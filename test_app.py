from fastapi.testclient import TestClient
import os
import sys

sys.path.append(os.path.dirname(__file__))

from main import app, startup_db_seed
from database import Base, engine

client = TestClient(app)

def setup_module(module):
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    startup_db_seed()

def test_system_info_and_initial_seed():
    # 1. System Info
    res = client.get("/api/system/info")
    assert res.status_code == 200
    data = res.json()
    assert data["madrasa_name"] == "Thandorappara Juma Masjid Madrasa"
    assert data["allowed_wifi_ip"] == "127.0.0.1"

def test_3tier_rbac_unified_login_without_device_restriction():
    # 1. Super Admin Unified Login
    super_res = client.post("/api/login", json={"username": "superadmin", "password": "superadmin123"})
    assert super_res.status_code == 200
    s_data = super_res.json()
    assert s_data["role"] == "SUPER_ADMIN"
    assert s_data["redirect_url"] == "/superadmin"

    # 2. Super Admin updates Madrasa WiFi IP to 192.168.1.100
    ip_res = client.post("/api/superadmin/settings", json={"allowed_wifi_ip": "192.168.1.100"})
    assert ip_res.status_code == 200
    assert ip_res.json()["settings"]["allowed_wifi_ip"] == "192.168.1.100"

    # 3. Super Admin creates secondary Admin
    create_adm_res = client.post("/api/superadmin/admins/create", json={
        "username": "admin_vice",
        "password": "vicepassword123",
        "full_name": "Vice Principal Ustadh"
    })
    assert create_adm_res.status_code == 200
    adm_id = create_adm_res.json()["admin"]["id"]

    # 4. Super Admin blocks secondary Admin -> Login blocked
    client.post("/api/superadmin/admins/toggle-block", json={"admin_id": adm_id})
    blocked_login = client.post("/api/login", json={"username": "admin_vice", "password": "vicepassword123"})
    assert blocked_login.status_code == 403
    assert "deactivated" in blocked_login.json()["detail"]

    # 5. Principal Admin Unified Login
    adm_login = client.post("/api/login", json={"username": "admin", "password": "admin123"})
    assert adm_login.status_code == 200
    assert adm_login.json()["role"] == "ADMIN"
    assert adm_login.json()["redirect_url"] == "/admin"

    # 6. Ustadh Bilal logs in from ANY device (no device restriction on login)
    ustadh_seed_login = client.post("/api/login", json={"username": "ustadh_bilal", "password": "bilal123"})
    assert ustadh_seed_login.status_code == 200
    assert ustadh_seed_login.json()["role"] == "USTADH"
    assert ustadh_seed_login.json()["redirect_url"] == "/ustadh"

    # 7. Principal Admin provisions new Ustadh Tariq
    create_ustadh = client.post("/api/admin/ustadhs/create", json={
        "full_name": "Ustadh Tariq Al-Hassan",
        "username": "ustadh_tariq",
        "password": "tariqpassword123",
        "shift_id": 1
    })
    assert create_ustadh.status_code == 200
    assert create_ustadh.json()["ustadh"]["username"] == "ustadh_tariq"

    # 8. Ustadh Tariq logs in freely from any device
    ustadh_login = client.post("/api/login", json={"username": "ustadh_tariq", "password": "tariqpassword123"})
    assert ustadh_login.status_code == 200
    assert ustadh_login.json()["role"] == "USTADH"
    assert ustadh_login.json()["redirect_url"] == "/ustadh"

def test_leave_management_workflow():
    # 1. Ustadh Bilal logs in and submits Leave Request
    u_res = client.post("/api/login", json={"username": "ustadh_bilal", "password": "bilal123"})
    assert u_res.status_code == 200
    ustadh_id = u_res.json()["user"]["id"]

    leave_res = client.post("/api/ustadh/leaves/submit", json={
        "ustadh_id": ustadh_id,
        "start_date": "2026-08-15",
        "end_date": "2026-08-18",
        "reason": "Family Function in Calicut"
    })
    assert leave_res.status_code == 200
    leave_id = leave_res.json()["leave"]["id"]
    assert leave_res.json()["leave"]["status"] == "PENDING"

    # 2. Principal Admin reviews and Approves Leave
    admin_leaves = client.get("/api/admin/leaves").json()
    assert len(admin_leaves) >= 1

    review_res = client.post("/api/admin/leaves/review", json={
        "leave_id": leave_id,
        "status": "APPROVED",
        "admin_notes": "Granted by Principal"
    })
    assert review_res.status_code == 200
    assert review_res.json()["status"] == "APPROVED"

    # 3. Ustadh checks own leaves -> Status is APPROVED
    my_leaves = client.get(f"/api/ustadh/leaves/{ustadh_id}").json()
    assert my_leaves[0]["status"] == "APPROVED"

def test_device_recognition_and_clockin_protection():
    client.post("/api/admin/ustadhs/reset-device", json={"username": "ustadh_bilal"})
    u_res = client.post("/api/login", json={"username": "ustadh_bilal", "password": "bilal123"})
    ustadh_id = u_res.json()["user"]["id"]

    registered_phone_key = "USTADH-DEV-PHONE-BILAL-01"
    unregistered_phone_key = "USTADH-DEV-PHONE-ROGUE-99"

    # 1. Attempt Clock-In outside Madrasa WiFi -> Blocked by IP guard
    blocked_wifi = client.post("/api/ustadh/clock-in", json={
        "ustadh_id": ustadh_id,
        "device_key": registered_phone_key,
        "custom_ip": "10.0.0.99"
    })
    assert blocked_wifi.status_code == 403
    assert "Please connect to the Madrasa WiFi" in blocked_wifi.json()["detail"]

    # 2. First Clock-In from registered_phone_key on allowed WiFi -> Registers device & succeeds
    clock_in_res = client.post("/api/ustadh/clock-in", json={
        "ustadh_id": ustadh_id,
        "device_key": registered_phone_key,
        "override_time": "2026-08-08T08:25:00",
        "custom_ip": "192.168.1.100"
    })
    assert clock_in_res.status_code == 200
    assert clock_in_res.json()["log"]["is_late_in"] is True
    assert clock_in_res.json()["log"]["late_minutes"] == 25

    # 3. Attempt Clock-Out from an UNRECOGNIZED device key -> Blocked by Device Lock
    blocked_dev = client.post("/api/ustadh/clock-out", json={
        "ustadh_id": ustadh_id,
        "device_key": unregistered_phone_key,
        "override_time": "2026-08-08T15:30:00",
        "custom_ip": "192.168.1.100"
    })
    assert blocked_dev.status_code == 403
    assert "Device not recognized" in blocked_dev.json()["detail"]

    # 4. Clock-Out with the registered device key -> Success
    clock_out_res = client.post("/api/ustadh/clock-out", json={
        "ustadh_id": ustadh_id,
        "device_key": registered_phone_key,
        "override_time": "2026-08-08T15:30:00",
        "custom_ip": "192.168.1.100"
    })
    assert clock_out_res.status_code == 200
    assert clock_out_res.json()["log"]["is_early_out"] is True

def test_multi_ip_whitelist_management():
    # 1. Super Admin lists allowed IPs
    ips_res = client.get("/api/superadmin/ips")
    assert ips_res.status_code == 200
    initial_ips = ips_res.json()
    assert len(initial_ips) >= 2 # Seeded 127.0.0.1 and 192.168.1.100

    # 2. Super Admin adds a 3rd allowed IP (e.g. 10.0.0.50 for Secondary Block)
    add_res = client.post("/api/superadmin/ips/add", json={
        "ip_address": "10.0.0.50",
        "description": "Secondary Campus Block WiFi"
    })
    assert add_res.status_code == 200
    new_ip_id = add_res.json()["ip"]["id"]

    # 3. Ustadh Tariq clocks in from 10.0.0.50 -> Success
    u_res = client.post("/api/login", json={"username": "ustadh_tariq", "password": "tariqpassword123"})
    ustadh_id = u_res.json()["user"]["id"]

    clock_res = client.post("/api/ustadh/clock-in", json={
        "ustadh_id": ustadh_id,
        "device_key": "USTADH-DEV-TARIQ-01",
        "custom_ip": "10.0.0.50"
    })
    assert clock_res.status_code == 200

    # 4. Super Admin deletes the 3rd IP
    del_res = client.delete(f"/api/superadmin/ips/{new_ip_id}")
    assert del_res.status_code == 200

    # 5. Attempt clocking in with deleted IP -> Blocked
    client.post("/api/ustadh/clock-out", json={
        "ustadh_id": ustadh_id,
        "device_key": "USTADH-DEV-TARIQ-01",
        "custom_ip": "192.168.1.100"
    })

    clock_blocked = client.post("/api/ustadh/clock-in", json={
        "ustadh_id": ustadh_id,
        "device_key": "USTADH-DEV-TARIQ-01",
        "custom_ip": "10.0.0.50"
    })
    assert clock_blocked.status_code == 403
    assert "Please connect to the Madrasa WiFi" in clock_blocked.json()["detail"]

if __name__ == "__main__":
    print("Running setup_module...")
    setup_module(None)
    print("Running test_system_info_and_initial_seed...")
    test_system_info_and_initial_seed()
    print("Running test_3tier_rbac_unified_login_without_device_restriction...")
    test_3tier_rbac_unified_login_without_device_restriction()
    print("Running test_leave_management_workflow...")
    test_leave_management_workflow()
    print("Running test_device_recognition_and_clockin_protection...")
    test_device_recognition_and_clockin_protection()
    print("Running test_multi_ip_whitelist_management...")
    test_multi_ip_whitelist_management()
    print("\n[SUCCESS] ALL THANDORAPPARA JUMA MASJID 3-TIER MULTI-IP TESTS PASSED SUCCESSFULLY!")
