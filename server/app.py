"""Servidor de leitura, vinculado exclusivamente ao loopback."""
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlsplit
import argparse
import json
import mimetypes

from server.service import Feed

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
            body = json.dumps(dict(markets=MARKETS, **self.server.feed.read()), allow_nan=False).encode()
            mime = "application/json"
        elif path in {"/", "/index.html", "/app.css", "/app.js", "/map.js", "/world.json", "/mark.svg", "/dmsans.ttf"}:
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
