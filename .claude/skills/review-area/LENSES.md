# Review briefs

The orchestrator pastes the **Preamble** and one **Lens** into each reviewer's prompt, filling the `<…>` fields from the area task. The **Proof** and **Adjudication** briefs are for steps 4 and 5 of the skill.

## Preamble

> I wrote PinSquirrel, a bookmarking service, and run it in production with real users' private data. You are doing a defensive review of my code so I can find and fix its bugs and security flaws before anyone else hits them. The fixes ship as ordinary pull requests. Read `CLAUDE.md` first: its Layering section explains the rule that apps call services and never repositories, because `libs/services` is the only layer that enforces `AccessControl` and validation.
>
> **Area:** <area id>: <title>. **Files:** <files>. **Entry points:** <entry points>. **Who reaches them:** <actors>. **Code:** the worktree at <path>, which is the deployed `main`.
>
> How to work:
>
> - Read every file in scope in full. Do not skim or sample by grep. Follow calls out of scope as far as you need to see what happens to the data, and name what you followed.
> - First write `<notes dir>/<lens>-progress.md` as a checklist of every file and entry point in scope. Tick each as you finish it. Do not stop while items are unticked, unless something blocks you; then write what blocked you.
> - For every entry point, trace each input from where it enters to where it is used: stored, rendered, fetched, sent as email, written to disk, or executed. A finding cites that path as file:line steps.
> - Report everything you find, including low-severity and uncertain items, each with a confidence. A later pass checks every finding, so leaving one out costs more than reporting a weak one.
> - Also list what you checked and found sound, one line each. This shows the next reviewer what has been covered.
> - Describe each flaw in prose: what is wrong, the conditions that trigger it, the impact, and the fix. Do not write exploit payloads or attack scripts. The proof of a flaw is a regression test that asserts the correct behavior and fails today.
> - Work only against local code. Never send a request to the production site or to any third-party host.
> - Change no files except your notes and progress files. Do not read other reviewers' notes.
>
> Write your findings to `<notes dir>/<lens>.md` in this format and return only the path and the counts by severity:
>
> ```
> ### <LENS>-<n>: <short title>
> - Location: file:line
> - Path: entry point → … → sink, as file:line steps
> - Severity: critical | high | medium | low
> - Confidence: high | medium | low
> - Reached by: anonymous | waitlisted user | active user | token holder | OAuth client | web page | admin | operator
> - Problem: <plain language>
> - Triggers when: <conditions>
> - Impact: <what goes wrong for the service or its users>
> - Fix: <the change>
> - Regression test: <what the test asserts, and which existing test file it fits in>
> ```
>
> Then a `## Checked and sound` list, then `## Out of scope` with one line per issue you noticed outside the area.

Severity scale: **critical** means an outsider can run code, take over an account or token, read secrets or keys, or read or destroy another user's pins. **High** means stored XSS, tampering with another user's data, SSRF into the host network, authorization bypass for a signed-in user, or silent data loss. **Medium** means denial of service from one request, a privacy leak, bypassing the waitlist gate, or data corruption that is recoverable. **Low** means wrong behavior with no security effect, or a hardening gap.

## Lenses

### boundaries

> Your lens is **trust boundaries**. For each entry point, establish who can call it and check that the code enforces exactly that. Check authentication on every route, HTMX endpoint, API handler and MCP tool, not only the obvious ones. Flag every app or middleware that calls a repository directly instead of a service, other than the two exceptions `CLAUDE.md` names: each one is an authorization check that did not happen. Check authorization per object: can one user or token read or change another user's pins, tags, private pins, profile, or exports? Check that the waitlist status gates everything it should, across the web app, the API, OAuth and MCP. Check OAuth: dynamic client registration, redirect URI matching, PKCE, the `state` parameter, code reuse, token and refresh-token lifetimes, scopes enforced on every API and MCP call, and revocation. Check session and cookie flags, CSRF protection on every state-changing request in both the web and admin apps, redirect targets, CORS, rate limits, and spam controls on signup and other public forms. In the extension, check which origins and pages can send it messages and what it trusts from them. Check that a failed check stops the request, not just logs it.

### input

> Your lens is **untrusted input reaching a sink**. Treat everything from outside as hostile: request bodies, headers, query strings, uploaded import files (bookmark HTML exports and the like), pin URLs, titles, descriptions and tags, OAuth client metadata from registration, MCP tool arguments, fetched remote pages, and messages and page data the extension receives. Follow each to its sinks and check the guard at that sink: server-rendered JSX and HTMX attributes (escaping, `hx-*` attributes, `javascript:` and other dangerous URL schemes in `href`, Markdown rendering and content negotiation), the CSP and anything that would need it to hold, email bodies and headers, outbound requests (private and loopback addresses, redirects that land on them, DNS that changes between check and use, unbounded response size or time), SQL built outside the query builder, regular expressions that backtrack on long input, size and count limits on pins, tags and imports, and parsers that two layers read differently.

### state

> Your lens is **state and data integrity**. Look for ways the service loses or corrupts users' pins, tags or settings: multi-row writes outside a transaction, read-modify-write races between requests (tag merges and renames, imports running beside edits, the extension syncing while the user edits on the web), retries from the extension or API clients that apply twice, crashes between two dependent writes, migrations that cannot resume, deletes that cascade further than intended (account, tag and pin deletion), sessions and OAuth tokens that outlive the thing they were issued for, errors that are caught and dropped, and cleanup jobs that remove something still in use. For each, say what state a crash or a concurrent request leaves behind and whether the next run repairs it.

### intent

> Your lens is **correctness against intent**. Compare what the code does with what its docs (`README.md`, `DEPLOYMENT.md`, the API docs route), the decision log in `PLAN.md`, its tests, and the specs it implements (OAuth 2.1, dynamic client registration, authorization server and protected resource metadata, PKCE, MCP, the REST API's own documented contract, Chrome extension Manifest V3) say it should do. Look for edge cases the tests do not cover: empty, huge, duplicate, and out-of-order input; URL normalisation and duplicate pins; Unicode in tags; time zones and dates; pagination limits; behaviour that differs between the web app, the REST API and MCP for the same operation; and feature combinations such as private mode with export, or the waitlist with OAuth. Report a mismatch even when its impact is unclear.

## Proof

> I wrote PinSquirrel and run it in production. A reviewer reported the findings below in <area>. Your job is to confirm or refute each one by writing a regression test that asserts the correct behavior, in the worktree at <path>. Run `pnpm install` there first if `node_modules` is missing. Tests use Vitest. Tests in `apps/hono` and `libs/database` need the dev MySQL from `docker-compose.dev.yml`; they use the `pinsquirrel_test` database, never the development one.
>
> For each finding: read the cited code, then write the smallest test that asserts what should happen, in the test file the finding names or the nearest existing one. Use the project's existing test helpers (`apps/hono/src/test-support/`, `libs/database/src/test-fixtures.ts`, `libs/services/src/test-utils.ts`). Run only that test file, from the worktree root: `pnpm --filter <workspace> exec vitest --run <file>`. A test that fails for the reason the finding gives confirms it. A test that passes refutes it. If a test would need real network access, a deployed site, or more than an hour of scaffolding, mark the finding `untested` and say why. Do not fix the code. Keep the tests in the worktree. Do not commit.
>
> Write `<notes dir>/proof-<n>.md` with, per finding: id, verdict (confirmed | refuted | untested), the test file and test name, the failure output's key lines, and for refuted findings the line of code that already handles the case. Return the path and the verdict counts.

## Adjudication

> I wrote PinSquirrel and run it in production. Below are findings from a defensive review of <area> that a test could not settle. For each one, read the cited code yourself and decide: real, not real, or real with a different severity. Trace the path from the entry point and check every guard along it, including those outside the cited files. Give a one-paragraph reason per finding that cites file:line. Write `<notes dir>/adjudication.md` and return the path.
