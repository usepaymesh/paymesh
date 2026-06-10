export function readStdin(): Promise<string | null> {
	if (
		process.stdin.isTTY ||
		process.stdin.readableEnded ||
		process.stdin.destroyed
	) {
		return Promise.resolve(null);
	}

	const chunks: Buffer[] = [];

	return new Promise((resolve, reject) => {
		process.stdin.on('data', (chunk: Buffer) => chunks.push(chunk));
		process.stdin.on('end', () =>
			resolve(Buffer.concat(chunks).toString('utf-8').trim() || null),
		);
		process.stdin.on('error', reject);

		if (process.stdin.readableEnded || process.stdin.destroyed) {
			resolve(Buffer.concat(chunks).toString('utf-8').trim() || null);
		}
	});
}
