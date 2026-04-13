# Pi Coding Agent Config

This repository is my personal [pi](https://pi.dev) package for coding agent configuration.

## What’s in here

- `package.json` — marks this repo as a pi package
- `extensions/` — place custom pi extensions here

## Install on a new machine

1. Install pi if you have not already:

   ```bash
   npm install -g @mariozechner/pi-coding-agent
   ```

2. Install this package from git:

   ```bash
   pi install git:<your-repo-url>
   ```

   Example:

   ```bash
   pi install git:github.com/yourname/nollepi
   ```

3. Start or reload pi.

## Local development

If you have the repo cloned locally, you can also install it by path:

```bash
pi install /absolute/path/to/nollepi
```

## Adding extensions

Drop `.ts` files or extension directories into `extensions/` and reload pi.

This scaffold intentionally ships with no extensions yet.
