"""Minimal ELM327-over-BLE client for the Toyota C-HR OBD integration.

Talks to a generic ELM327 BLE adapter (e.g. Vgate iCar Pro 2S) using
Home Assistant's bluetooth stack via bleak. Sends AT init + Mode 01 PID
queries and parses the hex responses. Designed for polling, not streaming.
"""
from __future__ import annotations

import asyncio
import logging

from bleak import BleakClient
from bleak.backends.device import BLEDevice

_LOGGER = logging.getLogger(__name__)

# Common Nordic-UART-style service used by most ELM327 BLE clones.
# Overridable if a given adapter differs (see options flow).
WRITE_UUID = "0000fff2-0000-1000-8000-00805f9b34fb"
NOTIFY_UUID = "0000fff1-0000-1000-8000-00805f9b34fb"

INIT_COMMANDS = ["ATZ", "ATE0", "ATL0", "ATS0", "ATH0", "ATSP0"]


class ELM327BLE:
    """A tiny request/response ELM327 BLE wrapper."""

    def __init__(self, device: BLEDevice,
                 write_uuid: str = WRITE_UUID,
                 notify_uuid: str = NOTIFY_UUID):
        self._device = device
        self._write_uuid = write_uuid
        self._notify_uuid = notify_uuid
        self._client: BleakClient | None = None
        self._buffer = bytearray()
        self._response = asyncio.Event()

    async def __aenter__(self):
        await self.connect()
        return self

    async def __aexit__(self, *exc):
        await self.disconnect()

    def _on_notify(self, _char, data: bytearray):
        self._buffer += data
        if b">" in data:          # ELM327 prompt => response complete
            self._response.set()

    async def connect(self):
        self._client = BleakClient(self._device)
        await self._client.connect()
        await self._client.start_notify(self._notify_uuid, self._on_notify)
        for cmd in INIT_COMMANDS:
            await self._send(cmd)
            await asyncio.sleep(0.1)

    async def disconnect(self):
        if self._client and self._client.is_connected:
            try:
                await self._client.stop_notify(self._notify_uuid)
            except Exception:  # noqa: BLE001
                pass
            await self._client.disconnect()
        self._client = None

    async def _send(self, cmd: str, timeout: float = 3.0) -> str:
        """Send a command, wait for the '>' prompt, return the raw ASCII reply."""
        assert self._client is not None
        self._buffer = bytearray()
        self._response.clear()
        await self._client.write_gatt_char(
            self._write_uuid, (cmd + "\r").encode(), response=False
        )
        try:
            await asyncio.wait_for(self._response.wait(), timeout)
        except asyncio.TimeoutError:
            _LOGGER.debug("ELM327 timeout on %s", cmd)
        return self._buffer.decode(errors="ignore")

    async def query_pid(self, pid: str, n_bytes: int):
        """Query a Mode 01 PID; return a list of data bytes or None."""
        raw = await self._send("01" + pid)
        # Response looks like: '41 0C 1A F8' ; strip spaces/newlines
        tokens = raw.replace("\r", " ").replace("\n", " ").split()
        # Find the '41' response header then the echoed pid
        try:
            i = tokens.index("41")
        except ValueError:
            return None
        if i + 1 >= len(tokens) or tokens[i + 1].upper() != pid.upper():
            return None
        data = tokens[i + 2:i + 2 + n_bytes]
        if len(data) < n_bytes:
            return None
        try:
            return [int(x, 16) for x in data]
        except ValueError:
            return None

    async def read_dtc_count(self) -> int | None:
        """Mode 01 PID 01 byte A bit7 + count in low bits = number of DTCs."""
        raw = await self._send("0101")
        tokens = raw.replace("\r", " ").split()
        try:
            i = tokens.index("41")
            a = int(tokens[i + 2], 16)
            return a & 0x7F
        except (ValueError, IndexError):
            return None
