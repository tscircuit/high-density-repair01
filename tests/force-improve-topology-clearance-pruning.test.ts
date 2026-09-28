import { expect, spyOn, test } from "bun:test"
import type { HighDensityRoute } from "../lib/types/high-density-types"
import * as segmentHelpers from "../lib/utils/force-improve-segment-helpers"
import { getVectorLength } from "../lib/utils/getVectorLength"
import { findAlignedTopologyCandidate } from "../lib/utils/high-density-force-improve-topology"

type RouteSpec = {
  name: string
  points: Array<[number, number, number]>
  root?: string
  thickness?: number
}

test("topology clearance pruning preserves exhaustive violations and exact boundary checks", () => {
  const specs: RouteSpec[] = [
    {
      name: "horizontal",
      points: [
        [-2, 0, 0],
        [2, 0, 0],
      ],
    },
    {
      name: "crossing",
      points: [
        [0, -2, 0],
        [0, 2, 0],
      ],
    },
    {
      name: "parallel",
      points: [
        [-2, 0.05, 0],
        [2, 0.05, 0],
      ],
    },
    {
      name: "clearance",
      points: [
        [-2, 0.1, 0],
        [2, 0.1, 0],
      ],
    },
    {
      name: "inside-epsilon",
      points: [
        [-2, 0.0999995, 0],
        [2, 0.0999995, 0],
      ],
    },
    {
      name: "outside-epsilon",
      points: [
        [-2, 0.099998, 0],
        [2, 0.099998, 0],
      ],
    },
    {
      name: "layer",
      points: [
        [0, -2, 1],
        [0, 2, 1],
      ],
    },
    {
      name: "same-root",
      root: "horizontal",
      points: [
        [1, -2, 0],
        [1, 2, 0],
      ],
    },
    {
      name: "far-x",
      points: [
        [10, 0, 0],
        [12, 0, 0],
      ],
    },
    {
      name: "far-y",
      points: [
        [0, 10, 0],
        [0, 12, 0],
      ],
    },
    {
      name: "diagonal",
      points: [
        [10, 10, 0],
        [11, 11, 0],
      ],
    },
    {
      name: "multi-segment",
      points: [
        [-1, 0.02, 0],
        [0, 0.02, 0],
        [1, 0.02, 0],
      ],
    },
    {
      name: "large-left",
      points: [
        [1e15, 1e15, 0],
        [1e15 + 2, 1e15, 0],
      ],
      thickness: 0.5,
    },
    {
      name: "large-right",
      points: [
        [1e15, 1e15 + 0.25, 0],
        [1e15 + 2, 1e15 + 0.25, 0],
      ],
      thickness: 0.5,
    },
    {
      name: "nan-coordinate",
      points: [
        [NaN, 20, 0],
        [21, 20, 0],
      ],
    },
    {
      name: "infinite-coordinate",
      points: [
        [Infinity, 20, 0],
        [21, 20, 0],
      ],
    },
    {
      name: "infinite-radius",
      points: [
        [30, 20, 0],
        [31, 20, 0],
      ],
      thickness: Infinity,
    },
    {
      name: "nan-radius",
      points: [
        [40, 20, 0],
        [41, 20, 0],
      ],
      thickness: NaN,
    },
    {
      name: "rounded-endpoint",
      points: [
        [1e16, 0, 0],
        [1, 0, 0],
      ],
    },
    {
      name: "rounded-crossing",
      points: [
        [0, -1, 0],
        [0, 1, 0],
      ],
    },
  ]
  const routes: HighDensityRoute[] = specs.map(
    (spec): HighDensityRoute => ({
      connectionName: spec.name,
      rootConnectionName: spec.root ?? spec.name,
      traceThickness: spec.thickness ?? 0.1,
      viaDiameter: 0.3,
      route: spec.points.map(
        ([x, y, z]): { x: number; y: number; z: number } => ({ x, y, z }),
      ),
      vias: [],
    }),
  )
  const segments = segmentHelpers.collectProjectionSegments(routes)
  const exactDistanceCandidates =
    segmentHelpers.getProjectionSegmentDistanceCandidates
  const expectedViolations = new Set<string>()
  const expectedExactPairs = new Set<string>()
  let exhaustiveChecks = 0
  for (let leftIndex = 0; leftIndex < segments.length; leftIndex++) {
    const left = segments[leftIndex]!
    for (
      let rightIndex = leftIndex + 1;
      rightIndex < segments.length;
      rightIndex++
    ) {
      const right = segments[rightIndex]!
      if (
        left.z !== right.z ||
        left.rootConnectionName === right.rootConnectionName
      )
        continue
      exhaustiveChecks++
      const pair = `${left.routeIndex}:${right.routeIndex}`
      const [candidate] = exactDistanceCandidates(left, right)
      if (
        candidate &&
        getVectorLength(
          candidate.leftPoint.x - candidate.rightPoint.x,
          candidate.leftPoint.y - candidate.rightPoint.y,
        ) +
          1e-6 <
          left.traceRadius + right.traceRadius
      ) {
        expectedViolations.add(pair)
      }
      // Check near-boundary and nonfinite pairs still take the exact path.
      if (
        (left.routeIndex === 0 && right.routeIndex <= 5) ||
        (left.routeIndex >= 14 && left.routeIndex <= 17) ||
        (right.routeIndex >= 14 && right.routeIndex <= 17) ||
        (left.routeIndex === 18 && right.routeIndex === 19)
      ) {
        expectedExactPairs.add(pair)
      }
    }
  }
  const observedViolations = new Set<string>()
  const observedExactPairs = new Set<string>()
  const geometrySpy = spyOn(
    segmentHelpers,
    "getProjectionSegmentDistanceCandidates",
  )
  geometrySpy.mockImplementation(
    (left, right, epsilon): ReturnType<typeof exactDistanceCandidates> => {
      const result = exactDistanceCandidates(left, right, epsilon)
      const leftIndex = routes.findIndex((route) =>
        route.route.includes(left.start as HighDensityRoute["route"][number]),
      )
      const rightIndex = routes.findIndex((route) =>
        route.route.includes(right.start as HighDensityRoute["route"][number]),
      )
      const pair = `${leftIndex}:${rightIndex}`
      observedExactPairs.add(pair)
      const [candidate] = result
      if (
        candidate &&
        getVectorLength(
          candidate.leftPoint.x - candidate.rightPoint.x,
          candidate.leftPoint.y - candidate.rightPoint.y,
        ) +
          1e-6 <
          routes[leftIndex]!.traceThickness / 2 +
            routes[rightIndex]!.traceThickness / 2
      ) {
        observedViolations.add(pair)
      }
      return result
    },
  )
  try {
    expect(
      findAlignedTopologyCandidate(
        {
          originalRoutes: routes,
          guardedRoutes: routes,
          node: {
            capacityMeshNodeId: "test",
            center: { x: 0, y: 0 },
            width: 100,
            height: 100,
            portPoints: [],
          },
          crossingSelectors: [],
          protectedSelectors: [],
        },
        (_node, candidateRoutes): HighDensityRoute[] => candidateRoutes,
      ),
    ).toBeUndefined()
    expect([...observedViolations]).toEqual([...expectedViolations])
    expect(expectedViolations.size).toBeGreaterThan(0)
    expect(geometrySpy.mock.calls.length).toBeLessThan(exhaustiveChecks)
    expect(observedExactPairs.has("0:8")).toBe(false)
    expect(observedExactPairs.has("0:9")).toBe(false)
    for (const pair of expectedExactPairs)
      expect(observedExactPairs.has(pair)).toBe(true)
  } finally {
    geometrySpy.mockRestore()
  }
})
