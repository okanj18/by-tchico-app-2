
import { initializeApp, getApps, getApp, FirebaseApp } from "firebase/app";
import { getFirestore, Firestore, enableIndexedDbPersistence } from "firebase/firestore";
import { getStorage, FirebaseStorage } from "firebase/storage";
import { getAuth, Auth } from "firebase/auth";

// --- CONFIGURATION FIREBASE ---
// 1. Essai de lecture depuis les variables d'environnement (Vercel)
const env = (import.meta as any).env || {};

// Fonction utilitaire pour lire les variables avec ou sans "FIREBASE_"
// Exemple : cherche VITE_FIREBASE_PROJECT_ID, sinon essaie VITE_PROJECT_ID
const getEnv = (key: string) => {
    if (env[key]) return env[key];
    // Tentative de fallback sur le nom court (ex: VITE_PROJECT_ID au lieu de VITE_FIREBASE_PROJECT_ID)
    const shortKey = key.replace('_FIREBASE_', '_');
    if (env[shortKey]) return env[shortKey];
    return undefined;
};

const firebaseConfig = {
  apiKey: getEnv('VITE_FIREBASE_API_KEY'),
  authDomain: getEnv('VITE_FIREBASE_AUTH_DOMAIN'),
  projectId: getEnv('VITE_FIREBASE_PROJECT_ID'),
  storageBucket: getEnv('VITE_FIREBASE_STORAGE_BUCKET'),
  messagingSenderId: getEnv('VITE_FIREBASE_MESSAGING_SENDER_ID'),
  appId: getEnv('VITE_FIREBASE_APP_ID')
};

// 2. SOLUTION DE SECOURS (Si Vercel échoue, décommentez et remplissez ceci)
// Si vous décommentez ceci, remplacez les valeurs par celles de votre console Firebase
/*
const hardcodedConfig = {
  apiKey: "AIzaSy...", 
  authDomain: "votre-projet.firebaseapp.com",
  projectId: "votre-projet",
  storageBucket: "votre-projet.appspot.com",
  messagingSenderId: "...",
  appId: "..."
};
// Si la clé API est manquante via env, on utilise la version hardcodée
if (!firebaseConfig.apiKey && hardcodedConfig.apiKey && hardcodedConfig.apiKey !== "AIzaSy...") {
    console.log("Using hardcoded Firebase config");
    Object.assign(firebaseConfig, hardcodedConfig);
}
*/

let app: FirebaseApp | undefined;
let db: Firestore | undefined;
let storage: FirebaseStorage | undefined;
let auth: Auth | undefined;

// Initialisation conditionnelle
if (firebaseConfig.apiKey && firebaseConfig.apiKey !== "undefined") {
  try {
    app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
    db = getFirestore(app);
    storage = getStorage(app);
    auth = getAuth(app);

    // ACTIVATION DU MODE HORS LIGNE (Persistance)
    if (typeof window !== 'undefined' && db) {
        enableIndexedDbPersistence(db).catch((err) => {
            if (err.code == 'failed-precondition') {
                console.warn("Persistance échouée : Plusieurs onglets ouverts.");
            } else if (err.code == 'unimplemented') {
                console.warn("Le navigateur ne supporte pas la persistance hors ligne.");
            }
        });
    }
    console.log("Firebase initialized successfully");

  } catch (error) {
    console.error("Erreur d'initialisation Firebase:", error);
  }
} else {
  console.warn("Configuration Firebase manquante ou incomplète. L'application fonctionne en mode HORS LIGNE (Démo).");
  console.warn("Check your environment variables in Vercel: VITE_FIREBASE_API_KEY, etc.");
}

export { db, storage, auth };
export default app;
