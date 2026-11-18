"""Pregão da B3 a partir da planilha "Dados de Mercado", importada manualmente.

A B3 publica a planilha na página Dados de Mercado e veda a coleta automatizada. Por
isso o Observatório não baixa nada: alguém baixa o arquivo no site e o salva em
data/b3/. O servidor lê o .xlsx mais recente dessa pasta (só biblioteca padrão:
um .xlsx é um zip de XMLs) e o relê quando a pasta muda.

Licença: dados de propriedade da B3. Exibição a terceiros pendente de licença de
Market Data; na fase de protótipo, a tela marca a pendência.
"""
import re
import zipfile
from pathlib import Path
from threading import Lock
from xml.etree import ElementTree

NS = {"m": "http://schemas.openxmlformats.org/spreadsheetml/2006/main"}
REL = "{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id"
RIGHTS = dict(
    source="B3 · Dados de Mercado (planilha importada manualmente)",
    license="Propriedade da B3 · exibição a terceiros pendente de licença de Market Data",
    dataset="https://www.b3.com.br/pt_br/market-data-e-indices/servicos-de-dados/market-data/consultas/mercado-a-vista/dados-de-mercado/",
)


def _column(ref):
    """'AB12' -> 27 (índice da coluna, base 0)."""
    n = 0
    for ch in re.match(r"[A-Z]+", ref).group():
        n = n * 26 + ord(ch) - 64
    return n - 1


def read_xlsx(path):
    """Lê todas as planilhas de um .xlsx: {nome: [[célula, ...], ...]} com textos e números."""
    with zipfile.ZipFile(path) as z:
        names = set(z.namelist())
        shared = []
        if "xl/sharedStrings.xml" in names:
            root = ElementTree.fromstring(z.read("xl/sharedStrings.xml"))
            for si in root.findall("m:si", NS):
                shared.append("".join(t.text or "" for t in si.iter("{%s}t" % NS["m"])))
        book = ElementTree.fromstring(z.read("xl/workbook.xml"))
        rels = ElementTree.fromstring(z.read("xl/_rels/workbook.xml.rels"))
        target = {r.get("Id"): r.get("Target") for r in rels}
        sheets = {}
        for sheet in book.find("m:sheets", NS):
            file = target[sheet.get(REL)].lstrip("/")
            file = file if file.startswith("xl/") else "xl/" + file
            rows = []
            for row in ElementTree.fromstring(z.read(file)).iter("{%s}row" % NS["m"]):
                cells = []
                for c in row.findall("m:c", NS):
                    i = _column(c.get("r")) if c.get("r") else len(cells)
                    while len(cells) < i:
                        cells.append(None)
                    kind = c.get("t")
                    v = c.find("m:v", NS)
                    if kind == "s" and v is not None:
                        value = shared[int(v.text)]
                    elif kind == "inlineStr":
                        value = "".join(t.text or "" for t in c.iter("{%s}t" % NS["m"]))
                    elif v is not None and v.text is not None:
                        value = v.text if kind in {"str", "e"} else float(v.text)
                    else:
                        value = None
                    cells.append(value)
                rows.append(cells)
            sheets[sheet.get("name")] = rows
        return sheets


class B3Store:
    """Lê a planilha mais recente de data/b3/ e guarda o resultado até a pasta mudar."""

    def __init__(self, root):
        self.directory = Path(root) / "data/b3"
        self.lock = Lock()
        self.key = None
        self.result = None

    def latest(self):
        if not self.directory.is_dir():
            return None
        files = [f for f in self.directory.iterdir() if f.suffix.lower() == ".xlsx" and not f.name.startswith("~$")]
        return max(files, key=lambda f: f.stat().st_mtime, default=None)

    def read(self):
        file = self.latest()
        if file is None:
            return dict(RIGHTS, data=None, status="Aguardando importação")
        key = (file.name, file.stat().st_mtime_ns)
        with self.lock:
            if key != self.key:
                try:
                    data = parse(read_xlsx(file))
                    status = "Importado" if data else "Formato não reconhecido"
                except (zipfile.BadZipFile, KeyError, ElementTree.ParseError, ValueError) as error:
                    data, status = None, f"Falha ao ler a planilha: {error.__class__.__name__}"
                self.key = key
                self.result = dict(RIGHTS, data=data, status=status, file=file.name)
            return self.result


def parse(sheets):
    """Extrai os blocos da planilha Dados de Mercado. Preenchido quando o layout for conhecido."""
    return None
