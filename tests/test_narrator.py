import unittest
from datetime import UTC, datetime

from server.narrator import narrate, num, signed, spoken

NOW = datetime(2026, 11, 18, 18, 0, tzinfo=UTC)


def overview(rows=None, focus=None):
    rows = rows or [["2026-11-10", "5.50"], ["2026-11-11", "5.52"], ["2026-11-12", "5.55"], ["2026-11-13", "5.60"],
                    ["2026-11-16", "5.70"], ["2026-11-17", "5.80"]]
    return {"ptax": {"USD": {"history": rows}}, "focus": {"indicators": focus or []}}


def latest(period, actual, median, z, verdict, surveyed="2026-11-11"):
    return dict(period=period, actual=actual, median=median, sd=0.06, respondents=140, surveyed=surveyed,
                surprise=round(actual - median, 3), z=z, verdict=verdict)


SURPRISES = {"data": {
    "indicators": [
        dict(id="ipca", name="IPCA", latest=latest("2026-10", 0.14, 0.264, -2.03, "abaixo")),
        dict(id="servicos", name="Serviços", latest=latest("2026-10", 0.11, 0.21, -0.97, "abaixo")),
        dict(id="alimentacao", name="Alimentação no domicílio", latest=latest("2026-10", 1.31, 0.985, 0.68, "acima")),
        dict(id="igpm", name="IGP-M", latest=latest("2026-08", 1.0, 1.0, 0.0, "em linha", "2026-08-28")),
    ],
    "copom": {"meetings": [dict(meeting="R7/2026", surveyed="2026-11-04", before=13.75, median=13.5, decided=13.75,
                                change=0.0, verdict="acima")],
              "next": dict(meeting="R8/2026", surveyed="2026-11-13", median=13.75, expected=0.0, respondents=144)},
}}
FLOWS = {"data": {"through": "2026-11-06", "ytd": {"cambio_total": {"value": "26683.6"}},
                  "months": [{"month": "2026-11", "total": "-2100.0", "partial": True}]}}
NEWS = {"sources": [{"id": "bcb", "short": "BC"}], "items": [
    dict(id="a", source="bcb", title="BC anuncia leilão de linha", time="2026-11-18T14:00:00+00:00", impact=3),
    dict(id="b", source="bcb", title="Rotina", time="2026-11-18T13:00:00+00:00", impact=2),
    dict(id="c", source="bcb", title="Antiga", time="2026-11-10T13:00:00+00:00", impact=3),
]}


class NarratorTest(unittest.TestCase):
    def run_all(self, **kw):
        args = dict(overview=overview(), surprises=SURPRISES, flow=FLOWS, news=NEWS)
        args.update(kw)
        return narrate(args["overview"], args["surprises"], args["flow"], args["news"], now=NOW)

    def ids(self, result):
        return [e["id"] for e in result["events"]]

    def test_formatos(self):
        self.assertEqual(num(-0.124), "−0,12")
        self.assertEqual(num(1234.5, 1), "1.234,5")
        self.assertEqual(signed(3.6), "+3,60")
        self.assertEqual(signed(0.0), "0,00")
        self.assertEqual(spoken("US$ 2,1 bi e R$ 5,40, −0,12 p.p."), "2,1 bilhões de dólares e 5,40 reais, menos 0,12 ponto percentual")
        # "bi" só como abreviação de bilhões: palavras que começam com "bi" ficam intactas.
        self.assertEqual(spoken("bilionário"), "bilionário")

    def test_dolar(self):
        e = next(e for e in self.run_all()["events"] if e["kind"] == "cambio")
        self.assertIn("R$ 5,8000", e["text"])
        self.assertIn("alta de 1,75% no dia", e["text"])
        self.assertEqual((e["weight"], e["tone"]), (3, "neg"))
        self.assertEqual(e["time"], "2026-11-17T16:00:00+00:00")  # 13h de Brasília

    def test_surpresa_e_abertura(self):
        events = {e["id"]: e for e in self.run_all()["events"]}
        ipca = events["dado:ipca:2026-10"]
        self.assertIn("abaixo do consenso de 0,26%", ipca["text"])
        self.assertEqual((ipca["weight"], ipca["tone"]), (3, "pos"))
        # Componentes viram uma frase só; dado antigo (IGP-M de agosto) não aparece.
        self.assertNotIn("dado:servicos:2026-10", events)
        self.assertIn("abertura:ipca:2026-10", events)
        self.assertIn("serviços", events["abertura:ipca:2026-10"]["text"])
        self.assertFalse(any(i.startswith("dado:igpm") for i in events))

    def test_copom(self):
        events = {e["id"]: e for e in self.run_all()["events"]}
        self.assertIn("mais duro que o esperado", events["copom:R7/2026"]["text"])
        self.assertIn("manutenção em 13,75%", events["copom-next:R8/2026:2026-11-13"]["text"])

    def test_focus(self):
        focus = [dict(id="focus_ipca", years=[dict(year="2026", observed="2026-11-13", median="5.10",
                                                    week_ago=dict(median="5.22"), trend=dict(direction="queda", weeks=1))]),
                 dict(id="focus_pib", years=[dict(year="2026", observed="2026-11-13", median="1.73",
                                                   week_ago=dict(median="1.75"))])]
        events = [e for e in self.run_all(overview=overview(focus=focus))["events"] if e["id"].startswith("focus:")]
        self.assertEqual(len(events), 1)  # revisão do PIB abaixo do mínimo
        self.assertIn("reduziu a projeção para o IPCA de 2026 para 5,10%", events[0]["text"])
        self.assertEqual(events[0]["time"][:10], "2026-11-16")  # publicado na segunda-feira

    def test_noticias_e_fluxo(self):
        ids = self.ids(self.run_all())
        self.assertIn("nota:a", ids)
        self.assertNotIn("nota:b", ids)  # só alto impacto
        self.assertNotIn("nota:c", ids)  # mais de 48 horas
        flow = next(e for e in self.run_all()["events"] if e["kind"] == "fluxo")
        self.assertIn("saíram US$ 2,1 bi", flow["text"])
        self.assertIn("entraram US$ 26,7 bi", flow["text"])

    def test_ordem_e_resumo(self):
        result = self.run_all()
        times = [e["time"] for e in result["events"]]
        self.assertEqual(times, sorted(times, reverse=True))
        s = result["summary"]
        self.assertTrue(s["ids"][0].startswith("ptax:"))
        self.assertLessEqual(len(s["ids"]), 5)
        self.assertTrue(s["say"].startswith("Resumo do Observatório, 18 de novembro, 15h00."))

    def test_dados_faltando_nao_derrubam(self):
        result = narrate(None, {"data": {"indicators": [{"id": "ipca", "latest": {"period": "x"}}]}}, {}, None, now=NOW)
        self.assertEqual(result["events"], [])
        self.assertIn("Sem novidades", result["summary"]["text"])


if __name__ == "__main__":
    unittest.main()
