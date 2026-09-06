/**
 * Shrink a picture in the browser before uploading it: a phone photo is 3 to
 * 8 MB, the server only keeps 600 px anyway. Falls back to the original file
 * when the browser can't decode it (the server will try, or refuse politely).
 */
export async function downscaleImage(file: File, maxSide = 1200, quality = 0.85): Promise<File> {
	if (!file.type.startsWith('image/') || file.size < 300_000) return file;
	try {
		const bitmap = await createImageBitmap(file, {
			imageOrientation: 'from-image'
		} as ImageBitmapOptions);
		const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
		if (scale === 1) return file;
		const canvas = document.createElement('canvas');
		canvas.width = Math.round(bitmap.width * scale);
		canvas.height = Math.round(bitmap.height * scale);
		canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
		bitmap.close();
		const blob = await new Promise<Blob | null>((resolve) =>
			canvas.toBlob(resolve, 'image/jpeg', quality)
		);
		if (!blob) return file;
		return new File([blob], file.name.replace(/\.[^.]+$/, '') + '.jpg', { type: 'image/jpeg' });
	} catch {
		return file;
	}
}
