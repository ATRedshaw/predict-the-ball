"""Hyperparameter tuning for the ELO rating model.

Simulates ELO ratings chronologically across all match data, then uses
scipy's differential_evolution to minimise log-loss on held-out season folds
via walk-forward cross-validation. Writes the optimised parameters to
data/params/elo.json.

Walk-forward CV design
----------------------
The data is sorted by date. The most recent ``N_VAL_SEASONS`` seasons are used
as validation folds (one fold per season). For each fold, the ELO simulation
runs over the full history up to that point and log-loss is measured only on
matches from the target season. This means ratings at the start of any
validation season are informed by all prior matches — no leakage, and no
wasted data.

Parameters tuned
----------------
k_base          : Base K-factor controlling how much ratings move per match.
home_advantage  : Additive ELO bonus applied to the home team before computing
                  win probability (in rating points).
mov_weight      : Weight given to the margin-of-victory multiplier. At 0 every
                  match shifts ratings equally regardless of scoreline; at 1 the
                  full ln(goal_diff + 1) multiplier is applied.
reversion       : Fraction of the gap from 1500 that is pulled back at the
                  start of each new season (off-season mean reversion).

Run from backend/:
    python modelling-new/tuning.py
"""

import json
import logging
import warnings
from pathlib import Path

import numpy as np
import pandas as pd
import yaml
from scipy.optimize import differential_evolution

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)s  %(message)s",
)
log = logging.getLogger(__name__)

_HERE = Path(__file__).resolve().parent
DATA_PATH = _HERE / "data" / "preprocessed" / "results.csv"
OUTPUT_PATH = _HERE / "data" / "params" / "elo.json"
CONFIG_PATH = _HERE / "config" / "tuning.yaml"

with open(CONFIG_PATH) as _f:
    _cfg = yaml.safe_load(_f)

_elo = _cfg["elo"]
_opt = _cfg["optimisation"]
_bounds_cfg = _cfg["bounds"]

INITIAL_RATING: float = _elo["initial_rating"]
LOG_LOSS_CLIP: float = _elo["log_loss_clip"]
N_VAL_SEASONS: int = _elo["n_val_seasons"]

DE_SEED: int = _opt["seed"]
DE_POPSIZE: int = _opt["popsize"]
DE_MAXITER: int = _opt["maxiter"]
DE_TOL: float = _opt["tol"]
DE_MUTATION: tuple[float, float] = (_opt["mutation_min"], _opt["mutation_max"])
DE_RECOMBINATION: float = _opt["recombination"]
DE_POLISH: bool = _opt["polish"]
DE_LOG_EVERY: int = _opt["log_every_n_generations"]

PARAM_BOUNDS: list[tuple[float, float]] = [
    (_bounds_cfg["k_base"]["min"],         _bounds_cfg["k_base"]["max"]),
    (_bounds_cfg["home_advantage"]["min"],  _bounds_cfg["home_advantage"]["max"]),
    (_bounds_cfg["mov_weight"]["min"],      _bounds_cfg["mov_weight"]["max"]),
    (_bounds_cfg["reversion"]["min"],       _bounds_cfg["reversion"]["max"]),
]


# ---------------------------------------------------------------------------
# ELO simulation
# ---------------------------------------------------------------------------

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

    Scales the K-factor by ``ln(|goal_diff| + 1)``, weighted by ``mov_weight``.
    At ``mov_weight=0`` every result is treated identically.

    Args:
        goal_diff: Absolute goal difference for the match.
        mov_weight: Interpolation weight between flat (0) and full MoV (1).

    Returns:
        Multiplier >= 1.0 when mov_weight > 0, else exactly 1.0.
    """
    raw = np.log(abs(goal_diff) + 1)
    return 1.0 + mov_weight * (raw - 1.0) if raw > 1.0 else 1.0


def simulate_elo(
    matches: pd.DataFrame,
    k_base: float,
    home_advantage: float,
    mov_weight: float,
    reversion: float,
) -> np.ndarray:
    """Run the ELO simulation over a sorted match history.

    Ratings update after every match. At each season transition, all ratings
    revert partially toward ``INITIAL_RATING`` by the ``reversion`` fraction.

    Args:
        matches: DataFrame sorted by date with columns
            ``[season, home_team, away_team, home_score, away_score]``.
        k_base: Base K-factor.
        home_advantage: Rating bonus for the home side.
        mov_weight: Margin-of-victory multiplier weight.
        reversion: Off-season mean reversion fraction.

    Returns:
        Array of shape ``(n_matches,)`` containing the home team's predicted
        win probability *before* each match is processed.
    """
    ratings: dict[str, float] = {}
    predictions = np.empty(len(matches), dtype=np.float64)
    current_season = None

    for i, row in enumerate(matches.itertuples(index=False)):
        # Off-season reversion at each season boundary.
        if row.season != current_season:
            if current_season is not None and reversion > 0.0:
                for team in ratings:
                    ratings[team] += reversion * (INITIAL_RATING - ratings[team])
            current_season = row.season

        home = row.home_team
        away = row.away_team

        r_home = ratings.get(home, INITIAL_RATING)
        r_away = ratings.get(away, INITIAL_RATING)

        e_home = _expected_score(r_home, r_away, home_advantage)
        predictions[i] = e_home

        # Actual result from the home team's perspective.
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

    return predictions


# ---------------------------------------------------------------------------
# Cross-validation and objective
# ---------------------------------------------------------------------------

def _log_loss(y_true: np.ndarray, y_pred: np.ndarray) -> float:
    """Binary log-loss for match outcomes (1 = home win, 0 = away win, 0.5 = draw).

    Args:
        y_true: Array of actual outcomes (0, 0.5, or 1).
        y_pred: Array of predicted home win probabilities.

    Returns:
        Mean log-loss, clipped to avoid numerical blow-up.
    """
    p = np.clip(y_pred, LOG_LOSS_CLIP, 1.0 - LOG_LOSS_CLIP)
    # For draws (y_true == 0.5) this computes the cross-entropy at the midpoint,
    # which penalises confident wrong predictions for draws appropriately.
    return -np.mean(y_true * np.log(p) + (1.0 - y_true) * np.log(1.0 - p))


def _outcomes(matches: pd.DataFrame) -> np.ndarray:
    """Convert match scores to outcome values (1 / 0.5 / 0) for log-loss.

    Args:
        matches: DataFrame with ``home_score`` and ``away_score`` columns.

    Returns:
        Array of floats: 1.0 = home win, 0.5 = draw, 0.0 = away win.
    """
    outcomes = np.where(
        matches["home_score"] > matches["away_score"], 1.0,
        np.where(matches["home_score"] == matches["away_score"], 0.5, 0.0),
    )
    return outcomes.astype(np.float64)


def walk_forward_log_loss(
    matches: pd.DataFrame,
    val_seasons: list,
    k_base: float,
    home_advantage: float,
    mov_weight: float,
    reversion: float,
) -> float:
    """Compute mean walk-forward log-loss over the specified validation seasons.

    For each validation season the ELO simulation runs over the full dataset
    (ratings are stateful and depend on all prior matches), and log-loss is
    computed only on matches within that season. This correctly propagates
    rating state without any leakage.

    Args:
        matches: Full match history sorted by date.
        val_seasons: List of season codes to treat as validation.
        k_base: ELO K-factor base.
        home_advantage: Home rating advantage.
        mov_weight: MoV multiplier weight.
        reversion: Off-season reversion fraction.

    Returns:
        Mean log-loss across all validation matches.
    """
    predictions = simulate_elo(matches, k_base, home_advantage, mov_weight, reversion)
    actual = _outcomes(matches)

    val_mask = matches["season"].isin(val_seasons).values
    return _log_loss(actual[val_mask], predictions[val_mask])


def make_objective(matches: pd.DataFrame, val_seasons: list):
    """Return the objective function for differential_evolution.

    Args:
        matches: Full sorted match history.
        val_seasons: Validation season codes.

    Returns:
        Callable ``f(params) -> float`` suitable for scipy optimisers.
    """
    def objective(params: np.ndarray) -> float:
        k_base, home_advantage, mov_weight, reversion = params
        return walk_forward_log_loss(
            matches, val_seasons, k_base, home_advantage, mov_weight, reversion
        )

    return objective


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

def tune(data_path: Path = DATA_PATH, output_path: Path = OUTPUT_PATH) -> dict:
    """Run hyperparameter tuning and write the result to disk.

    Args:
        data_path: Path to the preprocessed results CSV.
        output_path: Destination path for the JSON parameter file.

    Returns:
        Dictionary of optimised parameter values.
    """
    log.info("Loading match data from %s", data_path)
    matches = pd.read_csv(data_path, parse_dates=["date"])
    matches = matches.sort_values("date").reset_index(drop=True)

    all_seasons = sorted(matches["season"].unique())
    log.info(
        "Loaded %d matches across %d seasons: %s",
        len(matches), len(all_seasons), all_seasons,
    )

    if len(all_seasons) <= N_VAL_SEASONS:
        raise ValueError(
            f"Need at least {N_VAL_SEASONS + 1} seasons; only {len(all_seasons)} found."
        )

    val_seasons = all_seasons[-N_VAL_SEASONS:]
    train_seasons = all_seasons[:-N_VAL_SEASONS]
    log.info("Train seasons: %s", train_seasons)
    log.info("Validation seasons: %s", val_seasons)

    val_count = matches["season"].isin(val_seasons).sum()
    log.info("Validation set: %d matches", val_count)

    objective = make_objective(matches, val_seasons)

    log.info(
        "Starting differential_evolution (popsize=%d, maxiter=%d)…",
        DE_POPSIZE, DE_MAXITER,
    )

    call_count = [0]

    def callback(xk, convergence):
        call_count[0] += 1
        if call_count[0] % DE_LOG_EVERY == 0:
            log.info(
                "  Generation %d — params: k=%.2f, hfa=%.1f, mov=%.3f, rev=%.3f",
                call_count[0], xk[0], xk[1], xk[2], xk[3],
            )

    with warnings.catch_warnings():
        warnings.simplefilter("ignore")
        result = differential_evolution(
            objective,
            bounds=PARAM_BOUNDS,
            popsize=DE_POPSIZE,
            maxiter=DE_MAXITER,
            tol=DE_TOL,
            seed=DE_SEED,
            callback=callback,
            workers=1,
            polish=DE_POLISH,
            init="sobol",
            mutation=DE_MUTATION,
            recombination=DE_RECOMBINATION,
        )

    k_base, home_advantage, mov_weight, reversion = result.x

    params = {
        "k_base": round(float(k_base), 4),
        "home_advantage": round(float(home_advantage), 4),
        "mov_weight": round(float(mov_weight), 4),
        "reversion": round(float(reversion), 4),
        "initial_rating": INITIAL_RATING,
    }

    log.info("Optimisation complete — log-loss: %.6f", result.fun)
    log.info("Converged: %s, iterations: %d, function evals: %d", result.success, result.nit, result.nfev)
    log.info("Optimised parameters: %s", params)

    output_path.parent.mkdir(parents=True, exist_ok=True)
    with open(output_path, "w") as f:
        json.dump(params, f, indent=2)
    log.info("Parameters written to %s", output_path)

    return params


if __name__ == "__main__":
    tune()
