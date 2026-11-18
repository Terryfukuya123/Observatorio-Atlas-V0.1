"""Informe diário e cadastro de classes de fundos da CVM (dados abertos, ODbL).

Agrega captação, resgate e patrimônio por dia e categoria. Os fundos de cotas
(FIC) ficam fora da soma: o dinheiro que eles recebem é repassado a outros fundos,
que já registram a captação, e contá-los duplicaria o fluxo.
"""
import csv
import io
import re
from collections import defaultdict
from decimal import Decimal, InvalidOperation
from urllib.request import Request, urlopen
from zipfile import ZipFile

HOST = "https://dados.cvm.gov.br/dados/FI/"
DAILY = HOST + "DOC/INF_DIARIO/DADOS/inf_diario_fi_{period}.zip"
REGISTRY = HOST + "CAD/DADOS/registro_fundo_classe.zip"
MAX_BYTES = 60_000_000
MAX_MEMBER = 400_000_000

CATEGORIES = {"rf": "Renda fixa", "mm": "Multimercado", "ac": "Ações", "pv": "Previdência", "cb": "Cambial", "ou": "Outros"}
FIC = "fic"
DAILY_COLUMNS = ("CNPJ_FUNDO_CLASSE", "DT_COMPTC", "VL_PATRIM_LIQ", "CAPTC_DIA", "RESG_DIA")
REGISTRY_COLUMNS = ("CNPJ_Classe", "Classificacao", "Classificacao_Anbima", "Classe_Cotas")


def download(url):
    if not url.startswith(HOST):
        raise ValueError("Endereço fora da lista autorizada")
    request = Request(url, headers={"User-Agent": "ObservatorioEconomico/1.0"})
    with urlopen(request, timeout=90) as response:
        if not response.url.startswith(HOST):
            raise ValueError("Redirecionamento inesperado")
        body = response.read(MAX_BYTES + 1)
    if len(body) > MAX_BYTES:
        raise ValueError("Arquivo excede o limite")
    return body


def cnpj(raw):
    digits = re.sub(r"\D", "", raw or "")
    if not digits or len(digits) > 14:
        raise ValueError("CNPJ inválido")
    return digits.zfill(14)


def category(row):
    if row["Classe_Cotas"] == "S":
        return FIC
    if row["Classificacao_Anbima"].startswith("Previd"):
        return "pv"
    return {"Renda Fixa": "rf", "Multimercado": "mm", "Ações": "ac", "Cambial": "cb"}.get(row["Classificacao"], "ou")


def _rows(body, name, columns):
    with ZipFile(io.BytesIO(body)) as archive:
        member = archive.getinfo(name) if name else archive.infolist()[0]
        if member.file_size > MAX_MEMBER:
            raise ValueError("Arquivo descompactado excede o limite")
        with io.TextIOWrapper(archive.open(member), encoding="latin-1") as stream:
            reader = csv.DictReader(stream, delimiter=";")
            if not reader.fieldnames or any(c not in reader.fieldnames for c in columns):
                raise ValueError("Colunas inesperadas")
            yield from reader


def normalize_registry(body):
    """{CNPJ da classe: categoria}. Classes de cotas recebem a marca FIC."""
    out = {}
    for row in _rows(body, "registro_classe.csv", REGISTRY_COLUMNS):
        if row["CNPJ_Classe"]:
            out[cnpj(row["CNPJ_Classe"])] = category(row)
    if len(out) < 1000:
        raise ValueError("Cadastro incompleto")
    return out


def _decimal(raw):
    try:
        value = Decimal(raw or "0")
    except InvalidOperation as error:
        raise ValueError("Valor inválido") from error
    if not value.is_finite() or abs(value) >= 10**16:
        raise ValueError("Valor fora do domínio")
    return value


def normalize_daily(body, registry, period):
    """{data: {categoria: [captação, resgate, patrimônio, classes]}, "_": [linhas, sem cadastro]}.

    Valores em reais, como texto com duas casas. Somente datas da própria competência.
    """
    prefix = f"{period[:4]}-{period[4:]}-"
    days = defaultdict(lambda: defaultdict(lambda: [Decimal(0), Decimal(0), Decimal(0), 0]))
    rows = unknown = 0
    for row in _rows(body, None, DAILY_COLUMNS):
        day = row["DT_COMPTC"]
        if not day.startswith(prefix):
            continue
        rows += 1
        kind = registry.get(cnpj(row["CNPJ_FUNDO_CLASSE"]))
        if kind is None:
            unknown += 1
            continue
        if kind == FIC:
            continue
        item = days[day][kind]
        item[0] += _decimal(row["CAPTC_DIA"])
        item[1] += _decimal(row["RESG_DIA"])
        item[2] += _decimal(row["VL_PATRIM_LIQ"])
        item[3] += 1
    if not rows:
        raise ValueError("Informe sem linhas da competência")
    out = {d: {k: [str(v[0].quantize(Decimal("0.01"))), str(v[1].quantize(Decimal("0.01"))),
                   str(v[2].quantize(Decimal("0.01"))), v[3]] for k, v in cats.items()}
           for d, cats in sorted(days.items())}
    out["_"] = [rows, unknown]
    return out
