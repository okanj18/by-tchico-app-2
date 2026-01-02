
import { GoogleGenAI, Type } from "@google/genai";
import { COMPANY_CONFIG } from "../config";

/**
 * Initialisation du client GenAI.
 * L'API Key est récupérée depuis process.env.API_KEY comme requis.
 */
const getAiClient = () => new GoogleGenAI({ apiKey: process.env.API_KEY });

export const getAIAnalysis = async (contextData: string, userPrompt: string): Promise<string> => {
    try {
        const ai = getAiClient();
        const modelName = 'gemini-3-flash-preview';
        
        const systemInstruction = `Tu es l'assistant expert de BY TCHICO, un atelier de couture de luxe au Sénégal.
Ta mission : Analyser les données et donner des conseils stratégiques courts (2 phrases max).
Donne des chiffres si possible. Réponds en Français.`;

        const fullPrompt = `DONNÉES DU MOMENT:
${contextData}

DEMANDE DU GÉRANT:
${userPrompt}`;

        const response = await ai.models.generateContent({
            model: modelName,
            contents: fullPrompt,
            config: {
                systemInstruction: systemInstruction,
                temperature: 0.7,
            }
        });

        // Utilisation de la propriété .text directe
        return response.text || "Analyse indisponible.";
    } catch (error) {
        console.error("Erreur Critique Gemini Analysis:", error);
        return "Erreur réseau avec l'IA. Vérifiez votre connexion ou les quotas d'API.";
    }
};

export const analyzeProductionBottlenecks = async (commandes: any[], artisans: any[]): Promise<string> => {
    try {
        const ai = getAiClient();
        const summary = commandes.map(c => ({
            id: c.id,
            statut: c.statut,
            qte: c.quantite,
            tailleurs: c.tailleursIds
        }));
        
        const prompt = `Voici l'état actuel de l'atelier BY TCHICO :
${JSON.stringify(summary)}
Nombre de tailleurs : ${artisans.length}

Identifie le blocage majeur en production et donne une solution en une seule phrase.`;

        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: prompt,
        });
        return response.text || "Production fluide.";
    } catch (e) {
        console.error("Erreur Gemini Bottlenecks:", e);
        return "Analyse de production temporairement indisponible.";
    }
};

export const recommendFabricMeterage = async (measurements: any, garmentType: string): Promise<string> => {
    try {
        if (!garmentType) return "Précisez le vêtement.";
        
        const ai = getAiClient();
        const prompt = `Expert tailleur sénégalais, dis-moi combien de mètres de tissu (Largeur 150cm) il faut pour un(e) "${garmentType}".
Mesures du client : ${JSON.stringify(measurements)}.
Réponse courte uniquement (ex: "3 mètres de Bazin car...")`;

        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: prompt,
        });
        return response.text || "Impossible de calculer.";
    } catch (e) {
        console.error("Erreur Gemini Meterage:", e);
        return "Service de calcul indisponible.";
    }
};

export const draftClientMessage = async (clientName: string, orderDescription: string, status: string): Promise<string> => {
     try {
        const ai = getAiClient();
        const prompt = `Rédige un petit message WhatsApp pour ${clientName} concernant sa commande "${orderDescription}" qui est maintenant au stade "${status}".
Ton poli et professionnel.`;

        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: prompt,
        });
        return response.text || "";
     } catch (e) {
         return `Bonjour ${clientName}, votre commande est passée au statut ${status}.`;
     }
}

export const parseMeasurementsFromText = async (text: string): Promise<Record<string, string | number>> => {
    try {
        if (!text) return {};
        const ai = getAiClient();
        const prompt = `Extrais les mesures de couture de ce texte : "${text}"`;

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
        
        const rawJson = response.text || "{}";
        // Nettoyage au cas où l'IA renverrait des balises ```json
        const cleanedJson = rawJson.replace(/```json/g, '').replace(/```/g, '').trim();
        return JSON.parse(cleanedJson);
    } catch (error) {
        console.error("Erreur parsing mesures IA:", error);
        return {};
    }
};
