import { expect, test } from "bun:test"
import type { HighDensityIntraNodeRoute } from "../lib/types/types"
import { simplifyRoute } from "../lib/utils/simplify"

test("simplifyRoute preserves colocated endpoint layer transitions and vias", () => {
  const route: HighDensityIntraNodeRoute = {
    capacityMeshNodeId: "node_1",
    connectionName: "net_endpoint_via",
    rootConnectionName: "net_endpoint_via",
    traceThickness: 0.15,
    viaDiameter: 0.3,
    route: [
      { x: 0.123456, y: 1.234567, z: 0 },
      { x: 0.123456, y: 1.234567, z: 1 },
      { x: 4.123456, y: 1.234567, z: 1 },
      { x: 4.123456, y: 1.234567, z: 0 },
    ],
    vias: [
      { x: 0.123456, y: 1.234567 },
      { x: 4.123456, y: 1.234567 },
    ],
  }

  const simplified = simplifyRoute(route, 4)

  expect(simplified.route[0]).toEqual({ x: 0.123456, y: 1.234567, z: 0 })
  expect(simplified.route[1]).toEqual({ x: 0.123456, y: 1.234567, z: 1 })
  expect(simplified.route.at(-2)).toEqual({ x: 4.123456, y: 1.234567, z: 1 })
  expect(simplified.route.at(-1)).toEqual({ x: 4.123456, y: 1.234567, z: 0 })
  expect(simplified.vias).toEqual([
    { x: 0.123456, y: 1.234567 },
    { x: 4.123456, y: 1.234567 },
  ])

  for (let i = 0; i < simplified.route.length - 1; i += 1) {
    const start = simplified.route[i]!
    const end = simplified.route[i + 1]!
    if (start.z !== end.z) {
      expect(start.x).toBe(end.x)
      expect(start.y).toBe(end.y)
    }
  }
})
