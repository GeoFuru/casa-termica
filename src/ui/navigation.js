export function initNavigation(onViewChange) {
  console.log("[Navigation] initNavigation called");
  const tabs = document.querySelectorAll("[data-view][role='tab']");
  console.log("[Navigation] Found tabs:", tabs.length);
  const panels = document.querySelectorAll(".view-panel");
  console.log("[Navigation] Found panels:", panels.length);

  function showView(viewId) {
    console.log("[Navigation] showView:", viewId);
    tabs.forEach(tab => {
      const isActive = tab.dataset.view === viewId;
      tab.setAttribute("aria-selected", isActive);
    });

    panels.forEach(panel => {
      const isActive = panel.id === viewId;
      panel.hidden = !isActive;
      console.log("[Navigation] Panel", panel.id, "hidden:", !isActive);
    });
  }

  tabs.forEach((tab, i) => {
    console.log("[Navigation] Tab", i, "view:", tab.dataset.view);
    tab.addEventListener("click", () => {
      console.log("[Navigation] Click on", tab.dataset.view);
      const viewId = tab.dataset.view;
      showView(viewId);
      onViewChange(viewId);
    });

    tab.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        tab.click();
      }
    });
  });

  return { showView };
}