
import { GoogleGenAI, Type } from "@google/genai";
import { COMPANY_CONFIG } from "../config";

export const getAIAnalysis = async (contextData: string, userPrompt: string): Promise<string> => {
    try {
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        const model = 'gemini-3-flash-preview';
        
        const systemInstruction = `
            Tu es un assistant expert en gestion d'entreprise pour "${COMPANY_CONFIG.name}", ${COMPANY_CONFIG.aiContext}.
            Ta mission est d'aider le gérant à optimiser la production, suivre les ventes, et gérer les denses.
            Réponds toujours de manière professionnelle, concise et en Français.
            Utilise le contexte JSON fourni pour baser tes analyses.
            La devise est le ${COMPANY_CONFIG.currency}.
        `;

        const fullPrompt = `
            CONTEXTE DONNÉES ENTREPRISE (JSON):
            ${contextData}

            QUESTION UTILISATEUR:
            ${userPrompt}
        `;

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
        console.error("Erreur Gemini:", error);
        return "Erreur de connexion à l'IA. Veuillez vérifier votre clé API ou votre connexion internet.";
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
        
        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: `Analyse ce flux de production pour l'atelier de couture BY TCHICO :
            Commandes en cours : ${JSON.stringify(summary)}
            Artisans disponibles : ${artisans.length}
            
            Identifie s'il y a un goulot d'étranglement (ex: trop de commandes en "Couture") ou si un artisan est surchargé. 
            Donne une recommandation d'action immédiate en 2 phrases maximum.`,
        });
        return response.text || "Flux de production stable.";
    } catch (e) {
        return "Analyse indisponible.";
    }
};

export const recommendFabricMeterage = async (measurements: any, garmentType: string): Promise<string> => {
    try {
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: `En tant qu'expert tailleur, recommande le métrage de tissu nécessaire (en mètres) pour confectionner un(e) "${garmentType}".
            Mesures du client (en cm) : ${JSON.stringify(measurements)}.
            Donne une réponse courte, précise et explique brièvement pourquoi ce métrage.`,
        });
        return response.text || "Erreur de calcul IA.";
    } catch (e) {
        return "Impossible d'obtenir une recommandation pour le moment.";
    }
};

export const draftClientMessage = async (clientName: string, orderDescription: string, status: string): Promise<string> => {
     try {
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: `Rédige un message WhatsApp court et poli pour le client ${clientName}.
            Sa commande "${orderDescription}" est actuellement au statut : "${status}".
            Si c'est "Prêt", invite-le à passer à la boutique ${COMPANY_CONFIG.name}.
            Utilise un ton chaleureux.`,
        });
        return response.text || "";
     } catch (e) {
         return "Bonjour, votre commande est mise à jour.";
     }
}

export const parseMeasurementsFromText = async (text: string): Promise<Record<string, string | number>> => {
    try {
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: `
                Analyse le texte suivant qui contient des mesures de couture dictées vocalement.
                Texte : "${text}"
                
                Extrais les valeurs et associe-les aux clés JSON correspondantes.
                
                RÈGLE CRITIQUE POUR LES MESURES MULTIPLES :
                Si l'utilisateur énonce deux chiffres (ex: "épaule 38 42"), renvoie "38/42".
            `,
            config: {
                responseMimeType: 'application/json',
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        tourCou: { type: Type.STRING, description: 'Tour de cou' },
                        epaule: { type: Type.STRING, description: 'Mesure épaule' },
                        poitrine: { type: Type.STRING, description: 'Tour de poitrine' },
                        longueurManche: { type: Type.STRING, description: 'Longueur de manche' },
                        tourBras: { type: Type.STRING, description: 'Tour de bras' },
                        tourPoignet: { type: Type.STRING, description: 'Tour de poignet' },
                        longueurBoubou: { type: Type.STRING, description: 'Longueur boubou' },
                        longueurChemise: { type: Type.STRING, description: 'Longueur chemise' },
                        carrureDos: { type: Type.STRING, description: 'Carrure dos' },
                        carrureDevant: { type: Type.STRING, description: 'Carrure devant' },
                        taille: { type: Type.STRING, description: 'Tour de taille' },
                        blouse: { type: Type.STRING, description: 'Mesure blouse' },
                        ceinture: { type: Type.STRING, description: 'Mesure ceinture' },
                        tourFesse: { type: Type.STRING, description: 'Tour de fesse' },
                        tourCuisse: { type: Type.STRING, description: 'Tour de cuisse' },
                        genou: { type: Type.STRING, description: 'Mesure genou' },
                        mollet: { type: Type.STRING, description: 'Mesure mollet' },
                        bas: { type: Type.STRING, description: 'Mesure bas' },
                        entreJambe: { type: Type.STRING, description: 'Entre jambe' },
                        longueurPantalon: { type: Type.STRING, description: 'Longueur pantalon' }
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
