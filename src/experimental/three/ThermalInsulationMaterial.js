/**
 * ThermalInsulationMaterial — Shader personalizado para aislamiento térmico
 * Pulsa suavemente, color según intensidad térmica (amarillo→naranja→rojo)
 * Compatible con Three.js r160+ ES modules
 */
import * as THREE from "/vendor/three.module.js";

const insulationVertexShader = `
  varying vec3 vNormal;
  varying vec3 vWorldPosition;
  varying vec2 vUv;
  
  uniform float uTime;
  uniform float uPulseSpeed;
  uniform float uPulseAmplitude;
  
  void main() {
    vUv = uv;
    vNormal = normalize(normalMatrix * normal);
    
    // Pulse animation - subtle scale along normal
    float pulse = sin(uTime * uPulseSpeed) * uPulseAmplitude;
    vec3 displaced = position + normal * pulse;
    
    vWorldPosition = (modelMatrix * vec4(displaced, 1.0)).xyz;
    
    gl_Position = projectionMatrix * viewMatrix * vec4(displaced, 1.0);
  }
`;

const insulationFragmentShader = `
  varying vec3 vNormal;
  varying vec3 vWorldPosition;
  varying vec2 vUv;
  
  uniform vec3 uBaseColor;      // Color base (amarillo cálido)
  uniform vec3 uHotColor;       // Color caliente (rojo)
  uniform float uIntensity;     // Intensidad térmica 0-1
  uniform float uTime;
  uniform float uOpacity;       // Opacidad base
  uniform float uGlowStrength;  // Fuerza del brillo
  
  // Noise function for organic texture
  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
  }
  
  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i + vec2(0.0, 0.0)), hash(i + vec2(1.0, 0.0)), f.x),
               mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
  }
  
  float fbm(vec2 p) {
    float value = 0.0;
    float amplitude = 0.5;
    for (int i = 0; i < 5; i++) {
      value += amplitude * noise(p);
      p *= 2.0;
      amplitude *= 0.5;
    }
    return value;
  }
  
  void main() {
    // Base color interpolation based on thermal intensity
    vec3 color = mix(uBaseColor, uHotColor, uIntensity);
    
    // Organic noise texture for fiber look
    vec2 noiseUv = vUv * 20.0 + uTime * 0.02;
    float n = fbm(noiseUv);
    
    // Subtle variation in color
    color += (n - 0.5) * 0.15 * uIntensity;
    
    // STRONG Pulse glow effect - visible animation
    float pulse = sin(uTime * 4.0 + vWorldPosition.y * 8.0) * 0.5 + 0.5;
    float glow = pulse * uIntensity * uGlowStrength * 2.0;
    
    // Fresnel effect for edge glow - stronger
    float fresnel = pow(1.0 - abs(dot(normalize(vNormal), vec3(0.0, 1.0, 0.0))), 1.5);
    float edgeGlow = fresnel * uIntensity * 0.6;
    
    // Color breathing - saturation shifts with pulse
    float breath = sin(uTime * 2.0) * 0.5 + 0.5;
    vec3 breathingColor = mix(color * 0.8, color * 1.3, breath * uIntensity * 0.5);
    
    // Final color with strong glow
    vec3 finalColor = breathingColor + vec3(glow + edgeGlow);
    
    // Opacity varies with pulse
    float alpha = uOpacity * (0.7 + 0.3 * n) * (0.6 + 0.4 * uIntensity) * (0.8 + 0.2 * pulse);
    
    gl_FragColor = vec4(finalColor, alpha);
  }
`;

/**
 * Crea el material de aislamiento térmico con shader personalizado
 */
export function createThermalInsulationMaterial(options = {}) {
  const defaults = {
    baseColor: new THREE.Color(0xffeb3b),    // Amarillo cálido
    hotColor: new THREE.Color(0xff4400),     // Rojo/naranja caliente
    intensity: 0.7,                           // 0 = frío, 1 = caliente (más visible)
    time: 0,
    pulseSpeed: 2.5,                          // Más rápido
    pulseAmplitude: 0.008,                    // 4x más amplitude
    opacity: 0.75,
    glowStrength: 0.5,                        // Más brillo
    side: THREE.DoubleSide,
    transparent: true,
    depthWrite: false,
  };

  const params = { ...defaults, ...options };

  const uniforms = {
    uBaseColor: { value: params.baseColor },
    uHotColor: { value: params.hotColor },
    uIntensity: { value: params.intensity },
    uTime: { value: params.time },
    uPulseSpeed: { value: params.pulseSpeed },
    uPulseAmplitude: { value: params.pulseAmplitude },
    uOpacity: { value: params.opacity },
    uGlowStrength: { value: params.glowStrength },
  };

  const material = new THREE.ShaderMaterial({
    vertexShader: insulationVertexShader,
    fragmentShader: insulationFragmentShader,
    uniforms: uniforms,
    side: params.side,
    transparent: params.transparent,
    depthWrite: params.depthWrite,
    depthTest: true,
  });

  // Método para actualizar intensidad térmica (0-1)
  material.setThermalIntensity = function(intensity) {
    this.uniforms.uIntensity.value = THREE.MathUtils.clamp(intensity, 0, 1);
    // Ajustar opacidad según intensidad
    this.uniforms.uOpacity.value = 0.5 + 0.3 * intensity;
  };

  // Método para actualizar tiempo (llamar en loop de animación)
  material.updateTime = function(deltaTime) {
    this.uniforms.uTime.value += deltaTime;
  };

  // Exponer uniforms para control externo
  material.thermalUniforms = uniforms;

  return material;
}

/**
 * Material simplificado fallback (sin shader) para dispositivos que no soporten shaders complejos
 */
export function createSimpleInsulationMaterial(options = {}) {
  const intensity = options.intensity || 0.5;
  const baseColor = new THREE.Color(0xffeb3b);
  const hotColor = new THREE.Color(0xff4400);
  const color = baseColor.clone().lerp(hotColor, intensity);
  
  return new THREE.MeshStandardMaterial({
    color: color,
    roughness: 0.95,
    metalness: 0.0,
    transparent: true,
    opacity: 0.5 + 0.3 * intensity,
    emissive: color.clone().multiplyScalar(0.2 * intensity),
    emissiveIntensity: intensity,
  });
}

/**
 * Detecta si el dispositivo soporta shaders personalizados
 */
export function supportsCustomShaders() {
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
    if (!gl) return false;
    
    // Test basic shader compilation
    const vs = gl.createShader(gl.VERTEX_SHADER);
    gl.shaderSource(vs, 'attribute vec3 position; void main() { gl_Position = vec4(position, 1.0); }');
    gl.compileShader(vs);
    if (!gl.getShaderParameter(vs, gl.COMPILE_STATUS)) return false;
    
    const fs = gl.createShader(gl.FRAGMENT_SHADER);
    gl.shaderSource(fs, 'precision mediump float; void main() { gl_FragColor = vec4(1.0, 0.0, 0.0, 1.0); }');
    gl.compileShader(fs);
    if (!gl.getShaderParameter(fs, gl.COMPILE_STATUS)) return false;
    
    return true;
  } catch (e) {
    return false;
  }
}