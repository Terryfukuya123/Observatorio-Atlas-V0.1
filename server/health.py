"""Saúde das fontes: um retrato de cada coleta da plataforma num só lugar.

Para cada série coletada diz a situação (em dia, atenção ou falha), a última observação,
a última coleta válida, a próxima tentativa e o erro, se houver. Lê só o que as lojas já
guardam em memória ou em disco; não dispara coleta nova.
"""
import json
from datetime import UTC, date, datetime, timedelta

OK, WARN, FAIL = "ok", "warn", "fail"
LEVEL = {
    "Atualizado": OK,
    "Importado": OK,
    "Dado histórico": WARN,
    "Atrasado": WARN,
    "Cobertura parcial": WARN,
    "Aguardando coleta": WARN,
    "Aguardando importação": WARN,
    "Coletando": WARN,
    "Última coleta falhou": WARN,
    "Fonte indisponível": FAIL,
}
PROVIDERS = {
    "sgs": "Banco Central do Brasil",
    "ptax": "Banco Central do Brasil",
    "focus": "Banco Central do Brasil",
    "bcfx": "Banco Central do Brasil",
    "ibge": "IBGE",
    "ust": "Tesouro dos EUA",
    "rg": "OCDE e Eurostat",
    "wb": "Banco Mundial",
}
# Uma coleta cuja próxima tentativa passou há mais disso está parada.
OVERDUE = timedelta(hours=6)
# Relatório da B3 importado à mão: depois de 4 dias corridos, pede nova importação.
B3_STALE = timedelta(days=4)


def level(status):
    if status and status.startswith("Falha"):
        return FAIL
    return LEVEL.get(status, WARN)


def last_observed(data, depth=0):
    """Data mais recente dentro do dado coletado (listas [data, valor] ou dicionários delas)."""
    if depth > 4 or data is None:
        return None
    if isinstance(data, list):
        if data and isinstance(data[-1], (list, tuple)) and data[-1] and isinstance(data[-1][0], str):
            return max(str(p[0]) for p in data if p and isinstance(p[0], str))
        found = [last_observed(v, depth + 1) for v in data[-3:]]
    elif isinstance(data, dict):
        if isinstance(data.get("observed"), str):
            return data["observed"]
        if isinstance(data.get("year"), str):
            return data["year"]
        found = [last_observed(v, depth + 1) for v in data.values()]
    else:
        return None
    found = [f for f in found if f]
    return max(found) if found else None


def names(catalog):
    out = {}
    if catalog.get("fluxo"):
        out["bcfx:atuacoes"] = "Atuações do BC no câmbio"
    if catalog.get("focus"):
        out["focus:anuais"] = "Expectativas Focus"
    for s in catalog.get("brasil", []) + catalog.get("fluxo", []) + catalog.get("inflacao", []):
        out[f"sgs:{s['code']}"] = s.get("name") or s["id"]
    for s in catalog.get("ibge", []):
        out[f"ibge:{s['id']}"] = s.get("name") or s["id"]
    for currency in catalog.get("ptax", []):
        out[f"ptax:{currency}"] = f"PTAX {currency}"
    for s in catalog.get("regional", []):
        out[f"rg:{s['id']}"] = s.get("name") or s["id"]
    for s in catalog.get("global", []):
        out[f"wb:{s['code']}"] = s.get("name") or s["code"]
    return out


def item(provider, key, name, status, observed=None, received=None, next_try=None, error=None, url=None, note=None):
    return dict(provider=provider, key=key, name=name, status=status, level=level(status), observed=observed,
                received=received, next=next_try, error=error, url=url, note=note)


def macro_items(store, now):
    label = names(store.catalog)
    out = []
    for key in sorted(label, key=lambda k: (PROVIDERS.get(k.split(":")[0], ""), label[k])):
        prefix = key.split(":")[0]
        meta = store.status(key)
        entry = store.entries.get(key, {})
        status = meta["status"]
        if meta.get("next") and status == "Atualizado" and now - datetime.fromisoformat(meta["next"]) > OVERDUE:
            status = "Atrasado"
        out.append(item(PROVIDERS.get(prefix, prefix), key, label[key], status, last_observed(entry.get("data")),
                        meta.get("received"), meta.get("next"), meta.get("error"), meta.get("url")))
    # Anos da curva do Tesouro aparecem como uma linha por ano.
    for key in sorted(k for k in store.entries if k.startswith("ust:")):
        meta = store.status(key)
        out.append(item("Tesouro dos EUA", key, "Curva de juros " + key[4:], meta["status"],
                        last_observed(store.entries[key].get("data")), meta.get("received"), meta.get("next"),
                        meta.get("error"), meta.get("url")))
    return out


def feed_items(feed):
    snap = feed.read()
    src = snap["source"]
    observed = max((s["observed"] for s in snap["series"].values()), default=None)
    return [item("BCE", "ecb", "Câmbio de referência (" + str(len(snap["series"])) + " moedas)", src.get("status"),
                 observed, src.get("received"), src.get("next"), src.get("error"), snap.get("endpoint"))]


def funds_items(funds):
    months = sorted(funds.months.items())
    if not months:
        return [item("CVM", "cvm:diario", "Fundos: informe diário", "Aguardando coleta")]
    period, last = months[-1]
    errors = [p for p, e in months if e.get("error")]
    status = "Fonte indisponível" if last.get("error") and not last.get("received") else "Dado histórico" if errors else "Atualizado"
    return [item("CVM", "cvm:diario", "Fundos: informe diário (" + str(len(months)) + " meses)", status,
                 None, last.get("received"), None, last.get("error") or (f"{len(errors)} meses com falha" if errors else None),
                 last.get("url"), "Competência mais recente: " + period[:4] + "-" + period[4:])]


def heatmap_items(editions, now):
    body = editions.read()
    if not body:
        return [item("CVM", "cvm:cda", "Heatmaps mensais (carteiras)", "Fonte indisponível")]
    edition = json.loads(body)
    # A CVM publica as carteiras com cerca de 90 dias de defasagem: 130 dias ainda é edição em dia.
    status = "Atualizado" if now.date() - date.fromisoformat(edition["to"]) <= timedelta(days=130) else "Dado histórico"
    return [item("CVM", "cvm:cda", "Heatmaps mensais (carteiras)", status, edition["to"], edition.get("generated"),
                 note="A CVM publica as carteiras com cerca de 90 dias de defasagem")]


def b3_items(b3, now):
    result = b3.read()
    data = result.get("data") or {}
    cut = (data.get("cutoff") or {}).get("volume")
    status = result.get("status")
    note = "Relatório importado à mão em data/b3"
    if cut and now.date() - date.fromisoformat(cut) > B3_STALE:
        status, note = "Atrasado", "Importe o relatório mais recente da B3 em data/b3"
    return [item("B3", "b3", "Pregão: volume e investidores", status, cut, None, None,
                 None if result.get("data") else result.get("status"), result.get("dataset"), note)]


def tesouro_items(store, now):
    result = store.read()
    data = result.get("data") or {}
    observed = data.get("observed")
    status = result["status"]
    note = "Taxas do Tesouro Direto do dia útil anterior"
    if observed and status == "Atualizado" and (now.date() - datetime.fromisoformat(observed).date()) > timedelta(days=5):
        status, note = "Atrasado", "O Tesouro não publica taxas novas há mais de 5 dias"
    return [item("Tesouro Nacional", "td", "Tesouro Direto: juros e inflação implícita", status, observed,
                 result.get("received"), result.get("next"), result.get("error"), result.get("dataset"), note)]


def news_items(store, now):
    data = store.read()
    out = []
    for s in data["sources"]:
        # Notícias complementam os dados: canal fora do ar é atenção, não falha da plataforma.
        if s["error"]:
            status = "Última coleta falhou"
        elif not s["received"]:
            status = "Aguardando coleta"
        elif s["next"] and now - datetime.fromisoformat(s["next"]) > OVERDUE:
            status = "Atrasado"
        else:
            status = "Atualizado"
        out.append(item(s["short"] if s["short"] != "Agência Brasil" else "Agência Brasil (EBC)", "news:" + s["id"],
                        "Ao vivo · " + s["name"], status, (s["latest"] or "")[:10] or None, s["received"], s["next"],
                        s["error"], s["url"], s["note"]))
    return out


def health(server, now=None):
    now = now or datetime.now(UTC)
    items = []
    for store, label, build in [
        ("feed", "BCE", lambda: feed_items(server.feed)),
        ("macro", "Coleta macro", lambda: macro_items(server.macro, now)),
        ("funds", "CVM", lambda: funds_items(server.funds)),
        ("editions", "CVM", lambda: heatmap_items(server.editions, now)),
        ("b3", "B3", lambda: b3_items(server.b3, now)),
        ("tesouro", "Tesouro Nacional", lambda: tesouro_items(server.tesouro, now)),
        ("news", "Ao vivo", lambda: news_items(server.news, now)),
    ]:
        if getattr(server, store, None) is None:
            continue
        try:
            items += build()
        except Exception as error:  # Uma loja com problema não derruba o painel inteiro.
            items.append(item(label, store, "Leitura da fonte", "Fonte indisponível", error=type(error).__name__))
    counts = {k: sum(1 for i in items if i["level"] == k) for k in (OK, WARN, FAIL)}
    overall = FAIL if counts[FAIL] else WARN if counts[WARN] else OK
    return dict(generated=now.isoformat(), overall=overall, counts=counts, items=items)
