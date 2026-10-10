# Toyota C-HR — Hybrid Custom OBD PIDs (verified reference)

Your 2019 C-HR (TNGA, 1.8 hybrid) exposes HV battery data over OBD. The
clutch.engineering/Pelican C-HR reference confirms support for **State of Charge,
HV battery min/max SOC, battery temperatures, 12V battery current/temp**, and fan
data on 2016–2026 C-HR. Raw hex below is the community Torque/ABRP set for Toyota
TNGA hybrids (Prius/Corolla/C-HR share the HV ECU addressing).

## How Toyota hybrid PIDs are addressed
- **ECU header:** `7E2` (request) → the Hybrid/HV ECU answers on `7EA`.
  (Engine ECU is `7E0`/`7E8`; some values live on `7E3`.)
- **Mode:** `21` (Toyota enhanced) or `22` (UDS, 2-byte DID). TNGA hybrids
  mostly use **Mode 21** with a 1-byte PID.
- In an ELM327 session you set the header with `ATSH7E2`, then send the PID.
- Response byte offset matters — the useful byte(s) sit at a fixed offset in
  the reply frame (shown as A/B/C… = 1st/2nd/3rd data byte).

## Verified hybrid PID set (Mode 21, header 7E2)

| Metric | Mode | PID | Header | Formula | Unit | Notes |
|---|---|---|---|---|---|---|
| **HV Battery SOC** | 21 | `98` | 7E2 | `A * 100 / 255` | % | Primary state-of-charge. Most reliable. |
| HV Battery SOC (alt) | 21 | `5B` | 7E2 | `A * 100 / 255` | % | Standard Mode 01 `015B` also works on many C-HRs |
| HV Battery Voltage | 21 | `3D` | 7E2 | `(A*256 + B) * 0.5 ... ` | V | Pack voltage; scale varies, verify |
| HV Battery Current | 21 | `3E` | 7E2 | `((A*256+B) - 32768) / 100` | A | Signed: + = charge, − = discharge |
| HV Battery Temp 1 | 21 | `87` | 7E2 | `A - 40` | °C | Module temp sensor 1 |
| HV Battery Temp 2 | 21 | `88` | 7E2 | `A - 40` | °C | Module temp sensor 2 |
| Delta SOC (max−min) | 21 | `99` | 7E2 | `A * 100 / 255` | % | Pack balance health |

### Standard Mode 01 that also works (no header change needed)
| Metric | Mode | PID | Formula | Unit |
|---|---|---|---|---|
| Hybrid/EV battery SOC | 01 | `5B` | `A * 100 / 255` | % |
| Hybrid battery pack remaining life | 01 | `5B` | `A * 100 / 255` | % |

## ⚠️ Verification procedure (do once with the dongle)
Because the exact PID byte can differ slightly by firmware, verify SOC against the
dash EV-bar before trusting it:
1. In an ELM327 terminal app (or via the ESPHome logs), send:
   ```
   ATSH7E2
   2198
   ```
   The reply looks like: `61 98 XX ...` — the byte after `61 98` is **A**.
   Compute `A*100/255`; it should read ~40–80% and track the dash hybrid bar.
2. If `2198` returns `NO DATA`, try `015B` (standard) — on many EU C-HRs this is
   the one that answers.
3. Current (`213E`): watch the sign flip when you brake (regen = charging = +)
   vs accelerate (discharge = −). If reversed, negate the formula.

## Recommended: start with the SIMPLE, GUARANTEED one
For first boot, enable **only** the standard `01 5B` SOC PID (no header juggling).
Once confirmed, add the `7E2` enhanced ones for voltage/current/temps.
