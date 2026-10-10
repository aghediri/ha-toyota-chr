# Toyota C-HR — 4G Telematics Box (always-connected) — Setup Guide

Always-connected car telemetry: ESP32+4G+GPS in the car pushes OBD + GPS data to
your Home Assistant over cellular via MQTT. Works when parked, driving, anywhere.

## Hardware (~€70-75, no monthly cost with 1NCE SIM)
- **LilyGO T-A7670G R2** (EU bands, WITH GPS) — ESP32 + A7670 4G Cat-1 + GNSS  (~€35)
- **Vgate iCar Pro 2S** BLE OBD dongle  (~€25)
- **LTE + GPS antennas** (dual kit for the board)  (~€8)
- **Data SIM** — 1NCE 10-year IoT SIM (~€10 once, 500MB) OR Free Mobile 2€/mo (FR)
- **12V->5V/3A car USB adapter** wired to switched/ignition 12V  (~€6)
- (optional) 3D-printed case from the firmware repo `3d-files/`

## Firmware: adlerre/obd2-mqtt  (purpose-built for HA)
Repo: https://github.com/adlerre/obd2-mqtt
Board environment to flash: **T-A7670X**

### Flash (easiest = Web Installer)
1. Open the repo's **Web Installer** (ESP Web Tools) in Chrome, plug the board via USB,
   select environment **T-A7670X**, flash firmware + filesystem.
   (CLI alternative: `pio run --target upload -e T-A7670X` then `--target uploadfs`.)

### Configure (captive portal)
2. After boot the board starts a Wi-Fi AP named **OBD2-MQTT-<MAC>**. Connect to it,
   open **http://192.168.4.1**.
3. Set:
   - **Wi-Fi**: leave blank (we use cellular) — or home Wi-Fi for updates
   - **Mobile/APN**: your SIM's APN
       - 1NCE APN: `iot.1nce.net`
       - Free Mobile FR APN: `free`
   - **ELM327**: pick the detected Vgate device; optionally set protocol = `6`
     (ISO 15765-4 CAN 11bit/500k) for faster init on the C-HR
   - **MQTT**: host = your HA IP `192.168.1.14`, port `1883`, your broker user/pass
   - **Sleep**: enable sleep timeout on ignition-off (e.g. sleep 15 min, wake to push)
4. Reboot. Sensors appear in HA automatically via MQTT discovery.

## Home Assistant side
### a) Install the broker (one-time)
- Settings -> Add-ons -> Add-on Store -> **Mosquitto broker** -> Install -> Start.
- Create an MQTT user (Settings -> People/Users or add in the add-on config).
- Settings -> Devices & Services -> **MQTT** integration -> it auto-detects the broker.

### b) Sensors (auto-discovered, prefix depends on firmware device name)
Standard profile publishes:
  fuelLevel, odometer, batteryVoltage (12V), coolantTemp, intakeTemp, ambientTemp,
  engineLoad, rpm, throttle, kmh, massAirFlow, fuelRate, oilTemp,
  avgSpeed, consumption, consumptionPer100, distanceDriven, checkEngineLight(DTC),
  + GPS location (device_tracker), GSM location, signalQuality, uptime, cpuTemp.

### c) Map
HA built-in **map card** uses OpenStreetMap tiles. The GPS feed becomes a
`device_tracker` / `sensor` with lat+lon → plots on OSM with history trail.

## Data usage
A push every 30-60s of a small JSON is a few MB/day — well within a 500MB/10yr 1NCE SIM
for occasional driving. Increase push interval if you want to save even more.

## Protecting the 12V battery
Power from a SWITCHED/ignition 12V if possible. If using the OBD port's always-on 12V,
rely on the firmware's sleep-on-ignition-off + periodic wake so you don't drain the
battery while parked for days.
