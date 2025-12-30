
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

    const handleLogin = (u: SessionUser) => {
        setUser(u);
        if (u.role === RoleEmploye.GARDIEN) setView('rh');
        else setView('dashboard');
    };
    
    const handleLogout = () => setUser(null);

    const handleAddEmploye = (e: Employe) => setEmployes(prev => [...prev, e]);
    const handleUpdateEmploye = (e: Employe) => setEmployes(prev => prev.map(emp => emp.id === e.id ? e : emp));
    const handleArchiveEmploye = (id: string) => setEmployes(prev => prev.map(e => e.id === id ? { ...e, actif: !e.actif } : e));
    const handleHardDeleteEmploye = (id: string) => {
        if (window.confirm("ÊTES-VOUS CERTAIN ?\n\nCette action supprimera définitivement l'employé.")) {
            setEmployes(prev => prev.filter(e => e.id !== id));
            setPointages(prev => prev.filter(p => p.employeId !== id));
        }
    };

    const handleAddClient = (c: Client) => setClients(prev => [...prev, c]);
    const handleUpdateClient = (c: Client) => setClients(prev => prev.map(cli => cli.id === c.id ? c : cli));
    
    // Suppression directe sans double confirmation
    const handleDeleteClient = (id: string) => {
        setClients(prev => prev.filter(c => c.id !== id));
    };

    const handleAddDepense = (d: Depense) => {
        setDepenses(prev => [...prev, d]);
        if (d.compteId) {
            setComptes(prev => prev.map(c => c.id === d.compteId ? { ...c, solde: c.solde - d.montant } : c));
            setTransactions(prev => [{
                id: `TR_DEP_${Date.now()}`, date: d.date, type: 'DECAISSEMENT', montant: d.montant,
                compteId: d.compteId!, description: `Dépense: ${d.description}`, categorie: d.categorie
            }, ...prev]);
        }
    };

    const handleDeleteDepense = (id: string) => {
        const dep = depenses.find(d => d.id === id);
        if (dep && dep.compteId) setComptes(prev => prev.map(c => c.id === dep.compteId ? { ...c, solde: c.solde + dep.montant } : c));
        setDepenses(prev => prev.filter(d => d.id !== id));
    };

    const handleUpdateDepense = (updated: Depense) => setDepenses(prev => prev.map(d => d.id === updated.id ? updated : d));
    const handleAddArticle = (a: Article) => setArticles(prev => [...prev, a]);
    const handleUpdateArticle = (a: Article) => setArticles(prev => prev.map(art => art.id === a.id ? a : art));

    const handleAddMouvement = (m: MouvementStock) => {
        setMouvements(prev => [m, ...prev]);
        setArticles(prev => prev.map(art => {
            if (art.id === m.articleId) {
                const newStock = JSON.parse(JSON.stringify(art.stockParLieu));
                if (!newStock[m.lieuId]) newStock[m.lieuId] = {};
                newStock[m.lieuId][m.variante] = (newStock[m.lieuId][m.variante] || 0) + m.quantite;
                return { ...art, stockParLieu: newStock };
            }
            return art;
        }));
    };

    const handleUpdateOrder = (o: Commande) => setCommandes(prev => prev.map(cmd => cmd.id === o.id ? o : cmd));
    const handleAddTransaction = (t: TransactionTresorerie) => setTransactions(prev => [t, ...prev]);

    const handleMakeSale = (d: any) => {
        const saleId = `CMD_VTE_${Date.now()}`;
        const newCmd: Commande = {
            id: saleId, clientId: d.clientId, clientNom: d.clientName, boutiqueId: d.boutiqueId,
            description: d.items.map((i: any) => `${i.nom} x${i.quantite}`).join(', '),
            dateCommande: new Date().toISOString(), dateLivraisonPrevue: new Date().toISOString(),
            statut: StatutCommande.LIVRE, tailleursIds: [], prixTotal: d.total, avance: d.montantRecu,
            reste: Math.max(0, d.total - d.montantRecu), type: 'PRET_A_PORTER',
            quantite: d.items.reduce((acc: number, i: any) => acc + i.quantite, 0),
            detailsVente: d.items.map((i: any) => ({ nomArticle: i.nom, variante: i.variante, quantite: i.quantite, prixUnitaire: i.prix })),
            paiements: d.montantRecu > 0 ? [{ id: `P_${Date.now()}`, date: new Date().toISOString(), montant: d.montantRecu, moyenPaiement: d.method }] : [],
            tva: d.tva, tvaRate: d.tvaRate, remise: d.remise
        };

        setCommandes(prev => [newCmd, ...prev]);

        setArticles(prevArticles => prevArticles.map(art => {
            const itemsToDeduct = d.items.filter((i: any) => i.articleId === art.id);
            if (itemsToDeduct.length === 0) return art;
            const newStock = JSON.parse(JSON.stringify(art.stockParLieu));
            if (!newStock[d.boutiqueId]) newStock[d.boutiqueId] = {};
            itemsToDeduct.forEach((item: any) => {
                const qtyToDeduct = item.quantite;
                newStock[d.boutiqueId][item.variante] = (newStock[d.boutiqueId][item.variante] || 0) - qtyToDeduct;
                const mv: MouvementStock = {
                    id: `M_VTE_${Date.now()}_${item.id}`, date: new Date().toISOString(),
                    articleId: art.id, articleNom: art.nom, variante: item.variante,
                    type: TypeMouvement.VENTE, quantite: -qtyToDeduct, lieuId: d.boutiqueId,
                    commentaire: `Vente directe #${saleId.slice(-6)}`
                };
                setMouvements(prevMv => [mv, ...prevMv]);
            });
            return { ...art, stockParLieu: newStock };
        }));

        if (d.montantRecu > 0 && d.accountId) {
            setTransactions(prev => [{
                id: `TR_VTE_${Date.now()}`, date: new Date().toISOString(), type: 'ENCAISSEMENT',
                montant: d.montantRecu, compteId: d.accountId, description: `Vente #${saleId.slice(-6)}`, categorie: 'VENTE'
            }, ...prev]);
            setComptes(prev => prev.map(c => c.id === d.accountId ? { ...c, solde: c.solde + d.montantRecu } : c));
        }
    };

    const handleAddOrderFournisseur = (order: CommandeFournisseur, accountId?: string) => {
        setCommandesFournisseurs(prev => [order, ...prev]);
        if (accountId && order.montantPaye > 0) {
            setComptes(prev => prev.map(c => c.id === accountId ? { ...c, solde: c.solde - order.montantPaye } : c));
            setTransactions(prev => [{
                id: `TR_CF_${Date.now()}`, date: order.dateCommande, type: 'DECAISSEMENT',
                montant: order.montantPaye, compteId: accountId, description: `Acompte CF #${order.id.slice(-6)}`, categorie: 'MATIERE_PREMIERE'
            }, ...prev]);
        }
    };

    const handleReceiveOrderFournisseur = (id: string, lieuId: string, quantities: Record<string, number>, date: string) => {
        setCommandesFournisseurs(prev => prev.map(order => {
            if (order.id === id) {
                const updatedLignes = order.lignes.map(line => {
                    const received = quantities[line.id] || 0;
                    if (received > 0) {
                        const m: MouvementStock = {
                            id: `M_REC_${Date.now()}_${line.id}`, date: date, articleId: line.articleId,
                            articleNom: line.nomArticle, variante: line.variante, type: TypeMouvement.ACHAT,
                            quantite: received, lieuId: lieuId, commentaire: `Réception CF #${id.slice(-6)}`
                        };
                        handleAddMouvement(m);
                        return { ...line, quantiteRecue: (line.quantiteRecue || 0) + received };
                    }
                    return line;
                });
                const allReceived = updatedLignes.every(l => (l.quantiteRecue || 0) >= l.quantite);
                return { 
                    ...order, lignes: updatedLignes, 
                    statut: allReceived ? StatutCommandeFournisseur.LIVRE : StatutCommandeFournisseur.EN_COURS,
                    receptions: [...(order.receptions || []), {
                        id: `R_${Date.now()}`, date: date, lieuId: lieuId,
                        details: updatedLignes.filter(l => (quantities[l.id] || 0) > 0).map(l => ({
                            nomArticle: l.nomArticle, variante: l.variante, quantiteRecue: quantities[l.id]
                        }))
                    }]
                };
            }
            return order;
        }));
    };

    const handleAddPaymentFournisseur = (orderId: string, amount: number, date: string, accountId?: string) => {
        setCommandesFournisseurs(prev => prev.map(order => {
            if (order.id === orderId) {
                const updatedPaye = order.montantPaye + amount;
                return { ...order, montantPaye: updatedPaye, statutPaiement: updatedPaye >= order.montantTotal ? StatutPaiement.PAYE : StatutPaiement.PARTIEL,
                    paiements: [...(order.paiements || []), { id: `P_F_${Date.now()}`, date, montant: amount }]
                };
            }
            return order;
        }));
        if (accountId) {
            setComptes(prev => prev.map(c => c.id === accountId ? { ...c, solde: c.solde - amount } : c));
            setTransactions(prev => [{
                id: `TR_PAY_F_${Date.now()}`, date: date, type: 'DECAISSEMENT', montant: amount,
                compteId: accountId, description: `Paiement Fourn. #${orderId.slice(-6)}`, categorie: 'MATIERE_PREMIERE'
            }, ...prev]);
        }
    };

    const handleDeleteFournisseur = (id: string) => {
        if (window.confirm("Voulez-vous vraiment supprimer ce fournisseur ? Cela n'effacera pas les commandes passées mais il ne sera plus sélectionnable.")) {
            setFournisseurs(prev => prev.filter(f => f.id !== id));
        }
    };

    const handleClearData = () => {
        if (window.confirm("⚠️ ACTION IRRÉVERSIBLE\n\nSouhaitez-vous vraiment effacer TOUTES les données de l'application ?\n(Ventes, Clients, Stocks, Employés, Logos...)")) {
            // 1. Remise à zéro des états React
            setBoutiques([]); setEmployes([]); setPointages([]); setClients([]); setCommandes([]); 
            setDepenses([]); setArticles([]); setCommandesFournisseurs([]); setFournisseurs([]); 
            setMouvements([]); setComptes([]); setTransactions([]); setGalleryItems([]);
            setCompanyAssets({ logoStr: '', stampStr: '', signatureStr: '' });
            
            // 2. Nettoyage explicite du LocalStorage
            Object.keys(localStorage).forEach(key => {
                if (key.startsWith('by_tchico_')) localStorage.removeItem(key);
            });
            
            alert("✅ L'application a été réinitialisée. Les données de démonstration seront masquées au prochain démarrage.");
            setView('dashboard');
        }
    };

    const handleFullRestore = (d: any) => {
        if (!d || typeof d !== 'object') return;
        if (!window.confirm("⚠️ RESTAURATION TOTALE\n\nCela remplacera TOUTES vos données actuelles par celles du fichier. Continuer ?")) return;

        if (d.boutiques) setBoutiques(d.boutiques);
        if (d.employes) setEmployes(d.employes);
        if (d.pointages) setPointages(d.pointages);
        if (d.clients) setClients(d.clients);
        if (d.commandes) setCommandes(d.commandes);
        if (d.depenses) setDepenses(d.depenses);
        if (d.articles) setArticles(d.articles);
        if (d.commandesFournisseurs) setCommandesFournisseurs(d.commandesFournisseurs);
        if (d.fournisseurs) setFournisseurs(d.fournisseurs);
        if (d.mouvements) setMouvements(d.mouvements);
        if (d.comptes) setComptes(d.comptes);
        if (d.transactions) setTransactions(d.transactions);
        if (d.galleryItems) setGalleryItems(d.galleryItems);
        if (d.companyAssets) setCompanyAssets(d.companyAssets);

        alert("✅ Restauration terminée avec succès !");
    };

    const availableViews = useMemo(() => {
        if (!user) return [];
        if (user.role === RoleEmploye.GARDIEN) return ['rh'];
        if (user.role === RoleEmploye.ADMIN || user.role === RoleEmploye.GERANT) return ['dashboard', 'ventes', 'production', 'stock', 'approvisionnement', 'fournisseurs', 'rh', 'clients', 'finance', 'catalogue', 'galerie', 'catalogue-public'];
        if (user.role === RoleEmploye.VENDEUR) return ['dashboard', 'ventes', 'clients', 'catalogue-public', 'galerie', 'finance'];
        if (user.role === RoleEmploye.CHEF_ATELIER) return ['dashboard', 'production', 'stock', 'approvisionnement', 'fournisseurs', 'clients', 'galerie'];
        return ['dashboard', 'galerie'];
    }, [user]);

    if (!user) return <LoginView employes={employes} onLogin={handleLogin} />;

    return (
        <div className="flex h-screen bg-gray-50 overflow-hidden">
            <Sidebar currentView={currentView} setView={setView} isOpen={sidebarOpen} setIsOpen={setSidebarOpen} availableViews={availableViews} user={user} onLogout={handleLogout} />
            <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
                <header className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between md:hidden">
                    <button onClick={() => setSidebarOpen(true)} className="p-2 -ml-2 text-gray-600"><Menu size={24} /></button>
                    <h1 className="text-lg font-bold text-brand-900 text-center flex-1">BY TCHICO</h1>
                </header>
                <div className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8 custom-scrollbar">
                    {currentView === 'dashboard' && <Dashboard commandes={commandes} employes={employes} depenses={depenses} clients={clients} />}
                    {currentView === 'ventes' && <SalesView articles={articles} boutiques={boutiques} clients={clients} commandes={commandes} onMakeSale={handleMakeSale} onAddPayment={(id, amt, meth, note, date, acc) => { setCommandes(prev => prev.map(c => c.id === id ? { ...c, avance: c.avance + amt, reste: Math.max(0, c.reste - amt), paiements: [...(c.paiements || []), { id: `P_${Date.now()}`, date, montant: amt, moyenPaiement: meth, note }] } : c)); if (acc) { setTransactions(prev => [{ id: `TR_PAY_${Date.now()}`, date: new Date().toISOString(), type: 'ENCAISSEMENT', montant: amt, compteId: acc, description: `Encaissement #${id.slice(-6)}`, categorie: 'VENTE' }, ...prev]); setComptes(prev => prev.map(c => c.id === acc ? { ...c, solde: c.solde + amt } : c)); } }} onCancelSale={(id, acc) => { setCommandes(prev => prev.map(c => c.id === id ? { ...c, statut: StatutCommande.ANNULE } : c)); }} comptes={comptes} companyAssets={companyAssets} />}
                    {currentView === 'production' && <ProductionView commandes={commandes} employes={employes} clients={clients} articles={articles} userRole={user.role} onUpdateStatus={(id, s) => setCommandes(prev => prev.map(c => c.id === id ? { ...c, statut: s } : c))} onCreateOrder={(o, cons, meth, acc) => { setCommandes(prev => [o, ...prev]); if (o.avance > 0 && acc) setComptes(prev => prev.map(c => c.id === acc ? { ...c, solde: c.solde + o.avance } : c)); if (cons && cons.length > 0) { setArticles(prevArticles => prevArticles.map(art => { const usages = cons.filter(u => u.articleId === art.id); if (usages.length === 0) return art; const newStock = JSON.parse(JSON.stringify(art.stockParLieu)); if (!newStock['ATELIER']) newStock['ATELIER'] = {}; usages.forEach(usage => { newStock['ATELIER'][usage.variante] = (newStock['ATELIER'][usage.variante] || 0) - usage.quantite; const mv: MouvementStock = { id: `M_CONS_${Date.now()}_${usage.articleId}`, date: new Date().toISOString(), articleId: art.id, articleNom: art.nom, variante: usage.variante, type: TypeMouvement.CONSOMMATION, quantite: -usage.quantite, lieuId: 'ATELIER', commentaire: `Production pour Commande #${o.id.slice(-6)}` }; setMouvements(prevMv => [mv, ...prevMv]); }); return { ...art, stockParLieu: newStock }; })); } }} onUpdateOrder={handleUpdateOrder} onAddPayment={(id, amt, meth, note, date, acc) => { setCommandes(prev => prev.map(c => c.id === id ? { ...c, avance: c.avance + amt, reste: Math.max(0, c.reste - amt), paiements: [...(c.paiements || []), { id: `P_${Date.now()}`, date, montant: amt, moyenPaiement: meth, note }] } : c)); if (acc) setComptes(prev => prev.map(c => c.id === acc ? { ...c, solde: c.solde + amt } : c)); }} onArchiveOrder={(id) => setCommandes(prev => prev.map(c => c.id === id ? { ...c, archived: true } : c))} comptes={comptes} companyAssets={companyAssets} />}
                    {currentView === 'catalogue' && <ArticlesView articles={articles} onAddArticle={handleAddArticle} onUpdateArticle={handleUpdateArticle} />}
                    {currentView === 'stock' && <StockView articles={articles} boutiques={boutiques} mouvements={mouvements} userRole={user.role} onAddMouvement={handleAddMouvement} onAddBoutique={(b) => setBoutiques(prev => [...prev, b])} />}
                    {currentView === 'fournisseurs' && <SuppliersView fournisseurs={fournisseurs} commandesFournisseurs={commandesFournisseurs} onAddFournisseur={(f) => setFournisseurs(prev => [...prev, f])} onUpdateFournisseur={(f) => setFournisseurs(prev => prev.map(old => old.id === f.id ? f : old))} onDeleteFournisseur={handleDeleteFournisseur} onAddPayment={handleAddPaymentFournisseur} comptes={comptes} />}
                    {currentView === 'approvisionnement' && <ProcurementView commandesFournisseurs={commandesFournisseurs} fournisseurs={fournisseurs} articles={articles} boutiques={boutiques} onAddOrder={handleAddOrderFournisseur} onUpdateOrder={(o) => setCommandesFournisseurs(prev => prev.map(old => old.id === o.id ? o : old))} onReceiveOrder={handleReceiveOrderFournisseur} onAddPayment={handleAddPaymentFournisseur} onUpdateArticle={handleUpdateArticle} onArchiveOrder={(id) => setCommandesFournisseurs(prev => prev.map(c => c.id === id ? { ...c, archived: true } : c))} comptes={comptes} />}
                    {currentView === 'rh' && <HRView employes={employes} boutiques={boutiques} onAddEmploye={handleAddEmploye} onUpdateEmploye={handleUpdateEmploye} onDeleteEmploye={handleHardDeleteEmploye} onArchiveEmploye={handleArchiveEmploye} onAddDepense={handleAddDepense} depenses={depenses} onDeleteDepense={handleDeleteDepense} onUpdateDepense={handleUpdateDepense} pointages={pointages} onAddPointage={(p) => setPointages(prev => [...prev, p])} onUpdatePointage={(p) => setPointages(prev => prev.map(old => old.id === p.id ? p : old))} currentUser={user} comptes={comptes} onUpdateComptes={setComptes} onAddTransaction={handleAddTransaction} />}
                    {currentView === 'clients' && <ClientsView clients={clients} commandes={commandes} onAddClient={handleAddClient} onUpdateClient={handleUpdateClient} onDeleteClient={handleDeleteClient} />}
                    {currentView === 'finance' && <FinanceView depenses={depenses} commandes={commandes} boutiques={boutiques} onAddDepense={handleAddDepense} onDeleteDepense={handleDeleteDepense} onUpdateDepense={handleUpdateDepense} userRole={user.role} fournisseurs={fournisseurs} commandesFournisseurs={commandesFournisseurs} clients={clients} comptes={comptes} transactions={transactions} onUpdateComptes={setComptes} onAddTransaction={handleAddTransaction} currentUser={user} />}
                    {currentView === 'galerie' && <GalleryView items={galleryItems} onAddItem={(i) => setGalleryItems(prev => [i, ...prev])} onDeleteItem={(id) => setGalleryItems(prev => prev.filter(i => i.id !== id))} />}
                    {currentView === 'catalogue-public' && <PublicCatalogView articles={articles} />}
                    {currentView === 'settings' && <SettingsView fullData={{ boutiques, employes, pointages, clients, commandes, depenses, articles, commandesFournisseurs, fournisseurs, mouvements, comptes, transactions, galleryItems, companyAssets }} onRestore={handleFullRestore} onImport={(t, d) => { 
                        const safeData = d.map(item => ({ ...item, id: item.id || `${t.slice(0,1)}_${Date.now()}_${Math.random().toString(36).substr(2, 5)}` }));
                        if(t === 'CLIENTS') setClients(prev => [...prev, ...safeData]); 
                        if(t === 'ARTICLES') setArticles(prev => [...prev, ...safeData]);
                        if(t === 'FOURNISSEURS') setFournisseurs(prev => [...prev, ...safeData]);
                        if(t === 'EMPLOYES') setEmployes(prev => [...prev, ...safeData]);
                        if(t === 'DEPENSES') setDepenses(prev => [...prev, ...safeData]);
                        if(t === 'POINTAGE') setPointages(prev => [...prev, ...safeData]);
                    }} onClearData={handleClearData} companyAssets={companyAssets} onUpdateAssets={setCompanyAssets} />}
                </div>
            </main>
        </div>
    );
};

export default App;
