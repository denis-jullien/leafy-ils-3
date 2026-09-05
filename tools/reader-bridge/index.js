#!/usr/bin/env node
/**
 * Leafy reader bridge.
 *
 * Runs on the PC (or Raspberry Pi) that is physically wired to the RFID reader.
 * It opens the reader (serial or TCP), turns each read into one code, and
 * broadcasts it to every browser tab connected on ws://localhost:8787.
 * The circulation page connects to that socket (see "Local reader bridge").
 *
 *   node index.js --serial /dev/ttyUSB0 --baud 9600
 *   node index.js --tcp 192.168.1.50:10001
 *
 * Framing: one code per line (CR/LF terminated) by default. Vendor protocols
 * that do not speak plain lines get a parser in parsers/ and --parser <name>.
 */
import { WebSocketServer } from 'ws';
import net from 'node:net';

const args = Object.fromEntries(
	process.argv
		.slice(2)
		.map((a, i, arr) => (a.startsWith('--') ? [a.slice(2), arr[i + 1] ?? true] : null))
		.filter(Boolean)
);

const PORT = Number(args.port ?? 8787);
const parsers = {
	/** Default: raw line is the code. Strips whitespace and common "UID:" style prefixes. */
	line: (line) => {
		const s = line.trim().replace(/^(uid|tag|id)\s*[:=]\s*/i, '');
		return s || null;
	}
};
const parse = parsers[args.parser ?? 'line'];
if (!parse) {
	console.error(`Unknown parser "${args.parser}". Available: ${Object.keys(parsers).join(', ')}`);
	process.exit(2);
}

/* ---- WebSocket side (browser) ---------------------------------------- */
const wss = new WebSocketServer({ host: '127.0.0.1', port: PORT });
const readerName = args.serial ?? args.tcp ?? 'none';
wss.on('connection', (ws) => {
	ws.send(JSON.stringify({ type: 'hello', reader: readerName }));
});
wss.on('listening', () => console.log(`bridge listening on ws://localhost:${PORT}`));

function broadcast(msg) {
	const data = JSON.stringify(msg);
	for (const c of wss.clients) if (c.readyState === c.OPEN) c.send(data);
}

let lastCode = '';
let lastAt = 0;
function emitLine(line) {
	const code = parse(line);
	if (!code) return;
	// Readers repeat a tag many times per second while it sits on the pad.
	const now = Date.now();
	if (code === lastCode && now - lastAt < 1500) return;
	lastCode = code;
	lastAt = now;
	console.log('scan', code);
	broadcast({ type: 'scan', code, reader: readerName });
}

function lineSplitter(onLine) {
	let pending = '';
	return (chunk) => {
		pending += chunk.toString('utf8');
		let i;
		while ((i = pending.search(/\r|\n/)) >= 0) {
			onLine(pending.slice(0, i));
			pending = pending.slice(i + 1);
		}
	};
}

/* ---- Reader side ------------------------------------------------------ */
if (args.serial) {
	const { SerialPort } = await import('serialport');
	const port = new SerialPort({ path: String(args.serial), baudRate: Number(args.baud ?? 9600) });
	port.on('open', () => console.log(`serial ${args.serial} open`));
	port.on('data', lineSplitter(emitLine));
	port.on('error', (e) => broadcast({ type: 'error', message: e.message }));
} else if (args.tcp) {
	const [host, p] = String(args.tcp).split(':');
	const connect = () => {
		const sock = net.createConnection({ host, port: Number(p ?? 10001) });
		sock.on('connect', () => console.log(`tcp ${args.tcp} connected`));
		sock.on('data', lineSplitter(emitLine));
		sock.on('error', (e) => console.error('tcp error', e.message));
		sock.on('close', () => {
			console.log('tcp closed, retrying in 3s');
			setTimeout(connect, 3000);
		});
	};
	connect();
} else {
	console.log('No reader given (--serial or --tcp). Type codes on stdin to simulate scans.');
	process.stdin.on('data', lineSplitter(emitLine));
}
