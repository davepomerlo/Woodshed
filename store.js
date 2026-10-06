/* Woodshed — storage: artifact database when available, browser storage otherwise */
(function () {
  const LS_KEY = 'woodshed.v1';
  const listeners = new Set();
  const S = {
    mode: 'local', db: null,
    sessions: [], progress: { drills: {}, changes: {} },
    onChange(fn) { listeners.add(fn); return () => listeners.delete(fn); },
    emit() { listeners.forEach(fn => { try { fn(); } catch (e) { console.error(e); } }); },

    _loadLocal() {
      try {
        const raw = localStorage.getItem(LS_KEY);
        if (raw) { const d = JSON.parse(raw); this.sessions = d.sessions || []; this.progress = d.progress || this.progress; }
      } catch (e) { /* storage unavailable */ }
    },
    _saveLocal() {
      try { localStorage.setItem(LS_KEY, JSON.stringify({ sessions: this.sessions, progress: this.progress })); } catch (e) { /* ignore */ }
    },

    async init() {
      this._loadLocal();
      this.emit();
      let db = null;
      try { db = window.claude && window.claude.use ? await window.claude.use('db') : null; } catch (e) { db = null; }
      if (!db) return;
      this.db = db; this.mode = 'cloud';
      try {
        db.collection('sessions').orderBy('date', 'desc').limit(1000).onSnapshot(snap => {
          this.sessions = snap.docs.map(d => ({ id: d.id, ...d.data() }));
          this._saveLocal(); this.emit();
        }, () => { this.mode = 'local'; this.emit(); });
        db.doc('progress/main').onSnapshot(snap => {
          if (snap.exists) { const d = snap.data(); this.progress = { drills: d.drills || {}, changes: d.changes || {} }; this._saveLocal(); this.emit(); }
        }, () => {});
      } catch (e) { this.mode = 'local'; }
    },

    async addSession(s) {
      const id = 's' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
      const doc = { ...s, created: new Date().toISOString() };
      this.sessions = [{ id, ...doc }, ...this.sessions].sort((a, b) => (b.date || '').localeCompare(a.date || ''));
      this._saveLocal(); this.emit();
      if (this.db) {
        try { await this.db.collection('sessions').doc(id).set(doc); }
        catch (e) { if (e && e.code === 'quota_exceeded') throw new Error('The log is full. Delete old entries to add new ones.'); }
      }
    },
    async deleteSession(id) {
      this.sessions = this.sessions.filter(s => s.id !== id);
      this._saveLocal(); this.emit();
      if (this.db) { try { await this.db.collection('sessions').doc(id).delete(); } catch (e) { /* ignore */ } }
    },
    _pTimer: null,
    saveProgress() {
      this._saveLocal(); this.emit();
      if (!this.db) return;
      clearTimeout(this._pTimer);
      this._pTimer = setTimeout(async () => {
        try { await this.db.doc('progress/main').set({ drills: this.progress.drills, changes: this.progress.changes }); } catch (e) { /* ignore */ }
      }, 600);
    },
    recordDrill(id, bpm) {
      const d = this.progress.drills[id] || { best: 0, hist: [] };
      d.best = Math.max(d.best || 0, bpm);
      d.hist = [...(d.hist || []), [todayISO(), bpm]].slice(-40);
      this.progress.drills = { ...this.progress.drills, [id]: d };
      this.saveProgress();
    },
    recordChanges(pair, count) {
      const d = this.progress.changes[pair] || { best: 0, hist: [] };
      d.best = Math.max(d.best || 0, count);
      d.hist = [...(d.hist || []), [todayISO(), count]].slice(-40);
      this.progress.changes = { ...this.progress.changes, [pair]: d };
      this.saveProgress();
    }
  };
  function todayISO() {
    const d = new Date(); const z = n => String(n).padStart(2, '0');
    return d.getFullYear() + '-' + z(d.getMonth() + 1) + '-' + z(d.getDate());
  }
  S.todayISO = todayISO;
  window.Store = S;
})();
