import { expect, test } from "bun:test"
import { runForceDirectedImprovement } from "lib/HighDensityForceImproveSolver"
import type { HighDensityRoute } from "lib/types/high-density-types"
import fixture from "./fixtures/sample24-cmn746-before-force-improve.json"

test("the actual six cmn746 routes retain fixed copper before any force step", () => {
  const node = fixture.nodeWithPortPoints
  const input: HighDensityRoute[] = structuredClone(fixture.hdRoutes)
  const snapshot = structuredClone(input)
  const result = runForceDirectedImprovement(
    {
      minX: node.center.x - node.width / 2,
      maxX: node.center.x + node.width / 2,
      minY: node.center.y - node.height / 2,
      maxY: node.center.y + node.height / 2,
    },
    input,
    0,
    { includeForceVectors: false },
  )
  expect(result.stepsCompleted).toBe(0)
  expect(result.routes).toHaveLength(6)
  for (const [index, route] of result.routes.entries()) {
    const original = snapshot[index]!
    expect(route.connectionName).toBe(original.connectionName)
    expect(route.rootConnectionName).toBe(original.rootConnectionName)
    expect(route.traceThickness).toBe(original.traceThickness)
    expect(route.viaDiameter).toBe(original.viaDiameter)
    for (const pointIndex of [
      0,
      1,
      original.route.length - 2,
      original.route.length - 1,
    ]) {
      expect(route.route[pointIndex]).toEqual(original.route[pointIndex])
    }
    const expectedVias = route.route.slice(1).flatMap((point, pointIndex) => {
      const previous = route.route[pointIndex]!
      return previous.z !== point.z &&
        previous.x === point.x &&
        previous.y === point.y
        ? [{ x: previous.x, y: previous.y }]
        : []
    })
    expect(route.vias).toEqual(expectedVias)
  }
  expect(input).toEqual(snapshot)
})
