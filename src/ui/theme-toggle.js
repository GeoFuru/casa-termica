class ThemeToggle extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
  }

  connectedCallback() {
    this.render();
    this.shadowRoot.querySelector("button").addEventListener("click", () => this.toggle());
    this.syncFromDocument();
    document.addEventListener("theme-change", () => this.syncFromDocument());
  }

  syncFromDocument() {
    const isDark = document.documentElement.classList.contains("dark");
    this.updateButton(isDark);
  }

  toggle() {
    const html = document.documentElement;
    const isDark = html.classList.toggle("dark");
    localStorage.setItem("ct-theme", isDark ? "dark" : "light");
    this.updateButton(isDark);
    document.dispatchEvent(new CustomEvent("theme-change", { detail: { dark: isDark } }));
  }

  updateButton(isDark) {
    const btn = this.shadowRoot.querySelector("button");
    const icon = this.shadowRoot.querySelector("ct-icon");
    if (btn) {
      btn.setAttribute("aria-label", isDark ? "Cambiar a modo claro" : "Cambiar a modo oscuro");
      btn.setAttribute("data-tooltip", isDark ? "Modo oscuro activado" : "Modo claro activado");
    }
    if (icon) {
      icon.setAttribute("name", isDark ? "sun" : "moon");
    }
  }

  render() {
    const isDark = document.documentElement.classList.contains("dark");
    this.shadowRoot.innerHTML = `
      <style>
        :host { display: inline-flex; }
        button {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 40px; height: 40px;
          border: none;
          background: transparent;
          border-radius: var(--ct-radius-md);
          color: var(--ct-text);
          cursor: pointer;
          transition: background var(--ct-fast);
        }
        button:hover { background: var(--ct-bg-alt); }
        button:focus-visible { box-shadow: var(--ct-shadow-focus); outline: none; }
        ct-icon { width: 20px; height: 20px; }
      </style>
      <button type="button" aria-label="${isDark ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}" data-tooltip="${isDark ? "Modo oscuro activado" : "Modo claro activado"}">
        <ct-icon name="${isDark ? "sun" : "moon"}" size="md"></ct-icon>
      </button>
    `;
  }
}

if (!customElements.get("theme-toggle")) {
  customElements.define("theme-toggle", ThemeToggle);
}

export { ThemeToggle };