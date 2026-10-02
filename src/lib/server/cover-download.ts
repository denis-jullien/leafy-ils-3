import { lookup } from 'node:dns/promises';
import type { LookupAddress } from 'node:dns';
import { request as httpRequest, type IncomingMessage } from 'node:http';
import { request as httpsRequest } from 'node:https';
import { BlockList, isIP, type LookupFunction } from 'node:net';

export const MAX_COVER_BYTES = 15 * 1024 * 1024;
const MAX_REDIRECTS = 5;
const restricted = new BlockList();
for (const [address, prefix] of [
	['0.0.0.0', 8],
	['10.0.0.0', 8],
	['100.64.0.0', 10],
	['127.0.0.0', 8],
	['169.254.0.0', 16],
	['172.16.0.0', 12],
	['192.0.0.0', 24],
	['192.0.2.0', 24],
	['192.88.99.0', 24],
	['192.168.0.0', 16],
	['198.18.0.0', 15],
	['198.51.100.0', 24],
	['203.0.113.0', 24],
	['224.0.0.0', 4],
	['240.0.0.0', 4]
] as const)
	restricted.addSubnet(address, prefix, 'ipv4');
// Only global unicast IPv6 is eligible; exclude special-use and transition ranges.
const globalV6 = new BlockList();
globalV6.addSubnet('2000::', 3, 'ipv6');
restricted.addSubnet('2001::', 23, 'ipv6');
restricted.addSubnet('2001:db8::', 32, 'ipv6');
restricted.addSubnet('2002::', 16, 'ipv6');
restricted.addSubnet('3fff::', 20, 'ipv6');

export class CoverDownloadError extends Error {}

export function isPublicAddress(address: string): boolean {
	const family = isIP(address);
	if (family === 4) return !restricted.check(address, 'ipv4');
	return family === 6 && globalV6.check(address, 'ipv6') && !restricted.check(address, 'ipv6');
}

function parseUrl(raw: string): URL {
	let url;
	try {
		url = new URL(raw);
	} catch {
		throw new CoverDownloadError('Adresse de couverture invalide.');
	}
	if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password)
		throw new CoverDownloadError('Utilisez une adresse HTTP ou HTTPS sans identifiants.');
	const host = url.hostname
		.replace(/^\[|\]$/g, '')
		.toLowerCase()
		.replace(/\.$/, '');
	if (host === 'localhost' || /\.(localhost|local|internal)$/.test(host))
		throw new CoverDownloadError('Les adresses locales ou internes ne sont pas autorisées.');
	return url;
}

async function addressesFor(url: URL, signal: AbortSignal) {
	signal.throwIfAborted();
	const hostname = url.hostname.replace(/^\[|\]$/g, '');
	const family = isIP(hostname);
	const addresses = family
		? [{ address: hostname, family }]
		: await new Promise<LookupAddress[]>((resolve, reject) => {
				const abort = () => reject(signal.reason);
				signal.addEventListener('abort', abort, { once: true });
				lookup(hostname, { all: true, verbatim: true })
					.then(resolve, reject)
					.finally(() => signal.removeEventListener('abort', abort));
			});
	// Reject mixed public/private answers rather than falling back to an unsafe address.
	if (!addresses.length || addresses.some((entry) => !isPublicAddress(entry.address)))
		throw new CoverDownloadError('Les adresses locales ou internes ne sont pas autorisées.');
	signal.throwIfAborted();
	return addresses;
}

/** Read a response incrementally; destroy the stream immediately on overflow. */
export async function readCoverBody(
	response: IncomingMessage,
	maxBytes = MAX_COVER_BYTES
): Promise<Buffer> {
	const length = response.headers['content-length'];
	if (length && Number(length) > maxBytes) {
		response.destroy();
		throw new CoverDownloadError('Image trop lourde (15 Mo maximum).');
	}
	const chunks: Buffer[] = [];
	let size = 0;
	for await (const chunk of response) {
		const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
		size += bytes.length;
		if (size > maxBytes) {
			response.destroy();
			throw new CoverDownloadError('Image trop lourde (15 Mo maximum).');
		}
		chunks.push(bytes);
	}
	return Buffer.concat(chunks, size);
}

/** Resolve and pin each destination, retaining the original hostname for Host and TLS. */
export async function downloadCover(
	raw: string,
	options: { signal?: AbortSignal; userAgent?: string } = {}
): Promise<Buffer> {
	const signal = options.signal
		? AbortSignal.any([options.signal, AbortSignal.timeout(15000)])
		: AbortSignal.timeout(15000);
	try {
		let url = parseUrl(raw);
		for (let redirects = 0; redirects <= MAX_REDIRECTS; redirects++) {
			const addresses = await addressesFor(url, signal);
			const pinnedLookup: LookupFunction = (_host, lookupOptions, callback) => {
				if (lookupOptions.all) callback(null, addresses);
				else callback(null, addresses[0].address, addresses[0].family);
			};
			const response = await new Promise<IncomingMessage>((resolve, reject) => {
				const req = (url.protocol === 'https:' ? httpsRequest : httpRequest)(
					url,
					{
						lookup: pinnedLookup,
						// Never reuse a connection whose peer was resolved for another request.
						agent: false,
						signal,
						headers: {
							'User-Agent': options.userAgent ?? 'leafy-ils/0.1',
							'Accept-Encoding': 'identity'
						}
					},
					resolve
				);
				req.once('error', reject);
				req.end();
			});
			const status = response.statusCode ?? 0;
			if ([301, 302, 303, 307, 308].includes(status)) {
				response.destroy();
				if (!response.headers.location || redirects === MAX_REDIRECTS)
					throw new CoverDownloadError('Trop de redirections ou redirection invalide.');
				url = parseUrl(new URL(response.headers.location, url).href);
				continue;
			}
			if (
				status < 200 ||
				status >= 300 ||
				!response.headers['content-type']?.toLowerCase().startsWith('image/') ||
				(response.headers['content-encoding'] &&
					response.headers['content-encoding'] !== 'identity')
			) {
				response.destroy();
				throw new CoverDownloadError(`Image indisponible ou réponse invalide (${status}).`);
			}
			return await readCoverBody(response);
		}
		throw new CoverDownloadError('Trop de redirections.');
	} catch (err) {
		if (err instanceof CoverDownloadError) throw err;
		throw new CoverDownloadError(
			signal.aborted
				? 'Téléchargement de couverture interrompu ou trop lent.'
				: 'Impossible de télécharger cette couverture.'
		);
	}
}
