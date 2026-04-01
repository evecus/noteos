<template>
  <div class="toast" :class="{ show: visible }">{{ message }}</div>
</template>

<script setup>
import { useToast } from '../composables/useToast.js'
const { message, visible } = useToast()
</script>
