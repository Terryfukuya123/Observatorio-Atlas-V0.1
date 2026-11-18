"""Agregados do IBGE (SIDRA) pela API de dados v3, nível Brasil."""
from datetime import date
from decimal import Decimal, InvalidOperation
import json
from urllib.request import Request, urlopen

BASE = "https://servicodados.ibge.gov.br/api/v3/agregados/"
MAX_BYTES = 500_000
PERIODS = {"Mensal": 36, "Trimestral móvel": 36, "Trimestral": 24}
MONTHS = "jan fev mar abr mai jun jul ago set out nov dez".split()


def url(table, variable, classification=None, frequency="Mensal"):
    table, variable = int(table), int(variable)
    address = f"{BASE}{table}/periodos/-{PERIODS[frequency]}/variaveis/{variable}?localidades=N1%5Ball%5D"
    if classification:
        group, category = (int(part) for part in str(classification).split("/"))
        address += f"&classificacao={group}%5B{category}%5D"
    return address


def download(address):
    if not address.startswith(BASE):
        raise ValueError("Endereço fora da lista autorizada")
    request = Request(address, headers={"Accept": "application/json", "User-Agent": "ObservatorioEconomico/1.0"})
    with urlopen(request, timeout=30) as response:
        if not response.url.startswith(BASE):
            raise ValueError("Redirecionamento inesperado")
        body = response.read(MAX_BYTES + 1)
    if len(body) > MAX_BYTES:
        raise ValueError("Resposta excede o limite")
    return body


def period(code, frequency):
    """Código SIDRA → (data ISO do último mês coberto, rótulo em português)."""
    code = str(code)
    if len(code) != 6 or not code.isdigit():
        raise ValueError("Período inválido")
    year, part = int(code[:4]), int(code[4:])
    if frequency == "Trimestral":
        if not 1 <= part <= 4:
            raise ValueError("Trimestre inválido")
        return date(year, part * 3, 1).isoformat(), f"{part}º tri/{year}"
    if not 1 <= part <= 12:
        raise ValueError("Mês inválido")
    if frequency == "Trimestral móvel":
        first = MONTHS[(part - 3) % 12]
        return date(year, part, 1).isoformat(), f"{first}–{MONTHS[part - 1]}/{year}"
    return date(year, part, 1).isoformat(), f"{MONTHS[part - 1]}/{year}"


def normalize(body, variable, frequency, today):
    """[(data ISO, valor textual, rótulo do período)] em ordem crescente.

    Valores sigilosos ou indisponíveis ("...", "-", "X") são omitidos.
    """
    payload = json.loads(body)
    if not isinstance(payload, list) or len(payload) != 1 or str(payload[0].get("id")) != str(variable):
        raise ValueError("Variável divergente")
    results = payload[0].get("resultados") or []
    if len(results) != 1 or len(results[0].get("series") or []) != 1:
        raise ValueError("Recorte inesperado")
    serie = results[0]["series"][0]
    if serie.get("localidade", {}).get("id") != "1":
        raise ValueError("Localidade diferente de Brasil")
    rows = {}
    for code, raw in (serie.get("serie") or {}).items():
        day, label = period(code, frequency)
        if day > today.isoformat():
            raise ValueError("Período futuro")
        raw = str(raw).strip()
        if raw in {"...", "-", "X", "..", ""}:
            continue
        try:
            value = Decimal(raw)
        except InvalidOperation as error:
            raise ValueError("Valor inválido") from error
        if not value.is_finite() or abs(value) >= 10**12 or len(raw) > 20:
            raise ValueError("Valor fora do domínio")
        rows[day] = (raw, label)
    if not rows:
        raise ValueError("Série sem observações")
    return [(day, value, label) for day, (value, label) in sorted(rows.items())]
