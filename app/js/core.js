/*
 * Верстак 3D — геометрическое ядро.
 * Лицензия MIT. Зависит только от three.js (r128).
 * Фигуры с параметрами, текст (трассировка системного шрифта), BSP-CSG,
 * экспорт STL / OBJ / 3MF, импорт STL.
 */
'use strict';

const DEG = Math.PI / 180;
const r3 = v => Math.round(v * 1000) / 1000;
const r2 = v => Math.round(v * 100) / 100;
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const uid = () => Math.random().toString(36).slice(2, 10);

/* ============================ BSP CSG ============================ */
/* По мотивам csg.js — Copyright (c) 2011 Evan Wallace, лицензия MIT (см. app/THIRD-PARTY-NOTICES.txt).
   Переписано без рекурсии при построении и обходе дерева. */
const CSG = (() => {
  const EPS = 1e-5;
  class V {
    constructor(x, y, z) { this.x = x; this.y = y; this.z = z; }
    clone() { return new V(this.x, this.y, this.z); }
    neg() { return new V(-this.x, -this.y, -this.z); }
    plus(a) { return new V(this.x + a.x, this.y + a.y, this.z + a.z); }
    minus(a) { return new V(this.x - a.x, this.y - a.y, this.z - a.z); }
    times(k) { return new V(this.x * k, this.y * k, this.z * k); }
    dot(a) { return this.x * a.x + this.y * a.y + this.z * a.z; }
    lerp(a, t) { return this.plus(a.minus(this).times(t)); }
    len() { return Math.sqrt(this.dot(this)); }
    unit() { return this.times(1 / this.len()); }
    cross(a) { return new V(this.y * a.z - this.z * a.y, this.z * a.x - this.x * a.z, this.x * a.y - this.y * a.x); }
  }
  class Plane {
    constructor(n, w) { this.normal = n; this.w = w; }
    clone() { return new Plane(this.normal.clone(), this.w); }
    flip() { this.normal = this.normal.neg(); this.w = -this.w; }
    split(poly, cf, cb, f, b) {
      const n = this.normal, w = this.w, vs = poly.vertices, types = [];
      let pt = 0;
      for (const v of vs) { const t = n.dot(v) - w; const ty = t < -EPS ? 2 : t > EPS ? 1 : 0; pt |= ty; types.push(ty); }
      if (pt === 0) (n.dot(poly.plane.normal) > 0 ? cf : cb).push(poly);
      else if (pt === 1) f.push(poly);
      else if (pt === 2) b.push(poly);
      else {
        const fv = [], bv = [];
        for (let i = 0; i < vs.length; i++) {
          const j = (i + 1) % vs.length, ti = types[i], tj = types[j], vi = vs[i], vj = vs[j];
          if (ti !== 2) fv.push(vi);
          if (ti !== 1) bv.push(ti !== 2 ? vi.clone() : vi);
          if ((ti | tj) === 3) {
            const t = (w - n.dot(vi)) / n.dot(vj.minus(vi));
            const v = vi.lerp(vj, t); fv.push(v); bv.push(v.clone());
          }
        }
        if (fv.length >= 3) f.push(new Poly(fv, poly.shared, poly.plane.clone()));
        if (bv.length >= 3) b.push(new Poly(bv, poly.shared, poly.plane.clone()));
      }
    }
  }
  Plane.fromPoints = (a, b, c) => { const n = b.minus(a).cross(c.minus(a)).unit(); return new Plane(n, n.dot(a)); };
  class Poly {
    constructor(vs, shared, plane) { this.vertices = vs; this.shared = shared; this.plane = plane || Plane.fromPoints(vs[0], vs[1], vs[2]); }
    clone() { return new Poly(this.vertices.map(v => v.clone()), this.shared, this.plane.clone()); }
    flip() { this.vertices.reverse(); this.plane.flip(); }
  }
  class Node {
    constructor(polys) { this.plane = null; this.front = null; this.back = null; this.polygons = []; if (polys) this.build(polys); }
    nodes() { const out = [], st = [this]; while (st.length) { const n = st.pop(); out.push(n); if (n.front) st.push(n.front); if (n.back) st.push(n.back); } return out; }
    invert() {
      for (const n of this.nodes()) {
        for (const p of n.polygons) p.flip();
        if (n.plane) n.plane.flip();
        const t = n.front; n.front = n.back; n.back = t;
      }
    }
    clipPolygons(polys) {
      // итеративный обход, чтобы не переполнять стек на сложных моделях
      const out = [], st = [[this, polys]];
      while (st.length) {
        const [node, ps] = st.pop();
        if (!node.plane) { for (const p of ps) out.push(p); continue; }
        const f = [], b = [];
        for (const p of ps) node.plane.split(p, f, b, f, b);
        if (node.front) st.push([node.front, f]); else for (const p of f) out.push(p);
        if (node.back) st.push([node.back, b]);
      }
      return out;
    }
    clipTo(bsp) { for (const n of this.nodes()) n.polygons = bsp.clipPolygons(n.polygons); }
    allPolygons() { const out = []; for (const n of this.nodes()) for (const p of n.polygons) out.push(p); return out; }
    build(polys) {
      const st = [[this, polys]];
      while (st.length) {
        const [node, ps] = st.pop();
        if (!ps.length) continue;
        if (!node.plane) node.plane = ps[0].plane.clone();
        const f = [], b = [];
        for (const p of ps) node.plane.split(p, node.polygons, node.polygons, f, b);
        if (f.length) { if (!node.front) node.front = new Node(); st.push([node.front, f]); }
        if (b.length) { if (!node.back) node.back = new Node(); st.push([node.back, b]); }
      }
    }
  }
  const cl = a => a.map(p => p.clone());
  function union(a, b) {
    const A = new Node(cl(a)), B = new Node(cl(b));
    A.clipTo(B); B.clipTo(A); B.invert(); B.clipTo(A); B.invert();
    A.build(B.allPolygons()); return A.allPolygons();
  }
  function subtract(a, b) {
    const A = new Node(cl(a)), B = new Node(cl(b));
    A.invert(); A.clipTo(B); B.clipTo(A); B.invert(); B.clipTo(A); B.invert();
    A.build(B.allPolygons()); A.invert(); return A.allPolygons();
  }
  function intersect(a, b) {
    const A = new Node(cl(a)), B = new Node(cl(b));
    A.invert(); B.clipTo(A); B.invert(); A.clipTo(B); B.clipTo(A);
    A.build(B.allPolygons()); A.invert(); return A.allPolygons();
  }
  return { V, Poly, union, subtract, intersect };
})();

/* ===================== Трассировка контуров (для текста) ===================== */
/* Marching squares по полю 0..1, возвращает замкнутые контуры в пикселях. */
function traceContours(field, W, H, iso = 0.5) {
  const inside = (x, y) => field[y * W + x] >= iso;
  const pts = new Map();
  const ptOf = (id) => {
    let p = pts.get(id); if (p) return p;
    const e = id % 2, k = (id - e) / 2, x = k % W, y = (k - x) / W;
    if (e === 0) { const a = field[y * W + x], b = field[y * W + x + 1]; const t = (iso - a) / (b - a || 1e-9); p = [x + clamp(t, 0, 1), y]; }
    else { const a = field[y * W + x], b = field[(y + 1) * W + x]; const t = (iso - a) / (b - a || 1e-9); p = [x, y + clamp(t, 0, 1)]; }
    pts.set(id, p); return p;
  };
  const H_ = (x, y) => (y * W + x) * 2, V_ = (x, y) => (y * W + x) * 2 + 1;
  const segs = [];
  for (let y = 0; y < H - 1; y++) for (let x = 0; x < W - 1; x++) {
    const tl = inside(x, y), tr = inside(x + 1, y), br = inside(x + 1, y + 1), bl = inside(x, y + 1);
    const c = (tl ? 8 : 0) | (tr ? 4 : 0) | (br ? 2 : 0) | (bl ? 1 : 0);
    if (c === 0 || c === 15) continue;
    const T = H_(x, y), B = H_(x, y + 1), L = V_(x, y), R = V_(x + 1, y);
    const center = () => (field[y * W + x] + field[y * W + x + 1] + field[(y + 1) * W + x] + field[(y + 1) * W + x + 1]) / 4 >= iso;
    switch (c) {
      case 1: segs.push([L, B]); break;
      case 2: segs.push([B, R]); break;
      case 3: segs.push([L, R]); break;
      case 4: segs.push([T, R]); break;
      case 5: if (center()) { segs.push([T, L]); segs.push([B, R]); } else { segs.push([T, R]); segs.push([L, B]); } break;
      case 6: segs.push([T, B]); break;
      case 7: segs.push([T, L]); break;
      case 8: segs.push([T, L]); break;
      case 9: segs.push([T, B]); break;
      case 10: if (center()) { segs.push([T, R]); segs.push([L, B]); } else { segs.push([T, L]); segs.push([B, R]); } break;
      case 11: segs.push([T, R]); break;
      case 12: segs.push([L, R]); break;
      case 13: segs.push([B, R]); break;
      case 14: segs.push([L, B]); break;
    }
  }
  const at = new Map();
  segs.forEach((s, i) => { for (const e of s) { const l = at.get(e); if (l) l.push(i); else at.set(e, [i]); } });
  const used = new Uint8Array(segs.length), loops = [];
  for (let i = 0; i < segs.length; i++) {
    if (used[i]) continue;
    used[i] = 1;
    const start = segs[i][0]; let cur = segs[i][1];
    const loop = [ptOf(start)];
    let guard = 0;
    while (cur !== start && guard++ < 1e6) {
      loop.push(ptOf(cur));
      const nxt = (at.get(cur) || []).find(j => !used[j]);
      if (nxt === undefined) break;
      used[nxt] = 1;
      cur = segs[nxt][0] === cur ? segs[nxt][1] : segs[nxt][0];
    }
    if (loop.length >= 3) loops.push(loop);
  }
  return loops;
}
function simplifyClosed(pts, eps) {
  if (pts.length < 8) return pts;
  const dp = (a) => {
    if (a.length < 3) return a;
    const [x1, y1] = a[0], [x2, y2] = a[a.length - 1];
    const dx = x2 - x1, dy = y2 - y1, L = Math.hypot(dx, dy) || 1e-9;
    let best = -1, bi = 0;
    for (let i = 1; i < a.length - 1; i++) {
      const d = Math.abs(dy * a[i][0] - dx * a[i][1] + x2 * y1 - y2 * x1) / L;
      if (d > best) { best = d; bi = i; }
    }
    if (best > eps) { const l = dp(a.slice(0, bi + 1)), r = dp(a.slice(bi)); return l.slice(0, -1).concat(r); }
    return [a[0], a[a.length - 1]];
  };
  const half = Math.floor(pts.length / 2);
  const a = dp(pts.slice(0, half + 1)), b = dp(pts.slice(half).concat([pts[0]]));
  return a.slice(0, -1).concat(b.slice(0, -1));
}
const polyArea = p => { let s = 0; for (let i = 0, j = p.length - 1; i < p.length; j = i++) s += (p[j][0] + p[i][0]) * (p[j][1] - p[i][1]); return s / 2; };
function pointInPoly(pt, poly) {
  let c = false; const [x, y] = pt;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) c = !c;
  }
  return c;
}
/* Делит контуры на внешние и отверстия по вложенности. */
function nestContours(loops) {
  const info = loops.map(p => ({ p, a: Math.abs(polyArea(p)), depth: 0, parent: -1, holes: [] }));
  info.forEach((c, i) => {
    let best = -1;
    info.forEach((d, j) => {
      if (i === j || d.a <= c.a) return;
      if (pointInPoly(c.p[0], d.p)) { c.depth++; if (best < 0 || d.a < info[best].a) best = j; }
    });
    c.parent = best;
  });
  const outers = [];
  info.forEach(c => { if (c.depth % 2 === 0) outers.push(c); });
  info.forEach(c => { if (c.depth % 2 === 1 && c.parent >= 0) info[c.parent].holes.push(c.p); });
  return outers.map(o => ({ outer: o.p, holes: o.holes }));
}

const FONTS = [
  { id: 'sans', name: 'Без засечек', css: '"Arial", "Helvetica", "Liberation Sans", "DejaVu Sans", sans-serif' },
  { id: 'serif', name: 'С засечками', css: '"Times New Roman", "Liberation Serif", "DejaVu Serif", serif' },
  { id: 'mono', name: 'Моноширинный', css: '"Courier New", "Liberation Mono", "DejaVu Sans Mono", monospace' },
  { id: 'impact', name: 'Плакатный', css: '"Impact", "Arial Black", "Haettenschweiler", "DejaVu Sans", sans-serif' },
  { id: 'round', name: 'Округлый', css: '"Comic Sans MS", "Trebuchet MS", "Verdana", "DejaVu Sans", sans-serif' },
  { id: 'georgia', name: 'Книжный', css: '"Georgia", "Palatino Linotype", "Book Antiqua", "DejaVu Serif", serif' },
];
function textShapes(p) {
  const text = String(p.text || '').replace(/\r/g, '');
  if (!text.trim()) throw new Error('Пустой текст');
  const font = (FONTS.find(f => f.id === p.font) || FONTS[0]).css;
  const lines = text.split('\n');
  let fs = 140;
  const cv = document.createElement('canvas'), ctx = cv.getContext('2d', { willReadFrequently: true });
  const setFont = () => { ctx.font = `${p.italic ? 'italic ' : ''}${p.bold ? '700 ' : '400 '}${fs}px ${font}`; };
  setFont();
  let maxW = Math.max(...lines.map(l => ctx.measureText(l).width), 1);
  const lineH = fs * 1.18;
  if (maxW + 40 > 4000) { fs = Math.floor(fs * 3960 / (maxW + 40)); setFont(); maxW = Math.max(...lines.map(l => ctx.measureText(l).width), 1); }
  const pad = Math.ceil(fs * 0.25);
  const W = Math.ceil(maxW) + pad * 2, H = Math.ceil(lines.length * fs * 1.18) + pad * 2;
  cv.width = W; cv.height = H; setFont();
  ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#fff'; ctx.textBaseline = 'alphabetic';
  const align = p.align || 'center';
  ctx.textAlign = align === 'left' ? 'left' : align === 'right' ? 'right' : 'center';
  const ax = align === 'left' ? pad : align === 'right' ? W - pad : W / 2;
  lines.forEach((l, i) => ctx.fillText(l, ax, pad + i * fs * 1.18 + fs * 0.88));
  const data = ctx.getImageData(0, 0, W, H).data, field = new Float32Array(W * H);
  for (let i = 0; i < W * H; i++) field[i] = data[i * 4] / 255;
  const loops = traceContours(field, W, H, 0.5).map(l => simplifyClosed(l, 0.35)).filter(l => l.length >= 3 && Math.abs(polyArea(l)) > 1.5);
  if (!loops.length) throw new Error('Пустой текст');
  return nestContours(loops).map(({ outer, holes }) => {
    const sh = new THREE.Shape(outer.map(([x, y]) => new THREE.Vector2(x, H - y)));
    for (const h of holes) sh.holes.push(new THREE.Path(h.map(([x, y]) => new THREE.Vector2(x, H - y))));
    return sh;
  });
}

/* ============================ Каталог фигур ============================ */
const SHAPES = {
  box:        { name: 'Куб',            color: '#d9483b', size: [20, 20, 20], params: {} },
  rbox:       { name: 'Скруглённый куб', color: '#e0663a', size: [20, 20, 20], params: { r: .18 } },
  cylinder:   { name: 'Цилиндр',        color: '#e8873a', size: [20, 20, 20], params: { n: 48 } },
  sphere:     { name: 'Шар',            color: '#2f7fd6', size: [20, 20, 20], params: { n: 32 } },
  cone:       { name: 'Конус',          color: '#7a5bd0', size: [20, 20, 20], params: { n: 48, top: 0 } },
  pyramid:    { name: 'Пирамида',       color: '#e2b52f', size: [20, 20, 20], params: { n: 4 } },
  prism:      { name: 'Многогранник',   color: '#1f8a8a', size: [20, 20, 20], params: { n: 6 } },
  wedge:      { name: 'Клин',           color: '#2a9d6f', size: [20, 20, 20], params: {} },
  roof:       { name: 'Крыша',          color: '#3c9a52', size: [20, 20, 20], params: {} },
  roundroof:  { name: 'Полуцилиндр',    color: '#4a8fc0', size: [20, 10, 20], params: { n: 40 } },
  hemisphere: { name: 'Полусфера',      color: '#c4527a', size: [20, 10, 20], params: { n: 40 } },
  paraboloid: { name: 'Параболоид',     color: '#9b59b6', size: [20, 20, 20], params: { n: 40 } },
  torus:      { name: 'Тор',            color: '#3a9fb0', size: [24, 6.5, 24], params: { t: .36 } },
  tube:       { name: 'Труба',          color: '#d06a2c', size: [20, 20, 20], params: { wall: .25, n: 48 } },
  star:       { name: 'Звезда',         color: '#e0a21c', size: [24, 6, 24], params: { n: 5, inner: .42 } },
  heart:      { name: 'Сердце',         color: '#d63b5a', size: [24, 6, 22], params: {} },
  text:       { name: 'Текст',          color: '#2b6cb0', size: [40, 4, 12], params: { text: 'Привет', font: 'sans', bold: true, italic: false, align: 'center' } },
};
const KIND = { group: 'Группа', mesh: 'Импорт' };
for (const k in SHAPES) KIND[k] = SHAPES[k].name;
/* что показывать в «Параметрах фигуры» */
const PARAM_UI = {
  r:     { label: 'Скругление', min: .02, max: .5, step: .01, pct: true },
  n:     { label: 'Сегменты', min: 3, max: 96, step: 1, int: true },
  top:   { label: 'Верхний радиус', min: 0, max: 1, step: .01, pct: true },
  t:     { label: 'Толщина кольца', min: .05, max: .95, step: .01, pct: true },
  wall:  { label: 'Толщина стенки', min: .03, max: .95, step: .01, pct: true },
  inner: { label: 'Глубина лучей', min: .1, max: .95, step: .01, pct: true, invert: true },
};
const PARAM_LABEL_OVERRIDE = { pyramid: { n: 'Число граней' }, prism: { n: 'Число граней' }, star: { n: 'Число лучей' } };
const PARAM_LIMITS = { pyramid: { n: [3, 24] }, prism: { n: [3, 48] }, star: { n: [3, 24] } };

function roundedBoxGeom(r) {
  r = clamp(r, .02, .5); const m = 5, N = 2 * m + 1;
  const g = new THREE.BoxGeometry(1, 1, 1, N, N, N), P = g.attributes.position;
  const remap = u => { const i = Math.round((u + .5) * N); return i <= m ? -.5 + r * (i / m) : .5 - r * ((N - i) / m); };
  const v = new THREE.Vector3(), c = new THREE.Vector3(), lim = .5 - r;
  for (let i = 0; i < P.count; i++) {
    v.set(remap(P.getX(i)), remap(P.getY(i)), remap(P.getZ(i)));
    c.set(clamp(v.x, -lim, lim), clamp(v.y, -lim, lim), clamp(v.z, -lim, lim));
    const d = v.clone().sub(c);
    if (d.lengthSq() > 1e-12) v.copy(c).add(d.normalize().multiplyScalar(r));
    P.setXYZ(i, v.x, v.y, v.z);
  }
  return g;
}

function makeRaw(type, p) {
  const V2 = THREE.Vector2;
  const n = (d) => Math.round(clamp(p.n || d, 3, 128));
  const ext = (shape, rot = true, seg = 24) => {
    const g = new THREE.ExtrudeGeometry(shape, { depth: 1, bevelEnabled: false, curveSegments: seg });
    if (rot) g.rotateX(-Math.PI / 2);
    return g;
  };
  const lathe = (pts, segs) => new THREE.LatheGeometry(pts, segs);
  switch (type) {
    case 'box': return new THREE.BoxGeometry(1, 1, 1);
    case 'rbox': return roundedBoxGeom(p.r ?? .18);
    case 'cylinder': return new THREE.CylinderGeometry(.5, .5, 1, n(48));
    case 'prism': { const k = n(6); const g = new THREE.CylinderGeometry(.5, .5, 1, k); g.rotateY(Math.PI / k); return g; }
    case 'sphere': { const k = n(32); return new THREE.SphereGeometry(.5, k, Math.max(6, Math.round(k * .6))); }
    case 'cone': return new THREE.CylinderGeometry(.5 * clamp(p.top || 0, 0, 1), .5, 1, n(48));
    case 'pyramid': { const k = n(4); const g = new THREE.ConeGeometry(.5, 1, k); g.rotateY(Math.PI / k); return g; }
    case 'hemisphere': {
      const k = n(40), st = Math.max(4, Math.round(k / 4)), pts = [new V2(0, 0)];
      for (let i = 0; i <= st; i++) { const a = i / st * Math.PI / 2; pts.push(new V2(Math.max(0, .5 * Math.cos(a)), .5 * Math.sin(a))); }
      pts[pts.length - 1].x = 0;
      return lathe(pts, k);
    }
    case 'paraboloid': {
      const k = n(40), st = 16, pts = [new V2(0, 0)];
      for (let i = 0; i <= st; i++) { const y = i / st; pts.push(new V2(.5 * Math.sqrt(Math.max(0, 1 - y)), y)); }
      pts[pts.length - 1].x = 0;
      return lathe(pts, k);
    }
    case 'torus': { const t = clamp(p.t || .36, .05, .95); const g = new THREE.TorusGeometry(.5, .5 * t, 18, 56); g.rotateX(Math.PI / 2); return g; }
    case 'tube': {
      const w = clamp(p.wall || .25, .03, .95), k = n(48);
      const s = new THREE.Shape(); s.absarc(0, 0, 1, 0, Math.PI * 2, false);
      const h = new THREE.Path(); h.absarc(0, 0, 1 - w, 0, Math.PI * 2, true); s.holes.push(h);
      return ext(s, true, Math.ceil(k / 4));
    }
    case 'wedge': {
      const s = new THREE.Shape(); s.moveTo(-.5, 0); s.lineTo(.5, 0); s.lineTo(-.5, 1); s.lineTo(-.5, 0);
      return ext(s, false);
    }
    case 'roof': {
      const s = new THREE.Shape(); s.moveTo(-.5, 0); s.lineTo(.5, 0); s.lineTo(0, 1); s.lineTo(-.5, 0);
      return ext(s, false);
    }
    case 'roundroof': {
      const k = n(40), s = new THREE.Shape(); s.moveTo(.5, 0);
      for (let i = 1; i <= k / 2; i++) { const a = i / (k / 2) * Math.PI; s.lineTo(.5 * Math.cos(a), .5 * Math.sin(a)); }
      s.lineTo(.5, 0);
      return ext(s, false);
    }
    case 'star': {
      const k = Math.round(clamp(p.n || 5, 3, 24)), inner = clamp(p.inner || .42, .1, .95), pts = [];
      for (let i = 0; i < k * 2; i++) { const a = Math.PI / 2 + i * Math.PI / k, rr = i % 2 ? inner : 1; pts.push(new V2(Math.cos(a) * rr, Math.sin(a) * rr)); }
      return ext(new THREE.Shape(pts));
    }
    case 'heart': {
      const pts = [];
      for (let i = 0; i < 72; i++) {
        const t = i / 72 * Math.PI * 2;
        pts.push(new V2(16 * Math.sin(t) ** 3, 13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t)));
      }
      return ext(new THREE.Shape(pts.reverse()));
    }
    case 'text': return ext(textShapes(p), true, 1);
  }
  throw new Error('Неизвестная фигура: ' + type);
}

function normalize(g) {
  let ng = g.index ? g.toNonIndexed() : g;
  for (const a of ['uv', 'uv2', 'normal']) if (ng.attributes[a]) ng.deleteAttribute(a);
  ng.clearGroups();
  ng.computeBoundingBox();
  const c = new THREE.Vector3(), s = new THREE.Vector3();
  ng.boundingBox.getCenter(c); ng.boundingBox.getSize(s);
  ng.translate(-c.x, -c.y, -c.z);
  ng.scale(1 / (s.x || 1), 1 / (s.y || 1), 1 / (s.z || 1));
  ng.computeVertexNormals();
  ng.computeBoundingBox(); ng.computeBoundingSphere();
  return { g: ng, c, s };
}

/* ============================ Кэш геометрии ============================ */
const Assets = new Map();           // id → Float32Array позиций (нормализованных) — импортированные STL
const baseCache = new Map();
function paramsKey(o) {
  const d = SHAPES[o.type];
  const p = Object.assign({}, d ? d.params : {}, o.params || {});
  return { p, key: o.type + '|' + JSON.stringify(p) };
}
function rawInfo(o) {
  if (o.type === 'mesh') {
    const key = 'mesh|' + (o.params && o.params.asset);
    let r = baseCache.get(key);
    if (!r) {
      const arr = Assets.get(o.params && o.params.asset);
      if (!arr) throw new Error('Нет данных импортированной модели');
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(arr, 3));
      g.computeVertexNormals(); g.computeBoundingBox(); g.computeBoundingSphere();
      r = { g, c: new THREE.Vector3(), s: new THREE.Vector3(1, 1, 1) }; baseCache.set(key, r);
    }
    return r;
  }
  const { p, key } = paramsKey(o);
  let r = baseCache.get(key);
  if (!r) {
    r = normalize(makeRaw(o.type, p));
    if (baseCache.size > 400) baseCache.delete(baseCache.keys().next().value);
    baseCache.set(key, r);
  }
  return r;
}

function matrixOf(o) {
  const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(o.rot[0] * DEG, o.rot[1] * DEG, o.rot[2] * DEG));
  const m = o.mir || [1, 1, 1];
  return new THREE.Matrix4().compose(new THREE.Vector3().fromArray(o.pos), q, new THREE.Vector3(o.size[0] * m[0], o.size[1] * m[1], o.size[2] * m[2]));
}

const groupCache = new Map();
function groupInfo(o) {
  const key = (o.op || 'union') + JSON.stringify(o.children);
  let r = groupCache.get(key);
  if (!r) {
    r = computeGroup(o.children, o.op || 'union');
    if (groupCache.size > 120) groupCache.delete(groupCache.keys().next().value);
    groupCache.set(key, r);
  }
  return r;
}
function geomFor(o) { return o.children ? groupInfo(o).g : rawInfo(o).g; }

function polysOf(o) {
  const g = geomFor(o), m = matrixOf(o), P = g.attributes.position, C = g.attributes.color;
  const flip = m.determinant() < 0;
  const useC = !!(o.children && o.multi && C);
  const base = new THREE.Color(o.color), bc = [base.r, base.g, base.b];
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(), out = [];
  for (let i = 0; i < P.count; i += 3) {
    a.fromBufferAttribute(P, i).applyMatrix4(m);
    b.fromBufferAttribute(P, i + 1).applyMatrix4(m);
    c.fromBufferAttribute(P, i + 2).applyMatrix4(m);
    const va = new CSG.V(a.x, a.y, a.z), vb = new CSG.V(b.x, b.y, b.z), vc = new CSG.V(c.x, c.y, c.z);
    if (vb.minus(va).cross(vc.minus(va)).len() < 1e-9) continue;
    const col = useC ? [C.getX(i), C.getY(i), C.getZ(i)] : bc;
    out.push(new CSG.Poly(flip ? [va, vc, vb] : [va, vb, vc], col));
  }
  return out;
}
function boxOf(polys) {
  const mn = [Infinity, Infinity, Infinity], mx = [-Infinity, -Infinity, -Infinity];
  for (const p of polys) for (const v of p.vertices) {
    if (v.x < mn[0]) mn[0] = v.x; if (v.y < mn[1]) mn[1] = v.y; if (v.z < mn[2]) mn[2] = v.z;
    if (v.x > mx[0]) mx[0] = v.x; if (v.y > mx[1]) mx[1] = v.y; if (v.z > mx[2]) mx[2] = v.z;
  }
  return { mn, mx };
}
function overlap(a, b) {
  const A = boxOf(a), B = boxOf(b), e = 1e-4;
  for (let i = 0; i < 3; i++) if (A.mx[i] < B.mn[i] - e || B.mx[i] < A.mn[i] - e) return false;
  return true;
}
function unionAll(list) {
  let acc = list[0] || [];
  for (let i = 1; i < list.length; i++) acc = overlap(acc, list[i]) ? CSG.union(acc, list[i]) : acc.concat(list[i]);
  return acc;
}
function polysToGeom(polys) {
  let n = 0;
  for (const p of polys) n += p.vertices.length - 2;
  const pos = new Float32Array(n * 9), col = new Float32Array(n * 9);
  let k = 0;
  for (const p of polys) {
    const vs = p.vertices, s = p.shared;
    for (let i = 2; i < vs.length; i++) for (const v of [vs[0], vs[i - 1], vs[i]]) {
      pos[k] = v.x; pos[k + 1] = v.y; pos[k + 2] = v.z;
      col[k] = s[0]; col[k + 1] = s[1]; col[k + 2] = s[2]; k += 3;
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return g;
}
function computeGroup(children, op) {
  let polys;
  if (op === 'intersect') {
    polys = polysOf(children[0]);
    for (let i = 1; i < children.length; i++) {
      const b = polysOf(children[i]);
      polys = overlap(polys, b) ? CSG.intersect(polys, b) : [];
      if (!polys.length) break;
    }
  } else {
    const solids = children.filter(c => !c.hole), holes = children.filter(c => c.hole);
    if (solids.length) {
      polys = unionAll(solids.map(polysOf));
      for (const h of holes) { const hp = polysOf(h); if (hp.length && overlap(polys, hp)) polys = CSG.subtract(polys, hp); }
    } else polys = unionAll(holes.map(polysOf));
  }
  if (!polys.length) throw new Error(op === 'intersect' ? 'фигуры не пересекаются' : 'после вычитания ничего не осталось');
  return normalize(polysToGeom(polys));
}
function makeGroup(objs, op = 'union') {
  const children = JSON.parse(JSON.stringify(objs));
  const probe = { op, children };
  const info = groupInfo(probe);
  const solids = op === 'intersect' ? children : children.filter(c => !c.hole);
  const colors = new Set(solids.map(c => c.multi ? '*' : c.color.toLowerCase()));
  return {
    id: uid(), type: 'group', op, name: op === 'intersect' ? 'Пересечение' : 'Группа', color: (solids[0] || children[0]).color,
    multi: colors.size > 1 || colors.has('*'), hole: op !== 'intersect' && solids.length === 0,
    pos: info.c.toArray().map(r3), rot: [0, 0, 0], size: info.s.toArray().map(r3), mir: [1, 1, 1],
    orig: { c: info.c.toArray(), s: info.s.toArray() }, children,
  };
}
function objFromMatrix(o, M) {
  const p = new THREE.Vector3(), q = new THREE.Quaternion(), s = new THREE.Vector3();
  M.decompose(p, q, s);
  const e = new THREE.Euler().setFromQuaternion(q);
  return Object.assign({}, o, {
    pos: p.toArray().map(r3), rot: [e.x, e.y, e.z].map(v => r2(v / DEG)),
    size: s.toArray().map(v => Math.max(.1, r3(Math.abs(v)))), mir: s.toArray().map(v => v < 0 ? -1 : 1),
  });
}
function ungroupOne(o) {
  const O = new THREE.Matrix4().compose(new THREE.Vector3().fromArray(o.orig.c), new THREE.Quaternion(), new THREE.Vector3().fromArray(o.orig.s));
  const M = matrixOf(o).multiply(O.invert());
  return o.children.map(c => Object.assign(objFromMatrix(c, M.clone().multiply(matrixOf(c))), { id: uid() }));
}

/* ============================ Треугольники мира ============================ */
function forEachWorldTri(objs, fn) {
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
  for (const o of objs) {
    const g = geomFor(o), m = matrixOf(o), P = g.attributes.position, C = g.attributes.color;
    const flip = m.determinant() < 0, useC = !!(o.children && o.multi && C);
    for (let i = 0; i < P.count; i += 3) {
      a.fromBufferAttribute(P, i).applyMatrix4(m);
      b.fromBufferAttribute(P, i + 1).applyMatrix4(m);
      c.fromBufferAttribute(P, i + 2).applyMatrix4(m);
      const col = useC ? '#' + new THREE.Color(C.getX(i), C.getY(i), C.getZ(i)).getHexString() : o.color;
      if (flip) fn(a, c, b, o, col); else fn(a, b, c, o, col);
    }
  }
}
/* Объём (мм³) по формуле тетраэдров. Перекрывающиеся тела считаются дважды — это оценка. */
function volumeOf(objs) {
  let v = 0;
  forEachWorldTri(objs, (a, b, c) => { v += a.dot(new THREE.Vector3().crossVectors(b, c)) / 6; });
  return Math.abs(v);
}

/* ============================ Экспорт ============================ */
/* В файлах ось Z смотрит вверх: (x, y, z)три → (x, -z, y)файл */
function buildSTL(objs) {
  let tris = 0; for (const o of objs) tris += geomFor(o).attributes.position.count / 3;
  const buf = new ArrayBuffer(84 + 50 * tris), dv = new DataView(buf);
  const head = 'Verstak 3D STL export, units: mm';
  for (let i = 0; i < head.length; i++) dv.setUint8(i, head.charCodeAt(i));
  dv.setUint32(80, tris, true);
  let off = 84;
  const n = new THREE.Vector3(), t = new THREE.Vector3();
  const put = v => { dv.setFloat32(off, v.x, true); dv.setFloat32(off + 4, -v.z, true); dv.setFloat32(off + 8, v.y, true); off += 12; };
  forEachWorldTri(objs, (a, b, c) => {
    n.subVectors(b, a).cross(t.subVectors(c, a)).normalize();
    put(n); put(a); put(b); put(c); dv.setUint16(off, 0, true); off += 2;
  });
  return { bytes: new Uint8Array(buf), tris };
}
function buildOBJ(objs) {
  const out = ['# Verstak 3D OBJ export, units: mm', ''];
  let vi = 1;
  for (const o of objs) {
    out.push('o ' + String(o.name || 'object').replace(/\s+/g, '_'));
    const faces = [];
    forEachWorldTri([o], (a, b, c, _o, col) => {
      const k = new THREE.Color(col);
      for (const v of [a, b, c]) out.push(`v ${r3(v.x)} ${r3(-v.z)} ${r3(v.y)} ${k.r.toFixed(3)} ${k.g.toFixed(3)} ${k.b.toFixed(3)}`);
      faces.push(`f ${vi} ${vi + 1} ${vi + 2}`); vi += 3;
    });
    out.push(...faces, '');
  }
  return out.join('\n');
}
function build3MF(objs) {
  const colors = [], cidx = new Map();
  const colorIndex = c => { c = c.toUpperCase(); if (!cidx.has(c)) { cidx.set(c, colors.length); colors.push(c); } return cidx.get(c); };
  const esc = s => String(s).replace(/[&<>"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));
  const objXml = [], items = [];
  objs.forEach((o, k) => {
    const id = k + 2, verts = [], tris = [], vmap = new Map();
    const vid = v => {
      const key = `${r3(v.x)},${r3(-v.z)},${r3(v.y)}`;
      let i = vmap.get(key); if (i === undefined) { i = verts.length; vmap.set(key, i); verts.push(key.split(',')); } return i;
    };
    let mainColor = colorIndex(o.color);
    forEachWorldTri([o], (a, b, c, _o, col) => {
      const i1 = vid(a), i2 = vid(b), i3 = vid(c);
      if (i1 === i2 || i2 === i3 || i1 === i3) return;
      const ci = colorIndex(col);
      tris.push(`<triangle v1="${i1}" v2="${i2}" v3="${i3}"${ci !== mainColor ? ` pid="1" p1="${ci}"` : ''}/>`);
    });
    objXml.push(`<object id="${id}" name="${esc(o.name || 'object')}" type="model" pid="1" pindex="${mainColor}"><mesh><vertices>${verts.map(v => `<vertex x="${v[0]}" y="${v[1]}" z="${v[2]}"/>`).join('')}</vertices><triangles>${tris.join('')}</triangles></mesh></object>`);
    items.push(`<item objectid="${id}"/>`);
  });
  const model = `<?xml version="1.0" encoding="UTF-8"?>
<model unit="millimeter" xml:lang="ru-RU" xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02">
<metadata name="Application">Verstak 3D</metadata>
<resources><basematerials id="1">${colors.map((c, i) => `<base name="color${i}" displaycolor="${c}FF"/>`).join('')}</basematerials>${objXml.join('')}</resources>
<build>${items.join('')}</build>
</model>`;
  const enc = new TextEncoder();
  return zipFiles([
    { name: '[Content_Types].xml', data: enc.encode('<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="model" ContentType="application/vnd.ms-package.3dmanufacturing-3dmodel+xml"/></Types>') },
    { name: '_rels/.rels', data: enc.encode('<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Target="/3D/3dmodel.model" Id="rel0" Type="http://schemas.microsoft.com/3dmanufacturing/2013/01/3dmodel"/></Relationships>') },
    { name: '3D/3dmodel.model', data: enc.encode(model) },
  ]);
}

/* ZIP без сжатия (store) */
const CRC_T = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
function crc32(u8) { let c = 0xFFFFFFFF; for (let i = 0; i < u8.length; i++) c = CRC_T[(c ^ u8[i]) & 255] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; }
function zipFiles(files) {
  const enc = new TextEncoder(), d = new Date();
  const time = (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1);
  const date = ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate();
  const ents = files.map(f => ({ nb: enc.encode(f.name), data: f.data, crc: crc32(f.data) }));
  let size = 22; for (const e of ents) size += 30 + e.nb.length + e.data.length + 46 + e.nb.length;
  const out = new Uint8Array(size), dv = new DataView(out.buffer);
  let p = 0;
  for (const e of ents) {
    e.off = p;
    dv.setUint32(p, 0x04034b50, true); dv.setUint16(p + 4, 20, true); dv.setUint16(p + 6, 0x0800, true); dv.setUint16(p + 8, 0, true);
    dv.setUint16(p + 10, time, true); dv.setUint16(p + 12, date, true); dv.setUint32(p + 14, e.crc, true);
    dv.setUint32(p + 18, e.data.length, true); dv.setUint32(p + 22, e.data.length, true); dv.setUint16(p + 26, e.nb.length, true); dv.setUint16(p + 28, 0, true);
    out.set(e.nb, p + 30); out.set(e.data, p + 30 + e.nb.length); p += 30 + e.nb.length + e.data.length;
  }
  const cdo = p;
  for (const e of ents) {
    dv.setUint32(p, 0x02014b50, true); dv.setUint16(p + 4, 20, true); dv.setUint16(p + 6, 20, true); dv.setUint16(p + 8, 0x0800, true);
    dv.setUint16(p + 10, 0, true); dv.setUint16(p + 12, time, true); dv.setUint16(p + 14, date, true); dv.setUint32(p + 16, e.crc, true);
    dv.setUint32(p + 20, e.data.length, true); dv.setUint32(p + 24, e.data.length, true); dv.setUint16(p + 28, e.nb.length, true);
    dv.setUint16(p + 30, 0, true); dv.setUint16(p + 32, 0, true); dv.setUint16(p + 34, 0, true); dv.setUint16(p + 36, 0, true);
    dv.setUint32(p + 38, 0, true); dv.setUint32(p + 42, e.off, true); out.set(e.nb, p + 46); p += 46 + e.nb.length;
  }
  dv.setUint32(p, 0x06054b50, true); dv.setUint16(p + 4, 0, true); dv.setUint16(p + 6, 0, true);
  dv.setUint16(p + 8, ents.length, true); dv.setUint16(p + 10, ents.length, true); dv.setUint32(p + 12, p - cdo, true); dv.setUint32(p + 16, cdo, true); dv.setUint16(p + 20, 0, true);
  return out;
}

/* ============================ Импорт STL ============================ */
function parseSTL(u8) {
  const dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
  const pos = [];
  const binary = u8.length >= 84 && 84 + dv.getUint32(80, true) * 50 === u8.length;
  if (binary) {
    const n = dv.getUint32(80, true);
    for (let i = 0; i < n; i++) {
      const o = 84 + i * 50 + 12;
      for (let k = 0; k < 3; k++) { const x = dv.getFloat32(o + k * 12, true), y = dv.getFloat32(o + k * 12 + 4, true), z = dv.getFloat32(o + k * 12 + 8, true); pos.push(x, z, -y); }
    }
  } else {
    const txt = new TextDecoder().decode(u8), re = /vertex\s+([-+\d.eE]+)\s+([-+\d.eE]+)\s+([-+\d.eE]+)/g;
    let m; while ((m = re.exec(txt))) pos.push(+m[1], +m[3], -m[2]);
  }
  if (pos.length < 9) throw new Error('В файле нет треугольников');
  if (pos.length / 9 > 400000) throw new Error('Слишком большая модель (больше 400 тыс. треугольников)');
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(pos), 3));
  const { g: ng, s } = normalize(g);
  return { positions: ng.attributes.position.array, size: s.toArray().map(r3) };
}
function f32ToB64(f) { const u = new Uint8Array(f.buffer, f.byteOffset, f.byteLength); let s = ''; for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000)); return btoa(s); }
function b64ToF32(b) { const s = atob(b), u = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i); return new Float32Array(u.buffer); }

/* ============================ Проверка проекта ============================ */
function sanitize(list) {
  const num = (a, n, d) => Array.isArray(a) && a.length === n && a.every(Number.isFinite) ? a.map(Number) : d;
  return (Array.isArray(list) ? list : []).filter(o => o && (o.children || SHAPES[o.type] || o.type === 'mesh')).map(o => {
    const r = {
      id: typeof o.id === 'string' ? o.id : uid(), type: o.children ? 'group' : o.type,
      name: String(o.name || KIND[o.type] || 'Фигура').slice(0, 80), color: /^#[0-9a-f]{6}$/i.test(o.color) ? o.color : '#888888',
      hole: !!o.hole, pos: num(o.pos, 3, [0, 10, 0]), rot: num(o.rot, 3, [0, 0, 0]),
      size: num(o.size, 3, [20, 20, 20]).map(v => Math.max(.1, Math.abs(v))), mir: num(o.mir, 3, [1, 1, 1]).map(v => v < 0 ? -1 : 1),
    };
    if (o.params && typeof o.params === 'object') r.params = JSON.parse(JSON.stringify(o.params));
    if (o.locked) r.locked = true;
    if (o.children) {
      r.children = sanitize(o.children); r.multi = !!o.multi; r.op = o.op === 'intersect' ? 'intersect' : 'union';
      r.orig = { c: num(o.orig && o.orig.c, 3, r.pos), s: num(o.orig && o.orig.s, 3, r.size) };
    }
    return r;
  }).filter(o => !o.children || o.children.length);
}

const Core = {
  DEG, r2, r3, clamp, uid, CSG, SHAPES, KIND, PARAM_UI, PARAM_LABEL_OVERRIDE, PARAM_LIMITS, FONTS, Assets,
  traceContours, simplifyClosed, nestContours, polyArea,
  rawInfo, geomFor, matrixOf, makeGroup, ungroupOne, objFromMatrix, polysOf,
  volumeOf, buildSTL, buildOBJ, build3MF, zipFiles, crc32, parseSTL, f32ToB64, b64ToF32, sanitize,
};
if (typeof window !== 'undefined') window.Core = Core;
if (typeof module !== 'undefined') module.exports = Core;
