import { initializeApp, getApps, getApp, FirebaseApp } from "firebase/app";
import { getFirestore, Firestore, enableIndexedDbPersistence } from "firebase/firestore";
import { getStorage, FirebaseStorage } from "firebase/storage";
import { getAuth, Auth } from "firebase/auth";

// Configuration pour Vite (Les variables doivent commencer par VITE_)
// Utilisation de l'opérateur optionnel ?. pour éviter le crash si env est indéfini
const firebaseConfig = {
  apiKey: (import.meta as any).env?.VITE_FIREBASE_API_KEY,
  authDomain: (import.meta as any).env?.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: (import.meta as any).env?.VITE_FIREBASE_PROJECT_ID,
  storageBucket: (import.meta as any).env?.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: (import.meta as any).env?.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: (import.meta as any).env?.VITE_FIREBASE_APP_ID
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

  } catch (error) {
    console.error("Erreur d'initialisation Firebase:", error);
  }
} else {
  console.warn("Configuration Firebase manquante ou incomplète. L'application fonctionne en mode HORS LIGNE (Démo).");
}

export { db, storage, auth };
export default app;