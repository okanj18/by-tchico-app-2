
import { Client, Commande, Employe, RoleEmploye, StatutCommande, Depense, Boutique, Product, Fournisseur, CommandeFournisseur, StatutCommandeFournisseur, StatutPaiement, Article, MouvementStock, TypeMouvement, CompteFinancier, TransactionTresorerie, Pointage, GalleryItem, CompanyAssets } from '../types';

export const mockBoutiques: Boutique[] = [
    { id: 'ATELIER', nom: 'Atelier Central (Production)', lieu: 'Siège' },
    { id: 'B1', nom: 'Boutique Siège', lieu: 'Dakar, Plateau' },
    { id: 'B2', nom: 'Showroom Almadies', lieu: 'Dakar, Almadies' }
];

export const mockEmployes: Employe[] = [
    { id: 'E1', nom: 'Moussa Diop', role: RoleEmploye.CHEF_ATELIER, telephone: '770000001', salaireBase: 150000, typeContrat: 'CDI', boutiqueId: 'ATELIER', historiquePaie: [], absences: [] },
    { id: 'E2', nom: 'Fatou Ndiaye', role: RoleEmploye.TAILLEUR, telephone: '770000002', salaireBase: 100000, typeContrat: 'PRESTATAIRE', boutiqueId: 'ATELIER', historiquePaie: [], absences: [] }
];

export const mockPointages: Pointage[] = [
    { id: 'PT_1', employeId: 'E1', date: new Date().toISOString().split('T')[0], heureArrivee: '08:55', statut: 'PRESENT' }
];

export const mockClients: Client[] = [
    { 
        id: 'C1', 
        nom: 'Aissatou Ba', 
        telephone: '+221 77 123 45 67', 
        dateAnniversaire: '1990-05-15', 
        mesures: { 
            tourCou: 36, epaule: "38/40", poitrine: 90, longueurManche: 58, tourBras: 28, 
            tourPoignet: 16, longueurBoubou: 145, longueurChemise: 65, carrureDos: 36, 
            carrureDevant: 34, taille: 75, blouse: 60, ceinture: 80, tourFesse: 100, 
            tourCuisse: 55, entreJambe: 75, longueurPantalon: 100, genou: 40, mollet: 35, bas: 30 
        }, 
        notes: 'Préfère le lin et le coton.' 
    },
    { 
        id: 'C2', 
        nom: 'Jean Michel', 
        telephone: '+221 70 987 65 43', 
        mesures: { 
            tourCou: 42, epaule: 48, poitrine: 100, longueurManche: 65, tourBras: 35, 
            tourPoignet: 19, longueurBoubou: 155, longueurChemise: 75, carrureDos: 46, 
            carrureDevant: 44, taille: 90, blouse: 70, ceinture: 95, tourFesse: 105, 
            tourCuisse: 60, entreJambe: 82, longueurPantalon: 105, genou: 45, mollet: 40, bas: 35 
        }, 
        notes: 'Client VIP.' 
    }
];

export const mockCommandes: Commande[] = [
    { id: 'CMD001', clientId: 'C1', clientNom: 'Aissatou Ba', boutiqueId: 'B1', description: 'Robe en Soie Brodé', dateCommande: '2023-10-25', dateLivraisonPrevue: '2023-11-05', statut: StatutCommande.COUTURE, tailleursIds: ['E2'], prixTotal: 150000, avance: 100000, reste: 50000, type: 'SUR_MESURE', quantite: 1 }
];

export const mockDepenses: Depense[] = [];
export const mockArticles: Article[] = [];
export const mockFournisseurs: Fournisseur[] = [];
export const mockCommandesFournisseurs: CommandeFournisseur[] = [];
export const mockMouvements: MouvementStock[] = [];
export const mockComptes: CompteFinancier[] = [
    { id: 'CPT_1', nom: 'Caisse Principale', type: 'CAISSE', solde: 500000 }
];
export const mockTransactionsTresorerie: TransactionTresorerie[] = [];
export const mockGalleryItems: GalleryItem[] = [];
export const mockCompanyAssets: CompanyAssets = { logoStr: '', stampStr: '', signatureStr: '' };
