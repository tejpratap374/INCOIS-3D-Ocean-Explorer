import * as THREE from 'three'

const VERTEX_SHADER = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vNormal;
  varying vec3 vWorldPos;
  varying vec3 vViewPos;

  void main() {
    vUv = uv;
    // World-space normal (Earth is at the origin, rotation only) so it can be
    // dotted with the world-space sunDirection. This keeps the day/night
    // terminator and specular stable as the globe spins and the camera orbits.
    vNormal = normalize(mat3(modelMatrix) * normal);
    vec4 worldPos = modelMatrix * vec4(position, 1.0);
    vWorldPos = worldPos.xyz;
    vec4 mvPosition = viewMatrix * worldPos;
    vViewPos = mvPosition.xyz;
    gl_Position = projectionMatrix * mvPosition;
  }
`

  const FRAGMENT_SHADER = /* glsl */ `
  uniform sampler2D dayMap;
  uniform sampler2D specularMap;

  uniform vec3 sunDirection;
  uniform vec3 ambientColor;
  uniform float time;
  uniform float oceanWaveSpeed;
  uniform float useVectorMap; // 1.0 = Slate Grey Vector Theme, 0.0 = Satellite Photo

  varying vec2 vUv;
  varying vec3 vNormal;
  varying vec3 vWorldPos;
  varying vec3 vViewPos;

  // Cheap analytic normal perturbation for a subtle "alive" ocean surface.
  vec3 perturbNormal(vec3 n, vec3 worldPos, float mask) {
    float t = time * oceanWaveSpeed;
    float wx = sin(worldPos.x * 14.0 + t * 1.3) * sin(worldPos.z * 11.0 + t * 0.9);
    float wy = sin(worldPos.y * 13.0 - t * 1.1) * sin(worldPos.x * 9.0 + t * 1.6) * 0.6;
    return normalize(n + vec3(wx, wy, 0.0) * 0.30 * mask);
  }

  const float PI = 3.14159265359;

  void main() {
    // Calculate geographic lat/lon from spherical world position
    vec3 pos = normalize(vWorldPos);
    float lat = asin(clamp(pos.y, -1.0, 1.0));
    float lon = atan(pos.x, pos.z);

    vec2 uv = vec2(0.5 + lon / (2.0 * PI), 0.5 + lat / PI);

    vec3 day = texture2D(dayMap, uv).rgb;
    float specMask = texture2D(specularMap, uv).r;

    // Convert satellite day texture to deep dark charcoal gray so land recedes into dark background
    float grayDay = dot(day, vec3(0.299, 0.587, 0.114));
    vec3 desaturatedLand = vec3(grayDay * 0.08 + 0.04); // Deep dark charcoal gray terrain (#0b0d10)

    vec3 satLand = desaturatedLand;
    vec3 satOcean = vec3(0.015, 0.03, 0.06);
    vec3 satBase = mix(satLand, satOcean, specMask);

    // Deep dark charcoal vector map theme - dark gray land (#0e1014) and deep dark ocean base (#04050a)
    vec3 vecLand = mix(vec3(0.07, 0.08, 0.10), desaturatedLand, 0.35);
    vec3 vecOcean = vec3(0.015, 0.02, 0.04);
    vec3 vecBase = mix(vecLand, vecOcean, specMask);

    vec3 base = mix(satBase, vecBase, useVectorMap);

    vec3 n = perturbNormal(normalize(vNormal), vWorldPos, specMask);

    vec3 lightDir = normalize(sunDirection);
    float diffuse = max(dot(n, lightDir), 0.0);

    vec3 viewDir = normalize(-vViewPos);
    vec3 color = base;

    gl_FragColor = vec4(color, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`

interface LandOceanMaterialOptions {
  dayMap: THREE.Texture
  specularMap: THREE.Texture
  bumpMap?: THREE.Texture
  sunDirection?: THREE.Vector3
  ambientColor?: THREE.Color
  oceanWaveSpeed?: number
  useVectorMap?: number
}

export class LandOceanMaterial extends THREE.ShaderMaterial {
  constructor(options: LandOceanMaterialOptions) {
    const {
      dayMap,
      specularMap,
      bumpMap,
      sunDirection = new THREE.Vector3(0.5, 0.3, 1),
      ambientColor = new THREE.Color(0.12, 0.14, 0.18),
      oceanWaveSpeed = 0.8,
      useVectorMap = 1.0
    } = options

    super({
      uniforms: {
        dayMap: { value: dayMap },
        specularMap: { value: specularMap },
        bumpMap: { value: bumpMap },
        sunDirection: { value: sunDirection.clone().normalize() },
        ambientColor: { value: ambientColor },
        time: { value: 0 },
        oceanWaveSpeed: { value: oceanWaveSpeed },
        useVectorMap: { value: useVectorMap }
      },
      vertexShader: VERTEX_SHADER,
      fragmentShader: FRAGMENT_SHADER,
      lights: false
    })
  }
}
