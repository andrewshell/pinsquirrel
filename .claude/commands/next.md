# Continue Migration

Read the migration plan and determine the best next step to work on.

## Instructions

1. **Read the plan file**: `PLAN.md` in the project root

2. **Scan for incomplete tasks**: Look for `- [ ]` checkboxes that haven't been completed

3. **Identify the current phase**: Find the first phase with incomplete tasks

4. **Determine dependencies**: Check if earlier phases have blockers that need resolving first

5. **Recommend the next action**: Based on what's incomplete, suggest ONE specific task to work on

## Output Format

Respond with:

### Current Status

- Which phases are complete
- Which phase we're currently in
- Any blockers or dependencies

### Recommended Next Step

- The specific task to work on (with task number from plan)
- Brief explanation of what needs to be done
- Any files that will need to be created/modified

### Ready to Start?

Ask if I should proceed with implementing the recommended task.

## Notes

- Prefer tasks that can be completed in one session
- If a phase requires scaffolding (like Phase 1 setup), that should be done first
- Reference CLAUDE.md for project conventions and quality requirements
- Remember: we're building `apps/hono` alongside the existing `apps/web`
