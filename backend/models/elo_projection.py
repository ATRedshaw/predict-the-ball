from extensions import db
from datetime import datetime, timezone


class EloProjection(db.Model):
    """
    ELO-model projected final standings at a given gameweek.
    Generated/updated via cron job. The projections field is a JSON-encoded
    ordered list of team objects showing the model's predicted end-of-season finish,
    e.g. [{"position": 1, "team": "Arsenal", "projected_points": 84}, ...]
    """
    __tablename__ = "elo_projections"

    id = db.Column(db.Integer, primary_key=True)
    season = db.Column(db.String(9), nullable=False)  # e.g. "2025/2026"
    gameweek = db.Column(db.Integer, nullable=False)
    projections = db.Column(db.JSON, nullable=False)
    generated_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))

    # One projection snapshot per season + gameweek
    __table_args__ = (db.UniqueConstraint("season", "gameweek", name="uq_elo_projection_season_gw"),)

    def __repr__(self) -> str:
        return f"<EloProjection season={self.season} gw={self.gameweek}>"
