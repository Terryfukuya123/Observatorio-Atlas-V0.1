"""Placar de surpresas: dado divulgado contra o consenso do Focus na véspera (BCB, ODbL).

- Expectativa: a mediana da última pesquisa Focus (base de 30 dias) para o mês de
  referência. O Focus deixa de perguntar por um mês quando o dado sai, então a última
  pesquisa é o consenso às vésperas da divulgação.
- Surpresa: divulgado − mediana, em pontos percentuais. Surpresa padronizada: surpresa
  dividida pelo desvio-padrão das projeções naquela pesquisa (limitada a ±4), o que
  permite somar indicadores de escalas diferentes.
- Veredito: "acima" ou "abaixo" quando a surpresa passa de meio desvio-padrão e de
  0,03 p.p.; senão, "em linha".
- Copom: decisão (meta Selic vigente uma semana após a última pesquisa) contra a
  mediana para aquela reunião.
"""
from datetime import date, timedelta

GROUPS = frozenset({"inflacao", "precos", "atividade"})
WINDOW = 12
HISTORY = 24
CAP = 4.0
MIN_PP = 0.03
COPOM_LAG = timedelta(days=7)
COPOM_MIN = 0.1


def _r(v, places=2):
    return None if v is None else round(v, places)


def actual_map(data):
    """Pontos do SGS [(data, valor)] ou do IBGE [(data, valor, rótulo)] → {"AAAA-MM": valor}."""
    return {row[0][:7]: float(row[1]) for row in data or []}


def verdict(surprise, z):
    if abs(surprise) < MIN_PP or (z is not None and abs(z) < 0.5):
        return "em linha"
    return "acima" if surprise > 0 else "abaixo"


def indicator(spec, expectations, actual):
    rows = []
    for ref, (surveyed, median, sd, respondents) in sorted((expectations or {}).items()):
        if ref not in actual:
            continue
        m = float(median)
        s = float(sd) if sd is not None and float(sd) > 0 else None
        surprise = actual[ref] - m
        z = max(-CAP, min(CAP, surprise / s)) if s else None
        rows.append(dict(period=ref, actual=_r(actual[ref], 3), median=_r(m, 3), sd=_r(s, 3), respondents=respondents,
                         surveyed=surveyed, surprise=_r(surprise, 3), z=_r(z), verdict=verdict(surprise, z)))
    last = max(actual) if actual else None
    pending = sorted(ref for ref in (expectations or {}) if ref not in actual and (last is None or ref > last))
    upcoming = None
    if pending:
        surveyed, median, sd, respondents = expectations[pending[0]]
        upcoming = dict(period=pending[0], median=_r(float(median), 3), sd=_r(float(sd), 3) if sd is not None else None,
                        respondents=respondents, surveyed=surveyed)
    recent = rows[-WINDOW:]
    score = dict(count=len(recent), above=sum(r["verdict"] == "acima" for r in recent),
                 below=sum(r["verdict"] == "abaixo" for r in recent),
                 inline=sum(r["verdict"] == "em linha" for r in recent),
                 mean=_r(sum(r["surprise"] for r in recent) / len(recent), 3) if recent else None)
    return dict(id=spec["id"], indicator=spec["indicator"], name=spec["name"], group=spec["group"],
                latest=rows[-1] if rows else None, history=rows[-HISTORY:], score=score, next=upcoming)


def inflation_index(items):
    """Média mensal das surpresas padronizadas do IPCA e componentes, e a média de 3 meses."""
    by_month = {}
    for it in items:
        if it["group"] != "inflacao":
            continue
        for r in it["history"]:
            if r["z"] is not None:
                by_month.setdefault(r["period"], []).append(r["z"])
    months = sorted(by_month)
    out = []
    for i, m in enumerate(months):
        mean = sum(by_month[m]) / len(by_month[m])
        window = [sum(by_month[k]) / len(by_month[k]) for k in months[max(0, i - 2):i + 1]]
        out.append([m, _r(mean), _r(sum(window) / len(window)), len(by_month[m])])
    return out[-HISTORY:]


def copom(expectations, selic, today):
    """Reuniões decididas (pesquisa encerrada e uma semana de meta Selic depois) e a próxima."""
    meta = [(date.fromisoformat(d), float(v)) for d, v in selic or []]
    if not expectations or not meta:
        return dict(meetings=[], next=None)

    def at(day):
        found = None
        for d, v in meta:
            if d > day:
                break
            found = v
        return found

    latest = max(e[0] for e in expectations.values())
    meetings, upcoming = [], None
    for name, (surveyed, median, sd, respondents) in expectations.items():
        s = date.fromisoformat(surveyed)
        before = at(s)
        if before is None:
            continue
        m = float(median)
        if surveyed < latest and meta[-1][0] >= s + COPOM_LAG:
            after = at(s + COPOM_LAG)
            surprise = after - m
            meetings.append(dict(meeting=name, surveyed=surveyed, before=before, median=_r(m, 3), decided=after,
                                 sd=_r(float(sd), 3) if sd is not None else None, respondents=respondents,
                                 expected=_r(m - before, 3), change=_r(after - before, 3), surprise=_r(surprise, 3),
                                 verdict="em linha" if abs(surprise) < COPOM_MIN else "acima" if surprise > 0 else "abaixo"))
        elif upcoming is None and meta[-1][0] <= today:
            current = meta[-1][1]
            upcoming = dict(meeting=name, surveyed=surveyed, current=current, median=_r(m, 3),
                            sd=_r(float(sd), 3) if sd is not None else None, respondents=respondents,
                            expected=_r(m - current, 3), closed=surveyed < latest)
    return dict(meetings=meetings[-8:], next=upcoming)


def summary(catalog, monthly, selic_expectations, actuals, selic, today):
    """`catalog`: lista `surpresas`; `monthly`: Focus mensal por indicador; `actuals`: chave da fonte → pontos."""
    items = [indicator(spec, (monthly or {}).get(spec["indicator"]), actual_map(actuals.get(spec["actual"])))
             for spec in catalog]
    observed = [it["latest"]["period"] for it in items if it["latest"]]
    return dict(observed=max(observed) if observed else None, indicators=items, inflation_index=inflation_index(items),
                copom=copom(selic_expectations, selic, today))
