export const houseComponents = [
  {
    id: "roof",
    name: "Techo",
    layers: ["cladding", "structure", "insulation", "vapor", "interior"],
    baseCondition: "no-insulation",
    interventions: ["roof-add-insulation", "roof-replace-cladding"],
    thermalPathIds: ["roof-conduction", "roof-infiltration"]
  },
  {
    id: "walls",
    name: "Muros",
    layers: ["cladding-ext", "structure", "insulation", "vapor", "interior"],
    baseCondition: "no-insulation",
    interventions: ["walls-add-insulation", "walls-replace-cladding", "general-seal-cracks"],
    thermalPathIds: ["walls-conduction", "walls-infiltration"]
  },
  {
    id: "floor",
    name: "Piso",
    layers: ["finish", "slab", "insulation", "ground"],
    baseCondition: "no-insulation",
    interventions: ["floor-add-insulation"],
    thermalPathIds: ["floor-conduction"]
  },
  {
    id: "windows",
    name: "Ventanas",
    layers: ["frame", "glass"],
    baseCondition: "single-glazed",
    interventions: ["windows-replace-dvh", "windows-add-sealing", "windows-add-curtains"],
    thermalPathIds: ["windows-conduction", "windows-infiltration"]
  },
  {
    id: "doors",
    name: "Puertas",
    layers: ["panel", "frame"],
    baseCondition: "solid-wood-no-seal",
    interventions: ["doors-replace-insulated", "doors-add-sealing"],
    thermalPathIds: ["doors-conduction", "doors-infiltration"]
  }
];

export const layerDetails = {
  roof: {
    "roof.cladding": { name: "Cubierta (tejas/planchas)", material: "Cerámica / Metal", thickness: null },
    "roof.structure": { name: "Estructura (vigas/cerchas)", material: "Madera / Acero", thickness: null },
    "roof.insulation": { name: "Aislación térmica", material: "Lana vidrio/roca / EPS / PU", thickness: "80-150 mm" },
    "roof.vapor": { name: "Barrera de vapor", material: "Polietileno / Papel kraft", thickness: "0.2 mm" },
    "roof.interior": { name: "Revestimiento interior", material: "Volcanita / Madera / PVC", thickness: "10-15 mm" }
  },
  walls: {
    "walls.cladding-ext": { name: "Revestimiento exterior", material: "Madera / Fibrocemento / EIFS", thickness: "15-20 mm" },
    "walls.structure": { name: "Estructura (montantes)", material: "Madera / Acero galvanizado", thickness: "90-140 mm" },
    "walls.insulation": { name: "Aislación en cámara", material: "Lana vidrio/roca / Celulosa", thickness: "90-140 mm" },
    "walls.vapor": { name: "Barrera de vapor", material: "Polietileno / Papel kraft", thickness: "0.2 mm" },
    "walls.interior": { name: "Revestimiento interior", material: "Volcanita / Madera / OSB", thickness: "12-15 mm" }
  },
  floor: {
    "floor.finish": { name: "Terminación", material: "Cerámica / Madera / Vinílico", thickness: "8-15 mm" },
    "floor.slab": { name: "Loseta / Radier", material: "Hormigón armado", thickness: "100-150 mm" },
    "floor.insulation": { name: "Aislación bajo radier", material: "EPS / XPS / PU", thickness: "50-100 mm" },
    "floor.ground": { name: "Terreno / Solera", material: "Suelo natural / Grava", thickness: null }
  },
  windows: {
    "windows.frame": { name: "Marco", material: "PVC / Aluminio RPT / Madera", thickness: "60-80 mm" },
    "windows.glass": { name: "Vidrio", material: "Simple / DVH / DVH bajo emisivo", thickness: "4-24 mm" }
  },
  doors: {
    "doors.panel": { name: "Hoja", material: "Madera maciza / Núcleo aislante / Metal", thickness: "40-50 mm" },
    "doors.frame": { name: "Marco", material: "Madera / Metal / PVC", thickness: "60-80 mm" }
  }
};

export const interventions = [
  {
    id: "roof-add-insulation",
    componentId: "roof",
    name: "Aislar techo",
    description: "Colocar lana de vidrio 80 mm entre vigas",
    materialId: "glass-wool-80mm",
    quantityMode: "area",
    quantityUnit: "m2",
    affectedThermalPaths: ["roof-conduction"],
    reductionFactor: 0.75,
    laborCostClp: 8000,
    laborUnit: "m2",
    wasteRate: 0.10,
    isIllustrative: true,
    assumptions: ["Instalación correcta sin puentes térmicos", "Barrera de vapor incluida"]
  },
  {
    id: "roof-replace-cladding",
    componentId: "roof",
    name: "Renovar cubierta",
    description: "Reemplazar tejas/planchas dañadas",
    materialId: null,
    quantityMode: "area",
    quantityUnit: "m2",
    affectedThermalPaths: ["roof-infiltration"],
    reductionFactor: 0.30,
    laborCostClp: 15000,
    laborUnit: "m2",
    wasteRate: 0.15,
    isIllustrative: true,
    assumptions: ["Sellado correcto de cumbreras y limatesas"]
  },
  {
    id: "walls-add-insulation",
    componentId: "walls",
    name: "Aislar muros",
    description: "Insuflar celulosa o colocar paneles en cámaras",
    materialId: "glass-wool-80mm",
    quantityMode: "area",
    quantityUnit: "m2",
    affectedThermalPaths: ["walls-conduction"],
    reductionFactor: 0.65,
    laborCostClp: 12000,
    laborUnit: "m2",
    wasteRate: 0.15,
    isIllustrative: true,
    assumptions: ["Cámara de aire suficiente", "Protección contra humedad"]
  },
  {
    id: "walls-replace-cladding",
    componentId: "walls",
    name: "Renovar revestimiento",
    description: "EIFS o ventilada con aislamiento exterior",
    materialId: "rock-wool-50mm",
    quantityMode: "area",
    quantityUnit: "m2",
    affectedThermalPaths: ["walls-conduction", "walls-infiltration"],
    reductionFactor: 0.70,
    laborCostClp: 25000,
    laborUnit: "m2",
    wasteRate: 0.10,
    isIllustrative: true,
    assumptions: ["Soporte estructural apto", "Detalle de encuentros resuelto"]
  },
  {
    id: "floor-add-insulation",
    componentId: "floor",
    name: "Aislar piso",
    description: "EPS 50 mm sobre losa o entre vigas",
    materialId: "eps-50mm",
    quantityMode: "area",
    quantityUnit: "m2",
    affectedThermalPaths: ["floor-conduction"],
    reductionFactor: 0.55,
    laborCostClp: 10000,
    laborUnit: "m2",
    wasteRate: 0.10,
    isIllustrative: true,
    assumptions: ["Nivelación previa", "Barrera de vapor en contacto con suelo"]
  },
  {
    id: "windows-replace-dvh",
    componentId: "windows",
    name: "Cambiar a DVH",
    description: "Reemplazar vidrio simple por DVH 6+12+6 PVC",
    materialId: "pvc-dvh-6-12-6",
    quantityMode: "count",
    quantityUnit: "unit",
    affectedThermalPaths: ["windows-conduction", "windows-infiltration"],
    reductionFactor: 0.60,
    laborCostClp: 45000,
    laborUnit: "unit",
    wasteRate: 0,
    isIllustrative: true,
    assumptions: ["Medidas estándar", "Instalación con junta perimetral"]
  },
  {
    id: "windows-add-sealing",
    componentId: "windows",
    name: "Sellado perimetral",
    description: "Burletes y silicona en marcos existentes",
    materialId: "weatherstrip-silicone",
    quantityMode: "perimeter",
    quantityUnit: "m",
    affectedThermalPaths: ["windows-infiltration"],
    reductionFactor: 0.40,
    laborCostClp: 3000,
    laborUnit: "m",
    wasteRate: 0.10,
    isIllustrative: true,
    assumptions: ["Marcos en buen estado", "Superficies limpias y secas"]
  },
  {
    id: "windows-add-curtains",
    componentId: "windows",
    name: "Cortinas térmicas",
    description: "Cortinas con capa reflectiva interior",
    materialId: null,
    quantityMode: "count",
    quantityUnit: "unit",
    affectedThermalPaths: ["windows-conduction", "windows-infiltration"],
    reductionFactor: 0.25,
    laborCostClp: 5000,
    laborUnit: "unit",
    wasteRate: 0,
    isIllustrative: true,
    assumptions: ["Uso nocturno", "Ajuste perimetral"]
  },
  {
    id: "doors-replace-insulated",
    componentId: "doors",
    name: "Puerta aislada",
    description: "Puerta exterior con núcleo aislante y burletes",
    materialId: "insulated-door",
    quantityMode: "count",
    quantityUnit: "unit",
    affectedThermalPaths: ["doors-conduction", "doors-infiltration"],
    reductionFactor: 0.50,
    laborCostClp: 80000,
    laborUnit: "unit",
    wasteRate: 0,
    isIllustrative: true,
    assumptions: ["Medida estándar", "Umbral con sellado"]
  },
  {
    id: "doors-add-sealing",
    componentId: "doors",
    name: "Burletes puerta",
    description: "Burlete inferior y perimetral",
    materialId: "weatherstrip-silicone",
    quantityMode: "perimeter",
    quantityUnit: "m",
    affectedThermalPaths: ["doors-infiltration"],
    reductionFactor: 0.35,
    laborCostClp: 3000,
    laborUnit: "m",
    wasteRate: 0.10,
    isIllustrative: true,
    assumptions: ["Puerta en buen estado"]
  },
  {
    id: "general-seal-cracks",
    componentId: "walls",
    name: "Sellado grietas",
    description: "Silicona y espuma en fisuras y pasos de instalaciones",
    materialId: "sealant-foam",
    quantityMode: "fixed",
    quantityUnit: "m",
    fixedQuantity: 10,
    affectedThermalPaths: ["walls-infiltration", "roof-infiltration"],
    reductionFactor: 0.30,
    laborCostClp: 5000,
    laborUnit: "m",
    wasteRate: 0.20,
    isIllustrative: true,
    assumptions: ["Acceso a zonas críticas", "Limpieza previa"]
  }
];

export const thermalPaths = [
  { id: "roof-conduction", type: "conduction", componentId: "roof", baseIntensity: 1.0, label: "Conducción techo" },
  { id: "roof-infiltration", type: "infiltration", componentId: "roof", baseIntensity: 0.3, label: "Infiltración techo" },
  { id: "walls-conduction", type: "conduction", componentId: "walls", baseIntensity: 0.8, label: "Conducción muros" },
  { id: "walls-infiltration", type: "infiltration", componentId: "walls", baseIntensity: 0.4, label: "Infiltración muros" },
  { id: "floor-conduction", type: "conduction", componentId: "floor", baseIntensity: 0.5, label: "Conducción piso" },
  { id: "windows-conduction", type: "conduction", componentId: "windows", baseIntensity: 0.9, label: "Conducción ventanas" },
  { id: "windows-infiltration", type: "infiltration", componentId: "windows", baseIntensity: 0.6, label: "Infiltración ventanas" },
  { id: "doors-conduction", type: "conduction", componentId: "doors", baseIntensity: 0.4, label: "Conducción puertas" },
  { id: "doors-infiltration", type: "infiltration", componentId: "doors", baseIntensity: 0.5, label: "Infiltración puertas" }
];

export function calculateComponentAreas(dimensions) {
  const { length, width, height, roofPitch, windows, doors } = dimensions;
  const pitchRad = (roofPitch * Math.PI) / 180;
  const roofArea = (length * width) / Math.cos(pitchRad);
  const perimeter = 2 * (length + width);
  const grossWallArea = perimeter * height;
  const windowArea = windows.reduce((sum, w) => sum + w.width * w.height * w.count, 0);
  const doorArea = doors.reduce((sum, d) => sum + d.width * d.height * d.count, 0);
  const netWallArea = Math.max(0, grossWallArea - windowArea - doorArea);
  const floorArea = length * width;

  return {
    roof: { gross: roofArea, net: roofArea, openings: 0 },
    walls: { gross: grossWallArea, net: netWallArea, openings: windowArea + doorArea },
    floor: { gross: floorArea, net: floorArea, openings: 0 },
    windows: { gross: windowArea, net: windowArea, openings: 0 },
    doors: { gross: doorArea, net: doorArea, openings: 0 }
  };
}

export function getInterventionsForComponent(componentId) {
  return interventions.filter(i => i.componentId === componentId);
}

export function getComponentById(id) {
  return houseComponents.find(c => c.id === id);
}

export function getLayerDetails(componentId) {
  return layerDetails[componentId] || {};
}

export function getThermalPathsForComponent(componentId) {
  return thermalPaths.filter(p => p.componentId === componentId);
}
