"""Leitura de .xlsx sem dependências e a loja da planilha B3."""
import tempfile
import unittest
import zipfile
from pathlib import Path

from server.b3 import B3Store, read_xlsx

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


def write(path):
    with zipfile.ZipFile(path, "w") as z:
        z.writestr("xl/workbook.xml", WORKBOOK)
        z.writestr("xl/_rels/workbook.xml.rels", RELS)
        z.writestr("xl/sharedStrings.xml", SHARED)
        z.writestr("xl/worksheets/sheet1.xml", SHEET)


class ReadXlsx(unittest.TestCase):
    def test_reads_cells_in_position(self):
        with tempfile.TemporaryDirectory() as tmp:
            file = Path(tmp) / "a.xlsx"
            write(file)
            rows = read_xlsx(file)["Dados"]
        self.assertEqual(rows[0], ["Volume", None, 1234.5])
        self.assertEqual(rows[1], [None, "Estrangeiros", "texto"])


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
            write(folder / "dados.xlsx")
            store = B3Store(tmp)
            self.assertEqual(store.read()["status"], "Formato não reconhecido")
            (folder / "quebrado.xlsx").write_bytes(b"nao e zip")
            self.assertTrue(store.read()["status"].startswith("Falha ao ler"))


if __name__ == "__main__":
    unittest.main()
