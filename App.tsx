
import React, { useState, useMemo } from 'react';
import { Client, Commande, Employe, RoleEmploye, StatutCommande, Depense, Boutique, Fournisseur, CommandeFournisseur, StatutCommandeFournisseur, StatutPaiement, Article, MouvementStock, TypeMouvement, CompteFinancier, TransactionTresorerie, Pointage, GalleryItem, CompanyAssets, SessionUser, ModePaiement, TacheProduction, ReceptionFournisseur, Consommation } from './types';
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
        if (oldOrder && accId) {
            const diffAvance = o.avance - oldOrder.avance;
            if (diffAvance !== 0) {
                setComptes(prev => prev.map(c => c.id === accId ? { ...c, solde: c.solde + diffAvance } : c));
                const corrTrans: TransactionTresorerie = {
                    id: `TR_EDIT_AC_${Date.now()}`,
                    date: new Date().toISOString().split('T')[0],
                    type: diffAvance > 0 ? 'ENCAISSEMENT' : 'DECAISSEMENT',
                    montant: Math.abs(diffAvance),
                    compteId: accId,
                    description: `Correction Acompte : ${o.clientNom} (Commande #${o.id.slice(-6)})`,
                    categorie: 'VENTE',
                    createdBy: user?.nom
                };
                setTransactions(prev => [corrTrans, ...prev]);
            }
        }
        setCommandes(prev => prev.map(cmd => cmd.id === o.id ? { ...o, reste: Math.max(0, o.prixTotal - (o.avance + (o.paiements?.reduce((acc, p) => acc + p.montant, 0) || 0))) } : cmd));
    };

    const handleAddTaskToOrder = (orderId: string, task: TacheProduction) => {
        setCommandes(prev => prev.map(c => {
            if (c.id !== orderId) return c;
            const updatedTaches = [...(c.taches || []), task];
            return { ...c, taches: updatedTaches };
        }));
    };

    const handleUpdateTask = (orderId: string, taskId: string, newStatut: 'A_FAIRE' | 'FAIT') => {
        setCommandes(prev => prev.map(c => {
            if (c.id !== orderId) return c;
            const updatedTaches = (c.taches || []).map(t => t.id === taskId ? { ...t, statut: newStatut } : t);
            return { ...c, taches: updatedTaches };
        }));
    };

    const handleGlobalAddPayment = (orderId: string, amount: number, method: any, note: string, date: string, accId?: string) => {
        const order = commandes.find(c => c.id === orderId);
        if (!order) return;

        setCommandes(prev => prev.map(c => c.id === orderId ? { 
            ...c, 
            reste: Math.max(0, c.reste - amount), 
            paiements: [...(c.paiements || []), { id: `P_${Date.now()}`, date, montant: amount, moyenPaiement: method, note, compteId: accId }] 
        } : c));

        if (accId) {
            setComptes(prev => prev.map(c => c.id === accId ? { ...c, solde: c.solde + amount } : c));
            const newTransaction: TransactionTresorerie = {
                id: `TR_PAY_${Date.now()}`, date, type: 'ENCAISSEMENT', montant: amount, compteId: accId,
                description: `Versement : ${order.clientNom} (Commande ${orderId.slice(-6)})`, categorie: 'VENTE', createdBy: user?.nom
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
            const updatedPaiements = (c.paiements || []).map(p => p.id === paymentId ? { ...p, montant: newAmount, date, compteId: accId } : p);
            const totalPaid = c.avance + updatedPaiements.reduce((acc, p) => acc + p.montant, 0);
            return { ...c, paiements: updatedPaiements, reste: Math.max(0, c.prixTotal - totalPaid) };
        }));

        if (accId) {
            setComptes(prev => prev.map(c => c.id === accId ? { ...c, solde: c.solde + diff } : c));
            const corrTrans: TransactionTresorerie = {
                id: `TR_EDIT_${Date.now()}`, date: date, type: diff > 0 ? 'ENCAISSEMENT' : 'DECAISSEMENT',
                montant: Math.abs(diff), compteId: accId, description: `Modif. Versement : ${order.clientNom}`, categorie: 'VENTE', createdBy: user?.nom
            };
            setTransactions(prev => [corrTrans, ...prev]);
        }
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

        if (accId) {
            setComptes(prev => prev.map(c => c.id === accId ? { ...c, solde: c.solde - oldPayment.montant } : c));
            const delTrans: TransactionTresorerie = {
                id: `TR_DEL_${Date.now()}`, date: new Date().toISOString().split('T')[0], type: 'DECAISSEMENT',
                montant: oldPayment.montant, compteId: accId, description: `Annulation Versement : ${order.clientNom}`, categorie: 'VENTE', createdBy: user?.nom
            };
            setTransactions(prev => [delTrans, ...prev]);
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
        alert("Données restaurées !");
        window.location.reload();
    };

    const handleReceiveProcurementOrder = (id: string, lieuId: string, quantities: Record<string, number>, date: string) => {
        setCommandesFournisseurs(prev => prev.map(order => {
            if (order.id !== id) return order;
            const updatedLignes = order.lignes.map(line => {
                const received = quantities[line.id] || 0;
                if (received > 0) {
                    setArticles(prevArticles => prevArticles.map(art => {
                        if (art.id !== line.articleId) return art;
                        const newStock = { ...art.stockParLieu };
                        if (!newStock[lieuId]) newStock[lieuId] = {};
                        newStock[lieuId][line.variante] = (newStock[lieuId][line.variante] || 0) + received;
                        return { ...art, stockParLieu: newStock };
                    }));
                    const mvt: MouvementStock = {
                        id: `MVT_REC_${Date.now()}_${line.id}`,
                        date: date,
                        articleId: line.articleId,
                        articleNom: line.nomArticle,
                        variante: line.variante,
                        type: TypeMouvement.ACHAT,
                        quantite: received,
                        lieuId: lieuId,
                        commentaire: `Réception CF #${id.slice(-6)}`
                    };
                    setMouvements(prevM => [mvt, ...prevM]);
                }
                return { ...line, quantiteRecue: (line.quantiteRecue || 0) + received };
            });
            const allReceived = updatedLignes.every(l => (l.quantiteRecue || 0) >= l.quantite);
            return { ...order, lignes: updatedLignes, statut: allReceived ? StatutCommandeFournisseur.LIVRE : StatutCommandeFournisseur.EN_COURS };
        }));
    };

    const handleAddProcurementPayment = (orderId: string, amount: number, date: string, accId?: string) => {
        const order = commandesFournisseurs.find(c => c.id === orderId);
        if (!order) return;
        const newPayment = { id: `P_F_${Date.now()}`, date, montant: amount };
        setCommandesFournisseurs(prev => prev.map(c => {
            if (c.id !== orderId) return c;
            const updatedPaid = c.montantPaye + amount;
            const newStatutPaiement = updatedPaid >= c.montantTotal ? StatutPaiement.PAYE : StatutPaiement.PARTIEL;
            return { ...c, montantPaye: updatedPaid, statutPaiement: newStatutPaiement, paiements: [...(c.paiements || []), newPayment] };
        }));
        if (accId) {
            setComptes(prev => prev.map(c => c.id === accId ? { ...c, solde: c.solde - amount } : c));
            const supplier = fournisseurs.find(f => f.id === order.fournisseurId);
            const tr: TransactionTresorerie = {
                id: `TR_P_F_${Date.now()}`, date: date, type: 'DECAISSEMENT', montant: amount, compteId: accId,
                description: `Paiement Fournisseur : ${supplier?.nomEntreprise || 'Inconnu'} (CF ${orderId.slice(-6)})`, 
                categorie: 'ACHAT', createdBy: user?.nom
            };
            setTransactions(prev => [tr, ...prev]);
        }
    };

    const handleAddMouvementAndApplyStock = (m: MouvementStock) => {
        setMouvements(prev => [m, ...prev]);
        setArticles(prevArticles => prevArticles.map(art => {
            if (art.id !== m.articleId) return art;
            const newStock = { ...art.stockParLieu };
            
            // Appliquer sur le lieu d'origine (déduction si m.quantite est négatif)
            if (!newStock[m.lieuId]) newStock[m.lieuId] = {};
            newStock[m.lieuId][m.variante] = (newStock[m.lieuId][m.variante] || 0) + m.quantite;

            // Si c'est un transfert, appliquer l'ajout sur le lieu de destination
            if (m.type === TypeMouvement.TRANSFERT && m.lieuDestinationId) {
                if (!newStock[m.lieuDestinationId]) newStock[m.lieuDestinationId] = {};
                // Dans le transfert, m.quantite est négatif (sortie), on ajoute la valeur absolue en destination
                newStock[m.lieuDestinationId][m.variante] = (newStock[m.lieuDestinationId][m.variante] || 0) + Math.abs(m.quantite);
            }
            
            return { ...art, stockParLieu: newStock };
        }));
    };

    const handleImportCSVData = (type: string, data: any[]) => {
        if (type === 'CLIENTS') setClients(prev => [...prev, ...data]);
        else if (type === 'ARTICLES') setArticles(prev => [...prev, ...data]);
        else if (type === 'EMPLOYES') setEmployes(prev => [...prev, ...data]);
        else if (type === 'FOURNISSEURS') setFournisseurs(prev => [...prev, ...data]);
        else if (type === 'DEPENSES') setDepenses(prev => [...prev, ...data]);
        else if (type === 'POINTAGE') setPointages(prev => [...prev, ...data]);
    };

    const handleClearAllData = () => {
        if (window.confirm("⚠️ ACTION IRRÉVERSIBLE ⚠️\n\nSupprimer absolument TOUTES les données ?")) {
            localStorage.clear();
            window.location.reload();
        }
    };

    const availableViews = useMemo(() => {
        if (!user) return [];
        if (user.role === RoleEmploye.GARDIEN) return ['rh'];
        if (user.role === RoleEmploye.ADMIN || user.role === RoleEmploye.GERANT) return ['dashboard', 'ventes', 'production', 'stock', 'approvisionnement', 'fournisseurs', 'rh', 'clients', 'finance', 'catalogue', 'galerie', 'catalogue-public'];
        if (user.role === RoleEmploye.VENDEUR) return ['dashboard', 'ventes', 'production', 'clients', 'catalogue-public', 'galerie', 'finance'];
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
                    {currentView === 'production' && <ProductionView 
                        commandes={commandes} 
                        employes={employes} 
                        clients={clients} 
                        articles={articles} 
                        userRole={user.role} 
                        userBoutiqueId={user.boutiqueId}
                        onUpdateStatus={(id, s) => setCommandes(prev => prev.map(c => c.id === id ? { ...c, statut: s } : c))} 
                        onCreateOrder={(o, cons, meth, acc) => { 
                            setCommandes(prev => [o, ...prev]); 
                            if (o.avance > 0 && acc) { 
                                setComptes(prev => prev.map(c => c.id === acc ? { ...c, solde: c.solde + o.avance } : c)); 
                                const acTransaction: TransactionTresorerie = { id: `TR_AC_${Date.now()}`, date: new Date().toISOString().split('T')[0], type: 'ENCAISSEMENT', montant: o.avance, compteId: acc, description: `Acompte : ${o.clientNom}`, categorie: 'VENTE', createdBy: user?.nom }; 
                                setTransactions(prev => [acTransaction, ...prev]); 
                            } 
                            
                            // DÉDUCTION STOCK MATIÈRES PREMIÈRES (CONSOMMATIONS)
                            if (cons && cons.length > 0) {
                                setArticles(prevArticles => {
                                    const updated = [...prevArticles];
                                    cons.forEach(cItem => {
                                        const artIdx = updated.findIndex(a => a.id === cItem.articleId);
                                        if (artIdx !== -1) {
                                            const art = updated[artIdx];
                                            const newStock = { ...art.stockParLieu };
                                            if (!newStock['ATELIER']) newStock['ATELIER'] = {};
                                            newStock['ATELIER'][cItem.variante] = (newStock['ATELIER'][cItem.variante] || 0) - cItem.quantite;
                                            updated[artIdx] = { ...art, stockParLieu: newStock };
                                            
                                            // Enregistrement du mouvement
                                            const mvt: MouvementStock = {
                                                id: `MVT_CONS_${Date.now()}_${cItem.id}`,
                                                date: new Date().toISOString(),
                                                articleId: art.id,
                                                articleNom: art.nom,
                                                variante: cItem.variante,
                                                type: TypeMouvement.CONSOMMATION,
                                                quantite: -cItem.quantite,
                                                lieuId: 'ATELIER',
                                                commentaire: `Sortie stock pour commande #${o.id.slice(-6)}`
                                            };
                                            setMouvements(prevM => [mvt, ...prevM]);
                                        }
                                    });
                                    return updated;
                                });
                            }
                        }} 
                        onUpdateOrder={handleUpdateOrder} 
                        onAddPayment={handleGlobalAddPayment} 
                        onUpdatePayment={handleGlobalUpdatePayment} 
                        onDeletePayment={handleGlobalDeletePayment} 
                        onAddTask={handleAddTaskToOrder} 
                        onUpdateTask={handleUpdateTask} 
                        onArchiveOrder={(id) => setCommandes(prev => prev.map(c => c.id === id ? { ...c, archived: true } : c))} 
                        comptes={comptes} 
                        boutiques={boutiques}
                        companyAssets={companyAssets} 
                    />}
                    {currentView === 'stock' && <StockView articles={articles} boutiques={boutiques} mouvements={mouvements} userRole={user.role} onAddMouvement={handleAddMouvementAndApplyStock} onAddBoutique={(b) => setBoutiques(prev => [...prev, b])} onUpdateBoutique={(b) => setBoutiques(prev => prev.map(item => item.id === b.id ? b : item))} onDeleteBoutique={(id) => setBoutiques(prev => prev.filter(b => b.id !== id))} />}
                    {currentView === 'approvisionnement' && <ProcurementView 
                        commandesFournisseurs={commandesFournisseurs} 
                        fournisseurs={fournisseurs} 
                        articles={articles} 
                        boutiques={boutiques} 
                        onAddOrder={(o, accId) => { 
                            setCommandesFournisseurs(prev => [o, ...prev]); 
                            if (o.montantPaye > 0 && accId) {
                                setComptes(prev => prev.map(c => c.id === accId ? { ...c, solde: c.solde - o.montantPaye } : c));
                                const supplier = fournisseurs.find(f => f.id === o.fournisseurId);
                                const tr: TransactionTresorerie = {
                                    id: `TR_INIT_CF_${Date.now()}`, date: o.dateCommande, type: 'DECAISSEMENT', montant: o.montantPaye, compteId: accId,
                                    description: `Acompte Fournisseur : ${supplier?.nomEntreprise || 'Inconnu'} (CF ${o.id.slice(-6)})`, categorie: 'ACHAT', createdBy: user?.nom
                                };
                                setTransactions(prev => [tr, ...prev]);
                            }
                        }} 
                        onUpdateOrder={(o) => setCommandesFournisseurs(prev => prev.map(cmd => cmd.id === o.id ? o : cmd))} 
                        onReceiveOrder={handleReceiveProcurementOrder} 
                        onAddPayment={handleAddProcurementPayment} 
                        onUpdateArticle={(a) => setArticles(prev => prev.map(art => art.id === a.id ? a : art))} 
                        onArchiveOrder={(id) => setCommandesFournisseurs(prev => prev.map(c => c.id === id ? { ...c, archived: true } : c))} 
                        comptes={comptes} 
                    />}
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
