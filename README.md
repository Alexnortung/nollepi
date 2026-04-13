# Pi Coding Agent Config

This repository is my personal [pi](https://pi.dev) package for coding agent configuration.

## What’s in here

- `package.json` — marks this repo as a pi package
- `extensions/path-guard.ts` — prompts before file access outside the current working directory

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

## Path guard allowlist

The extension stores its persistent allowlist here:

```bash
~/.pi/agent/path-guard-allowlist.json
```

It records exact files and directories that you chose to trust.

## Adding extensions

Drop additional `.ts` files or extension directories into `extensions/` and reload pi.
