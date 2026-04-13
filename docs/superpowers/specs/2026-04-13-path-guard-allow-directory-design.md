# Path guard allow-directory parent selection

## Summary

Make the path guard extension's **Always allow this directory** flow behave like the bash command guard's prefix selector.

The first approval prompt remains unchanged. If the user selects **Always allow this directory**, the extension should open a second selector that lets the user choose which directory to trust, starting from the nearest directory and walking upward through each parent, excluding `/`.

## Goals

- Preserve the current path-guard prompt and overall UX.
- Add an explicit parent-directory selection step for **Always allow this directory**.
- Match the mental model already used by bash command guard's prefix selection.
- Keep the current allowlist file format unchanged.

## Non-goals

- Changing file allow behavior.
- Changing path matching semantics.
- Adding new allowlist entry types.
- Reworking the prompt text beyond what is needed for the second selector.

## Desired behavior

### Initial prompt

The first prompt stays the same:

- Deny
- Allow once
- Always allow this file
- Always allow this directory

### Second prompt for directory allowance

If the user selects **Always allow this directory**, path guard opens a second selector.

The selector options are built upward from the closest directory to the farthest parent, excluding `/`.

Examples:

- For a file target `/a/b/c/file.txt`, choices are:
  - `/a/b/c`
  - `/a/b`
  - `/a`

- For a directory target `/a/b/c`, choices are:
  - `/a/b/c`
  - `/a/b`
  - `/a`

### Persistence

The exact directory chosen in the second prompt is saved into the existing `directories` allowlist array.

No schema changes are required for `~/.pi/agent/path-guard-allowlist.json`.

## Implementation design

All changes stay inside `extensions/path-guard.ts`.

### Helper: upward directory choices

Add a helper that:

1. Accepts a canonical target path.
2. Determines the starting directory:
   - if the target is a directory, start at the target itself
   - otherwise start at `dirname(target)`
3. Builds an ordered array of directories by repeatedly walking to the parent directory.
4. Stops before `/`.

The output order must be nearest-first to match bash guard's prefix selector behavior.

### Helper: save selected directory

Add a helper that saves an explicitly selected directory to the allowlist instead of always deriving `dirname(target)`.

This keeps the current store merge behavior while allowing the second prompt to control what is persisted.

### Prompt flow change

Update the `Always allow this directory` branch in `maybePromptForAccess()` to:

1. Compute upward directory candidates.
2. Prompt the user with `ui.select(...)`.
3. Save the chosen directory.
4. If saving fails, notify and allow once.
5. If the user cancels the second prompt, block the request.

## Error handling

- If candidate generation somehow produces no choices, treat that as a blocked request.
- If the second selector is dismissed or no choice is returned, block the request as user-denied.
- If saving the selected directory fails, show the existing warning-style notification and allow the current request once.

## Testing

Add tests for:

1. **Choice generation**
   - file target produces nearest-parent-first options
   - directory target includes itself first
   - `/` is excluded

2. **Persistence of explicit directory choice**
   - saving a chosen parent directory writes that exact path into `directories`

3. **Extension prompt flow**
   - first prompt selects **Always allow this directory**
   - second prompt selects a parent directory
   - saved allowlist contains the selected parent, not only the immediate parent

## Risks and mitigations

- **Risk:** incorrect file-vs-directory detection for non-existent targets.
  - **Mitigation:** determine the starting point conservatively using filesystem metadata when available and otherwise fall back to the current file-oriented behavior.

- **Risk:** offering `/` would create an overly broad permission.
  - **Mitigation:** explicitly stop before `/`.

## Acceptance criteria

- Selecting **Always allow this directory** triggers a second selection prompt.
- The second prompt lists the target directory and its parents upward, nearest first, excluding `/`.
- The exact selected directory is persisted to the existing path guard allowlist.
- Existing file allow and once-only behavior remain unchanged.
