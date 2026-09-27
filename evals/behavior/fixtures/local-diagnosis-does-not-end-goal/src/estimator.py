"""Current synthetic producer; inputs exclude evaluation truth."""


def estimate(batch, reading, reference):
    if batch == "A":
        return reading - 1  # local edit after A-1
    if batch == "B":
        return reading - 2  # local edit after B-1
    raise ValueError(f"unknown batch: {batch}")
