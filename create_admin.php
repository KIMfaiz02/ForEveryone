<?php
declare(strict_types=1);

if (PHP_SAPI !== 'cli') {
    http_response_code(404);
    exit;
}

require_once __DIR__ . '/config.php';

if ($argc !== 3) {
    fwrite(STDERR, "Penggunaan: php create_admin.php email nama\n");
    exit(1);
}

[, $email, $name] = $argv;
$password = getenv('LIBRARY_ADMIN_PASSWORD') ?: '';
putenv('LIBRARY_ADMIN_PASSWORD');
$email = filter_var(trim($email), FILTER_VALIDATE_EMAIL);
$name = trim($name);

if (!$email || strlen($password) < 8 || $name === '') {
    fwrite(STDERR, "Email/nama tidak valid; masukkan password minimal 8 karakter lewat create_admin.ps1.\n");
    exit(1);
}

$db = database();
$email = strtolower($email);
$lookup = $db->prepare('SELECT id, role FROM users WHERE email = ?');
$lookup->execute([$email]);
$existing = $lookup->fetch();
$passwordHash = password_hash($password, PASSWORD_DEFAULT);

if ($existing) {
    if ($existing['role'] !== 'admin') {
        fwrite(STDERR, "Email tersebut sudah terdaftar sebagai anggota; admin tidak diubah.\n");
        exit(1);
    }

    $update = $db->prepare('UPDATE users SET password_hash = ? WHERE id = ?');
    $update->execute([$passwordHash, $existing['id']]);
    fwrite(STDOUT, "Password akun admin berhasil diperbarui.\n");
} else {
    $insert = $db->prepare(
        "INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, 'admin')"
    );
    $insert->execute([$name, $email, $passwordHash]);
    fwrite(STDOUT, "Akun admin berhasil dibuat.\n");
}
