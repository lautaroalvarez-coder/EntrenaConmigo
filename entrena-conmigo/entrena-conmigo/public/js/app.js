'use strict';
/* Entrená conmigo — front. Todo se guarda en el servidor (api/[...path].js). */

const $ = id => document.getElementById(id);
const esc = t => String(t ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const clone = o => JSON.parse(JSON.stringify(o));
const BL = ['Movilidad + rehab', 'Activación', 'Fuerza rápida · media · pliometría', 'Fuerza A', 'Fuerza B', 'Complementos / auxiliares'];
const blankSes = () => ({ foco: '', b: BL.map(n => ({ n, ex: [] })) });
const newEx = () => ({ n: 'Nuevo ejercicio', series: 3, reps: '8', kg: '', int: '', desc: '', video: '', nota: '' });

let ME = { coach: false }, A = null, T = null;      // sesión, alumno cargado, token
const ST = { edit: false, tab: 'ses', mi: 0, si: 0, d: true };  // estado de pantalla
const DR = {};                                       // series escritas pero todavía no guardadas

/* ---------- API y guardado ---------- */
async function api(method, path, body) {
  const r = await fetch('/api/' + path, { method, headers: body ? { 'Content-Type': 'application/json' } : {}, body: body ? JSON.stringify(body) : undefined });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw Object.assign(new Error(j.error || 'Algo salió mal.'), { status: r.status });
  return j;
}
const status = (t, err) => { const e = $('svi'); e.textContent = t; e.classList.toggle('err', !!err); };
const timers = {};
function later(key, fn) {                            // guarda 0,5 s después del último cambio
  clearTimeout(timers[key]); status('Guardando…');
  timers[key] = setTimeout(() => fn().then(() => status('✓ Guardado'), e => status('⚠ ' + e.message, 1)), 500);
}
const savePlan = () => later('plan', () => api('PUT', `a/${T}/plan`, { plan: A.plan }));
const savePerfil = () => later('perfil', () => api('PUT', `a/${T}/perfil`, { nombre: A.nombre, perfil: A.perfil }));
const ask = (msg, confirmar = true) => new Promise(res => {
  const d = $('dlg'); $('dmsg').textContent = msg; $('dok').hidden = !confirmar;
  $('dcan').textContent = confirmar ? 'Cancelar' : 'Entendido';
  d.onclose = () => res(d.returnValue === 'ok'); d.returnValue = ''; d.showModal();
});

/* ---------- Helpers de vista ---------- */
function edad(nac) {
  const n = new Date(nac + 'T00:00:00'); if (isNaN(n)) return null;
  const h = new Date(), mismoMes = h.getMonth() === n.getMonth();
  let e = h.getFullYear() - n.getFullYear();
  if (h.getMonth() < n.getMonth() || (mismoMes && h.getDate() < n.getDate())) e--;
  return { e, cumple: mismoMes && h.getDate() === n.getDate() };
}
const fld = (p, l, v, x = '', w = '') => `<label class="fl ${w}"><span>${l}</span><input data-p="${p}" value="${esc(v)}" ${x}></label>`;
const area = (p, l, v) => `<label class="fl w"><span>${l}</span><textarea rows="2" data-p="${p}">${esc(v)}</textarea></label>`;
const btn = (a, label, attrs = '', cls = '') => `<button class="${cls}" data-a="${a}" ${attrs}>${label}</button>`;

function hello() {
  const p = A.perfil || {}, ed = edad(p.nac);
  const meta = [ed && ed.e + ' años', p.alt && p.alt + ' cm', p.dep, p.club].filter(Boolean).map(esc);
  const hoy = new Date().toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' });
  return `<b>${esc(A.nombre)}</b>${meta.length ? ' · ' + meta.join(' · ') : ''} · ${hoy}`;
}

/* ---------- Pantallas ---------- */
const login = () => $('app').innerHTML = `<section class="card"><h1>Entrená conmigo</h1>
  <p class="mut">Si sos alumno o alumna, abrí el link que te pasó tu profe.</p>
  <details><summary>Soy el profe</summary><form data-f="login" class="row" style="margin-top:8px">
  <input class="grow" type="password" name="pw" placeholder="Contraseña" autocomplete="current-password" required><button class="p">Entrar</button></form></details></section>`;

async function dash() {
  const { alumnos } = await api('GET', 'alumnos');
  $('app').innerHTML = `<section class="card"><div class="row"><h1 class="grow">Mis alumnos</h1>${btn('logout', 'Salir')}</div>
    <form data-f="newal" class="row" style="margin-top:8px"><input class="grow" name="n" placeholder="Nombre del alumno o alumna" maxlength="80" required><button class="p">Crear alumno</button></form></section>
    <section class="card">${alumnos.length ? alumnos.map(a => `<div class="ex row"><b class="grow">${esc(a.nombre)}</b>
      <a class="btn p" href="/?a=${a.token}">Abrir</a>${btn('copy', 'Copiar link', `data-i="${a.token}"`)}${btn('delal', '×', `data-i="${a.token}" data-n="${esc(a.nombre)}" aria-label="Borrar a ${esc(a.nombre)}"`)}</div>`).join('')
      : '<p class="mut">Todavía no cargaste alumnos. Creá el primero arriba y copiale el link.</p>'}</section>`;
}

function render() {
  const P = ME.coach && ST.edit, p = A.perfil || {}, ed = edad(p.nac);
  const tabs = [['ses', 'Sesión'], ['reg', 'Registro de cargas'], ['fb', 'Feedback']];
  $('app').innerHTML = `<section class="card">
    <div class="row"><h1 class="grow">Bienvenido, ¡qué bueno que estés acá entrenando conmigo!</h1>
      ${ME.coach ? `<a class="btn" href="/">← Alumnos</a><button data-a="edit" aria-pressed="${ST.edit}">${ST.edit ? 'Salir del modo profe' : 'Modo profe'}</button>` : ''}</div>
    ${P ? '<div class="badge">Modo entrenador activo</div>' : ''}
    <p class="mut" id="hello">${hello()}</p>
    ${p.obj ? `<div class="note">🎯 Objetivos: ${esc(p.obj)}</div>` : ''}${p.les ? `<div class="note">⚠️ Lesiones: ${esc(p.les)}</div>` : ''}
    ${ed && ed.cumple ? `<div class="bday">🎂 ¡Feliz cumpleaños, ${esc(A.nombre)}! Hoy cumplís ${ed.e}. Que sea un gran día y un gran entrenamiento.</div>` : ''}
    <details ${ST.d ? 'open' : ''} style="margin-top:12px"><summary>Mis datos</summary><div class="dg">
      ${fld('nombre', 'Nombre', A.nombre)}${fld('perfil.nac', 'Fecha de cumpleaños', p.nac, 'type="date"')}
      ${fld('perfil.alt', 'Altura (cm)', p.alt, 'type="number" inputmode="decimal"')}${fld('perfil.dep', 'Deporte', p.dep)}${fld('perfil.club', 'Club', p.club)}
      ${area('perfil.les', 'Lesiones', p.les)}${area('perfil.obj', 'Objetivos', p.obj)}</div></details></section>
    <nav>${tabs.map(t => `<button aria-selected="${t[0] === ST.tab}" data-a="tab" data-i="${t[0]}">${t[1]}</button>`).join('')}</nav>
    ${{ ses: vSes, reg: vReg, fb: vFb }[ST.tab]()}`;
}

function exEdit(e, bi, ei) {
  const b = `plan.${ST.mi}.ses.${ST.si}.b.${bi}.ex.${ei}`, ids = `data-b="${bi}" data-e="${ei}"`;
  return `<div class="ex"><div class="row"><input class="grow strong" data-p="${b}.n" value="${esc(e.n)}" aria-label="Ejercicio">
    ${btn('moveE', '↑', `${ids} data-i="-1" aria-label="Subir"`)}${btn('moveE', '↓', `${ids} data-i="1" aria-label="Bajar"`)}${btn('dupE', '⧉', `${ids} title="Duplicar"`)}${btn('delE', '×', `${ids} aria-label="Quitar ejercicio"`)}</div>
    <div class="dg">${fld(b + '.series', 'Series', e.series, 'type="number" min="1" data-num')}${fld(b + '.reps', 'Reps', e.reps)}${fld(b + '.kg', 'Kg', e.kg, 'type="number" inputmode="decimal"')}
    ${fld(b + '.int', 'Intensidad', e.int)}${fld(b + '.desc', 'Descanso', e.desc)}${fld(b + '.video', 'Link del video (opcional)', e.video, 'type="url"', 'w')}${area(b + '.nota', 'Comentarios sobre el ejercicio', e.nota)}</div></div>`;
}

function exView(e, bi, ei) {
  let h = `<div class="ex"><h3>${esc(e.n)}</h3><div class="mut">${e.series} series × ${esc(e.reps)}${e.kg ? ` · Carga: ${esc(e.kg)} kg` : ''}${e.int ? ` · Intensidad: ${esc(e.int)}` : ''}${e.desc ? ` · Descanso: ${esc(e.desc)}` : ''}</div>`;
  if (e.nota) h += `<div class="mut pre" style="margin-top:6px">💬 ${esc(e.nota)}</div>`;
  if (/^https?:\/\//i.test(e.video || '')) h += `<a class="vid" href="${esc(e.video)}" target="_blank" rel="noopener">▶ Ver video del ejercicio</a>`;
  h += '<div class="sets">';
  for (let s = 1; s <= e.series; s++) {
    const k = `${ST.mi}.${ST.si}.${bi}.${ei}.${s}`;
    h += `<div class="set"><b>S${s}</b><input type="number" inputmode="decimal" data-k="${k}.kg" placeholder="${esc(e.kg || 'kg')}" value="${esc(DR[k + '.kg'] ?? '')}">
      <input type="number" inputmode="numeric" data-k="${k}.r" placeholder="reps" value="${esc(DR[k + '.r'] ?? '')}"></div>`;
  }
  return h + '</div></div>';
}

function vSes() {
  const P = ME.coach && ST.edit, M = A.plan[ST.mi], S = M.ses[ST.si];
  let h = `<div class="card"><div class="row">${A.plan.map((m, i) => `<span class="row tight">${btn('mi', esc(m.n), `aria-selected="${i === ST.mi}" data-i="${i}"`)}${P ? btn('delM', '×', `data-i="${i}" aria-label="Borrar ${esc(m.n)}"`) : ''}</span>`).join('')}
    ${P ? btn('addM', '+', 'title="Nuevo microciclo (copia el actual)"', 'p') : ''}</div>
    ${P ? `<div class="dg">${fld(`plan.${ST.mi}.n`, 'Nombre del microciclo', M.n, 'data-r', 'w')}</div>` : ''}</div>
    <div class="card"><div class="row">${M.ses.map((_, i) => btn('si', 'Sesión ' + (i + 1), `aria-selected="${i === ST.si}" data-i="${i}"`)).join('')}${P ? btn('addS', '+ Sesión') : ''}</div>`;
  if (P) h += `<div class="row" style="margin-top:12px">${btn('dupS', 'Duplicar sesión')}${btn('moveS', '←', 'data-i="-1" aria-label="Mover sesión a la izquierda"')}${btn('moveS', '→', 'data-i="1" aria-label="Mover sesión a la derecha"')}${btn('delS', 'Borrar sesión')}</div>
    <div class="dg">${area(`plan.${ST.mi}.ses.${ST.si}.foco`, 'Qué se trabaja en esta sesión (opcional)', S.foco)}</div>`;
  else if (S.foco) h += `<p class="mut" style="margin-top:12px">Hoy se trabaja: <b>${esc(S.foco)}</b></p>`;
  S.b.forEach((b, bi) => {
    if (!P && !b.ex.length) return;
    h += P ? `<div class="row" style="margin-top:18px"><input class="grow strong" data-p="plan.${ST.mi}.ses.${ST.si}.b.${bi}.n" value="${esc(b.n)}" aria-label="Nombre del bloque">
      ${btn('moveB', '↑', `data-b="${bi}" data-i="-1" aria-label="Subir bloque"`)}${btn('moveB', '↓', `data-b="${bi}" data-i="1" aria-label="Bajar bloque"`)}${btn('delB', '×', `data-b="${bi}" aria-label="Borrar bloque"`)}</div>`
      : `<div class="blk">${esc(b.n)}</div>`;
    b.ex.forEach((e, ei) => h += P ? exEdit(e, bi, ei) : exView(e, bi, ei));
    if (P) h += `<div style="margin-top:6px">${btn('addE', '+ Ejercicio', `data-b="${bi}"`)}</div>`;
  });
  h += P ? `<div style="margin-top:14px">${btn('addB', '+ Bloque')}</div><p class="mut">Los cambios se guardan solos. Para ver cómo lo ve el alumno, salí del modo profe.</p>`
    : `<div class="row" style="margin-top:14px">${btn('gs', 'Guardar sesión', '', 'p')}<span id="ok" class="toast"></span></div><p class="mut">En kg poné el peso total, incluyendo la barra. Si dejás kg vacío, se usa la carga indicada.</p>`;
  return h + '</div>';
}

function vReg() {
  const r = A.registros, tot = r.reduce((s, x) => s + x.kg * x.reps, 0);
  return `<div class="card"><h2>Registro de cargas</h2><p class="mut">Volumen total acumulado: <b>${tot.toLocaleString('es-AR')} kg</b></p>
    ${r.length ? `<div class="tw"><table><tr><th>Fecha</th><th>Microciclo</th><th>Sesión</th><th>Ejercicio</th><th>Serie</th><th>Kg</th><th>Reps</th></tr>
    ${r.slice(-300).reverse().map(x => `<tr><td>${x.fecha}</td><td>${esc(x.microciclo)}</td><td>${x.sesion}</td><td>${esc(x.ejercicio)}</td><td>${x.serie}</td><td>${x.kg}</td><td>${x.reps}</td></tr>`).join('')}</table></div>`
      : '<p class="mut">Todavía no hay cargas. Completá una sesión y tocá “Guardar sesión”.</p>'}
    ${ME.coach && r.length ? `<p>${btn('clr', 'Borrar registro')}</p>` : ''}</div>`;
}

function vFb() {
  const q = [['mot', 'Motivación para entrenar'], ['rec', 'Recuperación antes de entrenar'], ['esf', 'Esfuerzo percibido'], ['dol', 'Dolor muscular']];
  let h = `<div class="card"><h2>Feedback semanal</h2>${q.map(x => `<label class="q">${x[1]} (1 a 5): <b id="o${x[0]}">3</b></label><input type="range" min="1" max="5" value="3" id="${x[0]}" data-rg="${x[0]}">`).join('')}
    <label class="q" for="sue">Horas de sueño promedio</label><input type="number" id="sue" step="0.5" style="width:90px">
    <label class="q" for="com">Comentarios para tu entrenador</label><textarea id="com" rows="3"></textarea>
    <div class="row" style="margin-top:12px">${btn('gf', 'Enviar feedback', '', 'p')}<span id="okf" class="toast"></span></div>
    <p class="mut">Feedbacks enviados: ${A.nfb}</p></div>`;
  if (ME.coach && A.feedback?.length) h += `<div class="card"><h2>Feedbacks recibidos</h2><div class="tw"><table><tr><th>Fecha</th><th>Motiv.</th><th>Recup.</th><th>Esfuerzo</th><th>Dolor</th><th>Sueño</th><th>Comentarios</th></tr>
    ${A.feedback.map(f => `<tr><td>${new Date(f.creado).toLocaleDateString('es-AR')}</td><td>${f.datos.mot}</td><td>${f.datos.rec}</td><td>${f.datos.esf}</td><td>${f.datos.dol}</td><td>${esc(f.datos.sue)}</td><td class="c">${esc(f.datos.com)}</td></tr>`).join('')}</table></div></div>`;
  return h;
}

/* ---------- Eventos ---------- */
const setPath = (path, v) => { const p = path.split('.'), k = p.pop(); let o = A; for (const x of p) o = o[x]; o[k] = v; };
const mv = (arr, k, d) => { const j = k + d; if (j < 0 || j >= arr.length) return false; [arr[k], arr[j]] = [arr[j], arr[k]]; return true; };

document.addEventListener('change', ev => {           // campos con data-p: se guardan solos
  const t = ev.target, p = t.dataset.p; if (!p || !A) return;
  setPath(p, 'num' in t.dataset ? Math.max(1, +t.value || 1) : t.value);
  if (p === 'nombre' || p.startsWith('perfil.')) { $('hello').innerHTML = hello(); savePerfil(); }
  else { savePlan(); if ('r' in t.dataset) render(); }
});
document.addEventListener('input', ev => {
  const t = ev.target;
  if (t.dataset.k) DR[t.dataset.k] = t.value;
  if (t.dataset.rg) $('o' + t.dataset.rg).textContent = t.value;
});
document.addEventListener('toggle', ev => { if (ev.target.tagName === 'DETAILS' && ev.target.querySelector('.dg')) ST.d = ev.target.open; }, true);

document.addEventListener('submit', async ev => {
  ev.preventDefault();
  const f = ev.target, d = new FormData(f);
  try {
    if (f.dataset.f === 'login') { await api('POST', 'login', { password: d.get('pw') }); location.reload(); }
    if (f.dataset.f === 'newal') { const r = await api('POST', 'alumnos', { nombre: d.get('n') }); location.href = '/?a=' + r.token; }
  } catch (e) { ask(e.message, false); }
});

document.addEventListener('click', async ev => {
  const t = ev.target.closest('[data-a]'); if (!t) return;
  const { a, i, n } = t.dataset, num = +i, bi = +t.dataset.b, ei = +t.dataset.e;
  try {
    if (a === 'logout') { await api('POST', 'logout'); location.href = '/'; return; }
    if (a === 'copy') { await navigator.clipboard.writeText(`${location.origin}/?a=${i}`); status('✓ Link copiado'); return; }
    if (a === 'delal') { if (await ask(`¿Borrar a "${n}" con su rutina y sus registros? No se puede deshacer.`)) { await api('DELETE', 'a/' + i); dash(); } return; }
    if (!A) return;
    const m = A.plan[ST.mi], s = m.ses[ST.si], ex = s.b[bi]?.ex;
    const upd = () => { savePlan(); render(); };      // cambio de estructura: guardar y redibujar
    switch (a) {
      case 'tab': ST.tab = i; render(); break;
      case 'mi': ST.mi = num; ST.si = 0; render(); break;
      case 'si': ST.si = num; render(); break;
      case 'edit': ST.edit = !ST.edit; render(); break;
      case 'addM': { const c = clone(m); c.n = 'Microciclo ' + (A.plan.length + 1); A.plan.push(c); ST.mi = A.plan.length - 1; ST.si = 0; upd(); break; }
      case 'delM':
        if (A.plan.length < 2) await ask('Tiene que quedar al menos un microciclo.', false);
        else if (await ask(`¿Borrar "${A.plan[num].n}" con todas sus sesiones?`)) { A.plan.splice(num, 1); ST.mi = Math.min(ST.mi, A.plan.length - 1); ST.si = 0; upd(); }
        break;
      case 'addS': m.ses.splice(ST.si + 1, 0, blankSes()); ST.si++; upd(); break;
      case 'dupS': m.ses.splice(ST.si + 1, 0, clone(s)); ST.si++; upd(); break;
      case 'moveS': if (mv(m.ses, ST.si, num)) { ST.si += num; upd(); } break;
      case 'delS':
        if (m.ses.length < 2) await ask('Tiene que quedar al menos una sesión.', false);
        else if (await ask(`¿Borrar la Sesión ${ST.si + 1} con todo su contenido?`)) { m.ses.splice(ST.si, 1); ST.si = Math.max(0, ST.si - 1); upd(); }
        break;
      case 'addB': s.b.push({ n: 'Nuevo bloque', ex: [] }); upd(); break;
      case 'moveB': if (mv(s.b, bi, num)) upd(); break;
      case 'delB': if (await ask(`¿Borrar el bloque "${s.b[bi].n}" con todos sus ejercicios?`)) { s.b.splice(bi, 1); upd(); } break;
      case 'addE': ex.push(newEx()); upd(); break;
      case 'dupE': ex.splice(ei + 1, 0, clone(ex[ei])); upd(); break;
      case 'moveE': if (mv(ex, ei, num)) upd(); break;
      case 'delE': if (await ask(`¿Borrar el ejercicio "${ex[ei].n}"?`)) { ex.splice(ei, 1); upd(); } break;
      case 'gs': {
        const series = [];
        s.b.forEach((b, bj) => b.ex.forEach((x, ej) => { for (let k = 1; k <= x.series; k++) {
          const key = `${ST.mi}.${ST.si}.${bj}.${ej}.${k}`, reps = DR[key + '.r'], kg = DR[key + '.kg'] || x.kg;
          if (reps && kg !== '' && kg != null && !isNaN(kg)) series.push({ ejercicio: x.n, serie: k, kg: +kg, reps: +reps });
        } }));
        if (!series.length) { $('ok').textContent = 'No hay series completas para guardar'; break; }
        const r = await api('POST', `a/${T}/registros`, { microciclo: m.n, sesion: ST.si + 1, series });
        A.registros = r.registros;
        Object.keys(DR).forEach(k => k.startsWith(`${ST.mi}.${ST.si}.`) && delete DR[k]);
        render(); $('ok').textContent = `${r.n} series guardadas ✓`; break;
      }
      case 'clr': if (await ask('¿Borrar todo el registro de cargas?')) { await api('DELETE', `a/${T}/registros`); A.registros = []; render(); } break;
      case 'gf': {
        const g = id => $(id).value;
        const r = await api('POST', `a/${T}/feedback`, { mot: g('mot'), rec: g('rec'), esf: g('esf'), dol: g('dol'), sue: g('sue'), com: g('com') });
        A.nfb = r.nfb; if (r.feedback) A.feedback = r.feedback;
        render(); $('okf').textContent = '¡Gracias! Feedback enviado ✓'; break;
      }
    }
  } catch (e) { ask(e.message, false); }
});

/* ---------- Arranque ---------- */
(async () => {
  try {
    ME = await api('GET', 'me');
    let saved = null; try { saved = localStorage.getItem('ec:t'); } catch { }
    T = new URLSearchParams(location.search).get('a') || (!ME.coach && saved) || null;
    if (T) {
      A = await api('GET', 'a/' + T);
      if (!ME.coach) try { localStorage.setItem('ec:t', T); } catch { }  // solo para recordar el link en este celular
      render();
    } else if (ME.coach) await dash();
    else login();
  } catch (e) {
    if (T && e.status === 404) try { localStorage.removeItem('ec:t'); } catch { }
    $('app').innerHTML = `<section class="card"><h2>No pudimos cargar</h2><p class="mut">${esc(e.message)}</p><a class="btn" href="/">Volver al inicio</a></section>`;
  }
})();
