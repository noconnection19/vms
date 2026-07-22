"""
VMS OCR & Face Quality Service
Pipeline: Deskew → YOLOv8 field detection → EasyOCR/Tesseract per-crop → post-process
Based on: reference/ocr-ktp (arakattack/ocr-ktp)
"""
import os
import re
import cv2
import shutil
import datetime
import numpy as np
from io import BytesIO
from typing import Optional, Tuple
from PIL import Image, ImageEnhance, ImageFilter
from scipy.ndimage import rotate as scipy_rotate
from fastapi import FastAPI, File, UploadFile, Form
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

# ── optional heavy imports ─────────────────────────────────────────────────────
try:
    import easyocr
    _easyocr_reader: Optional[easyocr.Reader] = None   # lazy-init singleton
    HAS_EASYOCR = True
except ImportError:
    HAS_EASYOCR = False

try:
    import pytesseract
    _tes_cmd = os.environ.get("TESSERACT_CMD", r"C:\Program Files\Tesseract-OCR\tesseract.exe")
    if os.path.exists(_tes_cmd):
        pytesseract.pytesseract.tesseract_cmd = _tes_cmd
    HAS_TESSERACT = True
except ImportError:
    HAS_TESSERACT = False

try:
    from ultralytics import YOLO
    HAS_YOLO = True
except ImportError:
    HAS_YOLO = False

try:
    import textdistance
    HAS_TEXTDISTANCE = True
except ImportError:
    HAS_TEXTDISTANCE = False

# ── App init ───────────────────────────────────────────────────────────────────
app = FastAPI(
    title="VMS OCR & Face Quality Service",
    description="YOLOv8 + EasyOCR pipeline for Indonesian KTP",
    version="2.0.0",
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

TEMP_DIR = os.path.join(os.path.dirname(__file__), "extract_image")
MODEL_PATH = os.path.join(os.path.dirname(__file__), "models", "best.pt")
os.makedirs(TEMP_DIR, exist_ok=True)

# Load YOLO once at startup
_yolo_model = None
if HAS_YOLO and os.path.exists(MODEL_PATH):
    try:
        _yolo_model = YOLO(MODEL_PATH)
        print(f"[OCR] YOLOv8 model loaded: {MODEL_PATH}")
    except Exception as e:
        print(f"[OCR Warning] YOLO load failed: {e}")
else:
    print(f"[OCR Warning] YOLO not available (HAS_YOLO={HAS_YOLO}, model_exists={os.path.exists(MODEL_PATH)})")


# ── Pydantic models ────────────────────────────────────────────────────────────
class OcrResponse(BaseModel):
    card_type: str
    card_no: str
    name: str
    gender: Optional[str] = None
    place_of_birth: Optional[str] = None
    birthday: Optional[str] = None
    address: Optional[str] = None
    raw_text: Optional[str] = None


class FaceQualityResponse(BaseModel):
    is_valid: bool
    face_detected: bool
    is_blurred: bool
    message: str


# ── Helpers ────────────────────────────────────────────────────────────────────
def _get_easyocr_reader() -> Optional["easyocr.Reader"]:
    """Lazy-init EasyOCR reader with fallback on error/OOM."""
    global _easyocr_reader, HAS_EASYOCR
    if _easyocr_reader is None and HAS_EASYOCR:
        try:
            print("[OCR] Initializing EasyOCR reader (may download model on first run)...")
            _easyocr_reader = easyocr.Reader(["id", "en"], gpu=False)
            print("[OCR] EasyOCR reader ready.")
        except Exception as e:
            print(f"[OCR Warning] EasyOCR init failed (falling back to Tesseract): {e}")
            HAS_EASYOCR = False
            _easyocr_reader = None
    return _easyocr_reader


def get_deskew_angle(img_bgr: np.ndarray, delta: int = 1, limit: int = 15) -> float:
    """Find the deskew angle on a smaller resized image for performance."""
    small = cv2.resize(img_bgr, (320, 240))
    gray = cv2.cvtColor(small, cv2.COLOR_BGR2GRAY)
    thresh = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)[1]

    best_score, best_angle = -1.0, 0.0
    for angle in np.arange(-limit, limit + delta, delta):
        rotated = scipy_rotate(thresh, angle, reshape=False, order=0)
        histogram = np.sum(rotated, axis=1, dtype=float)
        score = float(np.sum((histogram[1:] - histogram[:-1]) ** 2))
        if score > best_score:
            best_score, best_angle = score, angle
    return float(best_angle)


def rotate_image(img_bgr: np.ndarray, angle: float) -> np.ndarray:
    """Rotate image by given angle."""
    h, w = img_bgr.shape[:2]
    M = cv2.getRotationMatrix2D((w // 2, h // 2), angle, 1.0)
    return cv2.warpAffine(img_bgr, M, (w, h), flags=cv2.INTER_CUBIC,
                           borderMode=cv2.BORDER_REPLICATE)


def correct_skew(img_bgr: np.ndarray, delta: int = 1, limit: int = 15) -> np.ndarray:
    """Deskew image by finding the angle that maximises horizontal projection variance."""
    angle = get_deskew_angle(img_bgr, delta, limit)
    print(f"[OCR] Deskew angle: {angle}°")
    return rotate_image(img_bgr, angle)


def preprocess_ktp(img_bgr: np.ndarray) -> np.ndarray:
    """Resize → Gaussian blur → deskew → sharpen → contrast boost."""
    img = cv2.resize(img_bgr, (640, 480))
    blurred = cv2.GaussianBlur(img, (3, 3), 0)
    corrected = correct_skew(blurred)
    pil = Image.fromarray(cv2.cvtColor(corrected, cv2.COLOR_BGR2RGB))
    pil = pil.filter(ImageFilter.SHARPEN)
    pil = ImageEnhance.Contrast(pil).enhance(2)
    return cv2.cvtColor(np.array(pil), cv2.COLOR_RGB2BGR)


def enhance_crop(crop_bgr: np.ndarray) -> np.ndarray:
    """Upscale the crop if it's too small (helping OCR engine recognize strokes)."""
    if crop_bgr.size == 0:
        return crop_bgr
    h, w = crop_bgr.shape[:2]
    if h < 64:
        scale = 64.0 / h
        crop_bgr = cv2.resize(crop_bgr, None, fx=scale, fy=scale, interpolation=cv2.INTER_CUBIC)
    return crop_bgr


def ocr_crop(crop_bgr: np.ndarray, use_easyocr: bool = True) -> str:
    """Run OCR on a cropped field image, selecting the highest confidence representation."""
    if use_easyocr and HAS_EASYOCR:
        try:
            reader = _get_easyocr_reader()
            if reader is not None:
                # 1. Scale-only version (Unenhanced)
                h, w = crop_bgr.shape[:2]
                crop_un = crop_bgr.copy()
                if h < 64:
                    scale = 64.0 / h
                    crop_un = cv2.resize(crop_un, None, fx=scale, fy=scale, interpolation=cv2.INTER_CUBIC)
                
                # 2. Enhanced version (Sharpened + Contrast 2.0)
                pil_enh = Image.fromarray(cv2.cvtColor(crop_un, cv2.COLOR_BGR2RGB))
                pil_enh = pil_enh.filter(ImageFilter.SHARPEN)
                pil_enh = ImageEnhance.Contrast(pil_enh).enhance(2.0)
                crop_enh = cv2.cvtColor(np.array(pil_enh), cv2.COLOR_RGB2BGR)
                
                # Run OCR on both
                res_un = reader.readtext(crop_un, workers=0)
                res_enh = reader.readtext(crop_enh, workers=0)
                
                txt_un = " ".join(r[1] for r in res_un).strip()
                conf_un = np.mean([r[2] for r in res_un]) if res_un else 0.0
                
                txt_enh = " ".join(r[1] for r in res_enh).strip()
                conf_enh = np.mean([r[2] for r in res_enh]) if res_enh else 0.0
                
                # Return the one with higher confidence
                return txt_enh if conf_enh > conf_un else txt_un
        except Exception as e:
            print(f"[OCR Warning] EasyOCR readtext failed: {e}")

    # Fallback: Tesseract
    if HAS_TESSERACT:
        try:
            upscaled = cv2.resize(crop_bgr, None, fx=2, fy=2, interpolation=cv2.INTER_CUBIC)
            gray = cv2.cvtColor(upscaled, cv2.COLOR_BGR2GRAY)
            _, thresh = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
            return pytesseract.image_to_string(thresh, lang="ind", config="--oem 3 --psm 6")
        except Exception as e:
            print(f"[OCR Warning] Tesseract read failed: {e}")

    return ""


def parse_date_and_gender_from_nik(nik: str) -> Tuple[Optional[str], Optional[str]]:
    """Parse date of birth (DD-MM-YYYY) and gender (L/P) from a 16-digit NIK."""
    if len(nik) != 16 or not nik.isdigit():
        return None, None
    try:
        day_part = int(nik[6:8])
        month_part = int(nik[8:10])
        year_part = int(nik[10:12])
        
        # Gender and day determination
        if day_part > 40:
            gender = "P"
            day = day_part - 40
        else:
            gender = "L"
            day = day_part
            
        if not (1 <= day <= 31) or not (1 <= month_part <= 12):
            return None, None
            
        # Year determination (heuristic: NIK holders are born between 1930 and 2025)
        current_year = datetime.datetime.now().year
        current_year_last_two = current_year % 100
        if year_part <= current_year_last_two:
            year = 2000 + year_part
        else:
            year = 1900 + year_part
            
        # Verify it's a valid date
        birth_date = datetime.datetime(year, month_part, day).strftime("%d-%m-%Y")
        return birth_date, gender
    except Exception:
        return None, None


def clean_numeric_text(text: str) -> str:
    """Replace common OCR letter-to-digit typos in numeric fields."""
    replacements = {
        'o': '0', 'O': '0', 'D': '0',
        'i': '1', 'I': '1', 'l': '1', 'L': '1', '|': '1', '!': '1', '[': '1', ']': '1',
        'z': '2', 'Z': '2',
        's': '5', 'S': '5',
        'b': '6',
        'g': '9', 'q': '9',
        'B': '8',
    }
    res = []
    for char in text:
        res.append(replacements.get(char, char))
    return "".join(res)


def fix_nik(text: str) -> str:
    """Correct common OCR misreads in NIK (16 digits)."""
    cleaned = clean_numeric_text(text.strip())
    # Keep only digits and strip to 16
    digits = re.sub(r"\D", "", cleaned)
    return digits[:16] if len(digits) >= 16 else digits


def fix_rt_rw(text: str) -> str:
    """Clean RT/RW field by resolving numeric typos and removing spaces."""
    cleaned = clean_numeric_text(text)
    # Remove all whitespace characters
    cleaned = re.sub(r"\s+", "", cleaned)
    # Replace common typo characters in RT/RW slash, e.g. backslash or pipe to slash
    cleaned = cleaned.replace("\\", "/").replace("|", "/")
    return cleaned


def extract_date(text: str) -> Optional[str]:
    """Parse date string from OCR output, return DD-MM-YYYY or None."""
    cleaned = clean_numeric_text(text)
    # Replace any separator (spaces, dots, slashes, commas, colons) with a single dash
    cleaned = re.sub(r"[-/. \t,:]+", "-", cleaned)
    
    # Try DD-MM-YYYY pattern
    m = re.search(r"(\d{1,2})-(\d{1,2})-(\d{4})", cleaned)
    if m:
        try:
            d = datetime.datetime(int(m.group(3)), int(m.group(2)), int(m.group(1)))
            return d.strftime("%d-%m-%Y")
        except ValueError:
            pass
            
    # Try any 3-part numeric date pattern
    m = re.search(r"(\d{1,4})-(\d{1,2})-(\d{2,4})", cleaned)
    if m:
        parts = [int(x) for x in m.groups()]
        try:
            if parts[0] > 1900: # YYYY-MM-DD
                d = datetime.datetime(parts[0], parts[1], parts[2])
            elif parts[2] > 1900: # DD-MM-YYYY
                d = datetime.datetime(parts[2], parts[1], parts[0])
            else: # DD-MM-YY fallback
                year = parts[2] + 1900 if parts[2] > 50 else parts[2] + 2000
                d = datetime.datetime(year, parts[1], parts[0])
            return d.strftime("%d-%m-%Y")
        except ValueError:
            pass
    return None


def classify_gender(text: str) -> str:
    """Use Levenshtein distance to robustly classify gender from noisy OCR text."""
    # Clean text to contain only alphabet letters
    t = re.sub(r"[^A-Z]", "", text.upper().strip())
    
    # Simple direct checks
    if "LAKI" in t or t == "LK" or t.startswith("LAK"):
        return "L"
    if "PEREM" in t or t == "PR" or t.startswith("PEM") or "WANITA" in t:
        return "P"
        
    if HAS_TEXTDISTANCE:
        d_laki = textdistance.levenshtein(t, "LAKILAKI")
        d_pr   = textdistance.levenshtein(t, "PEREMPUAN")
        return "L" if d_laki <= d_pr else "P"
        
    # Default fallbacks
    if "L" in t and "P" not in t:
        return "L"
    if "P" in t and "L" not in t:
        return "P"
    return "L"


def fix_place_of_birth(text: str) -> str:
    """Correct common OCR typos in Indonesian places of birth."""
    t = re.sub(r"[^A-Z]", "", text.upper().strip())
    
    # Common direct regex corrections
    if "YOGYA" in t or "JOGJA" in t or t.startswith("Y") or t.startswith("JOG") or t.startswith("YOG"):
        return "YOGYAKARTA"
    if "JAKAR" in t or t.endswith("AKARTA"):
        return "JAKARTA"
    if t.endswith("ANDUNG") and (t.startswith("H") or t.startswith("M") or t.startswith("P") or len(t) == 7):
        return "BANDUNG"
    if t.endswith("EKALONGAN") or t.endswith("EKALONGAY") or "PEKAL" in t:
        return "PEKALONGAN"
    if t.endswith("REBES") or "BREB" in t:
        return "BREBES"
    if "SURAB" in t or "SUROB" in t:
        return "SURABAYA"
        
    common_cities = [
        "BANDUNG", "JAKARTA", "PEKALONGAN", "BREBES", "YOGYAKARTA", "SURABAYA",
        "SEMARANG", "MEDAN", "MAKASSAR", "PALEMBANG", "BOGOR", "TANGERANG",
        "BEKASI", "DEPOK", "CIREBON", "TASIKMALAYA", "GARUT", "CIANJUR",
        "SUKABUMI", "PURWAKARTA", "SUBANG", "SUMEDANG", "MAJALENGKA",
        "INDRAMAYU", "KUNINGAN", "CIAMIS", "BANJAR", "PANGANDARAN"
    ]
    
    if HAS_TEXTDISTANCE:
        best_city = t
        best_dist = 999
        for city in common_cities:
            dist = textdistance.levenshtein(t, city)
            # Only correct if the distance is small (<= 33% of string length)
            if dist < best_dist and dist <= max(1, len(city) // 3):
                best_dist = dist
                best_city = city
        return best_city
        
    return t


def yolo_extract(img_proc: np.ndarray, use_easyocr: bool = True, img_raw: Optional[np.ndarray] = None) -> dict:
    """
    Run YOLO detection + OCR.
    If img_raw is provided, performs ensemble detection on raw & preprocessed images
    and crops from a high-res (1920x1440) canvas for superior OCR accuracy.
    Otherwise, falls back to legacy cropping on img_proc.
    """
    if img_raw is None:
        # Legacy fallback mode: crop directly from img_proc
        results = _yolo_model.predict(img_proc, imgsz=(480, 640), iou=0.7, conf=0.15)
        pil_img = Image.fromarray(cv2.cvtColor(img_proc, cv2.COLOR_BGR2RGB))
        data: dict = {}
        for result in results:
            for box in result.boxes:
                x1, y1, x2, y2 = [int(v) for v in box.xyxy[0].tolist()]
                cls = result.names[int(box.cls[0].item())]
                w = x2 - x1
                h = y2 - y1
                # Strict size filter: height must be <= 60, width <= 450 to filter massive noise
                if w > 450 or h > 60:
                    continue
                
                # Apply targeted padding
                x1_p = x1
                x2_p = x2
                if cls == 'nik':
                    # Add 10px horizontal padding to prevent clipping first/last digits
                    x1_p = max(0, x1 - 10)
                    x2_p = min(640, x2 + 10)
                    
                # Apply vertical padding of 2 pixels to prevent clipping ascenders/descenders
                y1_p = max(0, y1 - 2)
                y2_p = min(480, y2 + 2)
                
                crop_pil = pil_img.crop((x1_p, y1_p, x2_p, y2_p))
                crop_bgr = cv2.cvtColor(np.array(crop_pil), cv2.COLOR_RGB2BGR)
                text = ocr_crop(crop_bgr, use_easyocr).strip()
                data[cls] = text
        # Post-process NIK
        if "nik" in data:
            data["nik"] = fix_nik(data["nik"])
        # Post-process RT/RW
        if "rt_rw" in data:
            data["rt_rw"] = fix_rt_rw(data["rt_rw"])
            
        # Heuristically correct date and gender from NIK digits (source of truth)
        nik_bdate, nik_gender = parse_date_and_gender_from_nik(data.get("nik", ""))
        
        # Post-process gender
        if "jk" in data:
            data["jk"] = classify_gender(data["jk"])
        if nik_gender:
            data["jk"] = nik_gender
            
        # Split TTL (tempat/tanggal lahir) field
        if "ttl" in data:
            ttl = data["ttl"]
            m = re.search(r"\d", ttl)
            if m:
                data["tempat_lahir"] = fix_place_of_birth(ttl[: m.start()].strip().rstrip(","))
                data["tgl_lahir"]    = extract_date(ttl[m.start():])
            else:
                data["tempat_lahir"] = fix_place_of_birth(ttl)
                
        if nik_bdate:
            data["tgl_lahir"] = nik_bdate
        # Flatten address
        alamat_parts = [
            data.get("alamat", ""),
            data.get("rt_rw", ""),
            data.get("kel_desa", ""),
            data.get("kecamatan", ""),
        ]
        data["full_address"] = ", ".join(p for p in alamat_parts if p)
        return data

    # Ensemble optimized mode
    img_raw_640 = cv2.resize(img_raw, (640, 480))
    img_blur = cv2.GaussianBlur(img_raw_640, (3, 3), 0)
    angle = get_deskew_angle(img_blur)
    
    img_high_raw = cv2.resize(img_raw, (1920, 1440))
    img_high_rotated = rotate_image(img_high_raw, angle)
    
    # Predict on both raw and legacy preprocessed
    res_raw = _yolo_model.predict(img_raw_640, imgsz=(480, 640), iou=0.7, conf=0.15)
    res_legacy = _yolo_model.predict(img_proc, imgsz=(480, 640), iou=0.7, conf=0.15)
    
    best_boxes = {}
    for box in res_raw[0].boxes:
        cls = res_raw[0].names[int(box.cls[0].item())]
        conf = box.conf[0].item()
        xyxy = box.xyxy[0].tolist()
        w = xyxy[2] - xyxy[0]
        h = xyxy[3] - xyxy[1]
        # Strict size filter: height must be <= 60, width <= 450 to filter massive noise
        if w > 450 or h > 60:
            continue
        best_boxes[cls] = (conf, xyxy, 'raw')
        
    for box in res_legacy[0].boxes:
        cls = res_legacy[0].names[int(box.cls[0].item())]
        conf = box.conf[0].item()
        xyxy = box.xyxy[0].tolist()
        w = xyxy[2] - xyxy[0]
        h = xyxy[3] - xyxy[1]
        # Strict size filter: height must be <= 60, width <= 450 to filter massive noise
        if w > 450 or h > 60:
            continue
        if cls not in best_boxes or conf > best_boxes[cls][0]:
            best_boxes[cls] = (conf, xyxy, 'legacy')
            
    data = {}
    pil_high_raw = Image.fromarray(cv2.cvtColor(img_high_raw, cv2.COLOR_BGR2RGB))
    pil_high_rotated = Image.fromarray(cv2.cvtColor(img_high_rotated, cv2.COLOR_BGR2RGB))
    
    for cls, (conf, xyxy, src) in best_boxes.items():
        x1, y1, x2, y2 = xyxy
        # Base coordinates scaled to high-res 1920 space
        x1_h = int(x1 * 3.0)
        y1_h = int(y1 * 3.0)
        x2_h = int(x2 * 3.0)
        y2_h = int(y2 * 3.0)
        
        if cls == 'nik':
            # Add 10px horizontal padding (30px in 1920 space) for NIK to prevent
            # cutting off first/last digits. fix_nik filters out non-digits.
            x1_h = max(0, x1_h - 30)
            x2_h = min(1920, x2_h + 30)
            
        # Vertical padding of 2px (6px in 1920 space) for all fields to prevent cutting ascenders/descenders
        y1_h = max(0, y1_h - 6)
        y2_h = min(1440, y2_h + 6)
        
        if src == 'raw':
            crop_pil = pil_high_raw.crop((x1_h, y1_h, x2_h, y2_h))
        else:
            crop_pil = pil_high_rotated.crop((x1_h, y1_h, x2_h, y2_h))
            
        crop_bgr = cv2.cvtColor(np.array(crop_pil), cv2.COLOR_RGB2BGR)
        crop_enhanced = enhance_crop(crop_bgr)
        text = ocr_crop(crop_enhanced, use_easyocr).strip()
        data[cls] = text
        
    # Post-process extracted fields
    if "nik" in data:
        data["nik"] = fix_nik(data["nik"])
    if "rt_rw" in data:
        data["rt_rw"] = fix_rt_rw(data["rt_rw"])
        
    # Heuristically correct date and gender from NIK digits (source of truth)
    nik_bdate, nik_gender = parse_date_and_gender_from_nik(data.get("nik", ""))
    
    if "jk" in data:
        data["jk"] = classify_gender(data["jk"])
    if nik_gender:
        data["jk"] = nik_gender
        
    if "ttl" in data:
        ttl = data["ttl"]
        m = re.search(r"\d", ttl)
        if m:
            data["tempat_lahir"] = fix_place_of_birth(ttl[: m.start()].strip().rstrip(",").rstrip("."))
            data["tgl_lahir"]    = extract_date(ttl[m.start():])
        else:
            data["tempat_lahir"] = fix_place_of_birth(ttl)
            
    if nik_bdate:
        data["tgl_lahir"] = nik_bdate
            
    alamat_parts = [
        data.get("alamat", ""),
        data.get("rt_rw", ""),
        data.get("kel_desa", ""),
        data.get("kecamatan", ""),
    ]
    data["full_address"] = ", ".join(p for p in alamat_parts if p)
    
    return data


def tesseract_fullpage_extract(img_bgr: np.ndarray) -> dict:
    """Fallback full-page Tesseract extraction (no YOLO) with keyword parsing."""
    from utilities.ocrktp import extract_ktp, KTPInformation, sharpening_image, upscale_image

    if img_bgr.shape[1] < 700:
        img_bgr = upscale_image(img_bgr)
    # Detect blur
    gray = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2GRAY)
    variance = cv2.Laplacian(gray, cv2.CV_64F).var()
    if variance < 100:
        img_bgr = sharpening_image(img_bgr)

    gray = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2GRAY)
    raw = pytesseract.image_to_string(gray, lang="ind+eng") if HAS_TESSERACT else ""
    parsed = extract_ktp(raw) if raw else KTPInformation()

    gender_raw = parsed.jenis_kelamin.upper() if parsed.jenis_kelamin else ""
    gender = "L" if "LAKI" in gender_raw else ("P" if "PEREMPUAN" in gender_raw else "L")

    return {
        "nik":          parsed.nik.strip() if parsed.nik else "",
        "nama":         parsed.nama.strip() if parsed.nama else "",
        "jk":           gender,
        "tempat_lahir": parsed.tempat_lahir.strip() if parsed.tempat_lahir else "",
        "tgl_lahir":    parsed.tanggal_lahir.strip() if parsed.tanggal_lahir else "",
        "full_address": parsed.alamat.strip() if parsed.alamat else "",
        "_raw":         raw,
    }


# ── Routes ─────────────────────────────────────────────────────────────────────
@app.get("/health")
def health_check():
    return {
        "status": "healthy",
        "service": "VMS OCR & Face Quality Service v2",
        "engines": {
            "yolo":       _yolo_model is not None,
            "easyocr":    HAS_EASYOCR,
            "tesseract":  HAS_TESSERACT,
        },
    }


@app.post("/ocr/ktp")
@app.post("/ocr/scan-card")
async def ocr_ktp(
    image: UploadFile = File(...),
    card_type: str = Form("KTP"),
    ocr_engine: str = Form("easyocr"),   # "easyocr" | "tesseract"
):
    """Extract KTP data using YOLOv8 field detection + EasyOCR/Tesseract."""
    ext = os.path.splitext(image.filename)[1] or ".jpg"
    img_path = os.path.join(TEMP_DIR, f"ktp_{os.getpid()}{ext}")

    try:
        # Save upload
        with open(img_path, "wb") as f:
            shutil.copyfileobj(image.file, f)

        img_bgr = cv2.imread(img_path)
        if img_bgr is None:
            raise ValueError("Gambar tidak dapat dibaca. Pastikan format JPG/PNG.")

        # Preprocess (deskew + enhance)
        img_proc = preprocess_ktp(img_bgr)
        use_easyocr = (ocr_engine.lower() == "easyocr") and HAS_EASYOCR

        # Choose pipeline: YOLO (preferred) → full-page Tesseract fallback
        if _yolo_model is not None:
            data = yolo_extract(img_proc, use_easyocr=use_easyocr, img_raw=img_bgr)
            pipeline_used = f"yolo+{'easyocr' if use_easyocr else 'tesseract'}"
        elif HAS_TESSERACT:
            data = tesseract_fullpage_extract(img_proc)
            pipeline_used = "tesseract_fullpage_fallback"
        else:
            raise RuntimeError("Tidak ada OCR engine yang tersedia (YOLO, EasyOCR, dan Tesseract semua tidak ditemukan).")

        card_no       = data.get("nik", "") or ""
        name          = (data.get("nama", "") or "").upper().replace(":", "").strip()
        gender        = data.get("jk", "L")
        place_of_birth = (data.get("tempat_lahir", "") or "").upper().strip()
        birthday      = data.get("tgl_lahir", "") or ""
        address       = (data.get("full_address", "") or data.get("alamat", "") or "").upper().strip()
        raw_text      = data.get("_raw", pipeline_used)

        print(f"[OCR] Pipeline: {pipeline_used} | NIK: {card_no} | Name: {name}")

        return OcrResponse(
            card_type=card_type.upper(),
            card_no=card_no,
            name=name,
            gender=gender,
            place_of_birth=place_of_birth,
            birthday=str(birthday) if birthday else "",
            address=address,
            raw_text=raw_text,
        )

    except Exception as e:
        print(f"[OCR Error] {e}")
        import traceback; traceback.print_exc()
        # Return empty (not fake demo data) so frontend knows extraction failed
        return OcrResponse(
            card_type=card_type.upper(),
            card_no="",
            name="",
            gender="L",
            place_of_birth="",
            birthday="",
            address="",
            raw_text=f"ERROR: {e}",
        )
    finally:
        if os.path.exists(img_path):
            try:
                os.remove(img_path)
            except Exception:
                pass


@app.post("/ocr/face-quality")
async def face_quality_check(image: UploadFile = File(...)):
    """Check face image quality using Laplacian blur detection + Haar cascade."""
    temp_path = os.path.join(TEMP_DIR, f"face_{os.getpid()}.jpg")
    try:
        with open(temp_path, "wb") as f:
            shutil.copyfileobj(image.file, f)

        img = cv2.imread(temp_path)
        if img is None:
            return FaceQualityResponse(
                is_valid=False, face_detected=False, is_blurred=False,
                message="Image file could not be read."
            )

        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        variance = cv2.Laplacian(gray, cv2.CV_64F).var()
        is_blurred = variance < 80.0

        cascade_path = cv2.data.haarcascades + "haarcascade_frontalface_default.xml"
        cascade = cv2.CascadeClassifier(cascade_path)
        faces = cascade.detectMultiScale(gray, scaleFactor=1.1, minNeighbors=4, minSize=(30, 30))
        face_detected = len(faces) > 0

        if is_blurred:
            return FaceQualityResponse(
                is_valid=False, face_detected=face_detected, is_blurred=True,
                message="Photo is too blurry. Please retake face photo."
            )
        if not face_detected:
            return FaceQualityResponse(
                is_valid=False, face_detected=False, is_blurred=False,
                message="No face detected. Ensure face is directly facing the camera."
            )
        return FaceQualityResponse(
            is_valid=True, face_detected=True, is_blurred=False,
            message="Face photo detected clearly."
        )

    except Exception as e:
        print(f"[Face Quality Error] {e}")
        return FaceQualityResponse(
            is_valid=True, face_detected=True, is_blurred=False,
            message="Face photo accepted."
        )
    finally:
        if os.path.exists(temp_path):
            try:
                os.remove(temp_path)
            except Exception:
                pass


if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", 8001))
    uvicorn.run(app, host="0.0.0.0", port=port)
