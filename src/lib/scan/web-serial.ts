import type { ScanHandler, ScanSource } from './types';

export interface WebSerialOptions {
	baudRate?: number;
	/** Turn a raw line from the reader into a code, or null to ignore it. */
	parseLine?: (line: string) => string | null;
	/** Reuse a port the user already granted, instead of prompting. */
	port?: SerialPort;
}

export const webSerialSupported = () => typeof navigator !== 'undefined' && 'serial' in navigator;

/**
 * Talks to an RS232 / USB-serial reader straight from the browser. Chromium
 * only. The first call must come from a click, because the browser asks the
 * user to pick the port. Default framing: one code per line. Vendor-specific
 * protocols (Feig ISO host, etc.) plug in through parseLine.
 */
export class WebSerialSource implements ScanSource {
	readonly kind = 'serial' as const;
	readonly label = 'Serial reader (Web Serial)';
	private port: SerialPort | null = null;
	private reader: ReadableStreamDefaultReader<string> | null = null;
	private running = false;
	private readonly opts: WebSerialOptions;

	constructor(opts: WebSerialOptions = {}) {
		this.opts = opts;
	}

	async start(onScan: ScanHandler) {
		if (!webSerialSupported()) throw new Error('Web Serial is not available in this browser');
		this.port = this.opts.port ?? (await navigator.serial.requestPort());
		await this.port.open({ baudRate: this.opts.baudRate ?? 9600 });
		if (!this.port.readable) throw new Error('Serial port is not readable');

		const decoder = new TextDecoderStream();
		this.port.readable.pipeTo(decoder.writable as WritableStream<Uint8Array>).catch(() => {});
		this.reader = decoder.readable.getReader();
		this.running = true;
		const parse = this.opts.parseLine ?? ((l: string) => l.trim() || null);

		let pending = '';
		void (async () => {
			try {
				while (this.running && this.reader) {
					const { value, done } = await this.reader.read();
					if (done) break;
					pending += value;
					let nl: number;
					while ((nl = pending.search(/\r|\n/)) >= 0) {
						const line = pending.slice(0, nl);
						pending = pending.slice(nl + 1);
						const code = parse(line);
						if (code) onScan({ code, source: 'serial', at: Date.now() });
					}
				}
			} catch (err) {
				if (this.running) console.error('[serial] read failed', err);
			}
		})();
	}

	stop() {
		this.running = false;
		this.reader?.cancel().catch(() => {});
		this.reader = null;
		this.port?.close().catch(() => {});
		this.port = null;
	}
}
