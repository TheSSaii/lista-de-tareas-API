import { cert, getApp, getApps, initializeApp, type App } from "firebase-admin/app";
import { getAuth, type Auth } from "firebase-admin/auth";
import { getFirestore, type Firestore } from "firebase-admin/firestore";

type Credenciales = {
  projectId: string;
  clientEmail: string;
  privateKey: string;
};

let app: App | null = null;
let db: Firestore | null = null;
let auth: Auth | null = null;

function leerCredenciales(): Credenciales {
  const projectId = process.env.FIREBASE_PROJECT_ID?.trim() ?? "";
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL?.trim() ?? "";
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.trim() ?? "";

  const variables = [
    ["FIREBASE_PROJECT_ID", projectId],
    ["FIREBASE_CLIENT_EMAIL", clientEmail],
    ["FIREBASE_PRIVATE_KEY", privateKey],
  ] as const;

  const faltantes = variables.filter(([, valor]) => valor === "").map(([nombre]) => nombre);

  if (faltantes.length > 0) {
    throw new Error(`Faltan variables de entorno de Firebase Admin: ${faltantes.join(", ")}`);
  }

  return {
    projectId,
    clientEmail,
    privateKey: privateKey.replace(/\\n/g, "\n"),
  };
}

function obtenerApp(): App {
  if (app) return app;

  const credenciales = leerCredenciales();
  app =
    getApps().length > 0
      ? getApp()
      : initializeApp({
          credential: cert(credenciales),
        });

  return app;
}

export function getDb(): Firestore {
  if (!db) db = getFirestore(obtenerApp());
  return db;
}

export function getAuthAdmin(): Auth {
  if (!auth) auth = getAuth(obtenerApp());
  return auth;
}
