# Architecture

```
   Toyota C-HR OBD-II port
         │  (CAN bus — ISO 15765-4, 11-bit, 500 kbit/s)
         ▼
   Vgate iCar Pro 2S            ELM327 reader on the OBD-II port.
   (BLE ELM327 dongle)          Talks CAN to the car, BLE to the ESP32.
         │  BLE (GATT)
         ▼
   ESP32  (ESPHome firmware)    PURE BRIDGE.
                                • BLE client to the Vgate (ble_elm327).
                                • Decodes each PID with a one-line formula.
                                • Publishes clean numbers over the native API.
                                • Holds NO state, NO history, NO logic.
                                • Dongle MAC is entered from HA's UI (a text
                                  field + Reconnect button on the device page),
                                  saved in flash, re-applied on boot. No YAML.
         │  WiFi (ESPHome native API)
         ▼
   Home Assistant               ALL the intelligence.
   (homeserver, 192.168.1.14)   • Stores history.
                                • Derives trips, economy, range, cost.
                                • Warning automations (12V drain).
                                • The status + history dashboard.
```

## Why this split

OBD over ELM327 is **not** a clean byte stream you can relay. Getting one
reading means: run the ELM327 init sequence (`ATZ`, `ATE0`, `ATSP6`, …), send a
PID request (`01 0C`), parse the ASCII-hex reply (`41 0C 1A F8`), apply a
formula (`((A*256)+B)/4` → RPM). That ELM327 state machine has to live
*somewhere* that speaks BLE — and the homeserver has **no Bluetooth**. So the
ESP32 owns exactly that irreducible job and nothing more.

Everything you actually care about — history, trips, L/100 km, EV ratio, €
cost, alerts, the dashboard — lives in Home Assistant, versioned in this repo.
That keeps "the ESP32 is just a bridge" true in the way that matters: fix a
formula in the repo and OTA-reflash; change a metric, a cost, or the dashboard
and it's a pure HA/package edit.

## Entity standard

Every entity the firmware emits is `sensor.toyota_c_hr_*` /
`binary_sensor.toyota_c_hr_*`. The HA package and dashboard key off those exact
names, so the firmware is the single source of truth for naming.

## Repo layout

```
esphome/
  chr_obd_esphome.yaml      Flat firmware — the 13 decoded PIDs + diagnostics.
  secrets.example.yaml      Template for WiFi / AP / OTA secrets.
homeassistant/
  packages/chr_obd.yaml     Derived metrics, trips, cost, 12V alert.
  dashboards/chr_dashboard.yaml  Status + history dashboard (built-in cards).
docs/
  ARCHITECTURE.md           This file.
  hybrid_pids.md            Verified Toyota hybrid (7E2) PID reference.
  4g_telematics_phase2.md   Future GPS/4G path (not started).
```

## Data flow conditions

Data moves only when **all** of these hold:
- ESP32 powered (12V→USB, ideally ignition-switched) and in BLE range of the Vgate,
- the **car is awake** (ignition on / recently driven — a parked car's ECUs sleep),
- the ESP32 is in home-WiFi range.

Otherwise sensors show their last value or go unavailable — expected for a
parked car. The WiFi-signal and last-synced sensors exist to help you find a
parking spot with reach.
