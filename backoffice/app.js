'use strict';
/* Obra IA · Back office · navegación, acciones y guardado. */

let S = loadState();
const UI = { filter: 'curso', q: '', alertCap: null, openRid: null, sheet: false, saved: { s: 'ok' } };
const $ = s => document.querySelector(s);

const route = () => { let h = (location.hash || '#/obras').replace('#/', ''); h = ALIAS[h] || h; return VIEWS[h] ? h : 'obras'; };
function render() {
  const r = route(), y = window.scrollY;
  $('#app').innerHTML = shell(r, VIEWS[r]());
  document.title = 'Obra IA · Back office · ' + TITLES[r][0];
  if (render.last === r) window.scrollTo(0, y);
  render.last = r;
}
const hhmm = () => { const d = new Date(); return pad(d.getHours()) + ':' + pad(d.getMinutes()); };
function persist() {
  const r = saveState(S);
  UI.saved = { s: r === true ? 'ok' : r === 'demo' ? 'demo' : 'err', t: r === true ? hhmm() : null };
  const el = $('#saveState'); if (el) el.outerHTML = saveChip();
  return r;
}
function commit(msg) { persist(); render(); if (msg) toast(msg); }
let toastT;
function toast(t) {
  const el = $('#toast'); el.textContent = t; el.classList.add('show');
  clearTimeout(toastT); toastT = setTimeout(() => el.classList.remove('show'), 3800);
}
function note(o, texto, cap) { o.bitacora.unshift({ dia: o.hoy, cap: cap || null, texto }); }

/* ---------- diálogos ---------- */
const dlg = $('#dlg');
function openDlg(html, wide) { dlg.className = wide ? 'wide' : ''; dlg.innerHTML = html; if (!dlg.open) dlg.showModal(); }
function closeDlg() { if (dlg.open) dlg.close(); }
function ask(title, text, ok, cb) {
  openDlg(`<h3>${title}</h3><p class="muted">${text}</p><div class="row end"><button class="btn ghost" data-act="dlg-close">Cancelar</button><button class="btn primary" id="askOk">${ok}</button></div>`);
  $('#askOk').onclick = () => { closeDlg(); cb(); };
}

/* ---------- decisiones: ayudas ---------- */
function selAlert(o) { const L = computeAlerts(o); return L.find(a => a.cap === UI.alertCap) || L[0]; }
function ensureDec(o, cap) { return o.decisiones[cap] = o.decisiones[cap] || { estado: 'abierta', opcion: null, nota: '', costoRefuerzo: null, responsable: null, plazo: null }; }

/* ---------- tarjeta de reporte: ayudas ---------- */
const cardVals = card => ({ act: card.querySelector('[data-f=act]').value, dia: card.querySelector('[data-f=dia]').value, pct: card.querySelector('[data-f=pct]').value, rend: card.querySelector('[data-f=rend]').value });
function refreshSummary(card) {
  const o = cur(), v = cardVals(card), a = o.acts.find(z => z.id === v.act) || null, act = card.querySelector('summary .rv-act'), pc = card.querySelector('summary .rv-pct');
  if (act) { act.childNodes[0].textContent = a ? a.nombre : 'Actividad sin identificar'; act.querySelector('small').textContent = a ? a.cap : 'elígela al abrir'; }
  if (pc) pc.childNodes[0].textContent = v.pct === '' ? '—' : v.pct + '%';
}
function refreshEffect(card) {
  const o = cur(), v = cardVals(card), a = o.acts.find(z => z.id === v.act) || null;
  card.querySelector('.effect').textContent = effectText(o, a, v.pct, v.rend, v.dia);
  refreshSummary(card);
}
function refreshCard(card) {
  const o = cur(), v = cardVals(card), a = o.acts.find(z => z.id === v.act) || null, reading = card.querySelector('.reading');
  const oldU = reading.dataset.und || '', newU = a ? a.und : '';
  card.querySelector('.u').textContent = newU || 'u';
  card.querySelector('.cmp').innerHTML = cmpText(o, a);
  card.querySelector('.hbody').innerHTML = histHtml(o, a);
  if (oldU !== newU) {
    const rend = card.querySelector('[data-f=rend]');
    if (rend.value !== '') { rend.value = ''; toast('Cambió la unidad (' + (newU || 'sin actividad') + '/día): borré el rendimiento. Captúralo de nuevo si aplica.'); }
    reading.dataset.und = newU;
  }
  refreshEffect(card);
}

/* ---------- acciones por clic ---------- */
const ACT = {
  'dlg-close': el => { if (el && el.dataset && el.dataset.cap) UI.alertCap = el.dataset.cap; closeDlg(); },
  reset: () => ask('Volver a los datos de ejemplo', 'Se pierden los cambios que hiciste en este navegador.', 'Volver', () => { S = resetState(); UI.alertCap = null; UI.openRid = null; UI.q = ''; UI.filter = 'curso'; commit('Datos de ejemplo restaurados.'); }),
  'open-obra': el => { S.obraId = el.dataset.id; UI.alertCap = null; persist(); if (location.hash === '#/hoy') render(); else location.hash = '#/hoy'; },
  'sheet-toggle': () => { UI.sheet = !UI.sheet; render(); },
  'fab-capture': () => { UI.sheet = false; if (route() !== 'avances') location.hash = '#/avances'; else render(); setTimeout(() => { const t = $('#newText'); if (t) { t.scrollIntoView({ block: 'center' }); t.focus(); } }, 200); },
  'plan-filter': el => { UI.filter = el.dataset.f; render(); },
  'plan-clear': () => { UI.filter = 'curso'; UI.q = ''; render(); },
  'plan-validate': () => { const o = cur(); o.planEstado = 'validado'; o.baseEnd = o.planEnd; note(o, 'Plan v' + o.planVer + ' validado. Nueva línea base: entrega ' + fmtDiaY(o, o.planEnd) + '.'); commit('Plan v' + o.planVer + ' validado. Es la nueva línea base.'); },
  'act-detail': el => { const o = cur(), a = o.acts.find(x => x.id === el.dataset.id); if (a) openDlg(actDetail(o, a), true); },
  'act-edit': el => {
    const o = cur(), a = o.acts.find(x => x.id === el.dataset.id), p = o._plan[a.id];
    const pre = a.preds.map(id => o.acts.find(x => x.id === id).nombre).join(', ') || 'ninguna';
    openDlg(`<h3>Editar plan · ${esc(a.nombre)}</h3><p class="muted sm">${a.cap} · ${fmtDia(o, p.ini)} a ${fmtDia(o, p.fin)} · depende de: ${esc(pre)}</p>
      <label class="blk">Duración (días hábiles)<input id="e-dur" type="number" min="1" value="${a.dur}"></label>
      <p class="preview" id="e-prev">Sin cambios en el cronograma.</p>
      <label class="blk">Cantidad (${a.und})<input id="e-qty" type="number" min="0" value="${a.qty}"></label>
      <label class="blk">Cuadrilla<input id="e-crew" type="text" value="${esc(a.crew)}"></label>
      <div class="row end"><button class="btn ghost" data-act="act-detail" data-id="${a.id}">Volver al detalle</button><button class="btn primary" data-act="act-save" data-id="${a.id}">Guardar como plan v${(o.planVer || 1) + 1}</button></div>`);
    const upd = () => {
      const d = Math.max(1, Math.round(+$('#e-dur').value || a.dur)), pv = previewEdit(o, a.id, d);
      $('#e-prev').textContent = d === a.dur ? 'Sin cambios en el cronograma.' : `Con este cambio, ${pv.moved} actividad${pv.moved === 1 ? '' : 'es'} se mueve${pv.moved === 1 ? '' : 'n'} y la entrega pasa del ${fmtDiaY(o, o.planEnd)} al ${fmtDiaY(o, pv.end)} (${pv.delta >= 0 ? '+' : ''}${dias(pv.delta)}). La línea base (${fmtDiaY(o, o.baseEnd)}) se conserva.`;
    };
    $('#e-dur').addEventListener('input', upd);
  },
  'act-save': el => {
    const o = cur(), a = o.acts.find(x => x.id === el.dataset.id), before = o.planEnd;
    a.dur = Math.max(1, Math.round(+$('#e-dur').value || a.dur)); a.qty = Math.max(0, +$('#e-qty').value || 0); a.crew = $('#e-crew').value.trim() || a.crew;
    recompute(o); closeDlg();
    o.planVer = (o.planVer || 1) + 1; o.planEstado = 'borrador';
    note(o, 'Plan v' + o.planVer + ': ' + a.nombre + ' dura ' + a.dur + ' días. Falta validarlo.', a.cap);
    commit(o.planEnd !== before ? 'Plan v' + o.planVer + ' guardado. La entrega pasó del ' + fmtDiaY(o, before) + ' al ' + fmtDiaY(o, o.planEnd) + '. Falta validarlo.' : 'Plan v' + o.planVer + ' guardado. Falta validarlo.');
  },
  'rep-parse': () => {
    const o = cur(), text = $('#newText').value.trim();
    if (!text) return toast('Pega primero el mensaje de la obra.');
    const p = parseMessage(o, text), rid = 'r' + (S.seq++);
    o.reportes.unshift({ id: rid, actId: p.actId, pct: p.pct, rend: p.rend, fuente: 'Manual', fotos: 0, autor: 'Registrado por ti', texto: text, dia: o.hoy, hora: hhmm(), estado: 'pendiente' });
    UI.openRid = rid;
    commit(p.conf === 'alta' ? 'Mensaje leído. Revisa los campos y confirma.' : 'Leído con dudas. Revisa los campos antes de confirmar.');
  },
  'rep-simulate': () => { const o = cur(), n = simulateInbox(S, o); if (route() !== 'avances') location.hash = '#/avances'; commit(n ? 'Llegaron ' + n + ' mensajes de la obra (simulados).' : 'No hay actividades en curso para simular.'); },
  'rep-confirm': el => {
    const o = cur(), card = el.closest('.rv'), r = o.reportes.find(x => x.id === el.dataset.id), v = cardVals(card);
    if (!v.act) return toast('Elige la actividad antes de confirmar.');
    if (v.pct === '' || isNaN(+v.pct) || +v.pct < 0 || +v.pct > 100) return toast('El avance debe estar entre 0 y 100.');
    if (v.rend !== '' && (isNaN(+v.rend) || +v.rend < 0)) return toast('El rendimiento debe ser un número positivo.');
    r.actId = v.act; r.pct = +v.pct; r.rend = v.rend === '' ? null : +v.rend; r.dia = +v.dia;
    applyReport(o, r); UI.openRid = null;
    commit('Reporte confirmado. El plan y las decisiones se recalcularon.');
  },
  'rep-discard': el => { const o = cur(); o.reportes.find(x => x.id === el.dataset.id).estado = 'descartado'; commit('Reporte descartado.'); },
  'rep-correct': el => {
    const o = cur(), r = o.reportes.find(x => x.id === el.dataset.id), a = o.acts.find(x => x.id === r.actId), rid = 'r' + (S.seq++);
    o.reportes.unshift({ id: rid, actId: r.actId, pct: r.pct, rend: r.rend, fuente: 'Corrección', fotos: 0, autor: 'Corrección registrada por ti', texto: 'Corrección del registro del ' + fmtDia(o, r.dia) + ' de ' + (a ? a.nombre : r.actId) + ': ' + r.texto, dia: r.dia, hora: hhmm(), estado: 'pendiente', corrige: r.id });
    UI.openRid = rid; commit('Corrige el dato y confirma: el registro anterior queda como corregido.');
  },
  'dec-select': el => { UI.alertCap = el.dataset.cap; render(); },
  'dec-opt': el => { const o = cur(), a = selAlert(o); ensureDec(o, a.cap).opcion = el.dataset.k; commit(); },
  'dec-send': () => { const o = cur(), a = selAlert(o); ensureDec(o, a.cap).estado = 'en_comite'; note(o, 'Decisión preparada para el comité del lunes.', a.cap); commit('Preparada para el comité del lunes.'); },
  'dec-decide': () => {
    const o = cur(), a = selAlert(o), d = ensureDec(o, a.cap);
    if (!d.opcion) return toast('Elige una opción antes de registrar la decisión.');
    d.estado = 'decidida'; d.decDia = o.hoy; d.ritmoAntes = a.ritmo; d.responsable = d.responsable || 'director'; d.plazo = d.plazo != null ? d.plazo : 5;
    note(o, 'Decisión: ' + OPCT[d.opcion] + '. Responsable: ' + quien(o, d.responsable) + '.', a.cap);
    commit('Decisión registrada. La entrega proyectada se recalculó.');
  },
  'dec-exec': () => { const o = cur(), a = selAlert(o), d = ensureDec(o, a.cap); d.estado = 'ejecucion'; d.execDia = o.hoy; note(o, 'En ejecución: ' + OPCT[d.opcion] + '.', a.cap); commit('Marcada en ejecución. Falta comprobar el resultado.'); },
  'dec-verify': () => {
    const o = cur(), a = selAlert(o), d = ensureDec(o, a.cap), raw = +$('#v-ritmo').value;
    if (!raw || raw < 30 || raw > 130) return toast('El ritmo observado debe estar entre 30 y 130.');
    const v = clamp(raw / 100, 0.3, 1.3), antes = d.ritmoAntes != null ? d.ritmoAntes : a.ritmo, esperado = antes + (1 - antes) * recoverOf(o);
    const rec = antes >= 1 ? 0 : clamp((v - antes) / (1 - antes), 0, 1);
    d.estado = 'verificada'; d.verif = { dia: o.hoy, ritmo: v, esperado, rec };
    o.ritmos[a.cap] = { v, dia: o.hoy };
    note(o, 'Resultado verificado: ritmo observado ' + Math.round(v * 100) + '% (esperado ' + Math.round(esperado * 100) + '%).', a.cap);
    commit('Resultado verificado. El plan usa ahora el ritmo observado.');
  },
  'dec-use-rec': () => { const o = cur(), a = selAlert(o), d = ensureDec(o, a.cap); if (!d.verif) return; o.recover = d.verif.rec; note(o, 'Supuesto de recuperación actualizado a ' + Math.round(d.verif.rec * 100) + '% con el resultado observado.', a.cap); commit('Supuesto de la obra actualizado.'); },
  'dec-reopen': () => { const o = cur(), a = selAlert(o), d = ensureDec(o, a.cap); d.estado = 'abierta'; delete d.verif; note(o, 'Decisión reabierta.', a.cap); commit('Decisión reabierta.'); },
  'pres-validate': () => { const o = cur(); o.presupuesto.forEach(l => l.estado = 'validado'); note(o, 'Presupuesto validado por el presupuestista.'); commit('Presupuesto validado.'); },
  'worker-new': () => {
    openDlg(`<h3>Registrar ingreso</h3>
      <label class="blk">Nombre<input id="w-nom" type="text" placeholder="Nombre y apellido"></label>
      <label class="blk">Oficio<select id="w-of"><option>Formaletero</option><option>Ayudante de formaleta</option><option>Figurador</option><option>Latero</option><option>Plomero</option><option>Electricista</option><option>Pintor</option><option>Enchapador</option><option>Fachalero</option></select></label>
      <label class="chk"><input type="checkbox" id="w-ex"> Examen médico vigente</label>
      <label class="chk"><input type="checkbox" id="w-al"> Curso de alturas vigente</label>
      <label class="chk"><input type="checkbox" id="w-arl"> Afiliado a ARL</label>
      <label class="chk"><input type="checkbox" id="w-pr"> Prestaciones pagadas</label>
      <p class="muted sm" id="w-res">Falta: examen médico, curso de alturas, ARL, prestaciones.</p>
      <div class="row end"><button class="btn ghost" data-act="dlg-close">Cancelar</button><button class="btn primary" data-act="worker-save">Registrar</button></div>`);
    const upd = () => { const m = []; if (!$('#w-ex').checked) m.push('examen médico'); if (!$('#w-al').checked) m.push('curso de alturas'); if (!$('#w-arl').checked) m.push('ARL'); if (!$('#w-pr').checked) m.push('prestaciones'); $('#w-res').textContent = m.length ? 'Faltan documentos: ' + m.join(', ') + '. No debería entrar a la obra todavía.' : 'Documentos completos. Falta la autorización de ingreso de ' + quien(cur(), 'sst') + '.'; };
    ['#w-ex', '#w-al', '#w-arl', '#w-pr'].forEach(s => $(s).addEventListener('change', upd));
  },
  'worker-save': () => {
    const o = cur(), nom = $('#w-nom').value.trim();
    if (!nom) return toast('Escribe el nombre.');
    const w = { id: 'w' + (S.seq++), nombre: nom, oficio: $('#w-of').value, crew: 'Por asignar', ingresoDia: o.hoy, exam: $('#w-ex').checked ? o.hoy + 90 : null, alturas: $('#w-al').checked ? o.hoy + 180 : null, arl: $('#w-arl').checked, prest: $('#w-pr').checked, retiroDia: null, aut: null };
    o.personal.unshift(w); closeDlg(); const p = workerPend(o, w);
    note(o, 'Ingreso registrado: ' + nom + (p.length ? ' (documentos pendientes: ' + p.join(', ') + ').' : ' (documentos completos, falta autorizar).'));
    commit(p.length ? 'Registrado, pero faltan documentos: ' + p.join(', ') + '.' : 'Registrado. Falta la autorización de ingreso.');
  },
  'worker-auth': el => { const o = cur(), w = o.personal.find(x => x.id === el.dataset.id); w.aut = { por: 'sst', dia: o.hoy }; note(o, 'Ingreso autorizado por ' + quien(o, 'sst') + ': ' + w.nombre + '.'); commit('Ingreso autorizado: ' + w.nombre + '.'); },
  'worker-retire': el => { const o = cur(), w = o.personal.find(x => x.id === el.dataset.id); w.retiroDia = o.hoy; note(o, 'Retiro registrado: ' + w.nombre + '.'); commit(w.nombre + ' salió de la obra.'); },
  'report-save': () => {
    const o = cur(); o.informes = o.informes || [];
    o.informes.unshift({ id: 'i' + (S.seq++), planVer: o.planVer, corte: corte(o), html: reportPaper(o), texto: reportText(o) });
    note(o, 'Reporte semanal guardado como versión ' + o.informes.length + '.'); commit('Versión ' + o.informes.length + ' guardada. Conserva lo que se veía hoy.');
  },
  'report-view': el => { const o = cur(), i = o.informes.find(x => x.id === el.dataset.id); openDlg(`<div class="paper in-dlg">${i.html}</div><div class="row end"><button class="btn ghost" data-act="dlg-close">Cerrar</button></div>`, true); },
  'report-copy': () => {
    const t = reportText(cur());
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(t).then(() => toast('Reporte copiado.'), () => toast('No se pudo copiar desde este navegador.'));
    else toast('No se pudo copiar desde este navegador.');
  },
  'report-print': () => window.print()
};

/* ---------- cambios en campos ---------- */
const later = () => setTimeout(render, 220);
const CHG = {
  'dec-ref': t => {
    const o = cur(), a = selAlert(o); ensureDec(o, a.cap).costoRefuerzo = Math.max(0, +t.value || 0); persist();
    const c = opcionCostos(o, selAlert(o)), s = document.querySelector('.opt[data-k=reforzar] strong'); if (s) s.textContent = fmtM(c.reforzar);
  },
  'dec-note': t => { const o = cur(); ensureDec(o, selAlert(o).cap).nota = t.value; persist(); },
  'dec-resp': t => { const o = cur(); ensureDec(o, selAlert(o).cap).responsable = t.value; persist(); },
  'dec-plazo': t => { const o = cur(); ensureDec(o, selAlert(o).cap).plazo = +t.value; persist(); later(); },
  'pres-edit': t => { const o = cur(), l = o.presupuesto[+t.dataset.i], f = t.dataset.f; l[f] = Math.max(0, Math.round(+t.value || 0)) * 1e6; if (f === 'valor') l.estado = 'borrador'; persist(); later(); },
  'cfg-recover': t => { const o = cur(); o.recover = clamp((+t.value || 0) / 100, 0, 1); persist(); later(); },
  cfg: t => { const o = cur(); o[t.dataset.k] = Math.max(0, +t.value || 0); persist(); later(); },
  role: t => { const o = cur(); o.roles[t.dataset.k] = t.value.trim() || ROLES[t.dataset.k]; persist(); }
};

document.addEventListener('click', e => { const el = e.target.closest('[data-act]'); if (el && ACT[el.dataset.act]) ACT[el.dataset.act](el, e); });
document.addEventListener('keydown', e => { if ((e.key === 'Enter' || e.key === ' ') && e.target.matches && e.target.matches('tr[data-act]')) { e.preventDefault(); e.target.click(); } });
document.addEventListener('input', e => {
  const t = e.target, d = t.dataset || {};
  if (d.actChange === 'dec-ref') CHG['dec-ref'](t);
  else if (d.actInput === 'plan-q') { UI.q = t.value; const o = cur(), rows = $('#planRows'); if (rows) rows.innerHTML = planRows(o); }
  else if (t.matches && t.matches('.rv [data-f=pct], .rv [data-f=rend]')) refreshEffect(t.closest('.rv'));
});
document.addEventListener('change', e => {
  const t = e.target;
  if (t.matches && t.matches('.rv [data-f=act], .rv [data-f=dia]')) { refreshCard(t.closest('.rv')); return; }
  if (t.dataset.bind === 'obra') { S.obraId = t.value; UI.alertCap = null; persist(); render(); return; }
  const a = t.dataset.actChange; if (a && CHG[a]) CHG[a](t);
});
window.addEventListener('hashchange', () => { UI.sheet = false; render(); window.scrollTo(0, 0); });
render();
