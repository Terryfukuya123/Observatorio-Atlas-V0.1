"""Servidor de leitura, vinculado exclusivamente ao loopback."""
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlsplit
import argparse
import gzip
import hashlib
import json
import mimetypes
import re
import sys

from server.service import Feed
from server.editions import MonthlyEdition
from server.macro import MacroStore
from server.funds import FundFlows
from server.b3 import B3Store
from server.news import NewsStore
from server.tesouro import TesouroStore
from server.health import health
from core.fx import compare_rates, in_base, usd_cross
from providers.ecb import CURRENCIES

ROOT = Path(__file__).resolve().parents[1]
WEB = ROOT / "web"
STATIC_TYPES = {".html", ".css", ".js", ".json", ".svg", ".ttf", ".png"}
STATIC_NAME = re.compile(r"/[A-Za-z0-9][A-Za-z0-9_-]*(\.[A-Za-z0-9]+)+")


def is_static(path):
    """Arquivo direto em web/, com nome simples (sem pastas, '..' ou barras invertidas)."""
    return bool(STATIC_NAME.fullmatch(path)) and Path(path).suffix in STATIC_TYPES and (WEB / path[1:]).is_file()
COMPRESSIBLE = ("text/", "application/json", "application/javascript", "image/svg+xml")
_static_cache = {}


def static_file(file):
    """Bytes, ETag e versão gzip de um arquivo estático, guardados até o arquivo mudar."""
    stamp = file.stat().st_mtime_ns
    hit = _static_cache.get(file)
    if hit and hit[0] == stamp:
        return hit[1]
    body = file.read_bytes()
    entry = (body, '"' + hashlib.sha1(body).hexdigest()[:20] + '"', gzip.compress(body, 6))
    _static_cache[file] = (stamp, entry)
    return entry


MARKETS = json.loads((ROOT / "config/markets.json").read_text(encoding="utf8"))


class Handler(BaseHTTPRequestHandler):
    def log_request(self, code='-', size='-'):
        pass

    def do_GET(self):
        host = self.headers.get("Host", "")
        if host not in {f"127.0.0.1:{self.server.server_port}", f"localhost:{self.server.server_port}"}:
            self.send_error(403)
            return
        path = urlsplit(self.path).path
        params = parse_qs(urlsplit(self.path).query)
        base = params.get("base", ["USD"])[0]
        if path in {"/api/atlas", "/api/comparacao"} and base not in {"USD", "EUR"}:
            self.send_error(400, "Base invalida")
            return
        if path == "/api/atlas":
            snapshot = self.server.feed.read()
            series = snapshot["series"]
            crosses = {}
            for market in MARKETS.values():
                currency = market["currency"]
                local = series.get(market["series"])
                if local and currency not in crosses:
                    cross = usd_cross(local, series.get("USD"), currency)
                    if cross:
                        crosses[currency] = cross
            markets = {key: dict(m, series=(("EUR" if m["currency"] == "USD" else m["currency"])
                                           if base == "USD" else m["series"]))
                       for key, m in MARKETS.items()}
            body = json.dumps(dict(markets=markets, usd_crosses=crosses, **in_base(snapshot, base)),
                              allow_nan=False).encode()
            mime = "application/json"
        elif path == "/api/comparacao":
            first, second, period = (params.get(k, [""])[0] for k in ("a", "b", "dias"))
            allowed = (CURRENCIES | {"EUR"}) - {base}
            if first not in allowed or second not in allowed or period not in {"7", "30", "90"}:
                self.send_error(400, "Parametros invalidos")
                return
            result = compare_rates(in_base(self.server.feed.read(), base), first, second, int(period))
            body = json.dumps(result, allow_nan=False).encode()
            mime = "application/json"
        elif path in {"/api/macro", "/api/macro/indicador", "/api/macro/pais", "/api/macro/focus", "/api/macro/curva", "/api/macro/regional"}:
            store = self.server.macro
            if path == "/api/macro":
                result = store.overview()
            elif path == "/api/macro/regional":
                result = store.regional(params.get("id", [""])[0])
            elif path == "/api/macro/curva":
                result = store.curve_detail()
            elif path == "/api/macro/focus":
                result = store.focus_detail()
            elif path == "/api/macro/indicador":
                result = store.indicator(params.get("id", [""])[0])
            else:
                result = store.country(params.get("iso", [""])[0].upper())
            if result is None:
                self.send_error(400, "Parametros invalidos")
                return
            body = json.dumps(result, ensure_ascii=False, allow_nan=False).encode()
            mime = "application/json"
        elif path == "/api/fundos":
            body = json.dumps(self.server.funds.read(), ensure_ascii=False, allow_nan=False).encode()
            mime = "application/json"
        elif path == "/api/saude":
            body = json.dumps(health(self.server), ensure_ascii=False, allow_nan=False).encode()
            mime = "application/json"
        elif path == "/api/b3":
            body = json.dumps(self.server.b3.read(), ensure_ascii=False, allow_nan=False).encode()
            mime = "application/json"
        elif path == "/api/tesouro":
            body = json.dumps(self.server.tesouro.read(), ensure_ascii=False, allow_nan=False).encode()
            mime = "application/json"
        elif path == "/api/noticias":
            body = json.dumps(self.server.news.read(), ensure_ascii=False, allow_nan=False).encode()
            mime = "application/json"
        elif path == "/api/inflacao":
            body = json.dumps(self.server.macro.inflation(), ensure_ascii=False, allow_nan=False).encode()
            mime = "application/json"
        elif path == "/api/surpresas":
            body = json.dumps(self.server.macro.surprises(), ensure_ascii=False, allow_nan=False).encode()
            mime = "application/json"
        elif path == "/api/fluxo":
            self.server.macro.refresh_if_due()
            body = json.dumps(self.server.macro.flows(), ensure_ascii=False, allow_nan=False).encode()
            mime = "application/json"
        elif path == "/api/heatmaps":
            body = self.server.editions.read()
            if body is None:
                self.send_error(503, "Edicao mensal indisponivel")
                return
            mime = "application/json"
        elif path == "/" or is_static(path):
            file = WEB / ("index.html" if path == "/" else path[1:])
            if not file.is_file():
                self.send_error(404)
                return
            body, etag, packed = static_file(file)
            mime = mimetypes.guess_type(file)[0] or "application/octet-stream"
        else:
            self.send_error(404)
            return
        if path.startswith("/api/"):
            etag = '"' + hashlib.sha1(body).hexdigest()[:20] + '"'
            packed = None
        if etag in {tag.strip() for tag in self.headers.get("If-None-Match", "").split(",")}:
            self.send_response(304)
            self.send_header("ETag", etag)
            self.send_header("Cache-Control", "no-cache")
            self.end_headers()
            return
        if "gzip" in self.headers.get("Accept-Encoding", "") and len(body) > 1024 and mime.startswith(COMPRESSIBLE):
            body = packed or gzip.compress(body, 5)
            encoded = True
        else:
            encoded = False
        self.send_response(200)
        self.send_header("Content-Type", mime)
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-cache")
        self.send_header("ETag", etag)
        self.send_header("Vary", "Accept-Encoding")
        if encoded:
            self.send_header("Content-Encoding", "gzip")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("Referrer-Policy", "no-referrer")
        self.send_header("Content-Security-Policy", "default-src 'self'; style-src 'self' 'sha256-JyHF32z4Ou/Ujas95CX3WgBqlTt7Dxzo/fQG5/5oBo8='; script-src 'self' https://s3.tradingview.com; "
                         "frame-src https://www.tradingview-widget.com https://s.tradingview.com; object-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'")
        self.end_headers()
        try:
            self.wfile.write(body)
        except (BrokenPipeError, ConnectionResetError, ConnectionAbortedError):
            pass


class Server(ThreadingHTTPServer):
    request_queue_size = 64  # Módulos e painéis abrem conexões em paralelo na primeira visita.
    # No Windows, SO_REUSEADDR permite que um segundo processo escute na mesma porta e
    # receba parte das requisições. Sem ele, a segunda instância falha ao iniciar.
    allow_reuse_address = sys.platform != "win32"


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--port", type=int, default=8842)
    args = parser.parse_args()
    try:
        server = Server(("127.0.0.1", args.port), Handler)
    except OSError:
        sys.exit(f"Porta {args.port} já está em uso. Encerre a outra instância (scripts/stop.ps1) antes de iniciar.")
    with server:
        server.feed = Feed(ROOT / "data/cache/ecb.json")
        server.editions = MonthlyEdition(ROOT, server.feed)
        server.macro = MacroStore(ROOT)
        server.funds = FundFlows(ROOT)
        server.b3 = B3Store(ROOT)
        server.news = NewsStore(ROOT)
        server.tesouro = TesouroStore(ROOT)
        print(f"Observatório em http://127.0.0.1:{server.server_port}", flush=True)
        try:
            server.serve_forever()
        except KeyboardInterrupt:
            pass
