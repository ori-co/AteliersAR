---
name: add-target
description: Add an image target to the WebAR project from a JPG/PNG given by the user. Generates the 8thWall target files in image-targets/ (like Studio does), loads it in src/app.js and adds an empty Image Target entity tracking it in the main scene. Use when the user gives an image and wants it as a new AR image target.
argument-hint: "<path/to/image.jpg> [Target name]"
allowed-tools: Bash(python .claude/skills/add-target/make-target.py*), Bash(node .claude/skills/add-target/add-to-scene.mjs*), Bash(node .claude/skills/deploy/preflight.mjs*)
---

# add-target

Turns an image into a new image target and puts it in the scene. Background: [README.md](../../../README.md#image-targets).

**Never commit or push. Never deploy** (that's `/deploy`, on explicit request only).

Arguments: `$ARGUMENTS`

## 0. Gather the info

- **Image**: a path to a JPG or PNG. If the user pasted the image in the chat instead of giving a path, ask them for the file path (the scripts need a file on disk).
- **Target name**: the `name` field of the JSON, also used for the file names. Letters, digits, spaces, `_`, `-`. If none was given, suggest one that follows the existing ones in `image-targets/` and confirm it.
- Look at the image (Read tool). A **landscape** image is rotated 90° clockwise by the script, the way Studio stores landscape targets. Content placed under the entity must follow that orientation.
- **Studio**: ask the user to **save and close the project in 8thWall Studio** before you continue. The script edits `src/.expanse.json`; an open Studio may overwrite the change on its next save.

## 1. Generate the target files

```sh
python .claude/skills/add-target/make-target.py "<image>" "<Name>"
```

It writes `image-targets/<Name>.json` plus `_original`, `_cropped`, `_luminance` and `_thumbnail` PNGs, with Studio's conventions (3:4 portrait crop, 480x640 grayscale luminance, 263x350 thumbnail). By default it keeps the largest **centered** 3:4 area. It refuses a name that already exists. Needs Pillow (`pip install Pillow`).

- Check `<Name>_cropped.png` (Read tool): it is what the phone will look for. It must contain the whole printed visual, with no margin or background around it.
- If the crop is wrong (a `WARN` about >15% cropped out, or the visual is off-center), delete the 5 files and rerun with `--crop LEFT,TOP,WIDTH,HEIGHT` (pixels of the rotated image if it was landscape, ratio 3:4). Or ask the user to crop the image themselves first.
- `WARN … upscaled`: the image is small. It works, but suggest a sharper source if tracking turns out weak.

## 2. Add it to app.js and to the scene

```sh
node .claude/skills/add-target/add-to-scene.mjs "<Name>" ["<Entity name>"]
```

- Adds `require('../image-targets/<Name>.json')` to the `imageTargetData` list of `src/app.js`.
- Adds an **empty** Image Target entity at the root of the main space, tracking `<Name>`, with the orientation Studio gives Image Target entities. Default entity name: `Cible d'image - <Name>`.
- Aborts without writing anything if `.expanse.json` isn't in the format Studio writes, or if the target / entity name is already used.

This is the only allowed hand edit of `.expanse.json` (see CLAUDE.md). Don't edit the scene any other way.

## 3. Check

```sh
node .claude/skills/deploy/preflight.mjs
```

It must show no ERROR, and the new target must appear in "targets loaded by app.js". Ignore warnings about the deploy target or the version label here (they're about deploying).

## 4. Hand over to the user

Short summary: target name, crop kept, entity added. Then tell them to:

1. **Reopen the project in Studio** and check that the target shows up in the image targets list and on the new entity. If Studio doesn't list it, upload the same image in Studio under the same name (it will regenerate the files) and tell me, so the skill can be fixed.
2. Add the content (GLB model, etc.) **under the new entity in Studio**, then save.
3. Test it on the real device via `/deploy`.

Propose a commit message, e.g. `Add <Name> image target`. Don't commit.
