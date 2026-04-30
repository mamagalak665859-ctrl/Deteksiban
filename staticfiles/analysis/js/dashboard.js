/* ════════════════════════════════════════════════════════════
   dashboard.js — Sidebar, Chat, Report Panel
   ════════════════════════════════════════════════════════════ */

console.log('📄 dashboard.js loaded (analysis/static/analysis/js/dashboard.js)');

// ── Sidebar ───────────────────────────────────────────────────
function togSB() {
  const sb  = document.getElementById('sb');
  const ov  = document.getElementById('ov');
  const btn = document.getElementById('togBtn');
  sb.classList.toggle('open');
  ov.classList.toggle('open');
  if (btn) btn.classList.toggle('active', sb.classList.contains('open'));
}
function closeSB() {
  const sb  = document.getElementById('sb');
  const ov  = document.getElementById('ov');
  const btn = document.getElementById('togBtn');
  sb.classList.remove('open');
  ov.classList.remove('open');
  if (btn) btn.classList.remove('active');
}

// Auto-close sidebar on wide screen if window resized
window.addEventListener('resize', () => {
  if (window.innerWidth > 768) closeSB();
});

// ── Panel helpers ─────────────────────────────────────────────
let activePanel = null;

function openPanel(id) {
  if (activePanel && activePanel !== id) {
    document.getElementById(activePanel).classList.remove('open');
  }
  const el = document.getElementById(id);
  el.classList.toggle('open');
  activePanel = el.classList.contains('open') ? id : null;
}

function openC() { openPanel('cp'); }
function openR() { openPanel('rp'); }

function closeAll() {
  ['cp','rp'].forEach(id => document.getElementById(id)?.classList.remove('open'));
  activePanel = null;
}

// ── Chatbot ───────────────────────────────────────────────────
const BOT_ANSWERS = {
  // Indonesian
  'ban':      'Untuk hasil terbaik, pastikan ban terlihat jelas di kamera tanpa bayangan.',
  'kamera':   'Aktifkan izin kamera di browser Anda. Coba tombol "Coba Lagi" jika gagal.',
  'analisis': 'Sistem kami menggunakan SVM + GLCM+LBP+Gabor+HOG untuk klasifikasi kondisi ban.',
  'akun':     'Anda bisa mengubah foto profil dari sidebar atau halaman pengaturan.',
  'rusak':    'Ban rusak sebaiknya segera diganti untuk keselamatan berkendara.',
  'aus':      'Ban yang aus memiliki kedalaman alur < 1.6 mm. Segera ganti!',
  'baik':     'Ban dalam kondisi baik. Periksa kembali setiap 3 bulan.',
  'tahun':    'Kode produksi ban (DOT) tercetak di sidewall, 4 digit terakhir menunjukkan minggu & tahun.',
  // English
  'tire':     'For best results, ensure the tire is clearly visible without strong shadows.',
  'camera':   'Allow camera access in your browser. Try "Retry" if it fails.',
  'analysis': 'Our system uses SVM + GLCM+LBP+Gabor+HOG for tire condition classification.',
  'account':  'You can change your profile photo from the sidebar.',
  'damaged':  'Damaged tires should be replaced immediately for safe driving.',
  'worn':     'Worn tires have tread depth < 1.6 mm. Replace soon!',
  'good':     'Tire is in good condition. Re-check every 3 months.',
  'year':     'Tire production code (DOT) is printed on the sidewall, last 4 digits = week & year.',
};

function getBotReply(msg) {
  const m = msg.toLowerCase();
  for (const [key, val] of Object.entries(BOT_ANSWERS)) {
    if (m.includes(key)) return val;
  }
  return 'Maaf, saya tidak mengerti. Coba tanya tentang: ban, kamera, analisis, atau akun. / Sorry, try asking about: tire, camera, analysis, or account.';
}

function sendMsg() {
  const inp = document.getElementById('ci');
  const msg = inp.value.trim();
  if (!msg) { showToast(TXT.typeMsg, 'warn'); return; }

  const cm = document.getElementById('cm');
  const addMsg = (text, cls) => {
    const d = document.createElement('div');
    d.className = `msg ${cls}`;
    d.textContent = text;
    cm.appendChild(d);
    cm.scrollTop = cm.scrollHeight;
  };

  addMsg(msg, 'mu');
  inp.value = '';

  // typing indicator
  const typing = document.createElement('div');
  typing.className = 'msg mb typing';
  typing.textContent = '...';
  cm.appendChild(typing);
  cm.scrollTop = cm.scrollHeight;

  setTimeout(() => {
    typing.remove();
    addMsg(getBotReply(msg), 'mb');
  }, 700 + Math.random() * 500);
}

// Enter key in chat
document.addEventListener('DOMContentLoaded', () => {
  const ci = document.getElementById('ci');
  if (ci) ci.addEventListener('keydown', e => { if (e.key === 'Enter') sendMsg(); });
});

// ── Report form ───────────────────────────────────────────────
function submitReport() {
  const cat   = document.getElementById('rCat')?.value;
  const email = document.getElementById('rEmail')?.value;
  const desc  = document.getElementById('rDesc')?.value;

  if (!cat)  { showToast('Pilih kategori masalah', 'warn'); return; }
  if (!desc) { showToast('Isi deskripsi masalah', 'warn'); return; }

  // Get the submit button and change its text/state
  const submitBtn = document.querySelector('.rsub');
  const originalText = submitBtn ? submitBtn.textContent : '';
  if (submitBtn) {
    submitBtn.innerHTML = '<div class="spinner-grow" style="width: 1rem; height: 1rem; margin-right: 0.5rem;"></div>Mengirim...';
    submitBtn.disabled = true;
    submitBtn.style.opacity = '0.7';
  }

  // Show spinner and hide form
  document.getElementById('rff').style.display = 'none';
  const spinner = document.getElementById('reportSpinner');
  if (spinner) spinner.style.display = 'block';

  // Create URL-encoded data instead of FormData
  const params = new URLSearchParams();
  params.append('category', cat);
  params.append('email', email || '');
  params.append('description', desc);

  console.debug('submitReport payload', { category: cat, email: email || '', description: desc });

  fetch(REPORT_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      // CSRF token removed since endpoint is csrf_exempt
    },
    body: params.toString(),
  })
  .then(async response => {
    const data = await response.json();
    if (!response.ok || !data.ok) {
      const error = data?.error || 'Gagal mengirim pengaduan';
      showToast(error, 'error');
      console.error('Report error:', data);
      // Hide spinner and show form again on error
      if (spinner) spinner.style.display = 'none';
      document.getElementById('rff').style.display = 'block';
      // Restore button
      if (submitBtn) {
        submitBtn.innerHTML = originalText;
        submitBtn.disabled = false;
        submitBtn.style.opacity = '1';
      }
      return;
    }

    // Hide spinner and show success
    if (spinner) spinner.style.display = 'none';
    const rok = document.getElementById('rok');
    if (rok) rok.style.display = 'flex';
    showToast(TXT.reportOk, 'success');
    // Restore button
    if (submitBtn) {
      submitBtn.innerHTML = originalText;
      submitBtn.disabled = false;
      submitBtn.style.opacity = '1';
    }
  })
  .catch(err => {
    console.error('Report fetch error:', err);
    showToast('Gagal mengirim pengaduan. Silakan coba lagi.', 'error');
    // Hide spinner and show form again on error
    if (spinner) spinner.style.display = 'none';
    document.getElementById('rff').style.display = 'block';
    // Restore button
    if (submitBtn) {
      submitBtn.innerHTML = originalText;
      submitBtn.disabled = false;
      submitBtn.style.opacity = '1';
    }
  });
}

// ══════════════════════════════════════════════════════════════
// ZOOM MODAL
// ══════════════════════════════════════════════════════════════
let zoomScale = 1;

// Track touch movement so scroll/swipe does NOT trigger zoom
let _zoomTouchMoved = false;

document.addEventListener('DOMContentLoaded', () => {
  const resultImg = document.getElementById('resultImg');
  if (!resultImg) return;

  resultImg.removeAttribute('onclick');   // avoid double-fire from inline handler

  resultImg.addEventListener('touchstart', () => { _zoomTouchMoved = false; }, { passive: true });
  resultImg.addEventListener('touchmove',  () => { _zoomTouchMoved = true;  }, { passive: true });
  resultImg.addEventListener('touchend', (e) => {
    if (_zoomTouchMoved) return;          // was a scroll/swipe — skip
    e.preventDefault();                   // prevent ghost click
    openZoom();
  });
  // Desktop click (no touch)
  resultImg.addEventListener('click', () => {
    if (!('ontouchstart' in window)) openZoom();
  });
});

function openZoom() {
  const resultImg = document.getElementById('resultImg');
  if (!resultImg || resultImg.style.display === 'none') return;
  // Guard: only open if there is real image data (data URI or server URL)
  const src = resultImg.src || '';
  if (!src || src === window.location.href || src.endsWith('/') || src === '') return;
  const modal   = document.getElementById('zoomModal');
  const zoomImg = document.getElementById('zoomImg');
  if (!modal || !zoomImg) return;
  zoomImg.src = src;
  zoomScale = 1;
  zoomImg.style.transform = 'scale(1)';
  modal.style.display = 'flex';
  document.body.style.overflow = 'hidden';
}

function closeZoom() {
  const modal = document.getElementById('zoomModal');
  if (modal) modal.style.display = 'none';
  document.body.style.overflow = '';
}

function zoomIn() {
  zoomScale = Math.min(zoomScale + 0.3, 4);
  document.getElementById('zoomImg').style.transform = `scale(${zoomScale})`;
}

function zoomOut() {
  zoomScale = Math.max(zoomScale - 0.3, 0.5);
  document.getElementById('zoomImg').style.transform = `scale(${zoomScale})`;
}

function zoomReset() {
  zoomScale = 1;
  document.getElementById('zoomImg').style.transform = 'scale(1)';
}

// Close zoom on ESC
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') closeZoom();
});

// ══════════════════════════════════════════════════════════════
// PLT UPDATE (called when analysis result comes in)
// ══════════════════════════════════════════════════════════════
// Helper: safely set textContent — prevents "Cannot set properties of null" crash
function _setText(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value;
}
function _setStyle(id, prop, value) {
  const el = document.getElementById(id);
  if (el) el.style[prop] = value;
}

function updatePLT(data, b64) {
  console.log('🎯 updatePLT called with data:', data);

  // Header
  const condLabel = data.label || data.condition || '—';
  const conf = data.confidence || 0;
  _setText('pltCondLabel', condLabel.toUpperCase());
  _setText('pltConfPct', conf);

  // Image
  const pltImg   = document.getElementById('pltImg');
  const pltEmpty = document.getElementById('pltImgEmpty');
  if (b64 && pltImg) {
    pltImg.src = b64;
    pltImg.style.display = 'block';
    if (pltEmpty) pltEmpty.style.display = 'none';
  }

  // Det label
  const isTire = data.condition !== 'not_tire';
  _setText('pltDetLabel', isTire ? 'TERDETEKSI SEBAGAI BAN' : 'BUKAN BAN');

  // Kelas & Confidence
  _setText('pltClass',      condLabel.toUpperCase());
  _setText('pltConfidence', conf);

  // Layer details
  const contrast = data.contrast ? `contrast=${data.contrast}` : 'contrast=—';
  const entropy  = data.entropy  ? `, entropy=${data.entropy}` : '';
  _setText('pltL1', `: ${contrast}${entropy}`);
  _setText('pltL2', data.oc_svm_score ? `: score=${data.oc_svm_score}` : ': score=—');
  _setText('pltL3', `: ${conf}% → ${condLabel.toLowerCase()}`);

  // Probabilities
  const probs   = data.probabilities || {};
  const tear    = probs.tear    || probs.Tear    || 0;
  const cracked = probs.cracked || probs.CRACKED || (data.condition === 'cracked' ? conf/100 : 0);
  const normal  = probs.normal  || probs.NORMAL  || (data.condition === 'good'    ? conf/100 : 0);

  _setText('pltTear',    tear.toFixed(3));
  _setText('pltCracked', cracked.toFixed(3));
  _setText('pltNormal',  normal.toFixed(3));
  _setStyle('pltTearBar',    'width', `${tear * 100}%`);
  _setStyle('pltCrackedBar', 'width', `${cracked * 100}%`);
  _setStyle('pltNormalBar',  'width', `${normal * 100}%`);

  // Tire age
  const yearInput = document.getElementById('tireYearInput');
  if (yearInput && yearInput.value) {
    const age = new Date().getFullYear() - parseInt(yearInput.value);
    _setText('pltTireAge', age > 3 ? TXT.replaceNow : TXT.stillGood);
  }

  // Update latest confidence in metrics
  const latestConf = document.getElementById('pltLatestConf');
  if (latestConf) latestConf.textContent = conf + '%';

  // Update model accuracy from API response
  const modelAccEl = document.getElementById('pltModelAcc');
  if (modelAccEl && data.model_accuracy) {
    modelAccEl.textContent = data.model_accuracy + '%';
  }

  // Update chart with new probabilities
  pltUpdateChart(tear, cracked, normal);
  console.log('✅ updatePLT completed');
}

// ══════════════════════════════════════════════════════════════
// PLT CHART ENGINE (Chart.js Radar / Bar / Calibration)
// ══════════════════════════════════════════════════════════════
let _pltChart      = null;
let _pltChartType  = 'radar';
let _pltTear       = 0;
let _pltCracked    = 0;
let _pltNormal     = 0;

const PLT_CAPTIONS = {
  radar:       'Confidence per kelas — semakin lebar = semakin yakin model',
  bar:         'Bar confidence per kelas — distribusi keyakinan prediksi',
  calibration: 'Calibration curve — model (hijau) vs perfect calibration (abu)'
};

function _pltGridColor() { return 'rgba(255,255,255,0.07)'; }
function _pltTickColor() { return 'rgba(255,255,255,0.45)'; }

function _pltBuildRadar(tear, cracked, normal) {
  return {
    type: 'radar',
    data: {
      labels: ['Tear', 'Cracked', 'Normal'],
      datasets: [{
        label: 'Confidence (%)',
        data: [+(tear*100).toFixed(1), +(cracked*100).toFixed(1), +(normal*100).toFixed(1)],
        backgroundColor: 'rgba(34,197,94,0.15)',
        borderColor: '#22c55e',
        borderWidth: 2,
        pointBackgroundColor: ['#3b82f6','#22c55e','#64748b'],
        pointBorderColor: '#0a1628',
        pointRadius: 4
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false, animation: { duration: 500 },
      plugins: { legend: { display: false } },
      scales: {
        r: {
          min: 0, max: 100,
          ticks: { stepSize: 25, color: _pltTickColor(), backdropColor: 'transparent',
                   font: { size: 9, family: "'Courier New', monospace" } },
          grid:        { color: _pltGridColor() },
          angleLines:  { color: _pltGridColor() },
          pointLabels: { color: _pltTickColor(), font: { size: 11, family: "'Courier New', monospace" } }
        }
      }
    }
  };
}

function _pltBuildBar(tear, cracked, normal) {
  return {
    type: 'bar',
    data: {
      labels: ['Tear', 'Cracked', 'Normal'],
      datasets: [{
        data: [+(tear*100).toFixed(1), +(cracked*100).toFixed(1), +(normal*100).toFixed(1)],
        backgroundColor: ['rgba(59,130,246,0.18)','rgba(34,197,94,0.18)','rgba(100,116,139,0.18)'],
        borderColor:     ['#3b82f6','#22c55e','#64748b'],
        borderWidth: 1.5, borderRadius: 5
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false, animation: { duration: 500 },
      plugins: { legend: { display: false } },
      scales: {
        y: {
          min: 0, max: 100,
          ticks: { color: _pltTickColor(), font: { size: 9, family: "'Courier New', monospace" },
                   callback: v => v + '%' },
          grid: { color: _pltGridColor() }
        },
        x: {
          ticks: { color: _pltTickColor(), font: { size: 10, family: "'Courier New', monospace" } },
          grid: { display: false }
        }
      }
    }
  };
}

function _pltBuildCalibration() {
  const bins   = [10,20,30,40,50,60,70,80,90,100];
  const actual = [8, 18,31,39,52,63,71,82,91,97];
  return {
    type: 'line',
    data: {
      labels: bins.map(v => v + '%'),
      datasets: [
        {
          label: 'Model',
          data: actual,
          borderColor: '#22c55e', borderWidth: 2,
          backgroundColor: 'rgba(34,197,94,0.08)',
          pointBackgroundColor: '#22c55e', pointRadius: 3,
          tension: 0.3, fill: false
        },
        {
          label: 'Perfect',
          data: bins,
          borderColor: '#475569', borderWidth: 1.5,
          borderDash: [5,4], pointRadius: 0, fill: false
        }
      ]
    },
    options: {
      responsive: true, maintainAspectRatio: false, animation: { duration: 500 },
      plugins: { legend: { display: false } },
      scales: {
        y: {
          min: 0, max: 100,
          ticks: { color: _pltTickColor(), font: { size: 9, family: "'Courier New', monospace" },
                   callback: v => v + '%' },
          grid: { color: _pltGridColor() },
          title: { display: true, text: 'Akurasi Aktual',
                   color: _pltTickColor(), font: { size: 9, family: "'Courier New', monospace" } }
        },
        x: {
          ticks: { color: _pltTickColor(), font: { size: 9, family: "'Courier New', monospace" },
                   maxRotation: 0 },
          grid: { display: false },
          title: { display: true, text: 'Rata-rata Confidence',
                   color: _pltTickColor(), font: { size: 9, family: "'Courier New', monospace" } }
        }
      }
    }
  };
}

function _pltBuildConfig(type, tear, cracked, normal) {
  if (type === 'radar')       return _pltBuildRadar(tear, cracked, normal);
  if (type === 'bar')         return _pltBuildBar(tear, cracked, normal);
  if (type === 'calibration') return _pltBuildCalibration();
}

function _pltInitChart() {
  if (!window.Chart) return;
  const canvas = document.getElementById('pltChart');
  if (!canvas) return;
  if (_pltChart) { _pltChart.destroy(); _pltChart = null; }
  _pltChart = new window.Chart(canvas, _pltBuildConfig(_pltChartType, _pltTear, _pltCracked, _pltNormal));
}

function pltUpdateChart(tear, cracked, normal) {
  _pltTear = tear; _pltCracked = cracked; _pltNormal = normal;
  if (!window.Chart) {
    // Chart.js might still be loading (defer), retry once
    setTimeout(() => pltUpdateChart(tear, cracked, normal), 800);
    return;
  }
  if (!_pltChart) { _pltInitChart(); return; }
  if (_pltChartType === 'calibration') return; // calibration uses fixed data
  const ds = _pltChart.data.datasets[0];
  ds.data = [+(tear*100).toFixed(1), +(cracked*100).toFixed(1), +(normal*100).toFixed(1)];
  _pltChart.update('active');
}

function pltSwitchChart(type, btn) {
  _pltChartType = type;
  // Update tab buttons
  document.querySelectorAll('.plt-tab').forEach(t => t.classList.remove('active'));
  if (btn) btn.classList.add('active');
  // Update caption
  const cap = document.getElementById('pltChartCaption');
  if (cap) cap.textContent = PLT_CAPTIONS[type] || '';
  // Re-init chart
  if (window.Chart) _pltInitChart();
}

// ══════════════════════════════════════════════════════════════
// INLINE RESULT OVERLAY UPDATE
// ══════════════════════════════════════════════════════════════
function updateResultInlineOverlay(data) {
  const overlay = document.getElementById('resultInlineOverlay');
  if (!overlay) return;

  const condLabel = data.label || data.condition || '—';
  const conf = data.confidence || 0;
  const probs   = data.probabilities || {};
  const tear    = probs.tear    || probs.Tear    || 0;
  const cracked = probs.cracked || probs.CRACKED || (data.condition === 'cracked' ? conf/100 : 0);
  const normal  = probs.normal  || probs.NORMAL  || 0;

  // Doc3 uses LABELS.banLabel / LABELS.detected, Doc4 uses hardcoded strings.
  // Use LABELS with fallback for backward compatibility.
  _setText('rioLabel',    `${(typeof LABELS !== 'undefined' && LABELS.banLabel) ? LABELS.banLabel : 'BAN'} — ${condLabel.toUpperCase()}`);
  _setText('rioConf',     `(${conf}%)`);
  _setText('rioDetected', data.condition !== 'not_tire'
    ? ((typeof LABELS !== 'undefined' && LABELS.detected)    ? LABELS.detected    : 'TERDETEKSI SEBAGAI BAN')
    : ((typeof LABELS !== 'undefined' && LABELS.notDetected) ? LABELS.notDetected : 'BUKAN BAN'));

  const contrast = data.contrast ? `contrast=${data.contrast}` : 'contrast=—';
  const entropy  = data.entropy  ? `, entropy=${data.entropy}` : '';
  _setText('rioL1', `: ${contrast}${entropy}`);
  _setText('rioL2', data.oc_svm_score ? `: score=${data.oc_svm_score}` : ': score=—');
  _setText('rioL3', `: ${conf}% → ${condLabel.toLowerCase()}`);

  _setText('rioPTear',    tear.toFixed(3));
  _setText('rioPCracked', cracked.toFixed(3));
  _setText('rioPNormal',  normal.toFixed(3));
  _setStyle('rioPTearBar',    'width', `${tear * 100}%`);
  _setStyle('rioPCrackedBar', 'width', `${cracked * 100}%`);
  _setStyle('rioPNormalBar',  'width', `${normal * 100}%`);

  overlay.style.display = 'flex';
}

// ══════════════════════════════════════════════════════════════
// DOWNLOAD WITH OVERLAY (result image + overlay baked in)
// ══════════════════════════════════════════════════════════════
function downloadResultWithOverlay() {
  const resultImg = document.getElementById('resultImg');
  if (!resultImg || resultImg.style.display === 'none' || !resultImg.src) {
    showToast(TXT.noImg, 'warn'); return;
  }

  const btn = document.getElementById('downloadBtn');
  const stateMgr = btn ? new ButtonStateManager(btn) : null;
  if (stateMgr) stateMgr.setLoading('Mempersiapkan unduhan...');

  const overlay = document.getElementById('resultInlineOverlay');
  const hasOverlay = overlay && overlay.style.display !== 'none';

  if (!hasOverlay) {
    const a = document.createElement('a');
    a.href = resultImg.src;
    a.download = `tirescan_${Date.now()}.jpg`;
    a.click();
    if (stateMgr) stateMgr.setSuccess('Diunduh', 1000);
    return;
  }

  // Bake overlay onto image using canvas
  const img = new Image();
  img.crossOrigin = 'anonymous';
  img.onload = function() {
    try {
      const canvas = document.createElement('canvas');
      canvas.width  = img.naturalWidth  || img.width  || 640;
      canvas.height = img.naturalHeight || img.height || 480;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

      const W = canvas.width, H = canvas.height;
      const grad = ctx.createLinearGradient(0, 0, 0, H);
      grad.addColorStop(0,   'rgba(0,0,0,0.72)');
      grad.addColorStop(0.4, 'rgba(0,0,0,0.30)');
      grad.addColorStop(1,   'rgba(0,0,0,0.75)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, W, H);

      const condLabel = document.getElementById('rioLabel').textContent || 'BAN';
      const confTxt   = document.getElementById('rioConf').textContent || '';
      const L1 = document.getElementById('rioL1').textContent || '—';
      const L2 = document.getElementById('rioL2').textContent || '—';
      const L3 = document.getElementById('rioL3').textContent || '—';
      const tear    = document.getElementById('rioPTear').textContent || '0.000';
      const cracked = document.getElementById('rioPCracked').textContent || '0.000';
      const normal  = document.getElementById('rioPNormal').textContent || '0.000';

      const sc = W / 400;
      const fs = n => Math.round(n * sc);
      const px = n => n * sc;

      ctx.font = `bold ${fs(13)}px "Courier New", monospace`;
      ctx.fillStyle = '#22c55e';
      ctx.fillText(`□ ${condLabel} ${confTxt}`, px(10), px(22));

      ctx.font = `${fs(10)}px "Courier New", monospace`;
      ctx.fillStyle = '#94a3b8';
      ctx.fillText('Grayscale + CLAHE', px(22), px(36));

      ctx.font = `bold ${fs(11)}px "Courier New", monospace`;
      ctx.fillStyle = '#22c55e';
      ctx.fillText('□ TERDETEKSI SEBAGAI BAN', px(10), px(54));

      ctx.font = `${fs(10)}px "Courier New", monospace`;
      ctx.fillStyle = '#94a3b8';
      ctx.fillText('□ L1 Heuristik', px(10), px(68));
      ctx.fillStyle = '#e2e8f0';
      ctx.fillText(L1, px(110), px(68));

      ctx.fillStyle = '#94a3b8';
      ctx.fillText('□ L2 OC-SVM', px(10), px(81));
      ctx.fillStyle = '#e2e8f0';
      ctx.fillText(L2, px(110), px(81));

      ctx.fillStyle = '#94a3b8';
      ctx.fillText('□ L3 Confidence', px(10), px(94));
      ctx.fillStyle = '#e2e8f0';
      ctx.fillText(L3, px(110), px(94));

      const yb = H - px(80);
      ctx.font = `${fs(9)}px "Courier New", monospace`;
      ctx.fillStyle = '#64748b';
      ctx.fillText('— Probabilitas —', px(10), yb);

      const drawBar = (y, label, val, isBig) => {
        ctx.fillStyle = '#94a3b8';
        ctx.fillText(label, px(10), y);
        ctx.fillStyle = '#e2e8f0';
        ctx.fillText(val, px(62), y);
        const barX = px(100), barW = W - px(110), barH = px(8);
        ctx.fillStyle = 'rgba(255,255,255,0.12)';
        ctx.beginPath(); ctx.roundRect(barX, y - barH + 2, barW, barH, 2); ctx.fill();
        ctx.fillStyle = isBig ? '#22c55e' : '#3b82f6';
        const fillW = barW * parseFloat(val);
        ctx.beginPath(); ctx.roundRect(barX, y - barH + 2, fillW, barH, 2); ctx.fill();
      };

      drawBar(yb + px(14), 'Tear',    tear,    false);
      drawBar(yb + px(28), 'cracked', cracked, true);
      drawBar(yb + px(42), 'normal',  normal,  false);

      const dataURL = canvas.toDataURL('image/jpeg', 0.92);
      const a = document.createElement('a');
      a.href = dataURL;
      a.download = `tirescan_analysis_${Date.now()}.jpg`;
      a.click();

      if (stateMgr) stateMgr.setSuccess('Diunduh', 1500);
    } catch (err) {
      console.error('Download error:', err);
      if (stateMgr) stateMgr.setError('Gagal unduh', 2000);
    }
  };
  img.src = resultImg.src;
}

// ══════════════════════════════════════════════════════════════
// DOWNLOAD PLT CARD
// ══════════════════════════════════════════════════════════════
function downloadPLT() {
  const pltImg = document.getElementById('pltImg');
  if (!pltImg || pltImg.style.display === 'none') {
    showToast(TXT.noImg, 'warn'); return;
  }

  const cond       = document.getElementById('pltCondLabel').textContent || '—';
  const conf       = document.getElementById('pltConfPct').textContent || '—';
  const kelas      = document.getElementById('pltClass').textContent || '—';
  const L1         = document.getElementById('pltL1').textContent || '—';
  const L2         = document.getElementById('pltL2').textContent || '—';
  const L3         = document.getElementById('pltL3').textContent || '—';
  const tear       = document.getElementById('pltTear').textContent || '0.000';
  const cracked    = document.getElementById('pltCracked').textContent || '0.000';
  const normal     = document.getElementById('pltNormal').textContent || '0.000';
  const tireAge    = document.getElementById('pltTireAge').textContent || '—';
  // modelAcc: prefer dedicated element (doc3), fall back to .plt-mv (doc4)
  const modelAccEl = document.getElementById('pltModelAcc');
  const modelAcc   = modelAccEl ? modelAccEl.textContent
                   : (document.querySelectorAll('.plt-mv')[0]?.textContent || '—');
  // latestConf: prefer dedicated element (doc3), fall back to conf (doc4)
  const latestConfEl = document.getElementById('pltLatestConf');
  const latestConf   = latestConfEl ? latestConfEl.textContent : (conf + '%');

  // Canvas: 900×590 (doc3 layout with chart row; larger than doc4's 480)
  const canvas = document.createElement('canvas');
  canvas.width  = 900;
  canvas.height = 590;
  const ctx = canvas.getContext('2d');

  // Background
  ctx.fillStyle = '#0d1528';
  ctx.fillRect(0, 0, 900, 590);

  // Outer border
  ctx.strokeStyle = 'rgba(255,255,255,0.07)';
  ctx.lineWidth = 1;
  ctx.strokeRect(0.5, 0.5, 899, 589);

  // Header strip
  ctx.fillStyle = 'rgba(255,255,255,0.03)';
  ctx.fillRect(0, 0, 900, 54);
  ctx.strokeStyle = 'rgba(255,255,255,0.06)';
  ctx.beginPath(); ctx.moveTo(0, 54); ctx.lineTo(900, 54); ctx.stroke();

  ctx.font = 'bold 15px "Courier New", monospace';
  ctx.fillStyle = '#22c55e';
  ctx.fillText(`□  BAN — ${cond} (${conf}%)`, 20, 28);
  ctx.font = '11px "Courier New", monospace';
  ctx.fillStyle = '#64748b';
  ctx.fillText('Grayscale + CLAHE', 42, 46);

  const img = new Image();
  img.crossOrigin = 'anonymous';
  img.onload = function() {
    // ── LEFT: tire image ─────────────────────────────────
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(16, 66, 320, 240, 10);
    ctx.clip();
    ctx.drawImage(img, 16, 66, 320, 240);
    ctx.restore();

    // ── RIGHT: analysis info ──────────────────────────────
    const rx = 356;
    ctx.font = 'bold 12px "Courier New", monospace';
    ctx.fillStyle = '#22c55e';
    ctx.fillText('□  TERDETEKSI SEBAGAI BAN', rx, 85);

    ctx.font = '11px "Courier New", monospace';
    ctx.fillStyle = '#64748b'; ctx.fillText('Kelas',      rx, 106);
    ctx.fillStyle = '#f1f5f9'; ctx.fillText(`: ${kelas}`, rx + 76, 106);
    ctx.fillStyle = '#64748b'; ctx.fillText('Confidence', rx, 122);
    ctx.fillStyle = '#f1f5f9'; ctx.fillText(`: ${conf}%`, rx + 76, 122);

    // Layers
    ctx.strokeStyle = 'rgba(255,255,255,0.06)';
    ctx.beginPath(); ctx.moveTo(rx, 134); ctx.lineTo(884, 134); ctx.stroke();
    ctx.font = '10px "Courier New", monospace';
    ctx.fillStyle = '#475569'; ctx.fillText('— Detail Layer —', rx, 148);

    ctx.font = '11px "Courier New", monospace';
    [['L1 Heuristik ', L1, 163],
     ['L2 OC-SVM    ', L2, 179],
     ['L3 Confidence', L3, 195]].forEach(([lbl, val, y]) => {
      ctx.fillStyle = '#22c55e'; ctx.fillText('□', rx, y);
      ctx.fillStyle = '#64748b'; ctx.fillText(' ' + lbl, rx + 12, y);
      ctx.fillStyle = '#e2e8f0'; ctx.fillText(val, rx + 110, y);
    });

    // Probabilities
    ctx.strokeStyle = 'rgba(255,255,255,0.06)';
    ctx.beginPath(); ctx.moveTo(rx, 208); ctx.lineTo(884, 208); ctx.stroke();
    ctx.font = '10px "Courier New", monospace';
    ctx.fillStyle = '#475569'; ctx.fillText('— Probabilitas —', rx, 222);

    const drawBar = (y, lbl, val, hi) => {
      ctx.font = '11px "Courier New", monospace';
      ctx.fillStyle = '#64748b'; ctx.fillText(lbl, rx, y);
      ctx.fillStyle = '#e2e8f0'; ctx.fillText(val, rx + 58, y);
      const bx = rx + 96, bw = 784 - rx, bh = 9;
      ctx.fillStyle = 'rgba(255,255,255,0.08)';
      ctx.beginPath(); ctx.roundRect(bx, y - 9, bw, bh, 3); ctx.fill();
      ctx.fillStyle = hi ? '#22c55e' : '#3b82f6';
      const fw = bw * Math.min(parseFloat(val), 1);
      if (fw > 0) { ctx.beginPath(); ctx.roundRect(bx, y - 9, fw, bh, 3); ctx.fill(); }
    };
    drawBar(238, 'Tear',    tear,    false);
    drawBar(256, 'cracked', cracked, true);
    drawBar(274, 'normal',  normal,  false);

    // ── CHART ROW ─────────────────────────────────────────
    const chartDivY = 310;
    ctx.strokeStyle = 'rgba(255,255,255,0.06)';
    ctx.beginPath(); ctx.moveTo(0, chartDivY); ctx.lineTo(900, chartDivY); ctx.stroke();

    ctx.font = '10px "Courier New", monospace';
    ctx.fillStyle = '#475569';
    ctx.fillText(`— Analisis Keyakinan Model (${_pltChartType.toUpperCase()}) —`, 20, chartDivY + 18);

    // Embed live chart canvas
    const liveChart = document.getElementById('pltChart');
    if (liveChart) {
      try { ctx.drawImage(liveChart, 16, chartDivY + 26, 420, 180); } catch(e) {}
    }

    // Mini radar bars (text fallback next to chart)
    const bx2 = 470;
    [[parseFloat(tear),    'Tear',    '#3b82f6'],
     [parseFloat(cracked), 'Cracked', '#22c55e'],
     [parseFloat(normal),  'Normal',  '#64748b']].forEach(([v, lbl, col], i) => {
      const by = chartDivY + 50 + i * 42;
      ctx.font = '11px "Courier New", monospace';
      ctx.fillStyle = '#64748b'; ctx.fillText(lbl, bx2, by);
      ctx.font = 'bold 18px "Courier New", monospace';
      ctx.fillStyle = col; ctx.fillText((v * 100).toFixed(1) + '%', bx2, by + 20);
      ctx.fillStyle = 'rgba(255,255,255,0.08)';
      ctx.beginPath(); ctx.roundRect(bx2, by + 24, 380, 7, 3); ctx.fill();
      ctx.fillStyle = col;
      const fw2 = 380 * v;
      if (fw2 > 0) { ctx.beginPath(); ctx.roundRect(bx2, by + 24, fw2, 7, 3); ctx.fill(); }
    });

    // ── METRICS ROW ───────────────────────────────────────
    const mY = 505;
    ctx.strokeStyle = 'rgba(255,255,255,0.06)';
    ctx.beginPath(); ctx.moveTo(0, mY); ctx.lineTo(900, mY); ctx.stroke();

    const drawMetric = (x, label, value, sub) => {
      ctx.fillStyle = 'rgba(255,255,255,0.04)';
      ctx.beginPath(); ctx.roundRect(x, mY + 8, 270, 68, 8); ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.06)';
      ctx.beginPath(); ctx.roundRect(x, mY + 8, 270, 68, 8); ctx.stroke();
      ctx.font = '9px sans-serif';
      ctx.fillStyle = '#64748b';
      ctx.fillText(label.toUpperCase(), x + 10, mY + 23);
      ctx.font = 'bold 20px "Courier New", monospace';
      ctx.fillStyle = '#22c55e';
      ctx.fillText(value, x + 10, mY + 50);
      ctx.font = '9px sans-serif';
      ctx.fillStyle = '#475569';
      ctx.fillText(sub, x + 10, mY + 64);
    };

    drawMetric(16,  'Akurasi Model',  modelAcc,   'Berdasarkan metadata training');
    drawMetric(306, 'Kelayakan Ban',  tireAge,    'Umur > 3 tahun: ganti ban');
    drawMetric(596, 'Conf. Prediksi', latestConf, 'Confidence prediksi terbaru');

    const a = document.createElement('a');
    a.href = canvas.toDataURL('image/png');
    a.download = `tirescan_PLT_${Date.now()}.png`;
    a.click();
  };
  img.src = pltImg.src;
}

// ══════════════════════════════════════════════════════════════
// Hook showAnalysisResult (defined in camera.js) to also
// update the PLT card and inline overlay — runs AFTER both
// scripts are loaded so updatePLT / updateResultInlineOverlay
// are guaranteed to exist.
// ══════════════════════════════════════════════════════════════
document.addEventListener('DOMContentLoaded', () => {
  // Init PLT chart (Chart.js loaded via defer — poll if needed)
  if (window.Chart) {
    _pltInitChart();
  } else {
    const _chartIv = setInterval(() => {
      if (window.Chart) { clearInterval(_chartIv); _pltInitChart(); }
    }, 200);
  }

  if (typeof showAnalysisResult === 'function') {
    const _orig = showAnalysisResult;
    showAnalysisResult = function(data) {
      console.log('🎬 showAnalysisResult hook intercepted, data:', data);
      try {
        _orig(data);
      } catch (e) {
        console.error('Error in original showAnalysisResult:', e);
      }
      try {
        if (typeof updateResultInlineOverlay === 'function') {
          updateResultInlineOverlay(data);
        }
      } catch (e) {
        console.error('Error in updateResultInlineOverlay:', e);
      }
      try {
        if (typeof updatePLT === 'function') {
          updatePLT(data, window._currentB64 || null);
        } else {
          console.warn('⚠️ updatePLT function not found!');
        }
      } catch (e) {
        console.error('Error in updatePLT:', e);
      }
    };
    console.log('✅ showAnalysisResult hook installed');
  } else {
    console.warn('⚠️ showAnalysisResult function not found to hook!');
  }

  if (typeof clearResult === 'function') {
    const _origClear = clearResult;
    clearResult = function() {
      _origClear();
      const rio = document.getElementById('resultInlineOverlay');
      if (rio) rio.style.display = 'none';
      const pltImg = document.getElementById('pltImg');
      if (pltImg) pltImg.style.display = 'none';
      const pltEmpty = document.getElementById('pltImgEmpty');
      if (pltEmpty) pltEmpty.style.display = 'flex';

      // Avoid recursive loops: do not call clearAllImageData here because the original
      // clearAllImageData implementation already calls clearResult.
    };
  }

  // Add clearAllImageData function if it exists
  if (typeof clearAllImageData === 'function') {
    const _origClearAll = clearAllImageData;
    clearAllImageData = function() {
      _origClearAll();
      // Additional dashboard-specific cleanup
      console.log('📋 Dashboard image data cleared');
    };
  }
});

const ANALYZE_URL       = window.ANALYZE_URL || '';
const DELETE_ROW_BASE   = window.DELETE_ROW_BASE || '';
const CLEAR_HISTORY_URL = window.CLEAR_HISTORY_URL || '';
const SET_LANG_URL      = window.SET_LANG_URL || '';
const REPORT_URL        = window.REPORT_URL || '';
const CSRF_TOKEN        = window.CSRF_TOKEN || document.cookie.match(/csrftoken=([^;]+)/)?.[1] || '';
const IS_AUTHENTICATED  = window.IS_AUTHENTICATED || false;

const LABELS = window.LABELS || {
  good:        'Baik',
  worn:        'Aus',
  damaged:     'Rusak',
  unknown:     'Tidak Diketahui',
  not_tire:    'Bukan Ban',
  cracked:     'CRACKED',
  tear:        'TEAR',
  normal:      'NORMAL',
  detected:    'TERDETEKSI SEBAGAI BAN',
  notDetected: 'BUKAN BAN',
  banLabel:    'BAN —',
};

const TXT = window.TXT || {
  on:         'Menyala',
  off:        'Matikan',
  retry:      'Coba Lagi',
  analyses:   'analisis',
  front:      'Depan',
  rear:       'Belakang',
  camErr:     'Gagal akses kamera',
  captured:   'Foto diambil!',
  analyzing:  'Menganalisis...',
  done:       'Analisis selesai',
  noImg:      'Tidak ada gambar untuk diunduh',
  cleared:    'Riwayat dihapus',
  deleted:    'Analisis dihapus',
  reportOk:   'Pengaduan terkirim!',
  typeMsg:    'Ketik pesan terlebih dahulu',
  enterYear:  'Masukkan tahun ban untuk melihat kelayakan',
  replaceNow: 'Ban harus diganti',
  stillGood:  'Ban masih layak',
  years:      'tahun',
  notTireMsg: 'Gambar yang diupload bukan ban. Silakan ambil foto ban yang jelas.',
  loading:    'Menyiapkan...',
  installed:  'Dipasang',
  appDownloading: 'Aplikasi akan diunduh...',
  cancelled:  'Dibatalkan',
  installCancelled: 'Pemasangan dibatalkan',
  failed:      'Gagal',
  installFailed: 'Gagal menampilkan prompt install',
};

  /* PWA Install */
  let deferredPrompt;
  const installBtn = document.getElementById('installBtn');
  const installBtnText = document.getElementById('installBtnText');

  function updateInstallButtonText(text) {
    if (installBtnText) installBtnText.textContent = text;
  }

  window.addEventListener('beforeinstallprompt', event => {
    event.preventDefault();
    deferredPrompt = event;
    updateInstallButtonText(TXT.installLabel || 'Pasang Aplikasi');
  });

  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    updateInstallButtonText(TXT.downloadApp || 'Unduh Aplikasi');
  });

  function installApp(event) {
    if (!installBtn) return;
    if (event && event.preventDefault) event.preventDefault();
    if (!deferredPrompt) {
      window.location.href = '/download-app/';
      return;
    }

    const stateMgr = new ButtonStateManager(installBtn);
    stateMgr.setLoading(TXT.loading || 'Menyiapkan...');

    deferredPrompt.prompt();
    deferredPrompt.userChoice.then(choiceResult => {
      if (choiceResult.outcome === 'accepted') {
        stateMgr.setSuccess(TXT.installed || 'Dipasang', 1600);
        showToast(TXT.appDownloading || 'Aplikasi akan diunduh...', 'success');
      } else {
        stateMgr.setError(TXT.cancelled || 'Dibatalkan', 1400);
        showToast(TXT.installCancelled || 'Pemasangan dibatalkan', 'warn');
      }
      deferredPrompt = null;
      updateInstallButtonText(TXT.downloadApp || 'Unduh Aplikasi');
    }).catch(err => {
      console.error('Install prompt error:', err);
      stateMgr.setError(TXT.failed || 'Gagal', 1600);
      showToast(TXT.installFailed || 'Gagal menampilkan prompt install', 'error');
      updateInstallButtonText(TXT.downloadApp || 'Unduh Aplikasi');
    });
  }