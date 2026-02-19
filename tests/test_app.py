import os
import tempfile
import unittest
import uuid


TEST_DB_PATH = os.path.join(tempfile.gettempdir(), f"smartgomi_test_{uuid.uuid4().hex}.db")
os.environ["DB_PATH"] = TEST_DB_PATH
os.environ["DEFAULT_ADMIN_USERNAME"] = "admin"
os.environ["DEFAULT_ADMIN_PASSWORD"] = "admin1234"

import app as smart_app  # noqa: E402


class SmartGomiAppTest(unittest.TestCase):
    @classmethod
    def tearDownClass(cls):
        if os.path.exists(TEST_DB_PATH):
            os.remove(TEST_DB_PATH)

    def setUp(self):
        self.client = smart_app.app.test_client()

    def login(self):
        return self.client.post(
            "/admin/login",
            data={"username": "admin", "password": "admin1234"},
            follow_redirects=False,
        )

    def test_health(self):
        response = self.client.get("/health")
        self.assertEqual(response.status_code, 200)
        body = response.get_json()
        self.assertTrue(body["ok"])

    def test_device_auth_required(self):
        response = self.client.post("/device/heartbeat", json={"request_id": "hb-no-key"})
        self.assertEqual(response.status_code, 401)

    def test_admin_login(self):
        response = self.login()
        self.assertEqual(response.status_code, 302)
        self.assertIn("/admin/dashboard", response.headers["Location"])

    def test_unlock_flow_with_idempotency(self):
        with smart_app.app.app_context():
            db = smart_app.get_db()
            campaign = db.execute("SELECT token, device_id FROM campaigns ORDER BY id ASC LIMIT 1").fetchone()
            device = db.execute("SELECT api_key FROM devices WHERE id = ?", (campaign["device_id"],)).fetchone()
            token = campaign["token"]
            api_key = device["api_key"]

        hb_resp = self.client.post(
            "/device/heartbeat",
            headers={"X-Device-Key": api_key},
            json={"request_id": "hb-1", "online": True},
        )
        self.assertEqual(hb_resp.status_code, 200)

        lp_resp = self.client.get(f"/q/{token}")
        self.assertEqual(lp_resp.status_code, 200)

        unlock_payload = {"request_id": "unlock-1", "open_seconds": 6}
        first_unlock = self.client.post(f"/q/{token}/unlock", json=unlock_payload)
        second_unlock = self.client.post(f"/q/{token}/unlock", json=unlock_payload)
        self.assertEqual(first_unlock.status_code, second_unlock.status_code)
        self.assertEqual(first_unlock.get_json(), second_unlock.get_json())

        hb_poll = self.client.post(
            "/device/heartbeat",
            headers={"X-Device-Key": api_key},
            json={"request_id": "hb-2", "online": True},
        )
        self.assertEqual(hb_poll.status_code, 200)
        commands = hb_poll.get_json()["pending_commands"]
        self.assertTrue(any(c["request_id"] == "unlock-1" for c in commands))

        result_resp = self.client.post(
            "/device/unlock_result",
            headers={"X-Device-Key": api_key},
            json={
                "request_id": "unlock-result-1",
                "command_request_id": "unlock-1",
                "success": True,
                "open_seconds": 6,
            },
        )
        self.assertEqual(result_resp.status_code, 200)
        self.assertEqual(result_resp.get_json()["status"], "success")

        with smart_app.app.app_context():
            db = smart_app.get_db()
            success_count = db.execute(
                "SELECT COUNT(*) AS cnt FROM event_logs WHERE event_type = 'unlock_success'"
            ).fetchone()["cnt"]
            self.assertGreaterEqual(success_count, 1)

    def test_invalid_command_id_does_not_crash(self):
        with smart_app.app.app_context():
            db = smart_app.get_db()
            device = db.execute("SELECT api_key FROM devices ORDER BY id ASC LIMIT 1").fetchone()
            api_key = device["api_key"]

        response = self.client.post(
            "/device/unlock_result",
            headers={"X-Device-Key": api_key},
            json={"request_id": "bad-command-id", "command_id": "abc", "success": False},
        )
        self.assertEqual(response.status_code, 400)
        body = response.get_json()
        self.assertEqual(body["error"], "invalid_command_id")

    def test_invalid_logs_filter_does_not_500(self):
        login_response = self.login()
        self.assertEqual(login_response.status_code, 302)
        response = self.client.get("/admin/logs?device_id=abc", follow_redirects=False)
        self.assertEqual(response.status_code, 302)


if __name__ == "__main__":
    unittest.main()
