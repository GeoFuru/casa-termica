import * as THREE from "../../vendor/three.module.js";
import { houseComponents, getInterventionsForComponent, getLayerDetails, thermalPaths } from "../model/house.js";
import { calculatePathIntensities } from "../model/thermal-indicators.js";
import { createComponentSelect, createDimensionInputs, createInterventionToggles, createLayerToggles } from "./controls.js?v=zones-redesign-01";
import { getState, setState, subscribe } from "../state.js";

const componentNames = new Map(houseComponents.map(component => [component.id, component.name]));

export class House3DView {
  constructor(container) {
    this.container = container;
    this.scene = new THREE.Scene();
    this.scene.background = null;
    this.camera = new THREE.PerspectiveCamera(35, 1, 0.1, 100);
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.6));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.domElement.setAttribute("aria-label", "Modelo tridimensional interactivo de una vivienda de ejemplo");
    this.renderer.domElement.tabIndex = 0;
    this.renderer.domElement.style.touchAction = "none";
    this.container.replaceChildren(this.renderer.domElement);

    this.houseRoot = new THREE.Group();
    this.componentGroups = new Map();
    this.layerGroups = new Map();
    this.raycaster = new THREE.Raycaster();
    this.pointer = new THREE.Vector2();
    this.target = new THREE.Vector3(0, 1.45, 0);
    this.radius = 13;
    this.azimuth = 2.4;
    this.polar = 1.08;
    this.dragStart = null;
    this.previousPointer = null;
    this.interiorCut = false;
    this.layerCut = false;
    this.thermalFlow = null;
    this.thermalFlowFrame = null;
    this.thermalFlowTime = 0;
    this.lastFlowFrameTime = 0;
    this.materials = this.createMaterials();
    this.createEnvironment();
    this.createModel(getState().dimensions);
    this.setupInterface();
    this.setupCameraControls();
    this.onThemeChange = event => {
      this.materials.ground.color.set(event.detail?.dark ? "#343b35" : "#e3dfd5");
      this.render();
    };
    document.addEventListener("theme-change", this.onThemeChange);
    this.onClimateChange = () => this.updateThermalFlow(getState());
    window.addEventListener("climate-change", this.onClimateChange);
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(container);
    this.unsubscribe = subscribe(state => this.updateFromState(state));
    this.resize();
  }

  createMaterials() {
    return {
      wall: new THREE.MeshStandardMaterial({ color: 0xe6ddcd, roughness: 0.9 }),
      sideWall: new THREE.MeshStandardMaterial({ color: 0xd6cbb8, roughness: 0.92 }),
      floor: new THREE.MeshStandardMaterial({ color: 0xe9dfcd, roughness: 0.88 }),
      slab: new THREE.MeshStandardMaterial({ color: 0xb3aa9c, roughness: 1 }),
      roof: new THREE.MeshStandardMaterial({ color: 0x985e49, roughness: 0.78, side: THREE.DoubleSide }),
      roofEdge: new THREE.MeshStandardMaterial({ color: 0x754b3e, roughness: 0.84 }),
      wood: new THREE.MeshStandardMaterial({ color: 0x967554, roughness: 0.86 }),
      insulation: new THREE.MeshStandardMaterial({ color: 0xffc95e, emissive: 0x9b5b11, emissiveIntensity: 0.22, roughness: 0.86, side: THREE.DoubleSide }),
      glass: new THREE.MeshPhysicalMaterial({ color: 0x8ed5e7, roughness: 0.2, metalness: 0.03, transparent: true, opacity: 0.9, side: THREE.DoubleSide }),
      frame: new THREE.MeshStandardMaterial({ color: 0xf6f0e4, roughness: 0.68 }),
      door: new THREE.MeshStandardMaterial({ color: 0x825a43, roughness: 0.76 }),
      ground: new THREE.MeshStandardMaterial({ color: 0xe3dfd5, roughness: 1 }),
      warm: new THREE.MeshStandardMaterial({ color: 0xefb875, emissive: 0x6a3215, emissiveIntensity: 0.18, transparent: true, opacity: 0.78, side: THREE.DoubleSide })
    };
  }

  createEnvironment() {
    this.scene.add(new THREE.HemisphereLight(0xfff7e8, 0x706b62, 2.1));
    const key = new THREE.DirectionalLight(0xfff2dc, 3.2);
    key.position.set(-5, 10, -7);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    key.shadow.camera.left = -10;
    key.shadow.camera.right = 10;
    key.shadow.camera.top = 10;
    key.shadow.camera.bottom = -10;
    key.shadow.bias = -0.00015;
    this.scene.add(key);

    const fill = new THREE.DirectionalLight(0xc6d8df, 1.15);
    fill.position.set(6, 5, 6);
    this.scene.add(fill);

    const floor = new THREE.Mesh(new THREE.PlaneGeometry(200, 200), this.materials.ground);
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -0.24;
    floor.receiveShadow = true;
    this.scene.add(floor);

  }

  createModel(dimensions) {
    this.clearThermalFlow();
    if (this.houseRoot.parent) this.scene.remove(this.houseRoot);
    this.houseRoot = new THREE.Group();
    this.componentGroups = new Map();
    this.layerGroups = new Map();
    const length = Math.max(4, Math.min(14, dimensions.length || 8));
    const width = Math.max(4, Math.min(12, dimensions.width || 6));
    const height = Math.max(2, Math.min(4, dimensions.height || 2.5));
    const doorData = dimensions.doors?.[0] || { width: 0.9, height: 2.1, count: 1 };
    const doorWidth = Math.min(1.5, Math.max(0.7, doorData.width || 0.9));
    const doorHeight = Math.min(height - 0.28, doorData.height || 2.1);
    const windowData = dimensions.windows?.[0] || { width: 1.2, height: 1, count: 3 };
    const windowCount = Math.min(5, Math.max(1, windowData.count || 1));
    const bedroomCount = Math.max(1, Math.min(4, getState().bedroomCount || windowCount - 1));
    const fourBedroomLayout = bedroomCount === 4;
    const bedroomColumnsX = [-length / 2 + 1.5, -length / 2 + 4.5];
    const doorX = length / 2 - doorWidth / 2 - 0.28;
    const maxWindowWidth = Math.max(0.9, Math.min(1.25, (length - doorWidth - 0.6) / Math.max(2, bedroomCount + 1) * 0.95));
    const windowWidth = Math.min(windowData.width || 1.0, maxWindowWidth);
    const windowHeight = Math.min(windowData.height || 1, height * 0.55);
    const frontWindowSill = Math.min(1.1, height * 0.4);
    const wallThickness = 0.16;
    const roofRise = Math.min(1.75, width * Math.tan(THREE.MathUtils.degToRad(dimensions.roofPitch || 30)) / 2);
    const frontZ = -width / 2;
    const backZ = width / 2;

    const floorGroup = this.createComponentGroup("floor");
    this.addBox(floorGroup, length, 0.12, width, 0, 0.02, 0, this.materials.floor, "floor.finish");
    this.addBox(floorGroup, length + 0.06, 0.12, width + 0.06, 0, -0.1, 0, this.materials.slab, "floor.slab");
    this.addLayerMesh(floorGroup, "floor.insulation", this.makeFloorInsulation(length, width));

    const walls = this.createComponentGroup("walls");
    const livingWindowX = Math.max(-length / 2 + 0.35 + windowWidth / 2, doorX - doorWidth / 2 - windowWidth / 2 - 0.15);
    const bedroomWindowPositions = fourBedroomLayout ? [] : Array.from({ length: bedroomCount }, (_, index) => -width / 2 + 1.5 + index * 3);
    const sideBedroomWindows = bedroomCount === 1 ? bedroomWindowPositions : bedroomWindowPositions.slice(0, bedroomCount - 1);
    const frontOpenings = [
      { left: livingWindowX - windowWidth / 2, right: livingWindowX + windowWidth / 2, sill: frontWindowSill, top: frontWindowSill + windowHeight },
      { left: doorX - doorWidth / 2, right: doorX + doorWidth / 2, sill: 0, top: doorHeight },
      ...(fourBedroomLayout ? bedroomColumnsX.map(center => ({ left: center - windowWidth / 2, right: center + windowWidth / 2, sill: frontWindowSill, top: frontWindowSill + windowHeight })) : [])
    ].sort((a, b) => a.left - b.left);
    const addFrontWall = (...args) => {
      const mesh = this.addBox(...args);
      mesh.userData.cutawayFace = "front";
      return mesh;
    };
    let frontCursor = -length / 2;
    for (const opening of frontOpenings) {
      const left = Math.max(frontCursor, opening.left);
      const right = Math.min(length / 2, opening.right);
      if (left > frontCursor) addFrontWall(walls, left - frontCursor, height, wallThickness, (left + frontCursor) / 2, height / 2, frontZ, this.materials.wall, "walls.cladding-ext");
      if (right > left && opening.sill > 0) addFrontWall(walls, right - left, opening.sill, wallThickness, (right + left) / 2, opening.sill / 2, frontZ, this.materials.wall, "walls.cladding-ext");
      if (right > left && opening.top < height) addFrontWall(walls, right - left, height - opening.top, wallThickness, (right + left) / 2, opening.top + (height - opening.top) / 2, frontZ, this.materials.wall, "walls.cladding-ext");
      frontCursor = Math.max(frontCursor, right);
    }
    if (frontCursor < length / 2) addFrontWall(walls, length / 2 - frontCursor, height, wallThickness, (length / 2 + frontCursor) / 2, height / 2, frontZ, this.materials.wall, "walls.cladding-ext");
    let sideCursor = -width / 2;
    for (const centerZ of sideBedroomWindows) {
      const left = centerZ - windowWidth / 2;
      const right = centerZ + windowWidth / 2;
      if (left > sideCursor) this.addBox(walls, wallThickness, height, left - sideCursor, -length / 2, height / 2, (left + sideCursor) / 2, this.materials.wall, "walls.cladding-ext");
      if (frontWindowSill > 0) this.addBox(walls, wallThickness, frontWindowSill, windowWidth, -length / 2, frontWindowSill / 2, centerZ, this.materials.wall, "walls.cladding-ext");
      if (frontWindowSill + windowHeight < height) this.addBox(walls, wallThickness, height - frontWindowSill - windowHeight, windowWidth, -length / 2, frontWindowSill + windowHeight + (height - frontWindowSill - windowHeight) / 2, centerZ, this.materials.wall, "walls.cladding-ext");
      sideCursor = right;
    }
    if (sideCursor < width / 2) this.addBox(walls, wallThickness, height, width / 2 - sideCursor, -length / 2, height / 2, (width / 2 + sideCursor) / 2, this.materials.wall, "walls.cladding-ext");
    this.addBox(walls, wallThickness, height, width, length / 2, height / 2, 0, this.materials.sideWall, "walls.cladding-ext");
    if (bedroomCount > 1) {
      const backWindowCenters = fourBedroomLayout ? bedroomColumnsX : [-length / 2 + 1.5];
      let cursor = -length / 2;
      for (const centerX of backWindowCenters) {
        const left = Math.max(cursor, centerX - windowWidth / 2);
        const right = Math.min(length / 2, centerX + windowWidth / 2);
        if (left > cursor) this.addBox(walls, left - cursor, height, wallThickness, (left + cursor) / 2, height / 2, backZ, this.materials.sideWall, "walls.cladding-ext");
        this.addBox(walls, right - left, frontWindowSill, wallThickness, (right + left) / 2, frontWindowSill / 2, backZ, this.materials.sideWall, "walls.cladding-ext");
        if (frontWindowSill + windowHeight < height) this.addBox(walls, right - left, height - frontWindowSill - windowHeight, wallThickness, (right + left) / 2, frontWindowSill + windowHeight + (height - frontWindowSill - windowHeight) / 2, backZ, this.materials.sideWall, "walls.cladding-ext");
        cursor = right;
      }
      if (cursor < length / 2) this.addBox(walls, length / 2 - cursor, height, wallThickness, (length / 2 + cursor) / 2, height / 2, backZ, this.materials.sideWall, "walls.cladding-ext");
    } else {
      this.addBox(walls, length, height, wallThickness, 0, height / 2, backZ, this.materials.sideWall, "walls.cladding-ext");
    }

    this.addGable(walls, width, height, roofRise, -length / 2, wallThickness, this.materials.wall, -Math.PI / 2);
    this.addGable(walls, width, height, roofRise, length / 2, wallThickness, this.materials.sideWall, Math.PI / 2);

    const postSpacing = length / 7;
    for (let index = 0; index <= 7; index += 1) {
      const x = -length / 2 + index * postSpacing;
      const post = this.addBox(walls, 0.12, height, 0.13, x, height / 2, frontZ + 0.1, this.materials.wood, "walls.structure");
      post.userData.cutawayFace = "front";
      this.addBox(walls, 0.13, height, 0.12, x, height / 2, backZ - 0.1, this.materials.wood, "walls.structure");
    }

    this.addLayerMesh(walls, "walls.insulation", this.makeWallInsulation(length, width, height));
    this.addLayerMesh(walls, "walls.vapor", this.makeWallMembrane(length, width, height));
    this.addLayerMesh(walls, "walls.interior", this.makeInteriorLining(length, width, height));

    const roomPartitions = new THREE.Group();
    roomPartitions.name = "bedroom-partitions";
    roomPartitions.userData.componentId = "walls";
    const partitionMaterial = new THREE.MeshStandardMaterial({ color: 0xf1e8d9, roughness: 0.88 });
    const partitionHeight = Math.max(2, height - 0.28);
    if (fourBedroomLayout) {
      const hallHalf = 0.35;
      const roomStartX = -length / 2;
      const splitX = roomStartX + 3;
      const roomEndX = roomStartX + 6;
      for (const z of [-hallHalf, hallHalf]) {
        for (const centerX of bedroomColumnsX) {
          const gap = 0.86;
          const segment = (3 - gap) / 2;
          this.addBox(roomPartitions, segment, partitionHeight, 0.1, centerX - 1.5 + segment / 2, partitionHeight / 2, z, partitionMaterial);
          this.addBox(roomPartitions, segment, partitionHeight, 0.1, centerX + 1.5 - segment / 2, partitionHeight / 2, z, partitionMaterial);
        }
      }
      this.addBox(roomPartitions, 0.1, partitionHeight, 3 - hallHalf, splitX, partitionHeight / 2, (-width / 2 - hallHalf) / 2, partitionMaterial);
      this.addBox(roomPartitions, 0.1, partitionHeight, 3 - hallHalf, splitX, partitionHeight / 2, (width / 2 + hallHalf) / 2, partitionMaterial);
      this.addBox(roomPartitions, 0.1, partitionHeight, width / 2 - hallHalf, roomEndX, partitionHeight / 2, -width / 4 - hallHalf / 2, partitionMaterial);
      this.addBox(roomPartitions, 0.1, partitionHeight, width / 2 - hallHalf, roomEndX, partitionHeight / 2, width / 4 + hallHalf / 2, partitionMaterial);
    } else {
      const bedroomFrontX = -length / 2 + 3;
      const bedroomZStart = -width / 2;
      bedroomWindowPositions.forEach((centerZ, index) => {
        const roomLeft = bedroomZStart + index * 3;
        const doorGap = 0.9;
        const segment = (3 - doorGap) / 2;
        this.addBox(roomPartitions, 0.1, partitionHeight, segment, bedroomFrontX, partitionHeight / 2, roomLeft + segment / 2, partitionMaterial);
        this.addBox(roomPartitions, 0.1, partitionHeight, segment, bedroomFrontX, partitionHeight / 2, roomLeft + 3 - segment / 2, partitionMaterial);
        if (index > 0) this.addBox(roomPartitions, 3, partitionHeight, 0.1, -length / 2 + 1.5, partitionHeight / 2, roomLeft, partitionMaterial);
      });
    }

    const roof = this.createComponentGroup("roof");
    const overhang = 0.35;
    const xLeft = -length / 2 - overhang;
    const xRight = length / 2 + overhang;
    const eave = height;
    const ridge = eave + roofRise;
    const frontEave = -width / 2 - overhang;
    const backEave = width / 2 + overhang;
    const ridgeOffset = 0;
    const frontRoofSlope = this.addRoofSlope(roof, [
      [xLeft, eave, frontEave], [xRight, eave, frontEave],
      [xRight, ridge, ridgeOffset], [xLeft, ridge, ridgeOffset]
    ], this.materials.roof, "roof.cladding");
    frontRoofSlope.userData.cutawayFace = "front";
    const rearRoofSlope = this.addRoofSlope(roof, [
      [xLeft, ridge, ridgeOffset], [xRight, ridge, ridgeOffset],
      [xRight, eave, backEave], [xLeft, eave, backEave]
    ], this.materials.roof, "roof.cladding");
    rearRoofSlope.userData.cutawayFace = "back";
    this.addRoofRafters(roof, length, width, eave, ridge, frontEave, backEave);
    this.addLayerMesh(roof, "roof.insulation", this.makeRoofInsulation(length, width, height, roofRise, undefined, 0.18));
    this.addLayerMesh(roof, "roof.vapor", this.makeRoofInsulation(length, width, height, roofRise, 0x9db7b3, 0.02, "roof.vapor"));
    this.addLayerMesh(roof, "roof.interior", this.makeRoofInsulation(length, width, height, roofRise, 0xf7f0e4, 0.04, "roof.interior"));

    const windows = this.createComponentGroup("windows");
    this.addWindow(windows, livingWindowX, frontWindowSill, frontZ - 0.1, windowWidth, windowHeight, "front", "front");
    if (fourBedroomLayout) {
      bedroomColumnsX.forEach(x => this.addWindow(windows, x, frontWindowSill, frontZ - 0.1, windowWidth, windowHeight, "front", "front"));
      bedroomColumnsX.forEach(x => this.addWindow(windows, x, frontWindowSill, backZ + 0.1, windowWidth, windowHeight, "front", "back"));
    } else {
      sideBedroomWindows.forEach(z => this.addWindow(windows, -length / 2 - 0.1, frontWindowSill, z, windowWidth, windowHeight, "left"));
      if (bedroomCount > 1) this.addWindow(windows, -length / 2 + 1.5, frontWindowSill, backZ + 0.1, windowWidth, windowHeight, "front", "back");
    }

    const doors = this.createComponentGroup("doors");
    this.addDoor(doors, doorX, frontZ - wallThickness / 2 - 0.025, doorWidth, doorHeight);

    this.houseRoot.add(floorGroup, walls, roomPartitions, roof, windows, doors);
    this.houseRoot.traverse(object => {
      if (object.isMesh) {
        object.castShadow = true;
        object.receiveShadow = true;
      }
    });
    this.scene.add(this.houseRoot);
    this.updateLayerVisibility(getState());
    this.updateSelection(getState().selectedComponentId);
    this.render();
  }

  createComponentGroup(componentId) {
    const group = new THREE.Group();
    group.name = componentId;
    group.userData.componentId = componentId;
    this.componentGroups.set(componentId, group);
    return group;
  }

  addBox(group, width, height, depth, x, y, z, material, layerId) {
    const geometry = new THREE.BoxGeometry(width, height, depth);
    const mesh = new THREE.Mesh(geometry, material.clone());
    mesh.position.set(x, y, z);
    mesh.userData.componentId = group.userData.componentId;
    mesh.userData.layerId = layerId;
    group.add(mesh);
    if (layerId) this.registerLayerObject(layerId, mesh);
    return mesh;
  }

  addGable(group, width, wallHeight, rise, x, thickness, material, rotation) {
    const shape = new THREE.Shape();
    shape.moveTo(-width / 2, wallHeight);
    shape.lineTo(width / 2, wallHeight);
    shape.lineTo(0, wallHeight + rise);
    shape.closePath();
    const mesh = new THREE.Mesh(new THREE.ExtrudeGeometry(shape, { depth: thickness, bevelEnabled: false }), material.clone());
    mesh.material.side = THREE.DoubleSide;
    mesh.position.set(x - Math.sign(rotation) * thickness / 2, 0, 0);
    mesh.rotation.y = rotation;
    mesh.userData.componentId = "walls";
    mesh.userData.layerId = "walls.cladding-ext";
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
    this.registerLayerObject("walls.cladding-ext", mesh);
  }

  addLayerMesh(componentGroup, layerId, mesh) {
    mesh.userData.componentId = componentGroup.userData.componentId;
    mesh.userData.layerId = layerId;
    mesh.visible = false;
    componentGroup.add(mesh);
    this.registerLayerObject(layerId, mesh);
    return mesh;
  }

  registerLayerObject(layerId, mesh) {
    if (!this.layerGroups.has(layerId)) this.layerGroups.set(layerId, []);
    this.layerGroups.get(layerId).push(mesh);
  }

  makeWallInsulation(length, width, height) {
    const group = new THREE.Group();
    const mat = this.materials.insulation;
    const y = height / 2;
    this.addBox(group, length - 0.25, height - 0.25, 0.08, 0, y, -width / 2 + 0.24, mat, "walls.insulation");
    this.addBox(group, length - 0.25, height - 0.25, 0.08, 0, y, width / 2 - 0.24, mat, "walls.insulation");
    this.addBox(group, 0.08, height - 0.25, width - 0.35, -length / 2 + 0.24, y, 0, mat, "walls.insulation");
    this.addBox(group, 0.08, height - 0.25, width - 0.35, length / 2 - 0.24, y, 0, mat, "walls.insulation");
    return group;
  }

  makeFloorInsulation(length, width) {
    const group = new THREE.Group();
    this.addBox(group, length - 0.12, 0.1, width - 0.12, 0, -0.205, 0, this.materials.insulation, "floor.insulation");
    return group;
  }

  makeWallMembrane(length, width, height) {
    return this.makeWallInsulation(length, width, height);
  }

  makeInteriorLining(length, width, height) {
    const group = new THREE.Group();
    const lining = new THREE.MeshStandardMaterial({ color: 0xf7f0e4, roughness: 0.9, side: THREE.DoubleSide });
    this.addBox(group, length - 0.3, height - 0.3, 0.025, 0, height / 2, -width / 2 + 0.19, lining, "walls.interior");
    this.addBox(group, length - 0.3, height - 0.3, 0.025, 0, height / 2, width / 2 - 0.19, lining, "walls.interior");
    this.addBox(group, 0.025, height - 0.3, width - 0.3, -length / 2 + 0.19, height / 2, 0, lining, "walls.interior");
    this.addBox(group, 0.025, height - 0.3, width - 0.3, length / 2 - 0.19, height / 2, 0, lining, "walls.interior");
    return group;
  }

  makeRoofInsulation(length, width, height, rise, color, offset = 0, layerId = "roof.insulation") {
    const material = color ? new THREE.MeshStandardMaterial({ color, roughness: 0.9, side: THREE.DoubleSide }) : this.materials.insulation;
    const group = new THREE.Group();
    const xLeft = -length / 2 + 0.15;
    const xRight = length / 2 - 0.15;
    const eaveY = height - offset;
    const ridgeY = height + rise - offset;
    const frontLayer = this.addRoofSlope(group, [[xLeft,eaveY,-width/2+0.18],[xRight,eaveY,-width/2+0.18],[xRight,ridgeY,-0.05],[xLeft,ridgeY,-0.05]], material, layerId);
    const rearLayer = this.addRoofSlope(group, [[xLeft,ridgeY,0.05],[xRight,ridgeY,0.05],[xRight,eaveY,width/2-0.18],[xLeft,eaveY,width/2-0.18]], material, layerId);
    frontLayer.userData.cutawayFace = "front";
    rearLayer.userData.cutawayFace = "back";
    return group;
  }

  addRoofSlope(group, points, material, layerId) {
    const thickness = 0.11;
    const vertices = [];
    const faces = [[0,1,2],[0,2,3],[4,6,5],[4,7,6],[0,4,5],[0,5,1],[1,5,6],[1,6,2],[2,6,7],[2,7,3],[3,7,4],[3,4,0]];
    const fullPoints = points.concat(points.map(([x,y,z]) => [x,y-thickness,z]));
    for (const face of faces) for (const index of face) vertices.push(...fullPoints[index]);
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
    geometry.computeVertexNormals();
    const mesh = new THREE.Mesh(geometry, material.clone());
    mesh.userData.componentId = group.userData.componentId || "roof";
    mesh.userData.layerId = layerId;
    group.add(mesh);
    this.registerLayerObject(layerId, mesh);
    return mesh;
  }

  addRoofRafters(group, length, width, eave, ridge, frontEave, backEave) {
    const spacing = length / 6;
    for (let index = 0; index <= 6; index += 1) {
      const x = -length / 2 + index * spacing;
      for (const [startZ, endZ] of [[frontEave + 0.2, 0], [0, backEave - 0.2]]) {
        const startY = startZ < 0 ? eave : ridge;
        const endY = startZ < 0 ? ridge : eave;
        const points = [[x-0.045,startY-0.08,startZ],[x+0.045,startY-0.08,startZ],[x+0.045,endY-0.08,endZ],[x-0.045,endY-0.08,endZ]];
        const rafter = this.addRoofSlope(group, points, this.materials.wood, "roof.structure");
        rafter.userData.cutawayFace = startZ < 0 ? "front" : "back";
      }
    }
  }

  addWindow(group, x, y, z, width, height, orientation, cutawayFace = null) {
    const vertical = this.createComponentGroupMeshGroup(group, "windows");
    const frameMaterial = this.materials.frame;
    const glassMaterial = this.materials.glass;
    const depth = 0.08;
    const plane = new THREE.Group();
    plane.position.set(x, y + height / 2, z);
    if (orientation === "side") plane.rotation.y = Math.PI / 2;
    else if (orientation === "left") plane.rotation.y = -Math.PI / 2;
    const frameThickness = 0.09;
    this.addBox(plane, width, frameThickness, depth, 0, height / 2, 0, frameMaterial, "windows.frame");
    this.addBox(plane, width, frameThickness, depth, 0, -height / 2, 0, frameMaterial, "windows.frame");
    this.addBox(plane, frameThickness, height, depth, -width / 2, 0, 0, frameMaterial, "windows.frame");
    this.addBox(plane, frameThickness, height, depth, width / 2, 0, 0, frameMaterial, "windows.frame");
    const glass = new THREE.Mesh(new THREE.PlaneGeometry(width - 0.1, height - 0.1), glassMaterial);
    glass.position.z = 0.01;
    glass.userData.componentId = "windows";
    glass.userData.layerId = "windows.glass";
    plane.add(glass);
    this.registerLayerObject("windows.glass", glass);
    if (cutawayFace) plane.traverse(object => { if (object.isMesh) object.userData.cutawayFace = cutawayFace; });
    vertical.add(plane);
  }

  createComponentGroupMeshGroup(parent, componentId) {
    return parent;
  }

  addDoor(group, x, z, width, height) {
    const frame = new THREE.Group();
    frame.position.set(x, 0, z);
    const outer = this.addBox(frame, width + 0.14, height, 0.12, 0, height / 2, 0, this.materials.frame, "doors.frame");
    const leaf = this.addBox(frame, width, height, 0.06, 0, height / 2, 0.045, this.materials.door, "doors.panel");
    outer.userData.cutawayFace = "front";
    leaf.userData.cutawayFace = "front";
    const handle = new THREE.Mesh(new THREE.SphereGeometry(0.055, 12, 10), new THREE.MeshStandardMaterial({ color: 0xd9b874, metalness: 0.55, roughness: 0.35 }));
    handle.position.set(width * 0.34, height * 0.5, 0.09);
    handle.userData.componentId = "doors";
    handle.userData.cutawayFace = "front";
    frame.add(handle);
    group.add(frame);
  }

  setupInterface() {
    this.dimensionsKey = JSON.stringify(getState().dimensions);
    const componentSelect = document.getElementById("component-select");
    componentSelect.replaceChildren(createComponentSelect(houseComponents, componentId => {
      setState({ selectedComponentId: componentId });
    }));

    createDimensionInputs(getState().dimensions, dimensions => {
      setState({ dimensions });
    });
    this.renderControls(getState());
  }

  renderControls(state) {
    const panel = document.getElementById("component-panel");
    const title = document.getElementById("selected-component-title");
    const layers = document.getElementById("component-layers");
    const interventions = document.getElementById("component-interventions");
    const layersDisclosure = document.getElementById("layers-disclosure");
    const interventionsDisclosure = document.getElementById("interventions-disclosure");
    const layerSummary = document.getElementById("layer-summary");
    const interventionSummary = document.getElementById("intervention-summary");
    const detailCount = document.getElementById("component-detail-count");
    const selected = state.selectedComponentId;
    const sameComponent = this.controlsComponentId === selected;
    const layersWereOpen = sameComponent && layersDisclosure?.open;
    const interventionsWereOpen = sameComponent && interventionsDisclosure?.open;
    document.querySelectorAll(".component-btn").forEach(button => {
      const active = button.dataset.component === selected;
      button.classList.toggle("selected", active);
      button.setAttribute("aria-pressed", String(active));
      const activeCount = getInterventionsForComponent(button.dataset.component).filter(item => state.activeInterventions.has(item.id)).length;
      const status = button.querySelector(".zone-status");
      if (status) status.textContent = active ? "Viendo" : activeCount ? `${activeCount} activa${activeCount === 1 ? "" : "s"}` : "Explorar";
      button.classList.toggle("has-improvements", activeCount > 0);
    });

    if (!selected) {
      panel.hidden = true;
      this.controlsComponentId = null;
      return;
    }

    panel.hidden = false;
    title.textContent = componentNames.get(selected) || "Componente";
    const layerDetails = getLayerDetails(selected);
    const componentInterventions = getInterventionsForComponent(selected);
    const visibleLayerCount = Object.keys(layerDetails).filter(layerId => state.visibleLayers.has(layerId)).length;
    const activeInterventionCount = componentInterventions.filter(item => state.activeInterventions.has(item.id)).length;
    if (layerSummary) layerSummary.textContent = `${visibleLayerCount} de ${Object.keys(layerDetails).length} visibles`;
    if (interventionSummary) interventionSummary.textContent = `${activeInterventionCount} activas`;
    if (detailCount) detailCount.textContent = activeInterventionCount
      ? `${activeInterventionCount} ${activeInterventionCount === 1 ? "mejora activa" : "mejoras activas"}`
      : "Sin mejoras";
    layers.replaceChildren(createLayerToggles(layerDetails, state.visibleLayers, (layerId, visible) => {
      const visibleLayers = new Set(getState().visibleLayers);
      if (visible) visibleLayers.add(layerId);
      else visibleLayers.delete(layerId);
      setState({ visibleLayers });
    }));
    interventions.replaceChildren(createInterventionToggles(componentInterventions, state.activeInterventions, state.materials, (interventionId, active) => {
      const activeInterventions = new Set(getState().activeInterventions);
      if (active) activeInterventions.add(interventionId);
      else activeInterventions.delete(interventionId);
      setState({ activeInterventions, activeScenarioId: null });
    }));
    if (layersDisclosure) layersDisclosure.open = sameComponent ? layersWereOpen : false;
    if (interventionsDisclosure) interventionsDisclosure.open = sameComponent ? interventionsWereOpen : true;
    this.controlsComponentId = selected;
  }

  updateFromState(state) {
    if (this.dimensionsKey !== JSON.stringify(state.dimensions)) {
      this.dimensionsKey = JSON.stringify(state.dimensions);
      this.createModel(state.dimensions);
      this.fitCameraToHouse(state.dimensions);
    }
    this.renderControls(state);
    this.updateLayerVisibility(state);
    this.updateSelection(state.selectedComponentId);
    this.updateThermalFlow(state);
    const scale = document.getElementById("stage-scale-value");
    if (scale) {
      const display = value => String(Number(value.toFixed(1))).padStart(2, "0");
      scale.textContent = `${display(state.dimensions.length)} × ${display(state.dimensions.width)} M`;
    }
    this.render();
  }

  clearThermalFlow() {
    if (this.thermalFlowFrame) cancelAnimationFrame(this.thermalFlowFrame);
    this.thermalFlowFrame = null;
    if (!this.thermalFlow) return;
    this.scene.remove(this.thermalFlow.group);
    this.thermalFlow.group.traverse(object => {
      object.geometry?.dispose();
      object.material?.dispose();
    });
    this.thermalFlow = null;
  }

  createThermalFlow(state) {
    const dimensions = state.dimensions;
    const length = Math.max(4, Math.min(14, dimensions.length || 8));
    const width = Math.max(4, Math.min(12, dimensions.width || 6));
    const height = Math.max(2, Math.min(4, dimensions.height || 2.5));
    const roofRise = Math.min(1.75, width * Math.tan(THREE.MathUtils.degToRad(dimensions.roofPitch || 30)) / 2);
    const windowCount = Math.max(1, Math.min(5, dimensions.windows?.[0]?.count || 1));
    const bedroomCount = Math.max(1, Math.min(4, state.bedroomCount || windowCount - 1));
    const doorWidth = dimensions.doors?.[0]?.width || 0.9;
    const doorX = length / 2 - doorWidth / 2 - 0.28;
    const requestedWindowWidth = dimensions.windows?.[0]?.width || 0.9;
    const windowWidth = Math.min(requestedWindowWidth, Math.max(0.9, Math.min(1.25, (length - doorWidth - 0.6) / Math.max(2, bedroomCount + 1) * 0.95)));
    const livingWindowX = Math.max(-length / 2 + 0.35 + windowWidth / 2, doorX - doorWidth / 2 - windowWidth / 2 - 0.15);
    const routes = {
      roof: index => {
        const x = ((index * 0.618) % 1 - 0.5) * length * 0.86;
        const z = ((index * 0.381) % 1 - 0.5) * width * 0.46;
        return [new THREE.Vector3(x, height + roofRise * 0.62, z), new THREE.Vector3(x + 0.12, height + roofRise + 1.15, z + (index % 2 ? 0.12 : -0.12))];
      },
      walls: index => {
        const x = ((index * 0.618) % 1 - 0.5) * length * 0.9;
        const y = 0.3 + ((index * 0.347) % 1) * (height - 0.55);
        return [new THREE.Vector3(x, y, -width / 2 + 0.08), new THREE.Vector3(x - 0.12, y + 0.1, -width / 2 - 1.25)];
      },
      floor: index => {
        const x = ((index * 0.618) % 1 - 0.5) * length * 0.8;
        const z = ((index * 0.381) % 1 - 0.5) * width * 0.8;
        return [new THREE.Vector3(x, 0.12, z), new THREE.Vector3(x + 0.08, -1.05, z + 0.08)];
      },
      windows: index => {
        const y = Math.min(height * 0.62, 1.45);
        const opening = index % windowCount;
        if (bedroomCount === 4) {
          const columns = [-length / 2 + 1.5, -length / 2 + 4.5];
          if (opening < 2) {
            const x = columns[opening];
            return [new THREE.Vector3(x, y, -width / 2 + 0.08), new THREE.Vector3(x, y + 0.08, -width / 2 - 1.15)];
          }
          if (opening < 4) {
            const x = columns[opening - 2];
            return [new THREE.Vector3(x, y, width / 2 - 0.08), new THREE.Vector3(x, y + 0.08, width / 2 + 1.15)];
          }
          return [new THREE.Vector3(livingWindowX, y, -width / 2 + 0.1), new THREE.Vector3(livingWindowX, y + 0.08, -width / 2 - 1.15)];
        }
        if (opening < bedroomCount - 1 || (bedroomCount === 1 && opening === 0)) {
          const z = -width / 2 + 1.5 + opening * 3;
          return [new THREE.Vector3(-length / 2 + 0.08, y, z), new THREE.Vector3(-length / 2 - 1.15, y + 0.08, z)];
        }
        if (bedroomCount > 1 && opening === bedroomCount - 1) {
          const x = -length / 2 + 1.5;
          return [new THREE.Vector3(x, y, width / 2 - 0.08), new THREE.Vector3(x, y + 0.08, width / 2 + 1.15)];
        }
        return [new THREE.Vector3(livingWindowX, y, -width / 2 + 0.1), new THREE.Vector3(livingWindowX, y + 0.08, -width / 2 - 1.15)];
      },
      doors: index => {
        const x = length / 2 - 1.05;
        const y = 0.8 + ((index * 0.347) % 1) * 0.9;
        return [new THREE.Vector3(x, y, -width / 2 + 0.12), new THREE.Vector3(x, y, -width / 2 - 1.05)];
      }
    };
    const group = new THREE.Group();
    const systems = [];
    const baseCounts = { roof: 6, walls: 6, floor: 4, windows: 5, doors: 4 };
    for (const [componentId, route] of Object.entries(routes)) {
      const arrows = Array.from({ length: baseCounts[componentId] }, (_, index) => this.createFlowArrow(group, index));
      systems.push({ componentId, route, arrows, baseCount: baseCounts[componentId], intensity: 1, visibleCount: baseCounts[componentId] });
    }
    this.scene.add(group);
    this.thermalFlow = { group, systems };
    this.thermalFlowTime = 0;
  }

  createFlowArrow(parent, index) {
    const shaftSegments = 12;
    const shaftPositions = new Float32Array((shaftSegments + 1) * 2 * 3);
    const shaftIndices = [];
    for (let segment = 0; segment < shaftSegments; segment += 1) {
      const vertex = segment * 2;
      shaftIndices.push(vertex, vertex + 1, vertex + 2, vertex + 1, vertex + 3, vertex + 2);
    }
    const shaftGeometry = new THREE.BufferGeometry();
    shaftGeometry.setAttribute("position", new THREE.BufferAttribute(shaftPositions, 3));
    shaftGeometry.setIndex(shaftIndices);
    const headGeometry = new THREE.BufferGeometry();
    headGeometry.setAttribute("position", new THREE.BufferAttribute(new Float32Array(9), 3));
    headGeometry.setIndex([0, 1, 2]);
    const material = new THREE.MeshBasicMaterial({ color: 0xff7848, transparent: true, opacity: 0.98, blending: THREE.NormalBlending, side: THREE.DoubleSide, depthTest: false, depthWrite: false, toneMapped: false });
    const group = new THREE.Group();
    const shaft = new THREE.Mesh(shaftGeometry, material);
    const head = new THREE.Mesh(headGeometry, material);
    shaft.renderOrder = 30;
    head.renderOrder = 31;
    shaft.frustumCulled = false;
    head.frustumCulled = false;
    group.add(shaft, head);
    group.visible = false;
    group.userData.index = index;
    parent.add(group);
    return { group, shaftGeometry, shaftPositions, headGeometry, material };
  }

  updateThermalFlow(state) {
    document.querySelector(".aura-stage")?.classList.toggle("simulation-running", Boolean(state.simulationGenerated));
    const sceneLabel = document.getElementById("scene-label");
    const climateLabel = document.body.dataset.climate === "summer" ? "ESCENA DE VERANO · DÍA CALUROSO" : "ESCENA DE INVIERNO · DÍA FRÍO";
    if (sceneLabel) sceneLabel.textContent = `${climateLabel}${state.simulationGenerated ? " · FLUJO ACTIVO" : ""}`;
    if (!state.simulationGenerated) {
      this.clearThermalFlow();
      return;
    }
    if (!this.thermalFlow) this.createThermalFlow(state);
    const intensities = calculatePathIntensities(state.activeInterventions, state.interventions || []);
    const pathsByComponent = new Map();
    for (const path of thermalPaths) {
      if (!pathsByComponent.has(path.componentId)) pathsByComponent.set(path.componentId, []);
      const ratio = path.baseIntensity > 0 ? (intensities[path.id]?.currentIntensity ?? path.baseIntensity) / path.baseIntensity : 1;
      pathsByComponent.get(path.componentId).push(THREE.MathUtils.clamp(ratio, 0, 1));
    }
    const summer = document.body.dataset.climate === "summer";
    for (const system of this.thermalFlow.systems) {
      const pathFactors = pathsByComponent.get(system.componentId) || [1];
      system.intensity = THREE.MathUtils.clamp(pathFactors.reduce((sum, value) => sum + value, 0) / pathFactors.length, 0.04, 1);
      const componentOptions = (state.interventions || []).filter(item => item.componentId === system.componentId && item.affectedThermalPaths?.some(pathId => pathId.startsWith(`${system.componentId}-`)));
      const activeOptions = componentOptions.filter(item => state.activeInterventions.has(item.id));
      const hasCompleteCoverage = componentOptions.length > 0 && activeOptions.length === componentOptions.length;
      system.visibleCount = hasCompleteCoverage
        ? 0
        : Math.max(1, system.baseCount - activeOptions.length * Math.ceil(system.baseCount * 0.3));
      const coldInfiltration = !summer && ["windows", "doors"].includes(system.componentId);
      const color = summer ? 0xff7042 : coldInfiltration ? 0x38c4ed : 0xff7848;
      system.arrows.forEach((arrow, index) => {
        const visible = index < system.visibleCount;
        arrow.group.visible = visible;
        arrow.material.color.set(color);
        arrow.material.opacity = (0.32 + system.intensity * 0.62) * (visible ? 1 : 0);
        if (visible) this.updateFlowArrow(system, arrow, index, summer, this.thermalFlowTime);
      });
    }
    if (!this.thermalFlowFrame && !state.reducedMotion) {
      this.lastFlowFrameTime = performance.now();
      const tick = now => {
        if (!this.thermalFlow) { this.thermalFlowFrame = null; return; }
        this.thermalFlowTime += Math.min(0.05, (now - this.lastFlowFrameTime) / 1000);
        this.lastFlowFrameTime = now;
        this.updateThermalFlowPositions();
        this.render();
        this.thermalFlowFrame = requestAnimationFrame(tick);
      };
      this.thermalFlowFrame = requestAnimationFrame(tick);
    }
  }

  updateThermalFlowPositions() {
    if (!this.thermalFlow) return;
    const summer = document.body.dataset.climate === "summer";
    for (const system of this.thermalFlow.systems) system.arrows.forEach((arrow, index) => {
      if (arrow.group.visible) this.updateFlowArrow(system, arrow, index, summer, this.thermalFlowTime);
    });
  }

  isFlowEntering(componentId, summer) {
    return summer || (!summer && ["windows", "doors"].includes(componentId));
  }

  updateFlowArrow(system, arrow, index, summer, elapsed) {
    const state = getState();
    const windowCount = Math.max(1, Math.min(5, state.dimensions.windows?.[0]?.count || 1));
    const routeIndex = system.componentId === "windows" && system.visibleCount > 1
      ? Math.round(index * (windowCount - 1) / (system.visibleCount - 1))
      : system.componentId === "windows" ? Math.floor((windowCount - 1) / 2) : index;
    const [inside, outside] = system.route(routeIndex);
    const entering = this.isFlowEntering(system.componentId, summer);
    const start = entering ? outside : inside;
    const end = entering ? inside : outside;
    const direction = end.clone().sub(start).normalize();
    const view = this.camera.position.clone().sub(start).normalize();
    let side = direction.clone().cross(view).normalize();
    if (side.lengthSq() < 0.001) side.set(1, 0, 0);
    const phase = (elapsed * (0.08 + system.intensity * 0.3) + index / system.visibleCount) % 1;
    const center = start.clone().lerp(end, phase);
    const arrowLength = 0.72;
    const headLength = 0.22;
    const tail = center.clone().addScaledVector(direction, -arrowLength * 0.6);
    const tip = center.clone().addScaledVector(direction, arrowLength * 0.4);
    const waveAmplitude = 0.06 + system.intensity * 0.07;
    const halfShaft = 0.035 + system.intensity * 0.022;
    const shaftPositions = arrow.shaftPositions;
    const shaftSegments = shaftPositions.length / 6 - 1;
    for (let segment = 0; segment <= shaftSegments; segment += 1) {
      const t = segment / shaftSegments;
      const point = tail.clone().lerp(tip.clone().addScaledVector(direction, -headLength * 0.65), t);
      const wave = Math.sin(t * Math.PI * 3 + elapsed * 5 + index) * waveAmplitude * Math.sin(Math.PI * t);
      point.addScaledVector(side, wave);
      const width = halfShaft * (0.7 + 0.3 * t);
      const offset = segment * 6;
      shaftPositions[offset] = point.x + side.x * width;
      shaftPositions[offset + 1] = point.y + side.y * width;
      shaftPositions[offset + 2] = point.z + side.z * width;
      shaftPositions[offset + 3] = point.x - side.x * width;
      shaftPositions[offset + 4] = point.y - side.y * width;
      shaftPositions[offset + 5] = point.z - side.z * width;
    }
    arrow.shaftGeometry.attributes.position.needsUpdate = true;
    const base = tip.clone().addScaledVector(direction, -headLength);
    const headWidth = 0.085 + system.intensity * 0.05;
    const headPositions = arrow.headGeometry.attributes.position.array;
    headPositions.set([tip.x, tip.y, tip.z, base.x + side.x * headWidth, base.y + side.y * headWidth, base.z + side.z * headWidth, base.x - side.x * headWidth, base.y - side.y * headWidth, base.z - side.z * headWidth]);
    arrow.headGeometry.attributes.position.needsUpdate = true;
  }

  updateLayerVisibility(state) {
    const interventions = Array.from(state.activeInterventions).map(id => state.interventions.find(item => item.id === id)).filter(Boolean);
    for (const [layerId, objects] of this.layerGroups) {
      const [componentId] = layerId.split(".");
      const automatic = layerId.endsWith(".insulation") && interventions.some(item => item.componentId === componentId);
      const baseline = new Set(["floor.finish", "floor.slab", "walls.cladding-ext", "roof.cladding", "windows.frame", "windows.glass", "doors.panel", "doors.frame"]);
      for (const object of objects) {
        const hidesRoofShell = this.interiorCut && layerId.startsWith("roof.");
        const hidesFrontFace = this.layerCut && object.userData.cutawayFace === "front";
        const cutLayerVisible = (this.interiorCut || this.layerCut) && layerId === "walls.interior";
        const visible = !hidesRoofShell && !hidesFrontFace && ((state.visibleLayers?.has(layerId) ?? false) || baseline.has(layerId) || automatic || cutLayerVisible);
        object.visible = visible;
      }
    }
    for (const button of document.querySelectorAll("#component-layers input[type=checkbox]")) {
      button.checked = state.visibleLayers?.has(button.dataset.layer) || false;
    }
    this.render();
  }

  updateSelection(componentId) {
    for (const [id, group] of this.componentGroups) {
      group.traverse(object => {
        if (!object.isMesh || !object.material?.emissive) return;
        object.material.emissive.setHex(id === componentId ? 0x382013 : 0x000000);
        object.material.emissiveIntensity = id === componentId ? 0.32 : 0;
      });
    }
  }

  fitCameraToHouse(dimensions) {
    const length = dimensions.length || 8;
    const width = dimensions.width || 6;
    const diagonal = Math.hypot(length, width);
    this.radius = this.interiorCut
      ? Math.max(14, Math.max(length, width) * 1.65)
      : this.layerCut
        ? Math.max(15, diagonal * 1.75)
        : Math.max(12, diagonal * 1.32);
    this.updateCamera();
  }

  setupCameraControls() {
    const canvas = this.renderer.domElement;
    canvas.addEventListener("pointerdown", event => {
      this.dragStart = { x: event.clientX, y: event.clientY };
      this.previousPointer = { ...this.dragStart };
      canvas.setPointerCapture(event.pointerId);
    });
    canvas.addEventListener("pointermove", event => {
      if (!this.previousPointer) return;
      const dx = event.clientX - this.previousPointer.x;
      const dy = event.clientY - this.previousPointer.y;
      this.azimuth -= dx * 0.008;
      this.polar = THREE.MathUtils.clamp(this.polar + dy * 0.006, 0.35, 1.48);
      this.previousPointer = { x: event.clientX, y: event.clientY };
      this.updateCamera();
      this.render();
    });
    const stopDrag = event => {
      if (this.dragStart && Math.hypot(event.clientX - this.dragStart.x, event.clientY - this.dragStart.y) < 5) this.selectFromCanvas(event);
      this.dragStart = null;
      this.previousPointer = null;
    };
    canvas.addEventListener("pointerup", stopDrag);
    canvas.addEventListener("pointercancel", () => {
      this.dragStart = null;
      this.previousPointer = null;
    });
    canvas.addEventListener("wheel", event => {
      event.preventDefault();
      this.radius = THREE.MathUtils.clamp(this.radius + event.deltaY * 0.012, 8, 22);
      this.updateCamera();
      this.render();
    }, { passive: false });
    canvas.addEventListener("keydown", event => {
      if (event.key === "ArrowLeft") this.azimuth -= 0.12;
      else if (event.key === "ArrowRight") this.azimuth += 0.12;
      else if (event.key === "ArrowUp") this.polar = THREE.MathUtils.clamp(this.polar - 0.08, 0.35, 1.48);
      else if (event.key === "ArrowDown") this.polar = THREE.MathUtils.clamp(this.polar + 0.08, 0.35, 1.48);
      else if (event.key.toLowerCase() === "r") {
        this.interiorCut = false;
        this.layerCut = false;
        this.azimuth = 2.4;
        this.polar = 1.08;
        this.target.y = 1.2;
        this.radius = 13;
        this.updateLayerVisibility(getState());
      } else return;
      event.preventDefault();
      this.updateCamera();
      this.render();
    });
    document.getElementById("reset-house-view")?.addEventListener("click", () => {
      this.interiorCut = false;
      this.layerCut = false;
      this.azimuth = 2.4;
      this.polar = 1.08;
      this.target.y = 1.2;
      this.radius = 13;
      document.querySelectorAll("[data-house-view]").forEach(button => button.setAttribute("aria-pressed", "false"));
      this.updateLayerVisibility(getState());
      this.updateCamera();
      this.render();
    });
    document.querySelectorAll("[data-house-view]").forEach(button => {
      button.addEventListener("click", () => {
        const views = { front: [Math.PI, 1.12], side: [Math.PI / 2, 1.12], interior: [Math.PI * 0.77, 0.58], layers: [2.4, 0.92] };
        [this.azimuth, this.polar] = views[button.dataset.houseView];
        this.interiorCut = button.dataset.houseView === "interior";
        this.layerCut = button.dataset.houseView === "layers";
        this.target.y = this.interiorCut ? 0.55 : 1.2;
        this.fitCameraToHouse(getState().dimensions);
        this.updateLayerVisibility(getState());
        document.querySelectorAll("[data-house-view]").forEach(item => item.setAttribute("aria-pressed", String(item === button)));
        this.updateCamera();
        this.render();
      });
    });
    this.updateCamera();
  }

  updateCamera() {
    const sinPolar = Math.sin(this.polar);
    this.camera.position.set(
      this.target.x + this.radius * sinPolar * Math.sin(this.azimuth),
      this.target.y + this.radius * Math.cos(this.polar),
      this.target.z + this.radius * sinPolar * Math.cos(this.azimuth)
    );
    this.camera.lookAt(this.target);
  }

  selectFromCanvas(event) {
    const bounds = this.renderer.domElement.getBoundingClientRect();
    this.pointer.x = ((event.clientX - bounds.left) / bounds.width) * 2 - 1;
    this.pointer.y = -((event.clientY - bounds.top) / bounds.height) * 2 + 1;
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const hits = this.raycaster.intersectObjects(this.houseRoot.children, true);
    const hit = hits.find(item => item.object.userData.componentId && item.object.userData.componentId !== "floor");
    const componentId = hit?.object.userData.componentId;
    if (componentId) setState({ selectedComponentId: componentId });
  }

  resize() {
    const width = this.container.clientWidth;
    const height = this.container.clientHeight;
    if (!width || !height) return;
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.render();
  }

  render() {
    if (!this.renderer || !this.camera) return;
    this.renderer.render(this.scene, this.camera);
  }

  destroy() {
    this.unsubscribe?.();
    this.resizeObserver?.disconnect();
    document.removeEventListener("theme-change", this.onThemeChange);
    window.removeEventListener("climate-change", this.onClimateChange);
    this.clearThermalFlow();
    this.renderer.dispose();
    this.houseRoot.traverse(object => {
      if (object.geometry) object.geometry.dispose();
    });
    this.container.replaceChildren();
  }
}

export function createHouse3DView(container) {
  return new House3DView(container);
}
