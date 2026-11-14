class CtIcon extends HTMLElement {
  static get observedAttributes() {
    return ["name", "size", "label"];
  }

  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._iconsLoaded = false;
  }

  connectedCallback() {
    this.render();
    this.loadIcons();
  }

  attributeChangedCallback() {
    if (this._iconsLoaded) this.render();
  }

  async loadIcons() {
    if (document.getElementById("ct-icons-sprite")) {
      this._iconsLoaded = true;
      this.render();
      return;
    }

    try {
      const response = await fetch("assets/icons.svg");
      const text = await response.text();
      const parser = new DOMParser();
      const doc = parser.parseFromString(text, "image/svg+xml");
      const svg = doc.querySelector("svg");
      if (svg) {
        svg.id = "ct-icons-sprite";
        svg.style.display = "none";
        document.body.insertAdjacentElement("afterbegin", svg);
      }
      this._iconsLoaded = true;
      this.render();
    } catch (e) {
      console.warn("Failed to load icon sprite:", e);
    }
  }

  render() {
    const name = this.getAttribute("name") || "";
    const size = this.getAttribute("size") || "md";
    const label = this.getAttribute("label") || "";

    const sizeClass = {
      xs: "ct-icon-xs",
      sm: "ct-icon-sm",
      md: "",
      lg: "ct-icon-lg",
      xl: "ct-icon-xl"
    }[size] || "";

    const ariaHidden = label ? "false" : "true";
    const titleEl = label ? `<title>${label}</title>` : "";

    this.shadowRoot.innerHTML = `
      <style>
        :host { display: inline-flex; align-items: center; justify-content: center; flex-shrink: 0; }
        svg { width: 1em; height: 1em; stroke: currentColor; fill: none; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }
        .ct-icon-xs { width: 0.75em; height: 0.75em; }
        .ct-icon-sm { width: 0.875em; height: 0.875em; }
        .ct-icon-lg { width: 1.25em; height: 1.25em; }
        .ct-icon-xl { width: 1.5em; height: 1.5em; }
      </style>
      <svg class="${sizeClass}" aria-hidden="${ariaHidden}" role="img" focusable="false">
        ${titleEl}
        <use href="#icon-${name}"></use>
      </svg>
    `;
  }
}

if (!customElements.get("ct-icon")) {
  customElements.define("ct-icon", CtIcon);
}

export { CtIcon };