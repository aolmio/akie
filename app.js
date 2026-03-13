const body = document.body;  
const modeRadios = document.querySelectorAll(‘input[name=“colorMode”]’);  
const fileInput = document.getElementById(‘fileInput’);  
const loadButton = document.getElementById(‘loadButton’);  
const contentDiv = document.getElementById(‘content’);  
const prevBtn = document.getElementById(‘prevBtn’);  
const nextBtn = document.getElementById(‘nextBtn’);  
const pageInfo = document.getElementById(‘pageInfo’);  
const showTextPosts = document.getElementById(‘showTextPosts’);  
const showLinkPosts = document.getElementById(‘showLinkPosts’);  
const showComments = document.getElementById(‘showComments’);  
const sortBy = document.getElementById(‘sortBy’);  
const searchInput = document.getElementById(‘searchInput’);  
const fontSizeSelect = document.getElementById(‘fontSizeSelect’);  
const lineHeightSelect = document.getElementById(‘lineHeightSelect’);  
const postCountDiv = document.getElementById(‘postCount’);  
const paginationDiv = document.querySelector(’.pagination’);  
const dropZone = document.getElementById(‘dropZone’);  
const fileTags = document.getElementById(‘fileTags’);  
  
// Global variables  
let readPosts = new Set();  
let savedPosts = new Set();  
let readingProgress = {};  
let lastReadPosition = null;  
let currentAuthorFilter = null;  
  
let rawData = [];  
let filteredData = [];  
let currentPage = 1;  
const pageSize = 10;  
let lastScrollY = 0;  
  
// Track selected files across multiple picks  
let selectedFiles = [];  
  
// ─── DOMContentLoaded ────────────────────────────────────────────────────────  
document.addEventListener(‘DOMContentLoaded’, () => {  
loadStoredData();  
addSavedFilter();  
addResumeReadingButton();  
addClearAuthorFilterButton();  
setupTouchGestures();  
setupDropZone();  
});  
  
// ─── Stored Data ─────────────────────────────────────────────────────────────  
function loadStoredData() {  
try {  
if (localStorage.getItem(‘readPosts’))  
readPosts = new Set(JSON.parse(localStorage.getItem(‘readPosts’)));  
if (localStorage.getItem(‘savedPosts’))  
savedPosts = new Set(JSON.parse(localStorage.getItem(‘savedPosts’)));  
if (localStorage.getItem(‘readingProgress’))  
readingProgress = JSON.parse(localStorage.getItem(‘readingProgress’));  
if (localStorage.getItem(‘lastReadPosition’))  
lastReadPosition = JSON.parse(localStorage.getItem(‘lastReadPosition’));  
if (localStorage.getItem(‘currentAuthorFilter’))  
currentAuthorFilter = localStorage.getItem(‘currentAuthorFilter’);  
} catch (error) {  
console.error(“Error loading stored data:”, error);  
[‘readPosts’,‘savedPosts’,‘readingProgress’,‘lastReadPosition’,‘currentAuthorFilter’]  
.forEach(k => localStorage.removeItem(k));  
}  
}  
  
// ─── Drop Zone & Multi-file Selection ────────────────────────────────────────  
function setupDropZone() {  
// Click on drop zone triggers file picker  
dropZone.addEventListener(‘click’, () => fileInput.click());  
  
```  
// Drag & drop  
dropZone.addEventListener('dragover', e => {  
    e.preventDefault();  
    dropZone.classList.add('drag-over');  
});  
dropZone.addEventListener('dragleave', () => dropZone.classList.remove('drag-over'));  
dropZone.addEventListener('drop', e => {  
    e.preventDefault();  
    dropZone.classList.remove('drag-over');  
    addFiles([...e.dataTransfer.files]);  
});  
  
// Normal file input change  
fileInput.addEventListener('change', () => {  
    addFiles([...fileInput.files]);  
    // Reset input so same file can be re-selected if needed  
    fileInput.value = '';  
});  
```  
  
}  
  
function addFiles(newFiles) {  
newFiles.forEach(f => {  
// Avoid exact duplicates (same name + size)  
const isDupe = selectedFiles.some(sf => sf.name === f.name && sf.size === f.size);  
if (!isDupe) selectedFiles.push(f);  
});  
renderFileTags();  
loadButton.disabled = selectedFiles.length === 0;  
}  
  
function removeFile(index) {  
selectedFiles.splice(index, 1);  
renderFileTags();  
loadButton.disabled = selectedFiles.length === 0;  
}  
  
function renderFileTags() {  
fileTags.innerHTML = ‘’;  
selectedFiles.forEach((f, i) => {  
const tag = document.createElement(‘span’);  
tag.className = ‘file-tag’;  
  
```  
    // Auto-label: detect posts vs comments from filename  
    let icon = '📄';  
    const lower = f.name.toLowerCase();  
    if (lower.includes('comment')) icon = '💬';  
    else if (lower.includes('post') || lower.includes('submission')) icon = '📝';  
  
    tag.innerHTML = `${icon} ${f.name} <button class="file-tag-remove" title="Remove">×</button>`;  
    tag.querySelector('button').addEventListener('click', e => {  
        e.stopPropagation();  
        removeFile(i);  
    });  
    fileTags.appendChild(tag);  
});  
```  
  
}  
  
// ─── Load Button ──────────────────────────────────────────────────────────────  
loadButton.addEventListener(‘click’, async () => {  
if (selectedFiles.length === 0) return;  
  
```  
loadButton.disabled = true;  
loadButton.textContent = 'Loading…';  
  
let allData = [];  
let totalSkipped = 0;  
  
// Read all files in parallel  
const results = await Promise.all(selectedFiles.map(readNDJSON));  
results.forEach(({ data, skipped }) => {  
    allData = allData.concat(data);  
    totalSkipped += skipped;  
});  
  
rawData = allData;  
  
contentDiv.innerHTML = totalSkipped > 0  
    ? `⚠️ Skipped ${totalSkipped} malformed entries.<br><br>`  
    : '';  
  
loadButton.textContent = 'Load';  
loadButton.disabled = false;  
  
applyFilters();  
```  
  
});  
  
function readNDJSON(file) {  
return new Promise(resolve => {  
const reader = new FileReader();  
reader.onload = e => {  
const lines = e.target.result.split(’\n’).filter(l => l.trim());  
const data = [];  
let skipped = 0;  
for (const line of lines) {  
try { data.push(JSON.parse(line)); }  
catch { skipped++; }  
}  
resolve({ data, skipped });  
};  
reader.readAsText(file);  
});  
}  
  
// ─── Color Mode ──────────────────────────────────────────────────────────────  
modeRadios.forEach(radio => {  
radio.addEventListener(‘change’, () => {  
body.classList.remove(‘dark-gray’, ‘true-black’);  
if (radio.checked) {  
if (radio.value === ‘dark-gray’) body.classList.add(‘dark-gray’);  
if (radio.value === ‘true-black’) body.classList.add(‘true-black’);  
}  
});  
});  
  
// ─── Filtering ────────────────────────────────────────────────────────────────  
function applyFilters() {  
const showText = showTextPosts.checked;  
const showLink = showLinkPosts.checked;  
const showCom  = showComments.checked;  
const showSavedOnly = document.getElementById(‘showSavedOnly’)?.checked;  
const query = searchInput.value.toLowerCase();  
  
```  
filteredData = rawData.filter(item => {  
    const isComment = 'body' in item && !('title' in item);  
    const isText    = !isComment && (('is_self' in item) ? item.is_self : !!item.selftext);  
    const isLink    = !isComment && (('is_self' in item) ? !item.is_self : (!!item.url && !item.selftext));  
  
    if (isComment && !showCom)  return false;  
    if (isText    && !showText) return false;  
    if (isLink    && !showLink) return false;  
  
    if (showSavedOnly && !savedPosts.has(getPostId(item))) return false;  
    if (currentAuthorFilter && item.author !== currentAuthorFilter) return false;  
  
    const content = `${item.title || ''} ${item.selftext || ''} ${item.body || ''} ${item.author || ''}`.toLowerCase();  
    return content.includes(query);  
});  
  
applySorting();  
currentPage = 1;  
renderPage(currentPage);  
updateAuthorFilterUI();  
```  
  
}  
  
// ─── Sorting ──────────────────────────────────────────────────────────────────  
function applySorting() {  
const mode = sortBy.value;  
filteredData.sort((a, b) => {  
const lenA = (a.selftext || a.body || ‘’).length;  
const lenB = (b.selftext || b.body || ‘’).length;  
const scoreA = a.score || 0, scoreB = b.score || 0;  
const dateA  = a.created_utc || a.created || 0;  
const dateB  = b.created_utc || b.created || 0;  
switch (mode) {  
case ‘textLength’: return lenB - lenA;  
case ‘scoreAsc’:   return scoreA - scoreB;  
case ‘scoreDesc’:  return scoreB - scoreA;  
case ‘dateAsc’:    return dateA - dateB;  
case ‘dateDesc’:   return dateB - dateA;  
default: return 0;  
}  
});  
}  
  
// ─── Helpers ──────────────────────────────────────────────────────────────────  
function updatePostCount() {  
postCountDiv.textContent =  
`Showing ${filteredData.length} item${filteredData.length !== 1 ? 's' : ''}` +  
(currentAuthorFilter ? ` by ${currentAuthorFilter}` : ‘’);  
}  
  
function shortenText(text, maxLength) {  
if (!text) return ‘’;  
return text.length <= maxLength ? text : text.substring(0, maxLength) + ‘…’;  
}  
  
function getPostId(post) {  
return `${post.id || (post.author + post.created_utc + (post.title || post.body?.substring(0, 20) || ''))}`;  
}  
  
function markAsRead(post) {  
readPosts.add(getPostId(post));  
localStorage.setItem(‘readPosts’, JSON.stringify([…readPosts]));  
}  
  
function toggleRead(post, element) {  
const postId = getPostId(post);  
if (readPosts.has(postId)) {  
readPosts.delete(postId);  
element.classList.remove(‘read-post’);  
element.querySelector(’.read-toggle’).textContent = ‘○’;  
element.querySelector(’.read-toggle’).title = ‘Mark as read’;  
} else {  
readPosts.add(postId);  
element.classList.add(‘read-post’);  
element.querySelector(’.read-toggle’).textContent = ‘✓’;  
element.querySelector(’.read-toggle’).title = ‘Mark as unread’;  
}  
localStorage.setItem(‘readPosts’, JSON.stringify([…readPosts]));  
}  
  
function toggleSaved(post, element) {  
const postId = getPostId(post);  
if (savedPosts.has(postId)) {  
savedPosts.delete(postId);  
element.classList.remove(‘saved-post’);  
element.querySelector(’.save-toggle’).textContent = ‘☆’;  
element.querySelector(’.save-toggle’).title = ‘Save for later’;  
} else {  
savedPosts.add(postId);  
element.classList.add(‘saved-post’);  
element.querySelector(’.save-toggle’).textContent = ‘★’;  
element.querySelector(’.save-toggle’).title = ‘Unsave’;  
}  
localStorage.setItem(‘savedPosts’, JSON.stringify([…savedPosts]));  
}  
  
function filterByAuthor(author) {  
currentAuthorFilter = author;  
localStorage.setItem(‘currentAuthorFilter’, author);  
applyFilters();  
window.scrollTo(0, 0);  
}  
  
function clearAuthorFilter() {  
currentAuthorFilter = null;  
localStorage.removeItem(‘currentAuthorFilter’);  
applyFilters();  
const btn = document.getElementById(‘clearAuthorFilter’);  
if (btn) btn.style.display = ‘none’;  
}  
  
function updateAuthorFilterUI() {  
const btn = document.getElementById(‘clearAuthorFilter’);  
if (btn) btn.style.display = currentAuthorFilter ? ‘block’ : ‘none’;  
}  
  
function addClearAuthorFilterButton() {  
const filterControls = document.querySelector(’.controls’);  
if (!document.getElementById(‘clearAuthorFilter’)) {  
const btn = document.createElement(‘button’);  
btn.id = ‘clearAuthorFilter’;  
btn.textContent = ‘Clear Author Filter’;  
btn.className = ‘action-button clear-filter’;  
btn.style.display = currentAuthorFilter ? ‘block’ : ‘none’;  
btn.addEventListener(‘click’, clearAuthorFilter);  
filterControls.appendChild(btn);  
}  
}  
  
// ─── Render List ──────────────────────────────────────────────────────────────  
function renderPage(page) {  
contentDiv.innerHTML = ‘’;  
const start = (page - 1) * pageSize;  
const items = filteredData.slice(start, start + pageSize);  
  
```  
if (items.length === 0) {  
    contentDiv.innerHTML = '<p>No entries to display for current filter.</p>';  
} else {  
    items.forEach((post, index) => {  
        const div = document.createElement('div');  
        div.className = 'post';  
  
        if (readPosts.has(getPostId(post)))  div.classList.add('read-post');  
        if (savedPosts.has(getPostId(post))) div.classList.add('saved-post');  
  
        const dateStr = new Date((post.created_utc || post.created || 0) * 1000).toLocaleString();  
        const isComment = 'body' in post && !('title' in post);  
  
        const readIcon = readPosts.has(getPostId(post)) ? '✓' : '○';  
        const saveIcon = savedPosts.has(getPostId(post)) ? '★' : '☆';  
        const readTitle = readPosts.has(getPostId(post)) ? 'Mark as unread' : 'Mark as read';  
        const saveTitle = savedPosts.has(getPostId(post)) ? 'Unsave' : 'Save for later';  
  
        const actionHtml = `  
            <div class="post-actions">  
                <button class="action-button read-toggle" title="${readTitle}">${readIcon}</button>  
                <button class="action-button save-toggle" title="${saveTitle}">${saveIcon}</button>  
            </div>`;  
  
        if (isComment) {  
            div.innerHTML = `  
                <div class="post-type-badge comment-badge">💬 Comment</div>  
                <div class="post-meta">  
                    <span class="post-author" data-author="${post.author || 'unknown'}">${post.author || 'unknown'}</span> in  
                    <span class="post-subreddit">r/${post.subreddit || 'unknown'}</span>  
                    <span class="post-score">${post.score ?? 0} pts</span>  
                    <span class="post-date">${dateStr}</span>  
                </div>  
                <div class="post-preview">${shortenText(post.body, 150)}</div>  
                ${actionHtml}`;  
        } else {  
            const shortText = post.selftext ? shortenText(post.selftext, 150) : '';  
            div.innerHTML = `  
                <h3>${post.title || '(No Title)'}</h3>  
                <div class="post-meta">  
                    <span class="post-author" data-author="${post.author || 'unknown'}">${post.author || 'unknown'}</span> in  
                    <span class="post-subreddit">r/${post.subreddit || 'unknown'}</span>  
                    <span class="post-score">${post.score ?? 0} pts</span>  
                    <span class="post-date">${dateStr}</span>  
                </div>  
                <div class="post-preview">  
                    ${(post.is_self !== false || post.selftext)  
                        ? shortText  
                        : `<a href="${post.url || '#'}" target="_blank">${post.url || '(No link)'}</a>`}  
                </div>  
                ${actionHtml}`;  
        }  
  
        div.querySelector('.post-actions').addEventListener('click', e => e.stopPropagation());  
        div.querySelector('.read-toggle').addEventListener('click', e => { e.stopPropagation(); toggleRead(post, div); });  
        div.querySelector('.save-toggle').addEventListener('click', e => { e.stopPropagation(); toggleSaved(post, div); });  
        div.querySelector('.post-author').addEventListener('click', e => {  
            e.stopPropagation();  
            filterByAuthor(e.target.dataset.author);  
        });  
        div.addEventListener('click', () => {  
            markAsRead(post);  
            div.classList.add('read-post');  
            renderSinglePost(post, start + index);  
        });  
  
        contentDiv.appendChild(div);  
    });  
}  
  
updatePostCount();  
pageInfo.textContent = `Page ${page}`;  
prevBtn.disabled = page === 1;  
nextBtn.disabled = page * pageSize >= filteredData.length;  
paginationDiv.style.display = '';  
postCountDiv.style.display = '';  
contentDiv.style.fontSize = fontSizeSelect.value;  
contentDiv.style.lineHeight = lineHeightSelect.value;  
```  
  
}  
  
// ─── Render Single Post ───────────────────────────────────────────────────────  
function renderSinglePost(post, currentIndex) {  
lastScrollY = window.scrollY;  
contentDiv.innerHTML = ‘’;  
  
```  
const navControls = document.createElement('div');  
navControls.className = 'blog-nav';  
  
const backBtn = document.createElement('button');  
backBtn.textContent = '← Back to List';  
backBtn.className = 'back-button';  
backBtn.onclick = () => {  
    renderPage(currentPage);  
    window.scrollTo(0, lastScrollY);  
    paginationDiv.style.display = '';  
    postCountDiv.style.display = '';  
};  
  
const prevPostBtn = document.createElement('button');  
prevPostBtn.textContent = '← Previous';  
prevPostBtn.className = 'nav-button prev-post';  
prevPostBtn.disabled = currentIndex <= 0;  
prevPostBtn.onclick = () => {  
    if (currentIndex > 0) {  
        const p = filteredData[currentIndex - 1];  
        markAsRead(p);  
        renderSinglePost(p, currentIndex - 1);  
    }  
};  
  
const nextPostBtn = document.createElement('button');  
nextPostBtn.textContent = 'Next →';  
nextPostBtn.className = 'nav-button next-post';  
nextPostBtn.disabled = currentIndex >= filteredData.length - 1;  
nextPostBtn.onclick = () => {  
    if (currentIndex < filteredData.length - 1) {  
        const p = filteredData[currentIndex + 1];  
        markAsRead(p);  
        renderSinglePost(p, currentIndex + 1);  
    }  
};  
  
navControls.appendChild(backBtn);  
navControls.appendChild(prevPostBtn);  
navControls.appendChild(nextPostBtn);  
  
const div = document.createElement('div');  
div.className = 'post single-post';  
const dateStr = new Date((post.created_utc || post.created || 0) * 1000).toLocaleString();  
  
const actionBar = document.createElement('div');  
actionBar.className = 'single-post-actions';  
  
const readToggle = document.createElement('button');  
readToggle.className = 'action-button read-toggle';  
readToggle.textContent = readPosts.has(getPostId(post)) ? '✓ Read' : '○ Mark as read';  
readToggle.onclick = () => {  
    const pid = getPostId(post);  
    if (readPosts.has(pid)) { readPosts.delete(pid); readToggle.textContent = '○ Mark as read'; }  
    else { readPosts.add(pid); readToggle.textContent = '✓ Read'; }  
    localStorage.setItem('readPosts', JSON.stringify([...readPosts]));  
};  
  
const saveToggle = document.createElement('button');  
saveToggle.className = 'action-button save-toggle';  
saveToggle.textContent = savedPosts.has(getPostId(post)) ? '★ Saved' : '☆ Save for later';  
saveToggle.onclick = () => {  
    const pid = getPostId(post);  
    if (savedPosts.has(pid)) { savedPosts.delete(pid); saveToggle.textContent = '☆ Save for later'; }  
    else { savedPosts.add(pid); saveToggle.textContent = '★ Saved'; }  
    localStorage.setItem('savedPosts', JSON.stringify([...savedPosts]));  
};  
  
actionBar.appendChild(readToggle);  
actionBar.appendChild(saveToggle);  
  
const authorHtml = `<strong>Author:</strong> <span class="post-author clickable" data-author="${post.author || 'unknown'}">${post.author || 'unknown'}</span>`;  
const isComment = 'body' in post && !('title' in post);  
  
if (isComment) {  
    div.innerHTML = `  
        <div class="post-type-badge comment-badge">💬 Comment</div>  
        <p class="post-meta-single">  
            ${authorHtml}<br>  
            <strong>Subreddit:</strong> r/${post.subreddit || 'unknown'}<br>  
            <strong>Score:</strong> ${post.score ?? 0}<br>  
            <strong>Date:</strong> ${dateStr}  
        </p>  
        <div class="post-content"><strong>Comment:</strong><br>${post.body}</div>`;  
} else {  
    div.innerHTML = `  
        <h3>${post.title || '(No Title)'}</h3>  
        <p class="post-meta-single">  
            ${authorHtml}<br>  
            <strong>Subreddit:</strong> r/${post.subreddit || 'unknown'}<br>  
            <strong>Score:</strong> ${post.score ?? 0}<br>  
            <strong>Date:</strong> ${dateStr}  
        </p>  
        ${(post.is_self !== false || post.selftext)  
            ? `<div class="post-content"><strong>Text Post:</strong><br>${post.selftext || '(No content)'}</div>`  
            : `<div class="post-content"><strong>Link Post:</strong><br><a href="${post.url || '#'}" target="_blank">${post.url || '(No link)'}</a></div>`}`;  
}  
  
lastReadPosition = { postId: getPostId(post), index: currentIndex, page: currentPage };  
localStorage.setItem('lastReadPosition', JSON.stringify(lastReadPosition));  
  
contentDiv.appendChild(navControls);  
contentDiv.appendChild(actionBar);  
contentDiv.appendChild(div);  
  
paginationDiv.style.display = 'none';  
postCountDiv.style.display = 'none';  
  
const authorEl = div.querySelector('.post-author.clickable');  
if (authorEl) {  
    authorEl.addEventListener('click', () => {  
        filterByAuthor(authorEl.dataset.author);  
        renderPage(1);  
    });  
}  
  
setupReadingProgressTracking(post);  
```  
  
}  
  
// ─── Reading Progress ─────────────────────────────────────────────────────────  
function setupReadingProgressTracking(post) {  
const postId = getPostId(post);  
if (readingProgress[postId]) {  
setTimeout(() => window.scrollTo(0, readingProgress[postId]), 100);  
}  
let scrollTimeout;  
window.addEventListener(‘scroll’, () => {  
clearTimeout(scrollTimeout);  
scrollTimeout = setTimeout(() => {  
readingProgress[postId] = window.scrollY;  
localStorage.setItem(‘readingProgress’, JSON.stringify(readingProgress));  
}, 500);  
});  
}  
  
function addResumeReadingButton() {  
if (!lastReadPosition) return;  
document.querySelector(’.resume-reading’)?.remove();  
  
```  
const resumeDiv = document.createElement('div');  
resumeDiv.className = 'resume-reading';  
  
const btn = document.createElement('button');  
btn.textContent = 'Resume Reading';  
btn.onclick = () => {  
    currentPage = lastReadPosition.page;  
    renderPage(currentPage);  
    setTimeout(() => {  
        const post = filteredData[lastReadPosition.index];  
        if (post) renderSinglePost(post, lastReadPosition.index);  
    }, 100);  
};  
  
resumeDiv.appendChild(btn);  
const controlsDiv = document.querySelector('.controls');  
if (controlsDiv) controlsDiv.parentNode.insertBefore(resumeDiv, controlsDiv.nextSibling);  
```  
  
}  
  
// ─── Saved Filter ─────────────────────────────────────────────────────────────  
function addSavedFilter() {  
const filterControls = document.querySelector(’.controls’);  
if (!document.getElementById(‘showSavedOnly’)) {  
const savedFilter = document.createElement(‘label’);  
savedFilter.className = ‘toggle’;  
savedFilter.innerHTML = ‘<input type="checkbox" id="showSavedOnly"> Saved Only’;  
savedFilter.querySelector(‘input’).addEventListener(‘change’, applyFilters);  
filterControls.appendChild(savedFilter);  
}  
}  
  
// ─── Touch Gestures ───────────────────────────────────────────────────────────  
function setupTouchGestures() {  
let touchStartX = 0, touchEndX = 0;  
document.addEventListener(‘touchstart’, e => { touchStartX = e.changedTouches[0].screenX; }, false);  
document.addEventListener(‘touchend’, e => {  
touchEndX = e.changedTouches[0].screenX;  
const dist = touchEndX - touchStartX;  
const minDist = 100;  
const singlePost = document.querySelector(’.single-post’);  
  
```  
    if (singlePost) {  
        if (dist > minDist)  document.querySelector('.prev-post')?.click();  
        else if (dist < -minDist) document.querySelector('.next-post')?.click();  
    } else {  
        if (dist > minDist && !prevBtn.disabled)  prevBtn.click();  
        else if (dist < -minDist && !nextBtn.disabled) nextBtn.click();  
    }  
}, false);  
```  
  
}  
  
// ─── Click outside single post ────────────────────────────────────────────────  
document.addEventListener(‘click’, e => {  
if (  
contentDiv.querySelector(’.single-post’) &&  
!e.target.closest(’.single-post’) &&  
!e.target.classList.contains(‘back-button’) &&  
!e.target.closest(’.blog-nav’) &&  
!e.target.closest(’.single-post-actions’) &&  
e.target.closest(’#wrapper’)  
) {  
renderPage(currentPage);  
window.scrollTo(0, lastScrollY);  
paginationDiv.style.display = ‘’;  
postCountDiv.style.display = ‘’;  
}  
});  
  
// ─── Pagination ───────────────────────────────────────────────────────────────  
prevBtn.addEventListener(‘click’, () => { if (currentPage > 1) { currentPage–; renderPage(currentPage); } });  
nextBtn.addEventListener(‘click’, () => { if (currentPage * pageSize < filteredData.length) { currentPage++; renderPage(currentPage); } });  
  
// ─── Controls ─────────────────────────────────────────────────────────────────  
// ─── Controls ─────────────────────────────────────────────────────────────────  
showTextPosts.addEventListener(‘change’, applyFilters);  
showLinkPosts.addEventListener(‘change’, applyFilters);  
showComments.addEventListener(‘change’, applyFilters);  
sortBy.addEventListener(‘change’, () => { applySorting(); renderPage(currentPage); });  
searchInput.addEventListener(‘input’, applyFilters);  
fontSizeSelect.addEventListener(‘change’, () => { contentDiv.style.fontSize = fontSizeSelect.value; });  
lineHeightSelect.addEventListener(‘change’, () => { contentDiv.style.lineHeight = lineHeightSelect.value; });  
