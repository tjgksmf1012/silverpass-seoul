const KAKAO_KEY = import.meta.env.VITE_KAKAO_MAP_KEY

let sdkPromise = null
function loadSDK() {
  if (sdkPromise) return sdkPromise
  sdkPromise = new Promise((resolve, reject) => {
    if (window.kakao?.maps?.services) { resolve(); return }
    const s = document.createElement('script')
    s.src = `//dapi.kakao.com/v2/maps/sdk.js?appkey=${KAKAO_KEY}&libraries=services&autoload=false`
    s.onload = () => window.kakao.maps.load(resolve)
    s.onerror = (e) => { sdkPromise = null; console.error('Kakao Maps SDK 로드 실패', e); reject(e) }
    document.head.appendChild(s)
  })
  return sdkPromise
}

export async function searchPlaces(query, options = {}) {
  if (!KAKAO_KEY) return []
  await loadSDK()
  return new Promise(resolve => {
    const ps = new window.kakao.maps.services.Places()
    const lat = Number(options.location?.lat)
    const lng = Number(options.location?.lng)
    const hasLocation = Number.isFinite(lat) && Number.isFinite(lng)
    const searchOptions = hasLocation
      ? { location: new window.kakao.maps.LatLng(lat, lng), radius: options.radius || 5000, sort: window.kakao.maps.services.SortBy.DISTANCE }
      : { location: new window.kakao.maps.LatLng(37.5665, 126.9780), radius: 20000 }

    ps.keywordSearch(query, (data, status) => {
      if (status !== window.kakao.maps.services.Status.OK) { resolve([]); return }
      resolve(data.slice(0, 5).map(p => ({
        name: p.place_name,
        address: p.road_address_name || p.address_name,
        category: p.category_name?.split(' > ').pop() || '',
        phone: p.phone,
        lat: parseFloat(p.y),
        lng: parseFloat(p.x),
      })))
    }, searchOptions)
  })
}
