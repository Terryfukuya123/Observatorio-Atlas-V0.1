"""API SDMX da OCDE (formato CSV).

Os termos da OCDE permitem uso, inclusive comercial, com citação da fonte, ressalvadas
restrições de terceiros indicadas nos metadados de cada conjunto.
"""
import csv
from datetime import date, timedelta
from decimal import Decimal, InvalidOperation
from io import StringIO
import re
from urllib.parse import urlencode
from urllib.request import Request, urlopen

from providers.eurostat import period as _period

BASE = "https://sdmx.oecd.org/public/rest/data/"
MAX_BYTES = 1_500_000
FLOW = re.compile(r"^[A-Z0-9_.]+,[A-Z0-9_@]+,[0-9.]*$")
KEY = re.compile(r"^[A-Z0-9_.+]*$")
AGGREGATES = {"EA": "EMU", "EU": "EUU", "EA20": "EMU", "OECD": "OECD", "G20": "G20", "G7": "G7"}
STATUS = {"E": "estimado", "P": "provisório", "B": "quebra de série", "F": "projeção"}


def url(flow, key, frequency, today):
    if not FLOW.match(flow) or not KEY.match(key):
        raise ValueError("Consulta OCDE inválida")
    months = 25 if frequency == "Mensal" else 39
    start = (today.replace(day=1) - timedelta(days=31 * months)).strftime("%Y-%m")
    return f"{BASE}{flow}/{key}?" + urlencode({"startPeriod": start, "dimensionAtObservation": "AllDimensions"})


def download(address):
    if not address.startswith(BASE):
        raise ValueError("Endereço fora da lista autorizada")
    request = Request(address, headers={"Accept": "application/vnd.sdmx.data+csv; charset=utf-8",
                                        "User-Agent": "ObservatorioEconomico/1.0"})
    with urlopen(request, timeout=60) as response:
        if not response.url.startswith(BASE):
            raise ValueError("Redirecionamento inesperado")
        body = response.read(MAX_BYTES + 1)
    if len(body) > MAX_BYTES:
        raise ValueError("Resposta excede o limite")
    return body


def normalize(body, territories, today):
    """{ISO3 ou agregado: [(data ISO, valor textual, rótulo, situação)]}."""
    rows = list(csv.DictReader(StringIO(body.decode("utf-8-sig"))))
    if not rows or not {"REF_AREA", "TIME_PERIOD", "OBS_VALUE"} <= set(rows[0]):
        raise ValueError("CSV SDMX inesperado")
    fixed = [k for k in rows[0] if k not in {"REF_AREA", "TIME_PERIOD", "OBS_VALUE", "OBS_STATUS", "DECIMALS", "UNIT_MULT", "BASE_PER"}]
    signature = {k: rows[0][k] for k in fixed}
    out, seen = {}, set()
    for row in rows:
        if any(row[k] != v for k, v in signature.items()):
            raise ValueError("Mais de uma série por território")
        code = row["REF_AREA"]
        area = AGGREGATES.get(code) or (code if code in territories else None)
        if not area or row["OBS_VALUE"] in ("", "NaN"):
            continue
        day, label = _period(row["TIME_PERIOD"])
        if day > today.isoformat():
            raise ValueError("Período futuro")
        if (area, day) in seen:
            if code in {"EA20"}:
                continue  # EA e EA20 podem coexistir; prevalece o primeiro.
            raise ValueError("Observação duplicada")
        seen.add((area, day))
        raw = row["OBS_VALUE"].strip()
        try:
            number = Decimal(raw)
        except InvalidOperation as error:
            raise ValueError("Valor inválido") from error
        if not number.is_finite() or abs(number) >= 10**9:
            raise ValueError("Valor fora do domínio")
        out.setdefault(area, []).append((day, raw, label, STATUS.get(row.get("OBS_STATUS") or "")))
    if not out:
        raise ValueError("Nenhum território com valores")
    for points in out.values():
        points.sort()
    return out
