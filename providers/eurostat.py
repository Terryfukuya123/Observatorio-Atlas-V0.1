"""API de disseminação do Eurostat (JSON-stat 2.0).

O aviso de direitos do Eurostat autoriza reuso comercial com citação, exceto para dados
de países fora da UE, da EFTA e dos candidatos oficiais à adesão. Por isso só entram os
territórios de ALLOWED; dados de EUA, Japão, Reino Unido etc. vêm de outras fontes.
"""
from datetime import date
from decimal import Decimal, InvalidOperation
import json
import re
from urllib.parse import urlencode
from urllib.request import Request, urlopen

BASE = "https://ec.europa.eu/eurostat/api/dissemination/statistics/1.0/data/"
MAX_BYTES = 1_000_000
PERIODS = {"Mensal": 25, "Trimestral": 13}
# Revisão de 17/11/2026. UE-27, EFTA e candidatos oficiais. Kosovo (candidato potencial) e Reino Unido ficam fora.
EU = {"AT": "AUT", "BE": "BEL", "BG": "BGR", "HR": "HRV", "CY": "CYP", "CZ": "CZE", "DK": "DNK", "EE": "EST",
      "FI": "FIN", "FR": "FRA", "DE": "DEU", "EL": "GRC", "HU": "HUN", "IE": "IRL", "IT": "ITA", "LV": "LVA",
      "LT": "LTU", "LU": "LUX", "MT": "MLT", "NL": "NLD", "PL": "POL", "PT": "PRT", "RO": "ROU", "SK": "SVK",
      "SI": "SVN", "ES": "ESP", "SE": "SWE"}
EFTA = {"IS": "ISL", "LI": "LIE", "NO": "NOR", "CH": "CHE"}
CANDIDATES = {"AL": "ALB", "BA": "BIH", "GE": "GEO", "MD": "MDA", "ME": "MNE", "MK": "MKD", "RS": "SRB",
              "TR": "TUR", "UA": "UKR"}
AGGREGATES = {"EA": "EMU", "EA21": "EMU", "EU27_2020": "EUU"}
# Quando há mais de um código para o mesmo agregado, vale o primeiro presente na resposta.
PREFERENCE = {"EMU": ("EA", "EA21")}
ALLOWED = {**EU, **EFTA, **CANDIDATES, **AGGREGATES}
STATUS = {"e": "estimado", "p": "provisório", "b": "quebra de série", "d": "definição diferente", "u": "baixa confiabilidade"}
MONTHS = "jan fev mar abr mai jun jul ago set out nov dez".split()
SAFE = re.compile(r"^[A-Za-z0-9_\-.]{1,40}$")


def url(dataset, filters, frequency):
    if not SAFE.match(dataset) or not all(SAFE.match(k) and SAFE.match(v) for k, v in filters.items()):
        raise ValueError("Consulta Eurostat inválida")
    query = dict(filters, format="JSON", lang="EN", lastTimePeriod=PERIODS[frequency])
    return BASE + dataset + "?" + urlencode(query)


def download(address):
    if not address.startswith(BASE):
        raise ValueError("Endereço fora da lista autorizada")
    request = Request(address, headers={"Accept": "application/json", "User-Agent": "ObservatorioEconomico/1.0"})
    with urlopen(request, timeout=45) as response:
        if not response.url.startswith(BASE):
            raise ValueError("Redirecionamento inesperado")
        body = response.read(MAX_BYTES + 1)
    if len(body) > MAX_BYTES:
        raise ValueError("Resposta excede o limite")
    return body


def period(code):
    """'2026-10' ou '2026-Q3' → (data ISO do último mês coberto, rótulo em português)."""
    match = re.fullmatch(r"(\d{4})-(?:(\d{2})|Q([1-4]))", code)
    if not match:
        raise ValueError("Período inválido")
    year = int(match.group(1))
    if match.group(3):
        quarter = int(match.group(3))
        return date(year, quarter * 3, 1).isoformat(), f"{quarter}º tri/{year}"
    month = int(match.group(2))
    if not 1 <= month <= 12:
        raise ValueError("Mês inválido")
    return date(year, month, 1).isoformat(), f"{MONTHS[month - 1]}/{year}"


def normalize(body, today):
    """{ISO3: [(data ISO, valor textual, rótulo, situação)]} para os territórios elegíveis."""
    # Somente decimais como texto: os índices das dimensões precisam ser inteiros para ordenar.
    data = json.loads(body, parse_float=str)
    if data.get("error"):
        raise ValueError("Eurostat recusou a consulta")
    ids, sizes = data.get("id"), [int(s) for s in data.get("size", [])]
    if not ids or len(ids) != len(sizes) or ids[-2:] != ["geo", "time"]:
        raise ValueError("Estrutura JSON-stat inesperada")
    if any(size != 1 for size in sizes[:-2]):
        raise ValueError("Recorte com mais de uma série por território")
    geo = data["dimension"]["geo"]["category"]["index"]
    time = data["dimension"]["time"]["category"]["index"]
    geo = sorted(geo, key=lambda k: int(geo[k])) if isinstance(geo, dict) else list(geo)
    time = sorted(time, key=lambda k: int(time[k])) if isinstance(time, dict) else list(time)
    if len(geo) != sizes[-2] or len(time) != sizes[-1]:
        raise ValueError("Dimensões inconsistentes")
    values, status = data.get("value") or {}, data.get("status") or {}
    if isinstance(values, list):
        values = {str(i): v for i, v in enumerate(values) if v is not None}
    periods = [period(code) for code in time]
    if any(day > today.isoformat() for day, _ in periods):
        raise ValueError("Período futuro")
    present = set(geo)
    out = {}
    for g, code in enumerate(geo):
        iso = ALLOWED.get(code)
        if not iso:
            continue
        preferred = next((c for c in PREFERENCE.get(iso, ()) if c in present), code)
        if code != preferred:
            continue
        for t, (day, label) in enumerate(periods):
            position = str(g * len(time) + t)
            raw = values.get(position)
            if raw is None:
                continue
            raw = str(raw)
            try:
                number = Decimal(raw)
            except InvalidOperation as error:
                raise ValueError("Valor inválido") from error
            if not number.is_finite() or abs(number) >= 10**9:
                raise ValueError("Valor fora do domínio")
            out.setdefault(iso, []).append((day, raw, label, STATUS.get(status.get(position, ""), None)))
    if not out:
        raise ValueError("Nenhum território elegível com valores")
    return out
