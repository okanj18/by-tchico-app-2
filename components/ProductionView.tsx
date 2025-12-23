
import React, { useState, useMemo } from 'react';
import { Commande, Employe, Client, Article, StatutCommande, RoleEmploye, ModePaiement, CompteFinancier, CompanyAssets, TacheProduction, ActionProduction, ElementCommande, PaiementClient } from '../types';
import { Scissors, LayoutList, Users, Search, X, Activity, Clock, Calendar, CheckCircle, CheckSquare, Zap, Columns, Trophy, Wallet, Printer, Eye, UserPlus, Plus, Save, Truck, ArrowRightLeft, DollarSign, Trash2, AlertTriangle, ChevronLeft, ChevronRight, ClipboardList, Minus } from 'lucide-react';
import { COMPANY_CONFIG } from '../config';

interface ProductionViewProps {
    commandes: Commande[];
    employes: Employe[];
    clients: Client[];
    articles: Article[];
    userRole: RoleEmploye;
    onUpdateStatus: (id: string, status: StatutCommande) => void;
    onCreateOrder: (order: Commande, consommations: { articleId: string, variante: string, quantite: number }[], paymentMethod?: ModePaiement, accountId?: string) => void;
    onUpdateOrder: (order: Commande, accountId?: string, paymentMethod?: ModePaiement) => void;
    onAddPayment: (orderId: string, amount: number, method: ModePaiement, note: string, date: string, accountId?: string) => void;
    onArchiveOrder: (orderId: string) => void;
    comptes: CompteFinancier[];
    companyAssets?: CompanyAssets;
}

const KANBAN_STATUS_ORDER = [
    StatutCommande.EN_ATTENTE,
    StatutCommande.EN_COUPE,
    StatutCommande.COUTURE,
    StatutCommande.FINITION,
    StatutCommande.PRET
];

const ProductionView: React.FC<ProductionViewProps> = ({ 
    commandes, employes, clients, articles, userRole, 
    onUpdateStatus, onCreateOrder, onUpdateOrder, onAddPayment, onArchiveOrder, comptes, companyAssets 
}) => {
    const [viewMode, setViewMode] = useState<'ORDERS' | 'TAILORS' | 'PERFORMANCE' | 'KANBAN' | 'PLANNING'>('PLANNING');
    const [searchTerm, setSearchTerm] = useState('');
    const [listFilter, setListFilter] = useState<'ALL' | 'ACTIVE' | 'READY' | 'DELIVERED' | 'ARCHIVED'>('ACTIVE');
    
    // Modal States
    const [taskModalOpen, setTaskModalOpen] = useState(false);
    const [orderModalOpen, setOrderModalOpen] = useState(false);
    const [paymentModalOpen, setPaymentModalOpen] = useState(false);
    const [deliveryModal, setDeliveryModal] = useState<{ order: Commande, maxQty: number, qty: number } | null>(null);
    const [kanbanMoveModal, setKanbanMoveModal] = useState<{
        order: Commande, fromStatus: StatutCommande, toStatus: StatutCommande, maxQty: number, qty: number, assignTailorId: string
    } | null>(null);
    const [orderDetailView, setOrderDetailView] = useState<Commande | null>(null);

    // Form Multi-Articles
    const [newOrderItems, setNewOrderItems] = useState<{nom: string, qte: number}[]>([{nom: '', qte: 1}]);
    const [newOrderData, setNewOrderData] = useState<Partial<Commande>>({
        clientId: '', description: '', prixTotal: 0, avance: 0, dateLivraisonPrevue: ''
    });
    const [initialAccountId, setInitialAccountId] = useState('');

    const [selectedOrderForPayment, setSelectedOrderForPayment] = useState<Commande | null>(null);
    const [payAmount, setPayAmount] = useState(0);
    const [payAccount, setPayAccount] = useState('');
    const [payMethod, setPayMethod] = useState<ModePaiement>('ESPECE');
    const [payDate, setPayDate] = useState(new Date().toISOString().split('T')[0]);

    // Task Assignment Data
    const [newTaskData, setNewTaskData] = useState<{ orderId: string, elementNom: string, action: ActionProduction, quantite: number, note: string, tailleurId: string, date: string }>({ 
        orderId: '', elementNom: '', action: 'COUTURE', quantite: 1, note: '', tailleurId: '', date: new Date().toISOString().split('T')[0] 
    });

    const [agendaBaseDate, setAgendaBaseDate] = useState(() => {
        const d = new Date(); d.setHours(0,0,0,0); return d;
    });

    // --- DATA AGGREGATION ---
    const tailleurs = useMemo(() => employes.filter(e => (e.role === RoleEmploye.TAILLEUR || e.role === RoleEmploye.CHEF_ATELIER || e.role === RoleEmploye.STAGIAIRE) && e.actif !== false).sort((a, b) => a.nom.localeCompare(b.nom)), [employes]);
    
    const filteredCommandes = useMemo(() => {
        return commandes.filter(c => {
            if (c.type !== 'SUR_MESURE') return false; 
            const isCompleted = c.statut === StatutCommande.LIVRE || c.statut === StatutCommande.ANNULE;
            const isArchived = c.archived === true;
            const isReady = (c.repartitionStatuts?.[StatutCommande.PRET] || 0) > 0 || c.statut === StatutCommande.PRET;

            const matchesFilter = viewMode === 'ORDERS' ? (
                listFilter === 'ACTIVE' ? (!isCompleted && !isArchived) :
                listFilter === 'READY' ? (isReady && !isArchived) :
                listFilter === 'DELIVERED' ? (isCompleted && !isArchived) :
                listFilter === 'ARCHIVED' ? isArchived : true
            ) : (!isCompleted && !isArchived);

            const searchLower = searchTerm.toLowerCase();
            return matchesFilter && (c.clientNom.toLowerCase().includes(searchLower) || c.id.toLowerCase().includes(searchLower));
        }).sort((a, b) => new Date(b.dateCommande).getTime() - new Date(a.dateCommande).getTime());
    }, [commandes, searchTerm, viewMode, listFilter]);

    const artisanPerformance = useMemo(() => {
        return tailleurs.map(t => {
            const tasks = commandes.flatMap(c => (c.taches || [])).filter(task => task.tailleurId === t.id);
            const finished = tasks.filter(task => task.statut === 'FAIT');
            return { id: t.id, nom: t.nom, totalPieces: finished.reduce((acc, tk) => acc + tk.quantite, 0), percent: tasks.length > 0 ? Math.round((finished.length / tasks.length) * 100) : 0 };
        }).sort((a, b) => b.totalPieces - a.totalPieces);
    }, [tailleurs, commandes]);

    // --- LOGIQUE METIER ---

    const handleAddItemRow = () => setNewOrderItems([...newOrderItems, {nom: '', qte: 1}]);
    const handleRemoveItemRow = (idx: number) => setNewOrderItems(newOrderItems.filter((_, i) => i !== idx));

    const handleCreateCustomOrder = () => {
        if (!newOrderData.clientId || !newOrderData.prixTotal || newOrderItems.some(i => !i.nom)) {
            alert("Veuillez remplir le client, le prix et les noms d'articles."); return;
        }
        const client = clients.find(c => c.id === newOrderData.clientId);
        const totalQty = newOrderItems.reduce((acc, i) => acc + i.qte, 0);
        const order: Commande = {
            id: `CMD_SM_${Date.now()}`, clientId: newOrderData.clientId || '', clientNom: client?.nom || 'Inconnu',
            description: newOrderItems.map(i => `${i.nom} (x${i.qte})`).join(', '),
            dateCommande: new Date().toISOString(), dateLivraisonPrevue: newOrderData.dateLivraisonPrevue || '',
            statut: StatutCommande.EN_ATTENTE, tailleursIds: [], prixTotal: newOrderData.prixTotal || 0,
            avance: newOrderData.avance || 0, reste: (newOrderData.prixTotal || 0) - (newOrderData.avance || 0),
            type: 'SUR_MESURE', quantite: totalQty, repartitionStatuts: { [StatutCommande.EN_ATTENTE]: totalQty },
            paiements: (newOrderData.avance || 0) > 0 ? [{ id: `P_${Date.now()}`, date: new Date().toISOString(), montant: newOrderData.avance || 0, moyenPaiement: 'ESPECE', note: 'Acompte' }] : [],
            elements: newOrderItems.map(i => ({nom: i.nom.toUpperCase(), quantite: i.qte})), taches: []
        };
        onCreateOrder(order, [], 'ESPECE', initialAccountId);
        setOrderModalOpen(false); alert("Commande créée !");
    };

    // Glisser-Déposer
    const handleDragStart = (e: React.DragEvent, orderId: string, fromStatus: string) => {
        e.dataTransfer.setData('orderId', orderId);
        e.dataTransfer.setData('fromStatus', fromStatus);
    };

    const handleDropOnColumn = (e: React.DragEvent, toStatus: StatutCommande) => {
        e.preventDefault();
        const orderId = e.dataTransfer.getData('orderId');
        const fromStatus = e.dataTransfer.getData('fromStatus');
        if (fromStatus === toStatus) return;

        const order = commandes.find(c => c.id === orderId);
        if (!order) return;

        const qtyAvailable = order.repartitionStatuts?.[fromStatus] || (order.statut === fromStatus ? order.quantite : 0);
        if (qtyAvailable <= 0) return;

        setKanbanMoveModal({ order, fromStatus: fromStatus as StatutCommande, toStatus, maxQty: qtyAvailable, qty: qtyAvailable, assignTailorId: '' });
    };

    const executeKanbanMove = () => {
        if (!kanbanMoveModal) return;
        const { order, fromStatus, toStatus, qty, assignTailorId } = kanbanMoveModal;
        const newRepartition = { ...(order.repartitionStatuts || { [fromStatus]: order.quantite }) };
        
        newRepartition[fromStatus] = (newRepartition[fromStatus] || 0) - qty;
        if (newRepartition[fromStatus] <= 0) delete newRepartition[fromStatus];
        newRepartition[toStatus] = (newRepartition[toStatus] || 0) + qty;
        
        let mostAdvanced = StatutCommande.EN_ATTENTE;
        KANBAN_STATUS_ORDER.forEach(s => { if ((newRepartition[s] || 0) > 0) mostAdvanced = s as StatutCommande; });
        
        let updatedTaches = [...(order.taches || [])];
        if (assignTailorId) {
            let action: ActionProduction = 'COUTURE';
            if (toStatus === StatutCommande.EN_COUPE) action = 'COUPE';
            else if (toStatus === StatutCommande.FINITION) action = 'FINITION';
            else if (toStatus === StatutCommande.PRET) action = 'REPASSAGE';
            
            updatedTaches.push({ 
                id: `T_KB_${Date.now()}`, commandeId: order.id, action, quantite: qty, tailleurId: assignTailorId, 
                date: new Date().toISOString().split('T')[0], statut: 'A_FAIRE' 
            });
        }
        
        onUpdateOrder({ ...order, repartitionStatuts: newRepartition, statut: mostAdvanced, taches: updatedTaches });
        setKanbanMoveModal(null);
    };

    const handleTaskStatusChange = (order: Commande, task: TacheProduction, newStatut: 'A_FAIRE' | 'FAIT') => {
        const updatedTaches = (order.taches || []).map(t => t.id === task.id ? { ...t, statut: newStatut } : t);
        let newRepartition = { ...(order.repartitionStatuts || { [StatutCommande.EN_ATTENTE]: order.quantite }) };
        const transitions: Record<string, { from: StatutCommande, to: StatutCommande }> = { 
            'COUPE': { from: StatutCommande.EN_ATTENTE, to: StatutCommande.EN_COUPE }, 
            'COUTURE': { from: StatutCommande.EN_COUPE, to: StatutCommande.COUTURE }, 
            'FINITION': { from: StatutCommande.COUTURE, to: StatutCommande.FINITION }, 
            'REPASSAGE': { from: StatutCommande.FINITION, to: StatutCommande.PRET } 
        };
        const rule = transitions[task.action];
        if (rule) {
            const available = newStatut === 'FAIT' ? (newRepartition[rule.from] || 0) : (newRepartition[rule.to] || 0);
            const qtyToMove = Math.min(task.quantite, available);
            if (qtyToMove > 0) {
                if (newStatut === 'FAIT') { 
                    newRepartition[rule.from] -= qtyToMove; if (newRepartition[rule.from] <= 0) delete newRepartition[rule.from]; 
                    newRepartition[rule.to] = (newRepartition[rule.to] || 0) + qtyToMove; 
                } else { 
                    newRepartition[rule.to] -= qtyToMove; if (newRepartition[rule.to] <= 0) delete newRepartition[rule.to]; 
                    newRepartition[rule.from] = (newRepartition[rule.from] || 0) + qtyToMove; 
                }
            }
        }
        let mostAdvanced = StatutCommande.EN_ATTENTE;
        KANBAN_STATUS_ORDER.forEach(s => { if ((newRepartition[s] || 0) > 0) mostAdvanced = s as StatutCommande; });
        onUpdateOrder({ ...order, taches: updatedTaches, repartitionStatuts: newRepartition, statut: mostAdvanced });
    };

    const handleConfirmPayment = () => {
        if (!selectedOrderForPayment || payAmount <= 0 || !payAccount) return;
        onAddPayment(selectedOrderForPayment.id, payAmount, payMethod, "Règlement solde production", payDate, payAccount);
        setPaymentModalOpen(false); setSelectedOrderForPayment(null);
    };

    const handleFinalDelivery = () => {
        if (!deliveryModal) return;
        const { order, qty } = deliveryModal;
        if (order.reste > 0 && !window.confirm(`⚠️ ATTENTION : Reste ${order.reste.toLocaleString()} F à payer. Livrer quand même ?`)) return;
        const newRepartition = { ...(order.repartitionStatuts || { [StatutCommande.PRET]: order.quantite }) };
        newRepartition[StatutCommande.PRET] = (newRepartition[StatutCommande.PRET] || 0) - qty;
        if (newRepartition[StatutCommande.PRET] <= 0) delete newRepartition[StatutCommande.PRET];
        newRepartition[StatutCommande.LIVRE] = (newRepartition[StatutCommande.LIVRE] || 0) + qty;
        let allDone = !KANBAN_STATUS_ORDER.some(s => (newRepartition[s] || 0) > 0);
        onUpdateOrder({ ...order, repartitionStatuts: newRepartition, statut: allDone ? StatutCommande.LIVRE : order.statut });
        setDeliveryModal(null); alert("Livraison validée.");
    };

    // --- CALCUL QUANTITÉ ASSIGNABLE PAR ARTICLE ---
    const getAssignableQtyForElement = (order: Commande, elementNom: string, action: ActionProduction) => {
        const totalOrdered = order.elements?.find(e => e.nom === elementNom)?.quantite || 0;
        const alreadyAssigned = (order.taches || [])
            .filter(t => t.elementNom === elementNom && t.action === action)
            .reduce((acc, t) => acc + t.quantite, 0);
        return Math.max(0, totalOrdered - alreadyAssigned);
    };

    return (
        <div className="space-y-6 h-[calc(100vh-8rem)] flex flex-col">
            {/* Header Global */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 shrink-0">
                <div className="flex items-center gap-3">
                    <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2"><Scissors className="text-brand-600"/> Atelier & Flux</h2>
                    <div className="flex gap-2">
                        <button onClick={() => setOrderModalOpen(true)} className="bg-brand-900 text-white px-4 py-2 rounded-lg flex items-center gap-2 text-[10px] font-black uppercase hover:bg-black shadow-lg transition-all active:scale-95"><Plus size={16}/> Nouvelle Commande</button>
                        <button onClick={() => { setNewTaskData({ orderId: '', elementNom: '', action: 'COUTURE', quantite: 1, note: '', tailleurId: '', date: new Date().toISOString().split('T')[0] }); setTaskModalOpen(true); }} className="bg-brand-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 text-[10px] font-black uppercase hover:bg-brand-700 shadow-lg transition-all active:scale-95"><UserPlus size={16}/> Assigner Tâche</button>
                    </div>
                </div>
                <div className="flex flex-wrap bg-white border p-1 rounded-xl shadow-sm">
                    {[{id: 'PLANNING', label: 'Agenda', icon: Calendar},{id: 'KANBAN', label: 'Kanban', icon: Columns},{id: 'ORDERS', label: 'Commandes', icon: ClipboardList},{id: 'TAILORS', label: 'Artisans', icon: Users},{id: 'PERFORMANCE', label: 'Top Performance', icon: Trophy}].map((mode) => (
                        <button key={mode.id} onClick={() => setViewMode(mode.id as any)} className={`px-4 py-1.5 text-[10px] font-black uppercase rounded-lg flex items-center gap-2 transition-all ${viewMode === mode.id ? 'bg-brand-900 text-white shadow-md' : 'text-gray-500 hover:bg-gray-50'}`}><mode.icon size={14}/> <span>{mode.label}</span></button>
                    ))}
                </div>
            </div>

            {/* Zone Contenu */}
            <div className="flex-1 overflow-hidden">
                {viewMode === 'PLANNING' && (
                    <div className="bg-white border rounded-2xl shadow-sm h-full flex flex-col overflow-hidden animate-in fade-in duration-300">
                        <div className="p-4 border-b bg-gray-50 flex justify-between items-center shrink-0">
                            <div className="flex items-center gap-3"><button onClick={() => { const d = new Date(agendaBaseDate); d.setDate(d.getDate()-7); setAgendaBaseDate(d); }} className="p-2 hover:bg-gray-200 rounded-lg border bg-white"><ChevronLeft size={18}/></button><button onClick={() => { const d = new Date(agendaBaseDate); d.setDate(d.getDate()+7); setAgendaBaseDate(d); }} className="p-2 hover:bg-gray-200 rounded-lg border bg-white"><ChevronRight size={18}/></button><span className="font-black text-sm uppercase tracking-widest">{agendaBaseDate.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}</span></div>
                        </div>
                        <div className="flex-1 overflow-auto custom-scrollbar">
                            <table className="w-full border-collapse table-fixed min-w-[1000px]">
                                <thead className="sticky top-0 z-20 bg-gray-100">
                                    <tr><th className="w-44 p-4 border-b border-r text-left text-[10px] font-black text-gray-400 uppercase bg-gray-50 tracking-widest">Artisan</th>{Array.from({length: 7}, (_, i) => { const d = new Date(agendaBaseDate); d.setDate(d.getDate() + i); const isToday = d.toISOString().split('T')[0] === new Date().toISOString().split('T')[0]; return <th key={i} className={`p-3 border-b text-center text-[10px] font-black uppercase ${isToday ? 'bg-brand-50 text-brand-900 border-b-2 border-brand-600' : 'text-gray-500'}`}>{d.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric' })}</th>; })}</tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {tailleurs.map(tailor => (
                                        <tr key={tailor.id} className="group">
                                            <td className="p-4 border-r bg-gray-50 font-black text-xs sticky left-0 z-10 shadow-sm uppercase">{tailor.nom}</td>
                                            {Array.from({length: 7}, (_, i) => {
                                                const d = new Date(agendaBaseDate); d.setDate(d.getDate() + i); const dateStr = d.toISOString().split('T')[0];
                                                const tasks = commandes.flatMap(o => (o.taches || []).map(t => ({...t, order: o}))).filter(t => t.tailleurId === tailor.id && t.date === dateStr);
                                                return <td key={i} className="p-1 border-r h-36 vertical-top relative cursor-pointer hover:bg-brand-50/10" onClick={() => { setNewTaskData({...newTaskData, tailleurId: tailor.id, date: dateStr}); setTaskModalOpen(true); }}><div className="space-y-1 h-full overflow-y-auto no-scrollbar">{tasks.map(t => <div key={t.id} onClick={(e) => { e.stopPropagation(); handleTaskStatusChange(t.order, t, t.statut === 'A_FAIRE' ? 'FAIT' : 'A_FAIRE'); }} className={`p-2 rounded border shadow-sm transition-all hover:scale-105 active:scale-95 ${t.statut === 'FAIT' ? 'bg-green-500 text-white border-green-600' : (t.date < new Date().toISOString().split('T')[0] ? 'bg-red-600 text-white border-red-700 animate-pulse' : 'bg-white text-gray-800 border-gray-200')}`}><div className="flex justify-between items-start gap-1"><span className="text-[9px] font-black uppercase">{t.action} x{t.quantite}</span>{t.statut === 'FAIT' ? <CheckCircle size={10}/> : <Clock size={10}/>}</div><div className="text-[8px] font-bold truncate opacity-90 mt-1 uppercase">{t.order.clientNom} {t.elementNom && `(${t.elementNom})`}</div></div>)}</div></td>;
                                            })}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {viewMode === 'KANBAN' && (
                    <div className="flex gap-4 h-full overflow-x-auto pb-4 custom-scrollbar animate-in slide-in-from-bottom-4 duration-500">
                        {KANBAN_STATUS_ORDER.map((status) => (
                            <div 
                                key={status} 
                                className="flex-1 min-w-[300px] bg-gray-100/40 rounded-2xl flex flex-col border border-gray-200"
                                onDragOver={(e) => e.preventDefault()}
                                onDrop={(e) => handleDropOnColumn(e, status as StatutCommande)}
                            >
                                <div className="p-4 border-b flex justify-between items-center bg-white rounded-t-2xl shrink-0">
                                    <h3 className="text-xs font-black text-gray-700 uppercase tracking-widest">{status}</h3>
                                    <span className="bg-brand-900 text-white text-[10px] px-2.5 py-1 rounded-full font-black shadow-inner">
                                        {filteredCommandes.reduce((acc, c) => acc + (c.repartitionStatuts?.[status] || (c.statut === status ? c.quantite : 0)), 0)} pcs
                                    </span>
                                </div>
                                <div className="flex-1 overflow-y-auto p-3 space-y-4">
                                    {filteredCommandes.filter(c => (c.repartitionStatuts?.[status] || 0) > 0 || (!c.repartitionStatuts && c.statut === status)).map(order => {
                                        const qtyInColumn = (order.repartitionStatuts?.[status]) || (order.statut === status ? order.quantite : 0);
                                        return (
                                            <div 
                                                key={order.id} 
                                                draggable 
                                                onDragStart={(e) => handleDragStart(e, order.id, status)}
                                                className="bg-white p-4 rounded-xl shadow-sm border-b-4 border-gray-200 cursor-grab hover:border-brand-500 active:cursor-grabbing group transition-all"
                                            >
                                                <div className="flex justify-between items-center mb-2 text-[10px] font-black text-gray-400">
                                                    <span>#{order.id.slice(-6)}</span>
                                                    <span className="bg-brand-50 text-brand-700 px-2 py-0.5 rounded-lg border border-brand-100">QTÉ: {qtyInColumn}</span>
                                                </div>
                                                <p className="font-black text-gray-800 text-sm mb-1 uppercase tracking-tight">{order.clientNom}</p>
                                                <p className="text-[10px] text-gray-500 italic line-clamp-1 border-l-2 border-brand-200 pl-2 mb-3">{order.description}</p>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {viewMode === 'ORDERS' && (
                    <div className="bg-white border rounded-2xl shadow-sm h-full flex flex-col overflow-hidden animate-in slide-in-from-bottom-4 duration-300">
                        <div className="p-4 bg-gray-50 border-b flex justify-between items-center shrink-0">
                            <div className="flex bg-white border p-1 rounded-xl shadow-inner shrink-0">
                                {[{id: 'ACTIVE', label: 'En cours', icon: Activity},{id: 'READY', label: 'Prêts', icon: CheckSquare},{id: 'DELIVERED', label: 'Livrées', icon: Truck},{id: 'ALL', label: 'Toutes', icon: ClipboardList}].map((f) => (
                                    <button key={f.id} onClick={() => setListFilter(f.id as any)} className={`px-4 py-2 text-[10px] font-black uppercase rounded-lg transition-all flex items-center gap-2 ${listFilter === f.id ? 'bg-brand-900 text-white shadow-lg' : 'text-gray-500 hover:bg-gray-50'}`}><f.icon size={12}/> {f.label}</button>
                                ))}
                            </div>
                            <div className="relative w-80"><Search className="absolute left-4 top-2.5 text-gray-400" size={18}/><input type="text" placeholder="Chercher client, réf..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full pl-12 pr-4 py-2 border-2 border-gray-100 rounded-xl text-sm font-bold bg-white focus:border-brand-600 outline-none"/></div>
                        </div>
                        <div className="flex-1 overflow-auto custom-scrollbar">
                            <table className="w-full text-sm text-left">
                                <thead className="bg-white text-gray-400 font-black border-b sticky top-0 z-10 uppercase text-[9px] tracking-widest"><tr><th className="p-4">Client & Dates</th><th className="p-4 text-right">Finance</th><th className="p-4">État Production</th><th className="p-4 text-right">Actions</th></tr></thead>
                                <tbody className="divide-y divide-gray-100">
                                    {filteredCommandes.map(order => {
                                        const qtyPret = order.repartitionStatuts?.[StatutCommande.PRET] || (order.statut === StatutCommande.PRET ? order.quantite : 0);
                                        return (
                                            <tr key={order.id} className="hover:bg-gray-50 transition-colors group">
                                                <td className="p-4"><div className="font-black text-gray-900 uppercase text-sm">{order.clientNom}</div><div className="text-[10px] text-gray-400 font-bold mt-1">CMD: {new Date(order.dateCommande).toLocaleDateString()} • LIV: <span className="text-brand-700">{new Date(order.dateLivraisonPrevue).toLocaleDateString()}</span></div></td>
                                                <td className="p-4 text-right"><div className="font-black text-gray-900">{order.prixTotal.toLocaleString()} F</div><div className={`text-[10px] font-black ${order.reste > 0 ? 'text-red-600' : 'text-green-700'}`}>{order.reste > 0 ? `RESTE: ${order.reste.toLocaleString()} F` : 'SOLDÉ'}</div></td>
                                                <td className="p-4"><div className="flex flex-wrap gap-1.5">{KANBAN_STATUS_ORDER.map(s => { const q = order.repartitionStatuts?.[s] || (order.statut === s ? order.quantite : 0); return q > 0 && (<span key={s} className="px-2 py-0.5 bg-white text-brand-900 rounded border border-brand-100 text-[8px] font-black uppercase shadow-sm">{s} ({q})</span>); })}</div></td>
                                                <td className="p-4 text-right">
                                                    <div className="flex justify-end gap-1.5">
                                                        <button onClick={() => setOrderDetailView(order)} className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg border border-transparent hover:border-blue-100" title="Détails & Finance"><Eye size={18}/></button>
                                                        {qtyPret > 0 && (<button onClick={() => setDeliveryModal({ order, maxQty: qtyPret, qty: qtyPret })} className="px-3 py-1.5 text-white bg-green-600 hover:bg-green-700 rounded-lg text-[9px] font-black uppercase flex items-center gap-1 shadow-lg active:scale-95"><Truck size={12}/> Livrer</button>)}
                                                        {order.reste > 0 && (<button onClick={() => {setSelectedOrderForPayment(order); setPayAmount(order.reste); setPaymentModalOpen(true);}} className="p-2 text-orange-600 hover:bg-orange-100 rounded-lg border border-transparent hover:border-orange-100"><DollarSign size={18}/></button>)}
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
                
                {/* ... TAILORS ET PERFORMANCE RESTENT IDENTIQUES ... */}
            </div>

            {/* MODALS : TACHE, PAIEMENT, LIVRAISON, KANBAN_MOVE, DETAILS */}

            {/* MODAL NOUVELLE COMMANDE (RE-VISITÉ POUR VISIBILITÉ CAISSE) */}
            {orderModalOpen && (
                <div className="fixed inset-0 bg-brand-900/80 z-[250] flex items-center justify-center p-4 backdrop-blur-md">
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg p-10 flex flex-col max-h-[90vh] animate-in zoom-in duration-300 border border-brand-100">
                        <div className="flex justify-between items-center mb-8 border-b pb-6 shrink-0">
                            <h3 className="text-2xl font-black text-gray-800 flex items-center gap-3 uppercase tracking-tighter"><Scissors className="text-brand-600" size={32}/> Nouvelle Commande</h3>
                            <button onClick={() => setOrderModalOpen(false)} className="hover:bg-gray-100 p-2 rounded-full"><X size={32}/></button>
                        </div>
                        <div className="flex-1 overflow-y-auto space-y-8 pr-2 custom-scrollbar">
                            <div><label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">Sélectionner Client</label><select className="w-full p-4 border-2 border-gray-100 rounded-2xl text-sm font-bold bg-gray-50 focus:border-brand-600 transition-all outline-none" value={newOrderData.clientId} onChange={e => setNewOrderData({...newOrderData, clientId: e.target.value})}><option value="">-- Choisir un client --</option>{clients.map(c => <option key={c.id} value={c.id}>{c.nom} ({c.telephone})</option>)}</select></div>
                            
                            <div className="space-y-4">
                                <div className="flex justify-between items-center"><label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">Articles de la commande</label><button onClick={handleAddItemRow} className="p-1 bg-brand-50 text-brand-600 rounded hover:bg-brand-100"><Plus size={14}/></button></div>
                                {newOrderItems.map((item, idx) => (
                                    <div key={idx} className="flex gap-3 items-center animate-in slide-in-from-left duration-200">
                                        <input type="text" placeholder="Nom (ex: Chemise)" className="flex-1 p-4 border-2 border-gray-100 rounded-2xl text-sm font-bold bg-gray-50 focus:border-brand-600 outline-none uppercase" value={item.nom} onChange={e => { const list = [...newOrderItems]; list[idx].nom = e.target.value.toUpperCase(); setNewOrderItems(list); }} />
                                        <input type="number" min="1" className="w-20 p-4 border-2 border-gray-100 rounded-2xl text-center font-black bg-gray-50" value={item.qte} onChange={e => { const list = [...newOrderItems]; list[idx].qte = parseInt(e.target.value)||1; setNewOrderItems(list); }} />
                                        {newOrderItems.length > 1 && <button onClick={() => handleRemoveItemRow(idx)} className="text-red-400 hover:text-red-600"><Minus size={20}/></button>}
                                    </div>
                                ))}
                            </div>

                            <div className="grid grid-cols-1 gap-6 bg-brand-50 p-6 rounded-3xl border border-brand-100 shadow-inner">
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2"><label className="text-[10px] font-black text-brand-800 uppercase tracking-widest ml-1">Prix Total (TTC)</label><input type="number" placeholder="0" className="w-full p-4 border-2 border-white rounded-2xl text-xl font-black text-brand-900 placeholder:text-gray-300" value={newOrderData.prixTotal || ''} onChange={e => setNewOrderData({...newOrderData, prixTotal: parseInt(e.target.value)||0})}/></div>
                                    <div className="space-y-2"><label className="text-[10px] font-black text-brand-800 uppercase tracking-widest ml-1">Acompte Reçu</label><input type="number" placeholder="0" className="w-full p-4 border-2 border-white rounded-2xl text-xl font-black text-green-600 placeholder:text-gray-300" value={newOrderData.avance || ''} onChange={e => setNewOrderData({...newOrderData, avance: parseInt(e.target.value)||0})}/></div>
                                </div>
                                <div className="space-y-2"><label className="text-[10px] font-black text-brand-800 uppercase tracking-widest ml-1">Date Livraison</label><input type="date" className="w-full p-4 border-2 border-white rounded-2xl text-xs font-bold bg-white" value={newOrderData.dateLivraisonPrevue} onChange={e => setNewOrderData({...newOrderData, dateLivraisonPrevue: e.target.value})}/></div>
                            </div>
                            <div className="space-y-2 pb-6"><label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">Compte d'encaissement</label><select className="w-full p-4 border-2 border-gray-100 rounded-2xl text-sm font-bold bg-gray-50 focus:border-brand-600 outline-none" value={initialAccountId} onChange={e => setInitialAccountId(e.target.value)}><option value="">-- Choisir Caisse --</option>{comptes.map(c => <option key={c.id} value={c.id}>{c.nom} ({c.solde.toLocaleString()} F)</option>)}</select></div>
                        </div>
                        <div className="flex justify-end gap-4 mt-8 shrink-0 pt-4 border-t">
                            <button onClick={() => setOrderModalOpen(false)} className="px-8 py-4 text-gray-400 font-black uppercase text-[10px] tracking-widest">Annuler</button>
                            <button onClick={handleCreateCustomOrder} className="px-12 py-4 bg-brand-900 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-2xl hover:bg-black transition-all transform active:scale-95">Valider</button>
                        </div>
                    </div>
                </div>
            )}

            {/* MODAL ASSIGNATION TACHE (AVEC DISTINCTION ARTICLES & CONTRÔLE QTE) */}
            {taskModalOpen && (
                <div className="fixed inset-0 bg-brand-900/70 z-[200] flex items-center justify-center p-4 backdrop-blur-sm">
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm p-8 animate-in zoom-in duration-300 border border-gray-100">
                        <div className="flex justify-between items-center mb-8 border-b pb-4"><h3 className="font-black text-gray-800 flex items-center gap-3 uppercase tracking-tighter text-lg"><UserPlus size={24} className="text-brand-600"/> Nouvelle Assignation</h3><button onClick={() => setTaskModalOpen(false)} className="hover:bg-gray-100 p-2 rounded-full transition-colors"><X size={24}/></button></div>
                        <div className="space-y-6">
                            <div><label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 ml-1">Commande Client</label><select className="w-full p-4 border-2 border-gray-100 rounded-2xl text-sm font-bold bg-gray-50 focus:border-brand-600 transition-all outline-none" value={newTaskData.orderId} onChange={e => {
                                const cmdId = e.target.value;
                                const cmd = commandes.find(c => c.id === cmdId);
                                setNewTaskData({...newTaskData, orderId: cmdId, elementNom: cmd?.elements?.[0]?.nom || ''});
                            }}><option value="">-- Sélectionner Commande --</option>{commandes.filter(c => !c.archived && c.statut !== StatutCommande.LIVRE).map(c => <option key={c.id} value={c.id}>{c.clientNom} (#{c.id.slice(-6)})</option>)}</select></div>
                            
                            {newTaskData.orderId && (
                                <div><label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 ml-1">Article spécifique</label><select className="w-full p-4 border-2 border-brand-50 rounded-2xl text-sm font-black bg-brand-50/20 text-brand-900 focus:border-brand-600 transition-all outline-none" value={newTaskData.elementNom} onChange={e => setNewTaskData({...newTaskData, elementNom: e.target.value})}><option value="">-- Choisir Article --</option>{commandes.find(c => c.id === newTaskData.orderId)?.elements?.map(el => <option key={el.nom} value={el.nom}>{el.nom} (Total: {el.quantite})</option>)}</select></div>
                            )}

                            <div><label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 ml-1">Étape de Production</label><select className="w-full p-4 border-2 border-gray-100 rounded-2xl text-sm font-bold bg-gray-50" value={newTaskData.action} onChange={e => setNewTaskData({...newTaskData, action: e.target.value as any})}><option value="COUPE">Coupe (Départ)</option><option value="COUTURE">Couture / Montage</option><option value="FINITION">Finition / Broderie</option><option value="REPASSAGE">Repassage / Prêt</option></select></div>
                            
                            <div className="grid grid-cols-2 gap-4">
                                <div><label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 ml-1">Qté à assigner</label><input type="number" min="1" className="w-full p-4 border-2 border-gray-100 rounded-2xl text-lg font-black bg-gray-50 text-center" value={newTaskData.quantite} onChange={e => setNewTaskData({...newTaskData, quantite: parseInt(e.target.value)||1})}/></div>
                                <div><label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 ml-1">Date Prévue</label><input type="date" className="w-full p-4 border-2 border-gray-100 rounded-2xl text-xs font-bold bg-gray-50" value={newTaskData.date} onChange={e => setNewTaskData({...newTaskData, date: e.target.value})}/></div>
                            </div>

                            <div><label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 ml-1">Artisan</label><select className="w-full p-4 border-2 border-gray-100 rounded-2xl text-sm font-bold bg-gray-50" value={newTaskData.tailleurId} onChange={e => setNewTaskData({...newTaskData, tailleurId: e.target.value})}><option value="">-- Choisir Artisan --</option>{tailleurs.map(t => <option key={t.id} value={t.id}>{t.nom}</option>)}</select></div>
                        </div>
                        <div className="flex justify-end gap-3 mt-10"><button onClick={() => setTaskModalOpen(false)} className="px-6 py-4 text-gray-400 font-black uppercase text-[10px] tracking-widest hover:text-gray-600">Annuler</button><button disabled={!newTaskData.tailleurId || !newTaskData.orderId || !newTaskData.elementNom} onClick={() => {
                                const order = commandes.find(c => c.id === newTaskData.orderId);
                                if (order && newTaskData.tailleurId) {
                                    const maxAssign = getAssignableQtyForElement(order, newTaskData.elementNom, newTaskData.action);
                                    if (newTaskData.quantite > maxAssign) {
                                        alert(`⚠️ QUANTITÉ TROP ÉLEVÉE !\nIl ne reste que ${maxAssign} ${newTaskData.elementNom} à assigner pour cette étape.`);
                                        return;
                                    }
                                    const newTask: TacheProduction = { id: `T_${Date.now()}`, commandeId: order.id, elementNom: newTaskData.elementNom, action: newTaskData.action, quantite: newTaskData.quantite, tailleurId: newTaskData.tailleurId, date: newTaskData.date, statut: 'A_FAIRE' };
                                    onUpdateOrder({ ...order, taches: [...(order.taches || []), newTask] }); setTaskModalOpen(false); alert("Assignation réussie.");
                                }
                        }} className="px-10 py-4 bg-brand-900 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-xl disabled:opacity-30 active:scale-95 transition-all">Confirmer</button></div>
                    </div>
                </div>
            )}

            {/* MODAL DETAILS & FINANCE (RÉ-AFFIRMÉ) */}
            {orderDetailView && (
                <div className="fixed inset-0 bg-brand-900/90 z-[300] flex items-center justify-center p-4 backdrop-blur-md">
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl flex flex-col h-[85vh] animate-in slide-in-from-bottom-8 duration-300">
                        <div className="p-8 border-b bg-gray-50 flex justify-between items-center rounded-t-3xl shrink-0">
                            <div><h3 className="text-2xl font-black text-gray-800 uppercase tracking-tighter">Fiche Commande</h3><p className="text-[10px] text-gray-400 font-mono tracking-widest mt-1">REF: #{orderDetailView.id}</p></div>
                            <button onClick={() => setOrderDetailView(null)} className="hover:bg-gray-200 p-3 rounded-full transition-colors"><X size={32}/></button>
                        </div>
                        <div className="flex-1 overflow-y-auto p-8 space-y-8 custom-scrollbar">
                            <div className="grid grid-cols-2 gap-8 border-b pb-8">
                                <div><h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3">Composition</h4><div className="space-y-2">{orderDetailView.elements?.map((e, i) => (<div key={i} className="flex justify-between items-center bg-gray-50 p-3 rounded-xl border border-gray-100"><span className="text-sm font-bold text-gray-800 uppercase">{e.nom}</span><span className="font-black text-brand-600">x{e.quantite}</span></div>))}</div></div>
                                <div><h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3">Dates Clés</h4><div className="space-y-3"><div className="flex justify-between text-sm"><span className="text-gray-500 font-bold uppercase">Commande :</span><span className="font-bold">{new Date(orderDetailView.dateCommande).toLocaleDateString()}</span></div><div className="flex justify-between text-sm"><span className="text-gray-500 font-bold uppercase">Livraison :</span><span className="font-black text-brand-700 underline decoration-2">{new Date(orderDetailView.dateLivraisonPrevue).toLocaleDateString()}</span></div></div></div>
                            </div>
                            <div>
                                <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-4">Historique des Règlements</h4>
                                <div className="space-y-3">
                                    <div className="flex justify-between items-center p-4 bg-brand-900 text-white rounded-2xl shadow-lg mb-6"><span className="text-xs font-black uppercase tracking-widest">Total TTC</span><span className="text-2xl font-black">{orderDetailView.prixTotal.toLocaleString()} F</span></div>
                                    <div className="space-y-2">
                                        {orderDetailView.paiements?.map((p, i) => (
                                            <div key={i} className="flex justify-between items-center bg-green-50 p-4 rounded-2xl border-l-4 border-green-600">
                                                <div><p className="text-xs font-black text-green-900 uppercase">{p.note || 'Versement'}</p><p className="text-[10px] text-green-700 font-bold">{new Date(p.date).toLocaleDateString()} à {new Date(p.date).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})} • {p.moyenPaiement}</p></div>
                                                <span className="font-black text-green-700">+{p.montant.toLocaleString()} F</span>
                                            </div>
                                        ))}
                                    </div>
                                    <div className={`mt-6 p-6 rounded-3xl border-2 flex justify-between items-center ${orderDetailView.reste > 0 ? 'bg-red-50 border-red-100 text-red-700' : 'bg-green-50 border-green-100 text-green-700'}`}><span className="font-black uppercase text-xs tracking-widest">Reste à Payer</span><span className="text-3xl font-black">{orderDetailView.reste.toLocaleString()} F</span></div>
                                </div>
                            </div>
                            <div><h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-4">Artisans sur cette commande</h4><div className="flex flex-wrap gap-2">{Array.from(new Set(orderDetailView.taches?.map(t => employes.find(e => e.id === t.tailleurId)?.nom))).map((nom, i) => (<span key={i} className="px-4 py-2 bg-gray-100 text-gray-800 rounded-xl text-xs font-black uppercase tracking-tighter border border-gray-200">{nom}</span>))}</div></div>
                        </div>
                        <div className="p-8 border-t bg-gray-50 flex justify-end shrink-0 rounded-b-3xl"><button onClick={() => setOrderDetailView(null)} className="px-10 py-4 bg-gray-800 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest">Fermer</button></div>
                    </div>
                </div>
            )}

            {/* MODAL KANBAN MOVE (MAINTENU & VÉRIFIÉ) */}
            {kanbanMoveModal && (
                <div className="fixed inset-0 bg-brand-900/70 z-[320] flex items-center justify-center p-4 backdrop-blur-sm">
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm p-8 animate-in zoom-in duration-200 border border-brand-100">
                        <h3 className="text-xl font-black text-gray-800 mb-8 flex items-center gap-3 uppercase tracking-tighter border-b pb-4"><ArrowRightLeft className="text-brand-600"/> Déplacer Articles</h3>
                        <div className="space-y-6">
                            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest text-center">De <span className="text-gray-900">{kanbanMoveModal.fromStatus}</span> → <span className="text-brand-600">{kanbanMoveModal.toStatus}</span></p>
                            <div><label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 ml-1">Nombre de pièces</label><input type="number" min="1" max={kanbanMoveModal.maxQty} className="w-full p-4 border-2 border-gray-100 rounded-2xl text-2xl font-black bg-gray-50 text-center" value={kanbanMoveModal.qty} onChange={e => setKanbanMoveModal({...kanbanMoveModal, qty: Math.min(kanbanMoveModal.maxQty, parseInt(e.target.value)||1)})}/></div>
                            <div className="bg-brand-50 p-6 rounded-2xl border border-brand-100"><label className="block text-[10px] font-black text-brand-800 uppercase mb-3 tracking-widest">Assigner l'artisan pour cette étape ?</label><select className="w-full p-3 border-2 border-white rounded-xl text-xs font-bold" value={kanbanMoveModal.assignTailorId} onChange={e => setKanbanMoveModal({...kanbanMoveModal, assignTailorId: e.target.value})}><option value="">-- Continuer sans assignation --</option>{tailleurs.map(t => <option key={t.id} value={t.id}>{t.nom}</option>)}</select></div>
                        </div>
                        <div className="flex justify-end gap-3 mt-10"><button onClick={() => setKanbanMoveModal(null)} className="px-6 py-4 text-gray-400 font-bold uppercase text-[10px] tracking-widest">Annuler</button><button onClick={executeKanbanMove} className="px-10 py-4 bg-brand-900 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-xl active:scale-95">Valider</button></div>
                    </div>
                </div>
            )}

            {/* MODAL PAIEMENT SOLDE (MAINTENU) */}
            {paymentModalOpen && selectedOrderForPayment && (
                <div className="fixed inset-0 bg-brand-900/70 z-[180] flex items-center justify-center p-4 backdrop-blur-sm">
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm p-8">
                        <div className="flex justify-between items-center mb-8 border-b pb-4"><h3 className="text-xl font-black flex items-center gap-3 text-gray-800 uppercase tracking-tighter"><Wallet size={24} className="text-orange-600"/> Encaissement Solde</h3><button onClick={() => setPaymentModalOpen(false)}><X size={24} className="text-gray-400"/></button></div>
                        <div className="space-y-6">
                            <div className="bg-orange-50 p-4 rounded-2xl border border-orange-100 flex justify-between items-center"><span className="text-xs font-black text-orange-800 uppercase">Reste Dû</span><span className="text-xl font-black text-orange-900">{selectedOrderForPayment.reste.toLocaleString()} F</span></div>
                            <div><label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 ml-1">Montant perçu</label><input type="number" className="w-full p-4 border-2 border-gray-100 rounded-2xl font-black text-2xl bg-gray-50 focus:border-orange-500 outline-none transition-all" value={payAmount} onChange={e => setPayAmount(Math.min(selectedOrderForPayment.reste, parseInt(e.target.value) || 0))} /></div>
                            <div><label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 ml-1">Caisse de Destination</label><select className="w-full p-4 border-2 border-gray-100 rounded-2xl bg-gray-50 text-sm font-bold" value={payAccount} onChange={e => setPayAccount(e.target.value)}><option value="">-- Choisir un compte --</option>{comptes.map(acc => (<option key={acc.id} value={acc.id}>{acc.nom} ({acc.solde.toLocaleString()} F)</option>))}</select></div>
                        </div>
                        <div className="flex justify-end gap-3 mt-10"><button onClick={() => setPaymentModalOpen(false)} className="px-6 py-4 text-gray-400 font-bold uppercase text-[10px] tracking-widest">Annuler</button><button onClick={handleConfirmPayment} disabled={!payAccount || payAmount <= 0} className="px-10 py-4 bg-brand-900 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-xl disabled:opacity-30 active:scale-95">Valider</button></div>
                    </div>
                </div>
            )}

            {/* MODAL LIVRAISON (MAINTENU) */}
            {deliveryModal && (
                <div className="fixed inset-0 bg-brand-900/80 z-[350] flex items-center justify-center p-4 backdrop-blur-sm">
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm p-10 text-center border-t-8 border-green-500 animate-in zoom-in duration-200">
                        <div className="w-20 h-20 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-6"><Truck size={40}/></div>
                        <h3 className="text-2xl font-black text-gray-800 mb-2 uppercase tracking-tighter">Confirmation Livraison</h3>
                        <p className="text-sm text-gray-500 mb-8 font-bold">Confirmer la sortie de <span className="text-gray-900 uppercase">{deliveryModal.order.clientNom}</span> ?</p>
                        <div className="mb-8 text-left bg-gray-50 p-6 rounded-2xl border border-gray-100">
                            <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3 text-center">Quantité à livrer</label>
                            <input type="number" min="1" max={deliveryModal.maxQty} className="w-full p-4 border-2 border-white rounded-xl text-3xl font-black text-brand-900 text-center shadow-sm" value={deliveryModal.qty} onChange={e => setDeliveryModal({...deliveryModal, qty: Math.min(deliveryModal.maxQty, parseInt(e.target.value)||1)})}/>
                        </div>
                        <div className="flex flex-col gap-3">
                            <button onClick={handleFinalDelivery} className="w-full py-5 bg-green-600 text-white rounded-2xl font-black uppercase text-xs tracking-widest shadow-xl active:scale-95">Valider la Sortie</button>
                            <button onClick={() => setDeliveryModal(null)} className="w-full py-4 text-gray-400 font-bold uppercase text-[10px] tracking-widest">Annuler</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ProductionView;
