'use strict';

const API_URL = 'api.php';
const DEFAULT_IMAGE = 'https://via.placeholder.com/150';
let books = [];
let genres = [];
let currentUser = null;
let selectedCatalogGenre = '';

async function api(action, data = null) {
    const response = await fetch(`${API_URL}?action=${encodeURIComponent(action)}`, {
        method: data === null ? 'GET' : 'POST',
        credentials: 'same-origin',
        headers: data === null ? {} : { 'Content-Type': 'application/json' },
        body: data === null ? undefined : JSON.stringify(data)
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'Permintaan gagal.');
    return result;
}

function escapeHtml(text) {
    return String(text ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function createToast() {
    const element = document.createElement('div');
    element.id = 'toast';
    element.className = 'toast';
    document.body.appendChild(element);
    return element;
}

function showToast(message, isError = false) {
    const toast = document.getElementById('toast') || createToast();
    toast.textContent = message;
    toast.className = `toast ${isError ? 'toast-error' : 'toast-success'}`;
    toast.style.opacity = '1';
    setTimeout(() => { toast.style.opacity = '0'; }, 2600);
}

function getCurrentUser() {
    return currentUser;
}

async function refreshData() {
    const result = await api('bootstrap');
    books = result.books;
    genres = result.genres;
    currentUser = result.user;
    updateHeader();
    populateGenreSelects();
    renderGenresAdmin();
    renderBooks();
    cariBuku();
    await renderProfile();
    await renderAdminDashboard();
}

async function loginUser(email, password) {
    const result = await api('login', { email, password });
    currentUser = result.user;
    updateHeader();
    return true;
}

async function registerUser(account) {
    await api('register', account);
    return true;
}

async function logoutUser() {
    await api('logout', {});
    currentUser = null;
    updateHeader();
}

function updateHeader() {
    const navAuth = document.getElementById('nav-auth');
    const nav = navAuth?.parentElement;
    if (nav) {
        let profileItem = document.getElementById('nav-profile');
        if (!profileItem) {
            profileItem = document.createElement('li');
            profileItem.id = 'nav-profile';
            profileItem.innerHTML = '<a href="profile.html">Profil</a>';
            nav.insertBefore(profileItem, navAuth);
        }
        profileItem.hidden = !currentUser;

        let adminItem = document.getElementById('nav-admin');
        if (!adminItem) {
            adminItem = document.createElement('li');
            adminItem.id = 'nav-admin';
            adminItem.innerHTML = '<a href="admin.html">Laporan</a>';
            nav.insertBefore(adminItem, profileItem);
        }
        adminItem.hidden = currentUser?.role !== 'admin';
    }

    if (navAuth) {
        if (currentUser) {
            navAuth.innerHTML = `<span class="user-greet">Halo, ${escapeHtml(currentUser.name)} (${escapeHtml(currentUser.role)})</span> <a href="#" id="logout-link">Keluar</a>`;
            document.getElementById('logout-link').addEventListener('click', async event => {
                event.preventDefault();
                try {
                    await logoutUser();
                    showToast('Anda telah keluar');
                    setTimeout(() => { window.location = 'index.html'; }, 400);
                } catch (error) {
                    showToast(error.message, true);
                }
            });
        } else {
            navAuth.innerHTML = '<a href="login.html">Masuk / Daftar</a>';
        }
    }

    const adminControls = document.getElementById('admin-controls');
    if (adminControls) adminControls.style.display = currentUser?.role === 'admin' ? 'flex' : 'none';
}

function renderResults(results, query) {
    const target = document.getElementById('hasil');
    if (!target) return;
    if (!results.length) {
        target.innerHTML = query
            ? `<p>Tidak ada buku ditemukan untuk "${escapeHtml(query)}".</p>`
            : '<p>Belum ada buku di katalog.</p>';
        return;
    }

    const label = query
        ? `Hasil pencarian untuk "${escapeHtml(query)}": (${results.length})`
        : `Semua buku: (${results.length})`;
    target.innerHTML = `<p>${label}</p><div class="results">${results.map(book => `
        <div class="result">
            <img src="${escapeHtml(book.img || DEFAULT_IMAGE)}" alt="${escapeHtml(book.title)}" width="80">
            <div class="meta">
                <h4>${escapeHtml(book.title)} <span class="genre-badge">${escapeHtml(book.genre)}</span></h4>
                <p>Penulis: ${escapeHtml(book.author)}</p>
            </div>
        </div>`).join('')}</div>`;
}

function cariBuku() {
    const input = document.getElementById('search');
    if (!input) return;
    const query = input.value.trim();
    const filter = document.getElementById('genre-filter');
    const genre = filter?.value || '';
    const normalizedQuery = query.toLocaleLowerCase('id');
    const matches = books.filter(book => {
        const matchesQuery = !normalizedQuery ||
            book.title.toLocaleLowerCase('id').includes(normalizedQuery) ||
            book.author.toLocaleLowerCase('id').includes(normalizedQuery);
        return matchesQuery && (!genre || book.genre.toLocaleLowerCase('id') === genre.toLocaleLowerCase('id'));
    });
    if (document.getElementById('search-sort')?.value === 'title') {
        matches.sort((a, b) => a.title.localeCompare(b.title, 'id'));
    }
    renderResults(matches, query);
}

function renderCatalogCategories() {
    const container = document.getElementById('catalog-category-list');
    if (!container) return;
    const categories = [{ name: 'Semua' }, ...genres];
    container.innerHTML = categories.map(category => {
        const value = category.name === 'Semua' ? '' : category.name;
        const active = value === selectedCatalogGenre;
        return `<button type="button" class="category-filter${active ? ' active' : ''}" data-category="${escapeHtml(value)}" aria-pressed="${active}">${escapeHtml(category.name)}</button>`;
    }).join('');
    container.querySelectorAll('[data-category]').forEach(button => {
        button.addEventListener('click', () => {
            selectedCatalogGenre = button.dataset.category;
            renderCatalogCategories();
            filterCatalogBooks();
        });
    });
}

function filterCatalogBooks() {
    document.querySelectorAll('#book-list .buku.card').forEach(card => {
        card.hidden = Boolean(selectedCatalogGenre) &&
            card.dataset.genre.toLocaleLowerCase('id') !== selectedCatalogGenre.toLocaleLowerCase('id');
    });
}

function renderBooks() {
    const container = document.getElementById('book-list');
    if (!container) return;
    const isAdmin = currentUser?.role === 'admin';
    container.innerHTML = books.map(book => `
        <article class="buku card" data-genre="${escapeHtml(book.genre)}">
            <img src="${escapeHtml(book.img || DEFAULT_IMAGE)}" alt="${escapeHtml(book.title)}">
            <h3>${escapeHtml(book.title)}</h3>
            <p>Penulis: ${escapeHtml(book.author)}</p>
            <div class="meta-extra"><span class="genre-badge">${escapeHtml(book.genre)}</span></div>
            <p class="stock-label"><strong>${book.available}</strong> dari ${book.stock} eksemplar tersedia</p>
            <div class="card-actions">
                <button class="btn-primary" data-borrow-id="${book.id}" ${Number(book.available) < 1 ? 'disabled' : ''}>${Number(book.available) < 1 ? 'Stok habis' : 'Pinjam'}</button>
                <button class="btn-secondary" data-edit-id="${book.id}" ${isAdmin ? '' : 'hidden'}>Edit</button>
                <button class="btn-danger" data-delete-id="${book.id}" ${isAdmin ? '' : 'hidden'}>Hapus</button>
            </div>
            <form class="book-edit-form" data-edit-form="${book.id}" hidden>
                <label>Judul<input name="title" value="${escapeHtml(book.title)}" required></label>
                <label>Penulis<input name="author" value="${escapeHtml(book.author)}" required></label>
                <label>Genre<select name="genre">${genres.map(genre => `<option value="${escapeHtml(genre.name)}" ${genre.name === book.genre ? 'selected' : ''}>${escapeHtml(genre.name)}</option>`).join('')}</select></label>
                <label>Stok total<input name="stock" type="number" min="0" step="1" value="${book.stock}" required></label>
                <label>URL sampul<input name="img" type="url" value="${escapeHtml(book.img || '')}"></label>
                <div class="edit-actions"><button type="submit" class="btn-primary">Simpan</button><button type="button" class="btn-secondary" data-cancel-edit>Batal</button></div>
            </form>
        </article>`).join('');
    renderCatalogCategories();
    filterCatalogBooks();

    container.querySelectorAll('[data-borrow-id]').forEach(button => {
        button.addEventListener('click', async () => {
            if (!currentUser) {
                showToast('Silakan masuk terlebih dahulu untuk meminjam', true);
                setTimeout(() => { window.location = 'login.html'; }, 700);
                return;
            }
            try {
                await api('borrow', { bookId: Number(button.dataset.borrowId) });
                showToast('Buku berhasil dipinjam. Riwayat tersimpan di profil.');
                await refreshData();
            } catch (error) {
                showToast(error.message, true);
            }
        });
    });

    container.querySelectorAll('[data-delete-id]').forEach(button => {
        button.addEventListener('click', async () => {
            if (!confirm('Hapus buku ini?')) return;
            try {
                await api('book_delete', { id: Number(button.dataset.deleteId) });
                showToast('Buku berhasil dihapus.');
                await refreshData();
            } catch (error) {
                showToast(error.message, true);
            }
        });
    });

    container.querySelectorAll('[data-edit-id]').forEach(button => {
        button.addEventListener('click', () => {
            const form = container.querySelector(`[data-edit-form="${button.dataset.editId}"]`);
            form.hidden = !form.hidden;
        });
    });

    container.querySelectorAll('.book-edit-form').forEach(form => {
        form.addEventListener('submit', async event => {
            event.preventDefault();
            const values = new FormData(form);
            try {
                await api('book_update', {
                    id: Number(form.dataset.editForm),
                    title: values.get('title'),
                    author: values.get('author'),
                    genre: values.get('genre'),
                    stock: Number(values.get('stock')),
                    img: values.get('img') || DEFAULT_IMAGE
                });
                showToast('Perubahan buku disimpan.');
                await refreshData();
            } catch (error) {
                showToast(error.message, true);
            }
        });
        form.querySelector('[data-cancel-edit]').addEventListener('click', () => { form.hidden = true; });
    });
}

function populateGenreSelects() {
    const addBookSelect = document.getElementById('new-genre');
    if (addBookSelect) {
        addBookSelect.innerHTML = genres.map(genre =>
            `<option value="${escapeHtml(genre.name)}">${escapeHtml(genre.name)}</option>`).join('');
    }
    const searchFilter = document.getElementById('genre-filter');
    if (searchFilter) {
        const selected = searchFilter.value;
        searchFilter.innerHTML = '<option value="">Semua Genre</option>' +
            genres.map(genre => `<option value="${escapeHtml(genre.name)}">${escapeHtml(genre.name)}</option>`).join('');
        searchFilter.value = selected;
    }
}

function renderGenresAdmin() {
    const container = document.getElementById('genre-list');
    if (!container) return;
    container.innerHTML = genres.map(genre =>
        `<div class="genre-item">${escapeHtml(genre.name)} <button class="del" data-genre-id="${genre.id}" aria-label="Hapus genre ${escapeHtml(genre.name)}">×</button></div>`
    ).join('');
    container.querySelectorAll('[data-genre-id]').forEach(button => {
        button.addEventListener('click', async () => {
            const genre = genres.find(item => Number(item.id) === Number(button.dataset.genreId));
            if (!genre || !confirm(`Hapus genre "${genre.name}"?`)) return;
            try {
                await api('genre_delete', { id: Number(button.dataset.genreId) });
                if (selectedCatalogGenre === genre.name) selectedCatalogGenre = '';
                showToast('Genre berhasil dihapus.');
                await refreshData();
            } catch (error) {
                showToast(error.message, true);
            }
        });
    });
}

async function renderProfile() {
    const profile = document.getElementById('profile-details');
    const history = document.getElementById('loan-history');
    const sidebarName = document.getElementById('profile-sidebar-name');
    const sidebarAvatar = document.getElementById('profile-sidebar-avatar');
    const sidebarRole = document.getElementById('profile-sidebar-role');
    const summary = document.getElementById('profile-summary-cards');
    if (!profile && !history && !sidebarName && !sidebarAvatar && !sidebarRole && !summary) return;

    if (!currentUser) {
        if (profile) profile.innerHTML = '<p class="empty-state">Masuk untuk melihat profil dan riwayat peminjaman.</p><a class="btn-primary" href="login.html">Masuk</a>';
        if (history) history.innerHTML = '';
        if (sidebarName) sidebarName.textContent = 'Akun Pengguna';
        if (sidebarAvatar) sidebarAvatar.textContent = '?';
        if (sidebarRole) sidebarRole.textContent = 'Anggota';
        if (summary) summary.innerHTML = '<p class="empty-state">Masuk untuk melihat statistik peminjaman.</p>';
        return;
    }

    let result;
    try {
        result = await api('profile');
        currentUser = result.user;
    } catch (error) {
        if (profile) profile.innerHTML = `<p class="empty-state">${escapeHtml(error.message)}</p>`;
        return;
    }
    const user = result.user;
    const loans = result.loans;
    const activeLoans = loans.filter(loan => !loan.returnedAt);
    const initial = (user.name || '?').trim().charAt(0).toUpperCase();
    if (sidebarName) sidebarName.textContent = user.name || 'Pengguna';
    if (sidebarAvatar) sidebarAvatar.textContent = initial;
    if (sidebarRole) sidebarRole.textContent = user.role === 'admin' ? 'Administrator' : 'Anggota';
    if (summary) {
        summary.innerHTML = `
            <article><strong>${loans.length}</strong><span>Total Peminjaman</span></article>
            <article><strong>${activeLoans.length}</strong><span>Sedang Dipinjam</span></article>
            <article><strong>${loans.length - activeLoans.length}</strong><span>Telah Dikembalikan</span></article>`;
    }
    if (profile) {
        profile.innerHTML = `
            <div class="profile-avatar" aria-hidden="true">${escapeHtml(initial)}</div>
            <div class="profile-info">
                <span class="eyebrow">Akun ${escapeHtml(user.role)}</span>
                <h2>${escapeHtml(user.name)}</h2>
                <p>${escapeHtml(user.email)}</p>
                ${user.nis ? `<p>NIS: ${escapeHtml(user.nis)}</p>` : ''}
                ${user.className ? `<p>Kelas: ${escapeHtml(user.className)}</p>` : ''}
            </div>
            <div class="profile-stats">
                <div><strong>${activeLoans.length}</strong><span>Sedang dipinjam</span></div>
                <div><strong>${loans.length}</strong><span>Total peminjaman</span></div>
            </div>`;
    }
    if (!history) return;
    if (!loans.length) {
        history.innerHTML = '<p class="empty-state">Belum ada riwayat peminjaman. Jelajahi katalog untuk meminjam buku.</p><a class="btn-secondary" href="katalog.html">Buka katalog</a>';
        return;
    }
    history.innerHTML = loans.map(loan => `
        <article class="loan-item">
            <div class="loan-copy">
                <h3>${escapeHtml(loan.title)}</h3>
                <p>Penulis: ${escapeHtml(loan.author || '-')}</p>
                <p>Dipinjam ${formatDate(loan.borrowedAt)} · Tenggat ${formatDate(loan.dueAt)}</p>
                ${loan.returnedAt ? `<p>Dikembalikan ${formatDate(loan.returnedAt)}</p>` : ''}
            </div>
            <div class="loan-status ${loan.returnedAt ? 'is-returned' : 'is-active'}">${loan.returnedAt ? 'Dikembalikan' : 'Dipinjam'}</div>
            ${loan.returnedAt ? '' : `<button class="btn-secondary" data-return-id="${loan.id}">Kembalikan</button>`}
        </article>`).join('');
    history.querySelectorAll('[data-return-id]').forEach(button => {
        button.addEventListener('click', async () => {
            try {
                await api('return', { id: Number(button.dataset.returnId) });
                showToast('Buku berhasil dikembalikan.');
                await refreshData();
            } catch (error) {
                showToast(error.message, true);
            }
        });
    });
}

function formatDate(value) {
    if (!value) return '-';
    const date = new Date(String(value).replace(' ', 'T'));
    if (Number.isNaN(date.getTime())) return '-';
    return new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }).format(date);
}

async function renderAdminDashboard() {
    const workspace = document.getElementById('admin-workspace');
    if (!workspace) return;
    const accessDenied = document.getElementById('admin-access-denied');
    if (currentUser?.role !== 'admin') {
        workspace.hidden = true;
        if (accessDenied) accessDenied.hidden = false;
        return;
    }

    let data;
    try {
        data = await api('admin_dashboard');
    } catch (error) {
        workspace.hidden = false;
        if (accessDenied) accessDenied.hidden = true;
        const stats = document.getElementById('admin-stats');
        if (stats) stats.innerHTML = `<p class="empty-state">${escapeHtml(error.message)}</p>`;
        return;
    }
    workspace.hidden = false;
    if (accessDenied) accessDenied.hidden = true;
    const stats = document.getElementById('admin-stats');
    if (stats) {
        stats.innerHTML = `
            <article class="admin-stat"><span>Total anggota</span><strong>${data.stats.members}</strong><small>akun pengguna terdaftar</small></article>
            <article class="admin-stat"><span>Total judul buku</span><strong>${data.stats.titles}</strong><small>${data.stats.copies} eksemplar dalam koleksi</small></article>
            <article class="admin-stat"><span>Sedang dipinjam</span><strong>${data.stats.active}</strong><small>belum dikembalikan</small></article>
            <article class="admin-stat"><span>Sudah dikembalikan</span><strong>${data.stats.returned}</strong><small>transaksi selesai</small></article>`;
    }
    renderAdminUserAccounts(data.users);
    const filter = document.getElementById('report-filter')?.value || 'all';
    const loans = data.loans.filter(loan =>
        filter === 'active' ? !loan.returnedAt :
        filter === 'returned' ? Boolean(loan.returnedAt) : true);
    const body = document.getElementById('loan-report-body');
    if (!body) return;
    if (!loans.length) {
        body.innerHTML = '<tr><td class="report-empty" colspan="6">Belum ada transaksi untuk ditampilkan.</td></tr>';
        return;
    }
    body.innerHTML = loans.map(loan => `
        <tr>
            <td><strong>${escapeHtml(loan.title || '-')}</strong><span>${escapeHtml(loan.author || '-')}</span></td>
            <td>${escapeHtml(loan.userName || loan.email || 'Akun dihapus')}<span>${escapeHtml(loan.email || '-')}</span></td>
            <td>${formatDate(loan.borrowedAt)}</td>
            <td>${formatDate(loan.dueAt)}</td>
            <td>${loan.returnedAt ? formatDate(loan.returnedAt) : '-'}</td>
            <td><span class="loan-status ${loan.returnedAt ? 'is-returned' : 'is-active'}">${loan.returnedAt ? 'Dikembalikan' : 'Dipinjam'}</span></td>
        </tr>`).join('');
}

function renderAdminUserAccounts(users) {
    const body = document.getElementById('user-account-body');
    if (!body) return;
    if (!users.length) {
        body.innerHTML = '<tr><td class="report-empty" colspan="7">Belum ada akun pengguna terdaftar.</td></tr>';
        return;
    }
    body.innerHTML = users.map(user => `
        <tr>
            <td><strong>${escapeHtml(user.name || '-')}</strong></td>
            <td>${escapeHtml(user.email || '-')}</td>
            <td>${escapeHtml(user.nis || '-')}</td>
            <td>${escapeHtml(user.className || '-')}</td>
            <td>${formatDate(user.createdAt)}</td>
            <td>
                <details class="account-password-reset">
                    <summary class="btn-secondary">Atur password baru</summary>
                    <form class="account-password-form" data-user-id="${user.id}">
                        <label>Password baru<input type="password" name="new-password" minlength="8" autocomplete="new-password" required></label>
                        <label>Ulangi password baru<input type="password" name="confirm-password" minlength="8" autocomplete="new-password" required></label>
                        <button class="btn-primary" type="submit">Simpan password</button>
                    </form>
                </details>
            </td>
            <td><button type="button" class="btn-danger account-delete-button" data-user-id="${user.id}" data-user-name="${escapeHtml(user.name)}">Hapus akun</button></td>
        </tr>`).join('');

    body.querySelectorAll('.account-delete-button').forEach(button => {
        button.addEventListener('click', async () => {
            if (!confirm(`Hapus akun ${button.dataset.userName}? Riwayat peminjaman tetap disimpan.`)) return;
            try {
                await api('user_delete', { userId: Number(button.dataset.userId) });
                showToast('Akun pengguna berhasil dihapus.');
                await renderAdminDashboard();
            } catch (error) {
                showToast(error.message, true);
            }
        });
    });
    body.querySelectorAll('.account-password-form').forEach(form => {
        form.addEventListener('submit', async event => {
            event.preventDefault();
            const values = new FormData(form);
            const password = String(values.get('new-password') || '');
            if (password !== String(values.get('confirm-password') || '')) {
                showToast('Password baru tidak cocok.', true);
                return;
            }
            try {
                await api('user_password', { userId: Number(form.dataset.userId), password });
                form.reset();
                showToast('Password baru berhasil disimpan.');
            } catch (error) {
                showToast(error.message, true);
            }
        });
    });
}

function initPageHandlers() {
    const search = document.getElementById('search');
    search?.addEventListener('keydown', event => {
        if (event.key === 'Enter') cariBuku();
    });
    document.getElementById('search-btn')?.addEventListener('click', cariBuku);
    document.getElementById('genre-filter')?.addEventListener('change', cariBuku);
    document.getElementById('search-sort')?.addEventListener('change', cariBuku);
    document.getElementById('report-filter')?.addEventListener('change', renderAdminDashboard);

    const addBookButton = document.getElementById('show-add-book');
    const addBookForm = document.getElementById('add-book-form');
    if (addBookButton && addBookForm) {
        addBookButton.addEventListener('click', () => {
            addBookForm.style.display = addBookForm.style.display === 'none' ? 'flex' : 'none';
            addBookButton.setAttribute('aria-expanded', String(addBookForm.style.display !== 'none'));
        });
        addBookForm.addEventListener('submit', async event => {
            event.preventDefault();
            try {
                await api('book_add', {
                    title: document.getElementById('new-title').value.trim(),
                    author: document.getElementById('new-author').value.trim(),
                    img: document.getElementById('new-img').value.trim() || DEFAULT_IMAGE,
                    genre: document.getElementById('new-genre').value || 'Umum',
                    stock: Number(document.getElementById('new-stock').value)
                });
                addBookForm.reset();
                showToast('Buku ditambahkan.');
                await refreshData();
            } catch (error) {
                showToast(error.message, true);
            }
        });
    }

    const genreButton = document.getElementById('show-genre-manager');
    const genreManager = document.getElementById('genre-manager');
    genreButton?.addEventListener('click', () => {
        if (genreManager) genreManager.style.display = genreManager.style.display === 'none' ? 'block' : 'none';
    });

    const addGenreForm = document.getElementById('add-genre-form');
    addGenreForm?.addEventListener('submit', async event => {
        event.preventDefault();
        try {
            await api('genre_add', { name: document.getElementById('genre-name').value.trim() });
            addGenreForm.reset();
            showToast('Genre ditambahkan.');
            await refreshData();
        } catch (error) {
            showToast(error.message, true);
        }
    });
}

function setActiveNav() {
    const path = window.location.pathname.split('/').pop() || 'index.html';
    document.querySelectorAll('nav a').forEach(link => {
        if (link.getAttribute('href') === path) link.classList.add('active');
        else link.classList.remove('active');
    });
}

document.addEventListener('DOMContentLoaded', async () => {
    initPageHandlers();
    setActiveNav();
    const searchInput = document.getElementById('search');
    const query = new URLSearchParams(window.location.search).get('q') || '';
    if (searchInput) searchInput.value = query;
    try {
        await refreshData();
    } catch (error) {
        showToast(error.message, true);
        const bookList = document.getElementById('book-list');
        if (bookList) bookList.innerHTML = `<p class="empty-state">${escapeHtml(error.message)}</p>`;
        const results = document.getElementById('hasil');
        if (results) results.innerHTML = `<p class="empty-state">${escapeHtml(error.message)}</p>`;
    }
});
