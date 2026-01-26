import { test, expect } from "bun:test"
import { Skill } from "../../src/skill"
import { Instance } from "../../src/project/instance"
import { tmpdir } from "../fixture/fixture"
import path from "path"
import fs from "fs/promises"

async function createGlobalSkill(homeDir: string) {
  const skillDir = path.join(homeDir, ".claude", "skills", "global-test-skill")
  await fs.mkdir(skillDir, { recursive: true })
  await Bun.write(
    path.join(skillDir, "SKILL.md"),
    `---
name: global-test-skill
description: A global skill from ~/.claude/skills for testing.
---

# Global Test Skill

This skill is loaded from the global home directory.
`,
  )
}

test("discovers skills from .opencode/skill/ directory", async () => {
  await using tmp = await tmpdir({
    git: true,
    init: async (dir) => {
      const skillDir = path.join(dir, ".opencode", "skill", "test-skill")
      await Bun.write(
        path.join(skillDir, "SKILL.md"),
        `---
name: test-skill
description: A test skill for verification.
---

# Test Skill

Instructions here.
`,
      )
    },
  })

  const originalDisableGlobal = process.env.OPENCODE_DISABLE_GLOBAL_SKILLS
  process.env.OPENCODE_DISABLE_GLOBAL_SKILLS = "1"

  try {
    await Instance.provide({
      directory: tmp.path,
      fn: async () => {
        const skills = await Skill.all()
        expect(skills.length).toBe(1)
        const testSkill = skills.find((s) => s.name === "test-skill")
        expect(testSkill).toBeDefined()
        expect(testSkill!.description).toBe("A test skill for verification.")
        expect(testSkill!.location).toContain("skill/test-skill/SKILL.md")
      },
    })
  } finally {
    process.env.OPENCODE_DISABLE_GLOBAL_SKILLS = originalDisableGlobal
  }
})

test("discovers multiple skills from .opencode/skill/ directory", async () => {
  await using tmp = await tmpdir({
    git: true,
    init: async (dir) => {
      const skillDir1 = path.join(dir, ".opencode", "skill", "skill-one")
      const skillDir2 = path.join(dir, ".opencode", "skill", "skill-two")
      await Bun.write(
        path.join(skillDir1, "SKILL.md"),
        `---
name: skill-one
description: First test skill.
---

# Skill One
`,
      )
      await Bun.write(
        path.join(skillDir2, "SKILL.md"),
        `---
name: skill-two
description: Second test skill.
---

# Skill Two
`,
      )
    },
  })

  const originalDisableGlobal = process.env.OPENCODE_DISABLE_GLOBAL_SKILLS
  process.env.OPENCODE_DISABLE_GLOBAL_SKILLS = "1"

  try {
    await Instance.provide({
      directory: tmp.path,
      fn: async () => {
        const skills = await Skill.all()
        expect(skills.length).toBe(2)
        expect(skills.find((s) => s.name === "skill-one")).toBeDefined()
        expect(skills.find((s) => s.name === "skill-two")).toBeDefined()
      },
    })
  } finally {
    process.env.OPENCODE_DISABLE_GLOBAL_SKILLS = originalDisableGlobal
  }
})

test("skips skills with missing frontmatter", async () => {
  await using tmp = await tmpdir({
    git: true,
    init: async (dir) => {
      const skillDir = path.join(dir, ".opencode", "skill", "no-frontmatter")
      await Bun.write(
        path.join(skillDir, "SKILL.md"),
        `# No Frontmatter

Just some content without YAML frontmatter.
`,
      )
    },
  })

  const originalDisableGlobal = process.env.OPENCODE_DISABLE_GLOBAL_SKILLS
  process.env.OPENCODE_DISABLE_GLOBAL_SKILLS = "1"

  try {
    await Instance.provide({
      directory: tmp.path,
      fn: async () => {
        const skills = await Skill.all()
        expect(skills).toEqual([])
      },
    })
  } finally {
    process.env.OPENCODE_DISABLE_GLOBAL_SKILLS = originalDisableGlobal
  }
})

test("discovers skills from .claude/skills/ directory", async () => {
  await using tmp = await tmpdir({
    git: true,
    init: async (dir) => {
      const skillDir = path.join(dir, ".claude", "skills", "claude-skill")
      await Bun.write(
        path.join(skillDir, "SKILL.md"),
        `---
name: claude-skill
description: A skill in the .claude/skills directory.
---

# Claude Skill
`,
      )
    },
  })

  const originalDisableGlobal = process.env.OPENCODE_DISABLE_GLOBAL_SKILLS
  const originalDisableClaudeCode = process.env.OPENCODE_DISABLE_CLAUDE_CODE
  const originalDisableClaudeSkills = process.env.OPENCODE_DISABLE_CLAUDE_CODE_SKILLS
  process.env.OPENCODE_DISABLE_GLOBAL_SKILLS = "1"
  process.env.OPENCODE_DISABLE_CLAUDE_CODE = "0"
  process.env.OPENCODE_DISABLE_CLAUDE_CODE_SKILLS = "0"

  try {
    await Instance.provide({
      directory: tmp.path,
      fn: async () => {
        const skills = await Skill.all()
        expect(skills.length).toBe(1)
        const claudeSkill = skills.find((s) => s.name === "claude-skill")
        expect(claudeSkill).toBeDefined()
        expect(claudeSkill!.location).toContain(".claude/skills/claude-skill/SKILL.md")
      },
    })
  } finally {
    process.env.OPENCODE_DISABLE_GLOBAL_SKILLS = originalDisableGlobal
    process.env.OPENCODE_DISABLE_CLAUDE_CODE = originalDisableClaudeCode
    process.env.OPENCODE_DISABLE_CLAUDE_CODE_SKILLS = originalDisableClaudeSkills
  }
})

test("discovers global skills from ~/.claude/skills/ directory", async () => {
  await using tmp = await tmpdir({ git: true })

  const originalHome = process.env.OPENCODE_TEST_HOME
  const originalDisableGlobal = process.env.OPENCODE_DISABLE_GLOBAL_SKILLS
  const originalDisableClaudeCode = process.env.OPENCODE_DISABLE_CLAUDE_CODE
  const originalDisableClaudeSkills = process.env.OPENCODE_DISABLE_CLAUDE_CODE_SKILLS
  process.env.OPENCODE_TEST_HOME = tmp.path
  process.env.OPENCODE_DISABLE_GLOBAL_SKILLS = "0"
  process.env.OPENCODE_DISABLE_CLAUDE_CODE = "0"
  process.env.OPENCODE_DISABLE_CLAUDE_CODE_SKILLS = "0"

  try {
    await createGlobalSkill(tmp.path)
    await Instance.provide({
      directory: tmp.path,
      fn: async () => {
        const skills = await Skill.all()
        expect(skills.length).toBe(1)
        expect(skills[0].name).toBe("global-test-skill")
        expect(skills[0].description).toBe("A global skill from ~/.claude/skills for testing.")
        expect(skills[0].location).toContain(".claude/skills/global-test-skill/SKILL.md")
      },
    })
  } finally {
    process.env.OPENCODE_TEST_HOME = originalHome
    process.env.OPENCODE_DISABLE_GLOBAL_SKILLS = originalDisableGlobal
    process.env.OPENCODE_DISABLE_CLAUDE_CODE = originalDisableClaudeCode
    process.env.OPENCODE_DISABLE_CLAUDE_CODE_SKILLS = originalDisableClaudeSkills
  }
})

test("returns empty array when no skills exist", async () => {
  await using tmp = await tmpdir({ git: true })

  const originalDisableGlobal = process.env.OPENCODE_DISABLE_GLOBAL_SKILLS
  process.env.OPENCODE_DISABLE_GLOBAL_SKILLS = "1"

  try {
    await Instance.provide({
      directory: tmp.path,
      fn: async () => {
        const skills = await Skill.all()
        expect(skills).toEqual([])
      },
    })
  } finally {
    process.env.OPENCODE_DISABLE_GLOBAL_SKILLS = originalDisableGlobal
  }
})
