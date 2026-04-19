# Workflow ubiquitous language

This glossary defines the workflow-domain terms used by the workflow system.

It is intentionally implementation-agnostic. It names the things that exist in the workflow model, not the APIs, classes, or storage shapes used to implement them.

## Terms

| Term | Definition | Notes |
| --- | --- | --- |
| **workflow** | A named mode of work with its own behavior, expectations, and progression rules. | In this repo, examples include `base`, `superpowers`, `alignment`, and `autonomous`. |
| **workflow run** | One concrete instance of a workflow from its start until it reaches completion. | A workflow is the kind of process; a workflow run is one occurrence of that process. |
| **workflow state** | The current stage of a workflow run within that workflow's state machine. | Use **state** for workflow progression, not **status**. |
| **task** | The main unit of structured work inside a workflow run. | A task should be commit-worthy: one coherent, independently reviewable change that leaves the codebase in a working state. |
| **task status** | The current lifecycle status of a task inside a workflow run. | Use **status** for task progress. Current canonical values are `proposed`, `approved`, `in-progress`, `review`, `approved-complete`, and `committed`. |
| **step** | A sub-unit of work inside a task. | A step exists to organize and track progress within a task. Steps are never committed on their own. |
| **step status** | The current progress status of a step. | Current canonical values are `pending`, `in-progress`, and `done`. |
| **alignment** | The process of bringing the human's and agent's mental models into agreement about the work. | Alignment can happen at the high level, at the task level, or during execution when new ambiguity appears. |
| **alignment state** | The current state of an alignment part during the alignment process. | Current canonical values are `unaligned`, `under-discussion`, `aligned`, `skipped`, and `not-relevant`. |
| **approval** | An explicit acceptance at a defined decision point that allows the workflow to advance. | In `alignment`, the main approval surfaces are alignment approval, task-list approval, and task-completion approval. |
| **persistence backend** | An interchangeable storage implementation for workflow-owned state. | This term names the storage role in the domain without choosing a specific technology or API shape. |

## Naming rules

- Prefer **workflow** for the named process and **workflow run** for one active instance of that process.
- Prefer **workflow state** for workflow progression.
- Prefer **task status** and **step status** for task and step progress.
- Prefer **alignment state** for the state of an alignment part.
- Prefer **approval** for explicit human acceptance points that let the workflow continue.
