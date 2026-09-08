import type { ConnectivityMap } from "circuit-json-to-connectivity-map"
import type { FixedObstacle } from "../types/FixedObstacle"
import { getMovingPointSegmentContact } from "./getMovingPointSegmentContact"
import type { Segment } from "./TraceSegmentMoveGuard"

type Point = { x: number; y: number }
type PreparedObstacle = {
  obstacle: FixedObstacle
  cosine: number
  sine: number
  radius: number
  edges: Array<[Point, Point]>
  nets: Set<string>
}
type Constraint = {
  segment: Segment
  pad: PreparedObstacle
  minimum: number
}

const pointSegmentDistance = (p: Point, a: Point, b: Point): number => {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const squared = dx * dx + dy * dy
  const t =
    squared === 0
      ? 0
      : Math.max(
          0,
          Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / squared),
        )
  return Math.hypot(p.x - a.x - t * dx, p.y - a.y - t * dy)
}

const segmentDistance = (a: Point, b: Point, c: Point, d: Point): number => {
  const orientation = (p: Point, q: Point, r: Point): number =>
    (q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x)
  if (
    orientation(a, b, c) * orientation(a, b, d) < 0 &&
    orientation(c, d, a) * orientation(c, d, b) < 0
  ) {
    return 0
  }
  return Math.min(
    pointSegmentDistance(a, c, d),
    pointSegmentDistance(b, c, d),
    pointSegmentDistance(c, a, b),
    pointSegmentDistance(d, a, b),
  )
}

/** Preserves each incident wire's original separation from physical pads. */
export class FixedObstacleMoveGuard {
  private readonly pads: PreparedObstacle[]
  private readonly originals = new Map<Segment, [Point, Point]>()
  private readonly adjacent = new Map<Point, Segment[]>()
  private readonly minimumDistance = new Map<
    Segment,
    Map<PreparedObstacle, number>
  >()

  constructor(
    segments: Segment[],
    obstacles: readonly FixedObstacle[],
    private readonly traceClearance: number,
    private readonly connMap?: ConnectivityMap,
  ) {
    for (const segment of segments) {
      if (segment.isVia) continue
      this.originals.set(segment, [{ ...segment.start }, { ...segment.end }])
      for (const point of new Set([segment.start, segment.end])) {
        const adjacent = this.adjacent.get(point) ?? []
        adjacent.push(segment)
        this.adjacent.set(point, adjacent)
      }
    }
    this.pads = obstacles.map((obstacle): PreparedObstacle => {
      const angle = ((obstacle.ccwRotationDegrees ?? 0) * Math.PI) / 180
      const halfX = obstacle.width / 2
      const halfY = obstacle.height / 2
      let edges: Array<[Point, Point]>
      let radius = 0
      if (obstacle.type === "oval") {
        radius = Math.min(halfX, halfY)
        edges = [
          [
            { x: -halfX + radius, y: -halfY + radius },
            { x: halfX - radius, y: halfY - radius },
          ],
        ]
      } else {
        const corners = [
          { x: -halfX, y: -halfY },
          { x: halfX, y: -halfY },
          { x: halfX, y: halfY },
          { x: -halfX, y: halfY },
        ]
        edges = corners.map((point, index): [Point, Point] => [
          point,
          corners[(index + 1) % 4]!,
        ])
      }
      return {
        obstacle,
        cosine: Math.cos(angle),
        sine: Math.sin(angle),
        edges,
        radius,
        nets: new Set(
          obstacle.connectedTo.map(
            (name): string => connMap?.getNetConnectedToId(name) ?? name,
          ),
        ),
      }
    })
  }

  constrain(points: Point[], dx: number, dy: number): Point {
    const length = Math.hypot(dx, dy)
    if (length === 0) return { x: 0, y: 0 }
    const moved = new Set(points)
    const adjacent = new Set(
      points.flatMap((point): Segment[] => this.adjacent.get(point) ?? []),
    )
    let fraction = 1
    const constraints: Constraint[] = []
    for (const segment of adjacent) {
      const root =
        this.connMap?.getNetConnectedToId(segment.rootConnectionName) ??
        segment.rootConnectionName
      for (const pad of this.pads) {
        const obstacle = pad.obstacle
        if (!obstacle.zLayers.includes(segment.z) || pad.nets.has(root)) continue
        const reach =
          Math.hypot(obstacle.width, obstacle.height) / 2 +
          segment.traceRadius +
          this.traceClearance +
          length
        if (
          Math.max(segment.start.x, segment.end.x) < obstacle.center.x - reach ||
          Math.min(segment.start.x, segment.end.x) > obstacle.center.x + reach ||
          Math.max(segment.start.y, segment.end.y) < obstacle.center.y - reach ||
          Math.min(segment.start.y, segment.end.y) > obstacle.center.y + reach
        ) {
          continue
        }
        const local = (point: Point): Point => {
          const x = point.x - obstacle.center.x
          const y = point.y - obstacle.center.y
          return {
            x: x * pad.cosine + y * pad.sine,
            y: -x * pad.sine + y * pad.cosine,
          }
        }
        let cached = this.minimumDistance.get(segment)
        if (!cached) {
          cached = new Map()
          this.minimumDistance.set(segment, cached)
        }
        let minimum = cached.get(pad)
        if (minimum === undefined) {
          const original = this.originals.get(segment)!
          const a = local(original[0])
          const b = local(original[1])
          const inside = (point: Point): boolean =>
            Math.abs(point.x) <= obstacle.width / 2 &&
            Math.abs(point.y) <= obstacle.height / 2
          const distance =
            obstacle.type === "rect" && (inside(a) || inside(b))
              ? 0
              : Math.max(
                  0,
                  Math.min(
                    ...pad.edges.map(([c, d]): number =>
                      segmentDistance(a, b, c, d),
                    ),
                  ) - pad.radius,
                )
          minimum = Math.min(segment.traceRadius + this.traceClearance, distance)
          cached.set(pad, minimum)
        }
        // Existing centerline intrusion has no smaller unsigned separation;
        // it can move outward without being trapped by its exit boundary.
        if (minimum <= 1e-12) continue
        constraints.push({ segment, pad, minimum })
        const a = local(segment.start)
        const b = local(segment.end)
        const delta = {
          x: dx * pad.cosine + dy * pad.sine,
          y: -dx * pad.sine + dy * pad.cosine,
        }
        const stationary = { x: 0, y: 0 }
        const da = moved.has(segment.start) ? delta : stationary
        const db = moved.has(segment.end) ? delta : stationary
        const radius = minimum + pad.radius
        for (const [c, d] of pad.edges) {
          const contact = Math.min(
            getMovingPointSegmentContact(a, c, d, da, stationary, stationary, radius),
            getMovingPointSegmentContact(b, c, d, db, stationary, stationary, radius),
            getMovingPointSegmentContact(c, a, b, stationary, da, db, radius),
            getMovingPointSegmentContact(d, a, b, stationary, da, db, radius),
          )
          if (contact <= fraction) {
            fraction = Math.max(0, contact - 1e-9 / length)
          }
        }
      }
    }
    const hasClearance = (scale: number): boolean =>
      constraints.every(({ segment, pad, minimum }): boolean => {
        const local = (point: Point): Point => {
          const x =
            point.x +
            (moved.has(point) ? dx * scale : 0) -
            pad.obstacle.center.x
          const y =
            point.y +
            (moved.has(point) ? dy * scale : 0) -
            pad.obstacle.center.y
          return {
            x: x * pad.cosine + y * pad.sine,
            y: -x * pad.sine + y * pad.cosine,
          }
        }
        const a = local(segment.start)
        const b = local(segment.end)
        if (
          pad.obstacle.type === "rect" &&
          [a, b].some(
            (p): boolean =>
              Math.abs(p.x) <= pad.obstacle.width / 2 &&
              Math.abs(p.y) <= pad.obstacle.height / 2,
          )
        ) {
          return false
        }
        const distance = Math.max(
          0,
          Math.min(
            ...pad.edges.map(([c, d]): number => segmentDistance(a, b, c, d)),
          ) - pad.radius,
        )
        return distance >= minimum - 1e-12
      })
    if (!hasClearance(fraction)) {
      let low = 0
      let high = fraction
      while ((high - low) * length > 1e-9) {
        const middle = (low + high) / 2
        if (hasClearance(middle)) low = middle
        else high = middle
      }
      fraction = low
    }
    return { x: dx * fraction, y: dy * fraction }
  }
}
