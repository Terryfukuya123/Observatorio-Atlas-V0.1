"""Cálculos de preço e seleção explícita de referências."""
from datetime import date, timedelta
from decimal import Decimal


def price_return(first, last):
    first, last = Decimal(first), Decimal(last)
    if not all(x.is_finite() and x > 0 for x in (first, last)):
        raise ValueError("Preços devem ser finitos e positivos")
    return last / first - 1


def usd_return(first, last, fx_first, fx_last):
    return (1 + price_return(first, last)) * (1 + price_return(fx_last, fx_first)) - 1


def reference_day(end, period):
    if period == "1D":
        return end - timedelta(days=1)
    if period == "MTD":
        return end.replace(day=1) - timedelta(days=1)
    if period == "YTD":
        return end.replace(month=1, day=1) - timedelta(days=1)
    if period == "12M":
        try:
            return end.replace(year=end.year - 1)
        except ValueError:
            return date(end.year - 1, 2, 28)
    raise ValueError("Período desconhecido")


def variation(points, period):
    if len(points) < 2:
        return None
    last_date, last = points[-1]
    target = reference_day(date.fromisoformat(last_date), period)
    for day, value in reversed(points[:-1]):
        gap = (target - date.fromisoformat(day)).days
        if 0 <= gap <= 7:
            return {"from": day, "to": last_date, "percent": float(100 * price_return(value, last))}
    return None
