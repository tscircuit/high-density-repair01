import { expect, test } from "bun:test"
import "bun-match-svg"
import { HighDensityForceImproveSolver } from "lib/HighDensityForceImproveSolver"
import { renderRvboyFixedPointSvg } from "./fixtures/rvboy-fixed-point-svg"
import fixture from "./fixtures/rvboy-plated-hole-fixed-points.json"

test("RVboy plated-hole crossing retains its fixed boundary coordinates", async () => {
  // Exact cmn_1981 sample from RVboy's native Pipeline 9 force-improve input.
  // The plated hole carries this route from inner2 to top without a new via.
  const solver = new HighDensityForceImproveSolver(
    structuredClone(fixture) as ConstructorParameters<
      typeof HighDensityForceImproveSolver
    >[0],
  )
  solver.solve()
  expect(solver.solved).toBe(true)
  expect(solver.failed).toBe(false)

  const [output] = solver.getOutput()
  const input = fixture.hdRoutes[0]
  const node = fixture.nodeWithPortPoints[0]
  const bottom = node.center.y - node.height / 2

  await expect(renderRvboyFixedPointSvg(output.route[0])).toMatchSvgSnapshot(
    import.meta.path,
  )

  // Rounding y=27.7000108 to 27.7 moves the fixed entry outside the hole's
  // routing envelope, so downstream simplification loses through_obstacle.
  expect(output.route[0].y).toBeGreaterThanOrEqual(bottom - 1e-6)
  expect(output.route).toEqual(input.route as typeof output.route)
  expect(output.vias).toEqual([])
  expect(output).toMatchObject({ endPcbPortId: input.endPcbPortId })
})
