<template>
  <div id="page">
    <!-- Topbar -->
    <div id="topbar">
      <button class="topbar-btn" @click="goBack">
        <svg viewBox="0 0 24 24"><path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/></svg>
        <span>返回</span>
      </button>
      <div class="topbar-title">{{ isNew ? '新建笔记' : '编辑笔记' }}</div>
      <div class="topbar-actions">
        <button v-if="!isNew" class="topbar-btn danger" @click="deleteNote" title="删除">
          <svg viewBox="0 0 24 24"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>
          <span>删除</span>
        </button>
        <button class="topbar-btn accent" @click="saveNote" :disabled="saving" title="保存">
          <svg viewBox="0 0 24 24"><path d="M17 3H5c-1.11 0-2 .9-2 2v14c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V7l-4-4zm-5 16c-1.66 0-3-1.34-3-3s1.34-3 3-3 3 1.34 3 3-1.34 3-3 3zm3-10H5V5h10v4z"/></svg>
          <span>{{ saving ? '保存中…' : '保存' }}</span>
        </button>
      </div>
    </div>

    <!-- Editor body -->
    <div id="editor-body">
      <div id="editor-inner">
        <!-- Title -->
        <input
          v-model="title"
          class="editor-title-input"
          placeholder="标题（可选）"
          type="text"
        />

        <!-- Tag editor -->
        <div class="editor-meta-row">
          <label class="meta-label">
            <svg viewBox="0 0 24 24"><path d="M21.41 11.58l-9-9C12.05 2.22 11.55 2 11 2H4c-1.1 0-2 .9-2 2v7c0 .55.22 1.05.59 1.42l9 9c.36.36.86.58 1.41.58.55 0 1.05-.22 1.41-.59l7-7c.37-.36.59-.86.59-1.41 0-.55-.23-1.06-.59-1.42zM5.5 7C4.67 7 4 6.33 4 5.5S4.67 4 5.5 4 7 4.67 7 5.5 6.33 7 5.5 7z"/></svg>
          </label>
          <TagEditor v-model:tags="tags" />
        </div>

        <!-- Pin toggle -->
        <div class="editor-meta-row">
          <label class="pin-toggle" :class="{ active: pinned }">
            <input type="checkbox" v-model="pinned" style="display:none" />
            <svg viewBox="0 0 24 24"><path d="M16 12V4h1V2H7v2h1v8l-2 2v2h5.2v6h1.6v-6H18v-2l-2-2z"/></svg>
            {{ pinned ? '已置顶' : '置顶' }}
          </label>
        </div>

        <!-- Textarea + preview toggle -->
        <div class="editor-tabs">
          <button :class="{ active: editorTab === 'write' }" @click="editorTab = 'write'">编写</button>
          <button :class="{ active: editorTab === 'preview' }" @click="editorTab = 'preview'">预览</button>
        </div>

        <div v-show="editorTab === 'write'" class="textarea-wrap">
          <textarea
            ref="textarea"
            v-model="content"
            class="editor-textarea"
            placeholder="用 Markdown 写点什么…"
            @keydown="onTextareaKey"
          ></textarea>
        </div>
        <div v-show="editorTab === 'preview'" class="preview-wrap">
          <div class="md-body" v-html="previewHtml"></div>
        </div>

        <!-- Files area -->
        <FileArea
          :files="noteFiles"
          :images="legacyImages"
          :pendingFiles="pendingFiles"
          @deleteFile="removeFile"
          @removePending="removePending"
          @lightbox="lightboxSrc = $event"
        />

        <!-- Drop zone -->
        <div
          class="drop-zone"
          :class="{ 'drag-over': dragging }"
          @click="fileInput.click()"
          @dragenter.prevent="dragging = true"
          @dragover.prevent="dragging = true"
          @dragleave.prevent="dragging = false"
          @drop.prevent="onDrop"
        >
          <svg viewBox="0 0 24 24" style="width:20px;height:20px;fill:currentColor;margin-bottom:4px;">
            <path d="M16.5 6v11.5c0 2.21-1.79 4-4 4s-4-1.79-4-4V5c0-1.38 1.12-2.5 2.5-2.5s2.5 1.12 2.5 2.5v10.5c0 .55-.45 1-1 1s-1-.45-1-1V6H10v9.5c0 1.38 1.12 2.5 2.5 2.5s2.5-1.12 2.5-2.5V5c0-2.21-1.79-4-4-4S7 2.79 7 5v12.5c0 3.04 2.46 5.5 5.5 5.5s5.5-2.46 5.5-5.5V6h-1.5z"/>
          </svg>
          <div>拖拽文件到这里，或点击选择文件</div>
          <input ref="fileInput" type="file" multiple style="display:none" @change="onFileSelect" />
        </div>

        <!-- Bottom meta -->
        <div class="editor-bottom-meta" v-if="!isNew && noteData">
          <span>创建于 {{ formatDate(noteData.created_at) }}</span>
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
import { useToast } from '../composables/useToast.js'
import TagEditor from '../components/TagEditor.vue'
import FileArea from '../components/FileArea.vue'
import ToastMsg from '../components/ToastMsg.vue'

const route = useRoute()
const router = useRouter()
const { toast } = useToast()

const isNew = computed(() => !route.params.id)
const noteId = computed(() => route.params.id ? parseInt(route.params.id) : null)

const title = ref('')
const content = ref('')
const tags = ref([])
const pinned = ref(false)
const saving = ref(false)
const editorTab = ref('write')
const dragging = ref(false)
const pendingFiles = ref([])
const noteFiles = ref([])
const legacyImages = ref([])
const noteData = ref(null)
const fileInput = ref(null)
const textarea = ref(null)
const lightboxSrc = ref('')

const previewHtml = computed(() => parseMarkdown(content.value))

function formatDate(s) {
  return new Date(s).toLocaleString('zh-CN', {
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit',
  })
}

async function loadNote() {
  if (!noteId.value) return
  try {
    const note = await api.get(`/notes/${noteId.value}`)
    noteData.value = note
    title.value = note.title || ''
    content.value = note.content || ''
    tags.value = [...(note.tags || [])]
    pinned.value = note.pinned || false
    noteFiles.value = note.files || []
    legacyImages.value = note.images || []
    document.title = (note.title || '编辑笔记') + ' · NoteOS'
  } catch (e) {
    toast('加载失败: ' + e.message)
  }
}

async function saveNote() {
  const body = content.value.trim()
  if (!body) { toast('内容不能为空'); return }
  saving.value = true
  try {
    if (isNew.value) {
      const note = await api.post('/notes', {
        title: title.value.trim(),
        content: body,
        tags: tags.value,
        pinned: pinned.value,
      })
      for (const f of pendingFiles.value) {
        try { await api.uploadFile(note.id, f) } catch (e) { toast('文件上传失败: ' + e.message) }
      }
      toast('✅ 笔记已保存')
      router.replace(`/notes/${note.id}`)
    } else {
      await api.put(`/notes/${noteId.value}`, {
        title: title.value.trim(),
        content: body,
        tags: tags.value,
        pinned: pinned.value,
      })
      toast('✅ 已保存')
      router.replace(`/notes/${noteId.value}`)
    }
  } catch (e) {
    toast('保存失败: ' + e.message)
    saving.value = false
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

async function removeFile(filename) {
  if (!noteId.value || !confirm('确认删除该附件？')) return
  try {
    await api.deleteFile(noteId.value, filename)
    const fresh = await api.get(`/notes/${noteId.value}`)
    noteFiles.value = fresh.files || []
    legacyImages.value = fresh.images || []
    toast('附件已删除')
  } catch (e) {
    toast('删除失败: ' + e.message)
  }
}

function removePending(i) {
  pendingFiles.value.splice(i, 1)
}

async function onFileSelect(e) {
  const files = Array.from(e.target.files)
  e.target.value = ''
  if (!files.length) return
  if (isNew.value) {
    pendingFiles.value.push(...files)
    return
  }
  for (const f of files) {
    try { await api.uploadFile(noteId.value, f) } catch (e) { toast('上传失败: ' + e.message) }
  }
  const fresh = await api.get(`/notes/${noteId.value}`)
  noteFiles.value = fresh.files || []
  legacyImages.value = fresh.images || []
  toast('✅ 文件已上传')
}

function onDrop(e) {
  dragging.value = false
  const files = Array.from(e.dataTransfer.files)
  if (files.length) onFileSelect({ target: { files, value: '' } })
}

function goBack() {
  if (!isNew.value && noteId.value) {
    router.push(`/notes/${noteId.value}`)
  } else if (history.length > 1) {
    router.back()
  } else {
    router.push('/')
  }
}

function onTextareaKey(e) {
  if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') saveNote()
  if (e.key === 'Escape') goBack()
  // Tab indent
  if (e.key === 'Tab') {
    e.preventDefault()
    const el = e.target
    const start = el.selectionStart
    const end = el.selectionEnd
    content.value = content.value.substring(0, start) + '  ' + content.value.substring(end)
    setTimeout(() => { el.selectionStart = el.selectionEnd = start + 2 }, 0)
  }
}

function onKeydown(e) {
  if ((e.ctrlKey || e.metaKey) && e.key === 's') { e.preventDefault(); saveNote() }
}

// iOS keyboard resize
function onViewportResize() {
  if (window.visualViewport) {
    document.getElementById('page').style.height = window.visualViewport.height + 'px'
  }
}

onMounted(() => {
  if (localStorage.getItem('noteos-dark') === '1') document.body.classList.add('dark')
  loadNote()
  document.addEventListener('keydown', onKeydown)
  if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', onViewportResize)
    window.visualViewport.addEventListener('scroll', onViewportResize)
  }
})

onBeforeUnmount(() => {
  document.removeEventListener('keydown', onKeydown)
  if (window.visualViewport) {
    window.visualViewport.removeEventListener('resize', onViewportResize)
    window.visualViewport.removeEventListener('scroll', onViewportResize)
  }
})
</script>

<style scoped>
:root { --topbar-h: calc(56px + var(--safe-top)); }

html, body { height: 100%; overflow: hidden; }

#page {
  display: flex; flex-direction: column;
  height: 100vh; height: 100dvh;
  background: var(--bg);
}

/* ===== Topbar ===== */
#topbar {
  display: flex; align-items: flex-end; gap: 8px;
  min-height: calc(56px + var(--safe-top, 0px));
  padding-bottom: 8px;
  padding-top: max(8px, var(--safe-top, 0px));
  padding-left: max(12px, var(--safe-left, 0px));
  padding-right: max(12px, var(--safe-right, 0px));
  background: var(--bg2);
  border-bottom: 1px solid var(--border);
  flex-shrink: 0;
  box-shadow: 0 1px 0 var(--border);
}
.topbar-title {
  flex: 1; font-size: 15px; font-weight: 600; color: var(--text2);
  text-align: center; overflow: hidden; text-overflow: ellipsis;
  white-space: nowrap; min-width: 0; padding: 0 4px;
}
.topbar-actions { display: flex; align-items: center; gap: 4px; flex-shrink: 0; }

/* ===== Editor body ===== */
#editor-body {
  flex: 1; overflow-y: auto;
  -webkit-overflow-scrolling: touch;
  overscroll-behavior-y: contain;
  padding: 24px max(20px, calc((100vw - 800px) / 2)) max(60px, calc(var(--safe-bottom, 0px) + 40px));
}
#editor-inner { max-width: 800px; margin: 0 auto; }

.editor-title-input {
  width: 100%; border: none; outline: none;
  background: transparent; font-family: var(--font);
  font-size: 26px; font-weight: 700; color: var(--text);
  margin-bottom: 14px; letter-spacing: -.02em;
}
.editor-title-input::placeholder { color: var(--border); }

.editor-meta-row {
  display: flex; align-items: center; gap: 8px;
  margin-bottom: 10px;
}
.meta-label { display: flex; align-items: center; color: var(--text3); }
.meta-label svg { width: 16px; height: 16px; fill: currentColor; }

.pin-toggle {
  display: inline-flex; align-items: center; gap: 5px;
  padding: 5px 12px; border-radius: 20px;
  border: 1.5px solid var(--border);
  font-size: 13px; color: var(--text2);
  cursor: pointer; transition: all .15s;
  user-select: none;
}
.pin-toggle svg { width: 14px; height: 14px; fill: currentColor; }
.pin-toggle.active { border-color: var(--pin); color: var(--pin); background: #fef3c7; }
.pin-toggle:hover { border-color: var(--accent); }

/* Tabs */
.editor-tabs {
  display: flex; gap: 4px;
  margin-bottom: 12px;
  border-bottom: 1px solid var(--border);
  padding-bottom: 0;
}
.editor-tabs button {
  padding: 7px 16px; border: none; background: none;
  font-size: 13px; font-family: var(--font);
  color: var(--text3); cursor: pointer;
  border-bottom: 2px solid transparent;
  margin-bottom: -1px; transition: color .15s, border-color .15s;
}
.editor-tabs button.active { color: var(--accent); border-bottom-color: var(--accent); font-weight: 600; }

/* Textarea */
.textarea-wrap { margin-bottom: 16px; }
.editor-textarea {
  width: 100%; min-height: 360px;
  border: 1.5px solid var(--border);
  border-radius: 12px;
  padding: 16px;
  font-family: 'Fira Code', 'Cascadia Code', monospace;
  font-size: 14px; line-height: 1.8;
  color: var(--text); background: var(--bg2);
  resize: vertical; outline: none;
  transition: border-color .15s;
}
.editor-textarea:focus { border-color: var(--accent); }
.editor-textarea::placeholder { color: var(--text3); }

/* Preview */
.preview-wrap {
  min-height: 360px;
  border: 1.5px solid var(--border);
  border-radius: 12px;
  padding: 16px 20px;
  background: var(--bg2);
  margin-bottom: 16px;
}

.editor-bottom-meta {
  margin-top: 20px;
  font-size: 12px; color: var(--text3);
  text-align: right;
}

/* ===== Mobile ===== */
@media (max-width: 768px) {
  #editor-body { padding: 16px 14px max(80px, calc(var(--safe-bottom, 0px) + 60px)); }
  .editor-title-input { font-size: 20px; }
  .editor-textarea { min-height: 260px; font-size: 13px; }
  .topbar-btn.accent span, .topbar-btn.danger span { display: none; }
  .topbar-btn.accent, .topbar-btn.danger { padding: 8px; }
}
</style>
