from datetime import datetime, timezone

from extensions import db


class EloProjection(db.Model):
    """Snapshot of ELO-simulated season finish probabilities.

    Generated whenever the actual standings change. Each row represents one
    complete Monte Carlo simulation run for a given season.

    ``projections`` is a JSON list of team objects sorted by mean projected
    finish position, e.g.:

    .. code-block:: json

        [
            {
                "team": "Arsenal",
                "mean_position": 1.8,
                "finish_probabilities": {"1": 45.2, "2": 30.1, "3": 12.4, ...}
            },
            ...
        ]

    ``finish_probabilities`` keys are string positions ``"1"`` through ``"20"``,
    values are percentage chances (0–100) of finishing there.
    """

    __tablename__ = "elo_projections"

    id = db.Column(db.Integer, primary_key=True)
    season = db.Column(db.String(9), nullable=False, index=True)  # e.g. "2026-27"
    projections = db.Column(db.JSON, nullable=False)
    simulation_count = db.Column(db.Integer, nullable=False, default=0, server_default="0")
    fixtures_simulated = db.Column(db.Integer, nullable=False, default=0, server_default="0")
    match_outcomes_simulated = db.Column(
        db.BigInteger,
        nullable=False,
        default=0,
        server_default="0",
    )
    updated_at = db.Column(
        db.DateTime,
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    def __repr__(self) -> str:
        return f"<EloProjection season={self.season} updated_at={self.updated_at}>"
