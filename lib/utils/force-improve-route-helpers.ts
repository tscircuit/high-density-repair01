import type {
  HighDensityRoute,
  NodeWithPortPoints,
} from "../types/high-density-types"

type Vector = {
  x: number
  y: number
}

type Bounds = {
  minX: number
  maxX: number
  minY: number
  maxY: number
}

export const getRouteRootConnectionName = (route: HighDensityRoute) =>
  route.rootConnectionName ?? route.connectionName

export const deriveVias = (
  route: HighDensityRoute,
): HighDensityRoute["vias"] => {
  const vias: HighDensityRoute["vias"] = []

  for (let index = 0; index < route.route.length - 1; index += 1) {
    const current = route.route[index]
    const next = route.route[index + 1]
    if (!current || !next || current.z === next.z) continue
    if (
      Math.abs(current.x - next.x) > 1e-6 ||
      Math.abs(current.y - next.y) > 1e-6
    ) {
      continue
    }

    const nextVia = {
      x: current.x,
      y: current.y,
    }
    const lastVia = vias.at(-1)
    if (lastVia && lastVia.x === nextVia.x && lastVia.y === nextVia.y) continue
    vias.push(nextVia)
  }

  return vias
}

export const areSameXY = (
  left: Vector,
  right: Vector,
  coordinateMatchEpsilon = 1e-3,
) =>
  Math.abs(left.x - right.x) <= coordinateMatchEpsilon &&
  Math.abs(left.y - right.y) <= coordinateMatchEpsilon

export const getInsetNodeBounds = (
  node: NodeWithPortPoints,
  padding: number,
): Bounds => ({
  minX: node.center.x - node.width / 2 + padding,
  maxX: node.center.x + node.width / 2 - padding,
  minY: node.center.y - node.height / 2 + padding,
  maxY: node.center.y + node.height / 2 - padding,
})

export const getCoincidentPointIndexes = (
  points: Vector[],
  pointIndex: number,
  coordinateMatchEpsilon = 1e-3,
) => {
  const point = points[pointIndex]
  if (!point) return []

  const pointIndexes = [pointIndex]
  for (let cursor = pointIndex - 1; cursor >= 0; cursor -= 1) {
    const candidate = points[cursor]
    if (!candidate || !areSameXY(candidate, point, coordinateMatchEpsilon)) {
      break
    }
    pointIndexes.push(cursor)
  }
  for (let cursor = pointIndex + 1; cursor < points.length; cursor += 1) {
    const candidate = points[cursor]
    if (!candidate || !areSameXY(candidate, point, coordinateMatchEpsilon)) {
      break
    }
    pointIndexes.push(cursor)
  }

  return [...new Set(pointIndexes)]
}
