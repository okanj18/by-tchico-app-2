
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
                if (JSON.stringify(remoteData) !== JSON.stringify(localValueRef.current)) {
                    setValue(remoteData);
                    localValueRef.current = remoteData;
                }
            }
        }, (error) => {
            console.error(`🔥 Erreur Sync Lecture [${key}]:`, error);
        });

        return () => unsubscribe();
    }, [key]);

    // 2. ÉCRITURE (WRITE) - Debounce optimisé pour Mobile (500ms)
    const setSyncedValue: React.Dispatch<React.SetStateAction<T>> = (newValueOrFn) => {
        setValue((prev) => {
            const newValue = newValueOrFn instanceof Function ? (newValueOrFn as Function)(prev) : newValueOrFn;
            
            // Mise à jour optimiste locale immédiate
            localValueRef.current = newValue;

            // Annuler l'écriture précédente si elle n'est pas encore partie
            if (timeoutRef.current) clearTimeout(timeoutRef.current);
            
            // Délai court (500ms) pour capter les clics rapides (Statut, Paiement) tout en groupant la frappe
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
            }, 500);

            return newValue;
        });
    };

    return [value, setSyncedValue];
}
