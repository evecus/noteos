<template>
  <div class="tag-editor-row">
    <div class="tag-chips">
      <span v-for="(t, i) in tags" :key="t" class="chip">
        #{{ t }}<span class="remove" @click="remove(i)">×</span>
      </span>
    </div>
    <input
      v-model="input"
      class="tag-input"
      placeholder="添加标签，回车确认"
      @keydown="onKey"
    />
  </div>
</template>

<script setup>
import { ref } from 'vue'

const props = defineProps({ tags: Array })
const emit = defineEmits(['update:tags'])
const input = ref('')

function onKey(e) {
  if (e.key === 'Enter' || e.key === ',') {
    e.preventDefault()
    const val = input.value.trim().replace(/^#/, '')
    if (val && !props.tags.includes(val)) {
      emit('update:tags', [...props.tags, val])
    }
    input.value = ''
  }
}

function remove(i) {
  const next = [...props.tags]
  next.splice(i, 1)
  emit('update:tags', next)
}
</script>

<style scoped>
.tag-editor-row {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  align-items: center;
  padding: 6px 0;
}
.tag-chips { display: flex; flex-wrap: wrap; gap: 5px; }
.tag-input {
  border: none;
  outline: none;
  background: transparent;
  font-family: var(--font);
  font-size: 13px;
  color: var(--text);
  min-width: 140px;
  flex: 1;
}
.tag-input::placeholder { color: var(--text3); }
</style>
