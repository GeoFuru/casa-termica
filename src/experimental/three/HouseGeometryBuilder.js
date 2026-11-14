/**
 * HouseGeometryBuilder — Genera geometría 3D paramétrica de la casa con capas separadas
 * Cada componente (muros, techo, piso) = grupo de capas: cladding, structure, insulation, vapor, interior
 */
import * as THREE from "/vendor/three.module.js";
import { createThermalInsulationMaterial } from "/src/experimental/three/ThermalInsulationMaterial.js";

export class HouseGeometryBuilder {
  constructor(dimensions) {
    this.dims = dimensions;
    this.updateDimensions(dimensions);
    this.wallHeight = 0;
    this.ridgeHeight = 0;
    this.floorThickness = 0.2;
  }

  updateDimensions(dimensions) {
    this.dims = {
      length: dimensions.length || 8,
      width: dimensions.width || 6,
      height: dimensions.height || 2.5,
      roofPitch: dimensions.roofPitch || 30,
      windows: dimensions.windows || [{ id: "w1", width: 1.2, height: 1.0, count: 4 }],
      doors: dimensions.doors || [{ id: "d1", width: 0.9, height: 2.1, count: 2 }],
    };
  }

  /**
   * Construye la casa completa - cada componente es un grupo de capas
   */
  build() {
    const house = new THREE.Group();
    house.name = "house";

    // Piso con capas
    const floor = this.buildFloorLayers();
    floor.name = "floor";
    house.add(floor);

    // Muros con capas
    const { group: walls, wallHeight } = this.buildWallLayers();
    this.wallHeight = wallHeight;
    walls.name = "walls";
    walls.position.y = this.floorThickness / 2;
    house.add(walls);

    // Techo con capas
    const roof = this.buildRoofLayers(wallHeight);
    this.ridgeHeight = roof.userData.ridgeHeight;
    roof.name = "roof";
    roof.position.y = this.floorThickness / 2 + wallHeight;
    house.add(roof);

    // Ventanas (separadas, no tienen capas internas complejas)
    const windows = this.buildWindows(wallHeight);
    windows.name = "windows";
    windows.position.y = this.floorThickness / 2;
    house.add(windows);

    // Puertas
    const doors = this.buildDoors();
    doors.name = "doors";
    doors.position.y = this.floorThickness / 2;
    house.add(doors);

    // Centrar en XZ, suelo en y=0
    this.centerHouse(house);

    return house;
  }

  centerHouse(house) {
    const box = new THREE.Box3().setFromObject(house);
    const center = box.getCenter(new THREE.Vector3());
    house.position.x -= center.x;
    house.position.z -= center.z;
  }

  // ============================================================
  // PISO - Capas: finish, slab, insulation, ground
  // ============================================================
  buildFloorLayers() {
    const { length, width } = this.dims;
    const group = new THREE.Group();
    const yBase = 0;

    // 1. Ground (terreno) - base
    const groundGeo = new THREE.BoxGeometry(length + 2, 1, width + 2);
    const ground = new THREE.Mesh(groundGeo);
    ground.position.set(0, -0.5, 0);
    ground.name = "floor_ground";
    ground.userData = { layerType: "ground", componentId: "floor", layerOrder: 0 };
    group.add(ground);

    // 2. Insulation (bajo radier)
    const insGeo = new THREE.BoxGeometry(length, 0.1, width);
    const insulation = new THREE.Mesh(insGeo);
    insulation.position.set(0, 0.05, 0);
    insulation.name = "floor_insulation";
    insulation.userData = { layerType: "insulation", componentId: "floor", layerOrder: 1, visible: true };
    group.add(insulation);

    // 3. Slab (loseta/hormigón)
    const slabGeo = new THREE.BoxGeometry(length, 0.2, width);
    const slab = new THREE.Mesh(slabGeo);
    slab.position.set(0, this.floorThickness / 2, 0);
    slab.name = "floor_slab";
    slab.userData = { layerType: "slab", componentId: "floor", layerOrder: 2, visible: true };
    group.add(slab);

    // 4. Finish (terminación - cerámica/madera)
    const finishGeo = new THREE.BoxGeometry(length, 0.02, width);
    const finish = new THREE.Mesh(finishGeo);
    finish.position.set(0, this.floorThickness + 0.01, 0);
    finish.name = "floor_finish";
    finish.userData = { layerType: "finish", componentId: "floor", layerOrder: 3, visible: true };
    group.add(finish);

    return group;
  }

  // ============================================================
  // MUROS - Capas por muro: cladding, structure, insulation, vapor, interior
  // ============================================================
  buildWallLayers() {
    const { length, width, height, windows, doors } = this.dims;
    const wallThickness = 0.2;
    const wallGroup = new THREE.Group();
    const wallHeight = height;
    this.wallHeight = wallHeight;

    const layerThicknesses = {
      cladding: 0.02,
      structure: 0.14,  // vigas/pilares
      insulation: 0.1,
      vapor: 0.005,
      interior: 0.015,
    };

    const totalThickness = Object.values(layerThicknesses).reduce((a, b) => a + b, 0);
    // wallThickness = 0.2, las capas suman ~0.28, ajustamos
    const scale = wallThickness / totalThickness;
    Object.keys(layerThicknesses).forEach(k => layerThicknesses[k] *= scale);

    const wallData = [
      { x: 0, z: -width / 2, w: length, h: wallHeight, rotY: 0, side: "front" },
      { x: 0, z: width / 2, w: length, h: wallHeight, rotY: Math.PI, side: "back" },
      { x: -length / 2, z: 0, w: width, h: wallHeight, rotY: -Math.PI / 2, side: "left" },
      { x: length / 2, z: 0, w: width, h: wallHeight, rotY: Math.PI / 2, side: "right" },
    ];

    for (const wall of wallData) {
      const wallLayers = this.createWallLayers(wall, layerThicknesses);
      wallGroup.add(wallLayers);
    }

    return { group: wallGroup, wallHeight };
  }

  createWallLayers(wall, layerThicknesses) {
    const { x, z, w, h, rotY, side } = wall;
    const wallLayersGroup = new THREE.Group();
    wallLayersGroup.name = `wall_${side}_layers`;

    // Posición base del muro (centro en z, y en mitad de altura)
    const centerY = h / 2;

    // Definir capas de exterior a interior
    const layers = [
      { type: "cladding", thickness: layerThicknesses.cladding, offset: 0 },
      { type: "structure", thickness: layerThicknesses.structure, offset: layerThicknesses.cladding },
      { type: "insulation", thickness: layerThicknesses.insulation, offset: layerThicknesses.cladding + layerThicknesses.structure },
      { type: "vapor", thickness: layerThicknesses.vapor, offset: layerThicknesses.cladding + layerThicknesses.structure + layerThicknesses.insulation },
      { type: "interior", thickness: layerThicknesses.interior, offset: layerThicknesses.cladding + layerThicknesses.structure + layerThicknesses.insulation + layerThicknesses.vapor },
    ];

    // Calcular espesor total del muro
    const wallThickness = layers.reduce((sum, layer) => sum + layer.thickness, 0);

    let currentZ = -wallThickness / 2; // Empezar desde cara exterior

    for (const layer of layers) {
      const geom = new THREE.BoxGeometry(w, h, layer.thickness);
      const mesh = new THREE.Mesh(geom);

      // Posición: centrado en X, altura media, Z progresivo
      mesh.position.set(x, centerY, z + currentZ + layer.thickness / 2);
      mesh.rotation.y = rotY;

      mesh.name = `wall_${side}_${layer.type}`;
      mesh.userData = {
        layerType: layer.type,
        componentId: "walls",
        side: side,
        layerOrder: layers.indexOf(layer),
        visible: true
      };

      wallLayersGroup.add(mesh);
      currentZ += layer.thickness;
    }

    return wallLayersGroup;
  }

  // ============================================================
  // TECHO - Capas por faldón: cladding, structure, insulation, vapor, interior
  // ============================================================
  buildRoofLayers(wallHeight) {
    const { length, width, roofPitch } = this.dims;
    const pitchRad = THREE.MathUtils.degToRad(roofPitch);
    const halfWidth = width / 2;
    const ridgeHeight = halfWidth * Math.tan(pitchRad);
    const roofThickness = 0.15;
    const overhang = 0.3;

    const roofGroup = new THREE.Group();

    const layerThicknesses = {
      cladding: 0.02,
      structure: 0.1,
      insulation: 0.15,
      vapor: 0.005,
      interior: 0.015,
    };

    const roofLength = length + overhang * 2;
    const roofHalfWidth = halfWidth / Math.cos(pitchRad) + overhang;

    // Dos faldones
    const slopes = [
      { name: "left", rotX: -pitchRad, zOffset: -roofHalfWidth / 2 },
      { name: "right", rotX: pitchRad, zOffset: roofHalfWidth / 2 },
    ];

    for (const slope of slopes) {
      const slopeGroup = new THREE.Group();
      slopeGroup.name = `roof_${slope.name}_layers`;

      const layerOrder = ["cladding", "structure", "insulation", "vapor", "interior"];
      let currentNormalOffset = 0;

      for (const layerType of layerOrder) {
        const thickness = layerThicknesses[layerType] || 0.02;
        
        // Geometría del plano del techo
        const geom = new THREE.BoxGeometry(
          length + overhang * 2, 
          thickness, 
          roofHalfWidth * 2
        );
        const mesh = new THREE.Mesh(geom);
        
        // Posición: base del techo en y = wallHeight, luego offset por capas
        mesh.position.set(0, wallHeight + currentNormalOffset + thickness / 2, 0);
        mesh.rotation.x = slope.rotX;
        mesh.position.z = slope.zOffset + (slope.name === "left" ? thickness / 2 : -thickness / 2);
        
        mesh.name = `roof_${slope.name}_${layerType}`;
        mesh.userData = {
          layerType: layerType,
          componentId: "roof",
          slope: slope.name,
          layerOrder: layerOrder.indexOf(layerType),
          visible: true
        };

        slopeGroup.add(mesh);
        currentNormalOffset += thickness;
      }

      roofGroup.add(slopeGroup);
    }

    // Cumbrera
    const ridge = new THREE.Mesh(
      new THREE.BoxGeometry(length + overhang * 2, 0.1, 0.2),
      new THREE.MeshStandardMaterial()
    );
    ridge.position.set(0, wallHeight + ridgeHeight + 0.05, 0);
    ridge.name = "roof_ridge";
    ridge.userData = { layerType: "ridge", componentId: "roof", visible: true };
    roofGroup.add(ridge);

    roofGroup.userData.ridgeHeight = ridgeHeight;
    roofGroup.userData.wallHeight = wallHeight;
    return roofGroup;
  }

  // ============================================================
  // VENTANAS - Marco + Vidrio (simplificado)
  // ============================================================
  buildWindows(wallHeight) {
    const { windows, width } = this.dims;
    const windowGroup = new THREE.Group();

    const positions = this.calculateWindowPositions(wallHeight);

    windows.forEach((win, i) => {
      const pos = positions[i % positions.length];
      if (!pos) return;

      const { x, y, z, rotY, side } = pos;

      // Marco
      const frame = new THREE.Mesh(
        new THREE.BoxGeometry(win.width + 0.1, win.height + 0.1, 0.12),
        new THREE.MeshStandardMaterial({ color: 0x8b4513, roughness: 0.8 })
      );
      frame.position.set(x, y + win.height / 2, z - 0.06);
      frame.rotation.y = rotY;
      frame.name = `window_frame_${i}`;
      frame.userData = { layerType: "frame", componentId: "windows", side, visible: true };
      windowGroup.add(frame);

      // Vidrio
      const glass = new THREE.Mesh(
        new THREE.PlaneGeometry(win.width - 0.05, win.height - 0.05),
        new THREE.MeshPhysicalMaterial({
          color: 0x88ccee,
          transparent: true,
          opacity: 0.3,
          transmission: 0.9,
          thickness: 0.01,
          roughness: 0,
          metalness: 0,
          clearcoat: 1,
          clearcoatRoughness: 0.1,
          side: THREE.DoubleSide
        })
      );
      glass.position.set(x, y + win.height / 2, z - 0.005);
      glass.rotation.y = rotY;
      glass.name = `window_glass_${i}`;
      glass.userData = { layerType: "glass", componentId: "windows", side, visible: true };
      windowGroup.add(glass);
    });

    return windowGroup;
  }

  calculateWindowPositions(wallHeight) {
    const { length, width, height, windows, doors } = this.dims;
    const wallZ = -width / 2;
    const windowBottom = 1.0;
    const spacing = 0.5;

    const positions = [];
    let currentX = -length / 2 + spacing;

    const doorWidth = doors[0]?.width || 0.9;
    const doorStart = -doorWidth / 2;
    const doorEnd = doorWidth / 2;

    for (let i = 0; i < windows[0]?.count || 0; i++) {
      const winWidth = windows[0]?.width || 1.2;
      if (currentX + winWidth / 2 > doorStart && currentX - winWidth / 2 < doorEnd) {
        currentX = doorEnd + spacing;
      }
      if (currentX + winWidth / 2 > length / 2 - spacing) break;

      positions.push({
        x: currentX + winWidth / 2,
        y: windowBottom,
        z: wallZ,
        rotY: 0,
        side: "front"
      });
      currentX += winWidth + spacing;
    }

    // Muro trasero
    const backZ = width / 2;
    const backCount = Math.floor((windows[0]?.count || 4) / 2);
    currentX = -length / 2 + spacing;
    for (let i = 0; i < backCount; i++) {
      const winWidth = windows[0]?.width || 1.2;
      positions.push({
        x: currentX + winWidth / 2,
        y: windowBottom,
        z: backZ,
        rotY: Math.PI,
        side: "back"
      });
      currentX += winWidth + spacing;
    }

    return positions;
  }

  // ============================================================
  // PUERTAS
  // ============================================================
  buildDoors() {
    const { doors, width } = this.dims;
    const doorGroup = new THREE.Group();

    doors.forEach((door, i) => {
      const doorWidth = door.width;
      const doorHeight = door.height;
      const x = 0;
      const z = -width / 2;
      const y = 0;

      // Hoja
      const leaf = new THREE.Mesh(
        new THREE.BoxGeometry(doorWidth, doorHeight, 0.05),
        new THREE.MeshStandardMaterial({ color: 0x5d3a1a, roughness: 0.7 })
      );
      leaf.position.set(x, y + doorHeight / 2, z - 0.025);
      leaf.name = `door_leaf_${i}`;
      leaf.userData = { layerType: "leaf", componentId: "doors", visible: true };
      doorGroup.add(leaf);

      // Marco
      const frame = new THREE.Mesh(
        new THREE.BoxGeometry(doorWidth + 0.1, doorHeight + 0.05, 0.15),
        new THREE.MeshStandardMaterial({ color: 0x8b4513, roughness: 0.8 })
      );
      frame.position.set(x, y + doorHeight / 2, z - 0.075);
      frame.name = `door_frame_${i}`;
      frame.userData = { layerType: "frame", componentId: "doors", visible: true };
      doorGroup.add(frame);

      // Manija
      const handle = new THREE.Mesh(
        new THREE.CylinderGeometry(0.02, 0.02, 0.15, 8),
        new THREE.MeshStandardMaterial({ color: 0xffd700, metalness: 1, roughness: 0.1 })
      );
      handle.position.set(x + doorWidth / 2 - 0.1, y + doorHeight / 2, z - 0.1);
      handle.rotation.z = Math.PI / 2;
      handle.name = `door_handle_${i}`;
      handle.userData = { layerType: "handle", componentId: "doors", visible: true };
      doorGroup.add(handle);
    });

    return doorGroup;
  }
}

/**
 * Materiales PBR
 */
export function createHouseMaterials() {
  return {
    roof: new THREE.MeshStandardMaterial({ color: 0x8b3a1a, roughness: 0.9, metalness: 0.0 }),
    wallExterior: new THREE.MeshStandardMaterial({ color: 0xc49a6c, roughness: 0.85, metalness: 0.0 }),
    wallInterior: new THREE.MeshStandardMaterial({ color: 0xf5f0e8, roughness: 0.95, metalness: 0.0 }),
    floor: new THREE.MeshStandardMaterial({ color: 0xd4c8b8, roughness: 0.7, metalness: 0.0 }),
    structure: new THREE.MeshStandardMaterial({ color: 0x5d3a1a, roughness: 0.8, metalness: 0.0 }),
    // Aislamiento con shader térmico animado
    insulation: createThermalInsulationMaterial({
      baseColor: new THREE.Color(0xffeb3b),
      hotColor: new THREE.Color(0xff4400),
      intensity: 0.5,
      opacity: 0.65,
      glowStrength: 0.3,
    }),
    glass: new THREE.MeshPhysicalMaterial({
      color: 0x88ccee, transparent: true, opacity: 0.3, transmission: 0.95,
      thickness: 0.01, roughness: 0, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.05, ior: 1.5, side: THREE.DoubleSide
    }),
    wood: new THREE.MeshStandardMaterial({ color: 0x5d3a1a, roughness: 0.75, metalness: 0.0 }),
    ground: new THREE.MeshStandardMaterial({ color: 0x8b7d5e, roughness: 0.95, metalness: 0.0 }),
    // Capas específicas
    cladding: new THREE.MeshStandardMaterial({ color: 0xc49a6c, roughness: 0.85, metalness: 0.0 }),
    vapor: new THREE.MeshStandardMaterial({ color: 0xe0e0e0, transparent: true, opacity: 0.3, roughness: 0.9, metalness: 0.0 }),
    interior: new THREE.MeshStandardMaterial({ color: 0xf5f0e8, roughness: 0.95, metalness: 0.0 }),
    finish: new THREE.MeshStandardMaterial({ color: 0xdeb887, roughness: 0.7, metalness: 0.0 }),
    slab: new THREE.MeshStandardMaterial({ color: 0x999999, roughness: 0.8, metalness: 0.0 }),
    groundLayer: new THREE.MeshStandardMaterial({ color: 0x8b7355, roughness: 0.95, metalness: 0.0 }),
  };
}

/**
 * Aplica materiales según layerType
 */
export function applyMaterials(house, materials) {
  console.log("[3D] applyMaterials called with:", Object.keys(materials));
  house.traverse((child) => {
    if (!child.isMesh) return;

    const userData = child.userData || {};
    const layerType = userData.layerType;
    let mat = null;

    // Asignar material según layerType
    switch (layerType) {
      case "cladding": mat = materials.cladding || materials.wallExterior; break;
      case "structure": mat = materials.structure; break;
      case "insulation": mat = materials.insulation; break;
      case "vapor": mat = materials.vapor; break;
      case "interior": mat = materials.interior; break;
      case "finish": mat = materials.finish; break;
      case "slab": mat = materials.slab; break;
      case "ground": case "groundLayer": mat = materials.groundLayer || materials.ground; break;
      case "frame": case "leaf": mat = materials.wood; break;
      case "glass": mat = materials.glass; break;
      case "handle": mat = new THREE.MeshStandardMaterial({ color: 0xffd700, metalness: 1, roughness: 0.1 }); break;
      case "ridge": mat = materials.roof; break;
      case "roof": mat = materials.roof; break;
      case "wall": mat = materials.wallExterior; break;
      case "floor": case "slab": mat = materials.floor; break;
      default: 
        // Fallback por nombre
        const name = child.name || "";
        if (name.startsWith("roof")) mat = materials.roof;
        else if (name.startsWith("wall")) mat = materials.wallExterior;
        else if (name.startsWith("floor")) mat = materials.floor;
        else if (name.startsWith("window_frame") || name.startsWith("door_frame") || name.startsWith("door_leaf")) mat = materials.wood;
        else if (name.startsWith("window_glass")) mat = materials.glass;
        else if (name.startsWith("door_handle")) mat = new THREE.MeshStandardMaterial({ color: 0xffd700, metalness: 1, roughness: 0.1 });
        else if (name.startsWith("ground")) mat = materials.ground;
    }

    if (!mat) {
      console.warn("[3D] No material for:", child.name, "layerType:", layerType, "using fallback");
      mat = new THREE.MeshStandardMaterial({ color: 0xff00ff, wireframe: true });
    }

    child.material = mat;
    child.castShadow = true;
    child.receiveShadow = true;
  });
}
