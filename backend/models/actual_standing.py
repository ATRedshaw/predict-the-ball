from extensions import db
from datetime import datetime, timezone


class ActualStanding(db.Model):
    """
    A snapshot of the real Premier League table, captured approximately once per day.

    Multiple snapshots per season are kept for historical tracking. The ``updated_at``
    timestamp identifies when each snapshot was recorded.

    ``standings`` is an ordered list of team objects, e.g.:
    ``[{"position": 1, "team": "Arsenal", "played": 10, "points": 25, ...}, ...]``
    """
    __tablename__ = "actual_standings"

    id = db.Column(db.Integer, primary_key=True)
    season = db.Column(db.String(9), nullable=False)  # e.g. "2025-26"
    standings = db.Column(db.JSON, nullable=False)
    updated_at = db.Column(
        db.DateTime,
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    def __repr__(self) -> str:
        return f"<ActualStanding season={self.season} updated_at={self.updated_at}>"
