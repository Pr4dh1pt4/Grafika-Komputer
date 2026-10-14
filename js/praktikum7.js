import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { HDRLoader } from "three/addons/loaders/HDRLoader.js";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";

const canvas = document.getElementById("p7-canvas");
const status = document.getElementById("p7-status");
const fallback = document.getElementById("p7-fallback");

const MODEL_URL = "assets/Duck.glb";
const PANORAMAS = {
  studio: { label: "Studio Small 09", url: "assets/studio_small_09_1k.hdr" },
  ladybrand: { label: "Ladybrand Heritage House", url: "assets/ladybrand_heritage_house_1k.hdr" },
  procedural: { label: "Procedural", url: null },
};

const DEFAULT_CAMERA_POSITION = new THREE.Vector3(7.5, 5.2, 9.5);
const DEFAULT_TARGET = new THREE.Vector3(0, 1, 0);
const DEFAULT_FOV = 52;
const ORTHO_HALF_HEIGHT = 5.5;
const BACKGROUND_COLOR = new THREE.Color(0x0b1018);
const HOVER_EMISSIVE = new THREE.Color(0xd88945);
const HOVER_EMISSIVE_INTENSITY = 0.45;
const HOVER_SCALE = 1.06;
const SELECT_SCALE = 1.12;
const SELECT_SPIN = 1.2;
const DRAG_THRESHOLD = 5;
const BLOOM_THRESHOLD = 3;
const LIGHT_RADIUS = 8;
const LIGHT_HEIGHT = 9;
const LIGHT_START_ANGLE = Math.atan2(4, 6);

const ORBIT_DEFAULTS = { enabled: true, enablePan: true, enableDamping: true, dampingFactor: 0.05, rotateSpeed: 1, zoomSpeed: 1 };
const ORBIT_LIMITS = { minDistance: 3, maxDistance: 25, minZoom: 0.5, maxZoom: 3, maxPolarAngle: Math.PI / 2 - 0.05 };

const defaults = {
  cameraMode: "perspective",
  fov: DEFAULT_FOV,
  panorama: "studio",
  showBackground: true,
  useEnvironment: true,
  bloom: true,
  emissive: 5,
  bloomStrength: 0.55,
  bloomRadius: 0.3,
  roughness: 0.4,
  metalness: 0.5,
  orbitSpeed: 1,
  solarPaused: false,
  orbit: { ...ORBIT_DEFAULTS },
};

try {
  // ---------- Renderer, scene, camera ----------
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.8;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  // Composer memanggil renderer beberapa kali per frame; info direset manual agar menghitung semua pass.
  renderer.info.autoReset = false;

  const scene = new THREE.Scene();
  scene.background = BACKGROUND_COLOR.clone();

  const perspCamera = new THREE.PerspectiveCamera(DEFAULT_FOV, 16 / 10, 0.1, 200);
  const orthoCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 200);
  perspCamera.position.copy(DEFAULT_CAMERA_POSITION);
  orthoCamera.position.copy(DEFAULT_CAMERA_POSITION);
  let activeCamera = perspCamera;
  let controls = null;

  const state = structuredClone(defaults);

  // ---------- Postprocessing: RenderPass -> UnrealBloomPass -> OutputPass ----------
  const composer = new EffectComposer(renderer);
  const renderPass = new RenderPass(scene, activeCamera);
  const bloomPass = new UnrealBloomPass(new THREE.Vector2(900, 560), state.bloomStrength, state.bloomRadius, BLOOM_THRESHOLD);
  const outputPass = new OutputPass();
  composer.addPass(renderPass);
  composer.addPass(bloomPass);
  composer.addPass(outputPass);

  // ---------- Lights ----------
  const hemiLight = new THREE.HemisphereLight(0xcfe8ff, 0x2a2018, 0.35);
  scene.add(hemiLight);

  const dirLight = new THREE.DirectionalLight(0xffffff, 2.2);
  dirLight.castShadow = true;
  dirLight.shadow.mapSize.set(2048, 2048);
  Object.assign(dirLight.shadow.camera, { left: -10, right: 10, top: 10, bottom: -10, near: 0.5, far: 40 });
  dirLight.shadow.bias = -0.0004;
  dirLight.shadow.normalBias = 0.02;
  scene.add(dirLight, dirLight.target);

  let lightAngle = LIGHT_START_ANGLE;
  function placeDirectionalLight() {
    dirLight.position.set(Math.cos(lightAngle) * LIGHT_RADIUS, LIGHT_HEIGHT, Math.sin(lightAngle) * LIGHT_RADIUS);
  }
  placeDirectionalLight();

  // ---------- Ground ----------
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(30, 30),
    new THREE.MeshStandardMaterial({ color: 0x1f2533, roughness: 0.85, metalness: 0 }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  ground.name = "Ground";
  scene.add(ground);
  const grid = new THREE.GridHelper(30, 30, 0x3a4560, 0x2c3448);
  grid.position.y = 0.002;
  scene.add(grid);

  // ---------- Interactive registry ----------
  const interactiveObjects = [];
  function makeInteractive(object, name, { emissiveLocked = false } = {}) {
    object.name = name;
    object.userData.interactive = true;
    object.userData.emissiveLocked = emissiveLocked;
    object.userData.baseScale = object.scale.clone();
    object.userData.baseRotation = object.rotation.clone();
    interactiveObjects.push(object);
  }

  // ---------- Hierarchy: hierarchyGroup > parentMesh (kaca) > childMesh (sphere kuning) ----------
  const hierarchyGroup = new THREE.Group();
  hierarchyGroup.name = "hierarchyGroup";
  hierarchyGroup.position.set(-3.4, 0, 1.4);
  scene.add(hierarchyGroup);

  const parentMesh = new THREE.Mesh(
    new THREE.BoxGeometry(1.4, 1.4, 1.4),
    new THREE.MeshPhysicalMaterial({ color: 0xffffff, transmission: 0.95, thickness: 1.4, ior: 1.45, roughness: 0.08, metalness: 0, opacity: 1 }),
  );
  parentMesh.position.y = 1;
  // Shadow map biasa tidak memodelkan transmisi kaca, jadi kubus tidak menjadi caster.
  parentMesh.castShadow = false;
  hierarchyGroup.add(parentMesh);
  makeInteractive(parentMesh, "parentMesh (Glass Cube)");

  const glowMaterialOptions = { color: 0xffd34d, emissive: 0xffc21a, emissiveIntensity: state.emissive, roughness: 0.4 };
  const childMesh = new THREE.Mesh(new THREE.SphereGeometry(0.28, 32, 24), new THREE.MeshStandardMaterial(glowMaterialOptions));
  childMesh.position.set(1, 0.9, 0);
  childMesh.castShadow = true;
  childMesh.add(new THREE.PointLight(0xffc857, 3, 6, 2));
  parentMesh.add(childMesh);
  makeInteractive(childMesh, "childMesh (Yellow Sphere)", { emissiveLocked: true });

  // ---------- Challenge D: Solar System > Earth Orbit > Earth > Moon Orbit > Moon ----------
  const solarSystem = new THREE.Group();
  solarSystem.name = "Solar System";
  solarSystem.position.set(-0.8, 0, -4.2);
  scene.add(solarSystem);

  const SUN_HEIGHT = 2.2;
  const sun = new THREE.Mesh(new THREE.SphereGeometry(0.7, 48, 32), new THREE.MeshStandardMaterial(glowMaterialOptions));
  sun.position.y = SUN_HEIGHT;
  sun.add(new THREE.PointLight(0xffd08a, 12, 12, 2));
  solarSystem.add(sun);
  makeInteractive(sun, "Sun", { emissiveLocked: true });

  const earthOrbit = new THREE.Group();
  earthOrbit.name = "Earth Orbit";
  earthOrbit.position.y = SUN_HEIGHT;
  solarSystem.add(earthOrbit);

  const earth = new THREE.Mesh(new THREE.SphereGeometry(0.3, 32, 24), new THREE.MeshStandardMaterial({ color: 0x3b82f6, roughness: 0.6 }));
  earth.position.x = 2.3;
  earth.castShadow = true;
  earthOrbit.add(earth);
  makeInteractive(earth, "Earth");

  const moonOrbit = new THREE.Group();
  moonOrbit.name = "Moon Orbit";
  earth.add(moonOrbit);

  const moon = new THREE.Mesh(new THREE.SphereGeometry(0.1, 24, 16), new THREE.MeshStandardMaterial({ color: 0xc8ccd4, roughness: 0.9 }));
  moon.position.x = 0.6;
  moon.castShadow = true;
  moonOrbit.add(moon);
  makeInteractive(moon, "Moon");

  // ---------- Silver sphere ----------
  const silver = new THREE.Mesh(
    new THREE.SphereGeometry(1.1, 64, 48),
    new THREE.MeshStandardMaterial({ color: 0xd9dde3, metalness: 1, roughness: 0.08 }),
  );
  silver.position.set(3.4, 1.1, 2.4);
  silver.castShadow = true;
  silver.receiveShadow = true;
  scene.add(silver);
  makeInteractive(silver, "Silver Sphere");

  // ---------- Challenge E: PBR gallery (3 roughness × 3 metalness) + slider sphere ----------
  const galleryGroup = new THREE.Group();
  galleryGroup.name = "PBR Gallery";
  scene.add(galleryGroup);
  const galleryGeometry = new THREE.SphereGeometry(0.32, 48, 32);
  const LEVELS = [0.1, 0.5, 0.9];
  LEVELS.forEach((roughness, i) => {
    [0, 0.5, 1].forEach((metalness, j) => {
      const mesh = new THREE.Mesh(galleryGeometry, new THREE.MeshStandardMaterial({ color: 0xe0b25c, roughness, metalness }));
      mesh.position.set(2.6 + i * 1.0, 0.32, -1.2 - j * 1.0);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      galleryGroup.add(mesh);
      makeInteractive(mesh, `Gallery R${roughness} · M${metalness}`);
    });
  });
  const sliderSphere = new THREE.Mesh(
    new THREE.SphereGeometry(0.5, 64, 48),
    new THREE.MeshStandardMaterial({ color: 0xe0b25c, roughness: state.roughness, metalness: state.metalness }),
  );
  sliderSphere.position.set(6.1, 0.5, -2.2);
  sliderSphere.castShadow = true;
  sliderSphere.receiveShadow = true;
  galleryGroup.add(sliderSphere);
  makeInteractive(sliderSphere, "Slider Sphere");

  // ---------- GLB: duckRoot (penempatan) > animRoot (target clip) > gltf.scene ----------
  const duckRoot = new THREE.Group();
  duckRoot.position.set(0, 0, 1.6);
  scene.add(duckRoot);
  makeInteractive(duckRoot, "Duck");
  const animRoot = new THREE.Group();
  animRoot.name = "Duck animation root";
  duckRoot.add(animRoot);

  const glb = { status: "Memuat…", clipCount: null, fallbackClips: false };
  let mixer = null;
  let actions = [];
  let activeActionIndex = -1;

  function fitModel(model, height) {
    const box = new THREE.Box3().setFromObject(model);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    const scale = height / Math.max(size.y, 1e-6);
    model.scale.multiplyScalar(scale);
    model.position.set(-center.x * scale, -box.min.y * scale, -center.z * scale);
  }

  // Tiga clip demonstrasi pada root model bila GLB tidak membawa animasi.
  function createFallbackClips() {
    const q = (y, z = 0) => new THREE.Quaternion().setFromEuler(new THREE.Euler(0, y, z)).toArray();
    const track = (name, times, values) => new THREE.VectorKeyframeTrack(name, times, values);
    const quat = (times, list) => new THREE.QuaternionKeyframeTrack(".quaternion", times, list.flat());
    return [
      new THREE.AnimationClip("Idle", 2, [
        track(".position", [0, 1, 2], [0, 0, 0, 0, 0.06, 0, 0, 0, 0]),
        track(".scale", [0, 1, 2], [1, 1, 1, 1.03, 0.97, 1.03, 1, 1, 1]),
        quat([0, 2], [q(0), q(0)]),
      ]),
      new THREE.AnimationClip("Walk", 1.2, [
        track(".position", [0, 0.3, 0.6, 0.9, 1.2], [0, 0, 0, 0, 0.12, 0, 0, 0, 0, 0, 0.12, 0, 0, 0, 0]),
        track(".scale", [0, 1.2], [1, 1, 1, 1, 1, 1]),
        quat([0, 0.3, 0.6, 0.9, 1.2], [q(0, 0), q(0, 0.14), q(0, 0), q(0, -0.14), q(0, 0)]),
      ]),
      new THREE.AnimationClip("Run", 1.6, [
        track(".position", [0, 0.4, 0.8, 1.2, 1.6], [0, 0, 0, 0, 0.35, 0, 0, 0, 0, 0, 0.35, 0, 0, 0, 0]),
        track(".scale", [0, 0.4, 0.8, 1.2, 1.6], [1, 1, 1, 0.95, 1.08, 0.95, 1, 1, 1, 0.95, 1.08, 0.95, 1, 1, 1]),
        quat([0, 0.4, 0.8, 1.2, 1.6], [q(0), q(Math.PI / 2), q(Math.PI), q(Math.PI * 1.5), q(Math.PI * 2)]),
      ]),
    ];
  }

  function setupAnimations(clips) {
    mixer = new THREE.AnimationMixer(animRoot);
    actions = clips.slice(0, 3).map((clip) => mixer.clipAction(clip));
    activeActionIndex = -1;
    playClip(0);
  }

  function playClip(index) {
    const next = actions[index];
    if (!next) return;
    const previous = actions[activeActionIndex];
    if (next === previous) {
      next.reset().play();
    } else {
      next.reset().setEffectiveWeight(1).fadeIn(0.35).play();
      if (previous) previous.fadeOut(0.35);
    }
    activeActionIndex = index;
    syncUi();
  }

  function useModel(model, statusText) {
    fitModel(model, 1.5);
    model.traverse((object) => {
      if (object.isMesh) {
        object.castShadow = true;
        object.receiveShadow = true;
      }
    });
    animRoot.add(model);
    glb.status = statusText;
  }

  new GLTFLoader().loadAsync(MODEL_URL).then((gltf) => {
    let meshCount = 0;
    gltf.scene.traverse((object) => { if (object.isMesh) meshCount += 1; });
    useModel(gltf.scene, `Loaded · ${meshCount} mesh`);
    glb.clipCount = gltf.animations.length;
    glb.fallbackClips = gltf.animations.length === 0;
    setupAnimations(glb.fallbackClips ? createFallbackClips() : gltf.animations);
  }).catch((error) => {
    console.warn("GLB gagal dimuat, memakai placeholder:", error);
    const placeholder = new THREE.Mesh(new THREE.CapsuleGeometry(0.45, 0.6, 8, 24), new THREE.MeshStandardMaterial({ color: 0xf6bd60, roughness: 0.5 }));
    useModel(placeholder, "Gagal · placeholder");
    glb.clipCount = 0;
    glb.fallbackClips = true;
    setupAnimations(createFallbackClips());
  });

  // ---------- Panorama & environment ----------
  const pmrem = new THREE.PMREMGenerator(renderer);
  const hdrLoader = new HDRLoader();
  const panoramaCache = new Map();
  let activePanorama = null;
  let activeEntry = null;
  let panoramaRequest = 0;
  let panoramaStatus = "Menyiapkan panorama…";

  function buildProceduralPanorama() {
    const panorama = document.createElement("canvas");
    panorama.width = 1024;
    panorama.height = 512;
    const ctx = panorama.getContext("2d");
    const gradient = ctx.createLinearGradient(0, 0, 0, 512);
    gradient.addColorStop(0, "#14284a");
    gradient.addColorStop(0.47, "#8fb8de");
    gradient.addColorStop(0.53, "#4a4238");
    gradient.addColorStop(1, "#15120f");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 1024, 512);
    ctx.fillStyle = "#ffffff";
    [[110, 110, 150, 80], [470, 70, 200, 60], [820, 130, 110, 110]].forEach(([x, y, w, h]) => ctx.fillRect(x, y, w, h));
    const texture = new THREE.CanvasTexture(panorama);
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
  }

  function preparePanorama(texture) {
    texture.mapping = THREE.EquirectangularReflectionMapping;
    return { background: texture, environment: pmrem.fromEquirectangular(texture).texture };
  }

  function loadPanorama(key) {
    if (!panoramaCache.has(key)) {
      const { url } = PANORAMAS[key];
      const promise = url
        ? hdrLoader.loadAsync(url).then(preparePanorama)
        : Promise.resolve().then(() => preparePanorama(buildProceduralPanorama()));
      panoramaCache.set(key, promise);
      promise.catch(() => panoramaCache.delete(key));
    }
    return panoramaCache.get(key);
  }

  function applyEnvironment() {
    scene.background = state.showBackground && activeEntry ? activeEntry.background : BACKGROUND_COLOR;
    scene.environment = state.useEnvironment && activeEntry ? activeEntry.environment : null;
  }

  // Panorama lama tetap dipakai selama pemuatan; hanya permintaan terakhir yang diterapkan.
  async function selectPanorama(key) {
    const request = ++panoramaRequest;
    state.panorama = key;
    panoramaStatus = `Memuat ${PANORAMAS[key].label}…`;
    syncUi();
    try {
      const entry = await loadPanorama(key);
      if (request !== panoramaRequest) return;
      activePanorama = key;
      activeEntry = entry;
      panoramaStatus = `${PANORAMAS[key].label} aktif`;
      applyEnvironment();
      syncUi();
    } catch (error) {
      if (request !== panoramaRequest) return;
      console.warn("Panorama gagal dimuat:", error);
      const failed = PANORAMAS[key].label;
      if (activePanorama) {
        state.panorama = activePanorama;
        panoramaStatus = `${failed} gagal dimuat · tetap ${PANORAMAS[activePanorama].label}`;
        syncUi();
      } else {
        await selectPanorama("procedural");
        panoramaStatus = `${failed} gagal dimuat · fallback procedural`;
        syncUi();
      }
    }
  }

  // ---------- Responsive sizing ----------
  function updateOrthoFrustum(aspect) {
    Object.assign(orthoCamera, { left: -ORTHO_HALF_HEIGHT * aspect, right: ORTHO_HALF_HEIGHT * aspect, top: ORTHO_HALF_HEIGHT, bottom: -ORTHO_HALF_HEIGHT });
    orthoCamera.updateProjectionMatrix();
  }

  function resize() {
    const width = Math.max(1, canvas.clientWidth);
    const height = Math.max(1, canvas.clientHeight);
    const pixelRatio = Math.min(window.devicePixelRatio, 2);
    renderer.setPixelRatio(pixelRatio);
    renderer.setSize(width, height, false);
    composer.setPixelRatio(pixelRatio);
    composer.setSize(width, height);
    perspCamera.aspect = width / height;
    perspCamera.updateProjectionMatrix();
    updateOrthoFrustum(width / height);
  }
  new ResizeObserver(resize).observe(canvas);
  window.addEventListener("resize", resize);
  resize();

  // ---------- OrbitControls & kamera ----------
  function applyOrbitSettings() {
    if (controls) Object.assign(controls, ORBIT_LIMITS, state.orbit);
  }

  function rebuildControls(target) {
    if (controls) controls.dispose();
    controls = new OrbitControls(activeCamera, renderer.domElement);
    controls.target.copy(target);
    applyOrbitSettings();
    controls.update();
  }

  function setCameraMode(mode) {
    const next = mode === "orthographic" ? orthoCamera : perspCamera;
    const target = controls ? controls.target.clone() : DEFAULT_TARGET.clone();
    if (next !== activeCamera) {
      next.position.copy(activeCamera.position);
      next.quaternion.copy(activeCamera.quaternion);
      activeCamera = next;
    }
    state.cameraMode = mode;
    renderPass.camera = activeCamera;
    rebuildControls(target);
    syncUi();
  }

  // ---------- Hover & selection ----------
  let hovered = null;
  let selected = null;

  // Material milik objek, tanpa masuk ke child yang juga interaktif (mis. sphere kuning di dalam kubus).
  function ownMaterials(root) {
    const list = [];
    (function visit(object) {
      if (object.isMesh) [].concat(object.material).forEach((material) => { if (!list.includes(material)) list.push(material); });
      object.children.forEach((child) => { if (!child.userData.interactive) visit(child); });
    })(root);
    return list;
  }

  // Challenge F: emissive asli disimpan di userData sehingga highlight tidak destruktif.
  function setHoverHighlight(object, on) {
    if (!object || object.userData.emissiveLocked) return;
    for (const material of ownMaterials(object)) {
      if (!material.emissive) continue;
      if (on && !material.userData.originalEmissive) {
        material.userData.originalEmissive = material.emissive.clone();
        material.userData.originalEmissiveIntensity = material.emissiveIntensity;
        material.emissive.copy(HOVER_EMISSIVE);
        material.emissiveIntensity = HOVER_EMISSIVE_INTENSITY;
      } else if (!on && material.userData.originalEmissive) {
        material.emissive.copy(material.userData.originalEmissive);
        material.emissiveIntensity = material.userData.originalEmissiveIntensity;
        delete material.userData.originalEmissive;
        delete material.userData.originalEmissiveIntensity;
      }
    }
  }

  function applyInteractionScale(object) {
    if (!object) return;
    const factor = object === selected ? SELECT_SCALE : object === hovered ? HOVER_SCALE : 1;
    object.scale.copy(object.userData.baseScale).multiplyScalar(factor);
  }

  function setHovered(object) {
    if (object === hovered) return;
    const previous = hovered;
    setHoverHighlight(previous, false);
    hovered = object;
    setHoverHighlight(hovered, true);
    applyInteractionScale(previous);
    applyInteractionScale(hovered);
    canvas.style.cursor = hovered ? "pointer" : "";
  }

  function setSelected(object) {
    const previous = selected;
    selected = object;
    applyInteractionScale(previous);
    applyInteractionScale(selected);
  }

  // ---------- Raycasting ----------
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  let pointerInside = false;
  let gesture = null;
  let ignoreNextClick = false;

  function updatePointer(event) {
    const rect = canvas.getBoundingClientRect();
    pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  }

  function objectRoot(object) {
    for (let current = object; current; current = current.parent) {
      if (current.userData.interactive) return current;
    }
    return null;
  }

  function pick() {
    raycaster.setFromCamera(pointer, activeCamera);
    for (const hit of raycaster.intersectObjects(interactiveObjects, true)) {
      const root = objectRoot(hit.object);
      if (root) return root;
    }
    return null;
  }

  canvas.addEventListener("pointerdown", (event) => {
    updatePointer(event);
    gesture = { id: event.pointerId, x: event.clientX, y: event.clientY, dragged: false };
    ignoreNextClick = false;
    setHovered(null);
  });
  canvas.addEventListener("pointermove", (event) => {
    updatePointer(event);
    pointerInside = true;
    if (gesture && event.pointerId === gesture.id && Math.hypot(event.clientX - gesture.x, event.clientY - gesture.y) > DRAG_THRESHOLD) {
      gesture.dragged = true;
    }
  });
  canvas.addEventListener("pointerup", (event) => {
    if (!gesture || event.pointerId !== gesture.id) return;
    ignoreNextClick = gesture.dragged;
    gesture = null;
  });
  canvas.addEventListener("pointercancel", () => {
    gesture = null;
    ignoreNextClick = false;
  });
  canvas.addEventListener("pointerleave", () => {
    pointerInside = false;
    setHovered(null);
  });
  canvas.addEventListener("click", (event) => {
    if (ignoreNextClick) {
      ignoreNextClick = false;
      return;
    }
    if (event.button !== 0) return;
    updatePointer(event);
    const object = pick();
    setSelected(object);
    // Challenge B: klik pada model menjalankan clip berikutnya.
    if (object === duckRoot && actions.length) playClip((activeActionIndex + 1) % actions.length);
  });

  // ---------- UI ----------
  const $ = (id) => document.getElementById(id);
  const ui = {
    cameraMode: $("p7-camera-mode"), fov: $("p7-fov"), fovValue: $("p7-fov-value"),
    panorama: $("p7-panorama"), panoramaStatus: $("p7-panorama-status"),
    background: $("p7-background"), environment: $("p7-environment"), bloom: $("p7-bloom"),
    emissive: $("p7-emissive"), emissiveValue: $("p7-emissive-value"),
    bloomStrength: $("p7-bloom-strength"), bloomStrengthValue: $("p7-bloom-strength-value"),
    bloomRadius: $("p7-bloom-radius"), bloomRadiusValue: $("p7-bloom-radius-value"),
    roughness: $("p7-roughness"), roughnessValue: $("p7-roughness-value"),
    metalness: $("p7-metalness"), metalnessValue: $("p7-metalness-value"),
    orbitSpeed: $("p7-orbit-speed"), orbitSpeedValue: $("p7-orbit-speed-value"),
    clips: [0, 1, 2].map((index) => $(`p7-clip-${index}`)),
    solar: $("p7-solar"),
    orbitEnabled: $("p7-orbit-enabled"), orbitPan: $("p7-orbit-pan"), orbitDamping: $("p7-orbit-damping"),
    dampingFactor: $("p7-damping-factor"), dampingFactorValue: $("p7-damping-factor-value"),
    rotateSpeed: $("p7-rotate-speed"), rotateSpeedValue: $("p7-rotate-speed-value"),
    zoomSpeed: $("p7-zoom-speed"), zoomSpeedValue: $("p7-zoom-speed-value"),
    reset: $("p7-reset"),
    hud: Object.fromEntries(["camera", "lens", "glb", "clips", "clip", "solar", "panorama", "env", "hover", "selected", "calls", "tris", "geo", "fps"].map((key) => [key, $(`p7-hud-${key}`)])),
    info: Object.fromEntries(["state", "name", "type", "material", "local", "world", "rotation", "scale", "parent"].map((key) => [key, $(`p7-info-${key}`)])),
  };

  function syncUi() {
    ui.cameraMode.value = state.cameraMode;
    ui.fov.value = String(state.fov);
    ui.fov.disabled = state.cameraMode !== "perspective";
    ui.fovValue.textContent = `${state.fov}°`;
    ui.panorama.value = state.panorama;
    ui.panoramaStatus.textContent = panoramaStatus;
    ui.background.checked = state.showBackground;
    ui.environment.checked = state.useEnvironment;
    ui.bloom.checked = state.bloom;
    ui.emissive.value = String(state.emissive);
    ui.emissiveValue.textContent = state.emissive.toFixed(1);
    ui.bloomStrength.value = String(state.bloomStrength);
    ui.bloomStrengthValue.textContent = state.bloomStrength.toFixed(2);
    ui.bloomRadius.value = String(state.bloomRadius);
    ui.bloomRadiusValue.textContent = state.bloomRadius.toFixed(2);
    ui.roughness.value = String(state.roughness);
    ui.roughnessValue.textContent = state.roughness.toFixed(2);
    ui.metalness.value = String(state.metalness);
    ui.metalnessValue.textContent = state.metalness.toFixed(2);
    ui.orbitSpeed.value = String(state.orbitSpeed);
    ui.orbitSpeedValue.textContent = state.orbitSpeed.toFixed(2);
    ui.clips.forEach((button, index) => {
      const action = actions[index];
      button.disabled = !action;
      button.textContent = action ? `${index + 1} · ${action.getClip().name}` : String(index + 1);
      button.classList.toggle("active", index === activeActionIndex);
    });
    ui.solar.textContent = state.solarPaused ? "Resume Solar (S)" : "Pause Solar (S)";
    ui.solar.classList.toggle("active", state.solarPaused);
    ui.orbitEnabled.checked = state.orbit.enabled;
    ui.orbitPan.checked = state.orbit.enablePan;
    ui.orbitDamping.checked = state.orbit.enableDamping;
    ui.dampingFactor.value = String(state.orbit.dampingFactor);
    ui.dampingFactor.disabled = !state.orbit.enableDamping;
    ui.dampingFactorValue.textContent = state.orbit.dampingFactor.toFixed(2);
    ui.rotateSpeed.value = String(state.orbit.rotateSpeed);
    ui.rotateSpeedValue.textContent = state.orbit.rotateSpeed.toFixed(2);
    ui.zoomSpeed.value = String(state.orbit.zoomSpeed);
    ui.zoomSpeedValue.textContent = state.orbit.zoomSpeed.toFixed(2);
  }

  function setEmissive(value) {
    state.emissive = value;
    sun.material.emissiveIntensity = value;
    childMesh.material.emissiveIntensity = value;
  }

  function setBloom({ enabled = state.bloom, strength = state.bloomStrength, radius = state.bloomRadius } = {}) {
    Object.assign(state, { bloom: enabled, bloomStrength: strength, bloomRadius: radius });
    bloomPass.enabled = enabled;
    bloomPass.strength = strength;
    bloomPass.radius = radius;
  }

  function setSliderMaterial(roughness = state.roughness, metalness = state.metalness) {
    Object.assign(state, { roughness, metalness });
    sliderSphere.material.roughness = roughness;
    sliderSphere.material.metalness = metalness;
  }

  function toggleBackground() { state.showBackground = !state.showBackground; applyEnvironment(); syncUi(); }
  function toggleEnvironment() { state.useEnvironment = !state.useEnvironment; applyEnvironment(); syncUi(); }
  function toggleSolar() { state.solarPaused = !state.solarPaused; syncUi(); }

  function resetScene() {
    Object.assign(state, structuredClone(defaults));

    setHovered(null);
    setSelected(null);
    for (const object of interactiveObjects) {
      object.scale.copy(object.userData.baseScale);
      object.rotation.copy(object.userData.baseRotation);
    }
    earthOrbit.rotation.set(0, 0, 0);
    moonOrbit.rotation.set(0, 0, 0);
    lightAngle = LIGHT_START_ANGLE;
    placeDirectionalLight();

    setEmissive(state.emissive);
    setBloom();
    setSliderMaterial();

    perspCamera.position.copy(DEFAULT_CAMERA_POSITION);
    perspCamera.fov = DEFAULT_FOV;
    perspCamera.zoom = 1;
    perspCamera.updateProjectionMatrix();
    orthoCamera.zoom = 1;
    orthoCamera.updateProjectionMatrix();
    activeCamera = perspCamera;
    renderPass.camera = activeCamera;
    rebuildControls(DEFAULT_TARGET);

    if (activePanorama === "studio") {
      panoramaRequest += 1;
      panoramaStatus = `${PANORAMAS.studio.label} aktif`;
      applyEnvironment();
      syncUi();
    } else {
      selectPanorama("studio");
    }
  }

  ui.cameraMode.addEventListener("change", () => setCameraMode(ui.cameraMode.value));
  ui.fov.addEventListener("input", () => {
    state.fov = Number(ui.fov.value);
    perspCamera.fov = state.fov;
    perspCamera.updateProjectionMatrix();
    syncUi();
  });
  ui.panorama.addEventListener("change", () => selectPanorama(ui.panorama.value));
  ui.background.addEventListener("change", toggleBackground);
  ui.environment.addEventListener("change", toggleEnvironment);
  ui.bloom.addEventListener("change", () => { setBloom({ enabled: ui.bloom.checked }); syncUi(); });
  ui.emissive.addEventListener("input", () => { setEmissive(Number(ui.emissive.value)); syncUi(); });
  ui.bloomStrength.addEventListener("input", () => { setBloom({ strength: Number(ui.bloomStrength.value) }); syncUi(); });
  ui.bloomRadius.addEventListener("input", () => { setBloom({ radius: Number(ui.bloomRadius.value) }); syncUi(); });
  ui.roughness.addEventListener("input", () => { setSliderMaterial(Number(ui.roughness.value)); syncUi(); });
  ui.metalness.addEventListener("input", () => { setSliderMaterial(undefined, Number(ui.metalness.value)); syncUi(); });
  ui.orbitSpeed.addEventListener("input", () => { state.orbitSpeed = Number(ui.orbitSpeed.value); syncUi(); });
  ui.clips.forEach((button, index) => button.addEventListener("click", () => playClip(index)));
  ui.solar.addEventListener("click", toggleSolar);
  ui.reset.addEventListener("click", resetScene);

  [
    [ui.orbitEnabled, "enabled", "checked"],
    [ui.orbitPan, "enablePan", "checked"],
    [ui.orbitDamping, "enableDamping", "checked"],
    [ui.dampingFactor, "dampingFactor", "value"],
    [ui.rotateSpeed, "rotateSpeed", "value"],
    [ui.zoomSpeed, "zoomSpeed", "value"],
  ].forEach(([input, key, prop]) => {
    input.addEventListener(prop === "checked" ? "change" : "input", () => {
      state.orbit[key] = prop === "checked" ? input.checked : Number(input.value);
      applyOrbitSettings();
      syncUi();
    });
  });

  // ---------- Keyboard (event-based) ----------
  function isTypingTarget(target) {
    return target instanceof HTMLElement && (target.isContentEditable || ["INPUT", "SELECT", "TEXTAREA", "BUTTON"].includes(target.tagName));
  }

  window.addEventListener("keydown", (event) => {
    if (event.repeat || isTypingTarget(event.target) || event.ctrlKey || event.metaKey || event.altKey) return;
    const key = event.key.toLowerCase();
    if (["1", "2", "3"].includes(key)) playClip(Number(key) - 1);
    if (key === "s") toggleSolar();
    if (key === "e") toggleEnvironment();
    if (key === "p") toggleBackground();
    if (key === "r") resetScene();
    if (key === "c") setCameraMode(state.cameraMode === "perspective" ? "orthographic" : "perspective");
  });

  // ---------- HUD & information panel ----------
  const tmpWorld = new THREE.Vector3();
  const fmt = (vector) => `(${vector.x.toFixed(2)}, ${vector.y.toFixed(2)}, ${vector.z.toFixed(2)})`;
  const deg = (radians) => THREE.MathUtils.euclideanModulo(THREE.MathUtils.radToDeg(radians), 360).toFixed(0);

  function describeMaterials(object) {
    const materials = ownMaterials(object);
    if (!materials.length) return "— (Group tanpa mesh)";
    const types = [...new Set(materials.map((material) => material.type))].join(", ");
    const pbr = materials.find((material) => "roughness" in material);
    return pbr ? `${types} · R ${pbr.roughness.toFixed(2)} · M ${pbr.metalness.toFixed(2)}` : types;
  }

  function updateInfoPanel() {
    const { info } = ui;
    if (!selected) {
      info.state.textContent = "Klik objek untuk memilih";
      ["name", "type", "material", "local", "world", "rotation", "scale", "parent"].forEach((key) => { info[key].textContent = "—"; });
      return;
    }
    selected.getWorldPosition(tmpWorld);
    info.state.textContent = "Selected · rotasi berbasis delta time";
    info.name.textContent = selected.name;
    info.type.textContent = selected.type;
    info.material.textContent = describeMaterials(selected);
    info.local.textContent = fmt(selected.position);
    info.world.textContent = fmt(tmpWorld);
    info.rotation.textContent = `(${deg(selected.rotation.x)}°, ${deg(selected.rotation.y)}°, ${deg(selected.rotation.z)}°)`;
    info.scale.textContent = fmt(selected.scale);
    info.parent.textContent = selected.parent ? (selected.parent.name || selected.parent.type) : "—";
  }

  let frames = 0;
  let fps = 0;
  let fpsTime = performance.now();
  let hudTime = 0;

  function updateHud() {
    const { hud } = ui;
    const isPersp = state.cameraMode === "perspective";
    hud.camera.textContent = isPersp ? "Perspective" : "Orthographic";
    hud.lens.textContent = isPersp ? `${perspCamera.fov.toFixed(0)}° · ${perspCamera.zoom.toFixed(2)}` : `— · ${orthoCamera.zoom.toFixed(2)}`;
    hud.glb.textContent = glb.status;
    hud.clips.textContent = glb.clipCount === null ? "—" : glb.fallbackClips ? `${glb.clipCount} · fallback ${actions.length}` : String(glb.clipCount);
    hud.clip.textContent = actions[activeActionIndex] ? actions[activeActionIndex].getClip().name : "—";
    hud.solar.textContent = state.solarPaused ? "Paused" : "Running";
    hud.panorama.textContent = activePanorama ? PANORAMAS[activePanorama].label : "—";
    hud.env.textContent = `${state.useEnvironment ? "ON" : "OFF"} · ${state.bloom ? "ON" : "OFF"}`;
    hud.hover.textContent = hovered ? hovered.name : "—";
    hud.selected.textContent = selected ? selected.name : "—";
    hud.calls.textContent = String(renderer.info.render.calls);
    hud.tris.textContent = renderer.info.render.triangles.toLocaleString("id-ID");
    hud.geo.textContent = String(renderer.info.memory.geometries);
    hud.fps.textContent = String(fps);
  }

  // ---------- Animation loop ----------
  const clock = new THREE.Clock();

  function animate() {
    const delta = Math.min(clock.getDelta(), 0.05);
    renderer.info.reset();

    if (!state.solarPaused) {
      const step = state.orbitSpeed * delta;
      parentMesh.rotation.y += 0.6 * step;
      sun.rotation.y += 0.2 * step;
      earthOrbit.rotation.y += 0.5 * step;
      earth.rotation.y += 1.5 * step;
      moonOrbit.rotation.y += 2.0 * step;
    }
    lightAngle += 0.12 * state.orbitSpeed * delta;
    placeDirectionalLight();

    // Challenge G: objek terpilih terus berputar berbasis delta time.
    if (selected) selected.rotation.y += SELECT_SPIN * delta;
    if (mixer) mixer.update(delta);

    // Hover ditangguhkan selama pointer ditekan (orbit/pan atau calon klik).
    if (pointerInside && !gesture) setHovered(pick());

    controls.update();
    composer.render(delta);

    frames += 1;
    const now = performance.now();
    if (now - fpsTime >= 500) {
      fps = Math.round(frames * 1000 / (now - fpsTime));
      frames = 0;
      fpsTime = now;
    }
    if (now - hudTime >= 120) {
      hudTime = now;
      updateHud();
      updateInfoPanel();
    }
    requestAnimationFrame(animate);
  }

  rebuildControls(DEFAULT_TARGET);
  syncUi();
  selectPanorama(state.panorama);
  window.__p7Ready = true;
  status.textContent = `Running · Three.js r${THREE.REVISION}`;
  status.classList.add("p6-status");
  requestAnimationFrame(animate);
} catch (error) {
  console.error(error);
  window.__p7Ready = true;
  status.textContent = "Gagal menginisialisasi";
  fallback.hidden = false;
  fallback.textContent = error.message;
}
