
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { storage } from "./firebase";

/**
 * Compresse une image de manière agressive pour le web (Max 600px, Qualité 0.5).
 * Cela garantit que l'image fait moins de 100ko et se charge instantanément.
 */
const compressImage = (file: File): Promise<Blob> => {
    return new Promise((resolve, reject) => {
        // Timeout de sécurité : si la compression prend > 3s, on rejette
        const timeoutId = setTimeout(() => reject(new Error("Compression trop longue")), 3000);

        const img = new Image();
        const url = URL.createObjectURL(file);
        
        img.onload = () => {
            clearTimeout(timeoutId);
            URL.revokeObjectURL(url);
            
            try {
                const canvas = document.createElement('canvas');
                const MAX_WIDTH = 600; // Réduit à 600px pour performance maximale
                let width = img.width;
                let height = img.height;

                if (width > MAX_WIDTH) {
                    height *= MAX_WIDTH / width;
                    width = MAX_WIDTH;
                }

                canvas.width = width;
                canvas.height = height;
                
                const ctx = canvas.getContext('2d');
                if (!ctx) {
                    reject(new Error("Erreur contexte Canvas"));
                    return;
                }
                
                // Dessin simple
                ctx.drawImage(img, 0, 0, width, height);
                
                // Compression JPEG basse qualité (suffisant pour écran)
                canvas.toBlob((blob) => {
                    if (blob) resolve(blob);
                    else reject(new Error("Erreur Blob"));
                }, 'image/jpeg', 0.5);
            } catch (e) {
                reject(e);
            }
        };
        
        img.onerror = (err) => {
            clearTimeout(timeoutId);
            URL.revokeObjectURL(url);
            reject(err);
        };

        img.src = url;
    });
};

export const uploadImageToCloud = async (file: File, path: string): Promise<string> => {
    try {
        // 1. Compression
        let blobToUpload: Blob;
        try {
            blobToUpload = await compressImage(file);
        } catch (e) {
            console.warn("Échec compression, utilisation fichier original", e);
            blobToUpload = file;
        }
        
        // Helper Base64
        const blobToBase64 = (blob: Blob): Promise<string> => {
            return new Promise((resolve) => {
                const reader = new FileReader();
                reader.onloadend = () => resolve(reader.result as string);
                reader.readAsDataURL(blob);
            });
        };

        // 2. Mode Hors Ligne
        if (!storage) {
            return await blobToBase64(blobToUpload);
        }

        // 3. Upload avec Timeout strict (7 secondes)
        const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.jpg`;
        const storageRef = ref(storage, `${path}/${fileName}`);
        
        const uploadTask = uploadBytes(storageRef, blobToUpload);
        
        // Race condition
        const timeoutPromise = new Promise<string>((_, reject) => 
            setTimeout(() => reject(new Error("Timeout Upload")), 7000)
        );

        const urlPromise = uploadTask.then(snapshot => getDownloadURL(snapshot.ref));

        try {
            return await Promise.race([urlPromise, timeoutPromise]);
        } catch (e) {
            console.warn("Upload lent ou échoué, repli sur stockage local.", e);
            return await blobToBase64(blobToUpload);
        }

    } catch (error) {
        console.error("Erreur critique image:", error);
        return "";
    }
};
