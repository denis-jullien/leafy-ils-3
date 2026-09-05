# Reader bridge

Small Node program for the PC that is wired to the RFID reader. Browsers cannot open
TCP sockets, and only Chromium can open serial ports, so this bridge does it and hands
the reads to the circulation page over a WebSocket on `localhost`.

```sh
cd tools/reader-bridge
npm install
node index.js --serial /dev/ttyUSB0 --baud 9600     # RS232 / USB-serial reader
node index.js --tcp 192.168.1.50:10001              # Ethernet reader
node index.js                                       # no reader: type codes on stdin to test
```

Then open the circulation page, expand **Readers**, and enable the bridge with
`ws://localhost:8787`. The setting is remembered per browser.

## Protocol

Messages are JSON, one per WebSocket frame:

```json
{ "type": "scan", "code": "E00401234567ABCD", "reader": "/dev/ttyUSB0" }
```

The bridge assumes the reader sends one code per line. Readers that speak a binary
protocol (Feig ISO host mode, for example) need a parser function in `index.js`;
select it with `--parser <name>`.

Running it at login: on Windows use Task Scheduler, on Linux a user systemd unit, on
a Raspberry Pi the same. Keep it on `127.0.0.1`; nothing else should talk to it.
