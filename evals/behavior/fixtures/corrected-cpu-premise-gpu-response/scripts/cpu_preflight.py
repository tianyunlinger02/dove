"""Synthetic CPU-only parameter check; not a physical solver."""

import json
from pathlib import Path

config = json.loads(Path("config/response.json").read_text())
assert len(config["grid"]) == len(config["preflightGrid"]) == 3
assert all(value > 0 for key in ("grid", "preflightGrid") for value in config[key])
assert all(config[key] > 0 for key in ("timeSteps", "preflightSteps", "sourceCount", "receiverCount", "spacingMm", "stepUs"))
print("CPU input preflight valid; no physical response computed")
