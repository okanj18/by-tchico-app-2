
import React, { useState, useEffect, Suspense } from 'react';
import { Menu, Loader } from 'lucide-react';
import Sidebar from './components/Sidebar';
import { useSyncState } from './hooks/useSyncState';
import { getAuth, onAuthStateChanged } from "firebase/auth";
import app from './services/firebase';

// Lazy Loading des composants
const Dashboard = React.lazy(() => import('./components/Dashboard'));
const SalesView = React.lazy(() => import('./components/SalesView'));
const ProductionView = React.lazy(() => import('./components/ProductionView'));
const ClientsView = React.lazy(() => import('./components/ClientsView'));
const FinanceView = React.lazy(() => import('./components/FinanceView'));
const StockView = React.lazy(() => import('./components/StockView'));
const ArticlesView = React.lazy(() => import('./components/ArticlesView'));
const HRView = React.lazy(() => import('./components/HRView'));
const SuppliersView = React.lazy(() => import('./components/SuppliersView'));
const ProcurementView = React.lazy(() => import('./components/ProcurementView'));
const GalleryView = React.lazy(() => import('./components/GalleryView'));
const SettingsView = React.lazy(() => import('./components/SettingsView'));
const LoginView = React.lazy(() => import('./components/LoginView'));
const PublicCatalogView = React.lazy(() => import('./components/PublicCatalogView'));

import { 
    mockArticles, mockBoutiques, mockClients, mockCommandes, 
    mockCommandesFournisseurs, mockComptes, mockDepenses, 
    mockEmployes, mockFournisseurs, mockGalleryItems, 
    mockMouvements, mockPointages, mockTransactionsTresorerie,
    mockCompanyAssets
} from './services/mockData';

import { 
    Article, Boutique, Client, Commande, CommandeFournisseur, 
    CompteFinancier, Depense, Employe, Fournisseur, GalleryItem, 
    MouvementStock, Pointage, RoleEmploye, SessionUser, 
    StatutCommande, StatutCommandeFournisseur, TransactionTresorerie, ModePaiement,
    TypeMouvement, StatutPaiement, CompanyAssets
} from './types';

const App: React.FC = () => {
    const [currentView, setCurrentView] = useState('dashboard');
    const [user, setUser] = useState<SessionUser | null>(null);
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const [authLoading, setAuthLoading] = useState(true);

    // --- DATA STATES (CLOUD SYNCED) ---
    const [articles, setArticles] = useSyncState<Article[]>(mockArticles, 'articles');
    const [boutiques, setBoutiques] = useSyncState<Boutique[]>(mockBoutiques, 'boutiques');
    const [clients, setClients] = useSyncState<Client[]>(mockClients, 'clients');
    const [commandes, setCommandes] = useSyncState<Commande[]>(mockCommandes, 'commandes');
    const [commandesFournisseurs, setCommandesFournisseurs] = useSyncState<CommandeFournisseur[]>(mockCommandesFournisseurs, 'commandesFournisseurs');
    const [comptes, setComptes] = useSyncState<CompteFinancier[]>(mockComptes, 'comptes');
    const [depenses, setDepenses] = useSyncState<Depense[]>(mockDepenses, 'depenses');
    const [employes, setEmployes] = useSyncState<Employe[]>(mockEmployes, 'employes');
    const [fournisseurs, setFournisseurs] = useSyncState<Fournisseur[]>(mockFournisseurs, 'fournisseurs');
    const [galleryItems, setGalleryItems] = useSyncState<GalleryItem[]>(mockGalleryItems, 'galleryItems');
    const [mouvements, setMouvements] = useSyncState<MouvementStock[]>(mockMouvements, 'mouvements');
    const [pointages, setPointages] = useSyncState<Pointage[]>(mockPointages, 'pointages');
    const [transactions, setTransactions] = useSyncState<TransactionTresorerie[]>(mockTransactionsTresorerie, 'transactions');
    const [companyAssets, setCompanyAssets] = useSyncState<CompanyAssets>(mockCompanyAssets, 'companyAssets');

    // --- GESTION AUTHENTIFICATION ---
    useEffect(() => {
        if (!app) {
            setAuthLoading(false);
            return;
        }

        const auth = getAuth(app);
        const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
            if (firebaseUser) {
                const email = firebaseUser.email || '';
                let role = RoleEmploye.STAGIAIRE;
                let boutiqueId = undefined;
                let nom = firebaseUser.displayName || "Utilisateur";

                // Fallback roles
                if (email.includes('admin')) { role = RoleEmploye.ADMIN; nom = "Administrateur"; }
                else if (email.includes('gerant')) { role = RoleEmploye.GERANT; nom = "Gérant"; }
                else if (email.includes('atelier')) { role = RoleEmploye.CHEF_ATELIER; nom = "Chef Atelier"; boutiqueId = 'ATELIER'; }
                else if (email.includes('vendeur')) { role = RoleEmploye.VENDEUR; nom = "Vendeur Boutique"; boutiqueId = 'B1'; }
                
                setUser({
                    id: firebaseUser.uid,
                    nom: nom,
                    role: role,
                    boutiqueId: boutiqueId,
                    email: email
                });
            } else {
                setUser(null);
            }
            setAuthLoading(false);
        });
        return () => unsubscribe();
    }, []);

    // Sync User Role
    useEffect(() => {
        if (user && user.email && employes.length > 0) {
            const dbEmployee = employes.find(e => e.email && e.email.toLowerCase() === user.email?.toLowerCase());
            if (dbEmployee) {
                if (dbEmployee.role !== user.role || dbEmployee.boutiqueId !== user.boutiqueId) {
                    setUser(prev => prev ? {
                        ...prev,
                        role: dbEmployee.role,
                        nom: dbEmployee.nom,
                        boutiqueId: dbEmployee.boutiqueId
                    } : null);
                }
            }
        }
    }, [employes, user?.email]);

    const handleLogin = (u: SessionUser) => {
        setUser(u);
        setCurrentView('dashboard');
    };

    const handleLogout = () => {
        if (app) {
            const auth = getAuth(app);
            auth.signOut().then(() => {
                setUser(null);
                setCurrentView('dashboard');
            });
        } else {
            setUser(null);
            setCurrentView('dashboard');
        }
    };

    // --- HANDLERS METIERS ---

    const handleMakeSale = (saleData: any) => {
        const newOrder: Commande = {
            id: `CMD_VTE_${Date.now()}`,
            clientId: saleData.clientId || `C_PASSAGE_${Date.now()}`,
            clientNom: saleData.clientName,
            boutiqueId: saleData.boutiqueId,
            description: `Vente Boutique: ${saleData.items.map((i:any) => i.nom).join(', ')}`,
            dateCommande: new Date().toISOString(),
            dateLivraisonPrevue: new Date().toISOString(),
            statut: StatutCommande.LIVRE,
            tailleursIds: [],
            prixTotal: saleData.total,
            avance: saleData.montantRecu,
            reste: Math.max(0, saleData.total - saleData.montantRecu),
            type: 'PRET_A_PORTER',
            tva: saleData.tva,
            tvaRate: saleData.tvaRate,
            remise: saleData.remise,
            detailsVente: saleData.items.map((i:any) => ({
                nomArticle: i.nom,
                variante: i.variante,
                quantite: i.quantite,
                prixUnitaire: i.prix
            })),
            paiements: saleData.montantRecu > 0 ? [{
                id: `PAY_${Date.now()}`,
                date: new Date().toISOString(),
                montant: saleData.montantRecu,
                moyenPaiement: saleData.method,
                note: 'Paiement comptant'
            }] : []
        };

        setCommandes(prev => [newOrder, ...prev]);

        // Mises à jour stocks
        const updatedArticles = [...articles];
        const newMouvements = [...mouvements];

        saleData.items.forEach((item: any) => {
            const article = updatedArticles.find(a => a.id === item.articleId);
            if (article) {
                if (!article.stockParLieu[saleData.boutiqueId]) article.stockParLieu[saleData.boutiqueId] = {};
                const currentStock = article.stockParLieu[saleData.boutiqueId][item.variante] || 0;
                article.stockParLieu[saleData.boutiqueId][item.variante] = Math.max(0, currentStock - item.quantite);
                
                newMouvements.push({
                    id: `MVT_${Date.now()}_${item.articleId}`,
                    date: new Date().toISOString(),
                    articleId: item.articleId,
                    articleNom: item.nom,
                    variante: item.variante,
                    type: TypeMouvement.VENTE,
                    quantite: -item.quantite,
                    lieuId: saleData.boutiqueId,
                    commentaire: `Vente ${newOrder.id}`
                });
            }
        });
        setArticles(updatedArticles);
        setMouvements(newMouvements);

        // Transaction financière
        if (saleData.montantRecu > 0 && saleData.accountId) {
            const transaction: TransactionTresorerie = {
                id: `TR_${Date.now()}`,
                date: new Date().toISOString(),
                type: 'ENCAISSEMENT',
                montant: saleData.montantRecu,
                compteId: saleData.accountId,
                description: `Vente ${newOrder.id}`,
                categorie: 'VENTE'
            };
            setTransactions(prev => [transaction, ...prev]);
            setComptes(prev => prev.map(c => c.id === saleData.accountId ? { ...c, solde: c.solde + saleData.montantRecu } : c));
        }
    };

    const handleAddPayment = (orderId: string, amount: number, method: ModePaiement, note: string, date: string, accountId?: string) => {
        setCommandes(prev => prev.map(c => {
            if (c.id === orderId) {
                const newAvance = c.avance + amount;
                const newReste = Math.max(0, c.prixTotal - newAvance);
                return {
                    ...c,
                    avance: newAvance,
                    reste: newReste,
                    paiements: [...(c.paiements || []), {
                        id: `PAY_${Date.now()}`,
                        date: date,
                        montant: amount,
                        moyenPaiement: method,
                        note: note
                    }]
                };
            }
            return c;
        }));

        if (accountId) {
            const transaction: TransactionTresorerie = {
                id: `TR_${Date.now()}`,
                date: date,
                type: 'ENCAISSEMENT',
                montant: amount,
                compteId: accountId,
                description: `Paiement ${orderId}: ${note}`,
                categorie: 'VENTE'
            };
            setTransactions(prev => [transaction, ...prev]);
            setComptes(prev => prev.map(c => c.id === accountId ? { ...c, solde: c.solde + amount } : c));
        }
    };

    const handleCancelSale = (orderId: string, refundAccountId: string) => {
        const order = commandes.find(c => c.id === orderId);
        if (!order) return;

        setCommandes(prev => prev.map(c => c.id === orderId ? { ...c, statut: StatutCommande.ANNULE, cancelledBy: user?.nom, cancelledAt: new Date().toISOString() } : c));

        if (order.type === 'PRET_A_PORTER' && order.detailsVente) {
            const updatedArticles = [...articles];
            const newMouvements = [...mouvements];
            
            order.detailsVente.forEach(item => {
                const art = updatedArticles.find(a => a.nom === item.nomArticle);
                if (art && order.boutiqueId) {
                    if (!art.stockParLieu[order.boutiqueId]) art.stockParLieu[order.boutiqueId] = {};
                    art.stockParLieu[order.boutiqueId][item.variante] = (art.stockParLieu[order.boutiqueId][item.variante] || 0) + item.quantite;
                    
                    newMouvements.push({
                        id: `MVT_CANCEL_${Date.now()}`,
                        date: new Date().toISOString(),
                        articleId: art.id,
                        articleNom: art.nom,
                        variante: item.variante,
                        type: TypeMouvement.AJUSTEMENT,
                        quantite: item.quantite,
                        lieuId: order.boutiqueId,
                        commentaire: `Annulation Vente ${order.id}`
                    });
                }
            });
            setArticles(updatedArticles);
            setMouvements(newMouvements);
        }

        if (order.avance > 0 && refundAccountId) {
            const transaction: TransactionTresorerie = {
                id: `TR_REFUND_${Date.now()}`,
                date: new Date().toISOString(),
                type: 'DECAISSEMENT',
                montant: order.avance,
                compteId: refundAccountId,
                description: `Remboursement Annulation ${order.id}`,
                categorie: 'REMBOURSEMENT'
            };
            setTransactions(prev => [transaction, ...prev]);
            setComptes(prev => prev.map(c => c.id === refundAccountId ? { ...c, solde: c.solde - order.avance } : c));
        }
    };

    const handleCreateOrder = (order: Commande, consommations: any[], paymentMethod?: ModePaiement, accountId?: string) => {
        setCommandes(prev => [order, ...prev]);
        
        if (consommations.length > 0) {
            const updatedArticles = [...articles];
            const newMouvements = [...mouvements];
            consommations.forEach(c => {
                const article = updatedArticles.find(a => a.id === c.articleId);
                if (article) {
                    const lieu = 'ATELIER';
                    if (!article.stockParLieu[lieu]) article.stockParLieu[lieu] = {};
                    const current = article.stockParLieu[lieu][c.variante] || 0;
                    article.stockParLieu[lieu][c.variante] = Math.max(0, current - c.quantite);

                    newMouvements.push({
                        id: `MVT_PROD_${Date.now()}_${c.articleId}`,
                        date: new Date().toISOString(),
                        articleId: c.articleId,
                        articleNom: article.nom,
                        variante: c.variante,
                        type: TypeMouvement.CONSOMMATION,
                        quantite: -c.quantite,
                        lieuId: lieu,
                        commentaire: `Production ${order.id}`
                    });
                }
            });
            setArticles(updatedArticles);
            setMouvements(newMouvements);
        }

        if (order.avance > 0 && accountId) {
            const transaction: TransactionTresorerie = {
                id: `TR_${Date.now()}`,
                date: new Date().toISOString(),
                type: 'ENCAISSEMENT',
                montant: order.avance,
                compteId: accountId,
                description: `Avance Commande ${order.id}`,
                categorie: 'VENTE'
            };
            setTransactions(prev => [transaction, ...prev]);
            setComptes(prev => prev.map(c => c.id === accountId ? { ...c, solde: c.solde + order.avance } : c));
        }
    };

    const handleUpdateOrder = (order: Commande, accountId?: string, paymentMethod?: ModePaiement) => {
        const oldOrder = commandes.find(c => c.id === order.id);
        
        if (oldOrder && order.avance !== oldOrder.avance && accountId) {
            const diff = order.avance - oldOrder.avance;
            if (diff !== 0) {
                 const transaction: TransactionTresorerie = {
                    id: `TR_UPDATE_${Date.now()}`,
                    date: new Date().toISOString(),
                    type: diff > 0 ? 'ENCAISSEMENT' : 'DECAISSEMENT',
                    montant: Math.abs(diff),
                    compteId: accountId,
                    description: `Ajustement Avance ${order.id}`,
                    categorie: 'AJUSTEMENT'
                };
                setTransactions(prev => [transaction, ...prev]);
                setComptes(prev => prev.map(c => c.id === accountId ? { ...c, solde: c.solde + diff } : c));
                
                if (diff > 0) {
                    order.paiements = [...(order.paiements || []), {
                        id: `PAY_ADJ_${Date.now()}`,
                        date: new Date().toISOString(),
                        montant: diff,
                        moyenPaiement: paymentMethod || 'ESPECE',
                        note: 'Ajustement modification commande'
                    }];
                }
            }
        }
        setCommandes(prev => prev.map(c => c.id === order.id ? order : c));
    };

    const handleUpdateStatus = (id: string, status: StatutCommande) => {
        setCommandes(prev => prev.map(c => c.id === id ? { ...c, statut: status } : c));
    };

    const handleArchiveOrder = (id: string) => {
        setCommandes(prev => prev.map(c => c.id === id ? { ...c, archived: true } : c));
    };

    const handleAddClient = (c: Client) => setClients(prev => [...prev, c]);
    const handleUpdateClient = (c: Client) => setClients(prev => prev.map(cli => cli.id === c.id ? c : cli));

    const handleAddDepense = (d: Depense) => {
        setDepenses(prev => [d, ...prev]);
        if (d.compteId) {
            const transaction: TransactionTresorerie = {
                id: `TR_DEP_${Date.now()}`,
                date: d.date,
                type: 'DECAISSEMENT',
                montant: d.montant,
                compteId: d.compteId,
                description: d.description,
                categorie: 'DEPENSE'
            };
            setTransactions(prev => [transaction, ...prev]);
            setComptes(prev => prev.map(c => c.id === d.compteId ? { ...c, solde: c.solde - d.montant } : c));
        }
    };

    const handleDeleteDepense = (id: string) => setDepenses(prev => prev.filter(d => d.id !== id));
    const handleUpdateDepense = (d: Depense) => setDepenses(prev => prev.map(dep => dep.id === d.id ? d : dep));

    const handleAddSupplierOrder = (order: CommandeFournisseur, accountId?: string) => {
        setCommandesFournisseurs(prev => [order, ...prev]);
        if (order.montantPaye > 0 && accountId) {
            const transaction: TransactionTresorerie = {
                id: `TR_SUP_PAY_${Date.now()}`,
                date: order.dateCommande,
                type: 'DECAISSEMENT',
                montant: order.montantPaye,
                compteId: accountId,
                description: `Acompte Fournisseur ${order.id}`,
                categorie: 'ACHAT'
            };
            setTransactions(prev => [transaction, ...prev]);
            setComptes(prev => prev.map(c => c.id === accountId ? { ...c, solde: c.solde - order.montantPaye } : c));
            
             if (!order.paiements || order.paiements.length === 0) {
                 order.paiements = [{
                     id: `PAY_SUP_${Date.now()}`,
                     date: order.dateCommande,
                     montant: order.montantPaye,
                     note: 'Acompte à la commande'
                 }];
             }
        }
    };

    const handleUpdateSupplierOrder = (order: CommandeFournisseur) => setCommandesFournisseurs(prev => prev.map(c => c.id === order.id ? order : c));

    const handleAddSupplierPayment = (orderId: string, amount: number, date: string, accountId?: string) => {
        setCommandesFournisseurs(prev => prev.map(c => {
            if (c.id === orderId) {
                const newPaid = c.montantPaye + amount;
                return {
                    ...c,
                    montantPaye: newPaid,
                    statutPaiement: newPaid >= c.montantTotal ? StatutPaiement.PAYE : StatutPaiement.PARTIEL,
                    paiements: [...(c.paiements || []), {
                        id: `PAY_SUP_${Date.now()}`,
                        date: date,
                        montant: amount
                    }]
                };
            }
            return c;
        }));

        if (accountId) {
            const transaction: TransactionTresorerie = {
                id: `TR_SUP_PAY_${Date.now()}`,
                date: date,
                type: 'DECAISSEMENT',
                montant: amount,
                compteId: accountId,
                description: `Paiement Fournisseur ${orderId}`,
                categorie: 'ACHAT'
            };
            setTransactions(prev => [transaction, ...prev]);
            setComptes(prev => prev.map(c => c.id === accountId ? { ...c, solde: c.solde - amount } : c));
        }
    };

    const handleDeleteSupplierPayment = (orderId: string, paymentId: string) => {
        const order = commandesFournisseurs.find(c => c.id === orderId);
        if (!order || !order.paiements) return;

        const paymentToDelete = order.paiements.find(p => p.id === paymentId);
        if (!paymentToDelete) return;

        const newPaid = Math.max(0, order.montantPaye - paymentToDelete.montant);
        const updatedOrder = {
            ...order,
            montantPaye: newPaid,
            statutPaiement: newPaid >= order.montantTotal ? ('PAYE' as any) : (newPaid > 0 ? 'PARTIEL' as any : 'NON_PAYE' as any),
            paiements: order.paiements.filter(p => p.id !== paymentId)
        };

        setCommandesFournisseurs(prev => prev.map(c => c.id === orderId ? updatedOrder : c));
    };

    const handleUpdateSupplierPayment = (orderId: string, paymentId: string, updatedPayment: { montant: number, date: string, note?: string }) => {
        setCommandesFournisseurs(prev => prev.map(c => {
            if (c.id === orderId) {
                const oldPayment = c.paiements?.find(p => p.id === paymentId);
                if (!oldPayment) return c;
                const diff = updatedPayment.montant - oldPayment.montant;
                const newPaid = Math.max(0, c.montantPaye + diff);
                const updatedPaiements = c.paiements?.map(p => 
                    p.id === paymentId ? { ...p, ...updatedPayment } : p
                );
                return {
                    ...c,
                    montantPaye: newPaid,
                    statutPaiement: newPaid >= c.montantTotal ? ('PAYE' as any) : (newPaid > 0 ? 'PARTIEL' as any : 'NON_PAYE' as any),
                    paiements: updatedPaiements
                };
            }
            return c;
        }));
    };

    const handleArchiveSupplierOrder = (id: string) => setCommandesFournisseurs(prev => prev.map(c => c.id === id ? { ...c, archived: true } : c));

    const handleReceiveOrder = (id: string, lieuId: string, quantities: Record<string, number>, date: string) => {
        setCommandesFournisseurs(prev => prev.map(c => {
            if (c.id === id) {
                const updatedLines = c.lignes.map(l => ({ ...l, quantiteRecue: (l.quantiteRecue || 0) + (quantities[l.id] || 0) }));
                const allDelivered = updatedLines.every(l => l.quantiteRecue >= l.quantite);
                const updatedArticles = [...articles];
                updatedLines.forEach(l => {
                    const qty = quantities[l.id] || 0;
                    if (qty > 0) {
                        const article = updatedArticles.find(a => a.id === l.articleId);
                        if (article) {
                            if (!article.stockParLieu[lieuId]) article.stockParLieu[lieuId] = {};
                            article.stockParLieu[lieuId][l.variante] = (article.stockParLieu[lieuId][l.variante] || 0) + qty;
                            setMouvements(oldM => [{
                                id: `MVT_RCP_${Date.now()}_${l.id}`,
                                date: date,
                                articleId: l.articleId,
                                articleNom: l.nomArticle,
                                variante: l.variante,
                                type: 'ACHAT',
                                quantite: qty,
                                lieuId: lieuId,
                                commentaire: `Réception CF ${c.id}`
                            }, ...oldM]);
                        }
                    }
                });
                setArticles(updatedArticles);
                return {
                    ...c,
                    lignes: updatedLines,
                    statut: allDelivered ? StatutCommandeFournisseur.LIVRE : StatutCommandeFournisseur.EN_COURS,
                    receptions: [...(c.receptions || []), {
                        id: `RCP_${Date.now()}`,
                        date: date,
                        lieuId: lieuId,
                        details: updatedLines.map(l => ({ nomArticle: l.nomArticle, variante: l.variante, quantiteRecue: quantities[l.id] || 0 })).filter(d => d.quantiteRecue > 0)
                    }]
                };
            }
            return c;
        }));
    };

    const handleAddArticle = (a: Article) => setArticles(prev => [a, ...prev]);
    const handleUpdateArticle = (a: Article) => setArticles(prev => prev.map(art => art.id === a.id ? a : art));
    
    const handleAddMouvement = (m: MouvementStock) => {
        setMouvements(prev => [m, ...prev]);
        const updatedArticles = [...articles];
        const article = updatedArticles.find(a => a.id === m.articleId);
        if (article) {
            if (m.lieuId) {
                if (!article.stockParLieu[m.lieuId]) article.stockParLieu[m.lieuId] = {};
                article.stockParLieu[m.lieuId][m.variante] = (article.stockParLieu[m.lieuId][m.variante] || 0) + m.quantite;
            }
            if (m.lieuDestinationId) {
                if (!article.stockParLieu[m.lieuDestinationId]) article.stockParLieu[m.lieuDestinationId] = {};
                article.stockParLieu[m.lieuDestinationId][m.variante] = (article.stockParLieu[m.lieuDestinationId][m.variante] || 0) - m.quantite;
            }
            setArticles(updatedArticles);
        }
    };

    const handleAddBoutique = (b: Boutique) => setBoutiques(prev => [...prev, b]);
    const handleAddEmploye = (e: Employe) => setEmployes(prev => [e, ...prev]);
    const handleUpdateEmploye = (e: Employe) => setEmployes(prev => prev.map(emp => emp.id === e.id ? e : emp));
    const handleDeleteEmploye = (id: string) => setEmployes(prev => prev.map(e => e.id === id ? { ...e, actif: false } : e));
    const handleAddPointage = (p: Pointage) => setPointages(prev => [p, ...prev]);
    const handleUpdatePointage = (p: Pointage) => setPointages(prev => prev.map(pt => pt.id === p.id ? p : pt));
    const handleAddGalleryItem = (i: GalleryItem) => setGalleryItems(prev => [i, ...prev]);
    const handleDeleteGalleryItem = (id: string) => setGalleryItems(prev => prev.filter(i => i.id !== id));

    const handleDeleteTransaction = (id: string) => {
        const transaction = transactions.find(t => t.id === id);
        if (!transaction) return;

        const updatedComptes = comptes.map(c => {
            if (c.id === transaction.compteId) {
                const newSolde = transaction.type === 'ENCAISSEMENT' 
                    ? c.solde - transaction.montant 
                    : transaction.type === 'DECAISSEMENT' 
                        ? c.solde + transaction.montant 
                        : c.solde; 
                return { ...c, solde: newSolde };
            }
            return c;
        });

        setComptes(updatedComptes);
        setTransactions(prev => prev.filter(t => t.id !== id));
    };

    const handleUpdateTransaction = (updatedTransaction: TransactionTresorerie) => {
        const oldTransaction = transactions.find(t => t.id === updatedTransaction.id);
        if (!oldTransaction) return;

        let tempComptes = [...comptes];
        
        const oldAccountIndex = tempComptes.findIndex(c => c.id === oldTransaction.compteId);
        if (oldAccountIndex > -1) {
            if (oldTransaction.type === 'ENCAISSEMENT') tempComptes[oldAccountIndex].solde -= oldTransaction.montant;
            else if (oldTransaction.type === 'DECAISSEMENT') tempComptes[oldAccountIndex].solde += oldTransaction.montant;
        }

        const newAccountIndex = tempComptes.findIndex(c => c.id === updatedTransaction.compteId);
        if (newAccountIndex > -1) {
            if (updatedTransaction.type === 'ENCAISSEMENT') tempComptes[newAccountIndex].solde += updatedTransaction.montant;
            else if (updatedTransaction.type === 'DECAISSEMENT') tempComptes[newAccountIndex].solde -= updatedTransaction.montant;
        }

        setComptes(tempComptes);
        setTransactions(prev => prev.map(t => t.id === updatedTransaction.id ? updatedTransaction : t));
    };

    const handleRestore = (data: any) => {
        if (window.confirm("Restaurer ces données écrasera vos données actuelles. Continuer ?")) {
            if (data.articles) setArticles(data.articles);
            if (data.clients) setClients(data.clients);
            if (data.commandes) setCommandes(data.commandes);
            if (data.employes) setEmployes(data.employes);
            if (data.depenses) setDepenses(data.depenses);
            if (data.boutiques) setBoutiques(data.boutiques);
            if (data.comptes) setComptes(data.comptes);
            if (data.transactions) setTransactions(data.transactions);
            if (data.pointages) setPointages(data.pointages);
            if (data.fournisseurs) setFournisseurs(data.fournisseurs);
            if (data.commandesFournisseurs) setCommandesFournisseurs(data.commandesFournisseurs);
            if (data.galleryItems) setGalleryItems(data.galleryItems);
            if (data.companyAssets) setCompanyAssets(data.companyAssets); // Restore assets
            alert('Données restaurées avec succès.');
        }
    };

    const handleClearAllData = () => {
        if (window.confirm("⚠️ ATTENTION : Vous allez effacer TOUTES les données pour repartir à zéro. Cette action est irréversible. Continuer ?")) {
            setArticles([]);
            setBoutiques([{ id: 'ATELIER', nom: 'Atelier Central', lieu: 'Siège' }]);
            setClients([]);
            setCommandes([]);
            setCommandesFournisseurs([]);
            setComptes([{ id: 'CPT_CAISSE_CENTRALE', nom: 'Caisse Centrale', type: 'CAISSE', solde: 0, boutiqueId: 'ATELIER' }]);
            setDepenses([]);
            setEmployes([]);
            setFournisseurs([]);
            setGalleryItems([]);
            setMouvements([]);
            setPointages([]);
            setTransactions([]);
            setCompanyAssets({ logoStr: '', stampStr: '', signatureStr: '' }); // Reset assets
            alert("Données réinitialisées.");
        }
    };

    const handleImport = (type: 'CLIENTS' | 'ARTICLES', data: any[]) => {
        if (type === 'CLIENTS') setClients(prev => [...prev, ...data]);
        if (type === 'ARTICLES') setArticles(prev => [...prev, ...data]);
    };

    const fullData = {
        articles, boutiques, clients, commandes, commandesFournisseurs, 
        comptes, depenses, employes, fournisseurs, galleryItems, 
        mouvements, pointages, transactions, companyAssets
    };

    // --- RENDER ---

    if (authLoading) {
        return (
            <div className="flex items-center justify-center h-screen bg-gray-900 text-white">
                <Loader className="animate-spin text-brand-500 mr-2" /> Chargement sécurisé...
            </div>
        );
    }

    if (!user && currentView !== 'catalogue-public') {
        return (
            <Suspense fallback={<div className="flex items-center justify-center h-screen bg-gray-50"><Loader className="animate-spin text-brand-600" size={32} /></div>}>
                <LoginView employes={employes} onLogin={handleLogin} />
                <div className="fixed bottom-4 right-4">
                    <button 
                        onClick={() => setCurrentView('catalogue-public')} 
                        className="text-xs text-gray-500 hover:text-brand-600 underline"
                    >
                        Accès Catalogue Public
                    </button>
                </div>
            </Suspense>
        );
    }

    if (currentView === 'catalogue-public') {
        return (
            <div className="min-h-screen bg-gray-50 p-6">
                <div className="max-w-7xl mx-auto bg-white rounded-2xl shadow-xl overflow-hidden min-h-[90vh] flex flex-col">
                    <div className="p-4 border-b flex justify-between items-center">
                        <button onClick={() => setCurrentView('dashboard')} className="text-sm text-gray-500 hover:text-gray-800">
                            &larr; Retour Connexion
                        </button>
                    </div>
                    <div className="flex-1 p-6">
                        <Suspense fallback={<div className="flex justify-center p-10"><Loader className="animate-spin" /></div>}>
                            <PublicCatalogView articles={articles} />
                        </Suspense>
                    </div>
                </div>
            </div>
        );
    }

    let availableViews: string[] = [];
    if (user?.role === RoleEmploye.ADMIN || user?.role === RoleEmploye.GERANT) {
        availableViews = ['dashboard', 'ventes', 'production', 'stock', 'rh', 'finance', 'catalogue', 'approvisionnement', 'fournisseurs', 'clients', 'galerie', 'catalogue-public'];
    } else if (user?.role === RoleEmploye.VENDEUR) {
        availableViews = ['ventes', 'dashboard', 'clients', 'stock', 'finance', 'catalogue-public', 'galerie'];
    } else if (user?.role === RoleEmploye.TAILLEUR || user?.role === RoleEmploye.CHEF_ATELIER || user?.role === RoleEmploye.STAGIAIRE) {
        availableViews = ['production', 'stock', 'galerie'];
    } else if (user?.role === RoleEmploye.GARDIEN) {
        availableViews = ['rh'];
    }

    return (
        <div className="flex h-screen bg-gray-100 font-sans text-gray-900 overflow-hidden">
            <Sidebar 
                currentView={currentView}
                setView={setCurrentView}
                isOpen={isSidebarOpen}
                setIsOpen={setIsSidebarOpen}
                availableViews={availableViews}
                user={user}
                onLogout={handleLogout}
            />

            <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
                <div className="md:hidden bg-white p-4 flex justify-between items-center shadow-sm z-20">
                    <button onClick={() => setIsSidebarOpen(true)} className="p-2 -ml-2 text-gray-600">
                        <Menu size={24} />
                    </button>
                    <span className="font-bold text-lg text-brand-800">BY TCHICO</span>
                    <div className="w-8"></div>
                </div>

                <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
                    <Suspense fallback={
                        <div className="flex flex-col items-center justify-center h-full text-gray-400">
                            <Loader className="animate-spin mb-2" size={32} />
                            <p className="text-sm">Chargement du module...</p>
                        </div>
                    }>
                        {currentView === 'dashboard' && <Dashboard commandes={commandes} employes={employes} depenses={depenses} clients={clients} />}
                        {currentView === 'ventes' && <SalesView articles={articles} boutiques={boutiques} clients={clients} commandes={commandes} onMakeSale={handleMakeSale} onAddPayment={handleAddPayment} comptes={comptes} onCancelSale={handleCancelSale} companyAssets={companyAssets} />}
                        {currentView === 'production' && <ProductionView commandes={commandes} employes={employes} clients={clients} articles={articles} userRole={user?.role || RoleEmploye.STAGIAIRE} onUpdateStatus={handleUpdateStatus} onCreateOrder={handleCreateOrder} onUpdateOrder={handleUpdateOrder} onAddPayment={handleAddPayment} onArchiveOrder={handleArchiveOrder} comptes={comptes} companyAssets={companyAssets} />}
                        {currentView === 'clients' && <ClientsView clients={clients} commandes={commandes} onAddClient={handleAddClient} onUpdateClient={handleUpdateClient} />}
                        {currentView === 'finance' && <FinanceView depenses={depenses} commandes={commandes} boutiques={boutiques} onAddDepense={handleAddDepense} onDeleteDepense={handleDeleteDepense} onUpdateDepense={handleUpdateDepense} userRole={user?.role || RoleEmploye.STAGIAIRE} userBoutiqueId={user?.boutiqueId} fournisseurs={fournisseurs} commandesFournisseurs={commandesFournisseurs} clients={clients} comptes={comptes} transactions={transactions} onUpdateComptes={setComptes} onAddTransaction={t => setTransactions(prev => [t, ...prev])} onUpdateTransaction={handleUpdateTransaction} onDeleteTransaction={handleDeleteTransaction} />}
                        {currentView === 'stock' && <StockView articles={articles} boutiques={boutiques} mouvements={mouvements} userRole={user?.role || RoleEmploye.STAGIAIRE} onAddMouvement={handleAddMouvement} onAddBoutique={handleAddBoutique} />}
                        {currentView === 'catalogue' && <ArticlesView articles={articles} onAddArticle={handleAddArticle} onUpdateArticle={handleUpdateArticle} />}
                        {currentView === 'rh' && <HRView 
                            employes={employes} 
                            boutiques={boutiques} 
                            onAddEmploye={handleAddEmploye} 
                            onUpdateEmploye={handleUpdateEmploye} 
                            onDeleteEmploye={handleDeleteEmploye} 
                            onAddDepense={handleAddDepense} 
                            depenses={depenses}
                            onDeleteDepense={handleDeleteDepense}
                            onUpdateDepense={handleUpdateDepense}
                            pointages={pointages} 
                            onAddPointage={handleAddPointage} 
                            onUpdatePointage={handleUpdatePointage} 
                            currentUser={user} 
                            comptes={comptes} 
                            onUpdateComptes={setComptes} 
                            onAddTransaction={t => setTransactions(prev => [t, ...prev])} 
                        />}
                        {currentView === 'fournisseurs' && <SuppliersView fournisseurs={fournisseurs} commandesFournisseurs={commandesFournisseurs} onAddFournisseur={f => setFournisseurs(prev => [f, ...prev])} onUpdateFournisseur={f => setFournisseurs(prev => prev.map(fr => fr.id === f.id ? f : fr))} onAddPayment={handleAddSupplierPayment} comptes={comptes} />}
                        {currentView === 'approvisionnement' && <ProcurementView commandesFournisseurs={commandesFournisseurs} fournisseurs={fournisseurs} articles={articles} boutiques={boutiques} onAddOrder={handleAddSupplierOrder} onUpdateOrder={handleUpdateSupplierOrder} onReceiveOrder={handleReceiveOrder} onAddPayment={handleAddSupplierPayment} onUpdateArticle={handleUpdateArticle} onArchiveOrder={handleArchiveSupplierOrder} onDeletePayment={handleDeleteSupplierPayment} onUpdatePayment={handleUpdateSupplierPayment} comptes={comptes} />}
                        {currentView === 'galerie' && <GalleryView items={galleryItems} onAddItem={handleAddGalleryItem} onDeleteItem={handleDeleteGalleryItem} />}
                        {currentView === 'settings' && <SettingsView fullData={fullData} onRestore={handleRestore} onImport={handleImport} onClearData={handleClearAllData} companyAssets={companyAssets} onUpdateAssets={setCompanyAssets} />}
                    </Suspense>
                </main>
            </div>
        </div>
    );
};

export default App;
