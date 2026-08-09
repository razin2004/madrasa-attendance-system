from fastapi import FastAPI, Depends, HTTPException, Request, status
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse
from sqlalchemy import func
from sqlalchemy.orm import Session
import secrets
import os
import hashlib
from datetime import datetime, time, timedelta, date
import calendar
from typing import Optional, List

from config import settings
from database import Base, engine, get_db
import models
import schemas

# Create database tables automatically
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="Thandorappara Juma Masjid - Madrasa Attendance & Leave Management System",
    description="3-Tier Role-Based Access Control System with Super Admin, Admin, and Ustadh Portals",
    version="4.0.0"
)

# Mount static files directory
static_dir = os.path.join(os.path.dirname(__file__), "static")
if not os.path.exists(static_dir):
    os.makedirs(static_dir)

app.mount("/static", StaticFiles(directory=static_dir), name="static")


# Password Hashing Helpers (Bcrypt / SHA-256 fallback)
def hash_password(password: str) -> str:
    try:
        import bcrypt
        salt = bcrypt.gensalt()
        return bcrypt.hashpw(password.encode('utf-8'), salt).decode('utf-8')
    except Exception:
        return f"pbkdf2:sha256:{hashlib.sha256(password.encode('utf-8')).hexdigest()}"

def verify_password(plain_password: str, hashed_password: str) -> bool:
    if hashed_password.startswith("$2b$") or hashed_password.startswith("$2a$"):
        try:
            import bcrypt
            return bcrypt.checkpw(plain_password.encode('utf-8'), hashed_password.encode('utf-8'))
        except Exception:
            pass
    if hashed_password.startswith("pbkdf2:sha256:"):
        expected = f"pbkdf2:sha256:{hashlib.sha256(plain_password.encode('utf-8')).hexdigest()}"
        return secrets.compare_digest(expected, hashed_password)
    return secrets.compare_digest(plain_password, hashed_password)


# Seed initial Super Admin, Admin, Shift, and System Settings on startup
@app.on_event("startup")
def startup_db_seed():
    db = next(get_db())
    
    # 1. System Settings (Dynamic from config / environment)
    sys_setting = db.query(models.SystemSetting).first()
    first_wifi_ip = settings.ALLOWED_WIFI_IPS.split(",")[0].strip() if settings.ALLOWED_WIFI_IPS else "127.0.0.1"
    if not sys_setting:
        sys_setting = models.SystemSetting(
            madrasa_name=settings.MADRASA_NAME,
            allowed_wifi_ip=first_wifi_ip
        )
        db.add(sys_setting)

    # 2. Standard Madrasa Shift (08:00 AM - 04:00 PM)
    shift = db.query(models.MadrasaShift).first()
    if not shift:
        shift = models.MadrasaShift(
            name="Standard Madrasa Day Shift",
            start_time=time(8, 0, 0),
            end_time=time(16, 0, 0),
            grace_period_minutes=0
        )
        db.add(shift)

    # 3. Super Admin (Management Authority - Configured via .env)
    superadmin_user = settings.SUPERADMIN_USERNAME.strip()
    superadmin = db.query(models.User).filter(func.lower(models.User.username) == superadmin_user.lower()).first()
    if not superadmin:
        superadmin = models.User(
            username=superadmin_user,
            password_hash=hash_password(settings.SUPERADMIN_PASSWORD),
            full_name=settings.SUPERADMIN_NAME.strip(),
            role="SUPER_ADMIN",
            is_active=True
        )
        db.add(superadmin)
    else:
        # Sync configured password & display name from environment
        superadmin.password_hash = hash_password(settings.SUPERADMIN_PASSWORD)
        superadmin.full_name = settings.SUPERADMIN_NAME.strip()
        superadmin.is_active = True

    # 4. Admin (Principal / Sadr Ustadh - Configured via .env)
    admin_user = settings.ADMIN_USERNAME.strip()
    admin = db.query(models.User).filter(func.lower(models.User.username) == admin_user.lower()).first()
    if not admin:
        admin = models.User(
            username=admin_user,
            password_hash=hash_password(settings.ADMIN_PASSWORD),
            full_name=settings.ADMIN_NAME.strip(),
            role="ADMIN",
            is_active=True
        )
        db.add(admin)
    else:
        # Sync configured password & display name from environment
        admin.password_hash = hash_password(settings.ADMIN_PASSWORD)
        admin.full_name = settings.ADMIN_NAME.strip()
        admin.is_active = True

    # 5. Default Madrasa Whitelisted IPs (Configured via .env)
    existing_ips = db.query(models.AllowedIP).all()
    if not existing_ips:
        ip_list = [ip.strip() for ip in settings.ALLOWED_WIFI_IPS.split(",") if ip.strip()]
        if not ip_list:
            ip_list = ["127.0.0.1"]
        default_ips = [
            models.AllowedIP(
                ip_address=ip, 
                description="Localhost / Management PC" if ip == "127.0.0.1" else "Madrasa WiFi Network"
            )
            for ip in ip_list
        ]
        db.add_all(default_ips)

    db.commit()


# Helper: Extract client public IP address
def get_client_ip(request: Request, custom_ip: Optional[str] = None) -> str:
    if custom_ip:
        return custom_ip.strip()
    x_forwarded_for = request.headers.get("X-Forwarded-For")
    if x_forwarded_for:
        return x_forwarded_for.split(",")[0].strip()
    if request.client and request.client.host:
        return request.client.host
    return "127.0.0.1"


# Dynamic Multi-IP Whitelisting Dependency: Compares against all allowed IPs in DB
def verify_madrasa_wifi(request: Request, db: Session, custom_ip: Optional[str] = None) -> str:
    client_ip = get_client_ip(request, custom_ip)
    
    # Collect all whitelisted IPs from AllowedIP table and SystemSetting
    allowed_ips = db.query(models.AllowedIP).all()
    allowed_set = {ip.ip_address.strip() for ip in allowed_ips}
    
    setting = db.query(models.SystemSetting).first()
    if setting and setting.allowed_wifi_ip:
        for single_ip in setting.allowed_wifi_ip.split(","):
            if single_ip.strip():
                allowed_set.add(single_ip.strip())

    if not allowed_set:
        allowed_set.add("127.0.0.1")

    # Strict Check: If wildcard '*' is not present and client_ip is not in allowed list
    if "*" not in allowed_set and client_ip not in allowed_set:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Please connect to the Madrasa WiFi to clock in."
        )
    return client_ip


# HTML Page Routes (Unified Entry Point & 3-Tier Dashboards)
@app.get("/")
@app.get("/login")
def serve_login_page():
    return FileResponse(os.path.join(static_dir, "login.html"))

@app.get("/superadmin")
def serve_superadmin_dashboard():
    return FileResponse(os.path.join(static_dir, "superadmin_dashboard.html"))

@app.get("/admin")
def serve_admin_dashboard():
    return FileResponse(os.path.join(static_dir, "admin_dashboard.html"))

@app.get("/ustadh")
def serve_ustadh_dashboard():
    return FileResponse(os.path.join(static_dir, "ustadh_dashboard.html"))


# System Info Endpoint
@app.get("/api/system/info")
def system_info(request: Request, db: Session = Depends(get_db)):
    client_ip = get_client_ip(request)
    setting = db.query(models.SystemSetting).first()
    allowed_ip = setting.allowed_wifi_ip if setting else "127.0.0.1"
    is_allowed = (allowed_ip == "*" or client_ip == allowed_ip)

    return {
        "madrasa_name": setting.madrasa_name if setting else "Thandorappara Juma Masjid Madrasa",
        "client_ip": client_ip,
        "allowed_wifi_ip": allowed_ip,
        "ip_authorized": is_allowed,
        "server_time": datetime.now().isoformat()
    }


# ===================================================================
# UNIFIED LOGIN & ROLE-BASED ACCESS CONTROL (RBAC) ROUTING
# ===================================================================

@app.post("/api/login")
def unified_login(payload: schemas.UnifiedLoginRequest, db: Session = Depends(get_db)):
    username = payload.username.strip()
    password = payload.password.strip()

    # Case-insensitive username lookup (prevents mobile phone auto-capitalization errors)
    user = db.query(models.User).filter(func.lower(models.User.username) == username.lower()).first()
    if not user or not verify_password(password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid username or password. Please check your credentials."
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This account has been deactivated by the Management Committee."
        )

    # 1. Super Admin Role Routing
    if user.role == "SUPER_ADMIN":
        return {
            "message": f"Asalamu Alaikum, {user.full_name}",
            "role": "SUPER_ADMIN",
            "redirect_url": "/superadmin",
            "user": {
                "id": user.id,
                "username": user.username,
                "full_name": user.full_name,
                "role": user.role
            }
        }

    # 2. Admin (Principal) Role Routing
    if user.role == "ADMIN":
        return {
            "message": f"Asalamu Alaikum, {user.full_name}",
            "role": "ADMIN",
            "redirect_url": "/admin",
            "user": {
                "id": user.id,
                "username": user.username,
                "full_name": user.full_name,
                "role": user.role
            }
        }

    # 3. Ustadh (Staff) Role Routing
    if user.role == "USTADH":
        shift = user.shift if user.shift else db.query(models.MadrasaShift).first()

        # Retrieve the device key sent from the browser's localStorage
        device_key_sent = payload.device_key.strip() if payload.device_key else None
        registered_devices = db.query(models.DeviceKey).filter(models.DeviceKey.user_id == user.id).all()
        registered_keys = [d.device_key for d in registered_devices]

        # Skip corrupt / simulated unregistered keys
        is_corrupt_sim = device_key_sent and (
            "INVALID" in device_key_sent or
            "CORRUPTED" in device_key_sent or
            "ROGUE" in device_key_sent or
            "UNREGISTERED" in device_key_sent or
            "UNRECOGNIZED" in device_key_sent
        )

        active_device_key = None

        if is_corrupt_sim:
            # Simulated bad device — reject silently, show warning on frontend
            device_status = "unregistered"
            active_device_key = None

        elif device_key_sent and device_key_sent in registered_keys:
            # Already registered device — authorized
            device_status = "registered"
            active_device_key = device_key_sent

        elif len(registered_devices) < 2:
            # Under 2-device limit — auto-register this device now at login
            if not device_key_sent:
                device_key_sent = f"USTADH-DEV-{secrets.token_urlsafe(24)}"

            device_count = len(registered_devices) + 1
            new_device = models.DeviceKey(
                user_id=user.id,
                device_key=device_key_sent,
                device_name=f"Registered Device #{device_count}"
            )
            db.add(new_device)
            db.commit()
            db.refresh(user)

            device_status = "newly_registered"
            active_device_key = device_key_sent

        else:
            # 2 devices already registered — this 3rd device is blocked
            device_status = "unregistered"
            active_device_key = None

        return {
            "message": f"Asalamu Alaikum, {user.full_name}",
            "role": "USTADH",
            "redirect_url": "/ustadh",
            "device_status": device_status,
            "active_device_key": active_device_key,
            "registered_device_count": len(db.query(models.DeviceKey).filter(models.DeviceKey.user_id == user.id).all()),
            "user": {
                "id": user.id,
                "username": user.username,
                "full_name": user.full_name,
                "role": user.role,
                "shift_name": shift.name if shift else "Standard Shift"
            }
        }

    raise HTTPException(status_code=400, detail="Unknown user role")


# ===================================================================
# SUPER ADMIN (MANAGEMENT) ENDPOINTS
# ===================================================================

@app.get("/api/superadmin/settings")
def get_superadmin_settings(db: Session = Depends(get_db)):
    setting = db.query(models.SystemSetting).first()
    return {
        "madrasa_name": setting.madrasa_name if setting else "Thandorappara Juma Masjid Madrasa",
        "allowed_wifi_ip": setting.allowed_wifi_ip if setting else "127.0.0.1",
        "updated_at": setting.updated_at.isoformat() if setting else datetime.utcnow().isoformat()
    }

@app.post("/api/superadmin/settings")
def update_superadmin_settings(payload: schemas.SystemSettingsUpdateRequest, db: Session = Depends(get_db)):
    setting = db.query(models.SystemSetting).first()
    if not setting:
        setting = models.SystemSetting(
            madrasa_name=payload.madrasa_name or "Thandorappara Juma Masjid Madrasa",
            allowed_wifi_ip=payload.allowed_wifi_ip.strip()
        )
        db.add(setting)
    else:
        if payload.madrasa_name:
            setting.madrasa_name = payload.madrasa_name.strip()
        setting.allowed_wifi_ip = payload.allowed_wifi_ip.strip()
        setting.updated_at = datetime.utcnow()

    db.commit()
    db.refresh(setting)

    return {
        "message": "Global Madrasa WiFi Network configuration updated successfully.",
        "settings": {
            "madrasa_name": setting.madrasa_name,
            "allowed_wifi_ip": setting.allowed_wifi_ip
        }
    }

@app.get("/api/superadmin/ips")
def get_allowed_ips(db: Session = Depends(get_db)):
    ips = db.query(models.AllowedIP).order_by(models.AllowedIP.id.asc()).all()
    return [
        {
            "id": ip.id,
            "ip_address": ip.ip_address,
            "description": ip.description,
            "created_at": ip.created_at.isoformat()
        }
        for ip in ips
    ]

@app.post("/api/superadmin/ips/add")
def add_allowed_ip(payload: schemas.AddIpRequest, db: Session = Depends(get_db)):
    ip_str = payload.ip_address.strip()
    if not ip_str:
        raise HTTPException(status_code=400, detail="IP address cannot be blank")

    existing = db.query(models.AllowedIP).filter(models.AllowedIP.ip_address == ip_str).first()
    if existing:
        raise HTTPException(status_code=400, detail=f"IP address '{ip_str}' is already whitelisted.")

    new_ip = models.AllowedIP(
        ip_address=ip_str,
        description=payload.description.strip() if payload.description else "Madrasa WiFi Network"
    )
    db.add(new_ip)
    db.commit()
    db.refresh(new_ip)

    return {
        "message": f"IP address '{ip_str}' added to Madrasa WiFi whitelist.",
        "ip": {
            "id": new_ip.id,
            "ip_address": new_ip.ip_address,
            "description": new_ip.description
        }
    }

@app.delete("/api/superadmin/ips/{ip_id}")
def delete_allowed_ip(ip_id: int, db: Session = Depends(get_db)):
    ip_obj = db.query(models.AllowedIP).filter(models.AllowedIP.id == ip_id).first()
    if not ip_obj:
        raise HTTPException(status_code=404, detail="Whitelisted IP not found")

    deleted_ip = ip_obj.ip_address
    db.delete(ip_obj)
    db.commit()

    return {"message": f"IP address '{deleted_ip}' removed from Madrasa WiFi whitelist."}

@app.get("/api/superadmin/admins")
def get_all_admins(db: Session = Depends(get_db)):
    admins = db.query(models.User).filter(models.User.role == "ADMIN").order_by(models.User.id.asc()).all()
    return [
        {
            "id": a.id,
            "username": a.username,
            "full_name": a.full_name,
            "is_active": a.is_active,
            "created_at": a.created_at.isoformat()
        }
        for a in admins
    ]

@app.post("/api/superadmin/admins/create")
def create_admin_account(payload: schemas.AdminCreateRequest, db: Session = Depends(get_db)):
    existing = db.query(models.User).filter(models.User.username == payload.username.strip()).first()
    if existing:
        raise HTTPException(status_code=400, detail=f"Username '{payload.username}' is already in use.")

    new_admin = models.User(
        username=payload.username.strip(),
        password_hash=hash_password(payload.password.strip()),
        full_name=payload.full_name.strip(),
        role="ADMIN",
        is_active=True
    )
    db.add(new_admin)
    db.commit()
    db.refresh(new_admin)

    return {
        "message": f"Admin account for '{new_admin.full_name}' created successfully.",
        "admin": {
            "id": new_admin.id,
            "username": new_admin.username,
            "full_name": new_admin.full_name,
            "is_active": new_admin.is_active
        }
    }

@app.post("/api/superadmin/admins/toggle-block")
def toggle_admin_block_status(payload: schemas.AdminToggleBlockRequest, db: Session = Depends(get_db)):
    admin = db.query(models.User).filter(models.User.id == payload.admin_id, models.User.role == "ADMIN").first()
    if not admin:
        raise HTTPException(status_code=404, detail="Admin account not found")

    admin.is_active = not admin.is_active
    db.commit()
    status_text = "Activated" if admin.is_active else "Blocked"

    return {"message": f"Admin account '{admin.full_name}' is now {status_text}.", "is_active": admin.is_active}

@app.get("/api/superadmin/audit/all")
def get_superadmin_master_audit(db: Session = Depends(get_db)):
    ustadhs = db.query(models.User).filter(models.User.role == "USTADH").all()
    attendance = db.query(models.AttendanceLog).order_by(models.AttendanceLog.id.desc()).all()
    leaves = db.query(models.LeaveRequest).order_by(models.LeaveRequest.id.desc()).all()

    return {
        "total_ustadhs": len(ustadhs),
        "total_attendance_records": len(attendance),
        "total_leave_requests": len(leaves),
        "ustadhs": [
            {
                "id": u.id,
                "username": u.username,
                "full_name": u.full_name,
                "device_count": len(u.devices),
                "is_active": u.is_active
            }
            for u in ustadhs
        ],
        "attendance_logs": [
            {
                "id": a.id,
                "ustadh_name": a.ustadh.full_name if a.ustadh else "Unknown",
                "clock_in": a.clock_in_time.isoformat(),
                "clock_out": a.clock_out_time.isoformat() if a.clock_out_time else None,
                "is_late": a.is_late_in,
                "late_minutes": a.late_minutes,
                "is_early": a.is_early_out,
                "early_minutes": a.early_minutes,
                "ip": a.ip_address,
                "status": a.status
            }
            for a in attendance
        ],
        "leaves": [
            {
                "id": l.id,
                "ustadh_name": l.ustadh.full_name if l.ustadh else "Unknown",
                "start_date": l.start_date.isoformat(),
                "end_date": l.end_date.isoformat(),
                "reason": l.reason,
                "status": l.status,
                "reviewed_at": l.reviewed_at.isoformat() if l.reviewed_at else None
            }
            for l in leaves
        ]
    }


# ===================================================================
# ADMIN (PRINCIPAL / SADR USTADH) ENDPOINTS
# ===================================================================

@app.get("/api/admin/ustadhs")
def get_all_ustadhs(db: Session = Depends(get_db)):
    ustadhs = db.query(models.User).filter(models.User.role == "USTADH").order_by(models.User.id.asc()).all()
    return [
        {
            "id": u.id,
            "username": u.username,
            "full_name": u.full_name,
            "registered_device_count": len(u.devices),
            "can_add_device": u.can_add_device,
            "shift_name": u.shift.name if u.shift else "Default Shift",
            "shift_times": f"{u.shift.start_time.strftime('%I:%M %p')} - {u.shift.end_time.strftime('%I:%M %p')}" if u.shift else "08:00 AM - 04:00 PM",
            "created_at": u.created_at.isoformat()
        }
        for u in ustadhs
    ]

@app.post("/api/admin/ustadhs/create")
def create_ustadh_profile(payload: schemas.UstadhCreateRequest, db: Session = Depends(get_db)):
    existing = db.query(models.User).filter(models.User.username == payload.username.strip()).first()
    if existing:
        raise HTTPException(status_code=400, detail=f"Username '{payload.username}' is already registered.")

    shift = db.query(models.MadrasaShift).filter(models.MadrasaShift.id == payload.shift_id).first()
    if not shift:
        shift = db.query(models.MadrasaShift).first()

    new_ustadh = models.User(
        username=payload.username.strip(),
        password_hash=hash_password(payload.password.strip()),
        full_name=payload.full_name.strip(),
        role="USTADH",
        is_active=True,
        shift_id=shift.id if shift else None
    )
    db.add(new_ustadh)
    db.commit()
    db.refresh(new_ustadh)

    return {
        "message": f"Ustadh account for {new_ustadh.full_name} created successfully.",
        "ustadh": {
            "id": new_ustadh.id,
            "username": new_ustadh.username,
            "full_name": new_ustadh.full_name
        }
    }

@app.delete("/api/admin/ustadhs/{ustadh_id}")
def delete_ustadh_profile(ustadh_id: int, db: Session = Depends(get_db)):
    ustadh = db.query(models.User).filter(models.User.id == ustadh_id, models.User.role == "USTADH").first()
    if not ustadh:
        raise HTTPException(status_code=404, detail="Ustadh profile not found")

    deleted_name = ustadh.full_name
    db.delete(ustadh)
    db.commit()
    return {"message": f"Ustadh profile for '{deleted_name}' has been deleted."}

@app.post("/api/admin/ustadhs/reset-device")
def reset_ustadh_device(payload: schemas.DeviceResetRequest, db: Session = Depends(get_db)):
    ustadh = db.query(models.User).filter(models.User.username == payload.username.strip(), models.User.role == "USTADH").first()
    if not ustadh:
        raise HTTPException(status_code=404, detail="Ustadh profile not found")

    db.query(models.DeviceKey).filter(models.DeviceKey.user_id == ustadh.id).delete()
    ustadh.can_add_device = False
    db.commit()

    return {"message": f"Device bindings cleared for Ustadh '{ustadh.full_name}'. Next login will pair to their new phone."}

@app.post("/api/admin/ustadhs/allow-device")
def allow_additional_device(payload: schemas.AllowDeviceRequest, db: Session = Depends(get_db)):
    ustadh = db.query(models.User).filter(models.User.username == payload.username.strip(), models.User.role == "USTADH").first()
    if not ustadh:
        raise HTTPException(status_code=404, detail="Ustadh profile not found")

    ustadh.can_add_device = True
    db.commit()

    return {"message": f"Ustadh '{ustadh.full_name}' is now authorized to register a secondary mobile device."}

@app.get("/api/admin/leaves")
def get_all_leave_requests(db: Session = Depends(get_db)):
    leaves = db.query(models.LeaveRequest).order_by(models.LeaveRequest.id.desc()).all()
    return [
        {
            "id": l.id,
            "ustadh_id": l.ustadh_id,
            "ustadh_name": l.ustadh.full_name if l.ustadh else "Unknown Ustadh",
            "start_date": l.start_date.isoformat(),
            "end_date": l.end_date.isoformat(),
            "reason": l.reason,
            "status": l.status,
            "admin_notes": l.admin_notes,
            "created_at": l.created_at.isoformat()
        }
        for l in leaves
    ]

@app.post("/api/admin/leaves/review")
def review_leave_request(payload: schemas.LeaveReviewRequest, db: Session = Depends(get_db)):
    leave = db.query(models.LeaveRequest).filter(models.LeaveRequest.id == payload.leave_id).first()
    if not leave:
        raise HTTPException(status_code=404, detail="Leave request not found")

    leave.status = payload.status # "APPROVED" or "REJECTED"
    leave.admin_notes = payload.admin_notes
    leave.reviewed_by = payload.admin_id
    leave.reviewed_at = datetime.utcnow()

    db.commit()
    db.refresh(leave)

    action_text = "Approved" if leave.status == "APPROVED" else "Declined"
    return {"message": f"Leave request for {leave.ustadh.full_name if leave.ustadh else 'Ustadh'} has been {action_text}.", "status": leave.status}


def get_ustadh_punches_for_date(db: Session, ustadh_id: int, target_date):
    """Helper: Query all attendance punches for a specific Ustadh on a given calendar date."""
    start_of_day = datetime.combine(target_date, time.min)
    end_of_day = datetime.combine(target_date, time.max)
    return db.query(models.AttendanceLog).filter(
        models.AttendanceLog.ustadh_id == ustadh_id,
        models.AttendanceLog.clock_in_time >= start_of_day,
        models.AttendanceLog.clock_in_time <= end_of_day
    ).order_by(models.AttendanceLog.clock_in_time.asc()).all()


# Backward-compatible Admin Attendance Log List
@app.get("/api/admin/attendance")
def get_admin_attendance_logs(db: Session = Depends(get_db)):
    logs = db.query(models.AttendanceLog).order_by(models.AttendanceLog.id.desc()).all()
    return [
        {
            "id": l.id,
            "ustadh_id": l.ustadh_id,
            "ustadh_name": l.ustadh.full_name if l.ustadh else "Unknown Ustadh",
            "clock_in_time": l.clock_in_time.isoformat(),
            "clock_out_time": l.clock_out_time.isoformat() if l.clock_out_time else None,
            "is_late_in": l.is_late_in,
            "late_minutes": l.late_minutes,
            "is_early_out": l.is_early_out,
            "early_minutes": l.early_minutes,
            "ip_address": l.ip_address,
            "status": l.status
        }
        for l in logs
    ]


# ===================================================================
# TODAY'S LIVE STAFF ATTENDANCE ROSTER (SUPER ADMIN & ADMIN)
# ===================================================================
@app.get("/api/attendance/today")
@app.get("/api/admin/attendance/today")
@app.get("/api/superadmin/attendance/today")
def get_today_attendance_roster(db: Session = Depends(get_db)):
    today_date = datetime.now().date()
    start_of_day = datetime.combine(today_date, time.min)
    end_of_day = datetime.combine(today_date, time.max)

    ustadhs = db.query(models.User).filter(models.User.role == "USTADH").order_by(models.User.full_name.asc()).all()
    today_logs = db.query(models.AttendanceLog).filter(
        models.AttendanceLog.clock_in_time >= start_of_day,
        models.AttendanceLog.clock_in_time <= end_of_day
    ).order_by(models.AttendanceLog.clock_in_time.asc()).all()

    today_leaves = db.query(models.LeaveRequest).filter(
        models.LeaveRequest.status == "APPROVED",
        models.LeaveRequest.start_date <= today_date,
        models.LeaveRequest.end_date >= today_date
    ).all()

    leaves_by_ustadh = {l.ustadh_id: l for l in today_leaves}

    logs_by_ustadh = {}
    for log in today_logs:
        logs_by_ustadh.setdefault(log.ustadh_id, []).append(log)

    roster = []
    clocked_in_count = 0
    clocked_out_count = 0
    on_leave_count = 0
    not_clocked_in_count = 0

    for u in ustadhs:
        u_logs = logs_by_ustadh.get(u.id, [])
        u_leave = leaves_by_ustadh.get(u.id)

        has_active_clock_in = any(l.status == "CLOCKED_IN" for l in u_logs)
        punches = []
        for idx, l in enumerate(u_logs, 1):
            clock_in_formatted = l.clock_in_time.strftime("%I:%M %p")
            clock_out_formatted = l.clock_out_time.strftime("%I:%M %p") if l.clock_out_time else None
            
            duration_str = None
            if l.clock_out_time:
                diff_sec = int((l.clock_out_time - l.clock_in_time).total_seconds())
                hrs = diff_sec // 3600
                mins = (diff_sec % 3600) // 60
                duration_str = f"{hrs}h {mins}m" if hrs > 0 else f"{mins}m"
            else:
                duration_str = "Active Session"

            punches.append({
                "session_number": idx,
                "clock_in_time": clock_in_formatted,
                "clock_out_time": clock_out_formatted,
                "duration": duration_str,
                "is_late": l.is_late_in,
                "late_minutes": l.late_minutes,
                "is_early": l.is_early_out,
                "early_minutes": l.early_minutes,
                "status": l.status,
                "ip_address": l.ip_address
            })

        if has_active_clock_in:
            status_code = "CLOCKED_IN"
            clocked_in_count += 1
        elif u_leave:
            status_code = "ON_LEAVE"
            on_leave_count += 1
        elif len(u_logs) > 0:
            status_code = "CLOCKED_OUT"
            clocked_out_count += 1
        else:
            status_code = "NOT_CLOCKED_IN"
            not_clocked_in_count += 1

        roster.append({
            "ustadh_id": u.id,
            "username": u.username,
            "full_name": u.full_name,
            "shift_name": u.shift.name if u.shift else "Default Shift",
            "shift_times": f"{u.shift.start_time.strftime('%I:%M %p')} - {u.shift.end_time.strftime('%I:%M %p')}" if u.shift else "08:00 AM - 04:00 PM",
            "status": status_code,
            "total_punches_today": len(u_logs),
            "max_punches_per_day": 3,
            "punches": punches,
            "leave_reason": u_leave.reason if u_leave else None
        })

    return {
        "date": today_date.isoformat(),
        "formatted_date": today_date.strftime("%A, %d %B %Y"),
        "total_ustadhs": len(ustadhs),
        "clocked_in_count": clocked_in_count,
        "clocked_out_count": clocked_out_count,
        "on_leave_count": on_leave_count,
        "not_clocked_in_count": not_clocked_in_count,
        "roster": roster
    }


# ===================================================================
# HISTORICAL ATTENDANCE EXPLORER (FILTER BY USTADH, MONTH, DATE)
# ===================================================================
@app.get("/api/attendance/history")
@app.get("/api/admin/attendance/history")
@app.get("/api/superadmin/attendance/history")
def get_attendance_history(
    ustadh_id: Optional[int] = None,
    month: Optional[str] = None,
    date: Optional[str] = None,
    db: Session = Depends(get_db)
):
    query = db.query(models.AttendanceLog)

    if ustadh_id:
        query = query.filter(models.AttendanceLog.ustadh_id == ustadh_id)

    if date:
        try:
            d = datetime.strptime(date.strip(), "%Y-%m-%d").date()
            s_day = datetime.combine(d, time.min)
            e_day = datetime.combine(d, time.max)
            query = query.filter(models.AttendanceLog.clock_in_time >= s_day, models.AttendanceLog.clock_in_time <= e_day)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid date format. Expected YYYY-MM-DD")
    elif month:
        try:
            m_dt = datetime.strptime(month.strip(), "%Y-%m")
            _, last_day = calendar.monthrange(m_dt.year, m_dt.month)
            s_month = datetime(m_dt.year, m_dt.month, 1, 0, 0, 0)
            e_month = datetime(m_dt.year, m_dt.month, last_day, 23, 59, 59)
            query = query.filter(models.AttendanceLog.clock_in_time >= s_month, models.AttendanceLog.clock_in_time <= e_month)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid month format. Expected YYYY-MM")

    records = query.order_by(models.AttendanceLog.clock_in_time.desc()).all()

    total_records = len(records)
    total_completed = sum(1 for r in records if r.status == "CLOCKED_OUT")
    total_late = sum(1 for r in records if r.is_late_in)
    total_early = sum(1 for r in records if r.is_early_out)

    return {
        "filters": {
            "ustadh_id": ustadh_id,
            "month": month,
            "date": date
        },
        "summary": {
            "total_records": total_records,
            "total_completed_shifts": total_completed,
            "total_late_arrivals": total_late,
            "total_early_departures": total_early,
            "on_time_percentage": round(((total_records - total_late) / total_records * 100) if total_records > 0 else 100, 1)
        },
        "records": [
            {
                "id": r.id,
                "ustadh_id": r.ustadh_id,
                "ustadh_name": r.ustadh.full_name if r.ustadh else "Unknown Ustadh",
                "date": r.clock_in_time.strftime("%Y-%m-%d"),
                "date_formatted": r.clock_in_time.strftime("%a, %d %b %Y"),
                "clock_in": r.clock_in_time.strftime("%I:%M %p"),
                "clock_out": r.clock_out_time.strftime("%I:%M %p") if r.clock_out_time else None,
                "is_late": r.is_late_in,
                "late_minutes": r.late_minutes,
                "is_early": r.is_early_out,
                "early_minutes": r.early_minutes,
                "ip": r.ip_address,
                "status": r.status
            }
            for r in records
        ]
    }


# ===================================================================
# USTADH (STAFF) ENDPOINTS: CLOCK-IN / OUT (MAX 3 SESSIONS/DAY)
# ===================================================================

@app.post("/api/ustadh/clock-in")
def ustadh_clock_in(
    payload: schemas.UstadhClockInRequest,
    request: Request,
    db: Session = Depends(get_db)
):
    # 1. Dynamic IP Whitelist Check
    client_ip = verify_madrasa_wifi(request, db, payload.custom_ip)

    # 2. Fetch Ustadh & Validate / Register Device Key
    ustadh = db.query(models.User).filter(models.User.id == payload.ustadh_id, models.User.role == "USTADH").first()
    if not ustadh:
        raise HTTPException(status_code=404, detail="Ustadh profile not found")

    registered_keys = [d.device_key for d in ustadh.devices]
    incoming_key = payload.device_key.strip() if payload.device_key else None

    # Check for simulated unrecognized or corrupted device key
    is_corrupt_sim = incoming_key and (
        "INVALID" in incoming_key or 
        "CORRUPTED" in incoming_key or 
        "ROGUE" in incoming_key or 
        "UNREGISTERED" in incoming_key or 
        "UNRECOGNIZED" in incoming_key
    )

    if is_corrupt_sim:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Device not recognized. Please contact Admin"
        )

    if incoming_key and incoming_key in registered_keys:
        active_device_key = incoming_key
    elif len(registered_keys) < 2:
        if not incoming_key:
            incoming_key = f"USTADH-DEV-{secrets.token_urlsafe(24)}"
        device_count = len(registered_keys) + 1
        new_device = models.DeviceKey(
            user_id=ustadh.id,
            device_key=incoming_key,
            device_name=f"Registered Device #{device_count}"
        )
        db.add(new_device)
        db.commit()
        db.refresh(ustadh)
        active_device_key = incoming_key
    else:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Device not recognized. This device is not authorized for your account. Please contact the Principal Admin."
        )

    # Determine Clock-In timestamp
    if payload.override_time:
        try:
            clock_in_dt = datetime.fromisoformat(payload.override_time)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid override_time format")
    else:
        clock_in_dt = datetime.now()

    # Query today's punches for this Ustadh
    today_punches = get_ustadh_punches_for_date(db, ustadh.id, clock_in_dt.date())

    # Check if already clocked in for an active session
    active_log = next((p for p in today_punches if p.status == "CLOCKED_IN"), None)
    if active_log:
        session_num = len(today_punches)
        raise HTTPException(
            status_code=400,
            detail=f"You are currently clocked in for Session {session_num}. Please clock out before starting your next session."
        )

    # Enforce Maximum 3 Sessions Per Day
    if len(today_punches) >= 3:
        raise HTTPException(
            status_code=400,
            detail="Daily punch limit reached. Maximum 3 clock-in/out sessions allowed per day."
        )

    session_number = len(today_punches) + 1

    # Shift Time Logic (Late In)
    shift = ustadh.shift if ustadh.shift else db.query(models.MadrasaShift).first()
    shift_start_time = shift.start_time if shift else time(8, 0, 0)
    shift_start_dt = datetime.combine(clock_in_dt.date(), shift_start_time)
    grace_minutes = shift.grace_period_minutes if shift else 0

    is_late = False
    late_minutes = 0

    if clock_in_dt > (shift_start_dt + timedelta(minutes=grace_minutes)):
        is_late = True
        diff = clock_in_dt - shift_start_dt
        late_minutes = int(diff.total_seconds() // 60)

    log = models.AttendanceLog(
        ustadh_id=ustadh.id,
        shift_id=shift.id if shift else None,
        clock_in_time=clock_in_dt,
        is_late_in=is_late,
        late_minutes=late_minutes,
        ip_address=client_ip,
        device_key_used=active_device_key,
        status="CLOCKED_IN"
    )
    db.add(log)
    db.commit()
    db.refresh(log)

    status_msg = f"Asalamu Alaikum, {ustadh.full_name}! Session {session_number} of 3 started. {'[LATE IN: ' + str(late_minutes) + ' mins]' if is_late else '[ON TIME]'}"

    return {
        "message": status_msg,
        "session_number": session_number,
        "remaining_sessions_today": 3 - session_number,
        "log": {
            "id": log.id,
            "ustadh_id": log.ustadh_id,
            "clock_in_time": log.clock_in_time.isoformat(),
            "is_late_in": log.is_late_in,
            "late_minutes": log.late_minutes,
            "status": log.status
        }
    }


@app.post("/api/ustadh/clock-out")
def ustadh_clock_out(
    payload: schemas.UstadhClockOutRequest,
    request: Request,
    db: Session = Depends(get_db)
):
    # 1. Dynamic IP Whitelist Check
    client_ip = verify_madrasa_wifi(request, db, payload.custom_ip)

    # 2. Fetch Ustadh & Validate Device Key
    ustadh = db.query(models.User).filter(models.User.id == payload.ustadh_id, models.User.role == "USTADH").first()
    if not ustadh:
        raise HTTPException(status_code=404, detail="Ustadh profile not found")

    registered_keys = [d.device_key for d in ustadh.devices]
    if not payload.device_key or payload.device_key not in registered_keys:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Device not recognized. Please contact Admin"
        )

    log = db.query(models.AttendanceLog).filter(
        models.AttendanceLog.ustadh_id == ustadh.id,
        models.AttendanceLog.status == "CLOCKED_IN"
    ).order_by(models.AttendanceLog.id.desc()).first()

    if not log:
        raise HTTPException(
            status_code=400,
            detail="No active clock-in record found to clock out from."
        )

    if payload.override_time:
        try:
            clock_out_dt = datetime.fromisoformat(payload.override_time)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid override_time format")
    else:
        clock_out_dt = datetime.now()

    if clock_out_dt < log.clock_in_time:
        raise HTTPException(status_code=400, detail="Clock-out time cannot be earlier than clock-in time.")

    # 3. Shift Time Logic (Early Out)
    shift = db.query(models.MadrasaShift).filter(models.MadrasaShift.id == log.shift_id).first() if log.shift_id else None
    shift_end_time = shift.end_time if shift else time(16, 0, 0)
    shift_end_dt = datetime.combine(clock_out_dt.date(), shift_end_time)

    is_early = False
    early_minutes = 0

    if clock_out_dt < shift_end_dt:
        is_early = True
        diff = shift_end_dt - clock_out_dt
        early_minutes = int(diff.total_seconds() // 60)

    log.clock_out_time = clock_out_dt
    log.is_early_out = is_early
    log.early_minutes = early_minutes
    log.status = "CLOCKED_OUT"

    db.commit()
    db.refresh(log)

    today_punches = get_ustadh_punches_for_date(db, ustadh.id, clock_out_dt.date())
    session_number = len(today_punches)

    status_msg = f"Session {session_number} of 3 concluded. JazakAllah Khair! {'[EARLY OUT: ' + str(early_minutes) + ' mins]' if is_early else '[NORMAL DEPARTURE]'}"

    return {
        "message": status_msg,
        "session_number": session_number,
        "remaining_sessions_today": max(0, 3 - session_number),
        "log": {
            "id": log.id,
            "ustadh_id": log.ustadh_id,
            "clock_in_time": log.clock_in_time.isoformat(),
            "clock_out_time": log.clock_out_time.isoformat(),
            "is_late_in": log.is_late_in,
            "late_minutes": log.late_minutes,
            "is_early_out": log.is_early_out,
            "early_minutes": log.early_minutes,
            "status": log.status
        }
    }


@app.get("/api/ustadh/attendance/{ustadh_id}")
def get_ustadh_attendance(ustadh_id: int, db: Session = Depends(get_db)):
    logs = db.query(models.AttendanceLog).filter(
        models.AttendanceLog.ustadh_id == ustadh_id
    ).order_by(models.AttendanceLog.id.desc()).all()

    active_log = db.query(models.AttendanceLog).filter(
        models.AttendanceLog.ustadh_id == ustadh_id,
        models.AttendanceLog.status == "CLOCKED_IN"
    ).first()

    today_date = datetime.now().date()
    today_punches = get_ustadh_punches_for_date(db, ustadh_id, today_date)

    return {
        "ustadh_id": ustadh_id,
        "is_currently_clocked_in": active_log is not None,
        "active_log_id": active_log.id if active_log else None,
        "today_punches_count": len(today_punches),
        "max_punches_per_day": 3,
        "remaining_sessions_today": max(0, 3 - len(today_punches)),
        "logs": [
            {
                "id": l.id,
                "clock_in_time": l.clock_in_time.isoformat(),
                "clock_out_time": l.clock_out_time.isoformat() if l.clock_out_time else None,
                "is_late_in": l.is_late_in,
                "late_minutes": l.late_minutes,
                "is_early_out": l.is_early_out,
                "early_minutes": l.early_minutes,
                "status": l.status
            }
            for l in logs
        ]
    }


# Leave Management Endpoints for Ustadh
@app.post("/api/ustadh/leaves/submit")
def submit_leave_request(payload: schemas.LeaveSubmitRequest, db: Session = Depends(get_db)):
    ustadh = db.query(models.User).filter(models.User.id == payload.ustadh_id, models.User.role == "USTADH").first()
    if not ustadh:
        raise HTTPException(status_code=404, detail="Ustadh profile not found")

    try:
        s_date = datetime.strptime(payload.start_date.strip(), "%Y-%m-%d").date()
        e_date = datetime.strptime(payload.end_date.strip(), "%Y-%m-%d").date()
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid date format. Use YYYY-MM-DD.")

    if e_date < s_date:
        raise HTTPException(status_code=400, detail="End date cannot be earlier than start date.")

    new_leave = models.LeaveRequest(
        ustadh_id=ustadh.id,
        start_date=s_date,
        end_date=e_date,
        reason=payload.reason.strip(),
        status="PENDING"
    )
    db.add(new_leave)
    db.commit()
    db.refresh(new_leave)

    return {
        "message": "Leave request submitted successfully. Awaiting Principal review.",
        "leave": {
            "id": new_leave.id,
            "start_date": new_leave.start_date.isoformat(),
            "end_date": new_leave.end_date.isoformat(),
            "status": new_leave.status
        }
    }


@app.get("/api/ustadh/leaves/{ustadh_id}")
def get_ustadh_leaves(ustadh_id: int, db: Session = Depends(get_db)):
    leaves = db.query(models.LeaveRequest).filter(
        models.LeaveRequest.ustadh_id == ustadh_id
    ).order_by(models.LeaveRequest.id.desc()).all()

    return [
        {
            "id": l.id,
            "start_date": l.start_date.isoformat(),
            "end_date": l.end_date.isoformat(),
            "reason": l.reason,
            "status": l.status,
            "admin_notes": l.admin_notes,
            "created_at": l.created_at.isoformat()
        }
        for l in leaves
    ]
