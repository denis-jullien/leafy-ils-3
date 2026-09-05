import type { ScanHandler, ScanSource } from './types';

/** Message shape spoken by tools/reader-bridge. Keep the two in sync. */
export type BridgeMessage =
	| { type: 'scan'; code: string; reader?: string }
	| { type: 'hello'; reader?: string }
	| { type: 'error'; message: string };

export const DEFAULT_BRIDGE_URL = 'ws://localhost:8787';

/**
 * Connects to the small Node bridge running on the library PC (or a Pi) that
 * owns the TCP/IP or serial RFID reader. Browsers treat localhost as a secure
 * origin, so an https page may open this ws:// socket. Reconnects forever.
 */
export class BridgeSource implements ScanSource {
	readonly kind = 'bridge' as const;
	readonly label = 'Local reader bridge';
	private ws: WebSocket | null = null;
	private timer: ReturnType<typeof setTimeout> | null = null;
	private stopped = true;
	onStatus?: (connected: boolean) => void;

	constructor(private url: string = DEFAULT_BRIDGE_URL) {}

	start(onScan: ScanHandler) {
		this.stopped = false;
		const connect = () => {
			if (this.stopped) return;
			const ws = new WebSocket(this.url);
			this.ws = ws;
			ws.onopen = () => this.onStatus?.(true);
			ws.onmessage = (ev) => {
				try {
					const msg = JSON.parse(String(ev.data)) as BridgeMessage;
					if (msg.type === 'scan' && msg.code)
						onScan({ code: msg.code, source: 'bridge', at: Date.now() });
				} catch {
					/* ignore junk */
				}
			};
			ws.onclose = () => {
				this.onStatus?.(false);
				if (!this.stopped) this.timer = setTimeout(connect, 2000);
			};
			ws.onerror = () => ws.close();
		};
		connect();
	}

	stop() {
		this.stopped = true;
		if (this.timer) clearTimeout(this.timer);
		this.ws?.close();
		this.ws = null;
	}
}
