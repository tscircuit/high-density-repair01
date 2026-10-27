import { expect, test } from "bun:test"
import type { HighDensityRoute } from "../lib/types/high-density-types"
import { deriveVias } from "../lib/utils/force-improve-route-helpers"

test("derived drills keep their exact transition site and exclude pad barrels", (): void => {
  const route: HighDensityRoute = {
    connectionName: "physical-sites",
    traceThickness: 0.1,
    viaDiameter: 0.3,
    route: [
      { x: 0.123456789, y: 0.654321987, z: 0 },
      { x: 0.123456789, y: 0.654321987, z: 3 },
      {
        x: 1.123456789,
        y: 1.654321987,
        z: 3,
        toNextSegmentType: "through_obstacle",
      },
      { x: 1.123456789, y: 1.654321987, z: 0 },
    ],
    vias: [],
  }
  const original = structuredClone(route)
  expect(deriveVias(route)).toEqual([
    { x: 0.123456789, y: 0.654321987 },
  ])
  expect(route).toEqual(original)
})
