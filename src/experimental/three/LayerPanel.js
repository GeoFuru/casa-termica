/**
 * LayerPanel — Panel para activar/desactivar capas de la casa 3D
 * Usa event delegation para checkboxes (render no rompe listeners)
 */
class LayerPanel extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this.layers = new Map(); // layerId -> { mesh, visible, componentId, layerType }
    this.selectedComponent = null;
    this._boundOnChange = this._onChange.bind(this);
  }

  static get observedAttributes() {
    return ["component"];
  }

  connectedCallback() {
    this.shadowRoot.addEventListener("change", this._boundOnChange);
    this.render();
  }

  disconnectedCallback() {
    this.shadowRoot.removeEventListener("change", this._boundOnChange);
  }

  _onChange(e) {
    const target = e.target;
    if (target.matches('input[type="checkbox"][data-layer-id]')) {
      this.toggleLayer(target.dataset.layerId, target.checked);
    }
  }

  static get observedAttributes() {
    return ["component"];
  }

  attributeChangedCallback(name, oldVal, newVal) {
    if (name === "component" && oldVal !== newVal) {
      this.selectedComponent = newVal;
      this.updateVisibility();
    }
  }

  registerLayers(house) {
    this.layers.clear();
    house.traverse((child) => {
      if (child.isMesh && child.userData.layerType) {
        const id = `${child.userData.componentId}_${child.userData.layerType}_${child.userData.side || child.userData.slope || ""}_${child.userData.layerOrder || 0}`;
        this.layers.set(id, {
          mesh: child,
          visible: child.visible,
          componentId: child.userData.componentId,
          layerType: child.userData.layerType,
          side: child.userData.side,
          slope: child.userData.slope,
          layerOrder: child.userData.layerOrder
        });
      }
    });
    this.render();
  }

  toggleLayer(layerId, visible) {
    const layer = this.layers.get(layerId);
    if (layer) {
      layer.visible = visible;
      layer.mesh.visible = visible;
      this.dispatchEvent(new CustomEvent("layer-toggle", {
        detail: { layerId, visible },
        bubbles: true,
        composed: true
      }));
    }
  }

  setComponent(componentId) {
    this.selectedComponent = componentId;
    this.setAttribute("component", componentId);
    this.updateVisibility();
  }

  updateVisibility() {
    this.shadowRoot.querySelectorAll(".layer-item").forEach(item => {
      const layerId = item.dataset.layerId;
      const layer = this.layers.get(layerId);
      if (!layer) return;

      const matches = !this.selectedComponent || layer.componentId === this.selectedComponent;
      item.style.display = matches ? "flex" : "none";
    });
  }

  getLayerLabel(layer) {
    const typeLabels = {
      cladding: "Revestimiento",
      structure: "Estructura",
      insulation: "Aislamiento",
      vapor: "Barrera vapor",
      interior: "Interior",
      finish: "Terminación",
      slab: "Loseta",
      ground: "Terreno",
      frame: "Marco",
      glass: "Vidrio",
      leaf: "Hoja",
      handle: "Manija",
      ridge: "Cumbrera"
    };
    const sideLabels = {
      front: "Frontal",
      back: "Trasera",
      left: "Izquierda",
      right: "Derecha"
    };
    const slopeLabels = {
      left: "Norte",
      right: "Sur"
    };

    let label = typeLabels[layer.layerType] || layer.layerType;
    if (layer.side) label += ` (${sideLabels[layer.side] || layer.side})`;
    if (layer.slope) label += ` (${slopeLabels[layer.slope] || layer.slope})`;
    return label;
  }

  render() {
    const layerArray = Array.from(this.layers.entries())
      .filter(([_, layer]) => !this.selectedComponent || layer.componentId === this.selectedComponent)
      .sort((a, b) => (a[1].layerOrder || 0) - (b[1].layerOrder || 0));

    this.shadowRoot.innerHTML = `
      <style>
        :host { display: block; }
        .layer-panel { display: flex; flex-direction: column; gap: 4px; font-size: 13px; }
        .layer-group { border: 1px solid var(--ct-border); border-radius: 8px; overflow: hidden; background: var(--ct-surface); }
        .layer-group-header { 
          display: flex; align-items: center; justify-content: space-between; 
          padding: 8px 12px; background: var(--ct-bg-alt); border-bottom: 1px solid var(--ct-border);
          font-weight: 600; font-size: 12px; color: var(--ct-text); text-transform: uppercase; letter-spacing: 0.5px;
        }
        .layer-group-header span { display: flex; align-items: center; gap: 8px; }
        .layer-group-header .layer-count { color: var(--ct-text-muted); font-size: 11px; }
        .layer-items { max-height: 200px; overflow-y: auto; }
        .layer-item { 
          display: flex; align-items: center; gap: 8px; 
          padding: 8px 12px; border-bottom: 1px solid var(--ct-border-light);
          transition: background var(--ct-fast);
        }
        .layer-item:last-child { border-bottom: none; }
        .layer-item:hover { background: var(--ct-bg-alt); }
        .layer-item input[type="checkbox"] { 
          width: 16px; height: 16px; accent-color: var(--ct-brand); flex-shrink: 0; cursor: pointer;
        }
        .layer-item-label { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
        .layer-item-name { font-weight: 500; color: var(--ct-text); font-size: 13px; }
        .layer-item-meta { font-size: 11px; color: var(--ct-text-muted); display: flex; gap: 8px; }
        .layer-badge { 
          font-size: 9px; padding: 1px 5px; border-radius: 3px; 
          background: var(--ct-bg-alt); color: var(--ct-text-muted); text-transform: uppercase;
        }
        .layer-badge.insulation { background: #fff3cd; color: #856404; }
        .layer-badge.structure { background: #e2e3e5; color: #383d41; }
        .layer-badge.cladding { background: #d1ecf1; color: #0c5460; }
        .layer-badge.vapor { background: #f8d7da; color: #721c24; }
        .layer-badge.interior { background: #d4edda; color: #155724; }
      </style>
      <div class="layer-panel">
        ${layerArray.length === 0 
          ? '<div class="ct-p-md ct-text-center ct-text-muted">Selecciona un componente para ver sus capas</div>'
          : this.renderGroups(layerArray)
        }
      </div>
    `;
  }

  renderGroups(layerArray) {
    // Agrupar por componentId
    const groups = {};
    for (const [id, layer] of layerArray) {
      if (!groups[layer.componentId]) groups[layer.componentId] = [];
      groups[layer.componentId].push([id, layer]);
    }

    return Object.entries(groups).map(([componentId, layers]) => `
      <div class="layer-group">
        <div class="layer-group-header">
          <span>${componentId} <span class="layer-count">${layers.length} capas</span></span>
        </div>
        <div class="layer-items">
          ${layers.map(([id, layer]) => `
            <div class="layer-item" data-layer-id="${id}">
              <input type="checkbox" data-layer-id="${id}" ${layer.visible ? "checked" : ""} aria-label="${this.getLayerLabel(layer)}">
              <div class="layer-item-label">
                <span class="layer-item-name">${this.getLayerLabel(layer)}</span>
                <div class="layer-item-meta">
                  <span class="layer-badge ${layer.layerType}">${layer.layerType}</span>
                  ${layer.side ? `<span class="layer-badge">${layer.side}</span>` : ""}
                  ${layer.slope ? `<span class="layer-badge">${layer.slope}</span>` : ""}
                </div>
              </div>
            </div>
          `).join("")}
        </div>
      </div>
    `).join("");
  }

  getLayerLabel(layer) {
    const typeLabels = {
      cladding: "Revestimiento",
      structure: "Estructura",
      insulation: "Aislamiento",
      vapor: "Barrera vapor",
      interior: "Interior",
      finish: "Terminación",
      slab: "Loseta",
      ground: "Terreno",
      frame: "Marco",
      glass: "Vidrio",
      leaf: "Hoja",
      handle: "Manija",
      ridge: "Cumbrera"
    };
    const sideLabels = {
      front: "Frontal",
      back: "Trasera",
      left: "Izquierda",
      right: "Derecha"
    };
    const slopeLabels = {
      left: "Norte",
      right: "Sur"
    };

    let label = typeLabels[layer.layerType] || layer.layerType;
    if (layer.side) label += ` (${sideLabels[layer.side] || layer.side})`;
    if (layer.slope) label += ` (${slopeLabels[layer.slope] || layer.slope})`;
    return label;
  }
}

if (!customElements.get("layer-panel")) {
  customElements.define("layer-panel", LayerPanel);
}

export { LayerPanel };