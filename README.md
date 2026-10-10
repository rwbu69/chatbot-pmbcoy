# Chatbot PMB RAG

Proyek ini adalah sistem chatbot Telegram cerdas untuk menjawab pertanyaan calon mahasiswa baru mengenai Penerimaan Mahasiswa Baru (PMB) dan Pengenalan Kehidupan Kampus (PK2MB). Bot ini mengambil informasi langsung dari dokumen panduan resmi yang Anda unggah melalui dashboard admin.

---

## Cara Menjalankan Aplikasi

Ikuti langkah-langkah di bawah ini secara berurutan. Anda hanya perlu menyiapkan bot Telegram dan kunci API AI.

### 1. Persiapan Awal
Pastikan Anda sudah menginstal **Bun** di komputer Anda. Jika belum, Anda bisa mencarinya di Google dengan kata kunci "Install Bun".

### 2. Kloning dan Masuk ke Folder
Buka terminal (Command Prompt/PowerShell), lalu jalankan perintah ini:
git clone https://github.com/rwbu69/chatbot-pmbcoy.git
cd chatbot-pmbcoy

### 3. Instalasi Komponen
Di dalam folder tersebut, jalankan perintah:
bun install

### 4. Pengaturan File Rahasia (Env)
1. Salin file `.env.example` dan ubah namanya menjadi `.env` (pastikan ada titik di depannya).
2. Buka file `.env` menggunakan notepad atau editor kode.
3. Isi bagian `BOT_TOKEN` dengan token bot Telegram Anda (dapatkan dari @BotFather di Telegram).
4. Isi bagian `LLM_API_KEY` dengan kunci API OpenRouter Anda (daftar gratis di openrouter.ai).
5. Simpan file `.env` tersebut.

### 5. Menjalankan Sistem
Masih di terminal yang sama, ketik perintah berikut:
bun run dev

Jika muncul tulisan bahwa server berjalan dan bot Telegram telah terhubung, artinya aplikasi sudah menyala.

---

## Cara Melakukan Testing (Uji Coba)

Setelah aplikasi menyala, sistem ini masih kosong. Ikuti cara ini agar bot bisa mulai pintar menjawab:

### 1. Buka Dashboard Admin
Buka browser web Anda (Chrome/Firefox) dan ketikkan alamat berikut di kolom pencarian:
http://localhost:3000/admin/login

### 2. Masuk (Login)
Gunakan kata sandi bawaan berikut untuk masuk:
- Username: admin
- Password: admin123123

### 3. Unggah Dokumen Panduan
- Di halaman utama (Dokumen Sumber), klik "Pilih berkas dokumen".
- Masukkan file PDF atau Word (DOCX) yang berisi panduan jadwal atau syarat kegiatan kampus.
- Klik tombol "Unggah dokumen". Tunggu hingga muncul pesan hijau bahwa dokumen berhasil diproses.

### 4. Tes Mengobrol dengan Bot
- Buka aplikasi Telegram di HP atau komputer Anda.
- Cari nama bot Anda, lalu klik "Start".
- Coba ketikkan pertanyaan seperti: "Kapan jadwal acara hari pertama?" atau "Apa syarat pendaftaran ulangnya?".
- Bot akan membaca dokumen yang baru saja Anda unggah dan merangkum jawabannya untuk Anda.

### 5. Latih Bot Jika Gagal
- Jika bot salah menjawab atau tidak tahu, buka menu "Riwayat Percakapan" di Dashboard Admin.
- Anda akan melihat pesan yang gagal dijawab ditandai dengan warna oranye.
- Klik tombol "Buat FAQ dari ini".
- Anda akan dibawa ke halaman pembuatan FAQ Manual. Masukkan kata kunci singkat (misalnya: "jadwal,kapan") dan ketik sendiri teks jawaban benarnya. 
- Saat ditanya lagi dengan kata kunci yang sama, bot akan langsung memberikan jawaban buatan Anda tersebut.

---
Selesai! Anda sudah berhasil menyalakan dan mengelola chatbot Anda sendiri.
