# TapeOut Deployment & Submission Reference

## XBOT processor

| Field | Value |
|---|---|
| Processor | **XBOT Intelligence Processor** |
| Symbol | **XBOT** |
| Network | **X Layer** |
| Protocol | **TapeOut** |
| Transistor supply / cap | **1,000,000,000** |
| Unit mint price | **0.009 OKB / transistor** |
| Deployment wallet | `0x456b2071c82c9c7ae84e0f5202e3da3d15fe42cc` |

## Participation requirements

The repository exposes the required submission information in a reviewer-friendly format:

### 01 — Processor deployment

**Requirement:** The processor must be deployed on X Layer through the TapeOut factory.

**XBOT reference:**

```text
Network: X Layer
Protocol: TapeOut
Processor: XBOT Intelligence Processor
```

Processor contract:

```text
0xa5fc69Ca2D3d462CCa204D894D85ac8071c4F0f0
```

### 02 — Public asset economics

**Requirement:** Transistor supply, unit price and any cap must be set and publicly disclosed at deployment.

**XBOT disclosure:**

```text
Supply / cap: 1,000,000,000 transistors
Unit mint price: 0.009 OKB / transistor
```

The supply is treated as the disclosed maximum transistor quantity for project documentation. Protocol fees are separate from the stated unit mint price.

### 03 — Circuit taped out

**Requirement:** At least one circuit must be taped out on the processor before the window closes.

**XBOT demonstrated circuit:**

```text
Circuit ID: 3.2.268
Network: X Layer
Use case: XBOT 2-of-3 Consensus
```

The circuit reference is included for documentation. The live TapeOut interface and on-chain records remain the source of truth for current circuit status and metadata.

### 04 — Clear use case

**Requirement:** The project must have a clear use case.

XBOT uses the TapeOut circuit as a deterministic consensus layer for three normalized intelligence signals:

```text
Risk + Liquidity + Market
          ↓
     NAND network
          ↓
   XBOT Consensus
       (2 of 3)
```

The circuit outputs `1` when at least two of the three inputs are high.

### 05 — Submission package

**Requirement:** Submit the processor contract address, deployment wallet, product demo and project description.

| Submission item | XBOT reference |
|---|---|
| Processor contract | `0xa5fc69Ca2D3d462CCa204D894D85ac8071c4F0f0` |
| Deployment wallet | `0x456b2071c82c9c7ae84e0f5202e3da3d15fe42cc` |
| Product demo | `demo/index.html` |
| Project description | `README.md` |
| Architecture | `docs/architecture.md` |
| Circuit documentation | `docs/circuit.md` |
| TapeOut reference | `3.2.268` |

## Contract references

### Processor

```text
0xa5fc69Ca2D3d462CCa204D894D85ac8071c4F0f0
```

### Transistors

```text
0x7bE7280e31984d18f62218519985EC5DcCa751De
```

## Important distinction

A circuit's existence/tape-out status and the opening of a circuit container are separate concepts.

This repository does **not** claim that the circuit container has been opened.

## Verification

For current status, reviewers should verify:

1. The processor contract on X Layer.
2. The disclosed supply and mint price against the deployment/protocol records.
3. The circuit reference `3.2.268` in TapeOut.
4. The deployment wallet used for the processor.
5. The live browser demo and its deterministic truth-table verification.

This document is a project submission reference, not a substitute for TapeOut or X Layer's live records.
