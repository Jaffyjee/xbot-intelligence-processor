# XBOT Consensus Circuit

## Inputs

| Pin | Meaning |
|---|---|
| IN0 | Risk |
| IN1 | Liquidity |
| IN2 | Market |

## Output

| Pin | Meaning |
|---|---|
| OUT0 | XBOT Consensus |

## Rule

`OUT0 = 1` when at least two of `IN0`, `IN1`, and `IN2` are high.

## Boolean form

```text
OUT = (IN0 & IN1) | (IN0 & IN2) | (IN1 & IN2)
```

## NAND-only form

```text
N1 = NAND(IN0, IN1)
N2 = NAND(IN0, IN2)
N3 = NAND(IN1, IN2)
N4 = NAND(N1, N2)
N5 = NAND(N4, N4)
OUT = NAND(N5, N3)
```

## TapeOut reference

Circuit ID:

```text
3.2.268
```

Network:

```text
X Layer
```

The repository documents the logical design. TapeOut remains the authoritative source for the deployed circuit's on-chain netlist and circuit-specific metadata.
