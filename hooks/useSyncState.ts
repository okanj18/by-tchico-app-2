
import React, { useState, useEffect, useRef } from 'react';
import { doc, onSnapshot, setDoc } from "firebase/firestore";
import { db } from "../services/firebase";

/**
 * Hook de synchronisation hybride (LocalStorage + Firestore).
 * Garantit la persistance même sans Firebase configuré.
 */
export function useSyncState<T>(defaultValue: T, key: string): [T, React.Dispatch<React.SetStateAction<T>>] {
    // 1. Initialisation : Essayer LocalStorage d'abord, puis defaultValue
    const [value, setValue] = useState<T>(() => {
        const localData = localStorage.getItem(`by_tchico_${key}`);
        if (localData) {
            try {
                return JSON.parse(localData);
            } catch (e) {
                return defaultValue;
            }
        }
        return defaultValue;
    });

    const localValueRef = useRef<T>(value);
    const timeoutRef = useRef<any>(null);
    const isWritingRef = useRef(false);

    const writeToFirestore = async (data: T) => {
        // Sauvegarde systématique dans LocalStorage
        localStorage.setItem(`by_tchico_${key}`, JSON.stringify(data));
        
        if (!db) return;
        try {
            const cleanContent = JSON.parse(JSON.stringify(data));
            await setDoc(doc(db, "app_data", key), { 
                content: cleanContent, 
                lastUpdated: new Date().toISOString(),
                updatedByDevice: navigator.userAgent
            }, { merge: true });
        } catch (e) {
            console.error(`❌ Erreur Sync Firestore [${key}]:`, e);
        }
    };

    // ÉCOUTE FIRESTORE (Temps réel)
    useEffect(() => {
        if (!db) return;

        const docRef = doc(db, "app_data", key);
        const unsubscribe = onSnapshot(docRef, (docSnap) => {
            if (isWritingRef.current) return;

            if (docSnap.exists()) {
                const remoteData = docSnap.data().content as T;
                if (JSON.stringify(remoteData) !== JSON.stringify(localValueRef.current)) {
                    setValue(remoteData);
                    localValueRef.current = remoteData;
                    localStorage.setItem(`by_tchico_${key}`, JSON.stringify(remoteData));
                }
            }
        }, (error) => {
            console.debug(`Sync Lecture désactivée ou restreinte [${key}]`);
        });

        return () => unsubscribe();
    }, [key]);

    // ÉCRITURE
    const setSyncedValue: React.Dispatch<React.SetStateAction<T>> = (newValueOrFn) => {
        setValue((prev) => {
            const newValue = newValueOrFn instanceof Function ? (newValueOrFn as Function)(prev) : newValueOrFn;
            
            localValueRef.current = newValue;
            isWritingRef.current = true;

            if (timeoutRef.current) clearTimeout(timeoutRef.current);
            
            timeoutRef.current = setTimeout(async () => {
                await writeToFirestore(newValue);
                isWritingRef.current = false;
            }, 50);

            return newValue;
        });
    };

    return [value, setSyncedValue];
}
