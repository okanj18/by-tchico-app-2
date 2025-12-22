
import React, { useState, useMemo } from 'react';
import { Client, Commande, Employe, RoleEmploye, StatutCommande, Depense, Boutique, Fournisseur, CommandeFournisseur, StatutCommandeFournisseur, StatutPaiement, Article, MouvementStock, TypeMouvement, CompteFinancier, TransactionTresorerie, Pointage, GalleryItem, CompanyAssets, SessionUser } from './types';
import { mockBoutiques, mockEmployes, mockPointages, mockClients, mockCommandes, mockDepenses, mockArticles, mockCommandesFournisseurs, mockMouvements, mockComptes, mockTransactionsTresorerie, mockGalleryItems, mockCompanyAssets, mockFournisseurs } from './services/mockData';
import { useSyncState } from './hooks/useSyncState';
import Sidebar from './components/Sidebar';
import Dashboard from './components/Dashboard';
import SalesView from './components/SalesView';
import ProductionView from './components/ProductionView';
import ArticlesView from './components/ArticlesView';
import StockView from './components/StockView';
import ProcurementView from './components/ProcurementView';
import SuppliersView from './components/SuppliersView';
import HRView from './components/HRView';
import ClientsView from './components/ClientsView';
import FinanceView from './components/FinanceView';
import GalleryView from './components/GalleryView';
import PublicCatalogView from './components/PublicCatalogView';
import SettingsView from './components/SettingsView';
import LoginView from './components/LoginView';
import { Menu } from 'lucide-react';

const App: React.FC = () => {
    const [user, setUser] = useState<SessionUser | null>(null);
    const [currentView, setView] = useState('dashboard');
    const [sidebarOpen, setSidebarOpen] = useState(false);

    // Sync state for all business data
    const [boutiques, setBoutiques] = useSyncState<Boutique[]>(mockBoutiques, 'boutiques');
    const [employes, setEmployes] = useSyncState<Employe[]>(mockEmployes, 'employes');
    const [pointages, setPointages] = useSyncState<Pointage[]>(mockPointages, 'pointages');
    const [clients, setClients] = useSyncState<Client[]>(mockClients, 'clients');
    const [commandes, setCommandes] = useSyncState<Commande[]>(mockCommandes, 'commandes');
    const [depenses, setDepenses] = useSyncState<Depense[]>(mockDepenses, 'depenses');
    const [articles, setArticles] = useSyncState<Article[]>(mockArticles, 'articles');
    const [commandesFournisseurs, setCommandesFournisseurs] = useSyncState<CommandeFournisseur[]>(mockCommandesFournisseurs, 'commandesFournisseurs');
    const [fournisseurs, setFournisseurs] = useSyncState<Fournisseur[]>(mockFournisseurs, 'fournisseurs');
    const [mouvements, setMouvements] = useSyncState<MouvementStock[]>(mockMouvements, 'mouvements');
    const [comptes, setComptes] = useSyncState<CompteFinancier[]>(mockComptes, 'comptes');
    const [transactions, setTransactions] = useSyncState<TransactionTresorerie[]>(mockTransactionsTresorerie, 'transactions');
    const [galleryItems, setGalleryItems] = useSyncState<GalleryItem[]>(mockGalleryItems, 'gallery');
    const [companyAssets, setCompanyAssets] = useSyncState<CompanyAssets>(mockCompanyAssets, 'assets');

    // Handlers for data updates
    const handleLogin = (u: SessionUser) => setUser(u);
    const handleLogout = () => setUser(null);

    // Clients handlers
    const handleAddClient = (c: Client) => setClients(prev => [...prev, c]);
    const handleUpdateClient = (c: Client) => setClients(prev => prev.map(cli => cli.id === c.id ? c : cli));
    const handleDeleteClient = (id: string) => {
        if (window.confirm("Êtes-vous sûr de vouloir supprimer définitivement ce client et ses mesures ?")) {
            setClients(prev => prev.filter(c => c.id !== id));
        }
    };

    // Expenses handlers
    const handleAddDepense = (d: Depense) => {
        setDepenses(prev => [...prev, d]);
        if (d.compteId) {
            setComptes(prev => prev.map(c => c.id === d.compteId ? { ...c, solde: c.solde - d.montant } : c));
            const t: TransactionTresorerie = {
                id: `TR_DEP_${Date.now()}`,
                date: d.date,
                type: 'DECAISSEMENT',
                montant: d.montant,
                compteId: d.compteId,
                description: `Dépense: ${d.description}`,
                categorie: d.categorie
            };
            setTransactions(prev => [t, ...prev]);
        }
    };

    const handleDeleteDepense = (id: string) => {
        const dep = depenses.find(d => d.id === id);
        if (dep && dep.compteId) {
            setComptes(prev => prev.map(c => c.id === dep.compteId ? { ...c, solde: c.solde + dep.montant } : c));
        }
        setDepenses(prev => prev.filter(d => d.id !== id));
    };

    const handleUpdateDepense = (updated: Depense) => {
        setDepenses(prev => prev.map(d => d.id === updated.id ? updated : d));
    };

    // Employees handlers
    const handleAddEmploye = (e: Employe) => setEmployes(prev => [...prev, e]);
    const handleUpdateEmploye = (e: Employe) => setEmployes(prev => prev.map(emp => emp.id === e.id ? e : emp));
    const handleDeleteEmploye = (id: string) => setEmployes(prev => prev.map(e => e.id === id ? { ...e, actif: false } : e));

    // Articles & Stock handlers
    const handleAddArticle = (a: Article) => setArticles(prev => [...prev, a]);
    const handleUpdateArticle = (a: Article) => setArticles(prev => prev.map(art => art.id === a.id ? a : art));

    // Stock movements handlers
    const handleAddMouvement = (m: MouvementStock) => {
        setMouvements(prev => [m, ...prev]);
        setArticles(prev => prev.map(art => {
            if (art.id === m.articleId) {
                const newStock = { ...art.stockParLieu };
                if (!newStock[m.lieuId]) newStock[m.lieuId] = {};
                newStock[m.lieuId][m.variante] = (newStock[m.lieuId][m.variante] || 0) + m.quantite;
                
                if (m.type === TypeMouvement.TRANSFERT && m.lieuDestinationId) {
                    if (!newStock[m.lieuDestinationId]) newStock[m.lieuDestinationId] = {};
                    newStock[m.lieuDestinationId][m.variante] = (newStock[m.lieuDestinationId][m.variante] || 0) + Math.abs(m.quantite);
                }
                return { ...art, stockParLieu: newStock };
            }
            return art;
        }));
    };

    // Orders handlers
    const handleUpdateOrder = (o: Commande) => setCommandes(prev => prev.map(cmd => cmd.id === o.id ? o : cmd));
    
    // Finance handlers
    const handleAddTransaction = (t: TransactionTresorerie) => setTransactions(prev => [t, ...prev]);

    const handleClearData = () => {
        if(window.confirm("CETTE ACTION EST IRREVERSIBLE. Voulez-vous vraiment effacer TOUTES les données ?")) {
            setClients([]);
            setCommandes([]);
            setDepenses([]);
            setMouvements([]);
            setTransactions([]);
            setPointages([]);
            alert("Données effacées.");
        }
    };

    // Calculate available views based on user role
    const availableViews = useMemo(() => {
        if (!user) return [];
        const role = user.role;
        if (role === RoleEmploye.ADMIN || role === RoleEmploye.GERANT) {
            return ['dashboard', 'ventes', 'production', 'stock', 'approvisionnement', 'fournisseurs', 'rh', 'clients', 'finance', 'catalogue', 'galerie', 'catalogue-public'];
        }
        if (role === RoleEmploye.VENDEUR) {
            return ['dashboard', 'ventes', 'clients', 'catalogue-public', 'galerie', 'finance'];
        }
        if (role === RoleEmploye.CHEF_ATELIER) {
            return ['dashboard', 'production', 'stock', 'approvisionnement', 'fournisseurs', 'clients', 'galerie'];
        }
        if (role === RoleEmploye.GARDIEN) {
            return ['rh'];
        }
        return ['dashboard', 'galerie'];
    }, [user]);

    if (!user) {
        return <LoginView employes={employes} onLogin={handleLogin} />;
    }

    return (
        <div className="flex h-screen bg-gray-50 overflow-hidden">
            <Sidebar 
                currentView={currentView} 
                setView={setView} 
                isOpen={sidebarOpen} 
                setIsOpen={setSidebarOpen} 
                availableViews={availableViews}
                user={user}
                onLogout={handleLogout}
            />
            
            <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
                <header className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between md:hidden">
                    <button onClick={() => setSidebarOpen(true)} className="p-2 -ml-2 text-gray-600"><Menu size={24} /></button>
                    <h1 className="text-lg font-bold text-brand-900 text-center flex-1">BY TCHICO</h1>
                    <div className="w-10"></div>
                </header>

                <div className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8 custom-scrollbar">
                    {currentView === 'dashboard' && <Dashboard commandes={commandes} employes={employes} depenses={depenses} clients={clients} />}
                    
                    {currentView === 'ventes' && <SalesView 
                        articles={articles} 
                        boutiques={boutiques} 
                        clients={clients} 
                        commandes={commandes} 
                        onMakeSale={(d:any) => {
                            const newCmd: Commande = {
                                id: `CMD_VTE_${Date.now()}`,
                                clientId: d.clientId,
                                clientNom: d.clientName,
                                boutiqueId: d.boutiqueId,
                                description: d.items.map((i:any) => `${i.nom} (${i.variante}) x${i.quantite}`).join(', '),
                                dateCommande: new Date().toISOString(),
                                dateLivraisonPrevue: new Date().toISOString(),
                                statut: StatutCommande.LIVRE,
                                tailleursIds: [],
                                prixTotal: d.total,
                                avance: d.montantRecu,
                                reste: Math.max(0, d.total - d.montantRecu),
                                type: 'PRET_A_PORTER',
                                remise: d.remise,
                                tva: d.tva,
                                tvaRate: d.tvaRate,
                                quantite: d.items.reduce((acc:number, i:any)=>acc+i.quantite, 0),
                                detailsVente: d.items.map((i:any) => ({ nomArticle: i.nom, variante: i.variante, quantite: i.quantite, prixUnitaire: i.prix })),
                                paiements: d.montantRecu > 0 ? [{ id: `P_${Date.now()}`, date: new Date().toISOString(), montant: d.montantRecu, moyenPaiement: d.method }] : []
                            };
                            setCommandes(prev => [newCmd, ...prev]);
                            d.items.forEach((item:any) => {
                                handleAddMouvement({
                                    id: `M_VTE_${Date.now()}_${item.articleId}`,
                                    date: new Date().toISOString(),
                                    articleId: item.articleId,
                                    articleNom: item.nom,
                                    variante: item.variante,
                                    type: TypeMouvement.VENTE,
                                    quantite: -item.quantite,
                                    lieuId: d.boutiqueId,
                                    commentaire: `Vente #${newCmd.id.slice(-6)}`
                                });
                            });
                            if (d.montantRecu > 0 && d.accountId) {
                                const t: TransactionTresorerie = {
                                    id: `TR_VTE_${Date.now()}`,
                                    date: new Date().toISOString(),
                                    type: 'ENCAISSEMENT',
                                    montant: d.montantRecu,
                                    compteId: d.accountId,
                                    description: `Vente #${newCmd.id.slice(-6)}`,
                                    categorie: 'VENTE'
                                };
                                setTransactions(prev => [t, ...prev]);
                                setComptes(prev => prev.map(c => c.id === d.accountId ? { ...c, solde: c.solde + d.montantRecu } : c));
                            }
                        }} 
                        onAddPayment={(id, amt, meth, note, date, acc) => {
                            setCommandes(prev => prev.map(c => {
                                if (c.id === id) {
                                    const newPaid = [...(c.paiements || [])];
                                    newPaid.push({ id: `P_${Date.now()}`, date, montant: amt, moyenPaiement: meth, note });
                                    return { ...c, avance: c.avance + amt, reste: Math.max(0, c.reste - amt), paiements: newPaid };
                                }
                                return c;
                            }));
                            if (acc) {
                                const t: TransactionTresorerie = {
                                    id: `TR_PAY_${Date.now()}`,
                                    date: new Date().toISOString(),
                                    type: 'ENCAISSEMENT',
                                    montant: amt,
                                    compteId: acc,
                                    description: `Encaissement Vente #${id.slice(-6)}`,
                                    categorie: 'VENTE'
                                };
                                setTransactions(prev => [t, ...prev]);
                                setComptes(prev => prev.map(c => c.id === acc ? { ...c, solde: c.solde + amt } : c));
                            }
                        }} 
                        onCancelSale={(id, acc) => {
                            const sale = commandes.find(c => c.id === id);
                            if (!sale) return;
                            setCommandes(prev => prev.map(c => c.id === id ? { ...c, statut: StatutCommande.ANNULE } : c));
                            if (sale.avance > 0 && acc) {
                                const t: TransactionTresorerie = { id: `TR_CAN_${Date.now()}`, date: new Date().toISOString(), type: 'DECAISSEMENT', montant: sale.avance, compteId: acc, description: `Remboursement Annulation Vente #${id.slice(-6)}`, categorie: 'RESTAURATION' };
                                setTransactions(prev => [t, ...prev]);
                                setComptes(prev => prev.map(c => c.id === acc ? { ...c, solde: c.solde - sale.avance } : c));
                            }
                        }} 
                        comptes={comptes} 
                        companyAssets={companyAssets} 
                    />}

                    {currentView === 'production' && <ProductionView 
                        commandes={commandes} 
                        employes={employes} 
                        clients={clients} 
                        articles={articles} 
                        userRole={user.role} 
                        onUpdateStatus={(id, s) => setCommandes(prev => prev.map(c => c.id === id ? { ...c, statut: s } : c))} 
                        onCreateOrder={(o, cons, meth, acc) => {
                            setCommandes(prev => [o, ...prev]);
                            if (o.avance > 0 && acc) {
                                setComptes(prev => prev.map(c => c.id === acc ? { ...c, solde: c.solde + o.avance } : c));
                            }
                        }} 
                        onUpdateOrder={handleUpdateOrder} 
                        onAddPayment={(id, amt, meth, note, date, acc) => {
                             setCommandes(prev => prev.map(c => {
                                if (c.id === id) {
                                    const newPaid = [...(c.paiements || [])];
                                    newPaid.push({ id: `P_${Date.now()}`, date, montant: amt, moyenPaiement: meth, note });
                                    return { ...c, avance: c.avance + amt, reste: Math.max(0, c.reste - amt), paiements: newPaid };
                                }
                                return c;
                            }));
                            if (acc) {
                                setComptes(prev => prev.map(c => c.id === acc ? { ...c, solde: c.solde + amt } : c));
                            }
                        }}
                        onArchiveOrder={(id) => setCommandes(prev => prev.map(c => c.id === id ? { ...c, archived: true } : c))}
                        comptes={comptes}
                        companyAssets={companyAssets}
                    />}

                    {currentView === 'catalogue' && <ArticlesView articles={articles} onAddArticle={handleAddArticle} onUpdateArticle={handleUpdateArticle} />}
                    
                    {currentView === 'stock' && <StockView 
                        articles={articles} 
                        boutiques={boutiques} 
                        mouvements={mouvements} 
                        userRole={user.role} 
                        onAddMouvement={handleAddMouvement} 
                        onAddBoutique={(b) => setBoutiques(prev => [...prev, b])} 
                    />}

                    {currentView === 'approvisionnement' && <ProcurementView 
                        commandesFournisseurs={commandesFournisseurs} 
                        fournisseurs={fournisseurs} 
                        articles={articles} 
                        boutiques={boutiques} 
                        onAddOrder={(o, acc) => {
                            setCommandesFournisseurs(prev => [o, ...prev]);
                            if (o.montantPaye > 0 && acc) {
                                setComptes(prev => prev.map(c => c.id === acc ? { ...c, solde: c.solde - o.montantPaye } : c));
                            }
                        }} 
                        onUpdateOrder={(o) => setCommandesFournisseurs(prev => prev.map(c => c.id === o.id ? o : c))} 
                        onReceiveOrder={(id, lieu, qtys, date) => {
                            const order = commandesFournisseurs.find(c => c.id === id);
                            if (!order) return;
                            const newLignes = order.lignes.map(l => {
                                const rec = qtys[l.id] || 0;
                                if (rec > 0) {
                                    handleAddMouvement({ id: `M_REC_${Date.now()}_${l.articleId}`, date, articleId: l.articleId, articleNom: l.nomArticle, variante: l.variante, type: TypeMouvement.ACHAT, quantite: rec, lieuId: lieu, commentaire: `Réception CF #${id.slice(-6)}` });
                                }
                                return { ...l, quantiteRecue: (l.quantiteRecue || 0) + rec };
                            });
                            const isDone = newLignes.every(l => (l.quantiteRecue || 0) >= l.quantite);
                            setCommandesFournisseurs(prev => prev.map(c => c.id === id ? { ...c, lignes: newLignes, statut: isDone ? StatutCommandeFournisseur.LIVRE : StatutCommandeFournisseur.EN_COURS } : c));
                        }} 
                        onAddPayment={(id, amt, date, acc) => {
                            setCommandesFournisseurs(prev => prev.map(c => {
                                if (c.id === id) {
                                    const newP = [...(c.paiements || [])];
                                    newP.push({ id: `P_${Date.now()}`, date, montant: amt });
                                    const totalPaid = c.montantPaye + amt;
                                    return { ...c, montantPaye: totalPaid, paiements: newP, statutPaiement: totalPaid >= c.montantTotal ? StatutPaiement.PAYE : StatutPaiement.PARTIEL };
                                }
                                return c;
                            }));
                            if (acc) {
                                setComptes(prev => prev.map(c => c.id === acc ? { ...c, solde: c.solde - amt } : c));
                            }
                        }} 
                        onUpdateArticle={handleUpdateArticle} 
                        onArchiveOrder={(id) => setCommandesFournisseurs(prev => prev.map(c => c.id === id ? { ...c, archived: true } : c))} 
                        comptes={comptes} 
                    />}

                    {currentView === 'fournisseurs' && <SuppliersView 
                        fournisseurs={fournisseurs} 
                        commandesFournisseurs={commandesFournisseurs} 
                        onAddFournisseur={(f) => setFournisseurs(prev => [...prev, f])} 
                        onUpdateFournisseur={(f) => setFournisseurs(prev => prev.map(old => old.id === f.id ? f : old))} 
                        onAddPayment={(id, amt, date, acc) => {
                            setCommandesFournisseurs(prev => prev.map(c => {
                                if (c.id === id) {
                                    const newP = [...(c.paiements || [])];
                                    newP.push({ id: `P_${Date.now()}`, date, montant: amt });
                                    const totalPaid = c.montantPaye + amt;
                                    return { ...c, montantPaye: totalPaid, paiements: newP, statutPaiement: totalPaid >= c.montantTotal ? StatutPaiement.PAYE : StatutPaiement.PARTIEL };
                                }
                                return c;
                            }));
                            if (acc) {
                                setComptes(prev => prev.map(c => c.id === acc ? { ...c, solde: c.solde - amt } : c));
                            }
                        }} 
                        comptes={comptes} 
                    />}

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
                        onAddPointage={(p) => setPointages(prev => [...prev, p])} 
                        onUpdatePointage={(p) => setPointages(prev => prev.map(old => old.id === p.id ? p : old))} 
                        currentUser={user} 
                        comptes={comptes} 
                        onUpdateComptes={setComptes} 
                        onAddTransaction={handleAddTransaction} 
                    />}

                    {currentView === 'clients' && <ClientsView 
                        clients={clients} 
                        commandes={commandes} 
                        onAddClient={handleAddClient} 
                        onUpdateClient={handleUpdateClient} 
                        onDeleteClient={handleDeleteClient} 
                    />}

                    {currentView === 'finance' && <FinanceView 
                        depenses={depenses} 
                        commandes={commandes} 
                        boutiques={boutiques} 
                        onAddDepense={handleAddDepense} 
                        onDeleteDepense={handleDeleteDepense} 
                        onUpdateDepense={handleUpdateDepense}
                        userRole={user.role} 
                        userBoutiqueId={user.boutiqueId} 
                        fournisseurs={fournisseurs} 
                        commandesFournisseurs={commandesFournisseurs} 
                        clients={clients} 
                        comptes={comptes} 
                        transactions={transactions} 
                        onUpdateComptes={setComptes} 
                        onAddTransaction={handleAddTransaction} 
                        onUpdateTransaction={(t) => setTransactions(prev => prev.map(old => old.id === t.id ? t : old))}
                        onDeleteTransaction={(id) => setTransactions(prev => prev.filter(t => t.id !== id))}
                    />}

                    {currentView === 'galerie' && <GalleryView 
                        items={galleryItems} 
                        onAddItem={(i) => setGalleryItems(prev => [i, ...prev])} 
                        onDeleteItem={(id) => setGalleryItems(prev => prev.filter(i => i.id !== id))} 
                    />}

                    {currentView === 'catalogue-public' && <PublicCatalogView articles={articles} />}

                    {currentView === 'settings' && <SettingsView 
                        fullData={{ boutiques, employes, pointages, clients, commandes, depenses, articles, commandesFournisseurs, fournisseurs, mouvements, comptes, transactions, galleryItems }} 
                        onRestore={(d) => { if(window.confirm("Restaurer les données ?")) { setClients(d.clients || []); setCommandes(d.commandes || []); setDepenses(d.depenses || []); } }} 
                        onImport={(t, d) => { if(t === 'CLIENTS') setClients(prev => [...prev, ...d]); if(t === 'ARTICLES') setArticles(prev => [...prev, ...d]); }} 
                        onClearData={handleClearData} 
                        companyAssets={companyAssets} 
                        onUpdateAssets={setCompanyAssets} 
                    />}
                </div>
            </main>
        </div>
    );
};

export default App;
