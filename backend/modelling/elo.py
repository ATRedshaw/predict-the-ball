"""Current ELO ratings for all teams.

Loads the optimised parameters from ``data/params/elo.json`` and the full
match history from ``data/preprocessed/results.csv``, runs the ELO simulation
chronologically, then prints a ranked table of current ratings to stdout.

Run from backend/:
    python modelling/elo.py
"""

import json
from pathlib import Path

import numpy as np
import pandas as pd

DATA_PATH = Path(__file__).parent / "data" / "preprocessed" / "results.csv"
PARAMS_PATH = Path(__file__).parent / "data" / "params" / "elo.json"


def _expected_score(rating_home: float, rating_away: float, home_advantage: float) -> float:
    """Compute the expected score (win probability) for the home team.

    Args:
        rating_home: Current ELO rating of the home team.
        rating_away: Current ELO rating of the away team.
        home_advantage: Additive rating bonus for the home team.

    Returns:
        Float in (0, 1) representing the home team's expected score.
    """
    return 1.0 / (1.0 + 10.0 ** ((rating_away - (rating_home + home_advantage)) / 400.0))


def _mov_multiplier(goal_diff: int, mov_weight: float) -> float:
    """Compute the margin-of-victory K-factor multiplier.

    Args:
        goal_diff: Absolute goal difference for the match.
        mov_weight: Interpolation weight between flat (0) and full MoV (1).

    Returns:
        Multiplier >= 1.0 when mov_weight > 0, else exactly 1.0.
    """
    raw = np.log(abs(goal_diff) + 1)
    return 1.0 + mov_weight * (raw - 1.0) if raw > 1.0 else 1.0


def compute_ratings(
    matches: pd.DataFrame,
    k_base: float,
    home_advantage: float,
    mov_weight: float,
    reversion: float,
    initial_rating: float = 1500.0,
) -> dict[str, float]:
    """Run the ELO simulation over the full match history and return final ratings.

    Ratings update after every match. At each season transition, all known
    teams revert partially toward ``initial_rating`` by the ``reversion`` fraction.

    Args:
        matches: DataFrame sorted by date with columns
            ``[season, home_team, away_team, home_score, away_score]``.
        k_base: Base K-factor.
        home_advantage: Rating bonus for the home side.
        mov_weight: Margin-of-victory multiplier weight.
        reversion: Off-season mean reversion fraction.
        initial_rating: Starting rating for all teams.

    Returns:
        Dictionary mapping team name to final ELO rating.
    """
    ratings: dict[str, float] = {}
    current_season = None

    for row in matches.itertuples(index=False):
        if row.season != current_season:
            if current_season is not None and reversion > 0.0:
                for team in ratings:
                    ratings[team] += reversion * (initial_rating - ratings[team])
            current_season = row.season

        home = row.home_team
        away = row.away_team

        r_home = ratings.get(home, initial_rating)
        r_away = ratings.get(away, initial_rating)

        e_home = _expected_score(r_home, r_away, home_advantage)

        if row.home_score > row.away_score:
            s_home = 1.0
        elif row.home_score < row.away_score:
            s_home = 0.0
        else:
            s_home = 0.5

        goal_diff = abs(row.home_score - row.away_score)
        k = k_base * _mov_multiplier(goal_diff, mov_weight)

        delta = k * (s_home - e_home)
        ratings[home] = r_home + delta
        ratings[away] = r_away - delta

    return ratings


def print_rankings(ratings: dict[str, float], initial_rating: float = 1500.0) -> None:
    """Print a ranked table of ELO ratings to stdout.

    Args:
        ratings: Dictionary mapping team name to ELO rating.
        initial_rating: Baseline rating, used to display the delta column.
    """
    ranked = sorted(ratings.items(), key=lambda x: x[1], reverse=True)

    col_rank = 4
    col_team = max(len(t) for t, _ in ranked)
    col_rating = 8
    col_delta = 7

    header = (
        f"{'#':>{col_rank}}  "
        f"{'Team':<{col_team}}  "
        f"{'Rating':>{col_rating}}  "
        f"{'Delta':>{col_delta}}"
    )
    divider = "-" * len(header)

    print(divider)
    print(header)
    print(divider)

    for rank, (team, rating) in enumerate(ranked, start=1):
        delta = rating - initial_rating
        sign = "+" if delta >= 0 else ""
        print(
            f"{rank:>{col_rank}}  "
            f"{team:<{col_team}}  "
            f"{rating:>{col_rating}.1f}  "
            f"{sign}{delta:>{col_delta - 1}.1f}"
        )

    print(divider)


def main() -> None:
    """Load data and parameters, compute ratings, and print the rankings."""
    with open(PARAMS_PATH) as f:
        params = json.load(f)

    matches = pd.read_csv(DATA_PATH, parse_dates=["date"])
    matches = matches.sort_values("date").reset_index(drop=True)

    ratings = compute_ratings(
        matches,
        k_base=params["k_base"],
        home_advantage=params["home_advantage"],
        mov_weight=params["mov_weight"],
        reversion=params["reversion"],
        initial_rating=params["initial_rating"],
    )

    latest_season = matches["season"].iloc[-1]
    latest_date = matches["date"].iloc[-1].strftime("%d %b %Y")
    print(f"\nELO Rankings — season {latest_season}, last match {latest_date}\n")

    print_rankings(ratings, initial_rating=params["initial_rating"])


if __name__ == "__main__":
    main()
