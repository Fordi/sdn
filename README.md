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

Only `init` is called with any data (the resolved project config); every other event calls its handler with `null`.

Handlers may be `async`. `init` and `quit` are awaited before continuing, so those two can delay startup/shutdown until they finish (e.g. to flush logs or notify an external service), and a rejection there will stop startup/shutdown and surface the error. The other events (`running`, `restart`, `exit`, `crash`, `configUpdate`) fire without blocking `sdn`; if one of those rejects, the error is logged rather than crashing the service.

Your hooks module is re-imported on every `restart` and `configUpdate`, so edits to it take effect without needing to restart the `sdn` process itself.
