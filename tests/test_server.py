import gzip
import sys
import unittest
from http.client import HTTPConnection
from threading import Thread

from server.app import Handler, Server


class ServerBindTest(unittest.TestCase):
    @unittest.skipUnless(sys.platform == "win32", "Comportamento específico do Windows")
    def test_second_instance_on_same_port_fails(self):
        # No Windows, SO_REUSEADDR deixaria duas instâncias escutando a mesma porta.
        first = Server(("127.0.0.1", 0), Handler)
        try:
            with self.assertRaises(OSError):
                Server(("127.0.0.1", first.server_port), Handler)
        finally:
            first.server_close()


class StaticFiles(unittest.TestCase):
    def setUp(self):
        self.server = Server(("127.0.0.1", 0), Handler)
        Thread(target=self.server.serve_forever, daemon=True).start()

    def tearDown(self):
        self.server.shutdown()
        self.server.server_close()

    def get(self, path, **headers):
        conn = HTTPConnection("127.0.0.1", self.server.server_port, timeout=5)
        conn.request("GET", path, headers=headers)
        response = conn.getresponse()
        body = response.read()
        conn.close()
        return response, body

    def test_detects_running_observatory(self):
        # O atalho de dois cliques reconhece a plataforma já aberta e só abre o navegador.
        import socket
        from server.app import observatory_running
        self.assertTrue(observatory_running(self.server.server_port))
        with socket.socket() as free:
            free.bind(("127.0.0.1", 0))
            unused = free.getsockname()[1]
        self.assertFalse(observatory_running(unused, timeout=0.5))

    def test_host_header_and_public_port(self):
        port = self.server.server_port
        self.assertEqual(self.get("/app.js")[0].status, 200)
        self.assertEqual(self.get("/app.js", Host="evil.example:%d" % port)[0].status, 403)
        # Container: o navegador usa a porta publicada, diferente da interna.
        self.server.public_port = 9000
        self.assertEqual(self.get("/app.js", Host="localhost:9000")[0].status, 200)
        self.assertEqual(self.get("/app.js", Host="127.0.0.1:%d" % port)[0].status, 403)
        self.assertEqual(self.get("/app.js", Host="evil.example:9000")[0].status, 403)

    def test_gzip_etag_and_revalidation(self):
        plain, raw = self.get("/app.js")
        self.assertEqual(plain.status, 200)
        self.assertIsNone(plain.getheader("Content-Encoding"))
        packed, body = self.get("/app.js", **{"Accept-Encoding": "gzip"})
        self.assertEqual(packed.getheader("Content-Encoding"), "gzip")
        self.assertEqual(gzip.decompress(body), raw)
        self.assertLess(len(body), len(raw))
        etag = packed.getheader("ETag")
        again, empty = self.get("/app.js", **{"If-None-Match": etag})
        self.assertEqual((again.status, empty), (304, b""))

    def test_professional_profile_blocks_external_frames_and_b3_contents(self):
        from server.b3 import RestrictedB3
        self.server.profile = "profissional"
        self.server.b3 = RestrictedB3()
        for path in ["/", "/index.html"]:
            response, body = self.get(path)
            self.assertIn(b'data-profile="profissional"', body)
            self.assertIn("frame-src 'none'", response.getheader("Content-Security-Policy"))
            self.assertNotIn("tradingview.com", response.getheader("Content-Security-Policy"))
        import json
        data = json.loads(self.get("/api/b3")[1])
        self.assertTrue(data["restricted"])
        self.assertIsNone(data["data"])

    def test_invalid_monthly_links(self):
        for query in ["competencia=", "competencia=2026-13", "rev=x", "competencia=2026-10&rev=bad"]:
            self.assertEqual(self.get("/api/heatmaps?" + query)[0].status, 400)

    def test_new_file_is_served_without_restart(self):
        from server.app import WEB
        new = WEB / "zz-teste-novo.js"
        try:
            new.write_text("export const x = 1;", encoding="utf8")
            self.assertEqual(self.get("/zz-teste-novo.js")[0].status, 200)
        finally:
            new.unlink()

    def test_every_web_file_is_served_and_nothing_else(self):
        self.assertEqual(self.get("/pregao.js")[0].status, 200)
        self.assertEqual(self.get("/data.js")[0].status, 200)
        self.assertEqual(self.get("/og.png")[0].getheader("Content-Type"), "image/png")
        self.assertEqual(self.get("/")[0].status, 200)
        for path in ["/../server/app.py", "/..%5Cserver%5Capp.py", "/nao-existe.js", "/README.md", "/web/app.js", "/.git", "/app.js.bak"]:
            self.assertEqual(self.get(path)[0].status, 404, path)


if __name__ == "__main__":
    unittest.main()
