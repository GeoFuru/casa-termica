import { thermalPaths } from "./house.js";

export function calculatePathIntensities(activeInterventions, interventions) {
  const result = {};

  for (const path of thermalPaths) {
    let intensity = path.baseIntensity;

    for (const interventionId of activeInterventions) {
      const intervention = interventions.find(i => i.id === interventionId);
      if (intervention && intervention.affectedThermalPaths.includes(path.id)) {
        intensity *= (1 - intervention.reductionFactor);
      }
    }

    result[path.id] = {
      ...path,
      currentIntensity: Math.max(0, Math.min(1, intensity)),
      reduction: path.baseIntensity > 0 ? (1 - intensity / path.baseIntensity) : 0
    };
  }

  return result;
}

export function calculateRelativeIndex(currentIntensities, baseIntensities) {
  let currentSum = 0;
  let baseSum = 0;

  for (const pathId in currentIntensities) {
    currentSum += currentIntensities[pathId].currentIntensity;
    baseSum += baseIntensities[pathId]?.baseIntensity || 0;
  }

  if (baseSum === 0) return 100;

  return Math.round((currentSum / baseSum) * 100);
}

export function getBaseIntensities() {
  const base = {};
  for (const path of thermalPaths) {
    base[path.id] = path.baseIntensity;
  }
  return base;
}

export function getPathColor(type, intensity) {
  const baseHue = type === "conduction" ? 25 : 200;
  const saturation = 65;
  const lightness = 45 + (1 - intensity) * 20;
  return `hsl(${baseHue}, ${saturation}%, ${lightness}%)`;
}

export function getArrowOpacity(intensity) {
  return 0.3 + intensity * 0.7;
}