import os

class Settings:
    # Madrasa Wi-Fi IP Whitelist Configuration (single IP or comma-separated list)
    MADRASA_WIFI_IP: str = os.getenv("MADRASA_WIFI_IP", "127.0.0.1,::1")
    
    # Database URL: Supports SQLite for local dev & PostgreSQL for production
    DATABASE_URL: str = os.getenv("DATABASE_URL", "sqlite:///./thandorappara_madrasa.db")
    
    # Secret Key for Security Token Operations
    SECRET_KEY: str = os.getenv("SECRET_KEY", "madrasa-super-secret-key-change-in-production")

settings = Settings()
