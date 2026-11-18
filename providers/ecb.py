"""Arquivo oficial, com precisão decimal original e datas de referência diárias."""
from datetime import date, timedelta
from decimal import Decimal, InvalidOperation
from urllib.request import urlopen
from xml.etree import ElementTree

URL = "https://www.ecb.europa.eu/stats/eurofxref/eurofxref-hist-90d.xml"
CURRENCIES = frozenset("BRL USD CAD GBP CNY JPY INR HKD AUD".split())
MAX_BYTES = 512_000


def download():
    with urlopen(URL, timeout=10) as response:
        if response.url != URL:
            raise ValueError("Redirecionamento inesperado")
        body = response.read(MAX_BYTES + 1)
    if len(body) > MAX_BYTES:
        raise ValueError("Arquivo excede o limite")
    return body


def normalize(body, today):
    rows = {}
    days = set()
    root = ElementTree.fromstring(body)
    for cube in root.findall(".//{http://www.ecb.int/vocabulary/2002-08-01/eurofxref}Cube[@time]"):
        day = date.fromisoformat(cube.attrib["time"])
        if day > today or day in days:
            raise ValueError("Data futura ou duplicada")
        days.add(day)
        for entry in cube:
            code = entry.get("currency")
            if code not in CURRENCIES:
                continue
            raw = entry.attrib["rate"]
            try:
                value = Decimal(raw)
            except InvalidOperation as error:
                raise ValueError("Taxa inválida") from error
            if not value.is_finite() or not 0 < value < 1_000_000 or len(raw) > 20:
                raise ValueError("Taxa fora do domínio")
            series = rows.setdefault(code, {})
            if day in series:
                raise ValueError("Observação duplicada")
            series[day] = raw
    if not rows:
        raise ValueError("Nenhuma série elegível")
    newest = max(days)
    return {code: sorted((d.isoformat(), v) for d, v in observations.items()
                         if d >= newest - timedelta(days=90))
            for code, observations in rows.items()}
