#!/usr/bin/env node
// Pre-deploy checks for the WebAR project.
// Usage (from anywhere): node .claude/skills/deploy/preflight.mjs
// Exit code 1 if there is at least one error. Read-only.

import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { dirname, join, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../..')
const SRC = join(ROOT, 'src')
const TARGETS = join(ROOT, 'image-targets')
const DEPLOY_CONFIG = join(ROOT, 'deploy.config.json')

const errors = []
const warnings = []
const infos = []
const err = msg => errors.push(msg)
const warn = msg => warnings.push(msg)
const info = msg => infos.push(msg)

function report() {
  const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`
  console.log(`preflight: ${plural(errors.length, 'error')}, ${plural(warnings.length, 'warning')}`)
  infos.forEach(m => console.log(`INFO   ${m}`))
  errors.forEach(m => console.log(`ERROR  ${m}`))
  warnings.forEach(m => console.log(`WARN   ${m}`))
  process.exit(errors.length ? 1 : 0)
}

// Windows is case-insensitive, most web hosts are not: compare names exactly.
const existsExact = (dir, name) => { try { return readdirSync(dir).includes(name) } catch { return false } }
const isHidden = f => f.startsWith('.')

// ── Dependencies ──────────────────────────────────────────────────────
if (!existsSync(join(ROOT, 'node_modules'))) err('node_modules is missing: run `npm install`')

// ── Deploy target ─────────────────────────────────────────────────────
let deployDir = null
const noTarget = 'the build can run, but there is nowhere to deploy it'
if (!existsSync(DEPLOY_CONFIG)) warn(`deploy.config.json is missing: ${noTarget}`)
else {
  try {
    const cfg = JSON.parse(readFileSync(DEPLOY_CONFIG, 'utf8'))
    if (!cfg.dir) warn(`deploy.config.json has no "dir": ${noTarget}`)
    else {
      deployDir = resolve(ROOT, cfg.dir)
      // The deploy replaces this folder entirely: refuse the project itself, its parents and its own folders
      if ((ROOT + sep).startsWith(deployDir + sep) || deployDir.startsWith(ROOT + sep))
        err(`deploy.config.json "dir" (${cfg.dir}) is the project, one of its parents or one of its folders: it would be wiped`)
      info(`deploy target: ${deployDir}${cfg.url ? ` (${cfg.url})` : ''}`)
    }
  } catch (e) { err(`deploy.config.json: ${e.message}`) }
}

// ── Image targets loaded by app.js ────────────────────────────────────
const appJs = readFileSync(join(SRC, 'app.js'), 'utf8')
const required = [...appJs.matchAll(/require\(\s*['"]\.\.\/image-targets\/([^'"]+)['"]\s*\)/g)].map(m => m[1])
if (!required.length) err('src/app.js loads no image target (no require(\'../image-targets/…\'))')

const loadedNames = new Map() // target name → json file
const targetFiles = new Set() // every file in image-targets/ that belongs to a loaded target
for (const file of required) {
  if (!existsExact(TARGETS, file)) { err(`src/app.js requires image-targets/${file}, which does not exist (the build will fail)`); continue }
  targetFiles.add(file)
  let json
  try { json = JSON.parse(readFileSync(join(TARGETS, file), 'utf8')) } catch (e) { err(`image-targets/${file}: ${e.message}`); continue }
  if (!json.name) err(`image-targets/${file}: no "name" field`)
  else loadedNames.set(json.name, file)
  for (const res of Object.values(json.resources || {})) {
    if (!res) continue
    targetFiles.add(res)
    if (!existsExact(TARGETS, res)) err(`image-targets/${file}: resource "${res}" is missing`)
  }
}
info(`targets loaded by app.js: ${[...loadedNames].map(([n, f]) => `${n} (${f})`).join(', ') || 'none'}`)

for (const f of readdirSync(TARGETS))
  if (!isHidden(f) && !targetFiles.has(f)) warn(`image-targets/${f} is not used by app.js but will still be deployed`)

// ── Scene ─────────────────────────────────────────────────────────────
let scene
try { scene = JSON.parse(readFileSync(join(SRC, '.expanse.json'), 'utf8')) } catch (e) { err(`src/.expanse.json: ${e.message}`); report() }
const entities = Object.values(scene.objects || {})

const sceneTargets = entities.filter(e => e.imageTarget)
if (!sceneTargets.length) warn('the scene has no Image Target entity')
const trackedNames = new Set()
for (const e of sceneTargets) {
  const name = e.imageTarget.name
  trackedNames.add(name)
  if (!loadedNames.has(name))
    err(`scene entity "${e.name}" tracks target "${name}", but app.js only loads: ${[...loadedNames.keys()].join(', ') || 'nothing'}. Nothing will be detected`)
}
for (const name of loadedNames.keys())
  if (!trackedNames.has(name)) warn(`target "${name}" is loaded by app.js but no scene entity tracks it`)

// Assets referenced by the scene (GLB models…) are paths relative to src/
const usedAssets = new Set()
const walk = (v, visit) => {
  visit(v)
  if (Array.isArray(v)) v.forEach(x => walk(x, visit))
  else if (v && typeof v === 'object') Object.values(v).forEach(x => walk(x, visit))
}
walk(scene.objects, v => { if (typeof v === 'string' && v.startsWith('assets/')) usedAssets.add(v) })
for (const a of usedAssets) {
  const [dir, file] = [dirname(join(SRC, a)), a.split('/').pop()]
  if (!existsExact(dir, file)) err(`the scene references src/${a}, which does not exist`)
}
const assetsDir = join(SRC, 'assets')
if (existsSync(assetsDir)) for (const f of readdirSync(assetsDir))
  if (!isHidden(f) && !usedAssets.has(`assets/${f}`)) warn(`src/assets/${f} is not referenced by the scene but will still be deployed`)

// Custom components: registered in src/*.ts|js vs used in the scene
const registered = new Set()
for (const f of readdirSync(SRC).filter(f => /\.(ts|js)$/.test(f))) {
  const code = readFileSync(join(SRC, f), 'utf8')
  for (const m of code.matchAll(/registerComponent\(\s*\{\s*name:\s*['"]([^'"]+)['"]/g)) registered.add(m[1])
}
const usedComponents = new Set(entities.flatMap(e => Object.values(e.components || {}).map(c => c.name)))
for (const c of usedComponents)
  if (!registered.has(c)) warn(`the scene uses component "${c}", which is not registered in src/ (ignore if it is a built-in 8thWall component)`)

// ── Version label (HTML overlay) ──────────────────────────────────────
// The build may minify index.html: accept the id with or without quotes
const versionOf = html => html.match(/id="?ar-version"?[^>]*>([^<]*)</)?.[1]
const version = versionOf(readFileSync(join(SRC, 'index.html'), 'utf8'))
if (!version) warn('no element with id="ar-version" in src/index.html: you won\'t be able to tell which build runs on the phone')
else {
  info(`version: "${version}"`)
  const deployedIndex = deployDir && join(deployDir, 'index.html')
  if (deployedIndex && existsSync(deployedIndex) && versionOf(readFileSync(deployedIndex, 'utf8')) === version)
    warn(`version "${version}" is already the deployed one (found in ${deployedIndex}): bump it before deploying`)
}

report()
