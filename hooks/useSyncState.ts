
import React, { useState, useEffect, useRef } from 'react';
import { doc, onSnapshot, setDoc } from "firebase/firestore";
import { db } from "../services/firebase";

/**
 * Hook de synchronisation temps réel optimisé pour Mobile/iOS.
 * - Lecture : Priorité serveur (onSnapshot)
 * - Écriture : Quasi-immédiate (50ms debounce) avec sécurité "Flush on Hide" pour iOS.
 */
export function useSyncState<T>(defaultValue: T, key: string): [T, React.Dispatch<React.SetStateAction<T>>] {
    const [value, setValue] = useState<T>(defaultValue);
    const localValueRef = useRef<T>(defaultValue);
    const timeoutRef = useRef<any>(null);
    const isWritingRef = useRef(false);

    // Fonction d'écriture Firestore extraite pour être appelée par le debounce OU le flush
    const writeToFirestore = async (data: T) => {
        if (!db) return;
        try {
            const cleanContent = JSON.parse(JSON.stringify(data)); // Nettoyage des undefined
            await setDoc(doc(db, "app_data", key), { 
                content: cleanContent, 
                lastUpdated: new Date().toISOString(),
                updatedByDevice: navigator.userAgent
            }, { merge: true });
        } catch (e) {
            console.error(`❌ Erreur Sync Écriture [${key}]:`, e);
        }
    };

    // 1. ÉCOUTE (READ)
    useEffect(() => {
        if (!db) return;

        const docRef = doc(db, "app_data", key);
        
        const unsubscribe = onSnapshot(docRef, (docSnap) => {
            // Si on est en train d'écrire localement, on ignore temporairement pour éviter les sauts
            if (isWritingRef.current) return;

            if (docSnap.exists()) {
                const remoteData = docSnap.data().content as T;
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

    // 2. SÉCURITÉ IOS : Sauvegarder immédiatement si l'utilisateur quitte l'app
    useEffect(() => {
        const handleVisibilityChange = () => {
            if (document.visibilityState === 'hidden') {
                // Si une écriture était en attente, on l'exécute tout de suite
                if (timeoutRef.current) {
                    clearTimeout(timeoutRef.current);
                    writeToFirestore(localValueRef.current);
                }
            }
        };
        document.addEventListener("visibilitychange", handleVisibilityChange);
        return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
    }, [key]); // Dépendance stable, mais nécessaire pour la closure si writeToFirestore changeait (ici stable)

    // 3. ÉCRITURE (WRITE)
    const setSyncedValue: React.Dispatch<React.SetStateAction<T>> = (newValueOrFn) => {
        setValue((prev) => {
            const newValue = newValueOrFn instanceof Function ? (newValueOrFn as Function)(prev) : newValueOrFn;
            
            // Mise à jour optimiste locale
            localValueRef.current = newValue;
            isWritingRef.current = true;

            // Debounce très court (50ms) : Suffisant pour éviter les doubles clics,
            // mais assez rapide pour que l'OS ne tue pas le process JS sur mobile.
            if (timeoutRef.current) clearTimeout(timeoutRef.current);
            
            timeoutRef.current = setTimeout(async () => {
                await writeToFirestore(newValue);
                isWritingRef.current = false; // On relâche le verrou après écriture
            }, 50);

            return newValue;
        });
    };

    return [value, setSyncedValue];
}
