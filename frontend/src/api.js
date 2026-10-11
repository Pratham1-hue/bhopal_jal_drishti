import axios from 'axios'

const http = axios.create({ baseURL: import.meta.env.VITE_API_BASE || '', timeout: 20000 })
const PREFIX = 'vgw-cache:'

export function readCache(url) {
  try {
    const raw = localStorage.getItem(PREFIX + url)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

// GET with an offline fallback: the last good response is kept in localStorage,
// so an officer at a ghat with weak signal still sees the data.
export async function cachedGet(url) {
  try {
    const { data } = await http.get(url)
    try {
      localStorage.setItem(PREFIX + url, JSON.stringify({ t: Date.now(), data }))
    } catch {
      /* storage full â€” ignore */
    }
    return { ...data, __cachedAt: null }
  } catch (err) {
    const hit = readCache(url)
    if (hit) return { ...hit.data, __cachedAt: hit.t }
    throw err
  }
}

export const fetchRanked = () => cachedGet('/api/ghats/ranked')
export const fetchGhat = (id) => cachedGet(`/api/ghats/${id}`)
export const fetchAnomalies = () => cachedGet('/api/anomalies')
export const fetchMatrix = () => cachedGet('/api/cpcb/matrix')
export const fetchPlan = () => cachedGet('/api/plan')
export const fetchDataSummary = () => cachedGet('/api/data/summary')
export const fetchGuidelines = () => cachedGet('/api/guidelines')
export const fetchNotifications = () => cachedGet('/api/notifications')

export async function refreshData() {
  const { data } = await http.post('/api/refresh')
  return data
}

// payload: { site_id, issues?, manager?, note?, language?, instruction?, previous? }
export async function generateBrief(payload) {
  const body = typeof payload === 'string' ? { site_id: payload } : payload
  const { data } = await http.post('/api/brief/generate', body, { timeout: 180000 })
  return data
}
