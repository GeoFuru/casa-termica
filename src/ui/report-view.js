import { scenarios } from "../data/scenarios.js";
import { houseComponents } from "../model/house.js";
import { calculateComponentAreas } from "../model/house.js";
import { calculateAllEstimates, formatClp, formatNumber } from "../model/estimate.js";
import { getState, setState, subscribe } from "../state.js";

export function initReportView() {
  subscribe(renderReportView);
  document.getElementById("print-report").addEventListener("click", () => {
    setState({ isPrinting: true });
    window.print();
    setState({ isPrinting: false });
  });
  renderReportView();
}

function renderReportView() {
  const state = getState();
  renderReportMeta(state);
  renderHouseData(state);
  renderInterventions(state);
  renderCosts(state);
  renderObservations(state);
  renderDisclaimer();
}

function renderReportMeta(state) {
  const container = document.getElementById("report-meta");
  if (!container) return;

  const scenario = state.activeScenarioId ? scenarios[state.activeScenarioId] : null;
  const date = new Date().toLocaleDateString("es-CL", { year: "numeric", month: "long", day: "numeric" });

  container.innerHTML = `
    ${scenario ? `<strong>Escenario:</strong> ${scenario.name}` : "<strong>Configuración personalizada</strong>"}
    · <strong>Fecha:</strong> ${date}
    · <strong>Vivienda:</strong> ${formatNumber(state.dimensions.length)}×${formatNumber(state.dimensions.width)}×${formatNumber(state.dimensions.height)} m
  `;
}

function renderHouseData(state) {
  const container = document.getElementById("report-house-data");
  if (!container) return;

  const areas = calculateComponentAreas(state.dimensions);
  const totalEnvelope = areas.roof.net + areas.walls.net + areas.floor.net;

  container.innerHTML = `
    <dt>Tipo</dt><dd>Vivienda unifamiliar, una planta</dd>
    <dt>Dimensiones</dt><dd>${formatNumber(state.dimensions.length)} m × ${formatNumber(state.dimensions.width)} m × ${formatNumber(state.dimensions.height)} m (alto muro)</dd>
    <dt>Pendiente techo</dt><dd>${state.dimensions.roofPitch}°</dd>
    <dt>Superficie techo</dt><dd>${formatNumber(areas.roof.net)} m²</dd>
    <dt>Superficie muros (neta)</dt><dd>${formatNumber(areas.walls.net)} m²</dd>
    <dt>Superficie piso</dt><dd>${formatNumber(areas.floor.net)} m²</dd>
    <dt>Superficie envolvente total</dt><dd>${formatNumber(totalEnvelope)} m²</dd>
    <dt>Ventanas</dt><dd>${state.dimensions.windows[0]?.count || 0} uds (${formatNumber(state.dimensions.windows[0]?.width || 0)}×${formatNumber(state.dimensions.windows[0]?.height || 0)} m)</dd>
    <dt>Puertas</dt><dd>${state.dimensions.doors[0]?.count || 0} uds (${formatNumber(state.dimensions.doors[0]?.width || 0)}×${formatNumber(state.dimensions.doors[0]?.height || 0)} m)</dd>
  `;
}

function renderInterventions(state) {
  const container = document.getElementById("report-interventions");
  if (!container) return;

  if (state.activeInterventions.size === 0) {
    container.innerHTML = '<li class="ct-flex ct-items-start ct-gap-sm ct-p-md ct-bg-alt ct-rounded-md ct-text-sm ct-leading-relaxed">Sin intervenciones seleccionadas</li>';
    return;
  }

  const componentAreas = calculateComponentAreas(state.dimensions);
  const estimates = calculateAllEstimates(state.activeInterventions, state.interventions || [], state.materials, componentAreas, state.dimensions);

  container.innerHTML = Object.entries(estimates).map(([id, est]) => {
    const intervention = state.interventions?.find(i => i.id === id);
    const material = intervention?.materialId ? state.materials.find(m => m.id === intervention.materialId) : null;
    return `
      <li class="ct-flex ct-items-start ct-gap-sm ct-p-md ct-bg-alt ct-rounded-md ct-text-sm ct-leading-relaxed">
        <strong>${intervention?.name || id}</strong>
        ${material ? ` — ${material.name}` : ""}
        ${intervention?.description ? ` — ${intervention.description}` : ""}
        <br><small>Cantidad: ${formatNumber(est.quantity)} ${est.quantityUnit} · Compra: ${est.packages} ${est.salesUnit}${est.isQuantityAssumed ? " (cantidad supuesta)" : ""} · Materiales: ${formatClp(est.materialCost)} · Mano de obra: ${formatClp(est.laborCost)} · Total: ${formatClp(est.total)}</small>
        ${est.isIllustrative ? ' <span class="ct-text-warm">(ilustrativo)</span>' : ""}
      </li>
    `;
  }).join("");
}

function renderCosts(state) {
  const container = document.getElementById("report-costs");
  if (!container) return;

  const componentAreas = calculateComponentAreas(state.dimensions);
  const estimates = calculateAllEstimates(state.activeInterventions, state.interventions || [], state.materials, componentAreas, state.dimensions);

  const materialTotal = Object.values(estimates).reduce((s, e) => s + e.materialCost, 0);
  const laborTotal = Object.values(estimates).reduce((s, e) => s + e.laborCost, 0);
  const grandTotal = materialTotal + laborTotal;

  container.innerHTML = `
    <div class="cost-row ct-flex ct-justify-between ct-items-center ct-p-sm ct-p-md ct-bg-alt ct-rounded-md ct-text-sm">
      <span class="cost-label">Materiales</span>
      <span class="cost-value ct-font-medium ct-font-mono">${formatClp(materialTotal)}</span>
    </div>
    <div class="cost-row ct-flex ct-justify-between ct-items-center ct-p-sm ct-p-md ct-bg-alt ct-rounded-md ct-text-sm">
      <span class="cost-label">Mano de obra</span>
      <span class="cost-value ct-font-medium ct-font-mono">${formatClp(laborTotal)}</span>
    </div>
    <div class="cost-row total ct-flex ct-justify-between ct-items-center ct-p-sm ct-p-md ct-bg-brand ct-text-white ct-font-bold ct-text-lg ct-rounded-md">
      <span class="cost-label">Total estimado</span>
      <span class="cost-value ct-font-mono">${formatClp(grandTotal)}</span>
    </div>
  `;
}

function renderObservations(state) {
  const container = document.getElementById("report-observations");
  if (!container) return;

  const observations = [
    "Este informe utiliza datos ilustrativos y referenciales. No constituye un diagnóstico técnico ni certificación energética.",
    "Las rutas térmicas mostradas son representaciones conceptuales, no simulaciones físicas validadas.",
    "Los precios de demostración son ficticios y editables; no corresponden a cotizaciones ni referencias comerciales verificadas.",
    "Se recomienda evaluación profesional antes de ejecutar cualquier intervención: ventilación, humedad, compatibilidad de materiales, comportamiento al fuego y normativa vigente.",
    "No se debe sellar toda la ventilación de la vivienda; se requiere renovación de aire controlada para evitar condensación y problemas de calidad de aire interior."
  ];

  if (state.activeInterventions.size > 0) {
    const hasInsulation = Array.from(state.activeInterventions).some(id => id.includes("insulation"));
    const hasSealing = Array.from(state.activeInterventions).some(id => id.includes("seal") || id.includes("sealing"));
    const hasWindows = Array.from(state.activeInterventions).some(id => id.includes("window"));

    if (hasInsulation && !hasSealing) {
      observations.unshift("Prioridad: Complementar aislamiento con sellado de infiltraciones para maximizar efectividad.");
    }
    if (hasWindows && !hasInsulation) {
      observations.unshift("Considerar aislar techo y muros antes o junto con cambio de ventanas para mejor resultado global.");
    }
  }

  container.innerHTML = observations.map(obs => `<li class="ct-flex ct-items-start ct-gap-sm ct-p-md ct-bg-alt ct-rounded-md ct-text-sm ct-leading-relaxed">${obs}</li>`).join("");
}

function renderDisclaimer() {
  const container = document.getElementById("report-disclaimer");
  if (!container) return;

  container.innerHTML = `
    <strong>Advertencia:</strong> Los datos e indicadores mostrados son <strong>ilustrativos y referenciales</strong>. No constituyen un diagnóstico técnico, certificación energética ni garantía de ahorro. Para intervenciones reales, consulte a un profesional competente.
  `;
}
