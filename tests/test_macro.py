"""Camada macro com fixtures artificiais. Nenhuma chamada de rede sai da máquina."""
from datetime import UTC, date, datetime, timedelta
from http.client import HTTPConnection
import json
from pathlib import Path
from tempfile import TemporaryDirectory
from threading import Thread
from unittest import TestCase

from providers import bcb, ibge, treasury, worldbank
from server.app import Handler, ThreadingHTTPServer, ROOT
from server.macro import MacroStore, load_catalog

TODAY = date(2026, 11, 17)
NOW = datetime(2026, 11, 17, 20, tzinfo=UTC)


def sgs(*rows):
    return json.dumps([{"data": d, "valor": v} for d, v in rows]).encode()


def ptax(*rows):
    return json.dumps({"value": [{"cotacaoVenda": float(v), "dataHoraCotacao": f"{d} 13:05:00.000"} for d, v in rows]}).encode()


def focus(*rows):
    keys = ("Indicador", "Data", "DataReferencia", "Mediana", "numeroRespondentes")
    return json.dumps({"value": [dict(zip(keys, r), IndicadorDetalhe=None) for r in rows]}).encode()


FOCUS = focus(*[("IPCA", d, "2026", m, 140) for d, m in [("2026-10-13", 5.0), ("2026-10-20", 5.05), ("2026-10-27", 5.08),
                                                       ("2026-11-03", 5.1), ("2026-11-12", 5.1082), ("2026-11-13", 5.1082)]],
              ("IPCA", "2026-11-13", "2027", 5.0, 146), ("IPCA", "2026-11-13", "2035", 3.0, 20),
              ("Selic", "2026-11-13", "2026", 13.75, 144))


HEADER = 'Date,"1 Mo","1.5 Month","2 Mo","3 Mo","4 Mo","6 Mo","1 Yr","2 Yr","3 Yr","5 Yr","7 Yr","10 Yr","20 Yr","30 Yr"'
UST = {
    "2026": "\n".join([HEADER, "11/17/2026,4.09,4.24,4.26,4.33,4.32,4.41,4.60,4.80,4.84,4.90,4.99,5.10,5.50,5.46",
                        "11/10/2026,4.10,4.19,4.27,4.34,4.33,4.42,4.62,4.90,4.87,4.93,5.01,5.12,5.51,5.46",
                        "01/02/2026,3.72,3.71,3.66,3.65,3.62,3.58,3.47,3.47,3.55,3.74,3.95,4.19,4.81,4.86"]).encode(),
    # Ano anterior sem a coluna de 6 semanas, como nos arquivos antigos.
    "2025": "\n".join(['Date,"1 Mo","2 Mo","3 Mo","4 Mo","6 Mo","1 Yr","2 Yr","3 Yr","5 Yr","7 Yr","10 Yr","20 Yr","30 Yr"',
                        "12/31/2025,3.80,3.75,3.70,3.66,3.60,3.50,3.48,3.55,3.75,3.96,4.20,4.80,4.85",
                        "11/14/2025,4.50,4.48,4.45,4.40,4.35,4.20,4.60,4.10,4.15,4.20,4.40,4.70,4.70"]).encode(),
}


def sidra(variable, values, locality="1"):
    return json.dumps([{"id": str(variable), "resultados": [{"classificacoes": [], "series": [
        {"localidade": {"id": locality}, "serie": values}]}]}]).encode()


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

    def test_focus(self):
        url = bcb.focus_url({"IPCA", "Câmbio"}, TODAY)
        self.assertTrue(url.startswith(bcb.HOSTS[1]))
        self.assertIn("C%C3%A2mbio", url)
        self.assertIn("baseCalculo%20eq%200", url)
        data = bcb.normalize_focus(FOCUS, TODAY, {"IPCA", "Selic"})
        self.assertEqual(set(data["IPCA"]), {"2026", "2027"})  # 2035 fica fora do horizonte.
        self.assertEqual(data["IPCA"]["2026"][-1], ("2026-11-13", "5.1082", 140))
        with self.assertRaises(ValueError):
            bcb.normalize_focus(FOCUS, TODAY, {"IPCA"})  # Indicador não solicitado.
        with self.assertRaises(ValueError):
            bcb.normalize_focus(focus(("IPCA", "2026-11-13", "2026", 5, 1), ("IPCA", "2026-11-13", "2026", 5, 1)), TODAY, {"IPCA"})
        with self.assertRaises(ValueError):
            bcb.focus_url({"x' or 1 eq 1"}, TODAY)

    def test_treasury(self):
        rows = treasury.normalize(UST["2025"], TODAY)
        self.assertEqual(rows[0][0], "2025-11-14")
        self.assertNotIn("6S", rows[0][1])
        self.assertEqual(treasury.normalize(UST["2026"], TODAY)[-1][1]["10A"], "5.10")
        self.assertTrue(treasury.url(2026).startswith(treasury.BASE))
        for body in (b"Data,x\n", (HEADER + "\n11/18/2026,1,1,1,1,1,1,1,1,1,1,1,1,1,1").encode(),
                     (HEADER + "\n11/17/2026,abc,1,1,1,1,1,1,1,1,1,1,1,1,1").encode(),
                     "\n".join([HEADER, "11/17/2026,1,1,1,1,1,1,1,1,1,1,1,1,1,1"] * 1 + ["11/17/2026,1,1,1,1,1,1,1,1,1,1,1,1,1,1"]).encode()):
            with self.subTest(body=body[:40]), self.assertRaises(ValueError):
                treasury.normalize(body, TODAY)
        with self.assertRaises(ValueError):
            treasury.download("https://example.com/x.csv")

    def test_ibge(self):
        self.assertEqual(ibge.period("202609", "Mensal"), ("2026-09-01", "set/2026"))
        self.assertEqual(ibge.period("202602", "Trimestral"), ("2026-06-01", "2º tri/2026"))
        self.assertEqual(ibge.period("202602", "Trimestral móvel"), ("2026-02-01", "dez–fev/2026"))
        rows = ibge.normalize(sidra(4099, {"202608": "5.3", "202609": "5.2", "202607": "..."}), 4099, "Trimestral móvel", TODAY)
        self.assertEqual(rows, [("2026-08-01", "5.3", "jun–ago/2026"), ("2026-09-01", "5.2", "jul–set/2026")])
        address = ibge.url(8888, 11601, "544/129314")
        self.assertTrue(address.startswith(ibge.BASE))
        self.assertIn("periodos/-36/variaveis/11601?localidades=N1%5Ball%5D&classificacao=544%5B129314%5D", address)
        for body, variable in ((sidra(4099, {"202612": "1"}), 4099), (sidra(4099, {"202609": "1"}), 1),
                               (sidra(4099, {"202609": "1"}, locality="33"), 4099), (sidra(4099, {"202613": "1"}), 4099),
                               (sidra(4099, {"202609": "abc"}), 4099), (sidra(4099, {"202609": "..."}), 4099)):
            with self.subTest(body=body[-60:]), self.assertRaises(ValueError):
                ibge.normalize(body, variable, "Mensal", TODAY)
        with self.assertRaises(ValueError):
            ibge.download("https://example.com/")

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
        if url.startswith(ibge.BASE):
            variable = url.split("/variaveis/")[1].split("?")[0]
            return sidra(variable, {"202608": "5.3", "202609": "5.2"})
        if url.startswith(treasury.BASE):
            return UST[url.split("csv/")[1][:4]]
        if "Expectativas" in url:
            return FOCUS
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
        total = len(store.catalog["brasil"]) + len(store.catalog["ptax"]) + len(store.catalog["global"]) + len(store.catalog["ibge"]) + 3
        self.assertEqual(len(self.fake.calls), total)
        selic = data["brasil"][0]
        self.assertEqual((selic["value"], selic["observed"], selic["previous"]["delta"]), ("13.75", "2026-11-17", "0.25"))
        self.assertEqual(selic["license"], "ODbL 1.0")
        self.assertEqual(selic["collection"]["status"], "Atualizado")
        self.assertEqual(data["ptax"]["USD"]["value"], "5.757")
        self.assertAlmostEqual(data["ptax"]["USD"]["change_percent"], 1.0, places=6)
        self.assertEqual(data["indicators"][0]["coverage"], 2)
        ipca = next(f for f in data["focus"]["indicators"] if f["indicator"] == "IPCA")["years"][0]
        self.assertEqual((ipca["year"], ipca["median"], ipca["respondents"]), ("2026", "5.1082", 140))
        self.assertEqual(ipca["week_ago"], {"observed": "2026-11-03", "median": "5.1"})
        self.assertEqual(ipca["four_weeks_ago"]["observed"], "2026-10-13")
        self.assertEqual(ipca["trend"], {"direction": "alta", "weeks": 4})
        self.assertNotIn("history", ipca)
        self.assertEqual(data["focus"]["license"], "ODbL 1.0")
        self.assertEqual(data["us_curve"]["spreads"], {"10A-2A": "0.30", "10A-3M": "0.77"})
        self.assertEqual([c["code"] for c in data["us_curve"]["key"]], ["3M", "2A", "10A", "30A"])
        unemployment = data["ibge"][0]
        self.assertEqual((unemployment["value"], unemployment["period"], unemployment["previous"]["delta"]), ("5.2", "jul–set/2026", "-0.1"))
        self.assertEqual(unemployment["history"], [["2026-08-01", "5.3"], ["2026-09-01", "5.2"]])
        self.assertIn("IBGE", unemployment["license"])
        store.overview()
        self.assertEqual(len(self.fake.calls), total)  # Dentro do TTL não há nova coleta.
        restarted = self.store()
        restarted.overview()
        self.assertEqual(len(self.fake.calls), total)  # Cache sobrevive ao reinício.

    def test_curve(self):
        curve = self.store().curve_detail()
        self.assertEqual(curve["observed"], "2026-11-17")
        self.assertEqual(len(curve["curve"]), 14)
        labels = {c["label"]: c["observed"] for c in curve["comparisons"]}
        self.assertEqual(labels, {"1 semana": "2026-11-10", "1 mês": "2026-01-02", "início do ano": "2025-12-31", "1 ano": "2025-11-14"})
        self.assertEqual(curve["spread_history"]["10A-2A"][0], ["2025-11-14", "-0.20"])
        self.assertEqual(curve["inverted"], {"10A-2A": False, "10A-3M": False})
        self.assertEqual(len(curve["history"]["10A"]), 5)
        self.assertIn("Domínio público", curve["license"])

    def test_closed_year_refreshes_weekly(self):
        self.assertEqual(MacroStore.ttl("ust:2025", NOW), timedelta(days=7))
        self.assertEqual(MacroStore.ttl("ust:2026", NOW), timedelta(hours=4))

    def test_downloader_by_source(self):
        store = MacroStore(ROOT, clock=lambda: NOW, background=False, path=self.path)
        expected = {"sgs": bcb.download, "ptax": bcb.download, "focus": bcb.download,
                    "wb": worldbank.download, "ust": treasury.download, "ibge": ibge.download}
        for key, _, _ in store.jobs(TODAY):
            self.assertIs(store.downloader(key), expected[key.split(":")[0]], key)

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
                                   ("/api/macro/indicador?id=inflacao", 200), ("/api/macro/focus", 200), ("/api/macro/curva", 200), ("/api/macro/indicador?id=x", 400)]:
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
