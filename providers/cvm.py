"""Marcação mensal por unidade nas declarações públicas dos fundos à CVM."""
from collections import defaultdict
from csv import DictReader
from datetime import date, timedelta
from decimal import Decimal
from io import TextIOWrapper
from statistics import median
from zipfile import ZipFile

from core.calendar import is_target_day

CATALOG = {
    "br": {"PETR4": "Petrobras PN", "VALE3": "Vale", "ITUB4": "Itaú Unibanco PN",
           "BBDC4": "Bradesco PN", "ABEV3": "Ambev", "WEGE3": "WEG",
           "BBAS3": "Banco do Brasil", "RENT3": "Localiza", "SUZB3": "Suzano"},
    "us": {"MSFT": "Microsoft", "AMZN": "Amazon", "V": "Visa", "MA": "Mastercard",
           "AMAT": "Applied Materials", "GOOGL": "Alphabet A", "NVDA": "Nvidia",
           "NFLX": "Netflix", "META": "Meta Platforms"},
    "crypto": {"BTC": "Bitcoin", "ETH": "Ether", "BNB": "BNB",
               "USDT": "Tether", "USDC": "USD Coin", "RLUSD": "Ripple USD"},
}
# Identificações literais de tokens em informes, excluindo ETFs e derivativos.
TOKENS = {"BTC - Bitcoin USD": "BTC", "ETH - Ethereum USD": "ETH",
          "BNB BINANCE": "BNB", "USD Tether - Token": "USDT",
          "USDC - Token": "USDC", "RLUSD": "RLUSD"}
US_VENUES = {"NASDAQ STOCK MARKET", "NYSE EURONEXT"}


def identify(row, block):
    if block == 4:
        symbol = row["CD_ATIVO"].strip()
        if row["TP_APLIC"] == "Ações" and symbol in CATALOG["br"]:
            return "br", symbol
        return None
    if row["TP_ATIVO"] == "Outros" and row["EMISSOR"] in TOKENS:
        return "crypto", TOKENS[row["EMISSOR"]]
    symbol = row["CD_ATIVO_BV_MERC"].strip().removesuffix(" US")
    if (row["TP_ATIVO"] == "Ação ordinária" and row["BV_MERC"] in US_VENUES
            and row["PAIS"] == "ESTADOS UNIDOS DA AMÉRICA" and symbol in CATALOG["us"]):
        return "us", symbol


SECTORS = {
    "Financeiro": ("ITUB4", "BBDC4", "BBAS3", "V", "MA"),
    "Materiais básicos": ("VALE3", "SUZB3"), "Energia": ("PETR4",),
    "Consumo básico": ("ABEV3",), "Indústria": ("WEGE3",),
    "Consumo cíclico": ("RENT3", "AMZN"),
    "Tecnologia": ("MSFT", "NVDA", "AMAT"),
    "Comunicações": ("META", "NFLX", "GOOGL"),
    "Redes e protocolos": ("BTC", "ETH", "BNB"),
    "Stablecoins": ("USDT", "USDC", "RLUSD"),
}
SECTOR_BY_SYMBOL = {ticker: sector for sector, tickers in SECTORS.items() for ticker in tickers}


def unit_marks(archive, period, end, weights=None):
    positions = defaultdict(lambda: defaultdict(lambda: [Decimal(0), Decimal(0)]))
    with ZipFile(archive) as z:
        for block in (4, 7):
            member = z.getinfo(f"cda_fi_BLC_{block}_{period}.csv")
            if member.file_size > 350_000_000:
                raise ValueError("Arquivo mensal excede o limite de leitura")
            with TextIOWrapper(z.open(member), encoding="latin1") as stream:
                for row in DictReader(stream, delimiter=";"):
                    if row["DT_COMPTC"] != end.isoformat():
                        continue
                    asset = identify(row, block)
                    if asset is None or not row["CNPJ_FUNDO_CLASSE"]:
                        continue
                    qty = Decimal(row["QT_POS_FINAL"] or "0")
                    value = Decimal(row["VL_MERC_POS_FINAL"] or "0")
                    if weights is not None:
                        item = weights.setdefault(asset, {"position": Decimal(0), "volume": Decimal(0),
                                                         "complete": True})
                        item["position"] += max(Decimal(0), value)
                        trades = [row["VL_AQUIS_NEGOC"], row["VL_VENDA_NEGOC"]]
                        if all(x.strip() and Decimal(x) >= 0 for x in trades):
                            item["volume"] += sum(map(Decimal, trades))
                        else:
                            item["complete"] = False
                    if qty > 0 and value > 0:
                        pair = positions[asset][row["CNPJ_FUNDO_CLASSE"]]
                        pair[0] += qty
                        pair[1] += value
    return {asset: {fund: value / qty for fund, (qty, value) in funds.items()
                    if value >= 100} for asset, funds in positions.items()}


def fx_at(series, end):
    day = end
    while not is_target_day(day):
        day -= timedelta(days=1)
    key = day.isoformat()
    brl, usd = (dict(series[c]["history"]) for c in ("BRL", "USD"))
    if key not in brl or key not in usd:
        raise ValueError(f"Sem referência BCE do fechamento de {key}")
    return {"observed": key, "EUR": brl[key], "USD": str(Decimal(brl[key]) / Decimal(usd[key]))}


def build_tiles(first, last, fx_first, fx_last, weights=None):
    result = {}
    for group, catalog in CATALOG.items():
        tiles = []
        for symbol, name in catalog.items():
            key = group, symbol
            left, right = first.get(key, {}), last.get(key, {})
            common = sorted(left.keys() & right.keys())
            item = dict(symbol=symbol, name=name, funds=len(common), quotes={})
            weight = (weights or {}).get(key)
            item["sector"] = SECTOR_BY_SYMBOL[symbol]
            item["position"] = float(weight["position"]) if weight else None
            item["volume"] = float(weight["volume"]) if weight and weight["complete"] else None
            if common:
                for base in ("USD", "EUR"):
                    start_fx, end_fx = Decimal(fx_first[base]), Decimal(fx_last[base])
                    moves = [100 * (right[f] * start_fx / (left[f] * end_fx) - 1)
                             for f in common]
                    item["quotes"][base] = {
                        "value": float(median(right[f] / end_fx for f in common)),
                        "percent": float(median(moves)),
                    }
            tiles.append(item)
        result[group] = tiles
    return result
