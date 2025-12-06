export enum Gender {
  MALE = 'Garçon',
  FEMALE = 'Fille'
}

export enum Level {
  EXCELLENT = 'Excellent',
  TRES_BON = 'Très bon',
  BON = 'Bon',
  MOYEN = 'Moyen',
  FRAGILE = 'Fragile',
  INSUFFISANT = 'Insuffisant'
}

export enum Behavior {
  EXEMPLAIRE = 'Exemplaire',
  TRES_SATISFAISANT = 'Très satisfaisant',
  AGREABLE = 'Agréable',
  VOLONTAIRE = 'Volontaire / Participatif',
  SERIEUX = 'Sérieux / Attentif',
  RESERVE = 'Réservé / Timide',
  PASSIF = 'Passif / Effacé',
  INCONSTANT = 'Inconstant / Variable',
  DISTRAIT = 'Distrait / Rêveur',
  BAVARD = 'Bavard',
  AGITE = 'Agité',
  PERTURBATEUR = 'Perturbateur'
}

export enum Investment {
  SERIEUX = 'Sérieux et régulier',
  IRREGULIER = 'Irrégulier',
  EN_PROGRES = 'En progrès',
  MINIMAL = 'Minimal',
  INEXISTANT = 'Inexistant'
}

export interface Student {
  id: string;
  name: string;
  gender: Gender;
  level: Level;
  behavior: Behavior;
  investment: Investment;
  skills: string; // Free text for specific skills (e.g., "Calcul mental", "Grammaire")
  advice: string; // Free text or keywords (e.g., "Participer plus", "Continuer ainsi")
  generatedComment?: string;
}

export interface GeneratedResponseItem {
  id: string;
  comment: string;
}