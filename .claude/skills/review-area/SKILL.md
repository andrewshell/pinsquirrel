---
name: review-area
description: Run a deep bug and security review of one review area from the Review map. Independent Opus reviewers each take one lens, Opus proof agents confirm findings with failing regression tests, Fable rules on the high-severity ones a test could not settle, and the results are filed as Backlog tasks. Use when the user says "review the next area", "/review-area", or names a review area or its task.
argument-hint: '[area id | TASK-n]'
disable-model-invocation: true
---

# Review one area

Arguments: $ARGUMENTS

Run `backlog instructions overview` and `backlog instructions task-execution` first, and `backlog instructions task-finalization` before step 6.

## 0. Pick the area and set up

- An argument names the area (its id or its task). With no argument, take the first `review-area` task in To Do by ordinal: `backlog task list --labels review-area --status "To Do" --sort ordinal --plain`. If there is none, stop and suggest `/review-map`.
- Set the task In Progress.
- `$MAIN` is `$(dirname "$(git rev-parse --path-format=absolute --git-common-dir)")`. Notes go in `$NOTES` = `$MAIN/_local/review/<area id>-<YYYY-MM-DD>/`. Never write notes in a worktree's own `_local/`, because it is deleted with the worktree.
- `git fetch origin main`, then `git worktree add --detach .claude/worktrees/review-<area id> origin/main` from the main checkout. Reviewers read the deployed code there and proof tests run there. It has no `backlog/`, so the backlog CLI uses the main checkout's board.
- Read the area task and its entry in the `Review map` doc. List open `review-finding` tasks that cite files in this area (`backlog task list --labels review-finding --plain`, then `backlog search <path>`), so known issues are not filed twice. Do not give this list to the reviewers.

## 1. Reviewers (opus, one per lens)

Spawn one agent per lens the area task names, all at once: `model: "opus"`, `effort: "xhigh"`, background. Each prompt is the **Preamble** from [LENSES.md](LENSES.md) with the fields filled, followed by that lens's brief. Reviewers share nothing, and you do not pass on your own guesses about where bugs are. Each reviewer forming its own view is what makes agreement between lenses worth something.

Wait for all of them. A reviewer that returns with unticked progress items gets one fresh agent with the same brief, told to finish the unticked items and append to the same files.

## 2. Merge

Read every lens file yourself. Merge findings that share a root cause and keep all their ids. A finding two lenses reached separately keeps the higher confidence. Drop exact duplicates of the open tasks from step 0, and note which task each one matches. Write `$NOTES/merged.md`.

## 3. Proof (opus)

Every finding of medium severity or above, and every low finding with high confidence, goes to proof. Batch them, at most six per agent and at most three agents at once: `model: "opus"`, background, with the **Proof** brief from LENSES.md. They all write tests in the one review worktree, each in its own test files. Every test in `apps/hono` and `libs/database` shares the one `pinsquirrel_test` database, so only one agent at a time may run tests there. Batch findings by workspace and run the database-backed batches one after another. Before the first proof agent, check that the dev MySQL is up (`docker compose -f docker-compose.dev.yml ps`). If it is not, ask the user to start it.

Results:

- **confirmed**: the test fails for the stated reason. Keep the test.
- **refuted**: the test passes. Dismiss the finding, with the guarding line as the reason.
- **untested**: carry it to step 4 if high or critical. Otherwise file it marked unproven.

Read each failing test before you believe it. A test that fails for a different reason, or only because of its own setup, proves nothing.

## 4. Adjudication (fable, only when needed)

If any high or critical finding is untested, spawn one agent with `model: "fable"` (if the model is rejected, use `"opus"` and say so) and the **Adjudication** brief, covering all of them at once. Its verdict decides those findings. Skip this step when there are none. Fable is used nowhere else in this skill.

## 5. File the findings

One task per root cause:

- Title: an imperative fix, for example `Reject URL checks that redirect to private addresses`.
- Labels: `review-finding`, plus `security`, `bug`, or `data-loss`.
- Priority: high for critical or high severity, medium for medium, low for low.
- Milestone: `<area id> issues`, one per reviewed area (for example `oauth-tokens issues`). Add it with `backlog milestone add` if it does not exist. Findings never go in the area task's milestone.
- Description: location, path, problem, triggers, impact, fix, the lens ids, `Found by /review-area <area id> (TASK-n)`, and the proof verdict. Paste a confirmed proof test's source if it is under 40 lines. Otherwise name what it asserts.
- For a `security` task, add: `The fix's commit message and PR description are public. Describe the change in neutral terms until it is deployed.`
- Acceptance criteria: one per behavior the regression test asserts, plus "the regression test is in the suite and passes".

Collect the low findings that remain into a single task, `Minor review items in <area id>`, with one checklist line each, at low priority.

## 6. Close the area

- Final summary on the area task: the lenses run, files covered, counts by severity, filed task ids, dismissed findings with one-line reasons, duplicates of open tasks, unticked progress items, and the out-of-scope notes worth a later look. Check its acceptance criterion and set it Done.
- In the `Review map` doc, set this area's last reviewed date and `origin/main` commit.
- Out-of-scope notes that point at real flaws in another area go in that area's To Do task as a comment, if the area exists and has not been reviewed. Otherwise they are filed under step 5.
- Remove the review worktree. The proof tests that matter are already in the tasks.

## Reply

Lead with confirmed critical and high `security` findings, each with its title, who can reach it, and its task id, and offer to fix them now on a branch. Then give the counts by severity, the filed tasks with ids and titles, the dismissed count, and the next area in the queue.
