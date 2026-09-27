"""Consume inference-time sensor observations in the synthetic study."""

from estimator import estimate


def corrected_reading(row):
    return estimate(row["batch"], row["reading"], row.get("reference", 10))
