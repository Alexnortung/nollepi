# Autonomous Workflow

## Purpose

`autonomous` is the execution-heavy workflow for issue-driven or prompt-driven work where the agent is allowed to plan, implement, review, and progress with much less human gating than in `alignment`.

## Core Principles

- use lighter high-level mental alignment than `alignment`
- execute with stronger agent authority
- allow self-review and automatic progression to the next step
- support automatic pull-request creation
- rely on isolation as the primary safety boundary

## Intake

Autonomous work may start from:

- a GitHub issue
- a user prompt describing the work

At the start, the user should be able to choose whether the workflow begins with:

- a questions-and-answers style intake
- a grill-me style intake

## High-Level Flow

1. intake
2. lightweight high-level alignment
3. issue/problem understanding
4. planning
5. task execution
6. self-review / internal review
7. verification
8. commit
9. next step
10. pull-request creation
11. finish

Unlike `alignment`, Autonomous does not use the same human approval gates for each task.

## Task Rules Compared to Alignment

Tasks in `autonomous` do not follow the same rules as tasks in `alignment`.

In this workflow, the agent may:

- make whatever changes it decides are needed
- self-review, optionally with a subagent
- proceed automatically to the next step after review

Autonomous still benefits from structured tasks and steps, but the authority model is different.

## Safety Model

Autonomous has a strict environment requirement.

### Required

- isolated git worktree
- sandboxing must be available

### Default policy once active

- command guard off by default
- path guard off by default
- sandbox + isolated worktree become the primary safety boundary

### Failure to start

If sandboxing or the isolated worktree cannot be established, Autonomous must refuse to start.

It should then offer fallback to:

- `alignment`
- `base`

Autonomous should not silently degrade into a less safe partial mode.

## State Machine

`autonomous` should have its own explicit workflow state machine.

Likely state concepts include:

- intake
- lightweight alignment
- issue understanding
- planning
- task execution
- self-review
- verification
- commit
- next step
- pull-request creation
- finish

## Sidebar

The sidebar should make the current autonomous execution status legible without overwhelming the user.

Useful sidebar content includes:

- active workflow: `autonomous`
- current workflow state
- current task and step
- sandbox status
- worktree status
- review/verification status
- pull-request status

The sidebar remains mostly read-only in v1, with expandable summaries where useful.
