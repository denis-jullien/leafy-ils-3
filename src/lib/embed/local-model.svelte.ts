import { browser } from '$app/environment';

/**
 * The optional local embedding model, running in this browser through
 * transformers.js (WebGPU when available, CPU/WASM otherwise). Off by default;
 * the choice is remembered per browser. The model (~120 MB) downloads once and
 * is cached by the browser.
 */
export const LOCAL_MODEL_ID = 'Xenova/multilingual-e5-small';
const KEY = 'leafy.localModel';

type Extractor = (
	texts: string[],
	opts: { pooling: 'mean'; normalize: boolean }
) => Promise<{ tolist(): number[][] }>;

export class LocalEmbedder {
	enabled = $state(false);
	status = $state<'off' | 'loading' | 'ready' | 'error'>('off');
	progress = $state(0); // 0..100 while downloading
	device = $state<'webgpu' | 'wasm' | null>(null);
	error = $state('');

	private extractor: Extractor | null = null;
	private loading: Promise<void> | null = null;
	// Plain Maps on purpose: internal caches, nothing renders from them.
	// eslint-disable-next-line svelte/prefer-svelte-reactivity
	private cache = new Map<string, number[]>();

	constructor() {
		if (browser) {
			try {
				this.enabled = localStorage.getItem(KEY) === '1';
			} catch {
				/* storage unavailable */
			}
		}
	}

	setEnabled(on: boolean) {
		this.enabled = on;
		try {
			localStorage.setItem(KEY, on ? '1' : '0');
		} catch {
			/* ignore */
		}
		if (on) void this.load();
	}

	get webgpuAvailable() {
		return browser && 'gpu' in navigator;
	}

	/** `navigator.gpu` can exist without a usable adapter (headless, blocked GPU): ask for one. */
	private async pickDevice(): Promise<'webgpu' | 'wasm'> {
		if (!this.webgpuAvailable) return 'wasm';
		try {
			const gpu = (navigator as Navigator & { gpu: { requestAdapter(): Promise<unknown> } }).gpu;
			return (await gpu.requestAdapter()) ? 'webgpu' : 'wasm';
		} catch {
			return 'wasm';
		}
	}

	/** Download (first time) and initialise the model. Safe to call repeatedly. */
	load(): Promise<void> {
		if (this.extractor) return Promise.resolve();
		if (this.loading) return this.loading;
		this.status = 'loading';
		this.error = '';
		this.loading = (async () => {
			try {
				const tf = await import('@huggingface/transformers');
				// eslint-disable-next-line svelte/prefer-svelte-reactivity
				const files = new Map<string, number>();
				const build = (device: 'webgpu' | 'wasm') =>
					tf.pipeline('feature-extraction', LOCAL_MODEL_ID, {
						device,
						dtype: 'q8',
						progress_callback: (p: { status: string; file?: string; progress?: number }) => {
							if (p.status === 'progress' && p.file) {
								files.set(p.file, p.progress ?? 0);
								const values = [...files.values()];
								this.progress = Math.round(values.reduce((a, b) => a + b, 0) / values.length);
							}
						}
					});
				let device = await this.pickDevice();
				let pipe;
				try {
					pipe = await build(device);
				} catch (err) {
					if (device === 'wasm') throw err;
					device = 'wasm'; // the GPU path failed after all: run on the CPU
					pipe = await build(device);
				}
				this.device = device;
				this.extractor = pipe as unknown as Extractor;
				this.progress = 100;
				this.status = 'ready';
			} catch (err) {
				this.status = 'error';
				this.error = (err as Error).message;
				this.loading = null;
				throw err;
			}
		})();
		return this.loading;
	}

	/** Normalised embeddings, memoised per text. */
	async embed(texts: string[]): Promise<number[][]> {
		await this.load();
		const missing = texts.filter((t) => !this.cache.has(t));
		if (missing.length) {
			const out = (await this.extractor!(missing, { pooling: 'mean', normalize: true })).tolist();
			missing.forEach((t, i) => this.cache.set(t, out[i]));
		}
		return texts.map((t) => this.cache.get(t)!);
	}
}

/** One instance per browser tab. */
export const localModel = new LocalEmbedder();
