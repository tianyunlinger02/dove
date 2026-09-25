"""Synthetic fixed-offset comparison; Python standard library only."""
import argparse
import json
from pathlib import Path


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--prediction", required=True, help="Prospective prediction, saved before the initial score")
    parser.add_argument("--output", choices=("initial", "corrected"), default="initial")
    args = parser.parse_args()
    root = Path(__file__).resolve().parents[1]
    prediction = root / args.prediction
    if prediction.resolve() != root / "notes" / "prediction.md":
        parser.error("use notes/prediction.md in this synthetic fixture")
    before = prediction.read_bytes()

    calibration = json.loads((root / "data" / "calibration.json").read_text(encoding="utf-8"))
    offset = calibration["reference_reading"] - calibration["reference_value"]
    rows = json.loads((root / "data" / "holdout.json").read_text(encoding="utf-8"))["rows"]
    baseline = [abs(row["target_reading"] - row["truth"]) for row in rows]
    candidate = [abs(row["target_reading"] - offset - row["truth"]) for row in rows]
    result = {
        "material": "synthetic holdout, not population evidence",
        "rows": len(rows),
        "calibration_offset": offset,
        "raw_mae": sum(baseline) / len(rows),
        "candidate_mae": sum(candidate) / len(rows),
    }
    results = root / "results"
    results.mkdir(exist_ok=True)
    if args.output == "initial":
        (results / "prediction-before.txt").write_bytes(before)
    (results / f"{args.output}.json").write_text(json.dumps(result, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(result))


if __name__ == "__main__":
    main()
