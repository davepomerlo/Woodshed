/* Woodshed — Chords library + cycle trainer; Scales & fretboard explorer + note quiz */
(function () {
  const { Theory: TH, Audio2: AU, UI, App } = window;
  const { h } = UI;
  const T = AU.Transport;
  const FAMS = ['All', 'CAGED', 'Jazz', 'Gypsy jazz', 'Rock & metal', 'Triads', 'Classical'];
  const CYCLE = [0, 5, 10, 3, 8, 1, 6, 11, 4, 9, 2, 7];

  /* ================= Chords ================= */
  const cs = { root: 7, q: 'all', fam: 'All', cyc: { q: 'maj7', bars: 2, i: 0, lastRs: 1 } };
  const ce = {};

  function persistChords() { window.Resume.keep('chords', { root: cs.root, q: cs.q, fam: cs.fam, cq: cs.cyc.q, bars: cs.cyc.bars }); }
  function renderChordGrid() {
    persistChords();
    ce.grid.innerHTML = '';
    const list = TH.SHAPES.filter(sh => (cs.q === 'all' || sh.q === cs.q) && (cs.fam === 'All' || sh.fam === cs.fam));
    if (!list.length) { ce.grid.append(h('p', { class: 'muted' }, 'No shapes for that combination yet. Try another family.')); return; }
    list.forEach(sh => {
      const p = TH.placeShape(sh, cs.root, 1);
      const midi = p.midi.filter(m => m != null);
      const notes = p.frets.map((f, i) => f === null ? null : TH.noteName((TH.TUNING[i] + f) % 12, cs.root)).filter(Boolean);
      ce.grid.append(h('button', { class: 'chord-card', onclick: () => AU.strum(midi, 0, { vel: .9, spread: .03 }), title: 'Tap to hear' },
        h('div', { class: 'nm' }, TH.chordLabel(cs.root, sh.q, cs.root)),
        UI.chordDiagram(p.frets, cs.root),
        h('div', { class: 'sh' }, sh.name),
        h('div', { class: 'sh mono' }, notes.join(' '))));
    });
  }

  function cycleChord(i) {
    const pc = CYCLE[i % 12];
    const shapes = TH.shapesFor(cs.cyc.q).filter(s => s.fam !== 'Triads');
    const rs = cs.cyc.lastRs === 0 ? 1 : 0;
    const pick = shapes.find(s => s.rs === rs) || shapes[0];
    return { pc, shape: pick, p: pick ? TH.placeShape(pick, pc, 1) : null };
  }
  function renderCycle() {
    const cur = cycleChord(cs.cyc.i), nxt = cycleChord(cs.cyc.i + 1);
    ce.cycNow.innerHTML = '';
    ce.cycNow.append(
      h('div', { class: 'now-name' }, TH.chordLabel(cur.pc, cs.cyc.q, cur.pc), h('small', {}, 'next ' + TH.chordLabel(nxt.pc, cs.cyc.q, nxt.pc))),
      cur.p ? h('div', { style: 'width:110px' }, UI.chordDiagram(cur.p.frets, cur.pc)) : '',
      h('div', { class: 'note', style: 'max-width:34ch' }, cur.shape ? 'Suggested: ' + cur.shape.name + '. Alternate 6th- and 5th-string roots to stay in one area of the neck.' : ''));
  }
  function cycleTick(info) {
    if (App.jamOwner !== 'cycle' || info.subIdx !== 0 || info.beatInBar !== 0) return;
    const barIdx = info.bar;
    const i = Math.floor(barIdx / cs.cyc.bars);
    const cur = cycleChord(i);
    if (cur.p) AU.strum(cur.p.midi.filter(m => m != null), info.time, { vel: .55, dur: T.beatDur() * 1.5 });
    const delay = Math.max(0, (info.time - AU.ctx.currentTime) * 1000);
    setTimeout(() => { if (cs.cyc.i !== i) { cs.cyc.lastRs = cur.shape ? cur.shape.rs : 0; cs.cyc.i = i; renderCycle(); } }, delay);
  }
  function toggleCycle() {
    if (T.running && App.jamOwner === 'cycle') { T.stop(); App.jamOwner = null; return; }
    if (T.running) T.stop();
    App.jamOwner = 'cycle'; T.num = 4; T.den = 4; T.sub = 1; T.swing = false; T.trainer = null;
    cs.cyc.i = 0; renderCycle(); T.start();
  }

  function mountChords(sec) {
    const sv = window.Resume.part('chords');
    if (sv) { cs.root = sv.root ?? cs.root; cs.q = sv.q || cs.q; cs.fam = sv.fam || cs.fam; cs.cyc.q = sv.cq ?? cs.cyc.q; cs.cyc.bars = sv.bars || cs.cyc.bars; }
    const qualOpts = [{ value: 'all', label: 'All qualities' }, ...Object.entries(TH.CHORDS).filter(([q]) => TH.shapesFor(q).length).map(([q, c]) => ({ value: q, label: (q || 'maj') + ' — ' + c.name }))];
    sec.append(
      h('h1', { class: 'h' }, 'Chord shapes'),
      h('p', { class: 'lede', style: 'margin-bottom:16px' }, 'Movable shapes grouped by family. Pick a root and every shape moves there. Orange dots are roots; interval names sit under each string. Tap a diagram to hear it.'),
      h('div', { class: 'panel stack' },
        h('div', { class: 'row' },
          UI.field('Root', UI.select('ch-root', UI.keyOptions(), cs.root, v => { cs.root = +v; renderChordGrid(); }, 'Root')),
          UI.field('Quality', UI.select('ch-q', qualOpts, cs.q, v => { cs.q = v; renderChordGrid(); }, 'Quality'))),
        ce.fams = h('div', { class: 'chips' })),
      h('div', { style: 'margin-top:16px' }, ce.grid = h('div', { class: 'chord-grid' })),
      h('div', { class: 'panel stack', style: 'margin-top:22px' },
        h('div', {}, h('div', { class: 'h2' }, 'Cycle-of-fourths trainer'),
          h('p', { class: 'lede' }, 'The chord name changes every few bars around the cycle (C, F, Bb, Eb …). Find the shape before it arrives. This is how jazz players learn a chord type in all 12 keys.')),
        h('div', { class: 'row' },
          UI.field('Chord type', UI.select('cyc-q', ['maj7', '7', 'm7', 'm7b5', 'm6', '6/9', '9', '', 'm', '5'].map(q => ({ value: q, label: q || 'major' })), cs.cyc.q, v => { cs.cyc.q = v; renderCycle(); persistChords(); }, 'Chord type')),
          UI.field('Bars per chord', UI.select('cyc-bars', [1, 2, 4].map(b => ({ value: b, label: b + (b === 1 ? ' bar' : ' bars') })), cs.cyc.bars, v => { cs.cyc.bars = +v; persistChords(); }, 'Bars per chord')),
          ce.cycBtn = h('button', { class: 'btn primary', onclick: toggleCycle }, '▶ Start')),
        ce.cycNow = h('div', { class: 'now-card' }))
    );
    FAMS.forEach(f => ce.fams.append(h('button', { class: 'chip', 'aria-pressed': String(cs.fam === f), onclick: () => { cs.fam = f; [...ce.fams.children].forEach(c => c.setAttribute('aria-pressed', String(c.textContent === f))); renderChordGrid(); } }, f)));
    T.on((type, info) => {
      if (type === 'tick') cycleTick(info);
      if (type === 'state') ce.cycBtn.textContent = T.running && App.jamOwner === 'cycle' ? '■ Stop' : '▶ Start';
    });
    renderChordGrid(); renderCycle();
  }
  App.register('chords', { mount: mountChords, show(o) { if (o && o.fam) { cs.fam = o.fam; [...ce.fams.children].forEach(c => c.setAttribute('aria-pressed', String(c.textContent === o.fam))); renderChordGrid(); } } });

  /* ================= Scales & fretboard ================= */
  const fs = { root: 9, scale: 'minpent', labels: 'intervals', frets: 15, pos: 0, quiz: null };
  const fe = {};

  function win() {
    if (!fs.pos) return null;
    return [fs.pos, fs.pos + 4];
  }
  function renderBoard() {
    window.Resume.keep('fretboard', { root: fs.root, scale: fs.scale, labels: fs.labels, frets: fs.frets, pos: fs.pos });
    const sc = TH.SCALES[fs.scale];
    let marks = [];
    if (!fs.quiz) marks = UI.scaleMarks({ rootPc: fs.root, set: sc.iv, frets: fs.frets, labels: fs.labels, win: win() });
    else marks = fs.quiz.marks;
    fe.board.innerHTML = '';
    fe.board.append(UI.fretboard({ frets: fs.frets, marks, window: win(), onClick: onBoardClick }));
  }
  function onBoardClick(si, f) {
    AU.pluck(TH.TUNING[si] + f, 0, { vel: .9 });
    const q = fs.quiz;
    if (!q || !q.running) return;
    const pc = (TH.TUNING[si] + f) % 12;
    if (si === q.string && pc === q.target) { q.score++; q.marks = [{ s: si, f, kind: 'hit', label: TH.noteName(pc, 0) }]; nextQuiz(); }
    else { q.miss++; q.marks = [{ s: si, f, kind: 'miss', label: TH.noteName(pc, 0) }]; renderQuiz(); renderBoard(); }
  }

  function harmonize() {
    const iv = TH.SCALES[fs.scale].iv;
    if (iv.length !== 7) return null;
    const out = [];
    for (let d = 0; d < 7; d++) {
      const r = iv[d], t3 = TH.mod(iv[(d + 2) % 7] - r), t5 = TH.mod(iv[(d + 4) % 7] - r), t7 = TH.mod(iv[(d + 6) % 7] - r);
      let q = null;
      const key = t3 + ',' + t5 + ',' + t7;
      q = { '4,7,11': 'maj7', '4,7,10': '7', '3,7,10': 'm7', '3,6,10': 'm7b5', '3,6,9': 'dim7', '3,7,11': 'm', '4,8,11': '', '4,8,10': '7', '4,6,11': 'maj7', '4,6,10': '7', '3,6,11': 'dim', '2,7,10': '7' }[key];
      if (q === undefined || q === null) q = t3 === 4 ? '' : 'm';
      const label = (key === '3,7,11' ? 'm(maj7)' : key === '4,8,11' ? '+maj7' : key === '4,8,10' ? '7#5' : key === '4,6,11' ? 'maj7#11' : key === '4,6,10' ? '7b5' : key === '3,6,11' ? 'dim(maj7)' : q);
      out.push({ pc: TH.mod(fs.root + r), deg: r, q, label });
    }
    return out;
  }

  function renderInfo() {
    const sc = TH.SCALES[fs.scale];
    fe.info.innerHTML = '';
    const notes = sc.iv.map(i => TH.noteName(fs.root + i, fs.root));
    fe.info.append(
      h('div', { class: 'h2' }, TH.noteName(fs.root, fs.root) + ' ' + sc.name),
      h('div', { class: 'row', style: 'gap:24px;align-items:start' },
        h('div', {}, h('div', { class: 'eyebrow' }, 'Formula'), h('div', { class: 'mono' }, sc.iv.map(i => TH.intervalName(i, sc.iv)).join(' '))),
        h('div', {}, h('div', { class: 'eyebrow' }, 'Notes'), h('div', { class: 'mono' }, notes.join(' '))),
        sc.use ? h('div', { style: 'max-width:40ch' }, h('div', { class: 'eyebrow' }, 'Where you hear it'), h('div', {}, sc.use)) : '')
    );
    const harm = harmonize();
    if (harm) {
      const row = h('div', { class: 'prog-strip' });
      harm.forEach(c => {
        const v = TH.voiceNear(c.q, c.pc, 5);
        row.append(h('button', { class: 'pchord', onclick: () => v && AU.strum(v.p.midi.filter(m => m != null), 0, { vel: .9 }) },
          h('div', { class: 'rn' }, TH.romanFor(c.deg, c.q === '' && c.label.startsWith('m') ? 'm' : c.q)), h('div', { class: 'cn' }, TH.noteName(c.pc, fs.root) + c.label)));
      });
      fe.info.append(h('div', { class: 'eyebrow', style: 'margin-top:4px' }, 'Chords built from this scale (tap to hear)'), row);
    }
  }

  function playScale() {
    const sc = TH.SCALES[fs.scale];
    let w = win();
    if (!w) { const rf = TH.mod(fs.root - 4); const base = rf === 0 ? 12 : rf; w = [Math.max(0, base - 1), base + 3]; if (base > 10) w = [base - 1, base + 3]; }
    const notes = [];
    for (let si = 0; si < 6; si++) for (let f = w[0]; f <= w[1]; f++) {
      const m = TH.TUNING[si] + f;
      if (sc.iv.includes(TH.mod(m - fs.root)) && !notes.some(n => n.m === m)) notes.push({ m, si, f });
    }
    notes.sort((a, b) => a.m - b.m);
    const seq = [...notes, ...notes.slice(0, -1).reverse()];
    AU.ensure();
    const d = 60 / T.bpm / 2; let t = AU.ctx.currentTime + .05;
    seq.forEach(n => { AU.pluck(n.m, t, { vel: .85, dur: d * 1.5 }); t += d; });
    UI.toast('Playing in frets ' + w[0] + '–' + w[1] + ' at ' + T.bpm + ' BPM (8ths)');
  }

  /* ---- note quiz ---- */
  function startQuiz() {
    fs.quiz = { running: true, score: 0, miss: 0, end: Date.now() + 60000, marks: [] };
    nextQuiz();
    clearInterval(fe.qTimer);
    fe.qTimer = setInterval(() => {
      if (!fs.quiz) return clearInterval(fe.qTimer);
      if (Date.now() >= fs.quiz.end) { fs.quiz.running = false; clearInterval(fe.qTimer); }
      renderQuiz();
    }, 250);
  }
  function nextQuiz() {
    const q = fs.quiz;
    let pc, si;
    do { pc = Math.floor(Math.random() * 12); si = Math.floor(Math.random() * 6); } while (q.target === pc && q.string === si);
    q.target = pc; q.string = si;
    renderQuiz(); renderBoard();
  }
  function stopQuiz() { fs.quiz = null; clearInterval(fe.qTimer); renderQuiz(); renderBoard(); }
  function renderQuiz() {
    fe.quiz.innerHTML = '';
    const q = fs.quiz;
    if (!q) {
      fe.quiz.append(h('div', { class: 'h2' }, 'Note finder'), h('p', { class: 'lede', style: 'margin:0' }, 'You get a note and a string. Tap it on the fretboard. 60 seconds; the scale display hides while you play.'),
        h('div', {}, h('button', { class: 'btn primary', onclick: startQuiz }, 'Start 60-second round')));
      return;
    }
    const left = Math.max(0, (q.end - Date.now()) / 1000);
    if (q.running) {
      fe.quiz.append(h('div', { class: 'eyebrow' }, 'Find'),
        h('div', { class: 'quiz-target' }, TH.SHARP[q.target] + (TH.SHARP[q.target] !== TH.FLAT[q.target] ? ' / ' + TH.FLAT[q.target] : '') + ' on the ' + ['low E', 'A', 'D', 'G', 'B', 'high e'][q.string] + ' string'),
        h('div', { class: 'row mono num' }, h('span', {}, 'Time ' + UI.fmtTime(left)), h('span', {}, 'Correct ' + q.score), h('span', {}, 'Misses ' + q.miss)),
        h('div', {}, h('button', { class: 'btn', onclick: stopQuiz }, 'Stop')));
    } else {
      fe.quiz.append(h('div', { class: 'h2' }, 'Round over: ' + q.score + ' correct, ' + q.miss + ' misses'),
        h('div', { class: 'row' }, h('button', { class: 'btn primary', onclick: startQuiz }, 'Play again'), h('button', { class: 'btn', onclick: stopQuiz }, 'Back to scales')));
    }
  }

  function mountBoard(sec) {
    const fv = window.Resume.part('fretboard');
    if (fv && TH.SCALES[fv.scale]) Object.assign(fs, { root: fv.root, scale: fv.scale, labels: fv.labels || fs.labels, frets: fv.frets || fs.frets, pos: fv.pos || 0 });
    const scaleOpts = TH.SCALE_GROUPS.map(g => ({ group: g.group, items: g.items.map(([id, name]) => ({ value: id, label: name })) }));
    const posOpts = [{ value: 0, label: 'Whole neck' }, ...Array.from({ length: 13 }, (_, i) => ({ value: i + 1, label: 'Frets ' + (i + 1) + '–' + (i + 5) }))];
    sec.append(
      h('h1', { class: 'h' }, 'Scales & fretboard'),
      h('p', { class: 'lede', style: 'margin-bottom:16px' }, 'Every scale and mode from rock to raga, mapped across the neck. Narrow it to a 5-fret window to learn one position at a time.'),
      h('div', { class: 'panel stack' },
        h('div', { class: 'row' },
          UI.field('Root', UI.select('fb-root', UI.keyOptions(), fs.root, v => { fs.root = +v; renderBoard(); renderInfo(); }, 'Root')),
          UI.field('Scale or arpeggio', UI.select('fb-scale', scaleOpts, fs.scale, v => { fs.scale = v; renderBoard(); renderInfo(); }, 'Scale')),
          UI.field('Labels', UI.select('fb-labels', [{ value: 'intervals', label: 'Intervals' }, { value: 'notes', label: 'Note names' }, { value: 'none', label: 'No labels' }], fs.labels, v => { fs.labels = v; renderBoard(); }, 'Labels')),
          UI.field('Position', UI.select('fb-pos', posOpts, fs.pos, v => { fs.pos = +v; renderBoard(); }, 'Position')),
          UI.field('Neck', UI.select('fb-frets', [{ value: 15, label: '15 frets' }, { value: 22, label: '22 frets' }], fs.frets, v => { fs.frets = +v; renderBoard(); }, 'Frets')),
          h('button', { class: 'btn primary', onclick: playScale }, '▶ Play scale')),
        fe.board = h('div', { class: 'fb-wrap' }),
        fe.info = h('div', { class: 'stack', style: 'gap:10px' })),
      h('div', { class: 'panel stack' }, fe.quiz = h('div', { class: 'stack', style: 'gap:8px' }))
    );
    renderBoard(); renderInfo(); renderQuiz();
  }
  App.register('fretboard', { mount: mountBoard, show(o) { if (o && o.scale) { fs.scale = o.scale; if (o.root != null) fs.root = o.root; const s1 = document.getElementById('fb-scale'); if (s1) s1.value = fs.scale; const s2 = document.getElementById('fb-root'); if (s2) s2.value = fs.root; renderBoard(); renderInfo(); } } });
})();
