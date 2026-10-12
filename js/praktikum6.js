import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

const canvas = document.getElementById("p6-canvas");
const status = document.getElementById("p6-status");
const fallback = document.getElementById("p6-fallback");

const DEFAULT_CAMERA_POSITION = new THREE.Vector3(4.8, 3.6, 6.5);
const DEFAULT_TARGET = new THREE.Vector3(0, 0.8, 0);
const DEFAULT_FOV = 50;
const ORTHO_HALF_HEIGHT = 4.2;
const CUBE_START = new THREE.Vector3(-1.8, 0.5, -0.4);
const GROUND_LIMIT = 6.5;
const LIGHT_RADIUS = 4.3;
const LIGHT_HEIGHT = 4.2;
const LIGHT_START_ANGLE = Math.atan2(-2.5, -3.5);

const SEGMENT_LEVELS = [
  { name: "Low", sphere: [8, 6], knot: [32, 4] },
  { name: "Medium", sphere: [16, 12], knot: [64, 8] },
  { name: "High", sphere: [32, 24], knot: [128, 16] },
  { name: "Ultra", sphere: [64, 48], knot: [256, 32] },
];

const ORBIT_DEFAULTS = { enabled: true, enablePan: true, enableDamping: true, dampingFactor: 0.05, rotateSpeed: 1, zoomSpeed: 1 };

const defaults = {
  cameraMode: "perspective",
  fov: DEFAULT_FOV,
  lightIntensity: 1.5,
  lightOrbit: false,
  helpers: true,
  shadowSize: 1024,
  segment: 2,
  gallery: true,
  animating: true,
  orbit: { ...ORBIT_DEFAULTS },
};

try {
  // ---------- Renderer, scene, camera ----------
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0a0f17);
  scene.fog = new THREE.Fog(0x0a0f17, 14, 30);

  const perspCamera = new THREE.PerspectiveCamera(DEFAULT_FOV, 16 / 10, 0.1, 100);
  const orthoCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 100);
  perspCamera.position.copy(DEFAULT_CAMERA_POSITION);
  orthoCamera.position.copy(DEFAULT_CAMERA_POSITION);
  let activeCamera = perspCamera;
  let controls = null;

  const state = structuredClone(defaults);

  // ---------- Lights ----------
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.35);
  scene.add(ambientLight);

  const dirLight = new THREE.DirectionalLight(0xfff4e0, state.lightIntensity);
  dirLight.castShadow = true;
  dirLight.shadow.camera.left = -8;
  dirLight.shadow.camera.right = 8;
  dirLight.shadow.camera.top = 8;
  dirLight.shadow.camera.bottom = -8;
  dirLight.shadow.camera.near = 0.5;
  dirLight.shadow.camera.far = 25;
  dirLight.shadow.bias = -0.0005;
  dirLight.shadow.normalBias = 0.02;
  dirLight.target.position.set(0, 0, 0);
  scene.add(dirLight, dirLight.target);

  const pointLight = new THREE.PointLight(0x7dd3fc, 9, 0, 2);
  pointLight.position.set(-2.6, 2.2, 1.6);
  scene.add(pointLight);

  // Helpers: garis + kotak kuning (DirectionalLightHelper), panah kuning, penanda cyan PointLight.
  const dirHelper = new THREE.DirectionalLightHelper(dirLight, 0.6, 0xfbbf24);
  const dirArrow = new THREE.ArrowHelper(new THREE.Vector3(0, -1, 0), new THREE.Vector3(), 2.4, 0xfbbf24, 0.4, 0.22);
  const pointHelper = new THREE.PointLightHelper(pointLight, 0.22, 0x5eead4);
  const helpers = new THREE.Group();
  helpers.add(dirHelper, dirArrow, pointHelper);
  scene.add(helpers);

  let lightAngle = LIGHT_START_ANGLE;
  function placeDirectionalLight() {
    dirLight.position.set(Math.cos(lightAngle) * LIGHT_RADIUS, LIGHT_HEIGHT, Math.sin(lightAngle) * LIGHT_RADIUS);
  }
  placeDirectionalLight();

  const arrowDirection = new THREE.Vector3();
  function updateHelpers() {
    dirLight.updateMatrixWorld();
    dirLight.target.updateMatrixWorld();
    dirHelper.update();
    arrowDirection.subVectors(dirLight.target.position, dirLight.position).normalize();
    dirArrow.position.copy(dirLight.position);
    dirArrow.setDirection(arrowDirection);
    pointHelper.update();
  }

  // ---------- Objects ----------
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(16, 16),
    new THREE.MeshStandardMaterial({ color: 0x1b2333, roughness: 0.92, metalness: 0 }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  const grid = new THREE.GridHelper(16, 32, 0x2b3550, 0x1f2737);
  grid.position.y = 0.002;
  scene.add(grid);

  const cube = new THREE.Mesh(
    new THREE.BoxGeometry(1, 1, 1),
    new THREE.MeshStandardMaterial({ color: 0x5eead4, roughness: 0.45, metalness: 0.1 }),
  );
  cube.position.copy(CUBE_START);

  const sphere = new THREE.Mesh(
    new THREE.SphereGeometry(0.8, 32, 24),
    new THREE.MeshPhongMaterial({ color: 0xa78bfa, shininess: 80, specular: 0x444444 }),
  );
  sphere.position.set(0, 0.8, -0.2);

  const cone = new THREE.Mesh(
    new THREE.ConeGeometry(0.6, 1.4, 32),
    new THREE.MeshLambertMaterial({ color: 0xf472b6 }),
  );
  cone.position.set(1.9, 0.7, -0.4);

  const knot = new THREE.Mesh(
    new THREE.TorusKnotGeometry(0.55, 0.18, 128, 16),
    new THREE.MeshStandardMaterial({ color: 0xf6bd60, roughness: 0.3, metalness: 0.35 }),
  );
  knot.position.set(0, 1.3, -2.6);

  for (const mesh of [cube, sphere, cone, knot]) {
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    scene.add(mesh);
  }

  // Material gallery: satu geometry dipakai ulang oleh lima material berbeda.
  function makeLabel(text) {
    const labelCanvas = document.createElement("canvas");
    labelCanvas.width = 256;
    labelCanvas.height = 64;
    const ctx = labelCanvas.getContext("2d");
    ctx.fillStyle = "rgba(10, 12, 18, 0.78)";
    ctx.beginPath();
    ctx.roundRect(4, 8, 248, 48, 12);
    ctx.fill();
    ctx.fillStyle = "#e6e9f0";
    ctx.font = "700 30px Consolas, monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(text, 128, 33);
    const texture = new THREE.CanvasTexture(labelCanvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true, depthWrite: false }));
    sprite.scale.set(1.4, 0.35, 1);
    return sprite;
  }

  const galleryColor = 0xf472b6;
  const galleryEntries = [
    ["Basic", new THREE.MeshBasicMaterial({ color: galleryColor })],
    ["Lambert", new THREE.MeshLambertMaterial({ color: galleryColor })],
    ["Phong", new THREE.MeshPhongMaterial({ color: galleryColor, shininess: 90, specular: 0xffffff })],
    ["Standard", new THREE.MeshStandardMaterial({ color: galleryColor, roughness: 0.35, metalness: 0.2 })],
    ["Normal", new THREE.MeshNormalMaterial()],
  ];
  const gallery = new THREE.Group();
  let galleryGeometry = new THREE.SphereGeometry(0.42, 32, 24);
  const gallerySpheres = galleryEntries.map(([name, material], index) => {
    const x = (index - 2) * 1.55;
    const mesh = new THREE.Mesh(galleryGeometry, material);
    mesh.position.set(x, 0.45, 2.6);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    const label = makeLabel(name);
    label.position.set(x, 1.2, 2.6);
    gallery.add(mesh, label);
    return mesh;
  });
  scene.add(gallery);

  function applySegmentLevel(level) {
    const { sphere: [ws, hs], knot: [tubular, radial] } = SEGMENT_LEVELS[level];
    sphere.geometry.dispose();
    sphere.geometry = new THREE.SphereGeometry(0.8, ws, hs);
    knot.geometry.dispose();
    knot.geometry = new THREE.TorusKnotGeometry(0.55, 0.18, tubular, radial);
    galleryGeometry.dispose();
    galleryGeometry = new THREE.SphereGeometry(0.42, ws, hs);
    gallerySpheres.forEach((mesh) => { mesh.geometry = galleryGeometry; });
  }

  // ---------- Responsive sizing ----------
  function updateOrthoFrustum(aspect) {
    orthoCamera.left = -ORTHO_HALF_HEIGHT * aspect;
    orthoCamera.right = ORTHO_HALF_HEIGHT * aspect;
    orthoCamera.top = ORTHO_HALF_HEIGHT;
    orthoCamera.bottom = -ORTHO_HALF_HEIGHT;
    orthoCamera.updateProjectionMatrix();
  }

  function resize() {
    const width = Math.max(1, canvas.clientWidth);
    const height = Math.max(1, canvas.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(width, height, false);
    perspCamera.aspect = width / height;
    perspCamera.updateProjectionMatrix();
    updateOrthoFrustum(width / height);
  }
  new ResizeObserver(resize).observe(canvas);
  window.addEventListener("resize", resize);
  resize();

  // ---------- OrbitControls ----------
  function applyOrbitSettings() {
    if (!controls) return;
    Object.assign(controls, state.orbit);
  }

  // Kontrol lama di-dispose lalu dibuat ulang untuk kamera aktif; ini juga membuang sisa damping.
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
    rebuildControls(target);
    syncUi();
  }

  // ---------- UI ----------
  const $ = (id) => document.getElementById(id);
  const ui = {
    cameraMode: $("p6-camera-mode"),
    fov: $("p6-fov"), fovValue: $("p6-fov-value"),
    intensity: $("p6-light-intensity"), intensityValue: $("p6-light-intensity-value"),
    lightOrbit: $("p6-light-orbit"),
    helpers: $("p6-light-helpers"),
    shadow: $("p6-shadow-quality"),
    segment: $("p6-segment"), segmentValue: $("p6-segment-value"),
    gallery: $("p6-gallery"),
    animation: $("p6-animation"),
    orbitEnabled: $("p6-orbit-enabled"),
    orbitPan: $("p6-orbit-pan"),
    orbitDamping: $("p6-orbit-damping"),
    dampingFactor: $("p6-damping-factor"), dampingFactorValue: $("p6-damping-factor-value"),
    rotateSpeed: $("p6-rotate-speed"), rotateSpeedValue: $("p6-rotate-speed-value"),
    zoomSpeed: $("p6-zoom-speed"), zoomSpeedValue: $("p6-zoom-speed-value"),
    reset: $("p6-reset"),
    hud: {
      camera: $("p6-hud-camera"), lens: $("p6-hud-lens"), cube: $("p6-hud-cube"), rot: $("p6-hud-rot"),
      light: $("p6-hud-light"), shadow: $("p6-hud-shadow"), segment: $("p6-hud-segment"), anim: $("p6-hud-anim"),
      calls: $("p6-hud-calls"), tris: $("p6-hud-tris"), geo: $("p6-hud-geo"), tex: $("p6-hud-tex"),
      objects: $("p6-hud-objects"), fps: $("p6-hud-fps"),
    },
  };

  function syncUi() {
    ui.cameraMode.value = state.cameraMode;
    ui.fov.value = String(state.fov);
    ui.fov.disabled = state.cameraMode !== "perspective";
    ui.fovValue.textContent = `${state.fov}°`;
    ui.intensity.value = String(state.lightIntensity);
    ui.intensityValue.textContent = state.lightIntensity.toFixed(2);
    ui.lightOrbit.checked = state.lightOrbit;
    ui.helpers.checked = state.helpers;
    ui.shadow.value = String(state.shadowSize);
    ui.segment.value = String(state.segment);
    ui.segmentValue.textContent = SEGMENT_LEVELS[state.segment].name;
    ui.gallery.checked = state.gallery;
    ui.animation.textContent = state.animating ? "Pause Animation (G)" : "Resume Animation (G)";
    ui.animation.classList.toggle("active", !state.animating);
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

  function setShadowSize(size) {
    state.shadowSize = size;
    dirLight.shadow.mapSize.set(size, size);
    // Shadow map lama harus dibuang agar ukuran baru dialokasikan ulang pada render berikutnya.
    if (dirLight.shadow.map) {
      dirLight.shadow.map.dispose();
      dirLight.shadow.map = null;
    }
  }

  function setLightIntensity(value) {
    state.lightIntensity = value;
    dirLight.intensity = value;
  }

  function setHelpers(visible) {
    state.helpers = visible;
    helpers.visible = visible;
  }

  function setGallery(visible) {
    state.gallery = visible;
    gallery.visible = visible;
  }

  function setSegment(level) {
    state.segment = level;
    applySegmentLevel(level);
  }

  function toggleAnimation() {
    state.animating = !state.animating;
    syncUi();
  }

  let animTime = 0;
  function resetScene() {
    const keepShadow = state.shadowSize;
    Object.assign(state, structuredClone(defaults));
    state.shadowSize = keepShadow;

    cube.position.copy(CUBE_START);
    cube.rotation.set(0, 0, 0);
    animTime = 0;
    for (const mesh of [sphere, cone, knot, ...gallerySpheres]) mesh.rotation.set(0, 0, 0);
    knot.position.y = 1.3;

    lightAngle = LIGHT_START_ANGLE;
    placeDirectionalLight();
    setLightIntensity(state.lightIntensity);
    setHelpers(state.helpers);
    setGallery(state.gallery);
    setSegment(state.segment);

    perspCamera.position.copy(DEFAULT_CAMERA_POSITION);
    perspCamera.fov = DEFAULT_FOV;
    perspCamera.zoom = 1;
    perspCamera.updateProjectionMatrix();
    orthoCamera.zoom = 1;
    orthoCamera.updateProjectionMatrix();
    activeCamera = perspCamera;
    rebuildControls(DEFAULT_TARGET);
    syncUi();
  }

  ui.cameraMode.addEventListener("change", () => setCameraMode(ui.cameraMode.value));
  ui.fov.addEventListener("input", () => {
    state.fov = Number(ui.fov.value);
    perspCamera.fov = state.fov;
    perspCamera.updateProjectionMatrix();
    syncUi();
  });
  ui.intensity.addEventListener("input", () => { setLightIntensity(Number(ui.intensity.value)); syncUi(); });
  ui.lightOrbit.addEventListener("change", () => { state.lightOrbit = ui.lightOrbit.checked; });
  ui.helpers.addEventListener("change", () => setHelpers(ui.helpers.checked));
  ui.shadow.addEventListener("change", () => setShadowSize(Number(ui.shadow.value)));
  ui.segment.addEventListener("input", () => { setSegment(Number(ui.segment.value)); syncUi(); });
  ui.gallery.addEventListener("change", () => setGallery(ui.gallery.checked));
  ui.animation.addEventListener("click", toggleAnimation);
  ui.reset.addEventListener("click", resetScene);

  const orbitInputs = [
    [ui.orbitEnabled, "enabled", "checked"],
    [ui.orbitPan, "enablePan", "checked"],
    [ui.orbitDamping, "enableDamping", "checked"],
    [ui.dampingFactor, "dampingFactor", "value"],
    [ui.rotateSpeed, "rotateSpeed", "value"],
    [ui.zoomSpeed, "zoomSpeed", "value"],
  ];
  orbitInputs.forEach(([input, key, prop]) => {
    input.addEventListener(prop === "checked" ? "change" : "input", () => {
      state.orbit[key] = prop === "checked" ? input.checked : Number(input.value);
      applyOrbitSettings();
      syncUi();
    });
  });

  // ---------- Keyboard: state-based (gerak) + event-based (toggle) ----------
  const keys = new Set();
  function isTypingTarget(target) {
    return target instanceof HTMLElement && (target.isContentEditable || ["INPUT", "SELECT", "TEXTAREA", "BUTTON"].includes(target.tagName));
  }

  window.addEventListener("keydown", (event) => {
    if (isTypingTarget(event.target)) return;
    const key = event.key.toLowerCase();
    if (["arrowleft", "arrowright", "arrowup", "arrowdown"].includes(key)) event.preventDefault();
    keys.add(key);
    if (event.repeat) return;
    if (key === "g") toggleAnimation();
    if (key === "r") resetScene();
    if (key === "c") setCameraMode(state.cameraMode === "perspective" ? "orthographic" : "perspective");
    if (key === "l") { state.lightOrbit = !state.lightOrbit; syncUi(); }
    if (key === "h") { setGallery(!state.gallery); syncUi(); }
  });
  window.addEventListener("keyup", (event) => keys.delete(event.key.toLowerCase()));
  window.addEventListener("blur", () => keys.clear());

  function updateInput(delta) {
    const move = 2.6 * delta;
    const turn = 2.2 * delta;
    if (keys.has("arrowleft") || keys.has("a")) cube.position.x -= move;
    if (keys.has("arrowright") || keys.has("d")) cube.position.x += move;
    if (keys.has("arrowup") || keys.has("w")) cube.position.z -= move;
    if (keys.has("arrowdown") || keys.has("s")) cube.position.z += move;
    if (keys.has("q")) cube.rotation.y += turn;
    if (keys.has("e")) cube.rotation.y -= turn;
    cube.position.x = THREE.MathUtils.clamp(cube.position.x, -GROUND_LIMIT, GROUND_LIMIT);
    cube.position.z = THREE.MathUtils.clamp(cube.position.z, -GROUND_LIMIT, GROUND_LIMIT);
  }

  // ---------- HUD ----------
  let frames = 0;
  let fps = 0;
  let fpsTime = performance.now();

  function countObjects() {
    let count = 0;
    scene.traverseVisible((object) => { if (object.isMesh || object.isSprite) count += 1; });
    return count;
  }

  function updateHud() {
    const { render, memory } = renderer.info;
    const isPersp = state.cameraMode === "perspective";
    ui.hud.camera.textContent = isPersp ? "Perspective" : "Orthographic";
    ui.hud.lens.textContent = isPersp ? `${perspCamera.fov.toFixed(0)}° · ${perspCamera.zoom.toFixed(2)}` : `— · ${orthoCamera.zoom.toFixed(2)}`;
    ui.hud.cube.textContent = `(${cube.position.x.toFixed(2)}, ${cube.position.y.toFixed(2)}, ${cube.position.z.toFixed(2)})`;
    ui.hud.rot.textContent = `${THREE.MathUtils.euclideanModulo(THREE.MathUtils.radToDeg(cube.rotation.y), 360).toFixed(0)}°`;
    ui.hud.light.textContent = `${state.lightIntensity.toFixed(2)} · ${state.lightOrbit ? "orbit" : "static"}`;
    ui.hud.shadow.textContent = `${state.shadowSize}²`;
    ui.hud.segment.textContent = SEGMENT_LEVELS[state.segment].name;
    ui.hud.anim.textContent = state.animating ? "Playing" : "Paused";
    ui.hud.calls.textContent = String(render.calls);
    ui.hud.tris.textContent = render.triangles.toLocaleString("id-ID");
    ui.hud.geo.textContent = String(memory.geometries);
    ui.hud.tex.textContent = String(memory.textures);
    ui.hud.objects.textContent = String(countObjects());
    ui.hud.fps.textContent = String(fps);
  }

  // ---------- Animation loop ----------
  const clock = new THREE.Clock();

  function animate() {
    // getDelta selalu dipanggil agar tidak terjadi lompatan waktu setelah pause.
    const delta = Math.min(clock.getDelta(), 0.05);
    updateInput(delta);

    if (state.animating) {
      animTime += delta;
      sphere.rotation.y += 0.4 * delta;
      cone.rotation.y += 0.8 * delta;
      knot.rotation.x += 0.6 * delta;
      knot.rotation.y += 0.9 * delta;
      knot.position.y = 1.3 + Math.sin(animTime * 1.6) * 0.18;
      gallerySpheres.forEach((mesh) => { mesh.rotation.y += 0.7 * delta; });
    }

    if (state.lightOrbit) {
      lightAngle += 0.6 * delta;
      placeDirectionalLight();
    }

    controls.update();
    updateHelpers();
    renderer.render(scene, activeCamera);

    frames += 1;
    const now = performance.now();
    if (now - fpsTime >= 500) {
      fps = Math.round(frames * 1000 / (now - fpsTime));
      frames = 0;
      fpsTime = now;
    }
    updateHud();
    requestAnimationFrame(animate);
  }

  setShadowSize(state.shadowSize);
  rebuildControls(DEFAULT_TARGET);
  syncUi();
  window.__p6Ready = true;
  status.textContent = `Running · Three.js r${THREE.REVISION}`;
  status.classList.add("p6-status");
  requestAnimationFrame(animate);
} catch (error) {
  console.error(error);
  window.__p6Ready = true;
  status.textContent = "Gagal menginisialisasi";
  fallback.hidden = false;
  fallback.textContent = error.message;
}
