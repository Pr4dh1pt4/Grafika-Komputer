// Praktikum 3 — Interactive Transformation Playground (app.js)
//
// Satu triangle geometry (local space, berpusat di 0,0) dipakai ulang oleh
// SEMUA objek di scene -- Object A, Object B, child, dan orbiter. Yang
// membedakan posisi/rotasi/skala masing-masing HANYA nilai u_matrix yang
// dikirim sebelum tiap gl.drawArrays(). Tidak ada vertex buffer yang
// pernah diubah untuk memindahkan objek (lih. capaian #11).
//
// Matrix 3x3 di sini disimpan flat, 9 angka, COLUMN-MAJOR (kolom demi
// kolom) -- format yang sama yang diharapkan gl.uniformMatrix3fv() dan
// dipakai natural oleh `mat3 * vec3` di GLSL:
//   [ m0 m3 m6 ]
//   [ m1 m4 m7 ]
//   [ m2 m5 m8 ]
//
// mat3Multiply(A, B) mengembalikan A×B. Kalau M = mat3Multiply(mat3Multiply(I,T),R)
// dst., maka menerapkan M ke titik p sama dengan T*(R*(S*p)) -- urutan
// pembacaan array `order` (mis. ['T','R','S']) = urutan perkalian kiri-ke-kanan.

(function () {
  "use strict";

  var canvas = document.getElementById("canvas-transform");
  if (!canvas) return;

  var gl = canvas.getContext("webgl2");
  if (!gl) {
    var fallback = document.getElementById("webgl2-fallback-p3");
    if (fallback) fallback.hidden = false;
    return;
  }

  function clamp(v, min, max) {
    return Math.max(min, Math.min(max, v));
  }

  /* =========================================================
     SHADER: posisi dikirim sebagai vec2, diubah ke homogeneous
     coordinate (x, y, 1) di vertex shader, lalu dikalikan dengan
     Model Matrix (u_matrix). Warna cukup uniform vec4 karena semua
     objek solid -- fokus praktikum ini transformasi, bukan vertex
     color seperti Praktikum 2.
     ========================================================= */
  var VERTEX_SRC = [
    "#version 300 es",
    "in vec2 a_position;",
    "uniform mat3 u_matrix;",
    "uniform float u_pointSize;",
    "void main() {",
    "  vec3 homogeneous = vec3(a_position, 1.0);", // homogeneous coordinate (x, y, 1)
    "  vec3 transformed = u_matrix * homogeneous;", // Model Matrix diterapkan di sini
    "  gl_Position = vec4(transformed.xy, 0.0, 1.0);",
    "  gl_PointSize = u_pointSize;",
    "}",
  ].join("\n");

  var FRAGMENT_SRC = [
    "#version 300 es",
    "precision mediump float;",
    "uniform vec4 u_color;",
    "out vec4 outColor;",
    "void main() {",
    "  outColor = u_color;",
    "}",
  ].join("\n");

  function compileShader(type, source) {
    var shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      console.error("Shader compile error:", gl.getShaderInfoLog(shader));
      gl.deleteShader(shader);
      return null;
    }
    return shader;
  }

  function createProgram(vsSource, fsSource) {
    var vs = compileShader(gl.VERTEX_SHADER, vsSource);
    var fs = compileShader(gl.FRAGMENT_SHADER, fsSource);
    var program = gl.createProgram();
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      console.error("Program link error:", gl.getProgramInfoLog(program));
      return null;
    }
    return program;
  }

  var program = createProgram(VERTEX_SRC, FRAGMENT_SRC);
  gl.useProgram(program);

  var ATTRIB_POSITION = gl.getAttribLocation(program, "a_position");
  var UNIFORM_MATRIX = gl.getUniformLocation(program, "u_matrix");
  var UNIFORM_COLOR = gl.getUniformLocation(program, "u_color");
  var UNIFORM_POINT_SIZE = gl.getUniformLocation(program, "u_pointSize");

  gl.viewport(0, 0, canvas.width, canvas.height);

  /* =========================================================
     MATRIX 3x3 (column-major, flat array 9 angka)
     ========================================================= */
  function mat3Identity() {
    return [1, 0, 0, 0, 1, 0, 0, 0, 1];
  }
  function mat3Translation(tx, ty) {
    return [1, 0, 0, 0, 1, 0, tx, ty, 1];
  }
  function mat3Rotation(rad) {
    var c = Math.cos(rad), s = Math.sin(rad);
    return [c, s, 0, -s, c, 0, 0, 0, 1];
  }
  function mat3Scaling(sx, sy) {
    return [sx, 0, 0, 0, sy, 0, 0, 0, 1];
  }
  // A x B (column-major). Menerapkan hasilnya ke titik p == A*(B*p).
  function mat3Multiply(a, b) {
    var out = new Array(9);
    for (var col = 0; col < 3; col++) {
      for (var row = 0; row < 3; row++) {
        var sum = 0;
        for (var k = 0; k < 3; k++) sum += a[k * 3 + row] * b[col * 3 + k];
        out[col * 3 + row] = sum;
      }
    }
    return out;
  }

  // Model Matrix = komposisi Translation, Rotation, Scaling sesuai `order`
  // (array kode 'T'/'R'/'S'). Urutan ini menentukan hasil visual akhir --
  // itulah inti Challenge C (transform order comparison).
  function buildModelMatrix(obj, order) {
    var parts = {
      T: mat3Translation(obj.x, obj.y),
      R: mat3Rotation(obj.rot),
      S: mat3Scaling(obj.sx, obj.sy),
    };
    var M = mat3Identity();
    for (var i = 0; i < order.length; i++) M = mat3Multiply(M, parts[order[i]]);
    return M;
  }

  /* =========================================================
     GEOMETRI: satu triangle, satu line segment, satu titik --
     dipakai ulang untuk SEMUA objek/helper lewat u_matrix berbeda.
     ========================================================= */
  function makeGeometry(data) {
    var vao = gl.createVertexArray();
    gl.bindVertexArray(vao);
    var buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(ATTRIB_POSITION);
    gl.vertexAttribPointer(ATTRIB_POSITION, 2, gl.FLOAT, false, 0, 0);
    gl.bindVertexArray(null);
    return { vao: vao, count: data.length / 2 };
  }

  var triGeo = makeGeometry(new Float32Array([0, 0.16, -0.14, -0.12, 0.14, -0.12]));
  var lineGeo = makeGeometry(new Float32Array([-1, 0, 1, 0])); // sumbu X penuh, Y = rotasi 90 dari ini
  var pointGeo = makeGeometry(new Float32Array([0, 0]));

  function drawGeo(geo, matrix, color, glMode, pointSize) {
    gl.uniformMatrix3fv(UNIFORM_MATRIX, false, matrix);
    gl.uniform4fv(UNIFORM_COLOR, color);
    gl.uniform1f(UNIFORM_POINT_SIZE, pointSize || 6.0);
    gl.bindVertexArray(geo.vao);
    gl.drawArrays(glMode, 0, geo.count);
    gl.bindVertexArray(null);
  }

  /* =========================================================
     STATE SCENE
     ========================================================= */
  var INITIAL_A = { x: -0.35, y: 0, rot: 0, sx: 1, sy: 1 };
  var objA = { x: INITIAL_A.x, y: INITIAL_A.y, rot: INITIAL_A.rot, sx: INITIAL_A.sx, sy: INITIAL_A.sy };
  var COLOR_A = [0.37, 0.89, 0.83, 1];

  var objB = { x: 0.4, y: 0.25, rot: 0, sx: 1, sy: 1 };
  var COLOR_B = [0.96, 0.55, 0.33, 1];
  var bScalePhase = 0;

  // Challenge E: child punya local transform sendiri; posisi akhirnya
  // = parentMatrix x childLocalMatrix (dihitung tiap frame di render()).
  var childLocal = { x: 0.30, y: 0.0, rot: 0, sx: 0.45, sy: 0.45 };
  var COLOR_CHILD = [0.66, 0.76, 0.98, 1];

  // Challenge F: orbit murni komposisi matrix (center -> rotate -> geser
  // sejauh radius -> scale), BUKAN simulasi velocity/physics.
  var orbitAngle = 0;
  var ORBIT_CENTER = { x: 0, y: 0 };
  var ORBIT_RADIUS = 0.55;
  var ORBIT_SCALE = 0.5;
  var COLOR_ORBIT = [0.98, 0.86, 0.40, 1];

  var ORDER_OPTIONS = [["T", "R", "S"], ["S", "R", "T"]];
  var ORDER_LABELS = ["T × R × S", "S × R × T"];
  var orderIndex = 0;

  var PRESETS = {
    1: { x: -0.4, y: 0.2, rot: 0, sx: 1, sy: 1 },
    2: { x: 0.0, y: 0.0, rot: Math.PI / 4, sx: 1.5, sy: 1.5 },
    3: { x: 0.3, y: -0.2, rot: Math.PI / 2, sx: 1.8, sy: 0.6 },
  };

  var translateSpeed = 0.60;   // NDC/detik
  var rotationSpeedDeg = 90;   // derajat/detik
  var scaleSpeed = 0.50;       // unit skala/detik

  var playing = true;
  var autoBEnabled = true;
  var axesEnabled = true;
  var pivotEnabled = true;
  var parentChildEnabled = true;
  var orbitEnabled = true;

  var keys = {
    up: false, down: false, left: false, right: false,
    rotCCW: false, rotCW: false,
    scaleUp: false, scaleDown: false,
    scaleXUp: false, scaleXDown: false,
    scaleYUp: false, scaleYDown: false,
  };

  var mouseNDC = null;
  var lastTs = null;
  var fps = 0, fpsFrames = 0, fpsLastTs = null;

  /* =========================================================
     DOM & EVENTS
     ========================================================= */
  var els = {
    speed: document.getElementById("p3-speed"),
    speedVal: document.getElementById("p3-speed-val"),
    rotspeed: document.getElementById("p3-rotspeed"),
    rotspeedVal: document.getElementById("p3-rotspeed-val"),
    scalespeed: document.getElementById("p3-scalespeed"),
    scalespeedVal: document.getElementById("p3-scalespeed-val"),
    autob: document.getElementById("p3-autob"),
    axes: document.getElementById("p3-axes"),
    pivot: document.getElementById("p3-pivot"),
    parentchild: document.getElementById("p3-parentchild"),
    orbitCheckbox: document.getElementById("p3-orbit"),
    pause: document.getElementById("p3-pause"),
    reset: document.getElementById("p3-reset"),
    orderToggle: document.getElementById("p3-order-toggle"),
    preset1: document.getElementById("p3-preset1"),
    preset2: document.getElementById("p3-preset2"),
    preset3: document.getElementById("p3-preset3"),
    badges: document.querySelectorAll(".key-badge[data-key]"),
    readout: document.getElementById("p3-readout"),
    fps: document.getElementById("p3-fps"),
    order: document.getElementById("p3-order"),
    ndc: document.getElementById("p3-ndc"),
  };

  els.speed.addEventListener("input", function () {
    translateSpeed = parseFloat(els.speed.value);
    els.speedVal.textContent = translateSpeed.toFixed(2);
  });
  els.rotspeed.addEventListener("input", function () {
    rotationSpeedDeg = parseFloat(els.rotspeed.value);
    els.rotspeedVal.textContent = String(Math.round(rotationSpeedDeg));
  });
  els.scalespeed.addEventListener("input", function () {
    scaleSpeed = parseFloat(els.scalespeed.value);
    els.scalespeedVal.textContent = scaleSpeed.toFixed(2);
  });

  els.autob.addEventListener("change", function () { autoBEnabled = els.autob.checked; });
  els.axes.addEventListener("change", function () { axesEnabled = els.axes.checked; });
  els.pivot.addEventListener("change", function () { pivotEnabled = els.pivot.checked; });
  els.parentchild.addEventListener("change", function () { parentChildEnabled = els.parentchild.checked; });
  els.orbitCheckbox.addEventListener("change", function () { orbitEnabled = els.orbitCheckbox.checked; });

  function togglePlay() {
    playing = !playing;
    els.pause.textContent = playing ? "Pause (P)" : "Resume (P)";
  }
  function resetObjectA() {
    objA.x = INITIAL_A.x; objA.y = INITIAL_A.y; objA.rot = INITIAL_A.rot;
    objA.sx = INITIAL_A.sx; objA.sy = INITIAL_A.sy;
  }
  function applyPreset(n) {
    var p = PRESETS[n];
    objA.x = p.x; objA.y = p.y; objA.rot = p.rot; objA.sx = p.sx; objA.sy = p.sy;
  }
  function toggleOrder() {
    orderIndex = (orderIndex + 1) % ORDER_OPTIONS.length;
  }
  function toggleOrbit() {
    orbitEnabled = !orbitEnabled;
    els.orbitCheckbox.checked = orbitEnabled;
  }

  els.pause.addEventListener("click", togglePlay);
  els.reset.addEventListener("click", resetObjectA);
  els.orderToggle.addEventListener("click", toggleOrder);
  els.preset1.addEventListener("click", function () { applyPreset(1); });
  els.preset2.addEventListener("click", function () { applyPreset(2); });
  els.preset3.addEventListener("click", function () { applyPreset(3); });

  // Tombol kontinu (translasi/rotasi/scaling) -- event cuma menulis status,
  // gerakannya sendiri dibaca ulang tiap frame di updateObjectA() (state-based).
  var CONTINUOUS_CODES = [
    "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight",
    "KeyQ", "KeyE", "Equal", "NumpadAdd", "Minus", "NumpadSubtract",
    "KeyZ", "KeyX", "KeyC", "KeyV",
  ];

  function setContinuousKey(code, value) {
    switch (code) {
      case "ArrowUp": keys.up = value; break;
      case "ArrowDown": keys.down = value; break;
      case "ArrowLeft": keys.left = value; break;
      case "ArrowRight": keys.right = value; break;
      case "KeyQ": keys.rotCCW = value; break;
      case "KeyE": keys.rotCW = value; break;
      case "Equal": case "NumpadAdd": keys.scaleUp = value; break;
      case "Minus": case "NumpadSubtract": keys.scaleDown = value; break;
      case "KeyZ": keys.scaleXDown = value; break;
      case "KeyX": keys.scaleXUp = value; break;
      case "KeyC": keys.scaleYDown = value; break;
      case "KeyV": keys.scaleYUp = value; break;
    }
  }

  canvas.addEventListener("keydown", function (e) {
    if (CONTINUOUS_CODES.indexOf(e.code) !== -1) {
      e.preventDefault();
      setContinuousKey(e.code, true);
      return;
    }
    if (e.repeat) return; // aksi sekali-tekan: abaikan auto-repeat browser
    if (e.code === "KeyR") { resetObjectA(); return; }        // Challenge A
    if (e.code === "Digit1") { applyPreset(1); return; }      // Challenge B
    if (e.code === "Digit2") { applyPreset(2); return; }
    if (e.code === "Digit3") { applyPreset(3); return; }
    if (e.code === "KeyT") { toggleOrder(); return; }         // Challenge C
    if (e.code === "KeyP") { togglePlay(); return; }
    if (e.code === "KeyO") { toggleOrbit(); return; }
  });
  canvas.addEventListener("keyup", function (e) {
    setContinuousKey(e.code, false);
  });
  canvas.addEventListener("blur", function () {
    keys.up = keys.down = keys.left = keys.right = false;
    keys.rotCCW = keys.rotCW = false;
    keys.scaleUp = keys.scaleDown = false;
    keys.scaleXUp = keys.scaleXDown = keys.scaleYUp = keys.scaleYDown = false;
  });

  function pixelToNDC(e) {
    var rect = canvas.getBoundingClientRect();
    var xPix = (e.clientX - rect.left) * (canvas.width / rect.width);
    var yPix = (e.clientY - rect.top) * (canvas.height / rect.height);
    return {
      x: (xPix / canvas.width) * 2 - 1,
      y: 1 - (yPix / canvas.height) * 2,
    };
  }

  canvas.addEventListener("mousemove", function (e) { mouseNDC = pixelToNDC(e); });
  canvas.addEventListener("mouseleave", function () { mouseNDC = null; });
  // Challenge D: Mouse Pixel -> NDC -> transform.x/transform.y Object A.
  canvas.addEventListener("click", function (e) {
    var ndc = pixelToNDC(e);
    objA.x = ndc.x;
    objA.y = ndc.y;
  });

  /* =========================================================
     UPDATE (state-based + deltaTime, capaian #12-14)
     ========================================================= */
  function updateObjectA(dt) {
    var moveStep = translateSpeed * dt;
    if (keys.up) objA.y += moveStep;
    if (keys.down) objA.y -= moveStep;
    if (keys.left) objA.x -= moveStep;
    if (keys.right) objA.x += moveStep;
    objA.x = clamp(objA.x, -1, 1);
    objA.y = clamp(objA.y, -1, 1);

    var rotStep = (rotationSpeedDeg * Math.PI / 180) * dt;
    if (keys.rotCCW) objA.rot += rotStep; // Q
    if (keys.rotCW) objA.rot -= rotStep;  // E

    var scaleStep = scaleSpeed * dt;
    if (keys.scaleUp) { objA.sx += scaleStep; objA.sy += scaleStep; }   // +
    if (keys.scaleDown) { objA.sx -= scaleStep; objA.sy -= scaleStep; } // -
    if (keys.scaleXUp) objA.sx += scaleStep;   // X
    if (keys.scaleXDown) objA.sx -= scaleStep; // Z
    if (keys.scaleYUp) objA.sy += scaleStep;   // V
    if (keys.scaleYDown) objA.sy -= scaleStep; // C
    objA.sx = clamp(objA.sx, 0.15, 3.5);
    objA.sy = clamp(objA.sy, 0.15, 3.5);
  }

  // Object B: animasi otomatis (bukan input pengguna) -- rotasi kontinu
  // + scaling naik-turun mengikuti gelombang sinus, semua pakai deltaTime.
  function updateObjectB(dt) {
    if (!autoBEnabled) return;
    objB.rot += (110 * Math.PI / 180) * dt;
    bScalePhase += dt;
    var s = 1 + 0.35 * Math.sin(bScalePhase * 1.6);
    objB.sx = s; objB.sy = s;
  }

  function updateOrbit(dt) {
    if (!orbitEnabled) return;
    orbitAngle += (70 * Math.PI / 180) * dt;
  }

  function fmtRow(M, r) {
    return "[" + M[0 * 3 + r].toFixed(2) + ", " + M[1 * 3 + r].toFixed(2) + ", " + M[2 * 3 + r].toFixed(2) + "]";
  }

  function updateHUD(ts, dtMs, aMatrix) {
    fpsFrames++;
    if (fpsLastTs === null) fpsLastTs = ts;
    if (ts - fpsLastTs >= 500) {
      fps = Math.round((fpsFrames * 1000) / (ts - fpsLastTs));
      fpsFrames = 0;
      fpsLastTs = ts;
      els.fps.textContent = String(fps);
    }

    els.order.textContent = ORDER_LABELS[orderIndex];
    els.ndc.textContent = mouseNDC ? mouseNDC.x.toFixed(2) + ", " + mouseNDC.y.toFixed(2) : "-, -";

    els.badges.forEach(function (b) {
      b.classList.toggle("active", !!keys[b.getAttribute("data-key")]);
    });

    els.readout.textContent = [
      "position: (" + objA.x.toFixed(2) + ", " + objA.y.toFixed(2) + ")",
      "rotation: " + (objA.rot * 180 / Math.PI).toFixed(1) + "°",
      "scale: (" + objA.sx.toFixed(2) + ", " + objA.sy.toFixed(2) + ")",
      "order: " + ORDER_LABELS[orderIndex],
      "deltaTime: " + dtMs.toFixed(1) + " ms",
      "u_matrix =",
      fmtRow(aMatrix, 0),
      fmtRow(aMatrix, 1),
      fmtRow(aMatrix, 2),
    ].join("\n");
  }

  /* =========================================================
     RENDER LOOP
     ========================================================= */
  function render(ts) {
    if (lastTs === null) lastTs = ts;
    var dtRaw = (ts - lastTs) / 1000;
    var dt = clamp(dtRaw, 0, 0.05); // dibatasi supaya tab yang sempat tidak aktif tidak melompat jauh
    lastTs = ts;

    if (playing) {
      updateObjectA(dt);
      updateObjectB(dt);
      updateOrbit(dt);
    }

    var aMatrix = buildModelMatrix(objA, ORDER_OPTIONS[orderIndex]);
    updateHUD(ts, dtRaw * 1000, aMatrix);

    gl.clearColor(0.035, 0.043, 0.078, 1.0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.useProgram(program);

    if (axesEnabled) {
      drawGeo(lineGeo, mat3Identity(), [0.86, 0.32, 0.36, 1], gl.LINES);       // sumbu X (merah)
      drawGeo(lineGeo, mat3Rotation(Math.PI / 2), [0.32, 0.78, 0.42, 1], gl.LINES); // sumbu Y (hijau)
    }

    if (pivotEnabled) {
      drawGeo(pointGeo, mat3Identity(), [0.82, 0.85, 0.9, 1], gl.POINTS, 8);          // origin (0,0)
      drawGeo(pointGeo, mat3Translation(objA.x, objA.y), COLOR_A, gl.POINTS, 6);      // pivot Object A
      drawGeo(pointGeo, mat3Translation(objB.x, objB.y), COLOR_B, gl.POINTS, 6);      // pivot Object B
    }

    // Challenge F: rotasi mengelilingi ORBIT_CENTER, lalu digeser sejauh
    // radius, lalu diskalakan -- murni komposisi matrix, bukan velocity.
    if (orbitEnabled) {
      var centerT = mat3Translation(ORBIT_CENTER.x, ORBIT_CENTER.y);
      var spin = mat3Rotation(orbitAngle);
      var arm = mat3Translation(ORBIT_RADIUS, 0);
      var ownS = mat3Scaling(ORBIT_SCALE, ORBIT_SCALE);
      var orbitMatrix = mat3Multiply(mat3Multiply(mat3Multiply(centerT, spin), arm), ownS);
      drawGeo(triGeo, orbitMatrix, COLOR_ORBIT, gl.TRIANGLES);
    }

    var bMatrix = buildModelMatrix(objB, ["T", "R", "S"]);
    drawGeo(triGeo, bMatrix, COLOR_B, gl.TRIANGLES);

    // Challenge E: childWorldMatrix = parentMatrix x childLocalMatrix.
    // Child ikut berputar & membesar-mengecil setiap kali Object B berubah,
    // padahal childLocal sendiri tidak pernah disentuh.
    if (parentChildEnabled) {
      var childLocalMatrix = buildModelMatrix(childLocal, ["T", "R", "S"]);
      var childWorldMatrix = mat3Multiply(bMatrix, childLocalMatrix);
      drawGeo(triGeo, childWorldMatrix, COLOR_CHILD, gl.TRIANGLES);
    }

    drawGeo(triGeo, aMatrix, COLOR_A, gl.TRIANGLES);

    requestAnimationFrame(render);
  }

  requestAnimationFrame(render);
})();
