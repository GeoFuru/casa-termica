import { calculatePathIntensities } from "../model/thermal-indicators.js";
import { houseComponents, thermalPaths } from "../model/house.js";
import { formatClp, formatNumber } from "../model/estimate.js";
import { getState, subscribe } from "../state.js";

const monthNames = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
const monthDemand = [0.12, 0.1, 0.14, 0.3, 0.58, 0.88, 1, 0.96, 0.68, 0.42, 0.22, 0.14];
const seasonFactors = {
  winter: { "roof-conduction": 1, "roof-infiltration": 1.2, "walls-conduction": 0.9, "walls-infiltration": 1.25, "floor-conduction": 0.8, "windows-conduction": 0.9, "windows-infiltration": 1.4, "doors-conduction": 0.75, "doors-infiltration": 1.5 },
  summer: { "roof-conduction": 1.45, "roof-infiltration": 0.7, "walls-conduction": 0.95, "walls-infiltration": 0.55, "floor-conduction": 0.4, "windows-conduction": 1.4, "windows-infiltration": 0.6, "doors-conduction": 0.65, "doors-infiltration": 0.45 }
};
let winterBill = Number(localStorage.getItem("casa-termica-winter-bill")) || 90000;

export function initImpactView() {
  const input = document.getElementById("impact-bill-input");
  const range = document.getElementById("impact-bill-range");
  const updateBill = value => {
    winterBill = Math.max(10000, Math.min(600000, Number(value) || 10000));
    input.value = String(winterBill);
    range.value = String(Math.min(300000, winterBill));
    localStorage.setItem("casa-termica-winter-bill", String(winterBill));
    renderImpact(getState());
  };
  input.addEventListener("input", () => updateBill(input.value));
  range.addEventListener("input", () => updateBill(range.value));
  document.getElementById("impact-back-simulator")?.addEventListener("click", () => document.getElementById("simulator-tab")?.click());
  document.getElementById("impact-tab")?.addEventListener("click", () => requestAnimationFrame(() => renderImpact(getState())));
  window.addEventListener("climate-change", () => renderImpact(getState()));
  subscribe(renderImpact);
  renderImpact(getState());
}

function renderImpact(state) {
  if (!state.interventions?.length) return;
  const climate = document.body.dataset.climate === "summer" ? "summer" : "winter";
  const pathValues = calculatePathIntensities(state.activeInterventions, state.interventions);
  const factors = seasonFactors[climate];
  const current = Object.fromEntries(houseComponents.map(item => [item.id, 0]));
  const base = Object.fromEntries(houseComponents.map(item => [item.id, 0]));
  let currentTotal = 0;
  let baseTotal = 0;
  for (const path of thermalPaths) {
    const factor = factors[path.id] ?? 1;
    current[path.componentId] += (pathValues[path.id]?.currentIntensity ?? path.baseIntensity) * factor;
    base[path.componentId] += path.baseIntensity * factor;
    currentTotal += (pathValues[path.id]?.currentIntensity ?? path.baseIntensity) * factor;
    baseTotal += path.baseIntensity * factor;
  }
  const thermalReduction = baseTotal > 0 ? 1 - currentTotal / baseTotal : 0;
  // La demostración atribuye solo parte del cambio térmico al consumo de calefacción.
  const billReduction = Math.max(0, Math.min(0.65, thermalReduction * 0.62));
  const summer = climate === "summer";
  const billToday = winterBill * (summer ? 0.2 : 1);
  const billAfter = billToday * (1 - billReduction);
  const saving = billToday - billAfter;
  const savingRate = Math.round(billReduction * 100);

  setText("impact-season-icon", summer ? "☀" : "❄");
  setText("impact-season-name", summer ? "Verano" : "Invierno");
  setText("impact-monthly-saving", formatClp(saving));
  setText("impact-saving-percent", `${savingRate}%`);
  setText("impact-saving-note", state.activeInterventions.size ? `Con ${state.activeInterventions.size} mejora${state.activeInterventions.size === 1 ? " activa" : "s activas"} en tu modelo.` : "Activa mejoras en la casa para comparar el efecto estimado.");
  setText("impact-before", formatClp(billToday));
  setText("impact-after", formatClp(billAfter));
  setText("impact-reduction-label", `${savingRate}% menos`);
  const annualDemand = monthDemand.reduce((sum, factor) => sum + factor, 0);
  setText("impact-annual-saving", `${formatClp(winterBill * annualDemand * billReduction)} al año`);
  setText("impact-house-summary", `${state.bedroomCount || 3} habitaciones · ${formatNumber(state.floorArea || state.dimensions.length * state.dimensions.width)} m²`);

  const billChart = document.querySelector(".impact-bill-bars");
  if (billChart) {
    const scale = Math.max(billToday, 1);
    billChart.querySelector(".bill-before").style.width = "100%";
    billChart.querySelector(".bill-after").style.width = `${Math.max(10, billAfter / scale * 100)}%`;
  }

  const yearChart = document.getElementById("impact-year-chart");
  if (yearChart) {
    const maxBill = winterBill;
    yearChart.innerHTML = monthNames.map((month, index) => {
      const before = winterBill * monthDemand[index];
      const after = before * (1 - billReduction);
      const beforeHeight = Math.max(3, before / maxBill * 100);
      const afterHeight = Math.max(2, after / maxBill * 100);
      return `<div class="impact-month"><div class="impact-month-bars"><i class="month-before" style="height:${beforeHeight}%"></i><i class="month-after" style="height:${afterHeight}%"></i></div><small>${month}</small></div>`;
    }).join("");
  }

  const zones = document.getElementById("impact-zones-chart");
  if (zones) {
    const sorted = [...houseComponents].sort((a, b) => base[b.id] - base[a.id]);
    zones.innerHTML = sorted.map(component => {
      const ratio = base[component.id] > 0 ? current[component.id] / base[component.id] : 0;
      const reduction = Math.round((1 - ratio) * 100);
      const width = Math.max(2, ratio * 100);
      return `<button type="button" class="impact-zone-row" data-impact-component="${component.id}" title="Ver ${component.name} en el simulador"><span class="impact-zone-label"><strong>${component.name}</strong><small>${reduction ? `${reduction}% menos transferencia` : "Sin cambio todavía"}</small></span><span class="impact-zone-track"><i style="width:${width}%"></i></span><b>${Math.round(ratio * 100)}<small>%</small></b></button>`;
    }).join("");
    zones.querySelectorAll("[data-impact-component]").forEach(button => button.addEventListener("click", () => {
      document.getElementById("simulator-tab")?.click();
      requestAnimationFrame(() => document.querySelector(`.component-btn[data-component="${button.dataset.impactComponent}"]`)?.click());
    }));
  }
}

function setText(id, text) {
  const element = document.getElementById(id);
  if (element) element.textContent = text;
}
