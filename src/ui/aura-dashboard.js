import { houseComponents, thermalPaths } from "../model/house.js";
import { calculatePathIntensities } from "../model/thermal-indicators.js";
import { getState, subscribe } from "../state.js";

const climates = {
  winter: {
    outside: "4°", inside: "20°", title: "Día frío · condición de ejemplo",
    label: "ESCENA DE INVIERNO · DÍA FRÍO", chartTitle: "¿Por dónde se escapa el calor?",
    caption: "El calor sale por la envolvente y el aire frío se cuela por aberturas.", legend: "El calor escapa por techo y muros; el frío entra por ventanas y rendijas."
  },
  summer: {
    outside: "29°", inside: "25°", title: "Día caluroso · condición de ejemplo",
    label: "ESCENA DE VERANO · DÍA CALUROSO", chartTitle: "¿Por dónde entra más calor?",
    caption: "El calor del exterior atraviesa las zonas menos aisladas.", legend: "En un día caluroso, el calor de afuera entra a la casa."
  }
};

const seasonalFactors = {
  winter: {
    "roof-conduction": 1, "roof-infiltration": 1.2,
    "walls-conduction": 0.9, "walls-infiltration": 1.25,
    "floor-conduction": 0.8,
    "windows-conduction": 0.9, "windows-infiltration": 1.4,
    "doors-conduction": 0.75, "doors-infiltration": 1.5
  },
  summer: {
    "roof-conduction": 1.45, "roof-infiltration": 0.7,
    "walls-conduction": 0.95, "walls-infiltration": 0.55,
    "floor-conduction": 0.4,
    "windows-conduction": 1.4, "windows-infiltration": 0.6,
    "doors-conduction": 0.65, "doors-infiltration": 0.45
  }
};

const componentNames = new Map(houseComponents.map(item => [item.id, item.name]));
const quickImprovements = {
  roof: "roof-add-insulation",
  windows: "windows-replace-dvh",
  doors: "doors-add-sealing"
};
const improvementPrompts = {
  roof: "Probar aislación de cubierta",
  windows: "Probar vidrio doble",
  doors: "Probar sellos para la puerta"
};

export function initAuraDashboard() {
  document.querySelectorAll("[data-climate]").forEach(button => {
    if (button.tagName !== "BUTTON") return;
    button.addEventListener("click", () => setClimate(button.dataset.climate));
  });

  document.querySelectorAll("[data-component-choice]").forEach(button => {
    button.addEventListener("click", () => {
      const componentId = button.dataset.componentChoice;
      document.querySelector(`.component-btn[data-component="${componentId}"]`)?.click();
      const interventionId = quickImprovements[componentId];
      const toggle = interventionId && document.querySelector(`#component-interventions input[data-intervention="${interventionId}"]`);
      if (toggle) toggle.click();
      document.getElementById("component-panel")?.scrollIntoView({ behavior: "smooth", block: "center" });
    });
  });

  document.querySelectorAll("#budget-top-link,#budget-chart-link").forEach(button => {
    button.addEventListener("click", () => document.getElementById("budget-tab")?.click());
  });
  document.getElementById("report-top-link")?.addEventListener("click", () => document.getElementById("report-tab")?.click());

  document.querySelectorAll(".aura-rail nav [data-scroll-target]").forEach(button => {
    button.addEventListener("click", () => {
      const view = document.getElementById("simulator");
      const target = document.getElementById(button.dataset.scrollTarget);
      if (!view || !target) return;
      if (view.hidden) document.getElementById("simulator-tab")?.click();
      document.querySelectorAll(".aura-rail nav button").forEach(item => item.classList.toggle("active", item === button));
      requestAnimationFrame(() => {
        target.scrollIntoView({ behavior: "smooth", block: "start" });
        document.querySelectorAll(".aura-section-focus").forEach(item => item.classList.remove("aura-section-focus"));
        target.classList.add("aura-section-focus");
      });
    });
  });

  subscribe(renderIndicators);
  setClimate("winter");
}

function setClimate(climate) {
  const scene = climates[climate];
  if (!scene) return;
  document.body.dataset.climate = climate;
  document.querySelectorAll("[data-climate]").forEach(element => {
    if (element.tagName === "BUTTON") element.setAttribute("aria-pressed", String(element.dataset.climate === climate));
    if (element.classList.contains("aura-stage")) element.dataset.climate = climate;
  });
  setText("outside-temp", scene.outside);
  setText("inside-temp", scene.inside);
  setText("weather-title", scene.title);
  setText("weather-subtitle", `Interior ${scene.inside} · Exterior ${scene.outside}`);
  setText("scene-label", scene.label);
  setText("flow-direction", climate === "winter" ? "Calor sale · frío entra" : "Calor que entra");
  setText("chart-title", scene.chartTitle);
  setText("chart-caption", scene.caption);
  setText("flow-legend", scene.legend);
  setText("weather-symbol", climate === "winter" ? "❄" : "☀");
  setText("room-icon", climate === "winter" ? "❄" : "☀");
  const flowDot = document.getElementById("flow-dot");
  if (flowDot) flowDot.className = climate === "winter" ? "legend-mixed" : "legend-warm";
  window.dispatchEvent(new CustomEvent("climate-change", { detail: { climate } }));
  renderIndicators(getState());
}

function renderIndicators(state) {
  const pathValues = calculatePathIntensities(state.activeInterventions, state.interventions);
  const climate = climates[document.body.dataset.climate] ? document.body.dataset.climate : "winter";
  const factors = seasonalFactors[climate];
  const totals = Object.fromEntries(houseComponents.map(component => [component.id, 0]));
  const baselines = Object.fromEntries(houseComponents.map(component => [component.id, 0]));
  let total = 0;
  let baseline = 0;
  for (const path of thermalPaths) {
    const factor = factors[path.id] ?? 1;
    const intensity = (pathValues[path.id]?.currentIntensity ?? path.baseIntensity) * factor;
    const baseIntensity = path.baseIntensity * factor;
    totals[path.componentId] += intensity;
    baselines[path.componentId] += baseIntensity;
    total += intensity;
    baseline += baseIntensity;
  }

  const chart = document.getElementById("loss-chart");
  if (chart) {
    const ordered = [...houseComponents].sort((a, b) => totals[b.id] - totals[a.id]);
    const largestBaseline = Math.max(...Object.values(baselines));
    const contributions = allocateContributionPercentages(totals, baseline, total);
    chart.innerHTML = ordered.map(component => {
      const contribution = contributions[component.id] ?? 0;
      const width = largestBaseline ? Math.min(100, totals[component.id] / largestBaseline * 100) : 0;
      return `<button class="control-loss-zone" type="button" data-component-target="${component.id}" aria-label="${component.name}: aporta ${contribution}% del total inicial estimado" aria-pressed="${state.selectedComponentId === component.id}"><span class="control-loss-label"><span>${component.name}</span><strong>${contribution}%</strong></span><span class="control-loss-track"><span class="control-loss-fill" style="width:${width}%"></span></span></button>`;
    }).join("");
    setText("chart-scale-max", `Mayor zona inicial · ${baseline ? Math.round(largestBaseline / baseline * 100) : 0}%`);
    const remainingTotal = baseline ? Math.round(total / baseline * 100) : 100;
    setText("chart-caption", climate === "winter"
      ? `Aporte por zona · pérdidas estimadas restantes: ${remainingTotal}% del estado inicial.`
      : `Aporte por zona · entrada estimada restante: ${remainingTotal}% del estado inicial.`);
    chart.setAttribute("aria-label", climate === "winter"
      ? "Transferencia estimada de calor hacia fuera por componente, comparada con la casa inicial"
      : "Entrada estimada de calor desde el exterior por componente, comparada con la casa inicial");
    chart.querySelectorAll("[data-component-target]").forEach(button => {
      button.addEventListener("click", () => document.querySelector(`.component-btn[data-component="${button.dataset.componentTarget}"]`)?.click());
    });
  }

  const initialScore = climate === "winter" ? 72 : 68;
  const score = baseline ? Math.round(initialScore + (1 - total / baseline) * (100 - initialScore)) : initialScore;
  setText("analysis-number", String(score));
  const leading = [...houseComponents].sort((a, b) => totals[b.id] - totals[a.id])[0];
  setText("analysis-copy", `${componentNames.get(leading.id)} concentra mayor transferencia`);
  setText("analysis-subcopy", "Revisa sus capas y opciones de mejora.");
  const comfortFill = document.querySelector(".comfort-fill");
  if (comfortFill) comfortFill.style.width = `${score}%`;
  document.querySelectorAll("[data-component-choice]").forEach(button => {
    const componentId = button.dataset.componentChoice;
    const applied = state.activeInterventions.has(quickImprovements[componentId]);
    button.classList.toggle("is-applied", applied);
    button.querySelector("small").textContent = applied ? "Aplicado · pulsa para retirar" : improvementPrompts[componentId];
    button.setAttribute("aria-pressed", String(applied));
  });
  document.querySelectorAll("[data-component-target]").forEach(button => {
    const selected = button.dataset.componentTarget === state.selectedComponentId;
    button.classList.toggle("active", selected);
    button.setAttribute("aria-pressed", String(selected));
  });
}

function allocateContributionPercentages(totals, baseline, total) {
  if (!baseline) return Object.fromEntries(houseComponents.map(component => [component.id, 0]));
  const raw = houseComponents.map(component => ({
    id: component.id,
    value: totals[component.id] / baseline * 100
  }));
  const roundedTotal = Math.round(total / baseline * 100);
  const result = Object.fromEntries(raw.map(item => [item.id, Math.floor(item.value)]));
  let remainder = roundedTotal - Object.values(result).reduce((sum, value) => sum + value, 0);
  raw.sort((a, b) => (b.value % 1) - (a.value % 1));
  for (let index = 0; index < remainder; index++) {
    const item = raw[index % raw.length];
    result[item.id] += 1;
  }
  return result;
}

function setText(id, value) {
  const element = document.getElementById(id);
  if (element) element.textContent = value;
}
