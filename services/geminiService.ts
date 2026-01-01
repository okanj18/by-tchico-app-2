
import { GoogleGenAI, Type } from "@google/genai";
import { COMPANY_CONFIG } from "../config";

export const getAIAnalysis = async (contextData: string, userPrompt: string): Promise<string> => {
    try {
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        const model = 'gemini-3-flash-preview';
        
        const systemInstruction = `Tu es un assistant expert en gestion d'entreprise pour "${COMPANY_CONFIG.name}", ${COMPANY_CONFIG.aiContext}.
Ta mission est d'aider le gérant à optimiser la production, suivre les ventes, et gérer les dépenses.
Réponds toujours de manière professionnelle, concise et en Français.
La devise est le ${COMPANY_CONFIG.currency}.`;

        const fullPrompt = `CONTEXTE DONNÉES ENTREPRISE (JSON):
${contextData}

QUESTION UTILISATEUR:
${userPrompt}`;

        const response = await ai.models.generateContent({
            model: model,
            contents: fullPrompt,
            config: {
                systemInstruction: systemInstruction,
                temperature: 0.7,
            }
        });

        return response.text || "Désolé, je n'ai pas pu générer une analyse pour le moment.";
    } catch (error) {
        console.error("Erreur Gemini Analysis:", error);
        return "Erreur de connexion à l'IA. Veuillez vérifier votre connexion internet ou réessayer plus tard.";
    }
};

export const analyzeProductionBottlenecks = async (commandes: any[], artisans: any[]): Promise<string> => {
    try {
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        const summary = commandes.map(c => ({
            id: c.id,
            statut: c.statut,
            artisans: c.tailleursIds,
            datePrevue: c.dateLivraisonPrevue
        }));
        
        const prompt = `Analyse ce flux de production pour l'atelier de couture BY TCHICO :
Commandes en cours : ${JSON.stringify(summary)}
Artisans disponibles : ${artisans.length}

Identifie s'il y a un goulot d'étranglement (ex: trop de commandes en "Couture") ou si un artisan est surchargé. 
Donne une recommandation d'action immédiate en 2 phrases maximum.`;

        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: prompt,
        });
        return response.text || "Flux de production stable.";
    } catch (e) {
        console.error("Erreur Gemini Bottlenecks:", e);
        return "Analyse indisponible.";
    }
};

export const recommendFabricMeterage = async (measurements: any, garmentType: string): Promise<string> => {
    try {
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        const prompt = `En tant qu'expert tailleur sénégalais, recommande le métrage de tissu nécessaire (en mètres et yards) pour confectionner un(e) "${garmentType}".
Mesures du client (en cm) : ${JSON.stringify(measurements)}.
Prends en compte la largeur standard du tissu au Sénégal (généralement 150cm ou 120cm).
Donne une réponse courte, précise et explique brièvement pourquoi ce métrage.`;

        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: prompt,
        });
        return response.text || "Erreur de calcul IA.";
    } catch (e) {
        console.error("Erreur Gemini Meterage:", e);
        return "Impossible d'obtenir une recommandation pour le moment.";
    }
};

export const draftClientMessage = async (clientName: string, orderDescription: string, status: string): Promise<string> => {
     try {
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        const prompt = `Rédige un message WhatsApp court et poli pour le client ${clientName}.
Sa commande "${orderDescription}" est actuellement au statut : "${status}".
Si c'est "Prêt", invite-le à passer à la boutique ${COMPANY_CONFIG.name}.
Utilise un ton chaleureux.`;

        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: prompt,
        });
        return response.text || "";
     } catch (e) {
         return "Bonjour, votre commande est mise à jour.";
     }
}

export const parseMeasurementsFromText = async (text: string): Promise<Record<string, string | number>> => {
    try {
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        const prompt = `Analyse le texte suivant qui contient des mesures de couture dictées vocalement.
Texte : "${text}"

Extrais les valeurs et associe-les aux clés JSON correspondantes.

RÈGLE CRITIQUE POUR LES MESURES MULTIPLES :
Si l'utilisateur énonce deux chiffres (ex: "épaule 38 42"), renvoie "38/42".`;

        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: prompt,
            config: {
                responseMimeType: 'application/json',
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        tourCou: { type: Type.STRING },
                        epaule: { type: Type.STRING },
                        poitrine: { type: Type.STRING },
                        longueurManche: { type: Type.STRING },
                        tourBras: { type: Type.STRING },
                        tourPoignet: { type: Type.STRING },
                        longueurBoubou: { type: Type.STRING },
                        longueurChemise: { type: Type.STRING },
                        carrureDos: { type: Type.STRING },
                        carrureDevant: { type: Type.STRING },
                        taille: { type: Type.STRING },
                        blouse: { type: Type.STRING },
                        ceinture: { type: Type.STRING },
                        tourFesse: { type: Type.STRING },
                        tourCuisse: { type: Type.STRING },
                        genou: { type: Type.STRING },
                        mollet: { type: Type.STRING },
                        bas: { type: Type.STRING },
                        entreJambe: { type: Type.STRING },
                        longueurPantalon: { type: Type.STRING }
                    }
                }
            }
        });
        
        const jsonText = response.text || "{}";
        return JSON.parse(jsonText);
    } catch (error) {
        console.error("Erreur parsing mesures IA:", error);
        return {};
    }
};
