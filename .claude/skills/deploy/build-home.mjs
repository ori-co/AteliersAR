#!/usr/bin/env node
// Writes the repo's root index.html (the site home page): home/index.html with one entry per atelier
// that is deployed (<repo>/<slug>/index.html exists), newest first, from ateliers/<slug>/atelier.json.
// Usage (from anywhere): node .claude/skills/deploy/build-home.mjs

import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../..')
const ATELIERS = join(ROOT, 'ateliers')
const HOME = join(ROOT, 'home', 'index.html')
const PLACEHOLDER = /<!-- ATELIERS[^>]*-->/

const fail = msg => { console.error(`ERROR  ${msg}`); process.exit(1) }

const template = readFileSync(HOME, 'utf8')
if (!PLACEHOLDER.test(template)) fail('home/index.html has no <!-- ATELIERS --> placeholder')

const escape = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

const ateliers = readdirSync(ATELIERS, { withFileTypes: true })
  .filter(d => d.isDirectory() && existsSync(join(ROOT, d.name, 'index.html')))
  .map(d => {
    const file = join(ATELIERS, d.name, 'atelier.json')
    const meta = existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : {}
    return { slug: d.name, title: meta.title || d.name, client: meta.client || '', date: meta.date || '' }
  })
  .sort((a, b) => b.date.localeCompare(a.date) || a.slug.localeCompare(b.slug))

const indent = template.match(/\n([ \t]*)<!-- ATELIERS/)?.[1] ?? ''
const items = ateliers.length
  ? ateliers.map(a =>
      `<li><a href="./${a.slug}/"><span class="title">${escape(a.title)}</span>` +
      (a.client ? `<span class="client">${escape(a.client)}</span>` : '') +
      '</a></li>').join(`\n${indent}`)
  : '<li class="empty">Aucun atelier pour le moment</li>'

writeFileSync(join(ROOT, 'index.html'), template.replace(PLACEHOLDER, items))
console.log(`index.html: ${ateliers.length} atelier(s)`)
ateliers.forEach(a => console.log(`  /${a.slug}/  ${a.title}${a.client ? ` · ${a.client}` : ''}`))

// Deployed builds at the root that are no atelier (renamed or deleted atelier): left in place, but flagged
const known = new Set(readdirSync(ATELIERS))
for (const d of readdirSync(ROOT, { withFileTypes: true }))
  if (d.isDirectory() && !known.has(d.name) && existsSync(join(ROOT, d.name, 'bundle.js')))
    console.log(`WARN   ${d.name}/ is a deployed build that matches no folder in ateliers/: it stays online but is not listed`)
