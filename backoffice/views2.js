'use strict';
/* Obra IA · Back office · Avances, Decisiones, Reportes, Costos, Equipo y Configuración. */

/* ---------- avances: bandeja de revisión ---------- */
const MK = { act: 'Actividad', pct: 'Avance', rend: 'Rendimiento', paro: 'Tiempo muerto' };
const CONF = { alta: ['Lectura segura', 'ok'], media: ['Revisar', 'warn'], baja: ['Sin leer', 'bad'] };
function hlText(text, spans) {
  let out = '', pos = 0;
  for (const sp of (spans || []).slice().sort((x, y) => x.s - y.s)) {
    if (sp.s < pos) continue;
    out += esc(text.slice(pos, sp.s)) + `<mark class="m-${sp.k}" title="${MK[sp.k]}">${esc(text.slice(sp.s, sp.e))}</mark>`;
    pos = sp.e;
  }
  return out + esc(text.slice(pos));
}
function cmpText(o, a) {
  if (!a) return 'No pude identificar la actividad: elígela para confirmar.';
  const lc = lastConfirmed(o, a.id);
  return `Según el plan debería ir en ${pctTxt(planPctAct(o, a))}. Último dato confirmado: ${pctTxt(a.pct)}${lc ? ` (${fmtDia(o, lc.dia)}, ${esc(lc.autor.split(' · ')[0])})` : ''}.`;
}
function histHtml(o, a) {
  if (!a) return '<p class="muted sm">Elige una actividad para ver sus registros.</p>';
  const L = actHistory(o, a.id);
  return L.length ? '<ul class="hl">' + L.map(r => `<li><span class="mono">${fmtDia(o, r.dia)}</span> ${r.pct}% acumulado${r.rend ? ' · ' + r.rend + ' ' + a.und + '/día' : ''} · ${esc(r.autor.split(' · ')[0])}</li>`).join('') + '</ul>' : '<p class="muted sm">Sin registros confirmados todavía.</p>';
}
function effectText(o, a, pct, rend, dia) {
  if (!a) return 'Elige la actividad para ver qué se registrará y qué se recalcula.';
  if (pct === '' || pct == null || isNaN(+pct)) return 'Escribe el avance acumulado para ver qué se registrará.';
  const p = +pct, hasR = rend !== '' && rend != null && !isNaN(+rend);
  return `Al confirmar se registra ${p}% acumulado de ${a.nombre} (${dots(a.qty * p / 100)} de ${dots(a.qty)} ${a.und}) con fecha ${fmtDiaY(o, +dia)}${hasR ? ` y un rendimiento de ${rend} ${a.und}/día` : ''}. Se recalcula el ritmo de ${a.crew} y la entrega proyectada.`;
}
function actOptions(o, sel) {
  return (sel ? '' : '<option value="">Elegir actividad…</option>') + CAPS.map(cap => {
    const L = o.acts.filter(a => a.cap === cap && (a.pct < 0.999 || a.id === sel));
    return L.length ? `<optgroup label="${cap}">${L.map(a => `<option value="${a.id}"${a.id === sel ? ' selected' : ''}>${esc(a.nombre)}</option>`).join('')}</optgroup>` : '';
  }).join('');
}
function diaOptions(o, sel) {
  const d0 = []; for (let k = 0; k <= 5; k++) { if (o.hoy - k < 0) break; d0.push(o.hoy - k); }
  if (sel != null && !d0.includes(sel)) d0.push(sel);
  return d0.map(d => { const k = o.hoy - d; return `<option value="${d}"${d === sel ? ' selected' : ''}>${k === 0 ? 'Hoy' : k === 1 ? 'Ayer' : 'Hace ' + k + ' días hábiles'} · ${fmtDia(o, d)}</option>`; }).join('');
}
function paroBox(o, r, P) {
  const p0 = P.paro, on = !!p0, causa = P.causa || 'equipo';
  return `<div class="parobox"><label class="chk"><input type="checkbox" data-f="paroOn"${on ? ' checked' : ''}> Registrar tiempo muerto y bloqueo${on ? ' <span class="pill warn">Detectado en el mensaje</span>' : ''}</label>
    <div class="grid4 paro-f"${on ? '' : ' hidden'}>
      <label>Personas<input type="number" min="0" data-f="paroP" value="${p0 && p0.personas ? p0.personas : ''}"></label>
      <label>Horas<input type="number" min="0" step="0.5" data-f="paroH" value="${p0 && p0.horas ? p0.horas : ''}"></label>
      <label>Causa<select data-f="paroC">${Object.keys(BLQ_TIPOS).map(k => `<option value="${k}"${k === causa ? ' selected' : ''}>${BLQ_TIPOS[k]}</option>`).join('')}</select></label>
      <label>Responsable<select data-f="paroR">${Object.keys(o.roles).map(k => `<option value="${k}"${k === BLQ_RESP[causa] ? ' selected' : ''}>${esc(o.roles[k])}</option>`).join('')}</select></label></div>
    <label class="blk paro-f"${on ? '' : ' hidden'}>Qué está bloqueando<input type="text" data-f="paroT" value="${esc(bloqueoTitulo(r.texto))}"></label>
    <p class="muted sm paro-f paro-sum"${on ? '' : ' hidden'}></p></div>`;
}
function repBody(o, r, a, P, dup) {
  const orig = r.corrige ? o.reportes.find(x => x.id === r.corrige) : null;
  return `<div class="rv-body">
    <div class="bubble">${hlText(r.texto, P.spans)}</div>
    <div class="reading" data-und="${a ? a.und : ''}"><span class="eyebrow">Lectura de Obra IA · simulada con reglas · lo resaltado sustenta cada campo</span>
      <div class="grid4">
        <label>Actividad<select data-f="act">${actOptions(o, r.actId)}</select></label>
        <label>Fecha del trabajo<select data-f="dia">${diaOptions(o, r.dia)}</select></label>
        <label>Avance acumulado (%)<input type="number" min="0" max="100" data-f="pct" value="${r.pct == null ? '' : r.pct}"></label>
        <label>Rendimiento del día (<span class="u">${a ? a.und : 'u'}</span>/día)<input type="number" min="0" step="0.5" data-f="rend" value="${r.rend == null ? '' : r.rend}" placeholder="opcional"></label>
      </div>
      ${P.amb ? `<p class="warnbox">El mensaje trae varios porcentajes. Propongo el de hoy (${P.pct}%) y dejo ${P.prev.join('% y ')}% como dato anterior. Revísalo antes de confirmar.</p>` : ''}
      ${P.multi ? '<p class="warnbox">El mensaje parece hablar de más de una actividad. Confirma una y registra la otra por separado.</p>' : ''}
      ${dup ? '<p class="warnbox">Parece duplicado de un reporte ya registrado (misma actividad, avance y fecha). Descártalo si es el mismo.</p>' : ''}
      ${orig ? `<p class="infobox">Corrige el registro del ${fmtDia(o, orig.dia)} (${orig.pct}%). Al confirmar, el anterior queda como corregido y se conserva en el historial.</p>` : ''}
      ${paroBox(o, r, P)}
      <p class="effect">${effectText(o, a, r.pct, r.rend, r.dia)}</p>
      <p class="muted sm cmp">${cmpText(o, a)}</p>
      <details class="hist"><summary>Registros de esta actividad</summary><div class="hbody">${histHtml(o, a)}</div></details></div>
    <div class="rc-actions"><button class="btn primary" data-act="rep-confirm" data-id="${r.id}">Confirmar y recalcular</button><button class="btn ghost" data-act="rep-discard" data-id="${r.id}">Descartar</button></div></div>`;
}
function repRow(o, r, open) {
  const a = o.acts.find(x => x.id === r.actId) || null, P = parseMessage(o, r.texto), dup = dupOf(o, r), cf = CONF[P.conf];
  return `<details class="rv card" data-rid="${r.id}"${open ? ' open' : ''}><summary>
    <span class="rv-who"><b>${esc(r.autor.split(' · ')[0])}</b><small>${esc(r.fuente)}${r.fotos ? ' · ' + r.fotos + ' foto' + (r.fotos > 1 ? 's' : '') : ''} · ${esc(r.hora || '')}</small></span>
    <span class="rv-act">${a ? esc(a.nombre) : 'Actividad sin identificar'}<small>${a ? a.cap : 'elígela al abrir'}</small></span>
    <span class="rv-pct">${r.pct == null ? '—' : r.pct + '%'}<small>acumulado</small></span>
    <span class="rv-flags">${pill(cf[0], cf[1])}${dup ? pill('Posible duplicado', 'warn') : ''}${P.multi ? pill('Varias actividades', 'warn') : ''}${r.corrige ? pill('Corrección', 'info') : ''}</span>
  </summary>${repBody(o, r, a, P, dup)}</details>`;
}
function vAvances() {
  const o = cur(), pend = pendRep(o), hist = o.reportes.filter(r => r.estado !== 'pendiente').slice(0, 12);
  const openId = UI.openRid || (pend[0] && pend[0].id);
  const seguros = pend.filter(r => { const P = parseMessage(o, r.texto); return P.conf === 'alta' && !P.paro && !dupOf(o, r) && r.actId && r.pct != null; }).length;
  const est = { confirmado: ['Confirmado', 'ok'], descartado: ['Descartado', 'mute'], corregido: ['Corregido', 'mute'] };
  return `<div class="cols avance">
    <div><div class="card-h flat"><h2>Por revisar <span class="count">${pend.length}</span></h2>${seguros ? `<button class="btn ghost sm" data-act="rep-confirm-all">Confirmar los ${seguros} de lectura segura</button>` : '<span class="muted sm">Abre un reporte para revisar lo que se registraría</span>'}</div>
      ${pend.length ? `<div class="bandeja">${pend.map(r => repRow(o, r, r.id === openId)).join('')}</div>` : '<div class="card"><p class="empty">No hay reportes por revisar. Cuando la obra escriba, aparecen aquí.</p></div>'}
    </div>
    <div>
      <div class="card"><h2>Registrar un mensaje</h2>
        <p class="muted sm">Pega el texto que mandó el contramaestro. Obra IA propone la actividad, la fecha y el avance; tú confirmas.</p>
        <label class="sr" for="newText">Mensaje de la obra</label>
        <textarea id="newText" rows="3" placeholder="Ej.: Ing., la placa del 10 va en el 40%, hoy sacamos 15 m2."></textarea>
        <div class="row"><button class="btn primary" data-act="rep-parse">Leer mensaje</button><button class="btn ghost sm" data-act="rep-simulate">Simular mensajes (demo)</button></div></div>
      <div class="note"><b>Cómo funciona en el piloto:</b> el contramaestro reporta como hoy, por WhatsApp con fotos. Un modelo de IA lo lee y propone estos campos. Una persona confirma antes de que el dato cuente. En este prototipo la lectura usa reglas simples, no IA.</div>
    </div></div>
    <div class="card"><h2>Historial reciente</h2><div class="tbl-wrap"><table class="tbl"><thead><tr><th scope="col">Fecha del trabajo</th><th scope="col">Actividad</th><th scope="col" class="r">Avance acumulado</th><th scope="col" class="r">Rendimiento del día</th><th scope="col">Reportó</th><th scope="col">Estado</th><th scope="col"><span class="sr">Acciones</span></th></tr></thead><tbody>
      ${hist.map(r => { const a = o.acts.find(x => x.id === r.actId); return `<tr class="${r.estado === 'corregido' ? 'tachado' : ''}"><td class="mono">${fmtDia(o, r.dia)}</td><td>${a ? actLink(o, a.id) : esc(r.actId || '—')}</td><td class="r mono">${r.pct == null ? '—' : r.pct + '%'}</td><td class="r mono">${r.rend ? r.rend + ' ' + (a ? a.und : '') + '/día' : '—'}</td><td>${esc(r.autor.split(' · ')[0])}</td><td>${pill(est[r.estado][0], est[r.estado][1])}</td><td class="r">${r.estado === 'confirmado' ? `<button class="link" data-act="rep-correct" data-id="${r.id}">Corregir</button>` : ''}</td></tr>`; }).join('') || '<tr><td colspan="7" class="empty">Todavía no hay historial.</td></tr>'}
    </tbody></table></div></div>`;
}

/* ---------- decisiones ---------- */
const PLAZOS = [[0, 'Hoy'], [3, '3 días hábiles'], [5, '1 semana'], [10, '2 semanas']];
function decDetail(o, al) {
  const c = opcionCostos(o, al), d = al.dec, e = d.estado || 'abierta', a = al.activa, st = DEC[e];
  const idx = { abierta: 0, en_comite: 0, decidida: 1, ejecucion: 2, verificada: 3 }[e], editable = e === 'abierta' || e === 'en_comite', resp = d.responsable || 'director', plazo = d.plazo != null ? d.plazo : 5;
  const ritmoEsp = al.ritmo + (1 - al.ritmo) * recoverOf(o);
  const ev = o.reportes.filter(r => r.estado === 'confirmado').filter(r => { const x = o.acts.find(z => z.id === r.actId); return x && x.cap === al.cap; }).sort((x, y) => y.dia - x.dia).slice(0, 3);
  const hist = o.bitacora.filter(b => b.cap === al.cap).slice(0, 5);
  const optCard = (k, t, sub, dd, cost) => `<button class="opt ${d.opcion === k ? 'on' : ''}" data-act="dec-opt" data-k="${k}" aria-pressed="${d.opcion === k}" ${editable ? '' : 'disabled'}><b>${t}</b><span>${sub}</span><em>${dd ? 'Entrega +' + dias(dd) : 'Sin atraso en la entrega'}</em><strong>${fmtM(cost)}</strong></button>`;
  const esperado = d.opcion === 'reforzar' ? `Ritmo esperado ${pctTxt(ritmoEsp)}, entrega +${dias(al.diasRef)} y costo ${fmtM(c.reforzar)} (incluye ${fmtM(c.ref)} de refuerzo). Se comprueba con los reportes de las semanas siguientes.`
    : d.opcion === 'seguir' ? `Sin cambios: la entrega se mueve ${dias(al.diasSin)} y el atraso cuesta ${fmtM(c.seguir)}.` : 'Elige una opción para ver el resultado esperado.';
  const v = d.verif;
  let acciones;
  if (editable) acciones = `<button class="btn ghost" data-act="dec-send" ${e === 'en_comite' ? 'disabled' : ''}>${e === 'en_comite' ? 'Preparada para comité ✓' : 'Preparar para comité'}</button><button class="btn primary" data-act="dec-decide">Registrar decisión</button>`;
  else if (e === 'decidida') acciones = `<button class="btn primary" data-act="dec-exec">Marcar en ejecución</button><button class="btn ghost" data-act="dec-reopen">Reabrir</button>`;
  else if (e === 'ejecucion') acciones = `<button class="btn ghost" data-act="dec-reopen">Reabrir</button>`;
  else acciones = `<button class="btn ghost" data-act="dec-reopen">Reabrir</button>`;
  const verBox = e === 'ejecucion' ? `<div class="verbox"><h3 class="sub">Comprobar el resultado</h3><p class="muted sm">Cuando haya reportes nuevos, registra el ritmo que se observa desde que se ejecutó. Eso reemplaza el supuesto.</p><div class="row"><label class="inl">Ritmo observado (% del plan)<input id="v-ritmo" type="number" min="30" max="130" value="${Math.round(ritmoEsp * 100)}"></label><button class="btn primary" data-act="dec-verify">Registrar resultado verificado</button></div></div>`
    : e === 'verificada' && v ? `<div class="verbox ok"><h3 class="sub">Resultado verificado · ${fmtDiaY(o, v.dia)}</h3><p>Esperado: ritmo ${pctTxt(v.esperado)}. Observado: <b>${pctTxt(v.ritmo)}</b>. Recuperación observada: <b>${Math.round(v.rec * 100)}%</b> del ritmo perdido (el supuesto era ${Math.round(recoverOf(o) * 100)}%).</p><div class="row"><button class="btn ghost sm" data-act="dec-use-rec">Usar ${Math.round(v.rec * 100)}% como supuesto de esta obra</button></div></div>` : '';
  return `<div class="card det">
    <div class="det-h"><div><h2>${al.cap} · ${esc(al.crew)}</h2><p class="muted sm">${a ? 'Actividad en curso: ' + actLink(o, a.id) : al.restantes + ' actividades pendientes'}</p></div><div class="pills">${pill('Severidad ' + SEV[al.sev][0].toLowerCase(), SEV[al.sev][1])}${pill(st[0], st[1])}${e === 'en_comite' ? '' : ''}</div></div>
    <ol class="stepper" aria-label="Estado de la decisión">${['Propuesta', 'Decidida', 'En ejecución', 'Verificada'].map((t, i) => `<li class="${i < idx ? 'done' : i === idx ? 'cur' : ''}"${i === idx ? ' aria-current="step"' : ''}>${t}${i === 0 && e === 'en_comite' ? ' · para comité' : ''}</li>`).join('')}</ol>
    <h3 class="sub">Problema</h3>
    <div class="metrics">
      <div><small>Ritmo contra el plan</small><b class="${al.ritmo < 0.9 ? 'bad' : 'warn'}">${pctTxt(al.ritmo)}</b></div>
      <div><small>Atraso hoy</small><b>${al.atraso >= 0.5 ? (Math.round(al.atraso * 10) / 10).toString().replace('.', ',') + ' d' : 'casi nulo'}</b></div>
      <div><small>Actividades pendientes</small><b>${al.restantes}</b></div>
      <div><small>Entrega proyectada</small><b>${fmtDiaY(o, o.planEnd + al.diasSin)}</b></div>
    </div>
    <p class="story">${al.diasSin ? `Hoy el atraso ${al.atraso >= 0.5 ? 'es de ' + (Math.round(al.atraso * 10) / 10).toString().replace('.', ',') + ' días' : 'casi no se ve'}, pero a este ritmo cada actividad de ${al.cap.toLowerCase()} toma más de lo planeado y el atraso se acumula: la entrega se mueve <b>${dias(al.diasSin)}</b>.` : `El ritmo está por debajo del plan, pero hay holgura: por ahora no mueve la fecha de entrega.`}</p>
    ${al.diasSin ? `<p class="equiv"><b>Para dimensionarlo:</b> un mes adicional de una cuadrilla de 10 personas cuesta ${fmtM(10 * o.costoMensual)} brutos. Este atraso son ${(al.diasSin / 22).toFixed(1).replace('.', ',')} meses de obra y ${fmtM(al.diasSin * costDia(o))} con el costo diario configurado.</p>` : ''}
    <h3 class="sub">Evidencia</h3>
    ${ev.length ? `<ul class="evid">${ev.map(r => `<li><span class="mono">${fmtDia(o, r.dia)}</span><span>${actLink(o, r.actId)} · ${r.pct}% acumulado${r.rend ? ' · ' + r.rend + ' ' + o.acts.find(z => z.id === r.actId).und + '/día' : ''} · ${esc(r.autor.split(' · ')[0])}</span></li>`).join('')}</ul>` : '<p class="muted sm">Sin reportes confirmados de este capítulo.</p>'}
    <p class="muted sm">El ritmo sale de los reportes confirmados de ${al.cap.toLowerCase()}, comparados con el plan.</p>
    <h3 class="sub">Opciones</h3>
    <div class="opts3">${optCard('seguir', 'Seguir como está', 'Sin cambios en la cuadrilla.', al.diasSin, c.seguir)}${optCard('reforzar', 'Reforzar la cuadrilla', `Supone recuperar el ${Math.round(recoverOf(o) * 100)}% del ritmo perdido.`, al.diasRef, c.reforzar)}</div>
    <div class="row between"><label class="inl">Costo del refuerzo ($) <input type="number" min="0" step="500000" data-act-change="dec-ref" value="${c.ref}" ${editable ? '' : 'disabled'}></label><span class="muted sm">Costo diario del atraso: ${fmtM(c.cd)} (configurable)</span></div>
    <p class="assume"><b>Supuesto, no resultado comprobado:</b> reforzar la cuadrilla recupera el ${Math.round(recoverOf(o) * 100)}% del ritmo perdido. Es un valor de ejemplo que se edita en <a href="#/config">Configuración</a> y se comprueba con el paso «Verificada».</p>
    <h3 class="sub">Responsable y plazo</h3>
    <div class="grid2"><label>Responsable<select data-act-change="dec-resp" ${e === 'verificada' || e === 'ejecucion' ? 'disabled' : ''}>${Object.keys(o.roles).map(k => `<option value="${k}"${k === resp ? ' selected' : ''}>${esc(o.roles[k])}</option>`).join('')}</select></label>
      <label>Plazo<select data-act-change="dec-plazo" ${e === 'verificada' || e === 'ejecucion' ? 'disabled' : ''}>${PLAZOS.map(([n, t]) => `<option value="${n}"${n === plazo ? ' selected' : ''}>${t}</option>`).join('')}</select></label></div>
    <p class="muted sm">Fecha límite: <b>${fmtDiaY(o, (d.decDia != null ? d.decDia : o.hoy) + plazo)}</b></p>
    <h3 class="sub">Resultado esperado</h3><p>${esperado}</p>
    <label class="blk">Nota para el comité<textarea rows="2" data-act-change="dec-note" ${editable ? '' : 'disabled'} placeholder="Opcional">${esc(d.nota || '')}</textarea></label>
    ${verBox}
    <div class="row">${acciones}</div>
    <p class="muted sm">La decisión la toma tu equipo. Obra IA no cambia el plan ni la cuadrilla por su cuenta.</p>
    ${hist.length ? `<h3 class="sub">Bitácora</h3><ul class="log">${hist.map(b => `<li><span class="mono">${fmtDia(o, b.dia)}</span>${esc(b.texto)}</li>`).join('')}</ul>` : ''}
  </div>`;
}
function vDecisiones() {
  const o = cur(), L = computeAlerts(o);
  if (!L.length) return '<div class="card"><p class="empty">Sin decisiones pendientes. Todas las cuadrillas van al ritmo del plan.</p></div>';
  const sel = L.find(a => a.cap === UI.alertCap) || L[0];
  return `<div class="cols alerts"><div class="al-list">${L.map(a => { const e = a.dec.estado || 'abierta', st = a.sev === 'vigilar' && e === 'abierta' ? ['Vigilar', 'info'] : DEC[e]; return `<button class="al-item ${a.cap === sel.cap ? 'on' : ''}" data-act="dec-select" data-cap="${a.cap}" aria-pressed="${a.cap === sel.cap}">
      <div><b>${a.cap}</b><span>${esc(a.crew)}</span></div><div class="al-r">${pill(st[0], st[1])}<small>${decisionTomada(a.dec) ? esc(quien(o, a.dec.responsable || 'director')) : a.diasSin ? '+' + dias(a.diasSin) : 'sin impacto'}</small></div></button>`; }).join('')}
      <p class="muted sm">Una decisión aparece cuando el ritmo real de una cuadrilla baja del 97% del plan. Se recalcula con cada reporte confirmado.</p></div>
    ${decDetail(o, sel)}</div>`;
}

/* ---------- costos ---------- */
function vCostos() {
  const o = cur(), ov = overall(o), tot = o.presupuesto.reduce((s, l) => s + l.valor, 0), avAll = avance(o).real;
  const real = l => l.cap === 'Administración de obra' ? avAll : avance(o, l.cap).real;
  const ganado = o.presupuesto.reduce((s, l) => s + l.valor * real(l), 0), gasto = o.presupuesto.reduce((s, l) => s + l.gasto, 0), comp = o.presupuesto.reduce((s, l) => s + l.comprometido, 0);
  const borr = o.presupuesto.filter(l => l.estado === 'borrador').length, variac = gasto - ganado;
  const cell = (i, f, v, l) => `<input class="cell" type="number" min="0" step="10" data-act-change="pres-edit" data-i="${i}" data-f="${f}" value="${Math.round(v / 1e6)}" aria-label="${l}">`;
  return `${borr ? `<div class="banner warn"><div><b>${borr} capítulo${plural(borr, '', 's')} en borrador.</b> Salen de las cantidades de los planos. Tu presupuestista los revisa con tus precios y los valida.</div><button class="btn primary" data-act="pres-validate">Validar todo</button></div>` : '<div class="banner ok"><div><b>Presupuesto validado.</b> Si editas un valor, el capítulo vuelve a borrador hasta que lo valides.</div></div>'}
    <div class="kpis">${kpi('Presupuesto', fmtM(tot))}${kpi('Valor ganado', fmtM(ganado), '', pctTxt(tot ? ganado / tot : 0) + ' del presupuesto')}${kpi('Gasto real', fmtM(gasto), '', 'dato de ejemplo, sin conexión contable')}${kpi('Comprometido', fmtM(comp), '', 'gastado + contratado por ejecutar')}</div>
    <div class="card"><div class="tbl-wrap"><table class="tbl"><thead><tr><th scope="col">Capítulo</th><th scope="col" class="r">Presupuesto (M)</th><th scope="col" class="w140">Avance real</th><th scope="col" class="r">Valor ganado</th><th scope="col" class="r">Gasto real (M)</th><th scope="col" class="r">Comprometido (M)</th><th scope="col" class="r">Gasto − ganado</th><th scope="col">Estado</th></tr></thead><tbody>
      ${o.presupuesto.map((l, i) => { const g = l.valor * real(l), v = l.gasto - g; return `<tr><td><b>${l.cap}</b></td><td class="r">${cell(i, 'valor', l.valor, 'Presupuesto de ' + l.cap)}</td><td>${pbar(real(l), real(l))}<small class="mono">${pctTxt(real(l))}</small></td><td class="r mono">${fmtM(g)}</td><td class="r">${cell(i, 'gasto', l.gasto, 'Gasto real de ' + l.cap)}</td><td class="r">${cell(i, 'comprometido', l.comprometido, 'Comprometido de ' + l.cap)}</td><td class="r mono ${v > g * 0.05 && v > 0 ? 'bad' : ''}">${v > 0 ? '+' : ''}${fmtM(v)}</td><td>${pill(l.estado === 'validado' ? 'Validado' : 'Borrador', l.estado === 'validado' ? 'ok' : 'warn')}</td></tr>`; }).join('')}
      <tr class="tot"><td>Total</td><td class="r mono">${dots(tot / 1e6)}</td><td></td><td class="r mono">${fmtM(ganado)}</td><td class="r mono">${dots(gasto / 1e6)}</td><td class="r mono">${dots(comp / 1e6)}</td><td class="r mono">${variac > 0 ? '+' : ''}${fmtM(variac)}</td><td></td></tr></tbody></table></div>
      <p class="muted sm"><b>Valor ganado</b> = presupuesto × avance real: cuánto del presupuesto corresponde a lo que ya se hizo. <b>Gasto real</b> es lo pagado y <b>comprometido</b>, lo ya contratado. La diferencia «gasto − ganado» dice si se está gastando más de lo avanzado; por sí solo, el valor ganado no acredita cuánto se gastó ni cuánto se ahorró. Los valores son de ejemplo.</p></div>
    <div class="card"><h2>Costo del atraso (fuera del presupuesto)</h2><p>${ov.dias ? `Con el ritmo actual la entrega se mueve <b>${dias(ov.dias)}</b>: <b>${fmtM(ov.costoAtraso)}</b> de atraso${ov.refuerzos ? ` más <b>${fmtM(ov.refuerzos)}</b> de refuerzos decididos` : ''}.` : 'Sin atraso proyectado.'}</p></div>`;
}

/* ---------- equipo y documentos ---------- */
function docChip(o, v) {
  const e = docEstado(o, v);
  if (e === 'falta') return pill('Falta', 'bad');
  const k = e === 'ok' ? 'ok' : e === 'pronto' ? 'warn' : 'bad';
  return `<span class="pill ${k}">${e === 'vencido' ? 'Vencido ' : ''}${fmtDia(o, v)}</span>`;
}
function vEquipo() {
  const o = cur(), act = o.personal.filter(w => w.retiroDia == null), ret = o.personal.filter(w => w.retiroDia != null && w.retiroDia >= o.hoy - 22), rot = rotacion(o);
  const docsPend = personalPend(o), sinAut = act.filter(w => workerEstado(o, w).docs === 'completo' && !w.aut), pronto = act.filter(w => [w.exam, w.alturas].some(v => docEstado(o, v) === 'pronto')).length;
  if (!o.personal.length) return `<div class="card"><p class="empty">Esta obra todavía no tiene personal registrado.</p><div class="row center"><button class="btn primary" data-act="worker-new">Registrar ingreso</button></div></div>`;
  return `<div class="kpis">${kpi('En obra', act.length)}${kpi('Documentos pendientes', docsPend.length, docsPend.length ? 'bad' : '', 'no deberían entrar')}${kpi('Completos sin autorizar', sinAut.length, sinAut.length ? 'warn' : '', 'falta la autorización de ' + esc(quien(o, 'sst')))}${kpi('Rotación rápida', rot.rapidos, rot.rapidos ? 'warn' : '', rot.rapidos ? fmtCOP(rot.perdido) + ' de ingreso perdido' : 'últimos 30 días')}</div>
    <div class="note"><b>Quién verifica qué:</b> Obra IA revisa que los documentos estén completos y vigentes. La autorización de ingreso la da <b>${esc(quien(o, 'sst'))}</b> y queda registrada con su fecha; la herramienta no reemplaza su criterio profesional.</div>
    <div class="card"><div class="card-h"><h2>Personal en obra</h2><button class="btn primary sm" data-act="worker-new">Registrar ingreso</button></div>
    <div class="tbl-wrap"><table class="tbl"><thead><tr><th scope="col">Persona</th><th scope="col">Examen médico</th><th scope="col">Curso de alturas</th><th scope="col">ARL</th><th scope="col">Prestaciones</th><th scope="col">Documentos</th><th scope="col">Ingreso a la obra</th><th scope="col"><span class="sr">Acciones</span></th></tr></thead><tbody>
    ${act.map(w => { const e = workerEstado(o, w); return `<tr><td><b>${esc(w.nombre)}</b><small>${esc(w.oficio)} · ${esc(w.crew)}</small></td><td>${docChip(o, w.exam)}</td><td>${docChip(o, w.alturas)}</td><td>${pill(w.arl ? 'Afiliado' : 'Falta', w.arl ? 'ok' : 'bad')}</td><td>${pill(w.prest ? 'Pagadas' : 'Falta', w.prest ? 'ok' : 'bad')}</td><td>${e.docs === 'completo' ? pill('Completos', 'ok') : pill('Pendiente: ' + e.pend.join(', '), 'bad')}</td><td>${w.aut ? pill('Autorizado · ' + fmtDia(o, w.aut.dia), 'ok') : pill('Sin autorizar', e.docs === 'completo' ? 'warn' : 'mute')}</td><td class="r">${!w.aut && e.docs === 'completo' ? `<button class="link" data-act="worker-auth" data-id="${w.id}">Autorizar ingreso</button> · ` : ''}<button class="link" data-act="worker-retire" data-id="${w.id}">Retirar</button></td></tr>`; }).join('')}
    </tbody></table></div><p class="muted sm">Para entrar a una obra de riesgo alto se exige examen médico, curso de alturas, ARL y prestaciones pagadas. En el piloto, los documentos se leerían de las fotos que ya se mandan y una persona los confirma.</p></div>
    <div class="card"><h2>Retiros de los últimos 30 días</h2>${ret.length ? `<div class="tbl-wrap"><table class="tbl"><thead><tr><th scope="col">Persona</th><th scope="col">Oficio</th><th scope="col">Salió</th><th scope="col" class="r">Días en obra</th><th scope="col">Lectura</th></tr></thead><tbody>${ret.map(w => { const d = w.retiroDia - w.ingresoDia; return `<tr><td><b>${esc(w.nombre)}</b></td><td>${esc(w.oficio)}</td><td class="mono">${fmtDia(o, w.retiroDia)}</td><td class="r mono">${d}</td><td>${d < 5 ? pill('Se perdió el costo de ingreso', 'bad') : pill('Rotación normal', 'mute')}</td></tr>`; }).join('')}</tbody></table></div>
      <p class="muted sm">Costo de ingreso por persona (examen, curso, afiliaciones y prestaciones): ${fmtCOP(o.costoIngreso)}, valor de ejemplo editable en Configuración.</p>` : '<p class="empty">Sin retiros recientes.</p>'}</div>`;
}

/* ---------- reportes ---------- */
function reportData(o) {
  const av = avance(o), ov = overall(o), als = computeAlerts(o), fr = frescura(o);
  const conf = o.reportes.filter(r => r.estado === 'confirmado' && r.dia >= o.hoy - 7), por = {};
  conf.forEach(r => por[r.fuente] = (por[r.fuente] || 0) + 1);
  return {
    av, ov, abiertas: als.filter(alertaAbierta), tomadas: als.filter(a => decisionTomada(a.dec)),
    vigilar: als.filter(a => a.sev === 'vigilar' && !decisionTomada(a.dec)),
    enRitmo: o.acts.filter(a => a.pct > 0 && a.pct < 0.999 && !als.some(x => x.cap === a.cap)).map(a => a.nombre),
    bloq: bloqueosAbiertos(o).filter(b => !b.calc && b.reqDia <= o.hoy + 6), horasPerd: valor(o).prod.horasPerd, costoPerd: valor(o).prod.costoPerd,
    pend: pendRep(o), desact: fr.desact, eq: equipoPend(o), rot: rotacion(o), conf, por, fotos: conf.reduce((s, r) => s + (r.fotos || 0), 0)
  };
}
function fuentesTxt(d) {
  const k = Object.keys(d.por);
  return d.conf.length ? `${d.conf.length} reporte${plural(d.conf.length, '', 's')} confirmado${plural(d.conf.length, '', 's')} en los últimos 7 días hábiles (${k.map(x => d.por[x] + ' ' + x).join(', ')}) y ${d.fotos} foto${plural(d.fotos, '', 's')}.` : 'Sin reportes confirmados en los últimos 7 días hábiles.';
}
const EST_DEC = { decidida: 'Decidida', ejecucion: 'En ejecución', verificada: 'Verificada' };
function reportPaper(o) {
  const d = reportData(o);
  return `<p class="eyebrow">${esc(o.nombre)} · ${semana(o)}</p><h2>Reporte semanal para el comité</h2>
    <p class="conv">${corte(o)} · Plan v${o.planVer} (${o.planEstado === 'validado' ? 'validado' : 'borrador'}) · días hábiles (lunes a viernes) · valores en pesos colombianos (COP)</p>
    <div class="nums"><div><small>Plan</small><b>${pctTxt(d.av.plan)}</b></div><div><small>Real</small><b>${pctTxt(d.av.real)}</b></div><div><small>Entrega</small><b>${d.ov.dias ? '+' + dias(d.ov.dias) : 'En fecha'}</b></div></div>
    <p>Entrega planeada <b>${fmtDiaY(o, o.planEnd)}</b>${d.ov.dias ? `. Con el ritmo actual, <b>${fmtDiaY(o, o.planEnd + d.ov.dias)}</b>, con un costo de atraso de <b>${fmtM(d.ov.costoAtraso)}</b>${d.ov.refuerzos ? ` más <b>${fmtM(d.ov.refuerzos)}</b> de refuerzos decididos` : ''} en este ejemplo.` : '. Sin atraso proyectado.'}</p>
    ${d.abiertas.length ? `<h4>Desvíos que necesitan decisión</h4>${d.abiertas.map(a => `<div class="flag"><p><b>${a.cap}</b> · ${esc(a.crew)}. Ritmo al ${pctTxt(a.ritmo)} del plan; la entrega se mueve ${dias(a.diasSin)}. Si no se hace nada: ${fmtM(opcionCostos(o, a).seguir)}. Con refuerzo: ${fmtM(opcionCostos(o, a).reforzar)}. Responsable: ${esc(quien(o, a.dec.responsable || 'director'))}.${a.dec.estado === 'en_comite' ? ' <em>Preparada para el comité.</em>' : ''}</p></div>`).join('')}` : ''}
    ${d.tomadas.length ? `<h4>Decisiones</h4>${d.tomadas.map(a => `<div class="dec"><p><b>${a.cap}:</b> ${OPCT[a.dec.opcion]}. ${EST_DEC[a.dec.estado]}. Responsable: ${esc(quien(o, a.dec.responsable || 'director'))} · plazo ${fmtDiaY(o, (a.dec.decDia != null ? a.dec.decDia : o.hoy) + (a.dec.plazo != null ? a.dec.plazo : 5))}.${a.dec.verif ? ` Ritmo observado ${pctTxt(a.dec.verif.ritmo)}.` : ''}${a.dec.nota ? ' ' + esc(a.dec.nota) : ''}</p></div>`).join('')}` : ''}
    ${d.vigilar.length ? `<h4>Para vigilar</h4><ul>${d.vigilar.map(a => `<li>${a.cap}: ritmo al ${pctTxt(a.ritmo)} del plan, sin impacto fuerte todavía.</li>`).join('')}</ul>` : ''}
    ${d.enRitmo.length ? `<h4>En ritmo</h4><ul><li>${d.enRitmo.map(esc).join(', ')}.</li></ul>` : ''}
    ${d.bloq.length ? `<h4>Bloqueos que se necesitan pronto</h4><ul>${d.bloq.map(b => `<li>${esc(b.titulo)} (${BLQ_TIPOS[b.tipo].toLowerCase()}), ${b.reqDia <= o.hoy ? 'ya se necesita' : 'en ' + dias(b.reqDia - o.hoy)}. Responsable: ${esc(quien(o, b.resp))}.</li>`).join('')}</ul>` : ''}
    <h4>Tiempo muerto</h4><p>${d.horasPerd ? `${fmtH(d.horasPerd)} pagadas sin producir en los últimos 20 días hábiles (${fmtM(d.costoPerd)}).` : 'Sin tiempo muerto registrado en los últimos 20 días hábiles.'}</p>
    <h4>Datos pendientes</h4><ul><li>${d.pend.length} reporte${plural(d.pend.length, '', 's')} de obra sin confirmar.</li>${d.desact.length ? `<li>Dato desactualizado (más de 2 días sin reporte): ${d.desact.map(a => esc(a.nombre)).join(', ')}.</li>` : ''}<li>${d.eq.length} persona${plural(d.eq.length, '', 's')} con documentos pendientes o sin autorización de ingreso.</li>${o.planEstado === 'borrador' ? `<li>El plan v${o.planVer} está sin validar.</li>` : ''}${d.rot.rapidos ? `<li>${d.rot.rapidos} retiro${plural(d.rot.rapidos, '', 's')} antes de 5 días (${fmtCOP(d.rot.perdido)} de costo de ingreso perdido).</li>` : ''}</ul>
    <h4>Fuentes del avance</h4><p>${fuentesTxt(d)}</p>
    <p class="foot">Datos de ejemplo. Una persona revisa este reporte antes de enviarlo.</p>`;
}
function reportText(o) {
  const d = reportData(o), L = [];
  L.push(`REPORTE SEMANAL · ${o.nombre} · ${semana(o)}`, `${corte(o)} · Plan v${o.planVer} (${o.planEstado}) · días hábiles · pesos colombianos (COP)`, '(Datos de ejemplo)', '');
  L.push(`Avance según plan: ${pctTxt(d.av.plan)} · avance real: ${pctTxt(d.av.real)}`);
  L.push(`Entrega planeada: ${fmtDiaY(o, o.planEnd)}${d.ov.dias ? ` · proyectada: ${fmtDiaY(o, o.planEnd + d.ov.dias)} (+${dias(d.ov.dias)}; atraso ${fmtM(d.ov.costoAtraso)}${d.ov.refuerzos ? ' más ' + fmtM(d.ov.refuerzos) + ' de refuerzos decididos' : ''})` : ' · sin atraso proyectado'}`, '');
  if (d.abiertas.length) { L.push('DESVÍOS QUE NECESITAN DECISIÓN'); d.abiertas.forEach(a => L.push(`- ${a.cap} (${a.crew}): ritmo ${pctTxt(a.ritmo)} del plan, entrega +${dias(a.diasSin)}, costo ${fmtM(opcionCostos(o, a).seguir)} si no se hace nada. Responsable: ${quien(o, a.dec.responsable || 'director')}.`)); L.push(''); }
  if (d.tomadas.length) { L.push('DECISIONES'); d.tomadas.forEach(a => L.push(`- ${a.cap}: ${OPCT[a.dec.opcion]} · ${EST_DEC[a.dec.estado]} · responsable ${quien(o, a.dec.responsable || 'director')} · plazo ${fmtDiaY(o, (a.dec.decDia != null ? a.dec.decDia : o.hoy) + (a.dec.plazo != null ? a.dec.plazo : 5))}${a.dec.nota ? ' (' + a.dec.nota + ')' : ''}.`)); L.push(''); }
  if (d.vigilar.length) { L.push('PARA VIGILAR'); d.vigilar.forEach(a => L.push(`- ${a.cap}: ritmo ${pctTxt(a.ritmo)} del plan, sin impacto fuerte todavía.`)); L.push(''); }
  if (d.enRitmo.length) L.push('EN RITMO', '- ' + d.enRitmo.join(', '), '');
  if (d.bloq.length) { L.push('BLOQUEOS QUE SE NECESITAN PRONTO'); d.bloq.forEach(b => L.push(`- ${b.titulo} (${BLQ_TIPOS[b.tipo]}), responsable ${quien(o, b.resp)}.`)); L.push(''); }
  L.push('TIEMPO MUERTO', `- ${fmtH(d.horasPerd)} en los últimos 20 días hábiles (${fmtM(d.costoPerd)})`, '');
  L.push('DATOS PENDIENTES', `- Reportes sin confirmar: ${d.pend.length}`);
  if (d.desact.length) L.push(`- Dato desactualizado: ${d.desact.map(a => a.nombre).join(', ')}`);
  L.push(`- Personas con documentos pendientes o sin autorización: ${d.eq.length}`, '', 'FUENTES DEL AVANCE', '- ' + fuentesTxt(d));
  return L.join('\n');
}
function vReportes() {
  const o = cur(), inf = o.informes || [];
  return `<div class="row no-print"><button class="btn primary" data-act="report-save">Generar y guardar versión</button><button class="btn ghost" data-act="report-copy">Copiar texto</button><button class="btn ghost" data-act="report-print">Imprimir o guardar PDF</button></div>
    <div class="cols report"><div><p class="eyebrow">Vista previa con los datos de hoy</p><div class="paper">${reportPaper(o)}</div></div>
    <div class="card no-print"><h2>Versiones guardadas</h2><p class="muted sm">Una versión guardada conserva exactamente lo que se veía al generarla, aunque después cambien los datos.</p>
      ${inf.length ? `<ul class="vers">${inf.map((i, k) => `<li><div><b>Versión ${inf.length - k}</b><span>${esc(i.corte)} · plan v${i.planVer}</span></div><button class="btn ghost sm" data-act="report-view" data-id="${i.id}">Ver</button></li>`).join('')}</ul>` : '<p class="empty">Todavía no guardaste ninguna versión.</p>'}</div></div>`;
}

/* ---------- configuración ---------- */
function vConfig() {
  const o = cur(), f = (k, l, step, hint) => `<label class="blk">${l}<input type="number" min="0" step="${step}" data-act-change="cfg" data-k="${k}" value="${o[k]}"><small>${hint}</small></label>`;
  const fa = (k, l, step, hint) => `<label class="blk">${l}<input type="number" min="0" step="${step}" data-act-change="cfg-adm" data-k="${k}" value="${o.adm[k]}"><small>${hint}</small></label>`;
  return `<div class="cols cfg"><div>
      <div class="card"><h2>Parámetros de cálculo · ${esc(o.nombre)}</h2>
        ${f('trabajadores', 'Trabajadores afectados por un atraso', 5, 'Los que seguirían en obra mientras se atrasa.')}${f('costoMensual', 'Costo mensual total por persona ($)', 100000, 'Supuesto de ejemplo: 3 millones. De ahí salen el costo por día hábil (÷ 22) y por hora (÷ 176).')}${f('fijoDia', 'Costos fijos por día ($)', 250000, 'Campamento, vigilancia, equipos, interventoría.')}
        <p class="muted sm">Costo de un día de atraso: <b>${fmtCOP(costDia(o))}</b> = trabajadores × costo diario + costos fijos.</p>
        ${f('refuerzoBase', 'Costo base de reforzar una cuadrilla ($)', 500000, 'Valor inicial en las decisiones.')}
        <label class="blk">Ritmo que recupera un refuerzo (%)<input type="number" min="0" max="100" step="5" data-act-change="cfg-recover" value="${Math.round(recoverOf(o) * 100)}"><small>Supuesto de ejemplo, no un resultado comprobado. Cambia el efecto de reforzar en todas las decisiones.</small></label>
        ${f('costoIngreso', 'Costo de ingreso por persona ($)', 10000, 'Examen, curso de alturas, afiliaciones y prestaciones.')}</div>
      <div class="card"><h2>Supuestos del valor</h2><p class="muted sm">Con estos números se estima el valor. Son supuestos de ejemplo que el piloto debe medir.</p>
        ${f('paroEsperado', 'Días de paro que se esperan si un bloqueo no se resuelve a tiempo', 1, 'Se usa para estimar el paro evitado.')}
        ${fa('minManual', 'Minutos para procesar un reporte a mano', 5, 'Hoy, sin Obra IA.')}${fa('minRevision', 'Minutos para revisar un reporte leído', 1, 'Con Obra IA.')}${fa('minCorreccion', 'Minutos por corrección', 1, 'Se descuentan del ahorro.')}
        ${fa('informeManual', 'Minutos para armar el informe semanal a mano', 10, 'Hoy.')}${fa('informeRevision', 'Minutos para revisar el informe armado', 5, 'Con Obra IA.')}${fa('costoHora', 'Costo por hora de trabajo administrativo ($)', 1000, 'Residente o auxiliar.')}
        ${f('plataformaMes', 'Plataforma por mes ($)', 500000, 'Sin precio definido: 0.')}${f('implementacion', 'Implementación, una sola vez ($)', 500000, 'Sin precio definido: 0.')}</div>
      <div class="card"><h2>Responsables</h2><p class="muted sm">Aparecen en las intervenciones, decisiones y reportes.</p>
        ${Object.keys(o.roles).map(k => `<label class="blk">${ROLES[k]}<input type="text" data-act-change="role" data-k="${k}" value="${esc(o.roles[k])}"></label>`).join('')}</div></div>
    <div>
      <div class="card"><h2>Qué es real y qué está simulado</h2><ul class="check">
        <li><b>Real:</b> el cálculo del plan (dependencias entre actividades), del ritmo, de la entrega proyectada y del costo del atraso. Todo se recalcula al confirmar un reporte.</li>
        <li><b>Simulado:</b> la lectura de los mensajes (reglas simples, no IA) y el plan, que aquí viene precargado en vez de salir de los planos.</li>
        <li><b>No conectado:</b> contabilidad (el gasto es de ejemplo), WhatsApp y cualquier sistema externo.</li>
        <li><b>De ejemplo:</b> obras, personas, presupuesto, precios y costos. Nada es de una obra real.</li>
        <li><b>Convenciones:</b> duraciones en días hábiles (lunes a viernes); valores en pesos colombianos (COP); cada obra tiene su fecha de corte y su versión de plan, y la línea base es la entrega del plan validado.</li>
        <li><b>A validar en el piloto:</b> cómo reporta cada obra hoy, qué tan bien se lee ese reporte y si el ritmo detecta los desvíos a tiempo.</li></ul></div>
      <div class="card"><h2>Dónde se guardan los datos</h2><p class="muted sm">En este navegador (almacenamiento local), no en un servidor. Otra persona u otro computador no ven tus cambios. La demo guiada no guarda nada.</p></div>
      <div class="card"><h2>Controles de demo</h2><p class="muted sm">Para preparar una presentación.</p><div class="row"><button class="btn ghost" data-act="rep-simulate">Simular mensajes de la semana</button><button class="btn ghost" data-act="reset">Volver a los datos de ejemplo</button></div></div>
    </div></div>`;
}
