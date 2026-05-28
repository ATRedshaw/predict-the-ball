from extensions import db
from datetime import datetime, timezone


class ActualStanding(db.Model):
    """
    A snapshot of the real Premier League table at a given gameweek.
    Populated/updated via cron job after each round of fixtures.
    The standings field is a JSON-encoded ordered list of team objects,
    e.g. [{"position": 1, "team": "Arsenal", "played": 10, "points": 25}, ...]
    """
    __tablename__ = "actual_standings"

    id = db.Column(db.Integer, primary_key=True)
    season = db.Column(db.String(9), nullable=False)  # e.g. "2025/2026"
    gameweek = db.Column(db.Integer, nullable=False)
    standings = db.Column(db.JSON, nullable=False)
    updated_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))

    # One snapshot per season + gameweek
    __table_args__ = (db.UniqueConstraint("season", "gameweek", name="uq_actual_standing_season_gw"),)

    def __repr__(self) -> str:
        return f"<ActualStanding season={self.season} gw={self.gameweek}>"
