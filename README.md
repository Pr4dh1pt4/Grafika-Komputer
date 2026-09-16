# Graphics Playground — Grafika Komputer

Situs web interaktif untuk praktikum Grafika Komputer berbasis Canvas 2D dan JavaScript murni.

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