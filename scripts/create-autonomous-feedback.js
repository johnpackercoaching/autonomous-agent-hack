#!/usr/bin/env node
// Usage: node scripts/create-autonomous-feedback.js <title> <description> [priority]
// Creates an autonomous quality check feedback doc (source: "autonomous")
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

const [, , title, description, priority] = process.argv;

if (!title || !description) {
  console.error("Usage: node create-autonomous-feedback.js <title> <description> [priority]");
  process.exit(1);
}

const validPriorities = ["high", "medium", "low"];
const feedbackPriority = validPriorities.includes(priority) ? priority : "medium";

const docRef = await db.collection("feedback").add({
  user: {
    uid: "system",
    email: "autonomous@system.internal",
    displayName: "Autonomous Quality Check",
  },
  feedbackText: `[${title}] ${description}`,
  currentUrl: "/",
  platform: "web",
  source: "autonomous",
  status: "new",
  priority: feedbackPriority,
  timestamp: FieldValue.serverTimestamp(),
  lastUpdated: FieldValue.serverTimestamp(),
  progressNotes: [
    {
      text: "Created by autonomous quality check.",
      timestamp: new Date().toISOString(),
      author: "system",
    },
  ],
});

console.log(`Autonomous feedback created: ${docRef.id}`);
