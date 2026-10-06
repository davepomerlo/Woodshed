/* Woodshed — music theory core: notes, scales, chords, movable shapes */
(function () {
  const SHARP = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
  const FLAT  = ['C','Db','D','Eb','E','F','Gb','G','Ab','A','Bb','B'];
  const KEYS = [
    { pc: 0, name: 'C' }, { pc: 1, name: 'Db' }, { pc: 2, name: 'D' }, { pc: 3, name: 'Eb' },
    { pc: 4, name: 'E' }, { pc: 5, name: 'F' }, { pc: 6, name: 'F#' }, { pc: 7, name: 'G' },
    { pc: 8, name: 'Ab' }, { pc: 9, name: 'A' }, { pc: 10, name: 'Bb' }, { pc: 11, name: 'B' }
  ];
  const FLAT_KEYS = new Set([1, 3, 5, 8, 10]);
  // Standard tuning, low E (index 0) to high E (index 5), as MIDI numbers
  const TUNING = [40, 45, 50, 55, 59, 64];
  const STRING_NAMES = ['E', 'A', 'D', 'G', 'B', 'e'];

  const mod = (n, m = 12) => ((n % m) + m) % m;
  function noteName(pc, keyPc) {
    return (FLAT_KEYS.has(mod(keyPc)) ? FLAT : SHARP)[mod(pc)];
  }

  /* ---------- Scales & modes ---------- */
  const SCALE_GROUPS = [
    { group: 'Major modes', items: [
      ['ionian', 'Major (Ionian)', [0,2,4,5,7,9,11], 'Pop, rock, classical, country'],
      ['dorian', 'Dorian', [0,2,3,5,7,9,10], 'Funk, jazz minor, Santana-style rock'],
      ['phrygian', 'Phrygian', [0,1,3,5,7,8,10], 'Metal, flamenco colour, Raga Bhairavi'],
      ['lydian', 'Lydian', [0,2,4,6,7,9,11], 'Prog, film scores, Raga Yaman'],
      ['mixolydian', 'Mixolydian', [0,2,4,5,7,9,10], 'Blues-rock, jam bands, dominant chords'],
      ['aeolian', 'Natural minor (Aeolian)', [0,2,3,5,7,8,10], 'Rock and metal minor keys'],
      ['locrian', 'Locrian', [0,1,3,5,6,8,10], 'Over m7b5, extreme metal']
    ]},
    { group: 'Pentatonic & blues', items: [
      ['minpent', 'Minor pentatonic', [0,3,5,7,10], 'The rock and blues workhorse'],
      ['majpent', 'Major pentatonic', [0,2,4,7,9], 'Country, soul, West African highlife'],
      ['blues', 'Blues (minor + b5)', [0,3,5,6,7,10], 'Blues, rock, jazz blues'],
      ['majblues', 'Major blues', [0,2,3,4,7,9], 'Major-key blues, Allman-style lines']
    ]},
    { group: 'Minor families', items: [
      ['harmminor', 'Harmonic minor', [0,2,3,5,7,8,11], 'Neoclassical metal, classical, Maqam Nahawand'],
      ['melminor', 'Melodic minor', [0,2,3,5,7,9,11], 'Jazz minor, m6 and m(maj7) chords'],
      ['phrygdom', 'Phrygian dominant', [0,1,4,5,7,8,10], 'Flamenco, klezmer, Maqam Hijaz feel'],
      ['hungminor', 'Hungarian minor', [0,2,3,6,7,8,11], 'Gypsy jazz, Eastern European colour'],
      ['lyddom', 'Lydian dominant', [0,2,4,6,7,9,10], '7#11 chords, fusion'],
      ['altered', 'Altered (super-Locrian)', [0,1,3,4,6,8,10], 'Tension over V7 in jazz']
    ]},
    { group: 'Symmetric & jazz', items: [
      ['bebopdom', 'Bebop dominant', [0,2,4,5,7,9,10,11], 'Bebop lines that land chord tones on the beat'],
      ['dimhw', 'Diminished (half-whole)', [0,1,3,4,6,7,9,10], 'Over 7b9 chords, Django-style runs'],
      ['dimwh', 'Diminished (whole-half)', [0,2,3,5,6,8,9,11], 'Over dim7 chords'],
      ['wholetone', 'Whole tone', [0,2,4,6,8,10], 'Over 7#5 chords, dreamy prog']
    ]},
    { group: 'Beyond Western', items: [
      ['doubleharm', 'Double harmonic (Bhairav)', [0,1,4,5,7,8,11], 'Raga Bhairav, Maqam Hijaz Kar, Byzantine'],
      ['hirajoshi', 'Hirajoshi', [0,2,3,7,8], 'Japanese koto tuning'],
      ['insen', 'In-sen', [0,1,5,7,10], 'Japanese shakuhachi colour'],
      ['iwato', 'Iwato', [0,1,5,6,10], 'Japanese, very dark'],
      ['pelog', 'Pelog (12-TET approx.)', [0,1,3,7,8], 'Javanese and Balinese gamelan'],
      ['egyptian', 'Egyptian (suspended pent.)', [0,2,5,7,10], 'Ancient Egyptian and Celtic folk colour'],
      ['rast', 'Maqam Rast (no quarter tones)', [0,2,4,5,7,9,10], 'Arabic; real Rast lowers 3 and 7 by a quarter tone']
    ]},
    { group: 'Arpeggios', items: [
      ['arp-maj', 'Major triad', [0,4,7], ''], ['arp-min', 'Minor triad', [0,3,7], ''],
      ['arp-maj7', 'maj7', [0,4,7,11], ''], ['arp-7', 'Dominant 7', [0,4,7,10], ''],
      ['arp-m7', 'm7', [0,3,7,10], ''], ['arp-m7b5', 'm7b5', [0,3,6,10], ''],
      ['arp-dim7', 'dim7', [0,3,6,9], ''], ['arp-6', '6', [0,4,7,9], ''], ['arp-m6', 'm6', [0,3,7,9], '']
    ]}
  ];
  const SCALES = {};
  SCALE_GROUPS.forEach(g => g.items.forEach(([id, name, iv, use]) => { SCALES[id] = { id, name, iv, use, group: g.group }; }));

  const IV_NAMES = ['1','b2','2','b3','3','4','b5','5','b6','6','b7','7'];
  function intervalName(semi, set) {
    semi = mod(semi);
    if (semi === 6 && set && set.includes(7)) return '#4';
    if (semi === 8 && set && set.includes(7) && set.includes(9) === false && set.includes(4)) return '#5';
    if (semi === 3 && set && set.includes(4)) return '#9';
    return IV_NAMES[semi];
  }

  /* ---------- Chord qualities ---------- */
  const CHORDS = {
    '':     { name: 'Major',        f: [0,4,7] },
    'm':    { name: 'Minor',        f: [0,3,7] },
    '5':    { name: 'Power chord',  f: [0,7] },
    'dim':  { name: 'Diminished',   f: [0,3,6] },
    'sus2': { name: 'sus2',         f: [0,2,7] },
    'sus4': { name: 'sus4',         f: [0,5,7] },
    '6':    { name: 'Major 6',      f: [0,4,7,9] },
    'm6':   { name: 'Minor 6',      f: [0,3,7,9] },
    '6/9':  { name: '6/9',          f: [0,4,7,9,2] },
    'maj7': { name: 'Major 7',      f: [0,4,7,11] },
    '7':    { name: 'Dominant 7',   f: [0,4,7,10] },
    'm7':   { name: 'Minor 7',      f: [0,3,7,10] },
    'm7b5': { name: 'Half-diminished', f: [0,3,6,10] },
    'dim7': { name: 'Diminished 7', f: [0,3,6,9] },
    '9':    { name: 'Dominant 9',   f: [0,4,7,10,2] },
    'm9':   { name: 'Minor 9',      f: [0,3,7,10,2] },
    '13':   { name: 'Dominant 13',  f: [0,4,10,9] },
    '7#9':  { name: '7#9',          f: [0,4,7,10,3] },
    '7b9':  { name: '7b9',          f: [0,4,7,10,1] }
  };

  /* ---------- Movable shapes ----------
     frets: offsets from the root's fret on the root string, low E → high e. null = muted.
     rs = root string index (0 = low E). */
  const X = null;
  const SHAPES = [
    // Root on 6th string
    { q: '',     rs: 0, frets: [0,2,2,1,0,0], name: 'E-shape barre', fam: 'CAGED' },
    { q: 'm',    rs: 0, frets: [0,2,2,0,0,0], name: 'Em-shape barre', fam: 'CAGED' },
    { q: '7',    rs: 0, frets: [0,2,0,1,0,0], name: 'E7-shape barre', fam: 'CAGED' },
    { q: 'm7',   rs: 0, frets: [0,2,0,0,0,0], name: 'Em7-shape barre', fam: 'CAGED' },
    { q: 'sus4', rs: 0, frets: [0,2,2,2,0,0], name: 'Esus4-shape', fam: 'CAGED' },
    { q: '5',    rs: 0, frets: [0,2,2,X,X,X], name: 'Power chord, 6th string', fam: 'Rock & metal' },
    { q: 'maj7', rs: 0, frets: [0,X,1,1,0,X], name: 'Drop-3, 6th string', fam: 'Jazz' },
    { q: '7',    rs: 0, frets: [0,X,0,1,0,X], name: 'Drop-3, 6th string', fam: 'Jazz' },
    { q: 'm7',   rs: 0, frets: [0,X,0,0,0,X], name: 'Drop-3, 6th string', fam: 'Jazz' },
    { q: 'm7b5', rs: 0, frets: [0,X,0,0,-1,X], name: 'Drop-3, 6th string', fam: 'Jazz' },
    { q: 'dim7', rs: 0, frets: [0,X,-1,0,-1,X], name: 'Drop-3, 6th string', fam: 'Jazz' },
    { q: '6',    rs: 0, frets: [0,X,-1,1,0,X], name: 'Drop-3, 6th string', fam: 'Jazz' },
    { q: 'm6',   rs: 0, frets: [0,X,-1,0,0,X], name: 'Manouche m6, 6th string', fam: 'Gypsy jazz' },
    { q: '9',    rs: 0, frets: [0,X,0,1,0,2], name: '9 with top 9th', fam: 'Gypsy jazz' },
    { q: '13',   rs: 0, frets: [0,X,0,1,2,X], name: '13, 6th string', fam: 'Jazz' },
    { q: 'dim',  rs: 0, frets: [0,1,2,0,X,X], name: 'Dim triad, low strings', fam: 'Classical' },
    // Root on 5th string
    { q: '',     rs: 1, frets: [X,0,2,2,2,0], name: 'A-shape barre', fam: 'CAGED' },
    { q: 'm',    rs: 1, frets: [X,0,2,2,1,0], name: 'Am-shape barre', fam: 'CAGED' },
    { q: '7',    rs: 1, frets: [X,0,2,0,2,0], name: 'A7-shape barre', fam: 'CAGED' },
    { q: 'm7',   rs: 1, frets: [X,0,2,0,1,0], name: 'Am7-shape barre', fam: 'CAGED' },
    { q: 'maj7', rs: 1, frets: [X,0,2,1,2,0], name: 'Amaj7-shape', fam: 'CAGED' },
    { q: 'sus2', rs: 1, frets: [X,0,2,2,0,0], name: 'Asus2-shape', fam: 'CAGED' },
    { q: 'sus4', rs: 1, frets: [X,0,2,2,3,0], name: 'Asus4-shape', fam: 'CAGED' },
    { q: '5',    rs: 1, frets: [X,0,2,2,X,X], name: 'Power chord, 5th string', fam: 'Rock & metal' },
    { q: 'm7b5', rs: 1, frets: [X,0,1,0,1,X], name: 'Drop-2, 5th string', fam: 'Jazz' },
    { q: 'dim7', rs: 1, frets: [X,0,1,-1,1,X], name: 'Drop-2, 5th string', fam: 'Jazz' },
    { q: 'dim',  rs: 1, frets: [X,0,1,2,1,X], name: 'Dim triad, 5th string', fam: 'Classical' },
    { q: '6/9',  rs: 1, frets: [X,0,-1,-1,0,0], name: '6/9, 5th string', fam: 'Gypsy jazz' },
    { q: 'm6',   rs: 1, frets: [X,0,X,-1,1,0], name: 'Manouche m6, 5th string', fam: 'Gypsy jazz' },
    { q: '9',    rs: 1, frets: [X,0,-1,0,0,0], name: '9, 5th string', fam: 'Jazz' },
    { q: 'm9',   rs: 1, frets: [X,0,-2,0,0,X], name: 'm9, 5th string', fam: 'Jazz' },
    { q: '7#9',  rs: 1, frets: [X,0,-1,0,1,X], name: '"Purple" 7#9', fam: 'Rock & metal' },
    { q: '7b9',  rs: 1, frets: [X,0,-1,0,-1,X], name: '7b9, 5th string', fam: 'Jazz' },
    // Root on 4th string
    { q: '',     rs: 2, frets: [X,X,0,2,3,2], name: 'D-shape', fam: 'CAGED' },
    { q: 'm',    rs: 2, frets: [X,X,0,2,3,1], name: 'Dm-shape', fam: 'CAGED' },
    { q: '7',    rs: 2, frets: [X,X,0,2,1,2], name: 'D7-shape', fam: 'CAGED' },
    { q: 'm7',   rs: 2, frets: [X,X,0,2,1,1], name: 'Dm7-shape', fam: 'CAGED' },
    { q: 'maj7', rs: 2, frets: [X,X,0,2,2,2], name: 'Dmaj7-shape', fam: 'CAGED' },
    { q: 'm7b5', rs: 2, frets: [X,X,0,1,1,1], name: 'Drop-2, 4th string', fam: 'Jazz' },
    { q: 'dim7', rs: 2, frets: [X,X,0,1,0,1], name: 'Drop-2, 4th string', fam: 'Jazz' },
    { q: '6',    rs: 2, frets: [X,X,0,2,0,2], name: 'D6-shape', fam: 'CAGED' },
    { q: 'm6',   rs: 2, frets: [X,X,0,2,0,1], name: 'Dm6-shape', fam: 'CAGED' },
    // Triads on the top three strings
    { q: '',  rs: 3, frets: [X,X,X,0,0,-2], name: 'Triad, root on G (root position)', fam: 'Triads' },
    { q: '',  rs: 5, frets: [X,X,X,1,0,0],  name: 'Triad, root on e (1st inversion)', fam: 'Triads' },
    { q: '',  rs: 4, frets: [X,X,X,-1,0,-1], name: 'Triad, root on B (2nd inversion)', fam: 'Triads' },
    { q: 'm', rs: 3, frets: [X,X,X,0,-1,-2], name: 'Triad, root on G (root position)', fam: 'Triads' },
    { q: 'm', rs: 5, frets: [X,X,X,0,0,0],  name: 'Triad, root on e (1st inversion)', fam: 'Triads' },
    { q: 'm', rs: 4, frets: [X,X,X,-1,0,-2], name: 'Triad, root on B (2nd inversion)', fam: 'Triads' }
  ];

  /** Place a shape for root pitch class `pc`. Returns absolute frets or null values; prefers base in [minBase, minBase+11]. */
  function placeShape(shape, pc, minBase = 1) {
    const open = TUNING[shape.rs] % 12;
    let base = mod(pc - open);
    const lo = Math.min(...shape.frets.filter(f => f !== null));
    while (base + lo < 0 || base < minBase) base += 12;
    if (base > 14) base -= 12;
    if (base + lo < 0) base += 12;
    const frets = shape.frets.map(f => (f === null ? null : base + f));
    const midi = frets.map((f, i) => (f === null ? null : TUNING[i] + f));
    return { base, frets, midi };
  }

  function shapesFor(q) { return SHAPES.filter(s => s.q === q); }

  /** Pick a voicing near a target fret; avoids huge jumps between chords */
  function voiceNear(q, pc, targetFret) {
    const opts = shapesFor(q).filter(s => s.fam !== 'Triads');
    const list = (opts.length ? opts : shapesFor(q)).map(s => {
      const p = placeShape(s, pc, 1);
      const used = p.frets.filter(f => f !== null);
      const center = used.reduce((a, b) => a + b, 0) / used.length;
      // try an octave down if it fits
      let cand = { s, p, center };
      if (center - 12 >= 1 && Math.min(...used) - 12 >= 1) {
        const p2 = { ...p, base: p.base - 12, frets: p.frets.map(f => f === null ? null : f - 12), midi: p.midi.map(m => m === null ? null : m - 12) };
        if (Math.abs(center - 12 - targetFret) < Math.abs(center - targetFret)) cand = { s, p: p2, center: center - 12 };
      }
      return cand;
    });
    list.sort((a, b) => Math.abs(a.center - targetFret) - Math.abs(b.center - targetFret) + (a.s.rs > 1 ? 0.6 : 0) - (b.s.rs > 1 ? 0.6 : 0));
    return list[0] || null;
  }

  function chordTones(pc, q) { return (CHORDS[q] || CHORDS['']).f.map(i => mod(pc + i)); }
  function chordLabel(pc, q, keyPc) { return noteName(pc, keyPc) + q; }

  const ROMAN = ['I','bII','II','bIII','III','IV','#IV','V','bVI','VI','bVII','VII'];
  function romanFor(deg, q) {
    let r = ROMAN[mod(deg)];
    const minorish = ['m','m7','m6','m9','m7b5','dim','dim7'].includes(q);
    if (minorish) r = r.toLowerCase();
    let suffix = q;
    if (q === 'm') suffix = '';
    else if (q.startsWith('m') && q !== 'maj7') suffix = q.slice(1);
    if (q === 'm7b5') suffix = 'ø7';
    if (q === 'dim') suffix = '°';
    if (q === 'dim7') suffix = '°7';
    return r + suffix;
  }

  window.Theory = { SHARP, FLAT, KEYS, TUNING, STRING_NAMES, SCALE_GROUPS, SCALES, CHORDS, SHAPES,
    mod, noteName, intervalName, placeShape, shapesFor, voiceNear, chordTones, chordLabel, romanFor };
})();
