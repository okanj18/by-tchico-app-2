
import React, { useState, useEffect, useRef } from 'react';
import { doc, onSnapshot, setDoc } from "firebase/firestore";
import { db } from "../services/firebase";

/**
 * Hook de synchronisation robuste.
 * Gère la priorité locale pour l'interface utilisateur tout en garantissant l'écriture Cloud.
 */
export function useSyncState<T>(defaultValue: T, key: string): [T, React.Dispatch<React.SetStateAction<T>>] {
    const [value, setValue] = useState<T>(defaultValue);
    
    // On utilise une ref pour stocker la valeur "la plus récente" connue localement
    // Cela permet de ne pas écraser une saisie en cours avec une vieille valeur du serveur
    const localValueRef = useRef<T>(defaultValue);
    const isWritingRef = useRef(false);
    const timeoutRef = useRef<any>(null);

    // 1. ÉCOUTE (READ): S'abonner aux changements dans Firestore
    useEffect(() => {
        // Si pas de DB (mode démo), on ne fait rien
        if (!db) return;

        const docRef = doc(db, "app_data", key);
        
        const unsubscribe = onSnapshot(docRef, (docSnap) => {
            // Si on est en train d'écrire (debounce), on ignore temporairement l'update serveur
            // pour éviter que le curseur ne saute ou que l'interface ne clignote.
            if (isWritingRef.current) {
                return;
            }

            if (docSnap.exists()) {
                const data = docSnap.data().content as T;
                // On met à jour seulement si les données sont différentes (évite re-render inutile)
                if (JSON.stringify(data) !== JSON.stringify(localValueRef.current)) {
                    setValue(data);
                    localValueRef.current = data;
                }
            }
        }, (error) => {
            console.error(`🔥 Erreur Sync [${key}]:`, error);
        });

        return () => unsubscribe();
    }, [key]);

    // 2. ÉCRITURE (WRITE): Sauvegarder dans Firestore
    const setSyncedValue: React.Dispatch<React.SetStateAction<T>> = (newValueOrFn) => {
        // Mise à jour immédiate de l'UI locale
        setValue((prev) => {
            const newValue = newValueOrFn instanceof Function ? (newValueOrFn as Function)(prev) : newValueOrFn;
            localValueRef.current = newValue;
            
            // Indiquer qu'une écriture est en attente/cours
            isWritingRef.current = true;

            // Debounce : On attend un peu que l'utilisateur finisse de taper/cliquer avant d'envoyer
            if (timeoutRef.current) clearTimeout(timeoutRef.current);
            
            timeoutRef.current = setTimeout(async () => {
                if (!db) {
                    isWritingRef.current = false;
                    return;
                }
                
                try {
                    // Nettoyage des undefined qui font planter Firebase
                    const cleanContent = JSON.parse(JSON.stringify(newValue));

                    await setDoc(doc(db, "app_data", key), { 
                        content: cleanContent, 
                        lastUpdated: new Date().toISOString(),
                        deviceInfo: navigator.userAgent // Utile pour debug
                    }, { merge: true }); // Merge true pour ne pas écraser d'autres champs métadonnées
                    
                } catch (e) {
                    console.error(`❌ Échec écriture [${key}]:`, e);
                } finally {
                    // On relâche le verrou immédiatement après la tentative
                    isWritingRef.current = false;
                }
            }, 1000); // 1 seconde de délai pour grouper les mises à jour rapides

            return newValue;
        });
    };

    return [value, setSyncedValue];
}
