
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { storage } from "./firebase";

/**
 * Compresse une image de manière très agressive pour le web (Max 500px, Qualité 0.35).
 * Cela garantit que chaque image est extrêmement légère pour ne pas saturer le document Firestore.
 */
const compressImage = (file: File): Promise<Blob> => {
    return new Promise((resolve, reject) => {
        const timeoutId = setTimeout(() => reject(new Error("Compression trop longue")), 3000);

        const img = new Image();
        const url = URL.createObjectURL(file);
        
        img.onload = () => {
            clearTimeout(timeoutId);
            URL.revokeObjectURL(url);
            
            try {
                const canvas = document.createElement('canvas');
                const MAX_WIDTH = 500; // Réduit pour gagner en espace document
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
                
                ctx.drawImage(img, 0, 0, width, height);
                
                // Compression JPEG agressive (0.35)
                canvas.toBlob((blob) => {
                    if (blob) resolve(blob);
                    else reject(new Error("Erreur Blob"));
                }, 'image/jpeg', 0.35);
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
        let blobToUpload: Blob;
        try {
            blobToUpload = await compressImage(file);
        } catch (e) {
            console.warn("Échec compression, utilisation fichier original", e);
            blobToUpload = file;
        }
        
        const blobToBase64 = (blob: Blob): Promise<string> => {
            return new Promise((resolve) => {
                const reader = new FileReader();
                reader.onloadend = () => resolve(reader.result as string);
                reader.readAsDataURL(blob);
            });
        };

        if (!storage) {
            return await blobToBase64(blobToUpload);
        }

        const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.jpg`;
        const storageRef = ref(storage, `${path}/${fileName}`);
        
        const uploadTask = uploadBytes(storageRef, blobToUpload);
        
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
