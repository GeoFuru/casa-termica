/**
 * ViewToggle — Web Component para cambiar entre vista 2D (SVG) y 3D (Three.js)
 */
class ViewToggle extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this.currentView = "2d"; // '2d' | '3d'
    this._updating = false; // Prevent recursion
  }

  static get observedAttributes() {
    return ["view"];
  }

  connectedCallback() {
    this.render();
    this.shadowRoot.querySelectorAll("button").forEach((btn) => {
      btn.addEventListener("click", () => this.switchView(btn.dataset.view));
    });
    this.syncFromAttribute();
  }

  attributeChangedCallback() {
    if (!this._updating) {
      this.syncFromAttribute();
    }
  }

  syncFromAttribute() {
    const view = this.getAttribute("view") || "2d";
    if (view !== this.currentView) {
      this.setView(view, false);
    }
  }

  setView(view, emit = true) {
    if (view === this.currentView) return;
    this.currentView = view;
    this._updating = true;
    this.setAttribute("view", view);
    this._updating = false;
    this.updateButtons();

    if (emit) {
      this.dispatchEvent(new CustomEvent("view-change", {
        detail: { view },
        bubbles: true,
        composed: true
      }));
    }
  }

  switchView(view) {
    if (view !== this.currentView) {
      this.setView(view);
    }
  }

  updateButtons() {
    this.shadowRoot.querySelectorAll("button").forEach((btn) => {
      const isActive = btn.dataset.view === this.currentView;
      btn.setAttribute("aria-pressed", isActive);
      btn.classList.toggle("active", isActive);
    });
  }

  render() {
    this.shadowRoot.innerHTML = `
      <style>
        :host { display: inline-flex; }
        .view-toggle { display: inline-flex; background: var(--ct-bg-alt); border-radius: var(--ct-radius-md); padding: 2px; gap: 2px; }
        .view-toggle button {
          display: inline-flex; align-items: center; justify-content: center;
          width: 36px; height: 36px;
          border: none; background: transparent; border-radius: var(--ct-radius-sm);
          color: var(--ct-text-muted); cursor: pointer; transition: all var(--ct-fast);
        }
        .view-toggle button:hover { background: var(--ct-surface); color: var(--ct-text); }
        .view-toggle button:focus-visible { box-shadow: var(--ct-shadow-focus); outline: none; }
        .view-toggle button.active { background: var(--ct-brand); color: var(--ct-white); }
        .view-toggle button svg { width: 20px; height: 20px; stroke: currentColor; fill: none; stroke-width: 2; }
      </style>
      <div class="view-toggle" role="group" aria-label="Cambiar vista">
        <button type="button" data-view="2d" aria-label="Vista 2D (SVG)" aria-pressed="true" title="Vista 2D">
          <svg viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/></svg>
        </button>
        <button type="button" data-view="3d" aria-label="Vista 3D (Three.js)" aria-pressed="false" title="Vista 3D">
          <svg viewBox="0 0 24 24"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg>
        </button>
      </div>
    `;
  }
}

if (!customElements.get("view-toggle")) {
  customElements.define("view-toggle", ViewToggle);
}

export { ViewToggle };