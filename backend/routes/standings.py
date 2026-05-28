from flask import Blueprint, request, jsonify

standings_bp = Blueprint("standings", __name__, url_prefix="/api/standings")


@standings_bp.get("/<string:season>/actual/latest")
def get_latest_actual(season: str):
    """
    Return the most recent actual Premier League table for the given season.
    """
    pass


@standings_bp.get("/<string:season>/actual/<int:gameweek>")
def get_actual_by_gameweek(season: str, gameweek: int):
    """
    Return the actual table snapshot for a specific gameweek.
    """
    pass


@standings_bp.get("/<string:season>/elo/latest")
def get_latest_elo(season: str):
    """
    Return the most recent ELO-projected final standings for the given season.
    """
    pass


@standings_bp.get("/<string:season>/elo/<int:gameweek>")
def get_elo_by_gameweek(season: str, gameweek: int):
    """
    Return the ELO projection snapshot for a specific gameweek.
    """
    pass


@standings_bp.get("/<string:season>/deadline")
def get_deadline(season: str):
    """
    Return the prediction deadline (first match kick-off) for the given season.
    """
    pass


@standings_bp.get("/<string:season>/compare")
def compare_elo_vs_actual(season: str):
    """
    Return a side-by-side comparison of the current actual table and the
    pre-deadline ELO projection (gameweek 0 snapshot) for the given season.
    """
    pass
