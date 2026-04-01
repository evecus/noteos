<template>
  <div id="page">
    <div id="topbar">
      <button class="topbar-btn" @click="$router.push('/')">
        <svg viewBox="0 0 24 24"><path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/></svg>
        <span>返回</span>
      </button>
      <div class="topbar-title">账号设置</div>
      <div style="width:80px"></div>
    </div>

    <div id="content">
      <div id="content-inner">
        <div class="section-card">
          <h2 class="section-title">修改账号信息</h2>
          <p class="section-desc">修改用户名或密码需要先验证当前密码。</p>

          <div class="field-group">
            <label class="field-label">当前用户名</label>
            <div class="field-static">{{ currentUsername || '加载中…' }}</div>
          </div>

          <div class="field-group">
            <label class="field-label">新用户名 <span class="optional">（不修改留空）</span></label>
            <input
              v-model="newUsername"
              class="field-input"
              type="text"
              placeholder="输入新用户名"
              autocomplete="username"
            />
          </div>

          <div class="field-group">
            <label class="field-label">新密码 <span class="optional">（不修改留空）</span></label>
            <div class="pw-wrap">
              <input
                v-model="newPassword"
                :type="showNew ? 'text' : 'password'"
                class="field-input"
                placeholder="输入新密码"
                autocomplete="new-password"
              />
              <button type="button" class="pw-toggle" @click="showNew = !showNew">
                <svg v-if="!showNew" viewBox="0 0 24 24"><path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/></svg>
                <svg v-else viewBox="0 0 24 24"><path d="M12 7c2.76 0 5 2.24 5 5 0 .65-.13 1.26-.36 1.83l2.92 2.92c1.51-1.26 2.7-2.89 3.43-4.75-1.73-4.39-6-7.5-11-7.5-1.4 0-2.74.25-3.98.7l2.16 2.16C10.74 7.13 11.35 7 12 7zM2 4.27l2.28 2.28.46.46C3.08 8.3 1.78 10.02 1 12c1.73 4.39 6 7.5 11 7.5 1.55 0 3.03-.3 4.38-.84l.42.42L19.73 22 21 20.73 3.27 3 2 4.27zM7.53 9.8l1.55 1.55c-.05.21-.08.43-.08.65 0 1.66 1.34 3 3 3 .22 0 .44-.03.65-.08l1.55 1.55c-.67.33-1.41.53-2.2.53-2.76 0-5-2.24-5-5 0-.79.2-1.53.53-2.2zm4.31-.78l3.15 3.15.02-.16c0-1.66-1.34-3-3-3l-.17.01z"/></svg>
              </button>
            </div>
          </div>

          <div class="field-group">
            <label class="field-label">当前密码 <span class="required">*</span></label>
            <div class="pw-wrap">
              <input
                v-model="currentPassword"
                :type="showCurrent ? 'text' : 'password'"
                class="field-input"
                :class="{ error: errorMsg }"
                placeholder="输入当前密码以确认修改"
                autocomplete="current-password"
                @keydown.enter="save"
              />
              <button type="button" class="pw-toggle" @click="showCurrent = !showCurrent">
                <svg v-if="!showCurrent" viewBox="0 0 24 24"><path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/></svg>
                <svg v-else viewBox="0 0 24 24"><path d="M12 7c2.76 0 5 2.24 5 5 0 .65-.13 1.26-.36 1.83l2.92 2.92c1.51-1.26 2.7-2.89 3.43-4.75-1.73-4.39-6-7.5-11-7.5-1.4 0-2.74.25-3.98.7l2.16 2.16C10.74 7.13 11.35 7 12 7zM2 4.27l2.28 2.28.46.46C3.08 8.3 1.78 10.02 1 12c1.73 4.39 6 7.5 11 7.5 1.55 0 3.03-.3 4.38-.84l.42.42L19.73 22 21 20.73 3.27 3 2 4.27zM7.53 9.8l1.55 1.55c-.05.21-.08.43-.08.65 0 1.66 1.34 3 3 3 .22 0 .44-.03.65-.08l1.55 1.55c-.67.33-1.41.53-2.2.53-2.76 0-5-2.24-5-5 0-.79.2-1.53.53-2.2zm4.31-.78l3.15 3.15.02-.16c0-1.66-1.34-3-3-3l-.17.01z"/></svg>
              </button>
            </div>
          </div>

          <div v-if="errorMsg" class="error-msg">{{ errorMsg }}</div>
          <div v-if="successMsg" class="success-msg">{{ successMsg }}</div>

          <button class="save-btn" @click="save" :disabled="saving">
            {{ saving ? '保存中…' : '保存修改' }}
          </button>
        </div>

        <div class="section-card danger-zone">
          <h2 class="section-title danger">退出登录</h2>
          <p class="section-desc">退出后需要重新登录才能访问。</p>
          <button class="logout-btn" @click="logout">退出登录</button>
        </div>
      </div>
    </div>

    <ToastMsg />
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { getCsrfToken } from '../composables/useApi.js'
import { useToast } from '../composables/useToast.js'
import ToastMsg from '../components/ToastMsg.vue'

const router = useRouter()
const { toast } = useToast()

const currentUsername = ref('')
const newUsername = ref('')
const newPassword = ref('')
const currentPassword = ref('')
const showNew = ref(false)
const showCurrent = ref(false)
const errorMsg = ref('')
const successMsg = ref('')
const saving = ref(false)

onMounted(async () => {
  if (localStorage.getItem('noteos-dark') === '1') document.body.classList.add('dark')
  try {
    const r = await fetch('/api/settings/account', { credentials: 'include' })
    if (r.status === 401) { location.href = '/login'; return }
    const data = await r.json()
    currentUsername.value = data.username
  } catch {
    toast('加载失败')
  }
})

async function save() {
  errorMsg.value = ''
  successMsg.value = ''
  if (!currentPassword.value) { errorMsg.value = '请输入当前密码'; return }
  if (!newUsername.value && !newPassword.value) { errorMsg.value = '请至少修改用户名或密码'; return }

  saving.value = true
  try {
    const r = await fetch('/api/settings/account', {
      method: 'PUT',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': getCsrfToken() },
      body: JSON.stringify({
        current_password: currentPassword.value,
        new_username: newUsername.value,
        new_password: newPassword.value,
      }),
    })
    const data = await r.json()
    if (!r.ok) {
      errorMsg.value = data.error || '修改失败'
      return
    }
    successMsg.value = '修改成功！'
    if (newUsername.value) currentUsername.value = newUsername.value
    newUsername.value = ''
    newPassword.value = ''
    currentPassword.value = ''
    toast('✅ 账号信息已更新')
  } catch {
    errorMsg.value = '网络错误，请重试'
  } finally {
    saving.value = false
  }
}

async function logout() {
  await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' })
  location.href = '/login'
}
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
  flex-shrink: 0;
}
.topbar-title {
  flex: 1; font-size: 15px; font-weight: 600; color: var(--text2);
  text-align: center;
}
#content {
  flex: 1; overflow-y: auto;
  padding: 32px max(20px, calc((100vw - 600px) / 2)) 60px;
}
#content-inner { max-width: 600px; margin: 0 auto; display: flex; flex-direction: column; gap: 20px; }

.section-card {
  background: var(--bg2);
  border: 1px solid var(--border);
  border-radius: 16px;
  padding: 28px;
}
.section-title {
  font-size: 16px; font-weight: 700; color: var(--text);
  margin-bottom: 6px;
}
.section-title.danger { color: var(--danger); }
.section-desc { font-size: 13px; color: var(--text3); margin-bottom: 24px; }

.field-group { margin-bottom: 18px; }
.field-label {
  display: block; font-size: 13px; font-weight: 600;
  color: var(--text2); margin-bottom: 7px;
}
.optional { font-weight: 400; color: var(--text3); }
.required { color: var(--danger); }
.field-static {
  font-size: 15px; font-weight: 600; color: var(--accent);
  padding: 10px 0;
}
.field-input {
  width: 100%; padding: 11px 14px;
  border: 1.5px solid var(--border); border-radius: 10px;
  background: var(--bg3); color: var(--text);
  font-size: 14px; font-family: var(--font);
  outline: none; transition: border-color .15s;
}
.field-input:focus { border-color: var(--accent); }
.field-input.error { border-color: var(--danger); }

.pw-wrap { position: relative; }
.pw-wrap .field-input { padding-right: 44px; }
.pw-toggle {
  position: absolute; right: 10px; top: 50%; transform: translateY(-50%);
  background: none; border: none; cursor: pointer;
  color: var(--text3); display: flex; align-items: center; padding: 4px;
}
.pw-toggle svg { width: 18px; height: 18px; fill: currentColor; }

.error-msg { font-size: 13px; color: var(--danger); margin-bottom: 14px; }
.success-msg { font-size: 13px; color: #16a34a; margin-bottom: 14px; }

.save-btn {
  width: 100%; padding: 12px;
  border: none; border-radius: 10px;
  background: var(--accent); color: #fff;
  font-size: 15px; font-weight: 600; font-family: var(--font);
  cursor: pointer; transition: opacity .15s;
}
.save-btn:hover:not(:disabled) { opacity: .88; }
.save-btn:disabled { opacity: .6; cursor: not-allowed; }

.danger-zone { border-color: #fecaca; }
.logout-btn {
  padding: 10px 20px;
  border: 1.5px solid var(--danger); border-radius: 10px;
  background: transparent; color: var(--danger);
  font-size: 14px; font-weight: 600; font-family: var(--font);
  cursor: pointer; transition: background .15s, color .15s;
}
.logout-btn:hover { background: var(--danger); color: #fff; }

@media (max-width: 768px) {
  #content { padding: 20px 16px 60px; }
  .section-card { padding: 20px; }
}
</style>
