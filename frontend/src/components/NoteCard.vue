<template>
  <div
    class="note-card"
    :class="{ pinned: note.pinned }"
    :data-id="note.id"
    @click="$router.push(`/notes/${note.id}`)"
  >
    <div class="note-meta">
      <span v-if="note.pinned" class="pin-badge">📌</span>
      <span>{{ formatDate(note.created_at) }}</span>
      <span v-if="hasAttach" class="att-badge" title="有附件">
        <svg viewBox="0 0 24 24" width="12" height="12">
          <path d="M16.5 6v11.5c0 2.21-1.79 4-4 4s-4-1.79-4-4V5c0-1.38 1.12-2.5 2.5-2.5s2.5 1.12 2.5 2.5v10.5c0 .55-.45 1-1 1s-1-.45-1-1V6H10v9.5c0 1.38 1.12 2.5 2.5 2.5s2.5-1.12 2.5-2.5V5c0-2.21-1.79-4-4-4S7 2.79 7 5v12.5c0 3.04 2.46 5.5 5.5 5.5s5.5-2.46 5.5-5.5V6h-1.5z" fill="currentColor"/>
        </svg>
      </span>
    </div>

    <div v-if="note.title" class="note-card-title">{{ note.title }}</div>

    <div class="note-content" v-html="renderedContent"></div>

    <div v-if="thumbs.length" class="note-images">
      <img
        v-for="f in thumbs.slice(0, 4)"
        :key="f"
        :src="`/uploads/${f}`"
        @click.stop="$emit('lightbox', `/uploads/${f}`)"
        loading="lazy"
      />
    </div>

    <div v-if="note.tags && note.tags.length" class="note-tags">
      <span
        v-for="t in note.tags"
        :key="t"
        class="tag-badge"
        @click.stop="$emit('filterTag', t)"
      >#{{ t }}</span>
    </div>

    <div class="note-card-hover-hint">点击查看</div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { parseMarkdown } from '../composables/useMarkdown.js'

const props = defineProps({ note: Object })
defineEmits(['filterTag', 'lightbox'])

const renderedContent = computed(() => parseMarkdown(props.note.content || ''))

const thumbs = computed(() => {
  const imgs = []
  ;(props.note.images || []).forEach(f => imgs.push(f))
  ;(props.note.files || []).filter(f => f.mime?.startsWith('image/')).forEach(f => imgs.push(f.filename))
  return imgs
})

const hasAttach = computed(() =>
  (props.note.files || []).some(f => f.mime && !f.mime.startsWith('image/')))

function formatDate(s) {
  return new Date(s).toLocaleString('zh-CN', {
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit',
  })
}
</script>
