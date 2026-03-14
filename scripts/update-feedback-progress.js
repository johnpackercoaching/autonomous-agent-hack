#!/usr/bin/env node
// Usage: node scripts/update-feedback-progress.js <feedbackId> <progressText> [author]
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

const [, , feedbackId, progressText, author] = process.argv;

if (!feedbackId || !progressText) {
  console.error("Usage: node update-feedback-progress.js <feedbackId> <progressText> [author]");
  process.exit(1);
}

const ref = db.doc(`feedback/${feedbackId}`);
const snap = await ref.get();

if (!snap.exists) {
  console.error(`Feedback ${feedbackId} not found.`);
  process.exit(1);
}

await ref.update({
  lastUpdated: FieldValue.serverTimestamp(),
  progressNotes: FieldValue.arrayUnion({
    text: progressText,
    timestamp: new Date().toISOString(),
    author: author || "claude-agent",
  }),
});

console.log(`Progress note added to feedback ${feedbackId}.`);
