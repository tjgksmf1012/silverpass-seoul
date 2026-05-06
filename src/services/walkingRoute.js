const MAX_WALK_ROUTE_DISTANCE_M = 3500

function hasCoords(point) {
  return Number.isFinite(Number(point?.lat)) && Number.isFinite(Number(point?.lng))
}

function directDistance(start, end) {
  const radius = 6371000
  const toRad = degrees => degrees * Math.PI / 180
  const dLat = toRad(Number(end.lat) - Number(start.lat))
  const dLng = toRad(Number(end.lng) - Number(start.lng))
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(Number(start.lat))) * Math.cos(toRad(Number(end.lat))) * Math.sin(dLng / 2) ** 2
  return radius * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

function compactPoints(points) {
  return points.filter(hasCoords).reduce((acc, point) => {
    const normalized = { lat: Number(point.lat), lng: Number(point.lng) }
    const prev = acc[acc.length - 1]
    if (!prev || Math.abs(prev.lat - normalized.lat) > 0.00001 || Math.abs(prev.lng - normalized.lng) > 0.00001) {
      acc.push(normalized)
    }
    return acc
  }, [])
}

function normalizeWalkingRouteData(data, start, end) {
  const route = data?.routes?.[0]
  const rawPoints = data?.points || route?.geometry?.coordinates?.map(([lng, lat]) => ({ lat, lng })) || []
  const points = compactPoints(rawPoints)
  if (points.length < 2) return null
  const direct = directDistance(start, end)
  return {
    source: data?.source || 'walking-route',
    distance: Number(data?.distance ?? route?.distance) || Math.round(direct),
    duration: Number(data?.duration) || Math.max(1, Math.round(Number(route?.duration || 0) / 60)) || Math.max(1, Math.ceil(direct / 65)),
    points,
    steps: Array.isArray(data?.steps)
      ? data.steps
      : (route?.legs?.[0]?.steps || []).slice(0, 10).map(step => ({
        name: step.name || '',
        distance: Math.round(step.distance || 0),
        duration: Math.max(1, Math.round((step.duration || 0) / 60)),
        maneuver: step.maneuver?.type || '',
      })),
  }
}

async function getWalkingRouteFromOsrm(start, end) {
  const url = new URL(`https://router.project-osrm.org/route/v1/foot/${start.lng},${start.lat};${end.lng},${end.lat}`)
  url.searchParams.set('overview', 'full')
  url.searchParams.set('geometries', 'geojson')
  url.searchParams.set('steps', 'true')
  url.searchParams.set('alternatives', 'false')

  const res = await fetch(url, { signal: AbortSignal.timeout(8000) })
  if (!res.ok) return null
  const data = await res.json()
  if (data?.code !== 'Ok') return null
  return normalizeWalkingRouteData({ ...data, source: 'OSRM foot' }, start, end)
}

function firstPoint(step) {
  return compactPoints(step?.routePoints?.length ? step.routePoints : [step?.startPoint, step?.endPoint])[0] || null
}

function lastPoint(step) {
  const points = compactPoints(step?.routePoints?.length ? step.routePoints : [step?.startPoint, step?.endPoint])
  return points[points.length - 1] || null
}

function inferWalkEndpoints(step, index, steps, routeStart, routeEnd) {
  let start = hasCoords(step?.startPoint) ? step.startPoint : null
  let end = hasCoords(step?.endPoint) ? step.endPoint : null

  if (!start) {
    start = index === 0 ? routeStart : null
    for (let i = index - 1; !start && i >= 0; i -= 1) start = lastPoint(steps[i])
    start = start || routeStart
  }

  if (!end) {
    for (let i = index + 1; !end && i < steps.length; i += 1) end = firstPoint(steps[i])
    end = end || routeEnd
  }

  return hasCoords(start) && hasCoords(end) ? { start, end } : null
}

export async function getWalkingRoute(start, end) {
  if (!hasCoords(start) || !hasCoords(end)) return null
  const direct = directDistance(start, end)
  if (!Number.isFinite(direct) || direct <= 15 || direct > MAX_WALK_ROUTE_DISTANCE_M) return null

  const params = new URLSearchParams({
    startLat: String(start.lat),
    startLng: String(start.lng),
    endLat: String(end.lat),
    endLng: String(end.lng),
  })

  try {
    const res = await fetch(`/api/walk-route?${params}`, { signal: AbortSignal.timeout(8000) })
    if (!res.ok) return getWalkingRouteFromOsrm(start, end)
    const data = await res.json()
    return normalizeWalkingRouteData(data, start, end)
  } catch {
    return getWalkingRouteFromOsrm(start, end).catch(() => null)
  }
}

export async function enhanceRouteWalkingGeometry(route, routeStart, routeEnd) {
  const steps = route?.steps || []
  if (!steps.length) return route

  const enhancedSteps = await Promise.all(steps.map(async (step, index) => {
    if (step.type !== 'walk') return step
    const endpoints = inferWalkEndpoints(step, index, steps, routeStart, routeEnd)
    if (!endpoints) return step

    const walkingRoute = await getWalkingRoute(endpoints.start, endpoints.end)
    if (!walkingRoute?.points?.length) {
      return {
        ...step,
        startPoint: step.startPoint || endpoints.start,
        endPoint: step.endPoint || endpoints.end,
      }
    }

    return {
      ...step,
      startPoint: endpoints.start,
      endPoint: endpoints.end,
      routePoints: walkingRoute.points,
      routeSource: 'walking-route',
      walkingDistance: walkingRoute.distance,
      walkingDuration: walkingRoute.duration,
      walkInstructions: walkingRoute.steps,
    }
  }))

  return {
    ...route,
    steps: enhancedSteps,
    routePoints: compactPoints(enhancedSteps.flatMap(step => step.routePoints || [])),
  }
}
