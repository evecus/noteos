<template>
  <div class="login-wrap">
    <div class="bg-shapes" aria-hidden="true">
      <div class="shape shape-1"></div>
      <div class="shape shape-2"></div>
      <div class="shape shape-3"></div>
    </div>
    <div class="login-card">
      <div class="login-logo">
        <div class="logo-icon-wrap">
          <svg viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <linearGradient id="lg" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stop-color="#5B63D3"/>
                <stop offset="100%" stop-color="#7C4FC5"/>
              </linearGradient>
              <clipPath id="cp"><rect width="512" height="512" rx="112"/></clipPath>
            </defs>
            <g clip-path="url(#cp)">
              <rect width="512" height="512" fill="url(#lg)"/>
              <rect x="100" y="88" width="308" height="342" rx="28" fill="white" fill-opacity=".96"/>
              <polygon points="306,88 408,88 408,168" fill="#DDD8FF" fill-opacity=".55"/>
              <rect x="138" y="198" width="176" height="11" rx="5.5" fill="#5C63D3" fill-opacity=".55"/>
              <rect x="138" y="224" width="228" height="8" rx="4" fill="#5C63D3" fill-opacity=".28"/>
              <rect x="138" y="246" width="196" height="8" rx="4" fill="#5C63D3" fill-opacity=".25"/>
              <rect x="138" y="268" width="214" height="8" rx="4" fill="#5C63D3" fill-opacity=".22"/>
              <g transform="translate(256,256) rotate(-38) translate(-256,-256)">
                <rect x="245" y="148" width="22" height="18" rx="4" fill="#D8D8D8"/>
                <rect x="249" y="153" width="14" height="8" rx="2" fill="#FF8080" fill-opacity=".75"/>
                <rect x="245" y="166" width="22" height="122" rx="3" fill="#FFD166"/>
                <polygon points="245,288 267,288 256,324" fill="#F0A742"/>
                <polygon points="250,316 262,316 256,332" fill="#2A2A2A"/>
              </g>
            </g>
          </svg>
        </div>
        <span class="logo-text">NoteOS</span>
      </div>
      <h1 class="login-title">欢迎回来</h1>
      <p class="login-sub">请输入密码以继续</p>
      <form class="login-form" @submit.prevent="doLogin">
        <div class="field-wrap" :class="{ error: errorMsg }">
          <svg class="field-icon" viewBox="0 0 24 24">
            <path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z"/>
          </svg>
          <input
            ref="pwInput"
            v-model="password"
            :type="showPw ? 'text' : 'password'"
            class="field-input"
            placeholder="输入密码"
            autocomplete="current-password"
            autofocus
          />
          <button type="button" class="field-toggle" @click="showPw = !showPw">
            <svg v-if="!showPw" viewBox="0 0 24 24"><path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/></svg>
            <svg v-else viewBox="0 0 24 24"><path d="M12 7c2.76 0 5 2.24 5 5 0 .65-.13 1.26-.36 1.83l2.92 2.92c1.51-1.26 2.7-2.89 3.43-4.75-1.73-4.39-6-7.5-11-7.5-1.4 0-2.74.25-3.98.7l2.16 2.16C10.74 7.13 11.35 7 12 7zM2 4.27l2.28 2.28.46.46C3.08 8.3 1.78 10.02 1 12c1.73 4.39 6 7.5 11 7.5 1.55 0 3.03-.3 4.38-.84l.42.42L19.73 22 21 20.73 3.27 3 2 4.27zM7.53 9.8l1.55 1.55c-.05.21-.08.43-.08.65 0 1.66 1.34 3 3 3 .22 0 .44-.03.65-.08l1.55 1.55c-.67.33-1.41.53-2.2.53-2.76 0-5-2.24-5-5 0-.79.2-1.53.53-2.2zm4.31-.78l3.15 3.15.02-.16c0-1.66-1.34-3-3-3l-.17.01z"/></svg>
          </button>
        </div>
        <div v-if="errorMsg" class="error-msg">{{ errorMsg }}</div>
        <button type="submit" class="login-btn" :disabled="loading">
          <span v-if="!loading">登录</span>
          <span v-else class="spinner"></span>
        </button>
      </form>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()
const password = ref('')
const showPw = ref(false)
const errorMsg = ref('')
const loading = ref(false)

async function doLogin() {
  if (!password.value) return
  loading.value = true
  errorMsg.value = ''
  try {
    const r = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: password.value }),
    })
    if (r.ok) {
      router.replace('/')
    } else {
      const data = await r.json().catch(() => ({}))
      errorMsg.value = data.error || '密码错误'
      password.value = ''
    }
  } catch {
    errorMsg.value = '网络错误，请重试'
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.login-wrap {
  min-height: 100vh;
  min-height: 100dvh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--bg);
  padding: 20px;
  position: relative;
  overflow: hidden;
}
.bg-shapes { position: absolute; inset: 0; pointer-events: none; }
.shape {
  position: absolute;
  border-radius: 50%;
  filter: blur(60px);
  opacity: .15;
}
.shape-1 { width: 400px; height: 400px; background: #5B63D3; top: -100px; right: -100px; }
.shape-2 { width: 300px; height: 300px; background: #7C4FC5; bottom: -80px; left: -80px; }
.shape-3 { width: 200px; height: 200px; background: #5B63D3; top: 40%; left: 30%; }
.login-card {
  background: var(--bg2);
  border: 1px solid var(--border);
  border-radius: 20px;
  padding: 40px 36px;
  width: 100%;
  max-width: 380px;
  box-shadow: var(--shadow-md);
  position: relative;
  z-index: 1;
}
.login-logo {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 24px;
}
.logo-icon-wrap svg { width: 40px; height: 40px; border-radius: 10px; display: block; }
.logo-text { font-size: 22px; font-weight: 800; color: var(--accent); letter-spacing: -.02em; }
.login-title { font-size: 22px; font-weight: 700; color: var(--text); margin-bottom: 6px; }
.login-sub { font-size: 14px; color: var(--text3); margin-bottom: 28px; }
.login-form { display: flex; flex-direction: column; gap: 14px; }
.field-wrap {
  display: flex;
  align-items: center;
  gap: 8px;
  background: var(--bg3);
  border: 1.5px solid var(--border);
  border-radius: 12px;
  padding: 0 12px;
  transition: border-color .15s;
}
.field-wrap:focus-within { border-color: var(--accent); }
.field-wrap.error { border-color: var(--danger); }
.field-icon { width: 18px; height: 18px; fill: var(--text3); flex-shrink: 0; }
.field-input {
  flex: 1;
  border: none; outline: none;
  background: transparent;
  font-size: 15px;
  font-family: var(--font);
  color: var(--text);
  padding: 13px 0;
}
.field-toggle {
  background: none; border: none; cursor: pointer;
  color: var(--text3); display: flex; align-items: center; padding: 4px;
}
.field-toggle svg { width: 18px; height: 18px; fill: currentColor; }
.error-msg { font-size: 13px; color: var(--danger); }
.login-btn {
  padding: 13px;
  border: none;
  border-radius: 12px;
  background: var(--accent);
  color: #fff;
  font-size: 15px;
  font-weight: 600;
  font-family: var(--font);
  cursor: pointer;
  transition: opacity .15s, transform .12s;
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 48px;
}
.login-btn:hover:not(:disabled) { opacity: .9; transform: translateY(-1px); }
.login-btn:disabled { opacity: .6; cursor: not-allowed; }
.spinner {
  width: 18px; height: 18px;
  border: 2px solid rgba(255,255,255,.4);
  border-top-color: #fff;
  border-radius: 50%;
  animation: spin .7s linear infinite;
  display: inline-block;
}
@keyframes spin { to { transform: rotate(360deg); } }
</style>
