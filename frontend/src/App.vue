<template>
  <router-view />
</template>

<script setup>
import { onMounted } from 'vue'

onMounted(() => {
  if (localStorage.getItem('noteos-dark') === '1') {
    document.body.classList.add('dark')
  }
})
</script>
