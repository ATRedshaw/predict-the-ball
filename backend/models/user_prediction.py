from extensions import db
from datetime import datetime, timezone


class UserPrediction(db.Model):
    """
    A user's predicted final Premier League standings for a season.
    One row per user per season. Predictions apply to all leagues the user belongs to.
    The standings field is a JSON-encoded ordered list of 20 team names,
    index 0 being predicted champions.
    """
    __tablename__ = "user_predictions"

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    season = db.Column(db.String(9), nullable=False)  # e.g. "2025/2026"
    # JSON array: ["Man City", "Arsenal", ..., "Wolves"]
    standings = db.Column(db.JSON, nullable=False)
    # Null before the season deadline passes; once kicked off, the sum of
    # |predicted_position - actual_position| across all 20 teams.
    current_points = db.Column(db.Integer, nullable=True)
    # Count of teams placed at exactly the correct position (differential = 0).
    exact_predictions = db.Column(db.Integer, nullable=True)
    submitted_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = db.Column(db.DateTime, onupdate=lambda: datetime.now(timezone.utc))

    # One prediction per user per season
    __table_args__ = (db.UniqueConstraint("user_id", "season", name="uq_user_prediction_season"),)

    # Relationships
    user = db.relationship("User", back_populates="predictions")

    def __repr__(self) -> str:
        return f"<UserPrediction user={self.user_id} season={self.season}>"
