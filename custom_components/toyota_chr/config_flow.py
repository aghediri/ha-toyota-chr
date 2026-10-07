"""Config flow for Toyota C-HR OBD."""
from __future__ import annotations

import voluptuous as vol

from homeassistant import config_entries
from homeassistant.components.bluetooth import (
    BluetoothServiceInfoBleak,
    async_discovered_service_info,
)
from homeassistant.core import callback

from .const import (
    CONF_MAC,
    CONF_SCAN_INTERVAL,
    DEFAULT_NAME,
    DEFAULT_SCAN_INTERVAL,
    DOMAIN,
)

# ELM327 BLE clones commonly advertise these name prefixes.
ELM_NAME_HINTS = ("vlink", "vgate", "obd", "elm327", "ios-vlink")


class ChrObdConfigFlow(config_entries.ConfigFlow, domain=DOMAIN):
    """Handle a config flow for the Toyota C-HR OBD adapter."""

    VERSION = 1

    def __init__(self):
        self._discovered: dict[str, str] = {}

    async def async_step_bluetooth(self, discovery_info: BluetoothServiceInfoBleak):
        """Handle a Bluetooth discovery."""
        await self.async_set_unique_id(discovery_info.address)
        self._abort_if_unique_id_configured()
        self._discovered = {discovery_info.address: discovery_info.name or "OBD"}
        return await self.async_step_user()

    async def async_step_user(self, user_input=None):
        errors: dict = {}
        if user_input is not None:
            mac = user_input[CONF_MAC].strip().upper()
            await self.async_set_unique_id(mac, raise_on_progress=False)
            self._abort_if_unique_id_configured()
            return self.async_create_entry(
                title=DEFAULT_NAME,
                data={
                    CONF_MAC: mac,
                    CONF_SCAN_INTERVAL: user_input.get(
                        CONF_SCAN_INTERVAL, DEFAULT_SCAN_INTERVAL
                    ),
                },
            )

        # Offer discovered ELM327-looking adapters as suggestions.
        for info in async_discovered_service_info(self.hass):
            name = (info.name or "").lower()
            if any(h in name for h in ELM_NAME_HINTS):
                self._discovered.setdefault(info.address, info.name or "OBD")

        default_mac = next(iter(self._discovered), "")
        schema = vol.Schema(
            {
                vol.Required(CONF_MAC, default=default_mac): str,
                vol.Optional(
                    CONF_SCAN_INTERVAL, default=DEFAULT_SCAN_INTERVAL
                ): vol.All(int, vol.Range(min=5, max=600)),
            }
        )
        placeholders = {"found": ", ".join(self._discovered.values()) or "none"}
        return self.async_show_form(
            step_id="user", data_schema=schema, errors=errors,
            description_placeholders=placeholders,
        )

    @staticmethod
    @callback
    def async_get_options_flow(config_entry):
        return ChrObdOptionsFlow(config_entry)


class ChrObdOptionsFlow(config_entries.OptionsFlow):
    def __init__(self, config_entry):
        self.config_entry = config_entry

    async def async_step_init(self, user_input=None):
        if user_input is not None:
            return self.async_create_entry(title="", data=user_input)

        data = self.config_entry.data
        opts = self.config_entry.options
        schema = vol.Schema(
            {
                vol.Optional(
                    CONF_SCAN_INTERVAL,
                    default=opts.get(
                        CONF_SCAN_INTERVAL,
                        data.get(CONF_SCAN_INTERVAL, DEFAULT_SCAN_INTERVAL),
                    ),
                ): vol.All(int, vol.Range(min=5, max=600)),
            }
        )
        return self.async_show_form(step_id="init", data_schema=schema)
