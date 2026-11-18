"""Séries do SGS e PTAX do Banco Central do Brasil (dados abertos, ODbL)."""
from datetime import date, datetime, timedelta
from decimal import Decimal, InvalidOperation
import json
import re
from urllib.parse import quote
from urllib.request import Request, urlopen

SGS = "https://api.bcb.gov.br/dados/serie/bcdata.sgs.{code}/dados?formato=json&dataInicial={start}&dataFinal={end}"
PTAX = ("https://olinda.bcb.gov.br/olinda/servico/PTAX/versao/v1/odata/"
        "CotacaoMoedaPeriodo(moeda=@moeda,dataInicial=@dataInicial,dataFinalCotacao=@dataFinalCotacao)"
        "?@moeda='{currency}'&@dataInicial='{start}'&@dataFinalCotacao='{end}'&$format=json"
        "&$filter=" + quote("tipoBoletim eq 'Fechamento'") + "&$select=cotacaoVenda,dataHoraCotacao")
HOSTS = ("https://api.bcb.gov.br/", "https://olinda.bcb.gov.br/")
MAX_BYTES = 2_000_000
# Janela de coleta por periodicidade. O SGS limita consultas diárias a dez anos.
WINDOW = {"Diária": timedelta(days=3 * 366), "Mensal": timedelta(days=10 * 366), "Anual": timedelta(days=30 * 366)}


def download(url):
    if not url.startswith(HOSTS):
        raise ValueError("Endereço fora da lista autorizada")
    request = Request(url, headers={"Accept": "application/json", "User-Agent": "ObservatorioEconomico/1.0"})
    with urlopen(request, timeout=20) as response:
        if not response.url.startswith(HOSTS):
            raise ValueError("Redirecionamento inesperado")
        body = response.read(MAX_BYTES + 1)
    if len(body) > MAX_BYTES:
        raise ValueError("Resposta excede o limite")
    return body


def sgs_url(code, frequency, today):
    start = today - WINDOW[frequency]
    return SGS.format(code=int(code), start=start.strftime("%d/%m/%Y"), end=today.strftime("%d/%m/%Y"))


def ptax_url(currency, today):
    if currency not in {"USD", "EUR", "GBP", "JPY", "CHF", "CAD", "AUD", "DKK", "NOK", "SEK"}:
        raise ValueError("Moeda fora do catálogo PTAX")
    start = today - timedelta(days=400)
    return PTAX.format(currency=currency, start=start.strftime("%m-%d-%Y"), end=today.strftime("%m-%d-%Y"))


def _number(raw):
    raw = str(raw).strip()
    try:
        value = Decimal(raw)
    except InvalidOperation as error:
        raise ValueError("Valor inválido") from error
    if not value.is_finite() or abs(value) >= 10**15 or len(raw) > 24:
        raise ValueError("Valor fora do domínio")
    return raw


def normalize_sgs(body, today):
    """Retorna [(data ISO, valor textual)] em ordem crescente, descartando datas futuras.

    A meta Selic é publicada com vigência até a próxima reunião, por isso o SGS
    devolve datas posteriores ao dia corrente. Elas não são observações.
    """
    rows = json.loads(body)
    if not isinstance(rows, list):
        raise ValueError("Formato inesperado do SGS")
    series = {}
    for row in rows:
        day = datetime.strptime(row["data"], "%d/%m/%Y").date()
        if day > today:
            continue
        if day in series:
            raise ValueError("Observação duplicada")
        if row.get("valor") in (None, ""):
            continue
        series[day] = _number(row["valor"])
    if not series:
        raise ValueError("Série sem observações")
    return sorted((d.isoformat(), v) for d, v in series.items())


def normalize_ptax(body, today):
    """Cotação de venda do boletim de fechamento, com a precisão publicada."""
    rows = json.loads(body, parse_float=str).get("value")
    if not isinstance(rows, list):
        raise ValueError("Formato inesperado da PTAX")
    series = {}
    for row in rows:
        stamp = datetime.fromisoformat(row["dataHoraCotacao"][:19])
        day = stamp.date()
        if day > today:
            raise ValueError("Data futura")
        if day in series:
            raise ValueError("Boletim duplicado")
        value = _number(row["cotacaoVenda"])
        if Decimal(value) <= 0:
            raise ValueError("Cotação não positiva")
        series[day] = value
    if not series:
        raise ValueError("PTAX sem boletins")
    return sorted((d.isoformat(), v) for d, v in series.items())


FOCUS = ("https://olinda.bcb.gov.br/olinda/servico/Expectativas/versao/v1/odata/ExpectativasMercadoAnuais"
         "?$format=json&$top=20000&$select=Indicador,IndicadorDetalhe,Data,DataReferencia,Mediana,numeroRespondentes"
         "&$filter={filter}")
FOCUS_DAYS = 120
FOCUS_YEARS = 4


def focus_url(indicators, today):
    names = sorted(indicators)
    if not names or any("'" in name or len(name) > 60 for name in names):
        raise ValueError("Indicador Focus inválido")
    start = today - timedelta(days=FOCUS_DAYS)
    clause = " or ".join(f"Indicador eq '{name}'" for name in names)
    expression = f"({clause}) and baseCalculo eq 0 and Data ge '{start.isoformat()}'"
    return FOCUS.format(filter=quote(expression, safe=""))


def normalize_focus(body, today, indicators):
    """Medianas do Focus por indicador e ano: {indicador: {ano: [(data, mediana, respondentes)]}}.

    Considera somente a base de cálculo de 30 dias (baseCalculo 0, filtrada na consulta),
    linhas sem detalhamento e anos do corrente até três à frente.
    """
    rows = json.loads(body, parse_float=str).get("value")
    if not isinstance(rows, list):
        raise ValueError("Formato inesperado do Focus")
    years = {str(today.year + i) for i in range(FOCUS_YEARS)}
    out, seen = {}, set()
    for row in rows:
        name = row.get("Indicador")
        if name not in indicators:
            raise ValueError("Indicador Focus não solicitado")
        if row.get("IndicadorDetalhe") is not None or row.get("DataReferencia") not in years:
            continue
        day = date.fromisoformat(row["Data"])
        if day > today:
            raise ValueError("Data futura")
        key = (name, row["DataReferencia"], day)
        if key in seen:
            raise ValueError("Expectativa duplicada")
        seen.add(key)
        respondents = int(row.get("numeroRespondentes") or 0)
        if respondents <= 0:
            continue
        out.setdefault(name, {}).setdefault(row["DataReferencia"], []).append(
            (day.isoformat(), _number(row["Mediana"]), respondents))
    if not out:
        raise ValueError("Focus sem expectativas")
    for refs in out.values():
        for points in refs.values():
            points.sort()
    return out


# Focus mensal e por reunião do Copom: só a última pesquisa antes de cada divulgação importa,
# então cada mês de referência é pedido a partir do seu primeiro dia (o consenso da véspera).
FOCUS_MONTHLY = ("https://olinda.bcb.gov.br/olinda/servico/Expectativas/versao/v1/odata/ExpectativaMercadoMensais"
                 "?$format=json&$top=20000&$select=Indicador,Data,DataReferencia,Mediana,DesvioPadrao,numeroRespondentes"
                 "&$filter={filter}")
FOCUS_SELIC = ("https://olinda.bcb.gov.br/olinda/servico/Expectativas/versao/v1/odata/ExpectativasMercadoSelic"
               "?$format=json&$top=20000&$select=Data,Reuniao,Mediana,DesvioPadrao,numeroRespondentes"
               "&$filter={filter}")
SURPRISE_MONTHS = 25
# Mês aproximado de cada uma das 8 reuniões do Copom; a consulta começa um mês antes.
COPOM_MONTHS = (1, 3, 5, 6, 7, 9, 11, 12)
MEETING = re.compile(r"R([1-8])/(\d{4})")


def _months(today, count):
    y, m = today.year, today.month
    out = []
    for _ in range(count):
        out.append((y, m))
        y, m = (y, m - 1) if m > 1 else (y - 1, 12)
    return out[::-1]


def focus_monthly_url(indicators, today):
    names = sorted(indicators)
    if not names or any("'" in name or len(name) > 60 for name in names):
        raise ValueError("Indicador Focus inválido")
    who = " or ".join(f"Indicador eq '{name}'" for name in names)
    refs = " or ".join(f"(DataReferencia eq '{m:02d}/{y}' and Data ge '{y}-{m:02d}-01')"
                       for y, m in _months(today, SURPRISE_MONTHS))
    expression = f"({who}) and baseCalculo eq 0 and ({refs})"
    return FOCUS_MONTHLY.format(filter=quote(expression, safe=""))


def _last_survey(rows, key, today):
    """Mantém a pesquisa mais recente de cada chave: [data, mediana, desvio, respondentes]."""
    out = {}
    for row in rows:
        k = key(row)
        if k is None:
            continue
        day = date.fromisoformat(row["Data"])
        if day > today:
            raise ValueError("Data futura")
        respondents = int(row.get("numeroRespondentes") or 0)
        if respondents <= 0 or row.get("Mediana") is None:
            continue
        sd = row.get("DesvioPadrao")
        item = [day.isoformat(), _number(row["Mediana"]), None if sd is None else _number(sd), respondents]
        if k not in out or item[0] > out[k][0]:
            out[k] = item
    return out


def normalize_focus_monthly(body, today, indicators):
    """{indicador: {"AAAA-MM": [data da última pesquisa, mediana, desvio-padrão, respondentes]}}."""
    rows = json.loads(body, parse_float=str).get("value")
    if not isinstance(rows, list):
        raise ValueError("Formato inesperado do Focus mensal")

    def key(row):
        if row.get("Indicador") not in indicators:
            raise ValueError("Indicador Focus não solicitado")
        month, _, year = str(row.get("DataReferencia", "")).partition("/")
        if not (month.isdigit() and year.isdigit() and 1 <= int(month) <= 12):
            raise ValueError("Mês de referência inválido")
        return (row["Indicador"], f"{int(year):04d}-{int(month):02d}")

    found = _last_survey(rows, key, today)
    if not found:
        raise ValueError("Focus mensal sem expectativas")
    out = {}
    for (name, ref), item in sorted(found.items()):
        out.setdefault(name, {})[ref] = item
    return out


def focus_selic_url(today):
    clauses = []
    for year in range(today.year - 2, today.year + 1):
        for number, month in enumerate(COPOM_MONTHS, 1):
            y, m = (year, month - 1) if month > 1 else (year - 1, 12)
            clauses.append(f"(Reuniao eq 'R{number}/{year}' and Data ge '{y}-{m:02d}-01')")
    expression = f"baseCalculo eq 0 and ({' or '.join(clauses)})"
    return FOCUS_SELIC.format(filter=quote(expression, safe=""))


def normalize_focus_selic(body, today):
    """{"R7/2026": [data da última pesquisa, mediana, desvio-padrão, respondentes]}."""
    rows = json.loads(body, parse_float=str).get("value")
    if not isinstance(rows, list):
        raise ValueError("Formato inesperado do Focus Selic")

    def key(row):
        if not MEETING.fullmatch(str(row.get("Reuniao", ""))):
            raise ValueError("Reunião inválida")
        return row["Reuniao"]

    out = _last_survey(rows, key, today)
    if not out:
        raise ValueError("Focus Selic sem expectativas")
    return dict(sorted(out.items(), key=lambda kv: (kv[0][-4:], kv[0][1])))


# Histórico de atuações do BC no mercado de câmbio (ODbL), arquivo CSV completo desde 1999.
ATUACOES = "https://www.bcb.gov.br/conteudo/dadosabertos/BCBDepin/historico-atuacoes-mercado-cambio.csv"
ATUACOES_HOST = "https://www.bcb.gov.br/conteudo/dadosabertos/"
ATUACOES_MAX = 8_000_000
ATUACOES_COLUMNS = ("Data", "Instrumento", "Modalidade", "Volume USD Ofertado", "Volume USD Aceito")


def download_atuacoes(url):
    if not url.startswith(ATUACOES_HOST):
        raise ValueError("Endereço fora da lista autorizada")
    request = Request(url, headers={"Accept": "text/csv", "User-Agent": "ObservatorioEconomico/1.0"})
    with urlopen(request, timeout=30) as response:
        if not response.url.startswith(ATUACOES_HOST):
            raise ValueError("Redirecionamento inesperado")
        body = response.read(ATUACOES_MAX + 1)
    if len(body) > ATUACOES_MAX:
        raise ValueError("Resposta excede o limite")
    return body


def _brl_number(raw):
    """Volumes do arquivo usam vírgula decimal e nenhum separador de milhar."""
    raw = (raw or "").strip()
    if not raw:
        return None
    if "." in raw:
        raise ValueError("Separador inesperado")
    return _number(raw.replace(",", "."))


def normalize_atuacoes(body, today):
    """Operações desde 1º de janeiro do ano anterior: [(data, instrumento, modalidade, ofertado, aceito)].

    Volumes em US$. Linhas sem volume aceito (leilão sem aceitação ou ainda não
    divulgado) são mantidas com aceito None.
    """
    import csv
    import io
    reader = csv.DictReader(io.StringIO(body.decode("utf-8-sig")))
    if not reader.fieldnames or any(c not in reader.fieldnames for c in ATUACOES_COLUMNS):
        raise ValueError("Colunas inesperadas nas atuações")
    start = date(today.year - 1, 1, 1)
    out = []
    for row in reader:
        day = datetime.strptime(row["Data"][:10], "%Y-%m-%d").date()
        if day < start:
            continue
        if day > today + timedelta(days=7):
            raise ValueError("Data futura")
        instrument = row["Instrumento"].strip()
        modality = row["Modalidade"].strip()
        if not instrument or len(instrument) > 60 or len(modality) > 60:
            raise ValueError("Instrumento inválido")
        out.append((day.isoformat(), instrument, modality,
                    _brl_number(row["Volume USD Ofertado"]), _brl_number(row["Volume USD Aceito"])))
    if not out:
        raise ValueError("Atuações sem operações no período")
    out.sort(key=lambda row: row[0])  # Estável: mantém a ordem do arquivo no mesmo dia.
    return out
