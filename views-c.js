/* Woodshed — Today (session planner), Technique drills, Practice log */
(function () {
  const { Theory: TH, Content: C, Audio2: AU, UI, App, Store } = window;
  const { h } = UI;
  const T = AU.Transport;
  const AREAS = ['Chords', 'Right hand', 'Left hand', 'Improvisation', 'Scales & theory', 'Repertoire', 'Ear'];
  const FAM_FOR = { Rock: ['CAGED', 'Triads'], Blues: ['CAGED', 'Jazz'], Metal: ['Rock & metal', 'Triads'], Jazz: ['Jazz'], Manouche: ['Gypsy jazz'], Classical: ['Classical', 'Triads'], Prog: ['Triads', 'Jazz'], World: ['Triads', 'CAGED'], Funk: ['Jazz', 'Triads'] };

  // deterministic daily randomness
  function rng(seed) { let x = seed % 2147483647; if (x <= 0) x += 2147483646; return () => (x = x * 16807 % 2147483647) / 2147483647; }
  const dayNum = () => Math.floor((Date.now() - new Date().getTimezoneOffset() * 60000) / 86400000);
  const pick = (arr, r) => arr[Math.floor(r() * arr.length)];

  /* ================= Today ================= */
  const td = { day: dayNum(), minutes: 30, style: 'Auto', regen: 0, plan: [], cur: 0, remaining: 0, running: false, elapsed: 0, timer: null, done: false, resumed: null };
  const te = {};
  const R = window.Resume;

  function styleOfDay() { return td.style === 'Auto' ? C.STYLES[td.day % C.STYLES.length] : td.style; }

  function persistToday() {
    R.put('today', { day: td.day, minutes: td.minutes, style: td.style, regen: td.regen, cur: td.cur,
      remaining: Math.round(td.remaining), elapsed: Math.round(td.elapsed), running: td.running, done: td.done });
  }

  function makePlan(keepProgress) {
    const r = rng(td.day * 97 + td.regen * 13 + td.minutes);
    const style = styleOfDay();
    const drillsFor = C.DRILLS.filter(d => d.styles.includes(style) || d.styles.includes('All'));
    const progs = C.PROGRESSIONS.filter(p => p.style === style);
    const prog = pick(progs.length ? progs : C.PROGRESSIONS, r);
    const perm = pick(C.PERMS, r);
    const warm = pick(['perm', 'spider', 'trill'], r);
    const tech = pick(drillsFor.filter(d => !['perm', 'spider', 'trill', warm].includes(d.id)), r) || C.DRILLS[1];
    const fam = pick(FAM_FOR[style] || ['CAGED'], r);
    const root = Math.floor(r() * 12);
    const prompt = pick(C.PROMPTS, r);
    const blocks = C.ROUTINES[td.minutes].map(([name, min]) => {
      if (name === 'Warm-up') {
        const d = C.DRILLS.find(x => x.id === warm);
        return { name, min, title: d.name + (warm === 'perm' ? ' · pattern ' + perm : ''), detail: 'Slow and relaxed. Start well below your top speed.', go: () => App.go('technique', { drill: warm, perm }) };
      }
      if (name === 'Technique') return { name, min, title: tech.name, detail: tech.hand + ' hand · ' + tech.how[0], go: () => App.go('technique', { drill: tech.id }) };
      if (name === 'Chords') return { name, min, title: fam + ' shapes in ' + TH.KEYS[root].name, detail: 'Learn two new shapes, then run the cycle trainer with one of them.', go: () => App.go('chords', { fam }) };
      if (name === 'Jam & improvise') return { name, min, title: prog.name + ' (' + prog.style + ')', detail: 'Prompt: ' + prompt[1], go: () => App.go('jam', { progId: prog.id }) };
      return { name, min, title: 'Free play', detail: 'Play something you love, or loop the jam and record yourself to listen back.', go: null };
    });
    td.plan = blocks;
    if (!keepProgress) { td.cur = 0; td.remaining = blocks[0].min * 60; td.elapsed = 0; td.done = false; td.resumed = null; stopTimer(); persistToday(); }
    renderToday();
  }

  /** Start a brand-new plan for today, keeping the chosen length and style */
  function freshPlan() { td.day = dayNum(); td.regen = 0; makePlan(); }

  function restoreToday() {
    const s = R.part('today');
    const today = dayNum();
    if (!s || !C.ROUTINES[s.minutes]) return false;
    const started = (s.elapsed || 0) > 0 && !s.done;
    if (s.day !== today && !started) { td.minutes = s.minutes; td.style = s.style || 'Auto'; return false; }
    Object.assign(td, { day: s.day, minutes: s.minutes, style: s.style || 'Auto', regen: s.regen || 0, cur: Math.min(s.cur || 0, C.ROUTINES[s.minutes].length - 1),
      remaining: s.remaining ?? C.ROUTINES[s.minutes][0][1] * 60, elapsed: s.elapsed || 0, done: !!s.done, running: false });
    td.resumed = started ? { wasRunning: !!s.running, otherDay: s.day !== today, from: R.restoredFrom } : null;
    makePlan(true);
    return true;
  }

  function stopTimer() { td.running = false; clearInterval(td.timer); td.timer = null; }
  function startTimer() {
    if (td.running) { stopTimer(); renderTimer(); persistToday(); return; }
    if (td.done) { UI.toast('This session is complete. Start a new plan to go again.'); return; }
    td.running = true; td.resumed = null; renderResume();
    let last = Date.now(), lastSave = Date.now();
    td.timer = setInterval(() => {
      const now = Date.now(), dt = Math.min(5, (now - last) / 1000); last = now;
      td.remaining -= dt; td.elapsed += dt;
      if (td.remaining <= 0) {
        chime();
        if (td.cur < td.plan.length - 1) { td.cur++; td.remaining = td.plan[td.cur].min * 60; stopTimer(); persistToday(); renderToday(); UI.toast('Next: ' + td.plan[td.cur].name); return; }
        td.remaining = 0; td.done = true; stopTimer(); persistToday(); renderToday(); UI.toast('Session complete. Log it below.'); return;
      }
      if (now - lastSave > 5000) { lastSave = now; persistToday(); }
      renderTimer();
    }, 250);
    persistToday();
    renderTimer();
  }
  function chime() { try { AU.ensure(); const t = AU.ctx.currentTime + .02; [76, 81, 88].forEach((m, i) => AU.pluck(m, t + i * .12, { vel: .7 })); } catch (e) { /* ignore */ } }
  function renderTimer() {
    if (!te.timer) return;
    te.timer.textContent = UI.fmtTime(td.remaining);
    te.startBtn.textContent = td.done ? 'Session complete' : td.running ? 'Pause' : (td.elapsed > 0 ? 'Resume' : 'Start session');
    te.startBtn.disabled = td.done;
    te.elapsed.textContent = td.elapsed >= 60 ? Math.floor(td.elapsed / 60) + ' min practised so far' : td.elapsed > 0 ? 'Under a minute practised so far' : '';
  }

  function renderResume() {
    if (!te.resume) return;
    te.resume.innerHTML = '';
    const r = td.resumed;
    te.resume.hidden = !r;
    if (!r) return;
    const b = td.plan[td.cur];
    te.resume.append(
      h('div', { class: 'eyebrow' }, r.otherDay ? 'Unfinished session from an earlier day' : 'Picked up where you left off'),
      h('p', {}, 'Block ' + (td.cur + 1) + ' of ' + td.plan.length + ' · ' + b.name + ': ' + b.title + '. ' + UI.fmtTime(td.remaining) + ' left in this block, ' + (td.elapsed < 60 ? 'under a minute' : Math.round(td.elapsed / 60) + ' min') + ' practised.' + (r.wasRunning ? ' The timer paused when the app closed.' : '') + (r.from === 'cloud' ? ' Restored from your last device.' : '')),
      h('div', { class: 'row' },
        h('button', { class: 'btn primary', onclick: () => { if (b.go) b.go(); startTimer(); } }, 'Resume ' + b.name.toLowerCase()),
        h('button', { class: 'btn', onclick: freshPlan }, "Start today's plan instead")));
  }

  function renderStats() {
    const ss = Store.sessions;
    const today = Store.todayISO();
    const d0 = new Date(); const weekAgo = new Date(d0.getFullYear(), d0.getMonth(), d0.getDate() - 6);
    const iso = d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    const wk = ss.filter(s => s.date >= iso(weekAgo));
    const mins = wk.reduce((a, s) => a + (+s.minutes || 0), 0);
    const days = new Set(ss.map(s => s.date));
    let streak = 0; const cur = new Date(d0);
    if (!days.has(today)) cur.setDate(cur.getDate() - 1);
    while (days.has(iso(cur))) { streak++; cur.setDate(cur.getDate() - 1); }
    te.stats.innerHTML = '';
    [['Minutes this week', mins], ['Sessions this week', wk.length], ['Day streak', streak]].forEach(([k, v]) => te.stats.append(h('div', { class: 'stat' }, h('div', { class: 'v' }, v), h('div', { class: 'k' }, k))));
    te.bests.innerHTML = '';
    const bests = Object.entries(Store.progress.drills || {}).map(([id, d]) => ({ d: C.DRILLS.find(x => x.id === id), best: d.best })).filter(x => x.d && x.best).slice(0, 6);
    if (!bests.length) te.bests.append(h('p', { class: 'note', style: 'margin:0' }, 'Your clean tempos from the Technique tab show up here.'));
    else bests.forEach(b => te.bests.append(h('div', { class: 'row', style: 'justify-content:space-between' }, h('span', {}, b.d.name), h('span', { class: 'mono num' }, b.best + ' BPM'))));
  }

  function renderToday() {
    if (!te.list) return;
    te.list.innerHTML = '';
    te.styleLabel.textContent = styleOfDay();
    const mSel = document.getElementById('td-min'), sSel = document.getElementById('td-style');
    if (mSel) mSel.value = td.minutes; if (sSel) sSel.value = td.style;
    td.plan.forEach((b, i) => te.list.append(h('div', { class: 'block' + (i === td.cur && !td.done ? ' cur' : '') + (i < td.cur || td.done ? ' done' : '') },
      h('div', { class: 'min' }, b.min, h('small', {}, 'min')),
      h('div', { class: 'what' }, h('div', { class: 'eyebrow' }, b.name), h('b', {}, b.title), h('span', {}, b.detail)),
      b.go ? h('button', { class: 'btn small', onclick: () => { if (i !== td.cur) { td.cur = i; if (!td.running) td.remaining = b.min * 60; td.done = false; persistToday(); } renderToday(); b.go(); } }, 'Open') : h('span'))));
    te.curName.textContent = td.done ? 'All blocks done' : td.plan[td.cur] ? td.plan[td.cur].name + ': ' + td.plan[td.cur].title : '';
    renderTimer(); renderResume();
  }

  function mountToday(sec) {
    const restoredSettings = R.part('today');
    if (restoredSettings && C.ROUTINES[restoredSettings.minutes]) { td.minutes = restoredSettings.minutes; td.style = restoredSettings.style || 'Auto'; }
    sec.append(
      h('div', { class: 'row', style: 'justify-content:space-between;margin-bottom:16px' },
        h('div', {}, h('h1', { class: 'h' }, "Today's session"),
          h('p', { class: 'lede' }, 'A balanced plan for the time you have: technique for both hands, new chord shapes, then improvising over a progression. Your place is saved as you go, so you can close the app and resume later.'))),
      te.resume = h('div', { class: 'prompt', hidden: true, style: 'margin-bottom:18px' }),
      h('div', { class: 'grid2' },
        h('div', { class: 'stack' },
          h('div', { class: 'panel stack' },
            h('div', { class: 'row' },
              UI.field('Time available', UI.select('td-min', [20, 30, 45, 60].map(m => ({ value: m, label: m + ' minutes' })), td.minutes, v => { td.minutes = +v; td.day = dayNum(); makePlan(); }, 'Minutes')),
              UI.field('Focus style', UI.select('td-style', [{ value: 'Auto', label: 'Rotate daily' }, ...C.STYLES.map(s => ({ value: s, label: s }))], td.style, v => { td.style = v; td.day = dayNum(); makePlan(); }, 'Style')),
              h('button', { class: 'btn', onclick: () => { td.regen++; td.day = dayNum(); makePlan(); } }, 'Shuffle plan')),
            h('div', { class: 'note' }, 'Focus: ', te.styleLabel = h('b', {})),
            te.list = h('div', { class: 'block-list' }))),
        h('div', { class: 'stack' },
          h('div', { class: 'panel stack' },
            h('div', { class: 'eyebrow' }, 'Block timer'),
            te.curName = h('div', { class: 'h2' }),
            te.timer = h('div', { class: 'timer', 'aria-live': 'off' }, '00:00'),
            te.elapsed = h('div', { class: 'note' }),
            h('div', { class: 'row' },
              te.startBtn = h('button', { class: 'btn primary', onclick: startTimer }, 'Start session'),
              h('button', { class: 'btn', onclick: () => { if (td.cur < td.plan.length - 1) { td.cur++; td.remaining = td.plan[td.cur].min * 60; persistToday(); renderToday(); } } }, 'Skip block'),
              h('button', { class: 'btn', onclick: () => {
                stopTimer(); persistToday();
                const mins = Math.max(1, Math.round(td.elapsed / 60));
                const areas = new Set(['Right hand', 'Left hand', 'Chords', 'Improvisation']);
                App.go('log', { prefill: { minutes: td.elapsed > 60 ? mins : td.minutes, areas: [...areas], styles: [styleOfDay()], fromToday: true } });
              } }, 'Finish & log')),
            h('button', { class: 'btn small', style: 'justify-self:start', onclick: freshPlan }, 'Reset session')),
          h('div', { class: 'panel stack' }, te.stats = h('div', { class: 'stats' }),
            h('div', { class: 'eyebrow' }, 'Best clean tempos'), te.bests = h('div', { class: 'stack', style: 'gap:6px' }))))
    );
    Store.onChange(renderStats);
    App.on(ev => {
      if (ev === 'persist' && (td.running || td.elapsed > 0)) persistToday();
      if (ev === 'session-logged') { td.day = dayNum(); td.regen = 0; makePlan(); }
    });
    if (!restoreToday()) makePlan();
    renderStats();
  }
  App.register('today', { mount: mountToday, show() { renderStats(); } });

  /* ================= Technique ================= */
  const tq = { hand: 'All', style: 'All', id: 'perm', perm: '1234', trainer: false, step: 4, every: 4, start: null, goal: null, chA: 'G', chB: 'Cmaj7', chTimer: null, chLeft: 0 };
  const tqe = {};
  const CH_LIST = ['C', 'G', 'D', 'A', 'E', 'Am', 'Em', 'Dm', 'F (barre)', 'Bm (barre)', 'Bb (barre)', 'F#m (barre)', 'Cmaj7', 'G7', 'Am7', 'Dm7', 'E7', 'Bm7b5', 'Am6', 'E9'];
  const drill = () => C.DRILLS.find(d => d.id === tq.id);
  const subFor = unit => /16/.test(unit) ? 4 : /triplet/.test(unit) ? 3 : /8th/.test(unit) ? 2 : 1;

  function renderDrillList() {
    tqe.list.innerHTML = '';
    C.DRILLS.filter(d => (tq.hand === 'All' || d.hand === tq.hand) && (tq.style === 'All' || d.styles.includes(tq.style) || d.styles.includes('All'))).forEach(d => {
      const best = Store.progress.drills[d.id];
      tqe.list.append(h('button', { class: 'drill-item', 'aria-selected': String(d.id === tq.id), onclick: () => { tq.id = d.id; tq.start = null; tq.goal = null; renderDrillList(); renderDrill(); } },
        h('span', { class: 't' }, d.name),
        h('span', { class: 'm' }, h('span', { class: 'tag ' + (d.hand === 'Right' ? 'r' : d.hand === 'Left' ? 'l' : '') }, d.hand + (d.hand === 'Both' ? ' hands' : ' hand')), h('span', {}, d.styles.join(', ')), best ? h('span', { class: 'mono' }, 'best ' + best.best) : '')));
    });
  }

  function spark(hist) {
    if (!hist || hist.length < 2) return '';
    const W = 220, H = 48, vals = hist.map(x => x[1]), mx = Math.max(...vals), mn = Math.min(...vals);
    const x = i => 4 + i * (W - 8) / (vals.length - 1), y = v => H - 6 - (mx === mn ? .5 : (v - mn) / (mx - mn)) * (H - 14);
    const d = vals.map((v, i) => (i ? 'L' : 'M') + x(i).toFixed(1) + ' ' + y(v).toFixed(1)).join(' ');
    return UI.s('svg', { viewBox: `0 0 ${W} ${H}`, style: 'width:220px;max-width:100%;height:auto' },
      UI.s('path', { d: d + ` L ${x(vals.length - 1)} ${H - 2} L ${x(0)} ${H - 2} Z`, style: 'fill:var(--accent-soft)' }),
      UI.s('path', { d, style: 'fill:none;stroke:var(--accent);stroke-width:2' }),
      UI.s('circle', { cx: x(vals.length - 1), cy: y(vals[vals.length - 1]), r: 3.5, style: 'fill:var(--accent)' }));
  }

  function practice() {
    const d = drill();
    if (T.running && App.jamOwner === 'drill') { T.stop(); App.jamOwner = null; return; }
    if (T.running) T.stop();
    App.jamOwner = 'drill';
    T.num = 4; T.den = 4; T.swing = false; T.sub = subFor(d.unit); T.clickSubs = T.sub > 1; T.clickOn = true;
    T.setBpm(tq.start || d.bpm[0] || 80);
    T.trainer = tq.trainer ? { on: true, step: tq.step, every: tq.every, target: tq.goal || d.bpm[1] || 200 } : null;
    T.start();
  }

  function startChanges() {
    clearInterval(tq.chTimer);
    tq.chLeft = 60; AU.ensure(); AU.click(0, 3);
    tq.chTimer = setInterval(() => {
      tq.chLeft--;
      if (tqe.chClock) tqe.chClock.textContent = UI.fmtTime(tq.chLeft);
      if (tq.chLeft <= 0) { clearInterval(tq.chTimer); chime(); UI.toast("Time. Enter how many changes you made."); }
    }, 1000);
    tqe.chClock.textContent = UI.fmtTime(60);
  }

  function persistTech() { window.Resume.keep('technique', { hand: tq.hand, style: tq.style, id: tq.id, perm: tq.perm, trainer: tq.trainer, step: tq.step, every: tq.every, start: tq.start, goal: tq.goal, chA: tq.chA, chB: tq.chB }); }
  function renderDrill() {
    const d = drill();
    setTimeout(persistTech, 0);
    const best = Store.progress.drills[d.id];
    const box = tqe.detail; box.innerHTML = '';
    box.append(h('div', {}, h('div', { class: 'eyebrow' }, d.hand + (d.hand === 'Both' ? ' hands' : ' hand') + ' · ' + d.unit), h('h2', { class: 'h', style: 'font-size:28px;margin-top:2px' }, d.name)),
      h('ol', { class: 'how' }, d.how.map(x => h('li', {}, x))));
    let steps = d.tab || (d.gen ? d.gen(tq.perm) : null);
    if (d.id === 'perm') box.append(h('div', { class: 'row' }, UI.field('Finger pattern', UI.select('tq-perm', C.PERMS.map(p => ({ value: p, label: p.split('').join('-') })), tq.perm, v => { tq.perm = v; renderDrill(); }, 'Pattern')),
      h('button', { class: 'btn small', onclick: () => { tq.perm = C.PERMS[Math.floor(Math.random() * 24)]; renderDrill(); } }, 'Random pattern')));
    if (steps) box.append(h('pre', { class: 'tab', 'aria-label': 'Tablature' }, UI.renderTab(steps)),
      h('div', { class: 'row' }, h('button', { class: 'btn small', onclick: () => UI.playSteps(steps, Math.min(T.bpm, 120), subFor(d.unit) > 2 ? 2 : subFor(d.unit)) }, '▶ Hear it at ' + Math.min(T.bpm, 120) + ' BPM'),
        h('span', { class: 'note' }, 'h = hammer-on, p = pull-off, b = bend, / = slide, ~ = vibrato')));
    if (d.rhythm) box.append(h('pre', { class: 'tab' }, d.rhythm));
    if (d.refs) box.append(h('div', { class: 'row' }, d.refs.map(r => h('button', { class: 'btn small', onclick: () => AU.pluck(r.midi, 0, { vel: .9 }) }, '♪ ' + r.label))));
    if (d.changes) {
      box.append(h('div', { class: 'row' },
        UI.field('Chord A', UI.select('ch-a', CH_LIST.map(c => ({ value: c, label: c })), tq.chA, v => { tq.chA = v; renderDrill(); }, 'Chord A')),
        UI.field('Chord B', UI.select('ch-b', CH_LIST.map(c => ({ value: c, label: c })), tq.chB, v => { tq.chB = v; renderDrill(); }, 'Chord B')),
        h('button', { class: 'btn primary', onclick: startChanges }, 'Start 60 seconds'),
        tqe.chClock = h('span', { class: 'timer', style: 'font-size:32px' }, UI.fmtTime(tq.chLeft || 60))));
      const key = tq.chA + ' ↔ ' + tq.chB, rec = Store.progress.changes[key];
      const inp = h('input', { id: 'ch-count', type: 'number', min: 0, max: 200, style: 'width:90px', placeholder: 'Count' });
      box.append(h('div', { class: 'row' }, UI.field('Changes made', inp), h('button', { class: 'btn', onclick: () => { const n = +inp.value; if (!n) return UI.toast('Enter a count first'); Store.recordChanges(key, n); UI.toast('Saved ' + n + ' changes'); renderDrill(); } }, 'Save count'),
        h('span', { class: 'note' }, rec ? 'Best for ' + key + ': ' + rec.best : 'No count saved for this pair yet')), rec ? spark(rec.hist) : '');
      return;
    }
    if (!d.bpm[1]) return;
    const startInp = h('input', { id: 'tq-start', type: 'number', min: 30, max: 300, value: tq.start || (best ? Math.max(d.bpm[0], best.best - 10) : d.bpm[0]), style: 'width:80px', onchange: e => { tq.start = +e.target.value; persistTech(); } });
    tq.start = +startInp.value;
    const goalInp = h('input', { id: 'tq-goal', type: 'number', min: 30, max: 320, value: tq.goal || d.bpm[1], style: 'width:80px', onchange: e => { tq.goal = +e.target.value; persistTech(); } });
    const running = T.running && App.jamOwner === 'drill';
    box.append(h('div', { class: 'panel stack', style: 'box-shadow:none;background:var(--surface-2)' },
      h('div', { class: 'row' },
        UI.field('Start BPM', startInp), UI.field('Goal BPM', goalInp),
        UI.field('Speed trainer', h('button', { class: 'btn', id: 'tq-trainer', 'aria-pressed': String(tq.trainer), onclick: e => { tq.trainer = !tq.trainer; e.currentTarget.setAttribute('aria-pressed', String(tq.trainer)); e.currentTarget.textContent = tq.trainer ? 'On' : 'Off'; persistTech(); } }, tq.trainer ? 'On' : 'Off')),
        UI.field('Add BPM', UI.select('tq-step', [2, 4, 5, 8].map(v => ({ value: v, label: '+' + v })), tq.step, v => { tq.step = +v; persistTech(); }, 'Step')),
        UI.field('Every', UI.select('tq-every', [2, 4, 8].map(v => ({ value: v, label: v + ' bars' })), tq.every, v => { tq.every = +v; persistTech(); }, 'Every'))),
      h('div', { class: 'row' }, tqe.practiceBtn = h('button', { class: 'btn primary', onclick: practice }, running ? '■ Stop metronome' : '▶ Practice with metronome'),
        h('span', { class: 'note' }, 'Click plays ' + d.unit + '. Only count a tempo as clean when every note is even and in time.'))));
    const clean = h('input', { id: 'tq-clean', type: 'number', min: 20, max: 320, style: 'width:90px', placeholder: 'BPM' });
    box.append(h('div', { class: 'row' }, UI.field('Clean tempo today', clean),
      h('button', { class: 'btn', onclick: () => { const v = +clean.value || T.bpm; Store.recordDrill(d.id, v); UI.toast('Saved ' + v + ' BPM'); renderDrill(); renderDrillList(); } }, 'Save tempo'),
      h('button', { class: 'btn small', onclick: () => { clean.value = T.bpm; } }, 'Use current (' + T.bpm + ')')),
      best ? h('div', { class: 'row', style: 'align-items:center' }, h('span', { class: 'note' }, 'Best ' + best.best + ' BPM · goal ' + d.bpm[1]), spark(best.hist)) : h('div', { class: 'note' }, 'Suggested range: ' + d.bpm[0] + '–' + d.bpm[1] + ' BPM.'));
  }

  function mountTech(sec) {
    const saved = window.Resume.part('technique');
    if (saved && C.DRILLS.some(x => x.id === saved.id)) Object.assign(tq, saved);
    tqe.hands = h('div', { class: 'chips' });
    ['All', 'Right', 'Left', 'Both'].forEach(x => tqe.hands.append(h('button', { class: 'chip', 'aria-pressed': String(tq.hand === x), onclick: () => { tq.hand = x; [...tqe.hands.children].forEach(c => c.setAttribute('aria-pressed', String(c.dataset.v === x))); renderDrillList(); persistTech(); }, 'data-v': x }, x === 'All' ? 'All drills' : x === 'Both' ? 'Both hands' : x + ' hand')));
    sec.append(
      h('h1', { class: 'h' }, 'Technique'),
      h('p', { class: 'lede', style: 'margin-bottom:16px' }, 'Drills for the picking hand (pick, fingers and hybrid) and the fretting hand. Practise slowly with the speed trainer, then save the fastest tempo you can play cleanly.'),
      h('div', { class: 'row', style: 'margin-bottom:12px' }, tqe.hands, UI.field('Style', UI.select('tq-style', ['All', ...C.STYLES].map(s => ({ value: s, label: s })), tq.style, v => { tq.style = v; renderDrillList(); persistTech(); }, 'Style'))),
      h('div', { class: 'grid2', style: 'grid-template-columns:minmax(0,.8fr) minmax(0,1.7fr)' },
        tqe.list = h('div', { class: 'drill-list' }),
        tqe.detail = h('div', { class: 'panel stack' }))
    );
    T.on(type => { if ((type === 'state') && tqe.practiceBtn) tqe.practiceBtn.textContent = T.running && App.jamOwner === 'drill' ? '■ Stop metronome' : '▶ Practice with metronome'; });
    Store.onChange(() => { if (App.current === 'technique') { renderDrillList(); } });
    renderDrillList(); renderDrill();
  }
  App.register('technique', { mount: mountTech, show(o) { if (o && o.drill) { tq.id = o.drill; tq.hand = 'All'; tq.style = 'All'; if (o.perm) tq.perm = o.perm; tq.start = null; renderDrillList(); renderDrill(); } } });

  /* ================= Log ================= */
  const lg = { areas: new Set(), styles: new Set(), confirm: null };
  const le = {};

  function renderForm(prefill) {
    if (prefill) { lg.fromToday = !!prefill.fromToday; lg.areas = new Set(prefill.areas || []); lg.styles = new Set(prefill.styles || []); le.min.value = prefill.minutes || 30; }
    le.areaChips.innerHTML = ''; le.styleChips.innerHTML = '';
    AREAS.forEach(a => le.areaChips.append(h('button', { class: 'chip', 'aria-pressed': String(lg.areas.has(a)), onclick: e => { lg.areas.has(a) ? lg.areas.delete(a) : lg.areas.add(a); e.currentTarget.setAttribute('aria-pressed', String(lg.areas.has(a))); } }, a)));
    C.STYLES.forEach(a => le.styleChips.append(h('button', { class: 'chip', 'aria-pressed': String(lg.styles.has(a)), onclick: e => { lg.styles.has(a) ? lg.styles.delete(a) : lg.styles.add(a); e.currentTarget.setAttribute('aria-pressed', String(lg.styles.has(a))); } }, a)));
  }

  function renderChart() {
    const days = [];
    const d0 = new Date();
    for (let i = 13; i >= 0; i--) { const d = new Date(d0.getFullYear(), d0.getMonth(), d0.getDate() - i); days.push(d); }
    const iso = d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    const vals = days.map(d => Store.sessions.filter(s => s.date === iso(d)).reduce((a, s) => a + (+s.minutes || 0), 0));
    const W = 560, H = 170, L = 34, B = 24, top = 12;
    const mx = Math.max(40, Math.ceil(Math.max(...vals) / 20) * 20);
    const bw = (W - L - 8) / 14;
    const y = v => top + (H - top - B) * (1 - v / mx);
    const svg = UI.s('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': 'Minutes practised per day, last 14 days' });
    [0, mx / 2, mx].forEach(v => { svg.append(UI.s('line', { x1: L, x2: W - 4, y1: y(v), y2: y(v), style: 'stroke:var(--line);stroke-width:1' }), UI.s('text', { x: L - 6, y: y(v) + 4, 'text-anchor': 'end', style: 'fill:var(--muted);font:500 10px var(--mono)' }, Math.round(v))); });
    vals.forEach((v, i) => {
      const x = L + i * bw + 4;
      if (v > 0) svg.append(UI.s('rect', { x, y: y(v), width: bw - 8, height: y(0) - y(v), rx: 2, style: `fill:${i === 13 ? 'var(--accent)' : 'var(--tone)'}` }, UI.s('title', {}, v + ' min')));
      svg.append(UI.s('text', { x: x + (bw - 8) / 2, y: H - 8, 'text-anchor': 'middle', style: 'fill:var(--muted);font:500 10px var(--mono)' }, i === 13 ? 'today' : 'SMTWTFS'[days[i].getDay()]));
    });
    le.chart.innerHTML = ''; le.chart.append(svg);
    // area totals, last 30 days
    const cutoff = iso(new Date(d0.getFullYear(), d0.getMonth(), d0.getDate() - 29));
    const tot = {}; Store.sessions.filter(s => s.date >= cutoff).forEach(s => (s.areas || []).forEach(a => { tot[a] = (tot[a] || 0) + (+s.minutes || 0) / Math.max(1, (s.areas || []).length); }));
    const mxA = Math.max(1, ...Object.values(tot));
    le.areas.innerHTML = '';
    if (!Object.keys(tot).length) le.areas.append(h('p', { class: 'note', style: 'margin:0' }, 'Tag sessions with focus areas to see where your time goes.'));
    AREAS.filter(a => tot[a]).forEach(a => le.areas.append(h('div', { style: 'display:grid;grid-template-columns:120px 1fr 44px;gap:8px;align-items:center;font-size:13px' },
      h('span', {}, a), h('span', { style: 'height:8px;border-radius:4px;background:var(--line);overflow:hidden' }, h('span', { style: `display:block;height:100%;width:${tot[a] / mxA * 100}%;background:var(--tone)` })), h('span', { class: 'mono num', style: 'text-align:right' }, Math.round(tot[a])))));
  }

  function renderHist() {
    le.hist.innerHTML = '';
    le.mode.textContent = Store.mode === 'cloud' ? 'Saved with this page, so it follows you to any device you open it on.' : 'Saved in this browser only.';
    if (!Store.sessions.length) { le.hist.append(h('p', { class: 'muted', style: 'margin:0' }, 'No sessions yet. Your first entry will appear here.')); return; }
    Store.sessions.slice(0, 60).forEach(s => {
      const confirming = lg.confirm === s.id;
      le.hist.append(h('div', { class: 'hist-item' },
        h('div', { class: 'd' }, new Date(s.date + 'T12:00').toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' }), ' · ', h('span', { class: 'mono' }, s.minutes + ' min')),
        h('button', { class: 'btn small', onclick: () => { if (confirming) { Store.deleteSession(s.id); lg.confirm = null; } else { lg.confirm = s.id; renderHist(); } } }, confirming ? 'Confirm delete' : 'Delete'),
        h('div', { class: 'chips', style: 'grid-column:1/-1' }, [...(s.areas || []), ...(s.styles || [])].map(t => h('span', { class: 'tag' }, t))),
        s.notes ? h('div', { style: 'grid-column:1/-1;font-size:14px' }, s.notes) : ''));
    });
  }

  function mountLog(sec) {
    le.min = h('input', { id: 'lg-min', type: 'number', min: 1, max: 600, value: 30, style: 'width:90px' });
    le.date = h('input', { id: 'lg-date', type: 'date', value: Store.todayISO() });
    le.notes = h('textarea', { id: 'lg-notes', placeholder: 'What went well, what to fix next time, tempos, new shapes…' });
    sec.append(
      h('h1', { class: 'h' }, 'Practice log'),
      h('p', { class: 'lede', style: 'margin-bottom:16px' }, 'Record each session so you can see where your time goes and keep the balance between hands, chords and improvising.'),
      h('div', { class: 'grid2' },
        h('div', { class: 'stack' },
          h('form', { class: 'panel stack', onsubmit: async e => {
            e.preventDefault();
            const minutes = +le.min.value;
            if (!minutes) return UI.toast('Enter the minutes you practised');
            try {
              await Store.addSession({ date: le.date.value || Store.todayISO(), minutes, areas: [...lg.areas], styles: [...lg.styles], notes: le.notes.value.trim() });
              le.notes.value = ''; UI.toast('Session logged');
              if (lg.fromToday) { lg.fromToday = false; App.emit('session-logged'); }
            } catch (err) { UI.toast(err.message); }
          } },
            h('div', { class: 'row' }, UI.field('Date', le.date), UI.field('Minutes', le.min)),
            h('div', { class: 'stack', style: 'gap:6px' }, h('div', { class: 'eyebrow' }, 'Focus areas'), le.areaChips = h('div', { class: 'chips' })),
            h('div', { class: 'stack', style: 'gap:6px' }, h('div', { class: 'eyebrow' }, 'Styles'), le.styleChips = h('div', { class: 'chips' })),
            UI.field('Notes', le.notes),
            h('div', { class: 'row' }, h('button', { class: 'btn primary', type: 'submit' }, 'Save session'), le.mode = h('span', { class: 'note' }))),
          h('div', { class: 'panel stack' }, h('div', { class: 'eyebrow' }, 'History'), le.hist = h('div', { class: 'hist' }))),
        h('div', { class: 'stack' },
          h('div', { class: 'panel stack' }, h('div', { class: 'eyebrow' }, 'Minutes per day, last 14 days'), le.chart = h('div', { class: 'chart' })),
          h('div', { class: 'panel stack' }, h('div', { class: 'eyebrow' }, 'Minutes by focus area, last 30 days'), le.areas = h('div', { class: 'stack', style: 'gap:8px' }))))
    );
    renderForm();
    Store.onChange(() => { renderHist(); renderChart(); });
    renderHist(); renderChart();
  }
  App.register('log', { mount: mountLog, show(o) { if (o && o.prefill) renderForm(o.prefill); renderHist(); renderChart(); } });
})();
