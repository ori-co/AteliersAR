---
name: deploy
description: Check, build and deploy ONE atelier. Runs pre-flight checks (image targets, scene, assets, version label), builds ateliers/<slug>/, replaces only the <slug>/ build folder at the repo root and regenerates the root index.html (home page listing the deployed ateliers). Other ateliers are left untouched. Only run on explicit request.
disable-model-invocation: true
argument-hint: "<slug> [version label, e.g. \"V1.8 - Platform animation\"]"
allowed-tools: Bash(node .claude/skills/deploy/preflight.mjs*), Bash(node .claude/skills/deploy/set-version.mjs*), Bash(node .claude/skills/deploy/build-home.mjs*)
---

# deploy

The repo root is the static site: `index.html` is the home page and `<slug>/` is the build of each atelier (URL `/<slug>/`). This skill builds one atelier into `<slug>/`, then regenerates `index.html`. Background: [README.md](../../../README.md#build--deploy).

**Never commit or push.** The last step proposes a commit message only. **Never touch another atelier's build folder.**

Arguments: `$ARGUMENTS`. The first word is the slug (a folder of `ateliers/`), the rest is the version label. If no slug was given, list `ateliers/` and ask. `template` can't be deployed.

`<project>` below is `ateliers/<slug>/` (the source). `<slug>/` is the build at the repo root (what is served).

## 0. Version label (only if a label was given)

The label is the `id="ar-version"` element of the atelier's HTML overlay, not a scene entity, so Studio is not involved:

```sh
node .claude/skills/deploy/set-version.mjs <slug> "<label>"
```

If no label was given, skip this step. The pre-flight will flag a label that hasn't changed.

## 1. Pre-flight

```sh
node .claude/skills/deploy/preflight.mjs <slug>
```

Read-only. It checks that:

- `<slug>/` at the root, if it exists, is a previous build (it gets replaced entirely);
- `atelier.json` has a title, client and date (home page entry);
- every image target required by `src/app.js` exists, along with its 4 images;
- each scene Image Target entity tracks a target that `app.js` actually loads (the names must match, or nothing is detected and no error is shown);
- the GLB files referenced by the scene exist, and the scene's custom components are registered in `src/`;
- the version label is not already the deployed one (looked up in `<slug>/index.html`).

It also warns about image targets and assets that are unused but would still be deployed.

What to do next:

- **Any ERROR** → stop. Explain each error to the user and how to fix it. Scene issues (target name, entities) are fixed **by the user in 8thWall Studio**: don't hand-edit `src/.expanse.json`. Only fix `src/app.js` yourself if the user agrees.
- **"version … is already the deployed one"** → ask the user (AskUserQuestion) for a new label (then run step 0 and rerun the pre-flight), or deploy anyway.
- **`node_modules` missing** → step 2 installs it.
- **Other warnings** → list them briefly and continue unless the user objects.
- Remind the user to **save the atelier in Studio** before the build: the build reads `src/.expanse.json` from disk.

## 2. Build

From the repo root (Bash tool, POSIX). webpack resolves paths from the current directory, so the build must run inside the atelier:

```sh
cd ateliers/<slug> && { [ -d node_modules ] || npm ci; } && rm -rf dist && npm run build
```

`dist/` is removed first because the build never cleans it, and old targets or assets would pile up and get deployed. If the build fails, show the relevant part of the error, stop and don't touch `<slug>/`.

## 3. Replace `<slug>/` and the home page

From the repo root. Only this atelier's build folder is replaced:

```sh
rm -rf "<slug>" && cp -r ateliers/<slug>/dist "<slug>"
node .claude/skills/deploy/build-home.mjs
```

`build-home.mjs` writes the root `index.html` from `home/index.html`, listing every atelier that has a build folder at the root. Report its `WARN` lines: a build folder that matches no atelier stays online but isn't listed.

## 4. Verify

```sh
diff -rq ateliers/<slug>/dist "<slug>"     # must print nothing
git status --short "<slug>" index.html | cut -c1-2 | sort | uniq -c
```

Also check that the version label shown by the pre-flight appears in `<slug>/index.html`, and that `index.html` lists the atelier. Run `git status --short` on the whole repo too: outside `ateliers/<slug>/`, only `<slug>/` and `index.html` should have changed.

## 5. Hand over to the user

Give a short summary: atelier and version deployed, where, warnings you skipped. Then:

- Propose a commit message, e.g. `<slug> V1.7 - Full card target`.
- The static host publishes the repo once it's pushed.
- After publishing: open `<url>/<slug>/` (`url` from `deploy.config.json`) **on the real device** and check the version label on screen. If the old one still shows, it is the host / browser cache: wait a minute and reload.
