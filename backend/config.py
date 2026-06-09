import os
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


class Config:
    SECRET_KEY = os.environ["SECRET_KEY"]
    SQLALCHEMY_DATABASE_URI = _resolve_db_url(os.environ["DATABASE_URL"])
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    CORS_ORIGINS = _csv_env("CORS_ORIGINS")

    JWT_SECRET_KEY = os.environ["JWT_SECRET_KEY"]
    JWT_ACCESS_TOKEN_EXPIRES = 60 * 60 * 24 * 60  # 60 days

    MAIL_SERVER = os.environ["MAIL_SERVER"]
    MAIL_PORT = int(os.environ["MAIL_PORT"])
    MAIL_USE_TLS = True
    MAIL_USERNAME = os.environ["MAIL_USERNAME"]
    MAIL_PASSWORD = os.environ["MAIL_PASSWORD"]
    MAIL_DEFAULT_SENDER = os.environ["MAIL_DEFAULT_SENDER"]
