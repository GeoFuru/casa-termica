export function calculateNetArea(grossArea, openingsArea = 0) {
  return Math.max(0, Number(grossArea || 0) - Number(openingsArea || 0));
}

export function calculatePurchaseArea(netArea, wasteRate = 0) {
  const area = Math.max(0, Number(netArea) || 0);
  const waste = Math.max(0, Number(wasteRate) || 0);
  return area * (1 + waste);
}

export function calculatePackages(quantity, coveragePerPackage) {
  const amount = Math.max(0, Number(quantity) || 0);
  const coverage = Number(coveragePerPackage);
  if (amount === 0) return 0;
  if (!Number.isFinite(coverage) || coverage <= 0) return 0;
  return Math.ceil(amount / coverage);
}

export function calculateMaterialCost(packages, packagePriceClp) {
  return Math.max(0, Number(packages) || 0) * Math.max(0, Number(packagePriceClp) || 0);
}

export function calculateInterventionCost(materialCost, laborCost, otherCost = 0) {
  return Math.max(0, Number(materialCost) || 0) + Math.max(0, Number(laborCost) || 0) + Math.max(0, Number(otherCost) || 0);
}

export function calculateScenarioTotal(interventionCosts) {
  return Object.values(interventionCosts).reduce((sum, cost) => sum + (cost.total || 0), 0);
}

function getQuantity(intervention, dimensions, componentAreas) {
  const mode = intervention.quantityMode || "area";
  const component = intervention.componentId;
  if (mode === "area") return { quantity: componentAreas[component]?.net || 0, unit: "m2" };
  if (mode === "count") return { quantity: Number(dimensions[component]?.reduce((sum, item) => sum + item.count, 0) || 0), unit: "unit" };
  if (mode === "perimeter") {
    const openings = dimensions[component] || [];
    const quantity = openings.reduce((sum, item) => sum + 2 * (item.width + item.height) * item.count, 0);
    return { quantity, unit: "m" };
  }
  if (mode === "fixed") return { quantity: Math.max(0, Number(intervention.fixedQuantity) || 0), unit: intervention.quantityUnit || "m" };
  return { quantity: 0, unit: intervention.quantityUnit || "unit" };
}

export function calculateInterventionEstimate(intervention, material, quantity, quantityUnit, wasteRateOverride) {
  const wasteRate = Math.max(0, Number(wasteRateOverride ?? intervention.wasteRate ?? 0) || 0);
  const coverage = material?.coveragePerPackage ?? 1;
  const coverageUnit = material?.coverageUnit ?? intervention.quantityUnit ?? quantityUnit;
  const price = Math.max(0, Number(material?.packagePriceClp) || 0);
  const materialCompatible = !material || coverageUnit === quantityUnit;
  const purchasedQuantity = quantityUnit === "unit" ? quantity : calculatePurchaseArea(quantity, wasteRate);
  const packages = materialCompatible ? calculatePackages(purchasedQuantity, coverage) : 0;
  const materialCost = material ? calculateMaterialCost(packages, price) : 0;
  const laborUnit = Math.max(0, Number(intervention.laborCostClp) || 0);
  const laborCompatible = !intervention.laborUnit || intervention.laborUnit === quantityUnit;
  const laborCost = laborCompatible ? quantity * laborUnit : 0;
  const total = calculateInterventionCost(materialCost, laborCost);

  return {
    interventionId: intervention.id,
    quantity,
    quantityUnit,
    purchasedQuantity,
    wasteRate: quantityUnit === "unit" ? 0 : wasteRate,
    coveragePerPackage: coverage,
    coverageUnit,
    packages,
    salesUnit: material?.salesUnit || intervention.salesUnit || quantityUnit,
    packagePriceClp: price,
    laborUnit: intervention.laborUnit || quantityUnit,
    laborRateClp: laborUnit,
    materialCost,
    laborCost,
    total,
    isIllustrative: intervention.isIllustrative === true || material?.priceStatus === "illustrative" || material?.thermalStatus === "illustrative",
    isQuantityAssumed: intervention.quantityMode === "fixed",
    hasCompatibleUnits: materialCompatible && laborCompatible
  };
}

export function calculateAllEstimates(activeInterventions, interventions, materials, componentAreas, dimensions = {}) {
  const estimates = {};
  const materialMap = new Map(materials.map(material => [material.id, material]));

  for (const interventionId of activeInterventions) {
    const intervention = interventions.find(item => item.id === interventionId);
    if (!intervention) continue;
    const material = intervention.materialId ? materialMap.get(intervention.materialId) : null;
    if (intervention.materialId && !material) continue;
    const { quantity, unit } = getQuantity(intervention, dimensions, componentAreas);
    if (quantity <= 0) continue;
    estimates[interventionId] = calculateInterventionEstimate(intervention, material, quantity, unit);
  }

  return estimates;
}

export function formatClp(amount) {
  return new Intl.NumberFormat("es-CL", {
    style: "currency",
    currency: "CLP",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(Math.round(Number(amount) || 0)).replace("$", "$ ");
}

export function formatNumber(num, decimals = 2) {
  return new Intl.NumberFormat("es-CL", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  }).format(Number(num) || 0);
}
