import type { ScanHandler, ScanSource } from './types';

export interface KeyboardWedgeOptions {
	/** Max ms between two keystrokes for them to count as one scan. Humans are slower. */
	maxKeyGapMs?: number;
	/** Ignore anything shorter than this. Protects against a stray Enter. */
	minLength?: number;
	/** Skip the wedge when focus is inside an element matching this selector. */
	ignoreWithin?: string;
}

/**
 * USB barcode and many RFID readers act as a keyboard: they type the code and
 * press Enter. This listens on the whole window, so the volunteer never has to
 * click into a field first. A burst of fast keystrokes ending in Enter is a
 * scan; slow typing is a person and is left alone.
 */
export class KeyboardWedgeSource implements ScanSource {
	readonly kind = 'keyboard' as const;
	readonly label = 'Keyboard-wedge scanner';
	private buffer = '';
	private lastKeyAt = 0;
	private onScan: ScanHandler | null = null;
	private readonly opts: Required<KeyboardWedgeOptions>;

	constructor(opts: KeyboardWedgeOptions = {}) {
		this.opts = {
			maxKeyGapMs: opts.maxKeyGapMs ?? 60,
			minLength: opts.minLength ?? 4,
			ignoreWithin: opts.ignoreWithin ?? '[data-no-wedge]'
		};
	}

	private handler = (e: KeyboardEvent) => {
		if (e.ctrlKey || e.altKey || e.metaKey) return;
		const target = e.target as HTMLElement | null;
		if (target?.closest?.(this.opts.ignoreWithin)) return;

		const now = performance.now();
		if (now - this.lastKeyAt > this.opts.maxKeyGapMs) this.buffer = '';
		this.lastKeyAt = now;

		if (e.key === 'Enter' || e.key === 'Tab') {
			if (this.buffer.length >= this.opts.minLength) {
				e.preventDefault();
				const code = this.buffer;
				this.buffer = '';
				this.onScan?.({ code, source: 'keyboard', at: Date.now() });
			}
			return;
		}
		if (e.key.length === 1) this.buffer += e.key;
	};

	start(onScan: ScanHandler) {
		this.onScan = onScan;
		window.addEventListener('keydown', this.handler, true);
	}

	stop() {
		window.removeEventListener('keydown', this.handler, true);
		this.onScan = null;
	}
}
