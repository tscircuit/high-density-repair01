import inputEntries from "./highDensityForceImproveSolver_input.fixture.json"
import { GenericSolverDebugger } from "@tscircuit/solver-utils/react"
import { HighDensityForceImproveSolver } from "lib/HighDensityForceImproveSolver"

const createSolver = () => {
  return new HighDensityForceImproveSolver((inputEntries as any[])[0]) as any
}

export default (
  <GenericSolverDebugger
    createSolver={createSolver}
    onSolverCompleted={(solver) => {
      const output = solver.getOutput()
      console.log("HighDensityForceImproveSolver output", output)
      console.log("HighDensityForceImproveSolver hdRoutes[2]", output?.[2])
      console.log("HighDensityForceImproveSolver hdRoutes[5]", output?.[5])
      console.log("HighDensityForceImproveSolver hdRoutes[6]", output?.[6])
    }}
  />
)
