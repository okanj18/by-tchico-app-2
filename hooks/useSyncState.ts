import React, { useState, useEffect, useRef } from 'react';
import { doc, onSnapshot, setDoc } from "firebase/firestore";
import { db } from "../services/firebase";

/**
 * Hook personnalisé qui remplace useState/useStickyState.
 * Il synchronise automatiquement l'état avec un document Firestore.
 * 
 * @param key L'ID unique du document dans la collection 'app_data' (ex: 'articles', 'clients')
 * @param defaultValue La valeur par défaut si rien n'existe dans la base
 */
export function useSyncState<T>(defaultValue: T, key: string): [T, React.Dispatch<React.SetStateAction<T>>] {
    // État local pour la réactivité immédiate de l'UI
    const [value, setValue] = useState<T>(defaultValue);
    const isFirstLoad = useRef(true);
    const timeoutRef = useRef<any>(null);

    // 1. ÉCOUTE (READ): S'abonner aux changements dans Firestore
    useEffect(() => {
        if (!db) return;

        const docRef = doc(db, "app_data", key);
        
        // onSnapshot écoute en temps réel. Si un autre appareil modifie, on reçoit la màj ici.
        const unsubscribe = onSnapshot(docRef, (docSnap) => {
            if (docSnap.exists()) {
                const data = docSnap.data().content as T;
                // On met à jour le state local seulement si c'est différent (pour éviter les boucles)
                // Note: Une comparaison profonde serait idéale, ici on fait confiance au flux
                setValue(data);
            } else {
                // Si le document n'existe pas encore (premier lancement), on l'initialise
                // On ne fait rien ici pour garder la valeur par défaut locale, 
                // le premier 'Save' l'écrira.
            }
            isFirstLoad.current = false;
        }, (error) => {
            console.error(`Erreur sync lecture [${key}]:`, error);
        });

        return () => unsubscribe();
    }, [key]);

    // 2. ÉCRITURE (WRITE): Sauvegarder dans Firestore quand la valeur change
    const setSyncedValue: React.Dispatch<React.SetStateAction<T>> = (newValueOrFn) => {
        setValue((prev) => {
            const newValue = newValueOrFn instanceof Function ? (newValueOrFn as Function)(prev) : newValueOrFn;
            
            // Debounce : On attend 1s après la dernière frappe pour envoyer au cloud
            // pour ne pas saturer la base de données.
            if (timeoutRef.current) clearTimeout(timeoutRef.current);
            
            timeoutRef.current = setTimeout(async () => {
                if (!db) return;
                try {
                    await setDoc(doc(db, "app_data", key), { 
                        content: newValue, 
                        lastUpdated: new Date().toISOString() 
                    });
                    console.log(`☁️ Synced [${key}]`);
                } catch (e) {
                    console.error(`Erreur sync écriture [${key}]:`, e);
                }
            }, 1000);

            return newValue;
        });
    };

    return [value, setSyncedValue];
}