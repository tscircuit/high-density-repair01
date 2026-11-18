import { expect, test } from "bun:test"
import type { GraphicsObject } from "graphics-debug"
import { readFileSync } from "node:fs"
import { gunzipSync } from "node:zlib"
import { HighDensityForceImproveSolver } from "lib/HighDensityForceImproveSolver"

type Circle = NonNullable<GraphicsObject["circles"]>[number]
type ButterStickForceFixture = {
  params: ConstructorParameters<typeof HighDensityForceImproveSolver>[0]
  fixedVias: { x: number; y: number; radius: number }[]
}

test("ButterStick force clamping beside a completed data-byte via", async (): Promise<void> => {
  const fixture: ButterStickForceFixture = JSON.parse(
    gunzipSync(
      new Uint8Array(
        readFileSync(
          new URL(
            "./fixtures/butterstick-fixed-via-clamp.json.gz",
            import.meta.url,
          ),
        ),
      ),
    ).toString("utf8"),
  )
  const solver = new HighDensityForceImproveSolver(fixture.params)
  solver.solve()
  expect(solver.solved).toBeTrue()

  const graphics = solver.visualize()
  const node = fixture.params.nodeWithPortPoints[0]!
  const contextMargin = fixture.params.hdRoutes[0]!.viaDiameter * 2
  const fixedCircles = fixture.fixedVias
    .filter(
      (via): boolean =>
        Math.abs(via.x - node.center.x) <= node.width / 2 + contextMargin &&
        Math.abs(via.y - node.center.y) <= node.height / 2 + contextMargin,
    )
    .map(
      (via): Circle => ({
        center: { x: via.x, y: via.y },
        radius: via.radius,
        stroke: "#c2410c",
        fill: "rgba(249, 115, 22, 0.15)",
      }),
    )
  graphics.circles!.push(...fixedCircles)
  graphics.rects = [
    {
      center: node.center,
      width: node.width,
      height: node.height,
      stroke: "#94a3b8",
    },
  ]
  await expect(graphics).toMatchGraphicsSvg(import.meta.path)
})
