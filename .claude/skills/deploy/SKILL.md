---
name: deploy
description: Check, build and deploy the WebAR project. Runs pre-flight checks (image targets, scene, assets, version label), builds it, replaces the deploy folder set in deploy.config.json with the fresh build and proposes a commit message. Overwrites the deploy folder, so only run on explicit request.
disable-model-invocation: true
argument-hint: "[version label, e.g. \"V1.8 - Platform animation\"]"
allowed-tools: Bash(node .claude/skills/deploy/preflight.mjs*), Bash(node .claude/skills/deploy/set-version.mjs*)
---

# deploy

Builds the project and copies `dist/` to the deploy folder. Background: [README.md](../../../README.md#build--deploy).

**Never commit or push.** The last step proposes a commit message only.

Label given by the user: `$ARGUMENTS`

## 0. Version label (only if a label was given above)

The label is the `id="ar-version"` element of the HTML overlay (`src/index.html`), not a scene entity, so Studio is not involved:

```sh
node .claude/skills/deploy/set-version.mjs "<label>"
```

If no label was given, skip this step. The pre-flight will flag a label that hasn't changed.

## 1. Pre-flight

```sh
node .claude/skills/deploy/preflight.mjs
```

Read-only. It checks that:

- `deploy.config.json` has a `dir` (the folder that receives the build), which is not the project or one of its folders;
- every image target required by `src/app.js` exists, along with its 4 images;
- each scene Image Target entity tracks a target that `app.js` actually loads (the names must match, or nothing is detected and no error is shown);
- the GLB files referenced by the scene exist, and the scene's custom components are registered in `src/`;
- `node_modules/` is installed;
- the version label is not already the deployed one (looked up in `<dir>/index.html`).

It also warns about image targets and assets that are unused but would still be deployed.

What to do next:

- **Any ERROR** → stop. Explain each error to the user and how to fix it. Scene issues (target name, entities) are fixed **by the user in 8thWall Studio**: don't hand-edit `src/.expanse.json`. Only fix `src/app.js` yourself if the user agrees.
- **No deploy target** (`dir` is `null`) → ask the user where to deploy. Until it is set, you can still run step 2 (build only) and stop there.
- **"version … is already the deployed one"** → ask the user (AskUserQuestion) for a new label (then run step 0 and rerun the pre-flight), or deploy anyway.
- **Other warnings** → list them briefly and continue unless the user objects.
- Remind the user to **save the scene in Studio** before the build: the build reads `src/.expanse.json` from disk.

## 2. Build

From the project root (Bash tool, POSIX). webpack resolves paths from the current directory:

```sh
rm -rf dist && npm run build
```

`dist/` is removed first because the build never cleans it, and old targets or assets would pile up and get deployed. If the build fails, show the relevant part of the error, stop and don't touch the deploy folder.

## 3. Replace the deploy folder

`<dir>` is `deploy.config.json` → `dir`, resolved from the project root. It must contain nothing but build output:

```sh
rm -rf "<dir>" && cp -r dist "<dir>"
```

## 4. Verify

```sh
diff -rq dist "<dir>"     # must print nothing
```

Also check that the version label shown by the pre-flight appears in `<dir>/index.html`. If `<dir>` is in a git repo, summarize the changes with `git -C "<dir>" status --short . | cut -c1-2 | sort | uniq -c`.

## 5. Hand over to the user

Give a short summary: version deployed, where, warnings you skipped. Then:

- Propose a commit message. The convention is the version label, e.g. `V1.7 - Full card target`.
- Tell the user how the deploy folder gets published (push, upload…) if that is not automatic.
- After publishing: open `deploy.config.json` → `url` **on the real device** and check the version label on screen. If the old one still shows, it is the host / browser cache: wait a minute and reload.
