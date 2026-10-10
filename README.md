# Toyota C-HR → Home Assistant (OBD-II via ESP32 bridge)

Live OBD-II telemetry from a **2019 Toyota C-HR** (1.8 hybrid) into
**Home Assistant**, using an **ESP32 as a Bluetooth bridge** to a Vgate iCar
Pro 2S BLE ELM327 dongle. No cloud, no Toyota Connected Services, no phone.

```
Toyota C-HR OBD-II  →  Vgate (BLE ELM327)  →  ESP32 (ESPHome, bridge)  →  WiFi  →  Home Assistant
```

The ESP32 is a **pure bridge**: it speaks ELM327 over BLE and decodes the PIDs
into clean numbers. **All** history, trips, economy, cost, alerts and the
dashboard live in Home Assistant. See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

> **Why a bridge?** The target HA host has no Bluetooth. The ESP32 supplies the
> BLE radio and runs the ELM327 state machine that HA can't. That's its whole job.

## What you get

- 13 decoded PIDs: RPM, speed, coolant / intake / ambient temp, engine load,
  throttle, fuel level, fuel rate, HV battery SoC, 12V battery, distance.
- Diagnostics: dongle-in-range, engine-running, WiFi signal (dBm + %),
  last-synced, ESP32 uptime.
- HA-derived metrics: liters used, smoothed L/100 km, estimated range,
  per-trip distance & economy, daily/weekly/monthly distance, weekly € cost.
- A parked-car-friendly **status + history dashboard** (built-in cards only —
  cannot white-screen).
- A low-12V-battery warning automation.

## Entity standard

Everything is `sensor.toyota_c_hr_*` / `binary_sensor.toyota_c_hr_*`. The
firmware defines the names; the package and dashboard consume them.

## Install

### 1. Flash the ESP32
1. HA → Settings → Add-ons → install **ESPHome Device Builder**.
2. ESPHome → **New device** → ESP32 → skip → **Edit** → paste
   [`esphome/chr_obd_esphome.yaml`](esphome/chr_obd_esphome.yaml).
3. In the ESPHome **Secrets editor**, add the keys from
   [`esphome/secrets.example.yaml`](esphome/secrets.example.yaml) with real values.
4. **Install** (USB the first time, OTA after). HA auto-discovers the device →
   Add. All `sensor.toyota_c_hr_*` entities appear.
5. **Enter the dongle MAC from Home Assistant's UI** (no YAML editing):
   HA → Settings → Devices → **Toyota C-HR** →
     - **OBD Dongle MAC** — type/paste the Vgate's BLE MAC
     - **Reconnect Dongle** — press to apply
   The MAC is saved in the ESP32's flash and re-applied automatically on every
   boot. Find the MAC with the **nRF Connect** phone app, then
   **disconnect/forget** the dongle on the phone (it allows only one BLE
   connection; a lingering pairing blocks the ESP32).

If BLE won't link, try the alternate UUIDs noted in the firmware
(`18F0 / 2AF0 / 2AF1`) instead of `FFF0 / FFF1 / FFF2`.

### 2. Add the HA logic package
1. In `configuration.yaml`:
   ```yaml
   homeassistant:
     packages: !include_dir_named packages
   ```
2. Copy [`homeassistant/packages/chr_obd.yaml`](homeassistant/packages/chr_obd.yaml)
   → `<HA config>/packages/chr_obd.yaml`.
3. Developer Tools → YAML → **Check config** → **Restart**.

### 3. Add the dashboard
Settings → Dashboards → New dashboard → open → Edit → ⋮ → **Raw configuration
editor** → paste [`homeassistant/dashboards/chr_dashboard.yaml`](homeassistant/dashboards/chr_dashboard.yaml) → Save.

## When does data flow?

Only when the ESP32 is powered **and** in BLE range of the Vgate **and** the car
is awake (ignition on / recently driven) **and** the ESP32 is in home-WiFi
range. A parked car's ECUs sleep, so sensors show last values / unavailable —
that's expected. Keep the ESP32 in the car; WiFi reach to the parking spot is
the real limiter (hence the WiFi-signal / last-synced sensors).

## Roadmap

- **Phase 1 (this repo):** BLE bridge, offline, home-WiFi only.
- **Phase 2:** 4G + GPS telematics (ESP32 + A7670E + data SIM, MQTT, map).
  See [docs/4g_telematics_phase2.md](docs/4g_telematics_phase2.md).

## Hardware

- 2019 Toyota C-HR (VIN NMTK33BX…, EU/France spec, 1st-gen hybrid)
- Vgate iCar Pro 2S (BLE ELM327)
- ESP32 dev board (esp32dev)

## License

MIT — see [LICENSE](LICENSE).
