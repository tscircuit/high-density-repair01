import Flatbush from "flatbush"
import type { NodeHdRoute, NodeWithPortPoints, PortPoint } from "./types"

type Point2D = {
  x: number
  y: number
}

type Point3D = Point2D & {
  z: number
}

type RouteSegment = {
  routeIndex: number
  connectionName: string
  netName: string
  segmentIndex: number
  traceThickness: number
  start: Point3D
  end: Point3D
}

type ViaRecord = {
  orderIndex: number
  routeIndex: number
  viaIndex: number
  connectionName: string
  netName: string
  viaRadius: number
  point: Point2D
}

type PortPointRecord = {
  orderIndex: number
  connectionName: string
  netName: string
  keepoutRadius: number
  z: number
  point: Point2D
}

export type DrcIssue =
  | {
      kind: "invalid-route"
      routeIndex: number
      connectionName: string
      message: string
    }
  | {
      kind: "trace-trace"
      leftRouteIndex: number
      rightRouteIndex: number
      leftConnectionName: string
      rightConnectionName: string
      leftSegmentIndex: number
      rightSegmentIndex: number
      distance: number
      clearance: number
    }
  | {
      kind: "via-trace"
      viaRouteIndex: number
      traceRouteIndex: number
      viaConnectionName: string
      traceConnectionName: string
      traceSegmentIndex: number
      distance: number
      clearance: number
    }
  | {
      kind: "via-via"
      leftRouteIndex: number
      rightRouteIndex: number
      leftConnectionName: string
      rightConnectionName: string
      distance: number
      clearance: number
    }
  | {
      kind: "out-of-bounds"
      routeIndex: number
      connectionName: string
      pointType: "route-point" | "via"
      pointIndex: number
      x: number
      y: number
    }
  | {
      kind: "trace-port-point"
      routeIndex: number
      connectionName: string
      portPointConnectionName: string
      segmentIndex: number
      distance: number
      clearance: number
    }

export type DrcCheckResult = {
  ok: boolean
  issues: DrcIssue[]
}

const POSITION_EPSILON = 1e-6
const PORT_POINT_TRACE_CLEARANCE = 0.25

const roundToTwoDecimals = (value: number) => Number(value.toFixed(2))

const subtractPoint = (left: Point2D, right: Point2D): Point2D => ({
  x: left.x - right.x,
  y: left.y - right.y,
})

const dotPoint = (left: Point2D, right: Point2D) =>
  left.x * right.x + left.y * right.y

const crossPoint = (left: Point2D, right: Point2D) =>
  left.x * right.y - left.y * right.x

const getPointDistance = (left: Point2D, right: Point2D) =>
  Math.hypot(left.x - right.x, left.y - right.y)

const arePointsCoincident = (left: Point2D, right: Point2D) =>
  getPointDistance(left, right) <= POSITION_EPSILON

const clampUnitInterval = (value: number) => Math.max(0, Math.min(value, 1))

const getDistanceFromPointToSegment = (
  point: Point2D,
  start: Point2D,
  end: Point2D,
) => {
  const delta = subtractPoint(end, start)
  const lengthSquared = dotPoint(delta, delta)

  if (lengthSquared <= POSITION_EPSILON) {
    return getPointDistance(point, start)
  }

  const t = clampUnitInterval(
    dotPoint(subtractPoint(point, start), delta) / lengthSquared,
  )
  const projection = {
    x: start.x + delta.x * t,
    y: start.y + delta.y * t,
  }

  return getPointDistance(point, projection)
}

const getOrientation = (origin: Point2D, left: Point2D, right: Point2D) =>
  crossPoint(subtractPoint(left, origin), subtractPoint(right, origin))

const isPointOnSegment = (point: Point2D, start: Point2D, end: Point2D) =>
  point.x >= Math.min(start.x, end.x) - POSITION_EPSILON &&
  point.x <= Math.max(start.x, end.x) + POSITION_EPSILON &&
  point.y >= Math.min(start.y, end.y) - POSITION_EPSILON &&
  point.y <= Math.max(start.y, end.y) + POSITION_EPSILON

const doSegmentsIntersect = (
  leftStart: Point2D,
  leftEnd: Point2D,
  rightStart: Point2D,
  rightEnd: Point2D,
) => {
  const leftStartOrientation = getOrientation(leftStart, leftEnd, rightStart)
  const leftEndOrientation = getOrientation(leftStart, leftEnd, rightEnd)
  const rightStartOrientation = getOrientation(rightStart, rightEnd, leftStart)
  const rightEndOrientation = getOrientation(rightStart, rightEnd, leftEnd)

  if (
    Math.abs(leftStartOrientation) <= POSITION_EPSILON &&
    isPointOnSegment(rightStart, leftStart, leftEnd)
  ) {
    return true
  }

  if (
    Math.abs(leftEndOrientation) <= POSITION_EPSILON &&
    isPointOnSegment(rightEnd, leftStart, leftEnd)
  ) {
    return true
  }

  if (
    Math.abs(rightStartOrientation) <= POSITION_EPSILON &&
    isPointOnSegment(leftStart, rightStart, rightEnd)
  ) {
    return true
  }

  if (
    Math.abs(rightEndOrientation) <= POSITION_EPSILON &&
    isPointOnSegment(leftEnd, rightStart, rightEnd)
  ) {
    return true
  }

  return (
    leftStartOrientation * leftEndOrientation < 0 &&
    rightStartOrientation * rightEndOrientation < 0
  )
}

const getSegmentDistance = (
  leftStart: Point2D,
  leftEnd: Point2D,
  rightStart: Point2D,
  rightEnd: Point2D,
) => {
  if (doSegmentsIntersect(leftStart, leftEnd, rightStart, rightEnd)) {
    return 0
  }

  return Math.min(
    getDistanceFromPointToSegment(leftStart, rightStart, rightEnd),
    getDistanceFromPointToSegment(leftEnd, rightStart, rightEnd),
    getDistanceFromPointToSegment(rightStart, leftStart, leftEnd),
    getDistanceFromPointToSegment(rightEnd, leftStart, leftEnd),
  )
}

const getNodeBounds = (nodeWithPortPoints: NodeWithPortPoints) => {
  const rawMinX = nodeWithPortPoints.center.x - nodeWithPortPoints.width / 2
  const rawMaxX = nodeWithPortPoints.center.x + nodeWithPortPoints.width / 2
  const rawMinY = nodeWithPortPoints.center.y - nodeWithPortPoints.height / 2
  const rawMaxY = nodeWithPortPoints.center.y + nodeWithPortPoints.height / 2

  return {
    minX: Math.min(rawMinX, roundToTwoDecimals(rawMinX)),
    maxX: Math.max(rawMaxX, roundToTwoDecimals(rawMaxX)),
    minY: Math.min(rawMinY, roundToTwoDecimals(rawMinY)),
    maxY: Math.max(rawMaxY, roundToTwoDecimals(rawMaxY)),
  }
}

const getRouteNetName = (routeLike: {
  connectionName: string
  rootConnectionName?: string
}) => routeLike.rootConnectionName ?? routeLike.connectionName

const isPointInsideBounds = (
  point: Point2D,
  bounds: ReturnType<typeof getNodeBounds>,
) =>
  point.x >= bounds.minX - POSITION_EPSILON &&
  point.x <= bounds.maxX + POSITION_EPSILON &&
  point.y >= bounds.minY - POSITION_EPSILON &&
  point.y <= bounds.maxY + POSITION_EPSILON

const isCircularPointInsideBounds = (
  point: Point2D,
  radius: number,
  bounds: ReturnType<typeof getNodeBounds>,
) =>
  point.x - radius >= bounds.minX - POSITION_EPSILON &&
  point.x + radius <= bounds.maxX + POSITION_EPSILON &&
  point.y - radius >= bounds.minY - POSITION_EPSILON &&
  point.y + radius <= bounds.maxY + POSITION_EPSILON

const extractRouteSegments = (
  routes: NodeHdRoute[],
): {
  segments: RouteSegment[]
  issues: DrcIssue[]
} => {
  const segments: RouteSegment[] = []
  const issues: DrcIssue[] = []

  for (let routeIndex = 0; routeIndex < routes.length; routeIndex += 1) {
    const route = routes[routeIndex]
    if (!route || route.route.length < 2) {
      if (route) {
        issues.push({
          kind: "invalid-route",
          routeIndex,
          connectionName: route.connectionName,
          message: "Route must contain at least 2 points.",
        })
      }
      continue
    }

    for (
      let segmentIndex = 0;
      segmentIndex < route.route.length - 1;
      segmentIndex += 1
    ) {
      const start = route.route[segmentIndex]
      const end = route.route[segmentIndex + 1]

      if (!start || !end) continue

      if (start.x === end.x && start.y === end.y) {
        if (start.z !== end.z) {
          continue
        }

        continue
      }

      if (start.z !== end.z) {
        issues.push({
          kind: "invalid-route",
          routeIndex,
          connectionName: route.connectionName,
          message: `Segment ${segmentIndex} changes z without a colocated via.`,
        })
        continue
      }

      segments.push({
        routeIndex,
        connectionName: route.connectionName,
        netName: getRouteNetName(route),
        segmentIndex,
        traceThickness: route.traceThickness,
        start,
        end,
      })
    }
  }

  return {
    segments,
    issues,
  }
}

const isAdjacentSegmentPair = (left: RouteSegment, right: RouteSegment) =>
  left.routeIndex === right.routeIndex &&
  Math.abs(left.segmentIndex - right.segmentIndex) <= 1

const isViaIncidentToSegment = (
  via: Point2D,
  routeIndex: number,
  segment: RouteSegment,
) =>
  routeIndex === segment.routeIndex &&
  (arePointsCoincident(via, segment.start) ||
    arePointsCoincident(via, segment.end))

const getPortPointsByConnectionName = (
  nodeWithPortPoints: NodeWithPortPoints,
) => {
  const portPointsByConnection = new Map<string, PortPoint[]>()

  for (const portPoint of nodeWithPortPoints.portPoints) {
    const existingPortPoints =
      portPointsByConnection.get(portPoint.connectionName) ?? []
    existingPortPoints.push(portPoint)
    portPointsByConnection.set(portPoint.connectionName, existingPortPoints)
  }

  return portPointsByConnection
}

const getBestRoutePortPair = (
  route: NodeHdRoute,
  routePortPoints: PortPoint[],
): [PortPoint, PortPoint] | null => {
  const startPoint = route.route[0]
  const endPoint = route.route.at(-1)

  if (!startPoint || !endPoint || routePortPoints.length < 2) {
    return null
  }

  let bestPair: [PortPoint, PortPoint] | null = null
  let bestScore = Infinity

  for (let i = 0; i < routePortPoints.length; i += 1) {
    const leftPort = routePortPoints[i]
    if (!leftPort) continue

    for (let j = i + 1; j < routePortPoints.length; j += 1) {
      const rightPort = routePortPoints[j]
      if (!rightPort) continue

      const directScore =
        getPointDistance(startPoint, leftPort) +
        getPointDistance(endPoint, rightPort)
      if (directScore < bestScore) {
        bestScore = directScore
        bestPair = [leftPort, rightPort]
      }

      const swappedScore =
        getPointDistance(startPoint, rightPort) +
        getPointDistance(endPoint, leftPort)
      if (swappedScore < bestScore) {
        bestScore = swappedScore
        bestPair = [rightPort, leftPort]
      }
    }
  }

  return bestPair
}

const getSegmentBounds = (segment: RouteSegment) => ({
  minX: Math.min(segment.start.x, segment.end.x),
  maxX: Math.max(segment.start.x, segment.end.x),
  minY: Math.min(segment.start.y, segment.end.y),
  maxY: Math.max(segment.start.y, segment.end.y),
})

const collectViaRecords = (routes: NodeHdRoute[]) => {
  const vias: ViaRecord[] = []

  for (let routeIndex = 0; routeIndex < routes.length; routeIndex += 1) {
    const route = routes[routeIndex]
    if (!route) continue

    for (let viaIndex = 0; viaIndex < route.vias.length; viaIndex += 1) {
      const via = route.vias[viaIndex]
      if (!via) continue

      vias.push({
        orderIndex: vias.length,
        routeIndex,
        viaIndex,
        connectionName: route.connectionName,
        netName: getRouteNetName(route),
        viaRadius: route.viaDiameter / 2,
        point: via,
      })
    }
  }

  return vias
}

const collectPortPointRecords = (nodeWithPortPoints: NodeWithPortPoints) =>
  nodeWithPortPoints.portPoints.map((portPoint, index) => ({
    orderIndex: index,
    connectionName: portPoint.connectionName,
    netName: getRouteNetName(portPoint),
    keepoutRadius: portPoint.keepoutRadius ?? PORT_POINT_TRACE_CLEARANCE,
    z: portPoint.z,
    point: {
      x: portPoint.x,
      y: portPoint.y,
    },
  }))

const collectBaseDrcData = (
  nodeWithPortPoints: NodeWithPortPoints,
  routes: NodeHdRoute[],
) => {
  const issues: DrcIssue[] = []
  const bounds = getNodeBounds(nodeWithPortPoints)
  const { segments, issues: segmentIssues } = extractRouteSegments(routes)
  const portPointsByConnection =
    getPortPointsByConnectionName(nodeWithPortPoints)

  issues.push(...segmentIssues)

  for (let routeIndex = 0; routeIndex < routes.length; routeIndex += 1) {
    const route = routes[routeIndex]
    if (!route) continue

    const routePortPoints = portPointsByConnection.get(route.connectionName)
    if (!routePortPoints || routePortPoints.length < 2) {
      issues.push({
        kind: "invalid-route",
        routeIndex,
        connectionName: route.connectionName,
        message: "Route must match at least 2 sample port points.",
      })
      continue
    }

    const endpointPorts = getBestRoutePortPair(route, routePortPoints)
    if (!endpointPorts) {
      issues.push({
        kind: "invalid-route",
        routeIndex,
        connectionName: route.connectionName,
        message: "Route must match at least 2 sample port points.",
      })
      continue
    }
    const [firstPortPoint, secondPortPoint] = endpointPorts

    if (
      !routeHasValidAttachedEndpoints(route, [firstPortPoint, secondPortPoint])
    ) {
      issues.push({
        kind: "invalid-route",
        routeIndex,
        connectionName: route.connectionName,
        message:
          "Route endpoints must connect to both port points and leave/arrive on the same layer as the attached port.",
      })
    }

    for (let pointIndex = 0; pointIndex < route.route.length; pointIndex += 1) {
      const point = route.route[pointIndex]
      if (!point || isPointInsideBounds(point, bounds)) continue

      issues.push({
        kind: "out-of-bounds",
        routeIndex,
        connectionName: route.connectionName,
        pointType: "route-point",
        pointIndex,
        x: point.x,
        y: point.y,
      })
    }

    for (let viaIndex = 0; viaIndex < route.vias.length; viaIndex += 1) {
      const via = route.vias[viaIndex]
      if (
        !via ||
        isCircularPointInsideBounds(via, route.viaDiameter / 2, bounds)
      ) {
        continue
      }

      issues.push({
        kind: "out-of-bounds",
        routeIndex,
        connectionName: route.connectionName,
        pointType: "via",
        pointIndex: viaIndex,
        x: via.x,
        y: via.y,
      })
    }
  }

  return {
    issues,
    segments,
    vias: collectViaRecords(routes),
    portPoints: collectPortPointRecords(nodeWithPortPoints),
  }
}

const appendTraceTraceIssuesBruteForce = (
  issues: DrcIssue[],
  segments: RouteSegment[],
) => {
  for (let leftIndex = 0; leftIndex < segments.length; leftIndex += 1) {
    const leftSegment = segments[leftIndex]
    if (!leftSegment) continue

    for (
      let rightIndex = leftIndex + 1;
      rightIndex < segments.length;
      rightIndex += 1
    ) {
      const rightSegment = segments[rightIndex]
      if (!rightSegment || leftSegment.start.z !== rightSegment.start.z) {
        continue
      }

      if (isAdjacentSegmentPair(leftSegment, rightSegment)) {
        continue
      }

      if (leftSegment.netName === rightSegment.netName) {
        continue
      }

      const clearance =
        leftSegment.traceThickness / 2 + rightSegment.traceThickness / 2
      const distance = getSegmentDistance(
        leftSegment.start,
        leftSegment.end,
        rightSegment.start,
        rightSegment.end,
      )

      if (distance + POSITION_EPSILON >= clearance) {
        continue
      }

      issues.push({
        kind: "trace-trace",
        leftRouteIndex: leftSegment.routeIndex,
        rightRouteIndex: rightSegment.routeIndex,
        leftConnectionName: leftSegment.connectionName,
        rightConnectionName: rightSegment.connectionName,
        leftSegmentIndex: leftSegment.segmentIndex,
        rightSegmentIndex: rightSegment.segmentIndex,
        distance,
        clearance,
      })
    }
  }
}

const appendViaTraceIssuesBruteForce = (
  issues: DrcIssue[],
  vias: ViaRecord[],
  segments: RouteSegment[],
) => {
  for (const via of vias) {
    for (const segment of segments) {
      if (isViaIncidentToSegment(via.point, via.routeIndex, segment)) {
        continue
      }

      if (via.netName === segment.netName) {
        continue
      }

      const clearance = via.viaRadius + segment.traceThickness / 2
      const distance = getDistanceFromPointToSegment(
        via.point,
        segment.start,
        segment.end,
      )

      if (distance + POSITION_EPSILON >= clearance) {
        continue
      }

      issues.push({
        kind: "via-trace",
        viaRouteIndex: via.routeIndex,
        traceRouteIndex: segment.routeIndex,
        viaConnectionName: via.connectionName,
        traceConnectionName: segment.connectionName,
        traceSegmentIndex: segment.segmentIndex,
        distance,
        clearance,
      })
    }
  }
}

const appendViaViaIssuesBruteForce = (
  issues: DrcIssue[],
  vias: ViaRecord[],
) => {
  for (let leftIndex = 0; leftIndex < vias.length; leftIndex += 1) {
    const leftVia = vias[leftIndex]
    if (!leftVia) continue

    for (
      let rightIndex = leftIndex + 1;
      rightIndex < vias.length;
      rightIndex += 1
    ) {
      const rightVia = vias[rightIndex]
      if (!rightVia) continue

      if (leftVia.netName === rightVia.netName) {
        continue
      }

      const clearance = leftVia.viaRadius + rightVia.viaRadius
      const distance = getPointDistance(leftVia.point, rightVia.point)

      if (distance + POSITION_EPSILON >= clearance) {
        continue
      }

      issues.push({
        kind: "via-via",
        leftRouteIndex: leftVia.routeIndex,
        rightRouteIndex: rightVia.routeIndex,
        leftConnectionName: leftVia.connectionName,
        rightConnectionName: rightVia.connectionName,
        distance,
        clearance,
      })
    }
  }
}

const appendTracePortPointIssuesBruteForce = (
  issues: DrcIssue[],
  segments: RouteSegment[],
  portPoints: PortPointRecord[],
) => {
  for (const portPoint of portPoints) {
    for (const segment of segments) {
      if (segment.netName === portPoint.netName) {
        continue
      }

      if (segment.start.z !== portPoint.z) {
        continue
      }

      const distance = getDistanceFromPointToSegment(
        portPoint.point,
        segment.start,
        segment.end,
      )

      if (distance + POSITION_EPSILON >= portPoint.keepoutRadius) {
        continue
      }

      issues.push({
        kind: "trace-port-point",
        routeIndex: segment.routeIndex,
        connectionName: segment.connectionName,
        portPointConnectionName: portPoint.connectionName,
        segmentIndex: segment.segmentIndex,
        distance,
        clearance: portPoint.keepoutRadius,
      })
    }
  }
}

const appendTraceTraceIssuesWithFlatbush = (
  issues: DrcIssue[],
  segments: RouteSegment[],
) => {
  const segmentsByLayer = new Map<number, RouteSegment[]>()

  for (const segment of segments) {
    const layerSegments = segmentsByLayer.get(segment.start.z) ?? []
    layerSegments.push(segment)
    segmentsByLayer.set(segment.start.z, layerSegments)
  }

  for (const layerSegments of segmentsByLayer.values()) {
    if (layerSegments.length < 2) {
      continue
    }

    let maxTraceHalfThickness = 0
    const index = new Flatbush(layerSegments.length)
    for (const segment of layerSegments) {
      const { minX, maxX, minY, maxY } = getSegmentBounds(segment)
      index.add(minX, minY, maxX, maxY)
      maxTraceHalfThickness = Math.max(
        maxTraceHalfThickness,
        segment.traceThickness / 2,
      )
    }
    index.finish()

    for (let leftIndex = 0; leftIndex < layerSegments.length; leftIndex += 1) {
      const leftSegment = layerSegments[leftIndex]
      if (!leftSegment) continue

      const { minX, maxX, minY, maxY } = getSegmentBounds(leftSegment)
      const searchPadding =
        leftSegment.traceThickness / 2 + maxTraceHalfThickness
      const candidateIndexes = index.search(
        minX - searchPadding,
        minY - searchPadding,
        maxX + searchPadding,
        maxY + searchPadding,
      )

      for (const rightIndex of candidateIndexes) {
        if (rightIndex <= leftIndex) {
          continue
        }

        const rightSegment = layerSegments[rightIndex]
        if (!rightSegment) {
          continue
        }

        if (isAdjacentSegmentPair(leftSegment, rightSegment)) {
          continue
        }

        if (leftSegment.netName === rightSegment.netName) {
          continue
        }

        const clearance =
          leftSegment.traceThickness / 2 + rightSegment.traceThickness / 2
        const distance = getSegmentDistance(
          leftSegment.start,
          leftSegment.end,
          rightSegment.start,
          rightSegment.end,
        )

        if (distance + POSITION_EPSILON >= clearance) {
          continue
        }

        issues.push({
          kind: "trace-trace",
          leftRouteIndex: leftSegment.routeIndex,
          rightRouteIndex: rightSegment.routeIndex,
          leftConnectionName: leftSegment.connectionName,
          rightConnectionName: rightSegment.connectionName,
          leftSegmentIndex: leftSegment.segmentIndex,
          rightSegmentIndex: rightSegment.segmentIndex,
          distance,
          clearance,
        })
      }
    }
  }
}

const appendViaTraceIssuesWithFlatbush = (
  issues: DrcIssue[],
  vias: ViaRecord[],
  segments: RouteSegment[],
) => {
  if (vias.length === 0 || segments.length === 0) {
    return
  }

  let maxTraceHalfThickness = 0
  const index = new Flatbush(segments.length)
  for (const segment of segments) {
    const { minX, maxX, minY, maxY } = getSegmentBounds(segment)
    index.add(minX, minY, maxX, maxY)
    maxTraceHalfThickness = Math.max(
      maxTraceHalfThickness,
      segment.traceThickness / 2,
    )
  }
  index.finish()

  for (const via of vias) {
    const searchPadding = via.viaRadius + maxTraceHalfThickness
    const candidateIndexes = index.search(
      via.point.x - searchPadding,
      via.point.y - searchPadding,
      via.point.x + searchPadding,
      via.point.y + searchPadding,
    )

    for (const segmentIndex of candidateIndexes) {
      const segment = segments[segmentIndex]
      if (!segment) continue

      if (isViaIncidentToSegment(via.point, via.routeIndex, segment)) {
        continue
      }

      if (via.netName === segment.netName) {
        continue
      }

      const clearance = via.viaRadius + segment.traceThickness / 2
      const distance = getDistanceFromPointToSegment(
        via.point,
        segment.start,
        segment.end,
      )

      if (distance + POSITION_EPSILON >= clearance) {
        continue
      }

      issues.push({
        kind: "via-trace",
        viaRouteIndex: via.routeIndex,
        traceRouteIndex: segment.routeIndex,
        viaConnectionName: via.connectionName,
        traceConnectionName: segment.connectionName,
        traceSegmentIndex: segment.segmentIndex,
        distance,
        clearance,
      })
    }
  }
}

const appendViaViaIssuesWithFlatbush = (
  issues: DrcIssue[],
  vias: ViaRecord[],
) => {
  if (vias.length < 2) {
    return
  }

  let maxViaRadius = 0
  const index = new Flatbush(vias.length)
  for (const via of vias) {
    index.add(via.point.x, via.point.y, via.point.x, via.point.y)
    maxViaRadius = Math.max(maxViaRadius, via.viaRadius)
  }
  index.finish()

  for (let leftIndex = 0; leftIndex < vias.length; leftIndex += 1) {
    const leftVia = vias[leftIndex]
    if (!leftVia) continue

    const searchPadding = leftVia.viaRadius + maxViaRadius
    const candidateIndexes = index.search(
      leftVia.point.x - searchPadding,
      leftVia.point.y - searchPadding,
      leftVia.point.x + searchPadding,
      leftVia.point.y + searchPadding,
    )

    for (const rightIndex of candidateIndexes) {
      if (rightIndex <= leftIndex) {
        continue
      }

      const rightVia = vias[rightIndex]
      if (!rightVia) continue

      if (leftVia.netName === rightVia.netName) {
        continue
      }

      const clearance = leftVia.viaRadius + rightVia.viaRadius
      const distance = getPointDistance(leftVia.point, rightVia.point)

      if (distance + POSITION_EPSILON >= clearance) {
        continue
      }

      issues.push({
        kind: "via-via",
        leftRouteIndex: leftVia.routeIndex,
        rightRouteIndex: rightVia.routeIndex,
        leftConnectionName: leftVia.connectionName,
        rightConnectionName: rightVia.connectionName,
        distance,
        clearance,
      })
    }
  }
}

const isSamePoint3D = (left: Point3D, right: Point3D) =>
  arePointsCoincident(left, right) && left.z === right.z

const getFirstMovedPointIndex = (route: NodeHdRoute) => {
  const startPoint = route.route[0]
  if (!startPoint) return null

  for (let pointIndex = 1; pointIndex < route.route.length; pointIndex += 1) {
    const point = route.route[pointIndex]
    if (!point) continue

    if (!arePointsCoincident(startPoint, point)) {
      return pointIndex
    }
  }

  return null
}

const getLastMovedPointIndex = (route: NodeHdRoute) => {
  const endPoint = route.route.at(-1)
  if (!endPoint) return null

  for (
    let pointIndex = route.route.length - 2;
    pointIndex >= 0;
    pointIndex -= 1
  ) {
    const point = route.route[pointIndex]
    if (!point) continue

    if (!arePointsCoincident(endPoint, point)) {
      return pointIndex
    }
  }

  return null
}

const isEndpointAttachedOnSameLayer = (
  route: NodeHdRoute,
  portPoint: PortPoint,
  endpoint: "start" | "end",
) => {
  const endpointPoint =
    endpoint === "start" ? route.route[0] : route.route.at(-1)
  if (!endpointPoint || !isSamePoint3D(endpointPoint, portPoint)) {
    return false
  }

  const movedPointIndex =
    endpoint === "start"
      ? getFirstMovedPointIndex(route)
      : getLastMovedPointIndex(route)

  if (movedPointIndex === null) {
    return false
  }

  const colocatedSlice =
    endpoint === "start"
      ? route.route.slice(0, movedPointIndex)
      : route.route.slice(movedPointIndex + 1)

  if (colocatedSlice.some((point) => point && point.z !== portPoint.z)) {
    return false
  }

  const movedPoint = route.route[movedPointIndex]
  return movedPoint?.z === portPoint.z
}

const routeHasValidAttachedEndpoints = (
  route: NodeHdRoute,
  portPoints: [PortPoint, PortPoint],
) =>
  (isEndpointAttachedOnSameLayer(route, portPoints[0], "start") &&
    isEndpointAttachedOnSameLayer(route, portPoints[1], "end")) ||
  (isEndpointAttachedOnSameLayer(route, portPoints[1], "start") &&
    isEndpointAttachedOnSameLayer(route, portPoints[0], "end"))

export const runDrcCheckBruteForce = (
  nodeWithPortPoints: NodeWithPortPoints,
  routes: NodeHdRoute[],
): DrcCheckResult => {
  const { issues, segments, vias, portPoints } = collectBaseDrcData(
    nodeWithPortPoints,
    routes,
  )
  appendTraceTraceIssuesBruteForce(issues, segments)
  appendViaTraceIssuesBruteForce(issues, vias, segments)
  appendViaViaIssuesBruteForce(issues, vias)
  appendTracePortPointIssuesBruteForce(issues, segments, portPoints)

  return {
    ok: issues.length === 0,
    issues,
  }
}

export const runDrcCheckWithFlatbush = (
  nodeWithPortPoints: NodeWithPortPoints,
  routes: NodeHdRoute[],
): DrcCheckResult => {
  const { issues, segments, vias, portPoints } = collectBaseDrcData(
    nodeWithPortPoints,
    routes,
  )
  appendTraceTraceIssuesWithFlatbush(issues, segments)
  appendViaTraceIssuesWithFlatbush(issues, vias, segments)
  appendViaViaIssuesWithFlatbush(issues, vias)
  appendTracePortPointIssuesBruteForce(issues, segments, portPoints)

  return {
    ok: issues.length === 0,
    issues,
  }
}

export const runDrcCheck = runDrcCheckWithFlatbush
