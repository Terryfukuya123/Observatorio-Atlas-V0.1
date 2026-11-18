from unittest import TestCase

from server import inflation

CATALOG = [
    {"id": "ipca_difusao", "name": "Difusão", "block": "difusao"},
    *[{"id": k, "name": k, "block": "nucleos"} for k in inflation.CORES],
    {"id": "ipca_servicos", "name": "Serviços", "block": "grupos"},
    {"id": "icbr", "name": "IC-Br total", "block": "commodities"},
]


def monthly(values, start=(2023, 1)):
    year, month = start
    out = []
    for v in values:
        out.append([f"{year}-{month:02d}-01", str(v)])
        month += 1
        if month > 12:
            year, month = year + 1, 1
    return out


class InflationTest(TestCase):
    def test_compound_and_rates(self):
        self.assertAlmostEqual(inflation.compound([1, 1]), 2.01)
        r = inflation.rates(inflation._pts(monthly([0.5] * 24)))
        self.assertAlmostEqual(r["twelve"], round((1.005 ** 12 - 1) * 100, 2))
        self.assertAlmostEqual(r["saar3"], round((1.005 ** 12 - 1) * 100, 2))
        self.assertEqual(r["observed"], "2024-12")
        self.assertEqual(r["history"][-1], ["2024-12", r["twelve"]])
        self.assertIsNone(inflation.rates(inflation._pts(monthly([0.5] * 5))))

    def test_core_average_only_full_months(self):
        series = {k: monthly([0.3] * 14) for k in inflation.CORES}
        series["nucleo_p55"] = monthly([0.5] * 13)  # um mês a menos
        avg = inflation.core_average(series)
        self.assertEqual(len(avg), 13)
        self.assertAlmostEqual(avg[0][1], (0.3 * 4 + 0.5) / 5)
        self.assertEqual(inflation.core_average({}), [])

    def test_diffusion_compares_same_month(self):
        # Outubro: 50% nos cinco anos anteriores, 62% agora.
        values = []
        for year in range(2021, 2027):
            values += [55] * 9 + ([62] if year == 2026 else [50]) + ([45, 45] if year < 2026 else [])
        d = inflation.diffusion(inflation._pts(monthly(values, (2021, 1))))
        self.assertEqual((d["observed"], d["value"], d["seasonal"], d["seasonal_years"]), ("2026-10", 62.0, 50.0, 5))

    def test_index_changes(self):
        c = inflation.index_changes(inflation._pts(monthly([100 + i for i in range(13)])))
        self.assertEqual((c["month"], c["twelve"]), (round((112 / 111 - 1) * 100, 2), 12.0))

    def test_summary(self):
        series = {k: monthly([0.3] * 24) for k in inflation.CORES}
        series["ipca_servicos"] = monthly([0.5] * 24)
        series["ipca_difusao"] = monthly([60] * 24)
        series["icbr"] = monthly([100] * 24)
        s = inflation.summary(series, CATALOG, monthly([0.4] * 24))
        self.assertEqual(s["observed"], "2024-12")
        self.assertAlmostEqual(s["core_average"]["twelve"], round((1.003 ** 12 - 1) * 100, 2))
        self.assertEqual(s["groups"]["ipca_servicos"]["name"], "Serviços")
        self.assertEqual(s["commodities"]["icbr"]["twelve"], 0.0)
        self.assertEqual(len(s["cores"]), 5)
