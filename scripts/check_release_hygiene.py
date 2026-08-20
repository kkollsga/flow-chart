#!/usr/bin/env python3
"""CHANGELOG shape checks that a merge or a tired session gets wrong.

Two failures, both of which read as a complete list while hiding half of
themselves:

* **Duplicate section headings under one version.** Merging two branches that
  each added a `### Changed` block leaves two of them; a reader (and a release
  note generator) takes the first and drops the rest. Both of KGLite's 0.15.0
  merges produced exactly that.
* **A heading that is not a Keep a Changelog kind.** `### Notes`, `### Misc`
  are where entries go to be ignored.

Also asserts the file still has an `## [Unreleased]` section to write into,
because promoting it away without leaving a fresh one is the standard slip and
the next change then lands under the released version.
"""

from __future__ import annotations

import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CHANGELOG = ROOT / "CHANGELOG.md"

KINDS = {"Added", "Changed", "Deprecated", "Removed", "Fixed", "Security"}
VERSION_HEADING = re.compile(r"^## +(.+?)\s*$", re.M)
SUB_HEADING = re.compile(r"^### +(.+?)\s*$", re.M)


def main() -> int:
    if not CHANGELOG.is_file():
        print("check-release-hygiene: CHANGELOG.md is missing", file=sys.stderr)
        return 1
    text = CHANGELOG.read_text(encoding="utf-8")

    problems: list[str] = []
    headings = list(VERSION_HEADING.finditer(text))
    if not headings:
        return _fail(["CHANGELOG.md has no `## <version>` sections — the scan found nothing to check"])

    titles = [h.group(1) for h in headings]
    if not any(t.startswith("[Unreleased]") for t in titles):
        problems.append(
            "no `## [Unreleased]` section — promoting it away without leaving a fresh "
            "one sends the next change into the released version's block"
        )

    for i, h in enumerate(headings):
        start = h.end()
        end = headings[i + 1].start() if i + 1 < len(headings) else len(text)
        body = text[start:end]
        subs = [m.group(1) for m in SUB_HEADING.finditer(body)]
        seen: set[str] = set()
        for s in subs:
            if s in seen:
                problems.append(f"`## {h.group(1)}` carries two `### {s}` blocks — merge them")
            seen.add(s)
            if s not in KINDS:
                problems.append(
                    f"`## {h.group(1)}` has `### {s}`, which is not a Keep a Changelog kind "
                    f"({', '.join(sorted(KINDS))})"
                )

    if problems:
        return _fail(problems)
    print(f"check-release-hygiene: {len(headings)} section(s) well-formed")
    return 0


def _fail(problems: list[str]) -> int:
    print("check-release-hygiene: FAILED", file=sys.stderr)
    for p in problems:
        print(f"  {p}", file=sys.stderr)
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
