import { createApp } from 'vue'
import { createRouter, createWebHistory } from 'vue-router'
import App from './App.vue'
import './style.css'

import HomeView from './views/HomeView.vue'
import EditorView from './views/EditorView.vue'
import NoteView from './views/NoteView.vue'
import LoginView from './views/LoginView.vue'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', component: HomeView },
    { path: '/editor', component: EditorView },
    { path: '/editor/:id', component: EditorView },
    { path: '/notes/:id', component: NoteView },
    { path: '/login', component: LoginView },
  ],
})

const app = createApp(App)
app.use(router)
app.mount('#app')
