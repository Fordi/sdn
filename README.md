# SDN

## Systemd Demonizer for Node

This package will allow you to spin up a systemd service from an npm project with zero fuss.

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
$ npx @fordi-org/sdn install
```

This will create the service for you.  While you're in your working directory, there are some convenience scripts:

```bash
$ npx @fordi-org/sdn control start # This is an alias for `systemctl --user start your-service`  
$ npx @fordi-org/sdn control stop # Any other service-related verb works
$ npx @fordi-org/sdn logs # Will run journalctl so you can see what your service is doing
$ npx @fordi-org/sdn uninstall # Remove your service from systemd
```

You might want to consider adding `scripts` to your `package.json`:

```json
{
  ...
  "scripts": {
    "install-service": "npx @fordi-org/sdn install",
    "uninstall-service": "npx @fordi-org/sdn uninstall",
    "control": "npx @fordi-org/sdn control",
    "start": "npx @fordi-org/sdn control start",
    "status": "npx @fordi-org/sdn control status",
    "stop": "npx @fordi-org/sdn control stop",
    "logs": "npx @fordi-org/sdn logs",
    "restart": "npx @fordi-org/sdn control restart",
    "reload": "npx @fordi-org/sdn control '' daemon-reload"
  },
  ...
}
```
