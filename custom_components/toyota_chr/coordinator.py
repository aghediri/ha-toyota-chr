"""Data update coordinator for Toyota C-HR OBD."""
from __future__ import annotations

import logging
from datetime import timedelta

from homeassistant.components import bluetooth
from homeassistant.core import HomeAssistant
from homeassistant.helpers.update_coordinator import DataUpdateCoordinator, UpdateFailed

from .const import PIDS
from .elm327 import ELM327BLE

_LOGGER = logging.getLogger(__name__)


class ChrObdCoordinator(DataUpdateCoordinator):
    """Polls the ELM327 BLE adapter for OBD data.

    The car is only reachable when awake (ignition on / recently driven) AND
    the adapter is in BLE range. When unreachable we keep the last values and
    expose availability so the UI can show 'asleep / out of range'.
    """

    def __init__(self, hass: HomeAssistant, mac: str, scan_interval: int):
        super().__init__(
            hass, _LOGGER, name="toyota_chr",
            update_interval=timedelta(seconds=scan_interval),
        )
        self._mac = mac
        self._hass = hass
        self.available = False

    async def _async_update_data(self):
        device = bluetooth.async_ble_device_from_address(
            self._hass, self._mac, connectable=True
        )
        if device is None:
            # Adapter not advertising -> car asleep / out of range. Keep last data.
            self.available = False
            _LOGGER.debug("C-HR OBD adapter %s not in range", self._mac)
            return self.data or {}

        values: dict = dict(self.data or {})
        try:
            async with ELM327BLE(device) as elm:
                for pid, (key, _n, _u, _dc, _ic, nbytes, decode) in PIDS.items():
                    raw = await elm.query_pid(pid, nbytes)
                    if raw is not None:
                        try:
                            values[key] = decode(raw)
                        except Exception as err:  # noqa: BLE001
                            _LOGGER.debug("decode %s failed: %s", key, err)
                dtc = await elm.read_dtc_count()
                if dtc is not None:
                    values["dtc_count"] = dtc
            self.available = True
        except Exception as err:  # noqa: BLE001
            # Connection dropped mid-poll -> treat as unavailable, keep last data.
            self.available = False
            _LOGGER.debug("C-HR OBD poll failed: %s", err)
            if not self.data:
                raise UpdateFailed(f"Could not read OBD adapter: {err}") from err

        return values
