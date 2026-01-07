
import React, { useState, useMemo } from 'react';
import { Client, Commande, Employe, RoleEmploye, StatutCommande, Depense, Boutique, Fournisseur, CommandeFournisseur, StatutCommandeFournisseur, StatutPaiement, Article, MouvementStock, TypeMouvement, CompteFinancier, TransactionTresorerie, Pointage, GalleryItem, CompanyAssets, SessionUser, ModePaiement, TacheProduction, ReceptionFournisseur } from './types';
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
    
    const handleAddClient = (c: Client) => setClients(prev => [...prev, c]);
    const handleUpdateClient = (c: Client) => setClients(prev => prev.map(cli => cli.id === c.id ? c : cli));
    const handleDeleteClient = (id: string) => setClients(prev => prev.filter(c => c.id !== id));

    const handleUpdateOrder = (o: Commande, accId?: string) => {
        const oldOrder = commandes.find(c => c.id === o.id);
        if (oldOrder && oldOrder.avance !== o.avance && accId) {
            const diff = o.avance - oldOrder.avance;
            setComptes(prev => prev.map(c => c.id === accId ? { ...c, solde: c.solde + diff } : c));
            const correctionTransaction: TransactionTresorerie = {
                id: `TR_CORR_${Date.now()}`,
                date: new Date().toISOString().split('T')[0],
                type: diff > 0 ? 'ENCAISSEMENT' : 'DECAISSEMENT',
                montant: Math.abs(diff),
                compteId: accId,
                description: `Correction Acompte : ${o.clientNom} (Commande ${o.id.slice(-6)})`,
                categorie: 'VENTE',
                createdBy: user?.nom
            };
            setTransactions(prev => [correctionTransaction, ...prev]);
        }
        setCommandes(prev => prev.map(cmd => cmd.id === o.id ? o : cmd));
    };

    const handleAddTaskToOrder = (orderId: string, task: TacheProduction) => {
        setCommandes(prev => prev.map(c => {
            if (c.id !== orderId) return c;
            const updatedTaches = [...(c.taches || []), task];
            const updatedTailleurs = c.tailleursIds.includes(task.tailleurId) ? c.tailleursIds : [...c.tailleursIds, task.tailleurId];
            return { ...c, taches: updatedTaches, tailleursIds: updatedTailleurs };
        }));
    };

    const handleUpdateTask = (orderId: string, taskId: string, newStatut: 'A_FAIRE' | 'FAIT') => {
        setCommandes(prev => prev.map(c => {
            if (c.id !== orderId) return c;
            
            const taskToUpdate = (c.taches || []).find(t => t.id === taskId);
            if (!taskToUpdate) return c;

            const updatedTaches = (c.taches || []).map(t => t.id === taskId ? { ...t, statut: newStatut } : t);
            
            // Logique de synchronisation : faire avancer le statut de la commande si la tâche est terminée
            let newGlobalStatus = c.statut;
            if (newStatut === 'FAIT') {
                switch(taskToUpdate.action) {
                    case 'COUPE': 
                        newGlobalStatus = StatutCommande.COUTURE; 
                        break;
                    case 'COUTURE': 
                    case 'BRODERIE':
                        newGlobalStatus = StatutCommande.FINITION; 
                        break;
                    case 'FINITION': 
                    case 'REPASSAGE': 
                        newGlobalStatus = StatutCommande.PRET; 
                        break;
                    default:
                        // Pour les autres actions, on ne change pas forcément le statut global automatiquement
                        break;
                }
            }

            return { ...c, taches: updatedTaches, statut: newGlobalStatus };
        }));
    };

    const handleGlobalAddPayment = (orderId: string, amount: number, method: any, note: string, date: string, accId?: string) => {
        const order = commandes.find(c => c.id === orderId);
        if (!order) return;

        setCommandes(prev => prev.map(c => c.id === orderId ? { 
            ...c, 
            reste: Math.max(0, c.reste - amount), 
            paiements: [...(c.paiements || []), { id: `P_${Date.now()}`, date, montant: amount, moyenPaiement: method, note }] 
        } : c));

        if (accId) {
            setComptes(prev => prev.map(c => c.id === accId ? { ...c, solde: c.solde + amount } : c));
            const newTransaction: TransactionTresorerie = {
                id: `TR_PAY_${Date.now()}`,
                date: date,
                type: 'ENCAISSEMENT',
                montant: amount,
                compteId: accId,
                description: `Encaissement : ${order.clientNom} (Commande ${orderId.slice(-6)})`,
                categorie: 'VENTE',
                createdBy: user?.nom
            };
            setTransactions(prev => [newTransaction, ...prev]);
        }
    };

    const handleGlobalUpdatePayment = (orderId: string, paymentId: string, newAmount: number, date: string, accId: string) => {
        const order = commandes.find(c => c.id === orderId);
        if (!order) return;
        const oldPayment = order.paiements?.find(p => p.id === paymentId);
        if (!oldPayment) return;
        const diff = newAmount - oldPayment.montant;
        setCommandes(prev => prev.map(c => {
            if (c.id !== orderId) return c;
            const updatedPaiements = (c.paiements || []).map(p => p.id === paymentId ? { ...p, montant: newAmount, date } : p);
            const totalPaid = c.avance + updatedPaiements.reduce((acc, p) => acc + p.montant, 0);
            return { ...c, paiements: updatedPaiements, reste: Math.max(0, c.prixTotal - totalPaid) };
        }));
        setComptes(prev => prev.map(c => c.id === accId ? { ...c, solde: c.solde + diff } : c));
        const corrTrans: TransactionTresorerie = {
            id: `TR_EDIT_${Date.now()}`, date: date, type: diff > 0 ? 'ENCAISSEMENT' : 'DECAISSEMENT',
            montant: Math.abs(diff), compteId: accId, description: `Modif. Versement : ${order.clientNom}`, categorie: 'VENTE', createdBy: user?.nom
        };
        setTransactions(prev => [corrTrans, ...prev]);
    };

    const handleGlobalDeletePayment = (orderId: string, paymentId: string, accId: string) => {
        const order = commandes.find(c => c.id === orderId);
        if (!order) return;
        const oldPayment = order.paiements?.find(p => p.id === paymentId);
        if (!oldPayment) return;
        setCommandes(prev => prev.map(c => {
            if (c.id !== orderId) return c;
            const updatedPaiements = (c.paiements || []).filter(p => p.id !== paymentId);
            const totalPaid = c.avance + updatedPaiements.reduce((acc, p) => acc + p.montant, 0);
            return { ...c, paiements: updatedPaiements, reste: Math.max(0, c.prixTotal - totalPaid) };
        }));
        setComptes(prev => prev.map(c => c.id === accId ? { ...c, solde: c.solde - oldPayment.montant } : c));
        const delTrans: TransactionTresorerie = {
            id: `TR_DEL_${Date.now()}`, date: new Date().toISOString().split('T')[0], type: 'DECAISSEMENT',
            montant: oldPayment.montant, compteId: accId, description: `Annulation Versement : ${order.clientNom}`, categorie: 'VENTE', createdBy: user?.nom
        };
        setTransactions(prev => [delTrans, ...prev]);
    };

    // --- PROCUREMENT HANDLERS ---
    const handleReceiveProcurementOrder = (orderId: string, lieuId: string, quantities: Record<string, number>, date: string) => {
        const order = commandesFournisseurs.find(o => o.id === orderId);
        if (!order) return;

        // 1. Mettre à jour les quantités reçues sur la commande
        const updatedCommandes = commandesFournisseurs.map(o => {
            if (o.id !== orderId) return o;
            
            const updatedLignes = o.lignes.map(l => {
                const qRecNow = quantities[l.id] || 0;
                return { ...l, quantiteRecue: (l.quantiteRecue || 0) + qRecNow };
            });

            const allRec = updatedLignes.every(l => l.quantiteRecue >= l.quantite);
            const newReception: ReceptionFournisseur = {
                id: `REC_${Date.now()}`,
                date,
                lieuId,
                details: updatedLignes.filter(l => (quantities[l.id] || 0) > 0).map(l => ({
                    nomArticle: l.nomArticle,
                    variante: l.variante,
                    quantiteRecue: quantities[l.id] || 0
                }))
            };

            return {
                ...o,
                lignes: updatedLignes,
                statut: allRec ? StatutCommandeFournisseur.LIVRE : StatutCommandeFournisseur.EN_COURS,
                receptions: [...(o.receptions || []), newReception]
            };
        });
        setCommandesFournisseurs(updatedCommandes);

        // 2. Mettre à jour les stocks réels des articles
        const updatedArticles = articles.map(art => {
            let articleUpdated = false;
            const newStock = { ...art.stockParLieu };
            
            order.lignes.forEach(l => {
                if (l.articleId === art.id) {
                    const qRecNow = quantities[l.id] || 0;
                    if (qRecNow > 0) {
                        if (!newStock[lieuId]) newStock[lieuId] = {};
                        newStock[lieuId][l.variante] = (newStock[lieuId][l.variante] || 0) + qRecNow;
                        articleUpdated = true;

                        // Logger le mouvement de stock
                        const mvt: MouvementStock = {
                            id: `MVT_${Date.now()}_${l.id}`,
                            date,
                            articleId: art.id,
                            articleNom: art.nom,
                            variante: l.variante,
                            type: TypeMouvement.ACHAT,
                            quantite: qRecNow,
                            lieuId: lieuId,
                            commentaire: `Réception CMD Fourn. #${orderId.slice(-6)}`
                        };
                        setMouvements(prev => [mvt, ...prev]);
                    }
                }
            });

            return articleUpdated ? { ...art, stockParLieu: newStock } : art;
        });
        setArticles(updatedArticles);
        alert("Réception validée et stock mis à jour !");
    };

    const handleAddProcurementPayment = (orderId: string, amount: number, date: string, accId?: string) => {
        const order = commandesFournisseurs.find(o => o.id === orderId);
        if (!order) return;

        setCommandesFournisseurs(prev => prev.map(o => {
            if (o.id !== orderId) return o;
            const newPaid = o.montantPaye + amount;
            return {
                ...o,
                montantPaye: newPaid,
                statutPaiement: newPaid >= o.montantTotal ? StatutPaiement.PAYE : StatutPaiement.PARTIEL,
                paiements: [...(o.paiements || []), { id: `PF_${Date.now()}`, date, montant: amount, note: "Règlement fournisseur" }]
            };
        }));

        if (accId) {
            setComptes(prev => prev.map(c => c.id === accId ? { ...c, solde: c.solde - amount } : c));
            const tr: TransactionTresorerie = {
                id: `TR_PF_${Date.now()}`,
                date,
                type: 'DECAISSEMENT',
                montant: amount,
                compteId: accId,
                description: `Paiement Fournisseur (CMD #${orderId.slice(-6)})`,
                categorie: 'MATIERE_PREMIERE',
                createdBy: user?.nom
            };
            setTransactions(prev => [tr, ...prev]);
        }
    };

    const handleRestoreData = (data: any) => {
        if (!data) return;
        if (data.boutiques) setBoutiques(data.boutiques);
        if (data.employes) setEmployes(data.employes);
        if (data.pointages) setPointages(data.pointages);
        if (data.clients) setClients(data.clients);
        if (data.commandes) setCommandes(data.commandes);
        if (data.depenses) setDepenses(data.depenses);
        if (data.articles) setArticles(data.articles);
        if (data.commandesFournisseurs) setCommandesFournisseurs(data.commandesFournisseurs);
        if (data.fournisseurs) setFournisseurs(data.fournisseurs);
        if (data.mouvements) setMouvements(data.mouvements);
        if (data.comptes) setComptes(data.comptes);
        if (data.transactions) setTransactions(data.transactions);
        if (data.galleryItems) setGalleryItems(data.galleryItems);
        if (data.companyAssets) setCompanyAssets(data.companyAssets);
        alert("Restauration terminée avec succès !");
        window.location.reload();
    };

    const handleImportCSVData = (type: 'CLIENTS' | 'ARTICLES' | 'EMPLOYES' | 'FOURNISSEURS' | 'DEPENSES' | 'POINTAGE', data: any[]) => {
        switch (type) {
            case 'CLIENTS': setClients(prev => [...prev, ...data]); break;
            case 'ARTICLES': setArticles(prev => [...prev, ...data]); break;
            case 'EMPLOYES': setEmployes(prev => [...prev, ...data]); break;
            case 'FOURNISSEURS': setFournisseurs(prev => [...prev, ...data]); break;
            case 'DEPENSES': setDepenses(prev => [...prev, ...data]); break;
            case 'POINTAGE': setPointages(prev => [...prev, ...data]); break;
        }
    };

    const handleClearAllData = () => {
        if (!window.confirm("⚠️ ATTENTION : Voulez-vous vraiment TOUT SUPPRIMER ? Cette action est irréversible.")) return;
        setBoutiques(mockBoutiques); setEmployes(mockEmployes); setPointages(mockPointages); setClients(mockClients);
        setCommandes(mockCommandes); setDepenses(mockDepenses); setArticles(mockArticles);
        setCommandesFournisseurs(mockCommandesFournisseurs); setFournisseurs(mockFournisseurs); setMouvements(mockMouvements);
        setComptes(mockComptes); setTransactions(mockTransactionsTresorerie); setGalleryItems(mockGalleryItems); setCompanyAssets(mockCompanyAssets);
        localStorage.clear(); alert("Données réinitialisées."); window.location.reload();
    };

    const availableViews = useMemo(() => {
        if (!user) return [];
        if (user.role === RoleEmploye.GARDIEN) return ['rh'];
        if (user.role === RoleEmploye.ADMIN || user.role === RoleEmploye.GERANT) return ['dashboard', 'ventes', 'production', 'stock', 'approvisionnement', 'fournisseurs', 'rh', 'clients', 'finance', 'catalogue', 'galerie', 'catalogue-public'];
        if (user.role === RoleEmploye.VENDEUR) return ['dashboard', 'ventes', 'clients', 'catalogue-public', 'galerie', 'finance'];
        if (user.role === RoleEmploye.CHEF_ATELIER) return ['dashboard', 'production', 'stock', 'approvisionnement', 'fournisseurs', 'clients', 'galerie'];
        return ['dashboard', 'galerie'];
    }, [user]);

    if (!user) return <LoginView employes={employes} onLogin={handleLogin} companyAssets={companyAssets} />;

    return (
        <div className="flex h-screen bg-gray-50 overflow-hidden">
            <Sidebar currentView={currentView} setView={setView} isOpen={sidebarOpen} setIsOpen={setSidebarOpen} availableViews={availableViews} user={user} onLogout={handleLogout} commandes={commandes} articles={articles}/>
            <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
                <header className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between md:hidden">
                    <button onClick={() => setSidebarOpen(true)} className="p-2 -ml-2 text-gray-600"><Menu size={24} /></button>
                    <h1 className="text-lg font-bold text-brand-900 text-center flex-1">BY TCHICO</h1>
                </header>
                <div className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8 custom-scrollbar">
                    {currentView === 'dashboard' && <Dashboard commandes={commandes} employes={employes} depenses={depenses} clients={clients} />}
                    {currentView === 'ventes' && <SalesView articles={articles} boutiques={boutiques} clients={clients} commandes={commandes} onMakeSale={(s) => { setCommandes(prev => [s.order, ...prev]); if(s.transaction) setTransactions(prev => [s.transaction, ...prev]); if(s.newComptes) setComptes(s.newComptes); }} onAddPayment={handleGlobalAddPayment} comptes={comptes} onCancelSale={() => {}} companyAssets={companyAssets} currentUser={user} />}
                    {currentView === 'production' && <ProductionView commandes={commandes} employes={employes} clients={clients} articles={articles} userRole={user.role} onUpdateStatus={(id, s) => setCommandes(prev => prev.map(c => c.id === id ? { ...c, statut: s } : c))} onCreateOrder={(o, cons, meth, acc) => { setCommandes(prev => [o, ...prev]); if (o.avance > 0 && acc) { setComptes(prev => prev.map(c => c.id === acc ? { ...c, solde: c.solde + o.avance } : c)); const acTransaction: TransactionTresorerie = { id: `TR_AC_${Date.now()}`, date: new Date().toISOString().split('T')[0], type: 'ENCAISSEMENT', montant: o.avance, compteId: acc, description: `Acompte initial : ${o.clientNom}`, categorie: 'VENTE', createdBy: user?.nom }; setTransactions(prev => [acTransaction, ...prev]); } }} onUpdateOrder={handleUpdateOrder} onAddPayment={handleGlobalAddPayment} onUpdatePayment={handleGlobalUpdatePayment} onDeletePayment={handleGlobalDeletePayment} onAddTask={handleAddTaskToOrder} onUpdateTask={handleUpdateTask} onArchiveOrder={(id) => setCommandes(prev => prev.map(c => c.id === id ? { ...c, archived: true } : c))} comptes={comptes} companyAssets={companyAssets} />}
                    {currentView === 'stock' && <StockView articles={articles} boutiques={boutiques} mouvements={mouvements} userRole={user.role} onAddMouvement={(m) => setMouvements(prev => [m, ...prev])} onAddBoutique={(b) => setBoutiques(prev => [...prev, b])} onUpdateBoutique={(b) => setBoutiques(prev => prev.map(item => item.id === b.id ? b : item))} onDeleteBoutique={(id) => setBoutiques(prev => prev.filter(b => b.id !== id))} />}
                    {currentView === 'approvisionnement' && <ProcurementView commandesFournisseurs={commandesFournisseurs} fournisseurs={fournisseurs} articles={articles} boutiques={boutiques} onAddOrder={(o, accId) => { setCommandesFournisseurs(prev => [o, ...prev]); if (o.montantPaye > 0 && accId) setComptes(prev => prev.map(c => c.id === accId ? { ...c, solde: c.solde - o.montantPaye } : c)); }} onUpdateOrder={(o) => setCommandesFournisseurs(prev => prev.map(cmd => cmd.id === o.id ? o : cmd))} onReceiveOrder={handleReceiveProcurementOrder} onAddPayment={handleAddProcurementPayment} onUpdateArticle={(a) => setArticles(prev => prev.map(art => art.id === a.id ? a : art))} onArchiveOrder={(id) => setCommandesFournisseurs(prev => prev.map(c => c.id === id ? { ...c, archived: true } : c))} comptes={comptes} />}
                    {currentView === 'fournisseurs' && <SuppliersView fournisseurs={fournisseurs} commandesFournisseurs={commandesFournisseurs} onAddFournisseur={(f) => setFournisseurs(prev => [...prev, f])} onUpdateFournisseur={(f) => setFournisseurs(prev => prev.map(item => item.id === f.id ? f : item))} onDeleteFournisseur={(id) => setFournisseurs(prev => prev.filter(f => f.id !== id))} onAddPayment={() => {}} comptes={comptes} />}
                    {currentView === 'rh' && <HRView employes={employes} boutiques={boutiques} onAddEmploye={handleAddEmploye} onUpdateEmploye={handleUpdateEmploye} onDeleteEmploye={(id) => setEmployes(prev => prev.filter(e => e.id !== id))} onArchiveEmploye={(id) => setEmployes(prev => prev.map(e => e.id === id ? {...e, actif: !e.actif} : e))} onAddDepense={(d) => setDepenses(prev => [d, ...prev])} depenses={depenses} onDeleteDepense={(id) => setDepenses(prev => prev.filter(d => d.id !== id))} onUpdateDepense={(d) => setDepenses(prev => prev.map(item => item.id === d.id ? d : item))} pointages={pointages} onAddPointage={(p) => setPointages(prev => [...prev, p])} onUpdatePointage={(p) => setPointages(prev => prev.map(item => item.id === p.id ? p : item))} currentUser={user} comptes={comptes} onUpdateComptes={setComptes} onAddTransaction={(t) => setTransactions(prev => [t, ...prev])} onUpdateEmployes={(updates) => setEmployes(prev => prev.map(e => updates.find(u => u.id === e.id) || e))} />}
                    {currentView === 'clients' && <ClientsView clients={clients} commandes={commandes} onAddClient={handleAddClient} onUpdateClient={handleUpdateClient} onDeleteClient={handleDeleteClient} />}
                    {currentView === 'finance' && <FinanceView depenses={depenses} commandes={commandes} boutiques={boutiques} onAddDepense={(d) => setDepenses(prev => [d, ...prev])} onDeleteDepense={(id) => setDepenses(prev => prev.filter(d => d.id !== id))} onUpdateDepense={(d) => setDepenses(prev => prev.map(item => item.id === d.id ? d : item))} userRole={user.role} fournisseurs={fournisseurs} commandesFournisseurs={commandesFournisseurs} clients={clients} comptes={comptes} transactions={transactions} onUpdateComptes={setComptes} onAddTransaction={(t) => setTransactions(prev => [t, ...prev])} currentUser={user} />}
                    {currentView === 'catalogue' && <ArticlesView articles={articles} onAddArticle={(a) => setArticles(prev => [...prev, a])} onUpdateArticle={(a) => setArticles(prev => prev.map(item => item.id === a.id ? a : item))} />}
                    {currentView === 'galerie' && <GalleryView items={galleryItems} onAddItem={(i) => setGalleryItems(prev => [i, ...prev])} onUpdateItem={(i) => setGalleryItems(prev => prev.map(item => item.id === i.id ? i : item))} onDeleteItem={(id) => setGalleryItems(prev => prev.filter(i => i.id !== id))} />}
                    {currentView === 'catalogue-public' && <PublicCatalogView articles={articles} />}
                    {currentView === 'settings' && <SettingsView fullData={{ boutiques, employes, pointages, clients, commandes, depenses, articles, commandesFournisseurs, fournisseurs, mouvements, comptes, transactions, galleryItems, companyAssets }} onRestore={handleRestoreData} onImport={handleImportCSVData} onClearData={handleClearAllData} companyAssets={companyAssets} onUpdateAssets={setCompanyAssets} />}
                </div>
            </main>
        </div>
    );
};

export default App;
