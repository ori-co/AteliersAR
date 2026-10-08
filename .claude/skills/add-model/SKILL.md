---
name: add-model
description: Add a 3D model to an atelier from a Tinkercad OBJ export (.zip with .obj + .mtl). Converts it to GLB in ateliers/<slug>/src/assets/ and puts it in the scene under the Image Target entity of the chosen image target, standing on the image. Use when the user gives a .zip 3D scene and wants it to appear on an image target.
argument-hint: "<slug> <path/to/scene.zip> [Target name] [model name]"
allowed-tools: Bash(python .claude/skills/add-model/obj2glb.py*), Bash(node .claude/skills/add-model/add-to-scene.mjs*), Bash(node .claude/skills/deploy/preflight.mjs*)
---

# add-model

Turns a `.zip` 3D scene into a GLB of one atelier and puts it on one of its image targets. The atelier is `ateliers/<slug>/` (written `<project>` below); `template` as slug works on `template/` instead. Background: [README.md](../../../README.md#workflow-a-new-atelier).

**Never commit or push. Never deploy** (that's `/deploy`, on explicit request only).

Arguments: `$ARGUMENTS`

## 0. Gather the info

- **Atelier**: the slug, i.e. a folder of `ateliers/`. If none was given, list them and ask.
- **Zip**: usually in `<project>/scenes/`. If none was given and that folder holds exactly one `.zip` not yet converted, suggest it. One zip = one model; the converter only reads the first `.obj` of the zip.
- **Image target**: the `name` of a target of the scene (see `<project>/image-targets/*.json`). If there is only one, suggest it.
- **Model name**: file name of the GLB, also in its URL. Lowercase letters, digits, `-`. Suggest one from the zip name and confirm it.
- **Studio**: if the user has the atelier open in 8thWall Studio, ask them to save and close it first (the script edits `src/.expanse.json`).

## 1. Convert to GLB

```sh
python .claude/skills/add-model/obj2glb.py "<zip>" ateliers/<slug>/src/assets/<name>.glb
```

The user's converter for **Tinkercad** exports: one object per part and color, colors from the `Kd` of the `.mtl` (no textures), non metallic, Z up → Y up, units unchanged (mm). Needs `pip install numpy trimesh networkx`. Refuse to overwrite an existing `src/assets/<name>.glb` without asking.

- `ATTENTION : couleur … absente du .mtl`: those faces come out grey. Tell the user.

## 2. Put it on the image target

```sh
node .claude/skills/add-model/add-to-scene.mjs <slug> <name> "<Target name>" [--size S]
```

- Adds a `<name>.glb` entity as a child of the Image Target entity tracking `<Target name>`, in the format Studio writes (`gltfModel: { src: { type: 'asset', asset: 'assets/<name>.glb' } }`).
- The model **stands on the image**: base on the image plane, centered on it, its up axis out of the image. Its largest dimension is scaled to `S` image target units (default `0.6`), whatever the GLB's units. Scale and centering are computed from the GLB's bounding box.
- Aborts without writing anything if `.expanse.json` isn't in the format Studio writes, if no (or several) entities track the target, or if the GLB is already used in the scene. Warns if the target already has children (they may overlap).

This and `/add-target` are the only allowed hand edits of `.expanse.json` (see CLAUDE.md).

## 3. Check

```sh
node .claude/skills/deploy/preflight.mjs <slug>
```

No ERROR. Ignore warnings about node_modules, the deploy target or the version label.

## 4. Hand over to the user

Short summary: GLB (size, colors), target it stands on, size kept. Then:

1. Test on the real device via `/deploy <slug>`. Size and placement are a first guess: adjust with `--size` (remove the entity and rerun) or in Studio.
2. Propose a commit message, e.g. `<slug>: add <name> model on <Target name>`. Don't commit.
