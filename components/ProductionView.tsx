
import React, { useState, useMemo, useEffect } from 'react';
import { Commande, Employe, Client, Article, StatutCommande, RoleEmploye, Consommation, CompteFinancier, CompanyAssets, ModePaiement, TacheProduction, ActionProduction, ElementCommande, LivraisonPartielle, Boutique } from '../types';
import { Scissors, Search, Plus, Eye, Edit2, Trash2, X, Save, DollarSign, ClipboardList, UserPlus, Calendar, Layout, Users, Trophy, ChevronLeft, ChevronRight as ChevronRightIcon, Check, Square, CheckSquare, User as UserIcon, List, Ban, CreditCard, Clock, Package, Truck, UserCheck, AlertTriangle, Phone, Info, History, CheckCircle2, Store, Filter } from 'lucide-react';

interface ProductionViewProps {
    commandes: Commande[];
    employes: Employe[];
    clients: Client[];
    articles: Article[];
    userRole: RoleEmploye;
    userBoutiqueId?: string;
    onUpdateStatus: (id: string, s: StatutCommande | string) => void;
    onCreateOrder: (o: Commande, cons: Consommation[], method: ModePaiement, accId?: string) => void;
    onUpdateOrder: (o: Commande, accId?: string) => void;
    onAddPayment: (orderId: string, amount: number, method: ModePaiement, note: string, date: string, accId?: string) => void;
    onUpdatePayment: (orderId: string, paymentId: string, newAmount: number, date: string, accId: string) => void;
    onDeletePayment: (orderId: string, paymentId: string, accId: string) => void;
    onAddTask: (orderId: string, task: TacheProduction) => void;
    onUpdateTask: (orderId: string, taskId: string, newStatut: 'A_FAIRE' | 'FAIT') => void;
    onArchiveOrder: (id: string) => void;
    comptes: CompteFinancier[];
    boutiques: Boutique[];
    companyAssets: CompanyAssets;
}

const ProductionView: React.FC<ProductionViewProps> = ({ 
    commandes, employes, clients, articles, userRole, userBoutiqueId,
    onUpdateStatus, onCreateOrder, onUpdateOrder, onAddPayment, onUpdatePayment, onDeletePayment, onAddTask, onUpdateTask, onArchiveOrder, comptes, boutiques, companyAssets 
}) => {
    const [activeNav, setActiveNav] = useState<'COMMANDES' | 'AGENDA' | 'KANBAN' | 'ARTISANS' | 'PERFORMANCE'>('COMMANDES');
    const [searchTerm, setSearchTerm] = useState('');
    const [activeFilterTab, setActiveFilterTab] = useState<'EN_COURS' | 'PRETS' | 'TOUTES'>('EN_COURS');

    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [boutiqueFilter, setBoutiqueFilter] = useState('ALL');

    const [orderModalOpen, setOrderModalOpen] = useState(false);
    const [isEditingOrder, setIsEditingOrder] = useState(false);
    const [detailModalOpen, setDetailModalOpen] = useState(false);
    const [paymentModalOpen, setPaymentModalOpen] = useState(false);
    const [taskModalOpen, setTaskModalOpen] = useState(false);
    const [deliveryModalOpen, setDeliveryModalOpen] = useState(false);
    
    const [selectedOrder, setSelectedOrder] = useState<Commande | null>(null);
    const [newOrderData, setNewOrderData] = useState<Partial<Commande>>({
        clientId: '', prixTotal: 0, avance: 0, dateLivraisonPrevue: '', elements: [], consommations: [], description: '', boutiqueId: ''
    });
    const [initialAccountId, setInitialAccountId] = useState('');
    const [clientSearchTerm, setClientSearchTerm] = useState('');
    const [showClientResults, setShowClientResults] = useState(false);

    const [tempElement, setTempElement] = useState<{nom: string, quantite: number}>({ nom: '', quantite: 1 });
    const [tempCons, setTempCons] = useState<Consommation>({ articleId: '', variante: 'Standard', quantite: 0 });
    const [payData, setPayData] = useState({ amount: 0, method: 'ESPECE' as ModePaiement, accId: '', date: new Date().toISOString().split('T')[0], note: '', editingPaymentId: null as string | null });
    
    const [multiTasks, setMultiTasks] = useState<Partial<TacheProduction>[]>([]);
    const [taskBaseData, setTaskBaseData] = useState({ commandeId: '', tailleurId: '', date: new Date().toISOString().split('T')[0] });

    const [deliveryQtys, setDeliveryQtys] = useState<Record<string, number>>({});

    const [agendaDate, setAgendaDate] = useState(new Date());

    const tailleurs = useMemo(() => employes.filter(e => 
        (e.role === RoleEmploye.TAILLEUR || 
         e.role === RoleEmploye.CHEF_ATELIER || 
         e.role === RoleEmploye.STAGIAIRE || 
         e.role === RoleEmploye.ASSISTANT) && 
        e.actif !== false
    ), [employes]);

    const isVendeur = userRole === RoleEmploye.VENDEUR;

    const searchedClients = useMemo(() => {
        if (!clientSearchTerm) return [];
        return clients.filter(c => c.nom.toLowerCase().includes(clientSearchTerm.toLowerCase()) || c.telephone.includes(clientSearchTerm)).slice(0, 5);
    }, [clients, clientSearchTerm]);

    const selectedClientName = useMemo(() => clients.find(c => c.id === newOrderData.clientId)?.nom || '', [clients, newOrderData.clientId]);

    const filteredCommandes = useMemo(() => {
        return commandes.filter(c => {
            if (c.archived) return false;
            if (isVendeur && userBoutiqueId && c.boutiqueId !== userBoutiqueId) return false;
            if (boutiqueFilter !== 'ALL' && c.boutiqueId !== boutiqueFilter) return false;

            const cmdDate = new Date(c.dateCommande).getTime();
            if (startDate) {
                const start = new Date(startDate).setHours(0, 0, 0, 0);
                if (cmdDate < start) return false;
            }
            if (endDate) {
                const end = new Date(endDate).setHours(23, 59, 59, 999);
                if (cmdDate > end) return false;
            }

            const matchesSearch = c.clientNom.toLowerCase().includes(searchTerm.toLowerCase()) || c.id.toLowerCase().includes(searchTerm.toLowerCase());
            let matchesTab = true;
            if (activeFilterTab === 'EN_COURS') matchesTab = c.statut !== StatutCommande.LIVRE && c.statut !== StatutCommande.ANNULE;
            else if (activeFilterTab === 'PRETS') matchesTab = c.statut === StatutCommande.PRET;
            return matchesSearch && matchesTab;
        }).sort((a, b) => new Date(b.dateCommande).getTime() - new Date(a.dateCommande).getTime());
    }, [commandes, searchTerm, activeFilterTab, isVendeur, userBoutiqueId, boutiqueFilter, startDate, endDate]);

    useEffect(() => {
        if (orderModalOpen && !isEditingOrder && isVendeur && userBoutiqueId) {
            setNewOrderData(prev => ({ ...prev, boutiqueId: userBoutiqueId }));
            const shopAccount = comptes.find(c => c.boutiqueId === userBoutiqueId && c.type === 'CAISSE');
            if (shopAccount) setInitialAccountId(shopAccount.id);
        }
    }, [orderModalOpen, isEditingOrder, isVendeur, userBoutiqueId, comptes]);

    const getKanbanPieces = (status: StatutCommande) => {
        const result: { order: Commande, element: string, qty: number, total: number, isAssigned: boolean, artisanName?: string, action?: ActionProduction }[] = [];
        commandes.forEach(cmd => {
            if (cmd.archived || cmd.statut === StatutCommande.ANNULE || cmd.statut === StatutCommande.LIVRE) return;
            if (isVendeur && userBoutiqueId && cmd.boutiqueId !== userBoutiqueId) return;

            cmd.elements?.forEach(el => {
                const taches = (cmd.taches || []).filter(t => t.elementNom === el.nom);
                
                const qtyCoupeFait = taches.filter(t => t.action === 'COUPE' && t.statut === 'FAIT').reduce((s, t) => s + t.quantite, 0);
                const qtyCoutureFait = taches.filter(t => t.action === 'COUTURE' && t.statut === 'FAIT').reduce((s, t) => s + t.quantite, 0);
                const qtyFinitionFait = taches.filter(t => t.action === 'FINITION' && t.statut === 'FAIT').reduce((s, t) => s + t.quantite, 0);

                const tCoupe = taches.find(t => t.action === 'COUPE' && t.statut === 'A_FAIRE');
                const tCouture = taches.find(t => t.action === 'COUTURE' && t.statut === 'A_FAIRE');
                const tFinition = taches.find(t => t.action === 'FINITION' && t.statut === 'A_FAIRE');

                if (status === StatutCommande.EN_ATTENTE) {
                    const totalAssignedCoupe = taches.filter(t => t.action === 'COUPE').reduce((s,t) => s + t.quantite, 0);
                    const waiting = el.quantiteTotal - totalAssignedCoupe;
                    if (waiting > 0) result.push({ order: cmd, element: el.nom, qty: waiting, total: el.quantiteTotal, isAssigned: false, action: 'COUPE' });
                }
                
                if (status === StatutCommande.EN_COUPE && tCoupe) {
                    const artisan = employes.find(e => e.id === tCoupe.tailleurId)?.nom;
                    result.push({ order: cmd, element: el.nom, qty: tCoupe.quantite, total: el.quantiteTotal, isAssigned: true, artisanName: artisan });
                }

                if (status === StatutCommande.COUTURE) {
                    const totalAssignedCouture = taches.filter(t => t.action === 'COUTURE').reduce((s,t) => s + t.quantite, 0);
                    const waitingCouture = qtyCoupeFait - totalAssignedCouture;
                    if (waitingCouture > 0) result.push({ order: cmd, element: el.nom, qty: waitingCouture, total: el.quantiteTotal, isAssigned: false, action: 'COUTURE' });
                    if (tCouture) {
                        const artisan = employes.find(e => e.id === tCouture.tailleurId)?.nom;
                        result.push({ order: cmd, element: el.nom, qty: tCouture.quantite, total: el.quantiteTotal, isAssigned: true, artisanName: artisan });
                    }
                }

                if (status === StatutCommande.FINITION) {
                    const totalAssignedFinition = taches.filter(t => t.action === 'FINITION').reduce((s,t) => s + t.quantite, 0);
                    const waitingFinition = qtyCoutureFait - totalAssignedFinition;
                    if (waitingFinition > 0) result.push({ order: cmd, element: el.nom, qty: waitingFinition, total: el.quantiteTotal, isAssigned: false, action: 'FINITION' });
                    if (tFinition) {
                        const artisan = employes.find(e => e.id === tFinition.tailleurId)?.nom;
                        result.push({ order: cmd, element: el.nom, qty: tFinition.quantite, total: el.quantiteTotal, isAssigned: true, artisanName: artisan });
                    }
                }

                if (status === StatutCommande.PRET && qtyFinitionFait > 0) {
                    result.push({ order: cmd, element: el.nom, qty: qtyFinitionFait, total: el.quantiteTotal, isAssigned: false });
                }
            });
        });
        return result;
    };

    const handleCreateOrUpdateOrder = () => {
        if (!newOrderData.clientId || !newOrderData.prixTotal || !newOrderData.elements?.length) {
            alert("Client, prix et composition requis."); return;
        }

        if ((newOrderData.avance || 0) > (newOrderData.prixTotal || 0)) {
            alert("Le montant de l'acompte ne peut pas être supérieur au montant total de la commande.");
            return;
        }

        if (isEditingOrder && selectedOrder) {
            const totalPaiementsDejaFaits = selectedOrder.paiements?.reduce((acc, p) => acc + p.montant, 0) || 0;
            if ((newOrderData.avance || 0) + totalPaiementsDejaFaits > (newOrderData.prixTotal || 0)) {
                const totalActuel = (newOrderData.avance || 0) + totalPaiementsDejaFaits;
                alert(`Erreur : Le cumul de l'acompte (${(newOrderData.avance || 0).toLocaleString()} F) et des versements déjà enregistrés (${totalPaiementsDejaFaits.toLocaleString()} F) s'élève à ${totalActuel.toLocaleString()} F, ce qui dépasse le nouveau prix total.`);
                return;
            }
        }

        if (newOrderData.avance! > 0 && !initialAccountId) {
            alert("Veuillez sélectionner une caisse pour l'acompte."); return;
        }

        if (isEditingOrder && selectedOrder) {
            onUpdateOrder({ ...selectedOrder, ...newOrderData } as Commande, initialAccountId);
        } else {
            const order: Commande = { 
                id: `CMD_${Date.now()}`, clientId: newOrderData.clientId || '', clientNom: selectedClientName, 
                description: newOrderData.description || 'Sur Mesure', dateCommande: new Date().toISOString(), 
                dateLivraisonPrevue: newOrderData.dateLivraisonPrevue || '', statut: StatutCommande.EN_ATTENTE, 
                tailleursIds: [], prixTotal: newOrderData.prixTotal, avance: newOrderData.avance || 0, 
                reste: Math.max(0, newOrderData.prixTotal - (newOrderData.avance || 0)), type: 'SUR_MESURE', 
                quantite: newOrderData.elements!.reduce((acc, el) => acc + el.quantiteTotal, 0), 
                taches: [], paiements: [], consommations: newOrderData.consommations || [], elements: newOrderData.elements!, livraisons: [],
                boutiqueId: newOrderData.boutiqueId || userBoutiqueId || 'ATELIER'
            };
            onCreateOrder(order, newOrderData.consommations || [], 'ESPECE', initialAccountId);
        }
        setOrderModalOpen(false);
    };

    const handleAddConsommation = () => {
        const qty = typeof tempCons.quantite === 'string' ? parseFloat((tempCons.quantite as string).replace(',', '.')) : tempCons.quantite;
        if (!tempCons.articleId || isNaN(qty) || qty <= 0) { alert("Veuillez choisir un article et saisir une quantité valide."); return; }
        const art = articles.find(a => a.id === tempCons.articleId);
        if (!art) return;
        const stock = art.stockParLieu['ATELIER']?.[tempCons.variante] || 0;
        if (stock < qty) { alert(`Stock insuffisant à l'Atelier (${stock} ${art.unite} dispo).`); return; }
        setNewOrderData({ ...newOrderData, consommations: [...(newOrderData.consommations || []), { ...tempCons, quantite: qty, id: `CONS_${Date.now()}` }] });
        setTempCons({ articleId: '', variante: 'Standard', quantite: 0 });
    };

    const isTaskAssignmentInvalid = useMemo(() => {
        if (!taskBaseData.commandeId || !taskBaseData.tailleurId || multiTasks.length === 0) return true;
        const cmd = commandes.find(c => c.id === taskBaseData.commandeId);
        if (!cmd) return true;
        return multiTasks.some(t => {
            if (!t.elementNom || !t.quantite || t.quantite <= 0) return true;
            const element = cmd.elements?.find(el => el.nom === t.elementNom);
            const assignedAlready = cmd.taches?.filter(tk => tk.elementNom === t.elementNom && tk.action === t.action).reduce((s: number, tk) => s + tk.quantite, 0) || 0;
            const maxAllowed = element ? element.quantiteTotal - assignedAlready : 0;
            return t.quantite > maxAllowed;
        });
    }, [taskBaseData, multiTasks, commandes]);

    return (
        <div className="space-y-6">
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
                <div className="flex items-center gap-4">
                    <div className="p-3 bg-brand-900 text-white rounded-2xl shadow-xl"><Scissors size={32} /></div>
                    <div><h2 className="text-3xl font-black text-gray-800 tracking-tighter uppercase leading-none">Atelier <br/> BY TCHICO</h2></div>
                </div>
                <div className="bg-white p-1.5 rounded-2xl shadow-sm border border-gray-100 flex flex-wrap gap-1">
                    {[
                        { id: 'COMMANDES', label: 'Commandes', icon: ClipboardList },
                        { id: 'AGENDA', label: 'Agenda', icon: Calendar },
                        { id: 'KANBAN', label: 'Kanban Flux', icon: Layout },
                        { id: 'ARTISANS', label: 'Artisans', icon: Users },
                        { id: 'PERFORMANCE', label: 'Palmarès', icon: Trophy }
                    ].map(nav => (
                        <button key={nav.id} onClick={() => setActiveNav(nav.id as any)} className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2 transition-all ${activeNav === nav.id ? 'bg-brand-900 text-white shadow-lg scale-105' : 'text-gray-400 hover:bg-gray-50'}`}>
                            <nav.icon size={14}/> {nav.label}
                        </button>
                    ))}
                </div>
                <div className="flex gap-2">
                    <button onClick={() => { setIsEditingOrder(false); setOrderModalOpen(true); setNewOrderData({ clientId: '', prixTotal: 0, avance: 0, elements: [], consommations: [], description: '', boutiqueId: userBoutiqueId || '' }); setInitialAccountId(''); }} className="bg-brand-900 text-white px-6 py-3.5 rounded-xl font-black uppercase text-[10px] tracking-widest shadow-xl flex items-center gap-2 active:scale-95 transition-all">
                        <Plus size={18}/> Nouvelle Commande
                    </button>
                    {userRole !== RoleEmploye.VENDEUR && (
                        <button onClick={() => { setTaskBaseData({ commandeId: '', tailleurId: '', date: new Date().toISOString().split('T')[0] }); setMultiTasks([{ elementNom: '', action: 'COUPE', quantite: 1 }]); setTaskModalOpen(true); }} className="bg-[#ff4e00] hover:bg-[#e64600] text-white px-6 py-3.5 rounded-xl font-black uppercase text-[10px] tracking-widest shadow-xl flex items-center gap-2 active:scale-95 transition-all">
                            <UserPlus size={18}/> Assigner Tâche
                        </button>
                    )}
                </div>
            </div>

            {activeNav === 'COMMANDES' && (
                <div className="bg-white rounded-[2rem] shadow-sm border border-gray-100 overflow-hidden animate-in fade-in">
                    <div className="p-6 border-b space-y-4">
                         <div className="flex flex-col md:flex-row justify-between gap-4">
                            <div className="flex gap-2 overflow-x-auto no-scrollbar">
                                {['EN_COURS','PRETS','TOUTES'].map(t=><button key={t} onClick={()=>setActiveFilterTab(t as any)} className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeFilterTab===t?'bg-brand-50 text-brand-900 shadow-sm':'text-gray-400'}`}>{t.replace('_',' ')}</button>)}
                            </div>
                            <div className="relative w-full md:w-80">
                                <Search className="absolute left-4 top-2.5 text-gray-300" size={18}/>
                                <input type="text" placeholder="Rechercher..." value={searchTerm} onChange={e=>setSearchTerm(e.target.value)} className="w-full pl-11 pr-4 py-2 bg-gray-50 border-2 border-transparent rounded-xl text-sm font-bold focus:border-brand-500 outline-none transition-all"/>
                            </div>
                         </div>
                         <div className="flex flex-wrap gap-6 items-center bg-gray-50/50 p-4 rounded-2xl border border-gray-100 shadow-inner">
                            <div className="flex items-center gap-3">
                                <Calendar size={14} className="text-brand-600"/>
                                <span className="text-[10px] font-black uppercase text-gray-400">Période :</span>
                                <div className="flex items-center gap-2 bg-white p-1 rounded-xl border">
                                    <input type="date" value={startDate} onChange={e=>setStartDate(e.target.value)} className="p-1.5 border-none bg-transparent text-[10px] font-black uppercase outline-none focus:ring-0"/>
                                    <span className="text-[9px] font-black text-gray-300">AU</span>
                                    <input type="date" value={endDate} onChange={e=>setEndDate(e.target.value)} className="p-1.5 border-none bg-transparent text-[10px] font-black uppercase outline-none focus:ring-0"/>
                                </div>
                                {(startDate || endDate) && <button onClick={()=>{setStartDate(''); setEndDate('');}} className="p-1 text-gray-300 hover:text-red-500"><X size={14}/></button>}
                            </div>
                            {!isVendeur && (
                                <div className="flex items-center gap-3">
                                    <Store size={14} className="text-brand-600"/>
                                    <span className="text-[10px] font-black uppercase text-gray-400">Provenance :</span>
                                    <select value={boutiqueFilter} onChange={e=>setBoutiqueFilter(e.target.value)} className="bg-white px-3 py-2 border rounded-xl text-[10px] font-black uppercase outline-none focus:ring-2 focus:ring-brand-500 transition-all shadow-sm">
                                        <option value="ALL">Toutes les Boutiques</option>
                                        <option value="ATELIER">Atelier Central</option>
                                        {boutiques.map(b => <option key={b.id} value={b.id}>{b.nom}</option>)}
                                    </select>
                                </div>
                            )}
                         </div>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-gray-50 text-[10px] font-black uppercase text-gray-400 tracking-widest border-b">
                                <tr><th className="p-6">Référence & Client</th><th className="p-6">Provenance</th><th className="p-6">Composition</th><th className="p-6 text-center">Finance</th><th className="p-6 text-center">État Global</th><th className="p-6 text-right">Actions</th></tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {filteredCommandes.map(cmd => {
                                    const boutiqueOrigine = boutiques.find(b => b.id === cmd.boutiqueId);
                                    return (
                                        <tr key={cmd.id} className="hover:bg-brand-50/20">
                                            <td className="p-6"><div><p className="font-black text-gray-800 uppercase tracking-tighter text-base">{cmd.clientNom}</p><p className="text-[10px] text-gray-400 font-bold">#{cmd.id.slice(-6)} • {new Date(cmd.dateCommande).toLocaleDateString()}</p></div></td>
                                            <td className="p-6"><div className="flex items-center gap-2"><Store size={14} className="text-gray-300"/><span className="text-[10px] font-black uppercase text-gray-500">{boutiqueOrigine?.nom || "Atelier Central"}</span></div></td>
                                            <td className="p-6"><div className="flex flex-wrap gap-1">{cmd.elements?.map(e=><span key={e.id} className="px-2 py-0.5 bg-white border border-gray-200 rounded text-[9px] font-black uppercase">{e.nom} ({e.quantiteTotal})</span>)}</div></td>
                                            <td className="p-6 text-center"><div><p className="font-black text-gray-900">{cmd.prixTotal.toLocaleString()} F</p><p className={`text-[10px] font-black uppercase ${cmd.reste>0?'text-red-500':'text-green-600'}`}>{cmd.reste>0?`Reste : ${cmd.reste.toLocaleString()} F`:'Payé'}</p></div></td>
                                            <td className="p-6 text-center"><span className="px-4 py-2 bg-white border-2 border-gray-100 rounded-2xl text-[10px] font-black text-gray-600 uppercase tracking-widest">{cmd.statut.toUpperCase()}</span></td>
                                            <td className="p-6 text-right"><div className="flex justify-end gap-2"><button onClick={()=>{setSelectedOrder(cmd);setDetailModalOpen(true);}} className="p-2.5 bg-white text-blue-600 border border-blue-100 rounded-xl hover:bg-blue-600 hover:text-white transition-all shadow-sm"><Eye size={18}/></button><button onClick={()=>{setSelectedOrder(cmd);setPayData({...payData,amount:cmd.reste, editingPaymentId: null});setPaymentModalOpen(true);}} className="p-2.5 bg-white text-emerald-600 border border-emerald-100 rounded-xl hover:bg-emerald-600 hover:text-white shadow-sm" title="Encaisser"><DollarSign size={18}/></button>{userRole !== RoleEmploye.VENDEUR && (<button onClick={()=>{if(window.confirm("Annuler ?"))onUpdateStatus(cmd.id,StatutCommande.ANNULE);}} className="p-2.5 bg-white text-red-300 border border-red-50 rounded-xl hover:bg-red-500 hover:text-white transition-all shadow-sm"><Ban size={18}/></button>)}</div></td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {activeNav === 'AGENDA' && (
                <div className="bg-white rounded-[2rem] border border-gray-100 shadow-sm overflow-hidden flex flex-col min-h-[600px] animate-in fade-in">
                    <div className="p-6 border-b flex justify-between items-center bg-gray-50/50">
                        <div className="flex gap-1"><button onClick={()=>setAgendaDate(new Date(agendaDate.setDate(agendaDate.getDate()-7)))} className="p-2 hover:bg-white rounded-lg border border-gray-200"><ChevronLeft size={20}/></button><button onClick={()=>setAgendaDate(new Date(agendaDate.setDate(agendaDate.getDate()+7)))} className="p-2 hover:bg-white rounded-lg border border-gray-200"><ChevronRightIcon size={20}/></button><h3 className="text-xl font-black text-gray-800 uppercase tracking-widest ml-4">{agendaDate.toLocaleDateString('fr-FR',{month:'long',year:'numeric'})}</h3></div>
                    </div>
                    <div className="flex-1 overflow-auto">
                        <table className="w-full border-collapse">
                            <thead><tr className="bg-gray-50 text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] border-b"><th className="p-6 border-r text-left w-64 sticky left-0 bg-gray-50 z-20">Artisan</th>{Array.from({length:7}).map((_,i)=>{const d=new Date(agendaDate);d.setDate(agendaDate.getDate()+i);return <th key={i} className="p-6 border-r text-center">{d.toLocaleDateString('fr-FR',{weekday:'short',day:'numeric'})}</th>})}</tr></thead>
                            <tbody>
                                {tailleurs.map(artisan => (
                                    <tr key={artisan.id} className="border-b h-40">
                                        <td className="p-6 border-r font-black text-gray-700 uppercase text-xs sticky left-0 bg-white z-10 shadow-sm">{artisan.nom}</td>
                                        {Array.from({length:7}).map((_,i)=>{
                                            const d=new Date(agendaDate);d.setDate(agendaDate.getDate()+i);const dStr=d.toISOString().split('T')[0];
                                            const dayTasks=(commandes.flatMap(c=>(c.taches||[]).map(t=>({...t,orderId:c.id,clientNom:c.clientNom, boutiqueId: c.boutiqueId}))).filter(t=>t.tailleurId===artisan.id && t.date===dStr));
                                            return (
                                                <td key={i} onClick={()=>{ if(userRole !== RoleEmploye.VENDEUR) { setTaskBaseData({commandeId:'',tailleurId:artisan.id,date:dStr});setMultiTasks([{elementNom:'',action:'COUPE',quantite:1}]);setTaskModalOpen(true); } }} className={`p-2 border-r bg-gray-50/20 transition-colors ${userRole !== RoleEmploye.VENDEUR ? 'cursor-cell hover:bg-brand-50' : ''}`}>
                                                    <div className="flex flex-col gap-1 overflow-y-auto max-h-32">
                                                        {dayTasks.map(t=>{
                                                            return (
                                                                <div 
                                                                    key={t.id} 
                                                                    onClick={(e) => { 
                                                                        e.stopPropagation(); 
                                                                        if(userRole !== RoleEmploye.VENDEUR) onUpdateTask(t.orderId, t.id, t.statut === 'A_FAIRE' ? 'FAIT' : 'A_FAIRE'); 
                                                                    }} 
                                                                    className={`p-1.5 rounded-lg border text-[8px] font-black uppercase truncate flex items-center gap-1.5 shadow-sm transition-all hover:scale-105 cursor-pointer ${t.statut==='FAIT'?'bg-green-100 border-green-200 text-green-700':'bg-white border-brand-100 text-brand-900'}`}
                                                                >
                                                                    {t.statut==='FAIT'?<CheckSquare size={10}/>:<Square size={10}/>} {t.clientNom.split(' ')[0]} : {t.elementNom}({t.quantite})
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                </td>
                                            );
                                        })}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {activeNav === 'KANBAN' && (
                <div className="flex gap-6 overflow-x-auto pb-10 no-scrollbar h-[calc(100vh-18rem)] animate-in slide-in-from-right">
                    {[StatutCommande.EN_ATTENTE, StatutCommande.EN_COUPE, StatutCommande.COUTURE, StatutCommande.FINITION, StatutCommande.PRET].map((status) => {
                        const items = getKanbanPieces(status);
                        return (
                            <div key={status} className="flex flex-col min-w-[320px] max-w-[320px] h-full">
                                <div className="flex justify-between items-center mb-6 px-2"><h4 className="font-black text-gray-800 uppercase text-xs tracking-widest">{status}</h4><span className="bg-brand-50 text-brand-700 px-2 py-0.5 rounded-full text-[9px] font-black border border-brand-100">{items.length} flux</span></div>
                                <div className="flex-1 overflow-y-auto space-y-4 pr-1 custom-scrollbar">
                                    {items.map((item, pIdx) => (
                                        <div key={`${item.order.id}-${item.element}-${pIdx}`} className={`p-6 rounded-[1.5rem] border shadow-sm transition-all hover:shadow-xl ${item.isAssigned ? 'bg-brand-50 border-brand-200' : 'bg-white border-gray-100'}`}>
                                            <div className="space-y-3">
                                                <div className="flex justify-between items-start"><div onClick={()=>{setSelectedOrder(item.order);setDetailModalOpen(true);}} className="cursor-pointer"><h5 className="font-black text-gray-900 uppercase text-xs mb-1">{item.order.clientNom}</h5><p className="text-[8px] text-gray-400 font-bold uppercase tracking-widest">Réf: #{item.order.id.slice(-6)}</p></div><span className={`text-[10px] font-black px-2 py-0.5 rounded-lg ${item.isAssigned ? 'bg-brand-900 text-white' : 'bg-gray-100 text-gray-400'}`}>{item.qty}/{item.total} {item.element}</span></div>
                                                {item.isAssigned ? (<div className="flex items-center gap-2 px-3 py-2 bg-white rounded-xl border border-brand-100 shadow-inner"><div className="w-6 h-6 bg-brand-600 rounded-lg flex items-center justify-center text-white"><UserCheck size={12}/></div><div className="flex-1 min-w-0"><p className="text-[8px] font-black text-brand-800 uppercase truncate">{item.artisanName || 'En cours'}</p></div></div>) : (status !== StatutCommande.PRET && userRole !== RoleEmploye.VENDEUR && (<button onClick={() => { setTaskBaseData({commandeId: item.order.id, tailleurId: '', date: new Date().toISOString().split('T')[0]}); setMultiTasks([{elementNom: item.element, action: item.action as ActionProduction, quantite: item.qty}]); setTaskModalOpen(true); }} className="w-full py-2.5 bg-gray-50 hover:bg-brand-900 hover:text-white rounded-xl border border-dashed border-gray-200 text-[8px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2"><UserPlus size={12} /> Assigner</button>))}
                                                {status === StatutCommande.PRET && (<button onClick={()=>{setSelectedOrder(item.order); setDeliveryModalOpen(true);}} className="w-full py-2.5 bg-green-50 hover:bg-green-600 hover:text-white rounded-xl text-[8px] font-black uppercase tracking-widest text-green-700 transition-all flex items-center justify-center gap-2"><Truck size={12}/> Prêt</button>)}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {activeNav === 'ARTISANS' && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-in fade-in duration-500">
                    {tailleurs.map(artisan => {
                        const activeTasks = (commandes.flatMap(c => c.taches || []).filter(t => t.tailleurId === artisan.id && t.statut === 'A_FAIRE'));
                        return (
                            <div key={artisan.id} className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-gray-100 flex flex-col gap-6 group hover:shadow-md transition-all">
                                <div className="flex items-center gap-4"><div className="w-14 h-14 bg-brand-900 rounded-2xl flex items-center justify-center font-black text-white text-xl shadow-lg">{artisan.nom.charAt(0)}</div><div><h3 className="text-lg font-black text-gray-800 uppercase tracking-tighter">{artisan.nom}</h3><p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{artisan.role}</p></div></div>
                                <div className="grid grid-cols-2 gap-4"><div className="bg-gray-50 p-4 rounded-2xl border text-center"><p className="text-[8px] font-black text-gray-400 uppercase mb-1">Missions actives</p><p className="text-2xl font-black text-gray-800">{activeTasks.length}</p></div><div className="bg-green-50 p-4 rounded-2xl border border-green-100 text-center"><p className="text-[8px] font-black text-green-400 uppercase mb-1">Disponibilité</p><p className="text-[10px] font-black text-green-700 uppercase">En Poste</p></div></div>
                                {userRole !== RoleEmploye.VENDEUR && (<button onClick={()=>{setTaskBaseData({commandeId:'',tailleurId:artisan.id,date:new Date().toISOString().split('T')[0]});setMultiTasks([{elementNom:'',action:'COUPE',quantite:1}]);setTaskModalOpen(true);}} className="w-full py-4 bg-gray-50 hover:bg-brand-900 hover:text-white font-black uppercase text-[10px] tracking-widest rounded-xl border border-dashed border-gray-300 transition-all">Assigner Travail</button>)}
                            </div>
                        );
                    })}
                </div>
            )}

            {activeNav === 'PERFORMANCE' && (
                <div className="bg-white rounded-[2.5rem] border border-gray-100 shadow-sm overflow-hidden animate-in fade-in duration-500">
                    <div className="p-8 border-b bg-gray-50/50 flex items-center gap-4"><Trophy className="text-yellow-500" size={32}/><h3 className="text-xl font-black text-gray-800 uppercase tracking-tighter">Palmarès Performance Mensuelle</h3></div>
                    <div className="p-8 space-y-4">
                        {tailleurs.map((artisan, i) => {
                            const finishedTasks = commandes.flatMap(c => c.taches || []).filter(t => t.tailleurId === artisan.id && t.statut === 'FAIT').length;
                            return (
                                <div key={artisan.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-2xl border border-gray-100 hover:bg-white hover:shadow-xl transition-all">
                                    <div className="flex items-center gap-6"><span className="text-2xl font-black text-gray-300 w-8 text-center">#{i+1}</span><div className="w-12 h-12 bg-white rounded-xl border flex items-center justify-center font-black text-brand-900 shadow-sm">{artisan.nom.charAt(0)}</div><div><p className="font-black text-gray-800 uppercase text-sm tracking-tight">{artisan.nom}</p></div></div>
                                    <div className="flex items-center gap-10"><div className="text-right"><p className="text-[10px] font-black text-gray-400 uppercase mb-0.5">Tâches Finies</p><p className="text-xl font-black text-gray-800">{finishedTasks}</p></div><div className="w-40 h-2 bg-gray-200 rounded-full overflow-hidden shadow-inner"><div className="h-full bg-brand-900 transition-all duration-1000" style={{ width: `${Math.min(100, (finishedTasks/10)*100)}%` }} /></div></div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {detailModalOpen && selectedOrder && (
                <div className="fixed inset-0 bg-brand-900/90 z-[600] flex items-center justify-center p-4 backdrop-blur-md">
                    <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-3xl overflow-hidden flex flex-col max-h-[95vh] animate-in zoom-in border border-brand-100">
                        <div className="p-8 border-b flex justify-between items-center bg-white shrink-0">
                            <div><h3 className="text-2xl font-black text-gray-800 uppercase tracking-tighter">Fiche de Production</h3><p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">Réf: #{selectedOrder.id.slice(-6)}</p></div>
                            <div className="flex gap-2"><button onClick={()=>{setDetailModalOpen(false); setNewOrderData(selectedOrder); setIsEditingOrder(true); setOrderModalOpen(true);}} className="p-3 bg-gray-100 text-gray-600 rounded-xl hover:bg-brand-900 hover:text-white transition-colors"><Edit2 size={24}/></button><button onClick={() => setDetailModalOpen(false)} className="p-3 bg-gray-50 text-gray-400 rounded-xl hover:bg-gray-100"><X size={24}/></button></div>
                        </div>
                        <div className="p-10 overflow-y-auto flex-1 bg-gray-50/30 space-y-8 custom-scrollbar">
                            <div className="bg-white p-8 rounded-3xl border border-brand-100 shadow-sm flex flex-col md:flex-row justify-between items-start gap-4">
                                <div><p className="text-[10px] font-black text-gray-400 uppercase mb-1">Client Titulaire</p><p className="text-2xl font-black text-gray-900 uppercase">{selectedOrder.clientNom}</p><div className="flex items-center gap-2 mt-1 text-brand-600 font-bold"><Phone size={14}/> {clients.find(c => c.id === selectedOrder.clientId)?.telephone || 'Contact non spécifié'}</div><div className="mt-4 p-4 bg-brand-50 border border-brand-100 rounded-2xl"><p className="text-[10px] font-black text-brand-400 uppercase mb-1">Description Globale</p><p className="text-sm font-bold text-brand-900">{selectedOrder.description || "Aucune description globale"}</p></div></div>
                                <div className="text-right"><p className="text-[10px] font-black text-gray-400 uppercase mb-1">Boutique émettrice</p><div className="text-xs font-black uppercase text-brand-900 mb-4">{boutiques.find(b => b.id === selectedOrder.boutiqueId)?.nom || "Atelier Central"}</div><p className="text-[10px] font-black text-gray-400 uppercase mb-1">Livraison Prévue</p><div className="px-4 py-2 bg-brand-50 text-brand-900 rounded-xl text-[10px] font-black uppercase tracking-widest border border-brand-100 flex items-center gap-2"><Calendar size={12}/> {new Date(selectedOrder.dateLivraisonPrevue).toLocaleDateString()}</div></div>
                            </div>
                            
                            <div className="space-y-4">
                                <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-4">Composition & Artisans par étape</h4>
                                <div className="grid grid-cols-1 gap-4">
                                    {selectedOrder.elements?.map(el => {
                                        const elementTasks = (selectedOrder.taches || []).filter(tk => tk.elementNom === el.nom);
                                        const assignedCoupeQty = elementTasks.filter(tk => tk.action === 'COUPE').reduce((s: number, tk) => s + tk.quantite, 0) || 0;
                                        const progress = (assignedCoupeQty / el.quantiteTotal) * 100;
                                        return (<div key={el.id} className="bg-white p-6 rounded-[2rem] border border-gray-100 shadow-sm relative overflow-hidden group"><div className="flex justify-between items-start mb-4"><div><span className="text-lg font-black uppercase text-gray-800">{el.nom}</span><p className="text-[10px] text-gray-400 font-bold uppercase">Quantité Totale: {el.quantiteTotal}</p></div><span className="text-3xl font-black text-brand-900 opacity-20">x{el.quantiteTotal}</span></div><div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden mb-6"><div className="h-full bg-brand-900 transition-all duration-1000" style={{ width: `${progress}%` }} /></div><div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                                    {['COUPE', 'COUTURE', 'FINITION'].map((act) => {
                                                        const tasksForAction = elementTasks.filter(t => t.action === act);
                                                        return (<div key={act} className="bg-gray-50/50 p-4 rounded-2xl border border-gray-100"><p className="text-[8px] font-black text-gray-400 uppercase mb-2 tracking-widest">{act}</p>{tasksForAction.length > 0 ? (<div className="space-y-2">{tasksForAction.map(t => { const art = employes.find(e => e.id === t.tailleurId); return (<div key={t.id} className="flex items-center justify-between"><div className="flex items-center gap-2"><div className={`w-2 h-2 rounded-full ${t.statut === 'FAIT' ? 'bg-green-500' : 'bg-orange-400 animate-pulse'}`} /><span className="text-[10px] font-black text-gray-700 uppercase">{art?.nom || 'Inconnu'}</span></div><span className="text-[9px] font-bold text-gray-400">({t.quantite})</span></div>); })}</div>) : (<p className="text-[9px] text-gray-300 italic font-bold uppercase">En attente</p>)}</div>);
                                                    })}
                                                </div></div>);
                                    })}
                                </div>
                            </div>

                            <div className="space-y-4">
                                <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-4 flex items-center gap-2"><Truck size={14}/> Historique des Livraisons</h4>
                                <div className="bg-white rounded-3xl border border-brand-100 overflow-hidden shadow-sm">
                                    <table className="w-full text-xs text-left">
                                        <thead className="bg-gray-50 text-[8px] font-black text-gray-400 uppercase tracking-[0.2em] border-b">
                                            <tr><th className="p-4">Date</th><th className="p-4">Articles Remis</th><th className="p-4 text-right">Statut</th></tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-50">
                                            {(selectedOrder.livraisons || []).map((liv) => (
                                                <tr key={liv.id} className="hover:bg-gray-50">
                                                    <td className="p-4 text-gray-400 font-bold">{new Date(liv.date).toLocaleDateString()}</td>
                                                    <td className="p-4">
                                                        <div className="flex flex-wrap gap-1">
                                                            {liv.details.map((d, idx) => (
                                                                <span key={idx} className="px-2 py-0.5 bg-brand-50 text-brand-900 border border-brand-100 rounded text-[9px] font-black uppercase">
                                                                    {d.elementNom} ({d.quantite})
                                                                </span>
                                                            ))}
                                                        </div>
                                                    </td>
                                                    <td className="p-4 text-right font-black text-green-600 uppercase text-[9px]">Remis</td>
                                                </tr>
                                            ))}
                                            {(!selectedOrder.livraisons || selectedOrder.livraisons.length === 0) && (
                                                <tr><td colSpan={3} className="p-4 text-center text-gray-300 font-bold uppercase text-[9px] italic">Aucune livraison enregistrée</td></tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>

                            <div className="space-y-4">
                                <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-4 flex items-center gap-2"><History size={14}/> Historique des Règlements</h4>
                                <div className="bg-white rounded-3xl border border-brand-100 overflow-hidden shadow-sm">
                                    <table className="w-full text-xs text-left">
                                        <thead className="bg-gray-50 text-[8px] font-black text-gray-400 uppercase tracking-[0.2em] border-b">
                                            <tr><th className="p-4">Date</th><th className="p-4">Libellé</th><th className="p-4 text-right">Encaissement</th><th className="p-4 text-center">Actions</th></tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-50">
                                            <tr className="bg-brand-50/20">
                                                <td className="p-4 text-gray-400 font-bold">{new Date(selectedOrder.dateCommande).toLocaleDateString()}</td>
                                                <td className="p-4 font-black text-brand-900 uppercase">Acompte initial</td>
                                                <td className="p-4 text-right font-black text-brand-900">{selectedOrder.avance.toLocaleString()} F</td>
                                                <td className="p-4 text-center">
                                                    <button onClick={()=>{setDetailModalOpen(false); setNewOrderData(selectedOrder); setIsEditingOrder(true); setOrderModalOpen(true);}} className="p-1.5 text-blue-600 hover:bg-blue-100 rounded transition-colors" title="Modifier via commande"><Edit2 size={12}/></button>
                                                </td>
                                            </tr>
                                            {(selectedOrder.paiements || []).map((p) => (
                                                <tr key={p.id} className="hover:bg-gray-50 group">
                                                    <td className="p-4 text-gray-400 font-bold">{new Date(p.date).toLocaleDateString()}</td>
                                                    <td className="p-4 font-black text-gray-600 uppercase">{p.note || 'Versement Reliquat'}</td>
                                                    <td className="p-4 text-right font-black text-emerald-600">+{p.montant.toLocaleString()} F</td>
                                                    <td className="p-4 text-center">
                                                        <div className="flex justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                            <button onClick={()=>{setPayData({amount: p.montant, method: p.moyenPaiement, accId: p.compteId || '', date: new Date(p.date).toISOString().split('T')[0], note: p.note || '', editingPaymentId: p.id}); setPaymentModalOpen(true);}} className="p-1.5 text-blue-600 hover:bg-blue-100 rounded transition-colors"><Edit2 size={12}/></button>
                                                            <button onClick={()=>{if(window.confirm("Supprimer ce versement ?")) onDeletePayment(selectedOrder.id, p.id, p.compteId || '');}} className="p-1.5 text-red-600 hover:bg-red-100 rounded transition-colors"><Trash2 size={12}/></button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))}
                                            {(!selectedOrder.paiements || selectedOrder.paiements.length === 0) && (
                                                <tr><td colSpan={4} className="p-4 text-center text-gray-300 font-bold uppercase text-[9px] italic">Aucun versement additionnel</td></tr>
                                            )}
                                        </tbody>
                                        <tfoot className="bg-brand-900 text-white font-black">
                                            <tr>
                                                <td colSpan={2} className="p-5 uppercase tracking-widest text-[9px]">Total Déjà Perçu</td>
                                                <td className="p-5 text-right text-base">{(selectedOrder.prixTotal - selectedOrder.reste).toLocaleString()} F</td>
                                                <td></td>
                                            </tr>
                                        </tfoot>
                                    </table>
                                </div>
                            </div>

                            <div className="bg-white rounded-[2rem] p-8 border border-brand-100 shadow-2xl"><div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-center"><div><p className="text-[10px] font-black text-gray-400 uppercase mb-1">Montant Total</p><p className="text-3xl font-black text-gray-800">{selectedOrder.prixTotal.toLocaleString()} F</p></div><div><p className="text-[10px] font-black text-emerald-500 uppercase mb-1">Total Payé</p><p className="text-3xl font-black text-emerald-600">{(selectedOrder.prixTotal - selectedOrder.reste).toLocaleString()} F</p></div><div className="bg-red-50 p-4 rounded-2xl border border-red-100"><p className="text-[10px] font-black text-red-400 uppercase mb-1">Reste Final</p><p className="text-3xl font-black text-red-600">{selectedOrder.reste.toLocaleString()} F</p></div></div></div>
                        </div>
                        <div className="p-8 border-t bg-gray-50 flex justify-between gap-3 shrink-0">{selectedOrder.reste > 0 && (<button onClick={()=>{setPayData({...payData, amount: selectedOrder.reste, editingPaymentId: null}); setPaymentModalOpen(true);}} className="px-8 py-4 bg-emerald-600 text-white rounded-2xl font-black uppercase text-xs tracking-widest shadow-xl flex items-center gap-2 active:scale-95 transition-all"><DollarSign size={18}/> Encaisser Versement</button>)}<div className="flex gap-2 ml-auto">{selectedOrder.statut === StatutCommande.PRET && <button onClick={()=>{setDetailModalOpen(false); setDeliveryModalOpen(true);}} className="px-12 py-4 bg-brand-900 text-white rounded-2xl font-black uppercase text-xs tracking-widest shadow-xl flex items-center gap-2 active:scale-95"><Truck size={18}/> Passer à la Livraison</button>}</div></div>
                    </div>
                </div>
            )}

            {paymentModalOpen && selectedOrder && (
                <div className="fixed inset-0 bg-brand-900/80 z-[700] flex items-center justify-center p-4 backdrop-blur-md">
                    <div className="bg-white rounded-[2.5rem] p-10 w-full max-w-sm shadow-2xl border border-brand-100 animate-in zoom-in">
                        <div className="flex justify-between items-center mb-8 border-b pb-5 shrink-0"><h3 className="text-xl font-black uppercase tracking-tighter flex items-center gap-3"><DollarSign className="text-green-600"/> {payData.editingPaymentId ? 'Modifier Versement' : 'Encaisser Versement'}</h3><button onClick={()=>setPaymentModalOpen(false)}><X size={28} className="text-gray-400"/></button></div>
                        <div className="space-y-6">
                            {!payData.editingPaymentId && (<div className="bg-gray-50 p-6 rounded-3xl text-center border shadow-inner"><p className="text-[10px] font-black text-gray-400 uppercase mb-1">Reste à percevoir</p><p className="text-3xl font-black text-gray-900">{selectedOrder.reste.toLocaleString()} F</p></div>)}
                            <div><label className="block text-[10px] font-black text-gray-400 uppercase mb-2 ml-1">Montant à encaisser (F)</label><input type="number" className="w-full p-5 border-2 border-brand-100 rounded-2xl text-2xl font-black text-brand-600 focus:border-brand-600 outline-none transition-all shadow-sm" value={payData.amount||''} placeholder="0" onChange={e=>setPayData({...payData,amount:parseInt(e.target.value)||0})}/></div>
                            <div><label className="block text-[10px] font-black text-gray-400 uppercase mb-2 ml-1">Mode de règlement</label><select className="w-full p-4 border-2 border-brand-100 rounded-2xl font-black bg-white outline-none" value={payData.method} onChange={e=>setPayData({...payData, method: e.target.value as any})}><option value="ESPECE">Espèce</option><option value="WAVE">Wave</option><option value="ORANGE_MONEY">Orange Money</option></select></div>
                            <div><label className="block text-[10px] font-black text-gray-400 uppercase mb-2 ml-1">Caisse / Destination</label><select className="w-full p-4 border-2 border-brand-100 rounded-2xl font-black bg-white outline-none" value={payData.accId} onChange={e=>setPayData({...payData,accId:e.target.value})}><option value="">-- Choisir Caisse --</option>{comptes.filter(c => !userBoutiqueId || c.boutiqueId === userBoutiqueId || userRole === RoleEmploye.ADMIN || userRole === RoleEmploye.GERANT).map(c=><option key={c.id} value={c.id}>{c.nom} ({c.solde.toLocaleString()} F)</option>)}</select></div>
                        </div>
                        <div className="flex justify-end gap-3 mt-10 pt-5 border-t"><button onClick={()=>setPaymentModalOpen(false)} className="px-6 py-4 text-gray-400 font-black uppercase text-[10px] tracking-widest">Annuler</button><button onClick={()=>{
                            if(!payData.accId || payData.amount <= 0) return; 
                            
                            const currentAvance = selectedOrder.avance;
                            const otherPaymentsSum = selectedOrder.paiements?.filter(p => p.id !== payData.editingPaymentId).reduce((acc, p) => acc + p.montant, 0) || 0;
                            const totalPerçuAvecCeci = currentAvance + otherPaymentsSum + payData.amount;
                            
                            if (totalPerçuAvecCeci > selectedOrder.prixTotal) {
                                const allowed = selectedOrder.prixTotal - (currentAvance + otherPaymentsSum);
                                alert(`Dépassement du total (${selectedOrder.prixTotal.toLocaleString()} F). Solde maximum autorisé : ${allowed.toLocaleString()} F.`);
                                return;
                            }
                            
                            if (payData.editingPaymentId) { onUpdatePayment(selectedOrder.id, payData.editingPaymentId, payData.amount, payData.date, payData.accId); } 
                            else { onAddPayment(selectedOrder.id, payData.amount, payData.method, payData.note || "Règlement solde", payData.date, payData.accId); }
                            setPaymentModalOpen(false);
                        }} disabled={!payData.accId || payData.amount <= 0} className="px-12 py-4 bg-brand-900 text-white rounded-2xl font-black uppercase text-xs tracking-widest shadow-xl active:scale-95 transition-all">Confirmer</button></div>
                    </div>
                </div>
            )}

            {orderModalOpen && (
                <div className="fixed inset-0 bg-brand-900/80 z-[600] flex items-center justify-center p-4 backdrop-blur-md">
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl flex flex-col max-h-[95vh] border border-brand-100 overflow-hidden animate-in zoom-in">
                         <div className="p-8 bg-white border-b flex justify-between items-center shrink-0"><h3 className="text-2xl font-black text-gray-800 uppercase tracking-tighter">{isEditingOrder?'Modifier':'Nouvelle'} Commande</h3><button onClick={()=>setOrderModalOpen(false)}><X size={28} className="text-gray-400"/></button></div>
                         <div className="p-8 space-y-6 overflow-y-auto flex-1 custom-scrollbar bg-gray-50/30">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div><label className="text-[10px] font-black text-gray-400 uppercase mb-2 block ml-1">Boutique émettrice</label>{isVendeur ? (<div className="w-full p-4 border-2 border-brand-100 bg-brand-50 rounded-2xl font-black uppercase text-xs text-brand-900">{boutiques.find(b => b.id === userBoutiqueId)?.nom || "Inconnu"}</div>) : (<select className="w-full p-4 border-2 border-gray-100 rounded-2xl font-bold bg-white" value={newOrderData.boutiqueId} onChange={e => setNewOrderData({...newOrderData, boutiqueId: e.target.value})}><option value="">-- Sélectionner Boutique --</option><option value="ATELIER">Atelier Central</option>{boutiques.map(b => <option key={b.id} value={b.id}>{b.nom}</option>)}</select>)}</div>
                                <div className="relative"><label className="text-[10px] font-black text-gray-400 uppercase mb-2 block ml-1">Client Titulaire</label>{!newOrderData.clientId ? (<div className="relative"><Search className="absolute left-4 top-3.5 text-gray-300" size={20}/><input type="text" className="w-full pl-12 p-4 border-2 border-gray-100 rounded-2xl font-bold bg-white focus:border-brand-500 outline-none transition-all shadow-sm" placeholder="Rechercher client..." value={clientSearchTerm} onChange={e=>{setClientSearchTerm(e.target.value);setShowClientResults(true);}} onFocus={()=>setShowClientResults(true)}/>{showClientResults && searchedClients.length>0 && (<div className="absolute top-full left-0 w-full mt-2 bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden z-[700]">{searchedClients.map(c=>(<button key={c.id} onClick={()=>{setNewOrderData({...newOrderData,clientId:c.id});setShowClientResults(false);}} className="w-full p-4 text-left hover:bg-brand-50 border-b last:border-0 flex items-center justify-between group transition-colors"><div><p className="font-black text-gray-800 uppercase text-xs">{c.nom}</p><p className="text-[10px] text-gray-400 font-bold">{c.telephone}</p></div><div className="p-2 bg-gray-100 rounded-lg group-hover:bg-brand-600 group-hover:text-white transition-colors"><Plus size={16}/></div></button>))}</div>)}</div>) : (<div className="flex items-center justify-between bg-brand-900 text-white p-4 rounded-2xl shadow-lg"><div className="flex items-center gap-3"><div className="p-2 bg-white/20 rounded-xl"><UserIcon size={20}/></div><div><p className="text-xs font-black uppercase">{selectedClientName}</p></div></div><button onClick={()=>setNewOrderData({...newOrderData,clientId:''})} className="p-2 hover:bg-white/10 rounded-full text-brand-300"><X size={20}/></button></div>)}</div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div><label className="text-[10px] font-black text-gray-400 uppercase mb-2 block ml-1">Date Livraison Prévue</label><input type="date" className="w-full p-4 border-2 border-gray-100 rounded-2xl font-bold bg-white" value={newOrderData.dateLivraisonPrevue} onChange={e=>setNewOrderData({...newOrderData,dateLivraisonPrevue:e.target.value})}/></div>
                                <div><label className="text-[10px] font-black text-gray-400 uppercase mb-2 block ml-1">Prix Total (F)</label><input type="number" className="w-full p-4 border-2 border-gray-100 rounded-2xl font-black text-gray-900 bg-white shadow-sm" value={newOrderData.prixTotal||''} placeholder="0" onChange={e=>setNewOrderData({...newOrderData,prixTotal:parseInt(e.target.value)||0})}/></div>
                            </div>
                            <div><label className="text-[10px] font-black text-gray-400 uppercase mb-2 block ml-1">Description Globale de la Commande</label><input type="text" className="w-full p-4 border-2 border-gray-100 rounded-2xl font-bold bg-white focus:border-brand-500 outline-none transition-all shadow-sm" placeholder="Ex: Tenue de mariage..." value={newOrderData.description || ''} onChange={e => setNewOrderData({...newOrderData, description: e.target.value})} /></div>
                            <div className="bg-white p-6 rounded-[2rem] border border-brand-100 space-y-4 shadow-inner">
                                <h4 className="text-[10px] font-black text-brand-700 uppercase tracking-widest flex items-center gap-2"><List size={14}/> Composition</h4>
                                <div className="flex gap-2"><input type="text" placeholder="Ex: Veste" className="flex-1 p-3 border-2 border-gray-100 rounded-xl text-xs font-black uppercase" value={tempElement.nom} onChange={e=>setTempElement({...tempElement,nom:e.target.value})}/><input type="number" placeholder="Qté" className="w-20 p-3 border-2 border-gray-100 rounded-xl text-center font-black" value={tempElement.quantite} onChange={e=>setTempElement({...tempElement,quantite:parseInt(e.target.value)||1})}/><button onClick={()=>{if(!tempElement.nom)return;setNewOrderData({...newOrderData,elements:[...(newOrderData.elements||[]),{id:`EL_${Date.now()}`,nom:tempElement.nom.toUpperCase(),quantiteTotal:tempElement.quantite}]});setTempElement({nom:'',quantite:1});}} className="p-3 bg-brand-900 text-white rounded-xl hover:bg-black transition-all shadow-md"><Plus size={20}/></button></div>
                                <div className="flex flex-wrap gap-2">{(newOrderData.elements||[]).map(el=>(<div key={el.id} className="bg-brand-50 border border-brand-200 px-4 py-2 rounded-xl flex items-center gap-3"><span className="text-[10px] font-black text-brand-900 uppercase">{el.nom} ({el.quantiteTotal})</span><button onClick={()=>setNewOrderData({...newOrderData,elements:newOrderData.elements?.filter(x=>x.id!==el.id)})} className="text-red-300 hover:text-red-500 transition-colors"><X size={14}/></button></div>))}</div>
                            </div>
                            {userRole !== RoleEmploye.VENDEUR && (<div className="bg-orange-50/50 p-6 rounded-[2rem] border border-orange-100 space-y-4 shadow-inner"><h4 className="text-[10px] font-black text-orange-700 uppercase tracking-widest flex items-center gap-2"><Package size={14}/> Sortie Stock Matière</h4><div className="flex flex-col md:flex-row gap-2"><select className="flex-1 p-3 border-2 border-orange-100 rounded-xl text-[10px] font-black uppercase bg-white" value={tempCons.articleId} onChange={e => setTempCons({ ...tempCons, articleId: e.target.value, variante: 'Standard' })}><option value="">-- Choisir Matière --</option>{articles.filter(a => a.typeArticle === 'MATIERE_PREMIERE').map(a => <option key={a.id} value={a.id}>{a.nom}</option>)}</select><div className="flex gap-2"><input type="text" inputMode="decimal" placeholder="Qté" className="w-20 p-3 border-2 border-orange-100 rounded-xl text-center font-black bg-white focus:border-brand-600 outline-none" value={tempCons.quantite || ''} onChange={e => { const val = e.target.value; if (val === '' || /^[0-9]+([.,][0-9]*)?$/.test(val)) { setTempCons({...tempCons, quantite: val as any}); } }} /><button onClick={handleAddConsommation} className="p-3 bg-orange-600 text-white rounded-xl hover:bg-orange-700 shadow-md transition-all active:scale-95"><Plus size={20}/></button></div></div><div className="flex flex-wrap gap-2">{(newOrderData.consommations||[]).map((c,idx)=>(<div key={idx} className="bg-white border border-orange-100 px-4 py-2 rounded-xl flex items-center gap-3 shadow-sm"><span className="text-[10px] font-black text-orange-900 uppercase">{articles.find(a=>a.id===c.articleId)?.nom} ({c.quantite})</span><button onClick={()=>setNewOrderData({...newOrderData,consommations:newOrderData.consommations?.filter((_,i)=>i!==idx)})} className="text-red-300 hover:text-red-500"><X size={14}/></button></div>))}</div></div>)}
                            <div className="grid grid-cols-2 gap-4">
                                <div><label className="text-[10px] font-black text-brand-600 uppercase mb-2 block ml-1">Acompte Immédiat (F)</label><input type="number" className="w-full p-4 border-2 border-brand-100 rounded-2xl font-black text-brand-600 bg-white shadow-sm" value={newOrderData.avance||''} placeholder="0" onChange={e=>setNewOrderData({...newOrderData,avance:parseInt(e.target.value)||0})}/></div>
                                {(newOrderData.avance||0)>0 && (<div><label className="text-[10px] font-black text-brand-900 uppercase mb-2 block ml-1">Caisse de réception</label><select className="w-full p-4 border-2 border-brand-300 rounded-2xl font-black bg-white" value={initialAccountId} onChange={e=>setInitialAccountId(e.target.value)}><option value="">-- Sélectionner --</option>{comptes.filter(c => !userBoutiqueId || c.boutiqueId === userBoutiqueId || userRole === RoleEmploye.ADMIN || userRole === RoleEmploye.GERANT).map(c=><option key={c.id} value={c.id}>{c.nom} ({c.solde.toLocaleString()} F)</option>)}</select></div>)}
                            </div>
                         </div>
                         <div className="p-8 bg-white border-t flex justify-end gap-4 shrink-0"><button onClick={()=>setOrderModalOpen(false)} className="px-8 py-4 text-gray-400 font-black uppercase text-xs">Annuler</button><button onClick={handleCreateOrUpdateOrder} disabled={!newOrderData.clientId || !newOrderData.elements?.length || (!newOrderData.boutiqueId && !userBoutiqueId)} className="px-16 py-4 bg-brand-900 text-white rounded-2xl font-black uppercase text-xs shadow-2xl active:scale-95 transition-all flex items-center gap-2 disabled:opacity-30"><Save size={18}/> Valider</button></div>
                    </div>
                </div>
            )}

            {taskModalOpen && (
                <div className="fixed inset-0 bg-brand-900/80 z-[800] flex items-center justify-center p-4 backdrop-blur-md">
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-xl flex flex-col max-h-[90vh] animate-in zoom-in duration-200 border border-brand-100 overflow-hidden">
                        <div className="p-8 border-b flex justify-between items-center bg-white shrink-0"><h3 className="text-xl font-black text-gray-800 uppercase tracking-tighter flex items-center gap-3"><UserPlus className="text-brand-600"/> Nouvelle Mission Artisan</h3><button onClick={()=>setTaskModalOpen(false)}><X size={28}/></button></div>
                        <div className="p-8 space-y-6 overflow-y-auto flex-1 bg-gray-50/30 custom-scrollbar">
                            <div className="grid grid-cols-2 gap-4">
                                <div><label className="block text-[10px] font-black text-gray-400 uppercase mb-2">Commande</label><select className="w-full p-4 border-2 border-gray-100 rounded-2xl font-bold bg-white" value={taskBaseData.commandeId} onChange={e=>setTaskBaseData({...taskBaseData,commandeId:e.target.value})}><option value="">-- Choisir Commande --</option>{commandes.filter(c=>!c.archived && c.statut!==StatutCommande.LIVRE).map(c=><option key={c.id} value={c.id}>{c.clientNom} (Ref #{c.id.slice(-6)})</option>)}</select></div>
                                <div><label className="block text-[10px] font-black text-gray-400 uppercase mb-2">Artisan</label><select className="w-full p-4 border-2 border-gray-100 rounded-2xl font-bold bg-white" value={taskBaseData.tailleurId} onChange={e=>setTaskBaseData({...taskBaseData,tailleurId:e.target.value})}><option value="">-- Choisir Artisan --</option>{tailleurs.map(t=><option key={t.id} value={t.id}>{t.nom}</option>)}</select></div>
                            </div>
                            <div className="space-y-4">
                                <div className="flex justify-between items-center"><h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Éléments à confier</h4><button onClick={()=>setMultiTasks([...multiTasks,{elementNom:'',action:'COUPE',quantite:1}])} className="text-[10px] font-black text-brand-600 uppercase flex items-center gap-1 hover:underline"><Plus size={14}/> Ligne</button></div>
                                {multiTasks.map((t,idx)=>{
                                    const cmd = commandes.find(c => c.id === taskBaseData.commandeId);
                                    const element = cmd?.elements?.find(el => el.nom === t.elementNom);
                                    const assignedAlready = cmd?.taches?.filter(tk => tk.elementNom === t.elementNom && tk.action === t.action).reduce((s: number, tk) => s + tk.quantite, 0) || 0;
                                    const maxAllowed = element ? element.quantiteTotal - assignedAlready : 0;
                                    const isError = t.quantite! > maxAllowed;
                                    return (<div key={idx} className={`bg-white p-6 rounded-2xl border shadow-sm flex flex-col md:flex-row gap-4 items-end transition-all ${isError ? 'border-red-500 bg-red-50/20' : 'border-gray-100'}`}><div className="flex-1 w-full"><label className="block text-[8px] font-black text-gray-400 uppercase mb-1">Pièce</label><select className="w-full p-2.5 border border-gray-100 rounded-xl font-bold text-xs" value={t.elementNom} onChange={e=>{const u=[...multiTasks];u[idx].elementNom=e.target.value;setMultiTasks(u);}}><option value="">-- Choisir --</option>{cmd?.elements?.map(el=><option key={el.id} value={el.nom}>{el.nom}</option>)}</select></div><div className="w-full md:w-32"><label className="block text-[8px] font-black text-gray-400 uppercase mb-1">Action</label><select className="w-full p-2.5 border border-gray-100 rounded-xl font-bold text-xs" value={t.action} onChange={e=>{const u=[...multiTasks];u[idx].action=e.target.value as ActionProduction;setMultiTasks(u);}}><option value="COUPE">COUPE</option><option value="COUTURE">COUTURE</option><option value="FINITION">FINITION</option></select></div><div className="w-full md:w-24"><label className={`block text-[8px] font-black uppercase mb-1 ${isError ? 'text-red-600' : 'text-gray-400'}`}>Qté (Max: {maxAllowed})</label><input type="number" className={`w-full p-2.5 border rounded-xl font-black text-center text-xs outline-none transition-all ${isError ? 'border-red-600 bg-white ring-4 ring-red-100' : 'border-gray-100'}`} value={t.quantite} onChange={e=>{const u=[...multiTasks];u[idx].quantite=parseInt(e.target.value)||0;setMultiTasks(u);}}/></div><button onClick={()=>setMultiTasks(multiTasks.filter((_,i)=>i!==idx))} className="p-2.5 text-red-300 hover:text-red-600"><Trash2 size={18}/></button></div>);
                                })}
                            </div>
                        </div>
                        <div className="p-8 bg-gray-50 border-t flex flex-col gap-4">{isTaskAssignmentInvalid && taskBaseData.commandeId && taskBaseData.tailleurId && multiTasks.length > 0 && (<p className="text-[10px] font-black text-red-600 uppercase text-center flex items-center justify-center gap-2"><AlertTriangle size={14}/> quota dépassé</p>)}<div className="flex justify-end gap-3"><button onClick={()=>setTaskModalOpen(false)} className="px-6 py-4 text-gray-400 font-black uppercase text-[10px]">Annuler</button><button onClick={()=>{ const cmd=commandes.find(c=>c.id===taskBaseData.commandeId); if(!cmd) return; multiTasks.forEach(mt=>{if(mt.elementNom && mt.quantite!>0) onAddTask(cmd.id,{id:`T_${Date.now()}_${Math.random()}`,commandeId:cmd.id,elementNom:mt.elementNom!,action:mt.action as ActionProduction,quantite:mt.quantite!,date:taskBaseData.date,tailleurId:taskBaseData.tailleurId,statut:'A_FAIRE'});}); setTaskModalOpen(false); setMultiTasks([]); }} disabled={isTaskAssignmentInvalid} className="px-12 py-4 bg-brand-900 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-xl active:scale-95 transition-all">Assigner</button></div></div>
                    </div>
                </div>
            )}

            {deliveryModalOpen && selectedOrder && (
                <div className="fixed inset-0 bg-brand-900/80 z-[700] flex items-center justify-center p-4 backdrop-blur-md">
                    <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in border border-brand-100">
                         <div className="p-8 bg-white border-b flex justify-between items-center shrink-0"><h3 className="text-xl font-black text-gray-800 uppercase tracking-tighter flex items-center gap-3"><Truck className="text-brand-600"/> Bon de Livraison</h3><button onClick={()=>setDeliveryModalOpen(false)}><X size={28}/></button></div>
                         <div className="p-8 space-y-6">
                            <div className="bg-gray-50 p-6 rounded-3xl border text-center"><p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Reste à payer</p><p className={`text-3xl font-black ${selectedOrder.reste > 0 ? 'text-red-500' : 'text-green-600'}`}>{selectedOrder.reste.toLocaleString()} F</p></div>
                            <div className="space-y-4">
                                {selectedOrder.elements?.map(el => {
                                    const qtyPret = (selectedOrder.taches || []).filter(t => t.elementNom === el.nom && t.action === 'FINITION' && t.statut === 'FAIT').reduce((s,t) => s + t.quantite, 0);
                                    const alreadyDelivered = (selectedOrder.livraisons || []).flatMap(l => l.details).filter(d => d.elementNom === el.nom).reduce((s, d) => s + d.quantite, 0);
                                    const deliverableNow = Math.max(0, qtyPret - alreadyDelivered);
                                    return (
                                        <div key={el.id} className="flex items-center justify-between p-4 bg-white border rounded-2xl">
                                            <div><span className="font-black text-gray-800 uppercase text-xs">{el.nom}</span><p className="text-[9px] text-gray-400 font-bold uppercase">Dispo : {deliverableNow} / {el.quantiteTotal}</p></div>
                                            <input type="number" className="w-16 p-2 bg-gray-50 border rounded-xl text-center font-black text-xs" value={deliveryQtys[el.id] || 0} onChange={e => setDeliveryQtys({...deliveryQtys, [el.id]: Math.min(deliverableNow, parseInt(e.target.value)||0)})} />
                                        </div>
                                    );
                                })}
                            </div>
                         </div>
                         <div className="p-8 bg-gray-50 border-t flex justify-end gap-3"><button onClick={()=>setDeliveryModalOpen(false)} className="px-6 py-4 text-gray-400 font-black uppercase text-[10px]">Annuler</button><button onClick={()=>{
                                const detailsLiv: { elementNom: string, quantite: number }[] = [];
                                selectedOrder.elements?.forEach(el => { const q = deliveryQtys[el.id] || 0; if (q > 0) detailsLiv.push({ elementNom: el.nom, quantite: q }); });
                                if (detailsLiv.length === 0) return;
                                const updatedLiv = [...(selectedOrder.livraisons || []), { id: `LIV_${Date.now()}`, date: new Date().toISOString(), details: detailsLiv }];
                                const allDelivered = selectedOrder.elements?.every(el => { const totalLivred = updatedLiv.flatMap(l => l.details).filter(d => d.elementNom === el.nom).reduce((s, d) => s + d.quantite, 0); return totalLivred >= el.quantiteTotal; });
                                onUpdateOrder({ ...selectedOrder, livraisons: updatedLiv, statut: allDelivered ? StatutCommande.LIVRE : StatutCommande.PRET }); 
                                setDeliveryModalOpen(false); 
                            }} className="px-12 py-4 bg-brand-900 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-xl">Confirmer Remise</button></div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ProductionView;
