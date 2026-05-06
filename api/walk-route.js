const SEOUL_BOUNDS = {
  minLat: 37.413,
  maxLat: 37.715,
  minLng: 126.734,
  maxLng: 127.269,
}

const MAX_DIRECT_DISTANCE_M = 3500
const TMAP_KEY = process.env.TMAP_API_KEY || process.env.SK_OPENAPI_APP_KEY || ''
const TMAP_SEARCH_OPTIONS = new Set(['0', '4', '10', '30'])

function numberOrNull(value) {
  const number = Number(value)
  return Number.isFinite(number) ? number : null
}

function isInSeoul(lat, lng) {
  return lat >= SEOUL_BOUNDS.minLat &&
    lat <= SEOUL_BOUNDS.maxLat &&
    lng >= SEOUL_BOUNDS.minLng &&
    lng <= SEOUL_BOUNDS.maxLng
}

function directDistance(start, end) {
  const radius = 6371000
  const toRad = degrees => degrees * Math.PI / 180
  const dLat = toRad(end.lat - start.lat)
  const dLng = toRad(end.lng - start.lng)
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(start.lat)) * Math.cos(toRad(end.lat)) * Math.sin(dLng / 2) ** 2
  return radius * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

function compactPoints(points) {
  return points.filter(point =>
    Number.isFinite(Number(point?.lat)) && Number.isFinite(Number(point?.lng))
  ).reduce((acc, point) => {
    const normalized = { lat: Number(point.lat), lng: Number(point.lng) }
    const prev = acc[acc.length - 1]
    if (!prev || Math.abs(prev.lat - normalized.lat) > 0.00001 || Math.abs(prev.lng - normalized.lng) > 0.00001) {
      acc.push(normalized)
    }
    return acc
  }, [])
}

function tmapIssueCode(status, payload) {
  const error = payload?.error || payload
  const code = error?.code || error?.id || status
  return `tmap_${status}_${String(code).replace(/[^a-zA-Z0-9_-]/g, '_')}`
}

function tmapSearchOption(value) {
  const option = String(value ?? '0')
  return TMAP_SEARCH_OPTIONS.has(option) ? option : '0'
}

function maneuverPoint(step) {
  const location = step?.maneuver?.location
  if (!Array.isArray(location) || location.length < 2) return null
  const [lng, lat] = location
  if (!Number.isFinite(Number(lat)) || !Number.isFinite(Number(lng))) return null
  return { lat: Number(lat), lng: Number(lng) }
}

function routeSteps(route) {
  return (route?.legs?.[0]?.steps || [])
    .filter(step => Number(step?.distance) > 0 || step?.maneuver?.type === 'arrive')
    .slice(0, 16)
    .map(step => ({
      name: step.name || '',
      distance: Math.round(step.distance || 0),
      duration: Math.max(1, Math.round((step.duration || 0) / 60)),
      maneuver: step.maneuver?.type || '',
      modifier: step.maneuver?.modifier || '',
      bearingBefore: step.maneuver?.bearing_before ?? null,
      bearingAfter: step.maneuver?.bearing_after ?? null,
      point: maneuverPoint(step),
    }))
}

function compactTmapLinePoints(features = []) {
  return compactPoints(features.flatMap(feature => {
    const coords = feature?.geometry?.coordinates
    if (feature?.geometry?.type === 'LineString' && Array.isArray(coords)) {
      return coords.map(([lng, lat]) => ({ lat, lng }))
    }
    if (feature?.geometry?.type === 'MultiLineString' && Array.isArray(coords)) {
      return coords.flatMap(line => line.map(([lng, lat]) => ({ lat, lng })))
    }
    return []
  }))
}

function tmapPoint(feature) {
  const coords = feature?.geometry?.coordinates
  if (!Array.isArray(coords) || coords.length < 2) return null
  const [lng, lat] = coords
  if (!Number.isFinite(Number(lat)) || !Number.isFinite(Number(lng))) return null
  return { lat: Number(lat), lng: Number(lng) }
}

function normalizeTmapStep(feature, index) {
  const properties = feature?.properties || {}
  const description = properties.description || properties.name || ''
  const point = tmapPoint(feature)
  if (!description && !point) return null
  const maneuver = properties.turnType || properties.pointType || (index === 0 ? 'depart' : '')
  return {
    name: description,
    distance: Math.round(properties.distance || 0),
    duration: Math.max(1, Math.round((properties.time || 0) / 60)),
    maneuver: String(maneuver),
    modifier: description,
    point,
    description,
    provider: 'tmap',
  }
}

async function getTmapWalkingRoute(start, end, searchOption) {
  if (!TMAP_KEY) return null
  const url = new URL('https://apis.openapi.sk.com/tmap/routes/pedestrian')
  url.searchParams.set('version', '1')
  url.searchParams.set('format', 'json')

  const upstream = await fetch(url, {
    method: 'POST',
    headers: {
      accept: 'application/json',
      'content-type': 'application/json',
      appKey: TMAP_KEY,
    },
    body: JSON.stringify({
      startX: start.lng,
      startY: start.lat,
      endX: end.lng,
      endY: end.lat,
      startName: '출발지',
      endName: '도착지',
      reqCoordType: 'WGS84GEO',
      resCoordType: 'WGS84GEO',
      searchOption,
    }),
    signal: AbortSignal.timeout(6500),
  })
  const text = await upstream.text()
  let json
  try {
    json = JSON.parse(text)
  } catch {
    json = null
  }
  if (!upstream.ok) {
    const error = new Error(tmapIssueCode(upstream.status, json))
    error.publicCode = error.message
    throw error
  }
  const features = json?.features || []
  const points = compactTmapLinePoints(features)
  if (points.length < 2) return null
  const summary = features.find(feature => feature?.properties?.totalDistance)?.properties || {}
  const steps = features
    .filter(feature => feature?.geometry?.type === 'Point')
    .map(normalizeTmapStep)
    .filter(Boolean)
    .slice(0, 16)
  return {
    source: 'TMAP pedestrian',
    searchOption,
    distance: Math.round(summary.totalDistance || directDistance(start, end)),
    duration: Math.max(1, Math.round((summary.totalTime || 0) / 60)) || Math.max(1, Math.ceil(directDistance(start, end) / 65)),
    points,
    steps,
  }
}

export default async function handler(req, res) {
  const searchOption = tmapSearchOption(req.query.searchOption)
  const debug = req.query.debug === '1'
  const start = {
    lat: numberOrNull(req.query.startLat),
    lng: numberOrNull(req.query.startLng),
  }
  const end = {
    lat: numberOrNull(req.query.endLat),
    lng: numberOrNull(req.query.endLng),
  }

  if ([start.lat, start.lng, end.lat, end.lng].some(value => value === null)) {
    return res.status(400).json({ error: 'invalid_coordinates' })
  }
  if (!isInSeoul(start.lat, start.lng) || !isInSeoul(end.lat, end.lng)) {
    return res.status(400).json({ error: 'outside_seoul' })
  }
  if (directDistance(start, end) > MAX_DIRECT_DISTANCE_M) {
    return res.status(400).json({ error: 'walk_segment_too_long' })
  }

  let tmapIssue = TMAP_KEY ? '' : 'tmap_key_missing'
  if (TMAP_KEY) {
    try {
      const tmapRoute = await getTmapWalkingRoute(start, end, searchOption)
      if (tmapRoute) {
        res.setHeader('Cache-Control', 's-maxage=86400, stale-while-revalidate=604800')
        return res.status(200).json(tmapRoute)
      }
      tmapIssue = 'tmap_empty_route'
    } catch (error) {
      tmapIssue = error?.publicCode || 'tmap_request_failed'
    }
  }

  const url = new URL(`https://router.project-osrm.org/route/v1/foot/${start.lng},${start.lat};${end.lng},${end.lat}`)
  url.searchParams.set('overview', 'full')
  url.searchParams.set('geometries', 'geojson')
  url.searchParams.set('steps', 'true')
  url.searchParams.set('alternatives', 'false')

  try {
    const upstream = await fetch(url, {
      headers: { 'User-Agent': 'SilverPassSeoul/1.0 route geometry' },
      signal: AbortSignal.timeout(6500),
    })
    if (!upstream.ok) {
      return res.status(502).json({ error: 'walk_route_upstream_failed' })
    }
    const json = await upstream.json()
    const route = json?.routes?.[0]
    const points = compactPoints(route?.geometry?.coordinates?.map(([lng, lat]) => ({ lat, lng })) || [])
    if (json?.code !== 'Ok' || points.length < 2) {
      return res.status(404).json({ error: 'walk_route_not_found' })
    }

    res.setHeader('Cache-Control', 's-maxage=86400, stale-while-revalidate=604800')
    const body = {
      source: 'OSRM foot',
      distance: Math.round(route.distance || directDistance(start, end)),
      duration: Math.max(1, Math.round((route.duration || 0) / 60)),
      points,
      steps: routeSteps(route),
    }
    if (debug) body.tmapIssue = tmapIssue
    return res.status(200).json(body)
  } catch (error) {
    return res.status(504).json({ error: 'walk_route_timeout' })
  }
}
