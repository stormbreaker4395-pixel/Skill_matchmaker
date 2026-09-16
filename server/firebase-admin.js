import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { cert, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function loadServiceAccount() {
  if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
    return JSON.parse(
      process.env.FIREBASE_SERVICE_ACCOUNT_JSON,
    );
  }

  if (
    process.env.FIREBASE_PROJECT_ID &&
    process.env.FIREBASE_CLIENT_EMAIL &&
    process.env.FIREBASE_PRIVATE_KEY
  ) {
    return {
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n"),
    };
  }

  const localPath = path.join(
    __dirname,
    "..",
    "firebase-service-account.json",
  );

  if (fs.existsSync(localPath)) {
    return JSON.parse(
      fs.readFileSync(localPath, "utf8"),
    );
  }

  throw new Error(
    "Firebase Admin credentials are missing. Set FIREBASE_SERVICE_ACCOUNT_JSON, or FIREBASE_PROJECT_ID/FIREBASE_CLIENT_EMAIL/FIREBASE_PRIVATE_KEY, or provide firebase-service-account.json locally.",
  );
}

const app = initializeApp({
  credential: cert(loadServiceAccount()),
});

export const firebaseAuth = getAuth(app);
