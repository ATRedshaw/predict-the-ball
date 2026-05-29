from extensions import db
from datetime import datetime, timezone


class PointsDeduction(db.Model):
    """
    An admin-applied points deduction for a specific team in a given season.

    Deductions are applied when calculating the actual league table. Multiple
    deductions can exist for the same team in the same season (e.g. two separate
    FFP rulings) and their values are summed.

    ``points`` is a positive integer representing the number of points removed.
    """
    __tablename__ = "points_deductions"

    id = db.Column(db.Integer, primary_key=True)
    season = db.Column(db.String(9), nullable=False)  # e.g. "2025-26"
    team = db.Column(db.String(100), nullable=False)
    points = db.Column(db.Integer, nullable=False)  # positive = points removed
    reason = db.Column(db.String(255), nullable=True)
    applied_at = db.Column(
        db.DateTime,
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    def __repr__(self) -> str:
        return f"<PointsDeduction season={self.season} team={self.team} points={self.points}>"
