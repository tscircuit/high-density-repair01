import RBush from "rbush"
import type { ProjectionSegment } from "./force-improve-segment-helpers"

type SegmentBox = {
  minX: number
  minY: number
  maxX: number
  maxY: number
  index: number
}

/** Index current geometry; point moves invalidate every incident segment. */
export class ProjectionSegmentSpatialIndex {
  private readonly tree = new RBush<SegmentBox>()
  private readonly boxes: SegmentBox[] = []
  private readonly incident = new Map<number, Map<number, SegmentBox[]>>()
  private readonly dirty = new Set<SegmentBox>()
  private maxTraceRadius = 0
  private coordinateScale = 1

  constructor(private readonly segments: ProjectionSegment[]) {
    for (const [index, segment] of segments.entries()) {
      const box = {
        index,
        minX: Math.min(segment.start.x, segment.end.x),
        minY: Math.min(segment.start.y, segment.end.y),
        maxX: Math.max(segment.start.x, segment.end.x),
        maxY: Math.max(segment.start.y, segment.end.y),
      }
      this.boxes.push(box)
      this.maxTraceRadius = Math.max(this.maxTraceRadius, segment.traceRadius)
      this.coordinateScale = Math.max(
        this.coordinateScale,
        Math.abs(box.minX),
        Math.abs(box.minY),
        Math.abs(box.maxX),
        Math.abs(box.maxY),
      )
      let points = this.incident.get(segment.routeIndex)
      if (!points) {
        points = new Map()
        this.incident.set(segment.routeIndex, points)
      }
      for (const pointIndex of [segment.startIndex, segment.endIndex]) {
        const boxes = points.get(pointIndex) ?? []
        boxes.push(box)
        points.set(pointIndex, boxes)
      }
    }
    this.tree.load(this.boxes)
  }

  getCandidates(params: {
    segmentIndex: number
    afterIndex: number
    clearance: number
  }): number[] {
    const { segmentIndex, afterIndex, clearance } = params
    const segment = this.segments[segmentIndex]
    const padding =
      segment.traceRadius +
      this.maxTraceRadius +
      clearance +
      1e-6 +
      32 * Number.EPSILON * this.coordinateScale
    return this.tree
      .search({
        minX: Math.min(segment.start.x, segment.end.x) - padding,
        minY: Math.min(segment.start.y, segment.end.y) - padding,
        maxX: Math.max(segment.start.x, segment.end.x) + padding,
        maxY: Math.max(segment.start.y, segment.end.y) + padding,
      })
      .map((box) => box.index)
      .filter((index) => index > afterIndex)
      .sort((left, right) => left - right)
  }

  markPointMoved(routeIndex: number, pointIndex: number): void {
    const boxes = this.incident.get(routeIndex)?.get(pointIndex)
    if (!boxes) return
    for (const box of boxes) this.dirty.add(box)
  }

  refreshMovedPoints(): boolean {
    if (this.dirty.size === 0) return false
    for (const box of this.dirty) {
      this.tree.remove(box)
      const segment = this.segments[box.index]
      box.minX = Math.min(segment.start.x, segment.end.x)
      box.minY = Math.min(segment.start.y, segment.end.y)
      box.maxX = Math.max(segment.start.x, segment.end.x)
      box.maxY = Math.max(segment.start.y, segment.end.y)
      this.coordinateScale = Math.max(
        this.coordinateScale,
        Math.abs(box.minX),
        Math.abs(box.minY),
        Math.abs(box.maxX),
        Math.abs(box.maxY),
      )
      this.tree.insert(box)
    }
    this.dirty.clear()
    return true
  }
}
