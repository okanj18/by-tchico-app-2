
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

    // États synchronisés avec LocalStorage et Firestore
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

    // Handlers
    const handleLogin = (u: SessionUser) => {
        setUser(u);
        if (u.role === RoleEmploye.GARDIEN) setView('rh');
        else setView('dashboard');
    };
    
    const handleLogout = () => setUser(null);

    const handleAddEmploye = (e: Employe) => setEmployes(prev => [...prev, e]);
    const handleUpdateEmploye = (e: Employe) => setEmployes(prev => prev.map(emp => emp.id === e.id ? e : emp));
    const handleUpdateEmployes = (updates: Employe[]) => {
        setEmployes(prev => prev.map(emp => {
            const update = updates.find(u => u.id === emp.id);
            return update || emp;
        }));
    };
    
    const handleAddClient = (c: Client) => setClients(prev => [...prev, c]);
    const handleUpdateClient = (c: Client) => setClients(prev => prev.map(cli => cli.id === c.id ? c : cli));
    const handleDeleteClient = (id: string) => setClients(prev => prev.filter(c => c.id !== id));

    const handleUpdateOrder = (o: Commande) => setCommandes(prev => prev.map(cmd => cmd.id === o.id ? o : cmd));

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

    const handleClearAllData = async () => {
        if (!window.confirm("⚠️ ATTENTION : Cette action va réinitialiser TOUTES les données de l'entreprise (Ventes, Clients, Production, etc.). Cette opération est irréversible. Confirmer ?")) return;

        setBoutiques(mockBoutiques);
        setEmployes(mockEmployes);
        setPointages(mockPointages);
        setClients([]);
        setCommandes([]);
        setDepenses([]);
        setArticles([]);
        setCommandesFournisseurs([]);
        setFournisseurs([]);
        setMouvements([]);
        setComptes(mockComptes);
        setTransactions([]);
        setGalleryItems([]);
        setCompanyAssets(mockCompanyAssets);

        localStorage.clear();
        alert("Données réinitialisées avec succès. L'application va redémarrer.");
        window.location.reload();
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
    };

    const handleImportCSVData = (type: string, data: any[]) => {
        switch(type) {
            case 'CLIENTS': setClients(prev => [...prev, ...data]); break;
            case 'ARTICLES': setArticles(prev => [...prev, ...data]); break;
            case 'EMPLOYES': setEmployes(prev => [...prev, ...data]); break;
            case 'FOURNISSEURS': setFournisseurs(prev => [...prev, ...data]); break;
            case 'DEPENSES': setDepenses(prev => [...prev, ...data]); break;
            case 'POINTAGE': setPointages(prev => [...prev, ...data]); break;
        }
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
            <Sidebar 
                currentView={currentView} 
                setView={setView} 
                isOpen={sidebarOpen} 
                setIsOpen={setSidebarOpen} 
                availableViews={availableViews} 
                user={user} 
                onLogout={handleLogout} 
                commandes={commandes}
                articles={articles}
            />
            <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
                <header className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between md:hidden">
                    <button onClick={() => setSidebarOpen(true)} className="p-2 -ml-2 text-gray-600"><Menu size={24} /></button>
                    <h1 className="text-lg font-bold text-brand-900 text-center flex-1">BY TCHICO</h1>
                </header>
                <div className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8 custom-scrollbar">
                    {currentView === 'dashboard' && <Dashboard commandes={commandes} employes={employes} depenses={depenses} clients={clients} />}
                    {currentView === 'ventes' && <SalesView articles={articles} boutiques={boutiques} clients={clients} commandes={commandes} onMakeSale={(s) => { setCommandes(prev => [s.order, ...prev]); if(s.transaction) setTransactions(prev => [s.transaction, ...prev]); if(s.newComptes) setComptes(s.newComptes); }} onAddPayment={handleGlobalAddPayment} comptes={comptes} onCancelSale={() => {}} companyAssets={companyAssets} />}
                    {currentView === 'production' && <ProductionView commandes={commandes} employes={employes} clients={clients} articles={articles} userRole={user.role} onUpdateStatus={(id, s) => setCommandes(prev => prev.map(c => c.id === id ? { ...c, statut: s } : c))} onCreateOrder={(o, cons, meth, acc) => { setCommandes(prev => [o, ...prev]); if (o.avance > 0 && acc) { setComptes(prev => prev.map(c => c.id === acc ? { ...c, solde: c.solde + o.avance } : c)); const acTransaction: TransactionTresorerie = { id: `TR_AC_${Date.now()}`, date: new Date().toISOString().split('T')[0], type: 'ENCAISSEMENT', montant: o.avance, compteId: acc, description: `Acompte initial : ${o.clientNom} (Cmd ${o.id.slice(-6)})`, categorie: 'VENTE', createdBy: user?.nom }; setTransactions(prev => [acTransaction, ...prev]); } }} onUpdateOrder={handleUpdateOrder} onAddPayment={handleGlobalAddPayment} onArchiveOrder={(id) => setCommandes(prev => prev.map(c => c.id === id ? { ...c, archived: true } : c))} comptes={comptes} companyAssets={companyAssets} />}
                    {currentView === 'stock' && <StockView articles={articles} boutiques={boutiques} mouvements={mouvements} userRole={user.role} onAddMouvement={(m) => setMouvements(prev => [m, ...prev])} onAddBoutique={(b) => setBoutiques(prev => [...prev, b])} onUpdateBoutique={(b) => setBoutiques(prev => prev.map(item => item.id === b.id ? b : item))} onDeleteBoutique={(id) => setBoutiques(prev => prev.filter(b => b.id !== id))} />}
                    {currentView === 'approvisionnement' && <ProcurementView commandesFournisseurs={commandesFournisseurs} fournisseurs={fournisseurs} articles={articles} boutiques={boutiques} onAddOrder={(o, accId) => { setCommandesFournisseurs(prev => [o, ...prev]); if (o.montantPaye > 0 && accId) setComptes(prev => prev.map(c => c.id === accId ? { ...c, solde: c.solde - o.montantPaye } : c)); }} onUpdateOrder={(o) => setCommandesFournisseurs(prev => prev.map(cmd => cmd.id === o.id ? o : cmd))} onReceiveOrder={() => {}} onAddPayment={() => {}} onUpdateArticle={() => {}} onArchiveOrder={(id) => setCommandesFournisseurs(prev => prev.map(c => c.id === id ? { ...c, archived: true } : c))} comptes={comptes} />}
                    {currentView === 'fournisseurs' && <SuppliersView fournisseurs={fournisseurs} commandesFournisseurs={commandesFournisseurs} onAddFournisseur={(f) => setFournisseurs(prev => [...prev, f])} onUpdateFournisseur={(f) => setFournisseurs(prev => prev.map(item => item.id === f.id ? f : item))} onDeleteFournisseur={(id) => setFournisseurs(prev => prev.filter(f => f.id !== id))} onAddPayment={() => {}} comptes={comptes} />}
                    {currentView === 'rh' && <HRView employes={employes} boutiques={boutiques} onAddEmploye={handleAddEmploye} onUpdateEmploye={handleUpdateEmploye} onDeleteEmploye={(id) => setEmployes(prev => prev.filter(e => e.id !== id))} onArchiveEmploye={(id) => setEmployes(prev => prev.map(e => e.id === id ? {...e, actif: !e.actif} : e))} onAddDepense={(d) => setDepenses(prev => [d, ...prev])} depenses={depenses} onDeleteDepense={(id) => setDepenses(prev => prev.filter(d => d.id !== id))} onUpdateDepense={(d) => setDepenses(prev => prev.map(item => item.id === d.id ? d : item))} pointages={pointages} onAddPointage={(p) => setPointages(prev => [...prev, p])} onUpdatePointage={(p) => setPointages(prev => prev.map(item => item.id === p.id ? p : item))} currentUser={user} comptes={comptes} onUpdateComptes={setComptes} onAddTransaction={(t) => setTransactions(prev => [t, ...prev])} onUpdateEmployes={handleUpdateEmployes} />}
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
