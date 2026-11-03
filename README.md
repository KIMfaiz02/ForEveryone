# Perpustakaan SMKN 5 Tangerang

Aplikasi memakai PHP 8+, MySQL/MariaDB, PDO, dan JavaScript di browser. Akun, katalog, genre, sesi login, dan transaksi peminjaman disimpan di database, bukan `localStorage`.

## Menjalankan secara lokal dengan XAMPP

1. Jalankan Apache dan MySQL dari XAMPP Control Panel.
2. Buka `http://localhost/phpmyadmin`, pilih **Import**, lalu impor file `database.sql`. File ini membuat database `library_yuppta`, tabel, genre awal, dan dua buku contoh.
3. Jika username/password MySQL berbeda dari bawaan XAMPP, atur environment variable `DB_HOST`, `DB_NAME`, `DB_USER`, dan `DB_PASSWORD`. Nilai default aplikasi adalah `127.0.0.1`, `library_yuppta`, `root`, dan password kosong.
4. Buka PowerShell di folder proyek dan buat akun admin pertama. Password dimasukkan secara tersembunyi dan tidak ditulis sebagai argumen perintah:

   ```powershell
   .\create_admin.ps1 -Email admin@sekolah.sch.id
   ```

   Masukkan password yang sama dua kali saat diminta. Password harus memiliki minimal 8 karakter. Perintah ini hanya dapat dijalankan dari terminal, bukan melalui browser.
5. Salin folder proyek ke `C:\xampp\htdocs\PerpusYppta`, lalu buka `http://localhost/PerpusYppta/`.

Alternatif tanpa XAMPP: setelah database MySQL berjalan dan konfigurasi koneksi tersedia, jalankan `php -S 127.0.0.1:8000` di folder proyek dan buka `http://127.0.0.1:8000/`.

Jangan membuka halaman dengan klik ganda atau alamat `file://`; PHP harus dijalankan melalui web server. Jangan gunakan server bawaan PHP untuk deployment publik.

## Akun dan data lama

Pendaftaran dari halaman web hanya membuat akun anggota. Hak admin hanya dapat diberikan pengelola database/server, misalnya dengan `create_admin.php`. Password baru disimpan menggunakan `password_hash`; pengguna tetap masuk menggunakan password yang sama. Untuk akun lama yang kolom `password_hash`-nya masih berisi password teks biasa, login pertama menerima password tersebut dan langsung menggantinya dengan hash. Password teks biasa tidak dipertahankan setelah login berhasil.

Data yang sebelumnya hanya tersimpan di `localStorage` browser tidak otomatis masuk ke database. Setelah database disiapkan, anggota perlu mendaftar kembali dan admin perlu membuat ulang data katalog yang belum ada di dua buku contoh.
