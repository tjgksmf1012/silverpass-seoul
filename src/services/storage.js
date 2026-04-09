const PROFILE_KEY = 'silverpass_profile'
const HISTORY_KEY = 'silverpass_history'
const VISITED_KEY = 'silverpass_visited'

export function isFirstVisit() {
  return !localStorage.getItem(VISITED_KEY)
}
export function markVisited() {
  localStorage.setItem(VISITED_KEY, '1')
}

export const DEFAULT_PROFILE = {
  name: '',
  guardianPhone: '',
  district: '종로구',
  maxWalkMin: 20,
  allowStairs: false,
  mobilityAid: false,
  favorites: [
    { id: 1, name: '복지관', icon: '🏛️', address: '' },
    { id: 2, name: '병원', icon: '🏥', address: '' },
    { id: 3, name: '약국', icon: '💊', address: '' },
    { id: 4, name: '집', icon: '🏠', address: '' },
  ],
}

export function getProfile() {
  try {
    const raw = localStorage.getItem(PROFILE_KEY)
    return raw ? { ...DEFAULT_PROFILE, ...JSON.parse(raw) } : DEFAULT_PROFILE
  } catch {
    return DEFAULT_PROFILE
  }
}

export function saveProfile(profile) {
  localStorage.setItem(PROFILE_KEY, JSON.stringify(profile))
}

export function addHistory(entry) {
  try {
    const history = getHistory()
    history.unshift({ ...entry, timestamp: Date.now() })
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history.slice(0, 20)))
  } catch {}
}

export function getHistory() {
  try {
    return JSON.parse(localStorage.getItem(HISTORY_KEY) ?? '[]')
  } catch {
    return []
  }
}
