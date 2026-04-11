import type {
  NodeHdRoute,
  NodeWithPortPoints,
  Point2D,
  Point3D,
  PortPoint,
} from "../types/types"

const POSITION_EPSILON = 1e-6

const getDistance = (left: Point2D, right: Point2D) =>
  Math.hypot(left.x - right.x, left.y - right.y)

const arePointsCoincident = (left: Point2D, right: Point2D) =>
  getDistance(left, right) <= POSITION_EPSILON

const isSamePoint3D = (left: Point3D, right: Point3D) =>
  arePointsCoincident(left, right) && left.z === right.z

const copyPoint = (point: Point3D): Point3D => ({
  x: point.x,
  y: point.y,
  z: point.z,
  ...(point.insideJumperPad === undefined
    ? {}
    : { insideJumperPad: point.insideJumperPad }),
})

const copyPortPoint = (portPoint: PortPoint): Point3D => ({
  x: portPoint.x,
  y: portPoint.y,
  z: portPoint.z,
  ...(portPoint.insideJumperPad === undefined
    ? {}
    : { insideJumperPad: portPoint.insideJumperPad }),
})

const cloneRoute = (route: NodeHdRoute): NodeHdRoute => ({
  ...route,
  route: route.route.map(copyPoint),
  vias: route.vias.map((via) => ({ ...via })),
  viaRegions: route.viaRegions?.map((viaRegion) => ({
    ...viaRegion,
    center: { ...viaRegion.center },
    connectedTo: [...viaRegion.connectedTo],
  })),
})

const getFirstMovedPointIndex = (points: Point3D[]) => {
  const startPoint = points[0]
  if (!startPoint) return null

  for (let pointIndex = 1; pointIndex < points.length; pointIndex += 1) {
    const point = points[pointIndex]
    if (!point) continue

    if (!arePointsCoincident(startPoint, point)) {
      return pointIndex
    }
  }

  return null
}

const getLastMovedPointIndex = (points: Point3D[]) => {
  const endPoint = points.at(-1)
  if (!endPoint) return null

  for (let pointIndex = points.length - 2; pointIndex >= 0; pointIndex -= 1) {
    const point = points[pointIndex]
    if (!point) continue

    if (!arePointsCoincident(endPoint, point)) {
      return pointIndex
    }
  }

  return null
}

const deriveVias = (points: Point3D[]) => {
  const vias: Point2D[] = []

  for (let index = 0; index < points.length - 1; index += 1) {
    const current = points[index]
    const next = points[index + 1]
    if (!current || !next) continue

    if (current.z === next.z) continue
    if (!arePointsCoincident(current, next)) continue

    const lastVia = vias.at(-1)
    if (lastVia && arePointsCoincident(lastVia, current)) {
      continue
    }

    vias.push({
      x: current.x,
      y: current.y,
    })
  }

  return vias
}

const getNodeBounds = (nodeWithPortPoints: NodeWithPortPoints) => ({
  minX: nodeWithPortPoints.center.x - nodeWithPortPoints.width / 2,
  maxX: nodeWithPortPoints.center.x + nodeWithPortPoints.width / 2,
  minY: nodeWithPortPoints.center.y - nodeWithPortPoints.height / 2,
  maxY: nodeWithPortPoints.center.y + nodeWithPortPoints.height / 2,
})

const clampColocatedClusterToBounds = (
  points: Point3D[],
  index: number,
  bounds: ReturnType<typeof getNodeBounds>,
) => {
  const anchorPoint = points[index]
  if (!anchorPoint) return

  const anchorPosition = {
    x: anchorPoint.x,
    y: anchorPoint.y,
  }
  const clampedPosition = {
    x: Math.max(bounds.minX, Math.min(bounds.maxX, anchorPosition.x)),
    y: Math.max(bounds.minY, Math.min(bounds.maxY, anchorPosition.y)),
  }

  for (let pointIndex = index; pointIndex >= 0; pointIndex -= 1) {
    const point = points[pointIndex]
    if (!point || !arePointsCoincident(point, anchorPosition)) {
      break
    }

    point.x = clampedPosition.x
    point.y = clampedPosition.y
  }

  for (
    let pointIndex = index + 1;
    pointIndex < points.length;
    pointIndex += 1
  ) {
    const point = points[pointIndex]
    if (!point || !arePointsCoincident(point, anchorPosition)) {
      break
    }

    point.x = clampedPosition.x
    point.y = clampedPosition.y
  }
}

const getInteriorJogPoint = (
  origin: Point2D,
  bounds: ReturnType<typeof getNodeBounds>,
  preferredStep: number,
) => {
  const step = Math.max(preferredStep, 0.05)
  const onLeft = Math.abs(origin.x - bounds.minX) <= POSITION_EPSILON
  const onRight = Math.abs(origin.x - bounds.maxX) <= POSITION_EPSILON
  const onBottom = Math.abs(origin.y - bounds.minY) <= POSITION_EPSILON
  const onTop = Math.abs(origin.y - bounds.maxY) <= POSITION_EPSILON

  if (onLeft) {
    return { x: Math.min(bounds.maxX, origin.x + step), y: origin.y }
  }
  if (onRight) {
    return { x: Math.max(bounds.minX, origin.x - step), y: origin.y }
  }
  if (onBottom) {
    return { x: origin.x, y: Math.min(bounds.maxY, origin.y + step) }
  }
  if (onTop) {
    return { x: origin.x, y: Math.max(bounds.minY, origin.y - step) }
  }

  const centerX = (bounds.minX + bounds.maxX) / 2
  const centerY = (bounds.minY + bounds.maxY) / 2
  const deltaX = centerX - origin.x
  const deltaY = centerY - origin.y

  if (Math.abs(deltaX) >= Math.abs(deltaY)) {
    return {
      x: Math.max(
        bounds.minX,
        Math.min(bounds.maxX, origin.x + Math.sign(deltaX || 1) * step),
      ),
      y: origin.y,
    }
  }

  return {
    x: origin.x,
    y: Math.max(
      bounds.minY,
      Math.min(bounds.maxY, origin.y + Math.sign(deltaY || 1) * step),
    ),
  }
}

const createMinimalRouteBetweenPorts = (
  route: NodeHdRoute,
  nodeWithPortPoints: NodeWithPortPoints,
  startPort: PortPoint,
  endPort: PortPoint,
) => {
  const bounds = getNodeBounds(nodeWithPortPoints)
  const preferredStep = Math.max(
    route.traceThickness * 2,
    route.viaDiameter,
    0.1,
  )

  if (isSamePoint3D(startPort, endPort)) {
    return [copyPortPoint(startPort)]
  }

  if (arePointsCoincident(startPort, endPort)) {
    const jogPoint = getInteriorJogPoint(startPort, bounds, preferredStep)

    return [
      copyPortPoint(startPort),
      { x: jogPoint.x, y: jogPoint.y, z: startPort.z },
      { x: jogPoint.x, y: jogPoint.y, z: endPort.z },
      copyPortPoint(endPort),
    ]
  }

  if (startPort.z === endPort.z) {
    return [copyPortPoint(startPort), copyPortPoint(endPort)]
  }

  let viaPoint = {
    x: (startPort.x + endPort.x) / 2,
    y: (startPort.y + endPort.y) / 2,
  }

  if (
    arePointsCoincident(viaPoint, startPort) ||
    arePointsCoincident(viaPoint, endPort)
  ) {
    viaPoint = getInteriorJogPoint(startPort, bounds, preferredStep)
  }

  viaPoint = {
    x: Math.max(bounds.minX, Math.min(bounds.maxX, viaPoint.x)),
    y: Math.max(bounds.minY, Math.min(bounds.maxY, viaPoint.y)),
  }

  return [
    copyPortPoint(startPort),
    { x: viaPoint.x, y: viaPoint.y, z: startPort.z },
    { x: viaPoint.x, y: viaPoint.y, z: endPort.z },
    copyPortPoint(endPort),
  ]
}

const getRoutePortsByConnection = (nodeWithPortPoints: NodeWithPortPoints) => {
  const routePortsByConnection = new Map<string, PortPoint[]>()

  for (const portPoint of nodeWithPortPoints.portPoints) {
    const existingPortPoints =
      routePortsByConnection.get(portPoint.connectionName) ?? []
    existingPortPoints.push(portPoint)
    routePortsByConnection.set(portPoint.connectionName, existingPortPoints)
  }

  return routePortsByConnection
}

const getEndpointPorts = (
  route: NodeHdRoute,
  portPointsByConnection: Map<string, PortPoint[]>,
) => {
  const routePorts = portPointsByConnection.get(route.connectionName)
  if (!routePorts || routePorts.length !== 2) {
    return null
  }

  const startPoint = route.route[0]
  const endPoint = route.route.at(-1)
  const firstPort = routePorts[0]
  const secondPort = routePorts[1]

  if (!startPoint || !endPoint || !firstPort || !secondPort) {
    return null
  }

  const directDistance =
    getDistance(startPoint, firstPort) + getDistance(endPoint, secondPort)
  const swappedDistance =
    getDistance(startPoint, secondPort) + getDistance(endPoint, firstPort)

  return directDistance <= swappedDistance
    ? { startPort: firstPort, endPort: secondPort }
    : { startPort: secondPort, endPort: firstPort }
}

const ensureStartAttachmentLayer = (
  points: Point3D[],
  startPort: PortPoint,
) => {
  if (points.length === 0) {
    return
  }

  points[0] = copyPortPoint(startPort)
  const firstMovedPointIndex = getFirstMovedPointIndex(points)
  if (firstMovedPointIndex === null) {
    return
  }

  for (let pointIndex = 0; pointIndex < firstMovedPointIndex; pointIndex += 1) {
    const point = points[pointIndex]
    if (!point) continue

    point.x = startPort.x
    point.y = startPort.y
    point.z = startPort.z
  }

  const movedPoint = points[firstMovedPointIndex]
  if (!movedPoint || movedPoint.z === startPort.z) {
    return
  }

  points.splice(firstMovedPointIndex, 0, {
    ...copyPoint(movedPoint),
    z: startPort.z,
  })
}

const ensureEndAttachmentLayer = (points: Point3D[], endPort: PortPoint) => {
  if (points.length === 0) {
    return
  }

  const lastPointIndex = points.length - 1
  points[lastPointIndex] = copyPortPoint(endPort)
  const lastMovedPointIndex = getLastMovedPointIndex(points)
  if (lastMovedPointIndex === null) {
    return
  }

  for (
    let pointIndex = lastMovedPointIndex + 1;
    pointIndex < points.length;
    pointIndex += 1
  ) {
    const point = points[pointIndex]
    if (!point) continue

    point.x = endPort.x
    point.y = endPort.y
    point.z = endPort.z
  }

  const movedPoint = points[lastMovedPointIndex]
  if (!movedPoint || movedPoint.z === endPort.z) {
    return
  }

  points.splice(lastMovedPointIndex + 1, 0, {
    ...copyPoint(movedPoint),
    z: endPort.z,
  })
}

const normalizeRouteEndpointLayers = (
  route: NodeHdRoute,
  nodeWithPortPoints: NodeWithPortPoints,
  startPort: PortPoint,
  endPort: PortPoint,
) => {
  const normalizedRoute = cloneRoute(route)

  if (normalizedRoute.route.length < 2) {
    normalizedRoute.route = createMinimalRouteBetweenPorts(
      route,
      nodeWithPortPoints,
      startPort,
      endPort,
    )
    normalizedRoute.vias = deriveVias(normalizedRoute.route)
    return normalizedRoute
  }

  ensureStartAttachmentLayer(normalizedRoute.route, startPort)
  ensureEndAttachmentLayer(normalizedRoute.route, endPort)
  const bounds = getNodeBounds(nodeWithPortPoints)
  const firstMovedPointIndex = getFirstMovedPointIndex(normalizedRoute.route)
  if (firstMovedPointIndex !== null) {
    clampColocatedClusterToBounds(
      normalizedRoute.route,
      firstMovedPointIndex,
      bounds,
    )
  }

  const lastMovedPointIndex = getLastMovedPointIndex(normalizedRoute.route)
  if (
    lastMovedPointIndex !== null &&
    lastMovedPointIndex !== firstMovedPointIndex
  ) {
    clampColocatedClusterToBounds(
      normalizedRoute.route,
      lastMovedPointIndex,
      bounds,
    )
  }

  normalizedRoute.vias = deriveVias(normalizedRoute.route)

  return normalizedRoute
}

export const normalizeRoutesToPortAttachments = (
  nodeWithPortPoints: NodeWithPortPoints,
  routes: NodeHdRoute[],
) => {
  const portPointsByConnection = getRoutePortsByConnection(nodeWithPortPoints)

  return routes.map((route) => {
    const endpointPorts = getEndpointPorts(route, portPointsByConnection)
    if (!endpointPorts) {
      return cloneRoute(route)
    }

    return normalizeRouteEndpointLayers(
      route,
      nodeWithPortPoints,
      endpointPorts.startPort,
      endpointPorts.endPort,
    )
  })
}
