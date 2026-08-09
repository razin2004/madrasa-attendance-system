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
    response = client.get("/api/system/info")
    assert response.status_code == 200
    data = response.json()
    assert "Thandorappara Juma Masjid" in data["madrasa_name"]
    assert "allowed_wifi_ip" in data

    # Verify initial database starts cleanly with zero fake Ustadhs
    admin_ustadhs = client.get("/api/admin/ustadhs").json()
    # No pre-seeded fake ustadhs
    assert len(admin_ustadhs) == 0

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

    # 6. Principal Admin provisions real Ustadh Tariq
    create_ustadh = client.post("/api/admin/ustadhs/create", json={
        "full_name": "Ustadh Tariq Al-Hassan",
        "username": "ustadh_tariq",
        "password": "tariqpassword123",
        "shift_id": 1
    })
    assert create_ustadh.status_code == 200
    assert create_ustadh.json()["ustadh"]["username"] == "ustadh_tariq"

    # 7. Ustadh Tariq logs in freely from any device (no device restriction on login)
    ustadh_login = client.post("/api/login", json={"username": "ustadh_tariq", "password": "tariqpassword123"})
    assert ustadh_login.status_code == 200
    assert ustadh_login.json()["role"] == "USTADH"
    assert ustadh_login.json()["redirect_url"] == "/ustadh"

def test_leave_management_workflow():
    # 1. Ustadh Tariq logs in and submits Leave Request
    u_res = client.post("/api/login", json={"username": "ustadh_tariq", "password": "tariqpassword123"})
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
    client.post("/api/admin/ustadhs/reset-device", json={"username": "ustadh_tariq"})

    registered_phone_key = "USTADH-DEV-PHONE-TARIQ-01"
    unregistered_phone_key = "USTADH-DEV-PHONE-ROGUE-99"

    # 1. Login with the registered phone key — auto-registers the device (new flow)
    login_res = client.post("/api/login", json={
        "username": "ustadh_tariq",
        "password": "tariqpassword123",
        "device_key": registered_phone_key
    })
    assert login_res.status_code == 200
    login_data = login_res.json()
    assert login_data["device_status"] in ("newly_registered", "registered")
    assert login_data["active_device_key"] == registered_phone_key
    ustadh_id = login_data["user"]["id"]

    # 2. Attempt Clock-In outside Madrasa WiFi -> Blocked by IP guard
    blocked_wifi = client.post("/api/ustadh/clock-in", json={
        "ustadh_id": ustadh_id,
        "device_key": registered_phone_key,
        "custom_ip": "10.0.0.99"
    })
    assert blocked_wifi.status_code == 403
    assert "Please connect to the Madrasa WiFi" in blocked_wifi.json()["detail"]

    # 3. Clock-In from registered device on allowed WiFi -> Success
    clock_in_res = client.post("/api/ustadh/clock-in", json={
        "ustadh_id": ustadh_id,
        "device_key": registered_phone_key,
        "override_time": "2026-08-08T08:25:00",
        "custom_ip": "192.168.1.100"
    })
    assert clock_in_res.status_code == 200
    assert clock_in_res.json()["log"]["is_late_in"] is True
    assert clock_in_res.json()["log"]["late_minutes"] == 25

    # 4. Attempt Clock-Out from an UNRECOGNIZED device key -> Blocked by Device Lock
    blocked_dev = client.post("/api/ustadh/clock-out", json={
        "ustadh_id": ustadh_id,
        "device_key": unregistered_phone_key,
        "override_time": "2026-08-08T15:30:00",
        "custom_ip": "192.168.1.100"
    })
    assert blocked_dev.status_code == 403
    assert "Device not recognized" in blocked_dev.json()["detail"]

    # 5. Clock-Out with the registered device key -> Success
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
        "device_key": "USTADH-DEV-PHONE-TARIQ-01",
        "custom_ip": "10.0.0.50"
    })
    assert clock_res.status_code == 200

    # 4. Super Admin deletes the 3rd IP
    del_res = client.delete(f"/api/superadmin/ips/{new_ip_id}")
    assert del_res.status_code == 200

    # 5. Attempt clocking in with deleted IP -> Blocked
    client.post("/api/ustadh/clock-out", json={
        "ustadh_id": ustadh_id,
        "device_key": "USTADH-DEV-PHONE-TARIQ-01",
        "custom_ip": "192.168.1.100"
    })

    clock_blocked = client.post("/api/ustadh/clock-in", json={
        "ustadh_id": ustadh_id,
        "device_key": "USTADH-DEV-PHONE-TARIQ-01",
        "custom_ip": "10.0.0.50"
    })
    assert clock_blocked.status_code == 403
    assert "Please connect to the Madrasa WiFi" in clock_blocked.json()["detail"]

def test_multi_session_daily_limit_and_roster_history():
    # Provision fresh Ustadh Omar
    create_omar = client.post("/api/admin/ustadhs/create", json={
        "full_name": "Ustadh Omar Farooq",
        "username": "ustadh_omar",
        "password": "omarpassword123",
        "shift_id": 1
    })
    assert create_omar.status_code == 200
    ustadh_id = create_omar.json()["ustadh"]["id"]
    omar_key = "USTADH-DEV-OMAR-01"
    target_date = "2026-08-10"

    # Session 1: Clock In & Out
    s1_in = client.post("/api/ustadh/clock-in", json={
        "ustadh_id": ustadh_id,
        "device_key": omar_key,
        "override_time": f"{target_date}T08:00:00",
        "custom_ip": "192.168.1.100"
    })
    assert s1_in.status_code == 200
    assert s1_in.json()["session_number"] == 1
    assert s1_in.json()["remaining_sessions_today"] == 2

    s1_out = client.post("/api/ustadh/clock-out", json={
        "ustadh_id": ustadh_id,
        "device_key": omar_key,
        "override_time": f"{target_date}T10:00:00",
        "custom_ip": "192.168.1.100"
    })
    assert s1_out.status_code == 200
    assert s1_out.json()["session_number"] == 1

    # Session 2: Clock In & Out
    s2_in = client.post("/api/ustadh/clock-in", json={
        "ustadh_id": ustadh_id,
        "device_key": omar_key,
        "override_time": f"{target_date}T11:00:00",
        "custom_ip": "192.168.1.100"
    })
    assert s2_in.status_code == 200
    assert s2_in.json()["session_number"] == 2

    s2_out = client.post("/api/ustadh/clock-out", json={
        "ustadh_id": ustadh_id,
        "device_key": omar_key,
        "override_time": f"{target_date}T13:00:00",
        "custom_ip": "192.168.1.100"
    })
    assert s2_out.status_code == 200
    assert s2_out.json()["session_number"] == 2

    # Session 3: Clock In & Out
    s3_in = client.post("/api/ustadh/clock-in", json={
        "ustadh_id": ustadh_id,
        "device_key": omar_key,
        "override_time": f"{target_date}T14:00:00",
        "custom_ip": "192.168.1.100"
    })
    assert s3_in.status_code == 200
    assert s3_in.json()["session_number"] == 3
    assert s3_in.json()["remaining_sessions_today"] == 0

    s3_out = client.post("/api/ustadh/clock-out", json={
        "ustadh_id": ustadh_id,
        "device_key": omar_key,
        "override_time": f"{target_date}T16:00:00",
        "custom_ip": "192.168.1.100"
    })
    assert s3_out.status_code == 200
    assert s3_out.json()["session_number"] == 3

    # Attempt Session 4 on same day -> Must fail with 400
    s4_blocked = client.post("/api/ustadh/clock-in", json={
        "ustadh_id": ustadh_id,
        "device_key": omar_key,
        "override_time": f"{target_date}T17:00:00",
        "custom_ip": "192.168.1.100"
    })
    assert s4_blocked.status_code == 400
    assert "Daily punch limit reached" in s4_blocked.json()["detail"]

    # Test Today's Roster Endpoint
    roster_res = client.get("/api/attendance/today")
    assert roster_res.status_code == 200
    r_data = roster_res.json()
    assert r_data["total_ustadhs"] >= 2
    assert "roster" in r_data

    # Test Historical Attendance Explorer with Filters
    hist_all = client.get("/api/attendance/history")
    assert hist_all.status_code == 200
    assert hist_all.json()["summary"]["total_records"] >= 3

    hist_ustadh = client.get(f"/api/attendance/history?ustadh_id={ustadh_id}")
    assert hist_ustadh.status_code == 200
    assert len(hist_ustadh.json()["records"]) == 3

    hist_date = client.get(f"/api/attendance/history?date={target_date}")
    assert hist_date.status_code == 200
    assert len(hist_date.json()["records"]) >= 3

    hist_month = client.get("/api/attendance/history?month=2026-08")
    assert hist_month.status_code == 200
    assert len(hist_month.json()["records"]) >= 3

def test_two_device_registration_and_third_device_blocking():
    # 1. Create a fresh Ustadh
    res = client.post("/api/admin/ustadhs/create", json={
        "full_name": "Ustadh Zayd",
        "username": "ustadh_zayd",
        "password": "zaydpassword123",
        "shift_id": 1
    })
    assert res.status_code == 200
    zayd_id = res.json()["ustadh"]["id"]

    dev_1 = "USTADH-DEV-ZAYD-PHONE-01"
    dev_2 = "USTADH-DEV-ZAYD-LAPTOP-02"
    dev_3 = "USTADH-DEV-ZAYD-UNAUTH-03"

    # Device 1 logs in -> Auto-registered (1/2)
    l1 = client.post("/api/login", json={"username": "ustadh_zayd", "password": "zaydpassword123", "device_key": dev_1})
    assert l1.status_code == 200
    assert l1.json()["device_status"] == "newly_registered"
    assert l1.json()["active_device_key"] == dev_1
    assert l1.json()["registered_device_count"] == 1

    # Device 1 clocks in & out -> Success
    c1_in = client.post("/api/ustadh/clock-in", json={"ustadh_id": zayd_id, "device_key": dev_1, "custom_ip": "192.168.1.100"})
    assert c1_in.status_code == 200
    c1_out = client.post("/api/ustadh/clock-out", json={"ustadh_id": zayd_id, "device_key": dev_1, "custom_ip": "192.168.1.100"})
    assert c1_out.status_code == 200

    # Device 2 logs in -> Auto-registered (2/2)
    l2 = client.post("/api/login", json={"username": "ustadh_zayd", "password": "zaydpassword123", "device_key": dev_2})
    assert l2.status_code == 200
    assert l2.json()["device_status"] == "newly_registered"
    assert l2.json()["active_device_key"] == dev_2
    assert l2.json()["registered_device_count"] == 2

    # Device 2 clocks in & out -> Success
    c2_in = client.post("/api/ustadh/clock-in", json={"ustadh_id": zayd_id, "device_key": dev_2, "custom_ip": "192.168.1.100"})
    assert c2_in.status_code == 200
    c2_out = client.post("/api/ustadh/clock-out", json={"ustadh_id": zayd_id, "device_key": dev_2, "custom_ip": "192.168.1.100"})
    assert c2_out.status_code == 200

    # Device 3 logs in -> 2 devices already registered! Returns 'unregistered'
    l3 = client.post("/api/login", json={"username": "ustadh_zayd", "password": "zaydpassword123", "device_key": dev_3})
    assert l3.status_code == 200
    assert l3.json()["device_status"] == "unregistered"
    assert l3.json()["active_device_key"] is None
    assert l3.json()["registered_device_count"] == 2

    # Device 3 attempts clock-in -> Blocked with 403 Forbidden!
    c3_in = client.post("/api/ustadh/clock-in", json={"ustadh_id": zayd_id, "device_key": dev_3, "custom_ip": "192.168.1.100"})
    assert c3_in.status_code == 403
    assert "Device not recognized" in c3_in.json()["detail"]

    # Device 3 attempts clock-out -> Blocked with 403 Forbidden!
    c3_out = client.post("/api/ustadh/clock-out", json={"ustadh_id": zayd_id, "device_key": dev_3, "custom_ip": "192.168.1.100"})
    assert c3_out.status_code == 403
    assert "Device not recognized" in c3_out.json()["detail"]

    # Device 1 and Device 2 can still login and be recognized as 'registered'
    l1_again = client.post("/api/login", json={"username": "ustadh_zayd", "password": "zaydpassword123", "device_key": dev_1})
    assert l1_again.json()["device_status"] == "registered"

    l2_again = client.post("/api/login", json={"username": "ustadh_zayd", "password": "zaydpassword123", "device_key": dev_2})
    assert l2_again.json()["device_status"] == "registered"

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
    print("Running test_multi_session_daily_limit_and_roster_history...")
    test_multi_session_daily_limit_and_roster_history()
    print("Running test_two_device_registration_and_third_device_blocking...")
    test_two_device_registration_and_third_device_blocking()
    print("\n[SUCCESS] ALL THANDORAPPARA JUMA MASJID 3-TIER MULTI-IP & MULTI-SESSION TESTS PASSED SUCCESSFULLY!")

