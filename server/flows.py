"""Fluxo de capital no Brasil a partir de séries do BCB (ODbL).

Organiza a leitura em camadas de tempo: acumulado no ano (comparado ao mesmo
período do ano anterior), mês a mês e dia a dia. Valores em US$ milhões, como
publicados, exceto o volume do interbancário (US$).
"""
from collections import defaultdict
from datetime import date
from decimal import Decimal

BLOCKS = frozenset({"cambio", "mercado", "agentes", "estrangeiros"})
REQUIRED = frozenset({"cambio_total", "cambio_comercial", "cambio_financeiro", "cambio_exportacao", "cambio_importacao",
                      "cambio_fin_compras", "cambio_fin_vendas", "posicao_bancos", "interbancario"})
MONTHS = 13
DAYS = 25
AGENT_MONTHS = 12

INSTRUMENTS = {
    ("Venda a Vista", None): "Venda à vista",
    ("Compra a Vista", None): "Compra à vista",
    ("Venda com Recompra", None): "Linha (venda com recompra)",
    ("Swap Cambial", "Tradicional"): "Swap tradicional",
    ("Swap Cambial", "Reverso"): "Swap reverso",
}


def _points(data):
    return [(date.fromisoformat(d), Decimal(v)) for d, v in data or []]


def _text(value, places="0.1"):
    return str(value.quantize(Decimal(places))) if value is not None else None


def year_to_date(points, end):
    """Soma de 1º de janeiro até `end` e do mesmo intervalo no ano anterior."""
    current = sum((v for d, v in points if d.year == end.year and d <= end), Decimal(0))
    limit = (end.month, end.day)
    previous = [v for d, v in points if d.year == end.year - 1 and (d.month, d.day) <= limit]
    return {"value": _text(current), "previous": _text(sum(previous, Decimal(0))) if previous else None}


def by_month(points):
    months = defaultdict(Decimal)
    for d, v in points:
        months[d.strftime("%Y-%m")] += v
    return months


def label(instrument, modality):
    return INSTRUMENTS.get((instrument, modality)) or INSTRUMENTS.get((instrument, None)) or f"{instrument} · {modality}"


def central_bank(operations, end):
    """Volume aceito por instrumento no ano de `end` (inclui rolagens de swaps e linhas)."""
    totals = defaultdict(lambda: [Decimal(0), 0])
    year = str(end.year)
    for day, instrument, modality, _offered, accepted in operations or []:
        if not day.startswith(year) or accepted is None:
            continue
        item = totals[label(instrument, modality)]
        item[0] += Decimal(accepted)
        item[1] += 1
    items = [{"instrument": k, "accepted": _text(v[0] / Decimal(1_000_000)), "operations": v[1]}
             for k, v in sorted(totals.items(), key=lambda kv: -kv[1][0])]
    recent = [{"date": day, "instrument": label(i, m),
               "accepted": _text(Decimal(a) / Decimal(1_000_000)) if a is not None else None,
               "offered": _text(Decimal(o) / Decimal(1_000_000)) if o is not None else None}
              for day, i, m, o, a in [op for op in operations or [] if op[4] is not None][-5:]][::-1]
    return {"year": end.year, "through": operations[-1][0] if operations else None, "items": items, "recent": recent}


def summary(series, operations, catalog):
    """`series` mapeia id → [(data ISO, valor)]; `catalog` é a lista `fluxo` do catálogo."""
    meta = {s["id"]: s for s in catalog}
    pts = {k: _points(series.get(k)) for k in meta}
    for k in REQUIRED - pts.keys():
        pts[k] = []
    total = pts["cambio_total"]
    if not total:
        return None
    end = total[-1][0]
    cambio = {k: dict(year_to_date(pts[k], end), name=meta[k]["name"])
              for k in ("cambio_total", "cambio_comercial", "cambio_financeiro", "cambio_exportacao",
                        "cambio_importacao", "cambio_fin_compras", "cambio_fin_vendas") if pts[k]}
    monthly = {k: by_month(pts[k]) for k in ("cambio_comercial", "cambio_financeiro", "cambio_total")}
    months = sorted(monthly["cambio_total"])[-MONTHS:]
    month_rows = [{"month": m, "comercial": _text(monthly["cambio_comercial"].get(m)),
                   "financeiro": _text(monthly["cambio_financeiro"].get(m)),
                   "total": _text(monthly["cambio_total"].get(m)),
                   "partial": m == end.strftime("%Y-%m")} for m in months]
    daily = {k: dict(pts[k]) for k in ("cambio_comercial", "cambio_financeiro")}
    day_rows = [{"date": d.isoformat(), "total": _text(v), "comercial": _text(daily["cambio_comercial"].get(d)),
                 "financeiro": _text(daily["cambio_financeiro"].get(d))} for d, v in total[-DAYS:]]

    def block(name):
        items, through = [], None
        for s in catalog:
            if s["block"] != name or not pts[s["id"]]:
                continue
            last = pts[s["id"]][-1][0]
            through = max(through or last, last)
            items.append(dict(year_to_date(pts[s["id"]], last), id=s["id"], name=s["name"], observed=last.isoformat(),
                              monthly=[[d.strftime("%Y-%m"), _text(v)] for d, v in pts[s["id"]][-AGENT_MONTHS:]]))
        return {"through": through.isoformat() if through else None, "items": items}

    banks = pts["posicao_bancos"]
    inter = pts["interbancario"]
    market = {}
    if banks:
        market["banks"] = {"observed": banks[-1][0].isoformat(), "value": _text(banks[-1][1]),
                           "history": [[d.strftime("%Y-%m"), _text(v)] for d, v in banks[-24:]]}
    if inter:
        window = [v for _, v in inter[-20:]]
        market["interbank"] = {"observed": inter[-1][0].isoformat(), "value": _text(inter[-1][1] / Decimal(1_000_000)),
                               "average20": _text(sum(window, Decimal(0)) / len(window) / Decimal(1_000_000))}
    return {"through": end.isoformat(), "year": end.year, "ytd": cambio, "months": month_rows, "days": day_rows,
            "agents": block("agentes"), "foreigners": block("estrangeiros"), "market": market,
            "central_bank": central_bank(operations, end) if operations else None}
