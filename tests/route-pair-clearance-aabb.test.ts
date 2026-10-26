import { expect, test } from "bun:test"
import type { HighDensityRoute } from "lib/types/high-density-types"
import {
  collectProjectionSegments,
  getProjectionSegmentDistanceCandidates,
} from "lib/utils/force-improve-segment-helpers"
import { getVectorLength } from "lib/utils/getVectorLength"
import { getRoutePairClearanceViolations } from "lib/utils/high-density-force-improve-topology"

type RoutePair = readonly [number, number]
type Point = { x: number; y: number; z: number }

const createRoute = (
  name: string,
  points: Point[],
  width = 0.2,
  root = name,
): HighDensityRoute => {
  return {
    connectionName: name,
    rootConnectionName: root,
    route: points,
    traceThickness: width,
    viaDiameter: 0.3,
    vias: [],
  }
}

// The original unfiltered predicate is the differential oracle. It intentionally
// evaluates every eligible pair with the unchanged exact witness calculation.
const getUnfilteredViolations = (routes: HighDensityRoute[]): RoutePair[] => {
  const segments = collectProjectionSegments(routes)
  const pairs: RoutePair[] = []
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
      ) {
        continue
      }
      const [candidate] = getProjectionSegmentDistanceCandidates(left, right)
      if (!candidate) continue
      const distance = getVectorLength(
        candidate.leftPoint.x - candidate.rightPoint.x,
        candidate.leftPoint.y - candidate.rightPoint.y,
      )
      if (distance + 1e-6 < left.traceRadius + right.traceRadius) {
        const pair: RoutePair =
          left.routeIndex < right.routeIndex
            ? [left.routeIndex, right.routeIndex]
            : [right.routeIndex, left.routeIndex]
        if (!pairs.some(([a, b]) => a === pair[0] && b === pair[1])) {
          pairs.push(pair)
        }
      }
    }
  }
  return pairs
}

const shiftPositiveUlps = (value: number, count: number): number => {
  const bytes = new ArrayBuffer(8)
  const view = new DataView(bytes)
  view.setFloat64(0, value)
  const bits = view.getBigUint64(0)
  view.setBigUint64(0, bits + BigInt(count))
  return view.getFloat64(0)
}

test("clearance boxes preserve the original ordered predicate across scales and boundaries", () => {
  const scenes: HighDensityRoute[][] = []
  for (const shift of [-2, -1, 0, 1, 2]) {
    const gap = shiftPositiveUlps(0.2 - 1e-6, shift)
    scenes.push([
      createRoute("lower", [
        { x: 0, y: 0, z: 0 },
        { x: 1, y: 0, z: 0 },
      ]),
      createRoute("upper", [
        { x: 0, y: gap, z: 0 },
        { x: 1, y: gap, z: 0 },
      ]),
    ])
  }
  for (const offset of [0, 1e8, 1e12]) {
    for (const shift of [-2, -1, 0, 1, 2]) {
      const ordinate = shiftPositiveUlps(offset + 0.2, shift)
      scenes.push([
        createRoute("lower", [
          { x: offset, y: offset, z: 0 },
          { x: offset + 4, y: offset, z: 0 },
        ]),
        createRoute("upper", [
          { x: offset, y: ordinate, z: 0 },
          { x: offset + 4, y: ordinate, z: 0 },
        ]),
      ])
    }
  }
  scenes.push([
    createRoute("horizontal", [
      { x: -1e6, y: 0, z: 0 },
      { x: 1e6, y: 0, z: 0 },
    ]),
    createRoute("vertical", [
      { x: 0, y: -1e6, z: 0 },
      { x: 0, y: 1e6, z: 0 },
    ]),
    createRoute(
      "same-root",
      [
        { x: 0, y: -1, z: 0 },
        { x: 0, y: 1, z: 0 },
      ],
      0.2,
      "horizontal",
    ),
    createRoute("other-layer", [
      { x: -1, y: 0, z: 1 },
      { x: 1, y: 0, z: 1 },
    ]),
    createRoute("zero-length", [
      { x: 0, y: 0, z: 0 },
      { x: 0, y: 0, z: 0 },
    ]),
  ])
  scenes.push([
    createRoute(
      "wide",
      [
        { x: -10, y: 0, z: 0 },
        { x: 10, y: 0, z: 0 },
      ],
      4,
    ),
    createRoute(
      "narrow",
      [
        { x: -10, y: 1.9, z: 0 },
        { x: 10, y: 1.9, z: 0 },
      ],
      0.1,
    ),
    createRoute("near-degenerate", [
      { x: 0, y: 0, z: 0 },
      { x: 0.00101, y: 0, z: 0 },
    ]),
  ])
  expect(getUnfilteredViolations(scenes[20]!)).toEqual([
    [0, 1],
    [1, 2],
  ])
  expect(getUnfilteredViolations(scenes[21]!)).toEqual([
    [0, 1],
    [0, 2],
  ])

  let seed = 0x57b026a1
  const nextNumber = (): number => {
    seed ^= seed << 13
    seed ^= seed >>> 17
    seed ^= seed << 5
    return (seed >>> 0) / 0x100000000
  }
  for (const scale of [0.01, 1, 1e8, 1e100, 1e200]) {
    for (let iteration = 0; iteration < 400; iteration++) {
      const routes: HighDensityRoute[] = []
      for (let index = 0; index < 4; index++) {
        const z = index === 3 ? 1 : 0
        const x = (nextNumber() - 0.5) * scale
        const y = (nextNumber() - 0.5) * scale
        const points: Point[] = [
          { x, y, z },
          {
            x: x + (nextNumber() - 0.5) * scale,
            y: y + (nextNumber() - 0.5) * scale,
            z,
          },
          {
            x: x + (nextNumber() - 0.5) * scale,
            y: y + (nextNumber() - 0.5) * scale,
            z,
          },
        ]
        routes.push(
          createRoute(
            `route${index}`,
            points,
            scale * (0.01 + nextNumber() * 0.3),
          ),
        )
      }
      scenes.push(routes)
    }
  }
  for (const routes of scenes) {
    const before = structuredClone(routes)
    expect(getRoutePairClearanceViolations(routes)).toEqual(
      getUnfilteredViolations(routes),
    )
    expect(routes).toEqual(before)
  }
})
