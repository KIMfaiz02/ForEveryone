CREATE DATABASE IF NOT EXISTS library_yuppta
    CHARACTER SET utf8mb4
    COLLATE utf8mb4_unicode_ci;

USE library_yuppta;

CREATE TABLE IF NOT EXISTS users (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    name VARCHAR(120) NOT NULL,
    email VARCHAR(190) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role ENUM('admin', 'user') NOT NULL DEFAULT 'user',
    nis VARCHAR(40) NOT NULL DEFAULT '',
    class_name VARCHAR(40) NOT NULL DEFAULT '',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY users_email_unique (email)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS genres (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    name VARCHAR(80) NOT NULL,
    PRIMARY KEY (id),
    UNIQUE KEY genres_name_unique (name)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS books (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    title VARCHAR(200) NOT NULL,
    author VARCHAR(160) NOT NULL,
    image_url VARCHAR(1000) NOT NULL DEFAULT '',
    genre_id BIGINT UNSIGNED NULL,
    stock INT UNSIGNED NOT NULL DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY books_genre_id_index (genre_id),
    CONSTRAINT books_genre_fk FOREIGN KEY (genre_id)
        REFERENCES genres (id) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS loans (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    user_id BIGINT UNSIGNED NULL,
    book_id BIGINT UNSIGNED NULL,
    borrower_name VARCHAR(120) NOT NULL,
    borrower_email VARCHAR(190) NOT NULL,
    book_title VARCHAR(200) NOT NULL,
    book_author VARCHAR(160) NOT NULL,
    borrowed_at DATETIME NOT NULL,
    due_at DATETIME NOT NULL,
    returned_at DATETIME NULL,
    PRIMARY KEY (id),
    KEY loans_user_id_index (user_id),
    KEY loans_book_active_index (book_id, returned_at),
    KEY loans_borrowed_at_index (borrowed_at),
    CONSTRAINT loans_user_fk FOREIGN KEY (user_id)
        REFERENCES users (id) ON DELETE SET NULL,
    CONSTRAINT loans_book_fk FOREIGN KEY (book_id)
        REFERENCES books (id) ON DELETE SET NULL
) ENGINE=InnoDB;

INSERT IGNORE INTO genres (name) VALUES ('Umum'), ('Sains'), ('Sejarah');

INSERT INTO books (title, author, image_url, genre_id, stock)
SELECT 'Matematika Dasar', 'John Doe', 'https://via.placeholder.com/150', id, 3
FROM genres WHERE name = 'Umum'
AND NOT EXISTS (SELECT 1 FROM books WHERE title = 'Matematika Dasar' AND author = 'John Doe');

INSERT INTO books (title, author, image_url, genre_id, stock)
SELECT 'Sejarah Dunia', 'Jane Smith', 'https://via.placeholder.com/150', id, 3
FROM genres WHERE name = 'Sejarah'
AND NOT EXISTS (SELECT 1 FROM books WHERE title = 'Sejarah Dunia' AND author = 'Jane Smith');
