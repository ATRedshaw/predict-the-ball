import secrets
import string
import uuid
from extensions import db
from datetime import datetime, timezone


def generate_invite_code() -> str:
    starts_with_letter = bool(secrets.randbits(1))
    characters = []

    for index in range(8):
        use_letter = (index % 2 == 0) == starts_with_letter
        alphabet = string.ascii_uppercase if use_letter else string.digits
        characters.append(secrets.choice(alphabet))

    return "".join(characters)


class League(db.Model):
    __tablename__ = "leagues"

    id = db.Column(db.Integer, primary_key=True)
    public_id = db.Column(
        db.String(36),
        unique=True,
        nullable=False,
        default=lambda: str(uuid.uuid4()),
        index=True,
    )
    name = db.Column(db.String(100), nullable=False)
    # Short unique invite code, e.g. "A7B2Q9Z4"
    code = db.Column(db.String(10), unique=True, nullable=False, default=generate_invite_code)
    season = db.Column(db.String(9), nullable=False)  # e.g. "2025/2026"
    created_by = db.Column(db.Integer, db.ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))

    # Relationships
    members = db.relationship("LeagueMember", back_populates="league", lazy="dynamic", cascade="all, delete-orphan")
    owner = db.relationship("User", foreign_keys=[created_by])

    def __repr__(self) -> str:
        return f"<League {self.name} ({self.code})>"
