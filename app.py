import csv
import hashlib
import json
import os
import secrets
import sqlite3
import uuid
from datetime import datetime, timedelta, timezone
from functools import wraps
from io import StringIO

from flask import (
    Flask,
    Response,
    flash,
    g,
    jsonify,
    redirect,
    render_template,
    request,
    session,
    url_for,
)


DEFAULT_OFFLINE_THRESHOLD_SECONDS = int(os.getenv("OFFLINE_THRESHOLD_MINUTES", "10")) * 60
DEFAULT_ALERT_THRESHOLD_SECONDS = int(os.getenv("ALERT_THRESHOLD_MINUTES", "30")) * 60
DEFAULT_HEARTBEAT_EXPECTED_SECONDS = int(os.getenv("HEARTBEAT_EXPECTED_SECONDS", "60"))
DEFAULT_HEARTBEAT_GRACE_SECONDS = int(os.getenv("HEARTBEAT_GRACE_SECONDS", "120"))
MIN_UNLOCK_SECONDS = 3
MAX_UNLOCK_SECONDS = 10
DEFAULT_UNLOCK_SECONDS = 6
DEFAULT_UNLOCK_COOLDOWN_SECONDS = 20


app = Flask(__name__)
app.config["SECRET_KEY"] = os.getenv("FLASK_SECRET_KEY", "dev-only-change-me")
app.config["DATABASE"] = os.getenv("DB_PATH", os.path.join(app.root_path, "smartgomi.db"))
app.config["DEFAULT_ADMIN_USERNAME"] = os.getenv("DEFAULT_ADMIN_USERNAME", "admin")
app.config["DEFAULT_ADMIN_PASSWORD"] = os.getenv("DEFAULT_ADMIN_PASSWORD", "admin1234")


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


def to_iso(dt: datetime) -> str:
    return dt.astimezone(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def from_iso(raw: str | None) -> datetime | None:
    if not raw:
        return None
    normalized = raw.replace("Z", "+00:00")
    return datetime.fromisoformat(normalized)


def clamp_open_seconds(value) -> int:
    try:
        parsed = int(value)
    except (TypeError, ValueError):
        return DEFAULT_UNLOCK_SECONDS
    return max(MIN_UNLOCK_SECONDS, min(MAX_UNLOCK_SECONDS, parsed))


def clamp_integer(value, *, default: int, min_value: int, max_value: int) -> int:
    try:
        parsed = int(value)
    except (TypeError, ValueError):
        return default
    return max(min_value, min(max_value, parsed))


def hash_password(password: str) -> str:
    salt = secrets.token_hex(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt.encode("utf-8"), 260000).hex()
    return f"{salt}${digest}"


def verify_password(password: str, hashed: str) -> bool:
    try:
        salt, digest = hashed.split("$", 1)
    except ValueError:
        return False
    candidate = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt.encode("utf-8"), 260000).hex()
    return secrets.compare_digest(candidate, digest)


def get_db() -> sqlite3.Connection:
    if "db" not in g:
        db = sqlite3.connect(app.config["DATABASE"])
        db.row_factory = sqlite3.Row
        db.execute("PRAGMA foreign_keys = ON;")
        g.db = db
    return g.db


@app.teardown_appcontext
def close_db(_exception):
    db = g.pop("db", None)
    if db is not None:
        db.close()


def ensure_session_id() -> str:
    if "sid" not in session:
        session["sid"] = str(uuid.uuid4())
    return session["sid"]


def get_current_admin():
    admin_id = session.get("admin_user_id")
    if not admin_id:
        return None
    db = get_db()
    return db.execute("SELECT * FROM admin_users WHERE id = ?", (admin_id,)).fetchone()


def admin_required(view_func):
    @wraps(view_func)
    def wrapped(*args, **kwargs):
        if not session.get("admin_user_id"):
            return redirect(url_for("login", next=request.path))
        return view_func(*args, **kwargs)

    return wrapped


def device_auth_required(view_func):
    @wraps(view_func)
    def wrapped(*args, **kwargs):
        api_key = request.headers.get("X-Device-Key", "").strip()
        if not api_key:
            return jsonify({"ok": False, "error": "missing_device_key"}), 401
        db = get_db()
        device = db.execute("SELECT * FROM devices WHERE api_key = ?", (api_key,)).fetchone()
        if not device:
            return jsonify({"ok": False, "error": "invalid_device_key"}), 401
        g.device = device
        return view_func(*args, **kwargs)

    return wrapped


def is_device_online(device: sqlite3.Row, now: datetime | None = None) -> bool:
    now = now or utc_now()
    last_seen_at = from_iso(device["last_seen_at"])
    if not last_seen_at:
        return False
    if device["status"] == "offline":
        return False
    return (now - last_seen_at).total_seconds() <= DEFAULT_OFFLINE_THRESHOLD_SECONDS


def get_idempotent_response(endpoint: str, request_id: str):
    db = get_db()
    row = db.execute(
        "SELECT response_json, status_code FROM idempotency_keys WHERE endpoint = ? AND request_id = ?",
        (endpoint, request_id),
    ).fetchone()
    if not row:
        return None
    return json.loads(row["response_json"]), row["status_code"]


def store_idempotent_response(endpoint: str, request_id: str, payload: dict, status_code: int):
    db = get_db()
    db.execute(
        """
        INSERT INTO idempotency_keys (endpoint, request_id, response_json, status_code, created_at)
        VALUES (?, ?, ?, ?, ?)
        ON CONFLICT(endpoint, request_id) DO NOTHING
        """,
        (endpoint, request_id, json.dumps(payload, ensure_ascii=False), status_code, to_iso(utc_now())),
    )


def append_event(
    *,
    event_type: str,
    device_id: int | None = None,
    campaign_id: int | None = None,
    location_id: int | None = None,
    success: bool | None = None,
    error_reason: str | None = None,
    request_id: str | None = None,
    actor: str | None = None,
    meta: dict | None = None,
    ts: datetime | None = None,
):
    db = get_db()
    ts = ts or utc_now()
    ts_iso = to_iso(ts)
    meta_json = json.dumps(meta or {}, ensure_ascii=False, sort_keys=True)
    prev = db.execute("SELECT event_hash FROM event_logs ORDER BY id DESC LIMIT 1").fetchone()
    prev_hash = prev["event_hash"] if prev else None
    hash_payload = {
        "event_type": event_type,
        "device_id": device_id,
        "campaign_id": campaign_id,
        "location_id": location_id,
        "ts": ts_iso,
        "success": success,
        "error_reason": error_reason,
        "request_id": request_id,
        "actor": actor,
        "meta_json": meta_json,
        "prev_hash": prev_hash,
    }
    digest = hashlib.sha256(
        json.dumps(hash_payload, ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode("utf-8")
    ).hexdigest()
    db.execute(
        """
        INSERT INTO event_logs (
            event_type, device_id, campaign_id, location_id, ts, success, error_reason,
            request_id, actor, meta_json, ip_address, user_agent, prev_hash, event_hash
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            event_type,
            device_id,
            campaign_id,
            location_id,
            ts_iso,
            1 if success is True else 0 if success is False else None,
            error_reason,
            request_id,
            actor,
            meta_json,
            request.headers.get("X-Forwarded-For", request.remote_addr),
            request.headers.get("User-Agent"),
            prev_hash,
            digest,
        ),
    )
    return digest


def recent_unlock_exists(device_id: int, cooldown_seconds: int) -> bool:
    db = get_db()
    cutoff = to_iso(utc_now() - timedelta(seconds=cooldown_seconds))
    row = db.execute(
        """
        SELECT 1
        FROM unlock_commands
        WHERE device_id = ?
          AND created_at >= ?
          AND status IN ('pending', 'success')
        LIMIT 1
        """,
        (device_id, cutoff),
    ).fetchone()
    return row is not None


def session_unlock_count(session_id: str, within_seconds: int) -> int:
    db = get_db()
    cutoff = to_iso(utc_now() - timedelta(seconds=within_seconds))
    row = db.execute(
        """
        SELECT COUNT(*) AS cnt
        FROM unlock_commands
        WHERE source = 'lp'
          AND requested_by = ?
          AND created_at >= ?
        """,
        (session_id, cutoff),
    ).fetchone()
    return row["cnt"] if row else 0


def create_unlock_command(
    *,
    request_id: str,
    device_id: int,
    campaign_id: int | None,
    source: str,
    requested_by: str,
    open_seconds: int,
    status: str,
    error_reason: str | None = None,
):
    db = get_db()
    now_iso = to_iso(utc_now())
    cursor = db.execute(
        """
        INSERT INTO unlock_commands (
            request_id, device_id, campaign_id, source, requested_by,
            open_seconds, status, error_reason, created_at, completed_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            request_id,
            device_id,
            campaign_id,
            source,
            requested_by,
            open_seconds,
            status,
            error_reason,
            now_iso,
            now_iso if status in ("success", "fail", "rejected_offline", "rejected_rate_limit") else None,
        ),
    )
    return cursor.lastrowid


def estimate_device_offline_seconds(
    *,
    device_id: int,
    window_start: datetime,
    window_end: datetime,
    expected_interval_seconds: int = DEFAULT_HEARTBEAT_EXPECTED_SECONDS,
    grace_seconds: int = DEFAULT_HEARTBEAT_GRACE_SECONDS,
) -> int:
    db = get_db()
    rows = db.execute(
        """
        SELECT ts
        FROM event_logs
        WHERE event_type = 'heartbeat'
          AND device_id = ?
          AND ts >= ?
          AND ts <= ?
        ORDER BY ts ASC
        """,
        (device_id, to_iso(window_start), to_iso(window_end)),
    ).fetchall()
    if not rows:
        return int((window_end - window_start).total_seconds())

    offline_seconds = 0
    previous = window_start
    for row in rows:
        current = from_iso(row["ts"])
        if not current:
            continue
        gap = int((current - previous).total_seconds())
        if gap > grace_seconds:
            offline_seconds += max(0, gap - expected_interval_seconds)
        previous = current

    tail_gap = int((window_end - previous).total_seconds())
    if tail_gap > grace_seconds:
        offline_seconds += max(0, tail_gap - expected_interval_seconds)

    window_size = int((window_end - window_start).total_seconds())
    return max(0, min(window_size, offline_seconds))


def get_today_range() -> tuple[datetime, datetime]:
    now = utc_now()
    start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    return start, start + timedelta(days=1)


def load_dashboard_metrics():
    db = get_db()
    start, end = get_today_range()
    start_iso = to_iso(start)
    end_iso = to_iso(end)

    success = db.execute(
        """
        SELECT COUNT(*) AS cnt
        FROM event_logs
        WHERE event_type = 'unlock_success'
          AND ts >= ?
          AND ts < ?
        """,
        (start_iso, end_iso),
    ).fetchone()["cnt"]
    fail = db.execute(
        """
        SELECT COUNT(*) AS cnt
        FROM event_logs
        WHERE event_type = 'unlock_fail'
          AND ts >= ?
          AND ts < ?
        """,
        (start_iso, end_iso),
    ).fetchone()["cnt"]
    attempts = success + fail
    fail_rate = (fail / attempts * 100.0) if attempts else 0.0

    locations = db.execute("SELECT * FROM locations ORDER BY id ASC").fetchall()
    offline_location_count = 0
    anomaly_rows = []
    for loc in locations:
        devices = db.execute("SELECT * FROM devices WHERE location_id = ?", (loc["id"],)).fetchall()
        if not devices:
            continue
        online_devices = sum(1 for d in devices if is_device_online(d))
        if online_devices == 0:
            offline_location_count += 1

        loc_success = db.execute(
            """
            SELECT COUNT(*) AS cnt
            FROM event_logs
            WHERE event_type = 'unlock_success'
              AND location_id = ?
              AND ts >= ?
              AND ts < ?
            """,
            (loc["id"], start_iso, end_iso),
        ).fetchone()["cnt"]
        loc_fail = db.execute(
            """
            SELECT COUNT(*) AS cnt
            FROM event_logs
            WHERE event_type = 'unlock_fail'
              AND location_id = ?
              AND ts >= ?
              AND ts < ?
            """,
            (loc["id"], start_iso, end_iso),
        ).fetchone()["cnt"]
        loc_attempts = loc_success + loc_fail
        loc_fail_rate = (loc_fail / loc_attempts * 100.0) if loc_attempts else 0.0
        offline_seconds = 0
        for d in devices:
            offline_seconds += estimate_device_offline_seconds(device_id=d["id"], window_start=start, window_end=utc_now())
        anomaly_rows.append(
            {
                "location_id": loc["id"],
                "location_name": loc["name"],
                "offline_seconds": offline_seconds,
                "fail_rate": round(loc_fail_rate, 2),
                "unlock_attempts": loc_attempts,
            }
        )

    anomaly_rows.sort(key=lambda row: (row["offline_seconds"], row["fail_rate"]), reverse=True)

    alert_10m = db.execute(
        "SELECT COUNT(*) AS cnt FROM devices WHERE last_seen_at IS NULL OR last_seen_at < ?",
        (to_iso(utc_now() - timedelta(seconds=DEFAULT_OFFLINE_THRESHOLD_SECONDS)),),
    ).fetchone()["cnt"]
    alert_30m = db.execute(
        "SELECT COUNT(*) AS cnt FROM devices WHERE last_seen_at IS NULL OR last_seen_at < ?",
        (to_iso(utc_now() - timedelta(seconds=DEFAULT_ALERT_THRESHOLD_SECONDS)),),
    ).fetchone()["cnt"]

    return {
        "unlock_success_today": success,
        "unlock_fail_today": fail,
        "failure_rate": round(fail_rate, 2),
        "offline_location_count": offline_location_count,
        "anomalies": anomaly_rows[:8],
        "alert_10m_count": alert_10m,
        "alert_30m_count": alert_30m,
    }


def list_locations_summary():
    db = get_db()
    start, end = get_today_range()
    start_iso = to_iso(start)
    end_iso = to_iso(end)
    locations = db.execute("SELECT * FROM locations ORDER BY id ASC").fetchall()
    rows = []
    for loc in locations:
        devices = db.execute("SELECT * FROM devices WHERE location_id = ? ORDER BY id ASC", (loc["id"],)).fetchall()
        online_count = sum(1 for device in devices if is_device_online(device))
        unlock_today = db.execute(
            """
            SELECT COUNT(*) AS cnt
            FROM event_logs
            WHERE event_type = 'unlock_success'
              AND location_id = ?
              AND ts >= ?
              AND ts < ?
            """,
            (loc["id"], start_iso, end_iso),
        ).fetchone()["cnt"]
        last_seen = None
        for d in devices:
            dt = from_iso(d["last_seen_at"])
            if dt and (last_seen is None or dt > last_seen):
                last_seen = dt
        offline_seconds = sum(
            estimate_device_offline_seconds(device_id=d["id"], window_start=start, window_end=utc_now()) for d in devices
        )
        rows.append(
            {
                "id": loc["id"],
                "name": loc["name"],
                "note": loc["note"],
                "device_total": len(devices),
                "online_count": online_count,
                "unlock_today": unlock_today,
                "last_seen_at": to_iso(last_seen) if last_seen else "-",
                "offline_minutes": round(offline_seconds / 60, 1),
            }
        )
    return rows


def query_event_logs(filters: dict, limit: int = 500):
    db = get_db()
    sql = """
    SELECT
      e.*,
      d.name AS device_name,
      d.serial AS device_serial,
      l.name AS location_name,
      c.token AS campaign_token
    FROM event_logs e
    LEFT JOIN devices d ON e.device_id = d.id
    LEFT JOIN locations l ON e.location_id = l.id
    LEFT JOIN campaigns c ON e.campaign_id = c.id
    WHERE 1 = 1
    """
    params = []
    if filters.get("from_ts"):
        sql += " AND e.ts >= ?"
        params.append(filters["from_ts"])
    if filters.get("to_ts"):
        sql += " AND e.ts < ?"
        params.append(filters["to_ts"])
    if filters.get("event_type"):
        sql += " AND e.event_type = ?"
        params.append(filters["event_type"])
    if filters.get("location_id"):
        sql += " AND e.location_id = ?"
        params.append(filters["location_id"])
    if filters.get("device_id"):
        sql += " AND e.device_id = ?"
        params.append(filters["device_id"])
    sql += " ORDER BY e.ts DESC LIMIT ?"
    params.append(limit)
    return db.execute(sql, tuple(params)).fetchall()


SCHEMA_SQL = """
CREATE TABLE IF NOT EXISTS locations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    note TEXT,
    geo TEXT,
    created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS devices (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    serial TEXT NOT NULL UNIQUE,
    location_id INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'offline',
    last_seen_at TEXT,
    fw_version TEXT,
    api_key TEXT NOT NULL UNIQUE,
    cooldown_seconds INTEGER NOT NULL DEFAULT 20,
    created_at TEXT NOT NULL,
    FOREIGN KEY (location_id) REFERENCES locations(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS campaigns (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    location_id INTEGER NOT NULL,
    device_id INTEGER NOT NULL,
    token TEXT NOT NULL UNIQUE,
    lp_variant TEXT NOT NULL DEFAULT 'A',
    active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL,
    FOREIGN KEY (location_id) REFERENCES locations(id) ON DELETE CASCADE,
    FOREIGN KEY (device_id) REFERENCES devices(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS admin_users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'operator',
    created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS unlock_commands (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    request_id TEXT NOT NULL UNIQUE,
    device_id INTEGER NOT NULL,
    campaign_id INTEGER,
    source TEXT NOT NULL,
    requested_by TEXT NOT NULL,
    open_seconds INTEGER NOT NULL,
    status TEXT NOT NULL,
    error_reason TEXT,
    created_at TEXT NOT NULL,
    completed_at TEXT,
    FOREIGN KEY (device_id) REFERENCES devices(id) ON DELETE CASCADE,
    FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS event_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    event_type TEXT NOT NULL,
    device_id INTEGER,
    campaign_id INTEGER,
    location_id INTEGER,
    ts TEXT NOT NULL,
    success INTEGER,
    error_reason TEXT,
    request_id TEXT,
    actor TEXT,
    meta_json TEXT,
    ip_address TEXT,
    user_agent TEXT,
    prev_hash TEXT,
    event_hash TEXT NOT NULL,
    FOREIGN KEY (device_id) REFERENCES devices(id) ON DELETE SET NULL,
    FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE SET NULL,
    FOREIGN KEY (location_id) REFERENCES locations(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_event_logs_ts ON event_logs(ts);
CREATE INDEX IF NOT EXISTS idx_event_logs_type ON event_logs(event_type);
CREATE INDEX IF NOT EXISTS idx_event_logs_device ON event_logs(device_id);
CREATE INDEX IF NOT EXISTS idx_event_logs_location ON event_logs(location_id);

CREATE TABLE IF NOT EXISTS idempotency_keys (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    endpoint TEXT NOT NULL,
    request_id TEXT NOT NULL,
    response_json TEXT NOT NULL,
    status_code INTEGER NOT NULL,
    created_at TEXT NOT NULL,
    UNIQUE(endpoint, request_id)
);
"""


def init_db():
    db = get_db()
    db.executescript(SCHEMA_SQL)
    now_iso = to_iso(utc_now())

    admin_count = db.execute("SELECT COUNT(*) AS cnt FROM admin_users").fetchone()["cnt"]
    if admin_count == 0:
        db.execute(
            """
            INSERT INTO admin_users (username, password_hash, role, created_at)
            VALUES (?, ?, 'admin', ?)
            """,
            (
                app.config["DEFAULT_ADMIN_USERNAME"],
                hash_password(app.config["DEFAULT_ADMIN_PASSWORD"]),
                now_iso,
            ),
        )

    location_count = db.execute("SELECT COUNT(*) AS cnt FROM locations").fetchone()["cnt"]
    if location_count == 0:
        db.execute(
            "INSERT INTO locations (name, note, geo, created_at) VALUES (?, ?, ?, ?)",
            ("Sample Site", "Auto-seeded MVP location", "", now_iso),
        )

    device_count = db.execute("SELECT COUNT(*) AS cnt FROM devices").fetchone()["cnt"]
    if device_count == 0:
        location_id = db.execute("SELECT id FROM locations ORDER BY id ASC LIMIT 1").fetchone()["id"]
        sample_device_api_key = os.getenv("SAMPLE_DEVICE_API_KEY", secrets.token_urlsafe(24))
        db.execute(
            """
            INSERT INTO devices (
                name, serial, location_id, status, last_seen_at, fw_version, api_key, cooldown_seconds, created_at
            ) VALUES (?, ?, ?, 'offline', NULL, ?, ?, ?, ?)
            """,
            ("Sample Device", "DEV-001", location_id, "0.1.0", sample_device_api_key, DEFAULT_UNLOCK_COOLDOWN_SECONDS, now_iso),
        )

    campaign_count = db.execute("SELECT COUNT(*) AS cnt FROM campaigns").fetchone()["cnt"]
    if campaign_count == 0:
        location = db.execute("SELECT id FROM locations ORDER BY id ASC LIMIT 1").fetchone()
        device = db.execute("SELECT id FROM devices ORDER BY id ASC LIMIT 1").fetchone()
        sample_campaign_token = os.getenv("SAMPLE_CAMPAIGN_TOKEN", secrets.token_urlsafe(18))
        db.execute(
            """
            INSERT INTO campaigns (location_id, device_id, token, lp_variant, active, created_at)
            VALUES (?, ?, ?, 'A', 1, ?)
            """,
            (location["id"], device["id"], sample_campaign_token, now_iso),
        )

    db.commit()


@app.before_request
def before_each_request():
    ensure_session_id()


@app.route("/health")
def health():
    return jsonify({"ok": True, "server_time": to_iso(utc_now())})


@app.route("/")
def home():
    if session.get("admin_user_id"):
        return redirect(url_for("dashboard"))
    return redirect(url_for("login"))


@app.route("/admin/login", methods=["GET", "POST"])
def login():
    if request.method == "POST":
        username = request.form.get("username", "").strip()
        password = request.form.get("password", "")
        db = get_db()
        admin = db.execute("SELECT * FROM admin_users WHERE username = ?", (username,)).fetchone()
        if admin and verify_password(password, admin["password_hash"]):
            session["admin_user_id"] = admin["id"]
            next_url = request.args.get("next") or url_for("dashboard")
            return redirect(next_url)
        flash("Invalid username or password", "error")
    return render_template("login.html")


@app.post("/admin/logout")
@admin_required
def logout():
    session.clear()
    return redirect(url_for("login"))


@app.route("/admin/dashboard")
@admin_required
def dashboard():
    metrics = load_dashboard_metrics()
    return render_template("dashboard.html", metrics=metrics)


@app.route("/admin/locations")
@admin_required
def locations_page():
    db = get_db()
    rows = list_locations_summary()
    locations = db.execute("SELECT id, name FROM locations ORDER BY name ASC").fetchall()
    return render_template("locations.html", rows=rows, locations=locations)


@app.post("/admin/locations")
@admin_required
def create_location():
    name = request.form.get("name", "").strip()
    note = request.form.get("note", "").strip()
    geo = request.form.get("geo", "").strip()
    if not name:
        flash("Location name is required", "error")
        return redirect(url_for("locations_page"))
    db = get_db()
    db.execute(
        "INSERT INTO locations (name, note, geo, created_at) VALUES (?, ?, ?, ?)",
        (name, note, geo, to_iso(utc_now())),
    )
    admin = get_current_admin()
    append_event(
        event_type="admin_action",
        actor=f"admin:{admin['username']}",
        success=True,
        meta={"action": "create_location", "name": name},
    )
    db.commit()
    flash("Location created", "ok")
    return redirect(url_for("locations_page"))


@app.post("/admin/devices")
@admin_required
def create_device():
    name = request.form.get("name", "").strip()
    serial = request.form.get("serial", "").strip()
    fw_version = request.form.get("fw_version", "").strip() or "unknown"
    location_id = request.form.get("location_id", "").strip()
    api_key = request.form.get("api_key", "").strip() or secrets.token_urlsafe(24)
    cooldown_seconds = clamp_integer(
        request.form.get("cooldown_seconds", DEFAULT_UNLOCK_COOLDOWN_SECONDS),
        default=DEFAULT_UNLOCK_COOLDOWN_SECONDS,
        min_value=3,
        max_value=300,
    )

    if not name or not serial or not location_id:
        flash("name / serial / location_id are required", "error")
        return redirect(url_for("locations_page"))

    db = get_db()
    try:
        db.execute(
            """
            INSERT INTO devices (
                name, serial, location_id, status, fw_version, api_key,
                cooldown_seconds, created_at
            ) VALUES (?, ?, ?, 'offline', ?, ?, ?, ?)
            """,
            (name, serial, int(location_id), fw_version, api_key, cooldown_seconds, to_iso(utc_now())),
        )
    except sqlite3.IntegrityError as exc:
        flash(f"Device creation failed: {exc}", "error")
        return redirect(url_for("locations_page"))

    admin = get_current_admin()
    append_event(
        event_type="admin_action",
        actor=f"admin:{admin['username']}",
        success=True,
        meta={"action": "create_device", "serial": serial, "location_id": int(location_id)},
    )
    db.commit()
    flash(f"Device created. API key: {api_key}", "ok")
    return redirect(url_for("location_detail", location_id=int(location_id)))


@app.post("/admin/campaigns")
@admin_required
def create_campaign():
    location_id = request.form.get("location_id", "").strip()
    device_id = request.form.get("device_id", "").strip()
    token = request.form.get("token", "").strip() or secrets.token_urlsafe(18)
    lp_variant = request.form.get("lp_variant", "A").strip() or "A"

    if not location_id or not device_id:
        flash("location_id and device_id are required", "error")
        return redirect(url_for("locations_page"))

    db = get_db()
    try:
        db.execute(
            """
            INSERT INTO campaigns (location_id, device_id, token, lp_variant, active, created_at)
            VALUES (?, ?, ?, ?, 1, ?)
            """,
            (int(location_id), int(device_id), token, lp_variant, to_iso(utc_now())),
        )
    except sqlite3.IntegrityError as exc:
        flash(f"Campaign creation failed: {exc}", "error")
        return redirect(url_for("location_detail", location_id=int(location_id)))

    admin = get_current_admin()
    append_event(
        event_type="admin_action",
        actor=f"admin:{admin['username']}",
        success=True,
        meta={"action": "create_campaign", "location_id": int(location_id), "device_id": int(device_id), "token": token},
    )
    db.commit()
    flash("Campaign token issued", "ok")
    return redirect(url_for("location_detail", location_id=int(location_id)))


@app.route("/admin/locations/<int:location_id>")
@admin_required
def location_detail(location_id: int):
    db = get_db()
    location = db.execute("SELECT * FROM locations WHERE id = ?", (location_id,)).fetchone()
    if not location:
        return "location not found", 404

    devices = db.execute("SELECT * FROM devices WHERE location_id = ? ORDER BY id ASC", (location_id,)).fetchall()
    campaigns = db.execute(
        """
        SELECT c.*, d.name AS device_name
        FROM campaigns c
        JOIN devices d ON c.device_id = d.id
        WHERE c.location_id = ?
        ORDER BY c.created_at DESC
        """,
        (location_id,),
    ).fetchall()
    start, end = get_today_range()
    start_iso = to_iso(start)
    end_iso = to_iso(end)
    hourly_rows = db.execute(
        """
        SELECT CAST(strftime('%H', ts) AS INTEGER) AS hour, COUNT(*) AS cnt
        FROM event_logs
        WHERE location_id = ?
          AND event_type = 'unlock_success'
          AND ts >= ?
          AND ts < ?
        GROUP BY hour
        ORDER BY hour ASC
        """,
        (location_id, start_iso, end_iso),
    ).fetchall()
    hourly_counts = {hour: 0 for hour in range(24)}
    for row in hourly_rows:
        hourly_counts[row["hour"]] = row["cnt"]

    error_logs = db.execute(
        """
        SELECT e.*, d.name AS device_name
        FROM event_logs e
        LEFT JOIN devices d ON e.device_id = d.id
        WHERE e.location_id = ?
          AND e.event_type = 'unlock_fail'
        ORDER BY e.ts DESC
        LIMIT 50
        """,
        (location_id,),
    ).fetchall()

    today_success = db.execute(
        """
        SELECT COUNT(*) AS cnt
        FROM event_logs
        WHERE location_id = ?
          AND event_type = 'unlock_success'
          AND ts >= ?
          AND ts < ?
        """,
        (location_id, start_iso, end_iso),
    ).fetchone()["cnt"]
    today_fail = db.execute(
        """
        SELECT COUNT(*) AS cnt
        FROM event_logs
        WHERE location_id = ?
          AND event_type = 'unlock_fail'
          AND ts >= ?
          AND ts < ?
        """,
        (location_id, start_iso, end_iso),
    ).fetchone()["cnt"]

    offline_seconds = 0
    devices_for_view = []
    for device in devices:
        online = is_device_online(device)
        offline_seconds += estimate_device_offline_seconds(device_id=device["id"], window_start=start, window_end=utc_now())
        devices_for_view.append(
            {
                **dict(device),
                "online": online,
                "last_seen_display": device["last_seen_at"] or "-",
            }
        )

    return render_template(
        "location_detail.html",
        location=location,
        devices=devices_for_view,
        campaigns=campaigns,
        hourly_counts=hourly_counts,
        error_logs=error_logs,
        today_success=today_success,
        today_fail=today_fail,
        today_failure_rate=round((today_fail / (today_success + today_fail) * 100.0), 2) if (today_success + today_fail) else 0.0,
        offline_minutes=round(offline_seconds / 60, 1),
    )


@app.route("/admin/logs")
@admin_required
def logs_page():
    db = get_db()
    from_date = request.args.get("from", "")
    to_date = request.args.get("to", "")
    event_type = request.args.get("event_type", "").strip()
    location_id = request.args.get("location_id", "").strip()
    device_id = request.args.get("device_id", "").strip()
    output_format = request.args.get("format", "html").strip()

    from_ts = None
    to_ts = None
    try:
        if from_date:
            from_ts = to_iso(datetime.fromisoformat(from_date).replace(tzinfo=timezone.utc))
        if to_date:
            to_ts = to_iso((datetime.fromisoformat(to_date) + timedelta(days=1)).replace(tzinfo=timezone.utc))
    except ValueError:
        flash("Invalid date format", "error")
        return redirect(url_for("logs_page"))

    filters = {
        "from_ts": from_ts,
        "to_ts": to_ts,
        "event_type": event_type or None,
        "location_id": int(location_id) if location_id else None,
        "device_id": int(device_id) if device_id else None,
    }
    rows = query_event_logs(filters)

    if output_format == "csv":
        output = StringIO()
        writer = csv.writer(output)
        writer.writerow(
            [
                "id",
                "ts",
                "event_type",
                "location_name",
                "device_serial",
                "success",
                "error_reason",
                "request_id",
                "actor",
                "meta_json",
                "prev_hash",
                "event_hash",
            ]
        )
        for row in rows:
            writer.writerow(
                [
                    row["id"],
                    row["ts"],
                    row["event_type"],
                    row["location_name"],
                    row["device_serial"],
                    row["success"],
                    row["error_reason"],
                    row["request_id"],
                    row["actor"],
                    row["meta_json"],
                    row["prev_hash"],
                    row["event_hash"],
                ]
            )
        payload = output.getvalue()
        filename = f"smartgomi_logs_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}.csv"
        return Response(
            payload,
            mimetype="text/csv",
            headers={"Content-Disposition": f'attachment; filename="{filename}"'},
        )

    locations = db.execute("SELECT id, name FROM locations ORDER BY name ASC").fetchall()
    devices = db.execute("SELECT id, serial, name FROM devices ORDER BY serial ASC").fetchall()
    event_types = db.execute("SELECT DISTINCT event_type FROM event_logs ORDER BY event_type ASC").fetchall()

    return render_template(
        "logs.html",
        rows=rows,
        locations=locations,
        devices=devices,
        event_types=event_types,
        filters={
            "from": from_date,
            "to": to_date,
            "event_type": event_type,
            "location_id": location_id,
            "device_id": device_id,
        },
    )


@app.post("/admin/unlock")
@admin_required
def admin_unlock():
    admin = get_current_admin()
    payload = request.get_json(silent=True) if request.is_json else request.form
    payload = payload or {}
    request_id = payload.get("request_id") or request.headers.get("X-Request-ID") or str(uuid.uuid4())
    endpoint = "admin_unlock"
    cached = get_idempotent_response(endpoint, request_id)
    if cached:
        body, status_code = cached
        return jsonify(body), status_code

    try:
        device_id = int(payload.get("device_id"))
    except (TypeError, ValueError):
        response = {"ok": False, "error": "invalid_device_id"}
        status_code = 400
        store_idempotent_response(endpoint, request_id, response, status_code)
        get_db().commit()
        return jsonify(response), status_code

    open_seconds = clamp_open_seconds(payload.get("open_seconds", DEFAULT_UNLOCK_SECONDS))
    db = get_db()
    device = db.execute("SELECT * FROM devices WHERE id = ?", (device_id,)).fetchone()
    if not device:
        response = {"ok": False, "error": "device_not_found"}
        status_code = 404
        store_idempotent_response(endpoint, request_id, response, status_code)
        db.commit()
        return jsonify(response), status_code

    cooldown = device["cooldown_seconds"] or DEFAULT_UNLOCK_COOLDOWN_SECONDS
    if not is_device_online(device):
        command_id = create_unlock_command(
            request_id=request_id,
            device_id=device_id,
            campaign_id=None,
            source="admin",
            requested_by=f"admin:{admin['username']}",
            open_seconds=open_seconds,
            status="rejected_offline",
            error_reason="device_offline",
        )
        append_event(
            event_type="unlock_fail",
            device_id=device_id,
            location_id=device["location_id"],
            success=False,
            error_reason="device_offline",
            request_id=request_id,
            actor=f"admin:{admin['username']}",
            meta={"source": "admin", "command_id": command_id, "open_seconds": open_seconds},
        )
        response = {"ok": False, "error": "device_offline", "command_id": command_id}
        status_code = 409
    elif recent_unlock_exists(device_id, cooldown):
        command_id = create_unlock_command(
            request_id=request_id,
            device_id=device_id,
            campaign_id=None,
            source="admin",
            requested_by=f"admin:{admin['username']}",
            open_seconds=open_seconds,
            status="rejected_rate_limit",
            error_reason="cooldown_active",
        )
        append_event(
            event_type="unlock_fail",
            device_id=device_id,
            location_id=device["location_id"],
            success=False,
            error_reason="cooldown_active",
            request_id=request_id,
            actor=f"admin:{admin['username']}",
            meta={"source": "admin", "command_id": command_id, "open_seconds": open_seconds},
        )
        response = {"ok": False, "error": "cooldown_active", "command_id": command_id}
        status_code = 429
    else:
        command_id = create_unlock_command(
            request_id=request_id,
            device_id=device_id,
            campaign_id=None,
            source="admin",
            requested_by=f"admin:{admin['username']}",
            open_seconds=open_seconds,
            status="pending",
            error_reason=None,
        )
        append_event(
            event_type="unlock_request",
            device_id=device_id,
            location_id=device["location_id"],
            success=True,
            request_id=request_id,
            actor=f"admin:{admin['username']}",
            meta={"source": "admin", "command_id": command_id, "open_seconds": open_seconds},
        )
        response = {
            "ok": True,
            "status": "pending",
            "command_id": command_id,
            "message": "unlock command queued",
            "device_id": device_id,
        }
        status_code = 202

    store_idempotent_response(endpoint, request_id, response, status_code)
    db.commit()
    return jsonify(response), status_code


@app.post("/device/heartbeat")
@device_auth_required
def device_heartbeat():
    device = g.device
    payload = request.get_json(silent=True) or {}
    request_id = payload.get("request_id") or request.headers.get("X-Request-ID")
    if not request_id:
        return jsonify({"ok": False, "error": "missing_request_id"}), 400

    endpoint = "device_heartbeat"
    cached = get_idempotent_response(endpoint, request_id)
    if cached:
        body, status_code = cached
        return jsonify(body), status_code

    online = bool(payload.get("online", True))
    fw_version = payload.get("fw_version") or device["fw_version"]
    voltage = payload.get("voltage")
    rssi = payload.get("rssi")
    now_iso = to_iso(utc_now())
    db = get_db()
    db.execute(
        """
        UPDATE devices
        SET status = ?, last_seen_at = ?, fw_version = ?
        WHERE id = ?
        """,
        ("online" if online else "offline", now_iso, fw_version, device["id"]),
    )

    append_event(
        event_type="heartbeat",
        device_id=device["id"],
        location_id=device["location_id"],
        success=True,
        request_id=request_id,
        actor=f"device:{device['serial']}",
        meta={
            "online": online,
            "voltage": voltage,
            "rssi": rssi,
            "fw_version": fw_version,
        },
    )

    pending_rows = db.execute(
        """
        SELECT id, request_id, open_seconds, source, campaign_id, created_at
        FROM unlock_commands
        WHERE device_id = ?
          AND status = 'pending'
        ORDER BY created_at ASC
        LIMIT 10
        """,
        (device["id"],),
    ).fetchall()

    pending_commands = [
        {
            "id": row["id"],
            "request_id": row["request_id"],
            "open_seconds": row["open_seconds"],
            "source": row["source"],
            "campaign_id": row["campaign_id"],
            "created_at": row["created_at"],
        }
        for row in pending_rows
    ]
    response = {"ok": True, "server_time": now_iso, "pending_commands": pending_commands}
    status_code = 200
    store_idempotent_response(endpoint, request_id, response, status_code)
    db.commit()
    return jsonify(response), status_code


@app.post("/device/unlock_result")
@device_auth_required
def device_unlock_result():
    device = g.device
    payload = request.get_json(silent=True) or {}
    request_id = payload.get("request_id") or request.headers.get("X-Request-ID")
    if not request_id:
        return jsonify({"ok": False, "error": "missing_request_id"}), 400
    endpoint = "device_unlock_result"
    cached = get_idempotent_response(endpoint, request_id)
    if cached:
        body, status_code = cached
        return jsonify(body), status_code

    command_id = payload.get("command_id")
    command_request_id = payload.get("command_request_id")
    success = bool(payload.get("success", False))
    error_reason = payload.get("error_reason")
    open_seconds = clamp_open_seconds(payload.get("open_seconds", DEFAULT_UNLOCK_SECONDS))

    db = get_db()
    command = None
    if command_id:
        command = db.execute(
            "SELECT * FROM unlock_commands WHERE id = ? AND device_id = ?",
            (int(command_id), device["id"]),
        ).fetchone()
    if not command and command_request_id:
        command = db.execute(
            "SELECT * FROM unlock_commands WHERE request_id = ? AND device_id = ?",
            (command_request_id, device["id"]),
        ).fetchone()

    if not command:
        append_event(
            event_type="unlock_fail",
            device_id=device["id"],
            location_id=device["location_id"],
            success=False,
            error_reason="unknown_command",
            request_id=request_id,
            actor=f"device:{device['serial']}",
            meta={"source": "device_result", "payload": payload},
        )
        response = {"ok": False, "error": "unknown_command"}
        status_code = 404
        store_idempotent_response(endpoint, request_id, response, status_code)
        db.commit()
        return jsonify(response), status_code

    status = "success" if success else "fail"
    db.execute(
        """
        UPDATE unlock_commands
        SET status = ?, error_reason = ?, open_seconds = ?, completed_at = ?
        WHERE id = ?
        """,
        (status, error_reason, open_seconds, to_iso(utc_now()), command["id"]),
    )

    append_event(
        event_type="unlock_success" if success else "unlock_fail",
        device_id=device["id"],
        campaign_id=command["campaign_id"],
        location_id=device["location_id"],
        success=success,
        error_reason=error_reason if not success else None,
        request_id=request_id,
        actor=f"device:{device['serial']}",
        meta={"command_id": command["id"], "command_request_id": command["request_id"], "open_seconds": open_seconds},
    )

    response = {"ok": True, "status": status, "command_id": command["id"]}
    status_code = 200
    store_idempotent_response(endpoint, request_id, response, status_code)
    db.commit()
    return jsonify(response), status_code


@app.route("/q/<campaign_token>")
def campaign_landing(campaign_token: str):
    db = get_db()
    row = db.execute(
        """
        SELECT
          c.*,
          d.name AS device_name,
          d.serial AS device_serial,
          d.id AS device_id,
          d.location_id AS location_id,
          d.status AS status,
          d.last_seen_at AS last_seen_at,
          l.name AS location_name
        FROM campaigns c
        JOIN devices d ON c.device_id = d.id
        JOIN locations l ON c.location_id = l.id
        WHERE c.token = ?
          AND c.active = 1
        """,
        (campaign_token,),
    ).fetchone()
    if not row:
        return "campaign not found", 404

    sid = ensure_session_id()
    append_event(
        event_type="qr_view",
        device_id=row["device_id"],
        campaign_id=row["id"],
        location_id=row["location_id"],
        success=True,
        request_id=str(uuid.uuid4()),
        actor=f"session:{sid}",
        meta={"lp_variant": row["lp_variant"]},
    )
    db.commit()

    return render_template(
        "lp.html",
        campaign=row,
        default_open_seconds=DEFAULT_UNLOCK_SECONDS,
        device_online=is_device_online(row),
    )


@app.post("/q/<campaign_token>/unlock")
def campaign_unlock(campaign_token: str):
    db = get_db()
    row = db.execute(
        """
        SELECT
          c.*,
          d.id AS device_id,
          d.serial AS device_serial,
          d.location_id AS location_id,
          d.status AS status,
          d.last_seen_at AS last_seen_at,
          d.cooldown_seconds AS cooldown_seconds
        FROM campaigns c
        JOIN devices d ON c.device_id = d.id
        WHERE c.token = ?
          AND c.active = 1
        """,
        (campaign_token,),
    ).fetchone()
    if not row:
        return jsonify({"ok": False, "error": "campaign_not_found"}), 404

    payload = request.get_json(silent=True) if request.is_json else request.form
    payload = payload or {}
    request_id = payload.get("request_id") or request.headers.get("X-Request-ID") or str(uuid.uuid4())
    endpoint = "campaign_unlock"
    cached = get_idempotent_response(endpoint, request_id)
    if cached:
        body, status_code = cached
        return jsonify(body), status_code

    open_seconds = clamp_open_seconds(payload.get("open_seconds", DEFAULT_UNLOCK_SECONDS))
    sid = ensure_session_id()
    cooldown = row["cooldown_seconds"] or DEFAULT_UNLOCK_COOLDOWN_SECONDS

    device_like = {
        "status": row["status"],
        "last_seen_at": row["last_seen_at"],
    }

    status_code = 202
    if not is_device_online(device_like):
        command_id = create_unlock_command(
            request_id=request_id,
            device_id=row["device_id"],
            campaign_id=row["id"],
            source="lp",
            requested_by=f"session:{sid}",
            open_seconds=open_seconds,
            status="rejected_offline",
            error_reason="device_offline",
        )
        append_event(
            event_type="unlock_fail",
            device_id=row["device_id"],
            campaign_id=row["id"],
            location_id=row["location_id"],
            success=False,
            error_reason="device_offline",
            request_id=request_id,
            actor=f"session:{sid}",
            meta={"source": "lp", "command_id": command_id, "open_seconds": open_seconds},
        )
        response = {"ok": False, "status": "rejected_offline", "command_id": command_id, "message": "Device is offline"}
        status_code = 409
    elif recent_unlock_exists(row["device_id"], cooldown):
        command_id = create_unlock_command(
            request_id=request_id,
            device_id=row["device_id"],
            campaign_id=row["id"],
            source="lp",
            requested_by=f"session:{sid}",
            open_seconds=open_seconds,
            status="rejected_rate_limit",
            error_reason="cooldown_active",
        )
        append_event(
            event_type="unlock_fail",
            device_id=row["device_id"],
            campaign_id=row["id"],
            location_id=row["location_id"],
            success=False,
            error_reason="cooldown_active",
            request_id=request_id,
            actor=f"session:{sid}",
            meta={"source": "lp", "command_id": command_id, "open_seconds": open_seconds},
        )
        response = {"ok": False, "status": "rejected_rate_limit", "command_id": command_id, "message": "Please wait and retry"}
        status_code = 429
    elif session_unlock_count(f"session:{sid}", 60) >= 5:
        command_id = create_unlock_command(
            request_id=request_id,
            device_id=row["device_id"],
            campaign_id=row["id"],
            source="lp",
            requested_by=f"session:{sid}",
            open_seconds=open_seconds,
            status="rejected_rate_limit",
            error_reason="session_rate_limited",
        )
        append_event(
            event_type="unlock_fail",
            device_id=row["device_id"],
            campaign_id=row["id"],
            location_id=row["location_id"],
            success=False,
            error_reason="session_rate_limited",
            request_id=request_id,
            actor=f"session:{sid}",
            meta={"source": "lp", "command_id": command_id, "open_seconds": open_seconds},
        )
        response = {
            "ok": False,
            "status": "rejected_rate_limit",
            "command_id": command_id,
            "message": "Too many attempts. Please retry later.",
        }
        status_code = 429
    else:
        command_id = create_unlock_command(
            request_id=request_id,
            device_id=row["device_id"],
            campaign_id=row["id"],
            source="lp",
            requested_by=f"session:{sid}",
            open_seconds=open_seconds,
            status="pending",
            error_reason=None,
        )
        append_event(
            event_type="unlock_request",
            device_id=row["device_id"],
            campaign_id=row["id"],
            location_id=row["location_id"],
            success=True,
            request_id=request_id,
            actor=f"session:{sid}",
            meta={"source": "lp", "command_id": command_id, "open_seconds": open_seconds},
        )
        response = {
            "ok": True,
            "status": "pending",
            "command_id": command_id,
            "message": "Unlock command sent. The device will open when it receives this command.",
        }

    store_idempotent_response(endpoint, request_id, response, status_code)
    db.commit()
    return jsonify(response), status_code


@app.route("/admin/locations/<int:location_id>/checklist")
@admin_required
def patrol_checklist(location_id: int):
    db = get_db()
    location = db.execute("SELECT * FROM locations WHERE id = ?", (location_id,)).fetchone()
    if not location:
        return "location not found", 404
    checklist = [
        "Power and waterproof box status",
        "Physical jam or trash overflow",
        "Manual unlock check",
        "QR label readability",
        "Cleanup around the station",
    ]
    return render_template("checklist.html", location=location, checklist=checklist)


def bootstrap():
    with app.app_context():
        init_db()


bootstrap()


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=int(os.getenv("PORT", "8000")), debug=False)
