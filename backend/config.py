import os
from datetime import timedelta
from pathlib import Path
from dotenv import load_dotenv

load_dotenv()

_BASE_DIR = Path(__file__).resolve().parent


def _resolve_db_url(url: str) -> str:
    """Convert a relative sqlite:/// URL to an absolute path anchored to the
    project root, so the database is found regardless of the working directory.

    Args:
        url: Raw DATABASE_URL string from the environment.

    Returns:
        URL with an absolute file path when the scheme is sqlite, otherwise
        the original string unchanged.
    """
    if url == "sqlite:///:memory:":
        return url
    if url.startswith("sqlite:///") and not url.startswith("sqlite:////"):
        relative_part = url[len("sqlite:///"):]
        absolute_path = _BASE_DIR / relative_part
        return f"sqlite:///{absolute_path}"
    return url


def _csv_env(name: str) -> list[str]:
    """Parse a comma-separated environment variable."""
    return [
        value.strip()
        for value in os.environ.get(name, "").split(",")
        if value.strip()
    ]


def _bool_env(name: str, default: bool = False) -> bool:
    value = os.environ.get(name)
    if value is None:
        return default
    return value.strip().lower() in {"1", "true", "yes", "on"}


class Config:
    SECRET_KEY = os.environ["SECRET_KEY"]
    SQLALCHEMY_DATABASE_URI = _resolve_db_url(os.environ["DATABASE_URL"])
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    CORS_ORIGINS = _csv_env("CORS_ORIGINS")

    JWT_SECRET_KEY = os.environ["JWT_SECRET_KEY"]
    JWT_ACCESS_TOKEN_EXPIRES = timedelta(
        minutes=int(os.environ.get("JWT_ACCESS_TOKEN_MINUTES", "15")),
    )
    JWT_REFRESH_TOKEN_EXPIRES = timedelta(
        days=int(os.environ.get("JWT_REFRESH_TOKEN_DAYS", "60")),
    )

    REFRESH_COOKIE_NAME = os.environ.get("REFRESH_COOKIE_NAME", "ptb_refresh_token")
    REFRESH_COOKIE_PATH = "/api/auth"
    REFRESH_COOKIE_SAMESITE = os.environ.get("REFRESH_COOKIE_SAMESITE", "Lax")
    REFRESH_COOKIE_SECURE = _bool_env(
        "REFRESH_COOKIE_SECURE",
        any(origin.startswith("https://") for origin in CORS_ORIGINS),
    )

    MAIL_SERVER = os.environ["MAIL_SERVER"]
    MAIL_PORT = int(os.environ["MAIL_PORT"])
    MAIL_USE_TLS = True
    MAIL_USERNAME = os.environ["MAIL_USERNAME"]
    MAIL_PASSWORD = os.environ["MAIL_PASSWORD"]
    MAIL_DEFAULT_SENDER = os.environ["MAIL_DEFAULT_SENDER"]
