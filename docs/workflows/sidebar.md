# Sidebar Behavior

## Purpose

The sidebar is a structured, low-noise view of workflow truth.

It should not primarily be an activity log.

Instead, it should help the user understand:

- which workflow is active
- which state the workflow is currently in
- what task and step are active
- what has been agreed
- what is waiting for attention or approval

## Interaction Model

For v1, the sidebar should be:

- adaptive
- compact by default
- mostly read-only
- lightly interactive for inspection

### Allowed interaction in v1

The user should be able to expand items such as:

- tasks
- steps
- alignment categories
- alignment parts

When expanded, the sidebar should show a short summary of what was agreed or decided.

### Not required in v1

The sidebar does not need to support:

- editing task descriptions directly
- approving tasks directly from the sidebar
- controlling subagent dispatch directly

## Compact View

The default compact view should show the most important current state, such as:

- active workflow
- current workflow state
- current task
- current step
- pending approval or blocker
- environment status when relevant

## Expanded View

The expanded view depends on the active workflow.

### Base

Likely minimal:

- active workflow
- current activity

### Superpowers

Orientation-focused:

- current Superpowers process stage
- current workflow state
- next gate or milestone

### Alignment

Richer structured detail:

- alignment categories and parts
- aligned vs pending vs not relevant parts
- task list
- current task and step
- pending approval surface
- summary of what was agreed

### Autonomous

Execution and environment detail:

- current task and step
- sandbox status
- worktree status
- review / verification state
- pull-request status

## Data Requirements

To support the sidebar, the system should maintain first-class summaries for:

- alignment parts
- tasks
- steps
- optionally review milestones and workflow checkpoints

These summaries allow the sidebar to present useful detail without forcing the user to reconstruct state from raw chat history.
