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


def unit_marks(archive, period, end):
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


def build_tiles(first, last, fx_first, fx_last):
    result = {}
    for group, catalog in CATALOG.items():
        tiles = []
        for symbol, name in catalog.items():
            key = group, symbol
            left, right = first.get(key, {}), last.get(key, {})
            common = sorted(left.keys() & right.keys())
            item = dict(symbol=symbol, name=name, funds=len(common), quotes={})
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
