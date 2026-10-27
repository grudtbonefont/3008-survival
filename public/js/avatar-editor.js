// Avatar editor: live rotating 3D preview + category tabs. Saved to localStorage, synced to the server.
import * as THREE from 'three';
import { makeAvatar, animate, disposeGroup } from './models.js';
import { CATS, SKINS, PALETTE, HAIR_COLORS, DEFAULT_AVATAR, validateAvatar, randomAvatar, locked } from '/shared/avatar.js';
import { t, nm } from './i18n.js';
import { svg } from './icons.js';

const KEY = '3008av';
export function loadAvatar() { try { return validateAvatar(JSON.parse(localStorage.getItem(KEY)), 99); } catch { return { ...DEFAULT_AVATAR }; } }
export function saveAvatar(av) { localStorage.setItem(KEY, JSON.stringify(av)); }

const TABS = [
  { id: 'body', cat: 'body', colors: [['skin', SKINS, 'col_skin']], icon: '🧍' },
  { id: 'face', cat: 'face', colors: [['skin', SKINS, 'col_skin']], icon: '🙂' },
  { id: 'hair', cat: 'hair', colors: [['hairColor', HAIR_COLORS, 'col_hair']], icon: '💇' },
  { id: 'hat', cat: 'hat', colors: [['hatColor', PALETTE, 'col_hat']], icon: '🎩' },
  { id: 'facewear', cat: 'facewear', colors: [['accColor', PALETTE, 'col_acc']], icon: '🕶' },
  { id: 'shirt', cat: 'shirtPat', colors: [['shirt', PALETTE, 'col_shirt'], ['shirt2', PALETTE, 'col_shirt2']], icon: '👕' },
  { id: 'pants', cat: 'pantsPat', colors: [['pants', PALETTE, 'col_pants'], ['shoes', PALETTE, 'col_shoes']], icon: '👖' },
  { id: 'back', cat: 'back', colors: [['accColor', PALETTE, 'col_acc']], icon: '🎒' },
];
const hex = (c) => '#' + c.toString(16).padStart(6, '0');

export function openEditor({ level = 1, onSave }) {
  let av = loadAvatar(), tab = 'body', dragging = false, lastX = 0, yaw = 0.5, spin = true, model = null, raf = 0;
  const el = document.createElement('div'); el.id = 'avatarEd'; el.className = 'panel wide';
  el.innerHTML = `<div class="edHead"><h2>${t('editor')}</h2><div class="edBtns"><button id="edRand">${t('random')}</button><button id="edReset">${t('reset')}</button><button id="edSave" class="primary">${t('save')}</button><button id="edX" class="iconBtn" title="Esc">${svg('x', 18)}</button></div></div>
  <div class="edBody"><div class="edPrev"><canvas id="edCanvas"></canvas><div class="edLv">${t('yourLv', { lv: level })}</div></div>
  <div class="edSide"><div class="edTabs"></div><div class="edOpts"></div><div class="edCols"></div></div></div>`;
  document.body.appendChild(el);
  const cv = el.querySelector('#edCanvas');
  const renderer = new THREE.WebGLRenderer({ canvas: cv, antialias: true, alpha: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(Math.min(2, devicePixelRatio)); renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping;
  const scene = new THREE.Scene(), cam = new THREE.PerspectiveCamera(30, 1, 0.1, 50);
  scene.add(new THREE.HemisphereLight(0xfff4e0, 0x4a4038, 1.3));
  const key = new THREE.DirectionalLight(0xffffff, 2.2); key.position.set(3, 5, 4); scene.add(key);
  const rim = new THREE.DirectionalLight(0x9fc8ff, 1.2); rim.position.set(-4, 3, -3); scene.add(rim);
  const disc = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.2, 0.12, 48), new THREE.MeshStandardMaterial({ color: 0x2c2c32, roughness: 0.8 })); disc.position.y = -0.06; scene.add(disc);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(1.15, 0.012, 8, 64), new THREE.MeshBasicMaterial({ color: 0xe8c872 })); ring.rotation.x = Math.PI / 2; ring.position.y = 0.01; scene.add(ring);
  const holder = new THREE.Group(); scene.add(holder);

  function rebuild() {
    if (model) { holder.remove(model.g); disposeGroup(model.g); }
    model = makeAvatar(av); holder.add(model.g);
    const h = model.height || 2; cam.position.set(0, h * 0.62, h * 2.35 + 1.2); cam.lookAt(0, h * 0.5, 0);
  }
  function resize() { const r = cv.parentElement.getBoundingClientRect(); renderer.setSize(r.width, r.height, false); cam.aspect = r.width / Math.max(1, r.height); cam.updateProjectionMatrix(); }
  let last = performance.now();
  function loop(now) {
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    if (spin && !dragging) yaw += dt * 0.6;
    holder.rotation.y = yaw; if (model) animate(model, dt, { moving: false, speed: 1 });
    renderer.render(scene, cam); raf = requestAnimationFrame(loop);
  }
  cv.addEventListener('pointerdown', e => { dragging = true; lastX = e.clientX; spin = false; cv.setPointerCapture(e.pointerId); });
  cv.addEventListener('pointermove', e => { if (dragging) { yaw += (e.clientX - lastX) * 0.012; lastX = e.clientX; } });
  cv.addEventListener('pointerup', () => { dragging = false; });
  cv.addEventListener('dblclick', () => { spin = !spin; });

  function renderTabs() {
    el.querySelector('.edTabs').innerHTML = TABS.map(x => `<button data-tab="${x.id}" class="${x.id === tab ? 'on' : ''}">${t('c_' + x.id)}</button>`).join('');
    el.querySelectorAll('.edTabs button').forEach(b => b.onclick = () => { tab = b.dataset.tab; renderTabs(); renderOpts(); });
  }
  function renderOpts() {
    const T = TABS.find(x => x.id === tab), list = CATS[T.cat];
    el.querySelector('.edOpts').innerHTML = list.map(o => { const lk = locked(T.cat, o.id, level);
      return `<button data-id="${o.id}" class="opt ${av[T.cat] === o.id ? 'on' : ''} ${lk ? 'lock' : ''}" ${lk ? 'disabled' : ''}>${nm(o)}${lk ? `<small>${svg('lock', 11)} ${t('lvReq', { lv: o.lv })}</small>` : o.lv > 1 ? `<small>★ ${t('lvReq', { lv: o.lv })}</small>` : ''}</button>`; }).join('');
    el.querySelectorAll('.edOpts .opt').forEach(b => b.onclick = () => { av[T.cat] = b.dataset.id; rebuild(); renderOpts(); });
    el.querySelector('.edCols').innerHTML = T.colors.map(([k, pal, lab]) => `<div class="colRow"><span>${t(lab)}</span><div class="sw">${pal.map(c => `<i data-k="${k}" data-c="${c}" style="background:${hex(c)}" class="${av[k] === c ? 'on' : ''}"></i>`).join('')}<label class="pick" title="RGB"><input type="color" data-k="${k}" value="${hex(av[k])}"></label></div></div>`).join('');
    el.querySelectorAll('.edCols i').forEach(i => i.onclick = () => { av[i.dataset.k] = +i.dataset.c; rebuild(); renderOpts(); });
    el.querySelectorAll('.edCols input').forEach(i => i.oninput = () => { av[i.dataset.k] = parseInt(i.value.slice(1), 16); rebuild(); });
  }
  el.querySelector('#edRand').onclick = () => { av = randomAvatar(level); rebuild(); renderOpts(); };
  el.querySelector('#edReset').onclick = () => { av = { ...DEFAULT_AVATAR }; rebuild(); renderOpts(); };
  const close = () => { removeEventListener('keydown', onKey); cancelAnimationFrame(raf); removeEventListener('resize', resize); if (model) disposeGroup(model.g); renderer.dispose(); el.remove(); };
  el.querySelector('#edSave').onclick = () => { av = validateAvatar(av, level); saveAvatar(av); onSave?.(av); close(); };
  const onKey = (e) => { if (e.key === 'Escape') close(); };
  el.querySelector('#edX').onclick = () => close(); addEventListener('keydown', onKey);
  addEventListener('resize', resize);
  renderTabs(); renderOpts(); rebuild(); requestAnimationFrame(() => { resize(); raf = requestAnimationFrame(loop); });
  return { close, get av() { return av; } };
}
