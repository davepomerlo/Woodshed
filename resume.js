/* Woodshed — remembers where you are (session timer, open tab, selections) so the app resumes after closing */
(function () {
  const KEY = 'woodshed.resume.v1';
  const R = {
    data: { savedAt: 0 }, db: null, _t: null, restoredFrom: null,

    part(name) { return this.data[name] || null; },
    put(name, obj) {
      this.data = { ...this.data, [name]: obj, savedAt: Date.now() };
      try { localStorage.setItem(KEY, JSON.stringify(this.data)); } catch (e) { /* storage unavailable */ }
      clearTimeout(this._t);
      this._t = setTimeout(() => this.flush(), 1500);
    },
    /** Save only when the value actually changed (safe to call from render code) */
    keep(name, obj) {
      if (JSON.stringify(this.data[name] || null) === JSON.stringify(obj)) return;
      this.put(name, obj);
    },
    clear(name) {
      const d = { ...this.data }; delete d[name]; d.savedAt = Date.now(); this.data = d;
      try { localStorage.setItem(KEY, JSON.stringify(d)); } catch (e) { /* ignore */ }
      this.flush();
    },
    async flush() {
      clearTimeout(this._t);
      if (!this.db) return;
      try { await this.db.doc('progress/resume').set(this.data); } catch (e) { /* ignore */ }
    },

    /** Load the newest saved state: this browser or the page's database. Waits at most `ms`. */
    async init(ms = 1500) {
      let local = null;
      try { local = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) { local = null; }
      if (local) { this.data = local; this.restoredFrom = 'device'; }
      const remote = await Promise.race([
        (async () => {
          try {
            const db = window.claude && window.claude.use ? await window.claude.use('db') : null;
            if (!db) return null;
            this.db = db;
            const snap = await db.doc('progress/resume').get();
            return snap.exists ? snap.data() : null;
          } catch (e) { return null; }
        })(),
        new Promise(res => setTimeout(() => res(null), ms))
      ]);
      if (remote && (remote.savedAt || 0) > (this.data.savedAt || 0)) {
        this.data = remote; this.restoredFrom = 'cloud';
        try { localStorage.setItem(KEY, JSON.stringify(remote)); } catch (e) { /* ignore */ }
      }
      // the db handle may arrive after the timeout; keep it for later saves
      if (!this.db && window.claude && window.claude.use) window.claude.use('db').then(db => { if (db) this.db = db; }).catch(() => {});
      const save = () => this.flush();
      document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') { App.emit('persist'); save(); } });
      window.addEventListener('pagehide', () => { App.emit('persist'); save(); });
    }
  };
  window.Resume = R;
})();
