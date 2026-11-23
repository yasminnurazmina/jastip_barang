import random
import string
from datetime import datetime, timedelta
from read_time import format_id_datetime, get_now

INITIAL_HOURS = 3
MAX_HOURS = 6
RETENTION_HOURS = 48

DATA = {
    "admins": {"admin1": "admin123"},
    "slots": [
        {"kode": f"{row}{num}", "ukuran": size}
        for row, size in [("A", "S"), ("B", "M"), ("C", "L")]
        for num in range(1, 5)
    ],
    "aktif": [
        {
            "token": "TTP-7K3Q9",
            "kode": "B2",
            "barang": "Tas ransel hitam",
            "catatan": "Gantungan kunci merah, stiker bintang",
            "penitip": "Rina Putri",
            "jenis_kontak": "No. HP",
            "kontak": "081234567890",
            "admin": "Andi Pratama",
            "titip_iso": "2026-11-23T08:00:00",
            "batas_iso": "2026-11-23T11:00:00",
            "total_hours": 3,
            "status": "Stored",
        },
        {
            "token": "TTP-4M8P2",
            "kode": "B1",
            "barang": "Helm full-face",
            "catatan": "Merek KYT, stiker biru di bagian belakang",
            "penitip": "Dimas A.",
            "jenis_kontak": "No. HP",
            "kontak": "081298765432",
            "admin": "admin1",
            "titip_iso": "2026-11-23T07:30:00",
            "batas_iso": "2026-11-23T10:30:00",
            "total_hours": 3,
            "status": "Request_Pickup",
        },
    ],
    "riwayat": [
        {
            "kode": "A1",
            "barang": "Payung",
            "penitip": "Budi S.",
            "titip": "22 Nov 2026, 13.00",
            "selesai": "22 Nov 2026, 15.40",
            "selesai_iso": "2026-11-22T15:40:00",
            "status": "Returned",
            "admin": "admin1",
        }
    ],
}


def purge_old_records(now: datetime | None = None) -> int:
    """
    DELETE (CRUD): Automatically removes records older than 48 hours.
    - Active items: deleted 48h after drop-off (titip_iso).
    - Returned items: deleted 48h after return (selesai_iso).
    Returns total number of deleted records.
    """
    current = now or get_now()
    cutoff = current - timedelta(hours=RETENTION_HOURS)

    before_count = len(DATA["aktif"]) + len(DATA["riwayat"])

    DATA["aktif"] = [
        item for item in DATA["aktif"]
        if datetime.fromisoformat(item["titip_iso"]) > cutoff
    ]
    DATA["riwayat"] = [
        item for item in DATA["riwayat"]
        if datetime.fromisoformat(item["selesai_iso"]) > cutoff
    ]

    return before_count - (len(DATA["aktif"]) + len(DATA["riwayat"]))


def generate_token() -> str:
    existing = {item["token"] for item in DATA["aktif"]}
    while True:
        code = "TTP-" + "".join(random.choices(string.ascii_uppercase + string.digits, k=5))
        if code not in existing:
            return code


def resolve_status(item: dict, now: datetime | None = None) -> str:
    current = now or get_now()
    batas_dt = datetime.fromisoformat(item["batas_iso"])
    if item["status"] != "Returned" and current > batas_dt:
        return "Expired"
    return item["status"]


def serialize_aktif(item: dict, now: datetime | None = None) -> dict:
    current = now or get_now()
    titip_dt = datetime.fromisoformat(item["titip_iso"])
    batas_dt = datetime.fromisoformat(item["batas_iso"])
    return {
        **item,
        "status": resolve_status(item, current),
        "titip_full": format_id_datetime(titip_dt),
        "batas": format_id_datetime(batas_dt),
    }


def get_admin_snapshot() -> dict:
    now = get_now()
    purge_old_records(now)
    return {
        "slots": DATA["slots"],
        "aktif": [serialize_aktif(item, now) for item in DATA["aktif"]],
        "riwayat": DATA["riwayat"],
        "server_time_display": format_id_datetime(now),
    }


def add_penitipan(payload: dict) -> dict:
    now = get_now()
    purge_old_records(now)

    if any(x["kode"] == payload["kode"] for x in DATA["aktif"]):
        raise ValueError(f"Rak {payload['kode']} sudah terisi.")

    batas_dt = now + timedelta(hours=INITIAL_HOURS)
    record = {
        "token": generate_token(),
        "kode": payload["kode"],
        "barang": payload["barang"].strip(),
        "catatan": payload.get("catatan", "").strip(),
        "penitip": payload["nama"].strip(),
        "jenis_kontak": payload.get("jenis", "No. HP"),
        "kontak": payload.get("kontak", "").strip(),
        "admin": payload.get("admin", "admin1"),
        "titip_iso": now.isoformat(timespec="seconds"),
        "batas_iso": batas_dt.isoformat(timespec="seconds"),
        "total_hours": INITIAL_HOURS,
        "status": "Stored",
    }
    DATA["aktif"].insert(0, record)
    return serialize_aktif(record, now)


def return_penitipan(token: str, admin: str = "admin1") -> dict:
    now = get_now()
    purge_old_records(now)

    idx = next((i for i, x in enumerate(DATA["aktif"]) if x["token"] == token), None)
    if idx is None:
        raise KeyError("Data penitipan tidak ditemukan atau sudah terhapus (>48 jam).")

    item = DATA["aktif"].pop(idx)
    titip_dt = datetime.fromisoformat(item["titip_iso"])
    history_entry = {
        "kode": item["kode"],
        "barang": item["barang"],
        "penitip": item["penitip"],
        "titip": format_id_datetime(titip_dt),
        "selesai": format_id_datetime(now),
        "selesai_iso": now.isoformat(timespec="seconds"),
        "status": "Returned",
        "admin": admin,
    }
    DATA["riwayat"].insert(0, history_entry)
    return history_entry


def find_by_token(token: str) -> dict | None:
    now = get_now()
    purge_old_records(now)
    return next((x for x in DATA["aktif"] if x["token"] == token.upper()), None)


def extend_one_hour(token: str) -> dict:
    item = find_by_token(token)
    if not item:
        raise KeyError("Token tidak ditemukan atau sudah kedaluwarsa (>48 jam).")
    if item["status"] == "Request_Pickup":
        raise ValueError("Tidak dapat memperpanjang saat status Request_Pickup.")
    if item["total_hours"] >= MAX_HOURS:
        raise ValueError("Batas maksimal penitipan adalah 6 jam (tidak dapat diperpanjang lagi).")

    current_batas = datetime.fromisoformat(item["batas_iso"])
    new_batas = current_batas + timedelta(hours=1)
    item["batas_iso"] = new_batas.isoformat(timespec="seconds")
    item["total_hours"] += 1
    return serialize_aktif(item)


def request_early_pickup(token: str) -> dict:
    item = find_by_token(token)
    if not item:
        raise KeyError("Token tidak ditemukan atau sudah kedaluwarsa (>48 jam).")
    item["status"] = "Request_Pickup"
    return serialize_aktif(item)