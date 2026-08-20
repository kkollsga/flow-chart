# Changelog

All notable user-visible changes to the flow-chart app. Format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/); versions are
[semver](https://semver.org/). The version itself is declared in exactly one
place — the `VERSION` file — and applied with `make bump-version`.

Internal-only changes (agent conventions, the gate, scripts, dev-docs) do not
get an entry here; git history is their record.

## [Unreleased]

### Changed
- The app no longer loads anything from a CDN and now works fully offline:
  Tailwind's runtime compiler is replaced with equivalent static CSS, and
  marked 4.3.0 plus the Font Awesome icons used are bundled with the app.
  Appearance and behaviour are unchanged.

## [0.1.0] — 2026-08-20

Baseline. This is the app as it stood when versioning, the local gate and the
release flow were introduced (`index.html` at commit `606776d`, last touched
2025-04-27, already live on GitHub Pages). Nothing changed in the app itself.

Deliberately **not** tagged retroactively: a `v0.1.0` tag minted now would
claim a release run that never happened, and `scripts/verify_release.py` is
built to notice exactly that kind of gap. Tagging starts with the next
release.
