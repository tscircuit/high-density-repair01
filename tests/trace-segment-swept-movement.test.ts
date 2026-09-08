import { expect, test } from "bun:test"
import { TraceSegmentMoveGuard } from "../lib/utils/TraceSegmentMoveGuard"

test("a trace cannot tunnel through foreign copper during one displacement", () => {
  for (const offset of [0, 10.123]) {
    const left = { x: offset - 1, y: -0.5 }
    const right = { x: offset - 1, y: 0.5 }
    const moving = {
      start: left,
      end: right,
      z: 0,
      traceRadius: 0.05,
      rootConnectionName: "moving",
    }
    const obstacle = {
      start: { x: offset, y: -2 },
      end: { x: offset, y: 2 },
      z: 0,
      traceRadius: 0.05,
      rootConnectionName: "fixed",
    }
    const guard = new TraceSegmentMoveGuard([moving, obstacle])
    // The requested final segment is clear, but getting there crosses the wire.
    const move = guard.constrain([left, right], 3, 0)
    expect(move.x).toBeGreaterThan(0.8)
    expect(move.x).toBeLessThanOrEqual(0.900002)
    expect(move.y).toBe(0)
    expect(left.x).toBe(offset - 1)
    expect(right.x).toBe(offset - 1)
    const sharedNetGuard = new TraceSegmentMoveGuard([
      moving,
      { ...obstacle, rootConnectionName: "moving" },
    ])
    expect(sharedNetGuard.constrain([left, right], 3, 0)).toEqual({
      x: 3,
      y: 0,
    })
    const otherLayerGuard = new TraceSegmentMoveGuard([
      moving,
      { ...obstacle, z: 1 },
    ])
    expect(otherLayerGuard.constrain([left, right], 3, 0)).toEqual({
      x: 3,
      y: 0,
    })
  }
})
