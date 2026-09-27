"""Evaluate the supplied synthetic rows; truth never enters the producer."""
import json
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))
from estimator import estimate


def main():
    rows = json.loads((ROOT / "data" / "observations.json").read_text())["records"]
    errors = {"all": [[], []], "A": [[], []], "B": [[], []]}
    for row in rows:
        prediction = estimate(row["batch"], row["reading"], row["reference"])
        raw = abs(row["reading"] - row["truth"])
        candidate = abs(prediction - row["truth"])
        print(f'{row["id"]}: raw={raw} candidate={candidate}', flush=True)
        for group in ("all", row["batch"]):
            errors[group][0].append(raw)
            errors[group][1].append(candidate)
    for group, (raw, candidate) in errors.items():
        print(f"{group}: raw_mae={sum(raw) / len(raw):.2f} candidate_mae={sum(candidate) / len(candidate):.2f}")
    if any(sum(candidate) >= sum(raw) for raw, candidate in errors.values()):
        raise SystemExit("confirmed comparison remains unmet")


if __name__ == "__main__":
    main()
