from datetime import UTC, datetime, timedelta
import io
import json
from pathlib import Path
from tempfile import TemporaryDirectory
from unittest import TestCase
from zipfile import ZipFile

from providers import cvm_daily
from server.funds import FundFlows, periods

NOW = datetime(2026, 11, 18, 12, tzinfo=UTC)


def archive(name, text):
    buffer = io.BytesIO()
    with ZipFile(buffer, "w") as z:
        z.writestr(name, text.encode("latin-1"))
    return buffer.getvalue()


REGISTRY_HEADER = "ID_Registro_Fundo;CNPJ_Classe;Classificacao;Classificacao_Anbima;Classe_Cotas\n"
REGISTRY_ROWS = [
    ("11111111000111", "Renda Fixa", "Renda Fixa Duração Livre", "N"),
    ("22222222000122", "Ações", "Ações Livre", "N"),
    ("33333333000133", "Multimercado", "Previdência Multimercado Livre", "N"),
    ("44444444000144", "Renda Fixa", "", "S"),  # Fundo de cotas: fora da soma.
] + [(f"9{i:013d}", "Multimercado", "", "N") for i in range(1000)]
REGISTRY = archive("registro_classe.csv", REGISTRY_HEADER + "".join(f"1;{c};{a};{b};{d}\n" for c, a, b, d in REGISTRY_ROWS))

DAILY_HEADER = "TP_FUNDO_CLASSE;CNPJ_FUNDO_CLASSE;ID_SUBCLASSE;DT_COMPTC;VL_TOTAL;VL_QUOTA;VL_PATRIM_LIQ;CAPTC_DIA;RESG_DIA;NR_COTST\n"


def daily(period, rows):
    return archive(f"inf_diario_fi_{period}.csv", DAILY_HEADER + "".join(
        f"CLASSES - FIF;{c};;{d};0;1;{pl};{cap};{res};1\n" for c, d, pl, cap, res in rows))


def month_rows(year, month, extra=()):
    rows = []
    for d in (3, 4, 5):
        day = f"{year}-{month:02d}-{d:02d}"
        rows += [("11.111.111/0001-11", day, "1000000000", "3000000", "1000000"),
                 ("22.222.222/0001-22", day, "500000000", "0", "2000000"),
                 ("33.333.333/0001-33", day, "200000000", "1000000", "0"),
                 ("44.444.444/0001-44", day, "900000000", "50000000", "0")]
    return rows + list(extra)


class Fake:
    def __init__(self):
        self.calls = []

    def __call__(self, url):
        self.calls.append(url)
        if url == cvm_daily.REGISTRY:
            return REGISTRY
        period = url.rsplit("_", 1)[1][:6]
        year, month = int(period[:4]), int(period[4:])
        extra = []
        if period == "202611":
            # Dia 06 com poucas classes reportando: incompleto.
            extra = [("11.111.111/0001-11", "2026-11-06", "1000000000", "9000000", "0")]
        return daily(period, month_rows(year, month, extra))


class Provider(TestCase):
    def test_registry_categories(self):
        registry = cvm_daily.normalize_registry(REGISTRY)
        self.assertEqual(registry["11111111000111"], "rf")
        self.assertEqual(registry["33333333000133"], "pv")
        self.assertEqual(registry["44444444000144"], cvm_daily.FIC)

    def test_daily_skips_fic_and_other_months(self):
        registry = cvm_daily.normalize_registry(REGISTRY)
        body = daily("202611", month_rows(2026, 11, [("11.111.111/0001-11", "2026-10-31", "1", "1", "0"),
                                                     ("55.555.555/0001-55", "2026-11-03", "1", "1", "0")]))
        out = cvm_daily.normalize_daily(body, registry, "202611")
        self.assertEqual(out["_"], [13, 1])
        self.assertEqual(out["2026-11-03"]["rf"], ["3000000.00", "1000000.00", "1000000000.00", 1])
        self.assertNotIn("2026-10-31", out)
        self.assertEqual(set(out["2026-11-03"]), {"rf", "ac", "pv"})

    def test_rejects_unexpected_columns(self):
        with self.assertRaises(ValueError):
            cvm_daily.normalize_daily(archive("x.csv", "A;B\n1;2\n"), {}, "202611")

    def test_download_host_is_restricted(self):
        with self.assertRaises(ValueError):
            cvm_daily.download("https://example.com/inf_diario.zip")


class Store(TestCase):
    def setUp(self):
        self.tmp = TemporaryDirectory()
        self.path = Path(self.tmp.name) / "fundos.json"
        self.fake = Fake()

    def tearDown(self):
        self.tmp.cleanup()

    def store(self, now=NOW):
        return FundFlows(".", fetch=self.fake, clock=lambda: now, background=False, path=self.path)

    def test_periods_cover_previous_year(self):
        self.assertEqual(periods(NOW.date())[0], "202501")
        self.assertEqual(periods(NOW.date())[-1], "202611")
        self.assertEqual(len(periods(NOW.date())), 23)

    def test_summary(self):
        payload = self.store().read()
        data = payload["data"]
        self.assertEqual(len(self.fake.calls), 24)
        self.assertEqual(data["through"], "2026-11-05")  # 06/11 incompleto.
        self.assertEqual(data["pending"], [{"date": "2026-11-06", "classes": 1}])
        ytd = {i["id"]: i for i in data["ytd"]}
        # 11 meses × 3 dias × R$ 2 mi em renda fixa; o mesmo intervalo de 2025.
        self.assertEqual((ytd["rf"]["value"], ytd["rf"]["previous"]), ("66.0", "66.0"))
        self.assertEqual(ytd["ac"]["value"], "-66.0")
        self.assertEqual(data["months"][-1], {"month": "2026-11", "partial": True, "rf": "6.0", "mm": "0.0", "ac": "-6.0",
                                              "pv": "3.0", "cb": "0.0", "ou": "0.0"})
        self.assertEqual(data["equity"]["total"], "1700.0")
        self.assertEqual(payload["license"], "ODbL 1.0")

    def test_cache_and_ttl(self):
        self.store().read()
        calls = len(self.fake.calls)
        self.store().read()
        self.assertEqual(len(self.fake.calls), calls)  # Cache sobrevive ao reinício.
        self.store(NOW + timedelta(hours=7)).read()
        self.assertEqual(self.fake.calls[calls:], [cvm_daily.DAILY.format(period="202611")])  # Só o mês corrente.

    def test_failure_keeps_data(self):
        self.store().read()
        def broken(url):
            raise OSError("rede")
        store = FundFlows(".", fetch=broken, clock=lambda: NOW + timedelta(days=2), background=False, path=self.path)
        payload = store.read()
        self.assertEqual(payload["data"]["through"], "2026-11-05")
        self.assertTrue(payload["collection"]["202611"]["error"])
        stored = json.loads(self.path.read_text(encoding="utf8"))
        self.assertIn("days", stored["months"]["202611"])
