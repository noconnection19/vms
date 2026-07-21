# Visitor Management System (VMS) 🚗🏢

A modern, full-stack Visitor Management System with automated ID card OCR scanning, self-service kiosk registration, gate access control, and real-time visitor tracking.

---

## 🏗 System Architecture & Tech Stack

The system consists of three main decoupled services:

```
[ Frontend (React + Vite) ] ──(HTTP)──> [ Backend API (Express + Node.js) ] ──> [ PostgreSQL DB ]
                                                     │
                                               (Multipart)
                                                     ▼
                                       [ OCR Microservice (FastAPI + YOLO) ]
```

### 1. Frontend (`src/frontend/`)
- **Framework**: React 18 + Vite
- **Styling**: Tailwind CSS + Phosphor Icons
- **Routing**: React Router v7
- **Port**: `http://localhost:5173`

### 2. Backend API (`src/backend/`)
- **Runtime**: Node.js + Express
- **Database**: PostgreSQL (`pg` driver with Railway Cloud / Local connection)
- **File Storage**: Local Multipart Uploads (`Uploads/`)
- **Port**: `http://localhost:5000`

### 3. OCR Microservice (`src/ocr_service/`)
- **Framework**: Python 3.x + FastAPI + Uvicorn
- **OCR Engine**: YOLOv8 Field Detection + EasyOCR / Tesseract OCR
- **Image Processing**: OpenCV, Pillow, NumPy
- **Port**: `http://localhost:8001`

---

## ✨ Key Features

- **📱 Self-Service Kiosk (`/kiosk`)**:
  - 5-step visitor self-registration flow.
  - Phone number history lookup (auto-fill returning visitors).
  - ID Card photo upload with instant OCR extraction (KTP/SIM/Passport).
  - Visitor selfie photo quality check.

- **🚪 Gate Access Control (`/admin/gate`)**:
  - Entrance Gate (Check-In) and Exit Gate (Check-Out) panels.
  - Primary workflow: Upload/scan ID card photo for automatic card number detection.
  - Optional/fallback manual card number input toggle.
  - Real-time gate response status (Gate Opened / Access Denied) with `DD/MM/YYYY HH:mm:ss` timestamping.

- **📊 Admin Dashboard (`/admin/dashboard`)**:
  - Live visitor metrics (Total Registered, Active Inside, Today Check-Outs).
  - Recent visit activity stream.

- **📋 Visit Logs & Visitor Management (`/admin/visits`, `/admin/visitors`)**:
  - Historical visit logs with formatted entry/exit timestamps.
  - Searchable registered visitor database.

---

## 📁 Repository Structure

```
src/
├── backend/                  # Express Node.js API
│   ├── db.js                 # PostgreSQL connection pool & schema init
│   ├── server.js             # Express app entrypoint & API routes setup
│   ├── routes/               # API route handlers
│   │   ├── visitorRoutes.js  # Visitor registration & OCR proxy endpoint
│   │   ├── gateRoutes.js     # Gate check-in/out logic & visit stats
│   │   └── adminRoutes.js    # Auth & dashboard management
│   └── Uploads/              # Saved card & visitor photo attachments
├── frontend/                 # React Single Page Application (SPA)
│   ├── src/
│   │   ├── pages/            # Page components (GateControlPage, KioskRegisterPage, etc.)
│   │   ├── utils/datetime.js # Centralized timezone & date formatter (DD/MM/YYYY)
│   │   └── context/          # Toast & UI context providers
│   └── vite.config.js
└── ocr_service/              # Python OCR FastAPI Microservice
    ├── main.py               # FastAPI server entrypoint
    ├── utilities/            # OCR preprocessing & validation helpers
    └── models/               # YOLO weights & trained OCR models
```

---

## 🚀 Getting Started

### Prerequisites
- **Node.js**: v18.x or higher
- **Python**: v3.9+ (with Virtual Environment)
- **PostgreSQL**: PostgreSQL database instance (or Railway Postgres cloud URL)

---

### 📦 Installation & Setup

#### 1. OCR Service
```bash
cd src/ocr_service
python -m venv venv

# Windows
.\venv\Scripts\Activate.ps1
# Linux / macOS
source venv/bin/activate

pip install -r requirements.txt
python main.py
```
> Runs at `http://localhost:8001`

#### 2. Backend API
```bash
cd src/backend
npm install

# (Optional) Create .env file for custom PostgreSQL URL
# DATABASE_URL=postgresql://user:password@host:port/dbname

npm start
```
> Runs at `http://localhost:5000`

#### 3. Frontend App
```bash
cd src/frontend
npm install
npm run dev
```
> Runs at `http://localhost:5173`

---

## 🔑 Default Admin Credentials

- **Username**: `admin`
- **Password**: `admin`
- **Login URL**: `http://localhost:5173/login`

---

## 🌐 Main API Endpoints Summary

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/v1/visitor/check-phone` | Lookup visitor profile by phone number |
| `POST` | `/api/v1/visitor/scan-ocr` | Process ID card image via Python OCR service |
| `POST` | `/api/v1/visitor/register` | Register new or returning visitor |
| `POST` | `/api/v1/gate/check-in` | Execute visitor entrance check-in by card number |
| `POST` | `/api/v1/gate/check-out` | Execute visitor exit check-out by card number |
| `GET` | `/api/v1/gate/visits` | Retrieve list of recent visit logs |
| `GET` | `/api/v1/gate/stats` | Retrieve real-time dashboard statistics |

---

## 📝 License

Internal Project - Visitor Management System (VMS).
