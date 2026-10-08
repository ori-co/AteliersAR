#!/usr/bin/env node
// Creates ateliers/<slug>/ as a copy of template/ (without node_modules/ and dist/) and fills its atelier.json.
// Usage (from anywhere): node .claude/skills/new-atelier/new-atelier.mjs <slug> "<Title>" "<Client / place>" [YYYY-MM-DD]
// Date defaults to today. It only sorts the home page, newest first.

import { cpSync, existsSync, readFileSync, writeFileSync } from 'node:fs'
import { basename, dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../..')
const TEMPLATE = join(ROOT, 'template')

const fail = msg => { console.error(`ERROR  ${msg}`); process.exit(1) }

const [slug, title, client, dateArg] = process.argv.slice(2).map(s => s.trim())
if (!slug || !title || !client) fail('usage: new-atelier.mjs <slug> "<Title>" "<Client / place>" [YYYY-MM-DD]')
// The slug is the URL of the atelier: /<slug>/
if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug)) fail(`invalid slug "${slug}": lowercase letters, digits and single hyphens only`)
// Builds are deployed to <repo>/<slug>/, next to the repo's own folders
const RESERVED = ['template', 'ateliers', 'home', 'node_modules']
if (RESERVED.includes(slug)) fail(`"${slug}" is reserved (${RESERVED.join(', ')})`)
if (/[<>&"]/.test(title + client)) fail('title and client cannot contain < > & or "')
const date = dateArg || new Date().toISOString().slice(0, 10)
if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) fail(`invalid date "${date}": expected YYYY-MM-DD`)

const dest = join(ROOT, 'ateliers', slug)
if (existsSync(dest)) fail(`ateliers/${slug} already exists`)

const skipped = new Set(['node_modules', 'dist'])
cpSync(TEMPLATE, dest, { recursive: true, filter: src => !skipped.has(basename(src)) })

writeFileSync(join(dest, 'atelier.json'), JSON.stringify({ title, client, date }, null, 2) + '\n')

for (const file of ['package.json', 'package-lock.json']) {
  const path = join(dest, file)
  const pkg = JSON.parse(readFileSync(path, 'utf8'))
  pkg.name = `ateliers-ar-${slug}`
  if (pkg.packages?.['']) pkg.packages[''].name = pkg.name
  writeFileSync(path, JSON.stringify(pkg, null, 2) + '\n')
}

const indexPath = join(dest, 'src', 'index.html')
const html = readFileSync(indexPath, 'utf8')
  .replace(/<title>[^<]*<\/title>/, `<title>${title}</title>`)
  .replace(/(<meta property="og:title" content=")[^"]*(")/, `$1${title}$2`)
writeFileSync(indexPath, html)

console.log(`ateliers/${slug}/ created from template/ ("${title}", ${client}, ${date})`)
