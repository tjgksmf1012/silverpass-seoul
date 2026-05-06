const PROFILE_KEY = 'silverpass_profile'
const HISTORY_KEY = 'silverpass_history'
const VISITED_KEY = 'silverpass_visited'

export const DEFAULT_FAVORITES = [
  { id: 1, name: '복지관', icon: '🏛️', address: '', showOnHome: true, custom: false },
  { id: 2, name: '병원', icon: '🏥', address: '', showOnHome: true, custom: false },
  { id: 3, name: '약국', icon: '💊', address: '', showOnHome: true, custom: false },
  { id: 4, name: '집', icon: '🏠', address: '', showOnHome: true, custom: false },
]

export function isFirstVisit() {
  return !localStorage.getItem(VISITED_KEY)
}
export function markVisited() {
  localStorage.setItem(VISITED_KEY, '1')
}

export const DEFAULT_PROFILE = {
  name: '',
  guardianPhone: '',
  homeAddress: '',
  district: '종로구',
  maxWalkMin: 20,
  allowStairs: false,
  mobilityAid: false,
  preferLowFloorBus: false,
  preferElevator: true,
  avoidTransfers: true,
  needRestStops: false,
  slowPace: false,
  healthNotes: '',
  favorites: DEFAULT_FAVORITES,
}

function favoriteId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return `custom_${crypto.randomUUID()}`
  return `custom_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
}

export function createFavoritePlace(overrides = {}) {
  return {
    id: overrides.id || favoriteId(),
    name: overrides.name || '새 장소',
    icon: overrides.icon || '📍',
    address: overrides.address || '',
    showOnHome: overrides.showOnHome ?? true,
    custom: overrides.custom ?? true,
  }
}

function normalizeFavorite(place, fallback = {}) {
  const id = place?.id ?? fallback.id ?? favoriteId()
  return {
    id,
    name: place?.name || fallback.name || '새 장소',
    icon: place?.icon || fallback.icon || '📍',
    address: place?.address || '',
    showOnHome: place?.showOnHome ?? place?.visible ?? fallback.showOnHome ?? true,
    custom: place?.custom ?? fallback.custom ?? !DEFAULT_FAVORITES.some(f => String(f.id) === String(id)),
  }
}

export function normalizeFavorites(favorites = []) {
  const list = Array.isArray(favorites) ? favorites : []
  const used = new Set()
  const byId = new Map(list.map(place => [String(place?.id), place]))

  const defaults = DEFAULT_FAVORITES.map(slot => {
    const saved = byId.get(String(slot.id))
    used.add(String(slot.id))
    return normalizeFavorite(saved, slot)
  })

  const custom = list
    .filter(place => place && !used.has(String(place.id)))
    .map(place => normalizeFavorite(place, { custom: true }))
    .filter(place => place.name || place.address)

  return [...defaults, ...custom]
}

export function getProfile() {
  try {
    const raw = localStorage.getItem(PROFILE_KEY)
    if (!raw) return { ...DEFAULT_PROFILE, favorites: normalizeFavorites(DEFAULT_PROFILE.favorites) }
    const parsed = JSON.parse(raw)
    return { ...DEFAULT_PROFILE, ...parsed, favorites: normalizeFavorites(parsed.favorites) }
  } catch {
    return { ...DEFAULT_PROFILE, favorites: normalizeFavorites(DEFAULT_PROFILE.favorites) }
  }
}

export function saveProfile(profile) {
  localStorage.setItem(PROFILE_KEY, JSON.stringify({
    ...profile,
    favorites: normalizeFavorites(profile.favorites),
  }))
}

function normalizeDestination(destination) {
  if (typeof destination !== 'string') return destination
  return destination.replace(/^"(.+)" 바로 이동$/, '$1')
}

function normalizeHistoryEntry(entry) {
  return { ...entry, destination: normalizeDestination(entry?.destination) }
}

export function addHistory(entry) {
  try {
    const history = getHistory()
    history.unshift(normalizeHistoryEntry({ ...entry, timestamp: Date.now() }))
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history.slice(0, 20)))
  } catch {}
}

export function getHistory() {
  try {
    return JSON.parse(localStorage.getItem(HISTORY_KEY) ?? '[]').map(normalizeHistoryEntry)
  } catch {
    return []
  }
}
