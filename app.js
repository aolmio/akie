// ─── Element refs ────────────────────────────────────────────────────────────
const body            = document.body;
const modeRadios      = document.querySelectorAll('input[name="colorMode"]');
const fileInput       = document.getElementById('fileInput');
const loadButton      = document.getElementById('loadButton');
const contentDiv      = document.getElementById('content');
const prevBtn         = document.getElementById('prevBtn');
const nextBtn         = document.getElementById('nextBtn');
const pageInfo        = document.getElementById('pageInfo');
const showTextPosts   = document.getElementById('showTextPosts');
const showLinkPosts   = document.getElementById('showLinkPosts');
const showComments    = document.getElementById('showComments');
const showSavedOnly   = document.getElementById('showSavedOnly');
const sortBy          = document.getElementById('sortBy');
const searchInput     = document.getElementById('searchInput');
const fontSizeSelect  = document.getElementById('fontSizeSelect');
const lineHeightSelect= document.getElementById('lineHeightSelect');
const postCountDiv    = document.getElementById('postCount');
const paginationDiv   = document.querySelector('.pagination');
const dropZone        = document.getElementById('dropZone');
const fileListDiv     = document.getElementById('fileList');
const loadStatus      = document.getElementById('loadStatus');
const authorFilterBar = document.getElementById('authorFilterBar');
const authorFilterName= document.getElementById('authorFilterName');
const clearAuthorBtn  = document.getElementById('clearAuthorFilter');

// ─── State ────────────────────────────────────────────────────────────────────
let readPosts    = new Set();
let savedPosts   = new Set();
let readingProgress = {};
let lastReadPosition = null;
let currentAuthorFilter = null;

let rawData      = [];        // all parsed items across all loaded files
let filteredData = [];
let currentPage  = 1;
const pageSize   = 10;
let lastScrollY  = 0;

let pendingFiles = [];        // File objects waiting to be loaded

// ─── Init ─────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    loadStoredData();
    setupDropZone();
    setupControls();
});

// ─── LocalStorage ─────────────────────────────────────────────────────────────
function loadStoredData() {
    try {
        const rp = localStorage.getItem('readPosts');
        const sp = localStorage.getItem('savedPosts');
        const rg = localStorage.getItem('readingProgress');
        const lr = localStorage.getItem('lastReadPosition');
        const af = localStorage.getItem('currentAuthorFilter');
        if (rp) readPosts    = new Set(JSON.parse(rp));
        if (sp) savedPosts   = new Set(JSON.parse(sp));
        if (rg) readingProgress = JSON.parse(rg);
        if (lr) lastReadPosition = JSON.parse(lr);
        if (af) currentAuthorFilter = af;
    } catch (e) {
        console.error('loadStoredData error:', e);
        ['readPosts','savedPosts','readingProgress','lastReadPosition','currentAuthorFilter']
            .forEach(k => localStorage.removeItem(k));
    }
}

function saveToStorage(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch(e) {}
}

// ─── Drop Zone / File picking ─────────────────────────────────────────────────
function setupDropZone() {
    // Clicking the zone opens the file dialog
    dropZone.addEventListener('click', () => fileInput.click());

    dropZone.addEventListener('dragover', e => {
        e.preventDefault();
        dropZone.classList.add('drag-over');
    });
    dropZone.addEventListener('dragleave', () => dropZone.classList.remove('drag-over'));
    dropZone.addEventListener('drop', e => {
        e.preventDefault();
        dropZone.classList.remove('drag-over');
        addPendingFiles(Array.from(e.dataTransfer.files));
    });

    fileInput.addEventListener('change', () => {
        addPendingFiles(Array.from(fileInput.files));
        fileInput.value = ''; // reset so same file can be picked again
    });
}

function addPendingFiles(newFiles) {
    newFiles.forEach(f => {
        const isDupe = pendingFiles.some(p => p.name === f.name && p.size === f.size);
        if (!isDupe) pendingFiles.push(f);
    });
    renderFileList();
    loadButton.disabled = pendingFiles.length === 0;
}

function removePendingFile(index) {
    pendingFiles.splice(index, 1);
    renderFileList();
    loadButton.disabled = pendingFiles.length === 0;
}

function renderFileList() {
    fileListDiv.innerHTML = '';
    pendingFiles.forEach((f, i) => {
        const tag = document.createElement('div');
        tag.className = 'file-tag';
        // Guess type from filename
        const lower = f.name.toLowerCase();
        const icon = lower.includes('comment') ? '💬' : lower.includes('post') || lower.includes('submission') ? '📝' : '📄';
        const kb = (f.size / 1024).toFixed(1);
        tag.innerHTML = `<span>${icon} ${f.name} <em>(${kb} KB)</em></span><button class="remove-file" title="Remove">✕</button>`;
        tag.querySelector('.remove-file').addEventListener('click', e => {
            e.stopPropagation();
            removePendingFile(i);
        });
        fileListDiv.appendChild(tag);
    });
}

// ─── Load Files ───────────────────────────────────────────────────────────────
loadButton.addEventListener('click', async () => {
    if (pendingFiles.length === 0) return;

    loadButton.disabled = true;
    loadButton.textContent = 'Loading…';
    loadStatus.textContent = '';

    let combined = [];
    let totalSkipped = 0;

    for (const file of pendingFiles) {
        const { items, skipped } = await parseNDJSON(file);
        combined = combined.concat(items);
        totalSkipped += skipped;
    }

    rawData = combined;

    let statusMsg = `Loaded ${rawData.length} item(s) from ${pendingFiles.length} file(s).`;
    if (totalSkipped > 0) statusMsg += ` Skipped ${totalSkipped} malformed line(s).`;
    loadStatus.textContent = statusMsg;

    loadButton.textContent = 'Load Files';
    loadButton.disabled = false;

    applyFilters();
    showResumeButton();
});

function parseNDJSON(file) {
    return new Promise(resolve => {
        const reader = new FileReader();
        reader.onload = e => {
            const lines = e.target.result.split('\n');
            const items = [];
            let skipped = 0;
            for (const line of lines) {
                const trimmed = line.trim();
                if (!trimmed) continue;
                try { items.push(JSON.parse(trimmed)); }
                catch { skipped++; }
            }
            resolve({ items, skipped });
        };
        reader.readAsText(file);
    });
}

// ─── Color mode ───────────────────────────────────────────────────────────────
modeRadios.forEach(radio => {
    radio.addEventListener('change', () => {
        body.classList.remove('dark-gray', 'true-black');
        if (radio.value === 'dark-gray')  body.classList.add('dark-gray');
        if (radio.value === 'true-black') body.classList.add('true-black');
    });
});

// ─── Helpers ──────────────────────────────────────────────────────────────────
function isComment(item) {
    return 'body' in item && !('title' in item);
}

function isTextPost(item) {
    if (isComment(item)) return false;
    return ('is_self' in item) ? item.is_self : !!item.selftext;
}

function isLinkPost(item) {
    if (isComment(item)) return false;
    return ('is_self' in item) ? !item.is_self : (!!item.url && !item.selftext);
}

function getPostId(item) {
    return item.id
        ? item.id
        : `${item.author}_${item.created_utc}_${(item.title || item.body || '').substring(0, 20)}`;
}

function shortenText(text, max) {
    if (!text) return '';
    return text.length <= max ? text : text.substring(0, max) + '…';
}

function formatDate(item) {
    return new Date((item.created_utc || item.created || 0) * 1000).toLocaleString();
}

// ─── Filtering & Sorting ──────────────────────────────────────────────────────
function applyFilters() {
    const showText  = showTextPosts.checked;
    const showLink  = showLinkPosts.checked;
    const showCom   = showComments.checked;
    const savedOnly = showSavedOnly.checked;
    const query     = searchInput.value.toLowerCase().trim();

    filteredData = rawData.filter(item => {
        // Type filter
        if (isComment(item)  && !showCom)  return false;
        if (isTextPost(item) && !showText) return false;
        if (isLinkPost(item) && !showLink) return false;

        // Saved filter
        if (savedOnly && !savedPosts.has(getPostId(item))) return false;

        // Author filter
        if (currentAuthorFilter && item.author !== currentAuthorFilter) return false;

        // Search
        if (query) {
            const haystack = [item.title, item.selftext, item.body, item.author]
                .filter(Boolean).join(' ').toLowerCase();
            if (!haystack.includes(query)) return false;
        }

        return true;
    });

    applySorting();
    currentPage = 1;
    renderPage(currentPage);
    updateAuthorFilterBar();
}

function applySorting() {
    const mode = sortBy.value;
    if (mode === 'none') return;

    filteredData.sort((a, b) => {
        switch (mode) {
            case 'textLength': return (b.selftext || b.body || '').length - (a.selftext || a.body || '').length;
            case 'scoreAsc':   return (a.score || 0) - (b.score || 0);
            case 'scoreDesc':  return (b.score || 0) - (a.score || 0);
            case 'dateAsc':    return (a.created_utc || a.created || 0) - (b.created_utc || b.created || 0);
            case 'dateDesc':   return (b.created_utc || b.created || 0) - (a.created_utc || a.created || 0);
            default:           return 0;
        }
    });
}

// ─── Author filter ────────────────────────────────────────────────────────────
function filterByAuthor(author) {
    currentAuthorFilter = author;
    localStorage.setItem('currentAuthorFilter', author);
    applyFilters();
    window.scrollTo(0, 0);
}

function clearAuthorFilter() {
    currentAuthorFilter = null;
    localStorage.removeItem('currentAuthorFilter');
    applyFilters();
}

function updateAuthorFilterBar() {
    if (currentAuthorFilter) {
        authorFilterBar.style.display = 'flex';
        authorFilterName.textContent = currentAuthorFilter;
    } else {
        authorFilterBar.style.display = 'none';
    }
}

clearAuthorBtn.addEventListener('click', clearAuthorFilter);

// ─── Read / Saved helpers ─────────────────────────────────────────────────────
function markAsRead(item) {
    readPosts.add(getPostId(item));
    saveToStorage('readPosts', [...readPosts]);
}

function toggleRead(item, cardEl) {
    const id = getPostId(item);
    if (readPosts.has(id)) {
        readPosts.delete(id);
        cardEl.classList.remove('read-post');
    } else {
        readPosts.add(id);
        cardEl.classList.add('read-post');
    }
    saveToStorage('readPosts', [...readPosts]);
    const btn = cardEl.querySelector('.btn-read');
    if (btn) btn.textContent = readPosts.has(id) ? '✓' : '○';
}

function toggleSaved(item, cardEl) {
    const id = getPostId(item);
    if (savedPosts.has(id)) {
        savedPosts.delete(id);
        cardEl.classList.remove('saved-post');
    } else {
        savedPosts.add(id);
        cardEl.classList.add('saved-post');
    }
    saveToStorage('savedPosts', [...savedPosts]);
    const btn = cardEl.querySelector('.btn-save');
    if (btn) btn.textContent = savedPosts.has(id) ? '★' : '☆';
}

// ─── Build a post card (list view) ───────────────────────────────────────────
function buildCard(item, globalIndex) {
    const id      = getPostId(item);
    const div     = document.createElement('div');
    div.className = 'post';
    if (readPosts.has(id))  div.classList.add('read-post');
    if (savedPosts.has(id)) div.classList.add('saved-post');

    const date     = formatDate(item);
    const author   = item.author || 'unknown';
    const sub      = item.subreddit || 'unknown';
    const score    = item.score ?? 0;
    const typeTag  = isComment(item) ? '<span class="type-badge comment-badge">💬 Comment</span>' : '';

    // Meta HTML
    const metaHtml = `
        <div class="post-meta">
            ${typeTag}
            <span class="post-author" data-author="${author}">${author}</span>
            in <span class="post-subreddit">r/${sub}</span>
            <span class="post-score">${score} pts</span>
            <span class="post-date">${date}</span>
        </div>`;

    // Content preview
    let previewHtml = '';
    if (isComment(item)) {
        previewHtml = `<div class="post-preview">${shortenText(item.body, 200)}</div>`;
    } else if (isTextPost(item)) {
        const t = item.title ? `<h3>${item.title}</h3>` : '';
        previewHtml = t + (item.selftext ? `<div class="post-preview">${shortenText(item.selftext, 200)}</div>` : '');
    } else {
        // link post
        const t = item.title ? `<h3>${item.title}</h3>` : '';
        previewHtml = t + `<div class="post-preview"><a href="${item.url || '#'}" target="_blank" rel="noopener">${shortenText(item.url, 100)}</a></div>`;
    }

    // Action buttons
    const actionsHtml = `
        <div class="post-actions">
            <button class="btn-action btn-read" title="Toggle read">${readPosts.has(id) ? '✓' : '○'}</button>
            <button class="btn-action btn-save" title="Toggle saved">${savedPosts.has(id) ? '★' : '☆'}</button>
        </div>`;

    div.innerHTML = metaHtml + previewHtml + actionsHtml;

    // Events
    div.querySelector('.post-author').addEventListener('click', e => {
        e.stopPropagation();
        filterByAuthor(e.currentTarget.dataset.author);
    });

    div.querySelector('.btn-read').addEventListener('click', e => {
        e.stopPropagation();
        toggleRead(item, div);
    });

    div.querySelector('.btn-save').addEventListener('click', e => {
        e.stopPropagation();
        toggleSaved(item, div);
    });

    div.addEventListener('click', () => {
        markAsRead(item);
        div.classList.add('read-post');
        openPost(item, globalIndex);
    });

    return div;
}

// ─── Render list page ─────────────────────────────────────────────────────────
function renderPage(page) {
    contentDiv.innerHTML = '';
    const start = (page - 1) * pageSize;
    const slice = filteredData.slice(start, start + pageSize);

    if (slice.length === 0) {
        contentDiv.innerHTML = '<p class="empty-msg">No items match the current filters.</p>';
    } else {
        slice.forEach((item, i) => {
            contentDiv.appendChild(buildCard(item, start + i));
        });
    }

    // post count
    let countText = `${filteredData.length} item${filteredData.length !== 1 ? 's' : ''}`;
    if (currentAuthorFilter) countText += ` by ${currentAuthorFilter}`;
    postCountDiv.textContent = countText;

    // pagination
    pageInfo.textContent = `Page ${page} / ${Math.max(1, Math.ceil(filteredData.length / pageSize))}`;
    prevBtn.disabled = page === 1;
    nextBtn.disabled = start + pageSize >= filteredData.length;
    paginationDiv.style.display = '';
    postCountDiv.style.display  = '';

    // font / spacing
    contentDiv.style.fontSize   = fontSizeSelect.value;
    contentDiv.style.lineHeight = lineHeightSelect.value;
}

// ─── Open single post (blog mode) ─────────────────────────────────────────────
function openPost(item, globalIndex) {
    lastScrollY = window.scrollY;

    // Save reading position
    lastReadPosition = { id: getPostId(item), index: globalIndex, page: currentPage };
    saveToStorage('lastReadPosition', lastReadPosition);

    contentDiv.innerHTML = '';
    paginationDiv.style.display = 'none';
    postCountDiv.style.display  = 'none';

    // ── Nav bar ──
    const nav = document.createElement('div');
    nav.className = 'blog-nav';

    const backBtn = document.createElement('button');
    backBtn.className = 'nav-button back-button';
    backBtn.textContent = '← Back to List';
    backBtn.onclick = () => {
        renderPage(currentPage);
        window.scrollTo(0, lastScrollY);
        paginationDiv.style.display = '';
        postCountDiv.style.display  = '';
    };

    const prevPostBtn = document.createElement('button');
    prevPostBtn.className = 'nav-button prev-post';
    prevPostBtn.textContent = '← Previous';
    prevPostBtn.disabled = globalIndex <= 0;
    prevPostBtn.onclick = () => {
        if (globalIndex > 0) {
            const p = filteredData[globalIndex - 1];
            markAsRead(p);
            openPost(p, globalIndex - 1);
        }
    };

    const nextPostBtn = document.createElement('button');
    nextPostBtn.className = 'nav-button next-post';
    nextPostBtn.textContent = 'Next →';
    nextPostBtn.disabled = globalIndex >= filteredData.length - 1;
    nextPostBtn.onclick = () => {
        if (globalIndex < filteredData.length - 1) {
            const p = filteredData[globalIndex + 1];
            markAsRead(p);
            openPost(p, globalIndex + 1);
        }
    };

    nav.appendChild(backBtn);
    nav.appendChild(prevPostBtn);
    nav.appendChild(nextPostBtn);

    // ── Action bar ──
    const id = getPostId(item);
    const actionBar = document.createElement('div');
    actionBar.className = 'single-post-actions';

    const readBtn = document.createElement('button');
    readBtn.className = 'btn-action btn-read';
    readBtn.textContent = readPosts.has(id) ? '✓ Read' : '○ Mark as read';
    readBtn.onclick = () => {
        if (readPosts.has(id)) { readPosts.delete(id); readBtn.textContent = '○ Mark as read'; }
        else                   { readPosts.add(id);    readBtn.textContent = '✓ Read'; }
        saveToStorage('readPosts', [...readPosts]);
    };

    const saveBtn = document.createElement('button');
    saveBtn.className = 'btn-action btn-save';
    saveBtn.textContent = savedPosts.has(id) ? '★ Saved' : '☆ Save for later';
    saveBtn.onclick = () => {
        if (savedPosts.has(id)) { savedPosts.delete(id); saveBtn.textContent = '☆ Save for later'; }
        else                    { savedPosts.add(id);    saveBtn.textContent = '★ Saved'; }
        saveToStorage('savedPosts', [...savedPosts]);
    };

    actionBar.appendChild(readBtn);
    actionBar.appendChild(saveBtn);

    // ── Post content ──
    const postDiv = document.createElement('div');
    postDiv.className = 'post single-post';

    const author = item.author || 'unknown';
    const date   = formatDate(item);
    const authorSpan = `<span class="post-author clickable" data-author="${author}">${author}</span>`;

    const metaBlock = `
        <div class="single-meta">
            <div>${authorSpan} in <span class="post-subreddit">r/${item.subreddit || 'unknown'}</span></div>
            <div>Score: <strong>${item.score ?? 0}</strong> &nbsp;|&nbsp; ${date}</div>
        </div>`;

    if (isComment(item)) {
        postDiv.innerHTML = `
            <span class="type-badge comment-badge">💬 Comment</span>
            ${metaBlock}
            <div class="post-content">${item.body || ''}</div>`;
    } else if (isTextPost(item)) {
        postDiv.innerHTML = `
            <h3>${item.title || '(No Title)'}</h3>
            ${metaBlock}
            <div class="post-content">${item.selftext || '(No content)'}</div>`;
    } else {
        postDiv.innerHTML = `
            <h3>${item.title || '(No Title)'}</h3>
            ${metaBlock}
            <div class="post-content">
                <a href="${item.url || '#'}" target="_blank" rel="noopener">${item.url || '(No link)'}</a>
            </div>`;
    }

    // Author click in single view
    const authorEl = postDiv.querySelector('.post-author.clickable');
    if (authorEl) {
        authorEl.addEventListener('click', () => {
            filterByAuthor(authorEl.dataset.author);
        });
    }

    contentDiv.appendChild(nav);
    contentDiv.appendChild(actionBar);
    contentDiv.appendChild(postDiv);

    // Restore scroll for this post
    if (readingProgress[id]) {
        setTimeout(() => window.scrollTo(0, readingProgress[id]), 50);
    } else {
        window.scrollTo(0, 0);
    }

    // Track reading scroll
    let scrollTimer;
    const onScroll = () => {
        clearTimeout(scrollTimer);
        scrollTimer = setTimeout(() => {
            readingProgress[id] = window.scrollY;
            saveToStorage('readingProgress', readingProgress);
        }, 400);
    };
    window.addEventListener('scroll', onScroll);
    // Clean up listener when leaving post
    postDiv._cleanupScroll = () => window.removeEventListener('scroll', onScroll);
}

// ─── Resume reading button ────────────────────────────────────────────────────
function showResumeButton() {
    document.querySelector('.resume-reading')?.remove();
    if (!lastReadPosition) return;

    const wrap = document.createElement('div');
    wrap.className = 'resume-reading';

    const btn = document.createElement('button');
    btn.textContent = '▶ Resume Reading';
    btn.onclick = () => {
        currentPage = lastReadPosition.page;
        renderPage(currentPage);
        setTimeout(() => {
            const target = filteredData.find(i => getPostId(i) === lastReadPosition.id)
                        || filteredData[lastReadPosition.index];
            if (target) openPost(target, filteredData.indexOf(target));
        }, 100);
    };

    wrap.appendChild(btn);
    const controls = document.querySelector('.controls');
    controls.parentNode.insertBefore(wrap, controls.nextSibling);
}

// ─── Pagination ───────────────────────────────────────────────────────────────
prevBtn.addEventListener('click', () => {
    if (currentPage > 1) { currentPage--; renderPage(currentPage); window.scrollTo(0,0); }
});
nextBtn.addEventListener('click', () => {
    if (currentPage * pageSize < filteredData.length) { currentPage++; renderPage(currentPage); window.scrollTo(0,0); }
});

// ─── Controls wiring ─────────────────────────────────────────────────────────
function setupControls() {
    showTextPosts.addEventListener('change', applyFilters);
    showLinkPosts.addEventListener('change', applyFilters);
    showComments.addEventListener('change', applyFilters);
    showSavedOnly.addEventListener('change', applyFilters);

    sortBy.addEventListener('change', () => { applySorting(); renderPage(currentPage); });

    searchInput.addEventListener('input', () => { applyFilters(); });

    fontSizeSelect.addEventListener('change', () => {
        contentDiv.style.fontSize = fontSizeSelect.value;
    });
    lineHeightSelect.addEventListener('change', () => {
        contentDiv.style.lineHeight = lineHeightSelect.value;
    });
}

// ─── Touch swipe ──────────────────────────────────────────────────────────────
(function setupSwipe() {
    let startX = 0;
    document.addEventListener('touchstart', e => { startX = e.changedTouches[0].screenX; }, { passive: true });
    document.addEventListener('touchend', e => {
        const delta = e.changedTouches[0].screenX - startX;
        if (Math.abs(delta) < 80) return;

        const inSingle = !!contentDiv.querySelector('.single-post');
        if (inSingle) {
            if (delta > 0) document.querySelector('.prev-post')?.click();
            else           document.querySelector('.next-post')?.click();
        } else {
            if (delta > 0 && !prevBtn.disabled) prevBtn.click();
            else if (delta < 0 && !nextBtn.disabled) nextBtn.click();
        }
    }, { passive: true });
})();

// ─── Click outside single post to go back ────────────────────────────────────
document.addEventListener('click', e => {
    if (!contentDiv.querySelector('.single-post')) return;
    if (e.target.closest('.single-post'))        return;
    if (e.target.closest('.blog-nav'))           return;
    if (e.target.closest('.single-post-actions'))return;
    if (!e.target.closest('#wrapper'))           return;

    renderPage(currentPage);
    window.scrollTo(0, lastScrollY);
    paginationDiv.style.display = '';
    postCountDiv.style.display  = '';
});
