"""Sensor platform for Toyota C-HR OBD."""
from __future__ import annotations

from homeassistant.components.sensor import SensorEntity
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant
from homeassistant.helpers.entity import DeviceInfo
from homeassistant.helpers.update_coordinator import CoordinatorEntity

from .const import DEFAULT_NAME, DOMAIN, PIDS


async def async_setup_entry(hass: HomeAssistant, entry: ConfigEntry, async_add_entities):
    coordinator = hass.data[DOMAIN][entry.entry_id]
    entities = [
        ChrObdSensor(coordinator, entry, key, name, unit, dclass, icon)
        for (_pid, (key, name, unit, dclass, icon, _n, _d)) in PIDS.items()
    ]
    # Derived DTC-count sensor.
    entities.append(
        ChrObdSensor(coordinator, entry, "dtc_count", "Fault Codes", None, None,
                     "mdi:alert-circle")
    )
    async_add_entities(entities)


class ChrObdSensor(CoordinatorEntity, SensorEntity):
    """A single OBD-derived sensor."""

    def __init__(self, coordinator, entry, key, name, unit, dclass, icon):
        super().__init__(coordinator)
        self._key = key
        self._attr_name = f"{DEFAULT_NAME} {name}"
        self._attr_unique_id = f"{entry.entry_id}_{key}"
        self._attr_native_unit_of_measurement = unit
        self._attr_device_class = dclass
        self._attr_icon = icon
        self._attr_device_info = DeviceInfo(
            identifiers={(DOMAIN, entry.entry_id)},
            name=DEFAULT_NAME,
            manufacturer="Toyota",
            model="C-HR (OBD-II)",
        )

    @property
    def native_value(self):
        return (self.coordinator.data or {}).get(self._key)

    @property
    def available(self) -> bool:
        # Available if we have ever read a value; the state may be stale when
        # the car is asleep, which is expected for an OBD source.
        return self._key in (self.coordinator.data or {})
