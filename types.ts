
export type RoleEmploye = 'ADMIN' | 'GERANT' | 'CHEF_ATELIER' | 'TAILLEUR' | 'VENDEUR' | 'STAGIAIRE' | 'GARDIEN' | 'ASSISTANT' | 'LIVREUR' | 'CHAUFFEUR';

export const RoleEmploye = {
    ADMIN: 'ADMIN' as RoleEmploye,
    GERANT: 'GERANT' as RoleEmploye,
    CHEF_ATELIER: 'CHEF_ATELIER' as RoleEmploye,
    TAILLEUR: 'TAILLEUR' as RoleEmploye,
    VENDEUR: 'VENDEUR' as RoleEmploye,
    STAGIAIRE: 'STAGIAIRE' as RoleEmploye,
    GARDIEN: 'GARDIEN' as RoleEmploye,
    ASSISTANT: 'ASSISTANT' as RoleEmploye,
    LIVREUR: 'LIVREUR' as RoleEmploye,
    CHAUFFEUR: 'CHAUFFEUR' as RoleEmploye
};

export type NiveauAcces = 'NONE' | 'READ' | 'WRITE';

export interface PermissionsUtilisateur {
    dashboard: NiveauAcces;
    ventes: NiveauAcces;
    production: NiveauAcces;
    stock: NiveauAcces;
    approvisionnement: NiveauAcces;
    fournisseurs: NiveauAcces;
    rh: NiveauAcces;
    clients: NiveauAcces;
    finance: NiveauAcces;
    catalogue: NiveauAcces;
    settings: NiveauAcces;
}

export enum StatutCommande {
    EN_ATTENTE = 'En Attente',
    EN_COUPE = 'En Coupe',
    COUTURE = 'Couture',
    FINITION = 'Finition',
    PRET = 'Prêt',
    LIVRE = 'Livré',
    ANNULE = 'Annulé'
}

export enum StatutCommandeFournisseur {
    EN_COURS = 'En Cours',
    LIVRE = 'Livré',
    ANNULE = 'Annulé'
}

export enum StatutPaiement {
    PAYE = 'Payé',
    PARTIEL = 'Partiel',
    NON_PAYE = 'Non Payé'
}

export enum TypeMouvement {
    ACHAT = 'ACHAT',
    CONSOMMATION = 'CONSOMMATION',
    TRANSFERT = 'TRANSFERT',
    AJUSTEMENT = 'AJUSTEMENT',
    VENTE = 'VENTE',
    PRODUCTION = 'PRODUCTION'
}

export type ModePaiement = 'ESPECE' | 'WAVE' | 'ORANGE_MONEY' | 'VIREMENT' | 'CHEQUE';

export type TypeCompte = 'CAISSE' | 'BANQUE' | 'MOBILE_MONEY';

export interface SessionUser {
    id: string;
    nom: string;
    role: RoleEmploye;
    boutiqueId?: string;
    email?: string;
    permissions?: PermissionsUtilisateur;
}

export interface Boutique {
    id: string;
    nom: string;
    lieu: string;
}

export interface TransactionPaie {
    id: string;
    date: string;
    type: 'ACOMPTE' | 'PRIME' | 'SALAIRE_NET';
    montant: number;
    description: string;
    createdBy?: string;
}

export interface Absence {
    id: string;
    date: string;
    motif: string;
    nombreJours: number;
    montantRetenue: number;
    reglee: boolean;
}

export interface Employe {
    id: string;
    nom: string;
    cniRecto?: string;
    cniVerso?: string;
    role: RoleEmploye;
    telephone: string;
    email?: string;
    password?: string;
    salaireBase: number;
    typeContrat: string;
    boutiqueId?: string;
    historiquePaie?: TransactionPaie[];
    absences?: Absence[];
    actif?: boolean;
    permissions?: PermissionsUtilisateur;
}

export interface Pointage {
    id: string;
    employeId: string;
    date: string;
    heureArrivee?: string;
    heureDepart?: string;
    statut: 'PRESENT' | 'RETARD' | 'ABSENT' | 'CONGE';
}

export interface MesureHistorique {
    date: string;
    valeurs: any;
}

export interface ModeleRealise {
    url: string;
    date: string;
    description?: string;
}

export interface Client {
    id: string;
    nom: string;
    telephone: string;
    email?: string;
    dateAnniversaire?: string;
    mesures: any;
    mesuresHistorique?: MesureHistorique[];
    modelesCousus?: ModeleRealise[];
    stylePreferences?: string;
    notes?: string;
    ville?: string;
    orderCount?: number;
    lastOrderDate?: number;
}

export interface LigneCommande {
    nomArticle: string;
    variante: string;
    quantite: number;
    prixUnitaire: number;
}

export interface PaiementClient {
    id: string;
    date: string;
    montant: number;
    moyenPaiement: ModePaiement;
    note?: string;
    compteId?: string;
}

export interface Consommation {
    id?: string;
    articleId: string;
    variante: string;
    quantite: number;
}

export type ActionProduction = 'COUPE' | 'COUTURE' | 'BRODERIE' | 'FINITION' | 'REPASSAGE' | 'AUTRE';

export interface TacheProduction {
    id: string;
    commandeId: string;
    elementNom: string; 
    action: ActionProduction;
    quantite: number;
    note?: string;
    date: string;
    tailleurId: string;
    statut: 'A_FAIRE' | 'FAIT';
    description?: string;
}

export interface ElementCommande {
    id: string;
    nom: string;
    quantiteTotal: number;
}

export interface LivraisonPartielle {
    id: string;
    date: string;
    details: { elementNom: string, quantite: number }[];
    note?: string;
}

export interface Commande {
    id: string;
    clientId: string;
    clientNom: string;
    boutiqueId?: string;
    description: string;
    dateCommande: string;
    dateLivraisonPrevue: string;
    dateLivraisonEffective?: string;
    statut: StatutCommande | string;
    tailleursIds: string[];
    prixTotal: number;
    avance: number;
    reste: number;
    type: 'SUR_MESURE' | 'PRET_A_PORTER';
    paiements?: PaiementClient[];
    tva?: number;
    tvaRate?: number;
    remise?: number;
    quantite: number; 
    elements?: ElementCommande[]; 
    repartitionStatuts?: Record<string, number>; 
    consommations?: Consommation[];
    detailsVente?: LigneCommande[];
    notes?: string;
    cancelledBy?: string;
    cancelledAt?: string;
    archived?: boolean;
    taches?: TacheProduction[];
    isDevis?: boolean;
    signatureClient?: string;
    livraisons?: LivraisonPartielle[];
}

export interface Depense {
    id: string;
    date: string;
    montant: number;
    categorie: 'LOYER' | 'SALAIRE' | 'MATIERE_PREMIERE' | 'LOGISTIQUE' | 'FOIRE_EXPO' | 'ELECTRICITE' | 'RESTAURATION' | 'AUTRE';
    description: string;
    boutiqueId?: string;
    compteId?: string;
    createdBy?: string;
}

export interface Fournisseur {
    id: string;
    nomEntreprise: string;
    contactPersonne: string;
    telephone: string;
    adresse: string;
    categories: string[];
    delaiLivraisonMoyen: number;
    notes: string;
}

export type TypeArticle = 'MATIERE_PREMIERE' | 'PRODUIT_FINI';

export interface Article {
    id: string;
    nom: string;
    typeArticle: TypeArticle;
    categorie: string;
    description: string;
    prixAchatDefault: number;
    prixVenteDefault: number;
    unite: string;
    uniteAchat?: string;
    ratioConversion?: number;
    variantes: string[];
    seuilAlerte: number;
    stockParLieu: Record<string, Record<string, number>>;
    images?: string[];
    archived?: boolean;
}

export interface LigneCommandeFournisseur {
    id: string;
    articleId: string;
    nomArticle: string;
    variante: string;
    quantite: number;
    quantiteRecue?: number;
    prixUnitaire: number;
    totalLigne: number;
}

export interface PaiementFournisseur {
    id: string;
    date: string;
    montant: number;
    note?: string;
}

export interface ReceptionFournisseur {
    id: string;
    date: string;
    lieuId: string;
    details: { nomArticle: string, variante: string, quantiteRecue: number }[];
}

export interface CommandeFournisseur {
    id: string;
    fournisseurId: string;
    dateCommande: string;
    dateLivraisonPrevue: string;
    statut: StatutCommandeFournisseur;
    lignes: LigneCommandeFournisseur[];
    montantTotal: number;
    montantPaye: number;
    statutPaiement: StatutPaiement;
    tva?: number;
    tvaRate?: number;
    paiements?: PaiementFournisseur[];
    receptions?: ReceptionFournisseur[];
    archived?: boolean;
}

export interface MouvementStock {
    id: string;
    date: string;
    articleId: string;
    articleNom: string;
    variante: string;
    type: TypeMouvement;
    quantite: number;
    lieuId: string;
    lieuDestinationId?: string;
    commentaire: string;
}

export interface CompteFinancier {
    id: string;
    nom: string;
    type: TypeCompte;
    solde: number;
    numero?: string;
    boutiqueId?: string;
}

export interface TransactionTresorerie {
    id: string;
    date: string;
    type: 'ENCAISSEMENT' | 'DECAISSEMENT' | 'VIREMENT_SORTANT' | 'VIREMENT_ENTRANT';
    montant: number;
    compteId: string;
    compteDestinationId?: string;
    description: string;
    categorie: string;
    createdBy?: string;
}

export interface GalleryItem {
    id: string;
    title: string;
    category: string;
    dateAdded: string;
    imageUrl: string;
    tags: string[];
    description: string;
}

export interface CompanyAssets {
    logoStr?: string;
    stampStr?: string;
    signatureStr?: string;
    systemPassword?: string;
}
