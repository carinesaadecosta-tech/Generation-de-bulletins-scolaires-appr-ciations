import { GoogleGenAI, Type } from "@google/genai";
import { Student, GeneratedResponseItem } from "../types";

// Safe access to process.env to prevent "process is not defined" crashes in browser environments
const getApiKey = () => {
  try {
    if (typeof process !== 'undefined' && process.env) {
      return process.env.API_KEY;
    }
  } catch (e) {
    // Ignore error if process is not available
  }
  return undefined;
};

const apiKey = getApiKey();

// Initialize the client only if we have a key, otherwise handle it in the function call
const ai = apiKey ? new GoogleGenAI({ apiKey: apiKey }) : null;

export const generateAppreciations = async (
  subject: string,
  students: Student[]
): Promise<GeneratedResponseItem[]> => {
  if (!ai || !apiKey) {
    throw new Error("Clé API manquante. Veuillez configurer votre clé API (process.env.API_KEY).");
  }

  if (students.length === 0) {
    return [];
  }

  // Filter out students with empty names to avoid wasting tokens
  const validStudents = students.filter(s => s.name.trim() !== "");
  if (validStudents.length === 0) return [];

  const prompt = `
    Tu es un assistant pédagogique expert pour des enseignants. 
    Ta tâche est de rédiger des appréciations de bulletin scolaire pour la matière : "${subject}".

    Voici la liste des élèves avec leurs caractéristiques :
    ${JSON.stringify(validStudents.map(s => ({
      id: s.id,
      prenom: s.name,
      genre: s.gender,
      niveau: s.level,
      comportement: s.behavior,
      investissement: s.investment,
      competences_acquises: s.skills,
      conseils_cibles: s.advice
    })), null, 2)}

    Consignes de rédaction :
    1. Langue : Français correct, simple et professionnel.
    2. Style : Direct mais encourageant et bienveillant.
    3. Structure : Utilise des connecteurs logiques (De plus, Cependant, Par ailleurs, Ainsi...) pour lier les idées.
    4. Contenu : Combine le niveau scolaire, le comportement et l'investissement. Mentionne les compétences spécifiques si indiquées. Termine par le conseil donné.
    5. Grammaire : Accorde impérativement les adjectifs selon le genre de l'élève (Garçon/Fille).
    6. Longueur : Environ 2 à 4 phrases par appréciation.
    
    Format de réponse attendu : Une liste JSON contenant l'ID de l'élève et son appréciation rédigée.
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              id: { type: Type.STRING },
              comment: { type: Type.STRING }
            },
            required: ["id", "comment"]
          }
        }
      }
    });

    const responseText = response.text;
    if (!responseText) {
        throw new Error("Réponse vide de l'IA");
    }
    
    const data = JSON.parse(responseText) as GeneratedResponseItem[];
    return data;

  } catch (error) {
    console.error("Erreur lors de la génération des appréciations :", error);
    throw error;
  }
};