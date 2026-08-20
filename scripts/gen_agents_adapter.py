#!/usr/bin/env python3
"""Regenerate the Codex adapter (`AGENTS.md`, `.agents/skills/`) from the authority.

`CLAUDE.md` + `.claude/skills/` are the authority; this script produces the
Codex-side copies. Never hand-edit the generated side: an improvement made
there is invisible to the authority and gets deleted by the next run (doctrine
`R7`; sonara lost ~20 lines that way on 2026-08-10).

The transform is one substitution — the name of the conventions file each side
points at — with **one exemption that matters**: a region wrapped in

    <!-- authority: verbatim -->
    …
    <!-- /authority -->

is copied through untouched, because it names the authority *literally* in
every copy. Substituting an authority declaration inverts it: the adapter ends
up telling its reader that the adapter is the thing to edit. sonara and
sonagram both hit exactly that on 2026-08-10, the day the procedure landed.

Skill *paths* are deliberately not substituted either: a step that names both
`.claude/skills/` and `.agents/skills/` means both, in either tree.
"""

from __future__ import annotations

import re
import shutil
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CLAUDE_SKILLS = ROOT / ".claude" / "skills"
AGENTS_SKILLS = ROOT / ".agents" / "skills"
ROOT_CLAUDE = ROOT / "CLAUDE.md"
ROOT_AGENTS = ROOT / "AGENTS.md"

VERBATIM = re.compile(r"<!-- authority: verbatim -->.*?<!-- /authority -->", re.S)
TITLE = re.compile(r"^# (?P<repo>.+?) — Claude Code Conventions[ \t]*$", re.M)


def transform(text: str, *, is_root: bool) -> str:
    """Substitute the conventions-file name outside every verbatim region."""
    out: list[str] = []
    pos = 0
    for m in VERBATIM.finditer(text):
        out.append(text[pos : m.start()].replace("CLAUDE.md", "AGENTS.md"))
        out.append(m.group(0))  # untouched — it names the authority literally
        pos = m.end()
    out.append(text[pos:].replace("CLAUDE.md", "AGENTS.md"))
    result = "".join(out)
    if is_root:
        result = TITLE.sub(r"# \g<repo> — Codex Conventions", result)
    return result


def main() -> int:
    if not ROOT_CLAUDE.is_file():
        sys.stderr.write("gen-agents: CLAUDE.md is missing — nothing to generate from\n")
        return 2
    if not CLAUDE_SKILLS.is_dir():
        sys.stderr.write("gen-agents: .claude/skills/ is missing — nothing to generate from\n")
        return 2

    written = 0
    ROOT_AGENTS.write_text(transform(ROOT_CLAUDE.read_text(encoding="utf-8"), is_root=True), encoding="utf-8")
    written += 1

    # Full replace, not merge: a skill deleted from the authority must not
    # survive on the Codex side, where nothing would ever read it again.
    if AGENTS_SKILLS.exists():
        shutil.rmtree(AGENTS_SKILLS)
    for src in sorted(CLAUDE_SKILLS.rglob("*")):
        rel = src.relative_to(CLAUDE_SKILLS)
        dst = AGENTS_SKILLS / rel
        if src.is_dir():
            dst.mkdir(parents=True, exist_ok=True)
            continue
        dst.parent.mkdir(parents=True, exist_ok=True)
        if src.suffix == ".md":
            dst.write_text(transform(src.read_text(encoding="utf-8"), is_root=False), encoding="utf-8")
        else:
            shutil.copy2(src, dst)
        written += 1

    print(f"gen-agents: regenerated {written} file(s) from CLAUDE.md + .claude/skills/")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
