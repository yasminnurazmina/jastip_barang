var slots = [], aktif = [], riwayat = [], serverTime = '';
var draft = {}, pilih = null, filter = 'Semua', toast = '', qrModal = null;

function loadState() {
  return fetch('/api/admin/state')
    .then(function (r) { return r.json(); })
    .then(function (d) {
      slots = d.slots;
      aktif = d.aktif;
      riwayat = d.riwayat;
      serverTime = d.server_time_display;
      render();
    });
}

function getAdminTimeInfo(item) {
  var now = new Date();
  var batas = new Date(item.batas_iso);
  var diffMin = Math.floor((batas - now) / 60000);
  var effectiveStatus = (diffMin < 0 && item.status !== 'Returned') ? 'Expired' : item.status;
  var notice = '';

  if (diffMin < 0) {
    var late = Math.abs(diffMin);
    if (late >= 30) {
      notice = '30 menit setelah waktu pengambilan (lewat ' + late + ' menit)';
    } else if (late <= 15) {
      notice = '15 menit setelah waktu pengambilan (lewat ' + late + ' menit)';
    } else {
      notice = 'Melewati batas pengambilan (lewat ' + late + ' menit)';
    }
  } else if (diffMin <= 15) {
    notice = 'Menjelang waktu pengambilan (' + diffMin + ' menit lagi)';
  }

  return { status: effectiveStatus, notice: notice };
}

function terisi(k) { return aktif.some(function (a) { return a.kode === k; }); }
function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

function nav(h) {
  return '<nav><h1>Penitipan Barang</h1>' +
    [['titip', 'Tambah Penitipan'], ['daftar', 'Jadwal'], ['riwayat', 'Riwayat']]
      .map(function (x) {
        return '<a href="#' + x[0] + '" class="' + (h === x[0] || (h === 'rak' && x[0] === 'titip') ? 'on' : '') + '">' + x[1] + '</a>';
      }).join('') +
    '<div class="who">Masuk sebagai admin1<br><a href="#login" style="display:inline;padding:0;color:var(--acc)">Keluar</a></div></nav>';
}

function shell(h, body) {
  return '<div class="shell">' + nav(h) + '<main>' + body + '</main></div>' +
    (toast ? '<div class="toast" role="status">' + toast + '</div>' : '');
}

function pLogin() {
  return '<div class="login"><h2>Masuk</h2><p class="sub">Untuk petugas penitipan.</p>' +
    '<div class="card"><label for="u">Username</label><input id="u" value="admin1" autocomplete="username">' +
    '<label for="p">Password</label><input id="p" type="password" value="admin123" autocomplete="current-password">' +
    '<div class="actions"><button class="btn" onclick="doLogin()">Masuk</button></div></div></div>';
}

function doLogin() {
  fetch('/api/admin/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: v('u') })
  }).then(function (r) {
    if (r.ok) { loadState(); location.hash = 'titip'; }
    else { alert('Login gagal'); }
  });
}

var KONTAK = {
  'No. HP': { ph: '08xxxxxxxxxx', type: 'tel', hint: 'Contoh: 081234567890.' },
  'Email': { ph: 'abc@email.com', type: 'email', hint: 'Contoh: abc@email.com.' },
  'Username sosmed': { ph: '@your_acc', type: 'text', hint: 'Contoh: @your_acc.' }
};

function pTitip() {
  return shell('titip',
    '<h2>Tambah Penitipan</h2><p class="sub">Langkah 1 dari 2 · Data penitip dan barang</p>' +
    '<div class="card"><label for="nama">Nama penitip</label><input id="nama" value="' + esc(draft.nama || '') + '" placeholder="Nama lengkap">' +
    '<label for="barang">Barang yang dititipkan</label><input id="barang" value="' + esc(draft.barang || '') + '" placeholder="Contoh: Tas ransel hitam">' +
    '<label for="catatan">Catatan tambahan (opsional)</label><textarea id="catatan" rows="3" placeholder="Contoh: sepatu Nike ukuran 32, stiker bintang">' + esc(draft.catatan || '') + '</textarea>' +
    '<div class="row"><div><label for="jenis">Jenis kontak</label><select id="jenis" onchange="gantiJenis()">' +
    Object.keys(KONTAK).map(function (j) { return '<option' + ((draft.jenis || 'No. HP') === j ? ' selected' : '') + '>' + j + '</option>'; }).join('') +
    '</select></div><div><label for="kontak">Kontak</label><input id="kontak" type="' + KONTAK[draft.jenis || 'No. HP'].type + '" value="' + esc(draft.kontak || '') + '" placeholder="' + KONTAK[draft.jenis || 'No. HP'].ph + '"></div></div>' +
    '<div class="hint" id="kHint">' + KONTAK[draft.jenis || 'No. HP'].hint + '</div>' +
    '<div class="actions"><button class="btn" onclick="lanjut()">Lanjut pilih rak</button></div></div>'
  );
}

function gantiJenis() {
  var k = KONTAK[v('jenis')], i = document.getElementById('kontak');
  i.type = k.type; i.placeholder = k.ph; i.value = '';
  document.getElementById('kHint').textContent = k.hint;
}

function lanjut() {
  if (!v('nama').trim() || !v('barang').trim()) {
    toast = 'Nama penitip dan barang wajib diisi';
    render();
    setTimeout(function () { toast = ''; render(); }, 2500);
    return;
  }
  draft = { nama: v('nama'), barang: v('barang'), catatan: v('catatan'), jenis: v('jenis'), kontak: v('kontak') };
  pilih = null;
  location.hash = 'rak';
}

function v(i) { return document.getElementById(i).value; }

function pRak() {
  var d = draft;
  if (!d.nama) { location.hash = 'titip'; return ''; }
  var g = slots.map(function (s) {
    var full = terisi(s.kode), c = full ? 'full' : (pilih === s.kode ? 'sel' : '');
    return '<button class="slot ' + c + '" ' + (full ? 'disabled' : 'onclick="pilihRak(\'' + s.kode + '\')"') + '><b>' + s.kode + '</b><span>' + (full ? 'Terisi' : 'Ukuran ' + s.ukuran + ' · kosong') + '</span></button>';
  }).join('');

  return shell('rak',
    '<h2>Pilih rak</h2><p class="sub">Langkah 2 dari 2 · Durasi awal penitipan otomatis 3 jam</p>' +
    '<div class="sum"><b>' + esc(d.nama) + '</b> menitipkan <b>' + esc(d.barang) + '</b>' +
    (d.catatan ? '<br>Catatan: ' + esc(d.catatan) : '') +
    '<br>' + esc(d.jenis) + ': ' + esc(d.kontak || '–') + '</div>' +
    '<div class="card"><div class="grid">' + g + '</div>' +
    '<div class="legend"><span>Bingkai tebal = dipilih</span><span>Garis putus = terisi</span></div>' +
    '<div class="sum" style="margin-top:16px;margin-bottom:0">Durasi awal: <b>3 jam</b> sejak disimpan (pengunjung dapat memperpanjang +1 jam hingga maksimal 6 jam).</div>' +
    '<div class="actions"><button class="btn ghost" onclick="location.hash=\'titip\'">Kembali</button>' +
    '<button class="btn" ' + (pilih ? '' : 'disabled') + ' onclick="kirim()">Simpan penitipan</button></div></div>'
  );
}

function pilihRak(k) { pilih = k; render(); }

function kirim() {
  fetch('/api/admin/titip', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      kode: pilih,
      nama: draft.nama,
      barang: draft.barang,
      catatan: draft.catatan,
      jenis: draft.jenis,
      kontak: draft.kontak
    })
  }).then(function (r) { return r.json().then(function (j) { return { ok: r.ok, body: j }; }); })
    .then(function (res) {
      if (!res.ok) {
        toast = res.body.error; render();
        setTimeout(function () { toast = ''; render(); }, 2500);
        return;
      }
      qrModal = res.body.item;
      draft = {}; pilih = null;
      loadState().then(function () { location.hash = 'daftar'; });
    });
}

function qrBox() {
  if (!qrModal) return '';
  var link = location.origin + '/?token=' + encodeURIComponent(qrModal.token);
  return '<div class="card" style="margin-bottom:14px;text-align:center">' +
    '<b>QR Penitipan · Rak ' + esc(qrModal.kode) + ' (' + esc(qrModal.penitip) + ')</b>' +
    '<p class="hint">Minta pengunjung memindai QR ini untuk memantau waktu & perpanjangan.</p>' +
    '<div style="background:#fff;display:inline-block;padding:10px;border-radius:8px;border:1px solid var(--line);margin:8px 0">' +
    '<img src="/api/qr/' + encodeURIComponent(qrModal.token) + '" alt="QR ' + esc(qrModal.token) + '" style="width:180px;height:180px;display:block"></div>' +
    '<div style="font-family:monospace;font-weight:700;font-size:18px">' + esc(qrModal.token) + '</div>' +
    '<div class="hint"><a href="' + link + '" target="_blank" style="color:var(--acc)">Buka halaman pengunjung ↗</a></div>' +
    '<div class="actions" style="justify-content:center"><button class="btn sm" onclick="qrModal=null;render()">Tutup</button></div></div>';
}

function badgeClass(status) {
  if (status === 'Stored') return 'badge';
  if (status === 'Request_Pickup') return 'badge w';
  return 'badge n';
}

function pDaftar() {
  var nowStr = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
  var rows = aktif.map(function (a, i) {
    var info = getAdminTimeInfo(a);
    return '<tr>' +
      '<td><b>' + a.kode + '</b><div class="hint">' + esc(a.token) + '</div></td>' +
      '<td>' + esc(a.barang) + (a.catatan ? '<div class="hint">' + esc(a.catatan) + '</div>' : '') + '</td>' +
      '<td>' + esc(a.penitip) + '</td>' +
      '<td>' + a.titip_full + '</td>' +
      '<td>' + a.batas + (info.notice ? '<div class="err">' + esc(info.notice) + '</div>' : '') + '</td>' +
      '<td><span class="' + badgeClass(info.status) + '">' + esc(info.status) + '</span></td>' +
      '<td><div style="display:flex;gap:6px">' +
      '<button class="btn sm" onclick="ambil(' + i + ')">Returned</button>' +
      '<button class="btn sm ghost" onclick="qrModal=aktif[' + i + '];render()">QR</button>' +
      '</div></td></tr>';
  }).join('');

  return shell('daftar',
    '<h2>Jadwal</h2><p class="sub">' + aktif.length + ' barang masih di rak · Waktu sekarang: ' + nowStr + '</p>' +
    qrBox() +
    '<div class="card tw">' +
    (aktif.length
      ? '<table><tr><th>Rak</th><th>Barang</th><th>Penitip</th><th>Waktu titip</th><th>Batas ambil</th><th>Status</th><th></th></tr>' + rows + '</table>'
      : '<p>Belum ada barang di rak. Mulai dari “Tambah Penitipan”.</p>') +
    '</div>'
  );
}

function ambil(i) {
  var item = aktif[i];
  fetch('/api/admin/aktif/' + encodeURIComponent(item.token) + '/return', { method: 'POST' })
    .then(function () {
      toast = 'Barang di rak ' + item.kode + ' ditandai Returned';
      loadState();
      setTimeout(function () { toast = ''; render(); }, 2500);
    });
}

function pRiwayat() {
  var r = riwayat.filter(function (x) { return filter === 'Semua' || x.status === filter; });
  return shell('riwayat',
    '<h2>Riwayat penitipan</h2><p class="sub">Barang yang telah dikembalikan (Returned)</p>' +
    '<div class="card tw"><table><tr><th>Rak</th><th>Barang</th><th>Penitip</th><th>Waktu titip</th><th>Waktu kembali</th><th>Status</th><th>Dicatat</th></tr>' +
    r.map(function (x) {
      return '<tr><td><b>' + x.kode + '</b></td><td>' + esc(x.barang) + '</td><td>' + esc(x.penitip) + '</td>' +
        '<td>' + x.titip + '</td><td>' + x.selesai + '</td><td><span class="badge">' + esc(x.status) + '</span></td><td>' + esc(x.admin) + '</td></tr>';
    }).join('') +
    '</table></div>'
  );
}

var pages = { login: pLogin, titip: pTitip, rak: pRak, daftar: pDaftar, riwayat: pRiwayat };
function render() {
  var h = location.hash.slice(1);
  if (!pages[h]) h = 'login';
  document.getElementById('app').innerHTML = pages[h]();
}

window.addEventListener('hashchange', render);
setInterval(function () { if (location.hash === '#daftar') loadState(); }, 15000);
loadState();