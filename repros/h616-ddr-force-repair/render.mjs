import { writeFileSync } from "node:fs"
import { RootCircuit } from "tscircuit"
import { convertCircuitJsonToPcbSvg } from "circuit-to-svg"
import { H616DdrBoard } from "./board"

const circuit = new RootCircuit()
circuit.add(H616DdrBoard())
await circuit.renderUntilSettled()
const circuitJson = circuit.getCircuitJson()
writeFileSync("circuit.json", JSON.stringify(circuitJson, null, 2))
writeFileSync(
  "board.svg",
  convertCircuitJsonToPcbSvg(circuitJson, {
    backgroundColor: "white",
    shouldDrawErrors: true,
    shouldDrawRatsNest: false,
  }),
)
