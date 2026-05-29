import type { HighDensityRepair01Input } from "lib/types/types"

export const cmn632Fixture = {
  adjacentObstacles: [],
  connMap: {
    idToNetMap: {},
    netMap: {},
  },
  nodeHdRoutes: [
    {
      capacityMeshNodeId: "cmn_632",
      connectionName: "source_trace_216",
      rootConnectionName: "source_trace_216",
      route: [
        {
          x: -18.999999999999993,
          y: -24.475,
          z: 0,
        },
        {
          x: -18.825,
          y: -24,
          z: 0,
        },
      ],
      traceThickness: 0.15,
      viaDiameter: 0.3,
      vias: [],
    },
  ],
  nodeWithPortPoints: {
    availableZ: [0],
    capacityMeshNodeId: "cmn_632",
    center: {
      x: -18.824999999999996,
      y: -24,
    },
    height: 0.9499999999999993,
    portPoints: [
      {
        connectionName: "source_trace_216",
        portPointId: "ce323_pp0_z0::0",
        rootConnectionName: "source_trace_216",
        x: -18.999999999999993,
        y: -24.475,
        z: 0,
      },
      {
        connectionName: "source_trace_216",
        portPointId: "tiny-terminal:end-port:source_trace_216",
        rootConnectionName: "source_trace_216",
        x: -18.825,
        y: -24,
        z: 0,
      },
    ],
    width: 0.8000000000000007,
  },
} satisfies HighDensityRepair01Input
