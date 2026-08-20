#!/usr/bin/env python3
"""Apply a version to the one place that declares it.

The version lives in `VERSION` and nowhere else. `index.html` deliberately
carries no version string: a citation drifts the moment a bump forgets it, and
doctrine `R16` is the rule that a version declaration may move while a citation
must not exist to be forgotten. If a visible version is ever wanted in the app,
add it here as a stamp written *by this script*, never as a second hand-edited
literal.

The bump *size* is not this script's decision — patch by default, and only the
release invocation changes that (CLAUDE.md "Releases"). This applies the number
it is handed, after checking it is a real semver and actually moves forward.
"""

from __future__ import annotations

import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
VERSION_FILE = ROOT / "VERSION"
SEMVER = re.compile(r"^(\d+)\.(\d+)\.(\d+)$")


def main(argv: list[str]) -> int:
    if len(argv) != 2 or not argv[1].strip():
        sys.stderr.write("usage: make bump-version VERSION=x.y.z\n")
        return 2
    new = argv[1].strip()
    m = SEMVER.match(new)
    if not m:
        sys.stderr.write(f"bump-version: {new!r} is not a MAJOR.MINOR.PATCH version\n")
        return 2

    old = VERSION_FILE.read_text(encoding="utf-8").strip()
    if not SEMVER.match(old):
        sys.stderr.write(f"bump-version: VERSION currently holds {old!r}, which is not semver\n")
        return 2
    if tuple(int(x) for x in new.split(".")) <= tuple(int(x) for x in old.split(".")):
        sys.stderr.write(f"bump-version: {new} does not move forward from {old}\n")
        return 2

    # R5 — one version bump per push. An unpushed release commit means the
    # version it picked is still the one being cut; fold into it.
    staged = subprocess.run(
        ["git", "log", "origin/main..HEAD", "--oneline"],
        cwd=ROOT, capture_output=True, text=True,
    )
    if staged.returncode == 0:
        for line in staged.stdout.splitlines():
            if re.search(r"\brelease\(", line):
                sys.stderr.write(
                    f"bump-version: an unpushed release commit already exists:\n"
                    f"    {line}\n"
                    f"bump-version: keep that version and fold this work into its CHANGELOG\n"
                    f"bump-version: block (doctrine R5 — one version bump per push).\n"
                )
                return 1

    VERSION_FILE.write_text(new + "\n", encoding="utf-8")
    print(f"bump-version: {old} -> {new} (VERSION)")
    print("bump-version: now promote CHANGELOG [Unreleased] -> [%s] and run `make release-preflight`" % new)
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))
