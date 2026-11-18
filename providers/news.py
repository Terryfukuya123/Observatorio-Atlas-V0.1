"""Notícias oficiais em tempo quase real: canais públicos de órgãos e agências.

Cada fonte vira uma lista de itens com título, link, hora, resumo curto, tema e impacto.
Só título, resumo curto e link: o texto completo fica na fonte. Tema e impacto vêm de
regras de palavras fixas e públicas (ver RULES), não de modelo.
"""
from datetime import UTC, datetime, timedelta, timezone
from email.utils import parsedate_to_datetime
from hashlib import sha1
from html import unescape
import csv
import io
import json
import re
import unicodedata
import xml.etree.ElementTree as ET
import zipfile
from urllib.request import Request, urlopen

BRASILIA = timezone(timedelta(hours=-3))
MAX_BYTES = 6_000_000
SUMMARY = 240

# id, nome, endereço, formato, minutos entre coletas, licença, filtro (só itens com tema)
SOURCES = [
    dict(id="bcb_notas", name="Banco Central · notas à imprensa", short="BCB",
         url="https://www.bcb.gov.br/api/feed/sitebcb/sitefeeds/notasImprensa", kind="atom", every=5,
         license="Dados públicos do Banco Central do Brasil"),
    dict(id="bcb_noticias", name="Banco Central · notícias", short="BCB",
         url="https://www.bcb.gov.br/api/feed/sitebcb/sitefeeds/noticias", kind="atom", every=15,
         license="Dados públicos do Banco Central do Brasil"),
    dict(id="agbr_economia", name="Agência Brasil · Economia", short="Agência Brasil",
         url="https://agenciabrasil.ebc.com.br/rss/economia/feed.xml", kind="rss", every=5,
         license="CC BY 4.0 · Agência Brasil/EBC"),
    dict(id="agbr_politica", name="Agência Brasil · Política (só temas econômicos)", short="Agência Brasil",
         url="https://agenciabrasil.ebc.com.br/rss/politica/feed.xml", kind="rss", every=10, only_topics=True,
         license="CC BY 4.0 · Agência Brasil/EBC"),
    dict(id="ibge", name="IBGE · Agência de Notícias (só temas econômicos)", short="IBGE",
         url="https://servicodados.ibge.gov.br/api/v3/noticias/?qtd=30", kind="ibge", every=15, only_topics=True,
         license="Dados públicos do IBGE"),
    dict(id="fed", name="Federal Reserve · comunicados", short="Fed",
         url="https://www.federalreserve.gov/feeds/press_all.xml", kind="rss", every=15, lang="en",
         license="Domínio público (governo dos EUA)"),
    dict(id="ecb", name="Banco Central Europeu · comunicados", short="BCE",
         url="https://www.ecb.europa.eu/rss/press.html", kind="rss", every=15, lang="en",
         license="Reutilização com citação da fonte (BCE)"),
    dict(id="cvm_fatos", name="CVM · fatos relevantes das companhias", short="CVM",
         url="https://dados.cvm.gov.br/dados/CIA_ABERTA/DOC/IPE/DADOS/ipe_cia_aberta_{year}.zip", kind="ipe", every=180,
         license="ODbL 1.0 · CVM", note="A CVM publica o arquivo com alguns dias de atraso"),
]
BY_ID = {s["id"]: s for s in SOURCES}
HOSTS = ("https://www.bcb.gov.br/", "https://agenciabrasil.ebc.com.br/", "https://servicodados.ibge.gov.br/",
         "https://www.federalreserve.gov/", "https://www.ecb.europa.eu/", "https://dados.cvm.gov.br/")

TOPICS = {
    "cambio": "Câmbio e intervenção",
    "juros": "Juros e bancos centrais",
    "fiscal": "Governo e contas públicas",
    "dados": "Dados divulgados",
    "regulacao": "Regras e supervisão",
    "empresas": "Empresas",
    "mundo": "Mundo",
    "geral": "Economia em geral",
}
# Para onde cada tema leva dentro da plataforma.
LINKS = {
    "cambio": ["#fluxo", "Fluxo cambial e atuações do BC"],
    "juros": ["#bussola", "Bússola dos juros"],
    "fiscal": ["#brasil", "Painel Brasil"],
    "dados": ["#agenda", "Agenda com impacto"],
    "regulacao": ["#brasil", "Painel Brasil"],
    "empresas": ["#pregao", "Pregão B3"],
    "mundo": ["#juros", "Juros dos EUA"],
}

# (tema, impacto, padrões). A primeira regra que casar define o tema; o impacto é o maior
# entre as regras que casarem. Padrões sem acento e em minúsculas.
RULES = [
    ("cambio", 3, [r"swap cambial", r"leil[ao]\w* de (cambio|linha|dolar)", r"venda de dolar", r"intervenc\w* (no|cambial)",
                   r"\bleiloes? de swap", r"foreign exchange intervention"]),
    ("cambio", 2, [r"reservas internacionais", r"\bcambio\b", r"\bdolar\b", r"\bcambial\b"]),
    ("juros", 3, [r"\bcopom\b", r"\bselic\b", r"\bfomc\b", r"federal funds", r"monetary policy decision",
                  r"interest rates?\b.*\b(decision|raises|lowers|maintains)", r"policy rate", r"key ecb interest rates",
                  r"\bata do copom", r"minutes of the federal open market"]),
    ("juros", 2, [r"politica monetaria", r"taxa de juros", r"\bjuros\b", r"monetary policy", r"\binflation\b",
                  r"financial stability"]),
    ("fiscal", 3, [r"\biof\b", r"contingenciamento", r"bloqueio de (r\$|despesas|recursos|gastos)", r"meta fiscal",
                   r"arcabouco", r"medida provisoria", r"pacote (fiscal|economico)", r"\brating\b", r"grau de investimento",
                   r"reforma tributaria", r"imposto de renda"]),
    ("fiscal", 2, [r"\borcamento\b", r"\bldo\b", r"\bploa\b", r"\bloa\b", r"divida publica", r"tesouro nacional",
                   r"\bdeficit\b", r"\bsuperavit\b", r"resultado primario", r"\bimpostos?\b", r"\btributo", r"\btarifa",
                   r"\bhaddad\b", r"\bdurigan\b", r"ministerio da fazenda", r"\bfazenda\b", r"\bgastos? publico",
                   r"\barrecadacao\b", r"\bdesoneracao\b", r"salario minimo", r"\bcongresso\b.*\b(aprova|vota)"]),
    ("dados", 3, [r"\bipca\b", r"\bpib\b", r"\bibc-br\b", r"\bcpi\b", r"\bpayroll\b", r"\bpnad\b",
                  r"\bdesemprego\b", r"taxa de desocupacao"]),
    ("dados", 2, [r"\binflacao\b", r"producao industrial", r"vendas no varejo", r"volume de servicos", r"\bic-br\b",
                  r"\bfocus\b", r"\bindice\b", r"balanca comercial", r"\bigp-m\b", r"\bcaged\b"]),
    ("regulacao", 2, [r"liquidacao extrajudicial", r"\bresolucao\b", r"consulta publica", r"\bpix\b", r"open finance",
                      r"novas regras", r"\bnorma\b", r"supervisao", r"regulat", r"\bguidance\b", r"\benforcement\b",
                      r"\bproposed rule", r"\bbanking\b"]),
    ("empresas", 2, [r"\bpetrobras\b", r"\bvale\b", r"\bembraer\b", r"\beletrobras\b", r"\bbanco do brasil\b",
                     r"fato relevante", r"\bfusao\b", r"\baquisicao\b", r"\bipo\b", r"\bdividendos\b"]),
]
COMPILED = [(t, i, [re.compile(p) for p in ps]) for t, i, ps in RULES]
# Rotina, não novidade: rolagem de swaps, estudos e relatórios periódicos valem um nível a menos.
ROUTINE = re.compile(r"\brolagem\b|\bestudo\b|\brelatorio de\b|\bboletim\b|\bschedule\b|\bspeech\b|\bentrevista\b")
# Fatos relevantes que costumam mexer com a ação: operações societárias, resultados e proventos.
CVM_MATERIAL = re.compile(r"aquisic|fusao|incorporac|\bopa\b|oferta publica|recuperacao judicial|falencia|projec|guidance|"
                          r"dividend|juros sobre (o )?capital|remuneracao aos acionistas|alienac|cisao|reestrutura|"
                          r"rebaixamento|rating|renuncia|\bpresidente\b|\bceo\b|desinvestimento|venda d[eao]s? ")
CVM_BIG = re.compile(r"petrobras|petroleo brasileiro|vale s\.?a|itau|bradesco|banco do brasil|b3 s\.?a|ambev|weg|"
                     r"eletrobras|centrais eletricas brasileiras|suzano|btg|santander|jbs|embraer|localiza|rede d.or|"
                     r"equatorial|sabesp|gerdau|rumo|raia|natura|magazine luiza|cosan|prio|klabin|telefonica|tim s")


def plain(text):
    text = unicodedata.normalize("NFKD", (text or "").lower())
    return "".join(c for c in text if not unicodedata.combining(c))


def strip_html(text, limit=SUMMARY):
    text = unescape(re.sub(r"<[^>]+>", " ", unescape(text or "")))
    text = re.sub(r"\s+", " ", text).strip()
    if len(text) > limit:
        text = text[:limit].rsplit(" ", 1)[0].rstrip(",.;:") + "…"
    return text


def classify(title, summary, source):
    """Tema e impacto (1 baixo, 2 médio, 3 alto) por regras fixas de palavras."""
    head, body = plain(title), plain(summary)
    topic, impact = None, 1
    for name, weight, patterns in COMPILED:
        in_title = any(p.search(head) for p in patterns)
        if in_title or any(p.search(body) for p in patterns):
            topic = topic or name
            # Casou só no resumo: vale um nível a menos.
            impact = max(impact, weight if in_title else weight - 1)
    if topic and ROUTINE.search(head):
        impact = max(1, impact - 1)
    if source == "cvm_fatos":
        company = head.split(":", 1)[0]
        buyback = "propria companhia" in head or "recompra" in head
        topic, impact = "empresas", 2 if not buyback and (CVM_MATERIAL.search(head) or CVM_BIG.search(company)) else 1
    elif source in {"fed", "ecb"}:
        if topic == "regulacao":
            impact = 1
        elif topic not in {"juros", "cambio"}:
            topic = "mundo"
    return topic, impact


def item(source, title, link, when, summary="", day_only=False, extra=None):
    title = strip_html(title, 220)
    summary = strip_html(summary)
    if summary.lower().startswith(title.lower()[:60]):
        summary = summary[len(title):].lstrip(" .:-–") if len(summary) > len(title) + 20 else ""
    topic, impact = classify(title, summary, source)
    out = dict(id=sha1((link or title).encode()).hexdigest()[:16], source=source, title=title, link=link,
               time=when.astimezone(UTC).isoformat(), day_only=day_only, summary=summary, topic=topic, impact=impact)
    if extra:
        out.update(extra)
    return out


def _when(text):
    text = (text or "").strip()
    try:
        return parsedate_to_datetime(text) if text[:3].isalpha() else datetime.fromisoformat(text.replace("Z", "+00:00"))
    except (TypeError, ValueError):
        return None


def parse_atom(body, source):
    ns = "{http://www.w3.org/2005/Atom}"
    out = []
    for entry in ET.fromstring(body).iter(ns + "entry"):
        when = _when(entry.findtext(ns + "updated") or entry.findtext(ns + "published"))
        link = next((l.get("href") for l in entry.iter(ns + "link") if l.get("rel", "alternate") == "alternate"), None)
        title = entry.findtext(ns + "title")
        if when and title and link:
            out.append(item(source, title, link, when, entry.findtext(ns + "content") or entry.findtext(ns + "summary") or ""))
    return out


def parse_rss(body, source):
    out = []
    for node in ET.fromstring(body).iter("item"):
        when = _when(node.findtext("pubDate"))
        title, link = node.findtext("title"), (node.findtext("link") or "").strip()
        # O BCE publica links com barra dupla; normaliza sem mudar o destino.
        link = re.sub(r"(?<!:)//+", "/", link)
        if when and title and link:
            out.append(item(source, title, link, when, node.findtext("description") or ""))
    return out


def parse_ibge(body, source):
    out = []
    for row in json.loads(body).get("items", []):
        try:
            when = datetime.strptime(row["data_publicacao"], "%d/%m/%Y %H:%M:%S").replace(tzinfo=BRASILIA)
        except (KeyError, ValueError):
            continue
        link = (row.get("link") or "").replace("http://", "https://", 1)
        if row.get("titulo") and link:
            out.append(item(source, row["titulo"], link, when, row.get("introducao") or ""))
    return out


def parse_ipe(body, source, today, days=7):
    """Fatos relevantes entregues à CVM nos últimos `days` dias."""
    with zipfile.ZipFile(io.BytesIO(body)) as archive:
        name = next(n for n in archive.namelist() if n.endswith(".csv"))
        text = archive.read(name).decode("latin-1")
    start = (today - timedelta(days=days)).isoformat()
    out = []
    for row in csv.DictReader(io.StringIO(text), delimiter=";"):
        if row.get("Categoria") != "Fato Relevante" or (row.get("Data_Entrega") or "") < start:
            continue
        try:
            when = datetime.fromisoformat(row["Data_Entrega"]).replace(hour=12, tzinfo=BRASILIA)
        except ValueError:
            continue
        company = (row.get("Nome_Companhia") or "").strip()
        subject = (row.get("Assunto") or "").strip() or "Fato relevante"
        link = (row.get("Link_Download") or "").strip()
        if not link.startswith("https://www.rad.cvm.gov.br/"):
            continue
        out.append(item(source, f"{company}: {subject}", link, when, "Fato relevante entregue à CVM.", day_only=True,
                        extra={"company": company}))
    return out


def url_for(source, today):
    return BY_ID[source]["url"].format(year=today.year)


def download(url):
    if not url.startswith(HOSTS):
        raise ValueError("Endereço fora da lista autorizada")
    request = Request(url, headers={"User-Agent": "ObservatorioEconomico/1.0"})
    with urlopen(request, timeout=30) as response:
        if not response.url.startswith(HOSTS):
            raise ValueError("Redirecionamento inesperado")
        body = response.read(MAX_BYTES + 1)
    if len(body) > MAX_BYTES:
        raise ValueError("Resposta excede o limite")
    return body


def parse(source, body, today):
    kind = BY_ID[source]["kind"]
    if kind == "atom":
        items = parse_atom(body, source)
    elif kind == "rss":
        items = parse_rss(body, source)
    elif kind == "ibge":
        items = parse_ibge(body, source)
    else:
        items = parse_ipe(body, source, today)
    if BY_ID[source].get("only_topics"):
        items = [i for i in items if i["topic"] and i["topic"] != "regulacao"]
    for i in items:
        i["topic"] = i["topic"] or "geral"
    return items
