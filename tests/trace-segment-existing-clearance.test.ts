import { expect, test } from "bun:test"
import { TraceSegmentMoveGuard } from "../lib/utils/TraceSegmentMoveGuard"

test("force movement improves existing copper overlap without worsening it", () => {
  const points = [
    { x: -0.07, y: -0.5 },
    { x: -0.07, y: 0.5 },
  ]
  const guard = new TraceSegmentMoveGuard([
    {
      start: points[0]!,
      end: points[1]!,
      z: 0,
      traceRadius: 0.05,
      rootConnectionName: "moving",
    },
    {
      start: { x: 0, y: -2 },
      end: { x: 0, y: 2 },
      z: 0,
      traceRadius: 0.05,
      rootConnectionName: "fixed",
    },
  ])
  const worsening = guard.constrain(points, 0.03, 0)
  expect(worsening.x).toBeLessThanOrEqual(0.000002)
  const improving = guard.constrain(points, -0.2, 0)
  expect(improving).toEqual({ x: -0.2, y: 0 })
  for (const point of points) point.x += improving.x
  const returning = guard.constrain(points, 0.25, 0)
  expect(returning.x).toBeGreaterThan(0.19999)
  expect(returning.x).toBeLessThanOrEqual(0.200002)
})
