from datetime import datetime, timedelta, timezone

WIB = timezone(timedelta(hours=7))
BULAN = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"]


def get_now() -> datetime:
    """Returns current time in WIB (UTC+7) regardless of OS or AWS server timezone."""
    return datetime.now(WIB).replace(tzinfo=None)


def format_id_datetime(dt: datetime) -> str:
    return f"{dt.day} {BULAN[dt.month - 1]} {dt.year}, {dt.hour:02d}.{dt.minute:02d}"


def format_id_date(dt: datetime) -> str:
    return f"{dt.day} {BULAN[dt.month - 1]} {dt.year}"