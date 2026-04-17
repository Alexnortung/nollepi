# Alignment Workflow

## Purpose

`alignment` is the collaborative workflow for feature work and bugfix work where the human and agent intentionally align before and during implementation.

This is the highest-human-involvement workflow.

In this workflow, the system should use a two-orchestrator model:

- a **high-level orchestrator** for intake, high-level alignment, and task planning
- a **task orchestrator** for one active task’s alignment and execution follow-up

## Core Principles

- the human and agent should align on the work before execution
- each mental alignment should begin with a brief overview of the agent's current mental model so both sides can align on the same frame before discussing details
- already aligned parts should not be repeated unnecessarily
- each aligned part requires explicit human confirmation
- the human may say "just go" for a task when additional task-level alignment is not needed
- the human reviews task outcomes before the workflow advances, and that review may also settle commit handling
- human manual edits are protected by default
- the agent may question a human edit, but if the human insists, the agent must not modify it

## Collaboration Model

### High-level orchestrator

The high-level orchestrator is the long-lived owner of the workflow run.

It should handle:

- intake
- high-level mental alignment
- provisional task-list proposal
- task-list mental alignment
- task-list approval
- workflow transitions and overall progression
- retention of compact summaries of what completed tasks developed

### Task orchestrator

The task orchestrator is an ephemeral, task-scoped collaborator.

It should handle:

- task-level alignment for the current task
- direct conversation with the human about that task
- direct dispatch of investigator, builder, and reviewer specialists for that task
- explanation of what changed for that task
- task execution follow-up before the workflow returns to higher-level planning

When supported by the implementation, the task orchestrator should be a literal spawned interactive subagent session.

## High-Level Flow

1. intake
2. high-level mental alignment
3. provisional task-list proposal
4. task-list mental alignment
5. task-list approval
6. handoff to a task orchestrator for the current task
7. task-level alignment
8. task execution
9. internal review
10. human review
11. next task or wrap-up / finish

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

In v1, task-level work should flow through the task orchestrator:

- an **investigator** when alignment or implementation is blocked by missing repo facts
- a **builder** when the task is aligned strongly enough to implement
- a **reviewer** after implementation exists and before the human review surface

The high-level orchestrator should remain the owner of workflow state, task-list progression, approvals, and transitions.

The task orchestrator should remain the visible collaborator for the current task. Specialist subagents support execution, but do not replace the task orchestrator’s responsibility for task alignment, explanation, or task-level follow-up.

After execution:

- the task orchestrator explains what changed
- the human reviews the code
- the task orchestrator takes the human’s review seriously and addresses requested changes
- if the human made manual edits, the agent must not overwrite them unless the change is discussed and allowed
- once the human accepts the task, the workflow can move directly to the next task or finish
- if commit handling is still needed, it should be decided on the human-review exit itself
- the human may override the proposed commit message, provide a replacement, or point at an existing commit hash so the agent records it instead of creating a duplicate

After the task is accepted, the high-level orchestrator should regain the lead for deciding the next task or finishing the run.

## Approval Surfaces

The workflow has three explicit approval surfaces:

1. **alignment approval**
   - a specific alignment part is confirmed by the human

2. **task-list approval**
   - the task list is accepted as the approved execution plan

3. **task-completion approval**
   - the result of a task is accepted and may move directly to next-task or finish, optionally carrying commit intent or existing commit data

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
- next task
- wrap-up / finish

A successful `human-review` exit should land directly in `next-task` or `finish`. If commit handling is part of that exit, the transition surface should carry whether the agent should create a commit, what message to use, or which existing commit hash already satisfies the task so the system avoids duplicate commits.

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
- active task orchestrator session
- specialist subagents working under the current task

The sidebar should be mostly read-only in v1, but allow the user to expand categories, tasks, and steps to inspect short summaries of what was agreed.