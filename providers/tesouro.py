"""Tesouro Direto: taxas diárias dos títulos públicos (Tesouro Transparente, dados abertos).

Com as taxas dos prefixados (LTN e NTN-F) e dos títulos atrelados ao IPCA (NTN-B e NTN-B
Principal) montamos duas curvas: juro nominal e juro real. A diferença entre elas, no
mesmo prazo, é a inflação implícita, o quanto de IPCA o mercado embute nos preços:
(1 + prefixado) / (1 + IPCA+) − 1.

Aproximações, ditas na tela: usamos a taxa média entre compra e venda do Tesouro Direto
(próxima da de mercado, mas não igual); títulos com cupom entram pela própria taxa, sem
separar os fluxos; prazos fora da curva real (antes do primeiro IPCA+) usam a taxa do
vértice mais curto, marcados como estimados. A inflação implícita inclui prêmio de risco.
"""
import csv
import io
from datetime import date, timedelta
from time import sleep
from urllib.error import URLError
from urllib.request import Request, urlopen

URL = ("https://www.tesourotransparente.gov.br/ckan/dataset/df56aa42-484a-4a59-8184-7676580c81e3/"
       "resource/796d2059-14e9-44e3-80c9-2d9e30b405c1/download/PrecoTaxaTesouroDireto.csv")
DATASET = "https://www.tesourotransparente.gov.br/ckan/dataset/taxas-dos-titulos-ofertados-pelo-tesouro-direto"
HOST = "https://www.tesourotransparente.gov.br/"
MAX_BYTES = 40_000_000
KINDS = {
    "Tesouro Prefixado": ("pre", "LTN"),
    "Tesouro Prefixado com Juros Semestrais": ("pre", "NTN-F"),
    "Tesouro IPCA+": ("real", "NTN-B Principal"),
    "Tesouro IPCA+ com Juros Semestrais": ("real", "NTN-B"),
}
HISTORY_DAYS = 2 * 366
EXTRAPOLATE = 1.0  # anos abaixo do primeiro IPCA+ em que usamos a taxa do vértice mais curto
TENORS = {"pre1": ("pre", 1), "pre2": ("pre", 2), "pre5": ("pre", 5), "real5": ("real", 5), "real10": ("real", 10)}


def download(url=URL, attempts=3, wait=5):
    """O servidor do Tesouro Transparente às vezes derruba a conexão: tenta até 3 vezes."""
    if not url.startswith(HOST):
        raise ValueError("Endereço fora da lista autorizada")
    for attempt in range(attempts):
        try:
            return _download(url)
        except (URLError, ConnectionError, TimeoutError):
            if attempt == attempts - 1:
                raise
            sleep(wait * (attempt + 1))


def _download(url):
    request = Request(url, headers={"User-Agent": "ObservatorioEconomico/1.0"})
    with urlopen(request, timeout=120) as response:
        if not response.url.startswith(HOST):
            raise ValueError("Redirecionamento inesperado")
        body = response.read(MAX_BYTES + 1)
    if len(body) > MAX_BYTES:
        raise ValueError("Resposta excede o limite")
    return body


def _rate(text):
    try:
        value = float((text or "").replace(".", "").replace(",", "."))
    except ValueError:
        return None
    return value if value > 0 else None


def _day(text):
    d, m, y = text.split("/")
    return date(int(y), int(m), int(d))


def parse(body, since):
    """{data: [(curva, título, vencimento, taxa média)]} a partir de `since`."""
    text = body.decode("latin-1")
    days = {}
    reader = csv.reader(io.StringIO(text), delimiter=";")
    header = next(reader)
    if header[:5] != ["Tipo Titulo", "Data Vencimento", "Data Base", "Taxa Compra Manha", "Taxa Venda Manha"]:
        raise ValueError("Layout desconhecido")
    for row in reader:
        if len(row) < 5 or row[0] not in KINDS:
            continue
        try:
            base = _day(row[2])
            maturity = _day(row[1])
        except ValueError:
            continue
        if base < since or maturity <= base:
            continue
        buy, sell = _rate(row[3]), _rate(row[4])
        rate = (buy + sell) / 2 if buy and sell else buy or sell
        if rate is None:
            continue
        curve, code = KINDS[row[0]]
        days.setdefault(base, []).append((curve, row[0], code, maturity, rate))
    if not days:
        raise ValueError("Arquivo sem taxas")
    return days


def years(base, maturity):
    return (maturity - base).days / 365.25


def curve(rows, kind, base):
    """Vértices (anos, taxa), com a média quando dois títulos vencem no mesmo dia."""
    by = {}
    for c, _name, _code, maturity, rate in rows:
        if c == kind:
            by.setdefault(maturity, []).append(rate)
    return [(years(base, m), sum(v) / len(v), m) for m, v in sorted(by.items())]


def interp(points, t, extrapolate=0.0):
    """Taxa no prazo `t` por interpolação linear; (taxa, estimada) ou (None, False)."""
    if not points or t > points[-1][0]:
        return None, False
    if t < points[0][0]:
        return (points[0][1], True) if points[0][0] - t <= extrapolate else (None, False)
    for (t0, r0, _), (t1, r1, _) in zip(points, points[1:]):
        if t0 <= t <= t1:
            return (r0 + (r1 - r0) * (t - t0) / (t1 - t0) if t1 > t0 else r0), False
    return points[-1][1], False


def breakeven(pre, real):
    return ((1 + pre / 100) / (1 + real / 100) - 1) * 100


def _r(v, places=2):
    return None if v is None else round(v, places)


def summarize(days, today):
    dates = sorted(days)
    last = dates[-1]

    def near(target):
        earlier = [d for d in dates if d <= target]
        return earlier[-1] if earlier else None

    month_ago, year_ago = near(last - timedelta(days=30)), near(last - timedelta(days=365))

    def point(d):
        pre, real = curve(days[d], "pre", d), curve(days[d], "real", d)
        out = {}
        for key, (kind, tenor) in TENORS.items():
            out[key] = _r(interp(pre if kind == "pre" else real, tenor)[0])
        for tenor in (3, 5, 10):
            p = interp(pre, tenor)[0]
            r = interp(real, tenor, EXTRAPOLATE)[0]
            out[f"be{tenor}"] = _r(breakeven(p, r)) if p is not None and r is not None else None
        return out

    history = []
    for d in dates:
        if (last - d).days <= HISTORY_DAYS:
            history.append(dict(date=d.isoformat(), **point(d)))
    now = point(last)
    changes = {k: {"month": _r(v - point(month_ago)[k]) if month_ago and v is not None and point(month_ago)[k] is not None else None,
                   "year": _r(v - point(year_ago)[k]) if year_ago and v is not None and point(year_ago)[k] is not None else None}
               for k, v in now.items()}

    pre, real = curve(days[last], "pre", last), curve(days[last], "real", last)
    # Inflação implícita até cada vencimento prefixado.
    implied = []
    for t, rate, maturity in pre:
        r, estimated = interp(real, t, EXTRAPOLATE)
        if r is not None:
            implied.append(dict(maturity=maturity.isoformat(), years=_r(t), pre=_r(rate), real=_r(r),
                                implied=_r(breakeven(rate, r)), estimated=estimated))
    before = {(name, m): rate for _c, name, _code, m, rate in days.get(month_ago, [])} if month_ago else {}
    titles = [dict(name=name, code=code, curve=c, maturity=m.isoformat(), years=_r(years(last, m)), rate=_r(rate),
                   month=_r(rate - before[(name, m)]) if (name, m) in before else None)
              for c, name, code, m, rate in sorted(days[last], key=lambda r: (r[0], r[3], r[2]))]
    return dict(observed=last.isoformat(), month_ago=month_ago.isoformat() if month_ago else None,
                year_ago=year_ago.isoformat() if year_ago else None, now=now, changes=changes,
                curves={"pre": [dict(maturity=m.isoformat(), years=_r(t), rate=_r(r)) for t, r, m in pre],
                        "real": [dict(maturity=m.isoformat(), years=_r(t), rate=_r(r)) for t, r, m in real]},
                implied=implied, titles=titles, history=history)
