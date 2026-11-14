/**
 * PostProcessing — Pipeline de post-procesado para Three.js
 * Incluye: Bloom, Tone Mapping (ACESFilmic), Color Grading, Vignette, FXAA
 */
import * as THREE from "/vendor/three.module.js";
import { EffectComposer } from "/vendor/three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "/vendor/three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "/vendor/three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { ShaderPass } from "/vendor/three/examples/jsm/postprocessing/ShaderPass.js";
import { OutputPass } from "/vendor/three/examples/jsm/postprocessing/OutputPass.js";
import { FXAAPass } from "/vendor/three/examples/jsm/postprocessing/FXAAPass.js";

/**
 * Shader para Color Grading / Tone Mapping personalizado
 */
const ColorGradingShader = {
  uniforms: {
    tDiffuse: { value: null },
    uExposure: { value: 1.0 },
    uContrast: { value: 1.0 },
    uSaturation: { value: 1.0 },
    uTemperature: { value: 0.0 },    // -1 = frío, 1 = cálido
    uTint: { value: 0.0 },           // -1 = verde, 1 = magenta
    uLift: { value: new THREE.Vector3(0, 0, 0) },    // Sombras
    uGamma: { value: new THREE.Vector3(1, 1, 1) },   // Medios
    uGain: { value: new THREE.Vector3(1, 1, 1) },    // Altas luces
    uVignette: { value: 0.0 },
    uVignetteColor: { value: new THREE.Color(0x000000) },
    uGrain: { value: 0.0 },
    uTime: { value: 0 },
  },
  vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    uniform sampler2D tDiffuse;
    uniform float uExposure;
    uniform float uContrast;
    uniform float uSaturation;
    uniform float uTemperature;
    uniform float uTint;
    uniform vec3 uLift;
    uniform vec3 uGamma;
    uniform vec3 uGain;
    uniform float uVignette;
    uniform vec3 uVignetteColor;
    uniform float uGrain;
    uniform float uTime;
    varying vec2 vUv;
    
    // ACES Filmic Tone Mapping
    vec3 acesFilmic(vec3 x) {
      float a = 2.51;
      float b = 0.03;
      float c = 2.43;
      float d = 0.59;
      float e = 0.14;
      return clamp((x * (a * x + b)) / (x * (c * x + d) + e), 0.0, 1.0);
    }
    
    // Filmic tone mapping (simplificado)
    vec3 filmic(vec3 x) {
      x *= 1.0 / 0.18; // exposure bias
      return acesFilmic(x);
    }
    
    // Color temperature adjustment
    vec3 colorTemp(vec3 color, float temp) {
      if (temp == 0.0) return color;
      if (temp > 0.0) {
        // Warm (orange)
        return mix(color, color * vec3(1.0, 0.8, 0.6), temp * 0.5);
      } else {
        // Cool (blue)
        return mix(color, color * vec3(0.8, 0.9, 1.1), -temp * 0.5);
      }
    }
    
    // Tint adjustment
    vec3 tintAdjust(vec3 color, float tint) {
      if (tint == 0.0) return color;
      if (tint > 0.0) {
        // Magenta
        return mix(color, vec3(color.r, color.g * 0.9, color.b), tint * 0.3);
      } else {
        // Green
        return mix(color, vec3(color.r, color.g, color.b * 0.9), -tint * 0.3);
      }
    }
    
    // Lift/Gamma/Gain (LGG) color correction
    vec3 lgg(vec3 color, vec3 lift, vec3 gamma, vec3 gain) {
      color = max(color, vec3(0.0));
      color = (color - lift) / (gain - lift);
      color = pow(color, vec3(1.0) / gamma);
      return clamp(color, 0.0, 1.0);
    }
    
    // Vignette
    float vignette(vec2 uv, float amount, vec3 color) {
      float dist = length(uv - 0.5) * 1.414;
      float vig = smoothstep(0.3, 0.8, dist) * amount;
      return vig;
    }
    
    // Film grain
    float grain(vec2 uv, float time, float amount) {
      vec2 noiseUV = uv * 512.0 + time * 100.0;
      float g = fract(sin(dot(noiseUV, vec2(12.9898, 78.233))) * 43758.5453);
      return (g - 0.5) * amount;
    }
    
    void main() {
      vec3 color = texture2D(tDiffuse, vUv).rgb;
      
      // Exposure
      color *= uExposure;
      
      // Lift/Gamma/Gain
      color = lgg(color, uLift, uGamma, uGain);
      
      // Temperature & Tint
      color = colorTemp(color, uTemperature);
      color = tintAdjust(color, uTint);
      
      // Contrast
      color = mix(vec3(0.5), color, uContrast);
      
      // Saturation
      float luminance = dot(color, vec3(0.2126, 0.7152, 0.0722));
      color = mix(vec3(luminance), color, uSaturation);
      
      // Tone Mapping (Filmic)
      color = filmic(color);
      
      // Vignette
      float vig = vignette(vUv, uVignette, uVignetteColor);
      color = mix(color, uVignetteColor, vig);
      
      // Film Grain
      if (uGrain > 0.0) {
        color += grain(vUv, uTime, uGrain);
      }
      
      // sRGB output
      color = pow(color, vec3(1.0 / 2.2));
      
      gl_FragColor = vec4(clamp(color, 0.0, 1.0), 1.0);
    }
  `
};

/**
 * Crea el compositor de post-procesado
 */
export function createPostProcessing(renderer, scene, camera, options = {}) {
  const defaults = {
    resolution: new THREE.Vector2(window.innerWidth, window.innerHeight),
    exposure: 1.0,
    bloomStrength: 0.15,
    bloomRadius: 0.4,
    bloomThreshold: 0.85,
    enableBloom: true,
    enableFXAA: true,
    enableColorGrading: true,
    enableVignette: true,
    vignetteAmount: 0.15,
  };
  
  const params = { ...defaults, ...options };
  
  // Composer
  const composer = new EffectComposer(renderer);
  composer.setSize(params.resolution.x, params.resolution.y);
  composer.setPixelRatio(window.devicePixelRatio);
  
  // Render Pass
  const renderPass = new RenderPass(scene, camera);
  composer.addPass(renderPass);
  
  // Bloom Pass
  if (params.enableBloom) {
    const bloomPass = new UnrealBloomPass(
      new THREE.Vector2(params.resolution.x, params.resolution.y),
      params.bloomStrength,
      params.bloomRadius,
      params.bloomThreshold
    );
    bloomPass.threshold = params.bloomThreshold;
    bloomPass.strength = params.bloomStrength;
    bloomPass.radius = params.bloomRadius;
    composer.addPass(bloomPass);
    params._bloomPass = bloomPass;
  }
  
  // Color Grading Pass
  if (params.enableColorGrading) {
    const colorGradingMaterial = new THREE.ShaderMaterial({
      uniforms: THREE.UniformsUtils.clone(ColorGradingShader.uniforms),
      vertexShader: ColorGradingShader.vertexShader,
      fragmentShader: ColorGradingShader.fragmentShader,
    });
    
    // Inicializar uniforms
    colorGradingMaterial.uniforms.tDiffuse.value = null; // Se asigna automáticamente
    colorGradingMaterial.uniforms.uExposure.value = 1.0;
    colorGradingMaterial.uniforms.uContrast.value = 1.05;
    colorGradingMaterial.uniforms.uSaturation.value = 1.05;
    colorGradingMaterial.uniforms.uTemperature.value = 0.05; // Ligeramente cálido
    colorGradingMaterial.uniforms.uTint.value = 0.0;
    colorGradingMaterial.uniforms.uLift.value = new THREE.Vector3(0.0, 0.0, 0.0);
    colorGradingMaterial.uniforms.uGamma.value = new THREE.Vector3(1.0, 1.0, 1.0);
    colorGradingMaterial.uniforms.uGain.value = new THREE.Vector3(1.0, 1.0, 1.0);
    colorGradingMaterial.uniforms.uVignette.value = params.enableVignette ? 0.25 : 0.0;
    colorGradingMaterial.uniforms.uVignetteColor.value = new THREE.Color(0x000000);
    colorGradingMaterial.uniforms.uGrain.value = 0.005;
    colorGradingMaterial.uniforms.uTime.value = 0;
    
    const colorGradingPass = new ShaderPass(colorGradingMaterial);
    composer.addPass(colorGradingPass);
    params._colorGradingPass = colorGradingPass;
    params._colorGradingMaterial = colorGradingMaterial;
  }
  
  // FXAA Pass (Anti-aliasing)
  if (params.enableFXAA) {
    const fxaaPass = new FXAAPass();
    fxaaPass.material.uniforms.resolution.value.set(1 / params.resolution.x, 1 / params.resolution.y);
    composer.addPass(fxaaPass);
    params._fxaaPass = fxaaPass;
  }
  
  // Output Pass (sRGB)
  const outputPass = new OutputPass();
  composer.addPass(outputPass);
  
  // Métodos de actualización
  composer.updateTime = (time) => {
    if (params._colorGradingMaterial) {
      params._colorGradingMaterial.uniforms.uTime.value = time * 0.001;
    }
  };
  
  composer.setExposure = (exposure) => {
    if (params._colorGradingMaterial) {
      params._colorGradingMaterial.uniforms.uExposure.value = exposure;
    }
  };
  
  composer.setBloom = (strength, radius, threshold) => {
    if (params._bloomPass) {
      params._bloomPass.strength = strength;
      params._bloomPass.radius = radius;
      params._bloomPass.threshold = threshold;
    }
  };
  
  composer.setColorGrading = (params_) => {
    if (params._colorGradingMaterial) {
      const m = params._colorGradingMaterial.uniforms;
      if (params_.contrast !== undefined) m.uContrast.value = params_.contrast;
      if (params_.saturation !== undefined) m.uSaturation.value = params_.saturation;
      if (params_.temperature !== undefined) m.uTemperature.value = params_.temperature;
      if (params_.tint !== undefined) m.uTint.value = params_.tint;
      if (params_.exposure !== undefined) m.uExposure.value = params_.exposure;
      if (params_.vignette !== undefined) m.uVignette.value = params_.vignette;
    }
  };
  
  composer.setResolution = (width, height) => {
    composer.setSize(width, height);
    if (params._fxaaPass) {
      params._fxaaPass.material.uniforms.resolution.value.set(1 / width, 1 / height);
    }
  };
  
  return composer;
}

/**
 * Carga HDRI Environment Map
 */
export async function loadHDRIEnvironment(renderer, url, options = {}) {
  const { RGBELoader } = await import("/vendor/three/examples/jsm/loaders/RGBELoader.js");
  
  return new Promise((resolve, reject) => {
    const loader = new RGBELoader();
    loader.setDataType(THREE.FloatType);
    
    loader.load(
      url,
      (texture) => {
        texture.mapping = THREE.EquirectangularReflectionMapping;
        texture.colorSpace = THREE.SRGBColorSpace;
        
        // Configurar como environment map
        if (options.asBackground) {
          // Solo como background
        } else {
          // Como environment lighting
        }
        
        resolve(texture);
      },
      undefined,
      (error) => reject(error)
    );
  });
}

/**
 * Crea HDRI procedural si no hay archivo
 */
export function createProceduralHDRI(size = 1024) {
  const data = new Float32Array(size * size * 3);
  
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = x / (size - 1);
      const v = y / (size - 1);
      
      // Convertir a coordenadas esféricas
      const theta = u * Math.PI * 2;
      const phi = v * Math.PI;
      
      const dir = new THREE.Vector3(
        Math.sin(phi) * Math.cos(theta),
        Math.cos(phi),
        Math.sin(phi) * Math.sin(theta)
      );
      
      // Sky gradient: horizon warm, zenith cool
      const horizonColor = new THREE.Color(0.9, 0.7, 0.4);  // Warm horizon
      const zenithColor = new THREE.Color(0.3, 0.5, 0.9);   // Cool zenith
      const groundColor = new THREE.Color(0.2, 0.15, 0.1);  // Dark ground
      
      let color;
      if (dir.y > 0.1) {
        // Sky
        const t = (dir.y - 0.1) / 0.9;
        color = zenithColor.clone().lerp(horizonColor, 1.0 - t);
      } else if (dir.y > -0.1) {
        // Horizon
        color = horizonColor;
      } else {
        // Ground
        color = groundColor;
      }
      
      // Sun highlight
      const sunDir = new THREE.Vector3(0.3, 0.8, 0.5).normalize();
      const sunDot = Math.max(0, dir.dot(sunDir));
      if (sunDot > 0.98) {
        color.add(new THREE.Color(1.0, 0.9, 0.7).multiplyScalar(Math.pow(sunDot, 64) * 5.0));
      }
      
      const idx = (y * size + x) * 3;
      data[idx] = color.r;
      data[idx + 1] = color.g;
      data[idx + 2] = color.b;
    }
  }
  
  const dataTexture = new THREE.DataTexture(data, size, size, THREE.RGBFormat, THREE.FloatType);
  dataTexture.mapping = THREE.EquirectangularReflectionMapping;
  dataTexture.colorSpace = THREE.SRGBColorSpace;
  dataTexture.needsUpdate = true;
  
  return dataTexture;
}

export { ColorGradingShader };