# XBOT Processor Architecture

## Purpose

The XBOT Intelligence Processor explores a hardware-style representation of selected XBOT intelligence signals.

The architecture separates **signal generation** from **signal combination**.

### Signal layer

The upstream XBOT intelligence stack can analyze blockchain information and produce normalized conditions. This repository models three example binary signals:

- Risk
- Liquidity
- Market

A value of `1` means the corresponding condition is active for the circuit input. A value of `0` means it is inactive.

### Logic layer

The three signals enter a NAND-based consensus network.

```text
        Risk ──────────┐
                       │
        Liquidity ─────┼──► Consensus Logic ───► OUT
                       │
        Market ────────┘
```

The logic implements a majority-of-three function.

## Design principle

The circuit is deterministic:

```text
same inputs → same output
```

No model inference occurs inside the NAND network.

This makes the circuit suitable as a transparent, auditable computational primitive within the broader XBOT concept.

## Future extension

Additional circuits can represent other deterministic combinations of intelligence signals, while software remains responsible for obtaining and interpreting the underlying blockchain data.
