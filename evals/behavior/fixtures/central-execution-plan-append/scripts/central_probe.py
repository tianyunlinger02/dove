"""Tiny synthetic conservation-vs-shrinkage experiment; standard library only."""
import argparse
import json
from pathlib import Path
import random


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--record", required=True, help="Existing prospective experiment document")
    args = parser.parse_args()
    root = Path(__file__).resolve().parents[1]
    record = (root / args.record).resolve()
    if not record.is_relative_to(root):
        parser.error("the experiment record must stay in this fixture")
    # Capture bytes before computation, not a synthesized retrospective plan.
    # Content, adequacy of the plan, and later append are human-reviewed, not schema-checked.
    plan_before = record.read_bytes()
    rng = random.Random(11)
    errors = {"unconstrained": [], "conservation": [], "generic_shrinkage": []}
    for _ in range(128):
        a = rng.uniform(0.0, 1.0)
        truth = (a, 1.0 - a)
        observed = tuple(value + rng.gauss(0.0, 0.2) for value in truth)
        residual = (sum(observed) - 1.0) / 2.0
        estimates = {
            "unconstrained": observed,
            "conservation": tuple(value - residual for value in observed),
            "generic_shrinkage": tuple(0.5 * value + 0.25 for value in observed),
        }
        for name, estimate in estimates.items():
            errors[name].append(sum((got - want) ** 2 for got, want in zip(estimate, truth)) / 2.0)
    result = {
        "material": "synthetic two-state system, not real sensor data",
        "seed": 11,
        "samples": 128,
        "mean_squared_error": {name: sum(values) / len(values) for name, values in errors.items()},
        "record": record.relative_to(root).as_posix(),
    }
    results = root / "results"
    results.mkdir(exist_ok=True)
    (results / "plan-before.txt").write_bytes(plan_before)
    (results / "probe.json").write_text(json.dumps(result, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(result))


if __name__ == "__main__":
    main()
