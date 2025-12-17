
import { GoogleGenAI } from "@google/genai";
import { COMPANY_CONFIG } from "../config";

// Initialization moved inside functions to ensure fresh instance as per guidelines

export const getAIAnalysis = async (contextData: string, userPrompt: string): Promise<string> => {
    try {
        // ALWAYS obtain API Key from process.env.API_KEY and initialize inside the function
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        
        // Using 'gemini-3-flash-preview' for basic text tasks as per model selection guidelines
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

        // Use .text property, not .text() method
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
        // Use .text property
        return response.text || "";
     } catch (e) {
         return `Bonjour ${clientName}, votre commande "${orderDescription}" est maintenant : ${status}.`;
     }
}

export const parseMeasurementsFromText = async (text: string): Promise<Record<string, number>> => {
    try {
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: `
                Analyse le texte suivant qui contient des mesures de couture dictées vocalement.
                Texte : "${text}"
                
                Extrais les valeurs numériques et associe-les aux clés JSON suivantes (si mentionnées).
                Clés disponibles : 
                - tourCou, epaule, poitrine, longueurManche, tourBras, tourPoignet
                - longueurBoubou1, longueurBoubou2 (si on dit "longueur boubou 140 sur 145" par exemple)
                - longueurChemise, carrureDos, carrureDevant, taille, blouse, ceinture
                - tourFesse, tourCuisse, entreJambe, longueurPantalon
                - genou1, genou2 (si on dit "genou 40 sur 38")
                - bas

                Règles :
                1. Renvoie UNIQUEMENT un objet JSON valide sans Markdown.
                2. Les valeurs doivent être des nombres (ex: 80, pas "80cm").
                3. Si une mesure est ambigüe, fais de ton mieux pour deviner le contexte (ex: "manche 60" = longueurManche).
                4. Ignore les clés non trouvées.
            `,
            config: {
                responseMimeType: 'application/json'
            }
        });
        
        // Use .text property
        const jsonText = response.text || "{}";
        return JSON.parse(jsonText);
    } catch (error) {
        console.error("Erreur parsing mesures IA:", error);
        return {};
    }
};
