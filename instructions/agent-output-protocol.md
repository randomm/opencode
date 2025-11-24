# Agent Output Protocol - NO WASTE

**CRITICAL: Project Manager only sees your FINAL text output. Nothing else.**

## What PM Sees vs What PM NEVER Sees

**✅ PM SEES:**
- Your final text message after ALL work complete
- Files you created/modified (via file system)
- Remory memories you stored

**❌ PM NEVER SEES:**
- Intermediate bash command output
- `cat` or `echo` summaries you create
- ASCII art, tables, or formatted displays
- Multiple "final" documents
- "Comprehensive implementation summaries"
- "Key sections displays"
- "Validation outputs"
- Progress updates or status messages

## FORBIDDEN Output Patterns (Token Waste)

**❌ DO NOT CREATE THESE:**

```bash
# Creating intermediate summaries PM never sees
cat << 'EOF' > /tmp/summary.txt
Comprehensive Implementation Summary
=====================================
Phase 1: Infrastructure Setup
Phase 2: Configuration Applied
Phase 3: Validation Complete
...detailed status...
EOF
cat /tmp/summary.txt

# Multiple "final" outputs
echo "=== Final Summary ==="
echo "=== Comprehensive Review ==="
echo "=== Implementation Complete ==="
echo "=== Key Highlights ==="
echo "=== Validation Results ==="

# Displaying file contents for "verification"
echo "=== Displaying main configuration ==="
cat infrastructure/main.tf
echo "=== Displaying outputs ==="
cat infrastructure/outputs.tf
echo "=== Displaying state ==="
cat terraform.tfstate

# Progress updates
echo "Step 1 of 5: Initializing..."
echo "Step 2 of 5: Configuring..."
echo "Step 3 of 5: Validating..."
```

**Why this is WRONG:**
- Each bash command output costs tokens
- PM never sees any of this output (it disappears)
- You're wasting 100-500 tokens per summary
- User is waiting for output they'll never see

## CORRECT Output Pattern (Minimal)

**✅ DO THIS:**

1. **Work silently**: Execute commands, read/write files, validate
2. **ONE final message**: Return concise summary to PM in your final text output
3. **No intermediate displays**: Don't cat/echo/display anything PM won't see
4. **Results only**: State what was accomplished, not step-by-step narrative

**Example - WRONG (wastes ~800 tokens):**

```
Agent: [creates infrastructure files]
Agent: cat << 'EOF' > /tmp/impl_summary.md
# Comprehensive Implementation Summary

## Overview
Completed full infrastructure setup for production deployment.

## Files Modified
- infrastructure/main.tf: Added 15 resources
- infrastructure/outputs.tf: Added 8 outputs
- infrastructure/variables.tf: Added 12 variables

## Validation Results
✅ Terraform syntax valid
✅ Provider initialization successful
✅ Configuration meets requirements

## Key Highlights
- Multi-region setup configured
- Auto-scaling policies applied
- Monitoring dashboards created
- Security groups hardened

## Next Steps
Ready for terraform apply
EOF
Agent: cat /tmp/impl_summary.md
Agent: echo "=== Displaying Key Configuration ==="
Agent: cat infrastructure/main.tf
Agent: echo "=== Final Validation ==="
Agent: terraform validate
Agent: [Returns to PM]: "Infrastructure setup complete. Ready for deployment."
```

**Result**: PM only sees "Infrastructure setup complete. Ready for deployment."
**Token waste**: ~750 tokens on output PM never saw

**Example - CORRECT (uses ~50 tokens):**

```
Agent: [creates infrastructure files silently]
Agent: [Returns to PM]: "Completed infrastructure setup. Created main.tf (15 resources), outputs.tf (8 outputs), variables.tf (12 variables). Terraform validation passing. Ready for deployment."
```

**Result**: PM sees concise summary with all key info.
**Token savings**: 700 tokens saved (93% reduction)

## Token Economics

**Cost of verbose output per agent invocation:**
- 3-5 intermediate summaries × 150 tokens each = 450-750 tokens wasted
- Monetary cost: $0.003-$0.005 per invocation
- Time cost: 2-4 extra seconds per summary (user waiting)
- Cumulative: 100 invocations/month = 45,000-75,000 wasted tokens

**With minimal output:**
- 0 intermediate summaries
- Final message only: 50-100 tokens
- Monthly savings: 45,000-75,000 tokens = $0.30-$0.50/month
- Time savings: 3-7 minutes/month of user waiting

## Specific Prohibitions

**❌ NEVER use bash for display purposes:**
- `cat file.txt` - PM can't see this
- `echo "Summary: ..."` - PM can't see this
- `cat << 'EOF' ... EOF` - PM can't see this
- `head -n 20 file.txt` - PM can't see this
- `tail -n 10 logfile.log` - PM can't see this

**❌ NEVER create multiple "final" outputs:**
- "Final summary"
- "Comprehensive review"
- "Implementation complete"
- "Key highlights"
- "Validation results"

Each of these is redundant and wastes tokens.

**❌ NEVER create progress narratives:**
- "Step 1 of 5: Initializing..."
- "Processing phase 2..."
- "Almost done..."
- "Finalizing..."

PM doesn't see these updates. Work silently.

## When Bash Output IS Necessary

**✅ ONLY use bash output for:**
1. **Validation commands** where you need the actual output to verify success
   - `terraform validate` - check exit code and errors
   - `docker build` - check for errors
   - `npm test` - check for failures

2. **Tool execution** where output informs your next action
   - `git status` - read state to decide next command
   - `kubectl get pods` - check pod status before scaling

**Even then**: Don't echo/cat the results for "display". Use the output internally.

## Rules Summary

1. **NEVER use bash to create summaries** - PM can't see them
2. **NEVER cat/echo for display purposes** - PM can't see them
3. **NEVER create multiple "final" outputs** - Wastes tokens
4. **ONE concise return message** - This is what PM actually sees
5. **If PM needs file contents** - They'll read files themselves with Read tool
6. **Work silently** - No progress updates, no step-by-step narratives
7. **Results only** - State what was accomplished in final message

## Catch Yourself

**Before running any bash command, ask:**
- "Will PM see this output?"
- "Am I creating this for display or for actual processing?"
- "Could I just include this info in my final return message?"

**If the answer is "for display" or "PM won't see it" → DON'T RUN IT**

## Remember

Every bash command you run costs tokens. If the output doesn't inform YOUR next action and PM can't see it, you're wasting resources.

**Your job**: Complete the work and return ONE concise message.
**Not your job**: Create documentation, summaries, or displays that PM never sees.
