export const scenarios = {
  economic: {
    id: "economic",
    name: "Económica",
    description: "Combinación demostrativa de sellos y aislación de techo. Las cantidades y precios son editables.",
    interventionIds: ["general-seal-cracks", "windows-add-sealing", "roof-add-insulation"],
    targetAudience: "Ejemplo de inversión inicial acotada"
  },
  balanced: {
    id: "balanced",
    name: "Equilibrada",
    description: "Aislar envolvente principal (techo y muros) más sellado de infiltraciones.",
    interventionIds: ["roof-add-insulation", "walls-add-insulation", "windows-add-sealing", "general-seal-cracks"],
    targetAudience: "Ejemplo de intervención de alcance medio"
  },
  integral: {
    id: "integral",
    name: "Integral",
    description: "Combinación demostrativa de aislación, recambio de aberturas y sellos.",
    interventionIds: ["roof-add-insulation", "walls-add-insulation", "floor-add-insulation", "windows-replace-dvh", "doors-replace-insulated", "general-seal-cracks"],
    targetAudience: "Ejemplo de intervención de mayor alcance"
  }
};
