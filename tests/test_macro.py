"""Camada macro com fixtures artificiais. Nenhuma chamada de rede sai da máquina."""
from datetime import UTC, date, datetime, timedelta
from http.client import HTTPConnection
import json
from pathlib import Path
from tempfile import TemporaryDirectory
from threading import Thread
from unittest import TestCase

from providers import bcb, worldbank
from server.app import Handler, ThreadingHTTPServer, ROOT
from server.macro import MacroStore, load_catalog

TODAY = date(2026, 11, 17)
NOW = datetime(2026, 11, 17, 20, tzinfo=UTC)


def sgs(*rows):
    return json.dumps([{"data": d, "valor": v} for d, v in rows]).encode()


def ptax(*rows):
    return json.dumps({"value": [{"cotacaoVenda": float(v), "dataHoraCotacao": f"{d} 13:05:00.000"} for d, v in rows]}).encode()


def wb(code, *rows):
    data = [{"indicator": {"id": code}, "countryiso3code": iso, "date": year, "value": value} for iso, year, value in rows]
    return json.dumps([{"page": 1, "pages": 1}, data]).encode()


class Providers(TestCase):
    def test_sgs_drops_future_and_blank(self):
        body = sgs(("16/11/2026", "13.75"), ("17/11/2026", "13.75"), ("09/12/2026", "13.75"), ("15/11/2026", ""))
        self.assertEqual(bcb.normalize_sgs(body, TODAY), [("2026-11-16", "13.75"), ("2026-11-17", "13.75")])

    def test_sgs_rejects_bad_input(self):
        for body in (sgs(("16/11/2026", "1"), ("16/11/2026", "2")), sgs(("16/11/2026", "NaN")),
                     sgs(("16/11/2026", "abc")), b'{"erro": 1}', sgs()):
            with self.subTest(body=body), self.assertRaises(ValueError):
                bcb.normalize_sgs(body, TODAY)

    def test_ptax_keeps_precision(self):
        body = json.dumps({"value": [{"cotacaoVenda": 5.584, "dataHoraCotacao": "2026-11-10 13:06:01.353639"}]})
        body = body.replace("5.584", "5.58400").encode()
        self.assertEqual(bcb.normalize_ptax(body, TODAY), [("2026-11-10", "5.58400")])
        with self.assertRaises(ValueError):
            bcb.normalize_ptax(ptax(("2026-11-18", "5.6")), TODAY)
        with self.assertRaises(ValueError):
            bcb.normalize_ptax(ptax(("2026-11-10", "0")), TODAY)

    def test_urls_are_allowlisted(self):
        self.assertTrue(bcb.sgs_url(432, "Diária", TODAY).startswith(bcb.HOSTS[0]))
        self.assertIn("dataInicial=", bcb.sgs_url(433, "Mensal", TODAY))
        self.assertIn("tipoBoletim%20eq%20%27Fechamento%27", bcb.ptax_url("USD", TODAY))
        for bad in (lambda: bcb.ptax_url("XYZ", TODAY), lambda: worldbank.url("../x"),
                    lambda: bcb.download("https://example.com/"), lambda: worldbank.download("https://example.com/")):
            with self.assertRaises(ValueError):
                bad()

    def test_worldbank_filters_aggregates(self):
        body = wb("FP.CPI.TOTL.ZG", ("BRA", "2025", 5.01), ("AFE", "2025", 3.1), ("WLD", "2025", 4.2), ("ARG", "2024", None))
        self.assertEqual(worldbank.normalize(body, "FP.CPI.TOTL.ZG", {"BRA", "ARG", "WLD"}),
                         {"BRA": {"year": "2025", "value": "5.01"}, "WLD": {"year": "2025", "value": "4.2"}})
        with self.assertRaises(ValueError):
            worldbank.normalize(wb("X.Y", ("BRA", "2025", 1)), "FP.CPI.TOTL.ZG", {"BRA"})
        with self.assertRaises(ValueError):
            worldbank.normalize(b'[{"message": [{"key": "Invalid value"}]}]', "FP.CPI.TOTL.ZG", {"BRA"})

    def test_catalog_matches_map(self):
        catalog = load_catalog(ROOT)
        self.assertGreaterEqual(len(catalog["brasil"]), 10)
        self.assertGreaterEqual(len(catalog["global"]), 8)
        for s in catalog["global"]:
            worldbank.url(s["code"])


class Fake:
    """Responde por prefixo de URL e registra as chamadas."""
    def __init__(self, fail=False):
        self.calls, self.fail, self.selic = [], fail, "13.75"

    def __call__(self, url):
        self.calls.append(url)
        if self.fail:
            raise OSError("rede")
        if "olinda" in url:
            return ptax(("2026-11-16", "5.70"), ("2026-11-17", "5.757"))
        if "bcdata.sgs" in url:
            return sgs(("14/11/2026", "13.50"), ("17/11/2026", self.selic))
        code = url.split("/indicator/")[1].split("?")[0]
        return wb(code, ("BRA", "2025", 2.5), ("USA", "2025", 1.8), ("WLD", "2025", 2.7), ("EUU", "2025", 9))


class Store(TestCase):
    def setUp(self):
        self.tmp = TemporaryDirectory()
        self.path = Path(self.tmp.name) / "macro.json"
        self.now = NOW
        self.fake = Fake()

    def tearDown(self):
        self.tmp.cleanup()

    def store(self, fetch=None):
        return MacroStore(ROOT, fetch=fetch or self.fake, clock=lambda: self.now, background=False, path=self.path)

    def test_overview_and_reuse(self):
        store = self.store()
        data = store.overview()
        total = len(store.catalog["brasil"]) + len(store.catalog["ptax"]) + len(store.catalog["global"])
        self.assertEqual(len(self.fake.calls), total)
        selic = data["brasil"][0]
        self.assertEqual((selic["value"], selic["observed"], selic["previous"]["delta"]), ("13.75", "2026-11-17", "0.25"))
        self.assertEqual(selic["license"], "ODbL 1.0")
        self.assertEqual(selic["collection"]["status"], "Atualizado")
        self.assertEqual(data["ptax"]["USD"]["value"], "5.757")
        self.assertAlmostEqual(data["ptax"]["USD"]["change_percent"], 1.0, places=6)
        self.assertEqual(data["indicators"][0]["coverage"], 2)
        store.overview()
        self.assertEqual(len(self.fake.calls), total)  # Dentro do TTL não há nova coleta.
        restarted = self.store()
        restarted.overview()
        self.assertEqual(len(self.fake.calls), total)  # Cache sobrevive ao reinício.

    def test_failure_keeps_last_valid(self):
        self.store().overview()
        self.now += timedelta(days=2)
        failing = Fake(fail=True)
        data = self.store(failing).overview()
        self.assertEqual(data["brasil"][0]["value"], "13.75")
        self.assertEqual(data["brasil"][0]["collection"]["status"], "Dado histórico")
        self.assertIn("OSError", data["brasil"][0]["collection"]["error"])
        calls = len(failing.calls)
        self.now += timedelta(minutes=10)
        self.store(failing).overview()
        self.assertEqual(len(failing.calls), calls)  # Espera a janela de nova tentativa.

    def test_first_failure(self):
        data = self.store(Fake(fail=True)).overview()
        self.assertNotIn("value", data["brasil"][0])
        self.assertEqual(data["brasil"][0]["collection"]["status"], "Fonte indisponível")

    def test_brasilia_day(self):
        # 23h30 em Brasília já é o dia seguinte em UTC: a vigência futura da meta Selic não entra.
        self.now = datetime(2026, 11, 18, 2, 30, tzinfo=UTC)
        self.fake.selic = "13.75"
        fake = self.fake
        original = fake.__call__
        def fetch(url):
            if "sgs.432" in url:
                fake.calls.append(url)
                self.assertIn("dataFinal=17/11/2026", url)
                return sgs(("17/11/2026", "13.75"), ("18/11/2026", "13.75"))
            return original(url)
        data = self.store(fetch).overview()
        self.assertEqual(data["brasil"][0]["observed"], "2026-11-17")

    def test_corrupt_cache(self):
        self.path.write_text('{"entries": {"sgs:432": {"next": "ontem"}}}', encoding="utf8")
        self.assertIn("rejeitado", self.store().warning)

    def test_country_and_indicator(self):
        store = self.store()
        country = store.country("BRA")
        growth = next(r for r in country["indicators"] if r["id"] == "pib_crescimento")
        self.assertEqual((growth["value"], growth["year"], growth["world"]["value"]), ("2.5", "2025", "2.7"))
        self.assertIsNone(store.country("XXX"))
        self.assertIsNone(store.indicator("inexistente"))
        values = store.indicator("inflacao")["values"]
        self.assertEqual(set(values), {"BRA", "USA", "WLD"})


class Http(TestCase):
    def test_routes(self):
        with TemporaryDirectory() as tmp, ThreadingHTTPServer(("127.0.0.1", 0), Handler) as server:
            server.macro = MacroStore(ROOT, fetch=Fake(), clock=lambda: NOW, background=False, path=Path(tmp) / "m.json")
            worker = Thread(target=server.serve_forever, daemon=True)
            worker.start()
            try:
                for path, code in [("/api/macro", 200), ("/api/macro/pais?iso=bra", 200), ("/api/macro/pais?iso=ZZZ", 400),
                                   ("/api/macro/indicador?id=inflacao", 200), ("/api/macro/indicador?id=x", 400)]:
                    with self.subTest(path=path):
                        conn = HTTPConnection("127.0.0.1", server.server_port, timeout=5)
                        conn.request("GET", path)
                        response = conn.getresponse()
                        body = response.read()
                        self.assertEqual(response.status, code)
                        if code == 200:
                            self.assertEqual(response.getheader("Cache-Control"), "no-store")
                            json.loads(body)
                        conn.close()
            finally:
                server.shutdown()
                worker.join()
