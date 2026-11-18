"""Leitura do relatório Dados de Mercado da B3 (CSV e .xlsx) e a loja com retratos diários."""
import json
import tempfile
import unittest
import zipfile
from pathlib import Path

from server.b3 import B3Store, daily, number, parse, period, read_csv, read_xlsx, snapshot

WORKBOOK = """<?xml version="1.0" encoding="UTF-8"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"
 xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
<sheets><sheet name="Dados" sheetId="1" r:id="rId1"/></sheets></workbook>"""
RELS = """<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="worksheet" Target="worksheets/sheet1.xml"/></Relationships>"""
SHARED = """<?xml version="1.0" encoding="UTF-8"?>
<sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<si><t>Volume</t></si><si><r><t>Estran</t></r><r><t>geiros</t></r></si></sst>"""
SHEET = """<?xml version="1.0" encoding="UTF-8"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>
<row r="1"><c r="A1" t="s"><v>0</v></c><c r="C1"><v>1234.5</v></c></row>
<row r="2"><c r="B2" t="s"><v>1</v></c><c r="C2" t="inlineStr"><is><t>texto</t></is></c></row>
</sheetData></worksheet>"""


def report(day=17, inv_day=16, cash=342813.1, total=358794.4, buy=206244.6, sell=211584.3):
    """Relatório sintético no layout do CSV da B3 (separador ';', vírgula decimal)."""
    br = lambda v: f"{v:.1f}".replace(".", ",")
    return "\n".join([
        "DADOS DE NEGOCIACAO /  TRADING DATA",
        "Volume Total (R$ milhoes) /Total Volume (BRL million)",
        "Mes/Month;A vista / Cash Market;Termo / Forward Market;Opcoes / Options Market;Em bloco / Block Lot;Total",
        "Out/Oct/26;1203469,3;3639,0;55539,1;16283,0;1278930,5",
        f"Nov/Nov/26;{br(cash)};918,1;11861,0;3202,1;{br(total)}",
        "2026(*);7252198,4;21082,3;310603,6;62244,1;7646128,6",
        f"(*) Ate dia {day} Nov - Until Nov {day}",
        "ANOS ANTERIORES /  PREVIOUS YEARS",
        "Ano / Year;A vista / Cash Market;Termo / Forward Market;Opcoes / Options Market;Em bloco / Block Lot;Total",
        "2025;5858831,8;22934,7;195282,3;15585,5;6092634,4",
        "",
        "Volume Medio Diario /  Average Daily Trading Value",
        "Mes/Month;R$ Milhoes / BRL million;Variation %;US$ Milhoes / USD million;Variation %",
        "Nov/Nov/26;32617,6;-10,10;5638,2;-9,00",
        "2025;24370,5;0,00;4429,0;0,00",
        "",
        "N de Negocios Total /  Number of Trades",
        "Mes/Month;A vista / Cash Market;Termo / Forward Market;Opcoes / Options Market;Em bloco / Block Lot;Total",
        "Nov/Nov/26;47772995;4648;3550098;244;51327985",
        "",
        "PARTICIPACAO DOS INVESTIDORES /  INVESTORS PARTICIPATION",
        "Mes/Month;Pes.Fisicas / Individuals;Institucionais / Institutional;Estrangeiro / Foreign;Inst.Financ. / Financial Inst.;Outros / Others",
        "Nov/Nov/2026;12,24%;22,27%;63,06%;1,77%;0,66%",
        "2026(*);11,80%;23,00%;62,50%;2,00%;0,70%",
        f"(*) Ate dia {inv_day} Nov - Until Nov {inv_day}",
        "",
        "Movimentacao dos Investidores Estrangeiros Mensal (R$ Milhoes)",
        "Mes/Month;Compras (A);Vendas (B);IPO/Follow On (C);Saldo A+C-B",
        "Out/Oct/2026;400000,0;391832,9;0,0;8167,1",
        f"Nov/Nov/2026;{br(buy)};{br(sell)};0,0;{br(buy - sell)}",
        "2026(*);4656426,7;4626203,0;4636,1;34859,7",
        f"(*) Ate dia {inv_day} Nov - Until Nov {inv_day}",
    ])


def write_xlsx(path):
    with zipfile.ZipFile(path, "w") as z:
        z.writestr("xl/workbook.xml", WORKBOOK)
        z.writestr("xl/_rels/workbook.xml.rels", RELS)
        z.writestr("xl/sharedStrings.xml", SHARED)
        z.writestr("xl/worksheets/sheet1.xml", SHEET)


class ReadXlsx(unittest.TestCase):
    def test_reads_cells_in_position(self):
        with tempfile.TemporaryDirectory() as tmp:
            file = Path(tmp) / "a.xlsx"
            write_xlsx(file)
            rows = read_xlsx(file)["Dados"]
        self.assertEqual(rows[0], ["Volume", None, 1234.5])
        self.assertEqual(rows[1], [None, "Estrangeiros", "texto"])


class Parse(unittest.TestCase):
    def test_numbers_and_periods(self):
        self.assertEqual(number("644900,52"), 644900.52)
        self.assertEqual(number("11,80%"), 11.8)
        self.assertEqual(number("47772995"), 47772995)
        self.assertIsNone(number(""))
        self.assertEqual(period("Nov/Nov/26"), "2026-11")
        self.assertEqual(period("Jan/Jan/2026"), "2026-01")
        self.assertEqual(period("2026(*)"), "2026*")
        self.assertEqual(period("2025"), "2025")
        self.assertIsNone(period("Mes/Month"))

    def test_blocks_and_cutoffs(self):
        with tempfile.TemporaryDirectory() as tmp:
            file = Path(tmp) / "r.csv"
            file.write_text(report(), encoding="utf-8-sig")
            r = parse(read_csv(file))
        self.assertEqual(r["year"], 2026)
        self.assertEqual(r["cutoff"]["volume"], "2026-11-17")
        self.assertEqual(r["cutoff"]["participation"], "2026-11-16")
        self.assertEqual(r["volume"]["2026-11"]["cash"], 342813.1)
        self.assertEqual(r["volume"]["2025"]["total"], 6092634.4)
        self.assertEqual(r["average"]["2026-11"], {"brl": 32617.6, "usd": 5638.2})
        self.assertEqual(r["trades"]["2026-11"]["total"], 51327985)
        self.assertEqual(r["participation"]["2026-11"]["foreign"], 63.06)
        self.assertEqual(r["foreign"]["2026-10"]["balance"], 8167.1)
        self.assertEqual(snapshot(r)["foreign"]["balance"], -5339.7)

    def test_unknown_layout(self):
        self.assertIsNone(parse([["qualquer"], ["coisa;1;2"]]))


class Daily(unittest.TestCase):
    def test_difference_between_snapshots_of_same_month(self):
        shots = []
        for day, cash, buy in [(14, 300000.0, 190000.0), (17, 342813.1, 206244.6)]:
            r = parse([line.split(";") for line in report(day, day - 1, cash, cash + 10000, buy, 200000.0).splitlines()])
            shots.append(snapshot(r))
        days = daily(shots)
        volume = next(d for d in days if d["kind"] == "volume")
        foreign = next(d for d in days if d["kind"] == "foreign")
        self.assertEqual((volume["from"], volume["to"], volume["cash"]), ("2026-11-14", "2026-11-17", 42813.1))
        self.assertEqual((foreign["from"], foreign["to"], foreign["balance"]), ("2026-11-13", "2026-11-16", 16244.6))


class Store(unittest.TestCase):
    def test_waits_for_import(self):
        with tempfile.TemporaryDirectory() as tmp:
            result = B3Store(tmp).read()
        self.assertIsNone(result["data"])
        self.assertEqual(result["status"], "Aguardando importação")
        self.assertIn("licença", result["license"])

    def test_unknown_layout_and_broken_file(self):
        with tempfile.TemporaryDirectory() as tmp:
            folder = Path(tmp) / "data/b3"
            folder.mkdir(parents=True)
            write_xlsx(folder / "dados.xlsx")
            store = B3Store(tmp)
            self.assertEqual(store.read()["status"], "Formato não reconhecido")
            (folder / "quebrado.xlsx").write_bytes(b"nao e zip")
            self.assertTrue(store.read()["status"].startswith("Falha ao ler"))

    def test_keeps_snapshots_when_file_is_overwritten(self):
        with tempfile.TemporaryDirectory() as tmp:
            folder = Path(tmp) / "data/b3"
            folder.mkdir(parents=True)
            file = folder / "RELATORIO_DADOS_DE_MERCADO.csv"
            file.write_text(report(14, 13, 300000.0), encoding="utf-8-sig")
            store = B3Store(tmp)
            self.assertEqual(store.read()["data"]["days"], [])
            file.write_text(report(17, 16, 342813.1), encoding="utf-8-sig")
            import os
            os.utime(file, ns=(file.stat().st_mtime_ns + 10**9,) * 2)
            result = store.read()
            saved = json.loads((folder / "retratos.json").read_text(encoding="utf8"))
        self.assertEqual(result["status"], "Importado")
        self.assertEqual(result["data"]["snapshots"], 2)
        self.assertEqual(len(saved), 2)
        self.assertEqual({d["kind"] for d in result["data"]["days"]}, {"volume", "foreign"})


if __name__ == "__main__":
    unittest.main()
