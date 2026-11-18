"""Calendário TARGET para a referência diária EUR (anos contemporâneos)."""
from datetime import date, timedelta


def easter(year):
    a = year % 19
    b, c = divmod(year, 100)
    d, e = divmod(b, 4)
    f = (b + 8) // 25
    g = (b - f + 1) // 3
    h = (19 * a + b - d - g + 15) % 30
    i, k = divmod(c, 4)
    l = (32 + 2 * e + 2 * i - h - k) % 7
    m = (a + 11 * h + 22 * l) // 451
    month, day = divmod(h + l - 7 * m + 114, 31)
    return date(year, month, day + 1)


def is_target_day(day):
    sunday = easter(day.year)
    return (day.weekday() < 5 and (day.month, day.day) not in {(1, 1), (5, 1), (12, 25), (12, 26)}
            and day not in {sunday - timedelta(days=2), sunday + timedelta(days=1)})


def expected_day(now):
    # Margem operacional fixa até 17h UTC, após o horário habitual de publicação.
    day = now.date() if now.hour >= 17 else now.date() - timedelta(days=1)
    while not is_target_day(day):
        day -= timedelta(days=1)
    return day
