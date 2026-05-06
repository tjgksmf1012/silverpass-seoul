const KAKAO_KEY = import.meta.env.VITE_KAKAO_MAP_KEY

const KNOWN_SEOUL_PLACES = [
  { name: '서울역', address: '서울 중구 한강대로 405', category: '역', lat: 37.5546788, lng: 126.9706069 },
  { name: '광화문역', address: '서울 종로구 세종대로 지하 172', category: '역', lat: 37.571607, lng: 126.97691 },
  { name: '서울시청', address: '서울 중구 세종대로 110', category: '공공기관', lat: 37.5662952, lng: 126.9779451 },
  { name: '종로구청', address: '서울 종로구 종로1길 36', category: '공공기관', lat: 37.573505, lng: 126.978988 },
  { name: '경복궁', address: '서울 종로구 사직로 161', category: '문화', lat: 37.579617, lng: 126.977041 },
  { name: '강남역', address: '서울 강남구 강남대로 396', category: '역', lat: 37.497952, lng: 127.027619 },
  { name: '서울대학교병원', address: '서울 종로구 대학로 101', category: '병원', lat: 37.579776, lng: 126.998895 },
]

function normalizeText(text = '') {
  return String(text).replace(/\s+/g, '').toLowerCase()
}

export function searchKnownPlaces(query) {
  const q = normalizeText(query)
  if (!q) return []
  return KNOWN_SEOUL_PLACES
    .filter(place => normalizeText(place.name).includes(q) || normalizeText(place.address).includes(q) || q.includes(normalizeText(place.name)))
    .slice(0, 5)
}

export function findKnownSeoulPlace(query) {
  return searchKnownPlaces(query)[0] || null
}

let sdkPromise = null
function loadSDK() {
  if (sdkPromise) return sdkPromise
  sdkPromise = new Promise((resolve, reject) => {
    if (window.kakao?.maps?.services) { resolve(); return }
    const s = document.createElement('script')
    s.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${KAKAO_KEY}&libraries=services&autoload=false`
    s.onload = () => window.kakao.maps.load(resolve)
    s.onerror = (e) => { sdkPromise = null; reject(e) }
    document.head.appendChild(s)
  })
  return sdkPromise
}

export async function searchPlaces(query, options = {}) {
  const knownPlaces = searchKnownPlaces(query)
  if (!KAKAO_KEY) return knownPlaces
  try {
    await loadSDK()
  } catch {
    return knownPlaces
  }
  return new Promise(resolve => {
    const ps = new window.kakao.maps.services.Places()
    const lat = Number(options.location?.lat)
    const lng = Number(options.location?.lng)
    const hasLocation = Number.isFinite(lat) && Number.isFinite(lng)
    const searchOptions = hasLocation
      ? { location: new window.kakao.maps.LatLng(lat, lng), radius: options.radius || 5000, sort: window.kakao.maps.services.SortBy.DISTANCE }
      : { location: new window.kakao.maps.LatLng(37.5665, 126.9780), radius: 20000 }

    ps.keywordSearch(query, (data, status) => {
      if (status !== window.kakao.maps.services.Status.OK) { resolve(knownPlaces); return }
      const remotePlaces = data.slice(0, 5).map(p => ({
        name: p.place_name,
        address: p.road_address_name || p.address_name,
        category: p.category_name?.split(' > ').pop() || '',
        phone: p.phone,
        lat: parseFloat(p.y),
        lng: parseFloat(p.x),
      }))
      resolve(remotePlaces.length ? remotePlaces : knownPlaces)
    }, searchOptions)
  })
}
