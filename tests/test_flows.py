from datetime import date
from unittest import TestCase

from providers import bcb
from server import flows
from server.macro import load_catalog
from server.app import ROOT

from test_macro import ATUACOES


class Flows(TestCase):
    def setUp(self):
        self.catalog = load_catalog(ROOT)["fluxo"]

    def series(self):
        out = {s["id"]: [] for s in self.catalog}
        # Dois anos de câmbio diário: o acumulado compara o mesmo intervalo do ano anterior.
        out["cambio_total"] = [("2025-01-10", "100"), ("2025-11-06", "50"), ("2025-12-01", "999"),
                               ("2026-01-05", "200.5"), ("2026-11-05", "-20"), ("2026-11-06", "-30")]
        out["cambio_comercial"] = [("2026-01-05", "150"), ("2026-11-06", "10")]
        out["cambio_financeiro"] = [("2026-01-05", "50.5"), ("2026-11-06", "-40")]
        out["posicao_bancos"] = [("2026-08-01", "-22088.2"), ("2026-09-01", "-26218.5")]
        out["interbancario"] = [("2026-11-16", "230000000"), ("2026-11-17", "360000000")]
        out["capitais_estrangeiros"] = [("2025-03-01", "10"), ("2025-12-01", "500"), ("2026-03-01", "40"), ("2026-09-01", "60")]
        return out

    def test_year_to_date_compares_same_window(self):
        data = flows.summary(self.series(), None, self.catalog)
        self.assertEqual(data["through"], "2026-11-06")
        total = data["ytd"]["cambio_total"]
        # 2026: 200,5 − 20 − 30; 2025 até 06/11: 100 + 50 (dezembro fica de fora).
        self.assertEqual((total["value"], total["previous"]), ("150.5", "150.0"))
        self.assertIsNone(data["central_bank"])

    def test_months_days_and_market(self):
        data = flows.summary(self.series(), None, self.catalog)
        last = data["months"][-1]
        self.assertEqual((last["month"], last["total"], last["partial"]), ("2026-11", "-50.0", True))
        self.assertEqual(data["days"][-1], {"date": "2026-11-06", "total": "-30.0", "comercial": "10.0", "financeiro": "-40.0"})
        self.assertEqual(data["market"]["banks"]["value"], "-26218.5")
        self.assertEqual(data["market"]["interbank"], {"observed": "2026-11-17", "value": "360.0", "average20": "295.0"})

    def test_agents_use_last_month_published(self):
        agents = flows.summary(self.series(), None, self.catalog)["agents"]
        self.assertEqual(agents["through"], "2026-09-01")
        item = agents["items"][0]
        self.assertEqual((item["id"], item["value"], item["previous"]), ("capitais_estrangeiros", "100.0", "10.0"))

    def test_without_exchange_series(self):
        self.assertIsNone(flows.summary({}, None, self.catalog))


class Atuacoes(TestCase):
    def test_normalize_and_summarize(self):
        operations = bcb.normalize_atuacoes(ATUACOES, date(2026, 11, 17))
        self.assertEqual(len(operations), 3)  # 2024 fica fora da janela.
        self.assertEqual(operations[0], ("2026-02-11", "Swap Cambial", "Tradicional", "1500000000.00", "1000000000.00"))
        self.assertIsNone(operations[-1][4])
        bc = flows.central_bank(operations, date(2026, 11, 6))
        self.assertEqual(bc["through"], "2026-03-03")
        self.assertEqual([(i["instrument"], i["accepted"]) for i in bc["items"]],
                         [("Venda à vista", "1250.0"), ("Swap tradicional", "1000.0")])
        self.assertEqual([r["instrument"] for r in bc["recent"]], ["Venda à vista", "Swap tradicional"])

    def test_rejects_unexpected_columns(self):
        with self.assertRaises(ValueError):
            bcb.normalize_atuacoes("Data,Valor\n2026-01-01,1\n".encode(), date(2026, 11, 17))

    def test_rejects_thousand_separator(self):
        body = ATUACOES.replace(b'"1250000000,00"', b'"1.250.000.000,00"')
        with self.assertRaises(ValueError):
            bcb.normalize_atuacoes(body, date(2026, 11, 17))

    def test_download_host_is_restricted(self):
        with self.assertRaises(ValueError):
            bcb.download_atuacoes("https://example.com/atuacoes.csv")
