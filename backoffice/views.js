'use strict';
/* Obra IA · Back office · estructura y pantallas de obra (Obras, Hoy, Plan) + detalle de actividad. */

const ICON = {
  obras: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
  hoy: '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3"/>',
  plan: '<path d="M4 6h9M8 12h12M6 18h8"/>',
  avances: '<path d="M5 19V10M12 19V5M19 19v-6"/>',
  decisiones: '<path d="M12 4l9 16H3z"/><path d="M12 10v4M12 17v.5"/>',
  costos: '<path d="M12 3v18M16 7.5c0-1.5-1.8-2.5-4-2.5s-4 1-4 2.5 1.8 2.3 4 2.8 4 1.3 4 2.8-1.8 2.5-4 2.5-4-1-4-2.5"/>',
  equipo: '<circle cx="9" cy="8" r="3.5"/><path d="M3 20c0-3.5 2.7-6 6-6s6 2.5 6 6M16 5a3.5 3.5 0 010 7M18 14c2 .8 3 2.800 3 6"/>',
  reportes: '<path d="M6 3h9l4 4v14H6z"/><path d="M14 3v5h5M9 13h7M9 17h7"/>',
  config: '<circle cx="12" cy="12" r="3"/><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M18.4 5.6l-2.1 2.1M7.7 16.3l-2.1 2.1"/>',
  bloqueos: '<rect x="5" y="10" width="14" height="10" rx="2"/><path d="M8 10V7a4 4 0 018 0v3"/>',
  valor: '<path d="M4 18l5-6 4 3 7-9"/><path d="M15 6h5v5"/>',
  mas: '<circle cx="5" cy="12" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="19" cy="12" r="1.6"/>'
};
const NAV_MAIN = [['hoy', 'Hoy'], ['plan', 'Plan'], ['avances', 'Avances'], ['bloqueos', 'Bloqueos'], ['decisiones', 'Decisiones'], ['valor', 'Valor'], ['reportes', 'Reportes']];
const NAV_MORE = [['costos', 'Costos'], ['equipo', 'Equipo y documentos'], ['config', 'Configuración']];
const TITLES = {
  obras: ['Obras', 'Todas tus obras de un vistazo'],
  hoy: ['Hoy', 'Lo que necesita tu atención en esta obra'],
  plan: ['Plan de obra', 'La programación completa, de la cimentación a la entrega'],
  avances: ['Avances', 'Lo que reporta la obra, revisado por una persona antes de contar'],
  bloqueos: ['Bloqueos', 'Lo que impide trabajar, antes de que pare la cuadrilla'],
  decisiones: ['Decisiones', 'Del desvío a la decisión y a la comprobación del resultado'],
  valor: ['Valor', 'Menos tiempos muertos, más productividad y mejor control del plazo'],
  reportes: ['Reportes', 'Lo que se presenta al comité, con su versión guardada'],
  costos: ['Costos', 'Presupuesto, valor ganado, gasto real y comprometido'],
  equipo: ['Equipo y documentos', 'Documentos al día y autorización de ingreso a la obra'],
  config: ['Configuración', 'Parámetros de cálculo, responsables y notas del prototipo']
};
const ALIAS = { resumen: 'obras', alertas: 'decisiones', avance: 'avances', presupuesto: 'costos', personal: 'equipo', reporte: 'reportes' };
const SEV = { alta: ['Alta', 'bad'], media: ['Media', 'warn'], vigilar: ['Vigilar', 'info'] };
const DEC = {
  abierta: ['Propuesta', 'warn'], en_comite: ['Para comité', 'info'], decidida: ['Decidida', 'ok'],
  ejecucion: ['En ejecución', 'info'], verificada: ['Verificada', 'ok']
};
const OPCT = { seguir: 'seguir como está', reforzar: 'reforzar la cuadrilla' };

const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const cur = () => S.obras.find(o => o.id === S.obraId);
const pctTxt = x => Math.round(x * 100) + '%';
const pill = (t, k) => `<span class="pill ${k}">${esc(t)}</span>`;
const dias = n => n === 1 ? '1 día' : n + ' días';
const plural = (n, a, b) => n === 1 ? a : b;
const pbar = (pl, re) => `<div class="pbar" role="img" aria-label="Plan ${pctTxt(pl)}, real ${pctTxt(re)}"><i class="re" style="width:${(re * 100).toFixed(1)}%"></i><i class="pl" style="left:${(pl * 100).toFixed(1)}%"></i></div>`;
const kpi = (label, val, cls, sub) => `<div class="kpi ${cls || ''}"><small>${label}</small><b>${val}</b>${sub ? `<span>${sub}</span>` : ''}</div>`;
const semana = o => o.hoy === 0 ? 'Inicia ' + fmtDiaY(o, 0) : 'Semana ' + (Math.floor(o.hoy / 5) + 1) + ' de ' + o.totalSem;
const corte = o => (o.hoy === 0 ? 'Inicio previsto ' : 'Corte ') + fmtDiaY(o, o.hoy);
const pendRep = o => o.reportes.filter(r => r.estado === 'pendiente');
const personalPend = o => o.personal.filter(w => w.retiroDia == null && workerPend(o, w).length);
const equipoPend = o => o.personal.filter(w => w.retiroDia == null && (workerPend(o, w).length || !w.aut));
const quien = (o, k) => (o.roles && o.roles[k]) || ROLES[k] || k;
const actLink = (o, id) => { const a = o.acts.find(x => x.id === id); return a ? `<button class="link" data-act="act-detail" data-id="${a.id}">${esc(a.nombre)}</button>` : '—'; };

/* ---------- estructura ---------- */
function saveChip() {
  const s = UI.saved || { s: 'ok' };
  const m = { ok: ['Guardado en este navegador' + (s.t ? ' · ' + s.t : ''), 'ok'], demo: ['Demo: nada se guarda', 'info'], err: ['No se pudo guardar: el navegador bloquea el almacenamiento', 'bad'] }[s.s] || ['', 'ok'];
  return `<span class="chip savechip ${m[1]}" id="saveState" role="status">${m[0]}</span>`;
}
function shell(route, body) {
  const o = cur();
  const badges = { avances: pendRep(o).length, bloqueos: bloqueosAbiertos(o).filter(b => b.reqDia <= o.hoy + 5).length, decisiones: computeAlerts(o).filter(alertaAbierta).length, equipo: equipoPend(o).length };
  const svg = id => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICON[id]}</svg>`;
  const link = ([id, l]) => `<a href="#/${id}" class="${route === id ? 'on' : ''}"${route === id ? ' aria-current="page"' : ''}>${svg(id)}<span>${l}</span>${badges[id] ? `<em aria-label="${badges[id]} pendientes">${badges[id]}</em>` : ''}</a>`;
  const [t, sub] = TITLES[route];
  const moreActive = NAV_MORE.some(x => x[0] === route) || ['obras', 'plan', 'valor', 'reportes'].includes(route);
  return `<aside class="side">
    <div class="brand"><i><svg viewBox="0 0 32 32" fill="none" aria-hidden="true"><path d="M7 25h18M9.5 25V13.5L16 8.5l6.5 5V25" stroke="#FAFAFA" stroke-width="2.2" stroke-linejoin="round"/><circle cx="16" cy="17.5" r="3" fill="#E0FEA2"/></svg></i><span>Obra IA<small>Back office</small></span></div>
    <button class="tour-btn" data-act="tour-start"><svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5v14l11-7z"/></svg>Ver demo guiada</button>
    <nav aria-label="Portafolio"><p class="nav-h">Portafolio</p>${link(['obras', 'Obras'])}</nav>
    <label class="obra-sel"><small>Obra</small>
      <select data-bind="obra" aria-label="Obra">${S.obras.map(x => `<option value="${x.id}"${x.id === S.obraId ? ' selected' : ''}>${esc(x.nombre)}</option>`).join('')}</select>
    </label>
    <nav aria-label="Esta obra"><p class="nav-h">${esc(o.nombre)}</p>${NAV_MAIN.map(link).join('')}</nav>
    <nav aria-label="Más"><p class="nav-h">Más</p>${NAV_MORE.map(link).join('')}</nav>
    <div class="side-foot"><span class="sample">Prototipo · datos de ejemplo</span><button class="link" data-act="reset">Volver a los datos de ejemplo</button></div>
  </aside>
  <main id="main">
    <header class="top"><div><h1>${t}</h1><p>${sub}</p></div>
      <div class="chips"><span class="chip">${esc(o.nombre)}</span><span class="chip mono">${semana(o)}</span><span class="chip mono" title="Las duraciones se miden en días hábiles (lunes a viernes) y los valores están en pesos colombianos">${corte(o)} · días hábiles · COP</span>${saveChip()}</div></header>
    <div class="content">${body}</div>
  </main>
  <nav class="mnav" aria-label="Navegación principal">${NAV_MAIN.filter(x => ['hoy', 'avances', 'bloqueos', 'decisiones'].includes(x[0])).map(([id, l]) => `<a href="#/${id}" class="${route === id ? 'on' : ''}">${svg(id)}<span>${l}</span>${badges[id] ? `<em>${badges[id]}</em>` : ''}</a>`).join('')}<button class="${moreActive || UI.sheet ? 'on' : ''}" data-act="sheet-toggle" aria-expanded="${!!UI.sheet}">${svg('mas')}<span>Más</span></button></nav>
  <button class="fab" data-act="fab-capture" aria-label="Registrar un mensaje de la obra"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>Mensaje</button>
  ${UI.sheet ? `<div class="msheet" role="dialog" aria-label="Más secciones"><a href="#/obras">Obras</a><a href="#/plan">Plan</a><a href="#/valor">Valor</a><a href="#/reportes">Reportes</a>${NAV_MORE.map(([id, l]) => `<a href="#/${id}">${l}${badges[id] ? ` <em>${badges[id]}</em>` : ''}</a>`).join('')}<button data-act="tour-start">Ver demo guiada</button></div>` : ''}`;
}

/* ---------- obras (portafolio) ---------- */
function vObras() {
  const rows = S.obras.map(o => ({ o, av: avance(o), ov: overall(o), al: computeAlerts(o).filter(alertaAbierta).length, pend: pendRep(o).length }));
  const totAl = rows.reduce((s, r) => s + r.al, 0), totPend = rows.reduce((s, r) => s + r.pend, 0), totCost = rows.reduce((s, r) => s + r.ov.costo, 0);
  return `<div class="kpis">
      ${kpi('Obras', S.obras.length)}${kpi('Reportes por confirmar', totPend, totPend ? 'warn' : '')}
      ${kpi('Decisiones abiertas', totAl, totAl ? 'bad' : '')}${kpi('Costo proyectado', fmtM(totCost), totCost ? 'bad' : '', 'atraso + refuerzos decididos')}
    </div>
    <div class="obras">${rows.map(({ o: x, av, ov, al, pend: p }) => `
      <article class="card obra ${x.id === S.obraId ? 'sel' : ''}">
        <div class="obra-h"><div><h2>${esc(x.nombre)}</h2><span>${x.pisos} pisos · ${x.unidades} apartamentos</span></div>${pill(x.tipo, x.tipo === 'En ejecución' ? 'info' : x.tipo === 'Entregando' ? 'ok' : 'mute')}</div>
        <div class="obra-b">
          <div><small>${semana(x)}</small>${pbar(av.plan, av.real)}<div class="two"><span>Plan <b>${pctTxt(av.plan)}</b></span><span>Real <b>${pctTxt(av.real)}</b></span></div></div>
          <div class="obra-m"><div><small>Atraso proyectado</small><b class="${ov.dias ? 'bad' : ''}">${ov.dias ? dias(ov.dias) : 'Sin atraso'}</b></div><div><small>Costo proyectado</small><b>${ov.costo ? fmtM(ov.costo) : '—'}</b></div><div><small>Decisiones abiertas</small><b>${al}</b></div><div><small>Por confirmar</small><b>${p}</b></div></div>
        </div>
        <button class="btn ghost" data-act="open-obra" data-id="${x.id}">Abrir ${esc(x.nombre)}</button>
      </article>`).join('')}</div>`;
}

/* ---------- hoy ---------- */
function intervenciones(o) {
  const L = [], pend = pendRep(o), fr = frescura(o), eq = equipoPend(o);
  for (const a of computeAlerts(o)) {
    if (a.sev === 'vigilar') continue;
    const d = a.dec, e = d.estado || 'abierta', resp = quien(o, d.responsable || 'director');
    if (e === 'abierta' || e === 'en_comite') L.push({ p: 100 + a.diasSin, motivo: `${a.cap}: ritmo al ${pctTxt(a.ritmo)} del plan; la entrega se mueve ${dias(a.diasSin)} (${fmtM(opcionCostos(o, a).seguir)} si no se hace nada).`, resp, accion: 'Decidir si se sigue o se refuerza la cuadrilla.', ruta: 'decisiones', btn: 'Decidir', cap: a.cap });
    else if (e === 'decidida') L.push({ p: 75, motivo: `${a.cap}: decisión tomada (${OPCT[d.opcion]}) que falta ejecutar.`, resp, accion: 'Marcar en ejecución.', ruta: 'decisiones', btn: 'Ejecutar', cap: a.cap });
    else if (e === 'ejecucion') L.push({ p: 65, motivo: `${a.cap}: ${OPCT[d.opcion]} en ejecución; falta comprobar el resultado.`, resp, accion: 'Registrar el ritmo observado.', ruta: 'decisiones', btn: 'Verificar', cap: a.cap });
  }
  for (const b of bloqueosAbiertos(o)) {
    if (b.calc || b.reqDia > o.hoy + 6) continue;
    const dd = b.reqDia - o.hoy, act = o.acts.find(x => x.id === b.actId);
    L.push({ p: 95 - Math.max(0, dd), motivo: `${BLQ_TIPOS[b.tipo]}: ${b.titulo}. ${dd <= 0 ? 'Ya se necesita.' : 'Se necesita en ' + dias(dd) + (act ? ' para ' + act.nombre : '') + '.'}`, resp: quien(o, b.resp), accion: b.estado === 'en_gestion' ? 'Confirmar la fecha de resolución.' : 'Asignar y resolver antes de que pare la cuadrilla.', ruta: 'bloqueos', btn: 'Resolver' });
  }
  if (pend.length) L.push({ p: 80, motivo: `${pend.length} reporte${plural(pend.length, '', 's')} de obra por confirmar.`, resp: quien(o, 'residente'), accion: 'Revisar y confirmar para recalcular el plan.', ruta: 'avances', btn: 'Revisar' });
  if (fr.desact.length) L.push({ p: 70, motivo: `${fr.desact.length} actividad${plural(fr.desact.length, '', 'es')} en curso sin reporte hace más de 2 días: ${fr.desact.map(a => a.nombre).join(', ')}.`, resp: quien(o, 'residente'), accion: 'Pedir el reporte al contramaestro.', ruta: 'avances', btn: 'Ver avances' });
  if (eq.length) L.push({ p: 50, motivo: `${eq.length} persona${plural(eq.length, '', 's')} con documentos pendientes o sin autorización de ingreso.`, resp: quien(o, 'sst'), accion: 'Completar documentos o autorizar el ingreso.', ruta: 'equipo', btn: 'Revisar' });
  if (o.planEstado === 'borrador') L.push({ p: o.hoy === 0 ? 90 : 85, motivo: o.planVer > 1 ? `El plan v${o.planVer} se editó y falta validarlo.` : 'El plan está en borrador, generado de los planos.', resp: quien(o, 'programador'), accion: 'Revisar y validar el plan.', ruta: 'plan', btn: 'Validar' });
  return L.sort((x, y) => y.p - x.p);
}
function intCard(i, n) {
  return `<article class="card int"><div class="int-h"><span class="num">${n}</span><p><b>${esc(i.motivo)}</b></p></div>
    <dl><div><dt>Responsable</dt><dd>${esc(i.resp)}</dd></div><div><dt>Acción</dt><dd>${esc(i.accion)}</dd></div></dl>
    <a class="btn primary sm" href="#/${i.ruta}">${i.btn}</a></article>`;
}
function vHoy() {
  const o = cur(), av = avance(o), ov = overall(o), fr = frescura(o), L = intervenciones(o), top = L.slice(0, 3), rest = L.slice(3);
  const delta = Math.round((av.real - av.plan) * 100), pend = pendRep(o).length;
  return `<div class="kpis">
    ${kpi('Entrega prevista', fmtDiaY(o, o.planEnd + ov.dias), ov.dias ? 'bad' : '', ov.dias ? '+' + dias(ov.dias) + ' sobre el plan (' + fmtDiaY(o, o.planEnd) + ')' : 'En fecha según el plan v' + o.planVer)}
    ${kpi('Desviación de avance', (delta > 0 ? '+' : '') + delta + ' pts', delta < -1 ? 'warn' : '', 'Plan ' + pctTxt(av.plan) + ' · real ' + pctTxt(av.real))}
    ${kpi('Actualización de datos', fr.enCurso.length ? (fr.enCurso.length - fr.desact.length) + ' de ' + fr.enCurso.length : '—', fr.desact.length ? 'warn' : '', fr.enCurso.length ? 'actividades con reporte de los últimos 2 días' + (pend ? ' · ' + pend + ' por confirmar' : '') : 'Aún no hay actividades en curso')}
    ${kpi('Costo proyectado', ov.costo ? fmtM(ov.costo) : '—', ov.costo ? 'bad' : '', ov.refuerzos ? 'atraso ' + fmtM(ov.costoAtraso) + ' + refuerzos ' + fmtM(ov.refuerzos) : ov.costo ? 'atraso, si nada cambia' : 'sin atraso proyectado')}
  </div>
  <h2 class="sec">Intervenciones de hoy</h2>
  ${top.length ? `<div class="ints">${top.map((i, k) => intCard(i, k + 1)).join('')}</div>` : '<div class="card"><p class="empty">Nada requiere intervención. Todo va según el plan.</p></div>'}
  ${rest.length ? `<details class="card more"><summary>${rest.length} pendiente${plural(rest.length, '', 's')} más</summary><div class="ints">${rest.map((i, k) => intCard(i, k + 4)).join('')}</div></details>` : ''}
  <div class="cols srow"><div class="card"><div class="card-h"><h2>Avance contra el plan</h2><span class="muted sm">Curva S · datos de ejemplo</span></div>${chartS(o)}</div>
    <div class="card"><h2>Ritmo por cuadrilla</h2>${chartRitmo(o)}</div></div>
  <div class="cols duo"><div class="card"><div class="card-h"><h2>Tiempos muertos por causa</h2><a class="btn ghost sm" href="#/bloqueos">Ver bloqueos</a></div>${chartPareto(o)}</div>
    <div class="card"><div class="card-h"><h2>Valor en esta obra</h2><a class="btn ghost sm" href="#/valor">Ver valor</a></div>${valorMini(o)}</div></div>
  <div class="card"><div class="card-h"><h2>Actividades en curso</h2><span class="muted sm">${fr.enCurso.length} activa${plural(fr.enCurso.length, '', 's')}</span></div>
    ${fr.enCurso.length ? `<div class="tbl-wrap"><table class="tbl"><thead><tr><th scope="col">Actividad</th><th scope="col">Cuadrilla</th><th scope="col" class="w140">Plan / real</th><th scope="col">Último reporte</th><th scope="col">Dato</th></tr></thead><tbody>
    ${fr.enCurso.map(a => { const u = a.ultimo != null ? a.ultimo : o._plan[a.id].ini, f = actFresca(o, a); return `<tr><td>${actLink(o, a.id)}<small>${a.cap}</small></td><td>${esc(a.crew)}</td><td>${pbar(planPctAct(o, a), a.pct)}<small class="mono">${pctTxt(planPctAct(o, a))} · ${pctTxt(a.pct)}</small></td><td class="mono">${fmtDia(o, u)}<small>hace ${dias(Math.max(0, o.hoy - u))}</small></td><td>${pill(f ? 'Al día' : 'Desactualizado', f ? 'ok' : 'warn')}</td></tr>`; }).join('')}
    </tbody></table></div>` : '<p class="empty">Esta obra todavía no tiene actividades en curso.</p>'}</div>`;
}

/* ---------- gantt ---------- */
function gantt(o, rows) {
  const max = o.planEnd + 70, x = d => (d / max * 100).toFixed(2), step = o.totalSem > 50 ? 20 : 10, ticks = [];
  for (let w = 0; w * 5 <= max; w += step) ticks.push(w);
  let h = `<div class="gantt" role="img" aria-label="Cronograma por capítulo"><div class="g-axis"><i></i><div>${ticks.map(w => `<span style="left:${x(w * 5)}%">S${w}</span>`).join('')}</div></div>`;
  rows.forEach(r => {
    const proj = r.projFin > r.fin + 0.5 ? `<div class="g-proj" style="left:${x(r.fin)}%;width:${x(r.projFin - r.fin)}%"></div><span class="g-lbl" style="left:calc(${x(r.projFin)}% + 6px)">+${Math.round(r.projFin - r.fin)} d</span>` : '';
    h += `<div class="g-row"><div class="g-lab">${esc(r.label)}<small>${esc(r.sub)}</small></div><div class="g-track"><div class="g-bar${r.crit ? ' crit' : ''}" style="left:${x(r.ini)}%;width:${x(r.fin - r.ini)}%"><div class="g-fill" style="width:${(r.real * 100).toFixed(1)}%"></div></div>${proj}<i class="g-today" style="left:${x(o.hoy)}%"></i></div></div>`;
  });
  return h + '</div>';
}
function actEstado(o, a) {
  const pp = planPctAct(o, a);
  if (a.pct >= 0.999) return ['Terminada', 'ok'];
  if (a.pct > 0) return pp - a.pct >= 0.08 ? ['Atrasada', 'bad'] : ['En curso', 'info'];
  return pp > 0 ? ['Sin arrancar', 'warn'] : ['Por iniciar', 'mute'];
}

/* ---------- plan ---------- */
function planList(o) {
  const f = UI.filter, q = norm(UI.q || '').trim();
  const enCurso = a => { const p = o._plan[a.id], pp = planPctAct(o, a); return (a.pct > 0 && a.pct < 0.999) || (pp > 0 && pp < 1) || (a.pct === 0 && p.ini >= o.hoy && p.ini <= o.hoy + 12); };
  let list = f === 'todas' ? o.acts : f === 'curso' ? o.acts.filter(enCurso) : o.acts.filter(a => a.cap === f);
  if (q) list = (f === 'curso' ? o.acts : list).filter(a => norm(a.nombre + ' ' + a.cap + ' ' + a.crew).includes(q));
  return list;
}
function planRows(o) {
  const list = planList(o);
  if (!list.length) return '<tr><td colspan="9" class="empty">Ninguna actividad coincide. Cambia la búsqueda o quita los filtros.</td></tr>';
  return list.map(a => {
    const p = o._plan[a.id], pp = planPctAct(o, a), [et, ek] = actEstado(o, a);
    return `<tr class="click" data-act="act-detail" data-id="${a.id}" tabindex="0" aria-label="Ver detalle de ${esc(a.nombre)}">
      <td><b>${esc(a.nombre)}</b><small>${a.cap}</small></td><td>${esc(a.crew)}</td><td class="mono">${fmtDia(o, p.ini)}</td><td class="mono">${fmtDia(o, p.fin)}</td><td class="r mono">${a.dur}</td>
      <td class="r mono">${dots(a.qty)} ${a.und}</td><td class="r mono">${a.und === 'glb' ? '—' : Math.round(rendPlan(a) * 10) / 10 + ' ' + a.und + '/d'}</td><td>${pbar(pp, a.pct)}<small class="mono">${pctTxt(pp)} · ${pctTxt(a.pct)}</small></td><td>${pill(et, ek)}</td></tr>`;
  }).join('');
}
function vPlan() {
  const o = cur(), ov = overall(o), f = UI.filter;
  const banner = o.planEstado === 'borrador'
    ? `<div class="banner warn"><div>${o.planVer > 1 ? `<b>Plan v${o.planVer} editado: falta validarlo.</b> La línea base sigue siendo la entrega del ${fmtDiaY(o, o.baseEnd)}.` : `<b>Plan en borrador.</b> Se generó de los planos licenciados. Tu programador de obra lo revisa, ajusta duraciones y cuadrillas, y lo valida antes de que sea el plan contra el cual se mide.`}</div><button class="btn primary" data-act="plan-validate">Validar plan</button></div>`
    : `<div class="banner ok"><div><b>Plan v${o.planVer} validado.</b> Si cambias la duración de una actividad, se mueven las que dependen de ella y queda como versión nueva por validar.</div></div>`;
  const crit = new Set(['Estructura', 'Fachada', 'Entrega']);
  const rows = CAPS.map(cap => {
    const L = o.acts.filter(a => a.cap === cap), av = avance(o, cap);
    return { label: cap, sub: L.length + (L.length === 1 ? ' actividad' : ' actividades') + ' · ' + pctTxt(av.real), ini: Math.min(...L.map(a => o._plan[a.id].ini)), fin: Math.max(...L.map(a => o._plan[a.id].fin)), real: av.real, projFin: Math.max(...L.map(a => ov.m[a.id].fin)), crit: crit.has(cap) };
  });
  const chips = [['curso', 'En curso'], ['todas', 'Todas (' + o.acts.length + ')']].concat(CAPS.slice(0, 6).map(c => [c, c]));
  const filtrado = f !== 'curso' || (UI.q || '').trim();
  return banner + `<div class="card"><div class="card-h"><h2>Cronograma por capítulo</h2><span class="legend"><i class="lg lime"></i>Avance real <i class="lg bar"></i>Duración planeada <i class="lg hoy"></i>Hoy <i class="lg proj"></i>Atraso proyectado</span></div>${gantt(o, rows)}
    <p class="muted sm">Línea base: entrega <b>${fmtDiaY(o, o.baseEnd)}</b> · Plan v${o.planVer}: <b>${fmtDiaY(o, o.planEnd)}</b>${o.planEnd !== o.baseEnd ? ' (' + (o.planEnd > o.baseEnd ? '+' : '') + dias(Math.round(o.planEnd - o.baseEnd)) + ' frente a la línea base)' : ''}${ov.dias ? ` · con el ritmo actual: <b class="bad">${fmtDiaY(o, o.planEnd + ov.dias)}</b> (+${dias(ov.dias)})` : ''} · días hábiles.</p></div>
    <div class="card"><div class="card-h"><h2>Actividades</h2><div class="plan-tools"><input type="search" id="planQ" class="search" data-act-input="plan-q" aria-label="Buscar actividad o cuadrilla" placeholder="Buscar actividad o cuadrilla" value="${esc(UI.q || '')}">${filtrado ? '<button class="btn ghost sm" data-act="plan-clear">Quitar filtros</button>' : ''}</div></div>
    <div class="chipsel" role="group" aria-label="Filtrar por capítulo">${chips.map(([k, l]) => `<button class="chipb ${f === k ? 'on' : ''}" data-act="plan-filter" data-f="${k}" aria-pressed="${f === k}">${l}</button>`).join('')}</div>
    <div class="tbl-wrap"><table class="tbl"><thead><tr><th scope="col">Actividad</th><th scope="col">Cuadrilla</th><th scope="col">Inicio</th><th scope="col">Fin</th><th scope="col" class="r">Días</th><th scope="col" class="r">Cantidad</th><th scope="col" class="r">Rend. plan</th><th scope="col" class="w140">Plan / real</th><th scope="col">Estado</th></tr></thead>
    <tbody id="planRows">${planRows(o)}</tbody></table></div>
    <p class="muted sm">Toca una fila para abrir el detalle de la actividad: plan, avance confirmado, evidencia, decisiones y cambios.</p></div>`;
}

/* ---------- detalle único de actividad ---------- */
function actDetail(o, a) {
  const p = o._plan[a.id], pp = planPctAct(o, a), [et, ek] = actEstado(o, a), lc = lastConfirmed(o, a.id);
  const succ = o.acts.filter(x => x.preds.includes(a.id));
  const ev = o.reportes.filter(r => r.actId === a.id).sort((x, y) => y.dia - x.dia).slice(0, 8);
  const al = computeAlerts(o).find(x => x.cap === a.cap), bit = o.bitacora.filter(b => b.cap === a.cap).slice(0, 4);
  const est = { confirmado: ['Confirmado', 'ok'], pendiente: ['Por confirmar', 'warn'], descartado: ['Descartado', 'mute'], corregido: ['Corregido', 'mute'] };
  return `<div class="dd"><div class="dd-h"><div><h3>${esc(a.nombre)}</h3><p class="muted sm">${a.cap} · ${esc(a.crew)}</p></div>${pill(et, ek)}</div>
    <div class="dgrid">
      <div><small>Plan v${o.planVer}</small><b>${fmtDia(o, p.ini)} → ${fmtDia(o, p.fin)}</b><span>${a.dur} días hábiles</span></div>
      <div><small>Cantidad y rendimiento</small><b>${dots(a.qty)} ${a.und}</b><span>${a.und === 'glb' ? 'global' : Math.round(rendPlan(a) * 10) / 10 + ' ' + a.und + '/día'}</span></div>
      <div><small>Avance según plan hoy</small><b>${pctTxt(pp)}</b><span>${dots(a.qty * pp)} ${a.und}</span></div>
      <div><small>Avance confirmado</small><b>${pctTxt(a.pct)}</b><span>${dots(qtyDone(a))} ${a.und}${lc ? ' · ' + fmtDia(o, lc.dia) : ''}</span></div>
    </div>
    <h4>Depende de</h4><p>${a.preds.map(id => actLink(o, id)).join(' · ') || 'Ninguna actividad'}</p>
    <h4>Habilita</h4><p>${succ.map(x => actLink(o, x.id)).join(' · ') || 'Es la última actividad del plan'}</p>
    <h4>Evidencia</h4>${ev.length ? `<ul class="evid">${ev.map(r => `<li><span class="mono">${fmtDia(o, r.dia)}</span><span>${r.pct == null ? '—' : r.pct + '% acumulado'}${r.rend ? ' · ' + r.rend + ' ' + a.und + '/día' : ''} · ${esc(r.fuente)}${r.fotos ? ' · ' + r.fotos + ' fotos' : ''} · ${esc(r.autor.split(' · ')[0])}</span>${pill(est[r.estado][0], est[r.estado][1])}</li>`).join('')}</ul>` : '<p class="muted sm">Sin reportes de esta actividad.</p>'}
    ${al ? `<h4>Decisión relacionada</h4><p>${a.cap}: ritmo al ${pctTxt(al.ritmo)} del plan · ${pill(DEC[al.dec.estado || 'abierta'][0], DEC[al.dec.estado || 'abierta'][1])} <a href="#/decisiones" data-act="dlg-close" class="inl-link" data-cap="${a.cap}">Ver decisión</a></p>` : ''}
    <h4>Cambios</h4>${bit.length ? `<ul class="evid">${bit.map(b => `<li><span class="mono">${fmtDia(o, b.dia)}</span><span>${esc(b.texto)}</span></li>`).join('')}</ul>` : '<p class="muted sm">Sin cambios registrados.</p>'}
    <div class="row end"><button class="btn ghost" data-act="dlg-close">Cerrar</button><button class="btn primary" data-act="act-edit" data-id="${a.id}">Editar plan de esta actividad</button></div></div>`;
}

function valorMini(o) {
  const x = valor(o), j = x.enJuego;
  return `<ul class="vm"><li><span>Trabajo administrativo liberado</span><b>${fmtH(x.adm.horas)}</b></li><li><span>Paro evitado por bloqueos resueltos a tiempo</span><b>${fmtH(x.prod.horasEvit)}</b></li><li><span>${x.atraso.items.length ? 'Atraso evitado (neto de refuerzos)' : 'Atraso en juego si nada cambia'}</span><b>${x.atraso.items.length ? fmtM(x.atraso.neto) : dias(j.dias) + ' · ' + fmtM(j.costo)}</b></li></ul><p class="muted sm">Estimado con supuestos de ejemplo; no es un resultado medido.</p>`;
}
