/* Woodshed standalone extras: offline support, keep-screen-on, and backup/restore of your data */
(function () {
  const { App, UI, Store, Resume, Audio2: AU } = window;
  const { h } = UI;

  /* ---------- offline: register the service worker ---------- */
  if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1')) {
    window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
  }
  // Ask the browser not to clear this app's saved data when storage runs low
  if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});

  /* ---------- keep the screen awake while you practise ---------- */
  let lock = null;
  async function updateWakeLock() {
    const today = Resume.part('today');
    const want = AU.Transport.running || !!(today && today.running);
    try {
      if (want && !lock && 'wakeLock' in navigator && document.visibilityState === 'visible') {
        lock = await navigator.wakeLock.request('screen');
        lock.addEventListener('release', () => { lock = null; });
      } else if (!want && lock) { await lock.release(); lock = null; }
    } catch (e) { lock = null; }
  }
  AU.Transport.on(type => { if (type === 'state') updateWakeLock(); });
  document.addEventListener('click', () => setTimeout(updateWakeLock, 60));
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') updateWakeLock(); });

  /* ---------- backup & restore (moves your log between devices) ---------- */
  function exportData() {
    const payload = {
      app: 'woodshed', version: 1, exported: new Date().toISOString(),
      sessions: Store.sessions, progress: Store.progress, resume: Resume.data
    };
    const blob = new Blob([JSON.stringify(payload, null, 1)], { type: 'application/json' });
    const a = h('a', { href: URL.createObjectURL(blob), download: 'woodshed-backup-' + Store.todayISO() + '.json' });
    document.body.append(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
    UI.toast('Backup saved to your downloads');
  }

  function mergeHist(a = [], b = []) {
    const seen = new Set(), out = [];
    [...a, ...b].forEach(x => { const k = JSON.stringify(x); if (!seen.has(k)) { seen.add(k); out.push(x); } });
    return out.sort((x, y) => String(x[0]).localeCompare(String(y[0]))).slice(-40);
  }
  function mergeBests(mine = {}, theirs = {}) {
    const out = { ...mine };
    Object.entries(theirs).forEach(([k, v]) => {
      const m = out[k] || { best: 0, hist: [] };
      out[k] = { best: Math.max(m.best || 0, v.best || 0), hist: mergeHist(m.hist, v.hist) };
    });
    return out;
  }

  async function importData(file) {
    let data;
    try { data = JSON.parse(await file.text()); } catch (e) { UI.toast('That file is not a Woodshed backup'); return; }
    if (!data || data.app !== 'woodshed') { UI.toast('That file is not a Woodshed backup'); return; }
    const byId = new Map(Store.sessions.map(s => [s.id, s]));
    let added = 0;
    (data.sessions || []).forEach(s => { if (s && s.id && !byId.has(s.id)) { byId.set(s.id, s); added++; } });
    Store.sessions = [...byId.values()].sort((a, b) => (b.date || '').localeCompare(a.date || ''));
    Store.progress = {
      drills: mergeBests(Store.progress.drills, data.progress && data.progress.drills),
      changes: mergeBests(Store.progress.changes, data.progress && data.progress.changes)
    };
    Store._saveLocal(); Store.emit();
    const newerPlace = data.resume && (data.resume.savedAt || 0) > (Resume.data.savedAt || 0);
    if (newerPlace) {
      try { localStorage.setItem('woodshed.resume.v1', JSON.stringify(data.resume)); } catch (e) { /* ignore */ }
      UI.toast('Imported ' + added + ' sessions. Reopening at your saved place…');
      setTimeout(() => location.reload(), 1200);
    } else UI.toast('Imported ' + added + ' new sessions and your best tempos');
  }

  function backupPanel() {
    const input = h('input', { type: 'file', accept: 'application/json,.json', hidden: true, onchange: e => { const f = e.target.files[0]; if (f) importData(f); e.target.value = ''; } });
    return h('div', { class: 'panel stack', style: 'margin-top:18px' },
      h('div', { class: 'eyebrow' }, 'Backup & move to another device'),
      h('p', { class: 'note', style: 'margin:0;font-size:14px' }, 'Your log, best tempos and saved place live on this device only. Save a backup file now and then, and import it on another device to bring everything across. Importing adds to what is already here; it never deletes anything.'),
      h('div', { class: 'row' },
        h('button', { class: 'btn primary', onclick: exportData }, 'Save backup file'),
        h('button', { class: 'btn', onclick: () => input.click() }, 'Import backup…'),
        input));
  }

  const logView = App.views.log;
  if (logView) {
    const mount = logView.mount;
    logView.mount = sec => { mount(sec); sec.append(backupPanel()); };
  }
})();
