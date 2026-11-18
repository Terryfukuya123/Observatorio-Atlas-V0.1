"""Indicadores derivados exclusivamente das referências EUR do mesmo arquivo BCE."""
from datetime import date, timedelta
from decimal import Decimal

from core.indicators import price_return


def usd_cross(local, dollar, currency):
    if not dollar or local["observed"] != dollar["observed"] or currency == "USD":
        return None
    # Na zona do euro, 1 EUR por EUR é a identidade da moeda-base.
    numerator = Decimal(1) if currency == "EUR" else Decimal(local["value"])
    rate = numerator / Decimal(dollar["value"])
    return {"instrument": f"USD/{currency}", "value": format(rate, ".5f"),
            "unit": f"{currency} por USD", "observed": dollar["observed"],
            "received": dollar["received"], "status": dollar["status"],
            "inputs": [dollar["instrument"]] if currency == "EUR" else
                      [local["instrument"], dollar["instrument"]]}


def compare_rates(snapshot, first, second, days):
    """Rebaseia duas séries na primeira observação comum dentro da janela solicitada."""
    source = snapshot["source"]
    result = {"pairs": [f"EUR/{first}", f"EUR/{second}"], "days": days, "points": [],
              "status": source["status"], "received": source.get("received"),
              "snapshot": source.get("snapshot"), "source": "BCE"}
    if first == second:
        return dict(result, message="Selecione dois pares distintos.")
    left = snapshot["series"].get(first)
    right = snapshot["series"].get(second)
    if not left or not right:
        return dict(result, message="Uma das séries está sem observações disponíveis.")
    # A janela termina na última data do par mais recente: uma série velha não desloca ambas ao passado.
    end = max(left["observed"], right["observed"])
    start = date.fromisoformat(end) - timedelta(days=days - 1)
    a, b = dict(left["history"]), dict(right["history"])
    common = sorted(d for d in a.keys() & b.keys() if start.isoformat() <= d <= end)
    if len(common) < 2:
        return dict(result, message="Menos de duas observações comuns no período.")
    base = common[0]
    def rebased(value, initial):
        return float(100 * (1 + price_return(initial, value)))
    result["points"] = [[d, rebased(a[d], a[base]), rebased(b[d], b[base])] for d in common]
    result["changes"] = [float(100 * price_return(s[base], s[common[-1]])) for s in (a,b)]
    result["from"], result["to"] = base, common[-1]
    result["status"] = ("Dado histórico" if source.get("error") else
                        "Atrasado" if common[-1] < snapshot["expected"] else "Atualizado")
    return result
