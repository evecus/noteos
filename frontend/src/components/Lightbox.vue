<template>
  <Teleport to="body">
    <div v-if="src" class="lightbox" @click="src = ''" @keydown.esc="src = ''">
      <img :src="src" />
    </div>
  </Teleport>
</template>

<script setup>
import { ref } from 'vue'

const src = ref('')

function open(imgSrc) {
  src.value = imgSrc
}

defineExpose({ open })
</script>
