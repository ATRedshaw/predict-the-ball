from extensions import db


class Deadline(db.Model):
    """
    Stores the prediction deadline for a given season — the kick-off time of the
    first match. Once this time passes, no predictions can be submitted or modified.
    """
    __tablename__ = "deadlines"

    id = db.Column(db.Integer, primary_key=True)
    season = db.Column(db.String(9), unique=True, nullable=False)  # e.g. "2025/2026"
    # Datetime of first match kick-off (UTC). Populated/updated via cron job.
    deadline_time = db.Column(db.DateTime, nullable=True)

    def __repr__(self) -> str:
        return f"<Deadline season={self.season} deadline={self.deadline_time}>"
