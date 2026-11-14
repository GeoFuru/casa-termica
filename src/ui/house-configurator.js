import { getState, setState, subscribe } from "../state.js";

const presets = {
  compact: { bedrooms: 2, area: 36 },
  family: { bedrooms: 3, area: 54 },
  roomy: { bedrooms: 3, area: 72 },
  fourRoom: { bedrooms: 4, area: 54 }
};

const insulationOptions = [
  ["roof-add-insulation", "Techo", "⌂"],
  ["walls-add-insulation", "Muros", "▤"],
  ["floor-add-insulation", "Piso", "▱"],
  ["windows-replace-dvh", "Ventanas", "▧"]
];

function getBedroomCount() {
  return Number(document.getElementById("house-bedroom-count")?.value || 3);
}

function getArea() {
  return Number(document.getElementById("house-floor-area")?.value || 54);
}

function updateSummary() {
  const bedrooms = getBedroomCount();
  const area = getArea();
  const minimum = bedrooms * 9 + 12;
  const areaInput = document.getElementById("house-floor-area");
  if (areaInput) areaInput.min = String(minimum);
  const livingArea = Math.max(0, area - bedrooms * 9);
  const summary = document.getElementById("house-config-summary");
  const detail = document.getElementById("house-config-detail");
  if (summary) summary.textContent = `${bedrooms} ${bedrooms === 1 ? "habitación" : "habitaciones"} · ${area} m² · ${bedrooms + 1} ventanas`;
  if (detail) detail.textContent = `${bedrooms === 4 ? "Sala + pasillo" : "Sala"} aprox. ${livingArea} m² · una ventana por dormitorio y otra en la sala`;
}

function renderInsulationToggles() {
  const container = document.getElementById("house-insulation-toggles");
  if (!container) return;
  const state = getState();
  container.innerHTML = insulationOptions.map(([id, label, icon]) => `
    <label class="house-insulation-option"><input type="checkbox" data-insulation="${id}" ${state.activeInterventions.has(id) ? "checked" : ""}><span class="insulation-option-icon" aria-hidden="true">${icon}</span><span class="insulation-option-label">${label}</span><span class="insulation-option-check" aria-hidden="true">＋</span></label>
  `).join("");
  container.querySelectorAll("[data-insulation]").forEach(input => input.addEventListener("change", () => {
    const activeInterventions = new Set(getState().activeInterventions);
    if (input.checked) activeInterventions.add(input.dataset.insulation);
    else activeInterventions.delete(input.dataset.insulation);
    setState({ activeInterventions, activeScenarioId: null });
  }));
}

function applyPreset(presetId) {
  const preset = presets[presetId];
  if (!preset) return;
  document.getElementById("house-bedroom-count").value = String(preset.bedrooms);
  document.getElementById("house-floor-area").value = String(preset.area);
  updateSummary();
}

function buildDimensions(bedrooms, area) {
  // Cuatro dormitorios se distribuyen 2 × 2 y dejan un pasillo central de 1 m.
  const width = bedrooms === 4 ? 6.7 : Math.max(6, bedrooms * 3);
  const length = area / width;
  const state = getState();
  const current = state.dimensions;
  const windowWidth = Math.min(1.25, Math.max(0.9, length / (bedrooms + 2) * 1.15));
  return {
    ...current,
    length: Number(length.toFixed(2)),
    width: Number(width.toFixed(2)),
    windows: [{ ...(current.windows?.[0] || {}), id: "w1", width: windowWidth, height: 1.15, count: bedrooms + 1 }],
    doors: [{ ...(current.doors?.[0] || {}), id: "d1", width: 0.9, height: 2.1, count: 1 }]
  };
}

export function initHouseConfigurator() {
  const bedroomSelect = document.getElementById("house-bedroom-count");
  const areaInput = document.getElementById("house-floor-area");
  bedroomSelect?.addEventListener("change", updateSummary);
  areaInput?.addEventListener("input", updateSummary);
  document.querySelectorAll("[data-house-preset]").forEach(button => {
    button.addEventListener("click", () => applyPreset(button.dataset.housePreset));
  });
  subscribe(renderInsulationToggles);
  renderInsulationToggles();
  document.getElementById("generate-simulation")?.addEventListener("click", () => {
    const bedrooms = getBedroomCount();
    const minimum = bedrooms * 9 + 12;
    const area = Math.max(minimum, Math.min(180, getArea()));
    if (areaInput) areaInput.value = String(area);
    const dimensions = buildDimensions(bedrooms, area);
    document.getElementById("simulation-status").textContent = "Preparando escena…";
    setState({ dimensions, bedroomCount: bedrooms, floorArea: area, simulationGenerated: true });
    updateSummary();
    window.setTimeout(() => {
      const status = document.getElementById("simulation-status");
      if (status) status.textContent = "Simulación activa";
    }, 450);
    document.getElementById("aura-house-title")?.scrollIntoView({ behavior: "smooth", block: "center" });
  });
  const state = getState();
  if (bedroomSelect) bedroomSelect.value = String(state.bedroomCount || 3);
  if (areaInput) areaInput.value = String(state.floorArea || 54);
  updateSummary();
}
