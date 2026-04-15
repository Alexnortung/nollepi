# Alignment Workflow

## Purpose

`alignment` is the collaborative, orchestrator-led workflow for feature work and bugfix work where the human and agent intentionally align before and during implementation.

This is the highest-human-involvement workflow.

## Core Principles

- the human and agent should align on the work before execution
- already aligned parts should not be repeated unnecessarily
- each aligned part requires explicit human confirmation
- the human may say "just go" for a task when additional task-level alignment is not needed
- the human reviews task outcomes before approval and commit
- human manual edits are protected by default
- the agent may question a human edit, but if the human insists, the agent must not modify it

## High-Level Flow

1. intake
2. high-level mental alignment
3. provisional task-list proposal
4. task-list mental alignment
5. task-list approval
6. task-level alignment
7. task execution
8. internal review
9. human review
10. task approval
11. commit
12. next task
13. wrap-up / finish

This workflow is done only when it reaches an explicit wrap-up / finish state.

## Task-List Approval State

The task-list approval state is a first-class part of the workflow.

In this state the human can:

- approve the task list
- split tasks
- merge tasks
- modify task descriptions
- challenge task boundaries
- request missing work to be added

Task-list review also includes mental alignment on the task plan itself.

If the human changes tasks materially, the affected tasks should re-enter task-list mental alignment. Unchanged aligned parts should remain aligned.

## Execution Model

Each task should normally go through task-level mental alignment before execution.

The human may explicitly say "just go" for a task, which skips additional task-level alignment for that task.

After execution:

- the agent explains what changed
- the human reviews the code
- the agent takes the human’s review seriously and addresses requested changes
- if the human made manual edits, the agent must not overwrite them unless the change is discussed and allowed
- once the human approves the task, the task can be committed if not already committed

## Approval Surfaces

The workflow has three explicit approval surfaces:

1. **alignment approval**
   - a specific alignment part is confirmed by the human

2. **task-list approval**
   - the task list is accepted as the approved execution plan

3. **task-completion approval**
   - the result of a task is accepted and may move toward commit/completion

## State Machine

`alignment` should have its own explicit workflow state machine.

Expected states include concepts like:

- intake
- high-level alignment
- task proposal
- task-list alignment
- task-list approval
- current task alignment
- task execution
- internal review
- human review
- approved
- commit
- next task
- wrap-up / finish

The exact final state names can be refined during design and implementation.

## Sidebar

The sidebar should be especially useful in `alignment`.

It should support inspection of:

- current workflow state
- alignment categories and parts
- which parts are aligned, pending, or not relevant
- current task
- current step
- pending approval surface
- proposed and approved tasks

The sidebar should be mostly read-only in v1, but allow the user to expand categories, tasks, and steps to inspect short summaries of what was agreed.
