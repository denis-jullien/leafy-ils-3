import { browser } from '$app/environment';
import {
	BridgeSource,
	DEFAULT_BRIDGE_URL,
	KeyboardWedgeSource,
	WebSerialSource,
	webSerialSupported,
	type ScanHandler,
	type ScanSource
} from '$lib/scan';

const BRIDGE_KEY = 'leafy.scan.bridgeUrl';
const SERIAL_KEY = 'leafy.scan.serialBaud';

/**
 * One place that owns every scan source on a page. The keyboard wedge is
 * always on; the bridge and Web Serial are opt-in and remembered per browser.
 * Call `attach(handler)` from onMount and use the returned cleanup.
 */
export class Scanners {
	keyboard = $state(false);
	bridgeUrl = $state('');
	bridgeConnected = $state(false);
	serialConnected = $state(false);
	serialBaud = $state(9600);
	readonly serialSupported = browser && webSerialSupported();
	error = $state('');

	private sources: ScanSource[] = [];
	private handler: ScanHandler = () => {};

	attach(handler: ScanHandler) {
		this.handler = handler;
		this.startKeyboard();
		try {
			this.bridgeUrl = localStorage.getItem(BRIDGE_KEY) ?? '';
			this.serialBaud = Number(localStorage.getItem(SERIAL_KEY) ?? 9600);
		} catch {
			/* storage may be unavailable */
		}
		if (this.bridgeUrl) this.startBridge();
		if (this.serialSupported) void this.reconnectSerial();
		return () => this.detach();
	}

	detach() {
		for (const s of this.sources) s.stop();
		this.sources = [];
		this.keyboard = this.bridgeConnected = this.serialConnected = false;
	}

	private startKeyboard() {
		const src = new KeyboardWedgeSource();
		src.start(this.handler);
		this.sources.push(src);
		this.keyboard = true;
	}

	enableBridge(url = DEFAULT_BRIDGE_URL) {
		this.bridgeUrl = url;
		try {
			localStorage.setItem(BRIDGE_KEY, url);
		} catch {
			/* ignore */
		}
		this.startBridge();
	}

	disableBridge() {
		this.bridgeUrl = '';
		try {
			localStorage.removeItem(BRIDGE_KEY);
		} catch {
			/* ignore */
		}
		this.stopKind('bridge');
		this.bridgeConnected = false;
	}

	private startBridge() {
		this.stopKind('bridge');
		const src = new BridgeSource(this.bridgeUrl || DEFAULT_BRIDGE_URL);
		src.onStatus = (c) => (this.bridgeConnected = c);
		src.start(this.handler);
		this.sources.push(src);
	}

	/** Must be called from a click: the browser shows the port picker. */
	async connectSerial() {
		this.error = '';
		try {
			localStorage.setItem(SERIAL_KEY, String(this.serialBaud));
		} catch {
			/* ignore */
		}
		await this.startSerial();
	}

	/** Silently reuse a port the user granted on an earlier visit. */
	private async reconnectSerial() {
		try {
			const [port] = await navigator.serial.getPorts();
			if (port) await this.startSerial(port);
		} catch {
			/* no granted port, fine */
		}
	}

	private async startSerial(port?: SerialPort) {
		this.stopKind('serial');
		const src = new WebSerialSource({ baudRate: this.serialBaud, port });
		try {
			await src.start(this.handler);
			this.sources.push(src);
			this.serialConnected = true;
		} catch (err) {
			this.error = (err as Error).message;
			this.serialConnected = false;
		}
	}

	disconnectSerial() {
		this.stopKind('serial');
		this.serialConnected = false;
	}

	private stopKind(kind: ScanSource['kind']) {
		for (const s of this.sources.filter((s) => s.kind === kind)) s.stop();
		this.sources = this.sources.filter((s) => s.kind !== kind);
	}
}
