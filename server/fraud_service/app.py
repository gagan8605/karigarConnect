"""
server/fraud_service/app.py
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
FIX: Your MONGO_URI already contains the DB name:
       mongodb://127.0.0.1:27017/karigarConnect
     PyMongo can read this directly — no separate DB_NAME needed.
     We extract the DB name from the URI so it always stays in sync.

BUGFIX (v3.1):
  - Force host="127.0.0.1" (IPv4) instead of "0.0.0.0" to prevent
    Node.js from connecting via ::1 (IPv6) and getting ECONNREFUSED.
  - Added allow_unsafe_werkzeug=True for Flask-SocketIO dev mode.
  - Wrapped socketio.run() in try/finally for clean shutdown.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
"""

import os
import logging
from flask import Flask
from flask_socketio import SocketIO
from flask_cors import CORS
from pymongo import MongoClient
from pymongo.errors import ServerSelectionTimeoutError
from dotenv import load_dotenv


# ── Load .env ─────────────────────────────────────
_here = os.path.dirname(os.path.abspath(__file__))

for _p in [
    os.path.join(_here, '..', '.env'),
    os.path.join(_here, '.env'),
    os.path.join(_here, '..', '..', '.env'),
]:
    if os.path.exists(_p):
        load_dotenv(_p)
        print(f'[app] .env loaded from: {os.path.abspath(_p)}')
        break


from routes.predict import predict_bp
from routes.actions import actions_bp
from scheduler.daily_scan import start_scheduler, stop_scheduler
from utils.model_loader import get_loader


logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] %(name)s: %(message)s',
)

logger = logging.getLogger(__name__)


# ── Extract DB name from URI ──────────────────────
def _get_db_name_from_uri(uri: str, fallback: str = "karigarConnect") -> str:

    uri_clean = uri.split("?")[0].rstrip("/")
    parts = uri_clean.rsplit("/", 1)

    if len(parts) == 2:
        candidate = parts[1]

        if candidate and ":" not in candidate:
            return candidate

    return fallback


# ── Create Flask App ──────────────────────────────
def create_app():

    app = Flask(__name__)
    CORS(app, resources={r"/*": {"origins": "*"}})

    # ── MongoDB Config ────────────────────────────
    MONGO_URI = os.environ.get(
        "MONGO_URI",
        "mongodb://127.0.0.1:27017/karigarConnect"
    )

    DB_NAME = _get_db_name_from_uri(
        MONGO_URI,
        fallback="karigarConnect"
    )

    logger.info(f"MONGO_URI : {MONGO_URI}")
    logger.info(f"DB_NAME   : {DB_NAME}  (extracted from URI)")

    mongo_client = MongoClient(
        MONGO_URI,
        serverSelectionTimeoutMS=8000
    )

    db = mongo_client[DB_NAME]
    app.config["MONGO_DB"] = db


    # ── Verify MongoDB connection ─────────────────
    try:

        mongo_client.server_info()

        total = db.users.count_documents({})
        workers = db.users.count_documents({"role": "worker"})
        clients = db.users.count_documents({"role": "client"})

        logger.info(f'✅ MongoDB connected → "{DB_NAME}"')
        logger.info(
            f"   users: total={total}  workers={workers}  clients={clients}"
        )

        if total == 0:
            all_dbs = mongo_client.list_database_names()
            logger.warning(
                f'⚠️  No users in "{DB_NAME}". All DBs: {all_dbs}'
            )

    except ServerSelectionTimeoutError as e:
        logger.error(f"❌ MongoDB unreachable: {e}")


    # ── MongoDB Indexes ───────────────────────────
    try:

        db.fraudqueue.create_index("userId", unique=True)
        db.fraudqueue.create_index([("fraudProb", -1)])
        db.fraudqueue.create_index("actioned")

        db.fraudpredictions.create_index(
            [("userId", 1), ("predictedAt", -1)]
        )

        db.fraudactions.create_index([("takenAt", -1)])

    except Exception as e:
        logger.warning(f"Index note (safe): {e}")


    # ── Socket.IO Setup ───────────────────────────
    socketio = SocketIO(
        app,
        cors_allowed_origins="*",
        async_mode="threading",
        logger=False,
        engineio_logger=False,
    )

    app.config["SOCKETIO"] = socketio


    @socketio.on("connect", namespace="/fraud")
    def on_connect():
        logger.info("[Socket] Admin connected → /fraud")


    @socketio.on("disconnect", namespace="/fraud")
    def on_disconnect():
        logger.info("[Socket] Admin disconnected ← /fraud")


    # ── Register Blueprints ───────────────────────
    app.register_blueprint(
        predict_bp,
        url_prefix="/api/fraud"
    )

    app.register_blueprint(
        actions_bp,
        url_prefix="/api/fraud"
    )


    # ── Health Check ──────────────────────────────
    @app.route("/health")
    def health():

        return {
            "status": "ok",
            "service": "fraud-detection",
            "db": DB_NAME,
            "version": "3.1",
        }, 200


    # ── Print All Routes (FIXED) ──────────────────
    logger.info("Registered Flask routes:")

    for rule in sorted(app.url_map.iter_rules(), key=lambda r: r.rule):

        methods = ",".join(
            sorted(rule.methods - {"HEAD", "OPTIONS"})
        )

        logger.info(f"[{methods:10s}] {rule.rule}")


    return app, socketio


# ── Run Application ──────────────────────────────
if __name__ == "__main__":

    app, socketio = create_app()

    logger.info("Loading XGBoost models...")
    get_loader()
    logger.info("Models loaded ✓")

    scheduler = start_scheduler()

    # Use FRAUD_SERVICE_PORT exclusively (never pick up Node.js's PORT var).
    # Locally binds to 127.0.0.1; set FRAUD_SERVICE_HOST=0.0.0.0 for cloud.
    HOST = os.environ.get("FRAUD_SERVICE_HOST", "127.0.0.1")
    PORT = int(os.environ.get("FRAUD_SERVICE_PORT", 5001))

    try:

        logger.info(f"Flask fraud service starting on {HOST}:{PORT}")

        socketio.run(
            app,
            host=HOST,
            port=PORT,
            debug=False,
            use_reloader=False,
            allow_unsafe_werkzeug=True,   # FIX: prevents write()-before-start_response
        )

    finally:

        stop_scheduler()