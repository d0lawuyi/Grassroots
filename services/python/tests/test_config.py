import base64
import json
import unittest

from grassroots_tools.config import key_role


def fake_jwt(role):
    body = base64.urlsafe_b64encode(json.dumps({"role": role}).encode()).decode().rstrip("=")
    return f"eyJhbGciOiJIUzI1NiJ9.{body}.signature"


class KeyRoleTest(unittest.TestCase):
    def test_new_style_keys(self):
        self.assertEqual(key_role("sb_publishable_abc"), "anon")
        self.assertEqual(key_role("sb_secret_abc"), "service_role")

    def test_old_style_jwt_keys(self):
        self.assertEqual(key_role(fake_jwt("anon")), "anon")
        self.assertEqual(key_role(fake_jwt("service_role")), "service_role")

    def test_unknown(self):
        self.assertIsNone(key_role("not-a-key"))


if __name__ == "__main__":
    unittest.main()
