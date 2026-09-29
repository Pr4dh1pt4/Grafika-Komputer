# Graphics Playground — Grafika Komputer

Situs web interaktif untuk praktikum Grafika Komputer, mencakup Canvas 2D, WebGL2, dan
transformasi matriks — dibangun dengan HTML, CSS, dan JavaScript murni.

## 🚀 Fitur Utama

### 1. Dashboard Navigasi
- Navigasi sidebar interaktif untuk mengakses modul-modul praktikum.
- Tampilan responsif dan terintegrasi dalam satu tempat.

### 2. Praktikum 1 — Canvas 2D Dasar

* **Primitive Drawer (Penggambar Bentuk 2D)**
  - Menggambar objek primitif 2D (Rectangle, Line, Circle, Triangle) secara interaktif (klik & seret).
  - Kustomisasi warna *fill*, warna *stroke*, dan ketebalan garis (*stroke width*).
  - Opsi menampilkan grid koordinat canvas.
  - Tombol Undo dan Clear untuk mengelola objek yang digambar.
  - Menampilkan data posisi & koordinat bentuk secara *live*.

* **Bouncing Object (Animasi Memantul)**
  - Simulasi bola memantul ke segala arah dan batang yang bergerak horizontal.
  - Klik canvas untuk menambah bola baru dengan warna acak.
  - Kontrol kecepatan animasi (0.2x – 3.0x), tombol Pause/Play, Reset, dan Clear.
  - Fitur opsional simulasi gravitasi.

* **Follow Mouse (Interaksi Event-Based)**
  - Objek lingkaran yang mengikuti pergerakan kursor mouse secara langsung (`mousemove`).
  - Efek jejak (*trail*) pergerakan kursor.
  - Mengubah warna objek secara acak ketika canvas diklik (`click`).

* **Keyboard Step (Interaksi Keyboard Event-Based)**
  - Mengontrol pergerakan objek berbasis event tombol keyboard (Tombol Panah / WASD).
  - Pergerakan langkah bertahap dengan efek *easing*.

* **Keyboard Translation (Interaksi Keyboard State-Based)**
  - Pergerakan objek secara halus berbasis status tombol keyboard yang aktif (`keys{}`).
  - Visualisasi indikator status tombol panah/WASD secara *real-time*.
  - Mengubah warna *player* saat canvas diklik.

* **Visualisasi Koordinat & Data Real-time**
  - Pemantauan koordinat kursor mouse dan status objek secara *live* pada setiap panel canvas.

### 3. Praktikum 2 — WebGL Fundamental

Praktikum 2 merupakan playground interaktif untuk mempelajari dasar WebGL2. Berbeda dari
Canvas 2D pada Praktikum 1, proses penggambaran pada praktikum ini menggunakan GPU melalui
*buffer*, *attribute*, dan shader.

* **Primitive Selector**
  - Memilih bentuk Triangle, Rectangle, Line-based Shape, atau Points.
  - Rectangle dibuat dari dua triangle untuk menunjukkan cara penyusunan primitive WebGL.

* **Draw Mode**
  - Menggambar data vertex menggunakan `TRIANGLES`, `LINE_STRIP`, atau `POINTS`.
  - Data vertex yang sama dapat menghasilkan tampilan berbeda hanya dengan mengganti *draw mode*.

* **Shader dan Graphics Pipeline**
  - Membuat WebGL2 context, mengompilasi vertex shader dan fragment shader, lalu menghubungkannya
    menjadi satu program WebGL.
  - Vertex shader mengatur posisi vertex, sedangkan fragment shader menentukan warna pixel.
  - Warna antar-vertex diinterpolasi otomatis oleh GPU saat proses rasterisasi.

* **Kontrol Warna**
  - Memilih warna Red, Green, Blue, Cyan, atau Random untuk objek utama.
  - Mode Random memberi warna berbeda pada setiap vertex sehingga menghasilkan gradasi warna.

* **Animasi dan Objek Bergerak**
  - Objek utama dapat digerakkan menggunakan tombol panah atau `WASD`.
  - Tiga objek tambahan bergerak otomatis dan memantul pada batas koordinat NDC.
  - Slider *Movement Speed* mengatur kecepatan pergerakan objek.
  - Tombol `Pause (P)` menghentikan atau melanjutkan animasi, sedangkan `Reset (R)` mengembalikan
    posisi objek ke kondisi awal.

* **Interaksi Mouse**
  - Klik pada canvas untuk membuat triangle baru pada posisi klik.
  - Koordinat pixel mouse dikonversi ke koordinat NDC WebGL dengan rentang `-1` sampai `1`.
  - Posisi mouse ditampilkan secara real-time pada HUD.
  - Tombol `Clear Spawned` menghapus seluruh triangle yang dibuat melalui klik.

* **Procedural Grid**
  - Grid koordinat dibuat secara otomatis menggunakan perulangan JavaScript.
  - Grid dapat ditampilkan atau disembunyikan melalui checkbox `Procedural grid pattern`.

* **HUD Real-time**
  - Menampilkan FPS, jumlah primitive, draw mode aktif, dan koordinat mouse dalam NDC.
  - Panel *Frame data* menampilkan status animasi, tipe primitive, warna, posisi objek utama,
    serta jumlah objek hasil spawn.

Alur utama WebGL pada praktikum ini adalah:

```text
Vertex Buffer -> Vertex Shader -> Primitive Assembly -> Rasterization
-> Fragment Shader -> Framebuffer -> Layar
```

Rendering dijalankan berulang menggunakan `requestAnimationFrame()`. Posisi dunia setiap objek
dihitung ulang pada setiap frame, kemudian dikirim kembali ke GPU menggunakan
`gl.bufferSubData()`.

### 4. Praktikum 3 — Interactive Transformation Playground

Praktikum 3 melanjutkan Praktikum 2 dengan fokus pada transformasi 2D: triangle yang sama kini
dipindah, diputar, dan diskalakan murni lewat matriks 3×3, tanpa pernah mengubah vertex buffer.

* **Geometry Buffer Bersama**
  - Satu triangle geometry dipakai ulang oleh seluruh objek (Object A, Object B, child, dan orbiter).
  - Yang membedakan posisi/rotasi/skala tiap objek hanya nilai uniform `u_matrix` yang dikirim
    sebelum tiap `gl.drawArrays()`.

* **Matrix Transformasi**
  - Translation, rotation, uniform scaling, dan non-uniform scaling masing-masing dibangun sebagai
    matriks 3×3, lalu digabung lewat matrix multiplication menjadi satu Model Matrix
    (Translation × Rotation × Scaling).
  - Posisi vertex dikonversi ke homogeneous coordinate `(x, y, 1)` sebelum dikalikan dengan Model
    Matrix di vertex shader.

* **Object A (Kontrol Keyboard)**
  - Translasi dengan tombol panah, rotasi dengan `Q`/`E`, scaling uniform dengan `+`/`-`, scaling
    non-uniform dengan `Z`/`X` (sumbu X) dan `C`/`V` (sumbu Y).
  - Seluruh kontrol bersifat *state-based* dan memakai `deltaTime` supaya kecepatan gerak konsisten
    di semua frame rate.

* **Object B (Animasi Otomatis)**
  - Berputar dan membesar-mengecil secara otomatis mengikuti gelombang sinus.
  - Dapat dinonaktifkan lewat checkbox `Auto B`.

* **Challenge A — Reset Transform**
  - Tombol `Reset` / tombol `R` mengembalikan posisi, rotasi, dan skala Object A ke kondisi awal.

* **Challenge B — Transform Preset**
  - Tombol Preset 1/2/3 atau tombol `1`, `2`, `3` menerapkan tiga preset transformasi berbeda pada
    Object A.

* **Challenge C — Toggle Transform Order**
  - Tombol `Toggle Order` / tombol `T` mengganti urutan perkalian matrix (`T × R × S` vs
    `S × R × T`) dan menampilkan urutan aktif pada HUD.

* **Challenge D — Mouse Translation**
  - Klik pada canvas memindahkan Object A ke posisi tersebut; koordinat pixel dikonversi ke NDC
    terlebih dahulu, sama seperti pada Praktikum 2.

* **Challenge E — Parent & Child**
  - Sebuah objek child memiliki transformasi lokal sendiri, lalu digabung dengan matrix Object B
    (`childWorldMatrix = parentMatrix × childLocalMatrix`) sehingga ikut bergerak setiap kali
    parent-nya bertransformasi.

* **Challenge F — Simple Orbit**
  - Sebuah objek mengorbit titik pusat (0,0) murni lewat komposisi matrix (rotasi + translasi
    radius + skala), bukan simulasi fisika/kecepatan.

* **Elemen Visual Bantu**
  - World axes (sumbu X merah, sumbu Y hijau), marker origin, dan marker pivot tiap objek — semua
    dapat ditampilkan/disembunyikan lewat checkbox.

* **HUD Transform Real-time**
  - Menampilkan posisi, rotasi, skala, urutan transform aktif, `deltaTime`, dan isi matriks
    `u_matrix` (3×3) Object A secara live — berguna untuk debugging transformasi.

Alur utama transformasi pada praktikum ini adalah:

```text
Local Coordinate (x, y, 1) -> Model Matrix (T x R x S) -> u_matrix (uniform)
-> Clip Space / NDC -> Screen
```

Rendering dijalankan berulang menggunakan `requestAnimationFrame()`, dengan `deltaTime` dihitung
setiap frame agar kecepatan translasi, rotasi, dan animasi otomatis tetap konsisten meskipun
frame rate berubah-ubah.

### 5. Praktikum 4 — Camera, Projection & 3D

Praktikum 4 melanjutkan transformasi 2D menuju pipeline 3D menggunakan cube WebGL2 dengan 36
vertex, warna per sisi, serta matrix 4×4 untuk Model, View, dan Projection.

* **Camera dan View Matrix**
  - Kamera menggunakan position, target, dan up vector melalui helper `Mat4.lookAt()`.
  - Tombol panah mengubah posisi X/Y, `W`/`S` mengubah Z, sedangkan `Page Up`/`Page Down`
    mengontrol tinggi kamera (Challenge B).
  - Checkbox Orbit mengaktifkan kamera yang bergerak melingkar mengitari target (Challenge A).

* **Projection dan Clipping**
  - Pilih Perspective atau Orthographic. FOV Perspective dapat diatur dari 30° sampai 100°.
  - Tombol `N` mengganti preset near/far: `0.1 / 100`, `1 / 20`, dan `2.5 / 8`.
  - Aspect ratio dihitung dari ukuran canvas setiap frame.

* **Depth, Animasi, dan HUD**
  - Depth Test dapat diaktifkan/dimatikan; color dan depth buffer dibersihkan pada setiap frame.
  - Cube berotasi otomatis, dengan kontrol untuk menghentikan rotasi.
  - HUD menampilkan projection, posisi camera, FOV, near/far, depth state, FPS, dan View Matrix.

Kontrol keyboard: panah untuk kamera X/Y, `W`/`S` untuk Z, `Page Up`/`Page Down` untuk tinggi,
`P` untuk projection, `[`/`]` untuk FOV, `N` untuk near/far, `D` untuk depth test, dan `R` untuk
reset. Jalankan situs melalui local development server, lalu buka `praktikum4.html`.

Alur pipeline:

```text
Local Position -> Model Matrix -> World -> View Matrix -> View
-> Projection Matrix -> Clip -> Perspective Divide -> NDC -> Screen
```

### 6. Praktikum 5 — Textured and Lit Object Playground

Praktikum 5 melanjutkan pipeline 3D dengan geometri ber-UV, pencahayaan per-fragment,
tekstur yang dapat dikonfigurasi, serta kontrol kamera dan point light. Buka `praktikum5.html`
melalui local server agar modul ES dan image texture SVG dimuat pada origin yang sama.

* **Geometri dan normal**
  - Kubus, torus, torus knot, dan bola dibuat langsung dengan JavaScript, tanpa library tambahan.
  - Setiap mesh memiliki position, face normal, smooth vertex normal, UV, dan color. VAO flat/smooth
    dibangun sekali dan dipakai ulang saat bentuk atau mode shading diganti.
  - Normal ditransformasi dengan inverse-transpose dari bagian 3×3 Model Matrix dan dinormalisasi
    lagi pada fragment shader.

* **Lighting**
  - Fragment shader menghitung ambient, diffuse Lambert, dan specular Blinn-Phong dengan point light.
  - Slider mengubah ambient strength, shininess, posisi lampu, serta non-uniform scale.
  - Ambient, diffuse, dan specular dapat diaktifkan secara terpisah.
  - Persamaan per-fragment: `ambient = k_a × lightColor`, `diffuse = max(dot(N, L), 0) × lightColor`,
    `specular = pow(max(dot(N, H), 0), shininess) × lightColor`, lalu
    `final = textureColor × (ambient + diffuse) + specular`.

* **Texture**
  - Checkerboard dibuat melalui Canvas API; image texture berasal dari `texture.svg`.
  - Filtering menyediakan NEAREST, LINEAR, dan LINEAR dengan mipmap. Wrapping mendukung REPEAT
    serta CLAMP_TO_EDGE; UV mesh sengaja melampaui rentang 0–1 agar wrapping dapat diamati.

* **Bentuk, kamera, dan animasi**
  - Bentuk melengkung otomatis memilih smooth normal; kubus otomatis memakai flat normal. Tombol F
    tetap dapat menukar mode secara manual.
  - Object rotation dapat dihentikan/dilanjutkan dengan P tanpa menjeda camera orbit atau light orbit.
    Camera orbit dan light orbit memiliki state dan timer masing-masing.
  - Panah menggerakkan lampu pada X/Y, W/S mengubah Z lampu, Q/E mengubah azimuth kamera, T
    mengaktifkan texture, L mengaktifkan orbit lampu, dan R mereset seluruh scene.

HUD menampilkan bentuk, shading, posisi light, sumber texture, filtering, wrapping, mode normal,
dan FPS. Belum ada perhitungan bayangan antarpermukaan (self-shadow).