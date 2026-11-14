/**
 * ThermalParticles — Sistema de partículas GPU para visualizar flujo de calor
 * Usa THREE.Points con BufferGeometry + ShaderMaterial para miles de partículas
 * Flujo: interior → exterior a través de capas, intensidad según aislamiento
 */
import * as THREE from "/vendor/three.module.js";

const particleVertexShader = `
  attribute float aStartTime;
  attribute vec3 aStartPos;
  attribute vec3 aEndPos;
  attribute float aSpeed;
  attribute float aSize;
  attribute float aComponentId; // 0=roof, 1=walls, 2=floor, 3=windows, 4=doors
  
  uniform float uTime;
  uniform float uGlobalSpeed;
  uniform float uParticleCount;
  
  varying float vProgress;
  varying float vComponentId;
  varying float vAge;
  
  void main() {
    // Ciclo de vida de la partícula
    float life = 5.0; // segundos por ciclo
    float cycleTime = mod(uTime - aStartTime, life);
    float progress = cycleTime / life;
    
    // Posición interpolada
    vec3 pos = mix(aStartPos, aEndPos, progress);
    
    // Añadir ruido orgánico al camino
    float noise = sin(uTime * 2.0 + aStartPos.x * 10.0 + aStartPos.y * 10.0) * 0.05;
    pos.x += noise * (1.0 - progress);
    pos.z += noise * (1.0 - progress);
    
    // Tamaño variable con distancia y edad
    float sizeFactor = 1.0 - progress * 0.5;
    float pointSize = aSize * sizeFactor * (300.0 / length(cameraPosition - pos));
    
    vProgress = progress;
    vComponentId = aComponentId;
    vAge = cycleTime;
    
    gl_PointSize = max(pointSize, 1.0);
    gl_Position = projectionMatrix * viewMatrix * vec4(pos, 1.0);
  }
`;

const particleFragmentShader = `
  uniform vec3 uColorCold;    // Color frío (azul)
  uniform vec3 uColorHot;     // Color caliente (rojo/naranja)
  uniform float uGlobalIntensity;
  
  varying float vProgress;
  varying float vComponentId;
  varying float vAge;
  
  // Colores por componente
  vec3 getComponentColor(float id, float intensity) {
    if (id < 0.5) return mix(vec3(0.2, 0.4, 1.0), vec3(1.0, 0.3, 0.0), intensity); // roof - azul a rojo
    else if (id < 1.5) return mix(vec3(0.1, 0.5, 0.9), vec3(1.0, 0.4, 0.1), intensity); // walls
    else if (id < 2.5) return mix(vec3(0.3, 0.3, 0.8), vec3(1.0, 0.5, 0.0), intensity); // floor
    else if (id < 3.5) return mix(vec3(0.4, 0.3, 1.0), vec3(1.0, 0.6, 0.2), intensity); // windows
    else return mix(vec3(0.2, 0.6, 0.9), vec3(1.0, 0.5, 0.1), intensity); // doors
  }
  
  void main() {
    // Forma circular suave
    vec2 center = gl_PointCoord - 0.5;
    float dist = length(center);
    if (dist > 0.5) discard;
    
    // Suavizado radial
    float alpha = 1.0 - smoothstep(0.0, 0.5, dist);
    alpha *= alpha; // Más suave
    
    // Color basado en componente (se pasa via attribute pero aquí simulamos)
    vec3 color = getComponentColor(0.0, 0.5); // Fallback
    
    // Pulso de vida
    float pulse = sin(gl_FragCoord.x * 10.0 + 10.0) * 0.5 + 0.5;
    
    gl_FragColor = vec4(1.0, 0.3, 0.1, alpha * 0.6);
  }
`;

// Fallback simple sin shaders complejos
const simpleParticleVertexShader = `
  attribute float aStartTime;
  attribute vec3 aStartPos;
  attribute vec3 aEndPos;
  attribute float aSpeed;
  attribute float aSize;
  attribute float aComponentId;
  
  uniform float uTime;
  uniform float uGlobalSpeed;
  
  varying float vProgress;
  varying float vComponentId;
  
  void main() {
    float life = 4.0;
    float cycleTime = mod(uTime - aStartTime, life);
    float progress = cycleTime / life;
    
    vec3 pos = mix(aStartPos, aEndPos, progress);
    
    // Ruido simple
    float noise = sin(uTime * 3.0 + aStartPos.x * 5.0) * 0.03 * (1.0 - progress);
    vec3 finalPos = pos;
    finalPos.x += noise;
    finalPos.z += noise;
    
    float sizeFactor = 1.0 - progress * 0.3;
    float pointSize = aSize * sizeFactor * (400.0 / length(cameraPosition - mix(aStartPos, aEndPos, progress)));
    
    vProgress = progress;
    vComponentId = aComponentId;
    
    gl_PointSize = max(pointSize, 6.0);
    gl_Position = projectionMatrix * viewMatrix * vec4(mix(aStartPos, aEndPos, progress), 1.0);
  }
`;

const simpleParticleFragmentShader = `
  varying float vProgress;
  varying float vComponentId;
  
  void main() {
    vec2 center = gl_PointCoord - 0.5;
    float dist = length(center);
    if (dist > 0.5) discard;
    
    float alpha = 1.0 - smoothstep(0.0, 0.5, dist);
    alpha *= alpha;
    
    // Color BRIGHT según progreso: azul (inicio) -> amarillo/rojo (fin)
    vec3 color = mix(vec3(0.0, 0.5, 1.0), vec3(1.0, 0.8, 0.0), vProgress);
    
    // Pulso fuerte
    float pulse = sin(vProgress * 30.0) * 0.4 + 0.8;
    
    // BRILLO MÁXIMO
    gl_FragColor = vec4(1.0, 0.8, 0.0, alpha * 1.0 * pulse);
  }
`;

/**
 * Crea sistema de partículas térmicas
 */
export class ThermalParticles {
  constructor(house, options = {}) {
    this.house = house;
    this.particleCount = options.particleCount || 2000;
    this.particles = null;
    this.geometry = null;
    this.material = null;
    this.useSimpleShader = true; // Usar shader simple por compatibilidad
    
    this.init();
  }
  
  init() {
    this.createGeometry();
    this.createMaterial();
    this.createParticles();
  }
  
  createGeometry() {
    const count = this.particleCount;
    
    // Buffers
    const startTimes = new Float32Array(count);
    const startPositions = new Float32Array(count * 3);
    const endPositions = new Float32Array(count * 3);
    const speeds = new Float32Array(count);
    const sizes = new Float32Array(count);
    const componentIds = new Float32Array(count);
    
    // Obtener bounding box de la casa para límites
    const box = new THREE.Box3().setFromObject(this.house);
    const min = box.min;
    const max = box.max;
    const center = box.getCenter(new THREE.Vector3());
    
    // Definir zonas de emisión (interior) y salida (exterior por componentes)
    const interiorMin = new THREE.Vector3(min.x * 0.7, min.y + 0.1, min.z * 0.7);
    const interiorMax = new THREE.Vector3(max.x * 0.7, max.y * 0.9, max.z * 0.7);
    
    for (let i = 0; i < this.particleCount; i++) {
      // Tiempo de inicio aleatorio
      startTimes[i] = Math.random() * 10;
      
      // Posición inicial: punto aleatorio en interior
      const sx = THREE.MathUtils.lerp(interiorMin.x, interiorMax.x, Math.random());
      const sy = THREE.MathUtils.lerp(interiorMin.y, interiorMax.y, Math.random());
      const sz = THREE.MathUtils.lerp(interiorMin.z, interiorMax.z, Math.random());
      startPositions[i * 3] = sx;
      startPositions[i * 3 + 1] = sy;
      startPositions[i * 3 + 2] = sz;
      
      // Posición final: punto en superficie exterior (hacia afuera)
      const direction = new THREE.Vector3(
        (Math.random() - 0.5) * 2,
        Math.random() * 0.5 + 0.2,
        (Math.random() - 0.5) * 2
      ).normalize();
      
      const distance = 5 + Math.random() * 3;
      const ex = startPositions[i * 3] + direction.x * distance;
      const ey = startPositions[i * 3 + 1] + direction.y * distance;
      const ez = startPositions[i * 3 + 2] + direction.z * distance;
      endPositions[i * 3] = ex;
      endPositions[i * 3 + 1] = ey;
      endPositions[i * 3 + 2] = ez;
      
      // Velocidad variable
      speeds[i] = 0.5 + Math.random() * 1.5;
      
      // Tamaño - MÁS GRANDE
      sizes[i] = 8 + Math.random() * 8;
      
      // Componente destino (para color)
      componentIds[i] = Math.floor(Math.random() * 5); // 0-4
    }
    
    this.geometry = new THREE.BufferGeometry();
    this.geometry.setAttribute('aStartTime', new THREE.BufferAttribute(startTimes, 1));
    this.geometry.setAttribute('aStartPos', new THREE.BufferAttribute(startPositions, 3));
    this.geometry.setAttribute('aEndPos', new THREE.BufferAttribute(endPositions, 3));
    this.geometry.setAttribute('aSpeed', new THREE.BufferAttribute(speeds, 1));
    this.geometry.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
    this.geometry.setAttribute('aComponentId', new THREE.BufferAttribute(componentIds, 1));
  }
  
  createMaterial() {
    if (this.useSimpleShader) {
      this.material = new THREE.ShaderMaterial({
        vertexShader: simpleParticleVertexShader,
        fragmentShader: simpleParticleFragmentShader,
        uniforms: {
          uTime: { value: 0 },
          uGlobalSpeed: { value: 1.0 },
        },
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        vertexColors: false,
      });
    } else {
      this.material = new THREE.ShaderMaterial({
        vertexShader: particleVertexShader,
        fragmentShader: particleFragmentShader,
        uniforms: {
          uTime: { value: 0 },
          uGlobalSpeed: { value: 1.0 },
          uColorCold: { value: new THREE.Color(0x2244ff) },
          uColorHot: { value: new THREE.Color(0xff3300) },
          uGlobalIntensity: { value: 0.5 },
        },
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      });
    }
  }
  
  createParticles() {
    this.particles = new THREE.Points(this.geometry, this.material);
    this.particles.frustumCulled = false;
    this.particles.name = "thermal-particles";
    console.log("[ThermalParticles] Created:", this.particleCount, "particles");
    console.log("[ThermalParticles] Material:", this.material.type);
  }
  
  update(deltaTime, time) {
    if (this.material && this.material.uniforms) {
      this.material.uniforms.uTime.value = time;
    }
  }
  
  setIntensity(intensity) {
    // Ajustar opacidad o cantidad según intensidad térmica global
    if (this.material) {
      this.material.opacity = 0.4 + intensity * 0.4;
    }
  }
  
  setColorScheme(coldColor, hotColor) {
    if (this.material && this.material.uniforms.uColorCold) {
      this.material.uniforms.uColorCold.value.set(coldColor);
      this.material.uniforms.uColorHot.value.set(hotColor);
    }
  }
  
  setVisible(visible) {
    if (this.particles) this.particles.visible = visible;
  }
  
  getMesh() {
    return this.particles;
  }
  
  dispose() {
    if (this.geometry) this.geometry.dispose();
    if (this.material) this.material.dispose();
    if (this.particles) this.particles.geometry.dispose();
  }
}

/**
 * Factory function
 */
export function createThermalParticles(house, options) {
  return new ThermalParticles(house, options);
}