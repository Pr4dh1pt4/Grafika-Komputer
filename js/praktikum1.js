(function () {
  "use strict";

  function clamp(v, min, max) {
    return Math.max(min, Math.min(max, v));
  }

  /* =========================================================
     1) PRIMITIVE DRAWER  (canvas 850x600)
     Menunjukkan bahwa gambar = data: posisi, ukuran, warna.
     ========================================================= */
  (function primitiveDrawer() {
    var canvas = document.getElementById("canvas-primitives");
    if (!canvas) return;
    var ctx = canvas.getContext("2d");

    var shapes = [];
    var currentShapeType = "rectangle";
    var dragging = false;
    var startPt = null;
    var currentPt = null;
    var draftStyle = null;
    var showGrid = true;

    var els = {
      count: document.getElementById("p1-count"),
      cursor: document.getElementById("p1-cursor"),
      readout: document.getElementById("p1-readout"),
      fill: document.getElementById("p1-fill"),
      stroke: document.getElementById("p1-stroke"),
      strokeWidth: document.getElementById("p1-strokewidth"),
      strokeWidthVal: document.getElementById("p1-strokewidth-val"),
      filled: document.getElementById("p1-filled"),
      grid: document.getElementById("p1-grid"),
      undo: document.getElementById("p1-undo"),
      clear: document.getElementById("p1-clear"),
      shapeBtns: document.querySelectorAll("#p1-shapes .btn"),
    };

    function getPos(e) {
      var rect = canvas.getBoundingClientRect();
      var scaleX = canvas.width / rect.width;
      var scaleY = canvas.height / rect.height;
      return {
        x: (e.clientX - rect.left) * scaleX,
        y: (e.clientY - rect.top) * scaleY,
      };
    }

    function drawGrid() {
      var step = 40;
      ctx.save();
      ctx.strokeStyle = "rgba(255,255,255,0.06)";
      ctx.lineWidth = 1;
      for (var x = 0; x <= canvas.width; x += step) {
        ctx.beginPath();
        ctx.moveTo(x + 0.5, 0);
        ctx.lineTo(x + 0.5, canvas.height);
        ctx.stroke();
      }
      for (var y = 0; y <= canvas.height; y += step) {
        ctx.beginPath();
        ctx.moveTo(0, y + 0.5);
        ctx.lineTo(canvas.width, y + 0.5);
        ctx.stroke();
      }
      ctx.fillStyle = "rgba(255,255,255,0.2)";
      ctx.font = "10px monospace";
      for (var xi = 0; xi <= canvas.width; xi += step * 2) {
        ctx.fillText(String(xi), xi + 3, 10);
      }
      for (var yi = step; yi <= canvas.height; yi += step * 2) {
        ctx.fillText(String(yi), 3, yi + 3);
      }
      ctx.restore();
    }

    // Semua bentuk direpresentasikan sebagai data murni (posisi + ukuran + warna).
    // Triangle secara eksplisit dibentuk dari TIGA koordinat vertex (p1, p2, p3).
    function buildShape(type, p1, p2, style) {
      var s = {
        type: type,
        fillColor: style.fillColor,
        strokeColor: style.strokeColor,
        strokeWidth: style.strokeWidth,
        filled: style.filled,
      };
      var x1 = Math.min(p1.x, p2.x), x2 = Math.max(p1.x, p2.x);
      var y1 = Math.min(p1.y, p2.y), y2 = Math.max(p1.y, p2.y);

      if (type === "rectangle") {
        s.x = x1; s.y = y1; s.w = x2 - x1; s.h = y2 - y1;
      } else if (type === "line") {
        s.x1 = p1.x; s.y1 = p1.y; s.x2 = p2.x; s.y2 = p2.y;
      } else if (type === "circle") {
        s.cx = p1.x; s.cy = p1.y;
        s.r = Math.hypot(p2.x - p1.x, p2.y - p1.y);
      } else if (type === "triangle") {
        var cx = (x1 + x2) / 2;
        s.p1 = { x: cx, y: y1 }; // vertex atas
        s.p2 = { x: x1, y: y2 }; // vertex kiri-bawah
        s.p3 = { x: x2, y: y2 }; // vertex kanan-bawah
      }
      return s;
    }

    function shapeHasSize(s) {
      if (s.type === "rectangle") return Math.abs(s.w) > 3 && Math.abs(s.h) > 3;
      if (s.type === "line") return Math.hypot(s.x2 - s.x1, s.y2 - s.y1) > 3;
      if (s.type === "circle") return s.r > 3;
      if (s.type === "triangle") return Math.abs(s.p3.x - s.p2.x) > 3 && Math.abs(s.p2.y - s.p1.y) > 3;
      return false;
    }

    function drawShape(s) {
      ctx.lineWidth = s.strokeWidth;
      ctx.fillStyle = s.fillColor;
      ctx.strokeStyle = s.strokeColor;
      ctx.beginPath();
      if (s.type === "rectangle") {
        ctx.rect(s.x, s.y, s.w, s.h);
      } else if (s.type === "line") {
        ctx.moveTo(s.x1, s.y1);
        ctx.lineTo(s.x2, s.y2);
      } else if (s.type === "circle") {
        ctx.arc(s.cx, s.cy, s.r, 0, Math.PI * 2);
      } else if (s.type === "triangle") {
        ctx.moveTo(s.p1.x, s.p1.y);
        ctx.lineTo(s.p2.x, s.p2.y);
        ctx.lineTo(s.p3.x, s.p3.y);
        ctx.closePath();
      }
      if (s.type === "line") {
        ctx.stroke();
      } else {
        if (s.filled) ctx.fill();
        ctx.stroke();
      }
    }

    function render() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      if (showGrid) drawGrid();
      shapes.forEach(drawShape);
      if (dragging && startPt && currentPt) {
        var preview = buildShape(currentShapeType, startPt, currentPt, draftStyle);
        ctx.globalAlpha = 0.7;
        drawShape(preview);
        ctx.globalAlpha = 1;
      }
      els.count.textContent = String(shapes.length);
    }

    function updateReadout(shape) {
      if (!shape) {
        els.readout.textContent = "// seret pada canvas untuk mulai menggambar";
        return;
      }
      var lines = ['type: "' + shape.type + '"'];
      if (shape.type === "rectangle") {
        lines.push(
          "x: " + Math.round(shape.x),
          "y: " + Math.round(shape.y),
          "width: " + Math.round(shape.w),
          "height: " + Math.round(shape.h)
        );
      } else if (shape.type === "line") {
        lines.push(
          "x1: " + Math.round(shape.x1),
          "y1: " + Math.round(shape.y1),
          "x2: " + Math.round(shape.x2),
          "y2: " + Math.round(shape.y2)
        );
      } else if (shape.type === "circle") {
        lines.push(
          "cx: " + Math.round(shape.cx),
          "cy: " + Math.round(shape.cy),
          "radius: " + Math.round(shape.r)
        );
      } else if (shape.type === "triangle") {
        lines.push(
          "p1: (" + Math.round(shape.p1.x) + ", " + Math.round(shape.p1.y) + ")",
          "p2: (" + Math.round(shape.p2.x) + ", " + Math.round(shape.p2.y) + ")",
          "p3: (" + Math.round(shape.p3.x) + ", " + Math.round(shape.p3.y) + ")"
        );
      }
      if (shape.type === "line") {
        lines.push('stroke: "' + shape.strokeColor + '"');
      } else {
        lines.push('fill: "' + shape.fillColor + '"', 'stroke: "' + shape.strokeColor + '"');
      }
      els.readout.textContent = lines.join("\n");
    }

    els.shapeBtns.forEach(function (btn) {
      btn.addEventListener("click", function () {
        els.shapeBtns.forEach(function (b) { b.classList.remove("active"); });
        btn.classList.add("active");
        currentShapeType = btn.getAttribute("data-shape");
      });
    });

    els.strokeWidth.addEventListener("input", function () {
      els.strokeWidthVal.textContent = els.strokeWidth.value;
    });

    els.grid.addEventListener("change", function () {
      showGrid = els.grid.checked;
      render();
    });

    els.undo.addEventListener("click", function () {
      shapes.pop();
      render();
      updateReadout(shapes[shapes.length - 1] || null);
    });

    els.clear.addEventListener("click", function () {
      shapes = [];
      render();
      updateReadout(null);
    });

    canvas.addEventListener("mousedown", function (e) {
      dragging = true;
      startPt = getPos(e);
      currentPt = startPt;
      draftStyle = {
        fillColor: els.fill.value,
        strokeColor: els.stroke.value,
        strokeWidth: parseInt(els.strokeWidth.value, 10),
        filled: els.filled.checked,
      };
      render();
    });

    canvas.addEventListener("mousemove", function (e) {
      var pos = getPos(e);
      els.cursor.textContent = Math.round(pos.x) + ", " + Math.round(pos.y);
      if (!dragging) return;
      currentPt = pos;
      render();
      updateReadout(buildShape(currentShapeType, startPt, currentPt, draftStyle));
    });

    window.addEventListener("mouseup", function (e) {
      if (!dragging) return;
      dragging = false;
      var pos = getPos(e);
      currentPt = pos;
      var finalShape = buildShape(currentShapeType, startPt, currentPt, draftStyle);
      if (shapeHasSize(finalShape)) {
        shapes.push(finalShape);
      }
      render();
      updateReadout(finalShape);
    });

    canvas.addEventListener("mouseleave", function () {
      if (!dragging) {
        els.cursor.textContent = "-, -";
      }
    });

    // Contoh awal: 3+ jenis primitive dan 4 warna berbeda sudah terlihat
    // begitu halaman dibuka, tanpa perlu interaksi (memenuhi syarat wajib
    // #2, #3, #4). Mahasiswa bebas menghapus (Clear) dan menggambar ulang.
    var PALETTE = { teal: "#5eead4", violet: "#a78bfa", pink: "#f472b6", amber: "#fbbf24" };
    shapes.push(buildShape(
      "rectangle", { x: 50, y: 60 }, { x: 260, y: 190 },
      { fillColor: PALETTE.teal, strokeColor: PALETTE.violet, strokeWidth: 3, filled: true }
    ));
    shapes.push(buildShape(
      "line", { x: 50, y: 230 }, { x: 320, y: 320 },
      { fillColor: PALETTE.violet, strokeColor: PALETTE.violet, strokeWidth: 4, filled: false }
    ));
    shapes.push(buildShape(
      "circle", { x: 520, y: 150 }, { x: 590, y: 150 },
      { fillColor: PALETTE.amber, strokeColor: PALETTE.pink, strokeWidth: 3, filled: true }
    ));
    shapes.push(buildShape( // triangle dari 3 koordinat vertex (syarat wajib #4)
      "triangle", { x: 560, y: 260 }, { x: 760, y: 430 },
      { fillColor: PALETTE.pink, strokeColor: PALETTE.amber, strokeWidth: 3, filled: true }
    ));

    render();
    updateReadout(shapes[shapes.length - 1]);
  })();

  /* =========================================================
     2) BOUNCING OBJECT — Challenge A  (canvas 850x600)
     Position + Velocity + Boundary Check, digerakkan oleh
     requestAnimationFrame().
     ========================================================= */
  (function bouncingObject() {
    var canvas = document.getElementById("canvas-anim");
    if (!canvas) return;
    var ctx = canvas.getContext("2d");

    var balls = [];
    var playing = true;
    var speedMult = 1;
    var gravity = false;
    var lastTime = null;
    var frameCount = 0;

    var els = {
      count: document.getElementById("p2-count"),
      status: document.getElementById("p2-status"),
      readout: document.getElementById("p2-readout"),
      playpause: document.getElementById("p2-playpause"),
      reset: document.getElementById("p2-reset"),
      clearballs: document.getElementById("p2-clearballs"),
      speed: document.getElementById("p2-speed"),
      speedVal: document.getElementById("p2-speed-val"),
      gravity: document.getElementById("p2-gravity"),
      hbar: document.getElementById("p2-hbar"),
    };

    // Objek bouncing yang HANYA bergerak horizontal: vy dikunci ke 0 selamanya,
    // posisi Y tidak pernah berubah, dan boundary check cuma dilakukan pada
    // sumbu X. Ini contoh gerakan yang dibatasi ke satu sumbu saja.
    function makeHBar() {
      return {
        x: canvas.width / 2,
        y: canvas.height - 70,
        w: 110,
        h: 24,
        vx: 3.2,
        color: "#fbbf24",
      };
    }
    var hbar = makeHBar();

    function getPos(e) {
      var rect = canvas.getBoundingClientRect();
      var scaleX = canvas.width / rect.width;
      var scaleY = canvas.height / rect.height;
      return {
        x: (e.clientX - rect.left) * scaleX,
        y: (e.clientY - rect.top) * scaleY,
      };
    }

    function randomColor() {
      var hue = Math.floor(Math.random() * 360);
      return "hsl(" + hue + ", 80%, 65%)";
    }

    function spawnBall(x, y) {
      var angle = Math.random() * Math.PI * 2;
      var speed = 2 + Math.random() * 3;
      balls.push({
        x: x,
        y: y,
        r: 10 + Math.random() * 14,
        vx: Math.cos(angle) * speed, // velocity
        vy: Math.sin(angle) * speed, // velocity
        color: randomColor(),
      });
    }

    spawnBall(canvas.width * 0.25, canvas.height * 0.3);
    spawnBall(canvas.width * 0.55, canvas.height * 0.4);
    spawnBall(canvas.width * 0.4, canvas.height * 0.65);

    // Mouse event -> spawn (contoh interaksi mouse tambahan di luar Follow Mouse).
    canvas.addEventListener("click", function (e) {
      var pos = getPos(e);
      spawnBall(pos.x, pos.y);
    });

    function togglePlay() {
      playing = !playing;
      els.playpause.textContent = playing ? "Pause" : "Play";
      els.status.textContent = playing ? "Berjalan" : "Pause";
    }
    els.playpause.addEventListener("click", togglePlay);

    // Space sebagai shortcut play/pause, kecuali sedang mengetik di kontrol lain.
    window.addEventListener("keydown", function (e) {
      if (e.code !== "Space") return;
      var tag = (document.activeElement && document.activeElement.tagName) || "";
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || tag === "BUTTON") return;
      e.preventDefault();
      togglePlay();
    });

    els.reset.addEventListener("click", function () {
      balls = [];
      spawnBall(canvas.width * 0.25, canvas.height * 0.3);
      spawnBall(canvas.width * 0.55, canvas.height * 0.4);
      hbar = makeHBar();
    });

    els.clearballs.addEventListener("click", function () {
      balls = [];
    });

    els.speed.addEventListener("input", function () {
      speedMult = parseFloat(els.speed.value);
      els.speedVal.textContent = speedMult.toFixed(1) + "x";
    });

    els.gravity.addEventListener("change", function () {
      gravity = els.gravity.checked;
    });

    // Inti Challenge A: posisi += velocity setiap frame, lalu boundary check
    // membalik arah kecepatan ketika bola menyentuh tepi canvas.
    function updateBalls(dt) {
      balls.forEach(function (b) {
        if (gravity) b.vy += 0.12 * dt;
        b.x += b.vx * dt; // position += velocity
        b.y += b.vy * dt;

        if (b.x - b.r < 0) { b.x = b.r; b.vx *= -1; }                       // boundary check kiri
        if (b.x + b.r > canvas.width) { b.x = canvas.width - b.r; b.vx *= -1; }   // boundary check kanan
        if (b.y - b.r < 0) { b.y = b.r; b.vy *= -1; }                       // boundary check atas
        if (b.y + b.r > canvas.height) {                                    // boundary check bawah
          b.y = canvas.height - b.r;
          b.vy *= -1;
          if (gravity) b.vy *= 0.85;
        }
      });

      // Gerak horizontal-saja: HANYA x yang berubah, y tetap konstan, dan
      // gravitasi (yang cuma mengubah vy) sengaja tidak pernah disentuh di sini.
      hbar.x += hbar.vx * dt; // position.x += velocity.x  (tidak ada komponen y)
      if (hbar.x - hbar.w / 2 < 0) { hbar.x = hbar.w / 2; hbar.vx *= -1; }                       // boundary check kiri
      if (hbar.x + hbar.w / 2 > canvas.width) { hbar.x = canvas.width - hbar.w / 2; hbar.vx *= -1; } // boundary check kanan
    }

    function updateReadout() {
      els.readout.textContent = [
        "frame: " + frameCount,
        "playing: " + playing,
        "speed: " + speedMult.toFixed(1) + "x",
        "gravity: " + gravity,
        "balls: " + balls.length,
        "hbar.x: " + Math.round(hbar.x) + " (y tetap: " + hbar.y + ", vy: 0)",
      ].join("\n");
    }

    function renderAnim() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      balls.forEach(function (b) {
        ctx.beginPath();
        ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
        ctx.fillStyle = b.color;
        ctx.fill();
      });

      ctx.fillStyle = hbar.color;
      ctx.fillRect(hbar.x - hbar.w / 2, hbar.y - hbar.h / 2, hbar.w, hbar.h);
      ctx.lineWidth = 2;
      ctx.strokeStyle = "rgba(255,255,255,0.5)";
      ctx.strokeRect(hbar.x - hbar.w / 2, hbar.y - hbar.h / 2, hbar.w, hbar.h);

      els.count.textContent = String(balls.length);
      els.hbar.textContent = "x=" + Math.round(hbar.x) + ", vy=0";
    }

    function loop(ts) {
      if (lastTime === null) lastTime = ts;
      var deltaMs = ts - lastTime;
      lastTime = ts;

      if (playing) {
        var dt = clamp((deltaMs / 16.6667) * speedMult, 0, 4);
        updateBalls(dt);
        frameCount++;
      }

      renderAnim();
      if (frameCount % 6 === 0) updateReadout();

      requestAnimationFrame(loop);
    }

    requestAnimationFrame(loop);
  })();

  /* =========================================================
     3) FOLLOW MOUSE — Challenge B & C  (canvas 850x600)
     EVENT-BASED: posisi & warna hanya berubah di dalam event
     handler itu sendiri. Tidak ada requestAnimationFrame loop
     yang menggerakkan objek ini.
     ========================================================= */
  (function followMouse() {
    var canvas = document.getElementById("canvas-follow");
    if (!canvas) return;
    var ctx = canvas.getContext("2d");

    var PALETTE = ["#5eead4", "#a78bfa", "#f472b6", "#fbbf24", "#60a5fa", "#34d399"];
    var circle = { x: canvas.width / 2, y: canvas.height / 2, r: 26, color: PALETTE[0] };
    var clicks = 0;
    var trail = true;

    var els = {
      cursor: document.getElementById("p3-cursor"),
      clicks: document.getElementById("p3-clicks"),
      readout: document.getElementById("p3-readout"),
      trailCheck: document.getElementById("p3-trail"),
      resetBtn: document.getElementById("p3-reset"),
    };

    function randomColor() {
      return PALETTE[Math.floor(Math.random() * PALETTE.length)];
    }

    function getPos(e) {
      var rect = canvas.getBoundingClientRect();
      var scaleX = canvas.width / rect.width;
      var scaleY = canvas.height / rect.height;
      return {
        x: (e.clientX - rect.left) * scaleX,
        y: (e.clientY - rect.top) * scaleY,
      };
    }

    function draw() {
      if (trail) {
        // clear tidak solid -> jejak lingkaran sebelumnya memudar perlahan
        ctx.fillStyle = "rgba(10, 12, 18, 0.25)";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      } else {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
      ctx.beginPath();
      ctx.arc(circle.x, circle.y, circle.r, 0, Math.PI * 2);
      ctx.fillStyle = circle.color;
      ctx.fill();
      ctx.lineWidth = 3;
      ctx.strokeStyle = "rgba(255,255,255,0.6)";
      ctx.stroke();
    }

    function updateReadout() {
      els.readout.textContent = [
        'event: "mousemove"',
        "circle.x = " + Math.round(circle.x),
        "circle.y = " + Math.round(circle.y),
        'color: "' + circle.color + '"',
        "clicks: " + clicks,
      ].join("\n");
    }

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    draw();
    updateReadout();

    canvas.addEventListener("mousemove", function (e) {
      var pos = getPos(e);
      // Inti Challenge B: assignment langsung, bukan hasil polling per-frame.
      circle.x = pos.x;
      circle.y = pos.y;
      els.cursor.textContent = Math.round(pos.x) + ", " + Math.round(pos.y);
      draw();
      updateReadout();
    });

    canvas.addEventListener("click", function () {
      clicks++;
      circle.color = randomColor(); // Challenge C: warna berubah saat diklik
      els.clicks.textContent = String(clicks);
      draw();
      updateReadout();
    });

    canvas.addEventListener("mouseleave", function () {
      els.cursor.textContent = "-, -";
    });

    els.trailCheck.addEventListener("change", function () {
      trail = els.trailCheck.checked;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      draw();
    });

    els.resetBtn.addEventListener("click", function () {
      circle.color = randomColor();
      clicks = 0;
      els.clicks.textContent = "0";
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      draw();
      updateReadout();
    });
  })();

  /* =========================================================
     4) KEYBOARD STEP  (canvas 850x600)
     EVENT-BASED: hanya event keydown yang boleh mengubah
     `box.targetX/targetY` -- itu satu-satunya "sumber kebenaran"
     posisi, dan berubah semata karena browser menembakkan event
     (termasuk native key-repeat saat tombol ditahan, tidak lagi
     diabaikan). Loop requestAnimationFrame di bawah HANYA dipakai
     untuk melukis interpolasi (easing) menuju target itu supaya
     terasa halus -- ia tidak pernah menambah jarak sendiri seperti
     loop pada canvas Keyboard Translation (state-based) di bawah.
     ========================================================= */
  (function keyboardStep() {
    var canvas = document.getElementById("canvas-key-event");
    if (!canvas) return;
    var ctx = canvas.getContext("2d");

    var STEP = 16;   // jarak yang ditambahkan ke target per event keydown
    var EASE = 0.22; // kecepatan mengejar target tiap frame (0-1, makin besar makin cepat)

    var box = {
      x: canvas.width / 2, y: canvas.height / 2,             // posisi yang digambar (dieaskan / mulus)
      targetX: canvas.width / 2, targetY: canvas.height / 2, // posisi tujuan, HANYA diubah oleh event
      size: 30, color: "#f472b6",
    };
    var stepCount = 0;
    var log = [];

    // Arah gerak per kode tombol -- disimpan sebagai data, bukan logika if/else berulang.
    var DIRS = {
      ArrowUp: { dx: 0, dy: -STEP }, KeyW: { dx: 0, dy: -STEP },
      ArrowDown: { dx: 0, dy: STEP }, KeyS: { dx: 0, dy: STEP },
      ArrowLeft: { dx: -STEP, dy: 0 }, KeyA: { dx: -STEP, dy: 0 },
      ArrowRight: { dx: STEP, dy: 0 }, KeyD: { dx: STEP, dy: 0 },
    };

    var els = {
      pos: document.getElementById("p4b-pos"),
      steps: document.getElementById("p4b-steps"),
      readout: document.getElementById("p4b-readout"),
      resetBtn: document.getElementById("p4b-reset"),
    };

    function pushLog(code, dir) {
      var sign = function (n) { return n > 0 ? "+" + n : String(n); };
      log.unshift(code + " -> dx:" + sign(dir.dx) + " dy:" + sign(dir.dy));
      if (log.length > 6) log.pop();
      els.readout.textContent = log.join("\n");
    }

    canvas.addEventListener("keydown", function (e) {
      var dir = DIRS[e.code];
      if (!dir) return;
      e.preventDefault();
      // Native key-repeat browser TIDAK diabaikan lagi: menahan tombol akan
      // membuat browser terus menembakkan event keydown berulang, sehingga
      // target terus bergerak tanpa perlu tap-tap manual.
      var half = box.size / 2;
      box.targetX = clamp(box.targetX + dir.dx, half, canvas.width - half);
      box.targetY = clamp(box.targetY + dir.dy, half, canvas.height - half);
      stepCount++;
      els.steps.textContent = String(stepCount);
      pushLog(e.code, dir);
    });

    els.resetBtn.addEventListener("click", function () {
      box.x = box.targetX = canvas.width / 2;
      box.y = box.targetY = canvas.height / 2;
      stepCount = 0;
      log = [];
      els.steps.textContent = "0";
      els.readout.textContent = "// tahan tombol panah/WASD -- tidak perlu tap-tap";
    });

    function render() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      ctx.strokeStyle = "rgba(255,255,255,0.05)";
      ctx.lineWidth = 1;
      for (var x = 0; x <= canvas.width; x += 50) {
        ctx.beginPath(); ctx.moveTo(x + 0.5, 0); ctx.lineTo(x + 0.5, canvas.height); ctx.stroke();
      }
      for (var y = 0; y <= canvas.height; y += 50) {
        ctx.beginPath(); ctx.moveTo(0, y + 0.5); ctx.lineTo(canvas.width, y + 0.5); ctx.stroke();
      }

      // Easing: posisi gambar mengejar target sedikit demi sedikit tiap
      // frame -- inilah yang membuat gerakannya terlihat mulus.
      box.x += (box.targetX - box.x) * EASE;
      box.y += (box.targetY - box.y) * EASE;

      var half = box.size / 2;
      ctx.fillStyle = box.color;
      ctx.fillRect(box.x - half, box.y - half, box.size, box.size);
      ctx.lineWidth = 2;
      ctx.strokeStyle = "rgba(255,255,255,0.6)";
      ctx.strokeRect(box.x - half, box.y - half, box.size, box.size);

      els.pos.textContent = Math.round(box.x) + ", " + Math.round(box.y);
    }

    function loop() {
      render();
      requestAnimationFrame(loop);
    }

    render();
    requestAnimationFrame(loop);
  })();

  /* =========================================================
     5) KEYBOARD TRANSLATION — Challenge D  (canvas 850x600)
     STATE-BASED: keydown/keyup hanya menyimpan status ke objek
     keys{}. requestAnimationFrame membaca status itu setiap
     frame dan menerapkan translasi selama tombol masih ditahan.
     ========================================================= */
  (function keyboardTranslation() {
    var canvas = document.getElementById("canvas-keystate");
    if (!canvas) return;
    var ctx = canvas.getContext("2d");

    var colors = [
      "#9b59b6",
      "#e74c3c",
      "#2ecc71",
      "#f1c40f",
      "#3498db"
    ];
    var colorIndex = 0;

    var keys = { up: false, down: false, left: false, right: false }; // <- state
    var player = { x: canvas.width / 2, y: canvas.height / 2, size: 30, speed: 4, color: colors[0] };

    var els = {
      pos: document.getElementById("p4-pos"),
      readout: document.getElementById("p4-readout"),
      resetBtn: document.getElementById("p4-reset"),
      badges: document.querySelectorAll(".key-badge[data-key]"),
    };

    // Fitur Interaksi Klik (BAGIAN H — Langkah 17 & Challenge C):
    // Mengubah warna player secara berurutan ketika canvas diklik
    canvas.addEventListener("click", function () {
      colorIndex = (colorIndex + 1) % colors.length;
      player.color = colors[colorIndex];
    });

    function setKeyFromCode(code, value) {
      if (code === "ArrowUp" || code === "KeyW") keys.up = value;
      else if (code === "ArrowDown" || code === "KeyS") keys.down = value;
      else if (code === "ArrowLeft" || code === "KeyA") keys.left = value;
      else if (code === "ArrowRight" || code === "KeyD") keys.right = value;
    }

    var HANDLED_CODES = ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "KeyW", "KeyA", "KeyS", "KeyD"];

    canvas.addEventListener("keydown", function (e) {
      if (HANDLED_CODES.indexOf(e.code) !== -1) e.preventDefault();
      setKeyFromCode(e.code, true); // event hanya menulis ke state, tidak menggerakkan objek
    });
    canvas.addEventListener("keyup", function (e) {
      setKeyFromCode(e.code, false);
    });
    canvas.addEventListener("blur", function () {
      keys.up = keys.down = keys.left = keys.right = false;
    });

    els.resetBtn.addEventListener("click", function () {
      player.x = canvas.width / 2;
      player.y = canvas.height / 2;
    });

    // Dibaca ulang setiap frame -- inilah bagian "state-based" dari pola ini.
    function update() {
      if (keys.up) player.y -= player.speed;
      if (keys.down) player.y += player.speed;
      if (keys.left) player.x -= player.speed;
      if (keys.right) player.x += player.speed;
      var half = player.size / 2;
      player.x = clamp(player.x, half, canvas.width - half);
      player.y = clamp(player.y, half, canvas.height - half);
    }

    function render() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      ctx.strokeStyle = "rgba(255,255,255,0.05)";
      ctx.lineWidth = 1;
      for (var x = 0; x <= canvas.width; x += 50) {
        ctx.beginPath(); ctx.moveTo(x + 0.5, 0); ctx.lineTo(x + 0.5, canvas.height); ctx.stroke();
      }
      for (var y = 0; y <= canvas.height; y += 50) {
        ctx.beginPath(); ctx.moveTo(0, y + 0.5); ctx.lineTo(canvas.width, y + 0.5); ctx.stroke();
      }

      var half = player.size / 2;
      ctx.fillStyle = player.color;
      ctx.fillRect(player.x - half, player.y - half, player.size, player.size);
      ctx.lineWidth = 2;
      ctx.strokeStyle = "rgba(255,255,255,0.6)";
      ctx.strokeRect(player.x - half, player.y - half, player.size, player.size);

      els.pos.textContent = Math.round(player.x) + ", " + Math.round(player.y);
      els.badges.forEach(function (b) {
        b.classList.toggle("active", !!keys[b.getAttribute("data-key")]);
      });
      els.readout.textContent = [
        "keys.up: " + keys.up,
        "keys.down: " + keys.down,
        "keys.left: " + keys.left,
        "keys.right: " + keys.right,
        "player: (" + Math.round(player.x) + ", " + Math.round(player.y) + ")",
        'player.color: "' + player.color + '" (klik canvas untuk ganti)',
      ].join("\n");
    }

    function loop() {
      update();
      render();
      requestAnimationFrame(loop);
    }

    render();
    requestAnimationFrame(loop);
  })();
})();
