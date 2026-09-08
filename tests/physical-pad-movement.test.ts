import { expect, test } from "bun:test"
import { ConnectivityMap } from "circuit-json-to-connectivity-map"
import type { FixedObstacle } from "../lib/types/FixedObstacle"
import {
  TraceSegmentMoveGuard,
  type Segment,
} from "../lib/utils/TraceSegmentMoveGuard"

test("wire movement respects physical pad clearance and same-net aliases", (): void => {
  for (const type of ["rect", "oval"] as const) {
    for (const angle of [0, Math.PI / 3]) {
      const transform = (x: number, y: number): { x: number; y: number } => ({
        x: 3 + x * Math.cos(angle) - y * Math.sin(angle),
        y: -4 + x * Math.sin(angle) + y * Math.cos(angle),
      })
      const a = transform(-0.4, 0.2)
      const b = transform(0.4, 0.2)
      const segment: Segment = {
        start: a,
        end: b,
        z: 0,
        traceRadius: 0.05,
        rootConnectionName: "signal",
      }
      const obstacle: FixedObstacle = {
        type,
        center: transform(0, -0.5),
        width: 2,
        height: 1,
        ccwRotationDegrees: (angle * 180) / Math.PI,
        zLayers: [0],
        connectedTo: ["pad_alias"],
      }
      const dx = Math.sin(angle) * 0.3
      const dy = -Math.cos(angle) * 0.3
      const connMap = new ConnectivityMap({})
      const guard = new TraceSegmentMoveGuard([segment], undefined, {
        obstacles: [obstacle],
        traceClearance: 0.1,
        connMap,
      })
      const move = guard.constrain([a, b], dx, dy)
      const localY =
        0.2 - move.x * Math.sin(angle) + move.y * Math.cos(angle)
      expect(localY - 0.05).toBeGreaterThanOrEqual(0.1 - 1e-9)
      expect(localY).toBeLessThan(0.2)
      expect(a).toEqual(transform(-0.4, 0.2))
      expect(b).toEqual(transform(0.4, 0.2))
      const aliasMap = new ConnectivityMap({})
      aliasMap.addConnections([["signal", "pad_alias"]])
      const sameNetGuard = new TraceSegmentMoveGuard([segment], undefined, {
        obstacles: [obstacle],
        traceClearance: 0.1,
        connMap: aliasMap,
      })
      expect(sameNetGuard.constrain([a, b], dx, dy)).toEqual({ x: dx, y: dy })
    }
  }
})
