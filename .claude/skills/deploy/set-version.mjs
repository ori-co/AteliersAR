#!/usr/bin/env node
// Sets the version label of the HTML overlay (element id="ar-version" in src/index.html). Touches nothing else.
// Usage (from anywhere): node .claude/skills/deploy/set-version.mjs "V1.8 - What changed"

import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../..')
const INDEX = join(ROOT, 'src', 'index.html')

const fail = msg => { console.error(`ERROR  ${msg}`); process.exit(1) }

const label = process.argv.slice(2).join(' ').trim()
if (!label) fail('usage: set-version.mjs "<label>"')
// The label is written as raw HTML text and looked up as-is in the deployed index.html
if (/[<>&"]/.test(label)) fail('the label cannot contain < > & or "')

const html = readFileSync(INDEX, 'utf8')
const re = /(id="ar-version"[^>]*>)([^<]*)(<)/g
const matches = [...html.matchAll(re)]
if (matches.length !== 1) fail(`expected exactly one element with id="ar-version" in src/index.html, found ${matches.length}`)

const before = matches[0][2]
if (before === label) { console.log(`version is already "${label}"`); process.exit(0) }
writeFileSync(INDEX, html.replace(re, `$1${label}$3`))
console.log(`version: "${before}" → "${label}"`)
