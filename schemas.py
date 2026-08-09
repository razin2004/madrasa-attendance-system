from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime, date

class UnifiedLoginRequest(BaseModel):
    username: str
    password: str
    device_key: Optional[str] = None

class UnifiedLoginResponse(BaseModel):
    message: str
    role: str # "SUPER_ADMIN", "ADMIN", "USTADH"
    redirect_url: str # "/superadmin", "/admin", "/ustadh"
    user: dict

class SystemSettingsUpdateRequest(BaseModel):
    madrasa_name: Optional[str] = "Thandorappara Juma Masjid Madrasa"
    allowed_wifi_ip: str

class AddIpRequest(BaseModel):
    ip_address: str
    description: Optional[str] = "Madrasa WiFi"

class AdminCreateRequest(BaseModel):
    username: str
    password: str
    full_name: str

class AdminToggleBlockRequest(BaseModel):
    admin_id: int

class UstadhCreateRequest(BaseModel):
    full_name: str
    username: str
    password: str
    shift_id: Optional[int] = 1

class UstadhUpdateRequest(BaseModel):
    full_name: Optional[str] = None
    password: Optional[str] = None
    shift_id: Optional[int] = None

class DeviceResetRequest(BaseModel):
    username: str

class AllowDeviceRequest(BaseModel):
    username: str

class UstadhClockInRequest(BaseModel):
    ustadh_id: int
    device_key: str
    override_time: Optional[str] = None
    custom_ip: Optional[str] = None

class UstadhClockOutRequest(BaseModel):
    ustadh_id: int
    device_key: str
    override_time: Optional[str] = None
    custom_ip: Optional[str] = None

class LeaveSubmitRequest(BaseModel):
    ustadh_id: int
    start_date: str # YYYY-MM-DD
    end_date: str   # YYYY-MM-DD
    reason: str

class LeaveReviewRequest(BaseModel):
    leave_id: int
    status: str # "APPROVED" or "REJECTED"
    admin_notes: Optional[str] = None
    admin_id: Optional[int] = None
