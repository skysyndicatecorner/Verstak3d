/*
 * Верстак 3D — интерфейс приложения.
 * Лицензия MIT.
 */
(() => {
'use strict';
const C = window.Core;
const { DEG, r2, r3, clamp, uid, SHAPES, KIND } = C;
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const V3 = THREE.Vector3;
const desktop = window.desktop || null;
const APP_VERSION = '1.0.0';

/* ============================ утилиты ============================ */
const fmt = v => { const x = r2(v); return String(Object.is(x, -0) ? 0 : x).replace('.', ','); };
function evalExpr(src) {
  const s = String(src).replace(/,/g, '.').replace(/\s+/g, '').replace(/мм$/i, '');
  let i = 0;
  const num = () => {
    if (s[i] === '(') { i++; const v = expr(); if (s[i++] !== ')') throw 0; return v; }
    if (s[i] === '-') { i++; return -num(); }
    if (s[i] === '+') { i++; return num(); }
    const m = /^(\d+\.?\d*|\.\d+)(e[-+]?\d+)?/i.exec(s.slice(i)); if (!m) throw 0;
    i += m[0].length; return parseFloat(m[0]);
  };
  const term = () => { let v = num(); while (s[i] === '*' || s[i] === '/') { const op = s[i++]; const b = num(); v = op === '*' ? v * b : v / b; } return v; };
  const expr = () => { let v = term(); while (s[i] === '+' || s[i] === '-') { const op = s[i++]; const b = term(); v = op === '+' ? v + b : v - b; } return v; };
  try { if (!s) return NaN; const v = expr(); return i === s.length && Number.isFinite(v) ? v : NaN; } catch (e) { return NaN; }
}
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const basename = p => String(p).split(/[\\/]/).pop();
const stripExt = n => n.replace(/\.[^.]+$/, '');
const store = {
  get(k, d) { try { const v = localStorage.getItem('verstak3d.' + k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem('verstak3d.' + k, JSON.stringify(v)); return true; } catch (e) { return false; } },
};

/* ============================ иконки ============================ */
const ICONS = {
  save: '<path d="M5 4h11l3 3v13H5zM8 4v5h7V4M8 20v-6h8v6"/>',
  undo: '<path d="M9 14 4 9l5-5M4 9h11a5 5 0 0 1 0 10h-3"/>',
  redo: '<path d="m15 14 5-5-5-5M20 9H9a5 5 0 0 0 0 10h3"/>',
  help: '<circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.7.3-1 .9-1 1.7M12 17h.01"/>',
  'chevron-up': '<path d="m6 15 6-6 6 6"/>', 'chevron-down': '<path d="m6 9 6 6 6-6"/>',
  paste: '<path d="M9 4h6v3H9zM7 5H5v15h6M15 5h2v3"/><path d="M12 10h8v10h-8z"/>',
  cut: '<circle cx="6" cy="18" r="2.5"/><circle cx="18" cy="18" r="2.5"/><path d="M7.8 16.2 17 4M16.2 16.2 7 4"/>',
  copy: '<path d="M9 9h11v11H9zM5 15V4h11"/>',
  dup: '<path d="M4 4h10v10H4z"/><path d="M10 10h10v10H10z" stroke-dasharray="2.5 2"/>',
  trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
  solid: '<path d="M12 3 4 7.5v9L12 21l8-4.5v-9z" fill="currentColor" fill-opacity=".25"/><path d="M4 7.5 12 12l8-4.5M12 12v9"/>',
  hole: '<path d="M12 3 4 7.5v9L12 21l8-4.5v-9z" stroke-dasharray="2.6 2.2"/><path d="M4 7.5 12 12l8-4.5M12 12v9" stroke-dasharray="2.6 2.2"/>',
  group: '<path d="M3 3h11v11H3z" fill="currentColor" fill-opacity=".2"/><path d="M10 10h11v11H10z" fill="currentColor" fill-opacity=".2"/><path d="M1.5 1.5h21v21h-21z" stroke-dasharray="2 2" stroke-width="1.2"/>',
  ungroup: '<path d="M3 3h8v8H3zM13 13h8v8h-8z"/><path d="M14 4h6v6M10 20H4v-6" stroke-dasharray="2 2"/>',
  subtract: '<path d="M3 5h12v14H3z" fill="currentColor" fill-opacity=".25"/><circle cx="16" cy="12" r="5.5" stroke-dasharray="2.4 2"/>',
  intersect: '<rect x="3" y="5" width="12" height="14"/><circle cx="15" cy="12" r="6"/><path d="M11 6.8a6 6 0 0 1 0 10.4V6.8z" fill="currentColor" fill-opacity=".5"/>',
  color: '<path d="m5 13 7-9 7 9a7 7 0 0 1-14 0z"/>',
  'select-all': '<path d="M4 4h16v16H4z" stroke-dasharray="3 2"/><path d="M8 8h8v8H8z"/>',
  deselect: '<path d="M4 4h16v16H4z" stroke-dasharray="3 2"/><path d="m9 9 6 6M15 9l-6 6"/>',
  lock: '<rect x="5" y="11" width="14" height="9" rx="1.5"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
  text: '<path d="M5 6V4h14v2M12 4v16M9 20h6"/>',
  import: '<path d="M12 3v12M7 10l5 5 5-5M5 21h14"/>',
  export: '<path d="M12 15V3M7 8l5-5 5 5M5 21h14"/>',
  drop: '<path d="M12 3v11M8 10l4 4 4-4"/><path d="M3 20h18" stroke-width="2.4"/>',
  rotate: '<path d="M20 12a8 8 0 1 1-2.34-5.66M20 4v5h-5"/>',
  'rot-left': '<path d="M4 12a8 8 0 1 0 2.34-5.66M4 4v5h5"/>',
  'rot-right': '<path d="M20 12a8 8 0 1 1-2.34-5.66M20 4v5h-5"/>',
  'rot-side': '<path d="M4 15h16v5H4z"/><path d="M8 11V4h5M6 6l2-2 2 2" />',
  'rot-reset': '<path d="M4 12a8 8 0 1 0 2.34-5.66M4 4v5h5M12 8v4l3 2"/>',
  'mir-x': '<path d="M12 3v18" stroke-dasharray="2 2"/><path d="M9 6 3 18h6zM15 6l6 12h-6z"/>',
  'mir-y': '<path d="M3 12h18" stroke-dasharray="2 2"/><path d="M6 9l6-6 6 6zM6 15l6 6 6-6z"/>',
  'mir-z': '<path d="M3 12h18" stroke-dasharray="2 2"/><path d="M5 9h14L12 3zM5 15h14l-7 6z"/>',
  array: '<path d="M3 8h5v8H3zM10 8h5v8h-5zM17 8h4v8h-4z"/>',
  ruler: '<path d="m3 16 13-13 5 5L8 21z"/><path d="m7 12 2 2M10 9l2 2M13 6l2 2"/>',
  ratio: '<path d="M4 20 20 4M14 4h6v6M10 20H4v-6"/><rect x="9" y="9" width="6" height="6" rx="1"/>',
  'zoom-in': '<circle cx="11" cy="11" r="7"/><path d="m20 20-4-4M8 11h6M11 8v6"/>',
  'zoom-out': '<circle cx="11" cy="11" r="7"/><path d="m20 20-4-4M8 11h6"/>',
  x2: '<path d="M4 20V10h10v10z"/><path d="M14 14h6V4H10v6"/>',
  fit: '<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>',
  home: '<path d="M4 11 12 4l8 7M6 10v10h12V10"/>',
  'v-top': '<path d="M4 4h16v16H4z"/><circle cx="12" cy="12" r="2.2"/>',
  'v-front': '<path d="M5 8h11v12H5zM5 8l4-4h11l-4 4M20 4v12l-4 4"/>',
  'v-right': '<path d="M8 8h11v12H8z"/><path d="M8 8 4 4v12l4 4"/>',
  plus: '<path d="M12 5v14M5 12h14"/>', minus: '<path d="M5 12h14"/>',
  close: '<path d="M6 6l12 12M18 6 6 18"/>', back: '<path d="M19 12H5M11 6l-6 6 6 6"/>',
  'al-left': '<path d="M4 3v18"/><path d="M7 6h10v4H7zM7 14h6v4H7z"/>',
  'al-right': '<path d="M20 3v18"/><path d="M7 6h10v4H7zM11 14h6v4h-6z"/>',
  'al-cx': '<path d="M12 3v18" stroke-dasharray="2 2"/><path d="M6 6h12v4H6zM8 14h8v4H8z"/>',
  'al-top': '<path d="M3 4h18"/><path d="M6 7h4v10H6zM14 7h4v6h-4z"/>',
  'al-bottom': '<path d="M3 20h18"/><path d="M6 7h4v10H6zM14 11h4v6h-4z"/>',
  'al-cz': '<path d="M3 12h18" stroke-dasharray="2 2"/><path d="M6 6h4v12H6zM14 8h4v8h-4z"/>',
  'al-front': '<path d="M3 20h18"/><path d="M6 8h12v8H6z"/><path d="M9 4h6"/>',
  'al-back': '<path d="M3 4h18"/><path d="M6 8h12v8H6z"/><path d="M9 20h6"/>',
  'al-cy': '<path d="M3 12h18" stroke-dasharray="2 2"/><path d="M7 7h10v10H7z"/>',
  file: '<path d="M6 3h9l4 4v14H6zM14 3v5h5"/>', folder: '<path d="M3 6h6l2 2h10v11H3z"/>',
};
function iconSVG(name) { return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name] || ''}</svg>`; }
function hydrateIcons(root = document) {
  $$('[data-icon]', root).forEach(el => {
    if (el.dataset.iconDone) return;
    el.dataset.iconDone = '1';
    if (el.tagName === 'I') { el.outerHTML = iconSVG(el.dataset.icon); return; }
    el.insertAdjacentHTML('afterbegin', iconSVG(el.dataset.icon));
    if (el.title && !el.getAttribute('aria-label') && !el.textContent.trim()) el.setAttribute('aria-label', el.title);
  });
}
hydrateIcons();

/* ============================ состояние ============================ */
const BEDS = [
  { id: 'std', name: 'Стандарт — 200 × 200 мм', w: 200, d: 200 },
  { id: 'ender3', name: 'Creality Ender-3 — 220 × 220 мм', w: 220, d: 220 },
  { id: 'k1', name: 'Creality K1 — 220 × 220 мм', w: 220, d: 220 },
  { id: 'mk4', name: 'Prusa MK4 — 250 × 210 мм', w: 250, d: 210 },
  { id: 'mini', name: 'Prusa MINI — 180 × 180 мм', w: 180, d: 180 },
  { id: 'bambu', name: 'Bambu Lab X1 / P1 / A1 — 256 × 256 мм', w: 256, d: 256 },
  { id: 'a1mini', name: 'Bambu Lab A1 mini — 180 × 180 мм', w: 180, d: 180 },
  { id: 'kobra', name: 'Anycubic Kobra 2 — 220 × 220 мм', w: 220, d: 220 },
  { id: 'big', name: 'Большой — 300 × 300 мм', w: 300, d: 300 },
];
const PALETTE = ['#d9483b', '#e8873a', '#e2b52f', '#7cb342', '#2a9d6f', '#1f8a8a', '#2f7fd6', '#2c3e8f', '#7a5bd0', '#c4527a',
  '#f2f2ee', '#c9c9c9', '#8a8a8a', '#3a3f46', '#141414', '#8d5a3b', '#f4b6c2', '#a8d8ea', '#ffe082', '#b39ddb'];

const S = {
  objects: [], sel: [], snap: 1, snapOn: true, rotSnap: 15, mode: 'select', tool: null,
  lock: false, asHole: false, bed: BEDS[0], showGrid: true, showDims: true,
  file: { path: null, name: null }, dirty: false, clipboard: null, density: 1.24, theme: 'system',
};
const byId = id => S.objects.find(o => o.id === id);
const selObjs = () => S.sel.map(byId).filter(Boolean);

/* ============================ история ============================ */
let past = [], future = [], current = '[]';
function commit() {
  const snap = JSON.stringify(S.objects);
  if (snap === current) return;
  past.push(current); if (past.length > 150) past.shift();
  future = []; current = snap;
  setDirty(true); autosave(); updateRibbon(); scheduleStats();
}
function restore(snap) { current = snap; S.objects = JSON.parse(snap); S.sel = S.sel.filter(id => byId(id)); rebuild(); setDirty(true); autosave(); scheduleStats(); }
function undo() { if (!past.length) return; future.push(current); restore(past.pop()); updateRibbon(); }
function redo() { if (!future.length) return; past.push(current); restore(future.pop()); updateRibbon(); }
function resetHistory() { past = []; future = []; current = JSON.stringify(S.objects); updateRibbon(); }
function usedAssets(list, out = new Set()) { for (const o of list) { if (o.type === 'mesh' && o.params) out.add(o.params.asset); if (o.children) usedAssets(o.children, out); } return out; }
function projectData() {
  const assets = {};
  for (const id of usedAssets(S.objects)) { const a = C.Assets.get(id); if (a) assets[id] = C.f32ToB64(a); }
  return { app: 'verstak3d', version: 2, units: 'mm', bed: S.bed.id, objects: S.objects, assets };
}
let autosaveT = 0;
function autosave() {
  clearTimeout(autosaveT);
  autosaveT = setTimeout(() => {
    const ok = store.set('autosave', { file: S.file, dirty: S.dirty, data: projectData() });
    if (!ok) store.set('autosave', { file: S.file, dirty: S.dirty, data: Object.assign(projectData(), { assets: {} }) });
  }, 400);
}
function setDirty(v) { S.dirty = v; updateTitle(); if (desktop) desktop.setDirty(v); }
function updateTitle() {
  const name = S.file.name || 'Без имени';
  const t = `${name}${S.dirty ? ' •' : ''} — Верстак 3D`;
  document.title = t; $('#docTitle').textContent = t;
  if (desktop) desktop.setTitle(t);
}

/* ============================ сцена ============================ */
const vp = $('#vp'), cv = $('#cv');
const renderer = new THREE.WebGLRenderer({ canvas: cv, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(36, 1, .5, 8000);
const HOME = { pos: new V3(190, 175, 250), target: new V3(0, 0, 0) };
camera.position.copy(HOME.pos);
const orbit = new THREE.OrbitControls(camera, cv);
orbit.enableDamping = true; orbit.dampingFactor = .14; orbit.screenSpacePanning = true;
orbit.mouseButtons = { LEFT: null, MIDDLE: THREE.MOUSE.PAN, RIGHT: THREE.MOUSE.ROTATE };
orbit.touches = { ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_PAN };
orbit.minDistance = 8; orbit.maxDistance = 3000; orbit.zoomSpeed = 1.1;
cv.addEventListener('contextmenu', e => e.preventDefault());

scene.add(new THREE.HemisphereLight(0xffffff, 0x8a96a6, .7));
const sun = new THREE.DirectionalLight(0xffffff, .75); sun.position.set(110, 200, 150); scene.add(sun);
const rim = new THREE.DirectionalLight(0xffffff, .3); rim.position.set(-160, 80, -120); scene.add(rim);

const tok = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim() || '#888888';
const workplane = new THREE.Group(); scene.add(workplane);
const lineMats = { sel: new THREE.LineBasicMaterial({ color: 0x2c5aa0 }), hole: new THREE.LineBasicMaterial({ color: 0x56626f }) };
const holeMat = () => new THREE.MeshStandardMaterial({ color: tok('--hole'), transparent: true, opacity: .3, depthWrite: false, roughness: .8 });
function buildWorkplane() {
  while (workplane.children.length) { const c = workplane.children.pop(); c.geometry.dispose(); c.material.dispose(); }
  const { w, d } = S.bed;
  const plane = new THREE.Mesh(new THREE.PlaneGeometry(w, d).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: tok('--plane') }));
  plane.position.y = -.08;
  workplane.add(plane);
  if (S.showGrid) {
    const minor = [], major = [];
    for (let x = -w / 2; x <= w / 2 + 1e-6; x += 1) { const a = Math.abs(Math.round(x) % 10) === 0 ? major : minor; if (Math.abs(x - Math.round(x)) < 1e-6) a.push(x, 0, -d / 2, x, 0, d / 2); }
    for (let z = -d / 2; z <= d / 2 + 1e-6; z += 1) { const a = Math.abs(Math.round(z) % 10) === 0 ? major : minor; a.push(-w / 2, 0, z, w / 2, 0, z); }
    const mk = (arr, col, y, op) => {
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(arr, 3));
      const l = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: col, transparent: op < 1, opacity: op })); l.position.y = y; return l;
    };
    workplane.add(mk(minor, tok('--grid-minor'), -.05, .7), mk(major, tok('--grid-major'), -.03, 1));
  }
  const edge = new THREE.BufferGeometry().setFromPoints([new V3(-w / 2, 0, -d / 2), new V3(w / 2, 0, -d / 2), new V3(w / 2, 0, d / 2), new V3(-w / 2, 0, d / 2), new V3(-w / 2, 0, -d / 2)]);
  const el = new THREE.Line(edge, new THREE.LineBasicMaterial({ color: tok('--bed-edge') })); el.position.y = -.02; workplane.add(el);
}
function applyTheme() {
  scene.background = new THREE.Color(tok('--vp'));
  buildWorkplane();
  lineMats.sel.color.set(tok('--accent')); lineMats.hole.color.set(tok('--hole-line'));
  for (const [id, m] of meshById) { const o = byId(id); if (o && o.hole) m.material.color.set(tok('--hole')); }
  for (const h of Handles.list) { h.material.color.set(h.userData.kind === 'side' || h.userData.kind === 'lift' ? tok('--accent') : tok('--handle')); h.children[0].material.color.set(tok('--accent')); }
  rulerLine.material.color.set(tok('--accent'));
}
function setTheme(t) {
  S.theme = t; store.set('theme', t);
  if (t === 'system') delete document.documentElement.dataset.theme; else document.documentElement.dataset.theme = t;
}
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', applyTheme);
new MutationObserver(applyTheme).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

/* поворот мышью — стандартный гизмо three.js */
const tc = new THREE.TransformControls(camera, cv);
tc.setSize(.9); tc.setSpace('local'); scene.add(tc);
const pivot = new THREE.Object3D(); scene.add(pivot);
let tcStart = null;
tc.addEventListener('dragging-changed', e => {
  orbit.enabled = !e.value;
  if (e.value) tcStart = { q: pivot.quaternion.clone(), p: pivot.position.clone(), items: selMeshes().map(m => ({ m, p: m.position.clone(), q: m.quaternion.clone() })) };
  else { selMeshes().forEach(syncFromMesh); commit(); attachGizmo(); renderPane(); }
});
tc.addEventListener('objectChange', () => {
  if (tc.object === pivot && tcStart) {
    const dq = pivot.quaternion.clone().multiply(tcStart.q.clone().invert());
    for (const it of tcStart.items) {
      it.m.position.copy(it.p).sub(tcStart.p).applyQuaternion(dq).add(tcStart.p);
      it.m.quaternion.copy(dq).multiply(it.q);
    }
  }
  fillPane(); updateStatus();
});

/* ============================ меши ============================ */
const meshById = new Map();
const edgeCache = new WeakMap();
const unitBoxEdges = new THREE.EdgesGeometry(new THREE.BoxGeometry(1, 1, 1));
/* Результат булевой операции содержит Т-стыки треугольников — его рёбра выглядят как «веер».
   Для групп и импортированных моделей вместо рёбер рисуем габаритную рамку. */
function edgesFor(g, o) {
  if (o && (o.children || o.type === 'mesh')) return unitBoxEdges;
  let e = edgeCache.get(g); if (!e) { e = new THREE.EdgesGeometry(g, 28); edgeCache.set(g, e); } return e;
}
function matFor(o) {
  if (o.hole) return holeMat();
  const vc = !!(o.children && o.multi);
  return new THREE.MeshStandardMaterial({ color: vc ? 0xffffff : o.color, vertexColors: vc, flatShading: true, roughness: .55, metalness: .02 });
}
function applyT(m, o) {
  const mir = o.mir || [1, 1, 1];
  m.position.fromArray(o.pos);
  m.rotation.set(o.rot[0] * DEG, o.rot[1] * DEG, o.rot[2] * DEG);
  m.scale.set(o.size[0] * mir[0], o.size[1] * mir[1], o.size[2] * mir[2]);
}
function syncFromMesh(m) {
  const o = byId(m.userData.id); if (!o) return;
  o.pos = m.position.toArray().map(r3);
  o.rot = [m.rotation.x, m.rotation.y, m.rotation.z].map(v => r2(v / DEG));
  o.size = m.scale.toArray().map(v => Math.max(.1, r3(Math.abs(v))));
  o.mir = m.scale.toArray().map(v => v < 0 ? -1 : 1);
}
function addMesh(o) {
  let g;
  try { g = C.geomFor(o); } catch (err) { console.error(err); toast('Не удалось построить «' + o.name + '»: ' + err.message); return null; }
  const m = new THREE.Mesh(g, matFor(o));
  m.userData.id = o.id;
  if (o.hole) m.renderOrder = 2;
  applyT(m, o);
  const line = new THREE.LineSegments(edgesFor(g, o), lineMats.hole);
  line.raycast = () => {};
  m.add(line); m.userData.line = line;
  scene.add(m); meshById.set(o.id, m);
  return m;
}
function rebuild() {
  for (const m of meshById.values()) { scene.remove(m); m.material.dispose(); }
  meshById.clear();
  for (const o of S.objects) addMesh(o);
  S.sel = S.sel.filter(id => meshById.has(id));
  updateSelection();
}
const selMeshes = () => S.sel.map(id => meshById.get(id)).filter(Boolean);
const worldBox = m => { m.updateMatrixWorld(true); return new THREE.Box3().setFromObject(m); };
function selBox() { const b = new THREE.Box3(); selMeshes().forEach(m => b.union(worldBox(m))); return b; }

function updateSelection() {
  for (const [id, m] of meshById) {
    const o = byId(id), on = S.sel.includes(id);
    m.userData.line.visible = on || o.hole;
    m.userData.line.material = on ? lineMats.sel : lineMats.hole;
    if (m.material.emissive) m.material.emissive.set(on && !o.hole ? 0x15202e : 0x000000);
  }
  attachGizmo(); renderPane(); updateRibbon(); updateStatus();
}
function attachGizmo() {
  const ms = selMeshes();
  if (S.mode !== 'rotate' || !ms.length || selObjs().some(o => o.locked)) { tc.detach(); return; }
  tc.setMode('rotate'); tc.setRotationSnap(S.rotSnap * DEG);
  const b = selBox(); b.getCenter(pivot.position);
  pivot.quaternion.identity();
  if (ms.length === 1) pivot.quaternion.copy(ms[0].quaternion);
  pivot.updateMatrixWorld();
  tc.attach(pivot);
}

/* ============================ ручки размера ============================ */
const Handles = { group: new THREE.Group(), list: [] };
scene.add(Handles.group);
function mkHandle(kind, lp, sx, sz) {
  const geo = kind === 'lift' ? new THREE.ConeGeometry(.6, 1.5, 18) : new THREE.BoxGeometry(1, 1, 1);
  const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: 0xffffff, depthTest: false, transparent: true }));
  m.renderOrder = 1000;
  const e = new THREE.LineSegments(new THREE.EdgesGeometry(geo), new THREE.LineBasicMaterial({ color: 0x2c5aa0, depthTest: false, transparent: true }));
  e.renderOrder = 1001; e.raycast = () => {}; m.add(e);
  m.userData = { kind, lp: new V3(...lp), sx, sz };
  Handles.group.add(m); Handles.list.push(m);
}
for (const sx of [-1, 1]) for (const sz of [-1, 1]) mkHandle('corner', [sx * .5, -.5, sz * .5], sx, sz);
mkHandle('side', [.5, -.5, 0], 1, 0); mkHandle('side', [-.5, -.5, 0], -1, 0);
mkHandle('side', [0, -.5, .5], 0, 1); mkHandle('side', [0, -.5, -.5], 0, -1);
mkHandle('top', [0, .5, 0], 0, 0);
mkHandle('lift', [0, .5, 0], 0, 0);
let hd = null; // активное перетаскивание ручки
function handlesWanted() {
  if (S.mode !== 'select' || S.tool || S.sel.length !== 1) return null;
  const o = byId(S.sel[0]); if (!o || o.locked) return null;
  return meshById.get(o.id) || null;
}
function updateHandles() {
  const m = handlesWanted();
  Handles.group.visible = !!m;
  if (!m) return;
  m.updateMatrixWorld(true);
  const box = worldBox(m), c = new V3().setFromMatrixPosition(m.matrixWorld);
  const q = new THREE.Quaternion(); m.getWorldQuaternion(q);
  for (const h of Handles.list) {
    const u = h.userData;
    if (u.kind === 'lift') {
      const p = new V3(c.x, box.max.y, c.z), k = p.distanceTo(camera.position) * .011;
      p.y += k * 3.4; h.position.copy(p); h.scale.setScalar(k); h.quaternion.identity();
    } else {
      const p = u.lp.clone().applyMatrix4(m.matrixWorld);
      h.position.copy(p); h.quaternion.copy(q);
      h.scale.setScalar(p.distanceTo(camera.position) * (u.kind === 'side' ? .0068 : .0092));
    }
  }
}
function basisOf(m) {
  const ex = new V3(), ey = new V3(), ez = new V3();
  m.matrixWorld.extractBasis(ex, ey, ez);
  return { ex: ex.normalize(), ey: ey.normalize(), ez: ez.normalize() };
}
const snapS = v => S.snapOn && S.snap ? Math.max(S.snap, Math.round(v / S.snap) * S.snap) : Math.max(.1, v);
function closestOnLine(A, d, ray) {
  const w0 = A.clone().sub(ray.origin), b = d.dot(ray.direction), dd = d.dot(w0), e = ray.direction.dot(w0);
  const den = 1 - b * b; if (Math.abs(den) < 1e-6) return null;
  return (b * e - dd) / den;
}
function startHandleDrag(h) {
  const m = handlesWanted(); if (!m) return false;
  m.updateMatrixWorld(true);
  const u = h.userData, B = basisOf(m);
  const s0 = new V3(Math.abs(m.scale.x), Math.abs(m.scale.y), Math.abs(m.scale.z));
  const sign = new V3(Math.sign(m.scale.x), Math.sign(m.scale.y), Math.sign(m.scale.z));
  const anchorLocal = u.kind === 'top' || u.kind === 'lift' ? new V3(0, -.5, 0) : new V3(-u.sx * .5, -.5, -u.sz * .5);
  const A = anchorLocal.applyMatrix4(m.matrixWorld);
  const hp = u.lp.clone().applyMatrix4(m.matrixWorld);
  hd = { kind: u.kind, sx: u.sx, sz: u.sz, m, B, s0, sign, A, hp, plane: new THREE.Plane().setFromNormalAndCoplanarPoint(B.ey, hp), p0: m.position.clone() };
  if (u.kind === 'lift') hd.t0 = closestOnLine(m.position.clone(), new V3(0, 1, 0), ray.ray) || 0;
  orbit.enabled = false;
  return true;
}
function moveHandleDrag(e) {
  const { m, B, s0, sign, A } = hd;
  const lock = S.lock || e.shiftKey;
  let nx = s0.x, ny = s0.y, nz = s0.z;
  if (hd.kind === 'corner' || hd.kind === 'side') {
    const p = new V3(); if (!ray.ray.intersectPlane(hd.plane, p)) return;
    const d = p.sub(A);
    if (hd.sx) nx = snapS(d.dot(B.ex) * hd.sx);
    if (hd.sz) nz = snapS(d.dot(B.ez) * hd.sz);
    if (lock) {
      const f = hd.sx && hd.sz ? Math.max(nx / s0.x, nz / s0.z) : hd.sx ? nx / s0.x : nz / s0.z;
      nx = s0.x * f; ny = s0.y * f; nz = s0.z * f;
    }
    const c = A.clone().addScaledVector(B.ey, ny / 2);
    if (hd.sx) c.addScaledVector(B.ex, hd.sx * nx / 2);
    if (hd.sz) c.addScaledVector(B.ez, hd.sz * nz / 2);
    m.position.copy(c);
  } else if (hd.kind === 'top') {
    const t = closestOnLine(A, B.ey, ray.ray); if (t === null) return;
    ny = snapS(t);
    if (lock) { const f = ny / s0.y; nx = s0.x * f; nz = s0.z * f; }
    m.position.copy(A).addScaledVector(B.ey, ny / 2);
  } else if (hd.kind === 'lift') {
    const t = closestOnLine(hd.p0, new V3(0, 1, 0), ray.ray); if (t === null) return;
    let dy = t - hd.t0; if (S.snapOn) dy = Math.round(dy / S.snap) * S.snap;
    m.position.set(hd.p0.x, hd.p0.y + dy, hd.p0.z);
    return;
  }
  m.scale.set(nx * sign.x, ny * sign.y, nz * sign.z);
}

/* ============================ размеры на модели ============================ */
const dimEls = { w: $('#dim-w'), d: $('#dim-d'), h: $('#dim-h'), e: $('#dim-e') };
function placeDim(el, p, w, h) {
  const v = p.clone().project(camera);
  if (v.z > 1 || Math.abs(v.x) > 1.2 || Math.abs(v.y) > 1.2) { el.hidden = true; return; }
  el.hidden = false;
  el.style.transform = `translate(${((v.x + 1) / 2 * w).toFixed(1)}px, ${((1 - v.y) / 2 * h).toFixed(1)}px) translate(-50%, -50%)`;
}
function updateDims() {
  const m = S.showDims && S.sel.length === 1 && !S.tool ? meshById.get(S.sel[0]) : null;
  if (!m) { for (const k in dimEls) dimEls[k].hidden = true; return; }
  m.updateMatrixWorld(true);
  const B = basisOf(m), c = new V3().setFromMatrixPosition(m.matrixWorld), box = worldBox(m);
  const toCam = camera.position.clone().sub(c);
  const sx = Math.sign(toCam.dot(B.ex)) || 1, sz = Math.sign(toCam.dot(B.ez)) || 1;
  const k = c.distanceTo(camera.position) * .045;
  const L = (x, y, z) => new V3(x, y, z).applyMatrix4(m.matrixWorld);
  const W = vp.clientWidth, H = vp.clientHeight;
  placeDim(dimEls.w, L(0, -.5, sz * .5).addScaledVector(B.ez, sz * k), W, H);
  placeDim(dimEls.d, L(sx * .5, -.5, 0).addScaledVector(B.ex, sx * k), W, H);
  placeDim(dimEls.h, L(sx * .5, .5, sz * .5).addScaledVector(B.ex, sx * k * 1.1).addScaledVector(B.ez, sz * k * 1.1).addScaledVector(B.ey, k * .4), W, H);
  const el = box.min.y;
  if (Math.abs(el) > .05) placeDim(dimEls.e, new V3(c.x, el / 2, c.z).addScaledVector(B.ex, -sx * k), W, H); else dimEls.e.hidden = true;
  const vals = { w: Math.abs(m.scale.x), d: Math.abs(m.scale.z), h: Math.abs(m.scale.y), e: el };
  for (const key in vals) { const inp = dimEls[key].firstElementChild.tagName === 'INPUT' ? dimEls[key].firstElementChild : dimEls[key].querySelector('input'); if (document.activeElement !== inp) inp.value = fmt(vals[key]); }
}
$('#dims').addEventListener('change', e => {
  const inp = e.target; const v = evalExpr(inp.value);
  const o = byId(S.sel[0]); if (!o || !Number.isFinite(v)) { updateDims(); return; }
  const k = inp.dataset.dim;
  if (k === 'e') setElevation(o, v); else setSize(o, { w: 0, h: 1, d: 2 }[k], v);
});
$('#dims').addEventListener('keydown', e => {
  if (e.key === 'Enter') { e.target.blur(); cv.focus(); }
  if (e.key === 'Escape') { e.target.blur(); updateDims(); }
  stepKey(e);
});
function stepKey(e) {
  if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;
  const v = evalExpr(e.target.value); if (!Number.isFinite(v)) return;
  e.preventDefault();
  const st = (e.shiftKey ? 10 : 1) * (e.key === 'ArrowUp' ? 1 : -1);
  e.target.value = fmt(v + st);
  e.target.dispatchEvent(new Event('change', { bubbles: true }));
}

/* ============================ изменение свойств ============================ */
function keepBottom(m, bottom) { const b = worldBox(m).min.y; m.position.y += bottom - b; }
function setSize(o, ax, v) {
  const m = meshById.get(o.id); if (!m) return;
  v = Math.max(.1, v);
  const bottom = worldBox(m).min.y;
  if (S.lock) { const f = v / o.size[ax]; o.size = o.size.map(s => r3(Math.max(.1, s * f))); } else o.size[ax] = r3(v);
  applyT(m, o); keepBottom(m, bottom); syncFromMesh(m);
  commit(); afterTransform();
}
function setElevation(o, v) {
  const m = meshById.get(o.id); if (!m) return;
  m.position.y += v - worldBox(m).min.y; syncFromMesh(m); commit(); afterTransform();
}
function afterTransform() { attachGizmo(); fillPane(); updateStatus(); }
/* применить матрицу к выделенным объектам (поворот, отражение, масштаб вокруг точки) */
function transformSel(Mfn) {
  const objs = selObjs().filter(o => !o.locked); if (!objs.length) return;
  for (const o of objs) {
    const M = Mfn().multiply(C.matrixOf(o));
    const n = C.objFromMatrix(o, M);
    Object.assign(o, { pos: n.pos, rot: n.rot, size: n.size, mir: n.mir });
    applyT(meshById.get(o.id), o);
  }
  commit(); afterTransform();
}
function aroundPoint(p, M) { return new THREE.Matrix4().makeTranslation(p.x, p.y, p.z).multiply(M).multiply(new THREE.Matrix4().makeTranslation(-p.x, -p.y, -p.z)); }
function rotateSel(axis, deg) {
  if (!S.sel.length) return;
  const b = selBox(), c = b.getCenter(new V3()), bottom = b.min.y;
  const ax = new V3(...axis);
  transformSel(() => aroundPoint(c, new THREE.Matrix4().makeRotationAxis(ax, deg * DEG)));
  if (axis[1] === 0) { // после поворота на бок — вернуть на прежний уровень низа
    const nb = selBox().min.y, dy = bottom - nb;
    selMeshes().forEach(m => { m.position.y += dy; syncFromMesh(m); }); current = JSON.stringify(S.objects); autosave(); afterTransform();
  }
}
function mirrorSel(ax) {
  if (!S.sel.length) return;
  const c = selBox().getCenter(new V3()), s = [1, 1, 1]; s[ax] = -1;
  transformSel(() => aroundPoint(c, new THREE.Matrix4().makeScale(...s)));
}
function scaleSel(f) {
  if (!S.sel.length) return;
  const b = selBox(), c = b.getCenter(new V3()); c.y = b.min.y;
  transformSel(() => aroundPoint(c, new THREE.Matrix4().makeScale(f, f, f)));
}
function resetRotation() {
  const objs = selObjs().filter(o => !o.locked); if (!objs.length) return;
  objs.forEach(o => { const m = meshById.get(o.id), bottom = worldBox(m).min.y; o.rot = [0, 0, 0]; applyT(m, o); keepBottom(m, bottom); syncFromMesh(m); });
  commit(); afterTransform();
}

/* ============================ действия ============================ */
const snapV = v => S.snapOn ? Math.round(v / S.snap) * S.snap : r2(v);
function freeSpot(size) {
  const boxes = [...meshById.values()].map(worldBox);
  const step = Math.max(26, Math.max(size[0], size[2]) + 6);
  for (let r = 0; r < 9; r++) for (let i = -r; i <= r; i++) for (let j = -r; j <= r; j++) {
    if (Math.max(Math.abs(i), Math.abs(j)) !== r) continue;
    const x = i * step, z = j * step;
    const hit = boxes.some(b => x + size[0] / 2 > b.min.x - 2 && x - size[0] / 2 < b.max.x + 2 && z + size[2] / 2 > b.min.z - 2 && z - size[2] / 2 < b.max.z + 2);
    if (!hit) return [x, z];
  }
  return [0, 0];
}
function textAspect(o) { const r = C.rawInfo(o); return r.s.x / r.s.z; }
function newObject(key, at) {
  const d = SHAPES[key];
  const o = { id: uid(), type: key, name: d.name, color: d.color, hole: S.asHole, pos: [0, d.size[1] / 2, 0], rot: [0, 0, 0], size: d.size.slice(), mir: [1, 1, 1] };
  if (Object.keys(d.params).length) o.params = JSON.parse(JSON.stringify(d.params));
  if (key === 'text') { o.name = 'Текст'; try { o.size[0] = r2(o.size[2] * textAspect(o)); } catch (e) {} }
  const [x, z] = at ? [snapV(at.x), snapV(at.z)] : freeSpot(o.size);
  o.pos[0] = x; o.pos[2] = z;
  return o;
}
function addShape(key, at) {
  const o = newObject(key, at);
  S.objects.push(o); S.sel = [o.id];
  rebuild(); commit();
  if (key === 'text') setTimeout(() => { const t = $('#p-text'); if (t) { t.focus(); t.select(); } }, 30);
}
function cloneObj(o) { const c = JSON.parse(JSON.stringify(o)); c.id = uid(); return c; }
function dup() {
  const objs = selObjs(); if (!objs.length) return;
  const copies = objs.map(o => { const c = cloneObj(o); c.pos[0] = r3(c.pos[0] + 10); c.pos[2] = r3(c.pos[2] + 10); c.locked = false; return c; });
  S.objects.push(...copies); S.sel = copies.map(c => c.id);
  rebuild(); commit();
}
function del() {
  if (!S.sel.length) return;
  S.objects = S.objects.filter(o => !S.sel.includes(o.id)); S.sel = [];
  rebuild(); commit();
}
function copySel(cut) {
  const objs = selObjs(); if (!objs.length) return;
  S.clipboard = JSON.stringify(objs);
  toast(cut ? 'Вырезано' : 'Скопировано: ' + objs.length);
  if (cut) del();
}
function paste() {
  if (!S.clipboard) { toast('Буфер обмена пуст'); return; }
  const copies = JSON.parse(S.clipboard).map(o => { const c = cloneObj(o); c.pos[0] = r3(c.pos[0] + 10); c.pos[2] = r3(c.pos[2] + 10); return c; });
  S.clipboard = JSON.stringify(copies);
  S.objects.push(...copies); S.sel = copies.map(c => c.id);
  rebuild(); commit();
}
function setHole(v) { const objs = selObjs(); if (!objs.length) return; objs.forEach(o => o.hole = v); rebuild(); commit(); }
function setColor(hex) {
  const objs = selObjs(); if (!objs.length) { S.lastColor = hex; $('#colorBar').style.background = hex; return; }
  objs.forEach(o => { o.color = hex; o.hole = false; if (o.children) o.multi = false; });
  S.lastColor = hex; $('#colorBar').style.background = hex;
  rebuild(); commit();
}
function toggleLock() {
  const objs = selObjs(); if (!objs.length) return;
  const v = !objs.every(o => o.locked); objs.forEach(o => o.locked = v);
  commit(); updateSelection(); toast(v ? 'Закреплено — мышью не сдвинется' : 'Откреплено');
}
function drop() {
  const ms = selMeshes(); if (!ms.length) return;
  ms.forEach(m => { m.position.y -= worldBox(m).min.y; syncFromMesh(m); });
  commit(); afterTransform();
}
function viewAxes() {
  const f = new V3(); camera.getWorldDirection(f); f.y = 0;
  if (f.lengthSq() < 1e-6) f.set(0, 0, -1);
  if (Math.abs(f.x) > Math.abs(f.z)) f.set(Math.sign(f.x), 0, 0); else f.set(0, 0, Math.sign(f.z));
  return { f, r: new V3(-f.z, 0, f.x) };
}
function nudge(v) {
  const ms = selMeshes().filter(m => !byId(m.userData.id).locked); if (!ms.length) return;
  ms.forEach(m => { m.position.add(v); syncFromMesh(m); });
  commit(); afterTransform();
}
function align(ax, mode) {
  const ms = selMeshes(); if (ms.length < 2) { toast('Выделите две фигуры или больше (Shift+клик)'); return; }
  const k = ['x', 'y', 'z'][ax];
  const boxes = ms.map(worldBox), all = new THREE.Box3(); boxes.forEach(b => all.union(b));
  const val = b => mode === 'min' ? b.min[k] : mode === 'max' ? b.max[k] : (b.min[k] + b.max[k]) / 2;
  const target = val(all);
  ms.forEach((m, i) => { if (byId(m.userData.id).locked) return; m.position[k] += target - val(boxes[i]); syncFromMesh(m); });
  commit(); afterTransform();
}
const busy = $('#busy');
function runBusy(fn) { busy.hidden = false; setTimeout(() => { try { fn(); } finally { busy.hidden = true; } }, 30); }
function group(op = 'union') {
  const objs = selObjs(); if (objs.length < 2) { toast('Выделите две фигуры или больше (Shift+клик или рамкой)'); return; }
  runBusy(() => {
    try {
      const g = C.makeGroup(objs, op);
      const at = S.objects.indexOf(objs[0]);
      S.objects = S.objects.filter(o => !S.sel.includes(o.id));
      S.objects.splice(Math.min(at, S.objects.length), 0, g);
      S.sel = [g.id]; rebuild(); commit();
      const holes = objs.filter(o => o.hole).length;
      toast(op === 'intersect' ? 'Осталась общая часть фигур' : holes && !g.hole ? 'Готово — отверстия вырезаны' : 'Фигуры объединены');
    } catch (err) { console.error(err); toast('Не получилось: ' + err.message); }
  });
}
function subtract() {
  const objs = selObjs(); if (objs.length < 2) { toast('Выделите сначала фигуру, из которой вырезать, затем вырезаемые (Shift+клик)'); return; }
  objs.forEach((o, i) => { o.hole = i > 0; });
  group('union');
}
function ungroup() {
  const ids = []; let changed = false;
  S.objects = S.objects.flatMap(o => {
    if (!S.sel.includes(o.id) || !o.children) return [o];
    changed = true; const parts = C.ungroupOne(o); ids.push(...parts.map(p => p.id)); return parts;
  });
  if (!changed) return;
  S.sel = ids; rebuild(); commit();
}
function selectAll() { S.sel = S.objects.map(o => o.id); updateSelection(); }
function deselect() { if (S.tool) setTool(null); S.sel = []; updateSelection(); }

/* ============================ камера ============================ */
let camTween = null;
function flyTo(pos, target) { camTween = { p0: camera.position.clone(), t0: orbit.target.clone(), p1: pos, t1: target, start: performance.now() }; }
function viewFit() {
  const ms = selMeshes().length ? selMeshes() : [...meshById.values()];
  const b = new THREE.Box3();
  if (ms.length) ms.forEach(m => b.union(worldBox(m))); else b.set(new V3(-S.bed.w / 2, 0, -S.bed.d / 2), new V3(S.bed.w / 2, 0, S.bed.d / 2));
  const c = b.getCenter(new V3()), r = Math.max(b.getSize(new V3()).length() / 2, 12);
  const fov = Math.min(camera.fov, camera.fov * camera.aspect) * DEG;
  const dist = r / Math.sin(fov / 2) * 1.08;
  const dir = camera.position.clone().sub(orbit.target).normalize();
  flyTo(c.clone().add(dir.multiplyScalar(dist)), c);
}
function view(kind) {
  const D = Math.max(S.bed.w, S.bed.d) * 1.55;
  if (kind === 'home') flyTo(HOME.pos.clone().multiplyScalar(Math.max(S.bed.w, S.bed.d) / 200), HOME.target.clone());
  if (kind === 'top') flyTo(new V3(0, D * 1.1, .01), new V3(0, 0, 0));
  if (kind === 'front') flyTo(new V3(0, D * .25, D), new V3(0, 20, 0));
  if (kind === 'right') flyTo(new V3(D, D * .25, 0), new V3(0, 20, 0));
  if (kind === 'fit') viewFit();
}
function zoom(f) {
  const d = camera.position.clone().sub(orbit.target);
  flyTo(orbit.target.clone().add(d.multiplyScalar(f)), orbit.target.clone());
}

/* ============================ линейка ============================ */
const rulerLine = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new V3(), new V3()]), new THREE.LineBasicMaterial({ color: 0x2c5aa0, depthTest: false }));
rulerLine.renderOrder = 999; rulerLine.visible = false; scene.add(rulerLine);
const rulerDots = [0, 1].map(() => { const m = new THREE.Mesh(new THREE.SphereGeometry(1, 12, 8), new THREE.MeshBasicMaterial({ color: 0xffffff, depthTest: false })); m.renderOrder = 1000; m.visible = false; scene.add(m); return m; });
const ruler = { a: null, b: null, fixed: false };
function setTool(t) {
  S.tool = t;
  if (t !== 'ruler') { ruler.a = ruler.b = null; ruler.fixed = false; rulerLine.visible = false; rulerDots.forEach(d => d.visible = false); $('#rulerLabel').hidden = true; }
  cv.style.cursor = t === 'ruler' ? 'crosshair' : '';
  if (t === 'ruler') toast('Линейка: щёлкните первую точку, затем вторую. Esc — выход.');
  updateRibbon(); attachGizmo();
}
function surfacePoint(e) {
  setRay(e);
  const h = ray.intersectObjects([...meshById.values()], false)[0];
  if (h) return h.point.clone();
  const p = new V3(); if (!ray.ray.intersectPlane(new THREE.Plane(new V3(0, 1, 0), 0), p)) return null;
  if (S.snapOn) { p.x = snapV(p.x); p.z = snapV(p.z); }
  return p;
}
function rulerUpdate() {
  if (!ruler.a) return;
  const b = ruler.b || ruler.a;
  rulerLine.geometry.setFromPoints([ruler.a, b]); rulerLine.visible = true;
  rulerDots[0].position.copy(ruler.a); rulerDots[0].visible = true;
  rulerDots[1].position.copy(b); rulerDots[1].visible = !!ruler.b;
  rulerDots.forEach(d => d.scale.setScalar(d.position.distanceTo(camera.position) * .005));
  const d = b.clone().sub(ruler.a);
  const lab = $('#rulerLabel');
  lab.textContent = `${fmt(d.length())} мм   ΔX ${fmt(Math.abs(d.x))}  ΔY ${fmt(Math.abs(d.z))}  ΔZ ${fmt(Math.abs(d.y))}`;
  const mid = ruler.a.clone().add(b).multiplyScalar(.5).project(camera);
  lab.style.left = ((mid.x + 1) / 2 * vp.clientWidth) + 'px'; lab.style.top = ((1 - mid.y) / 2 * vp.clientHeight) + 'px';
  lab.hidden = d.length() < 1e-6;
}

/* ============================ указатель ============================ */
const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), dragPlane = new THREE.Plane();
function setRay(e) {
  const r = cv.getBoundingClientRect();
  ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
  ray.setFromCamera(ndc, camera);
}
function pick(e) { setRay(e); return ray.intersectObjects([...meshById.values()], false)[0] || null; }
function pickHandle() {
  if (!Handles.group.visible) return null;
  const h = ray.intersectObjects(Handles.list, false)[0];
  return h ? h.object : null;
}
let down = null, objDrag = null, palDrag = null, marq = null, hoverEvt = null;
const marqEl = $('#marquee');
vp.addEventListener('pointerdown', e => {
  if (e.target !== cv) return;
  hideMenus();
  cv.focus({ preventScroll: true });
  down = { x: e.clientX, y: e.clientY, button: e.button };
  if (e.button !== 0) return;
  setRay(e);
  if (S.tool === 'ruler') {
    const p = surfacePoint(e);
    if (p) { if (!ruler.a || ruler.fixed) { ruler.a = p; ruler.b = null; ruler.fixed = false; } else { ruler.b = p; ruler.fixed = true; } rulerUpdate(); }
    orbit.enabled = false; down.tool = true; return;
  }
  if (tc.object) {
    if (typeof tc.pointerHover === 'function') tc.pointerHover({ x: ndc.x, y: ndc.y, button: 0 });
    if (tc.axis) { down.gizmo = true; return; }
  }
  const hh = pickHandle();
  if (hh && startHandleDrag(hh)) { down.handle = true; return; }
  const h = pick(e);
  if (!h) {
    if (e.pointerType === 'mouse') {
      marq = { x0: e.clientX, y0: e.clientY, add: e.shiftKey || e.ctrlKey || e.metaKey };
      orbit.enabled = false;
    } else down.empty = true;
    return;
  }
  const id = h.object.userData.id;
  if (e.shiftKey || e.ctrlKey || e.metaKey) {
    S.sel = S.sel.includes(id) ? S.sel.filter(x => x !== id) : [...S.sel, id];
    updateSelection(); orbit.enabled = false; down.toggled = true; return;
  }
  if (!S.sel.includes(id)) { S.sel = [id]; updateSelection(); }
  if (selObjs().some(o => o.locked)) { orbit.enabled = false; down.locked = true; return; }
  orbit.enabled = false;
  dragPlane.set(new V3(0, 1, 0), -h.point.y);
  const p = new V3(); ray.ray.intersectPlane(dragPlane, p);
  objDrag = { start: p, items: selMeshes().map(m => ({ m, p: m.position.clone() })), moved: false, alt: e.altKey };
}, { capture: true });

window.addEventListener('pointermove', e => {
  if (hd) { setRay(e); moveHandleDrag(e); fillPane(); updateStatus(); return; }
  if (objDrag) {
    setRay(e);
    const p = new V3(); if (!ray.ray.intersectPlane(dragPlane, p)) return;
    const dx = snapV(p.x - objDrag.start.x), dz = snapV(p.z - objDrag.start.z);
    if ((dx || dz) && !objDrag.moved) {
      objDrag.moved = true;
      if (objDrag.alt) { // Alt+перетаскивание — копия остаётся на месте
        for (const it of objDrag.items) { const o = byId(it.m.userData.id); const c = cloneObj(o); S.objects.push(c); const m = addMesh(c); if (m) { m.userData.line.visible = c.hole; } }
      }
    }
    for (const it of objDrag.items) it.m.position.set(it.p.x + dx, it.p.y, it.p.z + dz);
    fillPane(); updateStatus(); return;
  }
  if (marq) {
    const r = vp.getBoundingClientRect();
    const x = Math.min(marq.x0, e.clientX) - r.left, y = Math.min(marq.y0, e.clientY) - r.top;
    const w = Math.abs(e.clientX - marq.x0), h = Math.abs(e.clientY - marq.y0);
    if (w + h > 4) { marqEl.hidden = false; marqEl.style.cssText = `left:${x}px;top:${y}px;width:${w}px;height:${h}px`; }
    return;
  }
  if (palDrag) { palMove(e); return; }
  if (e.target === cv && e.pointerType === 'mouse') hoverEvt = e;
});
window.addEventListener('pointerup', e => {
  if (hd) {
    syncFromMesh(hd.m); hd = null; orbit.enabled = true;
    commit(); afterTransform(); renderPane(); down = null; return;
  }
  if (objDrag) {
    if (objDrag.moved) { objDrag.items.forEach(it => syncFromMesh(it.m)); commit(); }
    objDrag = null; orbit.enabled = true; afterTransform(); down = null; return;
  }
  if (marq) {
    const moved = Math.hypot(e.clientX - marq.x0, e.clientY - marq.y0) > 4;
    if (moved) {
      const r = cv.getBoundingClientRect();
      const x0 = Math.min(marq.x0, e.clientX) - r.left, x1 = Math.max(marq.x0, e.clientX) - r.left;
      const y0 = Math.min(marq.y0, e.clientY) - r.top, y1 = Math.max(marq.y0, e.clientY) - r.top;
      const hit = [];
      for (const [id, m] of meshById) {
        const c = worldBox(m).getCenter(new V3()).project(camera);
        const sx = (c.x + 1) / 2 * r.width, sy = (1 - c.y) / 2 * r.height;
        if (sx >= x0 && sx <= x1 && sy >= y0 && sy <= y1 && c.z < 1) hit.push(id);
      }
      S.sel = marq.add ? [...new Set([...S.sel, ...hit])] : hit;
      updateSelection();
    } else if (!marq.add && S.sel.length) { S.sel = []; updateSelection(); }
    marq = null; marqEl.hidden = true; orbit.enabled = true; down = null; return;
  }
  if (palDrag) { palUp(e); return; }
  if (down) {
    if (down.toggled || down.tool || down.locked) orbit.enabled = true;
    if (down.empty && Math.hypot(e.clientX - down.x, e.clientY - down.y) < 6 && S.sel.length) { S.sel = []; updateSelection(); }
    if (down.button === 2 && e.target === cv && Math.hypot(e.clientX - down.x, e.clientY - down.y) < 5) openContextMenu(e);
  }
  down = null;
});
window.addEventListener('pointercancel', () => {
  if (objDrag) { objDrag.items.forEach(it => it.m.position.copy(it.p)); objDrag = null; }
  if (hd) { const o = byId(hd.m.userData.id); applyT(hd.m, o); hd = null; }
  marq = null; marqEl.hidden = true; palEnd(); orbit.enabled = true; down = null;
});
function hoverCheck() {
  if (!hoverEvt || hd || objDrag || marq || palDrag) return;
  const e = hoverEvt; hoverEvt = null;
  if (S.tool === 'ruler') { if (ruler.a && !ruler.fixed) { const p = surfacePoint(e); if (p) { ruler.b = p; } } return; }
  setRay(e);
  const h = pickHandle();
  if (h) { const k = h.userData.kind; cv.style.cursor = k === 'top' || k === 'lift' ? 'ns-resize' : k === 'side' ? (h.userData.sx ? 'ew-resize' : 'ns-resize') : 'nwse-resize'; return; }
  const p = ray.intersectObjects([...meshById.values()], false)[0];
  cv.style.cursor = p ? (byId(p.object.userData.id) && byId(p.object.userData.id).locked ? 'not-allowed' : 'move') : '';
}

/* ============================ палитра фигур ============================ */
const thumbs = {};
const SOFT = { rbox: 'Скруглён\u00adный куб', prism: 'Много\u00adгранник', roundroof: 'Полу\u00adцилиндр', paraboloid: 'Пара\u00adболоид', hemisphere: 'Полу\u00adсфера' };
function buildLibrary() {
  const lib = $('#libGrid'), gal = $('#gallery');
  for (const key in SHAPES) {
    const d = SHAPES[key];
    const mk = (cls) => {
      const b = document.createElement('button');
      b.className = cls; b.type = 'button'; b.dataset.key = key; b.title = d.name + ' — нажмите или перетащите';
      b.innerHTML = `<span class="ph"></span><span>${cls === 'ltile' ? (SOFT[key] || d.name) : d.name}</span>`;
      b.addEventListener('pointerdown', e => {
        if (e.button !== 0) return;
        if (e.pointerType === 'mouse') e.preventDefault();
        palDrag = { key, x: e.clientX, y: e.clientY, moved: false };
      });
      b.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); addShape(key); } });
      return b;
    };
    lib.appendChild(mk('ltile')); gal.appendChild(mk('gtile'));
  }
}
function palMove(e) {
  if (!palDrag.moved && Math.hypot(e.clientX - palDrag.x, e.clientY - palDrag.y) > 6) {
    palDrag.moved = true;
    const o = newObject(palDrag.key, { x: 0, z: 0 });
    try {
      palDrag.preview = new THREE.Mesh(C.geomFor(o), S.asHole ? holeMat() : new THREE.MeshStandardMaterial({ color: o.color, transparent: true, opacity: .6, flatShading: true }));
      palDrag.preview.scale.fromArray(o.size); palDrag.preview.visible = false; palDrag.size = o.size; scene.add(palDrag.preview);
    } catch (err) { palDrag.preview = null; }
  }
  if (palDrag.moved && palDrag.preview) {
    const over = document.elementFromPoint(e.clientX, e.clientY) === cv;
    palDrag.preview.visible = false; palDrag.at = null;
    if (over) {
      setRay(e); const p = new V3();
      if (ray.ray.intersectPlane(new THREE.Plane(new V3(0, 1, 0), 0), p)) {
        palDrag.preview.position.set(snapV(p.x), palDrag.size[1] / 2, snapV(p.z)); palDrag.preview.visible = true; palDrag.at = p;
      }
    }
  }
}
function palEnd() { if (palDrag && palDrag.preview) { scene.remove(palDrag.preview); palDrag.preview.material.dispose(); } palDrag = null; }
function palUp() { const { key, moved, at } = palDrag; palEnd(); if (!moved) addShape(key); else if (at) addShape(key, at); }

function makeThumbs() {
  let r;
  try { r = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true }); } catch (e) { return; }
  r.setPixelRatio(1); r.setSize(112, 112);
  const sc = new THREE.Scene();
  sc.add(new THREE.HemisphereLight(0xffffff, 0x8a96a6, .8));
  const l = new THREE.DirectionalLight(0xffffff, .7); l.position.set(3, 5, 4); sc.add(l);
  const cam = new THREE.PerspectiveCamera(30, 1, .1, 50); cam.position.set(2.2, 1.9, 2.8); cam.lookAt(0, 0, 0);
  for (const key in SHAPES) {
    const d = SHAPES[key];
    const o = { type: key, params: key === 'text' ? Object.assign({}, d.params, { text: 'Аа' }) : d.params };
    let g; try { g = C.rawInfo(o).g; } catch (e) { continue; }
    let size = d.size; if (key === 'text') { const s = C.rawInfo(o).s; size = [s.x / s.z * 10, 3, 10]; }
    const mx = Math.max(...size);
    const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ color: d.color, flatShading: true, roughness: .55 }));
    m.scale.set(size[0] / mx, size[1] / mx, size[2] / mx);
    sc.add(m); r.render(sc, cam);
    thumbs[key] = r.domElement.toDataURL();
    sc.remove(m); m.material.dispose();
  }
  r.dispose(); if (r.forceContextLoss) r.forceContextLoss();
  $$('[data-key]').forEach(el => {
    const ph = el.querySelector('.ph'); if (!ph || !thumbs[el.dataset.key]) return;
    const img = new Image(); img.alt = ''; img.draggable = false; img.src = thumbs[el.dataset.key]; ph.replaceWith(img);
  });
}

/* ============================ панель «Формат» ============================ */
const paneBody = $('#paneBody');
const numIn = (id, lab, unit = '') => `<label class="num"><span>${lab}</span><input id="${id}" inputmode="decimal" autocomplete="off">${unit ? `<em>${unit}</em>` : ''}</label>`;
const sec = (title, body, open = true) => `<details class="psec" ${open ? 'open' : ''}><summary>${title}</summary><div class="pbody">${body}</div></details>`;
function swatchesHTML(cur) {
  return `<div class="swatches">${PALETTE.map(c => `<button class="sw${cur && cur.toLowerCase() === c ? ' on' : ''}" style="background:${c}" data-act="color" data-color="${c}" title="${c}" aria-label="Цвет ${c}"></button>`).join('')}</div>
  <label class="sw-more">Другой цвет <input type="color" id="p-color" value="${cur || '#888888'}"></label>`;
}
function typeSeg(objs) {
  const allHole = objs.every(o => o.hole), noHole = objs.every(o => !o.hole);
  return `<div class="seg"><button data-act="solid" class="${noHole ? 'on' : ''}"><i class="i-solid"></i>Тело</button><button data-act="hole" class="${allHole ? 'on' : ''}"><i class="i-hole"></i>Отверстие</button></div>`;
}
let paneMode = '';
function renderPane() {
  const objs = selObjs();
  const title = $('#paneTitle');
  if (!objs.length) { paneMode = 'scene'; title.textContent = 'Проект'; paneBody.innerHTML = sceneHTML(); updateSceneFacts(); return; }
  if (objs.length > 1) {
    paneMode = 'multi'; title.textContent = 'Формат фигур';
    const row = (lab, ax, a, b) => `<span>${lab}</span><button data-act="align" data-ax="${ax}" data-m="${a[0]}">${a[1]}</button><button data-act="align" data-ax="${ax}" data-m="mid">центр</button><button data-act="align" data-ax="${ax}" data-m="${b[0]}">${b[1]}</button>`;
    paneBody.innerHTML = `
      <div class="phead"><b>Выбрано фигур: ${objs.length}</b><span class="kind">${objs.filter(o => o.hole).length} отв.</span></div>
      ${sec('Объединение', `<div class="prow"><button class="pbtn primary" data-act="group">Сгруппировать</button><button class="pbtn" data-act="subtract">Вычесть</button><button class="pbtn" data-act="intersect">Пересечь</button></div>
        <p class="plabel" style="margin:0">«Сгруппировать» объединит тела и вырежет отверстия. «Вычесть» вырежет из первой выбранной фигуры все остальные.</p>`)}
      ${sec('Тип', typeSeg(objs))}
      ${sec('Цвет', swatchesHTML(null))}
      ${sec('Выравнивание', `<div class="al-grid">${row('Ш', 0, ['min', 'слева'], ['max', 'справа'])}${row('Г', 2, ['max', 'спереди'], ['min', 'сзади'])}${row('В', 1, ['min', 'снизу'], ['max', 'сверху'])}</div>`)}
      ${sec('Размер выделения', `<dl class="facts" id="multiFacts"></dl>
        <div class="prow"><button class="pbtn icon" data-act="scale" data-f="0.9" title="Меньше на 10%">${iconSVG('zoom-out')}</button><button class="pbtn icon" data-act="scale" data-f="1.1" title="Больше на 10%">${iconSVG('zoom-in')}</button><button class="pbtn" data-act="scale" data-f="0.5">½</button><button class="pbtn" data-act="scale" data-f="2">×2</button></div>`)}
      ${sec('Действия', `<div class="prow"><button class="pbtn" data-act="dup">Дублировать</button><button class="pbtn" data-act="array">Массив…</button><button class="pbtn danger" data-act="del">Удалить</button></div>`)}`;
    fillPane(); return;
  }
  const o = objs[0];
  paneMode = 'single'; title.textContent = 'Формат фигуры';
  let params = '';
  if (o.type === 'text') {
    const p = Object.assign({}, SHAPES.text.params, o.params);
    params = sec('Текст', `
      <textarea id="p-text" class="ptext" rows="2" spellcheck="false" aria-label="Текст">${esc(p.text)}</textarea>
      <select id="p-font" class="pselect" aria-label="Шрифт">${C.FONTS.map(f => `<option value="${f.id}" ${f.id === p.font ? 'selected' : ''}>${f.name}</option>`).join('')}</select>
      <div class="prow"><button class="pbtn ${p.bold ? 'on' : ''}" data-act="tp" data-k="bold" title="Полужирный"><b>Ж</b></button><button class="pbtn ${p.italic ? 'on' : ''}" data-act="tp" data-k="italic" title="Курсив"><i>К</i></button>
      <span style="flex:1"></span>
      <div class="seg three" style="width:132px"><button data-act="ta" data-v="left" class="${p.align === 'left' ? 'on' : ''}" title="По левому краю">⟸</button><button data-act="ta" data-v="center" class="${p.align === 'center' ? 'on' : ''}" title="По центру">≡</button><button data-act="ta" data-v="right" class="${p.align === 'right' ? 'on' : ''}" title="По правому краю">⟹</button></div></div>
      <p class="plabel" style="margin:0">Enter — новая строка. Чтобы вырезать надпись, сделайте её отверстием и сгруппируйте с фигурой.</p>`);
  } else if (SHAPES[o.type] && Object.keys(SHAPES[o.type].params).length) {
    const p = Object.assign({}, SHAPES[o.type].params, o.params);
    params = sec('Параметры фигуры', Object.keys(p).map(k => {
      const ui = C.PARAM_UI[k]; if (!ui) return '';
      const lim = (C.PARAM_LIMITS[o.type] || {})[k] || [ui.min, ui.max];
      const label = (C.PARAM_LABEL_OVERRIDE[o.type] || {})[k] || ui.label;
      const v = ui.invert ? 1 - p[k] + ui.min : p[k];
      return `<div class="slider"><label for="pr-${k}">${label}</label><input type="range" id="pr-${k}" data-param="${k}" min="${lim[0]}" max="${lim[1]}" step="${ui.step}" value="${v}"><label class="num"><input data-param-num="${k}" value="${ui.pct ? Math.round(v * 100) : v}" inputmode="decimal"><em>${ui.pct ? '%' : ''}</em></label></div>`;
    }).join(''));
  }
  const groupSec = o.children ? sec('Группа', `<p class="plabel" style="margin:0">${o.op === 'intersect' ? 'Пересечение' : 'Объединение'} из ${o.children.length} фигур.</p>
      ${!o.hole ? `<label class="chk"><input type="checkbox" id="p-multi" ${o.multi ? 'checked' : ''}> Сохранить цвета частей</label>` : ''}
      <div class="prow"><button class="pbtn" data-act="ungroup">Разгруппировать</button></div>`) : '';
  paneBody.innerHTML = `
    <div class="phead"><input id="p-name" value="${esc(o.name)}" maxlength="80" aria-label="Название"><span class="kind">${KIND[o.type] || ''}${o.locked ? ' · закреплено' : ''}</span></div>
    ${sec('Тип', typeSeg([o]))}
    ${o.hole ? '' : sec('Цвет', swatchesHTML(o.children && o.multi ? null : o.color))}
    ${params}${groupSec}
    ${sec('Размер', `<div class="trio">${numIn('p-sx', 'Ш')}${numIn('p-sz', 'Г')}${numIn('p-sy', 'В')}</div>
      <div class="prow"><label class="chk"><input type="checkbox" id="p-lock" ${S.lock ? 'checked' : ''}> Сохранять пропорции</label></div>
      <div class="prow"><button class="pbtn icon" data-act="scale" data-f="0.9" title="Меньше на 10%">${iconSVG('zoom-out')}</button>${numIn('p-pct', 'Масштаб', '%')}<button class="pbtn icon" data-act="scale" data-f="1.1" title="Больше на 10%">${iconSVG('zoom-in')}</button></div>`)}
    ${sec('Положение', `<div class="trio">${numIn('p-px', 'X')}${numIn('p-pz', 'Y')}${numIn('p-pe', 'Z')}</div><p class="plabel" style="margin:0">Z — высота над плоскостью. Можно вводить выражения: 20+5, 40/3.</p>`)}
    ${sec('Поворот', `<div class="trio">${numIn('p-rx', 'X', '°')}${numIn('p-rz', 'Y', '°')}${numIn('p-ry', 'Z', '°')}</div>
      <div class="prow"><button class="pbtn" data-act="rot" data-ax="y" data-d="90" title="Влево на 90°">↺ 90°</button><button class="pbtn" data-act="rot" data-ax="y" data-d="-90" title="Вправо на 90°">↻ 90°</button><button class="pbtn" data-act="rot" data-ax="x" data-d="90">На бок</button><button class="pbtn" data-act="rotreset">Сброс</button></div>`, false)}
    ${sec('Отражение', `<div class="prow"><button class="pbtn" data-act="mir" data-ax="0">↔ Слева направо</button><button class="pbtn" data-act="mir" data-ax="2">Спереди назад</button><button class="pbtn" data-act="mir" data-ax="1">↕ Сверху вниз</button></div>`, false)}
    ${sec('Действия', `<div class="prow"><button class="pbtn" data-act="drop">На плоскость</button><button class="pbtn" data-act="dup">Дублировать</button><button class="pbtn" data-act="array">Массив…</button><button class="pbtn" data-act="lock">${o.locked ? 'Открепить' : 'Закрепить'}</button><button class="pbtn danger" data-act="del">Удалить</button></div>`)}`;
  fillPane();
}
function fillPane() {
  if (paneMode === 'multi') {
    const el = $('#multiFacts'); if (!el) return;
    const s = selBox().getSize(new V3());
    el.innerHTML = `<dt>Ширина</dt><dd>${fmt(s.x)} мм</dd><dt>Глубина</dt><dd>${fmt(s.z)} мм</dd><dt>Высота</dt><dd>${fmt(s.y)} мм</dd>`;
    return;
  }
  if (paneMode !== 'single') return;
  const m = meshById.get(S.sel[0]); if (!m) return;
  const b = worldBox(m), a = document.activeElement;
  const vals = {
    'p-sx': Math.abs(m.scale.x), 'p-sy': Math.abs(m.scale.y), 'p-sz': Math.abs(m.scale.z),
    'p-px': m.position.x, 'p-pz': -m.position.z, 'p-pe': b.min.y,
    'p-rx': m.rotation.x / DEG, 'p-ry': m.rotation.y / DEG, 'p-rz': -m.rotation.z / DEG, 'p-pct': 100,
  };
  for (const id in vals) { const el = document.getElementById(id); if (el && el !== a) el.value = fmt(Math.abs(vals[id]) < 1e-6 ? 0 : vals[id]); }
}
function sceneHTML() {
  const tips = `<ol class="tips">
    <li><b>Добавьте фигуру</b> — перетащите её из панели слева или со вкладки «Вставка».</li>
    <li><b>Тяните белые квадраты</b> по углам, чтобы растянуть; верхний — меняет высоту, стрелка — поднимает.</li>
    <li><b>Щёлкните по числу</b> рядом с фигурой и введите точный размер в миллиметрах.</li>
    <li><b>Вырезайте</b>: сделайте фигуру отверстием, выделите обе (Shift+клик) и нажмите «Сгруппировать».</li>
    <li><b>Правая кнопка мыши</b> — вращать вид, колесо — приблизить, средняя кнопка — сдвинуть.</li>
  </ol>`;
  return `${sec('Модель', `<dl class="facts" id="sceneFacts"><dt>Фигур</dt><dd>…</dd></dl><div id="bedFit"></div>`)}
    ${sec('С чего начать', tips)}
    ${sec('Быстро добавить', `<div class="prow"><button class="pbtn" data-act="add" data-k="box">Куб</button><button class="pbtn" data-act="add" data-k="cylinder">Цилиндр</button><button class="pbtn" data-act="add" data-k="text">Текст</button><button class="pbtn" data-act="add" data-k="heart">Сердце</button></div>`)}`;
}
let statsT = 0, stats = null;
function scheduleStats() { clearTimeout(statsT); statsT = setTimeout(computeStats, 250); }
function computeStats() {
  const solids = S.objects.filter(o => !o.hole);
  const b = new THREE.Box3();
  solids.forEach(o => { const m = meshById.get(o.id); if (m) b.union(worldBox(m)); });
  let vol = 0; try { vol = C.volumeOf(solids); } catch (e) {}
  const size = solids.length ? b.getSize(new V3()) : new V3();
  const fits = !solids.length || (b.min.x >= -S.bed.w / 2 - .01 && b.max.x <= S.bed.w / 2 + .01 && b.min.z >= -S.bed.d / 2 - .01 && b.max.z <= S.bed.d / 2 + .01 && b.min.y >= -.05);
  const floating = solids.length && b.min.y > .05;
  stats = { count: S.objects.length, solids: solids.length, size, vol, fits, floating, loose: S.objects.length - solids.length };
  updateSceneFacts(); updateStatus();
}
function updateSceneFacts() {
  const el = $('#sceneFacts'); if (!el || !stats) return;
  const g = stats.vol / 1000 * S.density;
  el.innerHTML = `<dt>Фигур</dt><dd>${stats.count}</dd><dt>Габариты</dt><dd>${fmt(stats.size.x)} × ${fmt(stats.size.z)} × ${fmt(stats.size.y)} мм</dd>
    <dt>Объём</dt><dd>≈ ${fmt(stats.vol / 1000)} см³</dd><dt>Масса (100% заполнение)</dt><dd>≈ ${fmt(g)} г</dd><dt>Стол</dt><dd>${S.bed.w} × ${S.bed.d} мм</dd>`;
  $('#bedFit').innerHTML = stats.solids ? (stats.fits ? '<span class="badge ok">✓ Помещается на стол</span>' : '<span class="badge bad">✗ Выходит за стол принтера</span>') : '';
}
function updateStatus() {
  const objs = selObjs();
  let t;
  if (S.tool === 'ruler') t = 'Линейка: щёлкните две точки. Esc — выход';
  else if (!objs.length) t = S.objects.length ? `Фигур: ${S.objects.length} · ЛКМ — выбрать, рамка — выбрать несколько, ПКМ — вращать вид` : 'Пустой проект — добавьте фигуру из панели слева';
  else if (objs.length === 1) { const m = meshById.get(objs[0].id); t = m ? `${objs[0].name}: ${fmt(Math.abs(m.scale.x))} × ${fmt(Math.abs(m.scale.z))} × ${fmt(Math.abs(m.scale.y))} мм${objs[0].hole ? ' · отверстие' : ''}${objs[0].locked ? ' · закреплено' : ''}` : ''; }
  else t = `Выбрано: ${objs.length} · Ctrl+G — сгруппировать (отверстия вырежутся)`;
  $('#stLeft').textContent = t;
  if (stats) {
    $('#stModel').textContent = stats.solids ? `Модель ${fmt(stats.size.x)} × ${fmt(stats.size.z)} × ${fmt(stats.size.y)} мм · ≈ ${fmt(stats.vol / 1000 * S.density)} г` : '';
    const w = $('#stWarn');
    const msg = !stats.fits ? '⚠ Модель выходит за стол' : stats.floating ? '⚠ Модель висит над столом' : '';
    w.hidden = !msg; w.textContent = msg;
  }
  $('#stSnap').textContent = S.snapOn ? `Сетка ${fmt(S.snap)} мм` : 'Без привязки';
}
let textT = 0;
function setParam(o, k, v, immediate) {
  o.params = Object.assign({}, SHAPES[o.type] ? SHAPES[o.type].params : {}, o.params, { [k]: v });
  const apply = () => {
    const m = meshById.get(o.id), bottom = m ? worldBox(m).min.y : 0;
    try {
      if (o.type === 'text') o.size[0] = r2(o.size[2] * textAspect(o));
      if (o.type === 'torus') { const s = C.rawInfo(o).s; o.size[1] = r2(o.size[0] * s.y / s.x); }
    } catch (err) { toast(err.message); return; }
    rebuild(); const m2 = meshById.get(o.id); if (m2) { keepBottom(m2, bottom); syncFromMesh(m2); }
    commit(); fillPane();
  };
  clearTimeout(textT);
  if (immediate) apply(); else textT = setTimeout(apply, 260);
}
paneBody.addEventListener('input', e => {
  const t = e.target, o = byId(S.sel[0]); if (!o || S.sel.length !== 1) return;
  if (t.id === 'p-text') { if (t.value.trim()) setParam(o, 'text', t.value.slice(0, 200)); return; }
  if (t.dataset.param) {
    const k = t.dataset.param, ui = C.PARAM_UI[k]; let v = parseFloat(t.value);
    const num = paneBody.querySelector(`[data-param-num="${k}"]`); if (num) num.value = ui.pct ? Math.round(v * 100) : v;
    if (ui.invert) v = 1 - v + ui.min;
    setParam(o, k, ui.int ? Math.round(v) : v);
  }
});
paneBody.addEventListener('change', e => {
  const t = e.target, objs = selObjs();
  if (t.id === 'p-color') { setColor(t.value); return; }
  if (t.id === 'p-lock') { S.lock = t.checked; updateRibbon(); return; }
  const o = objs[0]; if (!o || objs.length !== 1) return;
  if (t.id === 'p-name') { o.name = t.value.trim() || KIND[o.type] || 'Фигура'; commit(); updateStatus(); return; }
  if (t.id === 'p-multi') { o.multi = t.checked; rebuild(); commit(); return; }
  if (t.id === 'p-font') { setParam(o, 'font', t.value, true); return; }
  if (t.dataset.paramNum) {
    const k = t.dataset.paramNum, ui = C.PARAM_UI[k]; let v = evalExpr(t.value); if (!Number.isFinite(v)) { renderPane(); return; }
    if (ui.pct) v /= 100;
    const lim = (C.PARAM_LIMITS[o.type] || {})[k] || [ui.min, ui.max];
    v = clamp(v, lim[0], lim[1]); if (ui.invert) v = 1 - v + ui.min;
    setParam(o, k, ui.int ? Math.round(v) : v, true); renderPane(); return;
  }
  const v = evalExpr(t.value);
  if (!Number.isFinite(v)) { fillPane(); return; }
  const m = meshById.get(o.id);
  switch (t.id) {
    case 'p-sx': setSize(o, 0, v); return;
    case 'p-sy': setSize(o, 1, v); return;
    case 'p-sz': setSize(o, 2, v); return;
    case 'p-pct': if (v > 0) scaleSel(v / 100); return;
    case 'p-pe': setElevation(o, v); return;
    case 'p-px': o.pos[0] = r3(v); break;
    case 'p-pz': o.pos[2] = r3(-v); break;
    case 'p-rx': case 'p-ry': case 'p-rz': {
      const bottom = worldBox(m).min.y;
      if (t.id === 'p-rx') o.rot[0] = v; else if (t.id === 'p-ry') o.rot[1] = v; else o.rot[2] = -v;
      applyT(m, o); keepBottom(m, bottom); syncFromMesh(m); commit(); afterTransform(); return;
    }
    default: return;
  }
  applyT(m, o); commit(); afterTransform();
});
paneBody.addEventListener('keydown', e => {
  if (e.key === 'Enter' && e.target.matches('input')) { e.target.blur(); }
  if (e.target.matches('input:not([type=range]):not([type=checkbox]):not([type=color])')) stepKey(e);
});
paneBody.addEventListener('click', e => {
  const b = e.target.closest('[data-act]'); if (!b) return;
  const a = b.dataset.act, o = byId(S.sel[0]);
  const act = {
    solid: () => setHole(false), hole: () => setHole(true), color: () => setColor(b.dataset.color),
    drop, dup, del, group: () => group('union'), subtract, intersect: () => group('intersect'), ungroup,
    align: () => align(+b.dataset.ax, b.dataset.m), scale: () => scaleSel(parseFloat(b.dataset.f)),
    rot: () => rotateSel(b.dataset.ax === 'x' ? [1, 0, 0] : [0, 1, 0], +b.dataset.d), rotreset: resetRotation,
    mir: () => mirrorSel(+b.dataset.ax), array: openArray, lock: toggleLock, add: () => addShape(b.dataset.k),
    tp: () => { if (o) setParam(o, b.dataset.k, !(Object.assign({}, SHAPES.text.params, o.params)[b.dataset.k]), true); renderPane(); },
    ta: () => { if (o) setParam(o, 'align', b.dataset.v, true); renderPane(); },
  }[a];
  if (act) act();
});

/* ============================ лента ============================ */
function setTab(name) {
  $$('.tab[data-tab]').forEach(t => t.classList.toggle('on', t.dataset.tab === name));
  $$('.rpanel').forEach(p => p.classList.toggle('on', p.dataset.panel === name));
  $('#ribbon').classList.remove('collapsed'); updateRibbonToggle();
}
$$('.tab[data-tab]').forEach(t => t.addEventListener('click', () => setTab(t.dataset.tab)));
$$('.tab[data-tab]').forEach(t => t.addEventListener('dblclick', () => { $('#ribbon').classList.toggle('collapsed'); updateRibbonToggle(); }));
function updateRibbonToggle() {
  const col = $('#ribbon').classList.contains('collapsed'), b = $('[data-cmd="toggle-ribbon"]');
  b.innerHTML = iconSVG(col ? 'chevron-down' : 'chevron-up'); b.title = col ? 'Развернуть ленту (Ctrl+F1)' : 'Свернуть ленту (Ctrl+F1)';
}
function setMode(m) { S.mode = m; if (m === 'rotate' && S.tool) setTool(null); attachGizmo(); updateRibbon(); }
const CMDS = {
  backstage: () => openBackstage('new'), 'backstage-close': closeBackstage,
  new: () => openBackstage('new'), open: openProjectDialog, save: () => saveProject(false), 'save-as': () => saveProject(true),
  export: () => openBackstage('export'), import: importSTL, help: () => openBackstage('help'),
  undo, redo, cut: () => copySel(true), copy: () => copySel(false), paste, dup, del,
  solid: () => setHole(false), hole: () => setHole(true), group: () => group('union'), subtract, intersect: () => group('intersect'), ungroup,
  'color-menu': openColorMenu, 'select-all': selectAll, deselect, lock: toggleLock,
  'as-hole': () => setAsHole(!S.asHole), 'add-text': () => addShape('text'),
  drop, 'rotate-mode': () => setMode(S.mode === 'rotate' ? 'select' : 'rotate'),
  'rot-left': () => rotateSel([0, 1, 0], 90), 'rot-right': () => rotateSel([0, 1, 0], -90),
  'rot-side': () => rotateSel([1, 0, 0], 90), 'rot-back': () => rotateSel([0, 0, 1], 90), 'rot-reset': resetRotation,
  array: openArray, ruler: () => setTool(S.tool === 'ruler' ? null : 'ruler'), ratio: () => { S.lock = !S.lock; updateRibbon(); renderPane(); },
  'scale-up': () => scaleSel(1.1), 'scale-down': () => scaleSel(1 / 1.1), 'scale-x2': () => scaleSel(2),
  'v-fit': () => view('fit'), 'v-home': () => view('home'), 'v-top': () => view('top'), 'v-front': () => view('front'), 'v-right': () => view('right'),
  'zoom-in': () => zoom(.75), 'zoom-out': () => zoom(1.33),
  'toggle-ribbon': () => { $('#ribbon').classList.toggle('collapsed'); updateRibbonToggle(); },
  'close-pane': () => { $('#showPane').checked = false; showPane(false); },
};
for (const ax of [0, 1, 2]) for (const m of ['min', 'mid', 'max']) CMDS[`al-${ax}-${m}`] = () => align(ax, m);
for (const ax of [0, 1, 2]) CMDS['mir-' + ax] = () => mirrorSel(ax);
document.addEventListener('click', e => {
  const b = e.target.closest('[data-cmd]');
  if (b && !b.disabled && CMDS[b.dataset.cmd]) { if (!b.closest('.ctxmenu')) hideMenus(); CMDS[b.dataset.cmd](b); }
});
function updateRibbon() {
  const n = S.sel.length, objs = selObjs();
  const dis = {
    undo: !past.length, redo: !future.length, cut: !n, copy: !n, dup: !n, del: !n, paste: !S.clipboard,
    solid: !n, hole: !n, group: n < 2, subtract: n < 2, intersect: n < 2, ungroup: !objs.some(o => o.children),
    lock: !n, drop: !n, 'rot-left': !n, 'rot-right': !n, 'rot-side': !n, 'rot-back': !n, 'rot-reset': !n,
    'mir-0': !n, 'mir-1': !n, 'mir-2': !n, array: !n, 'scale-up': !n, 'scale-down': !n, 'scale-x2': !n, deselect: !n,
  };
  for (const ax of [0, 1, 2]) for (const m of ['min', 'mid', 'max']) dis[`al-${ax}-${m}`] = n < 2;
  for (const k in dis) $$(`[data-cmd="${k}"]`).forEach(b => { if (!b.closest('.ctxmenu')) b.disabled = dis[k]; });
  const on = { 'rotate-mode': S.mode === 'rotate', ruler: S.tool === 'ruler', ratio: S.lock, 'as-hole': S.asHole, lock: n && objs.every(o => o.locked) };
  for (const k in on) $$(`[data-cmd="${k}"]`).forEach(b => b.classList.toggle('on', !!on[k]));
  const c = objs.length && !objs[0].hole ? objs[0].color : (S.lastColor || '#d9483b');
  $('#colorBar').style.background = c;
}
function setAsHole(v) { S.asHole = v; $('#libHole').checked = v; $('#library').classList.toggle('is-hole', v); updateRibbon(); }
$('#libHole').addEventListener('change', e => setAsHole(e.target.checked));
$('#snap').addEventListener('change', e => { S.snap = parseFloat(e.target.value); store.set('snap', S.snap); updateStatus(); });
$('#snapOn').addEventListener('change', e => { S.snapOn = e.target.checked; store.set('snapOn', S.snapOn); updateStatus(); });
$('#rotSnap').addEventListener('change', e => { S.rotSnap = parseFloat(e.target.value); store.set('rotSnap', S.rotSnap); attachGizmo(); });
$('#bed').innerHTML = BEDS.map(b => `<option value="${b.id}">${b.name}</option>`).join('');
$('#bed').addEventListener('change', e => { setBed(e.target.value); setDirty(true); autosave(); });
function setBed(id) { S.bed = BEDS.find(b => b.id === id) || BEDS[0]; $('#bed').value = S.bed.id; store.set('bed', S.bed.id); buildWorkplane(); scheduleStats(); }
$('#density').addEventListener('change', e => { S.density = parseFloat(e.target.value); store.set('density', S.density); updateSceneFacts(); updateStatus(); });
$('#showGrid').addEventListener('change', e => { S.showGrid = e.target.checked; store.set('showGrid', S.showGrid); buildWorkplane(); });
$('#showDims').addEventListener('change', e => { S.showDims = e.target.checked; store.set('showDims', S.showDims); });
$('#showLib').addEventListener('change', e => { $('#library').hidden = !e.target.checked; store.set('showLib', e.target.checked); });
$('#showPane').addEventListener('change', e => showPane(e.target.checked));
function showPane(v) { $('#pane').hidden = !v; store.set('showPane', v); }
$('#theme').addEventListener('change', e => setTheme(e.target.value));

/* цвет — всплывающая палитра */
const pop = $('#popover');
function openColorMenu(btn) {
  const r = (btn && btn.getBoundingClientRect) ? btn.getBoundingClientRect() : { left: 200, bottom: 160 };
  pop.innerHTML = `<h4>Цвета заливки</h4>${swatchesHTML(selObjs()[0] && selObjs()[0].color)}`;
  pop.hidden = false;
  pop.style.left = Math.min(r.left, window.innerWidth - 270) + 'px'; pop.style.top = (r.bottom + 4) + 'px';
}
pop.addEventListener('click', e => { const b = e.target.closest('[data-act="color"]'); if (b) { setColor(b.dataset.color); hideMenus(); } });
pop.addEventListener('change', e => { if (e.target.id === 'p-color') { setColor(e.target.value); hideMenus(); } });

/* контекстное меню */
const ctx = $('#ctxmenu');
function openContextMenu(e) {
  const h = pick(e);
  if (h) { const id = h.object.userData.id; if (!S.sel.includes(id)) { S.sel = [id]; updateSelection(); } }
  const n = S.sel.length, objs = selObjs();
  const it = (cmd, icon, label, kbd = '', dis = false) => `<button data-cmd="${cmd}" ${dis ? 'disabled' : ''}>${iconSVG(icon)}<span>${label}</span>${kbd ? `<kbd>${kbd}</kbd>` : ''}</button>`;
  ctx.innerHTML = n ? [
    it('cut', 'cut', 'Вырезать', 'Ctrl+X'), it('copy', 'copy', 'Копировать', 'Ctrl+C'), it('paste', 'paste', 'Вставить', 'Ctrl+V', !S.clipboard), it('dup', 'dup', 'Дублировать', 'Ctrl+D'), '<hr>',
    objs.every(o => o.hole) ? it('solid', 'solid', 'Сделать телом', 'S') : it('hole', 'hole', 'Сделать отверстием', 'H'),
    n > 1 ? it('group', 'group', 'Сгруппировать', 'Ctrl+G') : '', n > 1 ? it('subtract', 'subtract', 'Вычесть из первой') : '',
    objs.some(o => o.children) ? it('ungroup', 'ungroup', 'Разгруппировать', 'Ctrl+Shift+G') : '', '<hr>',
    it('drop', 'drop', 'Опустить на плоскость', 'D'), it('rot-left', 'rot-left', 'Повернуть на 90°'), it('mir-0', 'mir-x', 'Отразить'),
    it('lock', 'lock', objs.every(o => o.locked) ? 'Открепить' : 'Закрепить', 'Ctrl+L'), '<hr>',
    it('del', 'trash', 'Удалить', 'Del'),
  ].join('') : [
    it('paste', 'paste', 'Вставить', 'Ctrl+V', !S.clipboard), it('select-all', 'select-all', 'Выделить всё', 'Ctrl+A'), '<hr>',
    it('add-text', 'text', 'Добавить текст', 'T'), it('v-fit', 'fit', 'Показать всё', 'F'), it('v-home', 'home', 'Исходный вид'),
  ].join('');
  ctx.hidden = false;
  const w = ctx.offsetWidth, hgt = ctx.offsetHeight;
  ctx.style.left = Math.min(e.clientX, window.innerWidth - w - 8) + 'px';
  ctx.style.top = Math.min(e.clientY, window.innerHeight - hgt - 8) + 'px';
}
ctx.addEventListener('click', () => setTimeout(hideMenus, 0));
function hideMenus() { ctx.hidden = true; pop.hidden = true; }
document.addEventListener('pointerdown', e => { if (!e.target.closest('.ctxmenu,.popover,[data-cmd="color-menu"]')) hideMenus(); });

/* ============================ окна-диалоги ============================ */
const modal = $('#modal'), modalBox = $('#modalBox');
function openModal(html, onReady) {
  modalBox.innerHTML = html; modal.hidden = false;
  const first = modalBox.querySelector('input,select,button'); if (first) first.focus();
  if (onReady) onReady(modalBox);
}
function closeModal() { modal.hidden = true; modalBox.innerHTML = ''; }
modal.addEventListener('pointerdown', e => { if (e.target === modal) closeModal(); });
modal.addEventListener('keydown', e => { if (e.key === 'Escape') { e.stopPropagation(); closeModal(); } });
function confirmUnsaved(proceed) {
  if (!S.dirty || !S.objects.length) { proceed(); return; }
  openModal(`<h3>Сохранить изменения?</h3><div class="mbody"><p>В проекте «${esc(S.file.name || 'Без имени')}» есть несохранённые изменения.</p></div>
    <div class="mfoot"><button class="pbtn primary" data-m="save">Сохранить</button><button class="pbtn" data-m="discard">Не сохранять</button><button class="pbtn" data-m="cancel">Отмена</button></div>`, box => {
    box.addEventListener('click', async e => {
      const b = e.target.closest('[data-m]'); if (!b) return;
      closeModal();
      if (b.dataset.m === 'save') { if (await saveProject(false)) proceed(); }
      else if (b.dataset.m === 'discard') proceed();
    });
  });
}
function openArray() {
  if (!S.sel.length) { toast('Сначала выделите фигуру'); return; }
  const last = store.get('array', { kind: 'line', n: 4, dx: 25, dy: 0, dz: 0, cn: 8, r: 30, ang: 360, rot: true });
  openModal(`<h3>Массив копий</h3><div class="mbody">
    <div class="seg" id="ar-kind"><button data-k="line" class="${last.kind === 'line' ? 'on' : ''}">В ряд</button><button data-k="circle" class="${last.kind === 'circle' ? 'on' : ''}">По кругу</button></div>
    <div id="ar-line" ${last.kind === 'line' ? '' : 'hidden'}>
      <div class="trio" style="grid-template-columns:1fr">${numIn('ar-n', 'Копий', 'шт')}</div>
      <p class="plabel" style="margin:10px 0 6px">Шаг между копиями, мм</p>
      <div class="trio">${numIn('ar-dx', 'X')}${numIn('ar-dy', 'Y')}${numIn('ar-dz', 'Z')}</div>
    </div>
    <div id="ar-circle" ${last.kind === 'circle' ? '' : 'hidden'}>
      <div class="trio">${numIn('ar-cn', 'Всего', 'шт')}${numIn('ar-r', 'R', 'мм')}${numIn('ar-ang', 'Угол', '°')}</div>
      <label class="chk" style="margin-top:8px"><input type="checkbox" id="ar-rot" ${last.rot ? 'checked' : ''}> Поворачивать копии по кругу</label>
      <p class="plabel" style="margin:6px 0 0">Центр круга — на расстоянии R слева от выделения.</p>
    </div></div>
    <div class="mfoot"><button class="pbtn primary" id="ar-ok">Создать</button><button class="pbtn" id="ar-cancel">Отмена</button></div>`, box => {
    const set = (id, v) => { $('#' + id, box).value = fmt(v); };
    set('ar-n', last.n); set('ar-dx', last.dx); set('ar-dy', last.dy); set('ar-dz', last.dz); set('ar-cn', last.cn); set('ar-r', last.r); set('ar-ang', last.ang);
    let kind = last.kind;
    $('#ar-kind', box).addEventListener('click', e => { const b = e.target.closest('[data-k]'); if (!b) return; kind = b.dataset.k; $$('#ar-kind button', box).forEach(x => x.classList.toggle('on', x === b)); $('#ar-line', box).hidden = kind !== 'line'; $('#ar-circle', box).hidden = kind !== 'circle'; });
    $('#ar-cancel', box).addEventListener('click', closeModal);
    box.addEventListener('keydown', e => { if (e.key === 'Enter') $('#ar-ok', box).click(); });
    $('#ar-ok', box).addEventListener('click', () => {
      const g = id => evalExpr($('#' + id, box).value);
      const cfg = { kind, n: Math.round(g('ar-n')), dx: g('ar-dx'), dy: g('ar-dy'), dz: g('ar-dz'), cn: Math.round(g('ar-cn')), r: g('ar-r'), ang: g('ar-ang'), rot: $('#ar-rot', box).checked };
      if (Object.values(cfg).some(v => typeof v === 'number' && !Number.isFinite(v))) { toast('Проверьте числа'); return; }
      store.set('array', cfg); closeModal(); makeArray(cfg);
    });
  });
}
function makeArray(cfg) {
  const objs = selObjs(); const created = [];
  if (cfg.kind === 'line') {
    const n = clamp(cfg.n, 1, 200);
    for (let i = 1; i <= n; i++) for (const o of objs) { const c = cloneObj(o); c.locked = false; c.pos = [r3(o.pos[0] + cfg.dx * i), r3(o.pos[1] + cfg.dz * i), r3(o.pos[2] - cfg.dy * i)]; created.push(c); }
  } else {
    const n = clamp(cfg.cn, 2, 360), b = selBox(), cen = b.getCenter(new V3()); cen.x -= cfg.r;
    const step = (cfg.ang >= 360 ? 360 / n : cfg.ang / (n - 1)) * DEG;
    for (let i = 1; i < n; i++) for (const o of objs) {
      const R = new THREE.Matrix4().makeRotationY(step * i);
      let M;
      if (cfg.rot) M = aroundPoint(cen, R).multiply(C.matrixOf(o));
      else { const p = new V3().fromArray(o.pos).sub(cen).applyMatrix4(R).add(cen); M = C.matrixOf(Object.assign({}, o, { pos: p.toArray() })); }
      created.push(Object.assign(C.objFromMatrix(o, M), { id: uid(), locked: false }));
    }
  }
  S.objects.push(...created); S.sel = [...S.sel, ...created.map(c => c.id)];
  rebuild(); commit(); toast(`Создано копий: ${created.length}. Ctrl+G — объединить в одну деталь`);
}

/* ============================ файлы ============================ */
let dlPromise = null;
function viewerDownloads() {
  if (desktop || !window.claude || typeof window.claude.use !== 'function') return Promise.resolve(null);
  if (!dlPromise) dlPromise = window.claude.use('downloads').catch(() => null);
  return dlPromise;
}
const ALLOWED_VIEWER = /\.(txt|json|md|csv|zip|svg|png|html|pdf)$/i;
async function saveBytes(name, data, filters) {
  if (desktop) {
    const p = await desktop.saveDialog({ defaultPath: name, filters });
    if (!p) return null;
    await desktop.writeFile(p, data); return p;
  }
  const dl = await viewerDownloads();
  if (dl) {
    let fn = name, payload = typeof data === 'string' ? new TextEncoder().encode(data) : data;
    if (!ALLOWED_VIEWER.test(fn)) { payload = C.zipFiles([{ name: fn, data: payload }]); fn += '.zip'; }
    try { await dl.save({ filename: fn, data: new Blob([payload]) }); return fn; }
    catch (err) { toast(err && err.code === 'declined' ? 'Сохранение отменено' : 'Не удалось сохранить файл'); return null; }
  }
  const url = URL.createObjectURL(new Blob([data], { type: 'application/octet-stream' }));
  const a = document.createElement('a'); a.href = url; a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
  return name;
}
async function saveProject(as) {
  const json = JSON.stringify(projectData());
  try {
    if (desktop) {
      let p = !as && S.file.path ? S.file.path : await desktop.saveDialog({ defaultPath: (S.file.name || 'Мой проект') + '.v3d', filters: [{ name: 'Проект Верстак 3D', extensions: ['v3d'] }] });
      if (!p) return false;
      await desktop.writeFile(p, json);
      S.file = { path: p, name: stripExt(basename(p)) }; addRecent(p);
    } else {
      const n = await saveBytes((S.file.name || 'Мой проект') + (window.claude ? '.json' : '.v3d'), json);
      if (!n) return false;
      S.file = { path: null, name: S.file.name || 'Мой проект' };
    }
    setDirty(false); autosave(); closeBackstage(); toast('Проект сохранён'); return true;
  } catch (err) { console.error(err); toast('Не удалось сохранить: ' + err.message); return false; }
}
function loadProject(data, file) {
  const objs = C.sanitize(data.objects || data);
  if (data.assets) for (const id in data.assets) { try { C.Assets.set(id, C.b64ToF32(data.assets[id])); } catch (e) {} }
  S.objects = objs; S.sel = [];
  if (data.bed) setBed(data.bed);
  S.file = file || { path: null, name: null };
  rebuild(); resetHistory(); setDirty(false); autosave(); scheduleStats();
  closeBackstage(); setTimeout(() => view('fit'), 60);
}
function openFromBytes(bytes, name, path) {
  try {
    const data = JSON.parse(new TextDecoder().decode(bytes));
    if (!data || !(Array.isArray(data.objects) || Array.isArray(data))) throw new Error('это не проект Верстак 3D');
    loadProject(data, { path: path || null, name: stripExt(name) });
    if (path) addRecent(path);
    toast('Открыт проект «' + stripExt(name) + '»');
  } catch (err) { toast('Не удалось открыть файл: ' + err.message); }
}
function openProjectDialog() {
  confirmUnsaved(async () => {
    if (desktop) {
      const r = await desktop.openDialog({ filters: [{ name: 'Проект Верстак 3D', extensions: ['v3d', 'json'] }] });
      if (r) openFromBytes(r.data, r.name, r.path);
    } else $('#fileProject').click();
  });
}
async function openPath(p) {
  try { const r = await desktop.readFile(p); openFromBytes(r.data, r.name, r.path); }
  catch (err) { toast('Файл не найден: ' + basename(p)); removeRecent(p); }
}
$('#fileProject').addEventListener('change', e => {
  const f = e.target.files[0]; if (!f) return;
  f.arrayBuffer().then(b => openFromBytes(new Uint8Array(b), f.name)); e.target.value = '';
});
async function importSTL() {
  if (desktop) {
    const r = await desktop.openDialog({ filters: [{ name: 'Модель STL', extensions: ['stl'] }] });
    if (r) addMeshFromSTL(r.data, r.name);
  } else $('#fileSTL').click();
}
$('#fileSTL').addEventListener('change', e => {
  const f = e.target.files[0]; if (!f) return;
  f.arrayBuffer().then(b => addMeshFromSTL(new Uint8Array(b), f.name)); e.target.value = '';
});
function addMeshFromSTL(bytes, name) {
  runBusy(() => {
    try {
      const r = C.parseSTL(bytes), id = uid();
      C.Assets.set(id, r.positions);
      const o = { id: uid(), type: 'mesh', name: stripExt(name).slice(0, 60) || 'Модель', color: '#7f8c8d', hole: S.asHole, pos: [0, r.size[1] / 2, 0], rot: [0, 0, 0], size: r.size, mir: [1, 1, 1], params: { asset: id } };
      const [x, z] = freeSpot(o.size); o.pos[0] = x; o.pos[2] = z;
      S.objects.push(o); S.sel = [o.id]; rebuild(); commit(); closeBackstage();
      toast(`Импортировано: ${fmt(r.size[0])} × ${fmt(r.size[2])} × ${fmt(r.size[1])} мм`); view('fit');
    } catch (err) { toast('Не удалось импортировать: ' + err.message); }
  });
}
async function doExport(fmtName, onlySel) {
  const list = (onlySel && S.sel.length ? selObjs() : S.objects).filter(o => !o.hole);
  if (!list.length) { toast('Нечего экспортировать: нет тел (отверстия не печатаются)'); return; }
  const base = S.file.name || 'model';
  let res;
  try {
    if (fmtName === 'stl') res = await saveBytes(base + '.stl', C.buildSTL(list).bytes, [{ name: 'STL', extensions: ['stl'] }]);
    if (fmtName === 'obj') res = await saveBytes(base + '.obj', C.buildOBJ(list), [{ name: 'OBJ', extensions: ['obj'] }]);
    if (fmtName === '3mf') res = await saveBytes(base + '.3mf', C.build3MF(list), [{ name: '3MF', extensions: ['3mf'] }]);
  } catch (err) { toast('Ошибка экспорта: ' + err.message); return; }
  if (res) { closeBackstage(); toast('Экспортировано: ' + basename(res) + (stats && !stats.fits ? ' · модель больше стола!' : '')); }
}
function getRecent() { return store.get('recent', []); }
function addRecent(p) { const l = getRecent().filter(x => x.path !== p); l.unshift({ path: p, name: stripExt(basename(p)), time: Date.now() }); store.set('recent', l.slice(0, 12)); }
function removeRecent(p) { store.set('recent', getRecent().filter(x => x.path !== p)); }

/* ============================ шаблоны ============================ */
const o_ = (type, name, color, pos, size, extra = {}) => Object.assign({ id: uid(), type, name, color, hole: false, pos, rot: [0, 0, 0], size, mir: [1, 1, 1] }, extra);
const TEMPLATES = [
  { id: 'empty', name: 'Пустой проект', desc: 'Чистая рабочая плоскость', make: () => [] },
  { id: 'keychain', name: 'Брелок с именем', desc: 'Пластина, надпись и отверстие под кольцо', make: () => [
    o_('rbox', 'Пластина', '#2f7fd6', [0, 2, 0], [60, 4, 22], { params: { r: .12 } }),
    o_('text', 'Имя', '#f2f2ee', [4, 5, 0], [40, 2, 12], { params: { text: 'Маша', font: 'round', bold: true, italic: false, align: 'center' }, fitText: true }),
    o_('cylinder', 'Отверстие под кольцо', '#e8873a', [-24, 2, 0], [5, 10, 5], { hole: true, params: { n: 32 } }),
  ] },
  { id: 'cup', name: 'Стакан для карандашей', desc: 'Цилиндр с полостью и звёздами', make: () => [
    o_('cylinder', 'Стакан', '#e8873a', [0, 45, 0], [70, 90, 70], { params: { n: 64 } }),
    o_('cylinder', 'Полость', '#e8873a', [0, 48, 0], [64, 90, 64], { hole: true, params: { n: 64 } }),
    o_('star', 'Звезда', '#e2b52f', [0, 50, 35.5], [30, 3, 30], { rot: [90, 0, 0], params: { n: 5, inner: .45 } }),
  ] },
  { id: 'heart', name: 'Табличка-сердце', desc: 'Сердце с объёмной надписью', make: () => [
    o_('heart', 'Сердце', '#d63b5a', [0, 2.5, 0], [64, 5, 58]),
    o_('text', 'Надпись', '#f2f2ee', [0, 6, -4], [40, 2, 10], { params: { text: 'Люблю', font: 'georgia', bold: true, italic: true, align: 'center' }, fitText: true }),
  ] },
  { id: 'stamp', name: 'Вырезанная надпись', desc: 'Текст-отверстие вырезан в пластине', make: () => [
    o_('rbox', 'Пластина', '#2a9d6f', [0, 4, 0], [80, 8, 30], { params: { r: .1 } }),
    o_('text', 'Надпись', '#2b6cb0', [0, 7, 0], [60, 4, 14], { hole: true, params: { text: 'ВЕРСТАК', font: 'impact', bold: true, italic: false, align: 'center' }, fitText: true }),
  ] },
  { id: 'box', name: 'Коробочка', desc: 'Скруглённый корпус с полостью', make: () => [
    o_('rbox', 'Корпус', '#7a5bd0', [0, 15, 0], [60, 30, 40], { params: { r: .08 } }),
    o_('rbox', 'Полость', '#7a5bd0', [0, 18, 0], [56, 30, 36], { hole: true, params: { r: .06 } }),
  ] },
];
function instantiate(t) {
  const list = t.make();
  for (const o of list) if (o.fitText) { delete o.fitText; try { o.size[0] = r2(o.size[2] * textAspect(o)); } catch (e) {} }
  return list;
}
function useTemplate(id) {
  const t = TEMPLATES.find(x => x.id === id); if (!t) return;
  confirmUnsaved(() => {
    S.objects = instantiate(t); S.sel = [];
    S.file = { path: null, name: null };
    rebuild(); resetHistory(); setDirty(false); autosave(); scheduleStats(); closeBackstage();
    setTimeout(() => view(S.objects.length ? 'fit' : 'home'), 60);
    if (t.id !== 'empty') toast(t.id === 'stamp' || t.id === 'box' || t.id === 'cup' || t.id === 'keychain' ? 'Шаблон загружен. Выделите всё (Ctrl+A) и сгруппируйте (Ctrl+G), чтобы вырезать отверстия' : 'Шаблон загружен');
  });
}
const tplThumbs = {};
function renderTemplateThumbs() {
  let r; try { r = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true }); } catch (e) { return; }
  r.setPixelRatio(1); r.setSize(320, 240);
  for (const t of TEMPLATES) {
    if (t.id === 'empty') continue;
    const sc = new THREE.Scene(); sc.add(new THREE.HemisphereLight(0xffffff, 0x8a96a6, .8));
    const l = new THREE.DirectionalLight(0xffffff, .7); l.position.set(100, 200, 150); sc.add(l);
    const b = new THREE.Box3();
    for (const o of instantiate(t)) {
      try { const m = new THREE.Mesh(C.geomFor(o), o.hole ? new THREE.MeshStandardMaterial({ color: 0x8c98a6, transparent: true, opacity: .35, depthWrite: false }) : new THREE.MeshStandardMaterial({ color: o.color, flatShading: true })); applyT(m, o); m.updateMatrixWorld(); b.union(new THREE.Box3().setFromObject(m)); sc.add(m); } catch (e) {}
    }
    const c = b.getCenter(new V3()), rad = b.getSize(new V3()).length() / 2;
    const cam = new THREE.PerspectiveCamera(30, 4 / 3, 1, 5000); cam.position.copy(c).add(new V3(.8, .9, 1.2).normalize().multiplyScalar(rad / Math.sin(15 * DEG) * 1.05)); cam.lookAt(c);
    r.render(sc, cam); tplThumbs[t.id] = r.domElement.toDataURL();
  }
  r.dispose(); if (r.forceContextLoss) r.forceContextLoss();
}

/* ============================ Backstage ============================ */
const bs = $('#backstage'), bsContent = $('#bsContent');
function openBackstage(page) { hideMenus(); bs.hidden = false; showBS(page); }
function closeBackstage() { bs.hidden = true; }
$$('.bs-item[data-bs]').forEach(b => b.addEventListener('click', () => showBS(b.dataset.bs)));
function showBS(page) {
  $$('.bs-item[data-bs]').forEach(b => b.classList.toggle('on', b.dataset.bs === page));
  const pages = {
    new: () => {
      if (!Object.keys(tplThumbs).length) renderTemplateThumbs();
      return `<h1>Создать</h1><div class="tpl-grid">${TEMPLATES.map(t => `<button class="tpl" data-tpl="${t.id}"><span class="tpl-img">${tplThumbs[t.id] ? `<img src="${tplThumbs[t.id]}" alt="">` : iconSVG('plus')}</span><b>${t.name}</b><small>${t.desc}</small></button>`).join('')}</div>`;
    },
    open: () => {
      const rec = desktop ? getRecent() : [];
      return `<h1>Открыть</h1><div class="bs-list">
        <button class="bs-row" data-cmd="open">${iconSVG('folder')}<span><b>Обзор…</b><small>Файл проекта .v3d или .json</small></span></button>
        <button class="bs-row" data-cmd="import">${iconSVG('import')}<span><b>Импорт STL…</b><small>Вставить готовую 3D-модель в текущий проект</small></span></button></div>
        ${desktop ? `<h2>Последние</h2><div class="bs-list">${rec.length ? rec.map(r => `<button class="bs-row" data-recent="${esc(r.path)}">${iconSVG('file')}<span><b>${esc(r.name)}</b><small>${esc(r.path)}</small></span></button>`).join('') : '<p>Здесь появятся недавно открытые проекты.</p>'}</div>` : ''}`;
    },
    export: () => `<h1>Экспорт</h1>
      <p>Отверстия в файл не попадают — сначала сгруппируйте их с телами, чтобы вырезать. ${stats ? `Модель: ${fmt(stats.size.x)} × ${fmt(stats.size.z)} × ${fmt(stats.size.y)} мм${stats.fits ? '' : ' — <b style="color:var(--danger)">больше стола принтера</b>'}.` : ''}</p>
      <label class="chk" style="margin:12px 0 16px"><input type="checkbox" id="expSel" ${S.sel.length ? '' : 'disabled'}> Только выделенные фигуры</label>
      <div class="exp-grid">
        <button class="exp" data-exp="stl"><b>STL</b><small>Стандарт для 3D-печати. Открывается в Cura, PrusaSlicer, Bambu Studio, OrcaSlicer.</small></button>
        <button class="exp" data-exp="3mf"><b>3MF</b><small>Современный формат с цветами и отдельными деталями — удобно для многоцветной печати.</small></button>
        <button class="exp" data-exp="obj"><b>OBJ</b><small>Для Blender и других 3D-редакторов. Цвета сохраняются в вершинах.</small></button>
      </div>`,
    help: () => `<h1>Справка</h1>
      <h2>Мышь</h2><table class="keys">
      <tr><td>Левая кнопка</td><td>Выбрать фигуру и тащить её по плоскости. По пустому месту — рамка выделения.</td></tr>
      <tr><td>Белые квадраты</td><td>Растянуть фигуру. Shift — сохранить пропорции. Верхний квадрат — высота, стрелка — поднять над столом.</td></tr>
      <tr><td>Числа у фигуры</td><td>Щёлкните и введите точный размер в мм. Стрелки ↑↓ меняют на 1 мм (Shift — на 10).</td></tr>
      <tr><td>Правая кнопка</td><td>Вращать вид. Короткий щелчок — контекстное меню.</td></tr>
      <tr><td>Средняя кнопка</td><td>Сдвинуть вид.</td></tr><tr><td>Колесо</td><td>Приблизить или отдалить.</td></tr>
      <tr><td>Alt + перетаскивание</td><td>Сделать копию и сразу её переместить.</td></tr></table>
      <h2>Клавиатура</h2><table class="keys">
      <tr><td>Ctrl+N / O / S</td><td>Создать / открыть / сохранить проект</td></tr>
      <tr><td>Ctrl+Z / Ctrl+Y</td><td>Отменить / повторить</td></tr>
      <tr><td>Ctrl+C / X / V / D</td><td>Копировать / вырезать / вставить / дублировать</td></tr>
      <tr><td>Ctrl+G / Ctrl+Shift+G</td><td>Сгруппировать / разгруппировать</td></tr>
      <tr><td>Ctrl+A, Esc</td><td>Выделить всё, снять выделение</td></tr>
      <tr><td>Стрелки, PgUp/PgDn</td><td>Сдвиг на шаг сетки (Shift — в 10 раз больше)</td></tr>
      <tr><td>H / S</td><td>Отверстие / тело</td></tr><tr><td>D</td><td>Опустить на плоскость</td></tr>
      <tr><td>E</td><td>Свободный поворот</td></tr><tr><td>R</td><td>Линейка</td></tr><tr><td>T</td><td>Добавить текст</td></tr>
      <tr><td>F</td><td>Показать всё / выделенное</td></tr><tr><td>Ctrl+L</td><td>Закрепить фигуру</td></tr><tr><td>Ctrl+F1</td><td>Свернуть ленту</td></tr></table>
      <h2>Как вырезать форму</h2><p>Любую фигуру — сердце, звезду, текст, импортированную модель — можно сделать отверстием (кнопка «Отверстие» или клавиша H). Поставьте её туда, где нужно вырезать, выделите вместе с телом и нажмите «Сгруппировать». Или выделите сначала тело, затем вырезаемые фигуры и нажмите «Вычесть».</p>`,
    about: () => `<h1>Верстак 3D</h1><p>Версия ${APP_VERSION}. Открытый редактор 3D-моделей для 3D-печати: работает без интернета, на Windows, macOS и Linux.</p>
      <p>Лицензия MIT — программу можно свободно использовать, изменять и распространять. Трёхмерная графика — библиотека three.js (MIT). Булевы операции — реализация по мотивам csg.js Эвана Уоллеса (MIT).</p>
      <p>Tinkercad, Microsoft Office и названия 3D-принтеров — товарные знаки их владельцев. Верстак 3D не связан с этими компаниями.</p>
      <p>Проекты сохраняются в файлы .v3d — это обычный JSON, его можно открыть в любом текстовом редакторе.</p>`,
  };
  bsContent.innerHTML = (pages[page] || pages.new)();
}
bsContent.addEventListener('click', e => {
  const t = e.target.closest('[data-tpl]'); if (t) { useTemplate(t.dataset.tpl); return; }
  const x = e.target.closest('[data-exp]'); if (x) { doExport(x.dataset.exp, $('#expSel') && $('#expSel').checked); return; }
  const r = e.target.closest('[data-recent]'); if (r) { const p = r.dataset.recent; confirmUnsaved(() => openPath(p)); }
});

/* ============================ клавиатура ============================ */
const isTyping = t => t && t.matches && t.matches('input:not([type=checkbox]):not([type=range]):not([type=color]),textarea,select');
window.addEventListener('keydown', e => {
  if (e.key === 'F1' && !e.ctrlKey) { e.preventDefault(); openBackstage('help'); return; }
  if (e.key === 'F1' && e.ctrlKey) { e.preventDefault(); CMDS['toggle-ribbon'](); return; }
  if (!bs.hidden) { if (e.key === 'Escape') closeBackstage(); return; }
  if (!modal.hidden) return;
  const mod = e.ctrlKey || e.metaKey, c = e.code;
  if (mod && (c === 'KeyS')) { e.preventDefault(); saveProject(e.shiftKey); return; }
  if (mod && c === 'KeyO') { e.preventDefault(); openProjectDialog(); return; }
  if (mod && c === 'KeyN') { e.preventDefault(); openBackstage('new'); return; }
  if (isTyping(e.target)) return;
  if (mod) {
    if (c === 'KeyZ' && !e.shiftKey) undo();
    else if (c === 'KeyY' || (c === 'KeyZ' && e.shiftKey)) redo();
    else if (c === 'KeyD') dup();
    else if (c === 'KeyC') copySel(false);
    else if (c === 'KeyX') copySel(true);
    else if (c === 'KeyV') paste();
    else if (c === 'KeyG') e.shiftKey ? ungroup() : group('union');
    else if (c === 'KeyA') selectAll();
    else if (c === 'KeyL') toggleLock();
    else if (c === 'KeyE') openBackstage('export');
    else return;
    e.preventDefault(); return;
  }
  const step = (S.snapOn ? S.snap : 1) * (e.shiftKey ? 10 : 1);
  const { f, r } = viewAxes();
  switch (c) {
    case 'Delete': case 'Backspace': del(); break;
    case 'KeyH': setHole(true); break;
    case 'KeyS': setHole(false); break;
    case 'KeyD': drop(); break;
    case 'KeyE': CMDS['rotate-mode'](); break;
    case 'KeyR': CMDS.ruler(); break;
    case 'KeyT': addShape('text'); break;
    case 'KeyF': view('fit'); break;
    case 'Escape': hideMenus(); if (S.tool) setTool(null); else if (S.mode === 'rotate') setMode('select'); else deselect(); break;
    case 'ArrowUp': nudge(f.clone().multiplyScalar(step)); break;
    case 'ArrowDown': nudge(f.clone().multiplyScalar(-step)); break;
    case 'ArrowRight': nudge(r.clone().multiplyScalar(step)); break;
    case 'ArrowLeft': nudge(r.clone().multiplyScalar(-step)); break;
    case 'PageUp': nudge(new V3(0, step, 0)); break;
    case 'PageDown': nudge(new V3(0, -step, 0)); break;
    default: return;
  }
  e.preventDefault();
});
/* macOS: команды меню приложения приходят сюда (на Windows/Linux меню нет — работает лента) */
document.addEventListener('copy', e => { if (!isTyping(document.activeElement) && S.sel.length) { e.preventDefault(); copySel(false); } });
document.addEventListener('cut', e => { if (!isTyping(document.activeElement) && S.sel.length) { e.preventDefault(); copySel(true); } });
document.addEventListener('paste', e => { if (!isTyping(document.activeElement) && S.clipboard) { e.preventDefault(); paste(); } });
if (desktop) {
  desktop.onMenu(cmd => {
    const typing = isTyping(document.activeElement);
    if (cmd === 'save-and-close') { saveProject(false).then(ok => { if (ok) desktop.closeOk(); }); return; }
    if (cmd === 'undo') { if (typing) document.execCommand('undo'); else undo(); return; }
    if (cmd === 'redo') { if (typing) document.execCommand('redo'); else redo(); return; }
    if (cmd === 'select-all') { if (typing) document.activeElement.select && document.activeElement.select(); else selectAll(); return; }
    if (cmd === 'delete') { if (!typing) del(); return; }
    if (CMDS[cmd]) CMDS[cmd]();
  });
  desktop.onOpenFile(p => confirmUnsaved(() => openPath(p)));
}

/* ============================ цикл ============================ */
let toastT;
function toast(msg) { const t = $('#toast'); t.textContent = msg; t.hidden = false; clearTimeout(toastT); toastT = setTimeout(() => t.hidden = true, 3400); }
function resize() {
  const w = vp.clientWidth, h = vp.clientHeight; if (!w || !h) return;
  renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix();
}
new ResizeObserver(resize).observe(vp);
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');
function loop(t) {
  requestAnimationFrame(loop);
  if (camTween) {
    const k = reduceMotion.matches ? 1 : Math.min(1, (t - camTween.start) / 420), e = 1 - Math.pow(1 - k, 3);
    camera.position.lerpVectors(camTween.p0, camTween.p1, e);
    orbit.target.lerpVectors(camTween.t0, camTween.t1, e);
    if (k >= 1) camTween = null;
  }
  orbit.update();
  hoverCheck();
  updateHandles();
  updateDims();
  if (S.tool === 'ruler') rulerUpdate();
  renderer.render(scene, camera);
}

/* ============================ запуск ============================ */
async function init() {
  setTheme(store.get('theme', 'system')); $('#theme').value = S.theme;
  S.snap = store.get('snap', 1); $('#snap').value = String(S.snap);
  S.snapOn = store.get('snapOn', true); $('#snapOn').checked = S.snapOn;
  S.rotSnap = store.get('rotSnap', 15); $('#rotSnap').value = String(S.rotSnap);
  S.density = store.get('density', 1.24); $('#density').value = String(S.density);
  S.showGrid = store.get('showGrid', true); $('#showGrid').checked = S.showGrid;
  S.showDims = store.get('showDims', true); $('#showDims').checked = S.showDims;
  const showLib = store.get('showLib', true); $('#showLib').checked = showLib; $('#library').hidden = !showLib;
  const sp = store.get('showPane', true); $('#showPane').checked = sp; showPane(sp);
  S.bed = BEDS.find(b => b.id === store.get('bed', 'std')) || BEDS[0]; $('#bed').value = S.bed.id;
  applyTheme(); buildLibrary(); resize();

  let initialPath = null;
  if (desktop) { try { initialPath = await desktop.initialFile(); } catch (e) {} }
  const saved = store.get('autosave', null);
  if (saved && saved.data && Array.isArray(saved.data.objects) && saved.data.objects.length && !initialPath) {
    loadProject(saved.data, saved.file && saved.file.name ? saved.file : null);
    if (saved.dirty) setDirty(true);
  } else if (!initialPath) {
    S.objects = instantiate(TEMPLATES[2]); S.sel = [S.objects[0].id, S.objects[1].id];
    rebuild(); resetHistory(); setDirty(false); scheduleStats();
    toast('Пример: стакан и полость выделены — нажмите «Сгруппировать», чтобы вырезать полость');
  } else rebuild();
  if (initialPath) openPath(initialPath);
  updateTitle(); updateRibbon(); updateStatus();
  requestAnimationFrame(makeThumbs);
  viewerDownloads();
  requestAnimationFrame(loop);
  window.__verstak = { S, C, scene, camera, meshById, CMDS, addShape, group, rebuild, view, Handles, useTemplate, updateSelection };
}
init();
})();
