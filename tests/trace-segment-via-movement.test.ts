import { expect, test } from "bun:test"
import { TraceSegmentMoveGuard } from "../lib/utils/TraceSegmentMoveGuard"

test("a moving via preserves both incident layer constraints", () => {
  const top = { x: 0, y: 0 }
  const bottom = { x: 0, y: 0 }
  const segments = [
    {
      start: { x: -1, y: 0 },
      end: top,
      z: 0,
      traceRadius: 0.05,
      rootConnectionName: "via-net",
    },
    {
      start: bottom,
      end: { x: 0, y: 1 },
      z: 1,
      traceRadius: 0.05,
      rootConnectionName: "via-net",
    },
    {
      start: { x: 0.15, y: 0.2 },
      end: { x: 0.15, y: 0.8 },
      z: 1,
      traceRadius: 0.05,
      rootConnectionName: "foreign",
    },
  ]
  const guard = new TraceSegmentMoveGuard(segments)
  const move = guard.constrain([top, bottom], 0.4, 0)
  expect(move.x).toBeGreaterThan(0.05)
  expect(move.x).toBeLessThan(0.1)
  for (const point of [top, bottom]) {
    point.x += move.x
    point.y += move.y
  }
  expect(top).toEqual(bottom)
  const tangentMove = guard.constrain([top, bottom], 0, -0.1)
  expect(tangentMove.y).toBe(-0.1)
})
