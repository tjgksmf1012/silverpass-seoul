const SEOUL_BOUNDS = {
  minLat: 37.413,
  maxLat: 37.715,
  minLng: 126.734,
  maxLng: 127.269,
}

const MAX_DIRECT_DISTANCE_M = 3500

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

export default async function handler(req, res) {
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
    return res.status(200).json({
      source: 'OSRM foot',
      distance: Math.round(route.distance || directDistance(start, end)),
      duration: Math.max(1, Math.round((route.duration || 0) / 60)),
      points,
      steps: (route.legs?.[0]?.steps || []).slice(0, 10).map(step => ({
        name: step.name || '',
        distance: Math.round(step.distance || 0),
        duration: Math.max(1, Math.round((step.duration || 0) / 60)),
        maneuver: step.maneuver?.type || '',
      })),
    })
  } catch (error) {
    return res.status(504).json({ error: 'walk_route_timeout' })
  }
}
