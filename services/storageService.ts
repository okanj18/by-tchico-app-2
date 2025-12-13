
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { storage } from "./firebase";

/**
 * Compresse une image côté client via Canvas.
 * Utilise URL.createObjectURL pour une performance optimale (x10 plus rapide).
 * Réduit la taille (max 800px) et la qualité (60%) pour un chargement instantané.
 */
const compressImage = (file: File): Promise<Blob> => {
    return new Promise((resolve, reject) => {
        // Timeout de sécurité pour la compression (5s max)
        const timeoutId = setTimeout(() => reject(new Error("Délai de compression dépassé")), 5000);

        const img = new Image();
        // createObjectURL est beaucoup plus rapide que FileReader
        const url = URL.createObjectURL(file);
        
        img.onload = () => {
            clearTimeout(timeoutId);
            URL.revokeObjectURL(url); // Libérer la mémoire
            
            try {
                const canvas = document.createElement('canvas');
                // 800px est un bon compromis qualité/poids pour le web/mobile
                const MAX_WIDTH = 800; 
                let width = img.width;
                let height = img.height;

                // Calcul du ratio pour redimensionner
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
                
                // Dessiner l'image redimensionnée
                ctx.drawImage(img, 0, 0, width, height);
                
                // Convertir en JPEG qualité 60% (très léger)
                canvas.toBlob((blob) => {
                    if (blob) resolve(blob);
                    else reject(new Error("Erreur conversion Blob"));
                }, 'image/jpeg', 0.6);
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

/**
 * Télécharge une image vers Firebase Storage et renvoie l'URL.
 * Intègre un mécanisme de Fallback robuste : si l'upload échoue ou prend trop de temps (>10s),
 * l'image est convertie en Base64 pour permettre à l'utilisateur de continuer sans blocage.
 */
export const uploadImageToCloud = async (file: File, path: string): Promise<string> => {
    try {
        // 1. Compression
        const compressedBlob = await compressImage(file);
        
        // Fonction interne pour convertir Blob en Base64 (Fallback)
        const blobToBase64 = (blob: Blob): Promise<string> => {
            return new Promise((resolve) => {
                const reader = new FileReader();
                reader.onloadend = () => resolve(reader.result as string);
                reader.readAsDataURL(blob);
            });
        };

        // 2. Si Firebase n'est pas dispo -> Fallback immédiat
        if (!storage) {
            console.warn("Mode Hors Ligne : Stockage local Base64.");
            return await blobToBase64(compressedBlob);
        }

        // 3. Tentative d'Upload avec Timeout
        const uploadPromise = async () => {
             if (!storage) throw new Error("No storage");
             const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.jpg`;
             const storageRef = ref(storage, `${path}/${fileName}`);
             const snapshot = await uploadBytes(storageRef, compressedBlob);
             return await getDownloadURL(snapshot.ref);
        };

        // Timeout de 10 secondes pour l'upload
        const timeoutPromise = new Promise<string>((_, reject) => 
            setTimeout(() => reject(new Error("Upload timeout")), 10000)
        );

        try {
            // Course entre l'upload et le timeout
            return await Promise.race([uploadPromise(), timeoutPromise]);
        } catch (e) {
            console.warn("L'upload Cloud a échoué ou a pris trop de temps. Utilisation du stockage local (Base64).", e);
            // Si l'upload échoue (réseau lent, erreur config), on utilise le Base64
            return await blobToBase64(compressedBlob);
        }

    } catch (error) {
        console.error("Erreur critique traitement image:", error);
        return ""; // Retourne chaîne vide en cas d'échec total pour ne pas planter l'app
    }
};
