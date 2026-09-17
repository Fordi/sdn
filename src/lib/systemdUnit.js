import { resolve } from "node:path";
import { shellQuote } from "./shellQuote.js";

export function buildSystemdUnit(project, config) {
  return {
    ...project.systemd,
    Unit: {
      Description: project.description,
      After: ["network.target"],
      ...project.systemd?.Unit
    },
    Service: {
      Type: "simple",
      ...project.systemd?.Service,
      WorkingDirectory: project.root,
      ExecStart: shellQuote(
        resolve(config.root, "src/service/node"),
        resolve(config.root, "src/service/index.js"),
        resolve(project.root)
      ),
    },
    Install: {
      WantedBy: ["multi-user.target"],
      ...project.systemd?.Install,
    },
  };
}

export function renderSystemdUnit(systemd) {
  return Object.entries(systemd).map(
    ([heading, values]) => [
      `[${heading}]`,
      ...Object.entries(values).map(([name, value]) =>
        Array.isArray(value)
          ? value.map((v) => `${name}=${v}`).join('\n')
          : `${name}=${value}`
      )
    ].join('\n')
  ).join('\n\n');
}
