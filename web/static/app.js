/* ===== State ===== */
const state = {
  notes: [],
  total: 0,
  page: 1,
  limit: 20,
  query: '',
  tag: '',
  view: 'all',
  composeTags: [],
  pendingImages: [],  // legacy compose images
  pendingFiles: [],   // File[] staged in compose for new note
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
  },
  async uploadFile(noteId, file) {
    const fd = new FormData();
    fd.append('file', file);
    const r = await fetch(`/api/v1/notes/${noteId}/files`, { method:'POST', body: fd });
    if (!r.ok) throw new Error(await r.text());
    return r.json();
  },
  async deleteFile(noteId, filename) {
    const r = await fetch(`/api/v1/notes/${noteId}/files/${encodeURIComponent(filename)}`, { method:'DELETE' });
    if (!r.ok) throw new Error(await r.text());
  }
};

/* ===== Mobile Sidebar ===== */
function toggleMobileSidebar() {
  document.body.classList.toggle('sidebar-open');
}
function closeMobileSidebar() {
  document.body.classList.remove('sidebar-open');
}

/* ===== Mobile Search ===== */
function toggleMobileSearch() {
  const wrap = document.getElementById('search-wrap');
  const close = document.getElementById('search-close');
  const input = document.getElementById('search-input');
  wrap.style.display = 'flex';
  close.style.display = 'block';
  input.focus();
}
function closeMobileSearch() {
  const close = document.getElementById('search-close');
  const input = document.getElementById('search-input');
  close.style.display = 'none';
  input.value = '';
  state.query = '';
  loadNotes(true);
}

/* ===== FAB: scroll to compose + focus ===== */
function focusCompose() {
  const input = document.getElementById('compose-input');
  const main = document.getElementById('main');
  main.scrollTo({ top: 0, behavior: 'smooth' });
  setTimeout(() => input.focus(), 300);
}

/* ===== Notes Loading ===== */
async function loadNotes(reset = false) {
  if (reset) {
    state.page = 1;
    state.notes = [];
  }
  let path = `/notes?page=${state.page}&limit=${state.limit}`;
  if (state.query) path += `&q=${encodeURIComponent(state.query)}`;
  if (state.tag)   path += `&tag=${encodeURIComponent(state.tag)}`;

  try {
    const result = await api.get(path);
    let notes = result.notes;
    if (state.view === 'pinned') notes = notes.filter(n => n.pinned);
    state.notes = reset ? notes : [...state.notes, ...notes];
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
    const newNotes = reset ? state.notes : state.notes.slice((state.page - 1) * state.limit);
    newNotes.forEach(note => grid.appendChild(createNoteCard(note)));
  }
}

/* ===== File helpers ===== */
function mimeCategory(mime) {
  if (!mime) return 'other';
  if (mime.startsWith('image/')) return 'image';
  if (mime === 'application/pdf') return 'pdf';
  if (mime.startsWith('text/') || mime === 'application/json' || mime === 'application/xml') return 'text';
  if (mime.startsWith('video/')) return 'video';
  if (mime.startsWith('audio/')) return 'audio';
  return 'other';
}

function fileIcon(mime) {
  const cat = mimeCategory(mime);
  const icons = {
    pdf: `<svg viewBox="0 0 24 24"><path d="M20 2H8c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-8.5 7.5c0 .83-.67 1.5-1.5 1.5H9v2H7.5V7H10c.83 0 1.5.67 1.5 1.5v1zm5 2c0 .83-.67 1.5-1.5 1.5h-2.5V7H15c.83 0 1.5.67 1.5 1.5v3zm4-3H19v1h1.5V11H19v2h-1.5V7h3v1.5zM9 9.5h1v-1H9v1zM4 6H2v14c0 1.1.9 2 2 2h14v-2H4V6zm10 5.5h1v-3h-1v3z"/></svg>`,
    text: `<svg viewBox="0 0 24 24"><path d="M14 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z"/></svg>`,
    video: `<svg viewBox="0 0 24 24"><path d="M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z"/></svg>`,
    audio: `<svg viewBox="0 0 24 24"><path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/></svg>`,
    other: `<svg viewBox="0 0 24 24"><path d="M14 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6zm4 18H6V4h7v5h5v11z"/></svg>`,
  };
  return icons[cat] || icons.other;
}

function formatSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / 1024 / 1024).toFixed(1) + ' MB';
}

/* Render the files section of a note card (read-only view) */
function renderNoteFiles(files) {
  if (!files || files.length === 0) return '';
  const images = files.filter(f => mimeCategory(f.mime) === 'image');
  const others = files.filter(f => mimeCategory(f.mime) !== 'image');

  let html = '';

  // Inline image grid
  if (images.length) {
    html += `<div class="note-images">${images.map(f =>
      `<img src="/uploads/${f.filename}" title="${escHtml(f.orig_name)}" onclick="openLightbox(this)" loading="lazy"/>`
    ).join('')}</div>`;
  }

  // Attachment list for non-images
  if (others.length) {
    html += `<div class="note-attachments">${others.map(f => {
      const cat = mimeCategory(f.mime);
      const url = `/uploads/${f.filename}`;
      if (cat === 'pdf') {
        return `<div class="attachment-item attachment-pdf">
          <div class="att-icon att-pdf">${fileIcon('application/pdf')}</div>
          <div class="att-meta">
            <span class="att-name">${escHtml(f.orig_name)}</span>
            <span class="att-size">${formatSize(f.size)}</span>
          </div>
          <a class="att-action" href="${url}" target="_blank" rel="noopener" title="在新标签页预览">
            <svg viewBox="0 0 24 24"><path d="M19 19H5V5h7V3H5c-1.11 0-2 .9-2 2v14c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2v-7h-2v7zM14 3v2h3.59l-9.83 9.83 1.41 1.41L19 6.41V10h2V3h-7z"/></svg>
          </a>
        </div>`;
      }
      if (cat === 'text') {
        return `<div class="attachment-item attachment-text">
          <div class="att-icon att-text">${fileIcon(f.mime)}</div>
          <div class="att-meta">
            <span class="att-name">${escHtml(f.orig_name)}</span>
            <span class="att-size">${formatSize(f.size)}</span>
          </div>
          <a class="att-action" href="${url}" target="_blank" rel="noopener" title="查看">
            <svg viewBox="0 0 24 24"><path d="M19 19H5V5h7V3H5c-1.11 0-2 .9-2 2v14c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2v-7h-2v7zM14 3v2h3.59l-9.83 9.83 1.41 1.41L19 6.41V10h2V3h-7z"/></svg>
          </a>
        </div>`;
      }
      // audio / video / other
      const isMedium = cat === 'video' || cat === 'audio';
      return `<div class="attachment-item">
        <div class="att-icon">${fileIcon(f.mime)}</div>
        <div class="att-meta">
          <span class="att-name">${escHtml(f.orig_name)}</span>
          <span class="att-size">${formatSize(f.size)}</span>
        </div>
        <a class="att-action" href="${url}" download="${escHtml(f.orig_name)}" title="下载">
          <svg viewBox="0 0 24 24"><path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/></svg>
        </a>
      </div>`;
    }).join('')}</div>`;
  }

  return html;
}

function createNoteCard(note) {
  const div = document.createElement('div');
  div.className = 'note-card' + (note.pinned ? ' pinned' : '');
  div.dataset.id = note.id;

  const date = new Date(note.created_at).toLocaleString('zh-CN', {
    month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit'
  });

  const tagsHtml = (note.tags || []).map(t =>
    `<span class="tag-badge" onclick="filterByTag('${escHtml(t)}')">#${escHtml(t)}</span>`
  ).join('');

  // Legacy images field (old notes) + new files field
  const legacyImgHtml = (note.images || []).length > 0
    ? `<div class="note-images">${note.images.map(img =>
        `<img src="/uploads/${img}" onclick="openLightbox(this)" loading="lazy"/>`
      ).join('')}</div>` : '';

  const filesHtml = renderNoteFiles(note.files || []);
  const renderedMd = marked.parse(note.content || '', { breaks: true, gfm: true });

  div.innerHTML = `
    <div class="note-meta">
      ${note.pinned ? '<span class="pin-badge">📌</span>' : ''}
      <span>${date}</span>
    </div>
    <div class="note-content">${renderedMd}</div>
    ${legacyImgHtml}
    ${filesHtml}
    ${tagsHtml ? `<div class="note-tags">${tagsHtml}</div>` : ''}
    <div class="note-actions">
      <button class="btn-icon" title="编辑" onclick="openEdit(${note.id})">
        <svg viewBox="0 0 24 24"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a1 1 0 0 0 0-1.41l-2.34-2.34a1 1 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg>
      </button>
      <button class="btn-icon" title="${note.pinned ? '取消置顶' : '置顶'}" onclick="togglePin(${note.id}, ${note.pinned})">
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
  if (existing) existing.replaceWith(createNoteCard(note));
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
    list.innerHTML = tags.map(t =>
      `<div class="tag-nav-item${state.tag === t ? ' active' : ''}" onclick="filterByTag('${escHtml(t)}')">${escHtml(t)}</div>`
    ).join('');
  } catch(_) {}
}

function filterByTag(tag) {
  state.tag = state.tag === tag ? '' : tag;
  if (state.tag) state.view = '';
  closeMobileSidebar();
  loadNotes(true);
}

function setView(view, el) {
  state.view = view;
  state.tag = '';
  state.query = '';
  document.getElementById('search-input').value = '';
  document.querySelectorAll('.nav-item').forEach(e => e.classList.remove('active'));
  el.classList.add('active');
  closeMobileSidebar();
  loadNotes(true);
}

function updateCount() {
  document.getElementById('note-count').textContent = `共 ${state.total} 条`;
}

/* ===== Compose ===== */
function autoResize(el) {
  el.style.height = 'auto';
  el.style.height = el.scrollHeight + 'px';
}
function composeKeydown(e) {
  if (e.ctrlKey && e.key === 'Enter') { e.preventDefault(); submitNote(); }
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
  document.getElementById('compose-tag-chips').innerHTML = state.composeTags.map((t, i) =>
    `<span class="chip">#${escHtml(t)}<span class="remove" onclick="removeComposeTag(${i})">×</span></span>`
  ).join('');
}
function removeComposeTag(i) {
  state.composeTags.splice(i, 1);
  renderComposeTagChips();
}

function stagePendingImages(e) {
  stagePendingFiles(e); // route to unified handler
}
function stagePendingFiles(e) {
  state.pendingFiles.push(...Array.from(e.target.files));
  renderComposePendingFiles();
  e.target.value = '';
}
function renderComposePendingFiles() {
  document.getElementById('compose-images').innerHTML = state.pendingFiles.map((f, i) => {
    if (f.type.startsWith('image/')) {
      const url = URL.createObjectURL(f);
      return `<div class="img-preview-wrap">
        <img src="${url}"/>
        <button class="img-remove" onclick="removePendingFile(${i})">×</button>
      </div>`;
    }
    return `<div class="pending-file-chip">
      <span class="pf-name">${escHtml(f.name)}</span>
      <span class="pf-size">${formatSize(f.size)}</span>
      <button class="pf-remove" onclick="removePendingFile(${i})">×</button>
    </div>`;
  }).join('');
}
function removePendingFile(i) {
  state.pendingFiles.splice(i, 1);
  renderComposePendingFiles();
}

async function submitNote() {
  const content = document.getElementById('compose-input').value.trim();
  if (!content) return;
  const pinned = document.getElementById('compose-pin').checked;
  try {
    const note = await api.post('/notes', { content, tags: state.composeTags, pinned });
    for (const file of state.pendingFiles) {
      try { await api.uploadFile(note.id, file); } catch(err) { toast('文件上传失败: ' + err.message); }
    }
    const fresh = await api.get(`/notes/${note.id}`);
    state.notes.unshift(fresh);
    state.total++;
    document.getElementById('notes-grid').prepend(createNoteCard(fresh));
    document.getElementById('empty-state').style.display = 'none';
    updateCount();
    const inp = document.getElementById('compose-input');
    inp.value = '';
    inp.style.height = 'auto';
    document.getElementById('compose-pin').checked = false;
    state.composeTags = [];
    state.pendingFiles = [];
    renderComposeTagChips();
    document.getElementById('compose-images').innerHTML = '';
    renderTags();
    toast('✅ 笔记已保存');
    inp.blur();
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
    const updated = await api.put(`/notes/${id}`, { content: note.content, tags: note.tags, pinned: !current });
    Object.assign(note, updated);
    updateNoteCard(updated);
    toast(updated.pinned ? '📌 已置顶' : '取消置顶');
  } catch(e) { toast('操作失败'); }
}

/* ===== Edit Modal ===== */
async function openEdit(id) {
  const note = await api.get(`/notes/${id}`);
  state.editId = id;
  state.editTags = [...(note.tags || [])];
  document.getElementById('edit-input').value = note.content;
  document.getElementById('edit-pin').checked = note.pinned;
  renderEditTagChips();
  renderEditFiles(note.files || [], note.images || []);
  document.getElementById('modal-overlay').style.display = 'block';
  document.getElementById('edit-modal').style.display = 'flex';
  setTimeout(() => document.getElementById('edit-input').focus(), 50);
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
  document.getElementById('edit-tag-chips').innerHTML = state.editTags.map((t, i) =>
    `<span class="chip">#${escHtml(t)}<span class="remove" onclick="removeEditTag(${i})">×</span></span>`
  ).join('');
}
function removeEditTag(i) {
  state.editTags.splice(i, 1);
  renderEditTagChips();
}

/* Render all attachments inside the edit modal with delete buttons */
function renderEditFiles(files, legacyImages) {
  const container = document.getElementById('edit-files');
  if (!container) return;

  const allImages = [
    ...(legacyImages || []).map(img => ({ filename: img, orig_name: img, size: 0, mime: 'image/jpeg', _legacy: true })),
    ...(files || []).filter(f => f.mime && f.mime.startsWith('image/')),
  ];
  const others = (files || []).filter(f => f.mime && !f.mime.startsWith('image/'));

  let html = '';

  // Image grid
  if (allImages.length) {
    html += `<div class="edit-images-grid">${allImages.map(f => `
      <div class="edit-img-wrap">
        <img src="/uploads/${f.filename}" onclick="openLightbox(this)" loading="lazy"/>
        <button class="img-remove" onclick="confirmDeleteFile('${escHtml(f.filename)}')" title="删除">×</button>
      </div>`).join('')}</div>`;
  }

  // Non-image attachment list
  if (others.length) {
    html += `<div class="edit-att-list">${others.map(f => `
      <div class="edit-att-row">
        <div class="att-icon-sm">${fileIcon(f.mime)}</div>
        <div class="att-meta">
          <span class="att-name">${escHtml(f.orig_name)}</span>
          <span class="att-size">${formatSize(f.size)}</span>
        </div>
        <a class="att-action" href="/uploads/${f.filename}" target="_blank" rel="noopener" title="预览/下载">
          <svg viewBox="0 0 24 24"><path d="M19 19H5V5h7V3H5c-1.11 0-2 .9-2 2v14c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2v-7h-2v7zM14 3v2h3.59l-9.83 9.83 1.41 1.41L19 6.41V10h2V3h-7z"/></svg>
        </a>
        <button class="att-del" onclick="confirmDeleteFile('${escHtml(f.filename)}')" title="删除">
          <svg viewBox="0 0 24 24"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>
        </button>
      </div>`).join('')}</div>`;
  }

  if (!html) html = `<div class="edit-no-files">暂无附件</div>`;
  container.innerHTML = html;
}

async function confirmDeleteFile(filename) {
  const id = state.editId;
  if (!id) return;
  if (!confirm('确认删除该附件？此操作不可撤销。')) return;
  try {
    await api.deleteFile(id, filename);
    const fresh = await api.get(`/notes/${id}`);
    renderEditFiles(fresh.files || [], fresh.images || []);
    // sync card
    const n = state.notes.find(n => n.id === id);
    if (n) Object.assign(n, fresh);
    updateNoteCard(fresh);
    toast('附件已删除');
  } catch(e) {
    toast('删除失败: ' + e.message);
  }
}

/* Upload handler for the edit modal file input */
async function uploadEditFiles(e) {
  const id = state.editId;
  if (!id) return;
  const files = Array.from(e.target.files);
  if (!files.length) return;

  // Show progress indicator
  const btn = document.getElementById('edit-upload-btn');
  if (btn) { btn.disabled = true; btn.textContent = '上传中…'; }

  let ok = 0, fail = 0;
  for (const file of files) {
    try {
      await api.uploadFile(id, file);
      ok++;
    } catch(err) {
      fail++;
      toast(`${file.name} 上传失败: ${err.message}`);
    }
  }

  if (btn) { btn.disabled = false; btn.innerHTML = uploadBtnSVG; }

  const fresh = await api.get(`/notes/${id}`);
  renderEditFiles(fresh.files || [], fresh.images || []);
  const n = state.notes.find(n => n.id === id);
  if (n) Object.assign(n, fresh);
  updateNoteCard(fresh);

  if (ok > 0) toast(`✅ ${ok} 个文件已上传${fail ? `，${fail} 个失败` : ''}`);
  e.target.value = '';
}

const uploadBtnSVG = `<svg viewBox="0 0 24 24"><path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z"/></svg>`;

async function saveEdit() {
  const id = state.editId;
  if (!id) return;
  const content = document.getElementById('edit-input').value.trim();
  if (!content) { toast('内容不能为空'); return; }
  const pinned = document.getElementById('edit-pin').checked;
  try {
    await api.put(`/notes/${id}`, { content, tags: state.editTags, pinned });
    const fresh = await api.get(`/notes/${id}`);
    const n = state.notes.find(n => n.id === id);
    if (n) Object.assign(n, fresh);
    updateNoteCard(fresh);
    renderTags();
    closeModal();
    toast('✅ 已保存');
  } catch(e) { toast('保存失败: ' + e.message); }
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
function exportMarkdown() { window.location.href = '/api/v1/export/markdown'; }

/* ===== Dark Mode ===== */
function toggleDark() {
  document.body.classList.toggle('dark');
  localStorage.setItem('noteos-dark', document.body.classList.contains('dark') ? '1' : '0');
  document.querySelector('meta[name="theme-color"][media*="light"]')?.setAttribute('content',
    document.body.classList.contains('dark') ? '#3a3f8a' : '#5B63D3');
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
  if (!el) { el = document.createElement('div'); el.id = 'toast'; document.body.appendChild(el); }
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => el.classList.remove('show'), 2600);
}

/* ===== Utils ===== */
function escHtml(s) {
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

/* ===== Keyboard shortcuts ===== */
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    if (state.editId) { closeModal(); return; }
    document.getElementById('lightbox')?.remove();
    closeMobileSidebar();
  }
});

/* ===== Drag & drop onto edit modal drop zone ===== */
document.addEventListener('DOMContentLoaded', () => {
  const zone = document.getElementById('edit-drop-zone');
  if (!zone) return;

  ['dragenter','dragover'].forEach(evt => {
    zone.addEventListener(evt, e => {
      e.preventDefault();
      zone.classList.add('drag-over');
    });
  });
  ['dragleave','drop'].forEach(evt => {
    zone.addEventListener(evt, e => {
      e.preventDefault();
      zone.classList.remove('drag-over');
    });
  });
  zone.addEventListener('drop', async e => {
    const files = Array.from(e.dataTransfer.files);
    if (!files.length || !state.editId) return;
    // Simulate file input change
    const fakeEvt = { target: { files, value: '' } };
    await uploadEditFiles(fakeEvt);
  });
});
-e 
/* ===== Auth ===== */
async function checkAuth() {
  try {
    const res = await fetch('/api/auth/status');
    const data = await res.json();
    if (data.protected) {
      document.getElementById('logout-btn').style.display = 'flex';
      if (!data.loggedIn) {
        window.location.href = '/login';
      }
    }
  } catch(_) {}
}

async function logout() {
  await fetch('/api/auth/logout', { method: 'POST' });
  window.location.href = '/login';
}

/* ===== Init ===== */
if (localStorage.getItem('noteos-dark') === '1') document.body.classList.add('dark');
checkAuth();
loadNotes(true);
