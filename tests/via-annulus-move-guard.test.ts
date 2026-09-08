import { expect, test } from "bun:test"
import {
  TraceSegmentMoveGuard,
  type Segment,
} from "../lib/utils/TraceSegmentMoveGuard"

test("force movement preserves via clearance without tunneling or blocking opening moves", () => {
  const center = { x: 0, y: 0 }
  const via: Segment = {
    start: center,
    end: center,
    z: 0,
    traceRadius: 0.15,
    rootConnectionName: "via-net",
    isVia: true,
    clearance: 0.1,
  }
  const wire: Segment = {
    start: { x: -1, y: -0.4 },
    end: { x: 1, y: -0.4 },
    z: 0,
    traceRadius: 0.05,
    rootConnectionName: "wire-net",
  }
  const guard = new TraceSegmentMoveGuard([via, wire])
  const move = guard.constrain([wire.start, wire.end], 0, 0.8)
  expect(wire.start.y + move.y).toBeLessThanOrEqual(-0.3 + 1e-5)
  expect(move.y).toBeGreaterThan(0.09)

  const other = { ...wire, z: 1 }
  expect(
    new TraceSegmentMoveGuard([via, other]).constrain([center], 0, -1),
  ).toEqual({ x: 0, y: -1 })
  const sameNet = { ...wire, rootConnectionName: "via-net" }
  expect(
    new TraceSegmentMoveGuard([via, sameNet]).constrain([center], 0, -1),
  ).toEqual({ x: 0, y: -1 })

  const neighbor = { x: 1, y: 0 }
  const disk = {
    ...via,
    start: neighbor,
    end: neighbor,
    rootConnectionName: "foreign",
  }
  const diskMove = new TraceSegmentMoveGuard([via, disk]).constrain(
    [center],
    2,
    0,
  )
  expect(diskMove.x).toBeLessThanOrEqual(0.6 + 1e-5)
  expect(diskMove.x).toBeGreaterThan(0.59)

  const close = {
    ...wire,
    start: { x: -1, y: -0.2 },
    end: { x: 1, y: -0.2 },
  }
  const closeGuard = new TraceSegmentMoveGuard([via, close])
  expect(closeGuard.constrain([center], 0, -0.2).y).toBeGreaterThanOrEqual(
    -1e-5,
  )
  expect(closeGuard.constrain([center], 0, 0.2)).toEqual({ x: 0, y: 0.2 })

  const rotatingMove = guard.constrain([wire.end], 0, 2)
  const bx = wire.end.x,
    by = wire.end.y + rotatingMove.y
  const ex = bx - wire.start.x,
    ey = by - wire.start.y
  const t = Math.max(
    0,
    Math.min(
      1,
      -(wire.start.x * ex + wire.start.y * ey) / (ex * ex + ey * ey),
    ),
  )
  expect(
    Math.hypot(wire.start.x + t * ex, wire.start.y + t * ey),
  ).toBeGreaterThanOrEqual(0.3 - 1e-5)
})
