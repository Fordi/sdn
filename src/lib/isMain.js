import { realpathSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const realOrResolved = (path) => {
	try {
		return realpathSync(path);
	} catch {
		return resolve(path);
	}
};

export const isMain = (importMetaUrl) => fileURLToPath(importMetaUrl) === realOrResolved(process.argv[1]);
