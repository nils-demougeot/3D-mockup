// Matériaux réutilisables
import * as THREE from 'three';
import { sparkleNormal, brushedRoughness } from './textures.js';

// Tissu : faces arrière (intérieur du vêtement) d'une couleur unie plus sombre, sans impression
export function fabricMaterial({ color = '#ffffff', map = null, normalMap = null, normalScale = 0.6, roughness = 0.9, sheen = 0.45, inner = null } = {}) {
  const m = new THREE.MeshPhysicalMaterial({
    color, map, normalMap, roughness, metalness: 0,
    sheen, sheenRoughness: 0.8, sheenColor: new THREE.Color(0xffffff),
    side: THREE.DoubleSide,
  });
  m.normalScale = new THREE.Vector2(normalScale, normalScale);
  m.userData.inner = { value: new THREE.Color(inner || '#555555') };
  m.onBeforeCompile = (sh) => {
    sh.uniforms.innerColor = m.userData.inner;
    sh.fragmentShader = sh.fragmentShader
      .replace('void main() {', 'uniform vec3 innerColor;\nvoid main() {')
      .replace('#include <color_fragment>', '#include <color_fragment>\n if (!gl_FrontFacing) diffuseColor.rgb = innerColor;');
  };
  m.customProgramCacheKey = () => 'fabric';
  return m;
}

export function setInner(m, hex) {
  m.userData.inner?.value.set(hex);
}

export const METALS = {
  gold: { label: 'Or', color: '#e6c06a', roughness: 0.22 },
  silver: { label: 'Argent', color: '#e3e5e8', roughness: 0.18 },
  black: { label: 'Nickel noir', color: '#3a3b3f', roughness: 0.25 },
  rose: { label: 'Or rose', color: '#e7a98f', roughness: 0.22 },
  copper: { label: 'Cuivre', color: '#c47a4f', roughness: 0.28 },
  chrome: { label: 'Chrome', color: '#f2f4f7', roughness: 0.08 },
};

export function metalMaterial(kind = 'silver', extra = {}) {
  const m = METALS[kind] || METALS.silver;
  return new THREE.MeshPhysicalMaterial({ color: m.color, metalness: 1, roughness: m.roughness, ...extra });
}

// Holographique : reflets arc-en-ciel dépendants de l'angle de vue, masqués par holoMap (canal R)
export function holoMaterial({ map, holoMap = null, strength = 1, glitter = false, roughness = 0.22 }) {
  const m = new THREE.MeshPhysicalMaterial({
    map, roughness, metalness: 0.0, clearcoat: 1, clearcoatRoughness: 0.08,
    normalMap: sparkleNormal(),
  });
  m.normalScale = new THREE.Vector2(glitter ? 0.9 : 0.1, glitter ? 0.9 : 0.1);
  m.normalMap.repeat.set(glitter ? 4 : 2, glitter ? 4 : 2);
  m.userData.holo = { value: strength };
  m.userData.holoMap = { value: holoMap };
  m.userData.useHoloMap = { value: holoMap ? 1 : 0 };
  m.onBeforeCompile = (sh) => {
    sh.uniforms.holoStrength = m.userData.holo;
    sh.uniforms.holoMap = m.userData.holoMap;
    sh.uniforms.useHoloMap = m.userData.useHoloMap;
    sh.vertexShader = sh.vertexShader
      .replace('void main() {', 'varying vec2 vHoloUv;\nvarying vec3 vHoloWorldN;\nvoid main() {\n vHoloUv = uv;\n vHoloWorldN = normalize(mat3(modelMatrix) * normal);');
    sh.fragmentShader = sh.fragmentShader
      .replace('void main() {', `uniform float holoStrength;
uniform sampler2D holoMap;
uniform float useHoloMap;
varying vec2 vHoloUv;
varying vec3 vHoloWorldN;
vec3 holoHue(float h){ return clamp(abs(mod(h*6.0+vec3(0.0,4.0,2.0),6.0)-3.0)-1.0,0.0,1.0); }
float holoHash(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7)))*43758.5453); }
void main() {`)
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
  {
    float mask = useHoloMap > 0.5 ? texture2D(holoMap, vHoloUv).r : 1.0;
    mask *= holoStrength;
    vec3 V = normalize(vViewPosition);
    float ndv = dot(normal, V);
    vec2 cell = floor(vHoloUv * 90.0);
    float grain = holoHash(cell) * 0.05;
    float h = ndv * 1.6 + (vHoloUv.x * 1.3 + vHoloUv.y * 0.9) + grain + sin((vHoloUv.x - vHoloUv.y) * 60.0) * 0.04 + vHoloWorldN.x * 0.6;
    vec3 rainbow = mix(holoHue(h), vec3(1.0), 0.18);
    float lum = dot(diffuseColor.rgb, vec3(0.299, 0.587, 0.114));
    float sat = max(diffuseColor.r, max(diffuseColor.g, diffuseColor.b)) - min(diffuseColor.r, min(diffuseColor.g, diffuseColor.b));
    float whiteish = smoothstep(0.55, 0.9, lum) * (1.0 - smoothstep(0.1, 0.35, sat));
    vec3 tinted = diffuseColor.rgb * (0.45 + 0.85 * rainbow);
    vec3 holoCol = mix(tinted, rainbow * (0.6 + 0.4 * lum), whiteish);
    diffuseColor.rgb = mix(diffuseColor.rgb, holoCol, mask);
    metalnessFactor = mix(metalnessFactor, 0.92, mask);
    roughnessFactor = mix(roughnessFactor, 0.16, mask);
  }`);
  };
  m.customProgramCacheKey = () => 'holo';
  return m;
}

export function brushedSteel(color = '#d9dce0') {
  const m = new THREE.MeshPhysicalMaterial({ color, metalness: 1, roughness: 0.32, roughnessMap: brushedRoughness(), anisotropy: 0.6 });
  return m;
}
