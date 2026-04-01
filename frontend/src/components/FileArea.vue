<template>
  <div class="file-area" v-if="allImages.length || allOthers.length || pendingFiles.length">
    <div v-if="allImages.length" class="edit-images-grid">
      <div v-for="f in allImages" :key="f.filename" class="edit-img-wrap">
        <img :src="`/uploads/${f.filename}`" @click="$emit('lightbox', `/uploads/${f.filename}`)" loading="lazy" />
        <button class="img-remove" @click="$emit('deleteFile', f.filename)">×</button>
      </div>
    </div>
    <div v-if="pendingImages.length" class="edit-images-grid">
      <div v-for="(f, i) in pendingImages" :key="i" class="edit-img-wrap">
        <img :src="objectUrl(f)" loading="lazy" />
        <button class="img-remove" @click="$emit('removePending', pendingFiles.indexOf(f))">×</button>
      </div>
    </div>
    <div v-if="allOthers.length" class="edit-att-list">
      <div v-for="f in allOthers" :key="f.filename" class="edit-att-row">
        <div class="att-icon-sm" v-html="getFileIcon(f.mime)"></div>
        <div class="att-meta">
          <div class="att-name">{{ f.orig_name }}</div>
          <div class="att-size">{{ formatSize(f.size) }}</div>
        </div>
        <a class="att-action" :href="`/uploads/${f.filename}`" target="_blank" rel="noopener" title="预览">
          <svg viewBox="0 0 24 24"><path d="M19 19H5V5h7V3H5c-1.11 0-2 .9-2 2v14c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2v-7h-2v7zM14 3v2h3.59l-9.83 9.83 1.41 1.41L19 6.41V10h2V3h-7z"/></svg>
        </a>
        <button class="att-del" @click="$emit('deleteFile', f.filename)" title="删除">
          <svg viewBox="0 0 24 24"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>
        </button>
      </div>
    </div>
    <div v-if="pendingOthers.length" class="edit-att-list">
      <div v-for="(f, i) in pendingOthers" :key="i" class="edit-att-row">
        <div class="att-icon-sm" v-html="getFileIcon(f.type)"></div>
        <div class="att-meta">
          <div class="att-name">{{ f.name }}</div>
          <div class="att-size">{{ formatSize(f.size) }}</div>
        </div>
        <button class="att-del" @click="$emit('removePending', pendingFiles.indexOf(f))" title="删除">
          <svg viewBox="0 0 24 24"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { formatSize, getFileIcon } from '../composables/useFiles.js'

const props = defineProps({
  files: { type: Array, default: () => [] },
  images: { type: Array, default: () => [] }, // legacy
  pendingFiles: { type: Array, default: () => [] },
})

defineEmits(['deleteFile', 'removePending', 'lightbox'])

// merge legacy images into file-like objects
const allImages = computed(() => [
  ...props.images.map(img => ({ filename: img, orig_name: img, size: 0, mime: 'image/jpeg' })),
  ...(props.files || []).filter(f => f.mime?.startsWith('image/')),
])
const allOthers = computed(() =>
  (props.files || []).filter(f => f.mime && !f.mime.startsWith('image/')))

const pendingImages = computed(() => props.pendingFiles.filter(f => f.type.startsWith('image/')))
const pendingOthers = computed(() => props.pendingFiles.filter(f => !f.type.startsWith('image/')))

function objectUrl(f) {
  return URL.createObjectURL(f)
}
</script>
