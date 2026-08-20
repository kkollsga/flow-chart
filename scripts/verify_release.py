#!/usr/bin/env python3
"""Verify a release was actually *recorded and served*, not merely pushed.

Two independent things can silently not happen after a green `git push`:

1. **The tag.** It is created locally here, but a push that forgets
   `--tags` leaves `origin` without it, and every other check still passes.
   KGLite shipped 0.15.3 to two registries with no tag in the clone for two
   days, and every version query answered "0.15.3" (doctrine `R9`).
2. **The deploy.** This repo *is* its deployment: GitHub Pages serves
   `index.html` from `main`. A Pages build can fail, or lag, after a
   successful push — so "the push succeeded" answers "did something happen",
   never "is the new page being served". The check that answers the second
   question is comparing the bytes Pages returns against the bytes at HEAD.

Read-only: it never creates a tag. A locally-minted tag would hide the failure
that caused its absence.

    python3 scripts/verify_release.py v0.1.0
"""

from __future__ import annotations

import hashlib
import json
import subprocess
import sys
import time
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DEPLOYED_FILE = "index.html"
POLL_SECONDS = [0, 20, 40, 60, 60]  # Pages builds usually land inside ~1 min


def run(*args: str) -> tuple[int, str]:
    done = subprocess.run(args, cwd=ROOT, capture_output=True, text=True)
    return done.returncode, (done.stdout or done.stderr).strip()


def check_tag(tag: str) -> list[str]:
    problems: list[str] = []
    run("git", "fetch", "--tags", "--quiet")
    rc, local = run("git", "rev-parse", f"{tag}^{{commit}}")
    if rc != 0:
        return [f"tag {tag} does not exist locally — the release was not recorded"]
    rc, remote_ls = run("git", "ls-remote", "--tags", "origin", f"refs/tags/{tag}")
    if rc != 0 or not remote_ls:
        problems.append(f"tag {tag} exists locally but not on origin — push it (`git push origin {tag}`)")
        return problems
    # Annotated tags: peel to the commit.
    remote_sha = remote_ls.split()[0]
    rc, peeled = run("git", "rev-parse", f"{tag}^{{commit}}")
    if rc == 0 and peeled != local:
        problems.append(f"tag {tag}: local peel disagrees with itself — inspect by hand")
    rc, remote_commit = run("git", "rev-parse", f"{remote_sha}^{{commit}}")
    if rc == 0 and remote_commit != local:
        problems.append(
            f"tag {tag} points at {local[:8]} locally but {remote_commit[:8]} on origin"
        )
    return problems


def pages_url() -> str | None:
    rc, out = run("gh", "api", f"repos/{repo_slug()}/pages")
    if rc != 0:
        return None
    try:
        data = json.loads(out)
    except json.JSONDecodeError:
        return None
    return data.get("html_url")


def repo_slug() -> str:
    rc, out = run("git", "remote", "get-url", "origin")
    if rc != 0:
        return ""
    slug = out.rsplit("github.com", 1)[-1].lstrip(":/")
    return slug[:-4] if slug.endswith(".git") else slug


def check_deploy() -> list[str]:
    url = pages_url()
    if url is None:
        return [
            "could not read the Pages configuration via `gh api …/pages` — the deploy "
            "was NOT verified. A check that could not run is not a pass."
        ]
    want = hashlib.sha256((ROOT / DEPLOYED_FILE).read_bytes()).hexdigest()
    served = ""
    for wait in POLL_SECONDS:
        if wait:
            time.sleep(wait)
        try:
            with urllib.request.urlopen(url, timeout=30) as resp:
                served = hashlib.sha256(resp.read()).hexdigest()
        except OSError as exc:  # noqa: PERF203 — one message per attempt is the point
            served = f"<fetch failed: {exc}>"
            continue
        if served == want:
            print(f"deploy: {url} serves the current {DEPLOYED_FILE} (sha256 {want[:12]}…)")
            return []
    return [
        f"deploy: {url} is not serving the current {DEPLOYED_FILE} after "
        f"~{sum(POLL_SECONDS)}s (served {served[:12]}…, expected {want[:12]}…). "
        f"Check the pages-build-deployment run: `gh run list --workflow=pages-build-deployment`."
    ]


def main(argv: list[str]) -> int:
    if len(argv) != 2:
        sys.stderr.write("usage: verify_release.py <tag>   e.g. verify_release.py v0.1.0\n")
        return 2
    tag = argv[1]
    problems = check_tag(tag) + check_deploy()
    if problems:
        print("verify-release: FAILED", file=sys.stderr)
        for p in problems:
            print(f"  {p}", file=sys.stderr)
        return 1
    print(f"verify-release: {tag} is tagged on both sides and live")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))
