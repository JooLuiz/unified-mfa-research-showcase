---
description: Mesh branches must always contain every commit on main, received by merging main in
alwaysApply: true
---

# Mesh tracks main

This repo compares the same system with and without Event Mesh. That comparison holds only when each `mesh/*` branch is `main` plus its transport changes. Every commit on `main` must also be on every `mesh/*` branch.

- Land shared work on `main` first: tests, shared contracts, packages, domain code, scripts, and rules.
- A mesh branch receives `main`'s changes only by merging `main` into it.
- Do not copy `main`'s changes to mesh any other way: no patch, no cherry-pick, no editing the same lines by hand.
- After a change merges to `main`, merge `main` into each `mesh/*` branch before starting the next change on mesh.
- `git rev-list --count mesh/<branch>..main` must print `0` before mesh work begins, and again before a mesh pull request is opened.
- To check a `main` change on mesh before it merges, apply it to mesh only for the check. Revert the mesh working tree completely afterwards.
- Changes that only the mesh branch needs stay on mesh: the Event Mesh transport and its wiring. Never merge a mesh branch into `main` (see [branch-structure-parity.md](./branch-structure-parity.md)).
- Retired branches such as `mesh/mesh-frontend-with-vanilla-gateway-base-config` are exempt.
