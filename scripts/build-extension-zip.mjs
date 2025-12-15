import path from "path";
import { createWriteStream } from "fs";
import { promises as fs } from "fs";
import archiver from "archiver";

async function main() {
	const extensionDir = path.resolve(
		"static/assets/download/studyuren-companion"
	);
	const outputZip = path.resolve(
		"static/assets/download/studyuren-companion.zip"
	);

	try {
		await fs.access(extensionDir);
	} catch (err) {
		console.error(
			`[build-extension-zip] Extension directory not found: ${extensionDir}`
		);
		process.exit(1);
	}

	await fs.mkdir(path.dirname(outputZip), { recursive: true });

	const output = createWriteStream(outputZip);
	const archive = archiver("zip", { zlib: { level: 9 } });

	const finalizePromise = new Promise((resolve, reject) => {
		output.on("close", () => resolve(archive.pointer()));
		output.on("error", reject);
		archive.on("error", reject);
	});

	archive.pipe(output);
	archive.directory(extensionDir, false);
	await archive.finalize();

	const totalBytes = await finalizePromise;
	console.log(
		`[build-extension-zip] Created ${path.relative(
			process.cwd(),
			outputZip
		)} (${totalBytes} bytes)`
	);
}

main().catch((err) => {
	console.error("[build-extension-zip] Failed to create zip:", err);
	process.exit(1);
});

