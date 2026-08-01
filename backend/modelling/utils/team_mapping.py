"""Cached team-name mapping backed by Groq when new FPL names appear."""

from __future__ import annotations

import json
import logging
import os
from pathlib import Path
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

log = logging.getLogger(__name__)

USER_AGENT = "predict-the-ball/1.0"

FALLBACK_MODELS = [
    "llama-3.3-70b-versatile",
    "llama-3.1-8b-instant",
    "meta-llama/llama-4-maverick-17b-128e-instruct",
    "meta-llama/llama-4-scout-17b-16e-instruct",
]


def load_dotenv(path: Path) -> None:
    """Load simple KEY=value pairs into the process environment if absent."""
    if not path.exists():
        return

    for line in path.read_text().splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        key = key.strip()
        value = value.strip().strip("'").strip('"')
        if key and key not in os.environ:
            os.environ[key] = value


def load_mapping(path: Path) -> dict[str, str]:
    """Load a cached FPL-name to historical-name mapping."""
    if not path.exists():
        return {}
    with path.open() as f:
        data = json.load(f)
    if not isinstance(data, dict):
        raise ValueError(f"Team mapping must be a JSON object: {path}")
    return {
        str(k).strip(): str(v).strip()
        for k, v in data.items()
        if str(k).strip() and str(v).strip()
    }


def infer_simple_mappings(
    fpl_names: list[str],
    historical_names: list[str],
) -> dict[str, str]:
    """Match exact names and unambiguous City/Town suffix differences."""
    historical_lookup = {
        name.casefold(): name
        for name in historical_names
        if name.strip()
    }
    inferred: dict[str, str] = {}

    for fpl_name in fpl_names:
        exact = historical_lookup.get(fpl_name.casefold())
        if exact is not None:
            inferred[fpl_name] = exact
            continue

        lowered = fpl_name.casefold()
        for suffix in (" city", " town"):
            if not lowered.endswith(suffix):
                continue
            shortened = fpl_name[:-len(suffix)].strip()
            match = historical_lookup.get(shortened.casefold())
            if match is not None:
                inferred[fpl_name] = match
            break

    return inferred


def save_mapping(mapping: dict[str, str], path: Path) -> None:
    """Persist the mapping in deterministic key order."""
    path.parent.mkdir(parents=True, exist_ok=True)
    ordered = {key: mapping[key] for key in sorted(mapping)}
    with path.open("w") as f:
        json.dump(ordered, f, indent=2)
        f.write("\n")


def _fetch_json(
    url: str,
    *,
    method: str = "GET",
    headers: dict[str, str] | None = None,
    body: bytes | None = None,
    timeout: int = 30,
) -> Any:
    request = Request(
        url,
        data=body,
        method=method,
        headers={
            "User-Agent": USER_AGENT,
            **(headers or {}),
        },
    )
    try:
        with urlopen(request, timeout=timeout) as response:
            return json.loads(response.read().decode("utf-8"))
    except HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"HTTP {exc.code}: {detail[:300]}") from exc
    except URLError as exc:
        raise RuntimeError(f"Network error: {exc.reason}") from exc


def fetch_groq_models(models_url: str, api_key: str) -> list[str]:
    """Fetch available Groq model IDs."""
    response = _fetch_json(
        models_url,
        headers={"Authorization": f"Bearer {api_key}"},
    )
    models = response.get("data", []) if isinstance(response, dict) else []
    ids = [
        str(model.get("id", "")).strip()
        for model in models
        if isinstance(model, dict) and str(model.get("id", "")).strip()
    ]
    return ids


def ordered_model_candidates(
    *,
    models_url: str,
    api_key: str,
    preferred_models: list[str] | None = None,
) -> list[str]:
    """Return Groq models with Meta/Llama candidates first, then all others."""
    candidates: list[str] = []

    for model in preferred_models or []:
        if model not in candidates:
            candidates.append(model)

    try:
        available = fetch_groq_models(models_url, api_key)
    except Exception as exc:
        log.warning("Could not fetch Groq model list; using fallbacks: %s", exc)
        available = []

    def add(model: str) -> None:
        if model and model not in candidates:
            candidates.append(model)

    for model in available:
        lowered = model.lower()
        if "llama" in lowered or "meta" in lowered:
            add(model)
    for model in available:
        add(model)
    for model in FALLBACK_MODELS:
        add(model)

    return candidates


def parse_json_object(content: str) -> dict[str, Any]:
    """Parse a JSON object, allowing fenced or lightly wrapped model output."""
    text = content.strip()
    if text.startswith("```"):
        text = text.strip("`").strip()
        if text.lower().startswith("json"):
            text = text[4:].strip()

    try:
        parsed = json.loads(text)
    except json.JSONDecodeError:
        start = text.find("{")
        end = text.rfind("}")
        if start == -1 or end == -1 or start >= end:
            raise
        parsed = json.loads(text[start:end + 1])

    if not isinstance(parsed, dict):
        raise ValueError("Groq response JSON must be an object")
    return parsed


def validate_mapping_response(
    response: dict[str, Any],
    *,
    missing_fpl_names: list[str],
    historical_names: set[str],
) -> dict[str, str]:
    """Validate a model-produced mapping."""
    mapping_obj = response.get("mapping", response)
    if not isinstance(mapping_obj, dict):
        raise ValueError("Mapping response must be a JSON object or contain a mapping object")

    validated: dict[str, str] = {}
    missing = []
    invalid = []
    for fpl_name in missing_fpl_names:
        raw_value = mapping_obj.get(fpl_name)
        mapped_name = str(raw_value).strip() if raw_value is not None else ""
        if not mapped_name:
            missing.append(fpl_name)
        elif mapped_name not in historical_names:
            invalid.append(f"{fpl_name} -> {mapped_name}")
        else:
            validated[fpl_name] = mapped_name

    if missing:
        raise ValueError(f"Missing mapping keys: {missing}")
    if invalid:
        raise ValueError(f"Mapped names are not in historical names: {invalid}")

    return validated


def build_mapping_prompt(
    *,
    missing_fpl_names: list[str],
    historical_names: list[str],
) -> list[dict[str, str]]:
    """Build chat messages for team-name mapping."""
    system = (
        "You map Fantasy Premier League team names to canonical historical "
        "football-data team names. Return only valid JSON."
    )
    user = {
        "fpl_team_names_to_map": missing_fpl_names,
        "allowed_historical_team_names": historical_names,
        "required_output": {
            "mapping": {
                "FPL team name": "exactly one allowed historical team name"
            }
        },
        "rules": [
            "Use only names from allowed_historical_team_names as values.",
            "Include every FPL team name exactly as provided as a key.",
            "Return JSON only, with no prose.",
        ],
    }
    return [
        {"role": "system", "content": system},
        {"role": "user", "content": json.dumps(user)},
    ]


def request_mapping_from_model(
    *,
    chat_url: str,
    api_key: str,
    model: str,
    missing_fpl_names: list[str],
    historical_names: list[str],
) -> dict[str, Any]:
    """Ask one Groq model for a mapping JSON object."""
    payload = {
        "model": model,
        "messages": build_mapping_prompt(
            missing_fpl_names=missing_fpl_names,
            historical_names=historical_names,
        ),
        "temperature": 0,
        "response_format": {"type": "json_object"},
    }
    response = _fetch_json(
        chat_url,
        method="POST",
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
        body=json.dumps(payload).encode("utf-8"),
        timeout=60,
    )
    choices = response.get("choices", []) if isinstance(response, dict) else []
    if not choices:
        raise ValueError("Groq response did not include choices")
    content = choices[0].get("message", {}).get("content", "")
    if not isinstance(content, str) or not content.strip():
        raise ValueError("Groq response did not include message content")
    return parse_json_object(content)


def create_missing_mapping_with_groq(
    *,
    missing_fpl_names: list[str],
    historical_names: list[str],
    groq_config: dict[str, Any],
    env_path: Path,
) -> dict[str, str]:
    """Create mappings for missing FPL names using Groq model fallback."""
    load_dotenv(env_path)
    api_key = os.environ.get("GROQ_API_KEY", "").strip()
    if not api_key:
        raise RuntimeError(
            "GROQ_API_KEY is required because new FPL team names are missing "
            "from the cached mapping."
        )

    models_url = groq_config["models_url"]
    chat_url = groq_config["chat_completions_url"]
    preferred_models = groq_config.get("preferred_models", [])
    candidates = ordered_model_candidates(
        models_url=models_url,
        api_key=api_key,
        preferred_models=preferred_models,
    )

    errors = []
    historical_name_set = set(historical_names)
    for model in candidates:
        log.info("Trying Groq model for team mapping: %s", model)
        try:
            response = request_mapping_from_model(
                chat_url=chat_url,
                api_key=api_key,
                model=model,
                missing_fpl_names=missing_fpl_names,
                historical_names=historical_names,
            )
            return validate_mapping_response(
                response,
                missing_fpl_names=missing_fpl_names,
                historical_names=historical_name_set,
            )
        except Exception as exc:
            errors.append(f"{model}: {exc}")
            log.warning("Groq model failed for team mapping (%s): %s", model, exc)

    raise RuntimeError(
        "No Groq model returned a valid team-name mapping. "
        + " | ".join(errors[-10:])
    )


def ensure_team_name_mapping(
    *,
    fpl_team_names: list[str],
    historical_team_names: list[str],
    mapping_path: Path,
    groq_config: dict[str, Any],
    env_path: Path,
) -> dict[str, str]:
    """Load the cached mapping and extend it via Groq only when needed."""
    mapping = load_mapping(mapping_path)
    missing = [
        name for name in fpl_team_names
        if name not in mapping or not mapping[name]
    ]

    inferred = infer_simple_mappings(missing, historical_team_names)
    if inferred:
        mapping.update(inferred)
        missing = [name for name in missing if name not in inferred]

    if not missing:
        if inferred:
            save_mapping(mapping, mapping_path)
            log.info("Updated team-name mapping at %s", mapping_path)
        log.info("Team-name mapping cache covers all %d FPL teams", len(fpl_team_names))
        return mapping

    log.info(
        "Team-name mapping is missing %d FPL team(s): %s",
        len(missing),
        ", ".join(missing),
    )
    created = create_missing_mapping_with_groq(
        missing_fpl_names=missing,
        historical_names=historical_team_names,
        groq_config=groq_config,
        env_path=env_path,
    )
    mapping.update(created)
    save_mapping(mapping, mapping_path)
    log.info("Updated team-name mapping at %s", mapping_path)
    return mapping
