'use strict';
/* Obra IA · Back office · Bloqueos, Valor y gráficos. */

const fmtH = h => (Math.round(h * 10) / 10).toString().replace('.', ',') + ' h';
const BLQ_EST = { abierto: ['Abierto', 'warn'], en_gestion: ['En gestión', 'info'], resuelto: ['Resuelto', 'ok'] };
const LA_EST = { liberada: ['Liberada', 'ok'], restriccion: ['Con restricción', 'warn'], bloqueada: ['Bloqueada', 'bad'] };
const PLAZO_BLQ = [[0, 'Hoy'], [3, 'En 3 días hábiles'], [5, 'En 1 semana'], [10, 'En 2 semanas']];

/* ---------- gráficos ---------- */
function chartS(o) {
  const sr = serieS(o), W = 640, H = 250, m = { l: 44, r: 16, t: 16, b: 32 }, iw = W - m.l - m.r, ih = H - m.t - m.b;
  const ov = overall(o), finProy = o.planEnd + ov.dias, maxD = Math.max(o.planEnd, finProy) + 10;
  const X = d => m.l + d / maxD * iw, Y = p => m.t + (1 - p) * ih;
  const path = a => a.map((p, i) => (i ? 'L' : 'M') + X(p[0]).toFixed(1) + ' ' + Y(p[1]).toFixed(1)).join(' ');
  const av = avance(o);
  let g = [0, .25, .5, .75, 1].map(v => `<line x1="${m.l}" x2="${W - m.r}" y1="${Y(v)}" y2="${Y(v)}" class="gr"/><text x="${m.l - 6}" y="${Y(v) + 4}" text-anchor="end" class="tx">${Math.round(v * 100)}%</text>`).join('');
  const step = o.totalSem > 50 ? 20 : 10;
  for (let w = 0; w * 5 <= maxD; w += step) g += `<text x="${X(w * 5)}" y="${H - 10}" text-anchor="middle" class="tx">S${w}</text>`;
  const hoyX = X(o.hoy);
  return `<svg viewBox="0 0 ${W} ${H}" class="chart" role="img" aria-label="Curva S. Hoy el plan va en ${pctTxt(av.plan)} y lo real en ${pctTxt(av.real)}. Entrega planeada ${fmtDiaY(o, o.planEnd)}${ov.dias ? ', proyectada ' + fmtDiaY(o, finProy) : ''}.">
    ${g}
    <line x1="${X(o.planEnd)}" x2="${X(o.planEnd)}" y1="${m.t}" y2="${m.t + ih}" class="pend"/>
    <path d="${path(sr.plan)}" class="lplan"/>
    ${sr.real.length > 1 ? `<path d="${path(sr.real)}" class="lreal"/>` : ''}
    ${sr.proy.length ? `<path d="${path(sr.proy)}" class="lproy"/>` : ''}
    ${o.hoy > 0 ? `<line x1="${hoyX}" x2="${hoyX}" y1="${m.t}" y2="${m.t + ih}" class="lhoy"/><circle cx="${hoyX}" cy="${Y(av.real)}" r="4.5" class="dot"/><text x="${hoyX + 8}" y="${m.t + 12}" class="tx b">Hoy</text>` : ''}
  </svg>
  <div class="legend"><span><i class="lg ln plan"></i>Plan</span><span><i class="lg ln real"></i>Real</span><span><i class="lg ln proy"></i>Proyección con el ritmo actual</span></div>
  <p class="muted sm">Entrega planeada <b>${fmtDiaY(o, o.planEnd)}</b>${ov.dias ? ` · proyectada <b class="bad">${fmtDiaY(o, finProy)}</b> (+${dias(ov.dias)})` : ' · sin atraso proyectado'}.</p>`;
}
function chartPareto(o) {
  const v = valor(o), c = v.prod.porCausa, k = Object.keys(c).sort((a, b) => c[b] - c[a]), tot = k.reduce((s, x) => s + c[x], 0), mx = Math.max(1, ...k.map(x => c[x])), ch = costoHora(o);
  if (!k.length) return '<p class="empty">No hay tiempos muertos registrados en los últimos 20 días hábiles.</p>';
  return `<div class="par">${k.map(x => `<div class="par-row"><span>${BLQ_TIPOS[x]}</span><div class="par-bar"><i style="width:${(c[x] / mx * 100).toFixed(0)}%"></i></div><b>${fmtH(c[x])} · ${fmtM(c[x] * ch)}</b></div>`).join('')}</div>
    <p class="muted sm">Total: <b>${fmtH(tot)}</b> pagadas sin producir (${fmtM(tot * ch)} a ${fmtCOP(Math.round(ch))} por hora). ${v.prod.subPerd ? 'Parte corresponde a cuadrillas a precio fijo, cuyo costo asume el subcontratista.' : ''}</p>`;
}
function chartRitmo(o) {
  const rows = CAPS.filter(c => o.acts.some(a => a.cap === c && a.pct > 0 && a.pct < 0.999) || o.ritmos[c]);
  if (!rows.length) return '<p class="empty">Todavía no hay ritmos medidos.</p>';
  return `<div class="par">${rows.map(c => { const r = o.ritmos[c] ? o.ritmos[c].v : null, v = r == null ? 0 : Math.min(1.2, r), cls = r == null ? '' : r < 0.9 ? 'bad' : r < 0.97 ? 'warn' : 'ok'; return `<div class="par-row"><span>${c}</span><div class="par-bar rit"><i class="${cls}" style="width:${(v / 1.2 * 100).toFixed(0)}%"></i><u></u></div><b>${r == null ? 'sin dato' : pctTxt(r)}</b></div>`; }).join('')}</div><p class="muted sm">La marca vertical es el 100% del ritmo planeado.</p>`;
}
function puente(items) { // puente de valor: barras con signo
  const mx = Math.max(1, ...items.map(i => Math.abs(i[1])));
  return `<div class="par bridge">${items.map(([l, v, k]) => `<div class="par-row"><span>${l}</span><div class="par-bar ${k || ''}"><i class="${v < 0 ? 'neg' : 'pos'}" style="width:${(Math.abs(v) / mx * 100).toFixed(0)}%"></i></div><b class="${v < 0 ? 'bad' : ''}">${v < 0 ? '−' : ''}${fmtM(Math.abs(v))}</b></div>`).join('')}</div>`;
}

/* ---------- bloqueos ---------- */
function riesgoBloqueo(o, b) { return b.personas ? b.personas * 8 * o.paroEsperado * costoHora(o) : 0; }
function cuandoTxt(o, b) { const d = b.reqDia - o.hoy; return d <= 0 ? '<b class="bad">ya se necesita</b>' : 'en ' + dias(d); }
function bloqueoFila(o, b) {
  const act = o.acts.find(x => x.id === b.actId), est = BLQ_EST[b.estado] || BLQ_EST.abierto, r = riesgoBloqueo(o, b);
  return `<tr class="click" data-act="blq-detail" data-id="${b.id}" tabindex="0" aria-label="Ver detalle del bloqueo">
    <td><b>${esc(b.titulo)}</b><small>${BLQ_TIPOS[b.tipo]}${b.calc ? ' · calculado del plan' : ''}</small></td>
    <td>${act ? esc(act.nombre) : '—'}</td>
    <td class="mono">${fmtDia(o, b.reqDia)}<small>${b.estado === 'resuelto' ? 'resuelto ' + fmtDia(o, b.resueltoDia) : cuandoTxt(o, b)}</small></td>
    <td>${esc(quien(o, b.resp))}</td><td>${b.calc ? pill('Calculado', 'mute') : pill(est[0], est[1])}</td>
    <td class="r mono">${r ? fmtM(r) : '—'}<small>si para la cuadrilla</small></td></tr>`;
}
function vBloqueos() {
  const o = cur(), v = valor(o), abiertos = bloqueosAbiertos(o), res = o.bloqueos.filter(b => b.estado === 'resuelto').sort((x, y) => y.resueltoDia - x.resueltoDia), la = lookahead(o, 15);
  const libres = la.filter(x => x.estado === 'liberada').length, urg = abiertos.filter(b => b.reqDia <= o.hoy + 5).length;
  return `<div class="kpis">
      ${kpi('Bloqueos abiertos', abiertos.length, urg ? 'warn' : '', urg ? urg + ' se necesitan en 5 días o menos' : 'ninguno urgente')}
      ${kpi('Actividades liberadas', la.length ? libres + ' de ' + la.length : '—', la.length && libres < la.length ? 'warn' : '', 'en los próximos 15 días hábiles')}
      ${kpi('Tiempo muerto', fmtH(v.prod.horasPerd), v.prod.horasPerd ? 'bad' : '', fmtM(v.prod.costoPerd) + ' pagados sin producir · 20 días')}
      ${kpi('Resueltos a tiempo', v.prod.evitN, '', fmtH(v.prod.horasEvit) + ' de paro evitadas (estimado)')}
    </div>
    <div class="note"><b>Por qué importa:</b> una alerta sola no ahorra nada. Se ahorra cuando el material, el plano, el equipo o la actividad previa están resueltos <b>antes</b> de que la cuadrilla llegue a esa actividad. Aquí se ve qué le falta a cada actividad para poder arrancar y quién lo resuelve.</div>
    <div class="card look"><div class="card-h"><h2>Look-ahead: próximas 3 semanas</h2><button class="btn primary sm" data-act="blq-new">Registrar bloqueo</button></div>
      ${la.length ? `<div class="tbl-wrap"><table class="tbl"><thead><tr><th scope="col">Actividad</th><th scope="col">Inicio</th><th scope="col">Cuadrilla</th><th scope="col">Qué le falta</th><th scope="col">Estado</th></tr></thead><tbody>
      ${la.map(x => `<tr><td>${actLink(o, x.a.id)}<small>${x.a.cap}</small></td><td class="mono">${fmtDia(o, x.ini)}<small>${x.ini <= o.hoy ? 'en curso' : 'en ' + dias(x.ini - o.hoy)}</small></td><td>${esc(x.a.crew)}</td>
        <td>${x.restr.length ? x.restr.map(b => `<span class="rchip" title="${esc(b.titulo)}">${BLQ_TIPOS[b.tipo]}${b.calc ? ' · previa atrasada' : ''}</span>`).join('') : '<span class="muted sm">Nada pendiente</span>'}</td>
        <td>${pill(LA_EST[x.estado][0], LA_EST[x.estado][1])}</td></tr>`).join('')}</tbody></table></div>` : '<p class="empty">No hay actividades por arrancar en las próximas 3 semanas.</p>'}
      <p class="muted sm">Liberada: nada le impide empezar. Con restricción: falta algo, pero todavía hay tiempo. Bloqueada: lo que falta ya se necesitaba.</p></div>
    <div class="card"><h2>Bloqueos abiertos</h2>
      ${abiertos.length ? `<div class="tbl-wrap"><table class="tbl"><thead><tr><th scope="col">Bloqueo</th><th scope="col">Actividad</th><th scope="col">Se necesita</th><th scope="col">Responsable</th><th scope="col">Estado</th><th scope="col" class="r">Riesgo</th></tr></thead><tbody>${abiertos.sort((x, y) => x.reqDia - y.reqDia).map(b => bloqueoFila(o, b)).join('')}</tbody></table></div>` : '<p class="empty">No hay bloqueos abiertos.</p>'}
      ${res.length ? `<details class="more"><summary>${res.length} resuelto${plural(res.length, '', 's')}</summary><div class="tbl-wrap"><table class="tbl"><tbody>${res.map(b => bloqueoFila(o, b)).join('')}</tbody></table></div></details>` : ''}</div>
    <div class="cols duo"><div class="card"><h2>Tiempos muertos por causa</h2>${chartPareto(o)}</div>
      <div class="card"><h2>Cómo se detecta</h2><ul class="check"><li><b>Del reporte de campo:</b> cuando un mensaje dice que se paró gente (personas, horas y causa), Obra IA lo propone como tiempo muerto y bloqueo para que una persona lo confirme.</li><li><b>Del plan:</b> si una actividad previa va atrasada, Obra IA calcula que la siguiente no podrá arrancar en su fecha.</li><li><b>De tu equipo:</b> cualquiera registra un bloqueo con quién lo resuelve y para cuándo.</li></ul></div></div>`;
}
function blqDetail(o, b) {
  const act = o.acts.find(x => x.id === b.actId), est = b.calc ? ['Calculado', 'mute'] : BLQ_EST[b.estado], r = riesgoBloqueo(o, b);
  const paros = o.paros.filter(p => p.bloqueoId === b.id);
  const aTiempo = b.estado === 'resuelto' && b.resueltoDia <= b.reqDia && !paros.length;
  return `<div class="dd"><div class="dd-h"><div><h3>${esc(b.titulo)}</h3><p class="muted sm">${BLQ_TIPOS[b.tipo]}${act ? ' · ' + esc(act.nombre) : ''}</p></div>${pill(est[0], est[1])}</div>
    ${b.detalle ? `<p>${esc(b.detalle)}</p>` : ''}
    <div class="dgrid"><div><small>Se necesita</small><b>${fmtDiaY(o, b.reqDia)}</b><span>${b.estado === 'resuelto' ? 'resuelto ' + fmtDia(o, b.resueltoDia) : (b.reqDia - o.hoy <= 0 ? 'ya se necesita' : 'en ' + dias(b.reqDia - o.hoy))}</span></div>
      <div><small>Responsable</small><b>${esc(quien(o, b.resp))}</b><span>${b.creadoDia != null ? 'abierto el ' + fmtDia(o, b.creadoDia) : 'calculado del plan'}</span></div>
      <div><small>Personas afectadas</small><b>${b.personas || '—'}</b><span>${b.personas ? 'en ' + (act ? act.crew : 'la cuadrilla') : ''}</span></div>
      <div><small>Riesgo si para</small><b>${r ? fmtM(r) : '—'}</b><span>${b.personas ? b.personas + ' × 8 h × ' + o.paroEsperado + ' días' : ''}</span></div></div>
    ${b.calc ? `<p class="muted sm">Se calcula del plan: la actividad previa termina después de lo que esta necesita. Se resuelve con una decisión sobre la cuadrilla de la actividad previa.</p>` : ''}
    ${paros.length ? `<h4>Tiempo muerto registrado</h4><ul class="evid">${paros.map(p => `<li><span class="mono">${fmtDia(o, p.dia)}</span><span>${p.personas} personas × ${p.horas} h = ${fmtH(p.personas * p.horas)}</span><span class="mono">${fmtM(costoParo(o, p))}</span></li>`).join('')}</ul>` : ''}
    ${b.estado === 'resuelto' ? `<p class="${aTiempo ? 'okbox' : 'warnbox'}">${aTiempo ? 'Resuelto antes de que se necesitara: se evitó un paro estimado de ' + fmtH(b.personas * 8 * o.paroEsperado) + '.' : 'Se resolvió después de que se necesitaba: hubo tiempo muerto.'}</p>` : ''}
    ${!b.calc && b.estado !== 'resuelto' ? `<label class="blk">Responsable<select id="bd-resp">${Object.keys(o.roles).map(k => `<option value="${k}"${k === b.resp ? ' selected' : ''}>${esc(o.roles[k])}</option>`).join('')}</select></label>` : ''}
    <div class="row end"><button class="btn ghost" data-act="dlg-close">Cerrar</button>
      ${b.calc ? `<a class="btn primary" href="#/decisiones" data-act="dlg-close" data-cap="${(act && o.acts.find(x => x.id === b.predId) || act || {}).cap || ''}">Ver decisión</a>`
        : b.estado === 'resuelto' ? `<button class="btn ghost" data-act="blq-reopen" data-id="${b.id}">Reabrir</button>`
        : `${b.estado === 'abierto' ? `<button class="btn ghost" data-act="blq-gestion" data-id="${b.id}">Poner en gestión</button>` : ''}<button class="btn primary" data-act="blq-resolve" data-id="${b.id}">Marcar resuelto</button>`}</div></div>`;
}

/* ---------- valor ---------- */
function calcEscenario(c, o) {
  const costoMes = c.personas * c.costo, valorMes = costoMes * c.pct / 100, capEq = c.personas * c.pct / 100, bruto = valorMes * c.meses;
  let caja = bruto * c.caja / 100, nota = '';
  if (c.fijo) { caja = c.diasPlazo * o.fijoDia; nota = 'A precio fijo, el ahorro laboral queda en el subcontratista. Para el constructor, el beneficio está en el plazo: ' + c.diasPlazo + ' días × ' + fmtM(o.fijoDia) + ' de costos fijos por día.'; }
  const plat = c.plataforma * c.meses + c.impl;
  return { costoMes, valorMes, capEq, bruto, caja, plat, neto: caja - plat, nota };
}
const CALC_DEF = { personas: 50, costo: 3000000, pct: 5, meses: 1, caja: 0, fijo: false, diasPlazo: 0, plataforma: 0, impl: 0 };
const PRESETS = {
  p1: { label: '50 personas · 5%', c: { personas: 50, pct: 5, meses: 1, caja: 0 } },
  p2: { label: '50 personas · 10%', c: { personas: 50, pct: 10, meses: 1, caja: 0 } },
  p3: { label: 'Evitar un mes de una cuadrilla de 10', c: { personas: 10, pct: 100, meses: 1, caja: 100, fijo: false } },
  p4: { label: 'Cuadrilla a precio fijo', c: { personas: 50, pct: 10, meses: 1, caja: 0, fijo: true, diasPlazo: 5 } }
};
function calcOut(o) {
  const c = UI.calc || CALC_DEF, r = calcEscenario(c, o);
  return `<div class="calc-grid">
    <div class="kpi"><small>Costo mensual de las personas cubiertas</small><b>${fmtM(r.costoMes)}</b><span>${c.personas} × ${fmtM(c.costo)}</span></div>
    <div class="kpi"><small>Valor del tiempo recuperado (${c.pct}%)</small><b>${fmtM(r.valorMes)}<em>/mes</em></b><span>${c.meses > 1 ? fmtM(r.bruto) + ' en ' + c.meses + ' meses' : 'capacidad, no caja'}</span></div>
    <div class="kpi"><small>Capacidad equivalente</small><b>${(Math.round(r.capEq * 10) / 10).toString().replace('.', ',')} personas</b><span>con la misma nómina</span></div>
    <div class="kpi ${r.neto > 0 ? '' : 'warn'}"><small>Ahorro en caja, neto</small><b>${fmtM(r.neto)}</b><span>${fmtM(r.caja)} de caja − ${fmtM(r.plat)} de plataforma</span></div></div>
    ${r.nota ? `<p class="infobox">${r.nota}</p>` : ''}
    <p class="muted sm">El ${c.pct}% es una <b>hipótesis para calcular</b>, no un resultado probado. Esos ${fmtM(r.valorMes)} se vuelven ahorro de caja solo si evitan horas extras, contrataciones, retrabajos o una extensión de la obra; si no, se traducen en más producción. ${c.plataforma || c.impl ? '' : 'La plataforma no tiene precio definido: pon uno para ver el neto.'}</p>`;
}
function calcTabla(o) {
  const cm = (UI.calc || CALC_DEF).costo, fila = n => `<tr><td class="r mono">${n}</td><td class="r mono">${fmtM(n * cm)}</td><td class="r mono">${fmtM(n * cm * 0.05)}</td><td class="r mono">${fmtM(n * cm * 0.10)}</td></tr>`;
  return `<div class="tbl-wrap"><table class="tbl"><thead><tr><th scope="col" class="r">Personas cubiertas</th><th scope="col" class="r">Costo mensual</th><th scope="col" class="r">Recuperar 5% del tiempo</th><th scope="col" class="r">Recuperar 10%</th></tr></thead><tbody>${[20, 50, 100].map(fila).join('')}</tbody></table></div>`;
}
const ESCENARIOS = [
  { id: 'bloqueo', t: 'Una cuadrilla se para por un bloqueo', mec: 'Mayor productividad', que: 'La grúa torre está en mantenimiento y 8 personas pierden medio día. Hoy se entera el ingeniero cuando ya pasó.', como: 'El reporte de campo trae el paro; Obra IA lo propone como tiempo muerto y bloqueo, asigna un responsable, muestra qué actividades siguientes dependen de eso y mide cuánto costó o cuánto se evitó.', mide: 'Horas de tiempo muerto y unidades ejecutadas por hora pagada.' },
  { id: 'mes', t: 'Evitar un mes adicional de una cuadrilla', mec: 'Menor costo del atraso', que: 'El ritmo de estructura baja y la entrega se corre. Un mes más de una cuadrilla de 10 personas son 30 millones brutos.', como: 'La alerta sale del ritmo, se compara seguir contra reforzar con su costo y su supuesto, se decide con responsable y plazo, y después se comprueba con reportes cuánto se recuperó de verdad.', mide: 'Días evitados y costos que efectivamente dejan de pagarse, netos del refuerzo.' },
  { id: 'admin', t: 'Menos trabajo administrativo', mec: 'Menos trabajo administrativo', que: 'El residente pasa horas recopilando mensajes, actualizando avances y armando el informe del comité.', como: 'Los mensajes llegan leídos; la persona revisa y confirma los seguros en bloque, y el reporte semanal sale armado y queda guardado como versión.', mide: 'Horas netas liberadas, descontando revisión y correcciones.' },
  { id: 'fijo', t: 'Contrato a precio fijo', mec: 'Quién se queda con el ahorro', que: 'Si una actividad se contrata a precio fijo por metro, el ahorro laboral puede quedar en el subcontratista.', como: 'Cada cuadrilla se marca como directa o a precio fijo. Para las de precio fijo, el valor de productividad se muestra como del subcontratista y el beneficio del constructor se calcula por plazo y costos fijos.', mide: 'Cumplir el plazo y reducir los costos propios de permanencia.' },
  { id: 'valor', t: '¿Cuánto vale en una obra de 50 personas?', mec: 'Magnitud', que: 'Con 50 personas a 3 millones mensuales cada una, la obra paga 150 millones al mes.', como: 'La calculadora muestra qué significa recuperar 5% o 10% del tiempo pagado, cuánto es capacidad y cuánto puede ser caja, y qué se descuenta de la plataforma.', mide: 'En el piloto: horas recuperadas, costos evitados y beneficio neto en esa obra.' }
];
function valorHero() {
  return `<div class="card hero"><p class="eyebrow">Propuesta de valor · a validar</p>
    <h2>Obra IA ayuda a las constructoras a reducir tiempos muertos y sobrecostos, para ejecutar más obra con los recursos que ya pagan.</h2>
    <p>Convertimos los reportes de campo en información para saber <b>qué está frenando la obra</b>, <b>cuánto puede costarle</b> y <b>qué decisión tomar a tiempo</b>.</p>
    <p class="muted sm">Hoy no hay un porcentaje de ahorro demostrado por Obra IA. Lo que sigue son supuestos y cálculos con datos de ejemplo; el piloto sirve para medir cuánto se recupera de verdad.</p></div>`;
}
function vValor() {
  const o = cur(), v = valor(o), t = UI.valorTab || 'resumen', ov = v.enJuego;
  const tabs = [['resumen', 'Valor en esta obra'], ['calc', 'Calculadora'], ['escenarios', 'Escenarios'], ['piloto', 'Medición del piloto']];
  const nav = `<div class="tabs" role="tablist" aria-label="Secciones de valor">${tabs.map(([k, l]) => `<button role="tab" class="tabb ${t === k ? 'on' : ''}" aria-selected="${t === k}" data-act="valor-tab" data-t="${k}">${l}</button>`).join('')}</div>`;
  let body = '';
  if (t === 'resumen') {
    const hay = v.atraso.items.length;
    body = `<div class="mecs">
      <article class="card mec"><p class="eyebrow">1 · Menos trabajo administrativo</p><div class="big">${fmtH(v.adm.horas)}<small>netas liberadas</small></div>
        <p class="muted sm">${v.adm.conf} reportes leídos × ${o.adm.minManual - o.adm.minRevision} min − ${v.adm.corr} correcciones × ${o.adm.minCorreccion} min + ${v.adm.inf} informes × ${o.adm.informeManual - o.adm.informeRevision} min · 20 días hábiles.</p>
        <p><b>${fmtM(v.adm.valor)}</b> de capacidad administrativa a ${fmtCOP(o.adm.costoHora)} por hora.</p>${pill('Estimado · tiempos de ejemplo', 'warn')}
        <p class="muted sm">Cambia cuando confirmas reportes y guardas informes. <a href="#/avances">Ir a Avances</a></p></article>
      <article class="card mec"><p class="eyebrow">2 · Mayor productividad de las cuadrillas</p><div class="big">${fmtH(v.prod.horasEvit)}<small>de paro evitadas</small></div>
        <p class="muted sm">${v.prod.evitN} bloqueos resueltos antes de necesitarse × personas × 8 h × ${o.paroEsperado} días de paro esperado.</p>
        <p><b>${fmtM(v.prod.capDirecta)}</b> de capacidad propia${v.prod.horasSub ? ` · ${fmtH(v.prod.horasSub)} (${fmtM(v.prod.capSub)}) quedan en subcontratistas` : ''}. Aún se perdieron <b>${fmtH(v.prod.horasPerd)}</b> (${fmtM(v.prod.costoPerd)}).</p>${pill('Estimado · paro esperado es un supuesto', 'warn')}
        <p class="muted sm"><a href="#/bloqueos">Ir a Bloqueos</a></p></article>
      <article class="card mec"><p class="eyebrow">3 · Menor costo del atraso</p>${hay ? `<div class="big">${v.atraso.dias} días<small>evitados</small></div>
        <p class="muted sm">${v.atraso.items.map(i => `${i.cap}: ${i.dias} d × ${i.contrato === 'precio_fijo' ? 'costos fijos' : 'día completo'}`).join(' · ')}</p>
        <p><b>${fmtM(v.atraso.neto)}</b> neto: ${fmtM(v.atraso.bruto)} − ${fmtM(v.atraso.refuerzos)} de refuerzos.</p>${pill(v.atraso.items.every(i => i.medido) ? 'Medido con reportes' : 'Esperado · falta verificar', v.atraso.items.every(i => i.medido) ? 'ok' : 'warn')}`
        : `<div class="big">${dias(ov.dias)}<small>en juego</small></div><p class="muted sm">Aún no hay decisiones tomadas. Si nada cambia, la entrega se mueve ${dias(ov.dias)} y cuesta ${fmtM(ov.costo)}.</p>${pill('Sin decisiones todavía', 'mute')}`}
        <p class="muted sm"><a href="#/decisiones">Ir a Decisiones</a></p></article></div>
      <div class="cols duo"><div class="card"><h2>Qué es caja y qué es capacidad</h2>
        <div class="split3"><div><small>Ahorro en caja</small><b>${fmtM(v.atraso.neto)}</b><span>atraso evitado, neto de refuerzos</span></div><div><small>Capacidad propia</small><b>${fmtH(v.adm.horas + v.prod.horasDirectas)}</b><span>horas administrativas y de cuadrilla</span></div><div><small>En subcontratistas</small><b>${fmtM(v.prod.capSub)}</b><span>precio fijo: el ahorro es de ellos</span></div></div>
        <ul class="check"><li>La <b>capacidad</b> se vuelve caja solo si evita horas extras, contrataciones, retrabajos o una extensión de la obra.</li><li>No se suman las horas recuperadas y el ahorro por terminar antes: son la misma capacidad vista dos veces.</li></ul></div>
        <div class="card"><h2>Del valor bruto al neto en caja</h2>${puente([['Atraso evitado', v.atraso.bruto], ['Refuerzos pagados', -v.atraso.refuerzos], ['Plataforma e implementación', -v.plataforma], ['Neto en caja', v.netoCaja]])}
          <p class="muted sm">${v.plataforma ? '' : 'La plataforma no tiene precio definido (0). Se edita en <a href="#/config">Configuración</a>.'} Aún no es un resultado: son datos de ejemplo.</p></div></div>
      <div class="card"><h2>Contrato por cuadrilla: quién se queda con el ahorro</h2>
        <div class="tbl-wrap"><table class="tbl"><thead><tr><th scope="col">Cuadrilla</th><th scope="col">Cómo se contrata</th><th scope="col">Quién se queda con el ahorro de tiempo</th></tr></thead><tbody>
        ${CAPS.slice(0, 6).map(c => `<tr><td><b>${c}</b><small>${esc(CREW[c])}</small></td><td><label class="sr" for="ct-${c}">Contrato de ${c}</label><select id="ct-${c}" data-act-change="contrato" data-k="${c}"><option value="directo"${contratoDe(o, c) === 'directo' ? ' selected' : ''}>Pago directo</option><option value="precio_fijo"${contratoDe(o, c) === 'precio_fijo' ? ' selected' : ''}>Precio fijo (por metro)</option></select></td><td>${contratoDe(o, c) === 'directo' ? pill('El constructor', 'ok') : pill('El subcontratista; el constructor gana en plazo', 'info')}</td></tr>`).join('')}</tbody></table></div>
        <p class="muted sm">Con precio fijo, el beneficio del constructor está en cumplir el plazo y reducir sus propios costos de permanencia (${fmtM(o.fijoDia)} por día), no en las horas de la cuadrilla.</p></div>`;
  } else if (t === 'calc') {
    const c = UI.calc || CALC_DEF;
    body = `<div class="card"><h2>¿Qué magnitud podría tener?</h2><p class="muted sm">Toma ${fmtM(c.costo)} mensuales por persona como <b>supuesto de costo total</b>. El porcentaje es una hipótesis, no un resultado.</p>
      <div class="chipsel" role="group" aria-label="Ejemplos">${Object.keys(PRESETS).map(k => `<button class="chipb" data-act="calc-preset" data-p="${k}">${PRESETS[k].label}</button>`).join('')}</div>
      <div class="grid4 calc-in">
        <label>Personas cubiertas<input type="number" min="1" data-act-input="calc" data-k="personas" value="${c.personas}"></label>
        <label>Costo mensual por persona ($)<input type="number" min="0" step="100000" data-act-input="calc" data-k="costo" value="${c.costo}"></label>
        <label>Tiempo pagado que se recupera (%)<input type="number" min="0" max="100" step="1" data-act-input="calc" data-k="pct" value="${c.pct}"></label>
        <label>Meses<input type="number" min="1" max="36" data-act-input="calc" data-k="meses" value="${c.meses}"></label></div>
      <div class="grid4 calc-in">
        <label>Parte que se vuelve caja (%)<input type="number" min="0" max="100" step="5" data-act-input="calc" data-k="caja" value="${c.caja}"></label>
        <label>Plataforma por mes ($)<input type="number" min="0" step="500000" data-act-input="calc" data-k="plataforma" value="${c.plataforma}"></label>
        <label>Implementación ($)<input type="number" min="0" step="500000" data-act-input="calc" data-k="impl" value="${c.impl}"></label>
        <label class="chk2"><input type="checkbox" data-act-input="calc" data-k="fijo" ${c.fijo ? 'checked' : ''}> Actividad a precio fijo</label></div>
      ${c.fijo ? `<label class="blk">Días de plazo que se recuperan<input type="number" min="0" data-act-input="calc" data-k="diasPlazo" value="${c.diasPlazo}"></label>` : ''}
      <div id="calcOut">${calcOut(o)}</div></div>
      <div class="card"><h2>Escenarios de referencia</h2><div id="calcTab">${calcTabla(o)}</div><p class="muted sm">Valor de recuperar parte del tiempo pagado, con ${fmtM(c.costo)} por persona al mes. El 5% y el 10% son hipótesis.</p>
        <p class="note"><b>Ejemplo para una reunión:</b> con 50 personas y 150 millones mensuales de costo total, recuperar apenas el 5% del tiempo pagado equivale a 7,5 millones al mes en capacidad. Queremos comprobar en su obra cuánto se recupera, qué parte se vuelve ahorro real y si mejora el plazo.</p></div>`;
  } else if (t === 'escenarios') {
    body = `<div class="escs">${ESCENARIOS.map((e, i) => `<article class="card esc"><div class="esc-h"><span class="num">${i + 1}</span><div><h3>${e.t}</h3><p class="eyebrow">${e.mec}</p></div></div>
      <dl><div><dt>Qué pasa hoy</dt><dd>${e.que}</dd></div><div><dt>Cómo lo resuelve Obra IA</dt><dd>${e.como}</dd></div><div><dt>Cómo se mide</dt><dd>${e.mide}</dd></div></dl>
      <button class="btn primary sm" data-act="scn-start" data-id="${e.id}">Ver cómo se resuelve</button></article>`).join('')}</div>
      <p class="muted sm">Cada escenario se reproduce paso a paso sobre las pantallas reales, con datos de ejemplo. Al terminar, todo queda como estaba.</p>`;
  } else {
    const H = o.hipotesis, X = Math.round(v.adm.horas + v.prod.horasEvit);
    const fila = (l, k, hip, med, est) => `<tr><td>${l}</td><td class="r"><input class="cell" type="number" min="0" data-act-change="hipotesis" data-k="${k}" value="${hip}" aria-label="Hipótesis: ${l}"></td><td class="r mono">${med}</td><td>${est}</td></tr>`;
    body = `<div class="card"><h2>De la hipótesis a la afirmación específica</h2><p class="muted sm">El piloto convierte la propuesta en una frase concreta sobre una obra. Esto es lo que se mediría y lo que hay hasta ahora con datos de ejemplo.</p>
      <div class="tbl-wrap"><table class="tbl"><thead><tr><th scope="col">Indicador</th><th scope="col" class="r">Hipótesis</th><th scope="col" class="r">En esta obra</th><th scope="col">Qué tan firme es</th></tr></thead><tbody>
      ${fila('Horas administrativas netas liberadas', 'horasAdm', H.horasAdm, fmtH(v.adm.horas), pill('Estimado', 'warn'))}
      ${fila('Horas de paro evitadas', 'horasEvit', H.horasEvit, fmtH(v.prod.horasEvit), pill('Estimado', 'warn'))}
      ${fila('Días de atraso evitados', 'dias', H.dias, v.atraso.dias + ' d', v.atraso.items.length && v.atraso.items.every(i => i.medido) ? pill('Medido', 'ok') : pill(v.atraso.items.length ? 'Esperado' : 'Sin decisiones', v.atraso.items.length ? 'warn' : 'mute'))}
      <tr class="tot"><td>Ahorro neto en caja</td><td></td><td class="r mono">${fmtM(v.netoCaja)}</td><td>${pill('Depende de supuestos', 'warn')}</td></tr></tbody></table></div>
      <p class="frase">«En esta obra recuperamos <b>${X} horas</b>, evitamos <b>${fmtM(v.atraso.bruto)}</b> en costos de atraso y obtuvimos <b>${fmtM(v.netoCaja)}</b> de beneficio neto en caja.»${v.atraso.items.length ? '' : ' <span class="muted sm">Todavía no hay decisiones tomadas en esta obra, por eso el atraso evitado es $0.</span>'}</p>
      <p class="muted sm">Hoy es una frase de ejemplo, no un resultado. Para que sea defendible se necesitan tres datos del cliente: qué personal paga directamente, dónde pierde horas y cuánto le cuesta prolongar la obra un mes.</p></div>
      <div class="card"><h2>Los tres datos para defender la cifra</h2><div class="grid3b">
        <div class="dato"><small>Personal que paga directamente</small><b>${o.trabajadores} personas</b><span>Configuración · trabajadores afectados</span></div>
        <div class="dato"><small>Dónde pierde horas hoy</small><b>${fmtH(v.prod.horasPerd)} en 20 días</b><span>${Object.keys(v.prod.porCausa).map(k => BLQ_TIPOS[k]).join(', ') || 'sin registros'}</span></div>
        <div class="dato"><small>Costo de prolongar la obra un mes</small><b>${fmtM(costDia(o) * 22)}</b><span>22 días hábiles × ${fmtM(costDia(o))}</span></div></div>
        <p class="muted sm">Para no contar dos veces: las horas recuperadas se cuentan como capacidad, y el ahorro por terminar antes solo cuando el costo deja de pagarse.</p></div>`;
  }
  return valorHero() + nav + body;
}

const VIEWS = { obras: vObras, hoy: vHoy, plan: vPlan, avances: vAvances, bloqueos: vBloqueos, decisiones: vDecisiones, valor: vValor, reportes: vReportes, costos: vCostos, equipo: vEquipo, config: vConfig };
