from extensions import db
from datetime import datetime, timezone


class User(db.Model):
    __tablename__ = "users"

    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(64), unique=True, nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False)
    password_hash = db.Column(db.String(256), nullable=False)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))

    # Relationships
    league_memberships = db.relationship("LeagueMember", back_populates="user", lazy="dynamic")
    predictions = db.relationship("UserPrediction", back_populates="user", lazy="dynamic")

    def __repr__(self) -> str:
        return f"<User {self.username}>"
