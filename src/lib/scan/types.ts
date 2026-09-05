export type ScanSourceKind = 'keyboard' | 'serial' | 'bridge' | 'manual';

export interface ScanEvent {
	/** Raw code as delivered by the device, before any interpretation. */
	code: string;
	source: ScanSourceKind;
	at: number;
}

export type ScanHandler = (event: ScanEvent) => void;

/**
 * Anything that can produce scans. The circulation page does not care whether
 * a code came from a USB barcode gun, a serial RFID reader or a WebSocket.
 */
export interface ScanSource {
	readonly kind: ScanSourceKind;
	readonly label: string;
	start(onScan: ScanHandler): Promise<void> | void;
	stop(): void;
}
