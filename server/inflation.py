"""Qualidade da inflação: o IPCA por dentro, com séries do BCB (ODbL).

- Núcleos: a média dos cinco núcleos que o mercado acompanha (EX0, EX3, MS, DP, P55)
  tira o ruído de itens voláteis e mostra a tendência.
- Grupos: serviços, preços livres e monitorados, comercializáveis e não comercializáveis.
- Difusão: a parcela dos itens do IPCA com alta no mês; comparada à média do mesmo mês
  nos cinco anos anteriores, porque tem sazonalidade forte.
- IC-Br: o índice de commodities do BC em reais (agropecuária, metal e energia), que
  costuma antecipar alimentos e combustíveis no IPCA.

Ritmo de 3 meses anualizado: (1 + soma composta dos 3 meses) ^ 4 − 1, sem ajuste sazonal.
"""
from decimal import Decimal

BLOCKS = frozenset({"nucleos", "grupos", "difusao", "commodities"})
CORES = ("nucleo_ex0", "nucleo_ex3", "nucleo_ms", "nucleo_dp", "nucleo_p55")
HISTORY = 36


def _pts(data):
    return [(d[:7], float(Decimal(v))) for d, v in data or []]


def compound(values):
    acc = 1.0
    for v in values:
        acc *= 1 + v / 100
    return (acc - 1) * 100


def _r(v, places=2):
    return None if v is None else round(v, places)


def rates(points):
    """Variações mensais (%) → últimos 12 meses, ritmo de 3 meses anualizado e histórico de 12 meses."""
    if len(points) < 12:
        return None
    values = [v for _, v in points]
    twelve = compound(values[-12:])
    saar = ((1 + compound(values[-3:]) / 100) ** 4 - 1) * 100
    before = compound(values[-24:-12]) if len(values) >= 24 else None
    history = [[points[i][0], _r(compound(values[i - 11:i + 1]))] for i in range(max(11, len(points) - HISTORY), len(points))]
    return dict(observed=points[-1][0], month=_r(values[-1]), twelve=_r(twelve), saar3=_r(saar),
                twelve_year_ago=_r(before), history=history)


def core_average(series):
    """Média simples dos cinco núcleos, só nos meses em que todos saíram."""
    maps = [dict(_pts(series.get(k))) for k in CORES]
    if not all(maps):
        return []
    months = sorted(set.intersection(*(set(m) for m in maps)))
    return [(m, sum(mp[m] for mp in maps) / len(maps)) for m in months]


def diffusion(points):
    if not points:
        return None
    month, value = points[-1]
    same = [v for m, v in points if m[5:] == month[5:] and int(month[:4]) - 5 <= int(m[:4]) < int(month[:4])]
    recent = [v for _, v in points[-3:]]
    return dict(observed=month, value=_r(value, 1), average3=_r(sum(recent) / len(recent), 1),
                seasonal=_r(sum(same) / len(same), 1) if same else None, seasonal_years=len(same),
                history=[[m, _r(v, 1)] for m, v in points[-HISTORY:]])


def index_changes(points):
    if len(points) < 2:
        return None
    month, value = points[-1]

    def back(n):
        return _r((value / points[-1 - n][1] - 1) * 100) if len(points) > n else None
    return dict(observed=month, value=_r(value), month=back(1), quarter=back(3), twelve=back(12),
                history=[[m, _r(v)] for m, v in points[-HISTORY:]])


def summary(series, catalog, headline=None):
    """`series` mapeia id → [(data ISO, valor)]; `catalog` é a lista `inflacao`; `headline`, o IPCA mensal."""
    meta = {s["id"]: s for s in catalog}
    groups = {}
    for s in catalog:
        if s["block"] == "grupos":
            r = rates(_pts(series.get(s["id"])))
            if r:
                groups[s["id"]] = dict(r, name=s["name"])
    cores = {}
    for k in CORES:
        r = rates(_pts(series.get(k)))
        if r and k in meta:
            cores[k] = dict(r, name=meta[k]["name"])
    average = rates(core_average(series))
    commodities = {}
    for s in catalog:
        if s["block"] == "commodities":
            c = index_changes(_pts(series.get(s["id"])))
            if c:
                commodities[s["id"]] = dict(c, name=s["name"])
    diff = next((diffusion(_pts(series.get(s["id"]))) for s in catalog if s["block"] == "difusao"), None)
    ipca = rates(_pts(headline)) if headline else None
    observed = [x["observed"] for x in [ipca, average, diff, *groups.values()] if x]
    return dict(observed=max(observed) if observed else None, ipca=ipca, core_average=average, cores=cores,
                groups=groups, diffusion=diff, commodities=commodities)
