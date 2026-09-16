import fs from "node:fs";
import { cert, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";

const serviceAccount = JSON.parse(
  fs.readFileSync("./firebase-service-account.json", "utf8"),
);

const app = initializeApp({
  credential: cert(serviceAccount),
});

export const firebaseAuth = getAuth(app);