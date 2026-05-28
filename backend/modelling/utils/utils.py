"""Utilities for configuring the soccerdata environment.

soccerdata reads its league_dict.json at import time, so any custom leagues
must be written to disk before the library is first imported in a given
Python session.  Call ``ensure_custom_leagues`` at the very top of any
entry-point script, before importing soccerdata.
"""

import json
import logging
import os
from pathlib import Path

log = logging.getLogger(__name__)

# soccerdata respects the SOCCERDATA_DIR env var; falls back to ~/soccerdata.
def _soccerdata_dir() -> Path:
    env = os.environ.get("SOCCERDATA_DIR")
    return Path(env) if env else Path.home() / "soccerdata"


def ensure_custom_leagues(custom_leagues: dict) -> None:
    """Merge custom league definitions into soccerdata's league_dict.json.

    Reads the existing file (if any), merges in any entries from
    ``custom_leagues`` that are not already present, and writes the result
    back.  No-ops if every entry is already registered.

    Must be called before ``import soccerdata`` so the library picks up
    the updated file on first load.

    Args:
        custom_leagues: Mapping of league ID to source-identifier dict,
            matching the format expected by soccerdata.  Example::

                {
                    "ENG-Championship": {
                        "FBref": "Championship",
                        "MatchHistory": "E1",
                        "season_start": "Aug",
                        "season_end": "May",
                    }
                }
    """
    if not custom_leagues:
        return

    config_dir = _soccerdata_dir() / "config"
    config_dir.mkdir(parents=True, exist_ok=True)
    league_dict_path = config_dir / "league_dict.json"

    existing: dict = {}
    if league_dict_path.exists():
        with league_dict_path.open() as f:
            try:
                existing = json.load(f)
            except json.JSONDecodeError:
                log.warning("league_dict.json is malformed — overwriting with clean version")

    missing = {k: v for k, v in custom_leagues.items() if k not in existing}
    if not missing:
        log.debug("All custom leagues already registered; nothing to write")
        return

    existing.update(missing)
    with league_dict_path.open("w") as f:
        json.dump(existing, f, indent=2)

    log.info(
        "Registered %d custom league(s) in %s: %s",
        len(missing),
        league_dict_path,
        ", ".join(missing),
    )
