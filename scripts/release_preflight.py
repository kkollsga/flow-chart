#!/usr/bin/env python3
"""Every precondition for cutting a release, reported in one place.

A **checker, not a driver**: it performs no release step and has no `--fix`.
Each unmet precondition prints the command that would meet it, and the
decision stays with the human running the release.

The safety that matters on a release is upstream of the push and mechanical —
these checks, the gate, and the deploy verification afterwards. A confirmation
prompt is not one of them: it fires after the irreversible decision has been
made and stalls unattended runs (CLAUDE.md "Releases").
"""

from __future__ import annotations

import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SEMVER = re.compile(r"^\d+\.\d+\.\d+$")
DATED_HEADING = re.compile(r"^## +\[(?P<v>[^\]]+)\](?: +— +(?P<d>\d{4}-\d{2}-\d{2}))?\s*$", re.M)

results: list[tuple[bool, str, str]] = []


def check(ok: bool, label: str, fix: str = "") -> None:
    results.append((ok, label, fix))


def git(*args: str) -> tuple[int, str]:
    done = subprocess.run(["git", *args], cwd=ROOT, capture_output=True, text=True)
    return done.returncode, (done.stdout or done.stderr).strip()


def script(name: str) -> tuple[int, str]:
    done = subprocess.run([sys.executable, str(ROOT / "scripts" / name)], cwd=ROOT,
                          capture_output=True, text=True)
    return done.returncode, (done.stdout + done.stderr).strip()


def main() -> int:
    version = (ROOT / "VERSION").read_text(encoding="utf-8").strip()
    check(bool(SEMVER.match(version)), f"VERSION is semver ({version})",
          "make bump-version VERSION=x.y.z")

    text = (ROOT / "CHANGELOG.md").read_text(encoding="utf-8")
    headings = list(DATED_HEADING.finditer(text))
    released = [h for h in headings if h.group("v") != "Unreleased"]
    top = released[0] if released else None
    check(top is not None and top.group("v") == version,
          f"CHANGELOG's newest released section is [{version}]",
          f"promote `## [Unreleased]` to `## [{version}] — <today>` in CHANGELOG.md")
    check(top is not None and bool(top.group("d")),
          "that section carries a date",
          f"write `## [{version}] — YYYY-MM-DD`")
    check(any(h.group("v") == "Unreleased" for h in headings),
          "a fresh `## [Unreleased]` section is left on top",
          "add an empty `## [Unreleased]` above the newest version")

    rc, out = script("check_release_hygiene.py")
    check(rc == 0, "CHANGELOG sections are well-formed", "make check-release-hygiene   # " + out.splitlines()[-1] if out else "")

    rc, out = script("check_syntax.py")
    check(rc == 0, "index.html's inline script parses", "make check-syntax")

    rc, out = git("rev-parse", "--abbrev-ref", "HEAD")
    branch = out if rc == 0 else "?"
    check(True, f"on branch {branch}" + ("" if branch == "main" else " (fold-into-main branch)"))

    git("fetch", "--quiet", "origin", "main")
    rc, _ = git("merge-base", "--is-ancestor", "origin/main", "HEAD")
    check(rc == 0, "origin/main is an ancestor of HEAD (fast-forward push)",
          "git pull --rebase origin main")

    rc, out = git("tag", "--list", f"v{version}")
    check(not out.strip(), f"v{version} is not already tagged",
          "that version is already cut — bump again (doctrine R5: one version bump per push)")

    rc, out = git("status", "--porcelain")
    dirty = [l for l in out.splitlines() if l.strip()]
    check(True, f"{len(dirty)} path(s) modified in the working tree"
                + (" — stage release files explicitly by path, never `git add -A`" if dirty else ""))

    failed = [(label, fix) for ok, label, fix in results if not ok]
    for ok, label, fix in results:
        print(f"  {'ok  ' if ok else 'FAIL'}  {label}")
    if failed:
        print("\nrelease-preflight: NOT READY", file=sys.stderr)
        for label, fix in failed:
            if fix:
                print(f"  {label}\n      -> {fix}", file=sys.stderr)
        return 1
    print("\nrelease-preflight: every precondition met")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
