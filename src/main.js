import { initNavigation } from "./ui/navigation.js";
import { createHouse3DView } from "./ui/house-3d-view.js?v=thermal-flow-10";
import { initBudgetView } from "./ui/budget-view.js?v=budget-aura-01";
import { initReportView } from "./ui/report-view.js";
import { initAuraDashboard } from "./ui/aura-dashboard.js?v=aura-08";
import { initImpactView } from "./ui/impact-view.js?v=impact-page-02";
import { initHouseConfigurator } from "./ui/house-configurator.js?v=ui-compact-03";
import { materials } from "./data/materials.js";
import { calculateComponentAreas, houseComponents, interventions, thermalPaths } from "./model/house.js";
import { calculateAllEstimates, formatClp, formatNumber } from "./model/estimate.js";
import { getState, initialState, setState, subscribe } from "./state.js";
import "./ui/components/Icon.js";
import "./ui/theme-toggle.js";

function bootstrap() {
  initTheme();
  setState({ materials, interventions, thermalPaths });
  checkReducedMotion();
  loadPersistedState();

  initNavigation(handleViewChange);
  const requestedView = new URLSearchParams(window.location.search).get("view");
  if (["budget", "report", "impact"].includes(requestedView)) document.getElementById(`${requestedView}-tab`)?.click();
  document.getElementById("review-budget")?.addEventListener("click", () => document.getElementById("budget-tab")?.click());
  document.querySelectorAll("#dimension-form input").forEach(input => { input.required = true; });
  try {
    const houseView = createHouse3DView(document.getElementById("house-3d-canvas"));
    houseView.polar = 1.2;
    houseView.target.y = 1.2;
    houseView.materials.ground.color.set("#f7f6fb");
    houseView.fitCameraToHouse(getState().dimensions);
    houseView.updateCamera();
    houseView.render();
  } catch (error) {
    console.warn("3D view unavailable; continuing without WebGL:", error);
    const canvas = document.getElementById("house-3d-canvas");
    if (canvas) {
      canvas.setAttribute("role", "status");
      canvas.textContent = "La vista 3D no está disponible en este dispositivo. Puedes seguir usando el simulador, los presupuestos y el informe.";
      canvas.classList.add("house-canvas-unavailable");
    }
  }
  initAuraDashboard();
  initImpactView();
  initHouseConfigurator();
  initBudgetView();
  initReportView();
  subscribe(updateWorkspaceMetrics);
  updateWorkspaceMetrics(getState());

}

function updateWorkspaceMetrics(state) {
  const area = document.getElementById("metric-area");
  const activeCount = document.getElementById("metric-interventions");
  const investment = document.getElementById("metric-investment");
  if (!area || !activeCount || !investment) return;

  const dimensions = state.dimensions;
  area.textContent = `${formatNumber(dimensions.length * dimensions.width)} m²`;
  const activeComponents = new Set(Array.from(state.activeInterventions).map(id =>
    state.interventions.find(item => item.id === id)?.componentId
  ).filter(Boolean));
  activeCount.textContent = `${activeComponents.size} / ${houseComponents.length}`;
  const surfaces = calculateComponentAreas(dimensions);
  const estimates = calculateAllEstimates(state.activeInterventions, state.interventions, state.materials, surfaces, dimensions);
  const total = Object.values(estimates).reduce((sum, estimate) => sum + estimate.total, 0);
  investment.textContent = formatClp(total);
}

function handleViewChange(viewId) {
  setState({ activeView: viewId });
  updateNavTabs(viewId);
}

function updateNavTabs(viewId) {
  const labels = { simulator: "Casa", impact: "Impacto en la cuenta", budget: "Presupuesto", report: "Informe" };
  const breadcrumb = document.getElementById("active-breadcrumb");
  if (breadcrumb) breadcrumb.textContent = labels[viewId] || "Casa Térmica";
  document.querySelectorAll("[data-view]").forEach(btn => {
    const isActive = btn.dataset.view === viewId;
    btn.setAttribute("aria-selected", isActive);
    if (btn.matches(".aura-rail nav button")) btn.classList.toggle("active", isActive);
  });
  document.querySelectorAll(".aura-rail nav [data-scroll-target]").forEach(button => button.classList.remove("active"));
  document.querySelectorAll(".aura-section-focus").forEach(section => section.classList.remove("aura-section-focus"));
}

function initTheme() {
  const stored = localStorage.getItem("ct-theme");
  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  const isDark = stored ? stored === "dark" : prefersDark;
  if (isDark) document.documentElement.classList.add("dark");

  window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", (e) => {
    if (!localStorage.getItem("ct-theme")) {
      document.documentElement.classList.toggle("dark", e.matches);
    }
  });
}

function checkReducedMotion() {
  const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
  const update = (e) => {
    const reduced = e.matches;
    document.body.classList.toggle("reduced-motion", reduced);
    getState().reducedMotion = reduced;
  };
  update(mediaQuery);
  mediaQuery.addEventListener("change", update);
}

function loadPersistedState() {
  try {
    const stored = localStorage.getItem("casa-termica-state");
    if (!stored) return;
    const parsed = JSON.parse(stored);
    if (!parsed || typeof parsed !== "object") return;

    const restored = {};
    const dimensions = parsed.dimensions;
    const validOpeningList = list => Array.isArray(list) && list.length > 0 && list.every(item =>
      Number.isFinite(item.width) && item.width > 0 &&
      Number.isFinite(item.height) && item.height > 0 &&
      Number.isInteger(item.count) && item.count >= 0
    );
    if (dimensions &&
      Number.isFinite(dimensions.length) && dimensions.length > 0 &&
      Number.isFinite(dimensions.width) && dimensions.width > 0 &&
      Number.isFinite(dimensions.height) && dimensions.height > 0 &&
      Number.isFinite(dimensions.roofPitch) && dimensions.roofPitch >= 0 && dimensions.roofPitch < 75 &&
      validOpeningList(dimensions.windows) && validOpeningList(dimensions.doors)) {
      restored.dimensions = dimensions;
    }
    if (Number.isInteger(parsed.bedroomCount) && parsed.bedroomCount >= 1 && parsed.bedroomCount <= 4) restored.bedroomCount = parsed.bedroomCount;
    else if (dimensions?.windows?.[0]?.count) restored.bedroomCount = Math.max(1, Math.min(4, dimensions.windows[0].count - 1));
    if (Number.isFinite(parsed.floorArea) && parsed.floorArea >= 30 && parsed.floorArea <= 180) restored.floorArea = parsed.floorArea;
    else if (dimensions && Number.isFinite(dimensions.length * dimensions.width)) restored.floorArea = Math.round(dimensions.length * dimensions.width);

    if (Array.isArray(parsed.activeInterventions)) {
      const knownIds = new Set(interventions.map(intervention => intervention.id));
      restored.activeInterventions = new Set(parsed.activeInterventions.filter(id => knownIds.has(id)));
    }
    if (["economic", "balanced", "integral"].includes(parsed.activeScenarioId)) {
      restored.activeScenarioId = parsed.activeScenarioId;
    }
    if (Array.isArray(parsed.materials)) {
      const storedMaterials = new Map(parsed.materials.filter(item => item && typeof item.id === "string").map(item => [item.id, item]));
      restored.materials = materials.map(material => {
        const storedMaterial = storedMaterials.get(material.id);
        if (!storedMaterial) return material;
        const price = Number(storedMaterial.packagePriceClp);
        const coverage = Number(storedMaterial.coveragePerPackage);
        const manualPrice = Number.isFinite(price) && price >= 0 && storedMaterial.priceStatus === "manual";
        return {
          ...material,
          packagePriceClp: Number.isFinite(price) && price >= 0 ? price : material.packagePriceClp,
          coveragePerPackage: Number.isFinite(coverage) && coverage > 0 ? coverage : material.coveragePerPackage,
          priceStatus: manualPrice ? "manual" : material.priceStatus,
          isIllustrative: manualPrice ? false : material.isIllustrative
        };
      });
    }
    setState(restored);
  } catch (e) {
    console.warn("Failed to load persisted state:", e);
  }
}

function persistState() {
  const state = getState();
  try {
    localStorage.setItem("casa-termica-state", JSON.stringify({
      dimensions: state.dimensions,
      bedroomCount: state.bedroomCount,
      floorArea: state.floorArea,
      activeInterventions: Array.from(state.activeInterventions),
      activeScenarioId: state.activeScenarioId,
      materials: state.materials.map(material => ({
        id: material.id,
        packagePriceClp: material.packagePriceClp,
        coveragePerPackage: material.coveragePerPackage,
        priceStatus: material.priceStatus
      }))
    }));
  } catch (e) {
    console.warn("Failed to persist state:", e);
  }
}

subscribe(persistState);

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", bootstrap, { once: true });
} else {
  bootstrap();
}
