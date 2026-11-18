"""Saúde das fontes: situação de cada coleta e o resumo geral."""
import json
import unittest
from datetime import UTC, datetime, timedelta
from types import SimpleNamespace

from server.health import FAIL, OK, WARN, health, last_observed

NOW = datetime(2026, 11, 18, 12, tzinfo=UTC)


class Feed:
    def __init__(self, status="Atualizado"):
        self.status = status

    def read(self):
        return dict(series={"USD": {"observed": "2026-11-17"}}, source={"status": self.status, "received": NOW.isoformat()}, endpoint="https://ecb")


class Macro:
    catalog = {"brasil": [{"code": 432, "id": "selic", "name": "Meta Selic"}], "global": [], "ibge": [], "ptax": [], "regional": [], "fluxo": []}

    def __init__(self, entry):
        self.entries = {"sgs:432": entry} if entry else {}

    def status(self, key):
        entry = self.entries.get(key)
        if not entry:
            return {"status": "Aguardando coleta"}
        return {"status": "Fonte indisponível" if not entry.get("data") else "Dado histórico" if entry.get("error") else "Atualizado",
                "received": entry.get("received"), "next": entry.get("next"), "error": entry.get("error")}


class Editions:
    def __init__(self, to):
        self.to = to

    def read(self):
        return json.dumps({"to": self.to, "generated": NOW.isoformat()}).encode()


class B3:
    def __init__(self, cutoff):
        self.cutoff = cutoff

    def read(self):
        if not self.cutoff:
            return {"data": None, "status": "Aguardando importação"}
        return {"data": {"cutoff": {"volume": self.cutoff}}, "status": "Importado"}


def server(entry=None, feed="Atualizado", to="2026-10-31", cutoff="2026-11-17"):
    good = {"data": [["2026-11-17", 13.75]], "received": NOW.isoformat(), "next": (NOW + timedelta(hours=4)).isoformat()}
    return SimpleNamespace(feed=Feed(feed), macro=Macro(good if entry is None else entry), funds=SimpleNamespace(months={"202611": {"received": NOW.isoformat()}}),
                           editions=Editions(to), b3=B3(cutoff))


class Health(unittest.TestCase):
    def test_all_fresh(self):
        h = health(server(), NOW)
        self.assertEqual(h["overall"], OK)
        selic = next(i for i in h["items"] if i["key"] == "sgs:432")
        self.assertEqual((selic["name"], selic["observed"], selic["provider"]), ("Meta Selic", "2026-11-17", "Banco Central do Brasil"))

    def test_stopped_collection_is_late(self):
        stuck = {"data": [["2026-11-10", 13.75]], "received": (NOW - timedelta(days=2)).isoformat(), "next": (NOW - timedelta(days=1)).isoformat()}
        h = health(server(stuck), NOW)
        selic = next(i for i in h["items"] if i["key"] == "sgs:432")
        self.assertEqual((selic["status"], selic["level"], h["overall"]), ("Atrasado", WARN, WARN))

    def test_failure_wins_and_b3_asks_for_import(self):
        h = health(server(feed="Fonte indisponível", cutoff="2026-11-10"), NOW)
        self.assertEqual(h["overall"], FAIL)
        self.assertEqual(h["counts"][FAIL], 1)
        b3 = next(i for i in h["items"] if i["key"] == "b3")
        self.assertEqual(b3["status"], "Atrasado")
        self.assertIn("Importe", b3["note"])

    def test_old_heatmap_edition_and_broken_store(self):
        s = server(to="2026-05-31")
        s.funds = SimpleNamespace()  # sem 'months': a leitura falha e vira uma linha de falha, sem derrubar o resto
        h = health(s, NOW)
        heat = next(i for i in h["items"] if i["key"] == "cvm:cda")
        self.assertEqual(heat["status"], "Dado histórico")
        self.assertTrue(any(i["key"] == "funds" and i["level"] == FAIL for i in h["items"]))

    def test_last_observed_shapes(self):
        self.assertEqual(last_observed([["2026-01-01", 1], ["2026-02-01", 2]]), "2026-02-01")
        self.assertEqual(last_observed({"BRA": {"year": "2025", "value": "1"}, "USA": {"year": "2024"}}), "2025")
        self.assertEqual(last_observed({"a": {"observed": "2026-11-17"}}), "2026-11-17")
        self.assertIsNone(last_observed(None))


if __name__ == "__main__":
    unittest.main()
