import re
import json
import cv2
import tempfile
import numpy as np
from PIL import Image

class KTPInformation(object):
    def __init__(self):
        self.nik = ""
        self.nama = ""
        self.tempat_lahir = ""
        self.tanggal_lahir = ""
        self.jenis_kelamin = ""
        self.golongan_darah = ""
        self.alamat = ""
        self.rt = ""
        self.rw = ""
        self.kelurahan_atau_desa = ""
        self.kecamatan = ""
        self.agama = ""
        self.status_perkawinan = ""
        self.pekerjaan = ""
        self.kewarganegaraan = ""
        self.berlaku_hingga = "SEMUR HIDUP"

def word_to_number_converter(word):
    word_dict = {
        '|' : "1"
    }
    res = ""
    for letter in word:
        if letter in word_dict:
            res += word_dict[letter]
        else:
            res += letter
    return res

def nik_extract(word):
    word_dict = {
        'b' : "6",
        'e' : "2",
        '?' : "7",
    }
    res = ""
    for letter in word:
        if letter in word_dict:
            res += word_dict[letter]
        else:
            res += letter
    return res

def extract_ktp(extracted_result):
    result = KTPInformation()
    for word in extracted_result.split("\n"):
        if "NIK" in word:
            if ":" in word:
              word = word.split(' : ')
              result.nik = word[-1].replace("NIK", "")
              result.nik = nik_extract(result.nik)
            elif "NIK 1 " in word:
              word = word.split(' 1 ')
              result.nik = word[-1].replace("NIK", "")
              result.nik = nik_extract(result.nik)
            continue

        if "Nama" in word:
            word = word.split(':')
            result.nama = word[-1].replace('Nama ','')
            continue

        if "Tempat" in word or "Lahir" in word:
            word = word.split(':')
            if re.search("([0-9]{2}\-[0-9]{2}\-[0-9]{4})", word[-1]) is not None:
                result.tanggal_lahir = re.search("([0-9]{2}\-[0-9]{2}\-[0-9]{4})", word[-1])[0]
            result.tempat_lahir = word[-1].replace(result.tanggal_lahir, '')
            result.tempat_lahir = result.tempat_lahir.split(',')
            result.tempat_lahir = result.tempat_lahir[0].replace(' , ', '')

            continue

        if 'Darah' in word:
            if re.search("(LAKI-LAKI|LAKI|LELAKI|PEREMPUAN)", word) is not None:
                result.jenis_kelamin = re.search("(LAKI-LAKI|LAKI|LELAKI|PEREMPUAN)", word)[0]
                if result.jenis_kelamin == "LAKI" or result.jenis_kelamin == "LELAKI":
                    result.jenis_kelamin = "LAKI-LAKI"

            word = word.split(':')
            if "0" in word[-1]:
              word = 'O'
            if(re.search("(O|A|B|AB)", word[-1]) is not None):
                result.golongan_darah = re.search("(O|A|B|AB)", word[-1])[0]
            else:
                result.golongan_darah = '-'

        if 'Alamat' in word:
            word = word.split(':')
            result.alamat = word[-1].replace('Alamat ','')

        if 'NO.' in word:
            result.alamat = result.alamat + ' '+word

        if "Kecamalan" in word:
            if ":" in word:
                result.kecamatan = word.split(':')[1].strip()

        if "Kecamatan" in word:
            if ":" in word:
                result.kecamatan = word.split(':')[1].strip()

        if "Desa" in word:
            wrd = word.split()
            desa = []
            for wr in wrd:
                if not 'desa' in wr.lower():
                    desa.append(wr)
            result.kelurahan_atau_desa = ''.join(wr)

        if 'Kewarganegaraan' in word:
            if ":" in word:
                result.kewarganegaraan = word.split(':')[1].strip()
                if "WNI" in result.kewarganegaraan.upper():
                    result.kewarganegaraan = "WNI"
                elif "WNA" in result.kewarganegaraan.upper():
                    result.kewarganegaraan = "WNA"
            else:
                result.kewarganegaraan = word.split(' ')[1].strip()
                if "WNI" in result.kewarganegaraan.upper():
                    result.kewarganegaraan = "WNI"
                elif "WNA" in result.kewarganegaraan.upper():
                    result.kewarganegaraan = "WNA"

        if 'Pekerjaan' in word:
            wrod = word.split()
            pekerjaan = []
            for wr in wrod:
                if not '-' in wr:
                    pekerjaan.append(wr)
            result.pekerjaan = ' '.join(pekerjaan).replace('Pekerjaan', '').strip()
            result.pekerjaan = result.pekerjaan.split(':')
            result.pekerjaan = result.pekerjaan[-1]

        if 'Agama' in word:
            result.agama = word.replace('Agama',"").strip()
            if "ISLAM" in result.agama.upper():
              result.agama = "ISLAM"
            elif "KRISTEN" in result.agama.upper():
              result.agama = "KRISTEN"
            elif "BUDHA" in result.agama.upper():
              result.agama = "BUDHA"
            elif "KHONGHUCU" in result.agama.upper():
              result.agama = "KHONGHUCU"
            elif "KATOLIK" in result.agama.upper():
              result.agama = "KATOLIK"

        if 'Perkawinan' in word:
            if ':' in word:
                result.status_perkawinan = word.split(':')[1]
                if "KAWIN" in result.status_perkawinan.upper():
                    result.status_perkawinan = "KAWIN"
                elif "BELUM KAWIN" in result.status_perkawinan.upper():
                    result.status_perkawinan = "BELUM KAWIN"
                elif "CERAI HIDUP" in result.status_perkawinan.upper():
                    result.status_perkawinan = "CERAI HIDUP"
                elif "CERAI MATI" in result.status_perkawinan.upper():
                    result.status_perkawinan = "CERAI MATI"
            elif '.' in word:
                result.status_perkawinan = word.split('.')[1]
                if "KAWIN" in result.status_perkawinan.upper():
                    result.status_perkawinan = "KAWIN"
                elif "BELUM KAWIN" in result.status_perkawinan.upper():
                    result.status_perkawinan = "BELUM KAWIN"
                elif "CERAI HIDUP" in result.status_perkawinan.upper():
                    result.status_perkawinan = "CERAI HIDUP"
                elif "CERAI MATI" in result.status_perkawinan.upper():
                    result.status_perkawinan = "CERAI MATI"

        if "RTRW" in word:
            word = word.replace("RTRW ",'')
            if(len(word) == 7 and word[0] == "1"):
                result.rt = word[1:4]
                result.rw = word[4:7]
            elif(len(word) == 7 and word[3] == " "):
                result.rt = word[0:3]
                result.rw = word[4:7]

        if "RT/RW" in word:
            word = word.split(':')
            word = word[-1].replace('RT/RW ','')
            if "V" in word:
                result.rt = word.split('V')[0].strip()
                result.rw = word.split('V')[1].strip()
            else :
                result.rt = word.split('/')[0].strip()
                result.rw = word.split('/')[1].strip()
    return result

def to_json(data):
    return json.dumps(data.__dict__, indent=4)

def detect_blur(image):
    img = cv2.imread(image)
    if img is None:
        return 0, True
    gray_image = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    blur = cv2.Laplacian(gray_image, cv2.CV_64F).var()
    if blur < 100:
        return blur, True
    return blur, False

def set_image_dpi(file_path):
    im = Image.open(file_path)
    length_x, width_y = im.size
    factor = min(1, float(1024.0 / length_x))
    size = int(factor * length_x), int(factor * width_y)
    resample_filter = getattr(Image, 'Resampling', Image).LANCZOS if hasattr(Image, 'Resampling') else Image.BICUBIC
    im_resized = im.resize(size, resample_filter)

    temp_file = tempfile.NamedTemporaryFile(delete=False, suffix='.png')
    temp_filename = temp_file.name
    im_resized.save(temp_filename, dpi=(300, 300))
    return temp_filename

def sharpening_image(image):
    kernel = np.array([[0, -1, 0], [-1, 5, -1], [0, -1, 0]], np.float32)
    sharpen_image = cv2.filter2D(image, -1, kernel=kernel)
    return sharpen_image

def upscale_image(image):
    height, width = image.shape[:2]
    return cv2.resize(image, (width * 2, height * 2), interpolation=cv2.INTER_CUBIC)
