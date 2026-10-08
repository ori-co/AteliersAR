#!/usr/bin/env node
// Registers an existing image target of a project (<project>/image-targets/<Name>.json):
//   1. adds its require() to <project>/src/app.js
//   2. adds an Image Target entity tracking it at the root of the main space in <project>/src/.expanse.json
// <project> is ateliers/<slug>/, or template/ for "template".
// Usage (from anywhere): node .claude/skills/add-target/add-to-scene.mjs <slug|template> "<Name>" ["<Entity name>"]
// Entity name defaults to "Cible d'image - <Name>". The entity is empty: its content is added in Studio.

import { randomUUID } from 'node:crypto'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../..')

// Orientation of the Image Target entities created in Studio (target image flat, facing up).
const ROTATION = [-4.329780281177466e-17, -0.7071067811865476, -0.7071067811865475, 4.329780281177467e-17]

const fail = msg => { console.error(`ERROR  ${msg}`); process.exit(1) }

const [slug, name, entityArg] = process.argv.slice(2).map(s => s.trim())
if (!slug || !name) fail('usage: add-to-scene.mjs <slug|template> "<Name>" ["<Entity name>"]')
const PROJECT = slug === 'template' ? join(ROOT, 'template') : join(ROOT, 'ateliers', slug)
if (!existsSync(PROJECT)) fail(`${PROJECT} does not exist`)
const SCENE = join(PROJECT, 'src', '.expanse.json')
const APP_JS = join(PROJECT, 'src', 'app.js')
const entityName = entityArg || `Cible d'image - ${name}`

const jsonFile = `${name}.json`
const jsonPath = join(PROJECT, 'image-targets', jsonFile)
if (!existsSync(jsonPath)) fail(`image-targets/${jsonFile} does not exist: run make-target.py first`)
const target = JSON.parse(readFileSync(jsonPath, 'utf8'))
if (target.name !== name) fail(`image-targets/${jsonFile} has "name": "${target.name}", expected "${name}"`)

// ── Scene: check everything before writing anything ───────────────────
const raw = readFileSync(SCENE, 'utf8')
const scene = JSON.parse(raw)
// Studio writes the file as JSON.stringify(…, null, 2). If that ever changes, abort rather than reformat the whole scene.
const serialize = s => JSON.stringify(s, null, 2) + (raw.endsWith('\n') ? '\n' : '')
if (serialize(scene) !== raw) fail('.expanse.json is not in the expected format: add the Image Target in Studio instead')

const spaceId = scene.entrySpaceId
if (!scene.spaces?.[spaceId]) fail(`entry space ${spaceId} not found in .expanse.json`)
const objects = Object.values(scene.objects || {})
if (objects.some(e => e.imageTarget?.name === name)) fail(`the scene already has an entity tracking "${name}"`)
if (objects.some(e => e.name === entityName)) fail(`the scene already has an entity named "${entityName}"`)

// Place it right after the last root Image Target, keeping Studio's fractional ordering.
const roots = objects.filter(e => e.parentId === spaceId).sort((a, b) => a.order - b.order)
const lastTarget = roots.filter(e => e.imageTarget).at(-1)
let order
if (lastTarget) {
  const next = roots.find(e => e.order > lastTarget.order)
  order = next ? (lastTarget.order + next.order) / 2 : lastTarget.order + 1
} else {
  order = (roots.at(-1)?.order ?? 0) + 1
}

// ── app.js ────────────────────────────────────────────────────────────
const appJs = readFileSync(APP_JS, 'utf8')
const requireLine = `require('../image-targets/${jsonFile}')`
let newAppJs = appJs
if (appJs.includes(requireLine)) {
  console.log(`app.js already loads ${jsonFile}`)
} else {
  const m = appJs.match(/imageTargetData:\s*\[([\s\S]*?)\n(\s*)\]/)
  if (!m) fail('could not find the imageTargetData: [ … ] list in src/app.js')
  const items = m[1].replace(/\s+$/, '')
  const indent = (m[1].match(/\n(\s*)require/) || [, m[2] + '  '])[1]
  const list = `imageTargetData: [${items}${items.trim() ? ',' : ''}\n${indent}${requireLine}\n${m[2]}]`
  newAppJs = appJs.replace(m[0], list)
}

// ── Write ─────────────────────────────────────────────────────────────
const id = randomUUID()
scene.objects[id] = {
  id,
  position: [0, 0, 0],
  rotation: ROTATION,
  scale: [1, 1, 1],
  geometry: null,
  material: null,
  parentId: spaceId,
  components: {},
  name: entityName,
  imageTarget: { name },
  order,
}
writeFileSync(SCENE, serialize(scene))
if (newAppJs !== appJs) {
  writeFileSync(APP_JS, newAppJs)
  console.log(`app.js: + ${requireLine}`)
}
console.log(`scene: + "${entityName}" (${id}) tracking "${name}" in ${scene.spaces[spaceId].name}`)
