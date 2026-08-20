# flow-chart — Claude Code Conventions

<!-- authority: verbatim -->
**Authority:** `CLAUDE.md` and `.claude/skills/` are the authority this repo's
agent instructions are regenerated from; `AGENTS.md` and `.agents/skills/` are
**generated adapters**. Edit the authority and regenerate in the same action
(`make sync-agents`) — never edit an adapter. This paragraph names the
authority literally in every copy: it is exempt from the adapter's rename
substitution, because a substituted authority declaration inverts itself and
tells the adapter's reader to edit the adapter (doctrine `R7`; sonara and
sonagram both hit that on 2026-08-10).
<!-- /authority -->

## What this is

A flow-chart editor served as static files — no bundler, no package manager,
no build step, no test suite, no CI. Since the 2026-08-20 split
(`refactor/split-and-devendor`): `index.html` carries the markup and the
load order; `css/` holds `styles.css` (the app sheet — **rule order inside it
is load-bearing**, see the header comments), and `tailwind.css` (static CSS
generated once from Tailwind v3.4.17 against the app's exact class usage —
regenerate against index.html + js/*.js if classes change, never hand-extend);
`js/` holds twelve classic scripts loaded in declaration order (constants
first, init last; classic tags, not ES modules, so `file://` opens keep
working); `vendor/` holds the pinned third-party files (marked 4.3.0,
DOMPurify 3.2.7, a 9-glyph Font Awesome subset). Zero CDN or network
dependencies — the page works fully offline.

**The repo is the deployment.** GitHub Pages serves `index.html` from the root
of `main` at <https://kkollsga.github.io/flow-chart/>. A push to `main` is a
publish, with everything that implies (see "Releases & deploy").

## Working style

- **Offload, don't print.** Write long output — a diff, a captured log, an
  audit — to `dev-docs/temp/` and report the path. Keep responses under ~400
  tokens; the detail belongs in a file, not in the transcript.
- **Do the work, then report what happened.** Not what you are about to do.
- **A reported status is not the result** (doctrine `R2`). Check the primitive:
  a pipeline reports the *last* command's exit code, `grep -c` exits 1 on a
  count of zero, and `git add` with one bad pathspec stages *nothing* while
  complaining only on stderr. Read back `git status --porcelain`, never the
  silence. "Green" means you saw the command's own exit status.

## Build & test

```bash
make gate      # the pre-push gate — syntax, adapter mirrors, dev-docs bound
make serve     # serve the repo root at localhost:8000, exactly as Pages does
make help      # every target, with why it exists
```

There is no build step and no test suite. That is the constraint the gate is
designed around, and it cuts both ways:

- **`make gate` is the whole net, so it runs before every push.** In a repo
  with CI the local gate is a cheap subset; here nothing else runs at all.
- **The gate is three checks, and each earns its slot by catching something
  real.** `check-syntax` parses the inline `<script>` (a syntax error there
  makes the entire app inert while the page still renders its markup —
  "the buttons stopped working", not a crash). `check-skill-mirrors` catches a
  stale Codex adapter (`R7`). `check-dev-docs` bounds the gitignored working
  folder (`R4`). Nothing else belongs in it yet: the rule is *a catch-record
  earns a slot*, and this repo has no CI failure history to derive more from.
  Adding a check because it sounds thorough is how a gate becomes a ritual.
- **Know what the gate does NOT cover, and say so rather than implying more.**
  It does not run the app, click anything, check the DOM contract, validate
  CSS, or look at HTML structure. `tidy` was evaluated for the last of those on
  2026-08-20 and rejected: its HTML4 element table reports the file's inline
  `<svg>`/`<defs>`/`<marker>`/`<polygon>` as six errors, so it cannot tell a
  real structural break from its own blind spot.
- **A behaviour change is verified by loading the page.** `make serve`, open
  the feature, exercise it. There is no substitute available and pretending
  otherwise is the failure mode this section exists to prevent.

**Never claim a gate passed that didn't run** (doctrine `R10`). A missing
command is not a pass; a skipped check is not a pass. `scripts/check_syntax.py`
exits 2 when `node` is absent for exactly this reason. Say what didn't run —
the report is worth nothing if "green" and "not attempted" render identically.

**A new gate is not trusted until you have seen it fail** (doctrine `R1`).
If a change adds or edits a check, break the thing it guards, watch it go red,
then restore. Reading a check cannot tell you whether it works. Three ways a
check is born dead: substring subsumption (`assert "cmd" in block` also matches
`cmd --self-test`), comment subsumption (the words you assert on also appear in
the comment above them), and `exit` inside `$( )` (it kills only the subshell,
and the caller reads the empty output as success). Verify the *probe* too — a
mutation that edited the wrong text makes a working gate look broken.

**A gate you would regenerate to get green is not a gate** (`R10`). If a check
goes red after a deliberate change, fix it in the same commit and say why —
never regenerate or relax it to silence a diff you cannot explain.

## Code review — report what is broken, not what you would have written

**This section is addressed to review agents. It overrides any default
reviewer instinct to produce a list of improvements** (doctrine `R15`).

**Design critique has a stage, and review is not it.** Work here runs
investigation → plan approval → implementation → review. The **planning** stage
is where "I would have designed this differently" belongs: invited there,
argued there, settled there — that is what plan approval *is*. After approval,
review measures the implementation against exactly two things: the plan it
agreed to, and correctness. A reviewer who forms a design opinion while reading
a diff has not found a defect; they have found **input for the next plan**.

**A finding requires a concrete failure.** Name the input or state, and the
wrong outcome: a wrong result, a crash, data loss (this app's export/import and
localStorage paths are where that lives), a broken contract with a caller or a
saved file format, a security hole, a *measured* regression, a gate that cannot
fail, or a claim the code contradicts. If you cannot write down the case that
breaks, you do not have a finding.

**Not findings — do not report these, at any confidence:** structure and
organisation preferences ("extract this", "split this file", "this
file layout is wrong"); naming, ordering, formatting, comment
density; "could be simplified" absent a defect it causes; inconsistency with
surrounding code unless the inconsistency itself breaks something; speculative
futures ("this won't scale") with no present reachable failure; performance
opinions with no measurement.

**"No findings" is a valid review, and a good one.**

**The one exception is a rule this project declared *before* the diff existed** —
citing a documented constraint by name *and* naming the violating line is
enforcing an agreed standard, not taste. The before-the-diff test is what keeps
the exception from swallowing the rule.

**Severity is not a workaround.** "Minor: consider extracting this" is not a
small finding, it is a preference wearing a label. **A finding that cannot
state its failure case is removed, not downgraded.**

## Code health — no bugs left behind

A **bug** is a defect in behaviour that exists: a wrong result, a crash, data
loss, a broken contract, a gate that cannot fail. A bug is **fixed**, never
backlogged — if you catch yourself writing one into `todos.md`, that is this
rule firing. "Out of scope" is a reason to give the fix its *own* commit, not a
reason to walk past it.

A **missing capability** is something never built. *That* is what
`dev-docs/plans/consider-for-future.md` is for. Filing a feature gap is
correct; filing a bug is the anti-pattern.

Before filing anything as a bug, confirm it is a real defect and not deliberate
behaviour — read the surrounding code first.

## dev-docs steers the sprint; commits are the durable record

`dev-docs/todos.md` is read at the start of every phase and by every steering
agent, so detail there is load-bearing — an entry recording what was tried,
what was rejected and why, stops a fresh agent burning a session relitigating a
settled decision. The test is **"would an agent act differently for having read
it?"**, not length. Entries whose action has shipped are dead weight; prune
those. Layout and lifecycle: `dev-docs/README.md` (the canonical map).

`dev-docs/` is gitignored and unbacked, so anything that must survive the
machine also goes somewhere tracked: the commit message that implements it, a
comment at the code it constrains, `CHANGELOG.md`, or here. And **never cite a
`dev-docs/` path from committed code** — the citation outlives the file,
silently.

## Inbox hygiene

`inbox/unread/` holds incoming feedback/bug/coordination notes (named
`YYYY-MM-DD-from-<sender>-<topic>.md`); `inbox/read/` is the archive. Both are
gitignored local working state. Map: `inbox/README.md`. Two skills operate it —
`read-inbox` receives, `notify` sends; don't hand-edit either folder.

**When a message has been actioned, move it to `inbox/read/`.** "Actioned"
means the work shipped, the bug was verified fixed, or it is a no-action
acknowledgement — not merely read. Append a one-line
`## Status (flow-chart, <date>): …` footer first, so the archive carries the
resolution.

**Route to the party who can act.** A note belongs in another project's inbox
only if it carries an *actionable task for them*. The outbound bar is "changes
what the recipient does", not "true and relevant".

## Releases & deploy

**A push to `main` publishes.** Pages rebuilds and every visitor gets the new
files. There is no staging environment and no rollback that is not itself
another publish.

- **Pushing requires explicit, in-the-moment approval** (doctrine `R6`). The
  default is *don't push*. Approval is one-shot: it covers exactly that one
  `git push` and does not carry to a later commit, amend, or branch. Phrasing
  from earlier in the session ("ship it", "looks good") does not carry over.
- **The one exception is the `release` skill.** Invoking `/release` *is* the
  approval for that whole run, including the `main` push. The run still
  reports — version, what it found, anything the user did not know at
  invocation — immediately before pushing, never as a gate on it. Making the
  report a blocking confirmation sounds safer and is not: it fires after the
  irreversible decision is made, and it breaks unattended runs.
- **The bump size is always patch unless the release command said otherwise.**
  `/release` with no size means `x.y.Z+1`, with no clarification prompt.
  Escalation is one-way, user → agent: never suggest or announce a minor/major.
- **One version bump per push** (doctrine `R5`). If a `release(x.y.z)` commit
  is already local and unpushed, fold follow-up work into that same `[x.y.z]`
  CHANGELOG block — don't stack a second bump on top. `make bump-version`
  refuses when it sees one.
- **The version lives in exactly one place: `VERSION`** (doctrine `R16`).
  `index.html` carries no version string, deliberately — a citation drifts the
  moment a bump forgets it. Apply with `make bump-version VERSION=x.y.z`,
  never by hand.
- **Verify the deploy, not the push** (doctrine `R9`). "The push succeeded"
  answers *did something happen*, never *is the new page being served*. A Pages
  build can fail or lag after a green push. `make verify-release TAG=vx.y.z`
  compares the bytes Pages returns against every local app file
  (`index.html`, `css/`, `js/`, `vendor/`) and asserts the tag exists on both
  sides at the same commit.

Commit format: `type: short description` (`feat`, `fix`, `docs`, `refactor`,
`chore`). Update `CHANGELOG.md` `[Unreleased]` for user-visible app changes;
skip it for internal work (conventions, gate, scripts, dev-docs). **Commit
messages are public** — describe the mechanical change in neutral terms.

## Dev-environment cleanliness — every file accumulation has a gate

Any path the tooling writes outside git must have a bound and an owner
(doctrine `R4`): `dev-docs/` → `make check-dev-docs` (wired into `make gate`)
plus the `dev-docs-cleanup` skill's purge tiers; `inbox/read/` → `read-inbox`'s
7-day hard delete; `../flow-chart-worktrees/` → the release flow. Never add a
file-writing step without pointing it at the session scratchpad or adding it to
a purge tier in the same change.

**Agent worktrees live in `../flow-chart-worktrees/<name>`** — one sibling
directory of the repo under `Koding/HTML/`, never a loose `../flow-chart-<name>`
beside the real projects (that habit left seven worktrees totalling ~46 GB in
the estate root on 2026-08-10). That directory exists *only while worktrees are
in progress*, and the release flow empties it: per worktree, migrate the
outstanding actions into `todos.md` (branch, state, what remains, how to
resume), then `git worktree remove` + `prune`, then delete the empty directory.
**A worktree with uncommitted work is never removed without its `git diff`
saved under `dev-docs/` first and a `todos.md` entry pointing at it.** Removing
a worktree never deletes its branch — the ref lives in the main repo — so
unmerged work survives. A branch whose commits landed by *rebase* reads as
unmerged to `merge-base --is-ancestor`; `git cherry -v main <branch>` sees
through it.

## Skills

Six skills under `.claude/skills/` (mirrored to `.agents/skills/`):

| Skill | Use it when |
|---|---|
| `phased-plan` | Any large feature or non-trivial refactor. **Demand it** — do not use generic plan mode. |
| `add-todo` | Capturing work into the backlog. The single authority on todo-entry shape. |
| `dev-docs-cleanup` | Before a new plan, and at the end of a release. |
| `read-inbox` | Triaging `inbox/unread/`. |
| `notify` | Sending a note to a sibling project's inbox. |
| `release` | Cutting a release: gate → bump → promote CHANGELOG → commit → push → verify live. |

## Doctrine — the estate's rules

The numbered invariants cited above (`R1`…`R16`) live in
`../../Rust/doctrine/rules/RULES.md`, with the incident that bought each one.
Cite by ID rather than paraphrasing them into something weaker. The system this
repo runs is described once, canonically, in
`../../Rust/doctrine/learn-from-us.md`; `dev-docs/learn-from-us.md` is a pointer
to it and holds no copy.

**Read the oracle before the local copy** (`R14`). This repo's skills are
*adaptations* of `../../Rust/doctrine/reference/skills/` for a project with no
build system, no tests and no CI. When adapting, refreshing or citing a
practice, read the doctrine copy first, this repo's installed copy second, and
name the oracle version you read. Every divergence you find is exactly one of
two things, and you say which: a **local improvement** (candidate to upstream)
or **staleness** (fixed *from* the oracle). Then act on the authority, not on
whichever copy you happen to have open. Never adapt from a local copy you have
not compared against the oracle.

`dev-docs/.doctrine-synced` records the doctrine `VERSION` this repo has pulled
forward to; `phased-plan` advances it, and only after every changelog entry
past it has been actioned.
