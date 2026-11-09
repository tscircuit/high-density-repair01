Real DDR subsystem from [Allwinner H616 Devboard](https://github.com/Kononenko-K/Allwinner_H616_Devboard/blob/94fe1071ff3d7c2e6a227a3e4dfccb6acae305c4/Hardware/H616_DDR3/H616_devboard.kicad_pcb).

`board.tsx` preserves all 384 pads on U1, U2, R4 and C7, their native placements,
four copper layers, manufactured DDR widths (0.093/0.0975 mm), 0.35/0.15 mm
via pad/drill and 0.1 mm clearance. It requests 53 DDR signals, routing the
two data bytes before the remaining signals. Original copper is removed;
power, VREF and ZQ are outside this signal-routing experiment.

Captured using `tscircuit@0.0.3124`, Core `0.0.2309`, capacity-autorouter
`0.0.1063` and bus-lanes-solver `0.0.49`, without routing caches.
`tests/fixtures/h616-ddr-force-input.json` is the unmodified `cmn_2` force-repair
input from that TSX/Core run: 33 routes and 3,844 vertices. The SVG test renders
the actual solver output for this region. It does not claim the complete DDR
board is routed or timing-qualified.

Run the isolated repro from the repository root:

```sh
bun test tests/h616-ddr-force-repair.test.ts --timeout 9999999
```

To run the complete TSX board with the pinned published package:

```sh
cd repros/h616-ddr-force-repair
bun install
bun run render
```

Baseline isolated-region runtime: 251.4 seconds. The complete native board hits
the 120-second render limit in force repair. This SVG is a region diagnostic,
not a DRC-clean board output.
