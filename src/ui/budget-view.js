import { scenarios } from "../data/scenarios.js";
import { calculateComponentAreas } from "../model/house.js";
import { calculateAllEstimates, formatClp, formatNumber } from "../model/estimate.js";
import { getState, setState, subscribe } from "../state.js";

function formatUnit(unit) {
  return ({ m2: "m²", m: "m", unit: "unidad", package: "paquete", roll: "rollo", can: "lata" })[unit] || unit;
}

function formatCategory(category) {
  return ({ insulation: "Aislación", sealing: "Sellado", window: "Ventanas", door: "Puertas" })[category] || category;
}

function getEstimates(state) {
  const areas = calculateComponentAreas(state.dimensions);
  return calculateAllEstimates(state.activeInterventions, state.interventions || [], state.materials, areas, state.dimensions);
}

function getMatchingScenario(activeIds) {
  return Object.values(scenarios).find(scenario =>
    scenario.interventionIds.length === activeIds.size && scenario.interventionIds.every(id => activeIds.has(id))
  );
}

export function initBudgetView() {
  subscribe(renderBudgetView);
  document.querySelectorAll("#budget-return-home").forEach(button => {
    button.addEventListener("click", () => document.getElementById("simulator-tab")?.click());
  });
  renderBudgetView();
}

function renderBudgetView() {
  const state = getState();
  renderBudgetSummary(state);
  renderMaterialCatalog(state.materials);
  renderSurfaceCalculator(state.dimensions);
  renderCostBreakdown(state);
  renderScenarioComparison(state);
}

function renderBudgetSummary(state) {
  const estimates = Object.values(getEstimates(state));
  const total = estimates.reduce((sum, item) => sum + item.total, 0);
  const materials = estimates.reduce((sum, item) => sum + item.materialCost, 0);
  const labor = estimates.reduce((sum, item) => sum + item.laborCost, 0);
  const selectedScenario = getMatchingScenario(state.activeInterventions);
  const chosenCount = state.activeInterventions.size;

  const totalElement = document.getElementById("budget-total");
  if (totalElement) totalElement.textContent = formatClp(total);
  const note = document.getElementById("budget-total-note");
  if (note) note.textContent = chosenCount
    ? `${chosenCount} ${chosenCount === 1 ? "mejora seleccionada" : "mejoras seleccionadas"} · valores demostrativos.`
    : "Elige una mejora para empezar.";
  const materialTotal = document.getElementById("budget-material-total");
  if (materialTotal) materialTotal.textContent = formatClp(materials);
  const laborTotal = document.getElementById("budget-labor-total");
  if (laborTotal) laborTotal.textContent = formatClp(labor);
  const scenarioName = document.getElementById("budget-scenario-name");
  if (scenarioName) scenarioName.textContent = selectedScenario?.name || (chosenCount ? "A medida" : "Sin mejoras");
}

function renderMaterialCatalog(materialsList) {
  const container = document.getElementById("material-catalog");
  if (!container) return;

  if (materialsList.length === 0) {
    container.innerHTML = '<p class="budget-empty-copy">No hay materiales cargados.</p>';
    return;
  }

  const expandedMaterials = new Set(Array.from(container.querySelectorAll("[data-material] details[open]"))
    .map(details => details.closest("[data-material]")?.dataset.material).filter(Boolean));

  container.innerHTML = materialsList.map(material => {
    const status = material.priceStatus === "verified" ? "Verificado" : material.priceStatus === "manual" ? "Editado por ti" : "Valor de ejemplo";
    const thickness = material.thickness ? `${material.thickness} mm` : "Sin espesor indicado";
    const conductivity = material.thermalConductivity
      ? `${material.thermalConductivity} W/(m·K)${material.thermalStatus === "illustrative" ? " · ejemplo" : ""}`
      : "Sin dato disponible";
    const resistance = material.thermalResistance
      ? `${material.thermalResistance} m²·K/W${material.thermalStatus === "illustrative" ? " · ejemplo" : ""}`
      : "Sin dato disponible";

    return `
      <article class="budget-material-row" data-material="${material.id}" role="listitem">
        <div class="budget-material-main">
          <span class="budget-material-mark" aria-hidden="true"></span>
          <div class="budget-material-name"><span>${formatCategory(material.category)}</span><h3>${material.name}</h3><small>${thickness} · ${formatNumber(material.coveragePerPackage)} ${formatUnit(material.coverageUnit)} por ${formatUnit(material.salesUnit)}</small></div>
          <div class="budget-material-price"><strong>${formatClp(material.packagePriceClp)}</strong><span>por ${formatUnit(material.salesUnit)}</span><small>${status}</small></div>
        </div>
        <details class="budget-material-details" ${expandedMaterials.has(material.id) ? "open" : ""}>
          <summary>Ficha y edición de valores</summary>
          <div class="budget-material-specs">
            <div><span>Conductividad térmica</span><strong>${conductivity}</strong></div>
            <div><span>Resistencia térmica</span><strong>${resistance}</strong></div>
            <label><span>Precio por ${formatUnit(material.salesUnit)} · CLP</span><input class="ct-input" type="number" min="0" step="100" value="${material.packagePriceClp}" data-material-id="${material.id}" data-material-field="packagePriceClp" aria-label="Precio por ${formatUnit(material.salesUnit)} de ${material.name}"></label>
            <label><span>Cobertura por ${formatUnit(material.salesUnit)} · ${formatUnit(material.coverageUnit)}</span><input class="ct-input" type="number" min="0.01" step="0.01" value="${material.coveragePerPackage}" data-material-id="${material.id}" data-material-field="coveragePerPackage" aria-label="Cobertura por ${formatUnit(material.salesUnit)} de ${material.name}"></label>
          </div>
          <p class="budget-material-note">${material.priceStatus === "verified" && material.priceSource ? `Fuente: ${material.priceSource}${material.priceUpdatedAt ? ` · ${material.priceUpdatedAt}` : ""}` : material.priceStatus === "manual" ? "Precio ingresado manualmente." : "Precio demostrativo; no es una cotización comercial."}</p>
        </details>
      </article>
    `;
  }).join("");

  container.querySelectorAll("[data-material-field]").forEach(input => {
    input.addEventListener("change", () => {
      const value = Number(input.value);
      if (!Number.isFinite(value) || value < 0 || (input.dataset.materialField === "coveragePerPackage" && value === 0)) return;
      const updatedMaterials = materialsList.map(material => material.id === input.dataset.materialId
        ? {
            ...material,
            [input.dataset.materialField]: value,
            ...(input.dataset.materialField === "packagePriceClp" ? { priceStatus: "manual", priceSource: null, priceUpdatedAt: null, isIllustrative: false } : {})
          }
        : material);
      setState({ materials: updatedMaterials });
    });
  });
}

function renderSurfaceCalculator(dimensions) {
  const container = document.getElementById("surface-calculator");
  if (!container) return;
  const areas = calculateComponentAreas(dimensions);
  const rows = [
    ["Cubierta", areas.roof], ["Muros exteriores", areas.walls], ["Piso", areas.floor],
    ["Ventanas", areas.windows], ["Puertas", areas.doors]
  ];

  container.innerHTML = `
    <div class="budget-table-scroll"><table class="budget-area-table" aria-label="Superficies consideradas para el presupuesto">
      <thead><tr><th>Zona</th><th>Superficie total</th><th>Aberturas</th><th>Superficie a intervenir</th></tr></thead>
      <tbody>${rows.map(([name, area]) => `<tr><th scope="row">${name}</th><td>${formatNumber(area.gross, 1)} m²</td><td>${formatNumber(area.openings, 1)} m²</td><td>${formatNumber(area.net, 1)} m²</td></tr>`).join("")}</tbody>
    </table></div>
    <p class="budget-table-note">Superficies de referencia para la maqueta actual (${formatNumber(dimensions.length, 1)} × ${formatNumber(dimensions.width, 1)} m). Las aberturas se descuentan de los muros.</p>
  `;
}

function renderCostBreakdown(state) {
  const container = document.getElementById("cost-breakdown");
  if (!container) return;
  const estimates = getEstimates(state);
  const entries = Object.entries(estimates);

  if (entries.length === 0) {
    container.innerHTML = `
      <div class="budget-empty-state">
        <span class="budget-empty-mark" aria-hidden="true">＋</span>
        <div><h3>Aún no hay mejoras en el cálculo</h3><p>Prueba una mejora en la maqueta o elige una alternativa para ver su costo.</p></div>
        <button type="button" id="budget-empty-action">Explorar la casa</button>
      </div>
    `;
    container.querySelector("#budget-empty-action")?.addEventListener("click", () => document.getElementById("simulator-tab")?.click());
    return;
  }

  container.innerHTML = `
    <div class="budget-cost-table" role="table" aria-label="Detalle de costos de mejoras seleccionadas">
      <div class="budget-cost-table-head" role="row"><span role="columnheader">Mejora y cantidad</span><span role="columnheader">Materiales</span><span role="columnheader">Mano de obra</span><span role="columnheader">Subtotal</span></div>
      ${entries.map(([id, estimate]) => {
        const intervention = state.interventions.find(item => item.id === id);
        const component = intervention?.componentId || "Casa";
        const quantity = `${formatNumber(estimate.quantity, 1)} ${formatUnit(estimate.quantityUnit)}`;
        const purchase = estimate.packages ? `${estimate.packages} ${formatUnit(estimate.salesUnit)}` : "Sin compra de material";
        const waste = estimate.wasteRate ? ` · incluye ${formatNumber(estimate.wasteRate * 100, 0)}% de margen` : "";
        return `<div class="budget-cost-row" role="row"><div class="budget-cost-description" role="cell"><span>${component}</span><strong>${intervention?.name || id}</strong><small>${quantity} · ${purchase}${waste}</small></div><div class="budget-cost-value" role="cell"><span>Materiales</span><strong>${formatClp(estimate.materialCost)}</strong></div><div class="budget-cost-value" role="cell"><span>Instalación</span><strong>${formatClp(estimate.laborCost)}</strong></div><div class="budget-cost-subtotal" role="cell"><span>Subtotal</span><strong>${formatClp(estimate.total)}</strong></div></div>`;
      }).join("")}
    </div>
  `;
}

function renderScenarioComparison(state) {
  const container = document.getElementById("scenario-comparison");
  if (!container) return;
  const areas = calculateComponentAreas(state.dimensions);
  const activeIds = state.activeInterventions;
  const scenarioOrder = ["economic", "balanced", "integral"];

  container.innerHTML = scenarioOrder.map((key, index) => {
    const scenario = scenarios[key];
    const estimates = calculateAllEstimates(new Set(scenario.interventionIds), state.interventions || [], state.materials, areas, state.dimensions);
    const total = Object.values(estimates).reduce((sum, estimate) => sum + estimate.total, 0);
    const isActive = getMatchingScenario(activeIds)?.id === scenario.id;
    const included = scenario.interventionIds.map(id => state.interventions?.find(item => item.id === id)).filter(Boolean);
    const shown = included.slice(0, 3);

    return `
      <article class="budget-scenario ${isActive ? "is-selected" : ""}" role="listitem" data-scenario="${key}">
        <header><span class="budget-scenario-index">0${index + 1}</span>${isActive ? '<span class="budget-scenario-selected">En uso</span>' : ""}</header>
        <h3>${scenario.name}</h3>
        <p>${scenario.description}</p>
        <div class="budget-scenario-includes"><span>Incluye</span>${shown.map(item => `<small>${item.name}</small>`).join("")}${included.length > shown.length ? `<small>+ ${included.length - shown.length} mejoras</small>` : ""}</div>
        <footer><div><span>Inversión estimada</span><strong>${formatClp(total)}</strong></div><button class="budget-scenario-button" type="button" data-scenario="${key}" aria-pressed="${isActive}">${isActive ? "Alternativa aplicada" : "Usar alternativa"}</button></footer>
      </article>
    `;
  }).join("");

  container.querySelectorAll(".budget-scenario-button").forEach(button => {
    button.addEventListener("click", () => applyScenario(button.dataset.scenario));
  });
}

function applyScenario(scenarioId) {
  const scenario = scenarios[scenarioId];
  if (!scenario) return;
  setState({ activeInterventions: new Set(scenario.interventionIds), activeScenarioId: scenarioId });
}
