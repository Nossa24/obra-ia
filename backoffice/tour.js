'use strict';
/* Obra IA · Back office · demo guiada.
   Oscurece la pantalla, ilumina cada parte, explica y hace las acciones clave.
   Corre sobre datos de ejemplo limpios; al terminar restaura el estado del usuario. */

const TOUR = { i: -1, snaps: [], userSnap: null, nodes: null, busy: false, raf: 0 };
window.TOUR_ACTIVE = false;

const wait = ms => new Promise(r => setTimeout(r, ms));
const visible = el => (el && el.offsetParent !== null ? el : null);
function tourData() {
  const o = cur(), al = computeAlerts(o)[0] || null;
  return { o, al, av: avance(o), ov: overall(o), c: al ? opcionCostos(o, al) : null };
}
const atrasoTxt = a => a >= 0.5 ? 'es de ' + (Math.round(a * 10) / 10).toString().replace('.', ',') + ' días' : 'casi no se ve';
const navLink = r => () => visible(document.querySelector('.side nav a[href="#/' + r + '"]')) || visible(document.querySelector('.mnav a[href="#/' + r + '"]'));

const clickIf = s => { const e = document.querySelector(s); if (e) e.click(); return e; };
const qv = s => () => document.querySelector(s);
const fin = (titulo, texto) => ({ title: titulo, text: texto, next: 'Terminar' });
const GENERAL = [
  { route: 'obras', title: 'Así funcionaría Obra IA en tu obra', text: () => 'Recorre en unos minutos una obra de ejemplo: del plan completo a la alerta temprana, la decisión, la comprobación de su resultado y el valor que se mide. Todo son datos de ejemplo, ninguno es de una obra real.', next: 'Empezar' },
  { route: 'obras', target: '.kpis', place: 'bottom', title: 'Tus obras, de un vistazo', text: () => 'Reportes por confirmar, decisiones abiertas y cuánto costaría el atraso si nada cambia, con todas tus obras juntas.' },
  { route: 'obras', target: '.obra.sel', place: 'right', title: 'Va en plan, y aun así hay un problema', text: () => { const d = tourData(); return 'Torre Norte lleva ' + pctTxt(d.av.real) + ' de avance contra ' + pctTxt(d.av.plan) + ' planeado: parece que todo va bien. Pero ya proyecta ' + dias(d.ov.dias) + ' de atraso en la entrega. Veamos de dónde sale.'; } },
  { route: 'hoy', target: '.ints', place: 'bottom', title: 'Cada mañana: lo que importa hoy', text: () => { const L = intervenciones(cur()); return 'Obra IA ordena lo que necesita atención, con su motivo, el responsable y la acción. Lo primero hoy: ' + (L[0] ? L[0].motivo : 'nada'); } },
  { route: 'hoy', target: '.chart', place: 'bottom', title: 'El avance, contra el plan', text: () => 'La curva S compara lo planeado con lo real y proyecta la entrega con el ritmo actual. Al lado, el ritmo de cada cuadrilla y los tiempos muertos por causa.' },
  { route: 'plan', target: () => document.querySelector('.gantt').closest('.card'), place: 'bottom', title: 'El plan completo, de punta a punta', text: () => 'Desde los planos licenciados se arma la programación de toda la obra, no solo de los próximos 15 días. La línea negra es hoy; lo rayado es el atraso que se proyecta. Cada versión del plan conserva su línea base.' },
  { route: 'plan', target: '.tbl-wrap', place: 'top', title: 'Cada actividad, con su cuadrilla', text: () => 'Cantidad, rendimiento planeado y fechas. Al tocar una fila se abre el detalle de la actividad: plan, avance confirmado, evidencia, decisiones y cambios. Si editas una duración, ves antes qué se mueve.' },
  { route: 'avances', target: '.rv summary', place: 'bottom', title: 'Lo que reporta la obra', text: () => 'El contramaestro escribe como hoy, por WhatsApp. Obra IA lo lee y arma una bandeja: quién, qué actividad entendió, cuánto avance y qué tan seguro está. Aquí la lectura es simulada con reglas; en el piloto la hace un modelo de IA.' },
  { route: 'avances', target: '.rv[open] .reading', place: 'right', title: 'Lo que se registraría', text: () => 'Abierto el reporte, se ve el mensaje con lo que sustenta cada campo resaltado, la fecha del trabajo, el avance acumulado y el rendimiento del día. Si algo está mal, se corrige antes de confirmar.' },
  { route: 'avances', target: '.rv[open] .rc-actions', place: 'right', title: 'Una persona confirma', text: () => 'Nada cuenta hasta que alguien lo confirma, y el botón dice qué se recalcula. Confirmemos los tres reportes.', next: 'Confirmar los tres' },
  { route: 'avances', target: navLink('decisiones'), place: 'right', title: 'Al confirmar, todo se recalcula', enter() { for (let k = 0; k < 8; k++) { const b = document.querySelector('[data-act=rep-confirm]'); if (!b) break; b.click(); } }, text: () => 'Con cada reporte confirmado, Obra IA recalcula el ritmo de cada cuadrilla y proyecta la fecha de entrega. Por eso la decisión aparece antes de que el atraso se vea.' },
  { route: 'decisiones', target: '.det .metrics', place: 'bottom', title: 'El problema, con su costo', text: () => { const d = tourData(); if (!d.al) return 'Sin decisiones pendientes.'; return d.al.crew + ' va al ' + pctTxt(d.al.ritmo) + ' del ritmo planeado. Hoy el atraso ' + atrasoTxt(d.al.atraso) + '; a este ritmo la entrega se mueve ' + dias(d.al.diasSin) + ' y el atraso cuesta ' + fmtM(d.c.seguir) + '. Debajo, la evidencia de los reportes que lo sustentan.'; } },
  { route: 'decisiones', target: '.opts3', place: 'top', title: 'Tú decides', text: () => 'Obra IA compara las opciones con su costo y deja claro el supuesto de cada una. La decisión es de tu equipo, con responsable y plazo; Obra IA no cambia nada por su cuenta.', next: 'Reforzar y decidir' },
  { route: 'decisiones', target: '.stepper', place: 'bottom', title: 'Decisión registrada', enter() { clickIf('[data-k=reforzar]'); clickIf('[data-act=dec-decide]'); }, text: () => { const d = tourData(); if (!d.al) return ''; return 'Con el refuerzo la entrega se mueve ' + dias(d.al.diasRef) + ' en vez de ' + dias(d.al.diasSin) + ', y el costo baja de ' + fmtM(d.c.seguir) + ' a ' + fmtM(d.c.reforzar) + ' (incluye ' + fmtM(d.c.ref) + ' del refuerzo). Queda con responsable y fecha límite.'; }, next: 'Ejecutar y comprobar' },
  { route: 'decisiones', target: '.verbox', place: 'top', title: 'Y se comprueba el resultado', enter() { clickIf('[data-act=dec-exec]'); const v = document.querySelector('#v-ritmo'); if (v) v.value = 95; clickIf('[data-act=dec-verify]'); }, text: () => { const d = tourData(), v = d.al && d.al.dec.verif; if (!v) return ''; return 'Semanas después, con reportes nuevos, se registra el ritmo observado: ' + pctTxt(v.ritmo) + ' contra ' + pctTxt(v.esperado) + ' esperado. Se recuperó el ' + Math.round(v.rec * 100) + '% del ritmo perdido, no el ' + Math.round(recoverOf(d.o) * 100) + '% supuesto. El plan usa el dato real y el supuesto se puede corregir.'; } },
  { route: 'bloqueos', target: '.look', place: 'top', title: 'Antes de que pare la cuadrilla', text: () => 'Una alerta sola no ahorra nada. Aquí se ve qué le falta a cada actividad de las próximas tres semanas (material, plano, equipo, actividad previa, personal) y quién lo resuelve. Lo que se resuelve antes de necesitarse evita el paro.' },
  { route: 'valor', target: '.mecs', place: 'bottom', title: 'El valor, en tres mecanismos', enter() { UI.valorTab = 'resumen'; }, text: () => { const v = valor(cur()); return 'Menos trabajo administrativo (' + fmtH(v.adm.horas) + ' netas), mayor productividad (' + fmtH(v.prod.horasEvit) + ' de paro evitadas) y menor costo del atraso (' + dias(v.atraso.dias) + ' evitados, ' + fmtM(v.atraso.neto) + ' netos de refuerzos). Con datos de ejemplo y supuestos a validar en el piloto.'; } },
  { route: 'costos', target: '.tbl-wrap', place: 'top', title: 'Costos: lo planeado y lo gastado', text: () => 'El presupuesto sale de los planos como borrador y lo valida tu presupuestista. Con el avance real se calcula el valor ganado y se compara con el gasto real y lo comprometido.' },
  { route: 'equipo', target: '.kpis', place: 'bottom', title: 'Equipo y documentos', text: () => 'Quién tiene sus documentos al día y quién tiene autorizado el ingreso. Obra IA revisa los documentos; la autorización la da la persona de SST. También muestra cuánta gente se va antes de 5 días: plata de ingreso perdida.' },
  { route: 'reportes', target: '.paper .dec, .paper .flag', place: 'bottom', title: 'El reporte del lunes se arma solo', text: () => 'Todo lo anterior queda en un reporte para el comité: avance contra el plan, decisiones con responsable y plazo, bloqueos, tiempo muerto, datos pendientes y fuentes. Se guarda como versión y conserva lo que se veía al generarlo.' },
  { title: 'Qué es real y qué falta', text: () => 'Real: el cálculo del plan, del ritmo, de la fecha proyectada, del tiempo muerto y del costo del atraso. Simulado: la lectura de los mensajes y el plan desde los planos. El gasto y los tiempos de ejemplo son supuestos. El siguiente paso es un piloto con tus planos y los reportes de una obra real.', next: 'Terminar' }
];
const S_BLOQUEO = [
  { route: 'avances', target: '.rv[open] .bubble', place: 'bottom', title: 'Escenario 1 · Una cuadrilla se para por un bloqueo', enter() { UI.openRid = inyectarParo(S, cur()); }, text: () => 'Mayor productividad. Llega un mensaje de campo: la grúa torre sigue en mantenimiento y 8 personas pararon 4 horas. Hoy el ingeniero se entera cuando ya pasó.' },
  { route: 'avances', target: '.rv[open] .parobox', place: 'top', title: 'Obra IA lo detecta', text: () => { const o = cur(); return 'Del mensaje saca el tiempo muerto (8 personas × 4 horas = 32 horas, unos ' + fmtCOP(Math.round(32 * costoHora(o))) + ' pagados sin producir), la causa (equipo) y propone un responsable. Una persona lo revisa.'; } },
  { route: 'avances', target: '.rv[open] .rc-actions', place: 'right', title: 'Se confirma', text: () => 'Al confirmar, queda registrado el avance, el tiempo muerto y el bloqueo que lo causó.', next: 'Confirmar' },
  { route: 'avances', target: navLink('bloqueos'), place: 'right', title: 'Queda registrado', enter() { clickIf('[data-act=rep-confirm]'); }, text: () => 'Se creó el tiempo muerto (32 horas) y un bloqueo asociado en la sección Bloqueos, con responsable asignado.' },
  { route: 'bloqueos', target: () => document.querySelector('tr[data-act=blq-detail]'), place: 'top', title: 'Un bloqueo con dueño', text: () => 'El bloqueo aparece con su responsable, la fecha en que se necesitaba y el riesgo si vuelve a parar la cuadrilla. Cada persona del equipo ve lo que le toca resolver.' },
  { route: 'bloqueos', target: '.look', place: 'top', title: 'Y se ve qué más depende de eso', text: () => 'El look-ahead muestra las actividades de las próximas tres semanas y qué le falta a cada una. La placa del nivel 10 está con restricción: falta el detalle de la rampa y la grúa debe estar disponible.' },
  { route: 'bloqueos', target: () => document.querySelector('.kpis .kpi:nth-child(3)'), place: 'bottom', title: 'Resolver tarde cuesta', enter() { clickIf('tr[data-act=blq-detail]'); clickIf('#dlg [data-act=blq-resolve]'); }, text: () => { const v = valor(cur()); return 'La grúa se resolvió el mismo día, pero ya se habían perdido horas: en 20 días, ' + fmtH(v.prod.horasPerd) + ' pagadas sin producir (' + fmtM(v.prod.costoPerd) + ').'; } },
  { route: 'bloqueos', target: () => document.querySelector('.kpis .kpi:nth-child(4)'), place: 'bottom', title: 'Resolver antes, ahorra', enter() { const row = [...document.querySelectorAll('tr[data-act=blq-detail]')].find(r => r.innerText.includes('rampa')); if (row) row.click(); clickIf('#dlg [data-act=blq-resolve]'); }, text: () => { const v = valor(cur()); return 'El detalle de la rampa se resolvió antes de que la cuadrilla llegara a esa actividad. Ese paro no ocurrió: hoy suman ' + v.prod.evitN + ' bloqueos resueltos a tiempo y ' + fmtH(v.prod.horasEvit) + ' de paro evitadas (estimado).'; } },
  { route: 'valor', target: '.mecs article:nth-child(2)', place: 'bottom', title: 'Cómo se mide', enter() { UI.valorTab = 'resumen'; }, text: () => 'Se mide en horas de tiempo muerto y en capacidad recuperada. No es caja hasta que evita horas extras, contrataciones o una extensión de la obra, y el paro esperado es un supuesto que el piloto debe comprobar.' },
  fin('Lo que muestra este escenario', () => 'Mostrar una alerta por sí solo no genera ahorro. El ahorro aparece cuando el bloqueo se resuelve antes de que pare la cuadrilla, y para eso la plataforma tiene que decir qué falta, quién lo resuelve y para cuándo.')
];
const S_MES = [
  { route: 'decisiones', target: '.equiv', place: 'bottom', title: 'Escenario 2 · Evitar un mes adicional de una cuadrilla', text: () => { const d = tourData(); return 'Menor costo del atraso. La estructura va al ' + pctTxt(d.al.ritmo) + ' del ritmo y la entrega se mueve ' + dias(d.al.diasSin) + '. Para dimensionarlo: un mes más de una cuadrilla de 10 personas cuesta ' + fmtM(10 * d.o.costoMensual) + ' brutos.'; } },
  { route: 'decisiones', target: '.opts3', place: 'top', title: 'Seguir o reforzar, con su costo', text: () => 'Obra IA compara las dos opciones con días de atraso y costo, y deja visible el supuesto de cuánto ritmo recupera un refuerzo.', next: 'Reforzar y decidir' },
  { route: 'decisiones', target: '.stepper', place: 'bottom', title: 'La decisión tiene dueño y plazo', enter() { clickIf('[data-k=reforzar]'); clickIf('[data-act=dec-decide]'); }, text: () => 'Queda registrada con responsable y fecha límite. La plataforma no ejecuta nada: ayuda a decidir a tiempo.', next: 'Ejecutar y comprobar' },
  { route: 'decisiones', target: '.verbox', place: 'top', title: 'Se comprueba cuánto se recuperó', enter() { clickIf('[data-act=dec-exec]'); const v = document.querySelector('#v-ritmo'); if (v) v.value = 95; clickIf('[data-act=dec-verify]'); }, text: () => { const v = tourData().al.dec.verif; return 'Con reportes nuevos se registra el ritmo observado (' + pctTxt(v.ritmo) + '). Se recuperó el ' + Math.round(v.rec * 100) + '% del ritmo perdido, no necesariamente lo supuesto.'; } },
  { route: 'valor', target: '.mecs article:nth-child(3)', place: 'bottom', title: 'Lo que se evitó, neto', enter() { UI.valorTab = 'resumen'; }, text: () => { const v = valor(cur()); return 'Días evitados: ' + v.atraso.dias + '. Ahorro bruto ' + fmtM(v.atraso.bruto) + ', menos ' + fmtM(v.atraso.refuerzos) + ' de refuerzo: ' + fmtM(v.atraso.neto) + ' netos. Solo es ahorro si ese costo realmente deja de pagarse.'; } },
  fin('Lo que muestra este escenario', () => 'La alerta sale del ritmo, la decisión se compara con su costo y el resultado se comprueba con reportes. Al valor bruto se le descuentan los refuerzos, la plataforma y cualquier costo de acelerar.')
];
const S_ADMIN = [
  { route: 'avances', target: '.bandeja', place: 'right', title: 'Escenario 3 · Menos trabajo administrativo', text: () => { const o = cur(), n = pendRep(o).length, v = valor(o); return 'El residente hoy pasa horas recopilando mensajes y actualizando avances. Aquí esperan ' + n + ' reportes ya leídos, cada uno con lo que se registraría; en el último mes Obra IA ya leyó ' + v.adm.conf + ' reportes (ejemplo).'; } },
  { route: 'avances', target: '[data-act=rep-confirm-all]', place: 'bottom', title: 'Revisar y confirmar en bloque', text: () => 'Los de lectura segura se confirman juntos; los que traen dudas (varios porcentajes, tiempo muerto, posible duplicado) se revisan uno por uno.', next: 'Confirmar en bloque' },
  { route: 'avances', target: navLink('reportes'), place: 'right', title: 'Confirmados de una vez', enter() { clickIf('[data-act=rep-confirm-all]'); }, text: () => { const o = cur(); return 'Quedaron confirmados y el plan se recalculó. Los que traen dudas siguen en la bandeja (' + pendRep(o).length + ') para revisarlos uno por uno.'; } },
  { route: 'reportes', target: '.vers', place: 'left', title: 'El informe sale armado', enter() { clickIf('[data-act=report-save]'); }, text: () => 'Con lo confirmado, el reporte semanal se arma solo y se guarda como versión. Antes se armaba a mano para el comité.' },
  { route: 'valor', target: '.mecs article:nth-child(1)', place: 'bottom', title: 'Cómo se mide', enter() { UI.valorTab = 'resumen'; }, text: () => { const v = valor(cur()); return 'Horas netas liberadas: ' + fmtH(v.adm.horas) + ', descontando la revisión de cada reporte y las correcciones. Los minutos de cada tarea son supuestos editables.'; } },
  fin('Lo que muestra este escenario', () => 'El ahorro administrativo es real solo si se descuentan la revisión y las correcciones, y es capacidad del equipo: se vuelve caja únicamente si evita contratar o pagar horas extras.')
];
const S_FIJO = [
  { route: 'valor', target: '.mecs article:nth-child(2)', place: 'bottom', title: 'Escenario 4 · Contrato a precio fijo', enter() { UI.valorTab = 'resumen'; }, text: () => { const v = valor(cur()); return 'Quién se queda con el ahorro. Hoy, de ' + fmtH(v.prod.horasEvit) + ' de paro evitadas, ' + fmtH(v.prod.horasDirectas) + ' son de cuadrillas que paga el constructor y ' + fmtH(v.prod.horasSub) + ' de cuadrillas a precio fijo, que asume el subcontratista.'; } },
  { route: 'valor', target: () => document.querySelector('select[data-act-change=contrato]').closest('.card'), place: 'top', title: 'Cada cuadrilla, directa o a precio fijo', text: () => 'Se marca cómo se contrata cada cuadrilla. Pasemos la de estructura a precio fijo.', next: 'Pasar estructura a precio fijo' },
  { route: 'valor', target: '.mecs article:nth-child(2)', place: 'bottom', title: 'El valor cambia de dueño', enter() { const o = cur(); o.contratos['Estructura'] = 'precio_fijo'; }, text: () => { const v = valor(cur()); return 'Con estructura a precio fijo, el ahorro laboral queda en el subcontratista: ' + fmtH(v.prod.horasSub) + ' de las ' + fmtH(v.prod.horasEvit) + ' evitadas ya no son capacidad propia (' + fmtM(v.prod.capSub) + ').'; } },
  fin('Lo que muestra este escenario', () => 'Para el constructor, el beneficio de una actividad a precio fijo está en cumplir el plazo y reducir sus propios costos de permanencia, no en las horas de la cuadrilla. Por eso el valor se calcula distinto según el contrato.')
];
const S_VALOR = [
  { route: 'valor', target: '#calcOut', place: 'top', title: 'Escenario 5 · ¿Cuánto vale en una obra de 50 personas?', enter() { UI.valorTab = 'calc'; UI.calc = Object.assign({}, CALC_DEF, { costo: cur().costoMensual }, PRESETS.p1.c); }, text: () => { const r = calcEscenario(UI.calc, cur()); return '50 personas a ' + fmtM(UI.calc.costo) + ' cuestan ' + fmtM(r.costoMes) + ' al mes. Recuperar 5% del tiempo pagado equivale a ' + fmtM(r.valorMes) + ' al mes en capacidad, unas ' + (Math.round(r.capEq * 10) / 10).toString().replace('.', ',') + ' personas con la misma nómina. El 5% es una hipótesis.'; } },
  { route: 'valor', target: '#calcOut', place: 'top', title: 'Con 10%', enter() { UI.valorTab = 'calc'; UI.calc = Object.assign({}, CALC_DEF, { costo: cur().costoMensual }, PRESETS.p2.c); }, text: () => { const r = calcEscenario(UI.calc, cur()); return 'Recuperar 10% son ' + fmtM(r.valorMes) + ' al mes: cinco trabajadores adicionales en capacidad, manteniendo la nómina. Pero no se convierte automáticamente en ahorro de caja: puede traducirse en más producción.'; } },
  { route: 'valor', target: '#calcOut', place: 'top', title: 'Evitar un mes de una cuadrilla de 10', enter() { UI.valorTab = 'calc'; UI.calc = Object.assign({}, CALC_DEF, { costo: cur().costoMensual }, PRESETS.p3.c); }, text: () => { const r = calcEscenario(UI.calc, cur()); return 'Si evitar ese mes adicional hace que el costo deje de pagarse, son ' + fmtM(r.bruto) + ' brutos. De ahí se descuentan la plataforma, la implementación y cualquier costo adicional para acelerar.'; } },
  { route: 'valor', target: '.frase', place: 'top', title: 'La frase que el piloto debe poder decir', enter() { UI.valorTab = 'piloto'; }, text: () => 'En esta obra recuperamos X horas, evitamos Y costos y obtuvimos Z de beneficio neto. Eso se mide en el piloto con tres datos del cliente: qué personal paga directamente, dónde pierde horas y cuánto le cuesta prolongar la obra un mes.' },
  fin('Lo que muestra este escenario', () => 'Los porcentajes son hipótesis para calcular, no resultados. La propuesta se vuelve defendible cuando el piloto convierte esas hipótesis en horas recuperadas, costos evitados y beneficio neto en una obra concreta.')
];
const SCEN = { general: GENERAL, bloqueo: S_BLOQUEO, mes: S_MES, admin: S_ADMIN, fijo: S_FIJO, valor: S_VALOR };
let TSTEPS = GENERAL;

/* ---------- interfaz ---------- */
function tourNodes() {
  const root = document.createElement('div');
  root.className = 'tour';
  root.innerHTML = '<div class="tour-shield"></div><div class="tour-spot"></div><div class="tour-card" role="dialog" aria-modal="true" aria-label="Demo guiada"></div>';
  document.body.appendChild(root);
  return { root, spot: root.querySelector('.tour-spot'), card: root.querySelector('.tour-card') };
}
function paint() {
  const st = TSTEPS[TOUR.i], n = TSTEPS.length, last = TOUR.i === n - 1;
  TOUR.nodes.card.innerHTML = `<div class="tc-step">Paso ${TOUR.i + 1} de ${n}</div><div class="tour-bar"><i style="width:${(TOUR.i + 1) / n * 100}%"></i></div>
    <h3>${esc(st.title)}</h3><p>${esc(st.text())}</p>
    <div class="tc-actions"><button class="skip" data-t="skip">${last ? 'Cerrar' : 'Saltar demo'}</button><span>${TOUR.i ? '<button class="btn ghost sm" data-t="prev">Anterior</button>' : ''}<button class="btn primary sm" data-t="next">${esc(st.next || 'Siguiente')}</button></span></div>`;
  const nb = TOUR.nodes.card.querySelector('[data-t=next]'); if (nb) nb.focus({ preventScroll: true });
}
function resolveTarget(st) {
  if (!st.target) return null;
  try { return typeof st.target === 'function' ? st.target() : document.querySelector(st.target); } catch (e) { return null; }
}
function layout() {
  if (!TOUR.nodes) return;
  const st = TSTEPS[TOUR.i], { spot, card } = TOUR.nodes, el = resolveTarget(st);
  const vw = innerWidth, vh = innerHeight, cw = card.offsetWidth, ch = card.offsetHeight, g = 14, pad = 8;
  let r = null;
  if (el) { const b = el.getBoundingClientRect(); r = { left: b.left - pad, top: b.top - pad, width: b.width + 2 * pad, height: b.height + 2 * pad, right: b.right + pad, bottom: b.bottom + pad }; }
  let pos;
  if (!r) pos = { left: (vw - cw) / 2, top: (vh - ch) / 2 };
  else {
    const cx = clamp(r.left + r.width / 2 - cw / 2, 12, vw - cw - 12), cy = clamp(r.top, 12, vh - ch - 12);
    const opts = { bottom: { top: r.bottom + g, left: cx }, top: { top: r.top - ch - g, left: cx }, right: { left: r.right + g, top: cy }, left: { left: r.left - cw - g, top: cy } };
    const fits = p => p.top >= 12 && p.left >= 12 && p.top + ch <= vh - 12 && p.left + cw <= vw - 12;
    for (const k of [st.place || 'bottom', 'bottom', 'top', 'right', 'left']) if (fits(opts[k])) { pos = opts[k]; break; }
    if (!pos) { // no cabe sin tapar: se acorta lo iluminado y el cuadro va debajo
      r.height = Math.max(100, vh - ch - g - 12 - r.top); r.bottom = r.top + r.height;
      pos = { top: r.bottom + g, left: cx };
    }
  }
  spot.classList.toggle('none', !r);
  spot.style.left = (r ? r.left : vw / 2) + 'px'; spot.style.top = (r ? r.top : vh / 2) + 'px';
  spot.style.width = (r ? r.width : 0) + 'px'; spot.style.height = (r ? r.height : 0) + 'px'; spot.style.opacity = 1;
  card.style.left = pos.left + 'px'; card.style.top = pos.top + 'px';
}
const relayout = () => { cancelAnimationFrame(TOUR.raf); TOUR.raf = requestAnimationFrame(layout); };

async function goStep(i) {
  if (TOUR.busy || i < 0 || i >= TSTEPS.length) return;
  TOUR.busy = true;
  const st = TSTEPS[i];
  if (TOUR.snaps[i]) { S = JSON.parse(TOUR.snaps[i]); hydrate(S); } else TOUR.snaps[i] = JSON.stringify(S);
  TOUR.i = i; UI.alertCap = null; UI.openRid = null; UI.sheet = false;
  if (st.route) {
    S.obraId = 'norte';
    if (route() !== st.route) location.hash = '#/' + st.route;
    render(); await wait(180);
  }
  if (st.enter) { st.enter(); }
  render(); window.scrollTo(0, 0);
  await wait(40);
  const el = resolveTarget(st);
  if (el && !el.closest('.side') && !el.closest('.mnav')) {
    const b = el.getBoundingClientRect(), top = b.top + window.scrollY - (b.height > innerHeight * 0.4 ? 24 : Math.max(24, (innerHeight - b.height) / 3));
    window.scrollTo(0, Math.max(0, top));
  }
  if (TOUR.i < 0 || !TOUR.nodes) { TOUR.busy = false; return; } // se cerró la demo mientras cambiaba de paso
  paint(); await wait(30); if (TOUR.nodes) layout();
  TOUR.busy = false;
}

function onKey(e) {
  if (TOUR.i < 0) return;
  if (e.key === 'Escape') { e.preventDefault(); endTour(); }
  else if (e.key === 'ArrowRight' || e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); nextStep(); }
  else if (e.key === 'ArrowLeft') { e.preventDefault(); goStep(TOUR.i - 1); }
}
function nextStep() { if (TOUR.i === TSTEPS.length - 1) endTour(); else goStep(TOUR.i + 1); }
function onTourClick(e) {
  const b = e.target.closest('[data-t]'); if (!b) return;
  const t = b.dataset.t;
  if (t === 'next') nextStep(); else if (t === 'prev') goStep(TOUR.i - 1); else if (t === 'skip') endTour();
}

function startTour(id) {
  if (TOUR.i >= 0) return;
  closeDlg();
  TSTEPS = SCEN[typeof id === 'string' && SCEN[id] ? id : 'general'];
  TOUR.userSnap = JSON.stringify(S); TOUR.snaps = [];
  window.TOUR_ACTIVE = true;
  S = hydrate(seedState()); UI.alertCap = null; UI.filter = 'curso'; UI.q = ''; UI.openRid = null; UI.sheet = false;
  UI.saved = { s: 'demo' }; UI.valorTab = 'resumen'; UI.calc = null;
  TOUR.nodes = tourNodes();
  TOUR.nodes.card.addEventListener('click', onTourClick);
  document.addEventListener('keydown', onKey, true);
  window.addEventListener('resize', relayout);
  window.addEventListener('scroll', relayout, { passive: true });
  goStep(0);
}
function endTour() {
  if (TOUR.i < 0) return;
  TOUR.i = -1;
  document.removeEventListener('keydown', onKey, true);
  window.removeEventListener('resize', relayout);
  window.removeEventListener('scroll', relayout);
  if (TOUR.nodes) { TOUR.nodes.root.remove(); TOUR.nodes = null; }
  window.TOUR_ACTIVE = false;
  S = hydrate(JSON.parse(TOUR.userSnap)); UI.alertCap = null; UI.openRid = null; UI.valorTab = 'resumen'; UI.calc = null;
  UI.saved = { s: 'ok' };
  if (location.hash !== '#/obras') location.hash = '#/obras';
  render(); window.scrollTo(0, 0);
  toast('Demo terminada. Todo quedó como estaba.');
}
ACT['tour-start'] = () => startTour();
const demoQ = (location.search.match(/[?&]demo=([a-z0-9]+)/) || [])[1];
if (demoQ) setTimeout(() => startTour(demoQ), 500);
