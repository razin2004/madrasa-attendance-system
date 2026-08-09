import os

try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

class Settings:
    # Environment & Debug
    ENVIRONMENT: str = os.getenv("ENVIRONMENT", "production")
    DEBUG: bool = os.getenv("DEBUG", "False").lower() in ("true", "1", "yes")
    
    # Madrasa Metadata
    MADRASA_NAME: str = os.getenv("MADRASA_NAME", "Thandorappara Juma Masjid Madrasa")
    
    # Madrasa Wi-Fi IP Whitelist Configuration (single IP or comma-separated list)
    ALLOWED_WIFI_IPS: str = os.getenv("ALLOWED_WIFI_IPS", "127.0.0.1,192.168.1.100")
    
    # Database URL: Supports SQLite for local dev & PostgreSQL for production
    DATABASE_URL: str = os.getenv("DATABASE_URL", "sqlite:///./thandorappara_madrasa.db")
    
    # Secret Key for Security Token Operations
    SECRET_KEY: str = os.getenv("SECRET_KEY", "madrasa-super-secret-key-change-in-production")

    # Initial Super Admin (Management Authority) Credentials
    SUPERADMIN_USERNAME: str = os.getenv("SUPERADMIN_USERNAME", "superadmin")
    SUPERADMIN_PASSWORD: str = os.getenv("SUPERADMIN_PASSWORD", "superadmin123")
    SUPERADMIN_NAME: str = os.getenv("SUPERADMIN_NAME", "Masjid Management Committee")

    # Initial Admin (Principal / Sadr Ustadh) Credentials
    ADMIN_USERNAME: str = os.getenv("ADMIN_USERNAME", "admin")
    ADMIN_PASSWORD: str = os.getenv("ADMIN_PASSWORD", "admin123")
    ADMIN_NAME: str = os.getenv("ADMIN_NAME", "Principal Sadr Ustadh")

settings = Settings()
