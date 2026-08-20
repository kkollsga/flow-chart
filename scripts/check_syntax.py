#!/usr/bin/env python3
"""Parse the app's JavaScript — inline <script> blocks in index.html plus every
js/*.js file — and fail on a syntax error.

The app's behaviour lives in plain classic scripts with no bundler, no type
checker and no test suite, so a stray `}` is not caught by anything before it
reaches the deployed page — and because each file is parsed as one unit, a
syntax error anywhere in it means that file's classes never come into
existence and the app is inert. The page still renders its markup, so the
failure looks like "the buttons stopped working", not like a crash.

That is the one class of defect a mechanical check can catch here for free, so
it is the gate (doctrine R4's sibling reasoning: a check earns its slot by
catching something real). `node --check` parses without executing.

Not covered, deliberately, so nobody reads a green run as more than it is:
runtime errors, DOM contract breakage, CSS, and HTML structure. `tidy` was
evaluated for the last of those on 2026-08-20 and rejected — its HTML4 element
table reports the file's inline <svg>/<defs>/<marker>/<polygon> as six errors,
so it cannot tell a real structural break from its own blind spot.
"""

from __future__ import annotations

import re
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
HTML_TARGETS = ["index.html"]
JS_GLOB = "js/*.js"

# Inline blocks only: a <script src=…> is either a vendored file (checked via
# JS_GLOB if it lives in js/) or a third-party file we do not own.
INLINE = re.compile(r"<script\b(?![^>]*\bsrc=)[^>]*>(.*?)</script>", re.S)


def line_of(text: str, offset: int) -> int:
    return text.count("\n", 0, offset) + 1


def check_js_file(path: Path) -> list[str]:
    done = subprocess.run(
        ["node", "--check", str(path)], capture_output=True, text=True
    )
    if done.returncode != 0:
        detail = (done.stderr or done.stdout).strip()
        return [f"{path.relative_to(ROOT)}: failed to parse:\n    " + detail.replace("\n", "\n    ")]
    return []


def check_file(path: Path) -> tuple[list[str], int]:
    """Returns (problems, number of inline blocks checked)."""
    text = path.read_text(encoding="utf-8")
    problems: list[str] = []
    blocks = list(INLINE.finditer(text))
    for block in blocks:
        js = block.group(1)
        start_line = line_of(text, block.start(1))
        with tempfile.NamedTemporaryFile("w", suffix=".js", delete=False, encoding="utf-8") as fh:
            # Pad so node's reported line numbers match the .html file's.
            fh.write("\n" * (start_line - 1) + js)
            tmp = Path(fh.name)
        try:
            done = subprocess.run(
                ["node", "--check", str(tmp)], capture_output=True, text=True
            )
            if done.returncode != 0:
                detail = (done.stderr or done.stdout).strip()
                # node resolves the symlinked temp dir (/var -> /private/var), so
                # strip both spellings or the substitution leaves "/private" behind.
                for spelling in (str(tmp.resolve()), str(tmp)):
                    detail = detail.replace(spelling, path.name)
                problems.append(f"{path.name}: inline script failed to parse:\n    " + detail.replace("\n", "\n    "))
        finally:
            tmp.unlink(missing_ok=True)
    return problems, len(blocks)


def main() -> int:
    if shutil.which("node") is None:
        # A missing command is not a pass (R2 / gate honesty).
        sys.stderr.write(
            "check-syntax: node is not on PATH, so the inline script was NOT parsed.\n"
            "check-syntax: install node (brew install node) and re-run. Refusing to\n"
            "check-syntax: report a verdict from a check that could not run.\n"
        )
        return 2

    problems: list[str] = []
    checked = 0
    for name in HTML_TARGETS:
        path = ROOT / name
        if not path.is_file():
            problems.append(f"{name}: missing — this gate's target does not exist")
            continue
        file_problems, blocks = check_file(path)
        problems.extend(file_problems)
        checked += blocks

    for path in sorted(ROOT.glob(JS_GLOB)):
        problems.extend(check_js_file(path))
        checked += 1

    if checked == 0:
        # A scan that finds nothing is not a pass (R2). Either the app stopped
        # carrying script anywhere this check looks — in which case this gate
        # needs rewriting, not silently skipping — or the patterns broke.
        problems.append(
            "no script found: index.html has no inline <script> block and "
            f"{JS_GLOB} matches nothing. A check that scans nothing must not "
            "report success."
        )

    if problems:
        print("check-syntax: FAILED", file=sys.stderr)
        for p in problems:
            print(f"  {p}", file=sys.stderr)
        return 1
    print(f"check-syntax: {checked} script(s) parse clean")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
