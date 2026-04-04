#!/usr/bin/env node

import fs from 'fs'
import path from 'path'

const manifestPath = path.resolve(new URL('../manifest.json', import.meta.url))
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'))

const taskctlFeature = manifest.features.taskctl
const sourceFiles = [...(taskctlFeature.newFiles || []), ...(taskctlFeature.modifiedFiles || [])]

console.log('Checking taskctl criticalCode markers...\n')

let pass = 0
let fail = 0

for (const marker of taskctlFeature.criticalCode) {
  let found = false
  for (const file of sourceFiles) {
    const abs = path.resolve(new URL('../../', import.meta.url), file)
    if (!fs.existsSync(abs)) continue
    try {
      const content = fs.readFileSync(abs, 'utf-8')
      if (content.includes(marker)) {
        found = true
        break
      }
    } catch {
      // Skip unreadable files
    }
  }

  if (found) {
    console.log(`✓ "${marker}"`)
    pass++
  } else {
    console.log(`✗ "${marker}"`)
    fail++
  }
}

console.log(`\nResults: ${pass} passed, ${fail} failed`)
process.exit(fail > 0 ? 1 : 0)