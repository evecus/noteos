<template>
  <div id="page">
    <div id="topbar">
      <button class="topbar-btn" @click="goBack">
        <svg viewBox="0 0 24 24"><path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/></svg>
        <span>返回</span>
      </button>
      <div class="topbar-title" id="topbar-title">{{ note?.title || '笔记详情' }}</div>
      <div class="topbar-actions">
        <button class="topbar-btn danger" @click="deleteNote" title="删除" v-if="note">
          <svg viewBox="0 0 24 24"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>
          <span>删除</span>
        </button>
        <button class="topbar-btn accent" @click="goEdit" title="编辑" v-if="note">
          <svg viewBox="0 0 24 24"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a1 1 0 0 0 0-1.41l-2.34-2.34a1 1 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg>
          <span>编辑</span>
        </button>
      </div>
    </div>

    <!-- Skeleton -->
    <div id="skeleton" v-if="loading">
      <div class="sk-line sk-title"></div>
      <div class="sk-line short" style="margin-bottom:24px"></div>
      <div class="sk-line wide"></div>
      <div class="sk-line medium"></div>
      <div class="sk-line wide"></div>
      <div class="sk-line short"></div>
      <div class="sk-line wide"></div>
      <div class="sk-line medium"></div>
    </div>

    <!-- Error -->
    <div v-else-if="error" id="skeleton">
      <div style="text-align:center;padding:60px 0;color:var(--text3);font-size:16px">⚠️ {{ error }}</div>
    </div>

    <!-- Content -->
    <div v-else-if="note" id="content">
      <div id="content-inner">
        <div v-if="note.title" id="note-title">{{ note.title }}</div>
        <div id="note-meta">
          <span v-if="note.pinned" class="meta-pin">📌 已置顶</span>
          <span>创建于 {{ formatDate(note.created_at) }}</span>
          <span v-if="note.updated_at !== note.created_at">· 更新于 {{ formatDate(note.updated_at) }}</span>
        </div>
        <div v-if="note.tags && note.tags.length" id="note-tags">
          <span v-for="t in note.tags" :key="t" class="tag-badge">
            #{{ t }}
          </span>
        </div>
        <div id="note-body" class="md-body" v-html="renderedContent"></div>
        <div v-if="hasFiles" id="note-files">
          <div class="files-label">附件</div>
          <div v-if="allImages.length" class="files-images">
            <img
              v-for="f in allImages"
              :key="f.filename"
              :src="`/uploads/${f.filename}`"
              :alt="f.orig_name"
              loading="lazy"
              @click="lightboxSrc = `/uploads/${f.filename}`"
            />
          </div>
          <div v-if="otherFiles.length" class="files-list">
            <a
              v-for="f in otherFiles"
              :key="f.filename"
              class="file-row"
              :href="`/uploads/${f.filename}`"
              target="_blank"
              rel="noopener"
            >
              <div class="file-icon" v-html="getFileIcon(f.mime)"></div>
              <div class="file-info">
                <div class="file-name">{{ f.orig_name }}</div>
                <div class="file-size">{{ formatSize(f.size) }}</div>
              </div>
              <div class="file-open">
                <svg viewBox="0 0 24 24"><path d="M19 19H5V5h7V3H5c-1.11 0-2 .9-2 2v14c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2v-7h-2v7zM14 3v2h3.59l-9.83 9.83 1.41 1.41L19 6.41V10h2V3h-7z" fill="currentColor"/></svg>
              </div>
            </a>
          </div>
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
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { api } from '../composables/useApi.js'
import { parseMarkdown } from '../composables/useMarkdown.js'
import { formatSize, getFileIcon } from '../composables/useFiles.js'
import { useToast } from '../composables/useToast.js'
import ToastMsg from '../components/ToastMsg.vue'

const route = useRoute()
const router = useRouter()
const { toast } = useToast()

const note = ref(null)
const loading = ref(true)
const error = ref('')
const lightboxSrc = ref('')

const noteId = computed(() => parseInt(route.params.id))

const renderedContent = computed(() => parseMarkdown(note.value?.content || ''))

const allImages = computed(() => [
  ...(note.value?.images || []).map(img => ({ filename: img, orig_name: img, size: 0, mime: 'image/jpeg' })),
  ...(note.value?.files || []).filter(f => f.mime?.startsWith('image/')),
])
const otherFiles = computed(() =>
  (note.value?.files || []).filter(f => f.mime && !f.mime.startsWith('image/')))
const hasFiles = computed(() => allImages.value.length > 0 || otherFiles.value.length > 0)

function formatDate(s) {
  return new Date(s).toLocaleString('zh-CN', {
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit',
  })
}

async function loadNote() {
  loading.value = true
  error.value = ''
  try {
    note.value = await api.get(`/notes/${noteId.value}`)
    document.title = (note.value.title || '笔记详情') + ' · NoteOS'
  } catch (e) {
    error.value = e.message || '加载失败'
  } finally {
    loading.value = false
  }
}

async function deleteNote() {
  if (!confirm('确认删除这条笔记？')) return
  try {
    await api.del(`/notes/${noteId.value}`)
    toast('🗑️ 已删除')
    router.replace('/')
  } catch (e) {
    toast('删除失败: ' + e.message)
  }
}

function goEdit() { router.push(`/editor/${noteId.value}`) }
function goBack() {
  if (history.length > 1) router.back()
  else router.push('/')
}

function onKeydown(e) {
  if (e.key === 'Escape') { lightboxSrc.value ? (lightboxSrc.value = '') : goBack() }
}

onMounted(() => {
  if (localStorage.getItem('noteos-dark') === '1') document.body.classList.add('dark')
  loadNote()
  document.addEventListener('keydown', onKeydown)
})
onBeforeUnmount(() => document.removeEventListener('keydown', onKeydown))
</script>

<style scoped>
#page {
  display: flex; flex-direction: column;
  height: 100vh; height: 100dvh;
  background: var(--bg);
}
#topbar {
  display: flex; align-items: flex-end; gap: 8px;
  min-height: calc(56px + var(--safe-top, 0px));
  padding-bottom: 8px;
  padding-top: max(8px, var(--safe-top, 0px));
  padding-left: max(12px, var(--safe-left, 0px));
  padding-right: max(12px, var(--safe-right, 0px));
  background: var(--bg2); border-bottom: 1px solid var(--border);
  flex-shrink: 0; box-shadow: 0 1px 0 var(--border);
}
.topbar-title {
  flex: 1; font-size: 15px; font-weight: 600; color: var(--text2);
  text-align: center; overflow: hidden; text-overflow: ellipsis;
  white-space: nowrap; min-width: 0; padding: 0 4px;
}
.topbar-actions { display: flex; align-items: center; gap: 4px; flex-shrink: 0; }

#skeleton {
  padding: 32px max(24px, calc((100vw - 780px) / 2));
  max-width: 780px; margin: 0 auto; width: 100%;
}

#content {
  flex: 1; overflow-y: auto;
  -webkit-overflow-scrolling: touch;
  overscroll-behavior-y: contain;
  padding: 32px max(24px, calc((100vw - 780px) / 2)) max(60px, calc(var(--safe-bottom, 0px) + 40px));
}
#content-inner { max-width: 780px; margin: 0 auto; }

#note-title {
  font-size: 28px; font-weight: 700; color: var(--text);
  line-height: 1.3; margin-bottom: 14px; letter-spacing: -.02em;
  word-break: break-word;
}
#note-meta {
  display: flex; align-items: center; gap: 10px; flex-wrap: wrap;
  font-size: 13px; color: var(--text3);
  margin-bottom: 20px; padding-bottom: 16px;
  border-bottom: 1px solid var(--border);
}
.meta-pin { color: var(--pin); font-size: 14px; }
#note-tags { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 24px; }

/* Files section */
#note-files { margin-top: 32px; padding-top: 20px; border-top: 1px solid var(--border); }
.files-label {
  font-size: 11px; font-weight: 600; text-transform: uppercase;
  letter-spacing: .08em; color: var(--text3); margin-bottom: 12px;
}
.files-images {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(90px, 1fr));
  gap: 8px; margin-bottom: 12px;
}
.files-images img {
  width: 100%; aspect-ratio: 1; object-fit: cover;
  border-radius: 10px; cursor: pointer;
  transition: opacity .15s, transform .12s;
  border: 1px solid var(--border); display: block;
}
.files-images img:hover { opacity: .88; transform: scale(1.02); }
.files-list { display: flex; flex-direction: column; gap: 6px; }
.file-row {
  display: flex; align-items: center; gap: 10px;
  padding: 10px 14px; background: var(--bg2);
  border: 1px solid var(--border); border-radius: 10px;
  text-decoration: none; color: var(--text);
  transition: background .15s; -webkit-tap-highlight-color: transparent;
}
.file-row:hover { background: var(--bg3); }
.file-icon {
  width: 36px; height: 36px; border-radius: 8px;
  background: var(--accent-light); color: var(--accent);
  display: flex; align-items: center; justify-content: center;
  flex-shrink: 0;
}
.file-icon :deep(svg) { width: 18px; height: 18px; fill: currentColor; }
.file-info { flex: 1; min-width: 0; }
.file-name { font-size: 14px; font-weight: 500; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.file-size { font-size: 12px; color: var(--text3); margin-top: 2px; }
.file-open svg { width: 16px; height: 16px; fill: var(--text3); flex-shrink: 0; }

/* Mobile */
@media (max-width: 768px) {
  #content { padding: 20px 16px max(80px, calc(var(--safe-bottom, 0px) + 60px)); }
  #skeleton { padding: 20px 16px; }
  #note-title { font-size: 21px; }
  .topbar-btn.accent span, .topbar-btn.danger span { display: none; }
  .topbar-btn.accent, .topbar-btn.danger { padding: 8px; }
  .files-images { grid-template-columns: repeat(auto-fill, minmax(72px, 1fr)); gap: 6px; }
}
@media (min-width: 1200px) {
  #note-title { font-size: 32px; }
  .files-images { grid-template-columns: repeat(auto-fill, minmax(110px, 1fr)); }
}
</style>
