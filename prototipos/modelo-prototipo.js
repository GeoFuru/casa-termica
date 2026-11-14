import { createHouse3DView } from "/src/ui/house-3d-view.js?v=house-gable-alignment";
import { materials } from "/src/data/materials.js";
import { interventions, thermalPaths } from "/src/model/house.js";
import { getState, setState, subscribe } from "/src/state.js";

const components = [
  { id: "roof", name: "Techo", share: { winter: 38, summer: 31 } },
  { id: "windows", name: "Ventanas", share: { winter: 23, summer: 33 } },
  { id: "walls", name: "Muros", share: { winter: 19, summer: 17 } },
  { id: "floor", name: "Piso", share: { winter: 12, summer: 10 } },
  { id: "doors", name: "Puertas", share: { winter: 8, summer: 9 } }
];
const scenes = {
  winter: {
    outside: "4°", inside: "20°", title: "Invierno · día frío", label: "INVIERNO · EL CALOR BUSCA SALIR",
    legend: "El calor interior escapa por las zonas débiles", chartTitle: "¿Dónde se escapa más calor?",
    chartCaption: "Guía visual de las zonas que suelen merecer atención.", score: "72", analysis: "Mayor atención en cubierta y aberturas", weather: "Escena fría · ejemplo", subtitle: "Exterior 4 °C  →  Interior 20 °C"
  },
  summer: {
    outside: "29°", inside: "25°", title: "Verano · día caluroso", label: "VERANO · EL CALOR BUSCA ENTRAR",
    legend: "El calor exterior entra por cubierta, ventanas y muros", chartTitle: "¿Por dónde entra más calor?",
    chartCaption: "Las superficies reciben el calor del sol de forma diferente.", score: "68", analysis: "Mayor atención en ventanas y cubierta", weather: "Escena cálida · ejemplo", subtitle: "Exterior 29 °C  →  Interior 25 °C"
  }
};

setState({ materials, interventions, thermalPaths });
document.querySelectorAll("#dimension-form input").forEach(input => input.required = true);
const houseView = createHouse3DView(document.getElementById("house-3d-canvas"));
houseView.radius = 15.5;
houseView.polar = 1.2;
if (document.body.classList.contains("prototype-control")) houseView.materials.ground.color.set("#142426");
if (document.body.classList.contains("prototype-aura")) houseView.materials.ground.color.set("#d4d0df");
houseView.updateCamera();
houseView.render();
document.querySelectorAll("#reset-house-view,[data-house-view]").forEach(button => {
  button.addEventListener("click", () => {
    houseView.radius = 15.5;
    houseView.polar = button.dataset.houseView ? 1.12 : 1.2;
    houseView.updateCamera();
    houseView.render();
  });
});

function renderChart(climate) {
  const target = document.getElementById("loss-chart");
  if (!target) return;
  target.innerHTML = components.map(component => {
    const value = component.share[climate];
    const isWarm = document.body.classList.contains("prototype-warm");
    const width = Math.round(value / 40 * 100);
    const type = isWarm ? "loss-zone" : "control-loss-zone";
    const track = isWarm ? "loss-track" : "control-loss-track";
    const fill = isWarm ? "loss-fill" : "control-loss-fill";
    const label = isWarm ? "loss-zone-top" : "control-loss-label";
    return `<button class="${type}" type="button" data-component-target="${component.id}" aria-label="${component.name}: índice ilustrativo ${value}"><span class="${label}"><span>${component.name}</span><strong>${value}%</strong></span><span class="${track}"><span class="${fill}" style="width:${width}%"></span></span></button>`;
  }).join("");
  target.querySelectorAll("[data-component-target]").forEach(button => {
    button.addEventListener("click", () => {
      document.querySelector(`.component-btn[data-component="${button.dataset.componentTarget}"]`)?.click();
    });
  });
  syncChartSelection(getState().selectedComponentId);
}

function syncChartSelection(selected) {
  document.querySelectorAll("[data-component-target]").forEach(button => {
    const active = button.dataset.componentTarget === selected;
    button.classList.toggle("active", active);
    button.setAttribute("aria-pressed", String(active));
  });
}

function setClimate(climate) {
  const scene = scenes[climate];
  if (!scene) return;
  document.body.dataset.climate = climate;
  document.querySelectorAll("[data-climate]").forEach(button => {
    if (button.tagName === "BUTTON") button.setAttribute("aria-pressed", String(button.dataset.climate === climate));
  });
  document.querySelectorAll(".warm-stage,.control-stage,.aura-stage").forEach(stage => stage.dataset.climate = climate);
  for (const [id, value] of Object.entries({
    "outside-temp": scene.outside,
    "inside-temp": scene.inside,
    "scene-label": scene.label,
    "flow-legend": scene.legend,
    "chart-title": scene.chartTitle,
    "chart-caption": scene.chartCaption,
    "weather-title": scene.weather,
    "weather-subtitle": scene.subtitle,
    "analysis-number": scene.score,
    "analysis-copy": scene.analysis
  })) {
    const element = document.getElementById(id);
    if (element) element.textContent = value;
  }
  const weatherSymbol = document.getElementById("weather-symbol");
  if (weatherSymbol) weatherSymbol.textContent = climate === "winter" ? "❄" : "☀";
  const roomIcon = document.getElementById("room-icon");
  if (roomIcon) roomIcon.textContent = climate === "winter" ? "❄" : "☀";
  const comfortFill = document.querySelector(".comfort-fill");
  if (comfortFill) comfortFill.style.width = `${scene.score}%`;
  renderChart(climate);
}

document.querySelectorAll("button[data-climate]").forEach(button => {
  button.addEventListener("click", () => setClimate(button.dataset.climate));
});
document.querySelectorAll("[data-component-choice]").forEach(button => {
  button.addEventListener("click", () => {
    document.querySelector(`.component-btn[data-component="${button.dataset.componentChoice}"]`)?.click();
    document.getElementById("component-panel")?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  });
});
renderChart("winter");
subscribe(state => syncChartSelection(state.selectedComponentId));
