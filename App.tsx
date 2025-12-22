
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

    const handleLogin = (u: SessionUser) => setUser(u);
    const handleLogout = () => setUser(null);

    const handleAddClient = (c: Client) => setClients(prev => [...prev, c]);
    const handleUpdateClient = (c: Client) => setClients(prev => prev.map(cli => cli.id === c.id ? c : cli));
    const handleDeleteClient = (id: string) => {
        if (window.confirm("CETTE ACTION EST DÉFINITIVE.\n\nVoulez-vous supprimer ce client et toutes ses mesures ?")) {
            setClients(prev => prev.filter(c => c.id !== id));
        }
    };

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

    const handleAddEmploye = (e: Employe) => setEmployes(prev => [...prev, e]);
    const handleUpdateEmploye = (e: Employe) => setEmployes(prev => prev.map(emp => emp.id === e.id ? e : emp));
    const handleDeleteEmploye = (id: string) => setEmployes(prev => prev.map(e => e.id === id ? { ...e, actif: false } : e));

    const handleAddArticle = (a: Article) => setArticles(prev => [...prev, a]);
    const handleUpdateArticle = (a: Article) => setArticles(prev => prev.map(art => art.id === a.id ? a : art));

    const handleAddMouvement = (m: MouvementStock) => {
        setMouvements(prev => [m, ...prev]);
        setArticles(prev => prev.map(art => {
            if (art.id === m.articleId) {
                const newStock = { ...art.stockParLieu };
                if (!newStock[m.lieuId]) newStock[m.lieuId] = {};
                newStock[m.lieuId][m.variante] = (newStock[m.lieuId][m.variante] || 0) + m.quantite;
                return { ...art, stockParLieu: newStock };
            }
            return art;
        }));
    };

    const handleUpdateOrder = (o: Commande) => setCommandes(prev => prev.map(cmd => cmd.id === o.id ? o : cmd));
    const handleAddTransaction = (t: TransactionTresorerie) => setTransactions(prev => [t, ...prev]);

    const handleClearData = () => {
        if(window.confirm("CETTE ACTION EST IRREVERSIBLE. Voulez-vous vraiment effacer TOUTES les données ?")) {
            setClients([]); setCommandes([]); setDepenses([]); setMouvements([]); setTransactions([]); setPointages([]);
            alert("Données effacées.");
        }
    };

    const availableViews = useMemo(() => {
        if (!user) return [];
        const role = user.role;
        if (role === RoleEmploye.ADMIN || role === RoleEmploye.GERANT) return ['dashboard', 'ventes', 'production', 'stock', 'approvisionnement', 'fournisseurs', 'rh', 'clients', 'finance', 'catalogue', 'galerie', 'catalogue-public'];
        if (role === RoleEmploye.VENDEUR) return ['dashboard', 'ventes', 'clients', 'catalogue-public', 'galerie', 'finance'];
        if (role === RoleEmploye.CHEF_ATELIER) return ['dashboard', 'production', 'stock', 'approvisionnement', 'fournisseurs', 'clients', 'galerie'];
        if (role === RoleEmploye.GARDIEN) return ['rh'];
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
                    <div className="w-10"></div>
                </header>
                <div className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8 custom-scrollbar">
                    {currentView === 'dashboard' && <Dashboard commandes={commandes} employes={employes} depenses={depenses} clients={clients} />}
                    {currentView === 'ventes' && <SalesView articles={articles} boutiques={boutiques} clients={clients} commandes={commandes} 
                        onMakeSale={(d:any) => {
                            const newCmd: Commande = { id: `CMD_VTE_${Date.now()}`, clientId: d.clientId, clientNom: d.clientName, boutiqueId: d.boutiqueId, description: d.items.map((i:any) => `${i.nom} x${i.quantite}`).join(', '), dateCommande: new Date().toISOString(), dateLivraisonPrevue: new Date().toISOString(), statut: StatutCommande.LIVRE, tailleursIds: [], prixTotal: d.total, avance: d.montantRecu, reste: Math.max(0, d.total - d.montantRecu), type: 'PRET_A_PORTER', quantite: d.items.reduce((acc:number, i:any)=>acc+i.quantite, 0), detailsVente: d.items.map((i:any) => ({ nomArticle: i.nom, variante: i.variante, quantite: i.quantite, prixUnitaire: i.prix })), paiements: d.montantRecu > 0 ? [{ id: `P_${Date.now()}`, date: new Date().toISOString(), montant: d.montantRecu, moyenPaiement: d.method }] : [] };
                            setCommandes(prev => [newCmd, ...prev]);
                            if (d.montantRecu > 0 && d.accountId) { setTransactions(prev => [{ id: `TR_VTE_${Date.now()}`, date: new Date().toISOString(), type: 'ENCAISSEMENT', montant: d.montantRecu, compteId: d.accountId, description: `Vente #${newCmd.id.slice(-6)}`, categorie: 'VENTE' }, ...prev]); setComptes(prev => prev.map(c => c.id === d.accountId ? { ...c, solde: c.solde + d.montantRecu } : c)); }
                        }} 
                        onAddPayment={(id, amt, meth, note, date, acc) => { setCommandes(prev => prev.map(c => c.id === id ? { ...c, avance: c.avance + amt, reste: Math.max(0, c.reste - amt), paiements: [...(c.paiements || []), { id: `P_${Date.now()}`, date, montant: amt, moyenPaiement: meth, note }] } : c)); if (acc) { setTransactions(prev => [{ id: `TR_PAY_${Date.now()}`, date: new Date().toISOString(), type: 'ENCAISSEMENT', montant: amt, compteId: acc, description: `Encaissement Vente #${id.slice(-6)}`, categorie: 'VENTE' }, ...prev]); setComptes(prev => prev.map(c => c.id === acc ? { ...c, solde: c.solde + amt } : c)); } }} 
                        onCancelSale={(id, acc) => { setCommandes(prev => prev.map(c => c.id === id ? { ...c, statut: StatutCommande.ANNULE } : c)); }} 
                        comptes={comptes} companyAssets={companyAssets} 
                    />}
                    {currentView === 'production' && <ProductionView commandes={commandes} employes={employes} clients={clients} articles={articles} userRole={user.role} onUpdateStatus={(id, s) => setCommandes(prev => prev.map(c => c.id === id ? { ...c, statut: s } : c))} onCreateOrder={(o, cons, meth, acc) => { setCommandes(prev => [o, ...prev]); if (o.avance > 0 && acc) setComptes(prev => prev.map(c => c.id === acc ? { ...c, solde: c.solde + o.avance } : c)); }} onUpdateOrder={handleUpdateOrder} onAddPayment={(id, amt, meth, note, date, acc) => { setCommandes(prev => prev.map(c => c.id === id ? { ...c, avance: c.avance + amt, reste: Math.max(0, c.reste - amt), paiements: [...(c.paiements || []), { id: `P_${Date.now()}`, date, montant: amt, moyenPaiement: meth, note }] } : c)); if (acc) setComptes(prev => prev.map(c => c.id === acc ? { ...c, solde: c.solde + amt } : c)); }} onArchiveOrder={(id) => setCommandes(prev => prev.map(c => c.id === id ? { ...c, archived: true } : c))} comptes={comptes} companyAssets={companyAssets} />}
                    {currentView === 'catalogue' && <ArticlesView articles={articles} onAddArticle={handleAddArticle} onUpdateArticle={handleUpdateArticle} />}
                    {currentView === 'stock' && <StockView articles={articles} boutiques={boutiques} mouvements={mouvements} userRole={user.role} onAddMouvement={handleAddMouvement} onAddBoutique={(b) => setBoutiques(prev => [...prev, b])} />}
                    {currentView === 'rh' && <HRView employes={employes} boutiques={boutiques} onAddEmploye={handleAddEmploye} onUpdateEmploye={handleUpdateEmploye} onDeleteEmploye={handleDeleteEmploye} onAddDepense={handleAddDepense} depenses={depenses} onDeleteDepense={handleDeleteDepense} onUpdateDepense={handleUpdateDepense} pointages={pointages} onAddPointage={(p) => setPointages(prev => [...prev, p])} onUpdatePointage={(p) => setPointages(prev => prev.map(old => old.id === p.id ? p : old))} currentUser={user} comptes={comptes} onUpdateComptes={setComptes} onAddTransaction={handleAddTransaction} />}
                    {currentView === 'clients' && <ClientsView clients={clients} commandes={commandes} onAddClient={handleAddClient} onUpdateClient={handleUpdateClient} onDeleteClient={handleDeleteClient} />}
                    {currentView === 'finance' && <FinanceView depenses={depenses} commandes={commandes} boutiques={boutiques} onAddDepense={handleAddDepense} onDeleteDepense={handleDeleteDepense} onUpdateDepense={handleUpdateDepense} userRole={user.role} fournisseurs={fournisseurs} commandesFournisseurs={commandesFournisseurs} clients={clients} comptes={comptes} transactions={transactions} onUpdateComptes={setComptes} onAddTransaction={handleAddTransaction} />}
                    {currentView === 'galerie' && <GalleryView items={galleryItems} onAddItem={(i) => setGalleryItems(prev => [i, ...prev])} onDeleteItem={(id) => setGalleryItems(prev => prev.filter(i => i.id !== id))} />}
                    {currentView === 'catalogue-public' && <PublicCatalogView articles={articles} />}
                    {currentView === 'settings' && <SettingsView fullData={{ boutiques, employes, pointages, clients, commandes, depenses, articles, commandesFournisseurs, fournisseurs, mouvements, comptes, transactions, galleryItems }} onRestore={(d) => { setClients(d.clients || []); setCommandes(d.commandes || []); } } onImport={(t, d) => { if(t === 'CLIENTS') setClients(prev => [...prev, ...d]); if(t === 'ARTICLES') setArticles(prev => [...prev, ...d]); }} onClearData={handleClearData} companyAssets={companyAssets} onUpdateAssets={setCompanyAssets} />}
                </div>
            </main>
        </div>
    );
};

export default App;
