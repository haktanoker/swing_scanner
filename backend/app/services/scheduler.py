from datetime import datetime

def should_run_hourly(now: datetime) -> bool:
    # Her saatin 5. dakikasında çalışır
    return now.minute == 5