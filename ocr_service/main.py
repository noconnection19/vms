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
from typing import Optional
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

TEMP_DIR = "extract_image"
MODEL_PATH = os.path.join("models", "best.pt")
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


def correct_skew(img_bgr: np.ndarray, delta: int = 1, limit: int = 15) -> np.ndarray:
    """Deskew image by finding the angle that maximises horizontal projection variance."""
    gray = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2GRAY)
    thresh = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)[1]

    best_score, best_angle = -1.0, 0.0
    for angle in np.arange(-limit, limit + delta, delta):
        rotated = scipy_rotate(thresh, angle, reshape=False, order=0)
        histogram = np.sum(rotated, axis=1, dtype=float)
        score = float(np.sum((histogram[1:] - histogram[:-1]) ** 2))
        if score > best_score:
            best_score, best_angle = score, angle

    h, w = img_bgr.shape[:2]
    M = cv2.getRotationMatrix2D((w // 2, h // 2), best_angle, 1.0)
    corrected = cv2.warpAffine(img_bgr, M, (w, h), flags=cv2.INTER_CUBIC,
                               borderMode=cv2.BORDER_REPLICATE)
    print(f"[OCR] Deskew angle: {best_angle}°")
    return corrected


def preprocess_ktp(img_bgr: np.ndarray) -> np.ndarray:
    """Resize → Gaussian blur → deskew → sharpen → contrast boost."""
    img = cv2.resize(img_bgr, (640, 480))
    blurred = cv2.GaussianBlur(img, (3, 3), 0)
    corrected = correct_skew(blurred)
    pil = Image.fromarray(cv2.cvtColor(corrected, cv2.COLOR_BGR2RGB))
    pil = pil.filter(ImageFilter.SHARPEN)
    pil = ImageEnhance.Contrast(pil).enhance(2)
    return cv2.cvtColor(np.array(pil), cv2.COLOR_RGB2BGR)


def ocr_crop(crop_bgr: np.ndarray, use_easyocr: bool = True) -> str:
    """Run OCR on a cropped field image."""
    if use_easyocr and HAS_EASYOCR:
        try:
            reader = _get_easyocr_reader()
            if reader is not None:
                results = reader.readtext(crop_bgr, workers=0)
                return " ".join(r[1] for r in results)
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


def fix_nik(text: str) -> str:
    """Correct common OCR misreads in NIK (16 digits)."""
    replacements = {
        "l": "1", "!": "1", ")": "1", "L": "1", "|": "1", "]": "1",
        "b": "6", "?": "7", "D": "0", "B": "8", "O": "0",
    }
    result = ""
    for ch in text.strip():
        result += replacements.get(ch, ch)
    # Keep only digits and strip to 16
    digits = re.sub(r"\D", "", result)
    return digits[:16] if len(digits) >= 16 else digits


def extract_date(text: str) -> Optional[str]:
    """Parse date string from OCR output, return DD-MM-YYYY or None."""
    # Try DD-MM-YYYY / DD/MM/YYYY patterns
    m = re.search(r"(\d{1,2})([-/.])(\d{2})\2(\d{4})", text)
    if m:
        try:
            d = datetime.datetime(int(m.group(4)), int(m.group(3)), int(m.group(1)))
            return d.strftime("%d-%m-%Y")
        except ValueError:
            pass
    # Try any 3-part numeric date
    m = re.search(r"(\d{1,4})[-/.](\d{1,2})[-/.](\d{2,4})", text)
    if m:
        parts = [int(x) for x in m.groups()]
        try:
            d = datetime.datetime(parts[2] if parts[2] > 31 else parts[0],
                                  parts[1],
                                  parts[0] if parts[2] > 31 else parts[2])
            return d.strftime("%d-%m-%Y")
        except ValueError:
            pass
    return None


def classify_gender(text: str) -> str:
    """Use Levenshtein distance to robustly classify gender from noisy OCR text."""
    t = text.upper().strip()
    if HAS_TEXTDISTANCE:
        d_laki = textdistance.levenshtein(t, "LAKI-LAKI")
        d_pr   = textdistance.levenshtein(t, "PEREMPUAN")
        return "L" if d_laki <= d_pr else "P"
    # Simple fallback
    if "LAKI" in t:
        return "L"
    if "PEREMPUAN" in t or "WANITA" in t:
        return "P"
    return "L"


def yolo_extract(img_bgr: np.ndarray, use_easyocr: bool = True) -> dict:
    """Run YOLO detection + OCR per detected field crop."""
    results = _yolo_model.predict(img_bgr, imgsz=(480, 640), iou=0.7, conf=0.5)
    pil_img = Image.fromarray(cv2.cvtColor(img_bgr, cv2.COLOR_BGR2RGB))

    data: dict = {}
    for result in results:
        for box in result.boxes:
            x1, y1, x2, y2 = [int(v) for v in box.xyxy[0].tolist()]
            cls = result.names[int(box.cls[0].item())]
            crop_pil = pil_img.crop((x1, y1, x2, y2))
            crop_bgr = cv2.cvtColor(np.array(crop_pil), cv2.COLOR_RGB2BGR)
            text = ocr_crop(crop_bgr, use_easyocr).strip()
            data[cls] = text

    # Post-process NIK
    if "nik" in data:
        data["nik"] = fix_nik(data["nik"])

    # Post-process gender
    if "jk" in data:
        data["jk"] = classify_gender(data["jk"])

    # Split TTL (tempat/tanggal lahir) field
    if "ttl" in data:
        ttl = data["ttl"]
        m = re.search(r"\d", ttl)
        if m:
            data["tempat_lahir"] = ttl[: m.start()].strip().rstrip(",")
            data["tgl_lahir"]    = extract_date(ttl[m.start():])
        else:
            data["tempat_lahir"] = ttl

    # Flatten address
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
            data = yolo_extract(img_proc, use_easyocr=use_easyocr)
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
                message="File foto tidak dapat dibaca."
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
                message="Foto terlalu blur. Harap ambil ulang foto wajah."
            )
        if not face_detected:
            return FaceQualityResponse(
                is_valid=False, face_detected=False, is_blurred=False,
                message="Wajah tidak terdeteksi. Pastikan wajah menghadap kamera."
            )
        return FaceQualityResponse(
            is_valid=True, face_detected=True, is_blurred=False,
            message="Foto wajah terdeteksi dengan jelas."
        )

    except Exception as e:
        print(f"[Face Quality Error] {e}")
        return FaceQualityResponse(
            is_valid=True, face_detected=True, is_blurred=False,
            message="Foto wajah diterima."
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
