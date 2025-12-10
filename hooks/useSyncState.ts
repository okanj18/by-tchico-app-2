
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
    
    // VERROU DE SÉCURITÉ : Empêche l'écrasement des données locales par une vieille version du cloud
    // pendant qu'on est en train de taper ou de sauvegarder.
    const isLocalUpdatePending = useRef(false);

    // 1. ÉCOUTE (READ): S'abonner aux changements dans Firestore
    useEffect(() => {
        if (!db) return;

        const docRef = doc(db, "app_data", key);
        
        // onSnapshot écoute en temps réel. Si un autre appareil modifie, on reçoit la màj ici.
        const unsubscribe = onSnapshot(docRef, (docSnap) => {
            // SI UNE MODIFICATION LOCALE EST EN COURS D'ENVOI, ON IGNORE L'ENTRÉE CLOUD
            // Cela évite que l'interface "saute" en arrière pendant la saisie/création
            if (isLocalUpdatePending.current) {
                return;
            }

            if (docSnap.exists()) {
                const data = docSnap.data().content as T;
                setValue(data);
            } else {
                // Si le document n'existe pas encore, on ne fait rien pour garder la valeur par défaut locale.
            }
            isFirstLoad.current = false;
        }, (error) => {
            console.error(`Erreur sync lecture [${key}]:`, error);
        });

        return () => unsubscribe();
    }, [key]);

    // 2. ÉCRITURE (WRITE): Sauvegarder dans Firestore quand la valeur change
    const setSyncedValue: React.Dispatch<React.SetStateAction<T>> = (newValueOrFn) => {
        // On signale qu'une modification locale est en cours
        isLocalUpdatePending.current = true;

        setValue((prev) => {
            const newValue = newValueOrFn instanceof Function ? (newValueOrFn as Function)(prev) : newValueOrFn;
            
            // Debounce : On attend 500ms (au lieu de 1s) pour être plus réactif
            if (timeoutRef.current) clearTimeout(timeoutRef.current);
            
            timeoutRef.current = setTimeout(async () => {
                if (!db) {
                    isLocalUpdatePending.current = false;
                    return;
                }
                try {
                    await setDoc(doc(db, "app_data", key), { 
                        content: newValue, 
                        lastUpdated: new Date().toISOString() 
                    });
                    console.log(`☁️ Synced [${key}]`);
                } catch (e) {
                    console.error(`Erreur sync écriture [${key}]:`, e);
                } finally {
                    // Une fois sauvegardé, on relâche le verrou pour accepter les futures mises à jour cloud
                    // On ajoute un petit délai pour laisser le temps à Firebase de propager l'event local
                    setTimeout(() => {
                        isLocalUpdatePending.current = false;
                    }, 200);
                }
            }, 500);

            return newValue;
        });
    };

    return [value, setSyncedValue];
}
