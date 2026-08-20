# flow-chart — local gate and release entry points.
#
# Small named targets, each with a doc comment saying *why* it exists. This
# project has no build system, no test suite and no CI: `make gate` is the only
# mechanical check anything gets before the change is live, because a push to
# `main` IS the deploy (GitHub Pages serves index.html from the branch root).
# That makes the gate's membership rule stricter than usual, not looser — see
# CLAUDE.md "Build & test".

.DEFAULT_GOAL := help
PYTHON := python3

## The pre-push gate. Three checks, and each one is here because it can catch
## something real in a repo with no other net:
##   check-syntax        — a syntax error in any app script (inline blocks in
##                         index.html, js/*.js) makes the app inert while the
##                         page still renders.
##   check-skill-mirrors — a stale Codex adapter teaches a procedure the live
##                         copy warns against (doctrine R7).
##   check-dev-docs      — the gitignored working folder is the one accumulation
##                         with no reviewer, no CI and no remote (doctrine R4).
## Nothing else belongs here yet. The rule is "a catch-record earns a slot",
## and this repo has no CI failure history to derive more from.
.PHONY: gate
gate: check-syntax check-skill-mirrors check-dev-docs
	@echo "gate: green"

## Parse every app script (inline <script> blocks in index.html plus js/*.js)
## with node --check. Fails if it finds nothing to check. See the script's
## docstring for what this deliberately does NOT cover.
.PHONY: check-syntax
check-syntax:
	@$(PYTHON) scripts/check_syntax.py

## CLAUDE.md + .claude/skills/ (authority) vs AGENTS.md + .agents/skills/
## (generated). Drift here is fixed by regenerating, never by hand-porting.
.PHONY: check-skill-mirrors
check-skill-mirrors:
	@$(PYTHON) scripts/check_skill_mirrors.py

## Regenerate the Codex adapter from the authority, then prove it is in sync.
## Run this after ANY edit to CLAUDE.md or .claude/skills/, in the same action.
.PHONY: sync-agents
sync-agents:
	@$(PYTHON) scripts/gen_agents_adapter.py
	@$(PYTHON) scripts/check_skill_mirrors.py

## Mechanical bound on the gitignored dev-docs/ working folder — the one
## accumulation with no reviewer, no CI and no remote watching it grow. It
## NEVER deletes: which tier a file belongs in, and whether it is reproducible,
## is a judgement call, so the gate FAILS and hands the decision back. Stale
## purge-tier entries are reported as a warning (temp/bin churn is normal
## working state; failing on it would only teach people to bypass the gate).
## Tier lifecycles: dev-docs/README.md.
DEV_DOCS_MAX_MB := 64
.PHONY: check-dev-docs
check-dev-docs:
	@[ -d dev-docs ] || { echo "no dev-docs/ — nothing to bound"; exit 0; }; \
	mb=$$(du -sm dev-docs | cut -f1); \
	stale=$$( { find dev-docs/temp -mindepth 1 -maxdepth 1 -mtime +1; \
	            find dev-docs/bin  -mindepth 1 -maxdepth 1 -mtime +7; \
	          } 2>/dev/null ); \
	if [ "$${mb:-0}" -ge $(DEV_DOCS_MAX_MB) ]; then \
		echo "FAIL: dev-docs/ is $${mb} MB (>= $(DEV_DOCS_MAX_MB) MB)"; \
		echo "  largest tiers:"; \
		du -sm dev-docs/* 2>/dev/null | sort -rn | head -8 | sed 's/^/    /'; \
		[ -z "$$stale" ] || { echo "  past their documented lifetime:"; echo "$$stale" | sed 's/^/    /'; }; \
		echo "  -> reclaim, or move anything irreproducible to a durable tier (dev-docs/README.md)"; \
		exit 1; \
	fi; \
	echo "dev-docs/ is $${mb} MB (limit $(DEV_DOCS_MAX_MB) MB)"; \
	[ -z "$$stale" ] || { echo "WARN: past their documented lifetime (dev-docs/README.md):"; \
	                      echo "$$stale" | sed 's/^/    /'; }

## CHANGELOG shape: an [Unreleased] section exists, and it carries no duplicate
## or non-Keep-a-Changelog headings. Two "### Changed" blocks under one version
## is what a merge produces, and it reads as a complete list while hiding half
## of itself.
.PHONY: check-release-hygiene
check-release-hygiene:
	@$(PYTHON) scripts/check_release_hygiene.py

## Every precondition for cutting a release, reported in one place. A CHECKER,
## not a driver: it runs no release step and has no --fix. It prints the
## command for each unmet precondition and you decide what to run.
.PHONY: release-preflight
release-preflight:
	@$(PYTHON) scripts/release_preflight.py

## Apply a version. The version lives in exactly one declared place (VERSION);
## nothing else may cite it, so nothing else can drift (doctrine R16). Never
## hand-edit VERSION — this target validates the shape first.
##   make bump-version VERSION=0.1.1
.PHONY: bump-version
bump-version:
	@$(PYTHON) scripts/bump_version.py "$(VERSION)"

## Verify a cut release was recorded AND is being served (tag on both sides at
## the same commit; Pages returns the current index.html).
##   make verify-release TAG=v0.1.0
.PHONY: verify-release
verify-release:
	@$(PYTHON) scripts/verify_release.py "$(TAG)"

## Serve the app locally exactly as Pages does (static file from the repo root).
## http://localhost:8000/ — Ctrl-C to stop.
.PHONY: serve
serve:
	@echo "serving $(CURDIR) at http://localhost:8000/ (Ctrl-C to stop)"
	@$(PYTHON) -m http.server 8000 --directory "$(CURDIR)"

.PHONY: help
help:
	@echo "flow-chart targets:"
	@awk '/^## /{sub(/^## /,""); doc = doc $$0 " "; next} /^[a-z][a-zA-Z-]*:/{if (doc != "") {split($$1,n,":"); printf "  %-22s %s\n", n[1], substr(doc,1,70); doc=""}}' Makefile
