from sqlalchemy import Column, Integer, String, Boolean, DateTime, Time, Date, ForeignKey, Text
from sqlalchemy.orm import relationship
from datetime import datetime, time
from database import Base

class SystemSetting(Base):
    __tablename__ = "system_settings"

    id = Column(Integer, primary_key=True, index=True)
    madrasa_name = Column(String(150), default="Thandorappara Juma Masjid Madrasa")
    allowed_wifi_ip = Column(String(45), default="127.0.0.1")
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

class AllowedIP(Base):
    __tablename__ = "allowed_ips"

    id = Column(Integer, primary_key=True, index=True)
    ip_address = Column(String(45), unique=True, index=True, nullable=False)
    description = Column(String(150), default="Madrasa WiFi Network")
    created_at = Column(DateTime, default=datetime.utcnow)

class MadrasaShift(Base):
    __tablename__ = "madrasa_shifts"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), default="Standard Madrasa Day Shift")
    start_time = Column(Time, default=time(8, 0, 0))
    end_time = Column(Time, default=time(16, 0, 0))
    grace_period_minutes = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)

    users = relationship("User", back_populates="shift")
    attendance_logs = relationship("AttendanceLog", back_populates="shift")

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(50), unique=True, index=True, nullable=False)
    password_hash = Column(String(255), nullable=False)
    full_name = Column(String(100), nullable=False)
    role = Column(String(20), default="USTADH", index=True) # "SUPER_ADMIN", "ADMIN", "USTADH"
    is_active = Column(Boolean, default=True)
    shift_id = Column(Integer, ForeignKey("madrasa_shifts.id"), nullable=True)
    can_add_device = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    shift = relationship("MadrasaShift", back_populates="users")
    devices = relationship("DeviceKey", back_populates="user", cascade="all, delete-orphan")
    attendance_logs = relationship("AttendanceLog", back_populates="ustadh", foreign_keys="AttendanceLog.ustadh_id", cascade="all, delete-orphan")
    leave_requests = relationship("LeaveRequest", back_populates="ustadh", foreign_keys="LeaveRequest.ustadh_id", cascade="all, delete-orphan")

class DeviceKey(Base):
    __tablename__ = "device_keys"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    device_key = Column(String(128), unique=True, index=True, nullable=False)
    device_name = Column(String(100), default="Primary Mobile Device")
    registered_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="devices")

class AttendanceLog(Base):
    __tablename__ = "attendance_logs"

    id = Column(Integer, primary_key=True, index=True)
    ustadh_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    shift_id = Column(Integer, ForeignKey("madrasa_shifts.id"), nullable=True)
    clock_in_time = Column(DateTime, nullable=False, default=datetime.utcnow)
    clock_out_time = Column(DateTime, nullable=True)
    is_late_in = Column(Boolean, default=False)
    late_minutes = Column(Integer, default=0)
    is_early_out = Column(Boolean, default=False)
    early_minutes = Column(Integer, default=0)
    ip_address = Column(String(45), nullable=False)
    device_key_used = Column(String(128), nullable=False)
    status = Column(String(20), default="CLOCKED_IN") # "CLOCKED_IN", "CLOCKED_OUT"
    created_at = Column(DateTime, default=datetime.utcnow)

    ustadh = relationship("User", back_populates="attendance_logs", foreign_keys=[ustadh_id])
    shift = relationship("MadrasaShift", back_populates="attendance_logs")

class LeaveRequest(Base):
    __tablename__ = "leave_requests"

    id = Column(Integer, primary_key=True, index=True)
    ustadh_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    start_date = Column(Date, nullable=False)
    end_date = Column(Date, nullable=False)
    reason = Column(Text, nullable=False)
    status = Column(String(20), default="PENDING") # "PENDING", "APPROVED", "REJECTED"
    reviewed_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    admin_notes = Column(Text, nullable=True)
    reviewed_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    ustadh = relationship("User", back_populates="leave_requests", foreign_keys=[ustadh_id])
    reviewer = relationship("User", foreign_keys=[reviewed_by])
