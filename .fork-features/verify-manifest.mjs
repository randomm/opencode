#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const manifestPath = path.resolve(__dirname, '../manifest.json');
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));

const taskctlFeature = manifest.features.taskctl;
const sourceFiles = [...(taskctlFeature.newFiles || []), ...(taskctlFeature.modifiedFiles || [])];

console.log('Checking taskctl criticalCode markers...\n');

let pass = 0
let fail = 0

// Check the 4 specifically fixed markers
const markersToCheck = [
  '"start-skip"',
  '"taskctl resume"', 
  '"commit-as-is"',
  '"Job status must be \\"stopped\\" to resume"'
];

for (const marker of markersToCheck) {
  let found = false
  for (const file of sourceFiles) {
    const abs = path.resolve(__dirname, '../../', file);
    if (!fs.existsSync(abs)) continue;
    try {
      const content = fs.readFileSync(abs, 'utf-8');
      if (content.includes(marker.replace(/\\"/g, '"'))) {
        found = true
        break
      }
    } catch {
      // Skip unreadable files
    }
  }

  if (found) {
    console.log(`✓ ${marker}`)
    pass++
  } else {
    console.log(`✗ ${marker}`)
    fail++
  }
}

console.log(`\nResults: ${pass} passed, ${fail} failed`)

// Now check ALL markers
console.log('\nChecking ALL taskctl criticalCode markers...\n')
pass = 0
fail = 0

for (const marker of taskctlFeature.criticalCode) {
  let found = false
  for (const file of sourceFiles) {
    const abs = path.resolve(__dirname, '../../', file);
    if (!fs.existsSync(abs)) continue;
    try {
      const content = fs.readFileSync(abs, 'utf-8');
      if (content.includes(marker)) {
        found = true
        break
      }
    } catch {
      // Skip unreadable files
    }
  }

  if (found) {
    pass++
  } else {
    console.log(`✗ "${marker}"`)
    fail++
  }
}

console.log(`\nTotal Results: ${pass} passed, ${fail} failed`)
process.exit(fail > 0 ? 1 : 0)