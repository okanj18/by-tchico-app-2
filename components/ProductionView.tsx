
import React, { useState, useMemo } from 'react';
import { Commande, Employe, Client, Article, StatutCommande, RoleEmploye, ModePaiement, CompteFinancier, CompanyAssets, TacheProduction, ActionProduction, ElementCommande } from '../types';
import { Scissors, LayoutList, Users, History, Search, Camera, X, Activity, Clock, Shirt, Calendar, CheckCircle, CheckSquare, Zap, Columns, Trophy, Wallet, Printer, Eye, UserPlus, Plus, Save, Truck, ArrowRightLeft, DollarSign, Trash2, AlertTriangle, ChevronLeft, ChevronRight, Archive, ClipboardList, Filter } from 'lucide-react';
import { QRScannerModal } from './QRTools';

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
    const [isScannerOpen, setIsScannerOpen] = useState(false);
    
    const [agendaBaseDate, setAgendaBaseDate] = useState(() => {
        const d = new Date();
        d.setHours(0,0,0,0);
        return d;
    });

    const [overdueModalOpen, setOverdueModalOpen] = useState(false);
    const [taskModalOpen, setTaskModalOpen] = useState(false);
    const [paymentModalOpen, setPaymentModalOpen] = useState(false);
    const [deliveryModal, setDeliveryModal] = useState<{ order: Commande, maxQty: number, qty: number } | null>(null);
    const [kanbanMoveModal, setKanbanMoveModal] = useState<{
        order: Commande, fromStatus: StatutCommande, toStatus: StatutCommande, maxQty: number, qty: number, assignTailorId: string
    } | null>(null);

    const [selectedOrderForPayment, setSelectedOrderForPayment] = useState<Commande | null>(null);
    const [payAmount, setPayAmount] = useState(0);
    const [payAccount, setPayAccount] = useState('');
    const [payMethod, setPayMethod] = useState<ModePaiement>('ESPECE');
    const [payDate, setPayDate] = useState(new Date().toISOString().split('T')[0]);

    const [newTaskData, setNewTaskData] = useState<{ orderId: string, action: ActionProduction, quantite: number, note: string, tailleurId: string, date: string }>({ 
        orderId: '', action: 'COUTURE', quantite: 1, note: '', tailleurId: '', date: new Date().toISOString().split('T')[0] 
    });

    const tailleurs = useMemo(() => {
        return employes.filter(e => (e.role === RoleEmploye.TAILLEUR || e.role === RoleEmploye.CHEF_ATELIER || e.role === RoleEmploye.STAGIAIRE) && e.actif !== false).sort((a, b) => a.nom.localeCompare(b.nom));
    }, [employes]);

    const filteredCommandes = useMemo(() => {
        return commandes.filter(c => {
            if (c.type !== 'SUR_MESURE') return false; 
            const isCompleted = c.statut === StatutCommande.LIVRE || c.statut === StatutCommande.ANNULE;
            const isArchived = c.archived === true;
            const isReady = (c.repartitionStatuts?.[StatutCommande.PRET] || 0) > 0 || c.statut === StatutCommande.PRET;

            if (viewMode === 'ORDERS') {
                if (listFilter === 'ACTIVE' && (isCompleted || isArchived)) return false;
                if (listFilter === 'READY' && !isReady) return false;
                if (listFilter === 'DELIVERED' && !isCompleted) return false;
                if (listFilter === 'ARCHIVED' && !isArchived) return false;
            } else if (viewMode === 'KANBAN') {
                if (isCompleted || isArchived) return false;
            }

            const searchLower = searchTerm.toLowerCase();
            return c.clientNom.toLowerCase().includes(searchLower) || c.id.toLowerCase().includes(searchLower);
        }).sort((a, b) => new Date(b.dateCommande).getTime() - new Date(a.dateCommande).getTime());
    }, [commandes, searchTerm, viewMode, listFilter]);

    const overdueTasks = useMemo(() => {
        const todayStr = new Date().toISOString().split('T')[0];
        return commandes.flatMap(c => (c.taches || []).map(t => ({...t, order: c}))).filter(t => t.statut === 'A_FAIRE' && t.date < todayStr);
    }, [commandes]);

    // Fonction pour obtenir les artisans assignés à une étape précise (utilisé dans le Kanban)
    const getAssignedTailorsWithStatus = (order: Commande, status: StatutCommande | string) => {
        const statusToAction: Record<string, ActionProduction> = { 
            [StatutCommande.EN_COUPE]: 'COUPE', 
            [StatutCommande.COUTURE]: 'COUTURE', 
            [StatutCommande.FINITION]: 'FINITION', 
            [StatutCommande.PRET]: 'REPASSAGE' 
        };
        const targetAction = statusToAction[status];
        if (!targetAction) return [];
        const todayStr = new Date().toISOString().split('T')[0];
        return (order.taches || []).filter(t => t.action === targetAction).map(t => {
            const emp = employes.find(e => e.id === t.tailleurId);
            return { 
                name: emp?.nom || 'Inconnu', 
                statut: t.statut, 
                isLate: t.statut === 'A_FAIRE' && t.date < todayStr,
                qty: t.quantite
            };
        });
    };

    // LOGIQUE DE SYNCHRONISATION INTELLIGENTE
    const handleTaskStatusChange = (order: Commande, task: TacheProduction, newStatut: 'A_FAIRE' | 'FAIT') => {
        const updatedTaches = (order.taches || []).map(t => t.id === task.id ? { ...t, statut: newStatut } : t);
        
        // On récupère la répartition actuelle ou on l'initialise si vide
        let newRepartition = { ...(order.repartitionStatuts || { [StatutCommande.EN_ATTENTE]: order.quantite }) };
        
        // Définition des transitions de flux basées sur l'action terminée
        const transitions: Record<string, { from: StatutCommande, to: StatutCommande }> = { 
            'COUPE': { from: StatutCommande.EN_ATTENTE, to: StatutCommande.EN_COUPE }, 
            'COUTURE': { from: StatutCommande.EN_COUPE, to: StatutCommande.COUTURE }, 
            'FINITION': { from: StatutCommande.COUTURE, to: StatutCommande.FINITION }, 
            'REPASSAGE': { from: StatutCommande.FINITION, to: StatutCommande.PRET } 
        };

        const rule = transitions[task.action];
        if (rule) {
            if (newStatut === 'FAIT') {
                // Avancer dans le flux
                const availableInSource = newRepartition[rule.from] || 0;
                const qtyToMove = Math.min(task.quantite, availableInSource);
                if (qtyToMove > 0) {
                    newRepartition[rule.from] -= qtyToMove; 
                    if (newRepartition[rule.from] <= 0) delete newRepartition[rule.from];
                    newRepartition[rule.to] = (newRepartition[rule.to] || 0) + qtyToMove;
                }
            } else {
                // Reculer dans le flux (Rollback)
                const availableInDest = newRepartition[rule.to] || 0;
                const qtyToMove = Math.min(task.quantite, availableInDest);
                if (qtyToMove > 0) {
                    newRepartition[rule.to] -= qtyToMove;
                    if (newRepartition[rule.to] <= 0) delete newRepartition[rule.to];
                    newRepartition[rule.from] = (newRepartition[rule.from] || 0) + qtyToMove;
                }
            }
        }

        // Calculer le statut global (le plus avancé qui contient des pièces)
        let mostAdvanced = StatutCommande.EN_ATTENTE;
        KANBAN_STATUS_ORDER.forEach(s => { 
            if ((newRepartition[s] || 0) > 0) mostAdvanced = s as StatutCommande; 
        });

        onUpdateOrder({ ...order, taches: updatedTaches, repartitionStatuts: newRepartition, statut: mostAdvanced });
    };

    const handleDrop = (orderId: string, fromStatus: string, toStatus: StatutCommande) => {
        if (fromStatus === toStatus) return;
        const order = commandes.find(c => c.id === orderId);
        if (!order) return;
        const currentQty = order.repartitionStatuts ? (order.repartitionStatuts[fromStatus] || 0) : (order.statut === fromStatus ? order.quantite : 0);
        if (currentQty <= 0) return;
        setKanbanMoveModal({ order, fromStatus: fromStatus as StatutCommande, toStatus, maxQty: currentQty, qty: currentQty, assignTailorId: '' });
    };

    const executeKanbanMove = () => {
        if (!kanbanMoveModal) return;
        const { order, fromStatus, toStatus, qty, assignTailorId } = kanbanMoveModal;
        const newRepartition = { ...(order.repartitionStatuts || { [order.statut]: order.quantite }) };
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
                id: `T_KB_${Date.now()}`, 
                commandeId: order.id, 
                action, 
                quantite: qty, 
                tailleurId: assignTailorId, 
                date: new Date().toISOString().split('T')[0], 
                statut: 'A_FAIRE' 
            });
        }
        onUpdateOrder({ ...order, repartitionStatuts: newRepartition, statut: mostAdvanced, taches: updatedTaches });
        setKanbanMoveModal(null);
    };

    const handleFinalDelivery = () => {
        if (!deliveryModal) return;
        const { order, qty } = deliveryModal;

        if (order.reste > 0) {
            const confirmUnpaid = window.confirm(`⚠️ COMMANDE NON SOLDÉE !\nIl reste ${order.reste.toLocaleString()} F à payer.\n\nConfirmer quand même la livraison ?`);
            if (!confirmUnpaid) return;
        }

        const newRepartition = { ...(order.repartitionStatuts || { [StatutCommande.PRET]: order.quantite }) };
        newRepartition[StatutCommande.PRET] = (newRepartition[StatutCommande.PRET] || 0) - qty;
        if (newRepartition[StatutCommande.PRET] <= 0) delete newRepartition[StatutCommande.PRET];
        newRepartition[StatutCommande.LIVRE] = (newRepartition[StatutCommande.LIVRE] || 0) + qty;
        
        let allDelivered = true;
        KANBAN_STATUS_ORDER.forEach(s => { if ((newRepartition[s] || 0) > 0) allDelivered = false; });
        
        onUpdateOrder({ ...order, repartitionStatuts: newRepartition, statut: allDelivered ? StatutCommande.LIVRE : order.statut });
        setDeliveryModal(null); 
        alert(`Livraison effectuée.`);
    };

    // Fix: Missing name 'handleConfirmPayment' error. Record a payment for the remaining balance of an order.
    const handleConfirmPayment = () => {
        if (!selectedOrderForPayment || payAmount <= 0 || !payAccount) return;
        onAddPayment(selectedOrderForPayment.id, payAmount, payMethod, "Règlement solde (Atelier)", payDate, payAccount);
        setPaymentModalOpen(false);
        setSelectedOrderForPayment(null);
    };

    return (
        <div className="space-y-6 h-[calc(100vh-8rem)] flex flex-col">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 shrink-0">
                <div className="flex items-center gap-3">
                    <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2"><Scissors className="text-brand-600"/> Atelier & Flux</h2>
                    <button onClick={() => { setNewTaskData({ ...newTaskData, orderId: '', tailleurId: '', date: new Date().toISOString().split('T')[0] }); setTaskModalOpen(true); }} className="bg-brand-600 text-white px-3 py-2 rounded-lg flex items-center gap-2 text-xs font-bold hover:bg-brand-700 shadow-md transition-all active:scale-95"><Plus size={14}/> Assigner Tâche</button>
                </div>
                <div className="flex flex-wrap bg-white border p-1 rounded-lg shadow-sm">
                    {[{id: 'PLANNING', label: 'Agenda', icon: Calendar},{id: 'KANBAN', label: 'Kanban', icon: Columns},{id: 'ORDERS', label: 'Commandes', icon: LayoutList},{id: 'TAILORS', label: 'Artisans', icon: Users}].map((mode) => (
                        <button key={mode.id} onClick={() => setViewMode(mode.id as any)} className={`px-4 py-1.5 text-xs font-bold rounded flex items-center gap-2 transition-all ${viewMode === mode.id ? 'bg-brand-900 text-white shadow-lg' : 'text-gray-500 hover:bg-gray-50'}`}><mode.icon size={14}/> <span>{mode.label}</span></button>
                    ))}
                </div>
            </div>

            <div className="flex-1 overflow-hidden">
                {viewMode === 'PLANNING' && (
                    <div className="bg-white border rounded-xl shadow-sm h-full flex flex-col overflow-hidden animate-in fade-in duration-300">
                        <div className="p-3 border-b bg-gray-50 flex justify-between items-center shrink-0">
                            <div className="flex items-center gap-2">
                                <button onClick={() => { const d = new Date(agendaBaseDate); d.setDate(d.getDate()-7); setAgendaBaseDate(d); }} className="p-1.5 hover:bg-gray-200 rounded border border-gray-300"><ChevronLeft size={18}/></button>
                                <button onClick={() => { const d = new Date(agendaBaseDate); d.setDate(d.getDate()+7); setAgendaBaseDate(d); }} className="p-1.5 hover:bg-gray-200 rounded border border-gray-300"><ChevronRight size={18}/></button>
                                <span className="font-black text-sm ml-2 uppercase tracking-tighter text-gray-700">{agendaBaseDate.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}</span>
                            </div>
                            {overdueTasks.length > 0 && (<button onClick={() => setOverdueModalOpen(true)} className="bg-red-600 text-white px-4 py-1.5 rounded-full text-[10px] font-black flex items-center gap-2 animate-pulse shadow-lg uppercase tracking-widest"><AlertTriangle size={14}/> {overdueTasks.length} Retards en cours</button>)}
                        </div>
                        <div className="flex-1 overflow-auto custom-scrollbar">
                            <table className="w-full border-collapse table-fixed min-w-[1000px]">
                                <thead className="sticky top-0 z-20 bg-gray-100">
                                    <tr>
                                        <th className="w-40 p-3 border-b border-r text-left text-[10px] font-black text-gray-400 uppercase bg-gray-50 tracking-widest">Artisan</th>
                                        {Array.from({length: 7}, (_, i) => { 
                                            const d = new Date(agendaBaseDate); d.setDate(d.getDate() + i); 
                                            const isToday = d.toISOString().split('T')[0] === new Date().toISOString().split('T')[0]; 
                                            return <th key={i} className={`p-2 border-b text-center text-[10px] font-black uppercase tracking-tighter ${isToday ? 'bg-brand-50 text-brand-900 border-b-2 border-brand-600' : 'text-gray-500'}`}>{d.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric' })}</th>; 
                                        })}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {tailleurs.map(tailor => (
                                        <tr key={tailor.id} className="group">
                                            <td className="p-3 border-r bg-gray-50 font-bold text-xs sticky left-0 z-10 shadow-sm group-hover:bg-brand-50 transition-colors">{tailor.nom}</td>
                                            {Array.from({length: 7}, (_, i) => {
                                                const d = new Date(agendaBaseDate); d.setDate(d.getDate() + i);
                                                const dateStr = d.toISOString().split('T')[0];
                                                const tasks = commandes.flatMap(o => (o.taches || []).map(t => ({...t, order: o}))).filter(t => t.tailleurId === tailor.id && t.date === dateStr);
                                                const isToday = dateStr === new Date().toISOString().split('T')[0];
                                                
                                                return (
                                                    <td key={i} className={`p-1 border-r h-36 vertical-top relative cursor-pointer hover:bg-brand-50/20 transition-colors ${isToday ? 'bg-brand-50/5' : ''}`} onClick={() => { setNewTaskData({...newTaskData, tailleurId: tailor.id, date: dateStr}); setTaskModalOpen(true); }}>
                                                        <div className="space-y-1 h-full overflow-y-auto no-scrollbar">
                                                            {tasks.map(t => (
                                                                <div 
                                                                    key={t.id} 
                                                                    onClick={(e) => { e.stopPropagation(); handleTaskStatusChange(t.order, t, t.statut === 'A_FAIRE' ? 'FAIT' : 'A_FAIRE'); }} 
                                                                    className={`p-2 rounded border shadow-sm transition-all hover:scale-[1.02] active:scale-95 ${t.statut === 'FAIT' ? 'bg-green-500 text-white border-green-600' : (t.date < new Date().toISOString().split('T')[0] ? 'bg-red-600 text-white border-red-700 animate-pulse' : (isToday ? 'bg-orange-500 text-white border-orange-600' : 'bg-white text-gray-800 border-gray-200'))}`}
                                                                >
                                                                    <div className="flex justify-between items-start gap-1">
                                                                        <span className="text-[9px] font-black leading-tight uppercase">{t.action} x{t.quantite}</span>
                                                                        {t.statut === 'FAIT' ? <CheckCircle size={10}/> : <Clock size={10}/>}
                                                                    </div>
                                                                    <div className="text-[8px] font-bold truncate opacity-90 mt-1 uppercase">{t.order.clientNom}</div>
                                                                </div>
                                                            ))}
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

                {viewMode === 'KANBAN' && (
                    <div className="flex gap-4 h-full overflow-x-auto pb-4 custom-scrollbar animate-in slide-in-from-bottom-4 duration-500">
                        {KANBAN_STATUS_ORDER.map((status) => (
                            <div key={status} className="flex-1 min-w-[300px] bg-gray-100/40 rounded-2xl flex flex-col border border-gray-200" onDragOver={e => e.preventDefault()} onDrop={(e) => { e.preventDefault(); try { const raw = e.dataTransfer.getData('orderMove'); if(!raw) return; const data = JSON.parse(raw); handleDrop(data.id, data.from, status as StatutCommande); } catch(err) {} }}>
                                <div className="p-4 border-b flex justify-between items-center bg-white rounded-t-2xl shrink-0">
                                    <h3 className="text-xs font-black text-gray-700 uppercase tracking-widest">{status}</h3>
                                    <span className="bg-brand-900 text-white text-[10px] px-2.5 py-1 rounded-full font-black shadow-inner">
                                        {filteredCommandes.reduce((acc, c) => acc + (c.repartitionStatuts?.[status] || (c.statut === status ? c.quantite : 0)), 0)} pcs
                                    </span>
                                </div>
                                <div className="flex-1 overflow-y-auto p-3 space-y-4">
                                    {filteredCommandes.filter(c => (c.repartitionStatuts?.[status] || 0) > 0 || (!c.repartitionStatuts && c.statut === status)).map(order => {
                                        const qtyInColumn = (order.repartitionStatuts?.[status]) || (order.statut === status ? order.quantite : 0);
                                        const targetedTailors = getAssignedTailorsWithStatus(order, status);
                                        return (
                                            <div key={order.id} draggable onDragStart={(e) => e.dataTransfer.setData('orderMove', JSON.stringify({id: order.id, from: status}))} className="bg-white p-4 rounded-xl shadow-sm border-b-4 border-gray-200 cursor-grab hover:border-brand-500 active:cursor-grabbing group transition-all">
                                                <div className="flex justify-between items-center mb-2 text-[10px] font-black text-gray-400">
                                                    <span>#{order.id.slice(-6)}</span>
                                                    <span className="bg-brand-50 text-brand-700 px-2 py-0.5 rounded-lg border border-brand-100">QTÉ: {qtyInColumn}</span>
                                                </div>
                                                <p className="font-black text-gray-800 text-sm mb-1 uppercase tracking-tight">{order.clientNom}</p>
                                                <p className="text-[10px] text-gray-500 italic line-clamp-1 border-l-2 border-brand-200 pl-2 mb-3">{order.description}</p>
                                                
                                                {targetedTailors.length > 0 && (
                                                    <div className="pt-3 border-t border-gray-50 flex flex-wrap gap-2">
                                                        {targetedTailors.map((t, idx) => (
                                                            <div key={idx} className={`text-[8px] px-2 py-1 rounded font-black uppercase tracking-tighter flex items-center gap-1.5 shadow-sm border ${t.statut === 'FAIT' ? 'bg-green-500 text-white border-green-600' : (t.isLate ? 'bg-red-600 text-white animate-pulse' : 'bg-brand-900 text-white border-brand-800')}`}>
                                                                {t.statut === 'FAIT' ? <CheckCircle size={8}/> : <Clock size={8}/>}
                                                                {t.name} (x{t.qty})
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {viewMode === 'ORDERS' && (
                    <div className="bg-white border rounded-xl overflow-hidden shadow-sm h-full flex flex-col animate-in fade-in duration-300">
                        <div className="p-4 bg-gray-50 border-b flex flex-col md:flex-row justify-between items-center gap-4 shrink-0">
                            <div className="flex bg-white border p-1 rounded-xl shadow-inner">
                                {[{id: 'ACTIVE', label: 'En cours', icon: Activity},{id: 'READY', label: 'Prêts', icon: CheckSquare},{id: 'DELIVERED', label: 'Livrées', icon: Truck},{id: 'ALL', label: 'Toutes', icon: ClipboardList}].map((f) => (
                                    <button key={f.id} onClick={() => setListFilter(f.id as any)} className={`px-4 py-2 text-[10px] font-black uppercase rounded-lg transition-all flex items-center gap-2 ${listFilter === f.id ? 'bg-brand-900 text-white shadow-lg' : 'text-gray-500 hover:bg-gray-50'}`}><f.icon size={12}/> {f.label}</button>
                                ))}
                            </div>
                            <div className="relative w-full md:w-64"><Search className="absolute left-3 top-2.5 text-gray-400" size={16}/><input type="text" placeholder="Rechercher..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full pl-10 pr-3 py-2 border rounded-xl text-sm bg-white focus:ring-2 focus:ring-brand-500 transition-all outline-none"/></div>
                        </div>
                        <div className="flex-1 overflow-auto custom-scrollbar">
                            <table className="w-full text-sm text-left">
                                <thead className="bg-white text-gray-400 font-black border-b sticky top-0 z-10 uppercase text-[9px] tracking-widest"><tr><th className="p-4">Client / Commande</th><th className="p-4 text-right">Reste Paiement</th><th className="p-4">Répartition Production</th><th className="p-4 text-right">Actions</th></tr></thead>
                                <tbody className="divide-y divide-gray-100">
                                    {filteredCommandes.map(order => {
                                        const qtyPret = order.repartitionStatuts?.[StatutCommande.PRET] || (order.statut === StatutCommande.PRET ? order.quantite : 0);
                                        return (
                                            <tr key={order.id} className="hover:bg-gray-50 transition-colors group">
                                                <td className="p-4">
                                                    <div className="font-black text-gray-800 uppercase tracking-tight">{order.clientNom}</div>
                                                    <div className="text-[10px] text-gray-400 font-bold mt-0.5">REF: {order.id.slice(-6)} • {order.description}</div>
                                                </td>
                                                <td className={`p-4 text-right font-black ${order.reste > 0 ? 'text-red-600' : 'text-green-600'}`}>{order.reste.toLocaleString()} F</td>
                                                <td className="p-4">
                                                    <div className="flex flex-wrap gap-2">
                                                        {KANBAN_STATUS_ORDER.map(s => {
                                                            const q = order.repartitionStatuts?.[s] || (order.statut === s ? order.quantite : 0);
                                                            return q > 0 && (<span key={s} className="px-2.5 py-1 bg-white text-brand-900 rounded-lg text-[9px] font-black border border-brand-100 shadow-sm uppercase">{s} ({q})</span>);
                                                        })}
                                                    </div>
                                                </td>
                                                <td className="p-4 text-right">
                                                    <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                        {qtyPret > 0 && (<button onClick={() => setDeliveryModal({ order, maxQty: qtyPret, qty: qtyPret })} className="px-4 py-2 text-white bg-green-600 border border-green-700 hover:bg-green-700 rounded-xl text-[10px] font-black flex items-center gap-2 shadow-lg transition-transform active:scale-95 uppercase"><Truck size={14}/> Livrer</button>)}
                                                        {order.reste > 0 && (<button onClick={() => {setSelectedOrderForPayment(order); setPayAmount(order.reste); setPaymentModalOpen(true);}} className="p-2 text-orange-600 hover:bg-orange-100 rounded-xl border border-orange-100 transition-all shadow-sm"><DollarSign size={18}/></button>)}
                                                        <button onClick={() => { setNewTaskData({...newTaskData, orderId: order.id, date: new Date().toISOString().split('T')[0]}); setTaskModalOpen(true); }} className="p-2 text-brand-600 hover:bg-brand-50 rounded-xl border border-brand-100 transition-all shadow-sm"><UserPlus size={18}/></button>
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
            </div>

            {/* MODAL LISTE RETARDS (AMÉLIORÉ) */}
            {overdueModalOpen && (
                <div className="fixed inset-0 bg-brand-900/80 z-[200] flex items-center justify-center p-4 backdrop-blur-md">
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg flex flex-col max-h-[80vh] overflow-hidden border border-red-200">
                        <div className="p-6 border-b bg-red-600 text-white flex justify-between items-center shrink-0">
                            <h3 className="font-black flex items-center gap-3 uppercase tracking-widest text-sm"><AlertTriangle size={24} className="animate-bounce"/> Attention : Retards Critiques</h3>
                            <button onClick={() => setOverdueModalOpen(false)} className="hover:bg-white/20 p-2 rounded-full transition-colors"><X size={24}/></button>
                        </div>
                        <div className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar">
                            {overdueTasks.map(t => (
                                <div key={t.id} className="p-4 bg-red-50 border-2 border-red-100 rounded-2xl flex justify-between items-center group hover:border-red-300 transition-all">
                                    <div>
                                        <p className="font-black text-gray-900 text-sm uppercase tracking-tight">{t.order.clientNom}</p>
                                        <p className="text-[10px] text-red-700 font-black uppercase mt-1 tracking-wider">{t.action} x{t.quantite} • Échéance : {new Date(t.date).toLocaleDateString()}</p>
                                    </div>
                                    <button onClick={() => { handleTaskStatusChange(t.order, t, 'FAIT'); if(overdueTasks.length === 1) setOverdueModalOpen(false); }} className="px-5 py-2 bg-green-600 hover:bg-green-700 text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg active:scale-95 transition-all">Marquer Fait</button>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* MODAL ASSIGNATION TACHE (ACTUALISÉ) */}
            {taskModalOpen && (
                <div className="fixed inset-0 bg-brand-900/70 z-[200] flex items-center justify-center p-4 backdrop-blur-sm">
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm p-8 animate-in zoom-in duration-300 border border-gray-100">
                        <div className="flex justify-between items-center mb-8 border-b pb-4">
                            <h3 className="font-black text-gray-800 flex items-center gap-3 uppercase tracking-tighter text-lg"><UserPlus size={24} className="text-brand-600"/> Nouvelle Assignation</h3>
                            <button onClick={() => setTaskModalOpen(false)} className="hover:bg-gray-100 p-2 rounded-full transition-colors"><X size={24}/></button>
                        </div>
                        <div className="space-y-6">
                            <div><label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 ml-1">Commande Client</label><select className="w-full p-4 border-2 border-gray-100 rounded-2xl text-sm font-bold bg-gray-50 focus:border-brand-600 transition-all outline-none" value={newTaskData.orderId} onChange={e => setNewTaskData({...newTaskData, orderId: e.target.value})}><option value="">-- Sélectionner Commande --</option>{commandes.filter(c => !c.archived && c.statut !== StatutCommande.LIVRE).map(c => <option key={c.id} value={c.id}>{c.clientNom} (#{c.id.slice(-6)})</option>)}</select></div>
                            <div><label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 ml-1">Étape de Production</label><select className="w-full p-4 border-2 border-brand-50 rounded-2xl text-sm font-bold bg-brand-50/50 text-brand-900 focus:border-brand-600 transition-all outline-none" value={newTaskData.action} onChange={e => setNewTaskData({...newTaskData, action: e.target.value as any})}><option value="COUPE">Coupe (Départ)</option><option value="COUTURE">Couture / Montage</option><option value="FINITION">Finition / Broderie</option><option value="REPASSAGE">Repassage / Prêt</option></select></div>
                            <div className="grid grid-cols-2 gap-4">
                                <div><label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 ml-1">Qté pcs</label><input type="number" min="1" className="w-full p-4 border-2 border-gray-100 rounded-2xl text-lg font-black bg-gray-50 text-center" value={newTaskData.quantite} onChange={e => setNewTaskData({...newTaskData, quantite: parseInt(e.target.value)||1})}/></div>
                                <div><label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 ml-1">Date Prévue</label><input type="date" className="w-full p-4 border-2 border-gray-100 rounded-2xl text-xs font-bold bg-gray-50" value={newTaskData.date} onChange={e => setNewTaskData({...newTaskData, date: e.target.value})}/></div>
                            </div>
                            <div><label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 ml-1">Assigner à l'Artisan</label><select className="w-full p-4 border-2 border-gray-100 rounded-2xl text-sm font-bold bg-gray-50" value={newTaskData.tailleurId} onChange={e => setNewTaskData({...newTaskData, tailleurId: e.target.value})}><option value="">-- Choisir Artisan --</option>{tailleurs.map(t => <option key={t.id} value={t.id}>{t.nom}</option>)}</select></div>
                        </div>
                        <div className="flex justify-end gap-3 mt-10">
                            <button onClick={() => setTaskModalOpen(false)} className="px-6 py-4 text-gray-400 font-black uppercase text-[10px] tracking-widest hover:text-gray-600">Annuler</button>
                            <button disabled={!newTaskData.tailleurId || !newTaskData.orderId} onClick={() => {
                                const order = commandes.find(c => c.id === newTaskData.orderId);
                                if (order && newTaskData.tailleurId) {
                                    const newTask: TacheProduction = { id: `T_${Date.now()}`, commandeId: order.id, action: newTaskData.action, quantite: newTaskData.quantite, tailleurId: newTaskData.tailleurId, date: newTaskData.date, statut: 'A_FAIRE' };
                                    onUpdateOrder({ ...order, taches: [...(order.taches || []), newTask] });
                                    setTaskModalOpen(false);
                                    alert("Tâche planifiée.");
                                }
                            }} className="px-10 py-4 bg-brand-900 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-xl disabled:opacity-30 active:scale-95 transition-all">Confirmer l'Assignation</button>
                        </div>
                    </div>
                </div>
            )}

            {/* MODAL LIVRAISON (AMÉLIORÉ) */}
            {deliveryModal && (
                <div className="fixed inset-0 bg-brand-900/80 z-[190] flex items-center justify-center p-4 backdrop-blur-sm">
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm p-10 animate-in zoom-in duration-200 border-t-8 border-green-500 text-center">
                        <div className="w-20 h-20 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-6 shadow-inner"><Truck size={40}/></div>
                        <h3 className="text-2xl font-black text-gray-800 mb-2 uppercase tracking-tighter">Prêt pour Remise ?</h3>
                        <p className="text-sm text-gray-500 mb-8 font-bold">Client : <span className="text-gray-900 uppercase">{deliveryModal.order.clientNom}</span></p>
                        
                        <div className="mb-8 text-left bg-gray-50 p-6 rounded-2xl border border-gray-100">
                            <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3 text-center">Nombre de pièces à sortir</label>
                            <input type="number" min="1" max={deliveryModal.maxQty} className="w-full p-4 border-2 border-white rounded-xl text-3xl font-black text-brand-900 text-center shadow-sm" value={deliveryModal.qty} onChange={e => setDeliveryModal({...deliveryModal, qty: Math.min(deliveryModal.maxQty, parseInt(e.target.value)||1)})}/>
                        </div>
                        
                        <div className="flex flex-col gap-3">
                            <button onClick={handleFinalDelivery} className="w-full py-5 bg-green-600 text-white rounded-2xl font-black uppercase text-xs tracking-[0.2em] shadow-xl hover:bg-green-700 transition-all active:scale-95">Confirmer la Sortie</button>
                            <button onClick={() => setDeliveryModal(null)} className="w-full py-4 text-gray-400 font-bold uppercase text-[10px] tracking-widest hover:text-gray-600">Retour à l'atelier</button>
                        </div>
                    </div>
                </div>
            )}

            {/* MODAL PAIEMENT SOLDE */}
            {paymentModalOpen && selectedOrderForPayment && (
                <div className="fixed inset-0 bg-brand-900/70 z-[180] flex items-center justify-center p-4 backdrop-blur-sm">
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm p-8">
                        <div className="flex justify-between items-center mb-8 border-b pb-4">
                            <h3 className="text-xl font-black flex items-center gap-3 text-gray-800 uppercase tracking-tighter"><Wallet size={24} className="text-orange-600"/> Encaissement Solde</h3>
                            <button onClick={() => setPaymentModalOpen(false)}><X size={24} className="text-gray-400"/></button>
                        </div>
                        <div className="space-y-6">
                            <div className="bg-orange-50 p-4 rounded-2xl border border-orange-100 flex justify-between items-center"><span className="text-xs font-black text-orange-800 uppercase">Reste Dû</span><span className="text-xl font-black text-orange-900">{selectedOrderForPayment.reste.toLocaleString()} F</span></div>
                            <div><label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 ml-1">Montant perçu</label><input type="number" className="w-full p-4 border-2 border-gray-100 rounded-2xl font-black text-2xl bg-gray-50 focus:border-orange-500 outline-none transition-all" value={payAmount} onChange={e => setPayAmount(Math.min(selectedOrderForPayment.reste, parseInt(e.target.value) || 0))} /></div>
                            <div><label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 ml-1">Caisse de Destination</label><select className="w-full p-4 border-2 border-gray-100 rounded-2xl bg-gray-50 text-sm font-bold" value={payAccount} onChange={e => setPayAccount(e.target.value)}><option value="">-- Choisir un compte --</option>{comptes.map(acc => (<option key={acc.id} value={acc.id}>{acc.nom} ({acc.solde.toLocaleString()} F)</option>))}</select></div>
                        </div>
                        <div className="flex justify-end gap-3 mt-10">
                            <button onClick={() => setPaymentModalOpen(false)} className="px-6 py-4 text-gray-400 font-bold uppercase text-[10px] tracking-widest">Annuler</button>
                            <button onClick={handleConfirmPayment} disabled={!payAccount || payAmount <= 0} className="px-10 py-4 bg-brand-900 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-xl disabled:opacity-30 active:scale-95">Valider</button>
                        </div>
                    </div>
                </div>
            )}

            {/* MODAL KANBAN MOVE */}
            {kanbanMoveModal && (
                <div className="fixed inset-0 bg-brand-900/70 z-[180] flex items-center justify-center p-4 backdrop-blur-sm">
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm p-8 animate-in zoom-in duration-200">
                        <h3 className="text-xl font-black text-gray-800 mb-8 flex items-center gap-3 uppercase tracking-tighter border-b pb-4"><ArrowRightLeft className="text-brand-600"/> Déplacer Articles</h3>
                        <div className="space-y-6">
                            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest text-center">De <span className="text-gray-900">{kanbanMoveModal.fromStatus}</span> → <span className="text-brand-600">{kanbanMoveModal.toStatus}</span></p>
                            <div><label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 ml-1">Nombre de pièces</label><input type="number" min="1" max={kanbanMoveModal.maxQty} className="w-full p-4 border-2 border-gray-100 rounded-2xl text-2xl font-black bg-gray-50 text-center" value={kanbanMoveModal.qty} onChange={e => setKanbanMoveModal({...kanbanMoveModal, qty: Math.min(kanbanMoveModal.maxQty, parseInt(e.target.value)||1)})}/></div>
                            <div className="bg-indigo-50 p-6 rounded-2xl border border-indigo-100"><label className="block text-[10px] font-black text-indigo-700 uppercase mb-3 tracking-widest">Assigner l'artisan pour cette étape ?</label><select className="w-full p-3 border-2 border-indigo-200 rounded-xl text-xs font-bold" value={kanbanMoveModal.assignTailorId} onChange={e => setKanbanMoveModal({...kanbanMoveModal, assignTailorId: e.target.value})}><option value="">-- Continuer sans assignation --</option>{tailleurs.map(t => <option key={t.id} value={t.id}>{t.nom}</option>)}</select></div>
                        </div>
                        <div className="flex justify-end gap-3 mt-10"><button onClick={() => setKanbanMoveModal(null)} className="px-6 py-4 text-gray-400 font-bold uppercase text-[10px] tracking-widest">Annuler</button><button onClick={executeKanbanMove} className="px-10 py-4 bg-brand-900 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-xl active:scale-95">Valider</button></div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ProductionView;
