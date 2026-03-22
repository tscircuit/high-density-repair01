import type { HighDensityRepair01 } from "./HighDensityRepair01"
import type { GraphicsObject } from "graphics-debug"
import type { AdjacentObstacle, NodeHdRoute, Point2D, Sample } from "./types"

const ROUTE_HUE_SPAN = 300

const getNodeBounds = (sample: Sample) => {
  const { center, width, height } = sample.nodeWithPortPoints

  return {
    minX: center.x - width / 2,
    maxX: center.x + width / 2,
    minY: center.y - height / 2,
    maxY: center.y + height / 2,
  }
}

const getUniqueConnectionKeys = (sample: Sample) => {
  const keys = new Set<string>()

  for (const portPoint of sample.nodeWithPortPoints.portPoints) {
    keys.add(portPoint.rootConnectionName ?? portPoint.connectionName)
  }

  for (const route of sample.nodeHdRoutes) {
    keys.add(route.rootConnectionName ?? route.connectionName)
  }

  return [...keys]
}

const createColorMap = (sample: Sample) => {
  const connectionKeys = getUniqueConnectionKeys(sample)
  const total = Math.max(connectionKeys.length, 1)
  const colorMap: Record<string, string> = {}

  connectionKeys.forEach((key, index) => {
    colorMap[key] = `hsl(${(index * ROUTE_HUE_SPAN) / total}, 100%, 50%)`
  })

  return colorMap
}

const getRouteColor = (
  routeOrConnection: Pick<NodeHdRoute, "connectionName" | "rootConnectionName">,
  colorMap: Record<string, string>,
) =>
  colorMap[
    routeOrConnection.rootConnectionName ?? routeOrConnection.connectionName
  ] ?? "hsl(0, 0%, 40%)"

const withAlpha = (hslColor: string, alpha: number) => {
  const hslMatch = hslColor.match(/^hsl\((.+)\)$/)
  if (!hslMatch) return hslColor
  return `hsla(${hslMatch[1]}, ${alpha})`
}

const createOvalPolygon = (
  center: Point2D,
  width: number,
  height: number,
  segments = 24,
) => {
  const rx = width / 2
  const ry = height / 2

  return Array.from({ length: segments }, (_, index) => {
    const theta = (index / segments) * Math.PI * 2
    return {
      x: center.x + Math.cos(theta) * rx,
      y: center.y + Math.sin(theta) * ry,
    }
  })
}

const addObstacleGraphics = (
  graphics: GraphicsObject,
  obstacle: AdjacentObstacle,
  index: number,
) => {
  const label = [
    `obstacle ${index + 1}`,
    obstacle.type,
    `layers: ${obstacle.layers.join(",")}`,
    `connections: ${obstacle.connectedTo.length}`,
  ].join("\n")

  if (obstacle.type === "oval") {
    graphics.polygons ??= []
    graphics.polygons.push({
      points: createOvalPolygon(
        obstacle.center,
        obstacle.width,
        obstacle.height,
      ),
      fill: "rgba(255, 80, 80, 0.12)",
      stroke: "rgba(220, 40, 40, 0.4)",
      strokeWidth: 1,
      label,
      layer: "adjacent-obstacles",
    })
    return
  }

  graphics.rects ??= []
  graphics.rects.push({
    center: obstacle.center,
    width: obstacle.width,
    height: obstacle.height,
    fill: "rgba(255, 80, 80, 0.12)",
    stroke: "rgba(220, 40, 40, 0.4)",
    label,
    layer: "adjacent-obstacles",
  })
}

const addRouteGraphics = (
  graphics: GraphicsObject,
  route: NodeHdRoute,
  colorMap: Record<string, string>,
  routeIndex: number,
) => {
  const routeColor = getRouteColor(route, colorMap)
  const routeLabel =
    route.rootConnectionName === route.connectionName
      ? route.connectionName
      : `${route.connectionName}\nroot: ${route.rootConnectionName}`

  graphics.lines ??= []
  for (let i = 0; i < route.route.length - 1; i++) {
    const p1 = route.route[i]
    const p2 = route.route[i + 1]
    graphics.lines.push({
      points: [p1, p2],
      strokeColor: p1.z === 0 ? routeColor : withAlpha(routeColor, 0.35),
      strokeWidth: route.traceThickness,
      strokeDash: p1.z === 0 ? undefined : "8 4",
      label: `${routeLabel}\nz: ${p1.z}`,
      layer: `route-z${p1.z}`,
      step: routeIndex,
    })
  }

  graphics.circles ??= []
  for (const via of route.vias) {
    graphics.circles.push({
      center: via,
      radius: route.viaDiameter / 2,
      fill: withAlpha(routeColor, 0.35),
      stroke: routeColor,
      label: `${routeLabel}\nvia`,
      layer: "vias",
      step: routeIndex,
    })
  }

  for (const viaRegion of route.viaRegions ?? []) {
    graphics.circles.push({
      center: viaRegion.center,
      radius: viaRegion.diameter / 2,
      stroke: withAlpha(routeColor, 0.45),
      fill: "rgba(0, 0, 0, 0)",
      label: `${routeLabel}\nvia region: ${viaRegion.viaRegionId}`,
      layer: "via-regions",
      step: routeIndex,
    })
  }

  graphics.points ??= []
  for (const [pointIndex, point] of route.route.entries()) {
    const pointRole =
      pointIndex === 0
        ? "start"
        : pointIndex === route.route.length - 1
          ? "end"
          : `p${pointIndex}`

    graphics.points.push({
      x: point.x,
      y: point.y,
      color: point.z === 0 ? routeColor : withAlpha(routeColor, 0.55),
      label: `${routeLabel}\n${pointRole}\nz: ${point.z}`,
      layer: `route-points-z${point.z}`,
      step: routeIndex,
    })
  }
}

export const visualizeHighDensityRepair = (
  solver: HighDensityRepair01,
): GraphicsObject => {
  const sample = solver.inputParams

  const graphics: GraphicsObject = {
    points: [],
    lines: [],
    rects: [],
    circles: [],
    polygons: [],
    coordinateSystem: "cartesian",
    title: "HighDensityRepair01",
  }

  if (!sample) {
    graphics.title = "HighDensityRepair01 (no input)"
    return graphics
  }

  const colorMap = createColorMap(sample)
  const bounds = getNodeBounds(sample)

  graphics.rects.push({
    center: sample.nodeWithPortPoints.center,
    width: sample.nodeWithPortPoints.width,
    height: sample.nodeWithPortPoints.height,
    fill: "rgba(0, 180, 120, 0.08)",
    stroke: "rgba(0, 120, 90, 0.45)",
    label: sample.nodeWithPortPoints.capacityMeshNodeId,
    layer: "node",
  })

  graphics.lines.push({
    points: [
      { x: bounds.minX, y: bounds.minY },
      { x: bounds.maxX, y: bounds.minY },
      { x: bounds.maxX, y: bounds.maxY },
      { x: bounds.minX, y: bounds.maxY },
      { x: bounds.minX, y: bounds.minY },
    ],
    strokeColor: "rgba(0, 90, 70, 0.55)",
    strokeDash: "6 4",
    layer: "node-border",
  })

  for (const [index, obstacle] of sample.adjacentObstacles.entries()) {
    addObstacleGraphics(graphics, obstacle, index)
  }

  for (const [routeIndex, route] of sample.nodeHdRoutes.entries()) {
    addRouteGraphics(graphics, route, colorMap, routeIndex)
  }

  for (const portPoint of sample.nodeWithPortPoints.portPoints) {
    const portColor = getRouteColor(portPoint, colorMap)
    graphics.points.push({
      x: portPoint.x,
      y: portPoint.y,
      color: portPoint.z === 0 ? portColor : withAlpha(portColor, 0.55),
      label: [
        portPoint.connectionName,
        portPoint.rootConnectionName !== portPoint.connectionName
          ? `root: ${portPoint.rootConnectionName}`
          : undefined,
        `port: ${portPoint.portPointId}`,
        `z: ${portPoint.z}`,
      ]
        .filter(Boolean)
        .join("\n"),
      layer: `port-points-z${portPoint.z}`,
    })
  }

  return graphics
}
