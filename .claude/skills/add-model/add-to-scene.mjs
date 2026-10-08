#!/usr/bin/env node
// Puts a GLB of a project (<project>/src/assets/<name>.glb) under an Image Target entity of <project>/src/.expanse.json.
// <project> is ateliers/<slug>/, or template/ for "template".
// Usage (from anywhere): node .claude/skills/add-model/add-to-scene.mjs <slug|template> <name> "<Target name>" [--size S]
// The model stands on the image: base on the image plane, centered on it, its up axis out of the image.
// Its largest dimension is scaled to S image target units (default 0.6), whatever the GLB's own units.

import { randomUUID } from 'node:crypto'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../..')

// Child of an Image Target entity: +90° around X turns the model's up (+Y) into the target's +Z, out of the image.
const ROTATION = [0.7071067811865475, 0, 0, 0.7071067811865476]
const DEFAULT_SIZE = 0.6

const fail = msg => { console.error(`ERROR  ${msg}`); process.exit(1) }

const args = process.argv.slice(2)
const sizeAt = args.indexOf('--size')
const size = sizeAt >= 0 ? Number(args.splice(sizeAt, 2)[1]) : DEFAULT_SIZE
const [slug, name, targetName] = args.map(s => s.trim())
if (!slug || !name || !targetName) fail('usage: add-to-scene.mjs <slug|template> <name> "<Target name>" [--size S]')
if (!(size > 0)) fail('--size must be a positive number')
const PROJECT = slug === 'template' ? join(ROOT, 'template') : join(ROOT, 'ateliers', slug)
if (!existsSync(PROJECT)) fail(`${PROJECT} does not exist`)
const SCENE = join(PROJECT, 'src', '.expanse.json')
const asset = `assets/${name}.glb`
const glbPath = join(PROJECT, 'src', asset)
if (!existsSync(glbPath)) fail(`src/${asset} does not exist: run obj2glb.py first`)
const entityName = `${name}.glb`

// ── GLB bounding box (glTF units, Y up) ───────────────────────────────
function glbBounds(file) {
  const buf = readFileSync(file)
  if (buf.readUInt32LE(0) !== 0x46546c67) fail(`src/${asset} is not a binary glTF (.glb)`)
  const gltf = JSON.parse(buf.toString('utf8', 20, 20 + buf.readUInt32LE(12)))
  const mul = (a, b) => { // column-major 4x4
    const r = new Array(16).fill(0)
    for (let c = 0; c < 4; c++) for (let row = 0; row < 4; row++) for (let k = 0; k < 4; k++) r[c * 4 + row] += a[k * 4 + row] * b[c * 4 + k]
    return r
  }
  const local = n => {
    if (n.matrix) return n.matrix
    const [x, y, z, w] = n.rotation || [0, 0, 0, 1], [sx, sy, sz] = n.scale || [1, 1, 1], [tx, ty, tz] = n.translation || [0, 0, 0]
    return [
      (1 - 2 * (y * y + z * z)) * sx, 2 * (x * y + z * w) * sx, 2 * (x * z - y * w) * sx, 0,
      2 * (x * y - z * w) * sy, (1 - 2 * (x * x + z * z)) * sy, 2 * (y * z + x * w) * sy, 0,
      2 * (x * z + y * w) * sz, 2 * (y * z - x * w) * sz, (1 - 2 * (x * x + y * y)) * sz, 0,
      tx, ty, tz, 1,
    ]
  }
  const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity]
  const visit = (i, parent) => {
    const n = gltf.nodes[i], m = mul(parent, local(n))
    for (const prim of n.mesh !== undefined ? gltf.meshes[n.mesh].primitives : []) {
      const acc = gltf.accessors[prim.attributes.POSITION]
      for (const cx of [acc.min[0], acc.max[0]]) for (const cy of [acc.min[1], acc.max[1]]) for (const cz of [acc.min[2], acc.max[2]])
        for (let a = 0; a < 3; a++) {
          const v = m[a] * cx + m[4 + a] * cy + m[8 + a] * cz + m[12 + a]
          lo[a] = Math.min(lo[a], v); hi[a] = Math.max(hi[a], v)
        }
    }
    for (const c of n.children || []) visit(c, m)
  }
  const identity = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]
  for (const i of gltf.scenes[gltf.scene ?? 0].nodes) visit(i, identity)
  if (lo[0] === Infinity) fail(`src/${asset} has no mesh`)
  return { lo, hi }
}

const { lo, hi } = glbBounds(glbPath)
const dims = hi.map((h, i) => h - lo[i])
const scale = size / Math.max(...dims)
// Model point v ends up at position + R(scale * v), with R: (x, y, z) → (x, -z, y).
// Bring the base center (cx, minY, cz) to the image center.
const [cx, cy, cz] = [(lo[0] + hi[0]) / 2, lo[1], (lo[2] + hi[2]) / 2]
const position = [-scale * cx, scale * cz, -scale * cy].map(v => Math.abs(v) < 1e-9 ? 0 : v) // float noise, -0

// ── Scene: check everything before writing anything ───────────────────
const raw = readFileSync(SCENE, 'utf8')
const scene = JSON.parse(raw)
// Studio writes the file as JSON.stringify(…, null, 2). If that ever changes, abort rather than reformat the whole scene.
const serialize = s => JSON.stringify(s, null, 2) + (raw.endsWith('\n') ? '\n' : '')
if (serialize(scene) !== raw) fail('.expanse.json is not in the expected format: add the model in Studio instead')

const objects = Object.values(scene.objects || {})
const targets = objects.filter(e => e.imageTarget?.name === targetName)
if (!targets.length) fail(`no Image Target entity tracks "${targetName}". Targets in the scene: ${objects.filter(e => e.imageTarget).map(e => e.imageTarget.name).join(', ') || 'none'}`)
if (targets.length > 1) fail(`several entities track "${targetName}": ${targets.map(e => e.name).join(', ')}`)
const parent = targets[0]
if (objects.some(e => e.gltfModel?.src?.asset === asset)) fail(`the scene already uses ${asset}`)

const siblings = objects.filter(e => e.parentId === parent.id)
if (siblings.length) console.log(`WARN   "${parent.name}" already has ${siblings.length} child(ren): ${siblings.map(e => e.name).join(', ')}. They may overlap`)
const order = Math.max(0, ...siblings.map(e => e.order ?? 0)) + 1

// ── Write ─────────────────────────────────────────────────────────────
const id = randomUUID()
scene.objects[id] = {
  id,
  position,
  rotation: ROTATION,
  scale: [scale, scale, scale],
  geometry: null,
  material: null,
  parentId: parent.id,
  components: {},
  gltfModel: { src: { type: 'asset', asset } },
  name: entityName,
  order,
}
writeFileSync(SCENE, serialize(scene))
const fmt = n => +n.toPrecision(4)
console.log(`model: ${dims.map(fmt).join(' x ')} (width x height x depth, GLB units) → largest dimension ${size} target units (scale ${fmt(scale)})`)
console.log(`scene: + "${entityName}" (${id}) under "${parent.name}"`)
