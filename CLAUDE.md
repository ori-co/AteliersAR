# CLAUDE.md

Project docs: [README.md](README.md). Read it before changing anything.

## Rules

- **Never commit or push.** When work is done, propose a commit message only.
- `src/.expanse.json` is written by 8thWall Studio. Prefer asking the user to change the scene in Studio over hand-editing it. Only exception: adding an Image Target entity, via `.claude/skills/add-target/add-to-scene.mjs`.
- The version label lives in the HTML overlay (`id="ar-version"` in `src/index.html`), not in the scene. Set it with `.claude/skills/deploy/set-version.mjs`.
- Before writing 8thWall ECS code, read the "ECS gotchas" table in [README.md](README.md#ecs-gotchas).
- Work one step at a time, validated on the real device. Desktop preview doesn't count.
- The user communicates in French. Project docs (README, this file) are in English.

## Project skills (`.claude/skills/`)

- `/add-target`: turn a JPG/PNG into an image target, load it in `app.js` and add its entity to the scene.
- `/deploy`: pre-flight checks, build and copy to the folder set in `deploy.config.json`. Only on explicit request.
