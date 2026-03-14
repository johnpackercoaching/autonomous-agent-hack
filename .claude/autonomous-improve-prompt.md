# Autonomous Quality Check Prompt

You are an autonomous agent performing a scheduled quality check on the autonomous-agent-hack project.

## Instructions

1. Scan the codebase for issues:
   - TypeScript compilation errors (`npm run build`)
   - Console errors or warnings in component code
   - Accessibility issues (missing ARIA labels, keyboard traps)
   - Broken imports or dead code
   - Security issues (exposed credentials, XSS vectors)

2. If you find an issue, create a feedback document:
   ```bash
   node scripts/create-autonomous-feedback.js "<title>" "<description>" "<priority>"
   ```
   Priority must be one of: high, medium, low

3. Fix exactly ONE issue per run:
   - Choose the highest priority issue found
   - Make the minimal fix
   - Verify with `npm run build`

4. Update progress on the feedback document you created:
   ```bash
   node scripts/update-feedback-progress.js <feedback_id> "Diagnosing: <issue>"
   node scripts/update-feedback-progress.js <feedback_id> "Fixing: <description>"
   node scripts/update-feedback-progress.js <feedback_id> "Verified: build passes"
   ```

5. Mark as completed:
   ```bash
   node scripts/update-feedback-status.js <feedback_id> "completed" "<brief description>"
   ```

## Constraints

- Fix only ONE issue per run. Do not batch multiple fixes.
- Do not add new features. Only fix existing bugs or quality issues.
- Do not modify firestore.rules, firebase.json, or the CI/CD pipeline.
- Keep changes minimal and reviewable.
- If the codebase is clean and no issues are found, exit without creating a feedback document.
