import json
from datetime import UTC, date, datetime, timedelta
from pathlib import Path
from tempfile import TemporaryDirectory
from threading import Event
from unittest.mock import patch
from decimal import Decimal
from unittest import TestCase

from server.editions import MonthlyEdition
from core.fx import compare_rates, in_base
from providers.cvm import build_tiles, fx_at, identify


def raw(code, points):
    return {"instrument": "EUR/" + code, "history": points,
            "observed": points[-1][0], "value": points[-1][1]}


class DailyDollar(TestCase):
    def test_shared_dates_only_and_change(self):
        dollar = raw("USD", [("2026-11-12", "1.2"), ("2026-11-13", "1.25")])
        local = raw("BRL", [("2026-11-11", "8"), ("2026-11-12", "6"), ("2026-11-13", "6.5")])
        snap = dict(series={"USD": dollar, "BRL": local}, expected="2026-11-13",
                    source={"status": "Atualizado"})
        usd = in_base(snap, "USD")
        self.assertEqual(set(usd["series"]), {"EUR", "BRL"})
        brl = usd["series"]["BRL"]
        self.assertEqual(brl["value"], "5.20000")
        self.assertEqual(len(brl["history"]), 2)
        self.assertAlmostEqual(brl["change"]["percent"], 4)
        self.assertEqual(usd["series"]["EUR"]["value"], "0.80000")
        self.assertEqual(compare_rates(usd, "BRL", "EUR", 7)["pairs"], ["USD/BRL", "USD/EUR"])
        self.assertEqual(in_base(snap, "EUR")["series"]["BRL"]["value"], "6.5")

    def test_missing_leg_and_temporal_gap(self):
        local = raw("BRL", [("2026-11-11", "6"), ("2026-11-13", "6.5")])
        snap = dict(series={"BRL": local}, expected="2026-11-16", source={})
        self.assertEqual(in_base(snap, "USD")["series"], {})
        snap["series"]["USD"] = raw("USD", [("2026-11-11", "1.2"), ("2026-11-13", "1.25")])
        data = in_base(snap, "USD")["series"]["BRL"]
        self.assertIsNone(data["change"])
        self.assertEqual(data["status"], "Atrasado")
        snap["source"]["error"] = "offline"
        self.assertEqual(in_base(snap, "USD")["series"]["BRL"]["status"], "Dado histórico")


class MonthlyMarks(TestCase):
    def test_same_funds_and_two_fx_dates(self):
        key = ("br", "PETR4")
        left = {key: {"A": Decimal("10"), "B": Decimal("15"), "C": Decimal("45")}}
        right = {key: {"A": Decimal("12"), "B": Decimal("18"), "D": Decimal("4")}}
        result = build_tiles(left, right, {"USD": "5", "EUR": "6"}, {"USD": "6", "EUR": "6"})
        item = result["br"][0]
        self.assertEqual(item["funds"], 2)
        self.assertEqual(item["quotes"]["USD"], {"value": 2.5, "percent": 0.0})
        self.assertEqual(item["quotes"]["EUR"]["percent"], 20.0)
        self.assertEqual(result["crypto"][0]["quotes"], {})

    def test_monthly_position_and_trades_include_exited_assets(self):
        from io import BytesIO
        from zipfile import ZipFile
        from providers.cvm import unit_marks
        zfile = BytesIO()
        cols = "DT_COMPTC;CNPJ_FUNDO_CLASSE;CD_ATIVO;TP_APLIC;QT_POS_FINAL;VL_MERC_POS_FINAL;VL_AQUIS_NEGOC;VL_VENDA_NEGOC"
        rows = [cols,
                "2026-10-31;A;PETR4;Ações;10;200;10;20",
                "2026-10-31;B;PETR4;Ações;0;0;0;100",
                "2026-10-31;A;VALE3;Ações;1;180;;50",
                "2026-10-31;A;ABEV3;Ações;3;150;0;0"]
        with ZipFile(zfile, "w") as z:
            z.writestr("cda_fi_BLC_4_202610.csv", "\n".join(rows).encode("latin1"))
            z.writestr("cda_fi_BLC_7_202610.csv", "")
        weights = {}
        marks = unit_marks(zfile, "202610", date(2026,10,31), weights)
        fx = {"USD":"5","EUR":"6"}
        assets = {a["symbol"]: a for a in build_tiles(marks,marks,fx,fx,weights)["br"]}
        self.assertEqual(assets["PETR4"]["volume"],130)
        self.assertEqual(assets["PETR4"]["position"],200)
        self.assertEqual(assets["PETR4"]["funds"],1)
        self.assertIsNone(assets["VALE3"]["volume"])
        self.assertEqual(assets["ABEV3"]["volume"],0)
        self.assertIsNone(assets["ITUB4"]["position"])

    def test_currency_dates_weekend_and_gap(self):
        s = {"BRL": {"history": [("2026-10-30", "6")]},
             "USD": {"history": [("2026-10-30", "1.2")]}}
        self.assertEqual(fx_at(s, date(2026, 10, 31)), {"observed":"2026-10-30", "EUR":"6", "USD":"5"})
        with self.assertRaises(ValueError):
            fx_at(s, date(2026, 10, 29))

    def test_exclude_receipts_futures_and_etfs(self):
        self.assertIsNone(identify({"CD_ATIVO":"PETR4", "TP_APLIC":"Opções"}, 4))
        r = {"CD_ATIVO_BV_MERC":"AMZN US", "TP_ATIVO":"Ação ordinária", "BV_MERC":"NASDAQ STOCK MARKET",
             "PAIS":"ESTADOS UNIDOS DA AMÉRICA", "EMISSOR":"AMAZON.COM INC"}
        self.assertEqual(identify(r, 7), ("us", "AMZN"))
        self.assertIsNone(identify(dict(r, TP_ATIVO="Depository Receipt"), 7))
        self.assertIsNone(identify(dict(r, TP_ATIVO="Outros", EMISSOR="BITCOIN TRUST ETF"), 7))

class Editions(TestCase):
    def test_stale_snapshot_served_during_single_background_retry(self):
        with TemporaryDirectory() as folder:
            service = MonthlyEdition(Path(folder), None)
            service.seed.parent.mkdir(parents=True)
            old = json.dumps({"to":"2020-01-31","groups":{"br":[1]},"fx":[1]}).encode()
            service.seed.write_bytes(old)
            called, resume, finished = Event(), Event(), Event()
            def simulate(*args):
                called.set()
                resume.wait(2)
                finished.set()
            with patch("server.editions.publish", side_effect=simulate) as publish:
                self.assertEqual(service.read(), old)
                self.assertTrue(called.wait(2))
                self.assertEqual(service.read(), old)
                resume.set()
                self.assertTrue(finished.wait(2))
                self.assertEqual(publish.call_count, 1)
            self.assertIsNotNone(MonthlyEdition(Path(folder), None).next_check)

    def test_corrupt_runtime_file_falls_back_to_seed(self):
        with TemporaryDirectory() as folder:
            service = MonthlyEdition(Path(folder), None)
            service.seed.parent.mkdir(parents=True)
            service.directory.mkdir(parents=True)
            current = datetime.now(UTC).date().replace(day=1) - timedelta(days=1)
            good = json.dumps({"to":current.isoformat(),"groups":{"us":[1]},"fx":[1]}).encode()
            service.seed.write_bytes(good)
            (service.directory / "heatmaps.json").write_bytes(b"broken")
            with patch("server.editions.publish") as publish:
                self.assertEqual(service.read(), good)
                publish.assert_not_called()
