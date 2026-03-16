/* ===== State ===== */
const state = {
  notes: [], total: 0, page: 1, limit: 20,
  query: '', tag: '', view: 'all',
  // Modal state: 'new' | 'edit' | 'view'
  modal: { mode: null, noteId: null, tags: [], pendingFiles: [] },
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
  async uploadFile(noteId, file) {
    const fd = new FormData(); fd.append('file', file);
    const r = await fetch(`/api/v1/notes/${noteId}/files`, { method:'POST', body: fd });
    if (!r.ok) throw new Error(await r.text());
    return r.json();
  },
  async deleteFile(noteId, filename) {
    const r = await fetch(`/api/v1/notes/${noteId}/files/${encodeURIComponent(filename)}`, { method:'DELETE' });
    if (!r.ok) throw new Error(await r.text());
  }
};

/* ===== Mobile ===== */
function toggleMobileSidebar() { document.body.classList.toggle('sidebar-open'); }
function closeMobileSidebar()  { document.body.classList.remove('sidebar-open'); }
function toggleMobileSearch() {
  const w = document.getElementById('search-wrap');
  const c = document.getElementById('search-close');
  w.style.display = 'flex'; c.style.display = 'block';
  document.getElementById('search-input').focus();
}
function closeMobileSearch() {
  document.getElementById('search-close').style.display = 'none';
  document.getElementById('search-input').value = '';
  state.query = ''; loadNotes(true);
}

/* ===== Notes Loading ===== */
async function loadNotes(reset=false) {
  if (reset) { state.page = 1; state.notes = []; }
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
    document.getElementById('note-count').textContent = `共 ${state.total} 条`;
    document.getElementById('load-more-btn').style.display =
      state.notes.length < state.total ? 'inline-block' : 'none';
  } catch(e) { toast('加载失败: ' + e.message); }
}
async function loadMore() { state.page++; await loadNotes(false); }

/* ===== Render ===== */
function renderNotes(reset) {
  const grid = document.getElementById('notes-grid');
  const empty = document.getElementById('empty-state');
  if (reset) grid.innerHTML = '';
  if (state.notes.length === 0) { empty.style.display = 'block'; return; }
  empty.style.display = 'none';
  const list = reset ? state.notes : state.notes.slice((state.page-1)*state.limit);
  list.forEach(note => grid.appendChild(createNoteCard(note)));
}

function createNoteCard(note) {
  const div = document.createElement('div');
  div.className = 'note-card' + (note.pinned ? ' pinned' : '');
  div.dataset.id = note.id;

  const date = new Date(note.created_at).toLocaleString('zh-CN', {
    year:'numeric', month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit'
  });
  const tagsHtml = (note.tags||[]).map(t =>
    `<span class="tag-badge" onclick="event.stopPropagation();filterByTag('${escHtml(t)}')">#${escHtml(t)}</span>`
  ).join('');
  const renderedMd = marked.parse(note.content||'', {breaks:true,gfm:true});
  const titleHtml = note.title
    ? `<div class="note-card-title">${escHtml(note.title)}</div>` : '';

  // Image thumbnails from files
  const imgFiles = (note.files||[]).filter(f=>f.mime&&f.mime.startsWith('image/'));
  const legacyImgs = (note.images||[]);
  const hasAttach = (note.files||[]).filter(f=>f.mime&&!f.mime.startsWith('image/')).length > 0;

  let imgsHtml = '';
  if (legacyImgs.length) {
    imgsHtml += legacyImgs.slice(0,4).map(img=>`<img src="/uploads/${img}" onclick="event.stopPropagation();openLightbox(this)" loading="lazy"/>`).join('');
  }
  if (imgFiles.length) {
    imgsHtml += imgFiles.slice(0,4).map(f=>`<img src="/uploads/${f.filename}" onclick="event.stopPropagation();openLightbox(this)" loading="lazy"/>`).join('');
  }

  div.innerHTML = `
    <div class="note-meta">
      ${note.pinned ? '<span class="pin-badge">📌</span>' : ''}
      <span>${date}</span>
      ${hasAttach ? '<span class="att-badge" title="有附件"><svg viewBox="0 0 24 24" width="12" height="12"><path d="M16.5 6v11.5c0 2.21-1.79 4-4 4s-4-1.79-4-4V5c0-1.38 1.12-2.5 2.5-2.5s2.5 1.12 2.5 2.5v10.5c0 .55-.45 1-1 1s-1-.45-1-1V6H10v9.5c0 1.38 1.12 2.5 2.5 2.5s2.5-1.12 2.5-2.5V5c0-2.21-1.79-4-4-4S7 2.79 7 5v12.5c0 3.04 2.46 5.5 5.5 5.5s5.5-2.46 5.5-5.5V6h-1.5z" fill="currentColor"/></svg></span>' : ''}
    </div>
    ${titleHtml}
    <div class="note-content">${renderedMd}</div>
    ${imgsHtml ? `<div class="note-images">${imgsHtml}</div>` : ''}
    ${tagsHtml ? `<div class="note-tags">${tagsHtml}</div>` : ''}
    <div class="note-card-hover-hint">点击查看</div>
  `;
  // Click card → open view modal
  div.addEventListener('click', () => openViewModal(note.id));
  return div;
}

function updateNoteCard(note) {
  const el = document.querySelector(`.note-card[data-id="${note.id}"]`);
  if (el) el.replaceWith(createNoteCard(note));
}
function removeNoteCard(id) {
  const el = document.querySelector(`.note-card[data-id="${id}"]`);
  if (el) el.remove();
}

/* ===== Tags ===== */
async function renderTags() {
  try {
    const tags = await api.get('/tags');
    document.getElementById('tag-list').innerHTML = tags.map(t =>
      `<div class="tag-nav-item${state.tag===t?' active':''}" onclick="filterByTag('${escHtml(t)}')">${escHtml(t)}</div>`
    ).join('');
  } catch(_) {}
}
function filterByTag(tag) {
  state.tag = state.tag === tag ? '' : tag;
  if (state.tag) state.view = '';
  closeMobileSidebar(); loadNotes(true);
}
function setView(view, el) {
  state.view = view; state.tag = ''; state.query = '';
  document.getElementById('search-input').value = '';
  document.querySelectorAll('.nav-item').forEach(e => e.classList.remove('active'));
  el.classList.add('active');
  closeMobileSidebar(); loadNotes(true);
}

/* ===== Search ===== */
let _st = null;
function debounceSearch() {
  clearTimeout(_st);
  _st = setTimeout(() => {
    state.query = document.getElementById('search-input').value.trim();
    state.tag = ''; state.view = ''; loadNotes(true);
  }, 350);
}

/* ===================================================
   NOTE MODAL  —  3 modes: new / edit / view
   =================================================== */

function $nm(id) { return document.getElementById(id); }

function _showEl(...ids) { ids.forEach(id => { const el=$nm(id); if(el) el.style.display=''; }); }
function _hideEl(...ids) { ids.forEach(id => { const el=$nm(id); if(el) el.style.display='none'; }); }

/* Open modal in NEW mode */
function openNoteModal() {
  state.modal = { mode:'new', noteId:null, tags:[], pendingFiles:[] };
  _applyModalMode('new', null);
  _showModal();
  setTimeout(()=>$nm('nm-textarea').focus(), 80);
}

/* Open modal in VIEW mode (click card) */
async function openViewModal(id) {
  const note = await api.get(`/notes/${id}`);
  state.modal = { mode:'view', noteId:id, tags:[...(note.tags||[])], pendingFiles:[] };
  _applyModalMode('view', note);
  _showModal();
}

/* Switch from view → edit */
function switchToEdit() {
  const id = state.modal.noteId;
  if (!id) return;
  state.modal.mode = 'edit';
  // Keep current textarea value (already loaded), just flip UI
  const content = $nm('nm-preview').dataset.rawContent || '';
  _applyModalMode('edit', { id, content,
    tags: state.modal.tags,
    pinned: $nm('nm-pin').checked,
    files: state.modal._note?.files||[],
    images: state.modal._note?.images||[],
  });
}

function _applyModalMode(mode, note) {
  const isNew  = mode === 'new';
  const isEdit = mode === 'edit';
  const isView = mode === 'view';
  const isWriting = isNew || isEdit;

  // Header label
  $nm('nm-mode-label').textContent = isNew ? '新建笔记' : isView ? '笔记详情' : '编辑笔记';

  // Header buttons
  _hideEl('nm-edit-btn','nm-attach-btn','nm-pin-wrap','nm-delete-btn');
  if (isView)    { _showEl('nm-edit-btn'); if(note?.id) _showEl('nm-delete-btn'); }
  if (isWriting) { _showEl('nm-attach-btn','nm-pin-wrap'); if(isEdit) _showEl('nm-delete-btn'); }

  // Tags
  if (isWriting) {
    _showEl('nm-tags-row'); _hideEl('nm-tags-view');
    state.modal.tags = note ? [...(note.tags||[])] : [];
    _renderNmTagChips();
  } else {
    _hideEl('nm-tags-row');
    const tags = note?.tags||[];
    if (tags.length) {
      $nm('nm-tags-view').innerHTML = tags.map(t =>
        `<span class="tag-badge" onclick="filterByTag('${escHtml(t)}')">#${escHtml(t)}</span>`
      ).join('');
      _showEl('nm-tags-view');
    } else { _hideEl('nm-tags-view'); }
  }

  // Pin
  $nm('nm-pin').checked = note?.pinned || false;

  // Title
  if (isWriting) {
    $nm('nm-title').value = note?.title || '';
    _showEl('nm-title');
  } else {
    _hideEl('nm-title');
  }

  // Body
  if (isWriting) {
    _showEl('nm-textarea'); _hideEl('nm-preview');
    $nm('nm-textarea').value = note?.content || '';
    _showEl('nm-drop-zone'); _hideEl('nm-attach-btn'); _showEl('nm-attach-btn');
  } else {
    _hideEl('nm-textarea','nm-drop-zone');
    _showEl('nm-preview');
    const titleHtml = note?.title ? `<div class="nm-preview-title">${escHtml(note.title)}</div>` : '';
    $nm('nm-preview').innerHTML = titleHtml + marked.parse(note?.content||'');
    $nm('nm-preview').dataset.rawContent = note?.content||'';
  }

  // Files
  if (note) {
    state.modal._note = note;
    _renderNmFiles(note.files||[], note.images||[], isWriting);
  } else {
    $nm('nm-files').innerHTML = '';
  }

  // Footer
  if (isWriting) {
    _showEl('nm-footer');
    const d = note?.created_at ? new Date(note.created_at).toLocaleString('zh-CN',{year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'}) : '';
    $nm('nm-meta').textContent = d;
  } else {
    _hideEl('nm-footer');
  }

  // Drop zone visibility
  if (isWriting) { _showEl('nm-drop-zone'); } else { _hideEl('nm-drop-zone'); }
}

function _showModal() {
  $nm('modal-overlay').style.display = 'block';
  $nm('note-modal').style.display = 'flex';
  $nm('note-modal').classList.add('nm-enter');
  requestAnimationFrame(()=>$nm('note-modal').classList.add('nm-visible'));
}

function closeModal() {
  const modal = $nm('note-modal');
  modal.classList.remove('nm-visible');
  setTimeout(()=>{
    $nm('modal-overlay').style.display = 'none';
    modal.style.display = 'none';
    modal.classList.remove('nm-enter');
    state.modal = { mode:null, noteId:null, tags:[], pendingFiles:[] };
  }, 200);
}

/* Save (new or edit) */
async function saveModal() {
  const content = $nm('nm-textarea').value.trim();
  if (!content) { toast('内容不能为空'); return; }
  const title  = $nm('nm-title').value.trim();
  const pinned = $nm('nm-pin').checked;
  const tags   = state.modal.tags;
  const btn    = $nm('nm-save-btn');
  btn.disabled = true; btn.textContent = '保存中…';

  try {
    if (state.modal.mode === 'new') {
      const note = await api.post('/notes', { title, content, tags, pinned });
      for (const f of state.modal.pendingFiles) {
        try { await api.uploadFile(note.id, f); } catch(e) { toast('文件上传失败: '+e.message); }
      }
      const fresh = await api.get(`/notes/${note.id}`);
      state.notes.unshift(fresh); state.total++;
      document.getElementById('notes-grid').prepend(createNoteCard(fresh));
      document.getElementById('empty-state').style.display = 'none';
      document.getElementById('note-count').textContent = `共 ${state.total} 条`;
      renderTags();
      closeModal();
      toast('✅ 笔记已保存');
    } else {
      const id = state.modal.noteId;
      await api.put(`/notes/${id}`, { title, content, tags, pinned });
      const fresh = await api.get(`/notes/${id}`);
      const idx = state.notes.findIndex(n=>n.id===id);
      if (idx>=0) state.notes[idx] = fresh;
      updateNoteCard(fresh);
      renderTags();
      closeModal();
      toast('✅ 已保存');
    }
  } catch(e) {
    toast('保存失败: ' + e.message);
  } finally {
    btn.disabled = false; btn.textContent = '保存';
  }
}

/* Delete from modal */
async function deleteCurrentNote() {
  const id = state.modal.noteId;
  if (!id) return;
  if (!confirm('确认删除这条笔记？')) return;
  try {
    await api.del(`/notes/${id}`);
    state.notes = state.notes.filter(n=>n.id!==id); state.total--;
    removeNoteCard(id);
    if (state.notes.length===0) document.getElementById('empty-state').style.display='block';
    document.getElementById('note-count').textContent = `共 ${state.total} 条`;
    renderTags(); closeModal(); toast('🗑️ 已删除');
  } catch(e) { toast('删除失败: '+e.message); }
}

/* ===== Modal Tags ===== */
function nmTagKeydown(e) {
  if (e.key==='Enter'||e.key===',') {
    e.preventDefault();
    const val = e.target.value.trim().replace(/^#/,'');
    if (val && !state.modal.tags.includes(val)) { state.modal.tags.push(val); _renderNmTagChips(); }
    e.target.value = '';
  }
}
function _renderNmTagChips() {
  $nm('nm-tag-chips').innerHTML = state.modal.tags.map((t,i)=>
    `<span class="chip">#${escHtml(t)}<span class="remove" onclick="removeNmTag(${i})">×</span></span>`
  ).join('');
}
function removeNmTag(i) { state.modal.tags.splice(i,1); _renderNmTagChips(); }

/* ===== Modal Files ===== */
function _renderNmFiles(files, legacyImages, editable) {
  const el = $nm('nm-files');
  const images = [
    ...(legacyImages||[]).map(img=>({filename:img,orig_name:img,size:0,mime:'image/jpeg',_legacy:true})),
    ...(files||[]).filter(f=>f.mime&&f.mime.startsWith('image/')),
  ];
  const others = (files||[]).filter(f=>f.mime&&!f.mime.startsWith('image/'));

  let html = '';
  if (images.length) {
    html += `<div class="edit-images-grid">${images.map(f=>`
      <div class="edit-img-wrap">
        <img src="/uploads/${f.filename}" onclick="openLightbox(this)" loading="lazy"/>
        ${editable ? `<button class="img-remove" onclick="nmDeleteFile('${escHtml(f.filename)}')">×</button>` : ''}
      </div>`).join('')}</div>`;
  }
  if (others.length) {
    html += `<div class="edit-att-list">${others.map(f=>`
      <div class="edit-att-row">
        <div class="att-icon-sm">${fileIcon(f.mime)}</div>
        <div class="att-meta"><span class="att-name">${escHtml(f.orig_name)}</span><span class="att-size">${formatSize(f.size)}</span></div>
        <a class="att-action" href="/uploads/${f.filename}" target="_blank" rel="noopener" title="预览">
          <svg viewBox="0 0 24 24"><path d="M19 19H5V5h7V3H5c-1.11 0-2 .9-2 2v14c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2v-7h-2v7zM14 3v2h3.59l-9.83 9.83 1.41 1.41L19 6.41V10h2V3h-7z"/></svg>
        </a>
        ${editable ? `<button class="att-del" onclick="nmDeleteFile('${escHtml(f.filename)}')" title="删除"><svg viewBox="0 0 24 24"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg></button>` : ''}
      </div>`).join('')}</div>`;
  }

  // Pending files (new mode)
  if (state.modal.pendingFiles.length) {
    html += `<div class="edit-att-list">${state.modal.pendingFiles.map((f,i)=>
      f.type.startsWith('image/')
        ? `<div class="edit-img-wrap"><img src="${URL.createObjectURL(f)}"/><button class="img-remove" onclick="nmRemovePending(${i})">×</button></div>`
        : `<div class="edit-att-row"><div class="att-icon-sm">${fileIcon(f.type)}</div><div class="att-meta"><span class="att-name">${escHtml(f.name)}</span><span class="att-size">${formatSize(f.size)}</span></div><button class="att-del" onclick="nmRemovePending(${i})"><svg viewBox="0 0 24 24"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg></button></div>`
    ).join('')}</div>`;
  }

  el.innerHTML = html || '';
}

async function handleModalFileUpload(e) {
  const files = Array.from(e.target.files);
  if (!files.length) return;
  if (state.modal.mode === 'new') {
    state.modal.pendingFiles.push(...files);
    _renderNmFiles([], [], true);
  } else {
    const id = state.modal.noteId;
    for (const f of files) {
      try { await api.uploadFile(id, f); } catch(err) { toast('上传失败: '+err.message); }
    }
    const fresh = await api.get(`/notes/${id}`);
    state.modal._note = fresh;
    state.modal.tags = [...(fresh.tags||[])];
    _renderNmFiles(fresh.files||[], fresh.images||[], true);
    const idx = state.notes.findIndex(n=>n.id===id);
    if (idx>=0) state.notes[idx]=fresh; updateNoteCard(fresh);
    toast('✅ 文件已上传');
  }
  e.target.value = '';
}

function nmRemovePending(i) {
  state.modal.pendingFiles.splice(i,1);
  _renderNmFiles([], [], true);
}

async function nmDeleteFile(filename) {
  const id = state.modal.noteId;
  if (!id) return;
  if (!confirm('确认删除该附件？')) return;
  try {
    await api.deleteFile(id, filename);
    const fresh = await api.get(`/notes/${id}`);
    state.modal._note = fresh;
    _renderNmFiles(fresh.files||[], fresh.images||[], true);
    const idx = state.notes.findIndex(n=>n.id===id);
    if (idx>=0) state.notes[idx]=fresh; updateNoteCard(fresh);
    toast('附件已删除');
  } catch(e) { toast('删除失败: '+e.message); }
}

/* ===== File helpers ===== */
function mimeCategory(mime) {
  if (!mime) return 'other';
  if (mime.startsWith('image/')) return 'image';
  if (mime==='application/pdf') return 'pdf';
  if (mime.startsWith('text/')) return 'text';
  return 'other';
}
function fileIcon(mime) {
  const cat = mimeCategory(mime);
  const icons = {
    pdf:`<svg viewBox="0 0 24 24"><path d="M20 2H8c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-8.5 7.5c0 .83-.67 1.5-1.5 1.5H9v2H7.5V7H10c.83 0 1.5.67 1.5 1.5v1zm5 2c0 .83-.67 1.5-1.5 1.5h-2.5V7H15c.83 0 1.5.67 1.5 1.5v3zm4-3H19v1h1.5V11H19v2h-1.5V7h3v1.5z" fill="currentColor"/></svg>`,
    text:`<svg viewBox="0 0 24 24"><path d="M14 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z" fill="currentColor"/></svg>`,
    other:`<svg viewBox="0 0 24 24"><path d="M14 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6zm4 18H6V4h7v5h5v11z" fill="currentColor"/></svg>`,
  };
  return icons[cat] || icons.other;
}
function formatSize(bytes) {
  if (bytes<1024) return bytes+' B';
  if (bytes<1048576) return (bytes/1024).toFixed(1)+' KB';
  return (bytes/1048576).toFixed(1)+' MB';
}

/* ===== Export / Dark / Auth ===== */
function exportMarkdown() { window.location.href = '/api/v1/export/markdown'; }
function toggleDark() {
  document.body.classList.toggle('dark');
  localStorage.setItem('noteos-dark', document.body.classList.contains('dark') ? '1' : '0');
}
async function checkAuth() {
  try {
    const res = await fetch('/api/auth/status');
    const data = await res.json();
    if (data.protected) {
      document.getElementById('logout-btn').style.display = 'flex';
      if (!data.loggedIn) window.location.href = '/login';
    }
  } catch(_) {}
}
async function logout() {
  await fetch('/api/auth/logout', { method:'POST' });
  window.location.href = '/login';
}

/* ===== Lightbox ===== */
function openLightbox(img) {
  const lb = document.createElement('div');
  lb.id = 'lightbox';
  lb.onclick = () => lb.remove();
  const i = document.createElement('img');
  i.src = img.src; lb.appendChild(i);
  document.body.appendChild(lb);
}

/* ===== Toast ===== */
let _tt = null;
function toast(msg) {
  let el = document.getElementById('toast');
  if (!el) { el = document.createElement('div'); el.id='toast'; document.body.appendChild(el); }
  el.textContent = msg; el.classList.add('show');
  clearTimeout(_tt); _tt = setTimeout(()=>el.classList.remove('show'), 2600);
}

/* ===== Utils ===== */
function escHtml(s) {
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

/* ===== Drag & Drop on modal ===== */
document.addEventListener('DOMContentLoaded', () => {
  const zone = document.getElementById('nm-drop-zone');
  if (!zone) return;
  ['dragenter','dragover'].forEach(ev=>zone.addEventListener(ev,e=>{e.preventDefault();zone.classList.add('drag-over');}));
  ['dragleave','drop'].forEach(ev=>zone.addEventListener(ev,e=>{e.preventDefault();zone.classList.remove('drag-over');}));
  zone.addEventListener('drop', async e=>{
    const files = Array.from(e.dataTransfer.files);
    if (!files.length) return;
    await handleModalFileUpload({target:{files,value:''}});
  });
});

/* ===== Keyboard ===== */
document.addEventListener('keydown', e=>{
  if (e.key==='Escape') { closeModal(); document.getElementById('lightbox')?.remove(); closeMobileSidebar(); }
  if ((e.ctrlKey||e.metaKey) && e.key==='Enter') {
    if (state.modal.mode==='new'||state.modal.mode==='edit') saveModal();
  }
});

/* ===== Init ===== */
if (localStorage.getItem('noteos-dark')==='1') document.body.classList.add('dark');
checkAuth();
loadNotes(true);
