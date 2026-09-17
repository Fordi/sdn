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
npx sdn start # Equivalent to systemctl --user start your-service
npx sdn stop # stop your service
npx sdn restart # stop your service
npx sdn reload # refresh your service's systemd file
npx sdn status # get your service's status
npx sdn stop # stop your service
npx sdn control {verb} # This is an alias for `systemctl --user {verb} your-service`
npx sdn logs # Will run journalctl so you can see what your service is doing
npx sdn uninstall # Remove your service from systemd
```

You might want to consider adding `scripts` to your `package.json`:

```json
{
  ...
  "scripts": {
    "install-service": "sdn install",
    "uninstall-service": "sdn uninstall",
    "control": "sdn control",
    "start": "sdn start",
    "status": "sdn status",
    "stop": "sdn stop",
    "logs": "sdn logs",
    "restart": "sdn restart",
    "reload": "sdn reload"
  },
  ...
}
```
