var TOKEN = 'TTP-7K3Q9';
var P = null, view = 'gate', panel = null, msg = '', err = '';
var BL = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];

function p2(n) { return String(n).padStart(2, '0'); }
function fmt(d) { return d.getDate() + ' ' + BL[d.getMonth()] + ' ' + d.getFullYear() + ', ' + p2(d.getHours()) + '.' + p2(d.getMinutes()); }
function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

function getVisitorTimeInfo() {
  var now = new Date();
  var batas = new Date(P.batasIso);
  var diffMin = Math.floor((batas - now) / 60000);
  var effectiveStatus = (diffMin < 0 && P.status !== 'Returned') ? 'Expired' : P.status;
  var notice = '';

  if (diffMin > 0 && diffMin <= 15) {
    notice = 'Perhatian: 15 menit sebelum waktu pengambilan barang Anda (' + diffMin + ' menit lagi).';
  } else if (diffMin <= 0 && diffMin >= -15) {
    notice = diffMin === 0
      ? 'Waktu pengambilan telah tiba (0–15 menit setelah batas ambil).'
      : 'Perhatian: 15 menit setelah waktu pengambilan (lewat ' + Math.abs(diffMin) + ' menit). Segera ambil barang Anda.';
  } else if (diffMin < -15) {
    notice = 'Batas waktu pengambilan telah berakhir (Expired · lewat ' + Math.abs(diffMin) + ' menit).';
  }

  return { status: effectiveStatus, notice: notice };
}

function hydrateData(d) {
  TOKEN = d.token;
  P = {
    nama: d.penitip,
    barang: d.barang,
    catatan: d.catatan,
    rak: d.kode,
    admin: d.admin,
    titip: new Date(d.titip_iso),
    batas: new Date(d.batas_iso),
    batasIso: d.batas_iso,
    totalHours: d.total_hours,
    status: d.status
  };
}

function qr(seed) {
  return '<img src="/api/qr/' + encodeURIComponent(seed) + '" alt="QR Code penitipan" style="width:200px;height:200px;display:block">';
}

function badge(status) {
  var cls = status === 'Stored' ? 'badge' : 'badge w';
  return '<span class="' + cls + '">' + esc(status) + '</span>';
}

function gate() {
  return '<div class="wrap"><div class="brand">Penitipan Barang</div><h2>Cek penitipan saya</h2>' +
    '<p class="sub">Pindai QR dari admin, atau masukkan token Anda.</p>' +
    '<div class="card"><label for="tok">Token</label><input id="tok" value="' + TOKEN + '" placeholder="Contoh: TTP-7K3Q9" autocomplete="off">' +
    '<div class="hint">Token contoh sudah terisi untuk percobaan.</div><div class="err" id="gerr"></div>' +
    '<div class="stack"><button class="btn" onclick="masuk()">Lihat status</button></div></div></div>';
}

function masuk() {
  var t = document.getElementById('tok').value.trim().toUpperCase();
  fetch('/api/penitip/' + encodeURIComponent(t))
    .then(function (r) { return r.json().then(function (j) { return { ok: r.ok, body: j }; }); })
    .then(function (res) {
      if (!res.ok) {
        document.getElementById('gerr').textContent = res.body.error;
        return;
      }
      hydrateData(res.body.data);
      view = 'detail';
      render();
    });
}

function detail() {
  var info = getVisitorTimeInfo();
  var isRequestPickup = info.status === 'Request_Pickup';
  var isMaxHours = P.totalHours >= 6;

  var h = '<div class="wrap"><div class="brand">Penitipan Barang' +
    '<button class="brand a" style="color:var(--acc);background:none;border:0;font:inherit;font-size:14px;cursor:pointer" onclick="view=\'gate\';panel=null;msg=\'\';err=\'\';render()">Keluar</button></div>';

  h += '<div class="head"><div><h2>Penitipan Anda</h2><p class="sub">Halo, ' + esc(P.nama) + '</p></div>' + badge(info.status) + '</div>';

  if (msg) h += '<div class="note ok" role="status">' + esc(msg) + '</div>';
  if (err) h += '<div class="note" role="alert">' + esc(err) + '</div>';
  if (info.notice) h += '<div class="note" role="status">' + esc(info.notice) + '</div>';

  if (isRequestPickup) {
    h += '<div class="note">Pengajuan ambil lebih awal (<b>Request_Pickup</b>) aktif. Datanglah ke loker dan tunjukkan QR ini ke admin untuk menyelesaikan pengambilan.</div>';
  }

  h += '<div class="card qrbox"><div class="qr">' + qr(TOKEN) + '</div><div class="tok">' + TOKEN + '</div>' +
    '<div class="hint">Tunjukkan QR atau token ini ke admin saat mengambil barang.<br>Berlaku sampai ' + fmt(P.batas) + ' (Total durasi: ' + P.totalHours + ' / 6 jam)</div></div>';

  h += '<div class="card"><dl>' +
    '<dt>Barang</dt><dd>' + esc(P.barang) + '</dd>' +
    '<dt>Catatan</dt><dd>' + esc(P.catatan || '–') + '</dd>' +
    '<dt>Rak</dt><dd>' + P.rak + '</dd>' +
    '<dt>Dititipkan</dt><dd>' + fmt(P.titip) + '</dd>' +
    '<dt>Batas Ambil</dt><dd>' + fmt(P.batas) + '</dd>' +
    '<dt>Waktu Sekarang</dt><dd>' + fmt(new Date()) + '</dd>' +
    '</dl></div>';

  h += '<div class="card pj"><div class="av" aria-hidden="true">' + P.admin.charAt(0) + '</div>' +
    '<div><small>Penanggung jawab penitipan</small><b>Admin ' + esc(P.admin) + '</b></div></div>';

  if (!panel) {
    h += '<div class="two">' +
      '<button class="btn" ' + (isRequestPickup ? 'disabled' : 'onclick="perpanjangSatuJam()"') + '>Perpanjang +1 Jam</button>' +
      '<button class="btn ghost" ' + (isRequestPickup ? 'disabled' : 'onclick="panel=\'awal\';err=\'\';msg=\'\';render()"') + '>Ambil lebih awal</button>' +
      '</div>';

    if (isMaxHours) {
      h += '<div class="err">Durasi penitipan sudah mencapai batas maksimal 6 jam dan tidak dapat diperpanjang lagi.</div>';
    } else if (isRequestPickup) {
      h += '<div class="hint">Perpanjangan tidak tersedia karena Anda sudah mengajukan ambil lebih awal.</div>';
    } else {
      h += '<div class="hint">Setiap perpanjangan menambah 1 jam (sisa kuota perpanjangan: ' + (6 - P.totalHours) + ' jam).</div>';
    }
  }

  if (panel === 'awal') {
    h += '<div class="card"><b>Ambil barang lebih awal?</b>' +
      //'<p style="margin:8px 0 0">Status penitipan akan berubah menjadi <b>Request_Pickup</b>. Barang baru berstatus <b>Returned</b> setelah Admin ' + esc(P.admin) + ' mengonfirmasi di loker.</p>' +
      '<p style="margin:8px 0 0">Saat Anda mencapai tempat penitipan, Admin akan mengonfirmasi bahwa barang telah dikembalikan.</p>' +
      '<div class="two"><button class="btn ghost" onclick="panel=null;render()">Kembali</button>' +
      '<button class="btn" onclick="ajukanAwal()">Ya, ambil lebih awal</button></div></div>';
  }

  return h + '</div>';
}

function perpanjangSatuJam() {
  err = ''; msg = '';
  if (P.totalHours >= 6) {
    err = 'Tidak dapat memperpanjang: batas maksimal penitipan adalah 6 jam.';
    render();
    return;
  }
  fetch('/api/penitip/' + encodeURIComponent(TOKEN) + '/perpanjang', { method: 'POST' })
    .then(function (r) { return r.json().then(function (j) { return { ok: r.ok, body: j }; }); })
    .then(function (res) {
      if (!res.ok) {
        err = res.body.error;
        render();
        return;
      }
      hydrateData(res.body.data);
      msg = 'Batas ambil diperpanjang +1 jam menjadi ' + fmt(P.batas) + ' (Total ' + P.totalHours + ' dari 6 jam).';
      render();
    });
}

function ajukanAwal() {
  fetch('/api/penitip/' + encodeURIComponent(TOKEN) + '/awal', { method: 'POST' })
    .then(function (r) { return r.json(); })
    .then(function (res) {
      if (res.ok) {
        hydrateData(res.data);
        panel = null;
        msg = 'Status diubah menjadi Request_Pickup.';
        render();
      }
    });
}

function render() { document.getElementById('app').innerHTML = view === 'gate' ? gate() : detail(); }

setInterval(function () { if (view === 'detail' && !panel) render(); }, 15000);

var urlToken = new URLSearchParams(window.location.search).get('token');
if (urlToken) {
  TOKEN = urlToken.trim().toUpperCase();
  render();
  masuk();
} else {
  render();
}