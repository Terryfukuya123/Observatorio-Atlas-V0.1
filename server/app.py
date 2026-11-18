"""Servidor de leitura, vinculado exclusivamente ao loopback."""
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlsplit
import argparse
import json
import mimetypes

from server.service import Feed
from core.fx import compare_rates, usd_cross
from providers.ecb import CURRENCIES

ROOT = Path(__file__).resolve().parents[1]
WEB = ROOT / "web"
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
            body = json.dumps(dict(markets=MARKETS, usd_crosses=crosses, **snapshot), allow_nan=False).encode()
            mime = "application/json"
        elif path == "/api/comparacao":
            params = parse_qs(urlsplit(self.path).query)
            first, second, period = (params.get(k, [""])[0] for k in ("a", "b", "dias"))
            if first not in CURRENCIES or second not in CURRENCIES or period not in {"7", "30", "90"}:
                self.send_error(400, "Parametros invalidos")
                return
            result = compare_rates(self.server.feed.read(), first, second, int(period))
            body = json.dumps(result, allow_nan=False).encode()
            mime = "application/json"
        elif path in {"/", "/index.html", "/app.css", "/app.js", "/map.js", "/comparison.js", "/world.json", "/mark.svg", "/dmsans.ttf"}:
            file = WEB / ("index.html" if path == "/" else path[1:])
            if not file.is_file():
                self.send_error(404)
                return
            body = file.read_bytes()
            mime = mimetypes.guess_type(file)[0] or "application/octet-stream"
        else:
            self.send_error(404)
            return
        self.send_response(200)
        self.send_header("Content-Type", mime)
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store" if path.startswith("/api") else "no-cache")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("Referrer-Policy", "no-referrer")
        self.send_header("Content-Security-Policy", "default-src 'self'; style-src 'self'; object-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'")
        self.end_headers()
        try:
            self.wfile.write(body)
        except (BrokenPipeError, ConnectionResetError, ConnectionAbortedError):
            pass


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--port", type=int, default=8842)
    args = parser.parse_args()
    with ThreadingHTTPServer(("127.0.0.1", args.port), Handler) as server:
        server.feed = Feed(ROOT / "data/cache/ecb.json")
        print(f"Observatório em http://127.0.0.1:{server.server_port}", flush=True)
        try:
            server.serve_forever()
        except KeyboardInterrupt:
            pass
