import { expect, test } from "bun:test"
import {
  runDrcCheck,
  runDrcCheckBruteForce,
  type DrcCheckResult,
} from "../lib/drc-check"
import type { NodeHdRoute, NodeWithPortPoints } from "../lib/types/types"

const createRoute = (
  connectionName: string,
  route: NodeHdRoute["route"],
  vias: NodeHdRoute["vias"] = [],
  rootConnectionName = connectionName,
): NodeHdRoute => ({
  capacityMeshNodeId: "sample-drc",
  connectionName,
  rootConnectionName,
  traceThickness: 0.1,
  viaDiameter: 0.3,
  route,
  vias,
})

const createNodeWithPortPoints = (
  portPoints: NodeWithPortPoints["portPoints"],
): NodeWithPortPoints => ({
  capacityMeshNodeId: "sample-drc",
  center: { x: 0, y: 0 },
  width: 4,
  height: 4,
  availableZ: [0, 1],
  portPoints,
})

const expectBothCheckers = (
  nodeWithPortPoints: NodeWithPortPoints,
  routes: NodeHdRoute[],
  check: (result: DrcCheckResult) => void,
) => {
  check(runDrcCheck(nodeWithPortPoints, routes))
  check(runDrcCheckBruteForce(nodeWithPortPoints, routes))
}

test("runDrcCheck reports same-layer trace crossings", () => {
  const nodeWithPortPoints = createNodeWithPortPoints([
    {
      connectionName: "conn00",
      portPointId: "pp0",
      rootConnectionName: "conn00",
      x: -1,
      y: 0,
      z: 0,
    },
    {
      connectionName: "conn00",
      portPointId: "pp1",
      rootConnectionName: "conn00",
      x: 1,
      y: 0,
      z: 0,
    },
    {
      connectionName: "conn01",
      portPointId: "pp2",
      rootConnectionName: "conn01",
      x: 0,
      y: -1,
      z: 0,
    },
    {
      connectionName: "conn01",
      portPointId: "pp3",
      rootConnectionName: "conn01",
      x: 0,
      y: 1,
      z: 0,
    },
  ])

  expectBothCheckers(
    nodeWithPortPoints,
    [
      createRoute("conn00", [
        { x: -1, y: 0, z: 0 },
        { x: 1, y: 0, z: 0 },
      ]),
      createRoute("conn01", [
        { x: 0, y: -1, z: 0 },
        { x: 0, y: 1, z: 0 },
      ]),
    ],
    (result) => {
      expect(result.ok).toBe(false)
      expect(result.issues.some((issue) => issue.kind === "trace-trace")).toBe(
        true,
      )
    },
  )
})

test("runDrcCheck reports via overlaps with traces", () => {
  const nodeWithPortPoints = createNodeWithPortPoints([
    {
      connectionName: "conn00",
      portPointId: "pp0",
      rootConnectionName: "conn00",
      x: -1,
      y: 0,
      z: 0,
    },
    {
      connectionName: "conn00",
      portPointId: "pp1",
      rootConnectionName: "conn00",
      x: 1,
      y: 0,
      z: 0,
    },
    {
      connectionName: "conn01",
      portPointId: "pp2",
      rootConnectionName: "conn01",
      x: 0.3,
      y: -1.5,
      z: 0,
    },
    {
      connectionName: "conn01",
      portPointId: "pp3",
      rootConnectionName: "conn01",
      x: 0.3,
      y: 1.5,
      z: 0,
    },
  ])

  expectBothCheckers(
    nodeWithPortPoints,
    [
      createRoute("conn00", [
        { x: -1, y: 0, z: 0 },
        { x: 1, y: 0, z: 0 },
      ]),
      createRoute(
        "conn01",
        [
          { x: 0.3, y: -1.5, z: 0 },
          { x: 0.3, y: 1.5, z: 0 },
        ],
        [{ x: 0, y: 0.05 }],
      ),
    ],
    (result) => {
      expect(result.ok).toBe(false)
      expect(result.issues.some((issue) => issue.kind === "via-trace")).toBe(
        true,
      )
    },
  )
})

test("runDrcCheck ignores collisions on the same root net", () => {
  const nodeWithPortPoints = createNodeWithPortPoints([
    {
      connectionName: "conn00",
      portPointId: "pp0",
      rootConnectionName: "root00",
      x: -1,
      y: 0,
      z: 0,
    },
    {
      connectionName: "conn00",
      portPointId: "pp1",
      rootConnectionName: "root00",
      x: 1,
      y: 0,
      z: 0,
    },
    {
      connectionName: "conn01",
      portPointId: "pp2",
      rootConnectionName: "root00",
      x: 0,
      y: -1,
      z: 0,
    },
    {
      connectionName: "conn01",
      portPointId: "pp3",
      rootConnectionName: "root00",
      x: 0,
      y: 1,
      z: 0,
    },
  ])

  expectBothCheckers(
    nodeWithPortPoints,
    [
      createRoute(
        "conn00",
        [
          { x: -1, y: 0, z: 0 },
          { x: 1, y: 0, z: 0 },
        ],
        [],
        "root00",
      ),
      createRoute(
        "conn01",
        [
          { x: 0, y: -1, z: 0 },
          { x: 0, y: 1, z: 0 },
        ],
        [],
        "root00",
      ),
    ],
    (result) => {
      expect(result.ok).toBe(true)
      expect(result.issues).toHaveLength(0)
    },
  )
})

test("runDrcCheck rejects vias whose diameter crosses the node boundary", () => {
  const nodeWithPortPoints = createNodeWithPortPoints([
    {
      connectionName: "conn00",
      portPointId: "pp0",
      rootConnectionName: "conn00",
      x: -2,
      y: 0,
      z: 0,
    },
    {
      connectionName: "conn00",
      portPointId: "pp1",
      rootConnectionName: "conn00",
      x: 2,
      y: 0,
      z: 0,
    },
  ])

  expectBothCheckers(
    nodeWithPortPoints,
    [
      createRoute(
        "conn00",
        [
          { x: -2, y: 0, z: 0 },
          { x: 2, y: 0, z: 0 },
        ],
        [{ x: 1.95, y: 0 }],
      ),
    ],
    (result) => {
      expect(result.ok).toBe(false)
      expect(
        result.issues.some(
          (issue) =>
            issue.kind === "out-of-bounds" && issue.pointType === "via",
        ),
      ).toBe(true)
    },
  )
})
