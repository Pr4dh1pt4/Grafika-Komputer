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