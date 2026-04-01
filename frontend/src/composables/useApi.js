// composables/useApi.js

export function getCsrfToken() {
  return document.cookie.split(';').map(c => c.trim())
    .find(c => c.startsWith('csrf_token='))?.split('=')[1] || ''
}

export const api = {
  async get(path) {
    const r = await fetch('/api/v1' + path)
    if (r.status === 401) { location.href = '/login'; throw new Error('未授权') }
    if (!r.ok) throw new Error(await r.text())
    return r.json()
  },
  async post(path, body) {
    const r = await fetch('/api/v1' + path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': getCsrfToken() },
      body: JSON.stringify(body),
    })
    if (r.status === 401) { location.href = '/login'; throw new Error('未授权') }
    if (!r.ok) throw new Error(await r.text())
    return r.json()
  },
  async put(path, body) {
    const r = await fetch('/api/v1' + path, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': getCsrfToken() },
      body: JSON.stringify(body),
    })
    if (r.status === 401) { location.href = '/login'; throw new Error('未授权') }
    if (!r.ok) throw new Error(await r.text())
    return r.json()
  },
  async del(path) {
    const r = await fetch('/api/v1' + path, {
      method: 'DELETE',
      headers: { 'X-CSRF-Token': getCsrfToken() },
    })
    if (r.status === 401) { location.href = '/login'; throw new Error('未授权') }
    if (!r.ok) throw new Error(await r.text())
  },
  async uploadFile(noteId, file) {
    const fd = new FormData()
    fd.append('file', file)
    const r = await fetch(`/api/v1/notes/${noteId}/files`, {
      method: 'POST',
      headers: { 'X-CSRF-Token': getCsrfToken() },
      body: fd,
    })
    if (!r.ok) throw new Error(await r.text())
    return r.json()
  },
  async deleteFile(noteId, filename) {
    const r = await fetch(`/api/v1/notes/${noteId}/files/${encodeURIComponent(filename)}`, {
      method: 'DELETE',
      headers: { 'X-CSRF-Token': getCsrfToken() },
    })
    if (!r.ok) throw new Error(await r.text())
  },
}

export async function checkAuth() {
  try {
    const res = await fetch('/api/auth/status')
    const data = await res.json()
    if (data.protected && !data.loggedIn) {
      location.href = '/login'
    }
    return data
  } catch (_) {
    return {}
  }
}
