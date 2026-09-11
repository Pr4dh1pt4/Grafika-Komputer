// Praktikum 2 — WebGL Fundamental (app.js)
//
// Satu canvas WebGL2 (#canvas-webgl, 850x550) berisi:
//   - 1 objek utama yang dikendalikan oleh Parameter Control panel
//     (primitive selector, draw mode, color, WASD/Arrow -- state-based)
//   - 3 "moving objects" otomatis yang memantul di batas NDC (-1..1)
//   - triangle yang bisa di-spawn dengan klik mouse (pixel -> NDC)
//   - grid prosedural (dibangun dari nested loop JS, bukan digambar manual)
//
// Semua objek primitif menyimpan vertex-nya di local space (berpusat di
// 0,0). Posisi dunia dihitung ulang di JavaScript setiap frame lalu
// di-upload ke GPU lewat gl.bufferSubData() -- inilah "dynamic position
// buffer" yang dipakai untuk animasi, berbeda dari uniform transform.

(function () {
  "use strict";

  var canvas = document.getElementById("canvas-webgl");
  if (!canvas) return;

  var gl = canvas.getContext("webgl2");
  if (!gl) {
    var fallback = document.getElementById("webgl2-fallback");
    if (fallback) fallback.hidden = false;
    return;
  }

  function clamp(v, min, max) {
    return Math.max(min, Math.min(max, v));
  }

  /* =========================================================
     SHADER: GLSL ES 3.00. Posisi vertex sudah dalam NDC (dihitung
     di JS), jadi vertex shader tinggal meneruskannya. Warna per-
     vertex dikirim lewat attribute lalu di-interpolasi otomatis
     oleh GPU sebelum sampai ke fragment shader (`v_color`).
     ========================================================= */
  var VERTEX_SRC = [
    "#version 300 es",
    "in vec2 a_position;",
    "in vec3 a_color;",
    "uniform float u_pointSize;",
    "out vec3 v_color;",
    "void main() {",
    "  gl_Position = vec4(a_position, 0.0, 1.0);",
    "  gl_PointSize = u_pointSize;",
    "  v_color = a_color;",
    "}",
  ].join("\n");

  var FRAGMENT_SRC = [
    "#version 300 es",
    "precision mediump float;",
    "in vec3 v_color;",
    "out vec4 outColor;",
    "void main() {",
    "  outColor = vec4(v_color, 1.0);",
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
  var ATTRIB_COLOR = gl.getAttribLocation(program, "a_color");
  var UNIFORM_POINT_SIZE = gl.getUniformLocation(program, "u_pointSize");

  gl.viewport(0, 0, canvas.width, canvas.height);
  gl.uniform1f(UNIFORM_POINT_SIZE, 9.0);

  /* =========================================================
     GEOMETRI PRIMITIF (local space, berpusat di 0,0)
     Data vertex TIDAK berubah walau draw mode diganti -- hanya
     parameter `mode` pada gl.drawArrays() yang berubah.
     ========================================================= */
  var SHAPES = {
    triangle: function () {
      var s = 0.14;
      return new Float32Array([0, s, -s, -s, s, -s]);
    },
    // Rectangle = dua triangle (6 vertex). Dalam mode LINE_STRIP,
    // diagonal pembagi dua triangle-nya ikut kelihatan -- itu
    // sengaja, supaya "rectangle dari dua triangle" terlihat jelas.
    rectangle: function () {
      var s = 0.14;
      return new Float32Array([
        -s, -s, s, -s, s, s, // triangle 1
        -s, -s, s, s, -s, s, // triangle 2
      ]);
    },
    line: function () {
      var s = 0.16;
      return new Float32Array([
        -s, 0,
        -s * 0.4, s * 0.6,
        0, -s * 0.3,
        s * 0.4, s * 0.6,
        s, 0,
      ]);
    },
    points: function () {
      return new Float32Array([
        0, 0, 0.09, 0.09, -0.09, 0.09, 0.09, -0.09, -0.09, -0.09, 0.15, 0, -0.15, 0,
      ]);
    },
  };

  var COLORS = {
    red: { r: 0.94, g: 0.35, b: 0.35 },
    green: { r: 0.30, g: 0.85, b: 0.45 },
    blue: { r: 0.35, g: 0.55, b: 0.95 },
    cyan: { r: 0.30, g: 0.90, b: 0.88 },
  };
  var COLOR_CYCLE = ["red", "green", "blue", "cyan", "random"];

  function randomChannel() { return Math.random(); }

  // "random" -> setiap vertex dapat warna acak sendiri, sehingga hasil
  // render menunjukkan interpolasi warna antar-vertex oleh GPU.
  // Warna tetap (red/green/blue/cyan) -> semua vertex sama, jadi solid.
  function buildColorData(colorMode, vertexCount) {
    var fixed = COLORS[colorMode];
    var out = new Float32Array(vertexCount * 3);
    for (var i = 0; i < vertexCount; i++) {
      var c = fixed || { r: randomChannel(), g: randomChannel(), b: randomChannel() };
      out[i * 3] = c.r;
      out[i * 3 + 1] = c.g;
      out[i * 3 + 2] = c.b;
    }
    return out;
  }

  /* =========================================================
     DRAWABLE: satu VAO + dynamic position buffer + color buffer.
     `local` = bentuk asli (tidak berubah). `world` dihitung ulang
     tiap frame dari local + (x, y) lalu di-upload via bufferSubData.
     ========================================================= */
  function createDrawable(shapeType, colorMode) {
    var local = SHAPES[shapeType]();
    var count = local.length / 2;
    var world = new Float32Array(local.length);

    var vao = gl.createVertexArray();
    gl.bindVertexArray(vao);

    var posBuf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, posBuf);
    gl.bufferData(gl.ARRAY_BUFFER, world, gl.DYNAMIC_DRAW);
    gl.enableVertexAttribArray(ATTRIB_POSITION);
    gl.vertexAttribPointer(ATTRIB_POSITION, 2, gl.FLOAT, false, 0, 0);

    var colorBuf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, colorBuf);
    gl.bufferData(gl.ARRAY_BUFFER, buildColorData(colorMode, count), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(ATTRIB_COLOR);
    gl.vertexAttribPointer(ATTRIB_COLOR, 3, gl.FLOAT, false, 0, 0);

    gl.bindVertexArray(null);

    return {
      shapeType: shapeType, colorMode: colorMode,
      local: local, world: world, count: count,
      vao: vao, posBuf: posBuf, colorBuf: colorBuf,
      x: 0, y: 0, vx: 0, vy: 0, baseVx: 0, baseVy: 0,
    };
  }

  function setDrawableShape(obj, shapeType) {
    obj.shapeType = shapeType;
    obj.local = SHAPES[shapeType]();
    obj.count = obj.local.length / 2;
    obj.world = new Float32Array(obj.local.length);

    gl.bindBuffer(gl.ARRAY_BUFFER, obj.posBuf);
    gl.bufferData(gl.ARRAY_BUFFER, obj.world, gl.DYNAMIC_DRAW);
    gl.bindBuffer(gl.ARRAY_BUFFER, obj.colorBuf);
    gl.bufferData(gl.ARRAY_BUFFER, buildColorData(obj.colorMode, obj.count), gl.STATIC_DRAW);
  }

  function setDrawableColor(obj, colorMode) {
    obj.colorMode = colorMode;
    gl.bindBuffer(gl.ARRAY_BUFFER, obj.colorBuf);
    gl.bufferData(gl.ARRAY_BUFFER, buildColorData(colorMode, obj.count), gl.STATIC_DRAW);
  }

  // Inti "dynamic position buffer": posisi dunia = local + offset,
  // dihitung ulang tiap frame lalu ditulis ulang ke GPU buffer yang sama.
  function syncWorldBuffer(obj) {
    for (var i = 0; i < obj.count; i++) {
      obj.world[i * 2] = obj.local[i * 2] + obj.x;
      obj.world[i * 2 + 1] = obj.local[i * 2 + 1] + obj.y;
    }
    gl.bindBuffer(gl.ARRAY_BUFFER, obj.posBuf);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, obj.world);
  }

  function drawDrawable(obj, glMode) {
    gl.bindVertexArray(obj.vao);
    gl.drawArrays(glMode, 0, obj.count);
    gl.bindVertexArray(null);
  }

  // Spawned triangles each allocate their own VAO/buffers; free them
  // explicitly instead of leaving orphaned GPU resources behind.
  function disposeDrawable(obj) {
    gl.deleteBuffer(obj.posBuf);
    gl.deleteBuffer(obj.colorBuf);
    gl.deleteVertexArray(obj.vao);
  }

  /* =========================================================
     GRID PROSEDURAL: dibangun dari perulangan JavaScript (bukan
     ditulis manual satu per satu), selalu digambar sebagai LINES.
     ========================================================= */
  function buildGrid(divisions) {
    var positions = [];
    var step = 2 / divisions;
    for (var i = 0; i <= divisions; i++) {
      var v = -1 + i * step;
      positions.push(v, -1, v, 1); // garis vertikal
      positions.push(-1, v, 1, v); // garis horizontal
    }
    return new Float32Array(positions);
  }

  var gridPositions = buildGrid(10);
  var gridCount = gridPositions.length / 2;
  var gridVAO = gl.createVertexArray();
  gl.bindVertexArray(gridVAO);
  var gridPosBuf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, gridPosBuf);
  gl.bufferData(gl.ARRAY_BUFFER, gridPositions, gl.STATIC_DRAW);
  gl.enableVertexAttribArray(ATTRIB_POSITION);
  gl.vertexAttribPointer(ATTRIB_POSITION, 2, gl.FLOAT, false, 0, 0);
  var gridColorBuf = gl.createBuffer();
  var gridColorData = new Float32Array(gridCount * 3);
  for (var gi = 0; gi < gridCount; gi++) {
    gridColorData[gi * 3] = 0.20; gridColorData[gi * 3 + 1] = 0.26; gridColorData[gi * 3 + 2] = 0.36;
  }
  gl.bindBuffer(gl.ARRAY_BUFFER, gridColorBuf);
  gl.bufferData(gl.ARRAY_BUFFER, gridColorData, gl.STATIC_DRAW);
  gl.enableVertexAttribArray(ATTRIB_COLOR);
  gl.vertexAttribPointer(ATTRIB_COLOR, 3, gl.FLOAT, false, 0, 0);
  gl.bindVertexArray(null);

  /* =========================================================
     STATE: objek utama, 3 moving objects, dan spawned (klik).
     ========================================================= */
  var mainObj = createDrawable("triangle", "random");

  var MOVER_MARGIN = 0.15;
  function makeMover(color, x, y, vx, vy) {
    var o = createDrawable("triangle", color);
    o.x = x; o.y = y; o.baseVx = vx; o.baseVy = vy;
    return o;
  }
  var movers = [
    makeMover("green", -0.55, 0.45, 0.020, 0.014),
    makeMover("red", 0.55, -0.45, -0.017, 0.023),
    makeMover("blue", 0.6, 0.5, -0.014, -0.020),
  ];
  var MOVER_INITIAL = movers.map(function (o) { return { x: o.x, y: o.y, vx: o.baseVx, vy: o.baseVy }; });

  var spawned = []; // triangle hasil klik mouse

  var currentDrawModeName = "TRIANGLES";
  var DRAW_MODE_GL = { TRIANGLES: gl.TRIANGLES, LINE_STRIP: gl.LINE_STRIP, POINTS: gl.POINTS };

  var speedMult = 0.35;
  var gridEnabled = true;
  var playing = true;
  var keys = { up: false, down: false, left: false, right: false };
  var colorCycleIndex = COLOR_CYCLE.indexOf("random");

  var mouseNDC = null;
  var frameCount = 0;
  var fps = 0;
  var fpsFrames = 0;
  var fpsLastTs = null;

  /* =========================================================
     DOM & EVENTS
     ========================================================= */
  var els = {
    primitive: document.getElementById("p2g-primitive"),
    drawmode: document.getElementById("p2g-drawmode"),
    speed: document.getElementById("p2g-speed"),
    speedVal: document.getElementById("p2g-speed-val"),
    colors: document.querySelectorAll("#p2g-colors .btn"),
    grid: document.getElementById("p2g-grid"),
    pause: document.getElementById("p2g-pause"),
    reset: document.getElementById("p2g-reset"),
    clearSpawned: document.getElementById("p2g-clear-spawned"),
    readout: document.getElementById("p2g-readout"),
    fps: document.getElementById("p2g-fps"),
    count: document.getElementById("p2g-count"),
    mode: document.getElementById("p2g-mode"),
    ndc: document.getElementById("p2g-ndc"),
  };

  els.primitive.addEventListener("change", function () {
    setDrawableShape(mainObj, els.primitive.value);
  });

  els.drawmode.addEventListener("change", function () {
    currentDrawModeName = els.drawmode.value;
    els.mode.textContent = currentDrawModeName;
  });

  els.speed.addEventListener("input", function () {
    speedMult = parseFloat(els.speed.value);
    els.speedVal.textContent = speedMult.toFixed(2);
  });

  function selectColorButton(colorMode) {
    els.colors.forEach(function (b) {
      b.classList.toggle("active", b.getAttribute("data-color") === colorMode);
    });
  }
  els.colors.forEach(function (btn) {
    btn.addEventListener("click", function () {
      var color = btn.getAttribute("data-color");
      setDrawableColor(mainObj, color);
      selectColorButton(color);
      colorCycleIndex = COLOR_CYCLE.indexOf(color);
    });
  });

  els.grid.addEventListener("change", function () {
    gridEnabled = els.grid.checked;
  });

  function togglePlay() {
    playing = !playing;
    els.pause.textContent = playing ? "Pause (P)" : "Resume (P)";
  }
  els.pause.addEventListener("click", togglePlay);

  function resetScene() {
    mainObj.x = 0; mainObj.y = 0;
    movers.forEach(function (o, i) {
      o.x = MOVER_INITIAL[i].x;
      o.y = MOVER_INITIAL[i].y;
      o.baseVx = MOVER_INITIAL[i].vx;
      o.baseVy = MOVER_INITIAL[i].vy;
    });
    spawned.forEach(disposeDrawable);
    spawned = [];
  }
  els.reset.addEventListener("click", resetScene);

  els.clearSpawned.addEventListener("click", function () {
    spawned.forEach(disposeDrawable);
    spawned = [];
  });

  function cycleMainColor() {
    colorCycleIndex = (colorCycleIndex + 1) % COLOR_CYCLE.length;
    var color = COLOR_CYCLE[colorCycleIndex];
    setDrawableColor(mainObj, color);
    selectColorButton(color);
  }

  var HANDLED_MOVE_KEYS = ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "KeyW", "KeyA", "KeyS", "KeyD"];

  function setKeyFromCode(code, value) {
    if (code === "ArrowUp" || code === "KeyW") keys.up = value;
    else if (code === "ArrowDown" || code === "KeyS") keys.down = value;
    else if (code === "ArrowLeft" || code === "KeyA") keys.left = value;
    else if (code === "ArrowRight" || code === "KeyD") keys.right = value;
  }

  canvas.addEventListener("keydown", function (e) {
    if (HANDLED_MOVE_KEYS.indexOf(e.code) !== -1) {
      e.preventDefault();
      setKeyFromCode(e.code, true); // state-based: event hanya menulis status
      return;
    }
    if (e.code === "KeyR") { resetScene(); return; }
    if (e.code === "KeyP") { togglePlay(); return; }
    if (e.code === "KeyC") { cycleMainColor(); return; } // event-based: warna berubah 1x per event
  });
  canvas.addEventListener("keyup", function (e) {
    setKeyFromCode(e.code, false);
  });
  canvas.addEventListener("blur", function () {
    keys.up = keys.down = keys.left = keys.right = false;
  });

  function pixelToNDC(e) {
    var rect = canvas.getBoundingClientRect();
    var xPix = (e.clientX - rect.left) * (canvas.width / rect.width);
    var yPix = (e.clientY - rect.top) * (canvas.height / rect.height);
    return {
      x: (xPix / canvas.width) * 2 - 1,
      y: 1 - (yPix / canvas.height) * 2, // Y layar ke bawah -> Y NDC ke atas
    };
  }

  canvas.addEventListener("mousemove", function (e) {
    mouseNDC = pixelToNDC(e);
  });
  canvas.addEventListener("mouseleave", function () {
    mouseNDC = null;
  });
  canvas.addEventListener("click", function (e) {
    var ndc = pixelToNDC(e);
    var t = createDrawable("triangle", mainObj.colorMode);
    t.x = ndc.x; t.y = ndc.y;
    spawned.push(t);
  });

  /* =========================================================
     UPDATE & RENDER LOOP
     ========================================================= */
  var MAIN_STEP = 0.045; // NDC per frame @ speedMult = 1

  function updateMainObject() {
    var step = MAIN_STEP * speedMult;
    if (keys.up) mainObj.y += step;
    if (keys.down) mainObj.y -= step;
    if (keys.left) mainObj.x -= step;
    if (keys.right) mainObj.x += step;
    mainObj.x = clamp(mainObj.x, -1 + MOVER_MARGIN, 1 - MOVER_MARGIN);
    mainObj.y = clamp(mainObj.y, -1 + MOVER_MARGIN, 1 - MOVER_MARGIN);
  }

  // Challenge D: posisi += velocity tiap frame, lalu boundary check
  // membalik arah saat menyentuh batas NDC (-1..1).
  function updateMovers() {
    movers.forEach(function (o) {
      o.vx = o.baseVx * speedMult;
      o.vy = o.baseVy * speedMult;
      o.x += o.vx;
      o.y += o.vy;
      if (o.x - MOVER_MARGIN < -1) { o.x = -1 + MOVER_MARGIN; o.baseVx *= -1; }
      if (o.x + MOVER_MARGIN > 1) { o.x = 1 - MOVER_MARGIN; o.baseVx *= -1; }
      if (o.y - MOVER_MARGIN < -1) { o.y = -1 + MOVER_MARGIN; o.baseVy *= -1; }
      if (o.y + MOVER_MARGIN > 1) { o.y = 1 - MOVER_MARGIN; o.baseVy *= -1; }
    });
  }

  function updateHUD(ts) {
    if (fpsLastTs === null) fpsLastTs = ts;
    fpsFrames++;
    if (ts - fpsLastTs >= 500) {
      fps = Math.round((fpsFrames * 1000) / (ts - fpsLastTs));
      fpsFrames = 0;
      fpsLastTs = ts;
      els.fps.textContent = String(fps);
    }

    var total = 1 + movers.length + spawned.length;
    els.count.textContent = String(total);
    els.ndc.textContent = mouseNDC ? mouseNDC.x.toFixed(2) + ", " + mouseNDC.y.toFixed(2) : "-, -";

    els.readout.textContent = [
      "frame: " + frameCount,
      "playing: " + playing,
      "primitive: \"" + mainObj.shapeType + "\"",
      "drawMode: \"" + currentDrawModeName + "\"",
      "mainColor: \"" + mainObj.colorMode + "\"",
      "main: (" + mainObj.x.toFixed(2) + ", " + mainObj.y.toFixed(2) + ")",
      "spawned: " + spawned.length,
    ].join("\n");
  }

  function render(ts) {
    if (playing) {
      updateMainObject();
      updateMovers();
      frameCount++;
    }
    updateHUD(ts);

    gl.clearColor(0.035, 0.043, 0.078, 1.0); // biru gelap -- background non-default
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.useProgram(program);

    if (gridEnabled) {
      gl.uniform1f(UNIFORM_POINT_SIZE, 1.0);
      drawDrawable({ vao: gridVAO, count: gridCount }, gl.LINES);
      gl.uniform1f(UNIFORM_POINT_SIZE, 9.0);
    }

    var glMode = DRAW_MODE_GL[currentDrawModeName];

    movers.forEach(function (o) { syncWorldBuffer(o); drawDrawable(o, glMode); });
    spawned.forEach(function (o) { syncWorldBuffer(o); drawDrawable(o, glMode); });
    syncWorldBuffer(mainObj);
    drawDrawable(mainObj, glMode);

    requestAnimationFrame(render);
  }

  requestAnimationFrame(render);
})();
