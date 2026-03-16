/* ===== State ===== */
const state = {
  notes: [],
  total: 0,
  page: 1,
  limit: 20,
  query: '',
  tag: '',
  view: 'all',          // 'all' | 'pinned'
  composeTags: [],
  pendingImages: [],    // File[] staged for upload after note creation
  editId: null,
  editTags: [],
};

/* ===== API ===== */
const api = {
  async get(path) {
    const r = await fetch('/api/v1' + path);
    if (!r.ok) throw new Error(await r.text());
    return r.json();
  },
  async post(path, body) {
    const r = await fetch('/api/v1' + path, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(body) });
    if (!r.ok) throw new Error(await r.text());
    return r.json();
  },
  async put(path, body) {
    const r = await fetch('/api/v1' + path, { method:'PUT', headers:{'Content-Type':'application/json'}, body: JSON.stringify(body) });
    if (!r.ok) throw new Error(await r.text());
    return r.json();
  },
  async del(path) {
    const r = await fetch('/api/v1' + path, { method:'DELETE' });
    if (!r.ok) throw new Error(await r.text());
  },
  async uploadImage(noteId, file) {
    const fd = new FormData();
    fd.append('image', file);
    const r = await fetch(`/api/v1/notes/${noteId}/images`, { method:'POST', body: fd });
    if (!r.ok) throw new Error(await r.text());
    return r.json();
  }
};

/* ===== Notes Loading ===== */
async function loadNotes(reset = false) {
  if (reset) {
    state.page = 1;
    state.notes = [];
  }
  let path = `/notes?page=${state.page}&limit=${state.limit}`;
  if (state.query) path += `&q=${encodeURIComponent(state.query)}`;
  if (state.view === 'pinned') path += `&tag=__pinned__`;
  if (state.tag) path += `&tag=${encodeURIComponent(state.tag)}`;

  // For pinned view, filter client-side
  try {
    const result = await api.get(path.replace('tag=__pinned__', ''));
    if (state.view === 'pinned') {
      result.notes = result.notes.filter(n => n.pinned);
    }
    state.notes = reset ? result.notes : [...state.notes, ...result.notes];
    state.total = result.total;
    renderNotes(reset);
    renderTags();
    updateCount();
    document.getElementById('load-more-btn').style.display =
      state.notes.length < state.total ? 'inline-block' : 'none';
  } catch(e) {
    toast('加载失败: ' + e.message);
  }
}

async function loadMore() {
  state.page++;
  await loadNotes(false);
}

/* ===== Render ===== */
function renderNotes(reset) {
  const grid = document.getElementById('notes-grid');
  const empty = document.getElementById('empty-state');
  if (reset) grid.innerHTML = '';

  if (state.notes.length === 0) {
    empty.style.display = 'block';
  } else {
    empty.style.display = 'none';
    const startIdx = reset ? 0 : (state.page - 1) * state.limit;
    const newNotes = reset ? state.notes : state.notes.slice(startIdx);
    newNotes.forEach(note => grid.appendChild(createNoteCard(note)));
  }
}

function createNoteCard(note) {
  const div = document.createElement('div');
  div.className = 'note-card' + (note.pinned ? ' pinned' : '');
  div.dataset.id = note.id;

  const date = new Date(note.created_at).toLocaleString('zh-CN', {
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit'
  });

  const tagsHtml = (note.tags || []).map(t =>
    `<span class="tag-badge" onclick="filterByTag('${escHtml(t)}')">#${escHtml(t)}</span>`
  ).join('');

  const imagesHtml = (note.images || []).length > 0
    ? `<div class="note-images">${note.images.map(img =>
        `<img src="/uploads/${img}" onclick="openLightbox(this)" loading="lazy"/>`
      ).join('')}</div>` : '';

  const renderedMd = marked.parse(note.content || '', { breaks: true, gfm: true });

  div.innerHTML = `
    <div class="note-meta">
      ${note.pinned ? '<span class="pin-badge">📌</span>' : ''}
      <span>${date}</span>
    </div>
    <div class="note-content">${renderedMd}</div>
    ${imagesHtml}
    ${tagsHtml ? `<div class="note-tags">${tagsHtml}</div>` : ''}
    <div class="note-actions">
      <button class="btn-icon" title="编辑" onclick="openEdit(${note.id})">
        <svg viewBox="0 0 24 24"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a1 1 0 0 0 0-1.41l-2.34-2.34a1 1 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg>
      </button>
      <button class="btn-icon" title="置顶切换" onclick="togglePin(${note.id}, ${note.pinned})">
        <svg viewBox="0 0 24 24" style="fill:${note.pinned ? 'var(--pin)' : 'currentColor'}"><path d="M16 12V4h1V2H7v2h1v8l-2 2v2h5.2v6h1.6v-6H18v-2l-2-2z"/></svg>
      </button>
      <button class="btn-icon danger" title="删除" onclick="deleteNote(${note.id})">
        <svg viewBox="0 0 24 24"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>
      </button>
    </div>
  `;
  return div;
}

function updateNoteCard(note) {
  const existing = document.querySelector(`.note-card[data-id="${note.id}"]`);
  if (existing) {
    const updated = createNoteCard(note);
    existing.replaceWith(updated);
  }
}

function removeNoteCard(id) {
  const el = document.querySelector(`.note-card[data-id="${id}"]`);
  if (el) el.remove();
}

/* ===== Tags ===== */
async function renderTags() {
  try {
    const tags = await api.get('/tags');
    const list = document.getElementById('tag-list');
    list.innerHTML = tags.map(t => `
      <div class="tag-nav-item${state.tag === t ? ' active' : ''}" onclick="filterByTag('${escHtml(t)}')">${escHtml(t)}</div>
    `).join('');
  } catch(_) {}
}

function filterByTag(tag) {
  if (state.tag === tag) {
    state.tag = '';
    state.view = 'all';
  } else {
    state.tag = tag;
    state.view = '';
  }
  // update nav active
  document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
  loadNotes(true);
}

function setView(view, el) {
  state.view = view;
  state.tag = '';
  state.query = '';
  document.getElementById('search-input').value = '';
  document.querySelectorAll('.nav-item').forEach(e => e.classList.remove('active'));
  el.classList.add('active');
  loadNotes(true);
}

function updateCount() {
  const el = document.getElementById('note-count');
  el.textContent = `共 ${state.total} 条`;
}

/* ===== Compose ===== */
function autoResize(el) {
  el.style.height = 'auto';
  el.style.height = el.scrollHeight + 'px';
}

function composeKeydown(e) {
  if (e.ctrlKey && e.key === 'Enter') {
    e.preventDefault();
    submitNote();
  }
}

function tagKeydown(e) {
  if (e.key === 'Enter' || e.key === ',') {
    e.preventDefault();
    const val = e.target.value.trim().replace(/^#/, '');
    if (val && !state.composeTags.includes(val)) {
      state.composeTags.push(val);
      renderComposeTagChips();
    }
    e.target.value = '';
  }
}

function renderComposeTagChips() {
  const el = document.getElementById('compose-tag-chips');
  el.innerHTML = state.composeTags.map((t, i) =>
    `<span class="chip">#${escHtml(t)}<span class="remove" onclick="removeComposeTag(${i})">×</span></span>`
  ).join('');
}

function removeComposeTag(i) {
  state.composeTags.splice(i, 1);
  renderComposeTagChips();
}

/* Stage images for upload after note creation */
function stagePendingImages(e) {
  const files = Array.from(e.target.files);
  state.pendingImages.push(...files);
  renderComposeImages();
  e.target.value = '';
}

function renderComposeImages() {
  const el = document.getElementById('compose-images');
  el.innerHTML = state.pendingImages.map((f, i) => {
    const url = URL.createObjectURL(f);
    return `<div class="img-preview-wrap">
      <img src="${url}"/>
      <button class="img-remove" onclick="removePendingImage(${i})">×</button>
    </div>`;
  }).join('');
}

function removePendingImage(i) {
  state.pendingImages.splice(i, 1);
  renderComposeImages();
}

async function submitNote() {
  const content = document.getElementById('compose-input').value.trim();
  if (!content) return;
  const pinned = document.getElementById('compose-pin').checked;
  try {
    const note = await api.post('/notes', { content, tags: state.composeTags, pinned });
    // upload staged images
    for (const file of state.pendingImages) {
      try { await api.uploadImage(note.id, file); } catch(_) {}
    }
    // fetch updated note (with images)
    const fresh = await api.get(`/notes/${note.id}`);
    state.notes.unshift(fresh);
    state.total++;
    // prepend card
    const grid = document.getElementById('notes-grid');
    const card = createNoteCard(fresh);
    grid.prepend(card);
    document.getElementById('empty-state').style.display = 'none';
    updateCount();
    // reset
    document.getElementById('compose-input').value = '';
    document.getElementById('compose-input').style.height = 'auto';
    document.getElementById('compose-pin').checked = false;
    state.composeTags = [];
    state.pendingImages = [];
    renderComposeTagChips();
    document.getElementById('compose-images').innerHTML = '';
    renderTags();
    toast('✅ 笔记已保存');
  } catch(e) {
    toast('发布失败: ' + e.message);
  }
}

/* ===== Delete / Pin ===== */
async function deleteNote(id) {
  if (!confirm('确认删除这条笔记？')) return;
  try {
    await api.del(`/notes/${id}`);
    state.notes = state.notes.filter(n => n.id !== id);
    state.total--;
    removeNoteCard(id);
    updateCount();
    if (state.notes.length === 0) document.getElementById('empty-state').style.display = 'block';
    renderTags();
    toast('🗑️ 已删除');
  } catch(e) {
    toast('删除失败: ' + e.message);
  }
}

async function togglePin(id, current) {
  const note = state.notes.find(n => n.id === id);
  if (!note) return;
  try {
    const updated = await api.put(`/notes/${id}`, {
      content: note.content,
      tags: note.tags,
      pinned: !current
    });
    Object.assign(note, updated);
    updateNoteCard(updated);
    toast(updated.pinned ? '📌 已置顶' : '取消置顶');
  } catch(e) {
    toast('操作失败');
  }
}

/* ===== Edit Modal ===== */
async function openEdit(id) {
  const note = await api.get(`/notes/${id}`);
  state.editId = id;
  state.editTags = [...(note.tags || [])];
  document.getElementById('edit-input').value = note.content;
  document.getElementById('edit-pin').checked = note.pinned;
  renderEditTagChips();
  renderEditImages(note.images || []);
  document.getElementById('modal-overlay').style.display = 'block';
  document.getElementById('edit-modal').style.display = 'flex';
  document.getElementById('edit-input').focus();
}

function closeModal() {
  document.getElementById('modal-overlay').style.display = 'none';
  document.getElementById('edit-modal').style.display = 'none';
  state.editId = null;
}

function editTagKeydown(e) {
  if (e.key === 'Enter' || e.key === ',') {
    e.preventDefault();
    const val = e.target.value.trim().replace(/^#/, '');
    if (val && !state.editTags.includes(val)) {
      state.editTags.push(val);
      renderEditTagChips();
    }
    e.target.value = '';
  }
}

function renderEditTagChips() {
  const el = document.getElementById('edit-tag-chips');
  el.innerHTML = state.editTags.map((t, i) =>
    `<span class="chip">#${escHtml(t)}<span class="remove" onclick="removeEditTag(${i})">×</span></span>`
  ).join('');
}

function removeEditTag(i) {
  state.editTags.splice(i, 1);
  renderEditTagChips();
}

function renderEditImages(images) {
  const el = document.getElementById('edit-images');
  el.innerHTML = images.map(img =>
    `<div class="img-preview-wrap">
      <img src="/uploads/${img}"/>
    </div>`
  ).join('');
}

async function uploadEditImages(e) {
  const id = state.editId;
  if (!id) return;
  const files = Array.from(e.target.files);
  for (const file of files) {
    try {
      await api.uploadImage(id, file);
    } catch(err) {
      toast('图片上传失败: ' + err.message);
    }
  }
  const fresh = await api.get(`/notes/${id}`);
  renderEditImages(fresh.images || []);
  const noteInState = state.notes.find(n => n.id === id);
  if (noteInState) Object.assign(noteInState, fresh);
  toast('图片已上传');
  e.target.value = '';
}

async function saveEdit() {
  const id = state.editId;
  if (!id) return;
  const content = document.getElementById('edit-input').value.trim();
  if (!content) { toast('内容不能为空'); return; }
  const pinned = document.getElementById('edit-pin').checked;
  try {
    const updated = await api.put(`/notes/${id}`, { content, tags: state.editTags, pinned });
    // merge images from fresh fetch
    const fresh = await api.get(`/notes/${id}`);
    const noteInState = state.notes.find(n => n.id === id);
    if (noteInState) Object.assign(noteInState, fresh);
    updateNoteCard(fresh);
    renderTags();
    closeModal();
    toast('✅ 已保存');
  } catch(e) {
    toast('保存失败: ' + e.message);
  }
}

/* ===== Search ===== */
let _searchTimer = null;
function debounceSearch() {
  clearTimeout(_searchTimer);
  _searchTimer = setTimeout(() => {
    state.query = document.getElementById('search-input').value.trim();
    state.tag = '';
    state.view = '';
    loadNotes(true);
  }, 350);
}

/* ===== Export ===== */
function exportMarkdown() {
  window.location.href = '/api/v1/export/markdown';
}

/* ===== Dark Mode ===== */
function toggleDark() {
  document.body.classList.toggle('dark');
  localStorage.setItem('noteos-dark', document.body.classList.contains('dark') ? '1' : '0');
}

/* ===== Lightbox ===== */
function openLightbox(img) {
  const lb = document.createElement('div');
  lb.id = 'lightbox';
  lb.onclick = () => lb.remove();
  const i = document.createElement('img');
  i.src = img.src;
  lb.appendChild(i);
  document.body.appendChild(lb);
}

/* ===== Toast ===== */
let _toastTimer = null;
function toast(msg) {
  let el = document.getElementById('toast');
  if (!el) {
    el = document.createElement('div');
    el.id = 'toast';
    document.body.appendChild(el);
  }
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => el.classList.remove('show'), 2500);
}

/* ===== Utils ===== */
function escHtml(s) {
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

/* ===== Init ===== */
if (localStorage.getItem('noteos-dark') === '1') document.body.classList.add('dark');
loadNotes(true);
