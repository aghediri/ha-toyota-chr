"""Binary sensor platform for Toyota C-HR OBD (connectivity)."""
from __future__ import annotations

from homeassistant.components.binary_sensor import (
    BinarySensorDeviceClass,
    BinarySensorEntity,
)
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant
from homeassistant.helpers.entity import DeviceInfo
from homeassistant.helpers.update_coordinator import CoordinatorEntity

from .const import DEFAULT_NAME, DOMAIN


async def async_setup_entry(hass: HomeAssistant, entry: ConfigEntry, async_add_entities):
    coordinator = hass.data[DOMAIN][entry.entry_id]
    async_add_entities([ChrObdOnline(coordinator, entry)])


class ChrObdOnline(CoordinatorEntity, BinarySensorEntity):
    """True when the adapter is in range and responding (car awake)."""

    _attr_device_class = BinarySensorDeviceClass.CONNECTIVITY

    def __init__(self, coordinator, entry):
        super().__init__(coordinator)
        self._attr_name = f"{DEFAULT_NAME} In Range"
        self._attr_unique_id = f"{entry.entry_id}_in_range"
        self._attr_icon = "mdi:bluetooth-connect"
        self._attr_device_info = DeviceInfo(
            identifiers={(DOMAIN, entry.entry_id)},
            name=DEFAULT_NAME,
            manufacturer="Toyota",
            model="C-HR (OBD-II)",
        )

    @property
    def is_on(self) -> bool:
        return bool(getattr(self.coordinator, "available", False))
