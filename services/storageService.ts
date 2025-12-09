
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { storage } from "./firebase";

/**
 * Télécharge une image vers Firebase Storage et renvoie l'URL optimisée.
 * Si Firebase n'est pas configuré, renvoie une erreur ou une simulation.
 */
export const uploadImageToCloud = async (file: File, path: string): Promise<string> => {
    try {
        if (!storage) throw new Error("Firebase Storage non initialisé");

        // Création d'une référence unique : articles/ID_UNIQUE.jpg
        const storageRef = ref(storage, `${path}/${Date.now()}_${file.name}`);
        
        // Upload
        const snapshot = await uploadBytes(storageRef, file);
        
        // Récupération de l'URL publique
        const downloadURL = await getDownloadURL(snapshot.ref);
        
        return downloadURL;
    } catch (error) {
        console.error("Erreur upload image:", error);
        // Fallback: Si pas de Firebase (mode dev local sans internet), on retourne du base64 temporairement
        return new Promise((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result as string);
            reader.readAsDataURL(file);
        });
    }
};
