export const initialState = {
  dimensions: {
    length: 9,
    width: 6,
    height: 2.5,
    roofPitch: 30,
    windows: [{ id: "w1", width: 0.9, height: 1.0, count: 4 }],
    doors: [{ id: "d1", width: 0.9, height: 2.1, count: 1 }]
  },
  selectedComponentId: null,
  bedroomCount: 3,
  floorArea: 54,
  simulationGenerated: false,
  visibleLayers: new Set(),
  activeInterventions: new Set(),
  materials: [],
  activeScenarioId: null,
  calculatedSurfaces: {},
  costBreakdown: {},
  scenarioTotals: {},
  activeView: "simulator",
  reducedMotion: false,
  isPrinting: false
};

const listeners = new Set();

export function getState() {
  return initialState;
}

export function setState(partial) {
  Object.assign(initialState, partial);
  notify();
}

export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function notify() {
  for (const fn of listeners) {
    fn(initialState);
  }
}

export function resetState() {
  Object.keys(initialState).forEach(key => delete initialState[key]);
  Object.assign(initialState, {
    dimensions: {
      length: 9,
      width: 6,
      height: 2.5,
      roofPitch: 30,
      windows: [{ id: "w1", width: 0.9, height: 1.0, count: 4 }],
      doors: [{ id: "d1", width: 0.9, height: 2.1, count: 1 }]
    },
    selectedComponentId: null,
    bedroomCount: 3,
    floorArea: 54,
    simulationGenerated: false,
    visibleLayers: new Set(),
    activeInterventions: new Set(),
    materials: [],
    activeScenarioId: null,
    calculatedSurfaces: {},
    costBreakdown: {},
    scenarioTotals: {},
    activeView: "simulator",
    reducedMotion: false,
    isPrinting: false
  });
  notify();
}
