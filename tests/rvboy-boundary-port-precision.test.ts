import { expect, test } from "bun:test"
import { readFileSync } from "node:fs"
import { gunzipSync } from "node:zlib"
import "bun-match-svg"
import { getSvgFromGraphicsObject } from "graphics-debug"
import { HighDensityForceImproveSolver } from "lib/HighDensityForceImproveSolver"

test("RVboy fixed boundary ports retain clearance through force improvement", async (): Promise<void> => {
  const input = JSON.parse(
    gunzipSync(
      readFileSync(
        new URL(
          "./fixtures/rvboy-boundary-port-precision.json.gz",
          import.meta.url,
        ),
      ),
    ).toString(),
  )
  const original = JSON.stringify(input)
  const before = new HighDensityForceImproveSolver(structuredClone(input))
  const after = new HighDensityForceImproveSolver({
    ...structuredClone(input),
    preserveTopologyPortAnchors: true,
  })
  before.solve()
  after.solve()
  expect(after.solved).toBeTrue()
  expect(JSON.stringify(input)).toBe(original)
  for (const [index, route] of after.getOutput().entries()) {
    expect(route.route[0]).toEqual(input.hdRoutes[index].route[0])
    expect(route.route.at(-1)).toEqual(input.hdRoutes[index].route.at(-1))
  }
  // The 0.6 mm diagonal fixed trace has x+y=-19.8. Its minimum
  // legal foreign center is 0.3 + 0.05 + 0.1 mm away.
  const endpoint = (solver: HighDensityForceImproveSolver) =>
    solver
      .getOutput()
      .flatMap((route) => [route.route[0], route.route.at(-1)!])
      .find(
        (point) =>
          point.z === 0 &&
          point.x === -23.5 &&
          Math.abs(point.y - 3.064) < 0.001,
      )!
  const clearance = (solver: HighDensityForceImproveSolver): number =>
    Math.abs(endpoint(solver).x + endpoint(solver).y + 19.8) / Math.SQRT2 - 0.35
  expect(clearance(before)).toBeLessThan(0.1)
  expect(clearance(after)).toBeGreaterThanOrEqual(0.1)
  const viewbox = { minX: -23.501, maxX: -23.499, minY: 3.0628, maxY: 3.0645 }
  for (const [name, solver] of [
    ["before", before],
    ["after", after],
  ] as const) {
    // The solve uses the complete original region. Only the rendering is cropped.
    const limit = -19.8 - 0.45 * Math.SQRT2
    await expect(
      getSvgFromGraphicsObject(
        {
          rects: [
            {
              center: { x: -23.5, y: 3.06365 },
              width: 0.002,
              height: 0.0017,
              fill: "none",
              stroke: "none",
            },
          ],
          lines: [
            {
              points: [
                { x: viewbox.minX, y: limit - viewbox.minX },
                { x: viewbox.maxX, y: limit - viewbox.maxX },
              ],
              strokeColor: "#64748b",
              strokeWidth: 0.000015,
            },
          ],
          circles: [
            {
              center: endpoint(solver),
              radius: 0.00008,
              fill: name === "before" ? "#dc2626" : "#16a34a",
            },
          ],
        },
        {
          svgWidth: 800,
          svgHeight: 680,
          backgroundColor: "white",
          includeTextLabels: false,
        },
      ),
    ).toMatchSvgSnapshot(import.meta.path, name)
  }
})
