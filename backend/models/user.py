import secrets
from datetime import datetime, timedelta

from extensions import db, bcrypt

_CODE_TTL_MINUTES = 15
_RESEND_COOLDOWN_SECONDS = 60
_MAX_FAILED_CODE_ATTEMPTS = 5


class User(db.Model):
    __tablename__ = "users"

    id = db.Column(db.Integer, primary_key=True)
    first_name = db.Column(db.String(64), nullable=False)
    last_name = db.Column(db.String(64), nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False)
    password_hash = db.Column(db.String(256), nullable=False)
    is_verified = db.Column(db.Boolean, default=False, nullable=False)
    is_admin = db.Column(db.Boolean, default=False, nullable=False)
    token_version = db.Column(db.Integer, nullable=False, default=0, server_default="0")
    verification_code = db.Column(db.String(6), nullable=True)
    verification_code_expires_at = db.Column(db.DateTime, nullable=True)
    verification_code_sent_at = db.Column(db.DateTime, nullable=True)
    verification_code_failed_attempts = db.Column(
        db.Integer, nullable=False, default=0, server_default="0"
    )
    password_reset_code = db.Column(db.String(6), nullable=True)
    password_reset_code_expires_at = db.Column(db.DateTime, nullable=True)
    password_reset_code_sent_at = db.Column(db.DateTime, nullable=True)
    password_reset_code_failed_attempts = db.Column(
        db.Integer, nullable=False, default=0, server_default="0"
    )
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    # Relationships
    league_memberships = db.relationship(
        "LeagueMember", back_populates="user", lazy="dynamic",
        cascade="all, delete-orphan", passive_deletes=True,
    )
    predictions = db.relationship(
        "UserPrediction", back_populates="user", lazy="dynamic",
        cascade="all, delete-orphan", passive_deletes=True,
    )
    refresh_sessions = db.relationship(
        "RefreshSession", back_populates="user", lazy="dynamic",
        cascade="all, delete-orphan", passive_deletes=True,
    )

    def generate_verification_code(self) -> str:
        """Generate a fresh 6-digit verification code and store it with an expiry.

        Returns:
            The plaintext 6-digit code to include in the email.
        """
        code = f"{secrets.randbelow(1_000_000):06d}"
        now = datetime.utcnow()
        self.verification_code = code
        self.verification_code_expires_at = now + timedelta(minutes=_CODE_TTL_MINUTES)
        self.verification_code_sent_at = now
        self.verification_code_failed_attempts = 0
        return code

    def clear_verification_code(self) -> None:
        self.verification_code = None
        self.verification_code_expires_at = None
        self.verification_code_sent_at = None
        self.verification_code_failed_attempts = 0

    def record_failed_verification_code_attempt(self) -> bool:
        self.verification_code_failed_attempts = (
            self.verification_code_failed_attempts or 0
        ) + 1
        if self.verification_code_failed_attempts >= _MAX_FAILED_CODE_ATTEMPTS:
            self.clear_verification_code()
            return True
        return False

    def can_resend_verification_code(self) -> bool:
        """Check whether enough time has passed to send another verification code.

        Returns:
            True if the cooldown period has elapsed or no code has been sent yet.
        """
        if self.verification_code_sent_at is None:
            return True
        elapsed = (datetime.utcnow() - self.verification_code_sent_at).total_seconds()
        return elapsed >= _RESEND_COOLDOWN_SECONDS

    def generate_password_reset_code(self) -> str:
        """Generate a fresh 6-digit password-reset code and store it with an expiry.

        Returns:
            The plaintext 6-digit code to include in the email.
        """
        code = f"{secrets.randbelow(1_000_000):06d}"
        now = datetime.utcnow()
        self.password_reset_code = code
        self.password_reset_code_expires_at = now + timedelta(minutes=_CODE_TTL_MINUTES)
        self.password_reset_code_sent_at = now
        self.password_reset_code_failed_attempts = 0
        return code

    def clear_password_reset_code(self) -> None:
        self.password_reset_code = None
        self.password_reset_code_expires_at = None
        self.password_reset_code_sent_at = None
        self.password_reset_code_failed_attempts = 0

    def record_failed_password_reset_code_attempt(self) -> bool:
        self.password_reset_code_failed_attempts = (
            self.password_reset_code_failed_attempts or 0
        ) + 1
        if self.password_reset_code_failed_attempts >= _MAX_FAILED_CODE_ATTEMPTS:
            self.clear_password_reset_code()
            return True
        return False

    def can_resend_password_reset_code(self) -> bool:
        """Check whether enough time has passed to send another password-reset code.

        Returns:
            True if the cooldown period has elapsed or no code has been sent yet.
        """
        if self.password_reset_code_sent_at is None:
            return True
        elapsed = (datetime.utcnow() - self.password_reset_code_sent_at).total_seconds()
        return elapsed >= _RESEND_COOLDOWN_SECONDS

    def set_password(self, password: str) -> None:
        """Hash and store a plaintext password.

        Args:
            password: Plaintext password to hash.
        """
        self.password_hash = bcrypt.generate_password_hash(password).decode("utf-8")

    def check_password(self, password: str) -> bool:
        """Verify a plaintext password against the stored hash.

        Args:
            password: Plaintext password to check.

        Returns:
            True if the password matches, False otherwise.
        """
        return bcrypt.check_password_hash(self.password_hash, password)

    def __repr__(self) -> str:
        return f"<User {self.first_name} {self.last_name}>"
