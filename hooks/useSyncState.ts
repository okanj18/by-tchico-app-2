
import React, { useState, useEffect, useRef } from 'react';
import { doc, onSnapshot, setDoc } from "firebase/firestore";
import { db } from "../services/firebase";

/**
 * Hook de synchronisation temps réel optimisé.
 * Garantit que les données circulent entre les appareils sans blocage.
 */
export function useSyncState<T>(defaultValue: T, key: string): [T, React.Dispatch<React.SetStateAction<T>>] {
    const [value, setValue] = useState<T>(defaultValue);
    const localValueRef = useRef<T>(defaultValue);
    const timeoutRef = useRef<any>(null);

    // 1. ÉCOUTE (READ) - Priorité absolue aux données du serveur
    useEffect(() => {
        if (!db) return;

        const docRef = doc(db, "app_data", key);
        
        const unsubscribe = onSnapshot(docRef, (docSnap) => {
            if (docSnap.exists()) {
                const remoteData = docSnap.data().content as T;
                
                // Comparaison simple pour éviter les re-rendus inutiles
                // On utilise JSON.stringify qui est suffisant pour les volumes de données actuels
                if (JSON.stringify(remoteData) !== JSON.stringify(localValueRef.current)) {
                    // Mise à jour de l'état local avec les données du serveur
                    // Cela permet au PC de voir immédiatement ce que le mobile a envoyé
                    setValue(remoteData);
                    localValueRef.current = remoteData;
                }
            }
        }, (error) => {
            console.error(`🔥 Erreur Sync Lecture [${key}]:`, error);
        });

        return () => unsubscribe();
    }, [key]);

    // 2. ÉCRITURE (WRITE) - Debounce pour ne pas surcharger Firebase
    const setSyncedValue: React.Dispatch<React.SetStateAction<T>> = (newValueOrFn) => {
        setValue((prev) => {
            const newValue = newValueOrFn instanceof Function ? (newValueOrFn as Function)(prev) : newValueOrFn;
            
            // Mise à jour optimiste locale immédiate
            localValueRef.current = newValue;

            // Annuler l'écriture précédente si elle n'est pas encore partie (debounce)
            if (timeoutRef.current) clearTimeout(timeoutRef.current);
            
            // Attendre 1.5s d'inactivité avant d'envoyer au cloud
            // Cela évite d'envoyer chaque lettre tapée, mais assure l'envoi final
            timeoutRef.current = setTimeout(async () => {
                if (!db) return;
                
                try {
                    const cleanContent = JSON.parse(JSON.stringify(newValue)); // Nettoyage des undefined
                    await setDoc(doc(db, "app_data", key), { 
                        content: cleanContent, 
                        lastUpdated: new Date().toISOString(),
                        updatedByDevice: navigator.userAgent
                    }, { merge: true });
                } catch (e) {
                    console.error(`❌ Erreur Sync Écriture [${key}]:`, e);
                }
            }, 1500);

            return newValue;
        });
    };

    return [value, setSyncedValue];
}
