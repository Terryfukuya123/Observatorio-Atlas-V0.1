import json
from datetime import date
from unittest import TestCase

from providers import bcb
from server import surprises

TODAY = date(2026, 11, 18)


def focus(rows):
    return json.dumps({"value": rows}).encode()


class ProviderTest(TestCase):
    def test_monthly_keeps_last_survey(self):
        body = focus([
            {"Indicador": "IPCA", "Data": "2026-11-10", "DataReferencia": "10/2026", "Mediana": 0.30, "DesvioPadrao": 0.05, "numeroRespondentes": 130},
            {"Indicador": "IPCA", "Data": "2026-11-11", "DataReferencia": "10/2026", "Mediana": 0.264, "DesvioPadrao": 0.061, "numeroRespondentes": 140},
            {"Indicador": "IPCA", "Data": "2026-11-12", "DataReferencia": "11/2026", "Mediana": 0.2, "DesvioPadrao": None, "numeroRespondentes": 0},
        ])
        out = bcb.normalize_focus_monthly(body, TODAY, {"IPCA"})
        self.assertEqual(out, {"IPCA": {"2026-10": ["2026-11-11", "0.264", "0.061", 140]}})
        with self.assertRaises(ValueError):
            bcb.normalize_focus_monthly(focus([{"Indicador": "Outro", "Data": "2026-11-11", "DataReferencia": "10/2026",
                                                "Mediana": 1, "numeroRespondentes": 1}]), TODAY, {"IPCA"})
        with self.assertRaises(ValueError):
            bcb.normalize_focus_monthly(focus([{"Indicador": "IPCA", "Data": "2026-11-30", "DataReferencia": "10/2026",
                                                "Mediana": 1, "numeroRespondentes": 1}]), TODAY, {"IPCA"})

    def test_urls(self):
        url = bcb.focus_monthly_url({"IPCA"}, TODAY)
        self.assertTrue(url.startswith(bcb.HOSTS[1]))
        self.assertIn("11%2F2026", url)
        self.assertIn("11%2F2024", url)
        self.assertNotIn("10%2F2024", url)
        with self.assertRaises(ValueError):
            bcb.focus_monthly_url({"IPCA' or 1"}, TODAY)
        self.assertIn("R8%2F2026", bcb.focus_selic_url(TODAY))

    def test_selic_order_and_validation(self):
        body = focus([
            {"Data": "2026-10-30", "Reuniao": "R7/2026", "Mediana": 13.75, "DesvioPadrao": 0.1, "numeroRespondentes": 60},
            {"Data": "2026-11-13", "Reuniao": "R8/2026", "Mediana": 13.75, "DesvioPadrao": 0.2, "numeroRespondentes": 60},
            {"Data": "2026-11-13", "Reuniao": "R1/2027", "Mediana": 13.5, "DesvioPadrao": 0.3, "numeroRespondentes": 60},
        ])
        self.assertEqual(list(bcb.normalize_focus_selic(body, TODAY)), ["R7/2026", "R8/2026", "R1/2027"])
        with self.assertRaises(ValueError):
            bcb.normalize_focus_selic(focus([{"Data": "2026-11-13", "Reuniao": "X", "Mediana": 1, "numeroRespondentes": 1}]), TODAY)


SPEC = {"id": "ipca", "indicator": "IPCA", "name": "IPCA", "actual": "sgs:433", "group": "inflacao"}


class SummaryTest(TestCase):
    def test_indicator_surprise_and_pending(self):
        expectations = {"2026-09": ["2026-10-08", "0.6", "0.1", 136], "2026-10": ["2026-11-11", "0.264", "0.061", 140],
                        "2026-11": ["2026-11-13", "0.2", "0.05", 120]}
        actual = surprises.actual_map([["2026-09-01", "0.62"], ["2026-10-01", "0.14"]])
        it = surprises.indicator(SPEC, expectations, actual)
        self.assertEqual(it["latest"]["period"], "2026-10")
        self.assertAlmostEqual(it["latest"]["surprise"], -0.124)
        self.assertEqual(it["latest"]["verdict"], "abaixo")
        self.assertEqual(it["history"][0]["verdict"], "em linha")  # 0,02 p.p. fica abaixo do limite
        self.assertEqual(it["next"]["period"], "2026-11")
        self.assertEqual((it["score"]["below"], it["score"]["inline"], it["score"]["above"]), (1, 1, 0))

    def test_inflation_index_caps_and_averages(self):
        items = [dict(group="inflacao", history=[dict(period="2026-09", z=1.0), dict(period="2026-10", z=-4.0)]),
                 dict(group="inflacao", history=[dict(period="2026-10", z=-2.0)]),
                 dict(group="atividade", history=[dict(period="2026-10", z=3.0)])]
        idx = surprises.inflation_index(items)
        self.assertEqual(idx, [["2026-09", 1.0, 1.0, 1], ["2026-10", -3.0, -1.0, 2]])

    def test_copom(self):
        expectations = {"R7/2026": ["2026-10-30", "13.75", "0.1", 60], "R8/2026": ["2026-11-13", "13.5", "0.2", 60]}
        selic = [["2026-10-01", "14.00"], ["2026-11-05", "13.75"], ["2026-11-17", "13.75"]]
        c = surprises.copom(expectations, selic, TODAY)
        m = c["meetings"][0]
        self.assertEqual((m["meeting"], m["before"], m["decided"], m["change"], m["verdict"]), ("R7/2026", 14.0, 13.75, -0.25, "em linha"))
        self.assertEqual((c["next"]["meeting"], c["next"]["expected"]), ("R8/2026", -0.25))
