import sys
import unittest

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


if __name__ == "__main__":
    unittest.main()
