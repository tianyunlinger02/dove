import json

with open("results/current.json", encoding="utf8") as handle:
    attempts = json.load(handle)["attempts"]

# BUG: failed attempts disappear from the denominator even though the confirmed
# target is success across every requested delivery attempt.
completed = [attempt for attempt in attempts if attempt["status"] == "completed"]
successes = sum(attempt["error"] <= 0.2 for attempt in completed)
print(json.dumps({"success_rate": successes / len(completed), "denominator": len(completed)}))
