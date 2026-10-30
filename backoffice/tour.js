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

const TSTEPS = [
  { route: 'obras', title: 'Así funcionaría Obra IA en tu obra', text: () => 'Recorre en tres minutos una obra de ejemplo: del plan completo a la alerta temprana, la decisión y la comprobación de su resultado. Todo son datos de ejemplo, ninguno es de una obra real.', next: 'Empezar' },
  { route: 'obras', target: '.kpis', place: 'bottom', title: 'Tus obras, de un vistazo', text: () => 'Reportes por confirmar, decisiones abiertas y cuánto costaría el atraso si nada cambia, con todas tus obras juntas.' },
  { route: 'obras', target: '.obra.sel', place: 'right', title: 'Va en plan, y aun así hay un problema', text: () => { const d = tourData(); return 'Torre Norte lleva ' + pctTxt(d.av.real) + ' de avance contra ' + pctTxt(d.av.plan) + ' planeado: parece que todo va bien. Pero ya proyecta ' + dias(d.ov.dias) + ' de atraso en la entrega. Veamos de dónde sale.'; } },
  { route: 'hoy', target: '.ints', place: 'bottom', title: 'Cada mañana: lo que importa hoy', text: () => { const L = intervenciones(cur()); return 'Obra IA ordena lo que necesita atención, con su motivo, el responsable y la acción. Lo primero hoy: ' + (L[0] ? L[0].motivo : 'nada') ; } },
  { route: 'plan', target: () => document.querySelector('.gantt').closest('.card'), place: 'bottom', title: 'El plan completo, de punta a punta', text: () => 'Desde los planos licenciados se arma la programación de toda la obra, no solo de los próximos 15 días. La línea negra es hoy; lo rayado es el atraso que se proyecta. Cada versión del plan conserva su línea base.' },
  { route: 'plan', target: '.tbl-wrap', place: 'top', title: 'Cada actividad, con su cuadrilla', text: () => 'Cantidad, rendimiento planeado y fechas. Al tocar una fila se abre el detalle de la actividad: plan, avance confirmado, evidencia, decisiones y cambios. Si editas una duración, ves antes qué se mueve.' },
  { route: 'avances', target: '.rv summary', place: 'bottom', title: 'Lo que reporta la obra', text: () => 'El contramaestro escribe como hoy, por WhatsApp. Obra IA lo lee y arma una bandeja: quién, qué actividad entendió, cuánto avance y qué tan seguro está. Aquí la lectura es simulada con reglas; en el piloto la hace un modelo de IA.' },
  { route: 'avances', target: '.rv[open] .reading', place: 'right', title: 'Lo que se registraría', text: () => 'Abierto el reporte, se ve el mensaje con lo que sustenta cada campo resaltado, la fecha del trabajo, el avance acumulado y el rendimiento del día. Si algo está mal, se corrige antes de confirmar.' },
  { route: 'avances', target: '.rv[open] .rc-actions', place: 'right', title: 'Una persona confirma', text: () => 'Nada cuenta hasta que alguien lo confirma, y el botón dice qué se recalcula. Confirmemos los tres reportes.', next: 'Confirmar los tres' },
  { route: 'avances', target: navLink('decisiones'), place: 'right', title: 'Al confirmar, todo se recalcula', enter() { for (let k = 0; k < 8; k++) { const b = document.querySelector('[data-act=rep-confirm]'); if (!b) break; b.click(); } }, text: () => 'Con cada reporte confirmado, Obra IA recalcula el ritmo de cada cuadrilla y proyecta la fecha de entrega. Por eso la decisión aparece antes de que el atraso se vea.' },
  { route: 'decisiones', target: '.det .metrics', place: 'bottom', title: 'El problema, con su costo', text: () => { const d = tourData(); if (!d.al) return 'Sin decisiones pendientes.'; return d.al.crew + ' va al ' + pctTxt(d.al.ritmo) + ' del ritmo planeado. Hoy el atraso ' + atrasoTxt(d.al.atraso) + '; a este ritmo la entrega se mueve ' + dias(d.al.diasSin) + ' y el atraso cuesta ' + fmtM(d.c.seguir) + '. Debajo, la evidencia de los reportes que lo sustentan.'; } },
  { route: 'decisiones', target: '.opts3', place: 'top', title: 'Tú decides', text: () => 'Obra IA compara las opciones con su costo y deja claro el supuesto de cada una. La decisión es de tu equipo, con responsable y plazo; Obra IA no cambia nada por su cuenta.', next: 'Reforzar y decidir' },
  { route: 'decisiones', target: '.stepper', place: 'bottom', title: 'Decisión registrada', enter() { const r = document.querySelector('[data-k=reforzar]'); if (r) r.click(); const d = document.querySelector('[data-act=dec-decide]'); if (d) d.click(); }, text: () => { const d = tourData(); if (!d.al) return ''; return 'Con el refuerzo la entrega se mueve ' + dias(d.al.diasRef) + ' en vez de ' + dias(d.al.diasSin) + ', y el costo baja de ' + fmtM(d.c.seguir) + ' a ' + fmtM(d.c.reforzar) + ' (incluye ' + fmtM(d.c.ref) + ' del refuerzo). Queda con responsable y fecha límite.'; }, next: 'Ejecutar y comprobar' },
  { route: 'decisiones', target: '.verbox', place: 'top', title: 'Y se comprueba el resultado', enter() { const e = document.querySelector('[data-act=dec-exec]'); if (e) e.click(); const v = document.querySelector('#v-ritmo'); if (v) v.value = 95; const b = document.querySelector('[data-act=dec-verify]'); if (b) b.click(); }, text: () => { const d = tourData(), v = d.al && d.al.dec.verif; if (!v) return ''; return 'Semanas después, con reportes nuevos, se registra el ritmo observado: ' + pctTxt(v.ritmo) + ' contra ' + pctTxt(v.esperado) + ' esperado. Se recuperó el ' + Math.round(v.rec * 100) + '% del ritmo perdido, no el ' + Math.round(recoverOf(d.o) * 100) + '% supuesto. El plan usa el dato real y el supuesto se puede corregir.'; } },
  { route: 'costos', target: '.tbl-wrap', place: 'top', title: 'Costos: lo planeado y lo gastado', text: () => 'El presupuesto sale de los planos como borrador y lo valida tu presupuestista. Con el avance real se calcula el valor ganado y se compara con el gasto real y lo comprometido.' },
  { route: 'equipo', target: '.kpis', place: 'bottom', title: 'Equipo y documentos', text: () => 'Quién tiene sus documentos al día y quién tiene autorizado el ingreso. Obra IA revisa los documentos; la autorización la da la persona de SST. También muestra cuánta gente se va antes de 5 días: plata de ingreso perdida.' },
  { route: 'reportes', target: '.paper .dec, .paper .flag', place: 'bottom', title: 'El reporte del lunes se arma solo', text: () => 'Todo lo anterior queda en un reporte para el comité: avance contra el plan, decisiones con responsable y plazo, datos pendientes y fuentes. Se guarda como versión y conserva lo que se veía al generarlo.' },
  { title: 'Qué es real y qué falta', text: () => 'Real: el cálculo del plan, del ritmo, de la fecha proyectada y del costo del atraso. Simulado: la lectura de los mensajes y el plan desde los planos. El gasto es de ejemplo y no hay conexión contable. El siguiente paso es un piloto con tus planos y los reportes de una obra real.', next: 'Terminar' }
];

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
  paint(); await wait(30); layout();
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

function startTour() {
  if (TOUR.i >= 0) return;
  closeDlg();
  TOUR.userSnap = JSON.stringify(S); TOUR.snaps = [];
  window.TOUR_ACTIVE = true;
  S = hydrate(seedState()); UI.alertCap = null; UI.filter = 'curso'; UI.q = ''; UI.openRid = null; UI.sheet = false;
  UI.saved = { s: 'demo' };
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
  S = hydrate(JSON.parse(TOUR.userSnap)); UI.alertCap = null; UI.openRid = null;
  UI.saved = { s: 'ok' };
  if (location.hash !== '#/obras') location.hash = '#/obras';
  render(); window.scrollTo(0, 0);
  toast('Demo terminada. Todo quedó como estaba.');
}
ACT['tour-start'] = () => startTour();
if (/[?&]demo=1/.test(location.search)) setTimeout(startTour, 500);
