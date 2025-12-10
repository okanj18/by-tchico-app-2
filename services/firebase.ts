
import { initializeApp, getApps, getApp, deleteApp, FirebaseApp } from "firebase/app";
import { getFirestore, Firestore, enableIndexedDbPersistence } from "firebase/firestore";
import { getStorage, FirebaseStorage } from "firebase/storage";
import { getAuth, Auth, createUserWithEmailAndPassword, signOut } from "firebase/auth";

// --- CONFIGURATION FIREBASE ---
// 1. Essai de lecture depuis les variables d'environnement (Vercel)
const env = (import.meta as any).env || {};

// Fonction utilitaire pour lire les variables avec ou sans "FIREBASE_"
const getEnv = (key: string) => {
    if (env[key]) return env[key];
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
}

/**
 * Crée un utilisateur Firebase Auth sans déconnecter l'utilisateur courant.
 * Utilise une instance d'application secondaire temporaire.
 */
export const createAuthUser = async (email: string, password: string) => {
    if (!firebaseConfig.apiKey) throw new Error("Firebase non configuré.");

    // Créer une app secondaire pour ne pas écraser l'auth de l'app principale
    const secondaryAppName = "SecondaryAppForUserCreation";
    let secondaryApp: FirebaseApp;
    
    // Vérifier si l'app existe déjà (nettoyage précédent échoué)
    const existingApps = getApps();
    const existingSecondary = existingApps.find(a => a.name === secondaryAppName);
    if (existingSecondary) {
        secondaryApp = existingSecondary;
    } else {
        secondaryApp = initializeApp(firebaseConfig, secondaryAppName);
    }

    const secondaryAuth = getAuth(secondaryApp);

    try {
        const userCredential = await createUserWithEmailAndPassword(secondaryAuth, email, password);
        // On déconnecte immédiatement l'instance secondaire pour éviter tout conflit
        await signOut(secondaryAuth);
        return userCredential.user;
    } catch (error: any) {
        console.error("Erreur création utilisateur:", error);
        throw error;
    } finally {
        // Nettoyage de l'app secondaire
        await deleteApp(secondaryApp);
    }
};

export { db, storage, auth };
export default app;
