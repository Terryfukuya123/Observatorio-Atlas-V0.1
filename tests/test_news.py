from datetime import UTC, date, datetime, timedelta
import io
import json
from pathlib import Path
from tempfile import TemporaryDirectory
from unittest import TestCase
from zipfile import ZipFile

from providers import news
from server.health import health
from server.news import NewsStore

NOW = datetime(2026, 11, 18, 15, tzinfo=UTC)

ATOM = """<?xml version="1.0" encoding="utf-8"?><feed xmlns="http://www.w3.org/2005/Atom"><title>BC</title>
<entry><id>1</id><title type="text">BC anuncia leilão de swap cambial tradicional de até US$ 2 bilhões</title>
<updated>2026-11-18T11:30:00-03:00</updated><link rel="alternate" href="https://www.bcb.gov.br/detalhenoticia/1/nota"/>
<content type="html">&lt;div&gt;O Banco Central &lt;b&gt;realizará&lt;/b&gt; leilão nesta quarta-feira.&lt;/div&gt;</content></entry>
<entry><id>2</id><title type="text">BC anuncia leilões de swap cambial para fins de rolagem</title>
<updated>2026-11-17T18:30:00-03:00</updated><link rel="alternate" href="https://www.bcb.gov.br/detalhenoticia/2/nota"/>
<content type="html">Rolagem dos contratos.</content></entry>
<entry><id>3</id><title type="text">Inscrições abertas para o programa de estágio</title>
<updated>2026-11-17T10:00:00-03:00</updated><link rel="alternate" href="https://www.bcb.gov.br/detalhenoticia/3/nota"/>
<content type="html">Vagas.</content></entry>
<entry><id>4</id><title type="text">Nota antiga sobre a Selic</title>
<updated>2026-10-01T10:00:00-03:00</updated><link rel="alternate" href="https://www.bcb.gov.br/detalhenoticia/4/nota"/>
</entry></feed>"""

RSS = """<?xml version="1.0"?><rss version="2.0"><channel><title>AB</title>
<item><title>Governo anuncia contingenciamento de R$ 10 bilhões no Orçamento</title>
<link>https://agenciabrasil.ebc.com.br/economia/noticia/2026-11/contingenciamento</link>
<description>&lt;p&gt;O Ministério da Fazenda informou...&lt;/p&gt;</description><pubDate>Wed, 18 Nov 2026 11:00:00 -0300</pubDate></item>
<item><title>Feira de artesanato reúne expositores</title>
<link>https://agenciabrasil.ebc.com.br/geral/noticia/2026-11/feira</link>
<description>Evento cultural.</description><pubDate>Wed, 18 Nov 2026 10:00:00 -0300</pubDate></item>
</channel></rss>"""

IBGE = json.dumps({"items": [
    {"titulo": "IPCA sobe 0,40% em outubro", "introducao": "A inflação oficial...", "data_publicacao": "18/11/2026 09:00:00",
     "link": "http://agenciadenoticias.ibge.gov.br/ipca"},
    {"titulo": "IBGE recebe homenagem", "introducao": "Cerimônia.", "data_publicacao": "18/11/2026 08:00:00",
     "link": "http://agenciadenoticias.ibge.gov.br/homenagem"},
]})


def ipe():
    header = "CNPJ_Companhia;Nome_Companhia;Codigo_CVM;Data_Referencia;Categoria;Tipo;Especie;Assunto;Data_Entrega;Tipo_Apresentacao;Protocolo_Entrega;Versao;Link_Download\n"
    rows = [
        "1;PETROLEO BRASILEIRO S.A. PETROBRAS;9512;2026-11-16;Fato Relevante;;;Plano de negócios;2026-11-16;AP;1;1;https://www.rad.cvm.gov.br/ENET/a\n",
        "2;PEQUENA S.A.;1;2026-11-16;Fato Relevante;;;Aquisição de Ações de Emissão da Própria Companhia;2026-11-16;AP;2;1;https://www.rad.cvm.gov.br/ENET/b\n",
        "3;OUTRA S.A.;2;2026-11-16;Comunicado ao Mercado;;;Qualquer;2026-11-16;AP;3;1;https://www.rad.cvm.gov.br/ENET/c\n",
        "4;ANTIGA S.A.;3;2026-10-01;Fato Relevante;;;Velho;2026-10-01;AP;4;1;https://www.rad.cvm.gov.br/ENET/d\n",
    ]
    buffer = io.BytesIO()
    with ZipFile(buffer, "w") as z:
        z.writestr("ipe_cia_aberta_2026.csv", (header + "".join(rows)).encode("latin-1"))
    return buffer.getvalue()


BODIES = {"bcb_notas": ATOM.encode(), "bcb_noticias": ATOM.encode(), "agbr_economia": RSS.encode(),
          "agbr_politica": RSS.encode(), "ibge": IBGE.encode(), "fed": b"<rss><channel></channel></rss>",
          "ecb": b"<rss><channel></channel></rss>", "cvm_fatos": ipe()}


def fetcher(calls, fail=()):
    def fetch(url):
        source = next(s["id"] for s in news.SOURCES if news.url_for(s["id"], NOW.date()) == url)
        calls.append(source)
        if source in fail:
            raise OSError("fora do ar")
        return BODIES[source]
    return fetch


class ClassifyTest(TestCase):
    def test_rules(self):
        self.assertEqual(news.classify("BC anuncia leilão de swap cambial", "", "bcb_notas"), ("cambio", 3))
        self.assertEqual(news.classify("BC anuncia leilões de swap cambial para fins de rolagem", "", "bcb_notas"), ("cambio", 2))
        self.assertEqual(news.classify("Copom mantém a Selic em 15%", "", "bcb_notas"), ("juros", 3))
        self.assertEqual(news.classify("Governo eleva IOF sobre câmbio", "", "agbr_economia")[1], 3)
        self.assertEqual(news.classify("Federal Reserve issues FOMC statement", "", "fed"), ("juros", 3))
        self.assertEqual(news.classify("Board issues enforcement action", "", "fed"), ("regulacao", 1))
        self.assertEqual(news.classify("Speech by Governor Smith", "", "fed"), ("mundo", 1))
        # Palavra só no resumo vale um nível a menos.
        self.assertEqual(news.classify("Mercado reage", "o Copom decidiu", "agbr_economia"), ("juros", 2))
        self.assertEqual(news.classify("Feira de artesanato", "", "agbr_economia"), (None, 1))

    def test_parsers(self):
        items = news.parse("bcb_notas", ATOM.encode(), NOW.date())
        self.assertEqual(items[0]["title"], "BC anuncia leilão de swap cambial tradicional de até US$ 2 bilhões")
        self.assertEqual(items[0]["summary"], "O Banco Central realizará leilão nesta quarta-feira.")
        self.assertEqual(items[0]["time"], "2026-11-18T14:30:00+00:00")
        self.assertEqual(items[2]["topic"], "geral")
        politics = news.parse("agbr_politica", RSS.encode(), NOW.date())
        self.assertEqual([i["topic"] for i in politics], ["fiscal"])  # só temas econômicos
        ibge = news.parse("ibge", IBGE.encode(), NOW.date())
        self.assertEqual([(i["topic"], i["impact"]) for i in ibge], [("dados", 3)])
        self.assertTrue(ibge[0]["link"].startswith("https://"))
        fatos = news.parse("cvm_fatos", ipe(), NOW.date())
        self.assertEqual([(i["title"].split(":")[0], i["impact"], i["day_only"]) for i in fatos],
                         [("PETROLEO BRASILEIRO S.A. PETROBRAS", 2, True), ("PEQUENA S.A.", 1, True)])

    def test_summary_is_short_and_plain(self):
        text = news.strip_html("<p>" + "palavra " * 100 + "</p>")
        self.assertLessEqual(len(text), news.SUMMARY + 1)
        self.assertTrue(text.endswith("…"))

    def test_download_only_known_hosts(self):
        with self.assertRaises(ValueError):
            news.download("https://exemplo.com/feed.xml")


class StoreTest(TestCase):
    def test_collect_merge_and_cache(self):
        with TemporaryDirectory() as tmp:
            calls = []
            store = NewsStore(tmp, fetch=fetcher(calls, fail={"ecb"}), clock=lambda: NOW, background=False)
            data = store.read()
            self.assertEqual(len(calls), len(news.SOURCES))
            titles = [i["title"] for i in data["items"]]
            self.assertEqual(titles[0], "BC anuncia leilão de swap cambial tradicional de até US$ 2 bilhões")
            self.assertNotIn("Nota antiga sobre a Selic", titles)  # mais de 7 dias
            self.assertEqual(titles.count("Governo anuncia contingenciamento de R$ 10 bilhões no Orçamento"), 1)  # sem duplicar
            ecb = next(s for s in data["sources"] if s["id"] == "ecb")
            self.assertIn("Falha", ecb["error"])
            # Nada vencido: não coleta de novo; o cache sobrevive a um reinício.
            store.read()
            self.assertEqual(len(calls), len(news.SOURCES))
            again = NewsStore(tmp, fetch=fetcher(calls), clock=lambda: NOW, background=False)
            self.assertEqual(again.due(NOW), [])
            self.assertIn("ecb", again.due(NOW + timedelta(minutes=11)))  # o BCE, que falhou, tenta de novo
            self.assertEqual(len(again.read()["items"]), len(data["items"]))

    def test_item_that_left_the_feed_stays_and_keeps_first_seen(self):
        with TemporaryDirectory() as tmp:
            clock = [NOW]
            store = NewsStore(tmp, fetch=fetcher([]), clock=lambda: clock[0], background=False)
            first = {i["id"]: i["seen"] for i in store.read()["items"]}
            BODIES["bcb_notas"], saved = ATOM.replace("<entry><id>1</id>", "<!--<entry><id>1</id>").replace(
                "nesta quarta-feira.&lt;/div&gt;</content></entry>", "nesta quarta-feira.&lt;/div&gt;</content></entry>-->").encode(), BODIES["bcb_notas"]
            try:
                clock[0] = NOW + timedelta(hours=4)
                later = store.read()["items"]
            finally:
                BODIES["bcb_notas"] = saved
            swap = next(i for i in later if "até US$ 2 bilhões" in i["title"])
            self.assertEqual(swap["seen"], first[swap["id"]])

    def test_health_lists_each_source(self):
        with TemporaryDirectory() as tmp:
            store = NewsStore(tmp, fetch=fetcher([], fail={"fed"}), clock=lambda: NOW, background=False)
            store.read()

            class Server:
                pass
            server = Server()
            server.news = store
            report = health(server, NOW)
            rows = [i for i in report["items"] if i["key"].startswith("news:")]
            self.assertEqual(len(rows), len(news.SOURCES))
            self.assertEqual(next(r for r in rows if r["key"] == "news:fed")["level"], "warn")
            self.assertEqual(next(r for r in rows if r["key"] == "news:bcb_notas")["level"], "ok")
