# Task and Step Lifecycle

## Purpose

This document defines the task model used by the workflow system, especially for `alignment` and `autonomous`.

## Task

A task is the main unit of structured work.

A task must be **commit-worthy**.

### Commit-worthy means

A task is commit-worthy when it is:

- one coherent, independently reviewable change
- leaves the codebase in a working state
- can be represented by one commit
- not dependent on unrelated changes just to make sense

A task may be small or large.

A large refactor can still be commit-worthy if it is one coherent working change.

## Step

A step is a sub-unit inside a task.

Steps exist for organization, progress tracking, and clarity.

### Step rules

- steps are usually ordered
- steps may be marked unordered or parallel when appropriate
- steps are never committed alone
- if useful, steps should be recorded in the commit body, not the commit summary

## Source-of-Truth Requirement

Tasks and steps are not just labels.

They should contain enough information that a fresh agent could take the task or step artifact and begin implementation while staying aligned with the intended work.

Each task and step should include:

- a clear description
- a summary of what was agreed
- important implementation details and constraints
- enough context to guide implementation, review, and continuation

Mental alignment is responsible for creating, refining, and verifying these artifacts.

In practice, these artifacts should be stored as markdown files inside the workflow run directory under `docs/.workflows/runs/`.

## Task-List Creation in Alignment

In `alignment`, the orchestrator should first create a **complete-looking provisional draft** of the task list.

The draft should be good enough to react to seriously, but it is expected to be refined with the human before approval.

The human can then:

- split tasks
- merge tasks
- rewrite task descriptions
- challenge task boundaries
- add missing work

Material task-list changes should trigger renewed alignment only for the affected tasks or parts.

## Alignment Workflow Lifecycle

A typical task lifecycle in `alignment` is:

1. task proposed
2. task may be split/merged/rewritten during task-list review
3. task list approved by the human
4. task-level alignment, unless the human says "just go"
5. task execution
6. internal review
7. human review
8. next task or finish

## Autonomous Workflow Lifecycle

A typical task lifecycle in `autonomous` is:

1. task derived from the current plan
2. lighter alignment as needed
3. execution
4. self-review / internal review
5. verification
6. commit
7. continue automatically to the next step or task

## Review, Human Edits, and Task Artifacts

In `alignment`:

- the human reviews completed task work before the workflow advances beyond the task
- the agent must take human review feedback seriously
- if the human made manual edits, the agent must not change them unless the change is discussed and allowed
- the agent may question a human edit, but if the human insists, it must be preserved

The same principle applies to task and step markdown artifacts.

If the human edits a task or step file:

- the agent should reread it when told to do so
- if the human says alignment is needed, the agent should reconcile understanding and ask focused questions
- if the human says no alignment is needed, the file becomes the operative source of truth without reopening alignment

## Commit Traceability

Completed tasks should record commit hash(es) in both:

- `workflow.md`
- `task.md`

This allows one task to point to multiple commits when the human or agent creates more than one commit for that task.

In `alignment`, commit handling is settled as part of completing `human review` rather than by entering separate workflow states for approval and commit. The human may accept the proposed commit message, replace it, or point at an existing commit so the agent does not create a duplicate.

## Workflow Completion

For `alignment`, the workflow is not done merely because tasks are complete.

It is done only after the workflow reaches an explicit wrap-up / finish state.
