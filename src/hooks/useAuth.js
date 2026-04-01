import { useState } from 'react'

const KEY_CREDS   = 'dash_credentials'
const KEY_SESSION = 'dash_session'

function loadCreds() {
  try { return JSON.parse(localStorage.getItem(KEY_CREDS)) } catch { return null }
}

function loadSession() {
  try { return JSON.parse(localStorage.getItem(KEY_SESSION)) } catch { return null }
}

export function useAuth() {
  const [authenticated, setAuthenticated] = useState(() => {
    const creds   = loadCreds()
    const session = loadSession()
    return !!(creds && session?.username === creds.username)
  })

  const hasCredentials = !!loadCreds()

  function login(username, password) {
    const creds = loadCreds()
    if (!creds) return 'Nenhum acesso configurado.'
    if (creds.username !== username || creds.password !== password) return 'Usuário ou senha incorretos.'
    localStorage.setItem(KEY_SESSION, JSON.stringify({ username }))
    setAuthenticated(true)
    return null
  }

  function setupCredentials(username, password) {
    if (!username || !password) return 'Preencha usuário e senha.'
    if (password.length < 4) return 'Senha deve ter ao menos 4 caracteres.'
    localStorage.setItem(KEY_CREDS, JSON.stringify({ username, password }))
    localStorage.setItem(KEY_SESSION, JSON.stringify({ username }))
    setAuthenticated(true)
    return null
  }

  function logout() {
    localStorage.removeItem(KEY_SESSION)
    setAuthenticated(false)
  }

  return { authenticated, hasCredentials, login, setupCredentials, logout }
}
