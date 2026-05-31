import secrets
from extensions import db
from datetime import datetime, timezone


class League(db.Model):
    __tablename__ = "leagues"

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    # Short unique invite code, e.g. "X7K2PQ"
    code = db.Column(db.String(10), unique=True, nullable=False, default=lambda: secrets.token_urlsafe(6).upper()[:6])
    season = db.Column(db.String(9), nullable=False)  # e.g. "2025/2026"
    created_by = db.Column(db.Integer, db.ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))

    # Relationships
    members = db.relationship("LeagueMember", back_populates="league", lazy="dynamic", cascade="all, delete-orphan")
    owner = db.relationship("User", foreign_keys=[created_by])

    def __repr__(self) -> str:
        return f"<League {self.name} ({self.code})>"
