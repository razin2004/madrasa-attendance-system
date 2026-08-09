# Thandorappara Juma Masjid Madrasa Attendance & Leave Management System

A production-ready, secure, and modern **3-Tier Attendance and Leave Management Web Application** designed specifically for **Thandorappara Juma Masjid Madrasa**.

---

## 🌟 Key Features

### 1. 3-Tier Role-Based Access Control (RBAC)
- **Super Admin (Management Committee)**:
  - Configure Madrasa WiFi IP whitelist (supports multi-IP networks and wildcards `*`).
  - Create and manage Principal Admin accounts with 1-click **Block / Activate** controls.
  - View-only master audit sheets for all Ustadh profiles, attendance records, and leave applications.
- **Admin (Principal Sadr Ustadh)**:
  - Provision Ustadh staff profiles with assigned shift timings (e.g., 08:00 AM – 04:00 PM).
  - Manage paired devices: **Reset Phone** bindings or **Authorize Secondary Device**.
  - Review, **Accept**, or **Decline** Ustadh leave applications.
  - Monitor daily shift attendance logs and punctuality metrics.
- **Ustadh (Staff Member)**:
  - Full-screen, responsive attendance terminal for daily **Clock In** and **Clock Out**.
  - Submit leave applications with date ranges and reasons, and track approval status in real-time.
  - View personal attendance history logs.
  - Developer Sandbox for simulating network IPs, shift timestamps, and device token alerts.

---

### 2. Network & Device Security Architecture
- **Multi-IP Whitelist Management**: Clock-ins and clock-outs are strictly validated against authorized Madrasa router IPs.
- **Device Locking**: On the first clock-in, the Ustadh's device is registered. Subsequent clock-ins and clock-outs require the registered device token.
- **Decoupled Sign-In**: Login is accessible from any device or browser without device lock restrictions; device locking is strictly enforced on punch actions.
- **Automated Punctuality Calculation**: Real-time calculation of late arrival minutes (`is_late_in`) and early departure minutes (`is_early_out`) based on assigned shift schedules.

---

### 3. UI & Experience Design
- **Sliding Navigation Drawers & Panels**: Off-canvas left sliding navigation drawer and smooth full-screen sliding content panels.
- **Obsidian Glass Aesthetics**: Frosted glass panels, glowing state badges (emerald for clock-in, rose for clock-out, amber for warnings).
- **Interactive Modals & Toasts**: Confirmation modals for critical actions and floating glassmorphic toast notification banners with progress timers.

---

## 🛠️ Technology Stack

- **Backend**: Python 3.10+, FastAPI, SQLAlchemy, Pydantic, Passlib, Bcrypt, Uvicorn
- **Frontend**: HTML5, Vanilla JavaScript, Tailwind CSS (via CDN), Lucide Icons, SweetAlert2
- **Database**: SQLite (default for development) / PostgreSQL (production-ready)

---

## 🚀 Quick Start Guide

### Prerequisites
- Python 3.10 or higher
- Git

### 1. Clone the Repository
```bash
git clone https://github.com/your-username/smart-attendance.git
cd smart-attendance
```

### 2. Create and Activate Virtual Environment
```bash
# Windows PowerShell
python -m venv venv
.\venv\Scripts\Activate.ps1

# macOS / Linux
python3 -m venv venv
source venv/bin/activate
```

### 3. Install Dependencies
```bash
pip install -r requirements.txt
```

### 4. Run the Application
```bash
python -m uvicorn main:app --reload --host 127.0.0.1 --port 8000
```
Open **[http://127.0.0.1:8000](http://127.0.0.1:8000)** in your browser.

---

## 🔑 Default Credentials & 1-Click Presets

On initial launch, the system automatically seeds the default accounts and standard Madrasa day shift:

| Role | Username | Password | Access Portal |
| :--- | :--- | :--- | :--- |
| **Super Admin (Management)** | `superadmin` | `superadmin123` | `/superadmin` |
| **Principal Admin (Sadr Ustadh)** | `admin` | `admin123` | `/admin` |
| **Ustadh (Staff Member)** | `ustadh_bilal` | `bilal123` | `/ustadh` |

*(You can also use the **Quick Presets** drawer on the login page for 1-click credential auto-fill.)*

---

## 🧪 Running Automated Tests

Run the full end-to-end test suite:
```bash
python test_app.py
```

Expected output:
```text
Running setup_module...
Running test_system_info_and_initial_seed...
Running test_3tier_rbac_unified_login_without_device_restriction...
Running test_leave_management_workflow...
Running test_device_recognition_and_clockin_protection...
Running test_multi_ip_whitelist_management...

[SUCCESS] ALL THANDORAPPARA JUMA MASJID 3-TIER MULTI-IP TESTS PASSED SUCCESSFULLY!
```

---

## 📂 Project Structure

```text
smart attendence/
├── .gitignore              # Ignored files (virtualenv, databases, caches)
├── requirements.txt        # Production dependencies
├── config.py               # Application configuration & env variables
├── database.py             # Database engine & session management
├── models.py               # SQLAlchemy ORM database models
├── schemas.py              # Pydantic validation schemas
├── schema.sql              # Raw SQL reference schema
├── main.py                 # FastAPI endpoints & business logic
├── test_app.py             # Automated unit & integration tests
├── static/                 # Frontend assets
│   ├── login.html          # Unified sign-in portal with preset drawer
│   ├── superadmin_dashboard.html # Super admin console with sliding panels
│   ├── admin_dashboard.html      # Principal admin console with sliding panels
│   ├── ustadh_dashboard.html     # Full-screen Ustadh portal with sliding panels
│   └── app.js              # Frontend logic, toast banners & sliding drawer handlers
└── README.md               # Project documentation
```

---

## 📜 License

Developed for **Thandorappara Juma Masjid**. All rights reserved &copy; 2026.
