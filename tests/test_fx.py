from unittest import TestCase

from core.fx import compare_rates, usd_cross


def series(currency, rows):
    day, value = rows[-1]
    return {"instrument": f"EUR/{currency}", "history": rows, "observed": day,
            "value": value, "status": "Atualizado", "received": "2026-11-17T18:00:00Z"}


class ForeignExchange(TestCase):
    def setUp(self):
        self.brl = series("BRL", [("2026-10-01","8"), ("2026-11-12","6"), ("2026-11-13","6.3"), ("2026-11-17","6.6")])
        self.usd = series("USD", [("2026-11-12","1.2"), ("2026-11-16","1.25"), ("2026-11-17","1.32")])
        self.feed = {"source":{"status":"Atualizado","snapshot":"abc","received":self.brl["received"]},
                     "series":{"BRL":self.brl,"USD":self.usd}, "expected":"2026-11-17"}

    def test_cross_direction_and_unit(self):
        cross = usd_cross(self.brl,self.usd,"BRL")
        self.assertEqual((cross["instrument"],cross["unit"],cross["value"]),("USD/BRL","BRL por USD","5.00000"))
        self.assertEqual(cross["inputs"],["EUR/BRL","EUR/USD"])
        self.assertEqual(usd_cross(self.usd,self.usd,"EUR")["value"],"0.75758")
        self.assertIsNone(usd_cross(self.usd,self.usd,"USD"))

    def test_missing_or_mismatched_cross(self):
        self.assertIsNone(usd_cross(self.brl,None,"BRL"))
        self.assertIsNone(usd_cross(self.brl,dict(self.usd,observed="2026-11-16"),"BRL"))

    def test_shared_base_and_source(self):
        result=compare_rates(self.feed,"BRL","USD",7)
        self.assertEqual(result["points"],[["2026-11-12",100,100],["2026-11-17",110,110]])
        self.assertEqual(result["changes"],[10,10])
        self.assertEqual(result["snapshot"],"abc")
        self.assertEqual(result["from"],"2026-11-12")

    def test_identical_missing_and_disjoint_series(self):
        for pair in [("USD","USD"),("BRL","JPY")]:
            self.assertEqual(compare_rates(self.feed,*pair,7)["points"],[])
        self.feed["series"]["USD"]=series("USD",[("2026-11-17","1")])
        self.assertEqual(compare_rates(self.feed,"BRL","USD",30)["points"],[])

    def test_stale_and_historical(self):
        self.feed["expected"]="2026-11-18"
        self.assertEqual(compare_rates(self.feed,"BRL","USD",7)["status"],"Atrasado")
        self.feed["source"]["error"]="sem rede"
        self.assertEqual(compare_rates(self.feed,"BRL","USD",7)["status"],"Dado histórico")

    def test_one_stale_series_does_not_move_the_window_back(self):
        self.feed["series"]["BRL"]=series("BRL",[("2026-09-01","1"),("2026-09-02","2")])
        self.assertEqual(compare_rates(self.feed,"BRL","USD",30)["points"],[])
