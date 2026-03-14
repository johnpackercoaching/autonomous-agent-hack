#!/usr/bin/env node
// Usage: node scripts/update-feedback-status.js <feedbackId> <status> [fixDescription] [prUrl]
// Env: GOOGLE_APPLICATION_CREDENTIALS or /tmp/firebase-service-account.json

import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { readFileSync, existsSync } from "fs";

const credPath = process.env.GOOGLE_APPLICATION_CREDENTIALS || "/tmp/firebase-service-account.json";
if (!existsSync(credPath)) {
  console.error(`Service account not found at ${credPath}`);
  process.exit(1);
}

const serviceAccount = JSON.parse(readFileSync(credPath, "utf8"));
initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

const [, , feedbackId, status, fixDescription, prUrl] = process.argv;

if (!feedbackId || !status) {
  console.error("Usage: node update-feedback-status.js <feedbackId> <status> [fixDescription] [prUrl]");
  process.exit(1);
}

const validStatuses = ["new", "auto-fixing", "in-progress", "completed", "failed"];
if (!validStatuses.includes(status)) {
  console.error(`Invalid status: ${status}. Must be one of: ${validStatuses.join(", ")}`);
  process.exit(1);
}

const ref = db.doc(`feedback/${feedbackId}`);
const snap = await ref.get();

if (!snap.exists) {
  console.error(`Feedback ${feedbackId} not found.`);
  process.exit(1);
}

const updateData = {
  status,
  lastUpdated: FieldValue.serverTimestamp(),
  progressNotes: FieldValue.arrayUnion({
    text: `Status changed to "${status}".`,
    timestamp: new Date().toISOString(),
    author: "script",
  }),
};

if (status === "completed") {
  updateData.autoFixResult = {
    status: "completed",
    completedAt: new Date().toISOString(),
  };
  if (fixDescription) updateData.autoFixResult.fixDescription = fixDescription;
  if (prUrl) updateData.autoFixResult.prUrl = prUrl;
}

await ref.update(updateData);
console.log(`Feedback ${feedbackId} updated to status: ${status}`);

// Send notification email if completed
if (status === "completed") {
  const feedbackData = snap.data();
  const userEmail = feedbackData?.user?.email;
  if (userEmail) {
    await db.collection("mail").add({
      to: userEmail,
      message: {
        subject: "Your feedback fix is ready!",
        text: `Hi ${feedbackData.user.displayName || "there"},\n\nYour feedback has been auto-fixed and deployed.\n\n${fixDescription ? `Fix: ${fixDescription}\n` : ""}${prUrl ? `PR: ${prUrl}\n` : ""}\nThank you for helping improve the app!`,
      },
    });
    console.log(`Notification email queued for ${userEmail}.`);
  }
}
