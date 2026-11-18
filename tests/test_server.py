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

    def test_every_web_file_is_served_and_nothing_else(self):
        self.assertEqual(self.get("/pregao.js")[0].status, 200)
        self.assertEqual(self.get("/data.js")[0].status, 200)
        self.assertEqual(self.get("/")[0].status, 200)
        for path in ["/../server/app.py", "/nao-existe.js", "/README.md", "/web/app.js"]:
            self.assertEqual(self.get(path)[0].status, 404, path)


if __name__ == "__main__":
    unittest.main()
