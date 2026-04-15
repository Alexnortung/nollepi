# Workflow Artifacts

## Purpose

The workflow system should store live workflow state in editable markdown artifacts.

These are not design docs. They are working artifacts for active workflow runs.

## Storage Location

Workflow run artifacts should live under:

```text
docs/.workflows/runs/
```

This path signals that these files are operational workflow artifacts, not permanent design documentation.

## Folder Structure

Each workflow run should have its own folder with a sortable prefix and human-readable slug.

Example:

```text
docs/.workflows/runs/
  2026-04-15-01-alignment-button-variants/
    workflow.md
    tasks/
      01-update-domain-types/
        task.md
      02-migrate-button-usage/
        task.md
        step-2-variant-prop-contract.md
```

## Naming

Workflow run folders should use:

- a stable sortable prefix
- a human-readable slug

Task folders should also preserve clear ordering and readability.

## Authority Model

### `workflow.md`

`workflow.md` is the authoritative workflow ledger.

It should contain:

- workflow title/summary
- workflow type
- workflow state
- authoritative ordered task list
- references to task folders
- task statuses
- task-level commit hash(es)

### `task.md`

`task.md` is the authoritative task dossier.

It should contain:

- task summary
- task description
- important agreed details
- task-local status/context
- ordered step list
- references to any dedicated step files
- task-level commit hash(es)

### `step-*.md`

Step files are optional.

A step file should exist only when a step is large enough to deserve its own artifact.

When it exists:

- the step must still be referenced from `task.md`
- the ordered step list remains defined by `task.md`
- the step file becomes the detailed source of truth for that specific step

## Implementation note

The first implementation lives in `extensions/workflows/` and derives durable workflow state from these markdown artifacts. Session persistence, when used, is only for derived UI/session convenience state.

## Source-of-Truth Rules

These markdown artifacts are authoritative.

That means:

- tasks and steps should be detailed enough that a fresh agent can begin from them
- workflow/task/step runtime state should follow these artifacts
- if the human edits an artifact and tells the agent to reread it, the artifact becomes the operative source of truth

## Human Editing

The human should be able to edit these files directly.

This is itself a form of mental alignment.

### If the human says alignment is needed

The agent should:

- reread the edited file
- compare it to its current understanding
- update alignment state
- ask focused clarifying questions where needed

### If the human says no alignment is needed

The agent should:

- reread the edited file
- accept it as the new source of truth
- update its runtime state accordingly
- proceed without reopening alignment

## Commit Traceability

Completed tasks should record commit hash(es).

Hashes belong in both:

- `workflow.md`
- `task.md`

A task may have multiple commit hashes because the human may create multiple commits manually.

If `workflow.md` and `task.md` disagree about commits, the agent should reconcile that difference instead of silently choosing one.

## Editing Style

When the agent updates workflow artifacts, it should:

- preserve human wording by default
- restructure when necessary for clarity and consistency

The agent should avoid needlessly overwriting intentional human phrasing.
