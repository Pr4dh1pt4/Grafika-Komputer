import { Mat4 } from "./math3d.js";

const canvas = document.getElementById("canvas-camera");
const gl = canvas.getContext("webgl2");
const fallback = document.getElementById("p4-fallback");
const status = document.getElementById("p4-status");

if (!gl) {
  fallback.hidden = false;
  fallback.textContent = "Browser ini tidak mendukung WebGL2. Coba gunakan Chrome, Edge, atau Firefox versi terbaru.";
  status.textContent = "WebGL2 tidak tersedia";
  status.classList.remove("p4-status");
} else {
  const vertexSource = `#version 300 es
in vec3 a_position;
in vec3 a_color;
uniform mat4 u_model;
uniform mat4 u_view;
uniform mat4 u_projection;
out vec3 v_color;
void main() {
  gl_Position = u_projection * u_view * u_model * vec4(a_position, 1.0);
  v_color = a_color;
}`;

  const fragmentSource = `#version 300 es
precision highp float;
in vec3 v_color;
out vec4 outColor;
void main() {
  outColor = vec4(v_color, 1.0);
}`;

  function compileShader(type, source) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      const message = gl.getShaderInfoLog(shader);
      gl.deleteShader(shader);
      throw new Error(`Shader compile error: ${message}`);
    }
    return shader;
  }

  function createProgram() {
    const program = gl.createProgram();
    gl.attachShader(program, compileShader(gl.VERTEX_SHADER, vertexSource));
    gl.attachShader(program, compileShader(gl.FRAGMENT_SHADER, fragmentSource));
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      const message = gl.getProgramInfoLog(program);
      gl.deleteProgram(program);
      throw new Error(`Program link error: ${message}`);
    }
    return program;
  }

  function createCubeData() {
    const faces = [
      { color: [0.05, 0.78, 0.91], vertices: [[-0.5, -0.5, 0.5], [0.5, -0.5, 0.5], [0.5, 0.5, 0.5], [-0.5, -0.5, 0.5], [0.5, 0.5, 0.5], [-0.5, 0.5, 0.5]] },
      { color: [0.20, 0.35, 0.86], vertices: [[0.5, -0.5, -0.5], [-0.5, -0.5, -0.5], [-0.5, 0.5, -0.5], [0.5, -0.5, -0.5], [-0.5, 0.5, -0.5], [0.5, 0.5, -0.5]] },
      { color: [0.95, 0.40, 0.17], vertices: [[-0.5, -0.5, -0.5], [-0.5, -0.5, 0.5], [-0.5, 0.5, 0.5], [-0.5, -0.5, -0.5], [-0.5, 0.5, 0.5], [-0.5, 0.5, -0.5]] },
      { color: [0.16, 0.70, 0.40], vertices: [[0.5, -0.5, 0.5], [0.5, -0.5, -0.5], [0.5, 0.5, -0.5], [0.5, -0.5, 0.5], [0.5, 0.5, -0.5], [0.5, 0.5, 0.5]] },
      { color: [0.82, 0.30, 0.62], vertices: [[-0.5, 0.5, 0.5], [0.5, 0.5, 0.5], [0.5, 0.5, -0.5], [-0.5, 0.5, 0.5], [0.5, 0.5, -0.5], [-0.5, 0.5, -0.5]] },
      { color: [0.91, 0.75, 0.16], vertices: [[-0.5, -0.5, -0.5], [0.5, -0.5, -0.5], [0.5, -0.5, 0.5], [-0.5, -0.5, -0.5], [0.5, -0.5, 0.5], [-0.5, -0.5, 0.5]] },
    ];
    const positions = [];
    const colors = [];
    faces.forEach(({ color, vertices }) => vertices.forEach((vertex) => {
      positions.push(...vertex);
      colors.push(...color);
    }));
    return { positions: new Float32Array(positions), colors: new Float32Array(colors) };
  }

  try {
    const program = createProgram();
    const uniforms = {
      model: gl.getUniformLocation(program, "u_model"),
      view: gl.getUniformLocation(program, "u_view"),
      projection: gl.getUniformLocation(program, "u_projection"),
    };
    const cube = createCubeData();
    const vao = gl.createVertexArray();
    gl.bindVertexArray(vao);
    [
      ["a_position", cube.positions],
      ["a_color", cube.colors],
    ].forEach(([name, data]) => {
      const buffer = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
      const location = gl.getAttribLocation(program, name);
      gl.enableVertexAttribArray(location);
      gl.vertexAttribPointer(location, 3, gl.FLOAT, false, 0, 0);
    });
    gl.bindVertexArray(null);

    const initialCamera = [0, 1.5, 4];
    const camera = { position: [...initialCamera], target: [0, 0, 0], up: [0, 1, 0] };
    const projectionState = { mode: "perspective", fov: 60, near: 0.1, far: 100 };
    const presets = [{ near: 0.1, far: 100 }, { near: 1, far: 20 }, { near: 2.5, far: 8 }];
    const keys = new Set();
    let presetIndex = 0;
    let rotationX = 20;
    let rotationY = 30;
    let orbitAngle = 0;
    let lastTime = 0;
    let frames = 0;
    let fpsTime = 0;
    let fps = 0;

    const elements = {
      mode: document.getElementById("p4-mode"),
      fov: document.getElementById("p4-fov-range"),
      fovOutput: document.getElementById("p4-fov-output"),
      depth: document.getElementById("p4-depth-toggle"),
      rotation: document.getElementById("p4-rotation-toggle"),
      orbit: document.getElementById("p4-orbit-toggle"),
      reset: document.getElementById("p4-reset"),
      clipNext: document.getElementById("p4-clip-next"),
      projectionInfo: document.getElementById("p4-projection"),
      cameraInfo: document.getElementById("p4-camera"),
      fovInfo: document.getElementById("p4-fov"),
      clipInfo: document.getElementById("p4-clip"),
      depthInfo: document.getElementById("p4-depth"),
      fpsInfo: document.getElementById("p4-fps"),
      matrix: document.getElementById("p4-matrix"),
    };

    function changeClipPreset() {
      presetIndex = (presetIndex + 1) % presets.length;
      projectionState.near = presets[presetIndex].near;
      projectionState.far = presets[presetIndex].far;
    }

    function resetScene() {
      camera.position = [...initialCamera];
      camera.target = [0, 0, 0];
      camera.up = [0, 1, 0];
      projectionState.mode = "perspective";
      projectionState.fov = 60;
      projectionState.near = presets[0].near;
      projectionState.far = presets[0].far;
      presetIndex = 0;
      rotationX = 20;
      rotationY = 30;
      orbitAngle = 0;
      elements.mode.value = projectionState.mode;
      elements.fov.value = String(projectionState.fov);
      elements.depth.checked = true;
      elements.rotation.checked = true;
      elements.orbit.checked = false;
    }

    function isTypingTarget(target) {
      return target instanceof HTMLElement && (target.isContentEditable || ["INPUT", "SELECT", "TEXTAREA"].includes(target.tagName));
    }

    window.addEventListener("keydown", (event) => {
      if (isTypingTarget(event.target)) return;
      const key = event.key.toLowerCase();
      if (["arrowleft", "arrowright", "arrowup", "arrowdown", "pageup", "pagedown"].includes(key)) event.preventDefault();
      keys.add(key);
      if (event.repeat) return;
      if (key === "p") {
        projectionState.mode = projectionState.mode === "perspective" ? "orthographic" : "perspective";
        elements.mode.value = projectionState.mode;
      }
      if (key === "n") changeClipPreset();
      if (key === "d") elements.depth.checked = !elements.depth.checked;
      if (key === "r") resetScene();
    });
    window.addEventListener("keyup", (event) => keys.delete(event.key.toLowerCase()));
    window.addEventListener("blur", () => keys.clear());
    elements.mode.addEventListener("change", () => { projectionState.mode = elements.mode.value; });
    elements.fov.addEventListener("input", () => { projectionState.fov = Number(elements.fov.value); });
    elements.clipNext.addEventListener("click", changeClipPreset);
    elements.reset.addEventListener("click", resetScene);

    function updateControls(deltaTime) {
      const speed = 2 * deltaTime;
      if (keys.has("arrowleft")) camera.position[0] -= speed;
      if (keys.has("arrowright")) camera.position[0] += speed;
      if (keys.has("arrowup")) camera.position[1] += speed;
      if (keys.has("arrowdown")) camera.position[1] -= speed;
      if (keys.has("w")) camera.position[2] -= speed;
      if (keys.has("s")) camera.position[2] += speed;
      if (keys.has("pageup")) camera.position[1] += speed;
      if (keys.has("pagedown")) camera.position[1] -= speed;
      if (keys.has("[") || keys.has("{")) projectionState.fov -= 35 * deltaTime;
      if (keys.has("]") || keys.has("}")) projectionState.fov += 35 * deltaTime;
      projectionState.fov = Math.max(30, Math.min(100, projectionState.fov));
      elements.fov.value = String(projectionState.fov);
    }

    function createProjectionMatrix(aspect) {
      if (projectionState.mode === "perspective") {
        return Mat4.perspective(projectionState.fov * Math.PI / 180, aspect, projectionState.near, projectionState.far);
      }
      const size = 2;
      return Mat4.orthographic(-size * aspect, size * aspect, -size, size, projectionState.near, projectionState.far);
    }

    function updateHud(view) {
      elements.projectionInfo.textContent = projectionState.mode;
      elements.cameraInfo.textContent = `(${camera.position.map((value) => value.toFixed(2)).join(", ")})`;
      elements.fovInfo.textContent = `${projectionState.fov.toFixed(0)}°`;
      elements.fovOutput.textContent = `${projectionState.fov.toFixed(0)}°`;
      elements.clipInfo.textContent = `${projectionState.near} / ${projectionState.far}`;
      elements.depthInfo.textContent = elements.depth.checked ? "ON" : "OFF";
      elements.fpsInfo.textContent = String(fps);
      elements.matrix.textContent = Array.from(view, (value) => value.toFixed(2)).join("  ");
    }

    function render(time) {
      const deltaTime = Math.min((time - lastTime) / 1000 || 0, 0.05);
      lastTime = time;
      updateControls(deltaTime);
      if (elements.rotation.checked) {
        rotationX += 25 * deltaTime;
        rotationY += 40 * deltaTime;
      }
      if (elements.orbit.checked) {
        orbitAngle += 0.7 * deltaTime;
        camera.position[0] = Math.cos(orbitAngle) * 4;
        camera.position[2] = Math.sin(orbitAngle) * 4;
      }

      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.clearColor(0.035, 0.055, 0.075, 1);
      gl.clearDepth(1);
      if (elements.depth.checked) gl.enable(gl.DEPTH_TEST);
      else gl.disable(gl.DEPTH_TEST);
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      gl.useProgram(program);

      let model = Mat4.multiply(Mat4.rotationX(rotationX * Math.PI / 180), Mat4.rotationY(rotationY * Math.PI / 180));
      const view = Mat4.lookAt(camera.position, camera.target, camera.up);
      const projection = createProjectionMatrix(canvas.width / canvas.height);
      gl.uniformMatrix4fv(uniforms.model, false, model);
      gl.uniformMatrix4fv(uniforms.view, false, view);
      gl.uniformMatrix4fv(uniforms.projection, false, projection);
      gl.bindVertexArray(vao);
      gl.drawArrays(gl.TRIANGLES, 0, 36);
      gl.bindVertexArray(null);

      frames += 1;
      if (time - fpsTime >= 500) {
        fps = Math.round(frames * 1000 / (time - fpsTime));
        frames = 0;
        fpsTime = time;
      }
      updateHud(view);
      requestAnimationFrame(render);
    }

    status.textContent = "Running · WebGL2";
    requestAnimationFrame(render);
  } catch (error) {
    console.error(error);
    status.textContent = "Gagal menginisialisasi";
    status.classList.remove("p4-status");
    fallback.hidden = false;
    fallback.textContent = error.message;
  }
}