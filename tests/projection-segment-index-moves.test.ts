import { expect, test } from "bun:test"
import type { HighDensityRoute } from "lib/types/high-density-types"
import { collectProjectionSegments } from "lib/utils/force-improve-segment-helpers"
import { ProjectionSegmentSpatialIndex } from "lib/utils/ProjectionSegmentSpatialIndex"

test("moved points refresh both incident segments", (): void => {
  const routes: HighDensityRoute[] = [
    {
      connectionName: "left",
      traceThickness: 0.1,
      viaDiameter: 0.3,
      vias: [],
      route: [
        { x: 0, y: 0, z: 0 },
        { x: 0, y: 1, z: 0 },
      ],
    },
    {
      connectionName: "moving",
      traceThickness: 0.1,
      viaDiameter: 0.3,
      vias: [],
      route: [
        { x: 8, y: 0, z: 0 },
        { x: 8, y: 1, z: 0 },
        { x: 8, y: 2, z: 0 },
      ],
    },
  ]
  const index = new ProjectionSegmentSpatialIndex(
    collectProjectionSegments(routes),
  )
  const query = { segmentIndex: 0, afterIndex: 0, clearance: 0.1 }
  expect(index.getCandidates(query)).toEqual([])
  routes[1].route[1].x = 0.01
  routes[1].route[1].y = 0.5
  index.markPointMoved(1, 1)
  expect(index.refreshMovedPoints()).toBe(true)
  expect(index.getCandidates(query)).toEqual([1, 2])
  expect(index.getCandidates({ ...query, afterIndex: 1 })).toEqual([2])
  routes[1].route[1].x = 9
  index.markPointMoved(1, 1)
  expect(index.refreshMovedPoints()).toBe(true)
  expect(index.getCandidates(query)).toEqual([])
  expect(index.refreshMovedPoints()).toBe(false)
})
