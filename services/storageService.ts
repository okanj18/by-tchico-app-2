
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { storage } from "./firebase";

/**
 * Compresse une image côté client via Canvas.
 * Réduit la taille (max 600px) et la qualité (50%) pour un chargement instantané.
 */
const compressImage = (file: File): Promise<Blob> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (event) => {
            const img = new Image();
            img.src = event.target?.result as string;
            
            img.onload = () => {
                const canvas = document.createElement('canvas');
                // Optimisation: 600px est suffisant pour l'affichage web/mobile
                const MAX_WIDTH = 600; 
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
                    reject(new Error("Impossible de traiter l'image (Canvas context error)"));
                    return;
                }
                
                // Dessiner l'image redimensionnée
                ctx.drawImage(img, 0, 0, width, height);
                
                // Convertir en JPEG qualité 50% (très léger)
                canvas.toBlob((blob) => {
                    if (blob) resolve(blob);
                    else reject(new Error("Erreur de compression"));
                }, 'image/jpeg', 0.5);
            };
            
            img.onerror = (err) => reject(err);
        };
        reader.onerror = (err) => reject(err);
    });
};

/**
 * Télécharge une image vers Firebase Storage et renvoie l'URL optimisée.
 * Si Firebase n'est pas configuré, renvoie une version Base64 compressée (Mode Hors Ligne).
 */
export const uploadImageToCloud = async (file: File, path: string): Promise<string> => {
    try {
        // 1. Compression systématique (Crucial pour la performance)
        const compressedBlob = await compressImage(file);
        
        // 2. Vérification Firebase
        if (!storage) {
            console.warn("Mode Hors Ligne : Stockage de l'image en Base64 compressé localement.");
            // Fallback: Retourne le Base64 de l'image COMPRESSÉE (beaucoup plus léger)
            return new Promise((resolve) => {
                const reader = new FileReader();
                reader.onloadend = () => resolve(reader.result as string);
                reader.readAsDataURL(compressedBlob);
            });
        }

        // 3. Upload Cloud (si connecté)
        // Nom de fichier sécurisé
        const fileName = `${Date.now()}_${file.name.replace(/[^a-zA-Z0-9.]/g, '')}`;
        const storageRef = ref(storage, `${path}/${fileName}`);
        
        // Upload du blob compressé
        const snapshot = await uploadBytes(storageRef, compressedBlob);
        
        // Récupération de l'URL publique
        const downloadURL = await getDownloadURL(snapshot.ref);
        
        return downloadURL;
    } catch (error) {
        console.error("Erreur upload image:", error);
        // Fallback ultime : Base64 de l'original (si compression échoue)
        return new Promise((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result as string);
            reader.readAsDataURL(file);
        });
    }
};
