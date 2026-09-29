import { Mat4, Vec3 } from "./math3d.js";

const canvas = document.getElementById("p5-canvas");
const gl = canvas.getContext("webgl2", { antialias: true });
const status = document.getElementById("p5-status");
const fallback = document.getElementById("p5-fallback");

if (!gl) {
  status.textContent = "WebGL2 tidak tersedia";
  fallback.hidden = false;
  fallback.textContent = "Browser ini tidak mendukung WebGL2. Coba gunakan Chrome, Edge, atau Firefox versi terbaru.";
} else {
  const vertexSource = `#version 300 es
in vec3 a_position;
in vec3 a_normal;
in vec2 a_uv;
in vec3 a_color;
uniform mat4 u_model;
uniform mat4 u_view;
uniform mat4 u_projection;
uniform mat3 u_normalMatrix;
out vec3 v_position;
out vec3 v_normal;
out vec2 v_uv;
out vec3 v_color;
void main() {
  vec4 worldPosition = u_model * vec4(a_position, 1.0);
  v_position = worldPosition.xyz;
  v_normal = u_normalMatrix * a_normal;
  v_uv = a_uv;
  v_color = a_color;
  gl_Position = u_projection * u_view * worldPosition;
}`;

  const fragmentSource = `#version 300 es
precision highp float;
in vec3 v_position;
in vec3 v_normal;
in vec2 v_uv;
in vec3 v_color;
uniform sampler2D u_texture;
uniform vec3 u_lightPosition;
uniform vec3 u_cameraPosition;
uniform float u_ambientStrength;
uniform float u_shininess;
uniform bool u_useTexture;
uniform bool u_useAmbient;
uniform bool u_useDiffuse;
uniform bool u_useSpecular;
out vec4 outColor;
void main() {
  vec3 normal = normalize(v_normal);
  vec3 lightDirection = normalize(u_lightPosition - v_position);
  vec3 viewDirection = normalize(u_cameraPosition - v_position);
  vec3 halfDirection = normalize(lightDirection + viewDirection);
  vec3 baseColor = v_color * (u_useTexture ? texture(u_texture, v_uv).rgb : vec3(1.0));
  vec3 ambient = u_useAmbient ? vec3(u_ambientStrength) : vec3(0.0);
  float diffuseAmount = max(dot(normal, lightDirection), 0.0);
  vec3 diffuse = u_useDiffuse ? vec3(diffuseAmount) : vec3(0.0);
  float specularAmount = pow(max(dot(normal, halfDirection), 0.0), u_shininess);
  vec3 specular = u_useSpecular && diffuseAmount > 0.0 ? vec3(specularAmount) : vec3(0.0);
  outColor = vec4(baseColor * (ambient + diffuse) + specular, 1.0);
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

  function cross(a, b) {
    return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  }

  function subtract(a, b) {
    return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
  }

  function normalize(vector) {
    return Vec3.normalize(vector);
  }

  function makeMesh(triangles) {
    const positions = [];
    const flatNormals = [];
    const smoothNormals = [];
    const uvs = [];
    const colors = [];
    triangles.forEach((triangle) => {
      const edgeA = subtract(triangle.vertices[1].position, triangle.vertices[0].position);
      const edgeB = subtract(triangle.vertices[2].position, triangle.vertices[0].position);
      let faceNormal = normalize(cross(edgeA, edgeB));
      const averageNormal = normalize(triangle.vertices.reduce((sum, vertex) => [sum[0] + vertex.normal[0], sum[1] + vertex.normal[1], sum[2] + vertex.normal[2]], [0, 0, 0]));
      if (Vec3.dot(faceNormal, averageNormal) < 0) {
        triangle.vertices = [triangle.vertices[0], triangle.vertices[2], triangle.vertices[1]];
        faceNormal = faceNormal.map((value) => -value);
      }
      triangle.vertices.forEach((vertex) => {
        positions.push(...vertex.position);
        flatNormals.push(...faceNormal);
        smoothNormals.push(...vertex.normal);
        uvs.push(...vertex.uv);
        colors.push(...vertex.color);
      });
    });
    return {
      positions: new Float32Array(positions),
      flatNormals: new Float32Array(flatNormals),
      smoothNormals: new Float32Array(smoothNormals),
      uvs: new Float32Array(uvs),
      colors: new Float32Array(colors),
      count: positions.length / 3,
    };
  }

  function makeCube() {
    const faces = [
      { c: [0.28, 0.88, 0.78], p: [[-0.5, -0.5, 0.5], [0.5, -0.5, 0.5], [0.5, 0.5, 0.5], [-0.5, 0.5, 0.5]] },
      { c: [0.32, 0.55, 0.95], p: [[0.5, -0.5, -0.5], [-0.5, -0.5, -0.5], [-0.5, 0.5, -0.5], [0.5, 0.5, -0.5]] },
      { c: [0.95, 0.46, 0.30], p: [[-0.5, -0.5, -0.5], [-0.5, -0.5, 0.5], [-0.5, 0.5, 0.5], [-0.5, 0.5, -0.5]] },
      { c: [0.94, 0.76, 0.30], p: [[0.5, -0.5, 0.5], [0.5, -0.5, -0.5], [0.5, 0.5, -0.5], [0.5, 0.5, 0.5]] },
      { c: [0.77, 0.43, 0.82], p: [[-0.5, 0.5, 0.5], [0.5, 0.5, 0.5], [0.5, 0.5, -0.5], [-0.5, 0.5, -0.5]] },
      { c: [0.92, 0.42, 0.56], p: [[-0.5, -0.5, -0.5], [0.5, -0.5, -0.5], [0.5, -0.5, 0.5], [-0.5, -0.5, 0.5]] },
    ];
    const triangles = [];
    const quadUV = [[0, 0], [2, 0], [2, 2], [0, 2]];
    faces.forEach((face) => {
      const vertices = face.p.map((position, index) => ({ position, normal: normalize(position), uv: quadUV[index], color: face.c }));
      [[0, 1, 2], [0, 2, 3]].forEach((indices) => triangles.push({ vertices: indices.map((index) => vertices[index]) }));
    });
    return makeMesh(triangles);
  }

  function makeParametricMesh(rows, columns, surface, uvScaleU = 3, uvScaleV = 2) {
    const points = [];
    for (let row = 0; row <= rows; row += 1) {
      const rowPoints = [];
      for (let column = 0; column <= columns; column += 1) {
        rowPoints.push(surface(column / columns, row / rows));
      }
      points.push(rowPoints);
    }
    const triangles = [];
    for (let row = 0; row < rows; row += 1) {
      for (let column = 0; column < columns; column += 1) {
        const u0 = column / columns;
        const u1 = (column + 1) / columns;
        const v0 = row / rows;
        const v1 = (row + 1) / rows;
        const palette = 0.82 + 0.18 * Math.cos(v0 * Math.PI * 2);
        const makeVertex = (point, u, v) => ({
          position: point.position,
          normal: normalize(point.normal),
          uv: [u * uvScaleU, v * uvScaleV],
          color: [palette, 0.91, 0.78 + 0.18 * Math.sin(u * Math.PI * 2)],
        });
        const a = makeVertex(points[row][column], u0, v0);
        const b = makeVertex(points[row][column + 1], u1, v0);
        const c = makeVertex(points[row + 1][column + 1], u1, v1);
        const d = makeVertex(points[row + 1][column], u0, v1);
        triangles.push({ vertices: [a, b, c] }, { vertices: [a, c, d] });
      }
    }
    return makeMesh(triangles);
  }

  function makeTorus() {
    return makeParametricMesh(28, 48, (u, v) => {
      const angle = u * Math.PI * 2;
      const tube = v * Math.PI * 2;
      const radius = 0.78 + 0.32 * Math.cos(tube);
      return {
        position: [radius * Math.cos(angle), 0.32 * Math.sin(tube), radius * Math.sin(angle)],
        normal: [Math.cos(tube) * Math.cos(angle), Math.sin(tube), Math.cos(tube) * Math.sin(angle)],
      };
    });
  }

  function makeSphere() {
    return makeParametricMesh(28, 48, (u, v) => {
      const longitude = u * Math.PI * 2;
      const latitude = (v - 0.5) * Math.PI;
      const normal = [Math.cos(latitude) * Math.cos(longitude), Math.sin(latitude), Math.cos(latitude) * Math.sin(longitude)];
      return { position: normal.map((value) => value * 0.95), normal };
    }, 3, 2);
  }

  function makeKnot() {
    const curve = (t) => {
      const angle = t * Math.PI * 2;
      const radial = 0.82 + 0.34 * Math.cos(3 * angle);
      return [radial * Math.cos(2 * angle), 0.34 * Math.sin(3 * angle), radial * Math.sin(2 * angle)];
    };
    return makeParametricMesh(72, 12, (u, v) => {
      const center = curve(u);
      const tangent = normalize(subtract(curve((u + 0.001) % 1), curve((u - 0.001 + 1) % 1)));
      let side = normalize(cross(tangent, [0, 1, 0]));
      if (Math.hypot(...side) < 0.001) side = normalize(cross(tangent, [1, 0, 0]));
      const up = normalize(cross(tangent, side));
      const angle = v * Math.PI * 2;
      const normal = [side[0] * Math.cos(angle) + up[0] * Math.sin(angle), side[1] * Math.cos(angle) + up[1] * Math.sin(angle), side[2] * Math.cos(angle) + up[2] * Math.sin(angle)];
      return { position: center.map((value, index) => value + normal[index] * 0.15), normal };
    }, 3, 2);
  }

  function inverseTranspose3(matrix) {
    const a = matrix[0], b = matrix[1], c = matrix[2];
    const d = matrix[4], e = matrix[5], f = matrix[6];
    const g = matrix[8], h = matrix[9], i = matrix[10];
    const c00 = e * i - f * h;
    const c01 = f * g - d * i;
    const c02 = d * h - e * g;
    const c10 = c * h - b * i;
    const c11 = a * i - c * g;
    const c12 = b * g - a * h;
    const c20 = b * f - c * e;
    const c21 = c * d - a * f;
    const c22 = a * e - b * d;
    const determinant = a * c00 + b * c01 + c * c02;
    if (Math.abs(determinant) < 1e-8) return new Float32Array([1, 0, 0, 0, 1, 0, 0, 0, 1]);
    const inverseDeterminant = 1 / determinant;
    return new Float32Array([c00, c10, c20, c01, c11, c21, c02, c12, c22].map((value) => value * inverseDeterminant));
  }

  function createGeometry(mesh, program) {
    const locations = {
      position: gl.getAttribLocation(program, "a_position"),
      normal: gl.getAttribLocation(program, "a_normal"),
      uv: gl.getAttribLocation(program, "a_uv"),
      color: gl.getAttribLocation(program, "a_color"),
    };
    const shared = [
      [locations.position, mesh.positions, 3],
      [locations.uv, mesh.uvs, 2],
      [locations.color, mesh.colors, 3],
    ];
    const makeVao = (normals) => {
      const vao = gl.createVertexArray();
      gl.bindVertexArray(vao);
      [...shared, [locations.normal, normals, 3]].forEach(([location, data, size]) => {
        const buffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
        gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
        gl.enableVertexAttribArray(location);
        gl.vertexAttribPointer(location, size, gl.FLOAT, false, 0, 0);
      });
      gl.bindVertexArray(null);
      return vao;
    };
    return { flat: makeVao(mesh.flatNormals), smooth: makeVao(mesh.smoothNormals), count: mesh.count };
  }

  function makeCheckerboard() {
    const checker = document.createElement("canvas");
    checker.width = 128;
    checker.height = 128;
    const context = checker.getContext("2d");
    const tile = 16;
    for (let y = 0; y < 8; y += 1) {
      for (let x = 0; x < 8; x += 1) {
        context.fillStyle = (x + y) % 2 ? "#ef8354" : "#173f5f";
        context.fillRect(x * tile, y * tile, tile, tile);
      }
    }
    return checker;
  }

  try {
    const program = createProgram();
    const uniformNames = ["u_model", "u_view", "u_projection", "u_normalMatrix", "u_texture", "u_lightPosition", "u_cameraPosition", "u_ambientStrength", "u_shininess", "u_useTexture", "u_useAmbient", "u_useDiffuse", "u_useSpecular"];
    const uniforms = Object.fromEntries(uniformNames.map((name) => [name, gl.getUniformLocation(program, name)]));
    const geometries = {
      cube: createGeometry(makeCube(), program),
      torus: createGeometry(makeTorus(), program),
      knot: createGeometry(makeKnot(), program),
      sphere: createGeometry(makeSphere(), program),
    };
    const textures = { checker: gl.createTexture(), image: gl.createTexture() };

    function uploadTexture(texture, source) {
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
      gl.generateMipmap(gl.TEXTURE_2D);
    }

    uploadTexture(textures.checker, makeCheckerboard());
    gl.bindTexture(gl.TEXTURE_2D, textures.image);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([246, 189, 96, 255]));
    const image = new Image();
    image.addEventListener("load", () => uploadTexture(textures.image, image));
    image.src = "texture.svg";

    const defaults = {
      shape: "cube", smooth: false, textureEnabled: true, textureSource: "checker", filter: "linear", wrap: "repeat",
      ambient: 0.2, shininess: 32, light: [2.5, 2, 3], scale: [1, 1, 1],
      useAmbient: true, useDiffuse: true, useSpecular: true, lightOrbit: false, cameraOrbit: false, rotating: true,
    };
    const state = structuredClone(defaults);
    const cameraRadius = 4.6;
    let cameraAngle = 0;
    let cameraElevation = 0.28;
    let lightAngle = 0;
    let rotationX = 18;
    let rotationY = 28;
    let previousTime = 0;
    let fpsTime = 0;
    let frames = 0;
    let fps = 0;
    const keys = new Set();

    const ui = {
      shape: document.getElementById("p5-shape"),
      shading: document.getElementById("p5-shading"),
      textureToggle: document.getElementById("p5-texture-toggle"),
      textureSource: document.getElementById("p5-texture-source"),
      filter: document.getElementById("p5-filter"),
      wrap: document.getElementById("p5-wrap"),
      ambient: document.getElementById("p5-ambient"),
      shininess: document.getElementById("p5-shininess"),
      lightOrbit: document.getElementById("p5-light-orbit"),
      cameraOrbit: document.getElementById("p5-camera-orbit"),
      rotation: document.getElementById("p5-rotation"),
      reset: document.getElementById("p5-reset"),
      components: ["ambient", "diffuse", "specular"].map((name) => document.getElementById(`p5-${name}-toggle`)),
      light: ["x", "y", "z"].map((axis) => document.getElementById(`p5-light-${axis}`)),
      scale: ["x", "y", "z"].map((axis) => document.getElementById(`p5-scale-${axis}`)),
      hud: Object.fromEntries(["shape", "shading", "light", "texture", "filter", "wrap", "normal", "fps"].map((name) => [name, document.getElementById(`p5-hud-${name}`)])),
    };

    function updateTextureParameters() {
      const texture = textures[state.textureSource];
      gl.bindTexture(gl.TEXTURE_2D, texture);
      const wrap = state.wrap === "repeat" ? gl.REPEAT : gl.CLAMP_TO_EDGE;
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, wrap);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, wrap);
      if (state.filter === "nearest") {
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
      } else if (state.filter === "mipmap") {
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      } else {
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      }
    }

    function updateControlOutputs() {
      document.getElementById("p5-ambient-value").textContent = state.ambient.toFixed(2);
      document.getElementById("p5-shininess-value").textContent = String(state.shininess);
      ui.light.forEach((input, index) => { document.getElementById(`p5-light-${"xyz"[index]}-value`).textContent = state.light[index].toFixed(1); });
      ui.scale.forEach((input, index) => { document.getElementById(`p5-scale-${"xyz"[index]}-value`).textContent = state.scale[index].toFixed(2); });
      ui.shading.textContent = state.smooth ? "Smooth" : "Flat";
      ui.shading.classList.toggle("active", state.smooth);
      ui.shading.setAttribute("aria-pressed", String(state.smooth));
      ui.rotation.textContent = state.rotating ? "Stop Object Rotation (P)" : "Resume Object Rotation (P)";
    }

    function updateHud() {
      ui.hud.shape.textContent = ui.shape.options[ui.shape.selectedIndex].text;
      ui.hud.shading.textContent = state.smooth ? "Smooth" : "Flat";
      ui.hud.light.textContent = `(${state.light.map((value) => value.toFixed(2)).join(", ")})`;
      ui.hud.texture.textContent = state.textureEnabled ? (state.textureSource === "checker" ? "Checkerboard" : "SVG image") : "OFF";
      ui.hud.filter.textContent = state.filter === "mipmap" ? "LINEAR_MIPMAP" : state.filter.toUpperCase();
      ui.hud.wrap.textContent = state.wrap === "repeat" ? "REPEAT" : "CLAMP_TO_EDGE";
      ui.hud.normal.textContent = state.smooth ? "Vertex" : "Face";
      ui.hud.fps.textContent = String(fps);
    }

    function setShape(shape) {
      state.shape = shape;
      state.smooth = shape !== "cube";
      updateControlOutputs();
    }

    function toggleShading() {
      state.smooth = !state.smooth;
      updateControlOutputs();
    }

    function resetScene() {
      Object.assign(state, structuredClone(defaults));
      cameraAngle = 0;
      cameraElevation = 0.28;
      lightAngle = 0;
      rotationX = 18;
      rotationY = 28;
      ui.shape.value = state.shape;
      ui.textureToggle.checked = state.textureEnabled;
      ui.textureSource.value = state.textureSource;
      ui.filter.value = state.filter;
      ui.wrap.value = state.wrap;
      ui.ambient.value = String(state.ambient);
      ui.shininess.value = String(state.shininess);
      ui.lightOrbit.checked = state.lightOrbit;
      ui.cameraOrbit.checked = state.cameraOrbit;
      ui.components.forEach((checkbox, index) => { checkbox.checked = [state.useAmbient, state.useDiffuse, state.useSpecular][index]; });
      ui.light.forEach((input, index) => { input.value = String(state.light[index]); });
      ui.scale.forEach((input, index) => { input.value = String(state.scale[index]); });
      updateControlOutputs();
      updateTextureParameters();
    }

    function isTypingTarget(target) {
      return target instanceof HTMLElement && (target.isContentEditable || ["INPUT", "SELECT", "TEXTAREA", "BUTTON"].includes(target.tagName));
    }

    window.addEventListener("keydown", (event) => {
      if (isTypingTarget(event.target)) return;
      const key = event.key.toLowerCase();
      if (["arrowleft", "arrowright", "arrowup", "arrowdown"].includes(key)) event.preventDefault();
      keys.add(key);
      if (event.repeat) return;
      if (key === "p") { state.rotating = !state.rotating; updateControlOutputs(); }
      if (key === "f") toggleShading();
      if (key === "t") { state.textureEnabled = !state.textureEnabled; ui.textureToggle.checked = state.textureEnabled; }
      if (key === "l") { state.lightOrbit = !state.lightOrbit; ui.lightOrbit.checked = state.lightOrbit; }
      if (key === "r") resetScene();
    });
    window.addEventListener("keyup", (event) => keys.delete(event.key.toLowerCase()));
    window.addEventListener("blur", () => keys.clear());

    ui.shape.addEventListener("change", () => setShape(ui.shape.value));
    ui.shading.addEventListener("click", toggleShading);
    ui.textureToggle.addEventListener("change", () => { state.textureEnabled = ui.textureToggle.checked; });
    ui.textureSource.addEventListener("change", () => { state.textureSource = ui.textureSource.value; updateTextureParameters(); });
    ui.filter.addEventListener("change", () => { state.filter = ui.filter.value; updateTextureParameters(); });
    ui.wrap.addEventListener("change", () => { state.wrap = ui.wrap.value; updateTextureParameters(); });
    ui.ambient.addEventListener("input", () => { state.ambient = Number(ui.ambient.value); updateControlOutputs(); });
    ui.shininess.addEventListener("input", () => { state.shininess = Number(ui.shininess.value); updateControlOutputs(); });
    ui.light.forEach((input, index) => input.addEventListener("input", () => { state.light[index] = Number(input.value); updateControlOutputs(); }));
    ui.scale.forEach((input, index) => input.addEventListener("input", () => { state.scale[index] = Number(input.value); updateControlOutputs(); }));
    ui.components.forEach((checkbox, index) => checkbox.addEventListener("change", () => { state[["useAmbient", "useDiffuse", "useSpecular"][index]] = checkbox.checked; }));
    ui.lightOrbit.addEventListener("change", () => { state.lightOrbit = ui.lightOrbit.checked; });
    ui.cameraOrbit.addEventListener("change", () => { state.cameraOrbit = ui.cameraOrbit.checked; });
    ui.rotation.addEventListener("click", () => { state.rotating = !state.rotating; updateControlOutputs(); });
    ui.reset.addEventListener("click", resetScene);

    updateControlOutputs();
    updateTextureParameters();

    function updateInput(deltaTime) {
      const speed = 2.2 * deltaTime;
      if (keys.has("arrowleft")) state.light[0] -= speed;
      if (keys.has("arrowright")) state.light[0] += speed;
      if (keys.has("arrowdown")) state.light[1] -= speed;
      if (keys.has("arrowup")) state.light[1] += speed;
      if (keys.has("w")) state.light[2] += speed;
      if (keys.has("s")) state.light[2] -= speed;
      if (keys.has("q")) cameraAngle -= speed * 0.55;
      if (keys.has("e")) cameraAngle += speed * 0.55;
      state.light = state.light.map((value) => Math.max(-4, Math.min(4, value)));
      ui.light.forEach((input, index) => { input.value = String(state.light[index]); });
    }

    function render(time) {
      const deltaTime = Math.min((time - previousTime) / 1000 || 0, 0.05);
      previousTime = time;
      updateInput(deltaTime);
      if (state.rotating) {
        rotationX += 24 * deltaTime;
        rotationY += 36 * deltaTime;
      }
      if (state.cameraOrbit) cameraAngle += 0.45 * deltaTime;
      if (state.lightOrbit) {
        lightAngle += 0.75 * deltaTime;
        state.light[0] = Math.cos(lightAngle) * 2.8;
        state.light[2] = Math.sin(lightAngle) * 2.8;
        ui.light[0].value = String(state.light[0]);
        ui.light[2].value = String(state.light[2]);
      }

      const cameraPosition = [Math.sin(cameraAngle) * cameraRadius, Math.sin(cameraElevation) * cameraRadius, Math.cos(cameraAngle) * cameraRadius];
      const view = Mat4.lookAt(cameraPosition, [0, 0, 0], [0, 1, 0]);
      const projection = Mat4.perspective(Math.PI / 4, canvas.width / canvas.height, 0.1, 100);
      const rotation = Mat4.multiply(Mat4.rotationX(rotationX * Math.PI / 180), Mat4.rotationY(rotationY * Math.PI / 180));
      const model = Mat4.multiply(rotation, Mat4.scaling(...state.scale));
      const normalMatrix = inverseTranspose3(model);

      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.clearColor(0.035, 0.055, 0.075, 1);
      gl.clearDepth(1);
      gl.enable(gl.DEPTH_TEST);
      gl.enable(gl.CULL_FACE);
      gl.cullFace(gl.BACK);
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      gl.useProgram(program);
      gl.uniformMatrix4fv(uniforms.u_model, false, model);
      gl.uniformMatrix4fv(uniforms.u_view, false, view);
      gl.uniformMatrix4fv(uniforms.u_projection, false, projection);
      gl.uniformMatrix3fv(uniforms.u_normalMatrix, false, normalMatrix);
      gl.uniform3fv(uniforms.u_lightPosition, state.light);
      gl.uniform3fv(uniforms.u_cameraPosition, cameraPosition);
      gl.uniform1f(uniforms.u_ambientStrength, state.ambient);
      gl.uniform1f(uniforms.u_shininess, state.shininess);
      gl.uniform1i(uniforms.u_useTexture, state.textureEnabled ? 1 : 0);
      gl.uniform1i(uniforms.u_useAmbient, state.useAmbient ? 1 : 0);
      gl.uniform1i(uniforms.u_useDiffuse, state.useDiffuse ? 1 : 0);
      gl.uniform1i(uniforms.u_useSpecular, state.useSpecular ? 1 : 0);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, textures[state.textureSource]);
      gl.uniform1i(uniforms.u_texture, 0);
      const geometry = geometries[state.shape];
      gl.bindVertexArray(state.smooth ? geometry.smooth : geometry.flat);
      gl.drawArrays(gl.TRIANGLES, 0, geometry.count);
      gl.bindVertexArray(null);

      frames += 1;
      if (time - fpsTime >= 500) {
        fps = Math.round(frames * 1000 / (time - fpsTime));
        frames = 0;
        fpsTime = time;
      }
      updateControlOutputs();
      updateHud();
      requestAnimationFrame(render);
    }

    status.textContent = "Running · WebGL2";
    status.classList.add("p5-status");
    requestAnimationFrame(render);
  } catch (error) {
    console.error(error);
    status.textContent = "Gagal menginisialisasi";
    fallback.hidden = false;
    fallback.textContent = error.message;
  }
}