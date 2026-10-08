---
name: new-atelier
description: Create a new atelier (one WebAR experience with its own URL) by copying template/ to ateliers/<slug>/ and filling its home page entry (atelier.json). Use when the user starts a new atelier / workshop / event.
argument-hint: "<slug> [\"Title\"] [\"Client / place\"] [YYYY-MM-DD]"
allowed-tools: Bash(node .claude/skills/new-atelier/new-atelier.mjs*), Bash(node .claude/skills/deploy/preflight.mjs*)
---

# new-atelier

Creates `ateliers/<slug>/`, a full 8thWall Studio project copied from `template/`. Background: [README.md](../../../README.md#ateliers).

**Never commit or push. Never deploy** (that's `/deploy`, on explicit request only).

Arguments: `$ARGUMENTS`

## 0. Gather the info

- **Slug**: the URL of the atelier (`/<slug>/`). Lowercase letters, digits, hyphens. Suggest one from the title if none was given, e.g. `2026-10-salon-vivatech`, and confirm it. It can't be changed easily once deployed (the old URL stays online).
- **Title** and **client / place**: shown on the home page.
- **Date** (`YYYY-MM-DD`): sorts the home page, newest first. Defaults to today.

## 1. Create it

```sh
node .claude/skills/new-atelier/new-atelier.mjs <slug> "<Title>" "<Client / place>" [YYYY-MM-DD]
```

It copies `template/` without `node_modules/` and `dist/`, writes `atelier.json`, and sets the page `<title>` and the package name. It refuses an existing slug.

## 2. Check

```sh
node .claude/skills/deploy/preflight.mjs <slug>
```

Expected warnings at this stage: `node_modules` missing, no deploy target. No ERROR.

## 3. Hand over to the user

Then tell them to:

1. **Open `ateliers/<slug>/` in 8thWall Studio** (the folder itself, not the repo root).
2. Add image targets with `/add-target <slug> <image>` (Studio closed), then the GLB models under each target **in Studio**.
3. Deploy with `/deploy <slug>` to test on the real device.

Propose a commit message, e.g. `New atelier: <Title>`. Don't commit.
