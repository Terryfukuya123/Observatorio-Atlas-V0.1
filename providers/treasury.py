"""Curva diária de juros par do Tesouro dos EUA (obra do governo federal, domínio público)."""
import csv
from datetime import datetime
from decimal import Decimal, InvalidOperation
from io import StringIO
from urllib.request import Request, urlopen

BASE = "https://home.treasury.gov/resource-center/data-chart-center/interest-rates/daily-treasury-rates.csv/"
URL = BASE + "{year}/all?type=daily_treasury_yield_curve&field_tdr_date_value={year}&page&_format=csv"
MAX_BYTES = 400_000
# Cabeçalho publicado → (código, rótulo em português, prazo em anos). Colunas novas são ignoradas até catalogadas.
TENORS = {
    "1 Mo": ("1M", "1 mês", "0.0833"), "1.5 Month": ("6S", "6 semanas", "0.125"), "2 Mo": ("2M", "2 meses", "0.1667"),
    "3 Mo": ("3M", "3 meses", "0.25"), "4 Mo": ("4M", "4 meses", "0.3333"), "6 Mo": ("6M", "6 meses", "0.5"),
    "1 Yr": ("1A", "1 ano", "1"), "2 Yr": ("2A", "2 anos", "2"), "3 Yr": ("3A", "3 anos", "3"),
    "5 Yr": ("5A", "5 anos", "5"), "7 Yr": ("7A", "7 anos", "7"), "10 Yr": ("10A", "10 anos", "10"),
    "20 Yr": ("20A", "20 anos", "20"), "30 Yr": ("30A", "30 anos", "30"),
}
ORDER = [code for code, _, _ in TENORS.values()]


def url(year):
    year = int(year)
    if not 1990 <= year <= 2100:
        raise ValueError("Ano fora do intervalo")
    return URL.format(year=year)


def download(address):
    if not address.startswith(BASE):
        raise ValueError("Endereço fora da lista autorizada")
    request = Request(address, headers={"Accept": "text/csv", "User-Agent": "ObservatorioEconomico/1.0"})
    with urlopen(request, timeout=30) as response:
        if not response.url.startswith(BASE):
            raise ValueError("Redirecionamento inesperado")
        body = response.read(MAX_BYTES + 1)
    if len(body) > MAX_BYTES:
        raise ValueError("Arquivo excede o limite")
    return body


def normalize(body, today):
    """[(data ISO, {código: taxa textual})] em ordem crescente."""
    reader = csv.reader(StringIO(body.decode("utf-8-sig")))
    header = next(reader, None)
    if not header or header[0] != "Date":
        raise ValueError("Cabeçalho inesperado")
    columns = [TENORS.get(name.strip()) for name in header[1:]]
    if not any(columns) or "10 Yr" not in header or "2 Yr" not in header:
        raise ValueError("Vencimentos de referência ausentes")
    rows = {}
    for line in reader:
        if not line:
            continue
        day = datetime.strptime(line[0], "%m/%d/%Y").date()
        if day > today:
            raise ValueError("Data futura")
        if day in rows:
            raise ValueError("Data duplicada")
        curve = {}
        for spec, raw in zip(columns, line[1:]):
            raw = raw.strip()
            if not spec or raw in ("", "N/A"):
                continue
            try:
                value = Decimal(raw)
            except InvalidOperation as error:
                raise ValueError("Taxa inválida") from error
            if not value.is_finite() or not -5 < value < 30 or len(raw) > 10:
                raise ValueError("Taxa fora do domínio")
            curve[spec[0]] = raw
        if curve:
            rows[day] = curve
    if not rows:
        raise ValueError("Curva sem observações")
    return sorted((d.isoformat(), c) for d, c in rows.items())
