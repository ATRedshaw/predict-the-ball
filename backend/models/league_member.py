from extensions import db
from datetime import datetime, timezone


class LeagueMember(db.Model):
    __tablename__ = "league_members"

    id = db.Column(db.Integer, primary_key=True)
    league_id = db.Column(db.Integer, db.ForeignKey("leagues.id"), nullable=False)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    # "owner" or "member"
    role = db.Column(db.String(10), nullable=False, default="member")
    joined_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))

    # Unique constraint — a user can only appear once per league
    __table_args__ = (db.UniqueConstraint("league_id", "user_id", name="uq_league_member"),)

    # Relationships
    league = db.relationship("League", back_populates="members")
    user = db.relationship("User", back_populates="league_memberships")

    def __repr__(self) -> str:
        return f"<LeagueMember user={self.user_id} league={self.league_id} role={self.role}>"
