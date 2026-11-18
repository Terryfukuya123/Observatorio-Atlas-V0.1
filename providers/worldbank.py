"""World Development Indicators do Banco Mundial (CC BY 4.0)."""
import json
import re
from urllib.request import Request, urlopen

BASE = "https://api.worldbank.org/v2/country/all/indicator/"
URL = BASE + "{code}?format=json&per_page=1000&mrnev=1"
MAX_BYTES = 1_500_000
CODE = re.compile(r"^[A-Z]{2,3}(\.[A-Z0-9]{2,6}){1,5}$")


def url(code):
    if not CODE.match(code):
        raise ValueError("Código de indicador inválido")
    return URL.format(code=code)


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


def normalize(body, code, territories):
    """Último valor não vazio por território: {ISO3: {"year": "2025", "value": "2.28"}}.

    Somente códigos presentes em `territories` são aceitos (países do mapa e WLD),
    o que exclui os agregados regionais e de renda do Banco Mundial.
    """
    payload = json.loads(body, parse_float=str, parse_int=str)
    if not isinstance(payload, list) or len(payload) != 2 or not isinstance(payload[1], list):
        message = payload[0].get("message") if isinstance(payload, list) and payload and isinstance(payload[0], dict) else None
        raise ValueError("Resposta do Banco Mundial sem dados" + (f" ({message})" if message else ""))
    if int(payload[0].get("pages", 1)) > 1:
        raise ValueError("Paginação inesperada")
    values = {}
    for row in payload[1]:
        if row.get("indicator", {}).get("id") != code:
            raise ValueError("Indicador divergente")
        iso = row.get("countryiso3code") or ""
        if iso not in territories or row.get("value") is None:
            continue
        if iso in values:
            raise ValueError("Território duplicado")
        year = str(row["date"])
        if not re.fullmatch(r"\d{4}", year):
            raise ValueError("Ano inválido")
        raw = str(row["value"])
        number = float(raw)
        if number != number or abs(number) >= 1e16:
            raise ValueError("Valor fora do domínio")
        values[iso] = {"year": year, "value": raw}
    if not values:
        raise ValueError("Indicador sem valores")
    return values
