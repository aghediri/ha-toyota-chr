# Toyota C-HR OBD (Home Assistant / HACS)

Local Bluetooth integration that pulls live OBD-II data from a **Toyota C-HR**
(2019, 1st gen) into Home Assistant via a generic **ELM327 BLE adapter**
(e.g. **Vgate iCar Pro 2S**). No cloud, no MyToyota account, no phone app.

> **v1.0.0 — offline Bluetooth version.** The ESP32 route and the 4G/GPS
> always-connected version are tracked separately; this repo is the pure
> HA-native BLE integration.

## How it works

Home Assistant connects directly to the ELM327 BLE adapter plugged into the
car's OBD-II port, polls standard Mode 01 PIDs on an interval, and exposes them
as sensors. Because OBD only answers while the car is **awake** (ignition on /
recently driven) and the adapter is **in Bluetooth range**, values are the last
known readings when the car is parked — an `In Range` binary sensor tells you
when the data is live.

## Entities

| Entity | PID | Notes |
|---|---|---|
| Engine RPM | 01 0C | |
| Speed | 01 0D | km/h |
| Coolant Temp | 01 05 | °C |
| Intake Air Temp | 01 0F | °C |
| Ambient Temp | 01 46 | °C |
| Engine Load | 01 04 | % |
| Throttle | 01 11 | % |
| Fuel Level | 01 2F | % |
| HV Battery SoC | 01 5B | hybrid pack % |
| 12V Battery | 01 42 | module voltage |
| Fault Codes | 01 01 | stored DTC count |
| In Range | — | connectivity (car awake + adapter reachable) |

## Installation (HACS)

1. HACS → Integrations → ⋮ → **Custom repositories**.
2. Add `https://github.com/aghediri/ha-toyota-chr` as category **Integration**.
3. Install **Toyota C-HR OBD**, then restart Home Assistant.
4. Settings → Devices & Services → **Add Integration** → "Toyota C-HR OBD".
5. The flow suggests any discovered ELM327-style adapter; otherwise enter the
   adapter's **Bluetooth MAC** (find it with the nRF Connect phone app). Set the
   poll interval (default 30 s).

## Requirements

- A generic **ELM327 BLE** OBD adapter (Vgate iCar Pro 2S recommended).
  App-locked dongles (e.g. XTOOL AD20) are **not** supported — they don't expose
  the standard ELM327 interface.
- Home Assistant with a working **Bluetooth** adapter in range of the car.

## Notes

- First pair the adapter and **forget it on your phone** so it doesn't hold the
  single BLE connection open and block Home Assistant.
- The HV Battery SoC uses standard PID `01 5B`; enhanced Toyota `7E2` PIDs
  (voltage/current/temps) can be added in a later version.
- A sample Lovelace dashboard is in [`dashboard.yaml`](dashboard.yaml).

## Roadmap

- [ ] Enhanced Toyota hybrid PIDs (HV current, pack temps) via Mode 21 / 7E2
- [ ] Trip & consumption history helpers
- [ ] 4G + GPS always-connected variant (telematics)

## License

MIT — see [LICENSE](LICENSE).
