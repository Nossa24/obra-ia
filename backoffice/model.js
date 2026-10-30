'use strict';
/* Obra IA · Back office · modelo de datos y cálculos.
   Todo es de ejemplo. El tiempo se mide en días hábiles desde el inicio de cada obra. */

const VERSION = 4;
const LS_KEY = 'obraia-backoffice-v' + VERSION;
const CAPS = ['Cimentación', 'Estructura', 'Mampostería', 'Instalaciones', 'Acabados', 'Fachada', 'Entrega'];
const CREW = {
  'Cimentación': 'Cimentación 1', 'Estructura': 'Formaleteros 1', 'Mampostería': 'Lateros A',
  'Instalaciones': 'Plomeros 1', 'Acabados': 'Pintores A', 'Fachada': 'Fachaleros 1', 'Entrega': 'Residente de obra'
};
const BOSS = {
  'Cimentación': 'Gilberto · contramaestro cimentación', 'Estructura': 'Hernán · contramaestro estructura',
  'Mampostería': 'Ramiro · contramaestro mampostería', 'Instalaciones': 'Yesid · contramaestro instalaciones',
  'Acabados': 'Luz · contramaestra acabados', 'Fachada': 'Edwin · contramaestro fachada', 'Entrega': 'Residente de obra'
};
const RECOVER = 0.7; // parte del ritmo perdido que recupera reforzar la cuadrilla (supuesto de ejemplo, editable por obra)
const recoverOf = o => (o.recover != null ? o.recover : RECOVER);
const ROLES = { director: 'Director de obra', residente: 'Residente de obra', presupuestista: 'Presupuestista', sst: 'Coordinador SST', programador: 'Programador de obra', compras: 'Jefe de compras', diseno: 'Coordinador de diseño' };
// ciclo de una decisión: propuesta (abierta / para comité) → decidida → en ejecución → verificada
const decisionTomada = d => !!d && ['decidida', 'ejecucion', 'verificada'].includes(d.estado);
const recuperaActiva = d => !!d && d.opcion === 'reforzar' && ['decidida', 'ejecucion'].includes(d.estado);

/* ---------- utilidades ---------- */
const pad = n => String(n).padStart(2, '0');
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const MES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
function isoOf(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
function parseISO(s) { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d, 12); }
function addWD(base, n) {
  const d = new Date(base), step = n < 0 ? -1 : 1; let left = Math.abs(Math.round(n));
  while (left > 0) { d.setDate(d.getDate() + step); const w = d.getDay(); if (w !== 0 && w !== 6) left--; }
  return d;
}
function dateOf(o, dia) { return addWD(parseISO(o.fecha0), dia); }
function fmtDate(d) { return d.getDate() + ' ' + MES[d.getMonth()]; }
function fmtDia(o, dia) { return fmtDate(dateOf(o, dia)); }
function fmtDiaY(o, dia) { const d = dateOf(o, dia); return fmtDate(d) + ' ' + d.getFullYear(); }
function dots(n) { return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, '.'); }
function fmtM(n) {
  const m = n / 1e6;
  return '$' + (Math.abs(m) >= 100 ? dots(m) : (Math.round(m * 10) / 10).toString().replace('.', ',')) + ' M';
}
function fmtCOP(n) { return '$' + dots(n); }
function rng(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
function norm(s) { return String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, ''); }

/* ---------- plan: actividades y cronograma ---------- */
function buildActs(p) {
  const A = [];
  const add = a => A.push(Object.assign({ pct: 0 }, a));
  add({ id: 'CIM', cap: 'Cimentación', nombre: 'Excavación y cimentación', crew: CREW['Cimentación'], dur: 110, preds: [], qty: p * 190, und: 'm³' });
  for (let n = 1; n <= p; n++) add({ id: 'EST-' + n, cap: 'Estructura', nombre: 'Placa nivel ' + n, crew: CREW['Estructura'], dur: 11, preds: [n === 1 ? 'CIM' : 'EST-' + (n - 1)], qty: 176, und: 'm²', nivel: n });
  for (let n = 1; n <= p; n++) add({ id: 'MAM-' + n, cap: 'Mampostería', nombre: 'Muros piso ' + n, crew: CREW['Mampostería'], dur: 9, preds: ['EST-' + Math.min(n + 2, p)].concat(n > 1 ? ['MAM-' + (n - 1)] : []), qty: 162, und: 'm²', nivel: n });
  for (let n = 1; n <= p; n++) add({ id: 'INS-' + n, cap: 'Instalaciones', nombre: 'Instalaciones piso ' + n, crew: CREW['Instalaciones'], dur: 7, preds: ['MAM-' + n].concat(n > 1 ? ['INS-' + (n - 1)] : []), qty: 84, und: 'puntos', nivel: n });
  for (let n = 1; n <= p; n++) add({ id: 'ACA-' + n, cap: 'Acabados', nombre: 'Acabados piso ' + n, crew: CREW['Acabados'], dur: 10, preds: ['INS-' + n].concat(n > 1 ? ['ACA-' + (n - 1)] : []), qty: 220, und: 'm²', nivel: n });
  add({ id: 'FAC', cap: 'Fachada', nombre: 'Fachada', crew: CREW['Fachada'], dur: 70, preds: ['EST-' + p], qty: 1400, und: 'm²' });
  add({ id: 'ENT', cap: 'Entrega', nombre: 'Entrega de obra', crew: CREW['Entrega'], dur: 15, preds: ['ACA-' + p, 'FAC'], qty: 1, und: 'glb' });
  return A;
}
function recompute(o) {
  const plan = {};
  for (const a of o.acts) {
    let ini = 0;
    for (const p of a.preds) ini = Math.max(ini, plan[p].fin);
    plan[a.id] = { ini, fin: ini + a.dur };
  }
  o._plan = plan;
  o.planEnd = plan[o.acts[o.acts.length - 1].id].fin;
  o.totalSem = Math.ceil(o.planEnd / 5);
}
const rendPlan = a => a.qty / a.dur;
const planPctAct = (o, a) => clamp((o.hoy - o._plan[a.id].ini) / a.dur, 0, 1);
function avance(o, cap) {
  let w = 0, pl = 0, re = 0;
  for (const a of o.acts) {
    if (cap && a.cap !== cap) continue;
    w += a.dur; pl += a.dur * planPctAct(o, a); re += a.dur * a.pct;
  }
  return w ? { plan: pl / w, real: re / w } : { plan: 0, real: 0 };
}
// $3 millones mensuales por persona (supuesto): 22 días hábiles de 8 horas al mes
const costoHora = o => o.costoMensual / 176;
const costDia = o => o.trabajadores * (o.costoMensual / 22) + o.fijoDia;

/* ---------- proyección con el ritmo real ---------- */
function effRitmo(o, cap, raw) {
  const rr = o.ritmos[cap];
  let v = rr ? Math.min(1, rr.v) : 1;
  const d = o.decisiones[cap];
  if (!raw && recuperaActiva(d)) v = v + (1 - v) * recoverOf(o);
  return v;
}
function ritmosAll(o, raw) { const r = {}; CAPS.forEach(c => r[c] = effRitmo(o, c, raw)); return r; }
function ritmosOnly(o, cap, val) { const r = {}; CAPS.forEach(c => r[c] = 1); r[cap] = val; return r; }
function projectSchedule(o, ritmos) {
  const m = {}, hoy = o.hoy;
  for (const a of o.acts) {
    const pl = o._plan[a.id];
    let ini = 0;
    for (const p of a.preds) ini = Math.max(ini, m[p].fin);
    const r = ritmos[a.cap] || 1;
    if (a.pct >= 0.999) { m[a.id] = { ini: pl.ini, fin: Math.min(pl.fin, hoy) }; continue; }
    if (a.pct > 0) { m[a.id] = { ini: pl.ini, fin: hoy + a.dur * (1 - a.pct) / r }; continue; }
    ini = Math.max(ini, hoy);
    m[a.id] = { ini, fin: ini + a.dur / r };
  }
  return m;
}
const endOf = (o, m) => m[o.acts[o.acts.length - 1].id].fin;
function overall(o) {
  const m = projectSchedule(o, ritmosAll(o, false));
  const d = endOf(o, m) - o.planEnd;
  const dias = d < 0.5 ? 0 : Math.round(d);
  let refuerzos = 0;
  for (const cap of Object.keys(o.decisiones)) {
    const x = o.decisiones[cap];
    if (decisionTomada(x) && x.opcion === 'reforzar') refuerzos += x.costoRefuerzo != null ? x.costoRefuerzo : o.refuerzoBase;
  }
  const costoAtraso = dias * costDia(o);
  return { m, proj: endOf(o, m), dias, costoAtraso, refuerzos, costo: costoAtraso + refuerzos };
}
function computeAlerts(o) {
  const out = [];
  for (const cap of CAPS) {
    const rr = o.ritmos[cap];
    if (!rr) continue;
    const v = Math.min(1, rr.v);
    const dTomada = o.decisiones[cap] && decisionTomada(o.decisiones[cap]);
    if (v >= 0.97 && !dTomada) continue; // una decisión ya tomada se conserva hasta cerrar el ciclo
    const dec = o.decisiones[cap] || { estado: 'abierta', opcion: null, nota: '', responsable: null, plazo: null };
    const diasSin = Math.max(0, Math.round(endOf(o, projectSchedule(o, ritmosOnly(o, cap, v))) - o.planEnd));
    const diasRef = Math.max(0, Math.round(endOf(o, projectSchedule(o, ritmosOnly(o, cap, v + (1 - v) * recoverOf(o)))) - o.planEnd));
    const activa = o.acts.find(a => a.cap === cap && a.pct > 0 && a.pct < 0.999) || null;
    const atraso = activa ? Math.max(0, (planPctAct(o, activa) - activa.pct) * activa.dur) : 0;
    const restantes = o.acts.filter(a => a.cap === cap && a.pct < 0.999).length;
    const sev = diasSin >= 7 ? 'alta' : diasSin >= 2 ? 'media' : 'vigilar';
    out.push({ cap, crew: CREW[cap], ritmo: v, activa, atraso, restantes, diasSin, diasRef, sev, dec });
  }
  const ord = { alta: 0, media: 1, vigilar: 2 };
  out.sort((a, b) => ord[a.sev] - ord[b.sev] || b.diasSin - a.diasSin);
  return out;
}
const alertaAbierta = a => a.sev !== 'vigilar' && ['abierta', 'en_comite'].includes(a.dec.estado || 'abierta');
function opcionCostos(o, a) {
  const cd = costDia(o), ref = (a.dec.costoRefuerzo != null ? a.dec.costoRefuerzo : o.refuerzoBase);
  return { seguir: a.diasSin * cd, reforzar: a.diasRef * cd + ref, ref, cd };
}

/* ---------- reportes de obra ---------- */
function parseMessage(o, text) {
  // misma longitud que el texto original, para poder resaltar lo que sustenta cada campo
  const t = text.split('').map(ch => ch.normalize('NFD')[0].toLowerCase()).join('');
  const rules = [
    ['Estructura', /placa|estructura|formaleta|hierro|fundi|vaciado/],
    ['Mampostería', /muro|mamposteria|ladrillo|bloque|latero/],
    ['Instalaciones', /instalacion|hidraulic|electric|sanitari|tuberia|plomer/],
    ['Acabados', /acabado|pintura|estuco|enchape|pintor/],
    ['Fachada', /fachada/], ['Cimentación', /cimentacion|excavacion|pilote/], ['Entrega', /entrega|recibo/]
  ];
  const spans = [];
  let cap = null, m;
  for (const [c, re] of rules) { m = t.match(re); if (m) { cap = c; let e = m.index + m[0].length; while (/[a-z]/.test(t[e] || '')) e++; spans.push({ k: 'act', s: m.index, e }); break; } }
  let nivel = null;
  m = t.match(/(?:nivel|piso|planta)\s*(?:n[°o.]?\s*)?(\d{1,2})/);
  if (!m) m = t.match(/\b(?:del|al)\s+(\d{1,2})\b(?!\s*%)/);
  if (m) { nivel = +m[1]; spans.push({ k: 'act', s: m.index, e: m.index + m[0].length }); }
  const pre = { 'Estructura': 'EST', 'Mampostería': 'MAM', 'Instalaciones': 'INS', 'Acabados': 'ACA' };
  let actId = null;
  if (cap && pre[cap] && nivel) actId = pre[cap] + '-' + nivel;
  else if (cap === 'Fachada') actId = 'FAC';
  else if (cap === 'Cimentación') actId = 'CIM';
  else if (cap === 'Entrega') actId = 'ENT';
  if (actId && !o.acts.some(a => a.id === actId)) actId = null;
  // porcentajes: si hay varios, manda el de hoy y el resto queda como antecedente
  const found = [], re = /(\d{1,3})\s*(?:%|por\s*ciento)/g;
  let prevEnd = 0, mm;
  while ((mm = re.exec(t))) {
    const sep = Math.max(t.lastIndexOf(',', mm.index), t.lastIndexOf(';', mm.index), t.lastIndexOf('.', mm.index), t.lastIndexOf('\n', mm.index));
    const seg = t.slice(Math.max(prevEnd, sep + 1), mm.index);
    let score = 0;
    if (/\b(hoy|ahora|actual|actualmente|va en|vamos en|llevamos|lleva|queda|quedamos|ya va)\b/.test(seg)) score += 2;
    if (/\b(ayer|antier|antes|anterior|estaba|estabamos|habia|semana pasada)\b/.test(seg)) score -= 2;
    found.push({ v: clamp(+mm[1], 0, 100), s: mm.index, e: mm.index + mm[0].length, score });
    prevEnd = mm.index + mm[0].length;
  }
  let pct = null, prev = [];
  if (found.length) {
    let best = found[0];
    for (const f of found) if (f.score >= best.score) best = f;
    pct = best.v; prev = found.filter(f => f !== best).map(f => f.v);
    spans.push({ k: 'pct', s: best.s, e: best.e });
  } else {
    const mt = t.match(/terminad|listo|completo|finalizad/);
    if (mt) { pct = 100; spans.push({ k: 'pct', s: mt.index, e: mt.index + mt[0].length }); }
  }
  let rend = null, rm, last = null;
  const rr = /(\d+(?:[.,]\d+)?)\s*(?:m2|m²|metros)/g;
  while ((rm = rr.exec(t))) last = rm;
  if (last) { rend = parseFloat(last[1].replace(',', '.')); spans.push({ k: 'rend', s: last.index, e: last.index + last[0].length }); }
  const amb = found.length > 1;
  const capsAll = rules.filter(([c, r2]) => r2.test(t)).map(x => x[0]);
  const nivs = new Set(); let nm; const lre = /(?:nivel|piso|planta)\s*(?:n[°o.]?\s*)?(\d{1,2})/g;
  while ((nm = lre.exec(t))) nivs.add(nm[1]);
  const multi = capsAll.length > 1 || nivs.size > 1;
  const cues = {
    material: /no llego (el |la |los |las )?(hierro|concreto|material|bloque|ladrillo|cemento|acero|arena|madera|pedido|despacho)|falta(n)? (el |la |los |las )?(hierro|concreto|material|bloque|ladrillo|cemento|acero|arena|madera)|sin (hierro|concreto|material|cemento)|retraso (del|de) (concreto|hierro|material)/,
    equipo: /grua|equipo|maquina|vibrador|bomba|andamio|montacarga/,
    instruccion: /plano|detalle|instruccion|aprobacion|consulta|calculista|diseno|rfi/,
    personal: /falto(n)? (personal|gente|operarios)|sin (personal|gente)|no hay (gente|personal)|ausen/,
    actividad_previa: /esperando (el )?(desencofrado|fundida|muros|losa|vaciado)|falta (terminar|desencofrar)/,
    permiso: /permiso|licencia|cierre de via/
  };
  let causa = null;
  for (const k of Object.keys(cues)) if (cues[k].test(t)) { causa = k; break; }
  const paroCue = /(paramos|parados|paradas|parado|paro|detenid[oa]s?|sin trabajar|esperando|no pudimos trabajar)/.test(t);
  let personas = null, horas = null, pm = t.match(/(\d+)\s*(personas|operarios|obreros|trabajadores|hombres|ayudantes)/);
  if (pm) { personas = +pm[1]; spans.push({ k: 'paro', s: pm.index, e: pm.index + pm[0].length }); }
  pm = t.match(/(\d+(?:[.,]\d+)?)\s*(horas|hrs|h)\b/);
  if (pm) { horas = parseFloat(pm[1].replace(',', '.')); spans.push({ k: 'paro', s: pm.index, e: pm.index + pm[0].length }); }
  const paro = paroCue && (personas || horas) ? { personas, horas, causa } : null;
  return { actId, pct, rend, cap, amb, multi, prev, spans, paro, causa, conf: actId && pct != null ? (amb || multi ? 'media' : 'alta') : 'baja' };
}
function lastConfirmed(o, actId) {
  return o.reportes.filter(r => r.actId === actId && r.estado === 'confirmado').sort((x, y) => y.dia - x.dia)[0] || null;
}
function actHistory(o, actId) {
  return o.reportes.filter(r => r.actId === actId && r.estado === 'confirmado').sort((x, y) => y.dia - x.dia).slice(0, 6);
}
function dupOf(o, r) {
  return o.reportes.find(x => x.id !== r.id && x.actId && x.actId === r.actId && x.pct === r.pct && x.dia === r.dia && !['descartado', 'corregido'].includes(x.estado)) || null;
}
const qtyDone = a => a.qty * a.pct;
const actFresca = (o, a) => o.hoy - (a.ultimo != null ? a.ultimo : o._plan[a.id].ini) <= 2;
function frescura(o) {
  const enCurso = o.acts.filter(a => a.pct > 0 && a.pct < 0.999);
  return { enCurso, desact: enCurso.filter(a => !actFresca(o, a)) };
}
function previewEdit(o, id, dur) {
  const plan = {}; let moved = 0;
  for (const a of o.acts) {
    let ini = 0;
    for (const p of a.preds) ini = Math.max(ini, plan[p].fin);
    plan[a.id] = { ini, fin: ini + (a.id === id ? dur : a.dur) };
    if (a.id !== id && Math.abs(ini - o._plan[a.id].ini) > 0.01) moved++;
  }
  const end = plan[o.acts[o.acts.length - 1].id].fin;
  return { end, moved, delta: Math.round(end - o.planEnd) };
}
function applyReport(o, r) {
  if (r.pct == null) { // mensaje sin avance (solo tiempo muerto)
    r.estado = 'confirmado'; r.confirmadoDia = o.hoy;
    o.bitacora.unshift({ dia: o.hoy, cap: null, texto: 'Reporte confirmado sin avance: solo tiempo muerto.' });
    return true;
  }
  const a = o.acts.find(x => x.id === r.actId);
  if (!a) return false;
  const dia = r.dia != null ? r.dia : o.hoy;
  if (r.corrige) { const old = o.reportes.find(x => x.id === r.corrige); if (old) old.estado = 'corregido'; }
  a.pct = clamp(r.pct / 100, 0, 1); a.ultimo = dia;
  if (r.rend) a.rendReal = r.rend;
  const pp = planPctAct(o, a);
  let rt = null;
  if (r.rend) rt = r.rend / rendPlan(a);
  else if (pp >= 0.25) rt = a.pct / pp;
  if (rt != null) {
    rt = clamp(rt, 0.3, 1.3);
    const old = o.ritmos[a.cap];
    o.ritmos[a.cap] = { v: old ? (old.v + rt) / 2 : rt, dia };
  }
  r.estado = 'confirmado'; r.confirmadoDia = o.hoy;
  o.bitacora.unshift({ dia: o.hoy, cap: a.cap, texto: (r.corrige ? 'Corrección confirmada: ' : 'Reporte confirmado: ') + a.nombre + ' al ' + Math.round(r.pct) + '%.' });
  return true;
}
const MSG = {
  'Estructura': (a, p, r) => 'Ing., la placa del ' + a.nivel + ' va en el ' + p + '%, hoy sacamos ' + r + ' m2.',
  'Mampostería': (a, p) => 'Muros del piso ' + a.nivel + ' llevamos el ' + p + '%.',
  'Instalaciones': (a, p) => 'Instalaciones piso ' + a.nivel + ' al ' + p + '%, falta la prueba de presión.',
  'Acabados': (a, p) => 'Acabados piso ' + a.nivel + ' va en ' + p + '%.',
  'Fachada': (a, p, r) => 'Fachada: llevamos el ' + p + '%, hoy ' + r + ' m2.',
  'Cimentación': (a, p) => 'Cimentación al ' + p + '%.', 'Entrega': (a, p) => 'Entrega de obra al ' + p + '%.'
};
function simulateInbox(S, o) {
  const R = rng(S.seq * 7919 + o.hoy);
  const pend = new Set(o.reportes.filter(r => r.estado === 'pendiente').map(r => r.actId));
  const act = o.acts.filter(a => a.pct > 0 && a.pct < 0.999 && !pend.has(a.id)).slice(0, 3);
  let n = 0;
  for (const a of act) {
    const pctN = Math.min(100, Math.round((a.pct + 0.08 + R() * 0.1) * 100));
    const rt = o.ritmos[a.cap] ? o.ritmos[a.cap].v : 1;
    const rend = a.cap === 'Cimentación' || a.cap === 'Entrega' || a.cap === 'Instalaciones' ? null : Math.round(rendPlan(a) * clamp(rt + (R() - 0.5) * 0.12, 0.6, 1.1));
    const h = 7 + Math.floor(R() * 10), mi = Math.floor(R() * 60);
    o.reportes.unshift({
      id: 'r' + (S.seq++), actId: a.id, pct: pctN, rend, fuente: R() > 0.3 ? 'WhatsApp' : 'Foto', fotos: Math.floor(R() * 6),
      autor: BOSS[a.cap], texto: MSG[a.cap](a, pctN, rend), dia: o.hoy, hora: pad(h) + ':' + pad(mi), estado: 'pendiente'
    });
    n++;
  }
  return n;
}

/* ---------- personal ---------- */
const docEstado = (o, v) => v == null ? 'falta' : (v - o.hoy < 0 ? 'vencido' : v - o.hoy <= 15 ? 'pronto' : 'ok');
function workerPend(o, w) {
  const p = [];
  if (['falta', 'vencido'].includes(docEstado(o, w.exam))) p.push('examen médico');
  if (['falta', 'vencido'].includes(docEstado(o, w.alturas))) p.push('curso de alturas');
  if (!w.arl) p.push('ARL');
  if (!w.prest) p.push('prestaciones');
  return p;
}
function workerEstado(o, w) {
  const pend = workerPend(o, w);
  return { docs: pend.length ? 'pendiente' : 'completo', pend, aut: w.aut ? 'autorizado' : 'sin autorizar' };
}
function rotacion(o) {
  const ret = o.personal.filter(w => w.retiroDia != null && w.retiroDia >= o.hoy - 22);
  const rapidos = ret.filter(w => w.retiroDia - w.ingresoDia < 5);
  return { retirados: ret.length, rapidos: rapidos.length, perdido: rapidos.length * o.costoIngreso };
}

/* ---------- bloqueos, tiempos muertos y valor ---------- */
const BLQ_TIPOS = { material: 'Material', instruccion: 'Instrucción o diseño', equipo: 'Equipo', actividad_previa: 'Actividad previa', personal: 'Personal y documentos', permiso: 'Permiso o licencia' };
const BLQ_RESP = { material: 'compras', instruccion: 'diseno', equipo: 'residente', actividad_previa: 'residente', personal: 'sst', permiso: 'director' };
const avancePlanAt = (o, d) => { let w = 0, p = 0; for (const a of o.acts) { w += a.dur; p += a.dur * clamp((d - o._plan[a.id].ini) / a.dur, 0, 1); } return w ? p / w : 0; };
const contratoDe = (o, cap) => (o.contratos && o.contratos[cap]) || 'directo';
function costoParo(o, p) { return p.personas * p.horas * costoHora(o); }
function bloqueosCalculados(o) {
  const ov = overall(o), out = [];
  for (const a of o.acts) {
    if (a.pct > 0) continue;
    const pl = o._plan[a.id];
    if (pl.ini < o.hoy || pl.ini > o.hoy + 15) continue;
    for (const p of a.preds) {
      const pa = o.acts.find(x => x.id === p), pf = ov.m[p].fin;
      if (pa.pct > 0 && pa.pct < 0.999 && pf > pl.ini + 0.5) out.push({ id: 'calc-' + a.id + '-' + p, calc: true, tipo: 'actividad_previa', cap: a.cap, actId: a.id, predId: p, titulo: a.nombre + ' no puede arrancar el ' + fmtDiaY(o, pl.ini) + ': ' + pa.nombre + ' termina el ' + fmtDiaY(o, pf), reqDia: pl.ini, retraso: Math.round(pf - pl.ini), resp: 'residente', estado: 'abierto', personas: 0 });
    }
  }
  return out;
}
const bloqueosAbiertos = o => o.bloqueos.filter(b => b.estado !== 'resuelto').concat(bloqueosCalculados(o));
function lookahead(o, dias) {
  const lim = o.hoy + (dias || 15), bl = bloqueosAbiertos(o);
  return o.acts.filter(a => a.pct < 0.999 && o._plan[a.id].ini <= lim && (o._plan[a.id].fin >= o.hoy)).map(a => {
    const r = bl.filter(b => b.actId === a.id), vencida = r.some(b => b.reqDia <= o.hoy);
    return { a, ini: o._plan[a.id].ini, restr: r, estado: !r.length ? 'liberada' : vencida ? 'bloqueada' : 'restriccion' };
  }).sort((x, y) => x.ini - y.ini);
}
function serieS(o) {
  const plan = [], W = o.totalSem;
  for (let w = 0; w <= W; w++) plan.push([w * 5, avancePlanAt(o, w * 5)]);
  const av = avance(o).real, real = o.serie.filter(p => p[0] < o.hoy).concat(o.hoy > 0 ? [[o.hoy, av]] : []);
  const ov = overall(o), proy = o.hoy > 0 && av < 0.999 ? [[o.hoy, av], [o.planEnd + ov.dias, 1]] : [];
  return { plan, real, proy };
}
function parosVentana(o, dias) { return o.paros.filter(p => p.dia >= o.hoy - (dias || 20)); }
function valor(o) {
  const w0 = o.hoy - 20, cd = costDia(o), ch = costoHora(o), A = o.adm, enW = r => r.dia != null && r.dia >= w0;
  const conf = o.reportes.filter(r => r.estado === 'confirmado' && enW(r)).length + (A.previos || 0);
  const corr = o.reportes.filter(r => r.estado === 'corregido' && enW(r)).length + (A.corrPrevios || 0);
  const inf = (o.informes || []).filter(i => i.dia == null || i.dia >= w0).length + (A.informesPrevios || 0);
  const horasAdm = Math.max(0, conf * (A.minManual - A.minRevision) / 60 - corr * A.minCorreccion / 60 + inf * (A.informeManual - A.informeRevision) / 60);
  const adm = { conf, corr, inf, horas: horasAdm, valor: horasAdm * A.costoHora };
  const paros = parosVentana(o, 20), porCausa = {}; let horasPerd = 0, costoPerd = 0, subPerd = 0;
  for (const p of paros) { const h = p.personas * p.horas; horasPerd += h; porCausa[p.tipo] = (porCausa[p.tipo] || 0) + h; costoPerd += h * ch; if (contratoDe(o, p.cap) === 'precio_fijo') subPerd += h * ch; }
  const evit = o.bloqueos.filter(b => b.estado === 'resuelto' && b.resueltoDia != null && b.resueltoDia <= b.reqDia && b.resueltoDia >= w0 && b.personas && !o.paros.some(p => p.bloqueoId === b.id));
  let horasEvit = 0, evitSub = 0;
  for (const b of evit) { const h = b.personas * 8 * o.paroEsperado; horasEvit += h; if (contratoDe(o, b.cap) === 'precio_fijo') evitSub += h; }
  const prod = { horasPerd, costoPerd, subPerd, porCausa, horasEvit, evitN: evit.length, capDirecta: (horasEvit - evitSub) * ch, capSub: evitSub * ch, horasDirectas: horasEvit - evitSub, horasSub: evitSub };
  const items = [];
  for (const al of computeAlerts(o)) {
    const d = al.dec;
    if (!decisionTomada(d) || d.diasSinBase == null) continue;
    const actual = d.estado === 'verificada' ? al.diasSin : (d.opcion === 'reforzar' ? al.diasRef : al.diasSin);
    const dEv = Math.max(0, d.diasSinBase - actual), porDia = contratoDe(o, al.cap) === 'precio_fijo' ? o.fijoDia : cd;
    const ref = d.opcion === 'reforzar' ? (d.costoRefuerzo != null ? d.costoRefuerzo : o.refuerzoBase) : 0;
    items.push({ cap: al.cap, dias: dEv, bruto: dEv * porDia, refuerzo: ref, neto: dEv * porDia - ref, medido: d.estado === 'verificada', contrato: contratoDe(o, al.cap), opcion: d.opcion });
  }
  const atraso = { items, dias: items.reduce((x, i) => x + i.dias, 0), bruto: items.reduce((x, i) => x + i.bruto, 0), refuerzos: items.reduce((x, i) => x + i.refuerzo, 0) };
  atraso.neto = atraso.bruto - atraso.refuerzos;
  const plataforma = o.plataformaMes * 1 + o.implementacion; // un mes de piloto
  const netoCaja = atraso.neto - plataforma;
  const enJuego = overall(o);
  return { w0, adm, prod, atraso, plataforma, netoCaja, enJuego };
}
function registrarParo(S, o, d) {
  const dia = d.dia != null ? d.dia : o.hoy;
  let b = d.bloqueoId ? o.bloqueos.find(x => x.id === d.bloqueoId) : null;
  if (!b) {
    b = { id: 'b' + (S.seq++), tipo: d.tipo, cap: d.cap, actId: d.actId || null, titulo: d.titulo, detalle: d.detalle || '', resp: d.resp || BLQ_RESP[d.tipo], reqDia: d.reqDia != null ? d.reqDia : dia, estado: 'en_gestion', creadoDia: dia, personas: d.personas, fuente: d.fuente || null };
    o.bloqueos.unshift(b);
  }
  o.paros.unshift({ id: 'p' + (S.seq++), dia, cap: d.cap, bloqueoId: b.id, tipo: d.tipo, personas: d.personas, horas: d.horas });
  o.bitacora.unshift({ dia: o.hoy, cap: d.cap, texto: 'Tiempo muerto registrado: ' + d.personas + ' personas × ' + d.horas + ' h (' + BLQ_TIPOS[d.tipo].toLowerCase() + ').' });
  return b;
}
function bloqueoTitulo(texto) {
  let t = texto.includes(':') ? texto.slice(texto.indexOf(':') + 1) : texto;
  t = t.split(/[.!?]/)[0].trim();
  if (!t) t = texto.trim();
  t = t.charAt(0).toUpperCase() + t.slice(1);
  return t.length > 90 ? t.slice(0, 87) + '…' : t;
}
function inyectarParo(S, o) {
  const id = 'r' + (S.seq++);
  o.reportes.unshift({ id, actId: 'EST-9', pct: 60, rend: 13, fuente: 'WhatsApp', fotos: 3, autor: BOSS['Estructura'], texto: 'Ing., paramos 8 personas 4 horas: la grúa torre sigue en mantenimiento y no llegó el técnico. Placa del 9 va en el 60%, sacamos 13 m2.', dia: o.hoy, hora: '10:20', estado: 'pendiente' });
  return id;
}

/* ---------- datos de ejemplo ---------- */
const PRES = [['Cimentación', .09], ['Estructura', .27], ['Mampostería', .12], ['Instalaciones', .17], ['Acabados', .22], ['Fachada', .07], ['Administración de obra', .06]];
function buildObra(cfg, anchor) {
  const o = {
    id: cfg.id, nombre: cfg.nombre, tipo: cfg.tipo, pisos: cfg.pisos, unidades: cfg.unidades, planEstado: cfg.planEstado,
    trabajadores: 60, costoMensual: 3000000, fijoDia: 4000000, refuerzoBase: 15000000, costoIngreso: 780000,
    acts: buildActs(cfg.pisos), ritmos: {}, decisiones: {}, reportes: [], bitacora: [], personal: [], presupuesto: [], hoy: 0,
    planVer: 1, recover: RECOVER, roles: Object.assign({}, ROLES), informes: [],
    bloqueos: [], paros: [], serie: [], paroEsperado: 2, plataformaMes: 0, implementacion: 0,
    adm: { minManual: 20, minRevision: 4, minCorreccion: 6, informeManual: 180, informeRevision: 20, costoHora: 30000, previos: 110, corrPrevios: 6, informesPrevios: 3 },
    contratos: { 'Cimentación': 'directo', 'Estructura': 'directo', 'Mampostería': 'precio_fijo', 'Instalaciones': 'precio_fijo', 'Acabados': 'precio_fijo', 'Fachada': 'precio_fijo', 'Entrega': 'directo' },
    hipotesis: { horasAdm: 40, horasEvit: 200, dias: 10 }
  };
  recompute(o);
  o.baseEnd = o.planEnd;
  o.hoy = cfg.hoy === 'fin-20' ? Math.round(o.planEnd - 20) : cfg.hoy;
  o.fecha0 = isoOf(addWD(parseISO(anchor), cfg.hoy === 0 ? 15 : -o.hoy));
  const total = cfg.pisos * 2100e6;
  o.presupuesto = PRES.map(([cap, s]) => ({ cap, valor: Math.round(total * s / 1e6) * 1e6, estado: cfg.planEstado === 'validado' ? 'validado' : 'borrador', gasto: 0, comprometido: 0 }));
  return o;
}
function seedProgress(o, capRitmos) {
  for (const a of o.acts) {
    const pp = planPctAct(o, a);
    if (pp >= 1) a.pct = 1;
    else if (pp > 0) { a.pct = pp * (capRitmos[a.cap] || 1); a.ultimo = o.hoy - 1; }
  }
  for (const c of Object.keys(capRitmos)) o.ritmos[c] = { v: capRitmos[c], dia: o.hoy - 1 };
}
function seedPersonal(o, n, R, retirados) {
  const NOM = ['Carlos R.', 'Jhon F.', 'Edwin M.', 'Wilson P.', 'Andrés L.', 'Duván C.', 'Yeison T.', 'Mauricio G.', 'Óscar B.', 'Fabián H.', 'Néstor V.', 'Leidy A.', 'Brayan S.', 'Hugo D.', 'Camilo Z.', 'Iván N.', 'Jairo K.', 'Elkin O.', 'Darío J.', 'Mateo Q.'];
  const OF = { 'Estructura': ['Formaletero', 'Ayudante de formaleta', 'Figurador'], 'Mampostería': ['Latero', 'Ayudante'], 'Instalaciones': ['Plomero', 'Electricista'], 'Acabados': ['Pintor', 'Enchapador'], 'Fachada': ['Fachalero'] };
  const caps = Object.keys(OF), out = [];
  for (let i = 0; i < n + retirados; i++) {
    const cap = caps[i % caps.length], of = OF[cap][Math.floor(R() * OF[cap].length)];
    const w = {
      id: 'w' + i, nombre: NOM[i % NOM.length], oficio: of, crew: CREW[cap],
      ingresoDia: o.hoy - Math.floor(R() * 150) - 8,
      exam: o.hoy + Math.floor(R() * 150) - 12, alturas: o.hoy + Math.floor(R() * 200) - 14,
      arl: R() > 0.07, prest: R() > 0.1, retiroDia: null, aut: null
    };
    if (i >= n) { w.retiroDia = o.hoy - 2 - Math.floor(R() * 18); w.ingresoDia = i - n < 3 ? w.retiroDia - 2 - Math.floor(R() * 3) : w.retiroDia - 40; }
    out.push(w);
  }
  return out;
}
function seedHistory(o, stale) {
  const out = [];
  for (const a of o.acts) {
    if (!(a.pct > 0 && a.pct < 0.999)) continue;
    const ini = o._plan[a.id].ini, rate = a.pct / Math.max(1, o.hoy - ini), rt = o.ritmos[a.cap] ? Math.min(1, o.ritmos[a.cap].v) : 1;
    for (let k = 0; k < 3; k++) {
      const dia = o.hoy - 1 - ((stale && stale[a.id]) || 0) - 2 * k, v = a.pct - k * 2 * rate;
      if (dia <= ini || v <= 0.03) break;
      if (k === 0) a.ultimo = dia;
      const p = Math.round(v * 100), rend = ['Estructura', 'Mampostería', 'Fachada'].includes(a.cap) ? Math.round(rendPlan(a) * rt) : null;
      out.push({ id: 'h-' + a.id + '-' + k, actId: a.id, pct: p, rend, fuente: 'WhatsApp', fotos: 3, autor: BOSS[a.cap], texto: MSG[a.cap](a, p, rend), dia, hora: '16:' + pad(10 + k * 7), estado: 'confirmado', confirmadoDia: dia });
    }
  }
  return out.sort((x, y) => y.dia - x.dia);
}
function seedCostos(o, R) {
  const admin = avance(o).real;
  for (const l of o.presupuesto) {
    const real = l.cap === 'Administración de obra' ? admin : avance(o, l.cap).real, ganado = l.valor * real;
    l.gasto = Math.round(ganado * (0.97 + R() * 0.1) / 1e6) * 1e6;
    l.comprometido = Math.max(l.gasto, Math.round(l.valor * Math.min(1, real + 0.1 + R() * 0.08) / 1e6) * 1e6);
  }
}
function seedAut(o) {
  let libres = 0;
  for (const w of o.personal) {
    if (workerPend(o, w).length === 0 && w.retiroDia == null && libres < 2) { libres++; continue; }
    if (workerPend(o, w).length === 0 || w.retiroDia != null) w.aut = { por: 'sst', dia: w.ingresoDia };
  }
}
const histBitacora = (o, hist) => hist.map(r => { const a = o.acts.find(x => x.id === r.actId); return { dia: r.dia, cap: a.cap, texto: 'Reporte confirmado: ' + a.nombre + ' al ' + r.pct + '%.' }; });
function seedSerie(o) {
  const W = Math.floor(o.hoy / 5), av = avance(o), k = av.plan > 0 ? 1 - av.real / av.plan : 0;
  o.serie = [];
  for (let w = 0; w < W; w++) o.serie.push([w * 5, avancePlanAt(o, w * 5) * (1 - k * Math.pow(w / Math.max(1, W), 2))]);
}
function seedValor(o, kind) {
  const h = o.hoy, B = (id, tipo, cap, actId, titulo, resp, req, est, creado, personas, extra) => o.bloqueos.push(Object.assign({ id, tipo, cap, actId, titulo, detalle: '', resp, reqDia: req, estado: est, creadoDia: creado, personas }, extra || {}));
  const P = (id, dia, cap, tipo, personas, horas, bloqueoId) => o.paros.push({ id, dia, cap, tipo, personas, horas, bloqueoId });
  if (kind === 'norte') {
    B('b1', 'material', 'Estructura', 'EST-11', 'Hierro de 1/2" del nivel 11 sin fecha de entrega confirmada', 'compras', 220, 'en_gestion', 203, 12, { detalle: 'El proveedor no ha confirmado el despacho. Se necesita para armar la placa del nivel 11.' });
    B('b2', 'instruccion', 'Estructura', 'EST-10', 'Detalle de la rampa del nivel 10 pendiente de aprobación del calculista', 'diseno', 209, 'abierto', 204, 12, { detalle: 'La cuadrilla no puede armar el borde de la placa sin el detalle aprobado.' });
    B('b3', 'equipo', 'Estructura', 'EST-9', 'Grúa torre en mantenimiento', 'residente', 201, 'resuelto', 200, 8, { resueltoDia: 202 });
    B('b4', 'material', 'Estructura', 'EST-9', 'Retraso del concreto premezclado', 'compras', 196, 'resuelto', 196, 12, { resueltoDia: 197 });
    B('b5', 'personal', 'Instalaciones', 'INS-6', '2 plomeros sin curso de alturas vigente', 'sst', 207, 'en_gestion', 203, 2, { detalle: 'No pueden entrar a trabajar en altura hasta renovar el curso.' });
    B('b6', 'material', 'Mampostería', 'MAM-6', 'Bloque N.° 4 agotado: se pidió con anticipación', 'compras', 204, 'resuelto', 199, 6, { resueltoDia: 202 });
    B('b7', 'instruccion', 'Estructura', 'EST-9', 'Detalle de vigas de borde aprobado antes de armar', 'diseno', 200, 'resuelto', 196, 12, { resueltoDia: 199 });
    P('p1', 201, 'Estructura', 'equipo', 8, 4, 'b3'); P('p2', 202, 'Estructura', 'equipo', 8, 4, 'b3'); P('p3', 196, 'Estructura', 'material', 12, 3, 'b4');
  } else if (kind === 'este') {
    B('b1', 'permiso', 'Entrega', 'ENT', 'Certificado de ocupación pendiente de la visita de la curaduría', 'director', h + 5, 'en_gestion', h - 6, 0, { detalle: 'Visita agendada; faltan los planos récord firmados.' });
    B('b2', 'material', 'Fachada', 'FAC', 'Sellante de juntas de fachada: pedido sin confirmar', 'compras', h + 1, 'abierto', h - 1, 6);
    B('b3', 'equipo', 'Fachada', 'FAC', 'Andamio colgante con revisión vencida', 'residente', h - 8, 'resuelto', h - 12, 6, { resueltoDia: h - 10 });
    P('p4', h - 9, 'Fachada', 'equipo', 6, 3, 'b3');
  } else if (kind === 'sur') {
    B('b1', 'permiso', 'Cimentación', 'CIM', 'Licencia de excavación sin radicar', 'director', 0, 'abierto', 0, 0, { detalle: 'La obra no puede arrancar sin la licencia de excavación.' });
    B('b2', 'instruccion', 'Cimentación', 'CIM', 'Planos estructurales de cimentación sin aprobación del calculista', 'diseno', 0, 'en_gestion', 0, 0);
  }
  if (kind !== 'sur') seedSerie(o);
}
function seedState() {
  const anchor = isoOf(new Date());
  const S = { v: VERSION, anchor, obraId: 'norte', seq: 100, obras: [] };

  const norte = buildObra({ id: 'norte', nombre: 'Torre Norte', tipo: 'En ejecución', pisos: 18, unidades: 96, planEstado: 'validado', hoy: 205 }, anchor);
  seedProgress(norte, { 'Estructura': 0.875, 'Mampostería': 0.94 });
  norte.personal = seedPersonal(norte, 16, rng(11), 4);
  norte.reportes = [
    { id: 'r1', actId: 'EST-9', pct: 58, rend: 14, fuente: 'WhatsApp', fotos: 6, autor: BOSS['Estructura'], texto: 'Ing., la placa del 9 va en el 58%, hoy sacamos 14 m2. Mañana seguimos con la fundida.', dia: 205, hora: '16:42', estado: 'pendiente' },
    { id: 'r2', actId: 'MAM-6', pct: 80, rend: null, fuente: 'WhatsApp', fotos: 3, autor: BOSS['Mampostería'], texto: 'Muros del piso 6 llevamos el 80%, falta cerrar el eje F.', dia: 205, hora: '15:10', estado: 'pendiente' },
    { id: 'r3', actId: 'ACA-5', pct: 25, rend: null, fuente: 'Foto', fotos: 2, autor: BOSS['Acabados'], texto: 'Acabados piso 5 va en 25%, estamos con el estuco.', dia: 205, hora: '11:36', estado: 'pendiente' },
    { id: 'r0b', actId: 'EST-8', pct: 100, rend: 16, fuente: 'WhatsApp', fotos: 5, autor: BOSS['Estructura'], texto: 'Placa del 8 terminada, 16 m2 por día.', dia: 198, hora: '17:05', estado: 'confirmado', confirmadoDia: 198 }
  ];
  const hn = seedHistory(norte, { 'MAM-6': 3 });
  norte.reportes = norte.reportes.filter(r => r.estado === 'pendiente').concat(hn.concat(norte.reportes.filter(r => r.estado !== 'pendiente')).sort((x, y) => y.dia - x.dia));
  norte.bitacora = histBitacora(norte, hn).concat([
    { dia: 198, cap: 'Estructura', texto: 'Reporte confirmado: Placa nivel 8 al 100%.' },
    { dia: 190, cap: null, texto: 'Plan validado por el programador de obra.' }
  ]);

  const sur = buildObra({ id: 'sur', nombre: 'Edificio Sur', tipo: 'Por iniciar', pisos: 12, unidades: 64, planEstado: 'borrador', hoy: 0 }, anchor);
  sur.bitacora = [{ dia: 0, cap: null, texto: 'Plan y presupuesto generados desde los planos licenciados (borrador).' }];

  const este = buildObra({ id: 'este', nombre: 'Conjunto Este', tipo: 'Entregando', pisos: 9, unidades: 48, planEstado: 'validado', hoy: 'fin-20' }, anchor);
  seedProgress(este, { 'Fachada': 0.92 });
  este.personal = seedPersonal(este, 6, rng(23), 1);
  este.reportes = [
    { id: 'r4', actId: 'FAC', pct: 90, rend: 18, fuente: 'WhatsApp', fotos: 4, autor: BOSS['Fachada'], texto: 'Fachada: llevamos el 90%, hoy 18 m2.', dia: este.hoy, hora: '16:05', estado: 'pendiente' }
  ];
  const he = seedHistory(este);
  este.reportes = este.reportes.concat(he);
  este.bitacora = histBitacora(este, he);

  seedCostos(norte, rng(5)); seedCostos(este, rng(9)); seedAut(norte); seedAut(este);
  seedValor(norte, 'norte'); seedValor(este, 'este'); seedValor(sur, 'sur');
  S.obras.push(norte, sur, este);
  return S;
}

/* ---------- guardado ---------- */
function hydrate(S) { S.obras.forEach(recompute); return S; }
function loadState() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) { const S = JSON.parse(raw); if (S && S.v === VERSION) return hydrate(S); }
  } catch (e) { /* sin almacenamiento: se usan datos de ejemplo */ }
  return hydrate(seedState());
}
function saveState(S) {
  if (window.TOUR_ACTIVE) return 'demo'; // la demo guiada no toca lo que el usuario tiene guardado
  try { localStorage.setItem(LS_KEY, JSON.stringify(S, (k, v) => k[0] === '_' ? undefined : v)); return true; } catch (e) { return false; }
}
function resetState() { try { localStorage.removeItem(LS_KEY); } catch (e) { /* ignorar */ } return hydrate(seedState()); }
