
import { GoogleGenAI } from "@google/genai";
import { COMPANY_CONFIG } from "../config";

export const getAIAnalysis = async (contextData: string, userPrompt: string): Promise<string> => {
    try {
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        const model = 'gemini-3-flash-preview';
        
        const systemInstruction = `
            Tu es un assistant expert en gestion d'entreprise pour "${COMPANY_CONFIG.name}", ${COMPANY_CONFIG.aiContext}.
            Ta mission est d'aider le gérant à optimiser la production, suivre les ventes, et gérer les dépenses.
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
                
                Clés JSON : 
                - tourCou, epaule, poitrine, longueurManche, tourBras, tourPoignet
                - longueurBoubou, longueurChemise, carrureDos, carrureDevant, taille, blouse, ceinture
                - tourFesse, tourCuisse, genou, mollet, bas, entreJambe, longueurPantalon

                Renvoie UNIQUEMENT un objet JSON.
            `,
            config: {
                responseMimeType: 'application/json'
            }
        });
        
        const jsonText = response.text || "{}";
        return JSON.parse(jsonText);
    } catch (error) {
        console.error("Erreur parsing mesures IA:", error);
        return {};
    }
};
