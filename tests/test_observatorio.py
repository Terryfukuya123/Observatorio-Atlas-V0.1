"""Fixtures artificiais de teste. Nenhuma chamada de rede sai da máquina."""
from concurrent.futures import ThreadPoolExecutor
from datetime import UTC, date, datetime, timedelta
from decimal import Decimal
from http.client import HTTPConnection
import json
from pathlib import Path
from tempfile import TemporaryDirectory
from threading import Thread
from unittest import TestCase
from urllib.error import HTTPError

from core.calendar import expected_day, is_target_day
from core.indicators import price_return, reference_day, usd_return, variation
from providers.ecb import normalize
from server.app import Handler, ThreadingHTTPServer, ROOT
from server.service import Feed, retry_delay

NOW = datetime(2026, 5, 6, 20, tzinfo=UTC)


def fixture(rows):
    xml = '<Cube xmlns="http://www.ecb.int/vocabulary/2002-08-01/eurofxref">'
    for day, entries in rows:
        xml += '<Cube time="' + day + '">'
        xml += ''.join(f'<Cube currency="{c}" rate="{v}"/>' for c, v in entries)
        xml += '</Cube>'
    return (xml + '</Cube>').encode()


BODY = fixture([("2026-05-05", [("BRL", "5.00")]), ("2026-05-06", [("BRL", "5.50")])])


class Indicators(TestCase):
    def test_returns(self):
        self.assertEqual(price_return("100", "110"), Decimal(".1"))
        self.assertEqual(usd_return("100", "110", "5", "5.5"), Decimal("0"))
        self.assertAlmostEqual(float(usd_return("100","100","5","6")), -1/6)
        for invalid in ("0", "-2", "NaN", "Infinity"):
            with self.assertRaises(ValueError):
                price_return("1", invalid)

    def test_periods(self):
        end = date(2024, 2, 29)
        self.assertEqual(reference_day(end, "12M"), date(2023, 2, 28))
        self.assertEqual(reference_day(end, "MTD"), date(2024, 1, 31))
        self.assertEqual(reference_day(end, "YTD"), date(2023, 12, 31))
        points=[("2023-12-29","100"),("2024-01-31","110"),("2024-02-28","120"),("2024-02-29","132")]
        self.assertEqual(variation(points,"YTD")["percent"],32)
        self.assertEqual(variation(points,"MTD")["percent"],20)
        self.assertEqual(variation(points,"1D")["percent"],10)
        self.assertIsNone(variation(points,"12M"))

    def test_target_calendar(self):
        for day in [date(2026,4,3),date(2026,4,6),date(2026,5,1),date(2026,12,25)]:
            self.assertFalse(is_target_day(day))
        self.assertEqual(expected_day(datetime(2026,4,7,16,tzinfo=UTC)), date(2026,4,2))
        self.assertEqual(expected_day(datetime(2026,4,7,17,tzinfo=UTC)), date(2026,4,7))


class FeedTests(TestCase):
    def setUp(self):
        self.tmp=TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.clock=NOW
        self.path=Path(self.tmp.name)/"cache.json"
        self.body=BODY
        self.calls=0
        self.feed=Feed(self.path,self.fetch,lambda:self.clock)

    def fetch(self):
        self.calls+=1
        if isinstance(self.body,Exception):
            raise self.body
        return self.body

    def test_normalizer(self):
        self.assertEqual(normalize(BODY,NOW.date())["BRL"][-1][1],"5.50")
        for rows in [
            [("2099-01-01",[("USD","2")])],
            [("2026-05-05",[("USD","2"),("USD","3")])],
            [("2026-05-05",[("USD","")])],
            [("2026-05-05",[("USD","-1")])],
            [("2026-05-05",[("USD","NaN")])],
            [("2026-05-05",[("XXX","1")])],
        ]:
            with self.subTest(rows=rows), self.assertRaises(ValueError):
                normalize(fixture(rows),NOW.date())

    def test_shared_and_restart(self):
        with ThreadPoolExecutor(max_workers=6) as pool:
            reads=list(pool.map(lambda _: self.feed.read(),range(12)))
        self.assertEqual(self.calls,1)
        self.assertEqual(reads[0]["series"]["BRL"]["change"]["percent"],10)
        self.assertEqual(reads[0]["source"]["status"],"Cobertura parcial")
        restored=Feed(self.path,self.fetch,lambda:self.clock).read()
        self.assertEqual(restored,reads[0])
        self.assertEqual(self.calls,1)

    def test_failed_refresh_and_retention(self):
        valid=self.feed.read()
        self.clock+=timedelta(hours=5)
        self.body=OSError()
        result=self.feed.read()
        self.assertEqual(result["source"]["status"],"Fonte indisponível")
        self.assertEqual(result["series"]["BRL"]["status"],"Dado histórico")
        self.assertEqual(result["source"]["received"],valid["source"]["received"])
        self.feed.read()
        self.assertEqual(self.calls,2)
        self.clock+=timedelta(days=7)
        self.assertEqual(self.feed.read()["series"],{})
        self.assertNotIn("xml",json.loads(self.path.read_text()))

    def test_first_failure_and_recovery(self):
        self.body=ValueError("indisponível")
        self.assertEqual(self.feed.read()["series"],{})
        self.clock+=timedelta(minutes=31)
        self.body=BODY
        self.assertEqual(self.feed.read()["series"]["BRL"]["status"],"Atualizado")

    def test_stale_observation_and_missing_day(self):
        self.clock+=timedelta(days=2)
        self.body=fixture([("2026-05-04",[("BRL","1")]),("2026-05-06",[("BRL","2")])])
        r=self.feed.read()
        self.assertEqual(r["source"]["status"],"Atrasado")
        self.assertIsNone(r["series"]["BRL"]["change"])

    def test_regression(self):
        self.feed.read()
        self.clock+=timedelta(hours=5)
        self.body=fixture([("2026-05-05",[("BRL","5.00")])])
        r=self.feed.read()
        self.assertEqual(r["source"]["status"],"Fonte indisponível")
        self.assertEqual(r["series"]["BRL"]["observed"],"2026-05-06")

    def test_corrupt_snapshot(self):
        self.feed.read()
        state=json.loads(self.path.read_text())
        state["snapshot"]="0"*64
        self.path.write_text(json.dumps(state))
        self.body=OSError()
        r=Feed(self.path,self.fetch,lambda:self.clock).read()
        self.assertTrue(r["source"]["cache_warning"])
        self.assertEqual(r["series"],{})

    def test_retry_after(self):
        error=HTTPError("https://example.invalid",429,"limited",{"Retry-After":"9000"},None)
        self.assertEqual(retry_delay(error,NOW),timedelta(seconds=9000))

    def test_http_scope(self):
        with ThreadingHTTPServer(("127.0.0.1",0),Handler) as server:
            server.feed=self.feed
            worker=Thread(target=server.serve_forever,daemon=True)
            worker.start()
            try:
                for path,host,code in [("/",None,200),("/api/atlas",None,200),("/api/atlas?base=EUR",None,200),("/api/atlas?base=BRL",None,400),("/../config/markets.json",None,404),("/", "other.invalid",403)]:
                    with self.subTest(path=path,host=host):
                        conn=HTTPConnection("127.0.0.1",server.server_port,timeout=2)
                        conn.request("GET",path,headers={"Host":host} if host else {})
                        response=conn.getresponse()
                        self.assertEqual(response.status,code)
                        body=response.read()
                        if path=="/api/atlas":
                            self.assertEqual(json.loads(body)["base"], "USD")
                            self.assertEqual(json.loads(body)["series"], {})  # Fixture sem EUR/USD.
                        if path=="/api/atlas?base=EUR":
                            self.assertEqual(json.loads(body)["series"]["BRL"]["value"],"5.50")
                        conn.close()
            finally:
                server.shutdown()
                worker.join()

    def test_geographic_ids(self):
        world=json.loads((ROOT/"web/world.json").read_text(encoding="utf8"))
        ids={row["id"] for row in world}
        self.assertEqual(len(ids),len(world))
        markets=json.loads((ROOT/"config/markets.json").read_text(encoding="utf8"))
        self.assertEqual(set(markets)-ids,{"EMU"})
