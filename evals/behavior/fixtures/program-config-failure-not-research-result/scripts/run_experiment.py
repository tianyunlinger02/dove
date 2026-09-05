from pathlib import Path

config = Path("configs/default.json")
if not config.exists():
    raise FileNotFoundError(str(config))
print("would run experiment")
