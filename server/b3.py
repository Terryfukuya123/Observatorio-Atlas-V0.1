"""Pregão da B3 a partir do relatório "Dados de Mercado", importado manualmente.

A B3 publica o relatório na página Dados de Mercado e veda a coleta automatizada. Por
isso o Observatório não baixa nada: alguém baixa o arquivo no site e o salva em
data/b3/ (CSV ou .xlsx). O servidor lê todos os arquivos da pasta, guarda um retrato de
cada data de corte em data/b3/retratos.json e relê quando a pasta muda.

O relatório traz acumulados do mês (volume até D-1, investidores até D-2). A diferença
entre dois retratos consecutivos do mesmo mês dá o número de cada pregão: volume do dia
e saldo diário dos estrangeiros.

Licença: dados de propriedade da B3. Exibição a terceiros pendente de licença de
Market Data; na fase de protótipo, a tela marca a pendência.
"""
import json
import re
import unicodedata
import zipfile
from datetime import date
from hashlib import sha256
from pathlib import Path
from threading import Lock
from xml.etree import ElementTree

NS = {"m": "http://schemas.openxmlformats.org/spreadsheetml/2006/main"}
REL = "{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id"
RIGHTS = dict(
    source="B3 · Dados de Mercado (relatório importado manualmente)",
    license="Propriedade da B3 · exibição a terceiros pendente de licença de Market Data",
    dataset="https://www.b3.com.br/pt_br/market-data-e-indices/servicos-de-dados/market-data/consultas/mercado-a-vista/dados-de-mercado/",
)
MONTHS = {m: i + 1 for i, m in enumerate(["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"])}
EN = {m: i + 1 for i, m in enumerate(["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"])}
INVESTORS = ["individuals", "institutions", "foreign", "banks", "others"]


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


def read_csv(path):
    """O CSV da B3: separador ';', vírgula decimal, sem aspas. Linhas como listas de texto."""
    raw = Path(path).read_bytes()
    try:
        text = raw.decode("utf-8-sig")
    except UnicodeDecodeError:
        text = raw.decode("latin-1")
    return [line.split(";") for line in text.splitlines()]


def rows_of(path):
    if Path(path).suffix.lower() == ".xlsx":
        rows = []
        for sheet in read_xlsx(path).values():
            for row in sheet:
                rows.append(["" if c is None else (str(c).replace(".", ",") if isinstance(c, float) else str(c)) for c in row])
        return rows
    return read_csv(path)


def _plain(text):
    return unicodedata.normalize("NFD", str(text)).encode("ascii", "ignore").decode().lower().strip()


def number(text):
    """'644900,52' -> 644900.52 ; '11,80%' -> 11.8 ; vazio -> None."""
    t = str(text).strip().replace("%", "").replace(" ", "")
    if not t:
        return None
    if "," in t:
        t = t.replace(".", "").replace(",", ".")
    return float(t)


def period(label):
    """'Nov/Nov/26' ou 'Jan/Jan/2026' -> '2026-11' ; '2025' -> '2025' ; '2026(*)' -> '2026*'."""
    t = _plain(label)
    m = re.fullmatch(r"(\d{4})(\(\*\))?", t)
    if m:
        return m.group(1) + ("*" if m.group(2) else "")
    m = re.fullmatch(r"([a-z]{3})/([a-z]{3})/(\d{2,4})", t)
    if m and m.group(1) in MONTHS:
        y = int(m.group(3))
        y = y + 2000 if y < 100 else y
        return f"{y}-{MONTHS[m.group(1)]:02d}"
    return None


def cutoff(line, year):
    """'(*) Ate dia 17 Nov - Until Nov 17' -> '2026-11-17'."""
    m = re.search(r"ate dia (\d{1,2}) ([a-z]{3})", _plain(line))
    if not m:
        return None
    month = MONTHS.get(m.group(2)) or EN.get(m.group(2))
    return date(year, month, int(m.group(1))).isoformat() if month else None


def parse(rows):
    """Extrai os blocos do relatório. Devolve None se o layout não for reconhecido."""
    section = None
    out = {"volume": {}, "average": {}, "trades": {}, "participation": {}, "foreign": {}, "cutoff": {}}
    year = None
    for row in rows:
        first = _plain(row[0]) if row else ""
        joined = _plain(";".join(row))
        if "volume total" in joined:
            section = "volume"
        elif "volume medio diario" in joined:
            section = "average"
        elif "n de negocios total" in joined:
            section = "trades"
        elif "n de negocios medio" in joined:
            section = "trades_avg"
        elif "participacao dos investidores" in joined:
            section = "participation"
        elif "movimentacao dos investidores estrangeiros" in joined:
            section = "foreign"
        if not first:
            continue
        if first.startswith("(*)") and year:
            day = cutoff(first, year)
            if day:
                out["cutoff"].setdefault(section, day)
            continue
        key = period(row[0])
        if not key or section not in out:
            continue
        values = [number(c) for c in row[1:]]
        if key.endswith("*"):
            year = int(key[:4])
        if section in {"volume", "trades"} and len(values) >= 5:
            out[section][key] = dict(zip(["cash", "forward", "options", "block", "total"], values))
        elif section == "average" and len(values) >= 3:
            out[section][key] = {"brl": values[0], "usd": values[2]}
        elif section == "participation" and len(values) >= 5:
            out[section][key] = dict(zip(INVESTORS, values))
        elif section == "foreign" and len(values) >= 4:
            out[section][key] = dict(zip(["buy", "sell", "ipo", "balance"], values))
    if not out["volume"] or not out["foreign"] or not year:
        return None
    out["year"] = year
    return out


def snapshot(report):
    """Retrato do mês corrente na data de corte: acumulados usados para derivar o dia."""
    year = report["year"]
    vol_day = report["cutoff"].get("volume")
    inv_day = report["cutoff"].get("participation") or report["cutoff"].get("foreign")
    vol_month = vol_day[:7] if vol_day else None
    inv_month = inv_day[:7] if inv_day else None
    return {
        "volume_cutoff": vol_day,
        "investor_cutoff": inv_day,
        "volume": report["volume"].get(vol_month),
        "trades": report["trades"].get(vol_month),
        "foreign": report["foreign"].get(inv_month),
        "participation": report["participation"].get(inv_month),
        "year": year,
    }


def daily(snapshots):
    """Diferença entre retratos consecutivos do mesmo mês: o número de cada pregão (ou grupo de pregões)."""
    days = []
    vol = sorted((s for s in snapshots if s.get("volume_cutoff") and s.get("volume")), key=lambda s: s["volume_cutoff"])
    for a, b in zip(vol, vol[1:]):
        if a["volume_cutoff"][:7] == b["volume_cutoff"][:7] and b["volume_cutoff"] > a["volume_cutoff"]:
            days.append({"kind": "volume", "from": a["volume_cutoff"], "to": b["volume_cutoff"],
                         "cash": round(b["volume"]["cash"] - a["volume"]["cash"], 1),
                         "total": round(b["volume"]["total"] - a["volume"]["total"], 1),
                         "trades": (b["trades"] or {}).get("total", 0) - (a["trades"] or {}).get("total", 0)})
    inv = sorted((s for s in snapshots if s.get("investor_cutoff") and s.get("foreign")), key=lambda s: s["investor_cutoff"])
    for a, b in zip(inv, inv[1:]):
        if a["investor_cutoff"][:7] == b["investor_cutoff"][:7] and b["investor_cutoff"] > a["investor_cutoff"]:
            days.append({"kind": "foreign", "from": a["investor_cutoff"], "to": b["investor_cutoff"],
                         **{k: round(b["foreign"][k] - a["foreign"][k], 1) for k in ("buy", "sell", "ipo", "balance")}})
    return days


class B3Store:
    """Lê os relatórios de data/b3/, guarda os retratos e entrega o mais recente com os dias derivados."""

    def __init__(self, root):
        self.directory = Path(root) / "data/b3"
        self.history = self.directory / "retratos.json"
        self.lock = Lock()
        self.key = None
        self.result = None

    def files(self):
        if not self.directory.is_dir():
            return []
        return sorted(
            (f for f in self.directory.iterdir() if f.suffix.lower() in {".csv", ".xlsx"} and not f.name.startswith("~$")),
            key=lambda f: f.stat().st_mtime,
        )

    def read(self):
        files = self.files()
        if not files:
            return dict(RIGHTS, data=None, status="Aguardando importação")
        key = tuple((f.name, f.stat().st_mtime_ns) for f in files)
        with self.lock:
            if key != self.key:
                self.key = key
                self.result = self._load(files)
            return self.result

    def _load(self, files):
        try:
            saved = json.loads(self.history.read_text(encoding="utf8")) if self.history.exists() else {}
        except ValueError:
            saved = {}
        latest, status, error = None, "Formato não reconhecido", None
        for file in files:
            try:
                report = parse(rows_of(file))
            except (zipfile.BadZipFile, KeyError, ElementTree.ParseError, ValueError, OSError) as exc:
                error = f"Falha ao ler {file.name}: {exc.__class__.__name__}"
                continue
            if not report:
                continue
            shot = snapshot(report)
            shot["file"] = file.name
            shot["sha256"] = sha256(file.read_bytes()).hexdigest()
            saved[(shot["volume_cutoff"] or "") + "|" + (shot["investor_cutoff"] or "")] = shot
            if latest is None or (shot["volume_cutoff"] or "") >= (latest[1]["volume_cutoff"] or ""):
                latest = (report, shot)
        if saved:
            try:
                self.history.write_text(json.dumps(saved, ensure_ascii=False, indent=1), encoding="utf8")
            except OSError:
                pass
        if latest is None:
            return dict(RIGHTS, data=None, status=error or status)
        report, shot = latest
        data = dict(report, days=daily(list(saved.values())), snapshots=len(saved))
        return dict(RIGHTS, data=data, status="Importado", file=shot["file"], sha256=shot["sha256"])
