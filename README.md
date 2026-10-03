<div align="center">

<img src="assets/xbot-logo.svg" alt="XBOT logo" width="140">

# XBOT Intelligence Processor

**On-chain digital logic for XBOT intelligence — deployed on X Layer through TapeOut.**

</div>

XBOT Intelligence Processor is an experimental digital-logic processor inspired by the XBOT AI intelligence stack. It translates multiple intelligence signals into deterministic logic that can be represented as a TapeOut circuit.

The first demonstrated intelligence primitive is an **XBOT Consensus** circuit: three binary signals — Risk, Liquidity, and Market — are combined into a **2-of-3 consensus output**.

## Project at a glance

| Property | Value |
|---|---|
| Processor | XBOT Intelligence Processor |
| Symbol | XBOT |
| Network | X Layer |
| Protocol | TapeOut |
| Transistor supply | 1,000,000,000 |
| Mint price | 0.009 OKB / transistor |
| Processor contract | `0xa5fc69Ca2D3d462CCa204D894D85ac8071c4F0f0` |
| Transistor contract | `0x7bE7280e31984d18f62218519985EC5DcCa751De` |
| Demonstrated circuit | `3.2.268` |
| Logic primitive | NAND |
| Memory primitive | LATCH |

## What this project demonstrates

The processor explores a simple hardware-style representation of blockchain intelligence:

```text
Risk ───────────┐
                │
Liquidity ──────┼──► NAND logic ───► XBOT Consensus
                │
Market ────────┘

                 2-of-3
```

The output is **1 when at least two inputs are 1**.

This is a deterministic digital-logic primitive, not an AI model by itself. The intended architecture is that higher-level XBOT software can produce or interpret intelligence signals while the circuit provides a transparent logic layer for combining those signals.

## XBOT Consensus truth table

| Risk | Liquidity | Market | Consensus |
|---:|---:|---:|---:|
| 0 | 0 | 0 | 0 |
| 1 | 0 | 0 | 0 |
| 0 | 1 | 0 | 0 |
| 0 | 0 | 1 | 0 |
| 1 | 1 | 0 | 1 |
| 1 | 0 | 1 | 1 |
| 0 | 1 | 1 | 1 |
| 1 | 1 | 1 | 1 |

Equivalent Boolean function:

```text
Consensus = (Risk AND Liquidity)
         OR (Risk AND Market)
         OR (Liquidity AND Market)
```

The repository's browser demo implements the same truth table and lets reviewers test every combination.

## NAND implementation

A NAND-only construction can implement the 2-of-3 function without requiring an AND or OR primitive.

One logical construction is:

```text
N1 = NAND(Risk, Liquidity)
N2 = NAND(Risk, Market)
N3 = NAND(Liquidity, Market)
N4 = NAND(N1, N2)
N5 = NAND(N4, N4)
OUT = NAND(N5, N3)
```

The exact transistor/netlist count used by TapeOut is determined by the TapeOut circuit/netlist itself. The repository does **not** substitute a software gate count for the on-chain circuit's reported burn requirement.

## TapeOut circuit

The project has a demonstrated TapeOut circuit identified as:

```text
3.2.268
```

The circuit was designed around:

- 3 input signals
- 1 consensus output
- NAND-based digital logic
- X Layer as the tape-out network

### Processor

```text
0xa5fc69Ca2D3d462CCa204D894D85ac8071c4F0f0
```

### Transistors

```text
0x7bE7280e31984d18f62218519985EC5DcCa751De
```

## Repository structure

```text
.
├── README.md
├── LICENSE
├── assets/
│   └── xbot-logo.svg
├── docs/
│   ├── architecture.md
│   ├── circuit.md
│   └── tapeout.md
└── demo/
    ├── index.html
    └── app.js
```

## Run the demo

No Node.js, package manager, API key, or build system is required.

1. Open `demo/index.html` in a browser.
2. Set Risk, Liquidity, and Market to 0 or 1.
3. The demo calculates the XBOT Consensus output.
4. Use **Run all cases** to verify all eight truth-table combinations.

The demo is intentionally deterministic and runs entirely in the browser.

## Why this matters

The broader XBOT architecture contains software agents and blockchain analysis components. This processor project explores a complementary idea: representing a small, auditable part of a decision pipeline as digital logic.

That separation is intentional:

```text
XBOT AI / Blockchain Intelligence
              │
              ▼
     Intelligence Signals
     ┌────────┼────────┐
     ▼        ▼        ▼
    Risk  Liquidity  Market
     └────────┼────────┘
              ▼
       XBOT Consensus
              ▼
       TapeOut Circuit
```

The circuit does not claim to replace the XBOT AI backend. It demonstrates how selected binary signals can be combined through deterministic logic.

## Hackathon integration map

The demo is designed to make the project's technical surface easy to inspect:

| Evaluation area | What reviewers can inspect |
|---|---|
| Application innovation | XBOT intelligence signals reduced to a deterministic 2-of-3 hardware-style consensus primitive |
| TapeOut ecosystem integration | NAND transistor primitives, wired netlist, taped-out circuit reference `3.2.268`, and circuit-oriented asset lifecycle |
| Product completeness / UX | Interactive signal controls, live NAND path visualization, eight-state verification, responsive interface, and proof links |
| Asset issuance design | 1B disclosed transistor supply, 0.009 OKB unit price, ERC-1155 transistor asset, and circuit creation through TapeOut |
| X Layer integration | X Layer deployment network plus directly inspectable processor and transistor contract addresses |
| User growth potential | A reusable primitive that can be extended into additional XBOT circuits and used as a black-box building block |
| Contract security / economics | Deterministic client verification, explicit contract addresses, no client-side secrets, disclosed supply/price, and an explicit note that the project is experimental and unaudited |

### Important economic note

At the disclosed fixed price, a simple theoretical upper bound of full-supply gross mint consideration is:

`1,000,000,000 × 0.009 OKB = 9,000,000 OKB`

This is a mathematical cap based on the published supply and unit price, **not a revenue projection** and does not account for protocol fees or actual mint demand.

### Security posture

The browser demo intentionally has no wallet private keys, seed phrases, API secrets, or signing credentials. Its logic is deterministic and can be checked against the eight-state truth table. The repository does not claim a third-party security audit; reviewers should inspect the deployed contracts and TapeOut protocol behavior directly.

## Development roadmap

### Completed
- [x] XBOT processor deployed on X Layer
- [x] Supply and mint price disclosed
- [x] NAND/LATCH transistor primitives obtained
- [x] XBOT Consensus logic designed
- [x] TapeOut circuit `3.2.268` documented
- [x] Browser truth-table demo
- [x] XBOT brand asset added to the repository

### Next
- [ ] Add additional intelligence circuits
- [ ] Connect selected XBOT analysis outputs to circuit-oriented signal definitions
- [ ] Add reproducible circuit/netlist documentation for future designs
- [ ] Expand the browser demo with additional logic primitives

## Security and transparency

This repository contains documentation and a local deterministic demo. It does **not** contain:

- private keys
- seed phrases
- API secrets
- wallet signing credentials
- production environment variables

Never commit secrets to this repository.

## Disclaimer

XBOT Intelligence Processor is an experimental software and digital-logic project. The consensus circuit is a deterministic logic demonstration and is not financial advice, a trading strategy, or a guarantee of token performance.

## Links

- [XBOT Intelligence Processor on GitHub](https://github.com/Jaffyjee/xbot-intelligence-processor)
- [TapeOut](https://www.tapeout.net/)
- [X Layer](https://www.okx.com/xlayer)
