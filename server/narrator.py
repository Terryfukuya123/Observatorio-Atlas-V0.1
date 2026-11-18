"""Narrador de mercado: transforma os dados já coletados em frases curtas, com número e fonte.

Só regras fixas, sem modelo de linguagem: cada frase sai de um dado que a plataforma já
mostra (PTAX, Copom, placar de surpresas, Focus, fluxo cambial e notícias de alto impacto).
Nada é inventado; se um dado falta, a frase correspondente simplesmente não aparece.

Cada evento traz:
- text: a frase escrita; say: a mesma frase pronta para leitura em voz alta;
- weight: 1 (rotina), 2 (relevante) ou 3 (destaque);
- tone: "pos" ou "neg" quando há leitura clara (inflação abaixo do esperado, real mais
  forte), senão "neutro";
- link: a seção da plataforma com a análise completa.
"""
import re
from datetime import UTC, date, datetime, timedelta, timezone

BRT = timezone(timedelta(hours=-3))
KEEP_DAYS = 14
NEWS_HOURS = 48
MONTHS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"]
MONTHS_LONG = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto",
               "setembro", "outubro", "novembro", "dezembro"]
# Revisão mínima do Focus (em relação à semana anterior) para virar frase.
FOCUS_MIN = {"focus_ipca": 0.05, "focus_pib": 0.05, "focus_selic": 0.125, "focus_cambio": 0.03}
FOCUS_NAMES = {"focus_ipca": "o IPCA", "focus_pib": "o PIB", "focus_selic": "a Selic no fim do ano",
               "focus_cambio": "o dólar no fim do ano"}
SURPRISE_NAMES = {"desocupacao": "Desemprego"}
# Componentes do IPCA: viram uma frase só de abertura, em vez de uma por componente.
COMPONENTS = ("livres", "servicos", "monitorados", "alimentacao", "industrializados")


def num(v, places=2):
    """Número no formato brasileiro, com sinal de menos tipográfico."""
    text = f"{abs(v):,.{places}f}".replace(",", "X").replace(".", ",").replace("X", ".")
    return ("−" if v < 0 and round(abs(v), places) else "") + text


def signed(v, places=2):
    return ("+" if v > 0 and round(v, places) else "") + num(v, places)


def month_label(ref):
    y, m = ref.split("-")[:2]
    return MONTHS[int(m) - 1] + "/" + y[2:]


def month_spoken(ref):
    y, m = ref.split("-")[:2]
    return MONTHS_LONG[int(m) - 1] + " de " + y


def day_label(iso):
    return iso[8:10] + "/" + iso[5:7]


def at(day, hour):
    """Dia AAAA-MM-DD às `hour` horas de Brasília, em ISO UTC."""
    y, m, d = map(int, day[:10].split("-"))
    return datetime(y, m, d, hour, tzinfo=BRT).astimezone(UTC).isoformat()


def spoken(text):
    """Ajustes para a leitura em voz alta: siglas e abreviações viram palavras."""
    text = re.sub(r"US\$ (\d[\d.,]*\d|\d) bi\b", r"\1 bilhões de dólares", text)
    text = re.sub(r"R\$ (\d[\d.,]*\d|\d)", r"\1 reais", text)
    for a, b in (("p.p.", "ponto percentual"), ("−", "menos "), ("+", "mais "), ("Focus", "Fócus"), ("PTAX", "ptáx")):
        text = text.replace(a, b)
    return " ".join(text.split())


def event(id, time, kind, weight, text, link, source, tone="neutro", say=None):
    return dict(id=id, time=time, kind=kind, weight=weight, tone=tone, text=text,
                say=say or spoken(text), link=link, source=source)


def dollar(overview):
    p = (overview or {}).get("ptax", {}).get("USD") or {}
    rows = p.get("history") or []
    if len(rows) < 2:
        return []
    (day, last), (_, prev) = rows[-1], rows[-2]
    last, prev = float(last), float(prev)
    change = (last / prev - 1) * 100
    week = (last / float(rows[-6][1]) - 1) * 100 if len(rows) >= 6 else None
    move = "alta" if change > 0 else "queda" if change < 0 else "estabilidade"
    text = (f"Dólar PTAX de {day_label(day)} a R$ {num(last, 4)}, " +
            (f"{move} de {num(abs(change))}% no dia" if move != "estabilidade" else "estável no dia") +
            (f"; em cinco pregões, {signed(week)}%." if week is not None else "."))
    big = max(abs(change), abs(week or 0) / 2)
    weight = 3 if big >= 1.5 else 2 if big >= 0.75 else 1
    tone = "neg" if change >= 0.75 or (week or 0) >= 2 else "pos" if change <= -0.75 or (week or 0) <= -2 else "neutro"
    say = (f"Dólar ptáx do dia {int(day[8:10])} a {num(last, 2)} reais, " +
           (f"{move} de {num(abs(change))}% no dia" if move != "estabilidade" else "estável no dia") +
           (f"; em cinco pregões, {'alta' if week > 0 else 'queda'} de {num(abs(week))}%." if week is not None else "."))
    return [event("ptax:" + day, at(day, 13), "cambio", weight, text, "#moedas", "BCB · PTAX", tone, say)]


def copom(surprises, today):
    c = ((surprises or {}).get("data") or {}).get("copom") or {}
    out = []
    done = [m for m in c.get("meetings", []) if m.get("decided") is not None]
    if done:
        m = done[-1]
        when = date.fromisoformat(m["surveyed"])
        if (today - when).days <= KEEP_DAYS * 3:
            n, year = m["meeting"][1:].split("/")
            action = ("manteve a Selic em" if m["change"] == 0 else
                      ("cortou a Selic para" if m["change"] < 0 else "elevou a Selic para"))
            read = {"acima": "mais duro que o esperado", "abaixo": "mais brando que o esperado",
                    "em linha": "em linha com o esperado"}[m["verdict"]]
            text = (f"Copom ({n}ª reunião de {year}) {action} {num(m['decided'])}%; a mediana do Focus "
                    f"esperava {num(m['median'])}%: {read}.")
            out.append(event("copom:" + m["meeting"], at(m["surveyed"], 18), "juros",
                             3 if m["verdict"] != "em linha" else 2, text, "#surpresas", "BCB · SGS e Focus"))
    nxt = c.get("next")
    if nxt and nxt.get("median") is not None:
        n, year = nxt["meeting"][1:].split("/")
        move = nxt.get("expected") or 0
        exp = ("manutenção em" if abs(move) < 0.01 else "corte para" if move < 0 else "alta para")
        text = (f"Para a {n}ª reunião do Copom de {year}, o Focus de {day_label(nxt['surveyed'])} espera "
                f"{exp} {num(nxt['median'])}% ({nxt['respondents']} projeções).")
        out.append(event("copom-next:" + nxt["meeting"] + ":" + nxt["surveyed"], at(nxt["surveyed"], 9),
                         "expectativas", 1, text, "#surpresas", "BCB · Focus"))
    return out


def breakdown(parts, period, released):
    """Abertura do IPCA: quantos componentes vieram acima, abaixo e em linha."""
    words = {"acima": [], "abaixo": [], "em linha": []}
    for ind, r in parts:
        words[r["verdict"]].append(ind["name"].lower())
    bits = [f"{k} do esperado: {', '.join(v)}" if k != "em linha" else f"em linha: {', '.join(v)}"
            for k, v in words.items() if v]
    text = f"Abertura do IPCA de {month_label(period)}: " + "; ".join(bits) + "."
    up, down = len(words["acima"]), len(words["abaixo"])
    tone = "pos" if down > up else "neg" if up > down else "neutro"
    say = (f"Na abertura do IPCA de {month_spoken(period)}, {down} de {len(parts)} grupos vieram abaixo do esperado"
           + (f" e {up} acima" if up else "") + ".")
    return event(f"abertura:ipca:{period}", at(released, 9), "inflacao", 2 if abs(up - down) >= 2 else 1, text,
                 "#inflacao", "IBGE e Focus", tone, say)


def releases(surprises, today):
    out = []
    parts = []
    for ind in ((surprises or {}).get("data") or {}).get("indicators", []):
        r = ind.get("latest")
        if not r:
            continue
        if ind["id"] in COMPONENTS:
            parts.append((ind, r))
            continue
        released = date.fromisoformat(r["surveyed"]) + timedelta(days=1)
        if (today - released).days > KEEP_DAYS * 3:
            continue
        name = SURPRISE_NAMES.get(ind["id"], ind["name"])
        z = r.get("z")
        verdict = r["verdict"]
        compare = (f"{verdict} do consenso de {num(r['median'])}%" if verdict != "em linha"
                   else f"em linha com o consenso de {num(r['median'])}%")
        detail = (f" (surpresa de {signed(r['surprise'])} p.p." + (f", {signed(z, 1)} desvios" if z is not None else "") + ")"
                  if verdict != "em linha" else "")
        text = f"{name} de {month_label(r['period'])}: {num(r['actual'])}%, {compare}{detail}."
        say = (f"{name} de {month_spoken(r['period'])}: {num(r['actual'])}%, {compare}" +
               (f", uma surpresa de {num(abs(z), 1)} desvios-padrão" if verdict != "em linha" and z is not None else "") + ".")
        weight = 1 if verdict == "em linha" else 3 if z is not None and abs(z) >= 1.5 and ind["id"] in {"ipca", "desocupacao"} else 2
        tone = "pos" if verdict == "abaixo" else "neg" if verdict == "acima" else "neutro"
        out.append(event(f"dado:{ind['id']}:{r['period']}", at(released.isoformat(), 9),
                         "atividade" if ind["id"] == "desocupacao" else "inflacao", weight, text, "#surpresas",
                         "IBGE/FGV e Focus", tone, say))
    head = next((e for e in out if e["id"].startswith("dado:ipca:")), None)
    same = [(i, r) for i, r in parts if head and head["id"] == "dado:ipca:" + r["period"]]
    if same:
        out.append(breakdown(same, same[0][1]["period"], head["time"][:10]))
    return out


def focus(overview, today):
    out = []
    year = str(today.year)
    for ind in ((overview or {}).get("focus") or {}).get("indicators", []):
        limit = FOCUS_MIN.get(ind["id"])
        if limit is None:
            continue
        row = next((y for y in ind.get("years", []) if y["year"] == year), None)
        if not row or not row.get("week_ago"):
            continue
        observed = date.fromisoformat(row["observed"])
        if (today - observed).days > KEEP_DAYS:
            continue
        now, before = float(row["median"]), float(row["week_ago"]["median"])
        delta = now - before
        if abs(delta) < limit:
            continue
        places = 4 if ind["id"] == "focus_cambio" else 2
        unit = "" if ind["id"] == "focus_cambio" else "%"
        value = (f"R$ {num(now, 2)}" if ind["id"] == "focus_cambio" else f"{num(now, places)}{unit}")
        old = (f"R$ {num(before, 2)}" if ind["id"] == "focus_cambio" else f"{num(before, places)}{unit}")
        trend = row.get("trend") or {}
        streak = trend.get("weeks") or 0
        tail = (f"; {streak}ª semana seguida de {trend['direction']}" if streak >= 2 and trend.get("direction") in {"alta", "queda"} else "")
        text = f"Focus: mercado {'elevou' if delta > 0 else 'reduziu'} a projeção para {FOCUS_NAMES[ind['id']]} de {year} para {value} (era {old}){tail}."
        tone = "neutro"
        if ind["id"] == "focus_ipca":
            tone = "pos" if delta < 0 else "neg"
        weight = 2 if streak >= 4 or abs(delta) >= 2 * limit else 1
        # O boletim sai na segunda-feira seguinte à pesquisa de sexta.
        published = observed + timedelta(days=(7 - observed.weekday()) % 7 or 7)
        out.append(event(f"focus:{ind['id']}:{row['observed']}", at(published.isoformat(), 8), "expectativas",
                         weight, text, "#focus", "BCB · Focus", tone))
    return out


def flows(flow):
    data = (flow or {}).get("data") or {}
    months = data.get("months") or []
    through = data.get("through")
    total = (data.get("ytd") or {}).get("cambio_total")
    if not months or not through or not total:
        return []
    cur = months[-1]
    value = float(cur["total"]) / 1000
    ytd = float(total["value"]) / 1000
    verb = "entraram" if value >= 0 else "saíram"
    text = (f"Fluxo cambial: em {month_label(cur['month'])}, até {day_label(through)}, {verb} US$ {num(abs(value), 1)} bi; "
            f"no ano, {'entraram' if ytd >= 0 else 'saíram'} US$ {num(abs(ytd), 1)} bi.")
    say = (f"Fluxo cambial: em {month_spoken(cur['month'])}, até o dia {int(through[8:10])}, {verb} "
           f"{num(abs(value), 1)} bilhões de dólares; no ano, {'entraram' if ytd >= 0 else 'saíram'} {num(abs(ytd), 1)} bilhões.")
    tone = "pos" if value > 1 else "neg" if value < -1 else "neutro"
    # O BC divulga o fluxo às quartas-feiras, com dados até a sexta anterior.
    published = date.fromisoformat(through) + timedelta(days=5)
    return [event(f"fluxo:{through}", at(published.isoformat(), 14), "fluxo", 1, text, "#fluxo",
                  "BCB · fluxo cambial", tone, say)]


def headlines(news, now):
    out = []
    data = news or {}
    names = {s["id"]: s["short"] for s in data.get("sources", [])}
    for item in data.get("items", []):
        if item.get("impact") != 3:
            continue
        when = datetime.fromisoformat(item["time"])
        if now - when > timedelta(hours=NEWS_HOURS):
            continue
        source = names.get(item["source"], item["source"])
        text = f"{item['title']} ({source})."
        out.append(event("nota:" + item["id"], item["time"], "noticia", 3, text, "#noticias", source,
                         say=spoken(f"{source} informa: {item['title']}.")))
    return out


def narrate(overview, surprises, flow, news, now=None):
    now = now or datetime.now(UTC)
    today = now.astimezone(BRT).date()
    builders = (lambda: dollar(overview), lambda: copom(surprises, today), lambda: releases(surprises, today),
                lambda: focus(overview, today), lambda: flows(flow), lambda: headlines(news, now))
    events = []
    for build in builders:
        try:
            events += build()
        except (KeyError, TypeError, ValueError, IndexError, ZeroDivisionError):
            continue  # um dado mal formado tira só a sua frase, não o narrador inteiro
    cutoff = (now - timedelta(days=KEEP_DAYS)).isoformat()
    future = (now + timedelta(hours=1)).isoformat()
    # Frases de "o que vem" (próximo Copom) não envelhecem enquanto a reunião não acontece.
    events = [e for e in events if e["kind"] == "expectativas" and e["id"].startswith("copom-next") or cutoff <= e["time"]]
    events = [dict(e, time=min(e["time"], now.isoformat())) if e["time"] > future else e for e in events]
    events.sort(key=lambda e: e["time"], reverse=True)
    return dict(generated=now.isoformat(), events=events, summary=summary(events, now),
                method="Frases geradas por regras fixas a partir dos dados da própria plataforma (PTAX, Copom, "
                       "placar de surpresas, Focus, fluxo cambial e notícias de alto impacto). Sem modelo de "
                       "linguagem: cada número tem fonte e nada é estimado pelo narrador.")


def summary(events, now):
    """Resumo falado: o dólar do dia e os destaques mais recentes, no máximo cinco frases."""
    week = (now - timedelta(days=7)).isoformat()
    lead = [e for e in events if e["kind"] == "cambio"][:1]
    # Dados antes de notícias, no máximo duas notícias, e o mais importante primeiro.
    ranked = sorted((e for e in events if e not in lead and e["time"] >= week and e["weight"] >= 2),
                    key=lambda e: (e["weight"], e["kind"] != "noticia", e["time"]), reverse=True)
    news = [e for e in ranked if e["kind"] == "noticia"][:2]
    rest = [e for e in ranked if e["kind"] != "noticia" or e in news][:4]
    if not lead and not rest:
        return dict(text="Sem novidades relevantes nos últimos sete dias.", say="Sem novidades relevantes nos últimos sete dias.", ids=[])
    picked = lead + rest
    hour = now.astimezone(BRT)
    opening = f"Resumo do Observatório, {hour.day} de {MONTHS_LONG[hour.month - 1]}, {hour.hour}h{hour.minute:02d}."
    return dict(text=" ".join(e["text"] for e in picked),
                say=opening + " " + " ".join(e["say"] for e in picked),
                ids=[e["id"] for e in picked])
