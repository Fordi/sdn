import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const isMain = (importMetaUrl) => fileURLToPath(importMetaUrl) === resolve(process.argv[1]);
