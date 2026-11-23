import io
import sys
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parent
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

import qrcode
import qrcode.image.svg
from flask import Flask, Response, jsonify, request, send_from_directory
from read_time import format_id_datetime, get_now
from storedata import (
    DATA,
    add_penitipan,
    extend_one_hour,
    find_by_token,
    request_early_pickup,
    return_penitipan,
    serialize_aktif,
)

FRONTEND_DIR = BACKEND_DIR.parent / "frontend"
app = Flask(__name__, static_folder=str(FRONTEND_DIR), static_url_path="")


@app.get("/")
def visitor_page():
    return send_from_directory(FRONTEND_DIR, "penitip.html")


@app.get("/admin")
def admin_page():
    return send_from_directory(FRONTEND_DIR, "admin.html")


@app.get("/<path:filename>")
def static_files(filename):
    return send_from_directory(FRONTEND_DIR, filename)


@app.get("/api/qr/<token>")
def api_qr(token):
    clean_token = token.strip().upper()
    visitor_url = f"{request.host_url}?token={clean_token}"
    img = qrcode.make(visitor_url, image_factory=qrcode.image.svg.SvgPathImage)
    buf = io.BytesIO()
    img.save(buf)
    return Response(buf.getvalue(), mimetype="image/svg+xml")


@app.post("/api/admin/login")
def api_admin_login():
    body = request.get_json(silent=True) or {}
    username = body.get("username", "").strip()
    if username in DATA["admins"]:
        return jsonify({"ok": True, "admin": username})
    return jsonify({"ok": False, "error": "Username tidak dikenal."}), 401


@app.get("/api/admin/state")
def api_admin_state():
    now = get_now()
    return jsonify({
        "slots": DATA["slots"],
        "aktif": [serialize_aktif(item, now) for item in DATA["aktif"]],
        "riwayat": DATA["riwayat"],
        "server_time_display": format_id_datetime(now),
    })


@app.post("/api/admin/titip")
def api_admin_titip():
    body = request.get_json(silent=True) or {}
    try:
        created = add_penitipan(body)
        return jsonify({"ok": True, "item": created}), 201
    except (ValueError, KeyError) as exc:
        return jsonify({"ok": False, "error": str(exc)}), 400


@app.post("/api/admin/aktif/<token>/return")
def api_admin_return(token):
    try:
        entry = return_penitipan(token)
        return jsonify({"ok": True, "riwayat": entry})
    except KeyError as exc:
        return jsonify({"ok": False, "error": str(exc)}), 404


@app.get("/api/penitip/<token>")
def api_penitip_detail(token):
    item = find_by_token(token)
    if not item:
        return jsonify({"ok": False, "error": "Token tidak ditemukan atau barang sudah dikembalikan."}), 404
    return jsonify({"ok": True, "data": serialize_aktif(item)})


@app.post("/api/penitip/<token>/perpanjang")
def api_penitip_perpanjang(token):
    try:
        updated = extend_one_hour(token)
        return jsonify({"ok": True, "data": updated})
    except (ValueError, KeyError) as exc:
        return jsonify({"ok": False, "error": str(exc)}), 400


@app.post("/api/penitip/<token>/awal")
def api_penitip_awal(token):
    try:
        updated = request_early_pickup(token)
        return jsonify({"ok": True, "data": updated})
    except KeyError as exc:
        return jsonify({"ok": False, "error": str(exc)}), 404


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=False)