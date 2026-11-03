<?php
declare(strict_types=1);

require_once __DIR__ . '/config.php';

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
start_app_session();

function respond(array $data, int $status = 200): never
{
    http_response_code($status);
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function request_data(): array
{
    $data = json_decode(file_get_contents('php://input'), true);
    if (!is_array($data)) {
        respond(['error' => 'Permintaan tidak valid.'], 400);
    }
    return $data;
}

function require_user(): array
{
    if (empty($_SESSION['user_id'])) {
        respond(['error' => 'Silakan masuk terlebih dahulu.'], 401);
    }

    $statement = database()->prepare(
        'SELECT id, name, email, role, nis, class_name AS className, created_at AS createdAt
         FROM users WHERE id = ?'
    );
    $statement->execute([$_SESSION['user_id']]);
    $user = $statement->fetch();
    if (!$user) {
        $_SESSION = [];
        session_destroy();
        respond(['error' => 'Sesi tidak berlaku. Silakan masuk kembali.'], 401);
    }
    return $user;
}

function require_admin(): array
{
    $user = require_user();
    if ($user['role'] !== 'admin') {
        respond(['error' => 'Aksi ini hanya dapat dilakukan admin.'], 403);
    }
    return $user;
}

function read_id(array $data, string $key = 'id'): int
{
    $id = filter_var($data[$key] ?? null, FILTER_VALIDATE_INT, ['options' => ['min_range' => 1]]);
    if ($id === false) {
        respond(['error' => 'ID tidak valid.'], 422);
    }
    return $id;
}

function book_rows(): array
{
    return database()->query(
        "SELECT b.id, b.title, b.author, b.image_url AS img, COALESCE(g.name, 'Umum') AS genre,
                b.stock,
                b.stock - (SELECT COUNT(*) FROM loans l WHERE l.book_id = b.id AND l.returned_at IS NULL) AS available
         FROM books b LEFT JOIN genres g ON g.id = b.genre_id ORDER BY b.title"
    )->fetchAll();
}

function genre_rows(): array
{
    return database()->query('SELECT id, name FROM genres ORDER BY name')->fetchAll();
}

function loan_rows(?int $userId = null): array
{
    $sql = "SELECT l.id, l.book_id AS bookId, l.book_title AS title, l.book_author AS author,
                   COALESCE(u.email, l.borrower_email) AS email,
                   COALESCE(u.name, l.borrower_name) AS userName, l.borrowed_at AS borrowedAt,
                   l.due_at AS dueAt, l.returned_at AS returnedAt
            FROM loans l LEFT JOIN users u ON u.id = l.user_id";
    if ($userId !== null) {
        $statement = database()->prepare($sql . ' WHERE l.user_id = ? ORDER BY l.borrowed_at DESC');
        $statement->execute([$userId]);
        return $statement->fetchAll();
    }
    return database()->query($sql . ' ORDER BY l.borrowed_at DESC')->fetchAll();
}

function require_method(string $method): void
{
    if ($_SERVER['REQUEST_METHOD'] !== $method) {
        header('Allow: ' . $method);
        respond(['error' => 'Metode permintaan tidak diizinkan.'], 405);
    }
}

try {
    $action = (string)($_GET['action'] ?? '');
    $actions = [
        'bootstrap', 'login', 'register', 'logout', 'profile', 'admin_dashboard',
        'borrow', 'return', 'book_add', 'book_update', 'book_delete',
        'genre_add', 'genre_delete', 'user_delete', 'user_password',
    ];
    if (!in_array($action, $actions, true)) {
        respond(['error' => 'Aksi tidak ditemukan.'], 404);
    }

    $db = database();

    if ($action === 'bootstrap') {
        require_method('GET');
        $user = !empty($_SESSION['user_id']) ? require_user() : null;
        respond(['books' => book_rows(), 'genres' => genre_rows(), 'user' => $user]);
    }

    if ($action === 'login') {
        require_method('POST');
        $data = request_data();
        $email = filter_var(strtolower(trim((string)($data['email'] ?? ''))), FILTER_VALIDATE_EMAIL);
        $password = (string)($data['password'] ?? '');
        if (!$email || $password === '') {
            respond(['error' => 'Email atau kata sandi salah.'], 401);
        }
        $statement = $db->prepare('SELECT id, password_hash FROM users WHERE email = ?');
        $statement->execute([$email]);
        $account = $statement->fetch();
        $passwordMatches = $account && password_verify($password, $account['password_hash']);
        $legacyPlaintextPassword = $account && !$passwordMatches &&
            hash_equals((string)$account['password_hash'], $password);
        if (!$passwordMatches && !$legacyPlaintextPassword) {
            respond(['error' => 'Email atau kata sandi salah.'], 401);
        }
        if ($legacyPlaintextPassword) {
            $upgrade = $db->prepare('UPDATE users SET password_hash = ? WHERE id = ?');
            $upgrade->execute([password_hash($password, PASSWORD_DEFAULT), $account['id']]);
        }
        session_regenerate_id(true);
        $_SESSION['user_id'] = (int)$account['id'];
        respond(['user' => require_user()]);
    }

    if ($action === 'register') {
        require_method('POST');
        $data = request_data();
        $name = trim((string)($data['name'] ?? ''));
        $email = filter_var(strtolower(trim((string)($data['email'] ?? ''))), FILTER_VALIDATE_EMAIL);
        $password = (string)($data['password'] ?? '');
        $nis = trim((string)($data['nis'] ?? ''));
        $className = trim((string)($data['className'] ?? ''));
        if ($name === '' || strlen($name) > 120 || !$email || strlen($password) < 8 ||
            strlen($nis) > 40 || strlen($className) > 40) {
            respond(['error' => 'Periksa nama, email, kelas, NIS, dan password (minimal 8 karakter).'], 422);
        }
        $statement = $db->prepare(
            "INSERT INTO users (name, email, password_hash, role, nis, class_name)
             VALUES (?, ?, ?, 'user', ?, ?)"
        );
        try {
            $statement->execute([$name, $email, password_hash($password, PASSWORD_DEFAULT), $nis, $className]);
        } catch (PDOException $error) {
            if ($error->getCode() === '23000') {
                respond(['error' => 'Email sudah terdaftar.'], 409);
            }
            throw $error;
        }
        respond(['message' => 'Pendaftaran berhasil. Silakan masuk.'], 201);
    }

    if ($action === 'logout') {
        require_method('POST');
        $_SESSION = [];
        if (ini_get('session.use_cookies')) {
            $params = session_get_cookie_params();
            setcookie(session_name(), '', time() - 42000, $params['path'], '', $params['secure'], $params['httponly']);
        }
        session_destroy();
        respond(['message' => 'Anda telah keluar.']);
    }

    if ($action === 'profile') {
        require_method('GET');
        $user = require_user();
        respond(['user' => $user, 'loans' => loan_rows((int)$user['id'])]);
    }

    if ($action === 'admin_dashboard') {
        require_method('GET');
        require_admin();
        $users = $db->query(
            "SELECT id, name, email, nis, class_name AS className, created_at AS createdAt
             FROM users WHERE role = 'user' ORDER BY created_at DESC"
        )->fetchAll();
        $loans = loan_rows();
        $books = book_rows();
        $active = count(array_filter($loans, static fn(array $loan): bool => $loan['returnedAt'] === null));
        respond([
            'users' => $users,
            'loans' => $loans,
            'stats' => [
                'members' => count($users),
                'titles' => count($books),
                'copies' => array_sum(array_map(static fn(array $book): int => (int)$book['stock'], $books)),
                'active' => $active,
                'returned' => count($loans) - $active,
            ],
        ]);
    }

    if ($action === 'borrow') {
        require_method('POST');
        $user = require_user();
        $bookId = read_id(request_data(), 'bookId');
        $db->beginTransaction();
        $statement = $db->prepare('SELECT id, title, author, stock FROM books WHERE id = ? FOR UPDATE');
        $statement->execute([$bookId]);
        $book = $statement->fetch();
        if (!$book) {
            $db->rollBack();
            respond(['error' => 'Buku tidak ditemukan.'], 404);
        }
        $statement = $db->prepare('SELECT COUNT(*) FROM loans WHERE book_id = ? AND returned_at IS NULL');
        $statement->execute([$bookId]);
        $activeCount = (int)$statement->fetchColumn();
        $statement = $db->prepare(
            'SELECT COUNT(*) FROM loans WHERE user_id = ? AND book_id = ? AND returned_at IS NULL'
        );
        $statement->execute([$user['id'], $bookId]);
        if ((int)$statement->fetchColumn() > 0) {
            $db->rollBack();
            respond(['error' => 'Buku ini masih dalam peminjaman Anda.'], 409);
        }
        if ($activeCount >= (int)$book['stock']) {
            $db->rollBack();
            respond(['error' => 'Stok buku sedang habis dipinjam.'], 409);
        }
        $statement = $db->prepare(
            'INSERT INTO loans
                (user_id, book_id, borrower_name, borrower_email, book_title, book_author, borrowed_at, due_at)
             VALUES (?, ?, ?, ?, ?, ?, NOW(), DATE_ADD(NOW(), INTERVAL 14 DAY))'
        );
        $statement->execute([
            $user['id'], $bookId, $user['name'], $user['email'], $book['title'], $book['author']
        ]);
        $db->commit();
        respond(['message' => 'Buku berhasil dipinjam.']);
    }

    if ($action === 'return') {
        require_method('POST');
        $user = require_user();
        $id = read_id(request_data());
        $statement = $db->prepare(
            'UPDATE loans SET returned_at = NOW()
             WHERE id = ? AND user_id = ? AND returned_at IS NULL'
        );
        $statement->execute([$id, $user['id']]);
        if ($statement->rowCount() !== 1) {
            respond(['error' => 'Peminjaman aktif tidak ditemukan.'], 404);
        }
        respond(['message' => 'Buku berhasil dikembalikan.']);
    }

    if ($action === 'book_add' || $action === 'book_update') {
        require_method('POST');
        require_admin();
        $data = request_data();
        $title = trim((string)($data['title'] ?? ''));
        $author = trim((string)($data['author'] ?? ''));
        $genre = trim((string)($data['genre'] ?? 'Umum'));
        $image = trim((string)($data['img'] ?? ''));
        $stock = filter_var($data['stock'] ?? null, FILTER_VALIDATE_INT, ['options' => ['min_range' => 0]]);
        $imageScheme = $image === '' ? '' : strtolower((string)parse_url($image, PHP_URL_SCHEME));
        if ($title === '' || strlen($title) > 200 || $author === '' || strlen($author) > 160 ||
            strlen($genre) > 80 || strlen($image) > 1000 || $stock === false ||
            ($image !== '' && (!filter_var($image, FILTER_VALIDATE_URL) ||
                !in_array($imageScheme, ['http', 'https'], true)))) {
            respond(['error' => 'Periksa judul, penulis, genre, URL sampul, dan stok.'], 422);
        }
        $statement = $db->prepare('SELECT id FROM genres WHERE name = ?');
        $statement->execute([$genre]);
        $genreId = $statement->fetchColumn();
        if (!$genreId) {
            respond(['error' => 'Genre tidak ditemukan.'], 422);
        }
        if ($action === 'book_add') {
            $statement = $db->prepare(
                'INSERT INTO books (title, author, image_url, genre_id, stock) VALUES (?, ?, ?, ?, ?)'
            );
            $statement->execute([$title, $author, $image, $genreId, $stock]);
        } else {
            $id = read_id($data);
            $db->beginTransaction();
            $check = $db->prepare('SELECT id FROM books WHERE id = ? FOR UPDATE');
            $check->execute([$id]);
            if (!$check->fetchColumn()) {
                $db->rollBack();
                respond(['error' => 'Buku tidak ditemukan.'], 404);
            }
            $active = $db->prepare('SELECT COUNT(*) FROM loans WHERE book_id = ? AND returned_at IS NULL');
            $active->execute([$id]);
            if ($stock < (int)$active->fetchColumn()) {
                $db->rollBack();
                respond(['error' => 'Stok tidak boleh kurang dari buku yang sedang dipinjam.'], 409);
            }
            $statement = $db->prepare(
                'UPDATE books SET title = ?, author = ?, image_url = ?, genre_id = ?, stock = ? WHERE id = ?'
            );
            $statement->execute([$title, $author, $image, $genreId, $stock, $id]);
            $db->commit();
        }
        respond(['message' => 'Data buku berhasil disimpan.']);
    }

    if ($action === 'book_delete') {
        require_method('POST');
        require_admin();
        $id = read_id(request_data());
        $statement = $db->prepare(
            'DELETE b FROM books b WHERE b.id = ?
             AND NOT EXISTS (SELECT 1 FROM loans l WHERE l.book_id = b.id AND l.returned_at IS NULL)'
        );
        $statement->execute([$id]);
        if ($statement->rowCount() !== 1) {
            respond(['error' => 'Buku tidak ditemukan atau masih memiliki peminjaman aktif.'], 409);
        }
        respond(['message' => 'Buku berhasil dihapus.']);
    }

    if ($action === 'genre_add') {
        require_method('POST');
        require_admin();
        $name = trim((string)(request_data()['name'] ?? ''));
        if ($name === '' || strlen($name) > 80) {
            respond(['error' => 'Nama genre wajib diisi (maksimal 80 karakter).'], 422);
        }
        try {
            $db->prepare('INSERT INTO genres (name) VALUES (?)')->execute([$name]);
        } catch (PDOException $error) {
            if ($error->getCode() === '23000') {
                respond(['error' => 'Genre sudah ada.'], 409);
            }
            throw $error;
        }
        respond(['message' => 'Genre ditambahkan.']);
    }

    if ($action === 'genre_delete') {
        require_method('POST');
        require_admin();
        $id = read_id(request_data());
        $statement = $db->prepare(
            'DELETE g FROM genres g WHERE g.id = ?
             AND NOT EXISTS (SELECT 1 FROM books b WHERE b.genre_id = g.id)'
        );
        $statement->execute([$id]);
        if ($statement->rowCount() !== 1) {
            respond(['error' => 'Genre tidak ditemukan atau masih digunakan buku.'], 409);
        }
        respond(['message' => 'Genre dihapus.']);
    }

    if ($action === 'user_delete') {
        require_method('POST');
        require_admin();
        $id = read_id(request_data(), 'userId');
        $statement = $db->prepare(
            "DELETE u FROM users u WHERE u.id = ? AND u.role = 'user'
             AND NOT EXISTS (SELECT 1 FROM loans l WHERE l.user_id = u.id AND l.returned_at IS NULL)"
        );
        $statement->execute([$id]);
        if ($statement->rowCount() !== 1) {
            respond(['error' => 'Akun tidak ditemukan atau masih memiliki peminjaman aktif.'], 409);
        }
        respond(['message' => 'Akun pengguna berhasil dihapus.']);
    }

    if ($action === 'user_password') {
        require_method('POST');
        require_admin();
        $data = request_data();
        $id = read_id($data, 'userId');
        $password = (string)($data['password'] ?? '');
        if (strlen($password) < 8) {
            respond(['error' => 'Password baru harus memiliki minimal 8 karakter.'], 422);
        }
        $statement = $db->prepare(
            "UPDATE users SET password_hash = ? WHERE id = ? AND role = 'user'"
        );
        $statement->execute([password_hash($password, PASSWORD_DEFAULT), $id]);
        if ($statement->rowCount() !== 1) {
            $check = $db->prepare("SELECT id FROM users WHERE id = ? AND role = 'user'");
            $check->execute([$id]);
            if (!$check->fetchColumn()) {
                respond(['error' => 'Akun pengguna tidak ditemukan.'], 404);
            }
        }
        respond(['message' => 'Password baru berhasil disimpan.']);
    }

    respond(['error' => 'Aksi tidak ditemukan.'], 404);
} catch (Throwable $error) {
    if (isset($db) && $db->inTransaction()) {
        $db->rollBack();
    }
    error_log((string)$error);
    respond(['error' => 'Terjadi kesalahan server. Periksa konfigurasi database dan log PHP.'], 500);
}
