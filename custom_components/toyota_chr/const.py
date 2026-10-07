"""Constants for the Toyota C-HR OBD integration."""

DOMAIN = "toyota_chr"

CONF_MAC = "mac"
CONF_SCAN_INTERVAL = "scan_interval"

DEFAULT_SCAN_INTERVAL = 30          # seconds
DEFAULT_NAME = "Toyota C-HR"

# Standard OBD-II (Mode 01) PIDs supported on the 2019 C-HR.
# key: (mode, pid, name, unit, device_class, icon, decode)
# decode is applied to the raw data bytes list -> value.
MODE01 = "01"

def _dec_rpm(b):      # ((A*256)+B)/4
    return round(((b[0] << 8) + b[1]) / 4.0, 0)
def _dec_speed(b):    # A
    return b[0]
def _dec_temp(b):     # A-40
    return b[0] - 40
def _dec_percent(b):  # A*100/255
    return round(b[0] * 100.0 / 255.0, 0)
def _dec_volt(b):     # ((A*256)+B)/1000
    return round(((b[0] << 8) + b[1]) / 1000.0, 2)

# Each PID entry: pid hex (str), friendly key, name, unit, device_class, icon, n_bytes, decoder
PIDS = {
    "0C": ("rpm", "Engine RPM", "rpm", None, "mdi:engine", 2, _dec_rpm),
    "0D": ("speed", "Speed", "km/h", "speed", "mdi:speedometer", 1, _dec_speed),
    "05": ("coolant_temp", "Coolant Temp", "°C", "temperature", "mdi:coolant-temperature", 1, _dec_temp),
    "0F": ("intake_temp", "Intake Air Temp", "°C", "temperature", "mdi:air-filter", 1, _dec_temp),
    "46": ("ambient_temp", "Ambient Temp", "°C", "temperature", "mdi:thermometer", 1, _dec_temp),
    "04": ("engine_load", "Engine Load", "%", None, "mdi:gauge", 1, _dec_percent),
    "11": ("throttle", "Throttle", "%", None, "mdi:car-cruise-control", 1, _dec_percent),
    "2F": ("fuel_level", "Fuel Level", "%", None, "mdi:fuel", 1, _dec_percent),
    "5B": ("hv_battery_soc", "HV Battery SoC", "%", "battery", "mdi:car-electric", 1, _dec_percent),
    "42": ("module_voltage", "12V Battery", "V", "voltage", "mdi:car-battery", 2, _dec_volt),
}
