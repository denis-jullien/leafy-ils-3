import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Readable } from 'node:stream';
import { EventEmitter } from 'node:events';
import type { IncomingHttpHeaders, IncomingMessage, RequestOptions } from 'node:http';
import { downloadCover, isPublicAddress, readCoverBody } from './cover-download';

const mocks = vi.hoisted(() => ({ lookup: vi.fn(), request: vi.fn() }));
vi.mock('node:dns/promises', () => ({ lookup: mocks.lookup }));
vi.mock('node:http', () => ({ request: mocks.request }));
vi.mock('node:https', () => ({ request: mocks.request }));

function response(
	chunks: Buffer[],
	headers: IncomingHttpHeaders = { 'content-type': 'image/jpeg' },
	statusCode = 200
) {
	return Object.assign(Readable.from(chunks), { headers, statusCode }) as IncomingMessage;
}

function reply(message: IncomingMessage) {
	mocks.request.mockImplementationOnce(
		(_url: URL, _options: RequestOptions, callback: (r: IncomingMessage) => void) =>
			Object.assign(new EventEmitter(), { end: () => queueMicrotask(() => callback(message)) })
	);
}

beforeEach(() => {
	mocks.lookup.mockReset().mockResolvedValue([{ address: '93.184.215.14', family: 4 }]);
	mocks.request.mockReset();
});

describe('public cover destinations', () => {
	it('rejects private, loopback, special-use and IPv6 transition addresses', () => {
		for (const address of [
			'0.0.0.0',
			'127.0.0.1',
			'10.1.2.3',
			'169.254.169.254',
			'172.16.1.1',
			'192.168.1.1',
			'100.64.1.1',
			'198.18.1.1',
			'224.0.0.1',
			'::',
			'::1',
			'fc00::1',
			'fe80::1',
			'::ffff:127.0.0.1',
			'64:ff9b::7f00:1',
			'2002:7f00:1::',
			'2001:db8::1',
			'3fff::1'
		]) {
			expect(isPublicAddress(address)).toBe(false);
		}
		expect(isPublicAddress('1.1.1.1')).toBe(true);
		expect(isPublicAddress('2606:4700:4700::1111')).toBe(true);
	});

	it('rejects unsupported URLs, credentials, internal names and alternate loopback notation', async () => {
		for (const url of [
			'file:///etc/passwd',
			'ftp://example.com/a.jpg',
			'http://user:pass@example.com/a.jpg',
			'http://localhost/a',
			'http://anything.internal/a',
			'http://127.1/a',
			'http://2130706433/a',
			'http://[::ffff:127.0.0.1]/a'
		]) {
			await expect(downloadCover(url)).rejects.toThrow();
		}
		expect(mocks.request).not.toHaveBeenCalled();
	});

	it('rejects DNS answers containing any private address', async () => {
		mocks.lookup.mockResolvedValue([
			{ address: '1.1.1.1', family: 4 },
			{ address: '10.0.0.1', family: 4 }
		]);
		await expect(downloadCover('https://covers.example/image')).rejects.toThrow('internes');
		expect(mocks.request).not.toHaveBeenCalled();
	});

	it('pins the validated DNS answer and retains the hostname for TLS and Host', async () => {
		reply(response([Buffer.from('image bytes')]));
		await expect(downloadCover('https://covers.example/image')).resolves.toEqual(
			Buffer.from('image bytes')
		);
		const [url, options] = mocks.request.mock.calls[0] as [URL, RequestOptions];
		expect(url.hostname).toBe('covers.example');
		expect(options.agent).toBe(false);
		options.lookup!('covers.example', { all: true }, (err, addresses) => {
			expect(err).toBeNull();
			expect(addresses).toEqual([{ address: '93.184.215.14', family: 4 }]);
		});
		expect(mocks.lookup).toHaveBeenCalledTimes(1);
	});

	it('blocks redirects to internal destinations before opening another connection', async () => {
		reply(
			response([], { 'content-type': 'image/jpeg', location: 'http://169.254.169.254/latest' }, 302)
		);
		await expect(downloadCover('https://covers.example/image')).rejects.toThrow('internes');
		expect(mocks.request).toHaveBeenCalledTimes(1);
	});

	it('revalidates DNS for each redirect, including the same hostname', async () => {
		mocks.lookup
			.mockResolvedValueOnce([{ address: '1.1.1.1', family: 4 }])
			.mockResolvedValueOnce([{ address: '127.0.0.1', family: 4 }]);
		reply(response([], { 'content-type': 'image/jpeg', location: '/next' }, 302));
		await expect(downloadCover('https://covers.example/image')).rejects.toThrow('internes');
		expect(mocks.request).toHaveBeenCalledTimes(1);
	});

	it('supports public relative redirects and rejects endless redirects', async () => {
		reply(response([], { 'content-type': 'image/jpeg', location: '/next' }, 302));
		reply(response([Buffer.from('image')]));
		await expect(downloadCover('https://covers.example/image')).resolves.toEqual(
			Buffer.from('image')
		);
		expect(mocks.request.mock.calls[1][0].pathname).toBe('/next');
		for (let i = 0; i < 6; i++)
			reply(response([], { 'content-type': 'image/jpeg', location: '/again' }, 302));
		await expect(downloadCover('https://covers.example/image')).rejects.toThrow('redirections');
	});

	it('rejects non-images and encoded responses', async () => {
		reply(response([], { 'content-type': 'text/html' }));
		await expect(downloadCover('https://covers.example/image')).rejects.toThrow('invalide');
		reply(response([], { 'content-type': 'image/jpeg', 'content-encoding': 'gzip' }));
		await expect(downloadCover('https://covers.example/image')).rejects.toThrow('invalide');
	});

	it('aborts a pending DNS lookup without making a connection', async () => {
		mocks.lookup.mockImplementation(() => new Promise(() => {}));
		const controller = new AbortController();
		const downloading = downloadCover('https://covers.example/image', {
			signal: controller.signal
		});
		controller.abort();
		await expect(downloading).rejects.toThrow('interrompu');
		expect(mocks.request).not.toHaveBeenCalled();
	});
});

describe('bounded downloads', () => {
	it('rejects an oversized declared length before reading the body', async () => {
		const message = response([Buffer.from('abc')], {
			'content-type': 'image/jpeg',
			'content-length': '100'
		});
		await expect(readCoverBody(message, 4)).rejects.toThrow('lourde');
		expect(message.destroyed).toBe(true);
	});

	it('stops oversized chunked downloads even without a content length', async () => {
		const message = response([Buffer.from('abc'), Buffer.from('def'), Buffer.from('ghi')]);
		await expect(readCoverBody(message, 4)).rejects.toThrow('lourde');
		expect(message.destroyed).toBe(true);
	});

	it('accepts an image at exactly the size limit', async () => {
		await expect(
			readCoverBody(response([Buffer.from('ab'), Buffer.from('cd')]), 4)
		).resolves.toEqual(Buffer.from('abcd'));
	});
});
