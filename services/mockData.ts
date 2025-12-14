
// ... (imports existants)
import { Client, Commande, Employe, RoleEmploye, StatutCommande, Depense, Boutique, Product, Fournisseur, CommandeFournisseur, StatutCommandeFournisseur, StatutPaiement, Article, MouvementStock, TypeMouvement, CompteFinancier, TransactionTresorerie, Pointage, GalleryItem, CompanyAssets } from '../types';

// ... (toutes les autres constantes mockBoutiques, mockEmployes, etc. restent inchangées)

export const mockBoutiques: Boutique[] = [
    { id: 'ATELIER', nom: 'Atelier Central (Production)', lieu: 'Siège' },
    { id: 'B1', nom: 'Boutique Siège', lieu: 'Dakar, Plateau' },
    { id: 'B2', nom: 'Showroom Almadies', lieu: 'Dakar, Almadies' },
    { id: 'B3', nom: 'Stand Foire FIDAK', lieu: 'CICES' }
];

export const mockEmployes: Employe[] = [
    { id: 'E1', nom: 'Moussa Diop', numeroCNI: '1752199001234', role: RoleEmploye.CHEF_ATELIER, telephone: '770000001', salaireBase: 150000, typeContrat: 'CDI', boutiqueId: 'ATELIER', historiquePaie: [], absences: [] },
    { id: 'E2', nom: 'Fatou Ndiaye', numeroCNI: '1752199505678', role: RoleEmploye.TAILLEUR, telephone: '770000002', salaireBase: 100000, typeContrat: 'PRESTATAIRE', boutiqueId: 'ATELIER', historiquePaie: [], absences: [] },
    { id: 'E3', nom: 'Amadou Sow', numeroCNI: '2752198809012', role: RoleEmploye.TAILLEUR, telephone: '770000003', salaireBase: 100000, typeContrat: 'PRESTATAIRE', boutiqueId: 'ATELIER', historiquePaie: [], absences: [] },
    { id: 'E4', nom: 'Sophie Gueye', numeroCNI: '2752200003456', role: RoleEmploye.VENDEUR, boutiqueId: 'B1', telephone: '770000004', salaireBase: 75000, typeContrat: 'CDD', historiquePaie: [], absences: [] },
    { id: 'E5', nom: 'Ibrahima Fall', numeroCNI: '1752200207890', role: RoleEmploye.STAGIAIRE, telephone: '770000005', salaireBase: 30000, typeContrat: 'STAGE', boutiqueId: 'ATELIER', historiquePaie: [], absences: [] }
];

export const mockPointages: Pointage[] = [
    { id: 'PT_1', employeId: 'E1', date: new Date().toISOString().split('T')[0], heureArrivee: '08:55', statut: 'PRESENT' },
    { id: 'PT_2', employeId: 'E4', date: new Date().toISOString().split('T')[0], heureArrivee: '09:15', statut: 'RETARD' },
    { id: 'PT_3', employeId: 'E2', date: new Date().toISOString().split('T')[0], heureArrivee: '09:00', heureDepart: '18:00', statut: 'PRESENT' }
];

export const mockClients: Client[] = [
    { id: 'C1', nom: 'Aissatou Ba', telephone: '+221 77 123 45 67', dateAnniversaire: '1990-05-15', mesures: { tourCou: 36, epaule: 38, poitrine: 90, longueurManche: 58, tourBras: 28, tourPoignet: 16, longueurBoubou1: 140, longueurBoubou2: 145, longueurChemise: 65, carrureDos: 36, carrureDevant: 34, taille: 75, blouse: 60, ceinture: 80, tourFesse: 100, tourCuisse: 55, entreJambe: 75, longueurPantalon: 100, genou1: 40, genou2: 38, bas: 30 }, notes: 'Préfère le lin et le coton.' },
    { id: 'C2', nom: 'Jean Michel', telephone: '+221 70 987 65 43', mesures: { tourCou: 42, epaule: 48, poitrine: 100, longueurManche: 65, tourBras: 35, tourPoignet: 19, longueurBoubou1: 150, longueurBoubou2: 155, longueurChemise: 75, carrureDos: 46, carrureDevant: 44, taille: 90, blouse: 70, ceinture: 95, tourFesse: 105, tourCuisse: 60, entreJambe: 82, longueurPantalon: 105, genou1: 45, genou2: 43, bas: 35 }, notes: 'Client VIP.' }
];

export const mockCommandes: Commande[] = [
    { id: 'CMD001', clientId: 'C1', clientNom: 'Aissatou Ba', boutiqueId: 'B1', description: 'Robe en Soie Brodé', dateCommande: '2023-10-25', dateLivraisonPrevue: '2023-11-05', statut: StatutCommande.COUTURE, tailleursIds: ['E2', 'E5'], prixTotal: 150000, avance: 100000, reste: 50000, type: 'SUR_MESURE' },
    { id: 'CMD002', clientId: 'C2', clientNom: 'Jean Michel', boutiqueId: 'B2', description: 'Costume 3 pièces', dateCommande: '2023-10-28', dateLivraisonPrevue: '2023-11-10', statut: StatutCommande.EN_COUPE, tailleursIds: ['E1'], prixTotal: 250000, avance: 250000, reste: 0, type: 'SUR_MESURE' }
];

export const mockDepenses: Depense[] = [
    { id: 'D1', date: '2023-10-20', montant: 500000, categorie: 'LOYER', description: 'Loyer Atelier Octobre', boutiqueId: 'ATELIER' },
    { id: 'D2', date: '2023-10-22', montant: 150000, categorie: 'MATIERE_PREMIERE', description: 'Achat Tissu Bazin', boutiqueId: 'ATELIER' },
    { id: 'D3', date: '2023-10-26', montant: 25000, categorie: 'LOGISTIQUE', description: 'Transport Livraison Client', boutiqueId: 'B1' },
    { id: 'D4', date: '2023-10-27', montant: 200000, categorie: 'FOIRE_EXPO', description: 'Location Stand FIDAK', boutiqueId: 'B3' }
];

export const mockStock: Product[] = [
    { id: 'P1', nom: 'Chapeau Panama Local', prix: 15000, stock: 20, fournisseur: 'BY TCHICO' },
    { id: 'P2', nom: 'Tissu Soie Import', prix: 10000, stock: 50, fournisseur: 'Fournisseur Dubai' }
];

export const mockFournisseurs: Fournisseur[] = [
    { id: 'F1', nomEntreprise: 'Tissus du Monde', contactPersonne: 'M. Sylla', telephone: '+221 77 555 00 11', adresse: 'Marché HLM, Dakar', categories: ['Tissus', 'Bazin', 'Soie'], delaiLivraisonMoyen: 2, notes: 'Fournisseur principal pour le Bazin riche.' },
    { id: 'F2', nomEntreprise: 'Mercerie Sandaga', contactPersonne: 'Mme. Faye', telephone: '+221 76 444 22 33', adresse: 'Av. Lamine Gueye, Sandaga', categories: ['Mercerie', 'Fils', 'Boutons'], delaiLivraisonMoyen: 1, notes: 'Très réactive pour les petites commandes.' },
    { id: 'F3', nomEntreprise: 'Global Packaging', contactPersonne: 'Service Commercial', telephone: '+221 33 800 99 88', adresse: 'Zone Industrielle, Dakar', categories: ['Emballage', 'Sacs', 'Étiquettes'], delaiLivraisonMoyen: 5, notes: 'Commander en gros volume.' }
];

export const mockArticles: Article[] = [
    { id: 'A1', nom: 'Bazin Riche', typeArticle: 'MATIERE_PREMIERE', categorie: 'Tissu', description: 'Bazin qualité supérieure, importation Mali/Autriche', prixAchatDefault: 30000, prixVenteDefault: 45000, unite: 'Mètre', uniteAchat: 'Rouleau', ratioConversion: 30, variantes: ['Blanc', 'Bleu Ciel', 'Gris', 'Marron'], seuilAlerte: 20, stockParLieu: { 'ATELIER': { 'Blanc': 200, 'Bleu Ciel': 100 }, 'B1': {}, 'B2': {}, 'B3': {} }, images: [] },
    { id: 'A2', nom: 'Soie Italienne', typeArticle: 'MATIERE_PREMIERE', categorie: 'Tissu', description: 'Soie fluide pour robes de soirée', prixAchatDefault: 5000, prixVenteDefault: 12000, unite: 'Mètre', variantes: ['Rouge', 'Noir', 'Imprimé Floral'], seuilAlerte: 10, stockParLieu: { 'ATELIER': { 'Rouge': 20, 'Noir': 30 }, 'B1': { 'Rouge': 5 }, 'B2': {}, 'B3': {} }, images: [] },
    { id: 'A3', nom: 'Fil à Coudre', typeArticle: 'MATIERE_PREMIERE', categorie: 'Mercerie', description: 'Bobine de fil standard', prixAchatDefault: 500, prixVenteDefault: 1000, unite: 'Pièce', variantes: ['Noir', 'Blanc', 'Doré', 'Argenté'], seuilAlerte: 20, stockParLieu: { 'ATELIER': { 'Noir': 50, 'Blanc': 50 }, 'B1': { 'Noir': 10 }, 'B2': { 'Blanc': 10 }, 'B3': { 'Doré': 5 } }, images: [] },
    { id: 'A4', nom: 'Chemise Homme Lin', typeArticle: 'PRODUIT_FINI', categorie: 'Produit Fini', description: 'Chemise col Mao', prixAchatDefault: 5000, prixVenteDefault: 15000, unite: 'Pièce', variantes: ['M', 'L', 'XL'], seuilAlerte: 5, stockParLieu: { 'ATELIER': {}, 'B1': { 'M': 5, 'L': 7 }, 'B2': { 'L': 4, 'XL': 4 }, 'B3': {} }, images: [] },
    { id: 'A5', nom: 'Chaussures Cuir Artisanales', typeArticle: 'PRODUIT_FINI', categorie: 'Accessoire', description: 'Chaussures homme achetées fournisseur externe', prixAchatDefault: 8000, prixVenteDefault: 18000, unite: 'Paire', variantes: ['40', '41', '42', '43'], seuilAlerte: 3, stockParLieu: { 'ATELIER': {}, 'B1': { '41': 2, '42': 3 }, 'B2': { '43': 2 }, 'B3': {} }, images: [] },
    { id: 'A6', nom: 'Boutons', typeArticle: 'MATIERE_PREMIERE', categorie: 'Mercerie', description: 'Boutons divers pour chemises et pantalons', prixAchatDefault: 300, prixVenteDefault: 600, unite: 'Pièce', uniteAchat: 'Paquet', ratioConversion: 100, variantes: ['Pression', 'Machette Argent', 'Machette Or', 'Standard Blanc'], seuilAlerte: 50, stockParLieu: { 'ATELIER': { 'Pression': 200, 'Standard Blanc': 300 }, 'B1': {}, 'B2': {}, 'B3': {} }, images: [] }
];

export const mockCommandesFournisseurs: CommandeFournisseur[] = [
    { id: 'CF1', fournisseurId: 'F1', dateCommande: '2023-10-25', dateLivraisonPrevue: '2023-10-27', statut: StatutCommandeFournisseur.LIVRE, lignes: [{ id: 'L1', articleId: 'A1', nomArticle: 'Bazin Riche (Blanc)', variante: 'Blanc', quantite: 5, quantiteRecue: 5, prixUnitaire: 30000, totalLigne: 150000 }], montantTotal: 150000, montantPaye: 150000, statutPaiement: StatutPaiement.PAYE, paiements: [{ id: 'P1', date: '2023-10-25', montant: 150000, note: 'Paiement comptant' }], receptions: [{ id: 'R1', date: '2023-10-27', lieuId: 'ATELIER', details: [{ nomArticle: 'Bazin Riche (Blanc)', variante: 'Blanc', quantiteRecue: 5 }] }] },
    { id: 'CF2', fournisseurId: 'F2', dateCommande: '2023-10-29', dateLivraisonPrevue: '2023-10-30', statut: StatutCommandeFournisseur.EN_COURS, lignes: [{ id: 'L2', articleId: 'A3', nomArticle: 'Fil à Coudre (Doré)', variante: 'Doré', quantite: 10, quantiteRecue: 0, prixUnitaire: 1000, totalLigne: 10000 }, { id: 'L3', articleId: 'A6', nomArticle: 'Boutons (Pression)', variante: 'Pression', quantite: 50, quantiteRecue: 0, prixUnitaire: 300, totalLigne: 15000 }], montantTotal: 25000, montantPaye: 10000, statutPaiement: StatutPaiement.PARTIEL, paiements: [{ id: 'P2', date: '2023-10-29', montant: 10000, note: 'Acompte' }], receptions: [] }
];

export const mockMouvements: MouvementStock[] = [
    { id: 'M1', date: '2023-10-25', articleId: 'A1', articleNom: 'Bazin Riche', variante: 'Blanc', type: TypeMouvement.ACHAT, quantite: 150, lieuId: 'ATELIER', commentaire: 'Réception commande CF1' },
    { id: 'M2', date: '2023-10-26', articleId: 'A1', articleNom: 'Bazin Riche', variante: 'Blanc', type: TypeMouvement.CONSOMMATION, quantite: -5, lieuId: 'ATELIER', commentaire: 'Pour Commande Aissatou Ba' }
];

export const mockComptes: CompteFinancier[] = [
    { id: 'CPT_CAISSE_CENTRALE', nom: 'Caisse Centrale', type: 'CAISSE', solde: 150000, boutiqueId: 'ATELIER' },
    { id: 'CPT_WAVE_PRO', nom: 'Wave Marchand Pro', type: 'MOBILE_MONEY', solde: 350000, numero: '77 000 00 00' },
    { id: 'CPT_BANQUE_1', nom: 'Compte Ecobank', type: 'BANQUE', solde: 1250000, numero: 'SN123 456 789' }
];

export const mockTransactionsTresorerie: TransactionTresorerie[] = [
    { id: 'TR_001', date: '2023-10-28', type: 'ENCAISSEMENT', montant: 50000, compteId: 'CPT_CAISSE_CENTRALE', description: 'Vente Boutique #CMD_VTE_233', categorie: 'VENTE' },
    { id: 'TR_002', date: '2023-10-29', type: 'VIREMENT_SORTANT', montant: 100000, compteId: 'CPT_CAISSE_CENTRALE', compteDestinationId: 'CPT_BANQUE_1', description: 'Versement espèce en banque', categorie: 'VIREMENT' },
    { id: 'TR_003', date: '2023-10-29', type: 'VIREMENT_ENTRANT', montant: 100000, compteId: 'CPT_BANQUE_1', description: 'Dépôt espèce venant de Caisse Boutique', categorie: 'VIREMENT' }
];

export const mockGalleryItems: GalleryItem[] = [
    { id: 'IMG_1', title: 'Grand Boubou Bazin Bleu', category: 'Homme', dateAdded: '2023-10-15', imageUrl: 'https://placehold.co/400x600/1e40af/ffffff?text=Boubou+Bleu', tags: ['Bazin', 'Broderie', 'Cérémonie'], description: 'Modèle avec broderie or, col officier.' },
    { id: 'IMG_2', title: 'Robe Soie Soirée', category: 'Femme', dateAdded: '2023-10-20', imageUrl: 'https://placehold.co/400x600/9d174d/ffffff?text=Robe+Soie', tags: ['Soie', 'Rouge', 'Mariage'], description: 'Coupe sirène, manches longues.' },
    { id: 'IMG_3', title: 'Ensemble Lin Décontracté', category: 'Homme', dateAdded: '2023-11-01', imageUrl: 'https://placehold.co/400x600/374151/ffffff?text=Ensemble+Lin', tags: ['Lin', 'Simple', 'Quotidien'], description: 'Tunique courte et pantalon droit.' },
    { id: 'IMG_4', title: 'Inspiration Broderie #42', category: 'Inspiration', dateAdded: '2023-11-02', imageUrl: 'https://placehold.co/400x400/d97706/ffffff?text=Motif+Broderie', tags: ['Motif', 'Géométrique'], description: 'Idée de motif pour prochaine collection.' }
];

export const mockCompanyAssets: CompanyAssets = {
    logoStr: '',
    stampStr: '',
    signatureStr: ''
};