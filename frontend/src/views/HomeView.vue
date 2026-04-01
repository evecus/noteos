<template>
  <div id="app-layout">
    <!-- Sidebar overlay (mobile) -->
    <div v-if="sidebarOpen" class="sidebar-overlay" @click="sidebarOpen = false"></div>

    <!-- Sidebar -->
    <aside id="sidebar" :class="{ open: sidebarOpen }">
      <div class="logo">
        <svg class="logo-img" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <linearGradient id="lg-s" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stop-color="#5B63D3"/>
              <stop offset="100%" stop-color="#7C4FC5"/>
            </linearGradient>
            <clipPath id="cp-s"><rect width="512" height="512" rx="112"/></clipPath>
          </defs>
          <g clip-path="url(#cp-s)">
            <rect width="512" height="512" fill="url(#lg-s)"/>
            <rect x="100" y="88" width="308" height="342" rx="28" fill="white" fill-opacity=".96"/>
            <polygon points="306,88 408,88 408,168" fill="#DDD8FF" fill-opacity=".55"/>
            <rect x="138" y="198" width="176" height="11" rx="5.5" fill="#5C63D3" fill-opacity=".55"/>
            <rect x="138" y="224" width="228" height="8" rx="4" fill="#5C63D3" fill-opacity=".28"/>
            <g transform="translate(256,256) rotate(-38) translate(-256,-256)">
              <rect x="245" y="166" width="22" height="122" rx="3" fill="#FFD166"/>
              <polygon points="245,288 267,288 256,324" fill="#F0A742"/>
              <polygon points="250,316 262,316 256,332" fill="#2A2A2A"/>
            </g>
          </g>
        </svg>
        <span class="logo-text">NoteOS</span>
      </div>

      <nav>
        <a class="nav-item" :class="{ active: view === 'all' && !activeTag }" @click="setView('all')">
          <svg viewBox="0 0 24 24"><path d="M3 9h14V7H3v2zm0 4h14v-2H3v2zm0 4h14v-2H3v2zm16 0h2v-2h-2v2zm0-10v2h2V7h-2zm0 6h2v-2h-2v2z"/></svg>
          全部笔记
        </a>
        <a class="nav-item" :class="{ active: view === 'pinned' && !activeTag }" @click="setView('pinned')">
          <svg viewBox="0 0 24 24"><path d="M16 12V4h1V2H7v2h1v8l-2 2v2h5.2v6h1.6v-6H18v-2l-2-2z"/></svg>
          已置顶
        </a>
      </nav>

      <div class="sidebar-section">
        <div class="sidebar-label">标签</div>
        <div id="tag-list">
          <div
            v-for="t in tags"
            :key="t"
            class="tag-nav-item"
            :class="{ active: activeTag === t }"
            @click="filterByTag(t)"
          >{{ t }}</div>
        </div>
      </div>

      <div class="sidebar-footer">
        <button class="btn-ghost" @click="exportMd">
          <svg viewBox="0 0 24 24"><path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/></svg>
          导出 Markdown
        </button>
        <button class="btn-ghost" @click="toggleDark">
          <svg viewBox="0 0 24 24"><path d="M12 3a9 9 0 1 0 9 9c0-.46-.04-.92-.1-1.36a5.389 5.389 0 0 1-4.4 2.26 5.403 5.403 0 0 1-3.14-9.8c-.44-.06-.9-.1-1.36-.1z"/></svg>
          {{ dark ? '亮色模式' : '暗色模式' }}
        </button>
        <button v-if="showLogout" class="btn-ghost btn-logout" @click="logout">
          <svg viewBox="0 0 24 24"><path d="M17 7l-1.41 1.41L18.17 11H8v2h10.17l-2.58 2.58L17 17l5-5zM4 5h8V3H4c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h8v-2H4V5z"/></svg>
          退出登录
        </button>
      </div>
    </aside>

    <!-- Main area -->
    <div id="main">
      <!-- Mobile header -->
      <header id="mobile-header">
        <button class="icon-btn" @click="sidebarOpen = true" aria-label="菜单">
          <svg viewBox="0 0 24 24"><path d="M3 18h18v-2H3v2zm0-5h18v-2H3v2zm0-7v2h18V6H3z"/></svg>
        </button>
        <div class="mobile-logo">
          <svg viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg" style="width:26px;height:26px;border-radius:6px;">
            <defs>
              <linearGradient id="lg-m" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stop-color="#5B63D3"/>
                <stop offset="100%" stop-color="#7C4FC5"/>
              </linearGradient>
              <clipPath id="cp-m"><rect width="512" height="512" rx="112"/></clipPath>
            </defs>
            <g clip-path="url(#cp-m)">
              <rect width="512" height="512" fill="url(#lg-m)"/>
              <rect x="100" y="88" width="308" height="342" rx="28" fill="white" fill-opacity=".96"/>
            </g>
          </svg>
          <span style="font-size:15px;font-weight:700;color:var(--accent)">NoteOS</span>
        </div>
        <div class="mobile-header-right">
          <button class="icon-btn" @click="toggleMobileSearch" aria-label="搜索">
            <svg viewBox="0 0 24 24"><path d="M15.5 14h-.79l-.28-.27A6.471 6.471 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/></svg>
          </button>
          <button class="icon-btn new-btn" @click="$router.push('/editor')" aria-label="新建">
            <svg viewBox="0 0 24 24"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/></svg>
          </button>
        </div>
      </header>

      <!-- Mobile search bar -->
      <div id="mobile-search-bar" v-if="mobileSearchOpen">
        <input
          v-model="query"
          class="mobile-search-input"
          placeholder="搜索笔记…"
          autofocus
          @input="debouncedSearch"
        />
        <button class="icon-btn" @click="closeMobileSearch">
          <svg viewBox="0 0 24 24"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>
        </button>
      </div>

      <!-- Desktop top bar -->
      <div id="topbar">
        <div class="search-wrap">
          <svg viewBox="0 0 24 24"><path d="M15.5 14h-.79l-.28-.27A6.471 6.471 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/></svg>
          <input
            v-model="query"
            class="search-input"
            placeholder="搜索笔记…"
            @input="debouncedSearch"
          />
        </div>
        <div class="topbar-right">
          <span class="note-count">共 {{ total }} 条</span>
          <button class="new-note-btn" @click="$router.push('/editor')">
            <svg viewBox="0 0 24 24"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/></svg>
            新建笔记
          </button>
        </div>
      </div>

      <!-- Notes grid -->
      <div id="content">
        <div v-if="loading && notes.length === 0" class="notes-grid">
          <div v-for="i in 6" :key="i" class="note-card-sk">
            <div class="sk-line wide"></div>
            <div class="sk-line medium"></div>
            <div class="sk-line short"></div>
          </div>
        </div>

        <div v-else-if="notes.length === 0" id="empty-state">
          <svg viewBox="0 0 24 24"><path d="M14 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z"/></svg>
          <p>{{ query || activeTag ? '没有匹配的笔记' : '还没有笔记，点击右上角新建吧！' }}</p>
        </div>

        <div v-else class="notes-grid">
          <NoteCard
            v-for="note in notes"
            :key="note.id"
            :note="note"
            @filterTag="filterByTag"
            @lightbox="lightboxSrc = $event"
          />
        </div>

        <div v-if="notes.length < total" class="load-more-wrap">
          <button class="load-more-btn" @click="loadMore" :disabled="loading">
            {{ loading ? '加载中…' : '加载更多' }}
          </button>
        </div>
      </div>
    </div>

    <!-- Lightbox -->
    <div v-if="lightboxSrc" class="lightbox" @click="lightboxSrc = ''">
      <img :src="lightboxSrc" />
    </div>

    <ToastMsg />
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { api, checkAuth } from '../composables/useApi.js'
import { useToast } from '../composables/useToast.js'
import NoteCard from '../components/NoteCard.vue'
import ToastMsg from '../components/ToastMsg.vue'

const { toast } = useToast()

const notes = ref([])
const total = ref(0)
const page = ref(1)
const limit = 20
const query = ref('')
const view = ref('all')
const activeTag = ref('')
const tags = ref([])
const loading = ref(false)
const sidebarOpen = ref(false)
const mobileSearchOpen = ref(false)
const dark = ref(localStorage.getItem('noteos-dark') === '1')
const showLogout = ref(false)
const lightboxSrc = ref('')

let searchTimer = null

async function loadNotes(reset = false) {
  if (reset) { page.value = 1; notes.value = [] }
  loading.value = true
  try {
    let path = `/notes?page=${page.value}&limit=${limit}`
    if (query.value) path += `&q=${encodeURIComponent(query.value)}`
    if (activeTag.value) path += `&tag=${encodeURIComponent(activeTag.value)}`
    const result = await api.get(path)
    let list = result.notes || []
    if (view.value === 'pinned') list = list.filter(n => n.pinned)
    notes.value = reset ? list : [...notes.value, ...list]
    total.value = result.total
    loadTags()
  } catch (e) {
    toast('加载失败: ' + e.message)
  } finally {
    loading.value = false
  }
}

async function loadTags() {
  try { tags.value = await api.get('/tags') } catch (_) {}
}

async function loadMore() {
  page.value++
  await loadNotes(false)
}

function debouncedSearch() {
  clearTimeout(searchTimer)
  searchTimer = setTimeout(() => {
    activeTag.value = ''
    loadNotes(true)
  }, 350)
}

function setView(v) {
  view.value = v
  activeTag.value = ''
  query.value = ''
  sidebarOpen.value = false
  loadNotes(true)
}

function filterByTag(tag) {
  activeTag.value = activeTag.value === tag ? '' : tag
  if (activeTag.value) view.value = ''
  query.value = ''
  sidebarOpen.value = false
  loadNotes(true)
}

function toggleMobileSearch() { mobileSearchOpen.value = true }
function closeMobileSearch() {
  mobileSearchOpen.value = false
  query.value = ''
  loadNotes(true)
}

function toggleDark() {
  dark.value = !dark.value
  document.body.classList.toggle('dark', dark.value)
  localStorage.setItem('noteos-dark', dark.value ? '1' : '0')
}

function exportMd() { window.location.href = '/api/v1/export/markdown' }

async function logout() {
  await fetch('/api/auth/logout', { method: 'POST' })
  window.location.href = '/login'
}

onMounted(async () => {
  const auth = await checkAuth()
  showLogout.value = !!auth.protected
  loadNotes(true)
})
</script>

<style scoped>
#app-layout {
  display: flex;
  height: 100vh;
  height: 100dvh;
  overflow: hidden;
}

/* ===== Sidebar ===== */
#sidebar {
  width: var(--sidebar-w);
  min-width: var(--sidebar-w);
  height: 100vh;
  height: 100dvh;
  background: var(--bg2);
  border-right: 1px solid var(--border);
  display: flex;
  flex-direction: column;
  padding: 20px 12px 16px;
  padding-bottom: max(16px, var(--safe-bottom));
  gap: 8px;
  overflow-y: auto;
  z-index: 50;
  transition: transform .25s ease;
}
.logo {
  display: flex; align-items: center; gap: 9px;
  padding: 0 8px 14px;
  font-size: 17px; font-weight: 700; color: var(--accent);
  border-bottom: 1px solid var(--border); margin-bottom: 4px;
  letter-spacing: -.01em;
}
.logo-img { width: 28px; height: 28px; border-radius: 7px; }
nav { display: flex; flex-direction: column; gap: 2px; }
.nav-item {
  display: flex; align-items: center; gap: 8px;
  padding: 9px 10px; border-radius: 8px;
  cursor: pointer; font-size: 14px; color: var(--text2);
  text-decoration: none; transition: background .15s, color .15s;
  user-select: none; -webkit-tap-highlight-color: transparent;
}
.nav-item svg { width: 18px; height: 18px; fill: currentColor; flex-shrink: 0; }
.nav-item:hover { background: var(--bg3); color: var(--text); }
.nav-item.active { background: var(--accent-light); color: var(--accent); font-weight: 600; }
.sidebar-section { margin-top: 12px; }
.sidebar-label {
  font-size: 11px; font-weight: 600; text-transform: uppercase;
  letter-spacing: .06em; color: var(--text3); padding: 0 10px 6px;
}
.tag-nav-item {
  padding: 7px 10px; border-radius: 8px; cursor: pointer;
  font-size: 13px; color: var(--text2); transition: background .15s;
  -webkit-tap-highlight-color: transparent;
}
.tag-nav-item::before { content: '#'; color: var(--accent); font-weight: 700; margin-right: 4px; }
.tag-nav-item:hover { background: var(--bg3); color: var(--text); }
.tag-nav-item.active { background: var(--accent-light); color: var(--accent); }
.sidebar-footer {
  margin-top: auto; padding-top: 12px;
  border-top: 1px solid var(--border);
  display: flex; flex-direction: column; gap: 2px;
}
.btn-logout { color: var(--danger) !important; }

/* ===== Main ===== */
#main {
  flex: 1; display: flex; flex-direction: column;
  min-width: 0; overflow: hidden;
  background: var(--bg);
}

/* ===== Mobile header ===== */
#mobile-header {
  display: none;
  align-items: center; gap: 10px;
  padding: max(10px, var(--safe-top)) 14px 10px;
  background: var(--bg2);
  border-bottom: 1px solid var(--border);
  flex-shrink: 0;
}
.mobile-logo { display: flex; align-items: center; gap: 8px; flex: 1; }
.mobile-header-right { display: flex; gap: 6px; }
.icon-btn {
  width: 38px; height: 38px;
  border: none; border-radius: 10px;
  background: transparent; color: var(--text2);
  cursor: pointer; display: flex; align-items: center; justify-content: center;
  transition: background .15s; -webkit-tap-highlight-color: transparent;
}
.icon-btn svg { width: 22px; height: 22px; fill: currentColor; }
.icon-btn:hover { background: var(--bg3); }
.new-btn { background: var(--accent-light); color: var(--accent); }
.new-btn:hover { background: var(--accent); color: #fff; }

/* Mobile search bar */
#mobile-search-bar {
  display: flex; align-items: center; gap: 8px;
  padding: 8px 14px;
  background: var(--bg2);
  border-bottom: 1px solid var(--border);
  flex-shrink: 0;
}
.mobile-search-input {
  flex: 1; border: none; outline: none;
  background: var(--bg3); border-radius: 10px;
  padding: 9px 14px; font-size: 14px;
  font-family: var(--font); color: var(--text);
}

/* ===== Desktop topbar ===== */
#topbar {
  display: flex; align-items: center; gap: 12px;
  padding: 12px 20px;
  background: var(--bg2);
  border-bottom: 1px solid var(--border);
  flex-shrink: 0;
}
.search-wrap {
  flex: 1; display: flex; align-items: center; gap: 8px;
  background: var(--bg3);
  border: 1.5px solid var(--border);
  border-radius: 10px; padding: 0 12px;
  transition: border-color .15s;
}
.search-wrap:focus-within { border-color: var(--accent); }
.search-wrap svg { width: 16px; height: 16px; fill: var(--text3); flex-shrink: 0; }
.search-input {
  flex: 1; border: none; outline: none;
  background: transparent; font-size: 14px;
  font-family: var(--font); color: var(--text);
  padding: 9px 0;
}
.topbar-right { display: flex; align-items: center; gap: 12px; flex-shrink: 0; }
.note-count { font-size: 13px; color: var(--text3); }
.new-note-btn {
  display: flex; align-items: center; gap: 6px;
  padding: 9px 16px; border: none; border-radius: 10px;
  background: var(--accent); color: #fff;
  font-size: 14px; font-weight: 600; font-family: var(--font);
  cursor: pointer; transition: opacity .15s, transform .12s;
  white-space: nowrap;
}
.new-note-btn svg { width: 18px; height: 18px; fill: currentColor; }
.new-note-btn:hover { opacity: .9; transform: translateY(-1px); }

/* ===== Content ===== */
#content {
  flex: 1; overflow-y: auto;
  -webkit-overflow-scrolling: touch;
  overscroll-behavior-y: contain;
  padding: 20px;
}
.notes-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 14px;
}
#empty-state {
  text-align: center; padding: 80px 20px;
  color: var(--text3);
}
#empty-state svg { width: 48px; height: 48px; fill: var(--border); margin-bottom: 12px; }
#empty-state p { font-size: 15px; }
.load-more-wrap { text-align: center; padding: 20px 0; }
.load-more-btn {
  padding: 10px 28px; border: 1.5px solid var(--border);
  border-radius: 10px; background: var(--bg2); color: var(--text2);
  font-size: 14px; font-family: var(--font); cursor: pointer;
  transition: background .15s, border-color .15s;
}
.load-more-btn:hover { background: var(--bg3); border-color: var(--accent); color: var(--accent); }

/* Skeleton cards */
.note-card-sk {
  background: var(--bg2); border: 1px solid var(--border);
  border-radius: var(--radius); padding: 16px;
}

/* Sidebar overlay mobile */
.sidebar-overlay {
  position: fixed; inset: 0; background: rgba(0,0,0,.35);
  z-index: 49; display: none;
}

/* ===== Mobile ≤768px ===== */
@media (max-width: 768px) {
  #sidebar {
    position: fixed; top: 0; left: 0; bottom: 0;
    transform: translateX(-100%);
  }
  #sidebar.open { transform: translateX(0); }
  .sidebar-overlay { display: block; }
  #mobile-header { display: flex; }
  #topbar { display: none; }
  #content { padding: 12px; }
  .notes-grid { grid-template-columns: 1fr; }
}
@media (min-width: 769px) {
  .sidebar-overlay { display: none !important; }
}
</style>
