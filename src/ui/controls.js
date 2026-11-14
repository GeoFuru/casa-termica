export function createComponentSelect(components, onSelect) {
  const componentMeta = {
    roof: ["Techo", "Aislación y cubierta", "M3 4 12 2l9 2v3L12 4 3 7z"],
    walls: ["Muros", "Aislación y sellos", "M5 3h14v18H5zM9 3v18m6-18v18"],
    windows: ["Ventanas", "Vidrios y filtraciones", "M3 5h18v14H3zM12 5v14M3 12h18"],
    doors: ["Puertas", "Hoja y burletes", "M6 21V3h12v18M10 21V8h4v13"],
    floor: ["Piso", "Aislación al terreno", "m3 17 9-5 9 5-9 5zM3 12l9-5 9 5M3 7l9-5 9 5"]
  };
  const container = document.createElement("div");
  container.className = "component-select";
  container.setAttribute("role", "group");
  container.setAttribute("aria-label", "Seleccionar componente de la vivienda");

  components.forEach((comp, index) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "component-btn";
    btn.dataset.component = comp.id;
    const [name, description, iconPath] = componentMeta[comp.id] || [comp.name, "Componente de la envolvente", "M4 4h16v16H4z"];
    btn.innerHTML = `<span class="component-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="${iconPath}"/></svg></span><span class="component-copy"><span class="component-name">${name}</span><span class="component-sub">${description}</span></span><span class="zone-action"><span class="zone-status">Explorar</span><span class="component-chevron" aria-hidden="true">↗</span></span>`;
    btn.setAttribute("aria-label", `${name}: ${description}`);
    btn.setAttribute("aria-pressed", "false");
    btn.addEventListener("click", () => onSelect(comp.id));
    btn.addEventListener("keydown", (e) => {
      if (e.key === "ArrowRight" || e.key === "ArrowDown") {
        e.preventDefault();
        const next = container.querySelectorAll(".component-btn")[(index + 1) % components.length];
        next?.focus();
      } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
        e.preventDefault();
        const prev = container.querySelectorAll(".component-btn")[(index - 1 + components.length) % components.length];
        prev?.focus();
      }
    });
    container.appendChild(btn);
  });

  return container;
}

export function createLayerToggles(layers, visibleLayers, onToggle) {
  const container = document.createElement("div");
  container.className = "layer-toggles";
  container.setAttribute("role", "group");
  container.setAttribute("aria-label", "Capas constructivas");

  const layerEntries = Object.entries(layers);
  layerEntries.forEach(([layerId, layer], index) => {
    const label = document.createElement("label");
    label.className = "layer-item";

    const input = document.createElement("input");
    input.type = "checkbox";
    input.checked = visibleLayers.has(layerId);
    input.dataset.layer = layerId;
    input.id = `layer-${layerId}`;
    input.addEventListener("change", (e) => onToggle(layerId, e.target.checked));
    input.addEventListener("keydown", (e) => handleArrowNavigation(e, layerEntries, index, "layer-"));

    const info = document.createElement("div");
    info.className = "layer-info";

    const name = document.createElement("div");
    name.className = "layer-name";
    name.textContent = layer.name;

    const detail = document.createElement("div");
    detail.className = "layer-detail";
    detail.textContent = `${layer.material}${layer.thickness ? ` · ${layer.thickness}` : ""}`;

    info.append(name, detail);
    label.append(input, info);
    container.appendChild(label);
  });

  return container;
}

export function createInterventionToggles(interventions, activeInterventions, materials, onToggle) {
  const container = document.createElement("div");
  container.className = "intervention-toggles";
  container.setAttribute("role", "group");
  container.setAttribute("aria-label", "Intervenciones disponibles");

  interventions.forEach((intervention, index) => {
    const material = intervention.materialId ? materials.find(m => m.id === intervention.materialId) : null;
    const isActive = activeInterventions.has(intervention.id);

    const label = document.createElement("label");
    label.className = "intervention-item";

    const input = document.createElement("input");
    input.type = "checkbox";
    input.checked = isActive;
    input.dataset.intervention = intervention.id;
    input.id = `intervention-${intervention.id}`;
    input.addEventListener("change", (e) => onToggle(intervention.id, e.target.checked));
    input.addEventListener("keydown", (e) => handleArrowNavigation(e, interventions, index, "intervention-"));

    const info = document.createElement("div");
    info.className = "intervention-info";

    const name = document.createElement("div");
    name.className = "intervention-name";
    name.textContent = intervention.name;

    const detail = document.createElement("div");
    detail.className = "intervention-detail";
    detail.textContent = intervention.description;

    if (material) {
      const mat = document.createElement("div");
      mat.className = "intervention-material";
      mat.textContent = `Material: ${material.name}${material.isIllustrative ? " (ilustrativo)" : ""}`;
      info.append(name, detail, mat);
    } else {
      info.append(name, detail);
    }

    label.append(input, info);
    container.appendChild(label);
  });

  return container;
}

function handleArrowNavigation(e, items, currentIndex, prefix) {
  if (e.key === "ArrowDown") {
    e.preventDefault();
    const nextIndex = (currentIndex + 1) % items.length;
    const nextId = prefix + (Array.isArray(items[nextIndex]) ? items[nextIndex][0] : items[nextIndex].id);
    document.getElementById(nextId)?.focus();
  } else if (e.key === "ArrowUp") {
    e.preventDefault();
    const prevIndex = (currentIndex - 1 + items.length) % items.length;
    const prevId = prefix + (Array.isArray(items[prevIndex]) ? items[prevIndex][0] : items[prevIndex].id);
    document.getElementById(prevId)?.focus();
  }
}

export function createDimensionInputs(dimensions, onChange) {
  const form = document.getElementById("dimension-form");
  if (!form) return;

  const firstWindow = dimensions.windows[0];
  const firstDoor = dimensions.doors[0];
  for (const [id, value] of Object.entries({
    "dim-length": dimensions.length,
    "dim-width": dimensions.width,
    "dim-height": dimensions.height,
    "dim-pitch": dimensions.roofPitch,
    "win-width": firstWindow.width,
    "win-height": firstWindow.height,
    "win-count": firstWindow.count,
    "door-width": firstDoor.width,
    "door-height": firstDoor.height,
    "door-count": firstDoor.count
  })) {
    const input = document.getElementById(id);
    if (input) input.value = value;
  }

  const inputs = form.querySelectorAll("input");
  inputs.forEach(input => {
    input.addEventListener("input", () => {
      if (!form.checkValidity()) return;
      const formData = new FormData(form);
      const value = key => Number(formData.get(key));
      const newDimensions = {
        ...dimensions,
        length: value("length"),
        width: value("width"),
        height: value("height"),
        roofPitch: value("roofPitch"),
        windows: [{ id: "w1", width: value("winWidth"), height: value("winHeight"), count: value("winCount") }],
        doors: [{ id: "d1", width: value("doorWidth"), height: value("doorHeight"), count: value("doorCount") }]
      };
      onChange(newDimensions);
    });
  });
}
