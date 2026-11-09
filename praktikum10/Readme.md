
# Praktikum 10
# UV Mapping & PBR Material: GameBot Red Edition

## 1. Identitas Kelompok

| Keterangan | Isi |
|---|---|
| Anggota 1 | Agil Lukman Hakim Muchdi - 5025241037 |
| Anggota 2 | Pradhipta Raja Mahendra - 5025241055 |
| Kelompok | Murid Bapak |

## 2. Deskripsi Asset

- **Nama Asset:** GameBot Red Edition
- **Deskripsi:** Robot kecil bergaya game dengan badan berwarna merah, rangka logam, serta emission pada mata dan indikator.
- **File Blender:** `P10_Kelompok Murid Bapak_GameBot.blend`
- **Asal Asset:** Asset Sendiri

## 3. UV Mapping

- **Strategi Seam:** Seam ditempatkan pada bagian tersembunyi, sambungan antar-part, dan bagian belakang model untuk mengurangi bekas potongan yang terlihat.
- **UV Island:** Dipisahkan berdasarkan bagian kepala, badan, lengan, kaki, dan rangka.
- **Distortion:** Diperiksa menggunakan UV Checker. Perbaikan dilakukan melalui penambahan seam, Unwrap ulang, dan penyesuaian UV Island jika diperlukan.
- **Texel Density:** Diseragamkan menggunakan Average Island Scale.
- **Packing:** Menggunakan Pack Islands dengan margin yang disesuaikan terhadap resolusi tekstur.

Screenshot:
- `screenshots/01_asset_sebelum_uv.png`
- `screenshots/02_marked_seam.png`
- `screenshots/03_initial_unwrap.png`
- `screenshots/04_checker_test.png`
- `screenshots/05_final_uv_layout.png`

## 4. PBR Material dan Texture Maps

Material menggunakan beberapa texture map berikut:

| Map | Color Space | Fungsi |
|---|---|---|
| Base Color | sRGB | Warna utama merah |
| Roughness | Non-Color | Tingkat kekasaran |
| Metallic | Non-Color | Tingkat sifat logam |
| Normal | Non-Color | Detail permukaan melalui Normal Map node |
| Emission | sRGB | Efek cahaya pada mata dan indikator |

Pembagian material:
- **Metal:** Rangka dan bagian sendi.
- **Non-metal:** Badan bercat merah dan bagian non-logam.
- **Emission:** Mata dan indikator.
- **Normal Detail:** Detail permukaan seperti garis panel dan baut.

Screenshot:
- `screenshots/06_pbr_node_graph.png`
- `screenshots/07_texture_maps.png`

## 5. Challenge

1. **Metal + Painted Surface:** Memisahkan bagian logam dan permukaan cat merah menggunakan Metallic dan Roughness.
2. **Custom Emission Mask:** Memberikan efek emission pada bagian mata dan indikator.

Screenshot: `screenshots/08_challenge.png`

## 6. Tugas Tambahan – Eksplorasi PBR Material

- **Nama Model:** 
- **Sumber:** 
- **Lisensi:** 
- **Texture Map Tersedia:** 


## 7. Kendala dan Solusi

Pembagian Waktunya

## 8. Hasil Akhir

GameBot Red Edition telah melalui proses UV Mapping dan penerapan PBR Material. Model memiliki warna merah, bagian logam, serta emission pada mata dan indikator.

Screenshot: `screenshots/09_final_material.png`

## 9. Struktur Repository

```text
.
├── P10_Kelompok_GameBot.blend
├── textures/
├── screenshots/
└── README.md
```

## 10. Video Demo

[Link Video Demo]
