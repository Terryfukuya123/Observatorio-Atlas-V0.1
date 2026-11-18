from datetime import UTC, date, datetime, timedelta
from tempfile import TemporaryDirectory
from unittest import TestCase

from providers import tesouro
from server.health import health
from server.tesouro import TesouroStore

NOW = datetime(2026, 11, 18, 15, tzinfo=UTC)
HEADER = "Tipo Titulo;Data Vencimento;Data Base;Taxa Compra Manha;Taxa Venda Manha;PU Compra Manha;PU Venda Manha;PU Base Manha\n"


def fmt(v):
    return f"{v:.2f}".replace(".", ",")


def csv_body(days):
    """Prefixados a 14% e IPCA+ a 7%, com um choque de +1 p.p. no prefixado no último dia."""
    lines = []
    for base in days:
        shock = 1.0 if base == days[-1] else 0.0
        b = base.strftime("%d/%m/%Y")
        for name, venc, rate in [
            ("Tesouro Prefixado", "01/01/2029", 14.0 + shock),
            ("Tesouro Prefixado", "01/01/2032", 14.0 + shock),
            ("Tesouro Prefixado com Juros Semestrais", "01/01/2037", 14.0 + shock),
            ("Tesouro IPCA+", "15/05/2029", 7.0),
            ("Tesouro IPCA+ com Juros Semestrais", "15/08/2040", 7.0),
            ("Tesouro Selic", "01/03/2029", 0.05),
        ]:
            lines.append(f"{name};{venc};{b};{fmt(rate - 0.06)};{fmt(rate + 0.06)};1;1;1\n")
        lines.append(f"Tesouro Prefixado;01/01/2030;{b};;;0;0;0\n")  # fora de venda: ignorado
    return (HEADER + "".join(lines)).encode("latin-1")


DAYS = [date(2026, 11, 17) - timedelta(days=k) for k in range(420, -1, -7)] + [date(2026, 11, 17)]
DAYS = sorted(set(DAYS))
BODY = csv_body(DAYS)


class ProviderTest(TestCase):
    def test_parse_and_curves(self):
        days = tesouro.parse(BODY, date(2024, 1, 1))
        last = days[DAYS[-1]]
        self.assertEqual({r[2] for r in last}, {"LTN", "NTN-F", "NTN-B Principal", "NTN-B"})
        self.assertAlmostEqual(next(r[4] for r in last if r[3] == date(2032, 1, 1)), 15.0)  # média de compra e venda

    def test_interp(self):
        pts = [(2.0, 10.0, None), (4.0, 12.0, None)]
        self.assertEqual(tesouro.interp(pts, 3.0), (11.0, False))
        self.assertEqual(tesouro.interp(pts, 1.5, 1.0), (10.0, True))
        self.assertEqual(tesouro.interp(pts, 0.5, 1.0), (None, False))
        self.assertEqual(tesouro.interp(pts, 5.0), (None, False))

    def test_breakeven(self):
        self.assertAlmostEqual(tesouro.breakeven(14.0, 7.0), (1.14 / 1.07 - 1) * 100)

    def test_summary(self):
        s = tesouro.summarize(tesouro.parse(BODY, date(2024, 1, 1)), date(2026, 11, 18))
        self.assertEqual(s["observed"], "2026-11-17")
        self.assertAlmostEqual(s["now"]["be5"], round(tesouro.breakeven(15.0, 7.0), 2))
        self.assertAlmostEqual(s["changes"]["pre5"]["month"], 1.0)
        self.assertAlmostEqual(s["changes"]["real5"]["month"], 0.0)
        # O prefixado de 2029 vence antes do primeiro IPCA+: a inflação implícita é estimada.
        first = s["implied"][0]
        self.assertEqual((first["maturity"], first["estimated"]), ("2029-01-01", True))
        self.assertFalse(s["implied"][1]["estimated"])
        self.assertNotIn("2030-01-01", [t["maturity"] for t in s["titles"]])
        self.assertEqual(s["history"][-1]["date"], "2026-11-17")
        ltn = next(t for t in s["titles"] if t["maturity"] == "2032-01-01")
        self.assertEqual(ltn["month"], 1.0)

    def test_rejects_unknown_layout(self):
        with self.assertRaises(ValueError):
            tesouro.parse(b"a;b;c\n1;2;3\n", date(2024, 1, 1))

    def test_download_only_known_host(self):
        with self.assertRaises(ValueError):
            tesouro.download("https://exemplo.com/x.csv")


class StoreTest(TestCase):
    def test_collect_cache_and_health(self):
        with TemporaryDirectory() as tmp:
            calls = []

            def fetch(url):
                calls.append(url)
                return BODY

            store = TesouroStore(tmp, fetch=fetch, clock=lambda: NOW, background=False)
            result = store.read()
            self.assertEqual((result["status"], result["data"]["observed"]), ("Atualizado", "2026-11-17"))
            store.read()
            self.assertEqual(len(calls), 1)  # dentro das 6 horas não coleta de novo
            again = TesouroStore(tmp, fetch=fetch, clock=lambda: NOW, background=False)
            self.assertEqual(again.read()["data"]["now"], result["data"]["now"])

            class Server:
                pass
            server = Server()
            server.tesouro = again
            row = next(i for i in health(server, NOW)["items"] if i["key"] == "td")
            self.assertEqual((row["level"], row["observed"]), ("ok", "2026-11-17"))

    def test_failure_keeps_previous_data(self):
        with TemporaryDirectory() as tmp:
            clock = [NOW]
            store = TesouroStore(tmp, fetch=lambda url: BODY, clock=lambda: clock[0], background=False)
            store.read()

            def broken(url):
                raise OSError("fora do ar")
            store.fetch = broken
            clock[0] = NOW + timedelta(hours=7)
            result = store.read()
            self.assertEqual(result["status"], "Dado histórico")
            self.assertIn("Falha", result["error"])
            self.assertEqual(result["data"]["observed"], "2026-11-17")
