/* ════════════════════════════════════════════════════════════
   camera.js — Kamera & Upload Logic
   ════════════════════════════════════════════════════════════ */

let stream        = null;
let cameraOn      = false;
let facingMode    = 'user';          // 'user' | 'environment'
let captureCount  = 0;
let currentB64 = window._currentB64 = null;
window._currentB64 = null; // shared with dashboard.js
let cameraMode    = 'front';         // 'front' | 'rear'
let sessionAnalyses = 0;

window.TXT = window.TXT || {
  on: 'Menyala',
  off: 'Matikan',
  retry: 'Coba Lagi',
  camErr: 'Gagal akses kamera',
  captured: 'Foto diambil!',
  analyzing: 'Menganalisis...',
  done: 'Analisis selesai',
  noImg: 'Tidak ada gambar untuk diunduh',
  cleared: 'Riwayat dihapus',
  deleted: 'Analisis dihapus',
  reportOk: 'Pengaduan terkirim!',
  typeMsg: 'Ketik pesan terlebih dahulu',
  enterYear: 'Masukkan tahun ban untuk melihat kelayakan',
  replaceNow: 'Ban harus diganti',
  stillGood: 'Ban masih layak',
  years: 'tahun',
  notTireMsg: 'Gambar yang diupload bukan ban. Silakan ambil foto ban yang jelas.',
};

const video       = () => document.getElementById('video');
const canvas      = () => document.getElementById('canvas');
const noCamState  = () => document.getElementById('noCamState');
const camOffState = () => document.getElementById('camOffState');
const noCamMsg    = () => document.getElementById('noCamMsg');
const statusBadge = () => document.getElementById('statusBadge');
const statusDot   = () => document.getElementById('statusDot');
const statusText  = () => document.getElementById('statusText');
const captureBtn  = () => document.getElementById('captureBtn');
const retryBtn    = () => document.getElementById('retryBtn');
const toggleBtn   = () => document.getElementById('btnToggleCam');
const toggleLbl   = () => document.getElementById('toggleCamLabel');

function renderToggleButton(isOn) {
  const btn = toggleBtn();
  if (!btn) return;
  const label = isOn ? TXT.off : TXT.on;
  btn.innerHTML = `
    <svg viewBox="0 0 24 24" style="width:14px;height:14px;stroke:currentColor;fill:none;stroke-width:2">
      ${isOn ? '<path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/><circle cx="12" cy="13" r="4"/>' : '<line x1="1" y1="1" x2="23" y2="23"/><path d="M21 21H3a2 2 0 01-2-2V8"/>'}
    </svg>${label}`;
}

function getActiveStream() {
  if (stream instanceof MediaStream) return stream;
  const v = video();
  if (v && v.srcObject instanceof MediaStream) return v.srcObject;
  return null;
}

function isStreamActive(ms) {
  if (!ms) return false;
  return ms.getTracks().some(track => track.readyState === 'live' && track.enabled);
}

function stopCamera() {
  const activeStream = getActiveStream();
  const streamInfo = activeStream ? activeStream.getTracks().map(t => ({kind:t.kind, enabled:t.enabled, readyState:t.readyState})) : null;
  console.error('stopCamera debug:', {cameraOn, stream: !!stream, activeStream: !!activeStream, streamInfo});
  if (!activeStream) {
    console.warn('stopCamera: no active stream to stop');
    return false;
  }

  try {
    activeStream.getTracks().forEach(track => {
      try {
        track.stop();
      } catch (err) {
        console.warn('stopCamera: failed to stop track', err);
      }
    });
  } catch (err) {
    console.error('stopCamera: error stopping stream tracks', err);
    return false;
  }

  try {
    const v = video();
    if (v) {
      v.pause();
      v.srcObject = null;
      v.removeAttribute('src');
      v.load();
      v.style.display = 'none';
    }
  } catch (err) {
    console.warn('stopCamera: failed to clear video srcObject', err);
  }

  stream = null;
  cameraOn = false;
  return true;
}

// ── Start camera ──────────────────────────────────────────────
async function getVideoDeviceIdForFacingMode(mode) {
  if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) return null;
  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    const videoInputs = devices.filter(d => d.kind === 'videoinput');
    if (!videoInputs.length) return null;
    if (mode === 'environment') {
      return videoInputs.find(d => /back|rear|environment/i.test(d.label))?.deviceId || null;
    }
    return videoInputs.find(d => /front|user|selfie/i.test(d.label))?.deviceId || null;
  } catch (err) {
    console.warn('Could not enumerate video devices:', err);
    return null;
  }
}

async function startCamera() {
  console.error('startCamera debug:', {cameraOn, streamExists: !!stream});
  statusText().textContent = 'Debug: starting camera...';
  setStatus('starting');
  try {
    if (stream) stopCamera();

    // Mobile-friendly constraints: use ideal values and avoid strict exact match
    const videoConstraints = {
      width:  { ideal: 1280 },
      height: { ideal: 720 },
      facingMode: { ideal: facingMode },
    };

    console.log('Camera constraints:', videoConstraints);

    let stream_attempt = null;
    if (facingMode === 'environment') {
      const envDeviceId = await getVideoDeviceIdForFacingMode('environment');
      if (envDeviceId) {
        try {
          stream_attempt = await navigator.mediaDevices.getUserMedia({
            video: {
              deviceId: { exact: envDeviceId },
              width: { ideal: 1280 },
              height: { ideal: 720 },
            },
            audio: false,
          });
        } catch (errEnv) {
          console.warn('⚠️ Environment deviceId access failed, falling back to facingMode:', errEnv.name);
        }
      }
    }

    try {
      if (!stream_attempt) {
        stream_attempt = await navigator.mediaDevices.getUserMedia({
          video: videoConstraints,
          audio: false,
        });
      }
    } catch (err1) {
      console.warn('⚠️ Failed with preferred constraints, trying generic camera:', err1.name);
      // Fallback: try plain camera access
      try {
        stream_attempt = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: false,
        });
      } catch (err2) {
        console.error('❌ Fallback also failed:', err2.name);
        throw err1; // preserve original error for reporting
      }
    }
    
    stream = stream_attempt;

    console.log('✅ Camera stream acquired:', {
      videoWidth: stream.getVideoTracks()[0]?.getSettings().width,
      videoHeight: stream.getVideoTracks()[0]?.getSettings().height,
      facingMode: stream.getVideoTracks()[0]?.getSettings().facingMode,
    });

    const v = video();
    v.srcObject = stream;
    v.muted = true;
    v.playsInline = true;
    v.setAttribute('playsinline', '');
    v.setAttribute('webkit-playsinline', '');
    await v.play().catch(err => console.warn('Video play warning:', err));
    v.style.display = 'block';
    noCamState().style.display  = 'none';
    camOffState().style.display = 'none';
    cameraOn = true;

    v.onloadedmetadata = () => {
      const w = v.videoWidth, h = v.videoHeight;
      document.getElementById('stRes').textContent = `${w}×${h}`;
      console.log('✅ Video metadata loaded:', {w, h});
    };

    v.onerror = (err) => {
      console.error('❌ Video error:', err);
    };

    setStatus('live');
    cameraOn = true;
    renderToggleButton(true);
    retryBtn().style.display = 'none';

  } catch (err) {
    console.error('❌ Camera error:', err);
    console.error('   Error name:', err.name);
    console.error('   Error message:', err.message);
    
    cameraOn = false;
    stream   = null;
    video().style.display       = 'none';
    noCamState().style.display  = 'flex';
    camOffState().style.display = 'none';
    
    // Provide detailed error message
    let errorMsg = TXT.camErr;
    if (err.name === 'NotAllowedError') {
      errorMsg = '📱 Izin kamera ditolak. Buka Pengaturan → izinkan akses kamera.';
    } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
      errorMsg = '📱 Kamera tidak ditemukan pada perangkat ini.';
    } else if (err.name === 'NotReadableError') {
      errorMsg = '📱 Kamera sedang digunakan aplikasi lain. Tutup aplikasi lain.';
    } else if (err.name === 'OverconstrainedError') {
      errorMsg = '📱 Kamera tidak mendukung resolusi yang diminta. Coba lagi...';
    } else if (err.name === 'TypeError') {
      errorMsg = '📱 getUserMedia tidak didukung di browser ini.';
    }
    
    noCamMsg().textContent = errorMsg + ' (' + err.name + ')';
    setStatus('error');
    retryBtn().style.display = 'inline-flex';
    renderToggleButton(false);
    cameraOn = false;
  }
}

// ── Toggle camera on/off ──────────────────────────────────────
function toggleCamera() {
  const btn = toggleBtn();
  if (!btn) return;

  const activeStream = getActiveStream();
  const active = cameraOn || isStreamActive(activeStream);
  console.error('toggleCamera debug:', {cameraOn, stream: !!stream, activeStream: !!activeStream, active});
  statusText().textContent = `Debug: toggleCamera active=${active}`;
  if (active) {
    if (!stopCamera()) {
      console.error('toggleCamera: failed to stop active stream');
      statusText().textContent = 'Debug: failed to stop active stream';
    } else {
      statusText().textContent = 'Debug: stopCamera success';
    }
    const v = video();
    if (v) {
      v.style.display = 'none';
    }
    noCamState().style.display  = 'none';
    camOffState().style.display = 'flex';
    setStatus('off');
    renderToggleButton(false);
  } else {
    if (activeStream) {
      const staleInfo = activeStream.getTracks().map(t => ({kind:t.kind, enabled:t.enabled, readyState:t.readyState}));
      console.error('toggleCamera: activeStream exists while cameraOn is false, stopping stale stream', staleInfo);
      statusText().textContent = 'Debug: stale stream detected, stopping it';
      stopCamera();
    }
    const stateMgr = new ButtonStateManager(btn);
    stateMgr.setLoading('Mengakses kamera...');
    startCamera().then(() => {
      stateMgr.setSuccess('Kamera aktif', 1000);
    }).catch(err => {
      stateMgr.setError('Gagal mengakses kamera', 2000);
      console.error('Camera start error:', err);
      renderToggleButton(false);
      cameraOn = false;
    });
  }
}

// ── Set camera mode ───────────────────────────────────────────
function setMode(btn, mode, label) {
  cameraMode  = mode;
  facingMode  = mode === 'rear' ? 'environment' : 'user';
  document.querySelectorAll('.cb').forEach(b => b.classList.remove('act'));
  btn.classList.add('act');
  const stM = document.getElementById('stM');
  if (stM) stM.textContent = label;
  const infoModeEl = document.getElementById('infoMode');
  if (infoModeEl) infoModeEl.textContent = label;
  if (cameraOn) startCamera();
}

// ── Retry camera ─────────────────────────────────────────────
function retryCamera() {
  const btn = document.getElementById('retryBtn');
  if (!btn) return;

  const stateMgr = new ButtonStateManager(btn);
  stateMgr.setLoading('Mencoba lagi...');
  startCamera().then(() => {
    stateMgr.setSuccess('Kamera aktif', 1000);
  }).catch(err => {
    stateMgr.setError('Masih gagal', 2000);
    console.error('Camera retry error:', err);
  });
}

// ── Capture photo ─────────────────────────────────────────────
function capturePhoto() {
  const btn = document.getElementById('captureBtn');
  if (!btn) return;

  const v = video();
  if (!cameraOn || !v.videoWidth) {
    showToast(TXT.camErr, 'error'); return;
  }

  const stateMgr = new ButtonStateManager(btn);
  stateMgr.setLoading('Memproses foto...');

  const c  = canvas();
  c.width  = v.videoWidth;
  c.height = v.videoHeight;
  const ctx = c.getContext('2d');

  // Video is already flipped via CSS transform, so no need to mirror here
  ctx.drawImage(v, 0, 0);

  const b64 = c.toDataURL('image/jpeg', 0.92);
  currentB64 = window._currentB64 = b64;
  captureCount++;
  sessionAnalyses++;

  showResultImage(b64);
  addThumbnail(b64);
  updateCounters();
  showToast(TXT.captured, 'success');

  // send to API
  sendToAnalyze(b64).then(() => {
    stateMgr.setSuccess('Analisis selesai', 1500);
  }).catch(err => {
    stateMgr.setError('Gagal menganalisis', 2000);
    console.error('Analysis error:', err);
  });
}

// ── Handle file upload ────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  const inp = document.getElementById('uploadInput');
  if (inp) {
    inp.addEventListener('change', e => {
      const file = e.target.files[0];
      if (!file) return;

      const btn = document.getElementById('uploadBtn');
      const stateMgr = btn ? new ButtonStateManager(btn) : null;
      if (stateMgr) stateMgr.setLoading('Memproses file...');

      const reader = new FileReader();
      reader.onload = ev => {
        const b64 = ev.target.result;
        currentB64 = window._currentB64 = b64;
        captureCount++;
        sessionAnalyses++;
        showResultImage(b64);
        addThumbnail(b64);
        updateCounters();
        showToast(TXT.captured, 'success');
        sendToAnalyze(b64).then(() => {
          if (stateMgr) stateMgr.setSuccess('Analisis selesai', 1500);
        }).catch(err => {
          if (stateMgr) stateMgr.setError('Gagal menganalisis', 2000);
          console.error('Analysis error:', err);
        });
      };
      reader.readAsDataURL(file);
      e.target.value = '';
    });
  }

  // avatar upload
  const avf = document.getElementById('avf');
  if (avf) avf.addEventListener('change', handleAvatarUpload);

  // Only start camera if camera elements exist (dashboard page)
  if (document.getElementById('video')) {
    startCamera();
  }
});

// ── Send to Django analyze API ────────────────────────────────
async function sendToAnalyze(b64) {
  setAnalyzing(true);
  try {
    const yearInput = document.getElementById('tireYearInput');
    const body = {
      image:        b64,
      tire_year:    yearInput ? yearInput.value : null,
      camera_mode:  cameraMode,
    };
    const resp = await fetch(ANALYZE_URL, {
      method:  'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRFToken':  CSRF_TOKEN,
      },
      body: JSON.stringify(body),
    });
    const data = await resp.json();
    setAnalyzing(false);
    if (data.ok) {
      showAnalysisResult(data);
      addHistoryRow(data);
      updateTotalCounter(data);
    } else {
      showToast('Error: ' + data.error, 'error');
    }
  } catch (err) {
    setAnalyzing(false);
    showToast('Network error: ' + err.message, 'error');
  }
}

// ── UI helpers ────────────────────────────────────────────────
function setStatus(s) {
  const badge = statusBadge();
  const dot   = statusDot();
  const txt   = statusText();

  // Guard: only update status if elements exist (dashboard page only)
  if (!badge || !dot || !txt) return;

  const map = {
    starting: ['rgba(245,158,11,.1)', '#fde68a', 'rgba(245,158,11,.2)', '#f59e0b', 'Memulai...'],
    live:     ['rgba(34,197,94,.1)',  '#86efac', 'rgba(34,197,94,.2)',  '#22c55e', 'Live'],
    off:      ['rgba(148,163,184,.1)','#94a3b8', 'rgba(148,163,184,.2)','#94a3b8','Off'],
    error:    ['rgba(239,68,68,.1)',  '#fca5a5', 'rgba(239,68,68,.2)',  '#ef4444','Error'],
  };
  const [bg, color, border, dotBg, label] = map[s] || map.off;
  badge.style.background  = bg;
  badge.style.color       = color;
  badge.style.borderColor = border;
  dot.style.background    = dotBg;
  dot.style.animation     = s === 'live' ? '' : 'none';
  txt.textContent         = label;
}

function setAnalyzing(on) {
  const pill = document.getElementById('analyzingPill');
  const status = document.getElementById('resultStatus');
  const spinner = document.getElementById('analysisSpinner');
  const resultImg = document.getElementById('resultImg');
  const resultEmpty = document.getElementById('resultEmpty');

  // Guard: only update if elements exist (dashboard page only)
  if (pill) pill.style.display = on ? 'flex' : 'none';
  if (status) status.style.display = on ? 'none' : (currentB64 ? 'flex' : 'none');
  if (spinner) spinner.style.display = on ? 'flex' : 'none';
  if (resultImg) resultImg.style.display = on ? 'none' : (currentB64 ? 'block' : 'none');
  if (resultEmpty) resultEmpty.style.display = on ? 'none' : (currentB64 ? 'none' : 'flex');
}

function showResultImage(b64) {
  const img  = document.getElementById('resultImg');
  const empty = document.getElementById('resultEmpty');
  const status = document.getElementById('resultStatus');

  if (img) {
    img.src = b64;
    img.style.display = 'block';
  }
  if (empty) empty.style.display = 'none';
  if (status) status.style.display = 'flex';
}

function showAnalysisResult(data) {
  const badge = document.getElementById('resultBadge');
  const condMap = {
    good:    { cls: 'cond-good',    label: LABELS.good    },
    worn:    { cls: 'cond-worn',    label: LABELS.worn    },
    damaged: { cls: 'cond-damaged', label: LABELS.damaged },
    unknown: { cls: 'cond-unknown', label: LABELS.unknown },
    not_tire:{ cls: 'cond-unknown', label: LABELS.not_tire},
  };
  const info = condMap[data.condition] || condMap.unknown;
  badge.className = `result-badge ${info.cls}`;
  badge.textContent = `${info.label} ${data.confidence}%`;
  badge.style.display = 'inline-flex';

  // overlay — only update if elements exist
  const analisisStatus = document.getElementById('analisisStatus');
  if (analisisStatus) {
    analisisStatus.textContent = `${info.label} (${data.confidence}%)`;
  }

  const analisisDetail = document.getElementById('analisisDetail');
  if (analisisDetail) {
    analisisDetail.textContent = data.label || data.condition;
  }

  const oi = document.getElementById('overlayImg');
  if (oi && data.image_url) { oi.src = data.image_url; oi.style.display = 'block'; }

  const analisisOverlay = document.getElementById('analisisOverlay');
  if (analisisOverlay) {
    analisisOverlay.style.display = 'grid';
  }

  const rsTxt = document.getElementById('resultStatusText');
  const rsDot = document.getElementById('resultStatusDot');
  if (rsTxt) rsTxt.textContent = info.label;
  if (rsDot) rsDot.style.background = data.color || '#94a3b8';

  const resultStatus = document.getElementById('resultStatus');
  if (resultStatus) resultStatus.style.display = 'flex';

  // Pesan khusus untuk "bukan ban"
  if (data.condition === 'not_tire') {
    showToast(TXT.notTireMsg, 'warning');
  } else {
    showToast(TXT.done + ': ' + info.label, 'success');
  }
}

function addThumbnail(b64) {
  const strip = document.getElementById('tstrip');
  const empty = document.getElementById('thumbEmpty');

  // Guard: only add thumbnails if elements exist (dashboard page only)
  if (!strip || !empty) return;

  empty.style.display = 'none';
  strip.style.display = 'flex';

  const div = document.createElement('div');
  div.className = 'thumb';
  div.innerHTML = `<img src="${b64}" alt="thumb">`;
  div.onclick = () => {
    document.querySelectorAll('.thumb').forEach(t => t.classList.remove('sel'));
    div.classList.add('sel');
    showResultImage(b64);
    currentB64 = window._currentB64 = b64;
  };
  strip.insertBefore(div, strip.firstChild);

  const cnt = document.getElementById('thumbCount');
  if (cnt) {
    cnt.textContent = strip.children.length;
  }
}

function addHistoryRow(data) {
  const body = document.getElementById('historyBody');
  const empty = body.querySelector('.hem');
  if (empty) empty.remove();

  let table = body.querySelector('.htable');
  if (!table) {
    table = document.createElement('table');
    table.className = 'htable';
    table.innerHTML = `<thead><tr>
      <th>Foto</th><th>Kondisi</th><th>Label</th>
      <th>Kepercayaan</th><th>Tahun</th><th>Waktu</th><th></th>
    </tr></thead><tbody></tbody>`;
    body.appendChild(table);
  }
  const tbody = table.querySelector('tbody');
  const cond  = data.condition;
  const condMap = { good:'cond-good', worn:'cond-worn', damaged:'cond-damaged' };
  const cls = condMap[cond] || 'cond-unknown';
  const label = LABELS[cond] || cond;
  const now = new Date().toLocaleString('id-ID', { day:'2-digit', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' });

  const tr = document.createElement('tr');
  tr.id = `row-${data.id}`;
  tr.innerHTML = `
    <td>${data.image_url ? `<img src="${data.image_url}" style="width:50px;height:38px;object-fit:cover;border-radius:6px;display:block">` : '—'}</td>
    <td><span class="cond-badge ${cls}">${label}</span></td>
    <td style="color:var(--muted)">${data.label || '—'}</td>
    <td>
      <div style="font-size:12px;font-weight:600">${data.confidence}%</div>
      <div class="conf-bar"><div class="conf-fill" style="width:${data.confidence}%"></div></div>
    </td>
    <td style="color:var(--muted)">${document.getElementById('tireYearInput')?.value || '—'}</td>
    <td style="color:var(--muted);font-size:12px">${now}</td>
    <td>
      <button class="del-btn" onclick="deleteRow(${data.id})">
        <svg viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/></svg>
      </button>
    </td>`;
  tbody.insertBefore(tr, tbody.firstChild);
}

function updateCounters() {
  const countTag = document.getElementById('countTag');
  if (countTag) {
    countTag.textContent = `${captureCount} ${TXT.analyses}`;
  }
}

function updateTotalCounter(data) {
  const el = document.getElementById('stAnal');
  if (el) {
    el.textContent = parseInt(el.textContent || '0') + 1;
  }
}

function clearResult() {
  currentB64 = window._currentB64 = null;
  document.getElementById('resultImg').style.display = 'none';
  document.getElementById('resultEmpty').style.display = 'flex';
  document.getElementById('resultBadge').style.display = 'none';
  document.getElementById('resultStatus').style.display = 'none';
  document.getElementById('analyzingPill').style.display = 'none';
}

// ── Clear all image data from memory ───────────────────────────
function clearAllImageData() {
  // Clear current analysis image
  currentB64 = window._currentB64 = null;

  // Clear all thumbnail images from memory
  const thumbnails = document.querySelectorAll('#tstrip .thumb img');
  thumbnails.forEach(img => {
    // Revoke object URL if it exists to free memory
    if (img.src && img.src.startsWith('blob:')) {
      URL.revokeObjectURL(img.src);
    }
    img.src = '';
  });

  // Clear thumbnail strip
  document.getElementById('tstrip').innerHTML = '';
  document.getElementById('tstrip').style.display = 'none';
  document.getElementById('thumbEmpty').style.display = 'flex';
  document.getElementById('thumbCount').textContent = '0';

  // Clear result display
  clearResult();

  // Clear PLT display
  const pltImg = document.getElementById('pltImg');
  if (pltImg) {
    pltImg.style.display = 'none';
    pltImg.src = '';
  }
  const pltEmpty = document.getElementById('pltImgEmpty');
  if (pltEmpty) pltEmpty.style.display = 'flex';

  // Reset counters
  captureCount = 0;
  sessionAnalyses = 0;
  updateCountTag();

  console.log('🧹 All image data cleared from memory');
}

function downloadResult() {
  if (!currentB64) { showToast(TXT.noImg, 'warn'); return; }
  const a = document.createElement('a');
  a.href     = currentB64;
  a.download = `tirescan_${Date.now()}.jpg`;
  a.click();
}

async function deleteRow(pk) {
  if (!confirm('Hapus analisis ini?')) return;
  const resp = await fetch(`${DELETE_ROW_BASE}${pk}/`, {
    method: 'POST',
    headers: { 'X-CSRFToken': CSRF_TOKEN },
  });
  if (resp.ok) {
    const row = document.getElementById(`row-${pk}`);
    if (row) row.remove();
    showToast(TXT.deleted, 'success');
  }
}

async function clearAllHistory() {
  if (!confirm('Hapus semua riwayat?')) return;
  const resp = await fetch(CLEAR_HISTORY_URL, {
    method: 'POST',
    headers: { 'X-CSRFToken': CSRF_TOKEN },
  });
  if (resp.ok) {
    const body = document.getElementById('historyBody');
    body.innerHTML = `<div class="hem">Belum ada analisis. Ambil foto ban untuk memulai.</div>`;
    showToast(TXT.cleared, 'success');
  }
}

// ── Avatar upload ─────────────────────────────────────────────
function triggerAvatarUpload() {
  document.getElementById('avf').click();
}

async function handleAvatarUpload(e) {
  const file = e.target.files[0];
  if (!file) return;

  const btn = document.querySelector('.avatar-upload-btn');
  const stateMgr = btn ? new ButtonStateManager(btn) : null;
  if (stateMgr) stateMgr.setLoading('Mengupload foto...');

  const fd = new FormData();
  fd.append('avatar', file);
  try {
    const resp = await fetch('/api/avatar/', {
      method: 'POST',
      headers: { 'X-CSRFToken': CSRF_TOKEN },
      body: fd,
    });
    const data = await resp.json();
    if (data.ok) {
      ['simg','mimg'].forEach(id => {
        const img = document.getElementById(id);
        if (img) { img.src = data.url + '?t=' + Date.now(); img.style.display = 'block'; }
      });
      showToast('Foto profil diperbarui', 'success');
      if (stateMgr) stateMgr.setSuccess('Berhasil', 1500);
    } else {
      showToast('Gagal upload foto profil', 'error');
      if (stateMgr) stateMgr.setError('Gagal', 2000);
    }
  } catch (err) {
    showToast('Error: ' + err.message, 'error');
    if (stateMgr) stateMgr.setError('Gagal', 2000);
  }
}

// ── Language ──────────────────────────────────────────────────
function doSwitchLang(lang) {
  fetch(SET_LANG_URL, {
    method:  'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'X-CSRFToken': CSRF_TOKEN },
    body:    `language=${lang}`,
  }).then(() => location.reload());
}