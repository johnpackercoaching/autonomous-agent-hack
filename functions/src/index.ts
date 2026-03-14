import { onCall, HttpsError } from "firebase-functions/v2/https";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { initializeApp } from "firebase-admin/app";
import { getFirestore, FieldValue, Timestamp } from "firebase-admin/firestore";

initializeApp();
const db = getFirestore();

const GITHUB_OWNER = "jye-lol";
const GITHUB_REPO = "autonomous-agent-hack";
const GITHUB_WORKFLOW = "auto-fix.yml";
const RATE_LIMIT_MINUTES = 5;
const STALE_TIMEOUT_MINUTES = 50;

// ── triggerAutoFix ──────────────────────────────────────────────────────
// Callable function: creates a feedback doc and dispatches the GitHub Actions auto-fix workflow.
export const triggerAutoFix = onCall(
  { maxInstances: 5, timeoutSeconds: 30 },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "You must be signed in.");
    }

    const uid = request.auth.uid;
    const { feedbackId } = request.data as { feedbackId?: string };

    if (!feedbackId || typeof feedbackId !== "string") {
      throw new HttpsError("invalid-argument", "feedbackId is required.");
    }

    // Rate limiting: check last trigger time for this user
    const userRef = db.doc(`users/${uid}/rateLimit/autoFix`);
    const rateLimitSnap = await userRef.get();
    if (rateLimitSnap.exists) {
      const lastTrigger = rateLimitSnap.data()?.lastTrigger as Timestamp | undefined;
      if (lastTrigger) {
        const elapsed = (Date.now() - lastTrigger.toMillis()) / 1000 / 60;
        if (elapsed < RATE_LIMIT_MINUTES) {
          throw new HttpsError(
            "resource-exhausted",
            `Please wait ${Math.ceil(RATE_LIMIT_MINUTES - elapsed)} minutes before triggering another auto-fix.`
          );
        }
      }
    }

    // Verify feedback doc exists and belongs to this user
    const feedbackRef = db.doc(`feedback/${feedbackId}`);
    const feedbackSnap = await feedbackRef.get();
    if (!feedbackSnap.exists) {
      throw new HttpsError("not-found", "Feedback not found.");
    }
    const feedbackData = feedbackSnap.data();
    if (feedbackData?.user?.uid !== uid) {
      throw new HttpsError("permission-denied", "You can only auto-fix your own feedback.");
    }

    // Update feedback status
    await feedbackRef.update({
      status: "auto-fixing",
      lastUpdated: FieldValue.serverTimestamp(),
      progressNotes: FieldValue.arrayUnion({
        text: "Auto-fix triggered. Dispatching to CI pipeline...",
        timestamp: new Date().toISOString(),
        author: "system",
      }),
    });

    // Update rate limit
    await userRef.set({ lastTrigger: FieldValue.serverTimestamp() }, { merge: true });

    // Dispatch GitHub Actions workflow
    const githubToken = process.env.GITHUB_TOKEN;
    if (!githubToken) {
      await feedbackRef.update({
        status: "failed",
        progressNotes: FieldValue.arrayUnion({
          text: "Auto-fix failed: GitHub token not configured.",
          timestamp: new Date().toISOString(),
          author: "system",
        }),
      });
      throw new HttpsError("internal", "GitHub token not configured.");
    }

    const dispatchUrl = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/actions/workflows/${GITHUB_WORKFLOW}/dispatches`;
    const response = await fetch(dispatchUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${githubToken}`,
        Accept: "application/vnd.github.v3+json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        ref: "main",
        inputs: {
          feedback_id: feedbackId,
          feedback_text: feedbackData?.feedbackText || "",
          feedback_url: feedbackData?.currentUrl || "",
          mode: "user-feedback",
        },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      await feedbackRef.update({
        status: "failed",
        progressNotes: FieldValue.arrayUnion({
          text: `Auto-fix failed: GitHub dispatch error (${response.status}).`,
          timestamp: new Date().toISOString(),
          author: "system",
        }),
      });
      throw new HttpsError("internal", `GitHub dispatch failed: ${response.status} ${errorText}`);
    }

    await feedbackRef.update({
      progressNotes: FieldValue.arrayUnion({
        text: "CI pipeline dispatched successfully. Agent is starting...",
        timestamp: new Date().toISOString(),
        author: "system",
      }),
    });

    return { success: true, feedbackId };
  }
);

// ── recoverStaleAutoFix ─────────────────────────────────────────────────
// Scheduled every 15 minutes: resets stuck tickets that have been in "auto-fixing" for too long.
export const recoverStaleAutoFix = onSchedule(
  { schedule: "every 15 minutes", timeoutSeconds: 60 },
  async () => {
    const cutoff = new Date(Date.now() - STALE_TIMEOUT_MINUTES * 60 * 1000);

    const staleSnap = await db
      .collection("feedback")
      .where("status", "==", "auto-fixing")
      .where("lastUpdated", "<", Timestamp.fromDate(cutoff))
      .get();

    const batch = db.batch();
    for (const doc of staleSnap.docs) {
      batch.update(doc.ref, {
        status: "failed",
        lastUpdated: FieldValue.serverTimestamp(),
        progressNotes: FieldValue.arrayUnion({
          text: `Auto-fix timed out after ${STALE_TIMEOUT_MINUTES} minutes. Marked as failed.`,
          timestamp: new Date().toISOString(),
          author: "system",
        }),
      });
    }

    if (!staleSnap.empty) {
      await batch.commit();
      console.log(`Recovered ${staleSnap.size} stale auto-fix ticket(s).`);
    }
  }
);

// ── auditCompletedFixes ─────────────────────────────────────────────────
// Scheduled daily at 2 AM UTC: checks whether PRs from completed fixes have been merged.
export const auditCompletedFixes = onSchedule(
  { schedule: "0 2 * * *", timeoutSeconds: 120 },
  async () => {
    const githubToken = process.env.GITHUB_TOKEN;
    if (!githubToken) {
      console.error("auditCompletedFixes: GITHUB_TOKEN not set, skipping.");
      return;
    }

    const completedSnap = await db
      .collection("feedback")
      .where("status", "==", "completed")
      .where("autoFixResult.prUrl", "!=", null)
      .limit(50)
      .get();

    for (const doc of completedSnap.docs) {
      const data = doc.data();
      const prUrl = data.autoFixResult?.prUrl as string | undefined;
      if (!prUrl) continue;

      // Extract PR number from URL like https://github.com/owner/repo/pull/123
      const prMatch = prUrl.match(/\/pull\/(\d+)$/);
      if (!prMatch) continue;
      const prNumber = prMatch[1];

      const apiUrl = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/pulls/${prNumber}`;
      const response = await fetch(apiUrl, {
        headers: {
          Authorization: `Bearer ${githubToken}`,
          Accept: "application/vnd.github.v3+json",
        },
      });

      if (!response.ok) continue;

      const prData = (await response.json()) as { merged: boolean; state: string };

      if (prData.merged) {
        await doc.ref.update({
          "autoFixResult.status": "merged",
          lastUpdated: FieldValue.serverTimestamp(),
          progressNotes: FieldValue.arrayUnion({
            text: "PR has been merged. Fix is live in production.",
            timestamp: new Date().toISOString(),
            author: "system",
          }),
        });
      } else if (prData.state === "closed") {
        await doc.ref.update({
          "autoFixResult.status": "pr-closed",
          lastUpdated: FieldValue.serverTimestamp(),
          progressNotes: FieldValue.arrayUnion({
            text: "PR was closed without merging.",
            timestamp: new Date().toISOString(),
            author: "system",
          }),
        });
      }
    }

    console.log(`Audited ${completedSnap.size} completed fix(es).`);
  }
);
