# @fordi-org/sdn

## Systemd Demonizer for Node

This package will allow you to spin up a systemd service from an npm project with zero fuss.

# Installation

```sh
# Install to your project
npx i -D @fordi-org/sdn
# Install globally so you can run `sdn` instead of `npx sdn`
npx i @fordi-org/sdn
```

# Usage

First, configure your `package.json` appropriately.  The service name will be the `.name` of your project, with any `@org/` prefix stripped off.  The entrypoint will be your `.main` entry.  The service's description will be your project's description.

You can add any items to the service file with a `.config.systemd` section.  The first level of depth is the `[Section]`, and the second is the `Property=`.  Passing an array for a `Property=` will result in the property being repeated. For example:

```json
{
  "name": "my-service",
  "main": "src/index.js",
  "systemd": {
    "Unit": {
      "After": ["network.target", "mariadb.service"],
    }
  }
}
```

You don't really need to get into the systemd weeds here.  If you have a `.name` and `.main`, you should be good to go to the next steps:

```bash
npx sdn install
```

This will create the service for you.  While you're in your working directory, there are some convenience scripts:

```bash
npx sdn control {verb} # This is an alias for `systemctl --user {verb} your-service`
npx sdn start # Equivalent to systemctl --user start your-service
npx sdn stop # stop your service
npx sdn restart # stop your service
npx sdn reload # refresh your service's systemd file
npx sdn status # get your service's status
npx sdn stop # stop your service
npx sdn logs # Will run journalctl so you can see what your service is doing
npx sdn uninstall # Remove your service from systemd
```

# Hooks

You can run your own code in response to service lifecycle events by pointing `.config.hooks` at a JS module, relative to your project root:

```json
{
  "name": "my-service",
  "main": "src/index.js",
  "config": {
    "hooks": "./hooks.js"
  }
}
```

That module should export a function for each event you care about. Any event without a matching export is silently skipped, so you only need to implement the ones you use:

```js
// hooks.js
export const init = (project) => { /* service is about to start; project is the resolved config */ };
export const running = () => { /* the watched process started successfully */ };
export const quit = () => { /* sdn itself is shutting down (e.g. received SIGINT) */ };
export const restart = () => { /* nodemon is restarting the watched process */ };
export const exit = () => { /* the watched process exited cleanly */ };
export const crash = () => { /* the watched process exited with an error */ };
export const configUpdate = () => { /* nodemon's config was reloaded */ };
```

`init` is called with the resolved project config. `crash` is called with the last crash report (see [Crash diagnostics](#crash-diagnostics) below), or `null` if none was captured. Every other event calls its handler with `null`.

Handlers may be `async`. `init` and `quit` are awaited before continuing, so those two can delay startup/shutdown until they finish (e.g. to flush logs or notify an external service), and a rejection there will stop startup/shutdown and surface the error. The other events (`running`, `restart`, `exit`, `configUpdate`) fire without blocking `sdn`; if one of those rejects, the error is logged rather than crashing the service. `crash` is also awaited, so it can act on its return value (see below), but a rejection there is likewise just logged.

Your hooks module is re-imported on every `restart` and `configUpdate`, so edits to it take effect without needing to restart the `sdn` process itself.

## Controlling restarts from the crash hook

By default, after a crash `sdn` leaves the service stopped and waits for a file change before restarting it (nodemon's normal behavior). Your `crash` hook can override this by returning a value:

```js
export const crash = (lastError) => {
  if (isTransient(lastError)) {
    return true; // restart immediately
  }
  if (isFatal(lastError)) {
    return false; // stop the service and exit(1)
  }
  return 12; // stop the service and exit with this code instead
  // returning undefined (or nothing) leaves sdn waiting for a file change, as usual
};
```

- `true` restarts the watched process immediately.
- `false` stops `sdn` itself, exiting with code `1`.
- Any other integer stops `sdn` itself, exiting with that code.
- Anything else (`undefined`, `null`, a non-integer number, etc.) is treated as "no opinion" and falls back to the default wait-for-file-change behavior.

## Crash diagnostics

sdn automatically captures the error from an uncaught exception or unhandled rejection in your service and makes it available to your `crash` hook, and to your own code, as `lastError`:

```js
export const crash = (lastError) => {
  // lastError is null if nothing was captured, otherwise:
  // {
  //   type: "uncaughtException" | "unhandledRejection",
  //   time: "2026-09-20T18:54:56.377Z",
  //   error: { name: "Error", message: "...", stack: "..." }
  // }
  console.log(lastError?.error.message);
};
```

This capture is installed automatically around your `main` entry point, so you don't need to do anything to enable it. If you want to read the last crash report from your own application code (e.g. to report it somewhere on a clean start), import it directly:

```js
import { readLastCrash, clearLastCrash } from "@fordi-org/sdn";

const lastCrash = readLastCrash(); // null if there wasn't one
clearLastCrash(); // remove it once you've handled it
```

Both default to resolving the current project from `process.cwd()`; pass a project root or file path explicitly if you need to check a different project.

The crash report is stored at `<appData>/lastCrash.json` (see [Application data directory](#application-data-directory) below), and is cleared automatically each time your service starts, so a fresh boot never sees a stale report from a previous run.

## Application data directory

Every project gets a directory for its own runtime state, defaulting to `~/.local/state/{name}` (using the same de-scoped package name used for the service name). You can override it with `.config.appData`:

```json
{
  "name": "my-service",
  "main": "src/index.js",
  "config": {
    "appData": "/var/lib/my-service"
  }
}
```

If `<appData>/config.json` exists, it's deep-merged over your project's configuration (objects merge key-by-key; arrays and primitives are replaced outright). This is useful for machine-specific or environment-specific overrides that shouldn't live in your project's own `package.json` or repo — for example, secrets or per-host settings dropped in by a deploy script.

`sdn` watches the whole `appData` directory (separately from nodemon's own watch of your project's code) and restarts your service whenever something in it changes, so editing `appData/config.json` takes effect without needing to restart `sdn` itself. `lastCrash.json` is excluded from this, since it's written by your own crashing process — watching it would cause a restart loop on every crash.

## Reading your own project's config

`getConfig` is the same function sdn uses internally to resolve your project's configuration, and it's exported for your own code to use too:

```js
import { getConfig } from "@fordi-org/sdn";

const { config, PACKAGE, ConfigError } = getConfig(process.cwd());
```

It walks up from the given directory (or file) to find the nearest `package.json`, then merges together — in order — `package.json`'s own `.config` block, the file named by `.config.from` if set, and the `appData/config.json` overlay described above. The returned `config` is frozen; `PACKAGE` is your project's raw, frozen `package.json` contents; `ConfigError` is a constructor for configuration-related errors, pre-bound to reference whichever file the offending setting should have been in.

### Preprocessing config layers

`getConfig` takes an optional second argument, a function `(obj, path) => obj`, run on each of the three config layers just before it's merged in:

```js
const { config } = getConfig(root, (obj, path) => {
  // obj is the raw object read from `path` for this layer;
  // return the object to actually merge (mutating and returning obj is fine)
  return obj;
});
```

This runs once per layer, so you'll see it called up to three times — once each for `package.json`'s inline `config`, the `config.from` file, and the appData overlay — with `path` set to that layer's own file path each time. It defaults to the identity function, so plain `getConfig(root)` behaves as before.

### `getConfig.relative(...paths)`

Registers dotted config keys (e.g. `"schedule"`, or `"nested.value"`) that should be treated as paths and resolved relative to whichever file they were declared in, rather than left as-is or resolved against your project root. This is process-global, additive state — call it once, typically at the top of your app's entry point, before your first `getConfig()` call:

```js
import { getConfig } from "@fordi-org/sdn";

getConfig.relative("schedule", "netrc");
```

With this registered, a `"schedule": "./jobs/nightly.js"` set in your `appData/config.json` resolves relative to your `appData` directory, while the same key set in `package.json` resolves relative to your project root — each layer relative to its own file. Relativization runs before the `preprocess` function described above, so `preprocess` always sees already-resolved absolute paths for any key you've registered.

The resolved config also exposes `config.watchPaths`: every config source outside your project root that `sdn` found while building it — the `config.from` file (if set), and the resolved value of every registered `relative()` path. `sdn` watches each of these (in addition to the `appData` directory) and restarts your service when any of them change, so config changes always take effect on the next boot, wherever the config actually lives.

`sdn` resolves your project's config, and computes `watchPaths` from it, once at its own startup — before your hooks module or `main` entry point has run. Calling `getConfig.relative()` from a hook or from your app code is not supported, since it's too late to affect that watch list. If you need custom relativized paths watched, register them before `sdn` itself starts, for example via `NODE_OPTIONS=--import=./preload.js` set in your `.config.systemd.Service` block.

### `getConfig.setRoot(root)`

Sets a process-global default for `getConfig`'s first argument, used whenever `getConfig()` is called with no argument (or `undefined`). An explicitly-passed root always takes precedence over this default. This is useful for code that runs inside a known project (like a hook module, or your own `main` entry point) and wants to call `getConfig()` without having to re-derive its own project root:

```js
import { getConfig } from "@fordi-org/sdn";

getConfig.setRoot(import.meta.dirname);
// ...later, anywhere in this process...
const { config } = getConfig(); // resolves against the root set above
```
