"""Partial synthetic producer; inputs exclude evaluation truth."""


def estimate(batch, reading, reference):
    if batch == "A":
        return reading - (reference - 10)
    if batch == "B":
        raise NotImplementedError("batch B not implemented")
    raise ValueError(f"unknown batch: {batch}")
