
import React, { useState, useMemo } from 'react';
import { Commande, Employe, Client, Article, StatutCommande, RoleEmploye, ModePaiement, CompteFinancier, CompanyAssets, TacheProduction, ActionProduction, ElementCommande } from '../types';
import { COMPANY_CONFIG } from '../config';
import { Scissors, LayoutList, Users, History, Search, Camera, X, Activity, Clock, Shirt, Calendar, CheckCircle, Zap, PenTool, Columns, Trophy, Wallet, Printer, Eye, UserPlus, Plus, Save, Truck, ArrowRightLeft, DollarSign, ListFilter, Trash2, AlertTriangle, ChevronLeft, ChevronRight } from 'lucide-react';
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
    const [viewMode, setViewMode] = useState<'ORDERS' | 'TAILORS' | 'PERFORMANCE' | 'KANBAN' | 'HISTORY' | 'PLANNING'>('KANBAN');
    const [searchTerm, setSearchTerm] = useState('');
    const [historyFilterStatus, setHistoryFilterStatus] = useState<string>('ALL');
    const [isScannerOpen, setIsScannerOpen] = useState(false);
    
    const [agendaBaseDate, setAgendaBaseDate] = useState(() => {
        const d = new Date();
        d.setHours(0,0,0,0);
        return d;
    });

    // Modals
    const [taskModalOpen, setTaskModalOpen] = useState(false);
    const [orderModalOpen, setOrderModalOpen] = useState(false);
    const [paymentModalOpen, setPaymentModalOpen] = useState(false);
    const [kanbanMoveModal, setKanbanMoveModal] = useState<{
        order: Commande, fromStatus: StatutCommande, toStatus: StatutCommande, maxQty: number, qty: number, assignTailorId: string
    } | null>(null);
    const [deliveryModal, setDeliveryModal] = useState<{ order: Commande, maxQty: number, qty: number } | null>(null);

    // Payment & Tasks States
    const [selectedOrderForPayment, setSelectedOrderForPayment] = useState<Commande | null>(null);
    const [payAmount, setPayAmount] = useState(0);
    const [payAccount, setPayAccount] = useState('');
    const [payMethod, setPayMethod] = useState<ModePaiement>('ESPECE');
    const [payDate, setPayDate] = useState(new Date().toISOString().split('T')[0]);

    const [planningTarget, setPlanningTarget] = useState<{ tailorId: string, tailorName: string, date: Date } | null>(null);
    const [draggedInfo, setDraggedInfo] = useState<{orderId: string, fromStatus: string} | null>(null);

    const [newTaskData, setNewTaskData] = useState<{ orderId: string, action: ActionProduction, quantite: number, note: string, tailleurId: string }>({ orderId: '', action: 'COUTURE', quantite: 1, note: '', tailleurId: '' });

    // New Order State
    const [newOrderData, setNewOrderData] = useState<Partial<Commande>>({
        clientId: '', clientNom: '', description: '', prixTotal: 0, avance: 0, dateLivraisonPrevue: '', elements: []
    });
    const [tempElement, setTempElement] = useState({ nom: '', quantite: 1 });

    const tailleurs = useMemo(() => {
        return employes.filter(e => {
            const isTailleur = e.role === RoleEmploye.TAILLEUR || e.role === RoleEmploye.CHEF_ATELIER || e.role === RoleEmploye.STAGIAIRE;
            return isTailleur && e.actif !== false && e.nom.toLowerCase().includes(searchTerm.toLowerCase());
        });
    }, [employes, searchTerm]);

    const filteredCommandes = useMemo(() => {
        return commandes.filter(c => {
            if (c.type !== 'SUR_MESURE') return false; 
            const isCompleted = c.statut === StatutCommande.LIVRE || c.statut === StatutCommande.ANNULE;
            
            if (viewMode === 'HISTORY') {
                if (historyFilterStatus !== 'ALL' && c.statut !== historyFilterStatus) return false;
            } else if (viewMode !== 'PERFORMANCE') {
                if (isCompleted) return false;
            }

            const matchesSearch = c.clientNom.toLowerCase().includes(searchTerm.toLowerCase()) || 
                                  c.id.toLowerCase().includes(searchTerm.toLowerCase());
            return matchesSearch;
        }).sort((a, b) => new Date(b.dateCommande).getTime() - new Date(a.dateCommande).getTime());
    }, [commandes, searchTerm, viewMode, historyFilterStatus]);

    // --- ACTIONS LOGIQUE ---

    const handleTaskStatusChange = (order: Commande, task: TacheProduction, newStatut: 'A_FAIRE' | 'FAIT') => {
        const updatedTaches = (order.taches || []).map(t => t.id === task.id ? { ...t, statut: newStatut } : t);
        let newRepartition = { ...(order.repartitionStatuts || { [StatutCommande.EN_ATTENTE]: order.quantite }) };
        
        if (newStatut === 'FAIT') {
            const mapping: Record<string, { from: StatutCommande, to: StatutCommande }> = {
                'COUPE': { from: StatutCommande.EN_ATTENTE, to: StatutCommande.EN_COUPE },
                'COUTURE': { from: StatutCommande.EN_COUPE, to: StatutCommande.COUTURE },
                'FINITION': { from: StatutCommande.COUTURE, to: StatutCommande.FINITION }
            };
            const rule = mapping[task.action];
            if (rule) {
                const available = newRepartition[rule.from] || 0;
                const qtyToMove = Math.min(task.quantite, available);
                if (qtyToMove > 0) {
                    newRepartition[rule.from] -= qtyToMove;
                    if (newRepartition[rule.from] <= 0) delete newRepartition[rule.from];
                    newRepartition[rule.to] = (newRepartition[rule.to] || 0) + qtyToMove;
                }
            }
        }

        let mostAdvanced = StatutCommande.EN_ATTENTE;
        KANBAN_STATUS_ORDER.forEach(s => { if ((newRepartition[s] || 0) > 0) mostAdvanced = s as StatutCommande; });
        onUpdateOrder({ ...order, taches: updatedTaches, repartitionStatuts: newRepartition, statut: mostAdvanced });
    };

    const handleDragStart = (orderId: string, fromStatus: string) => setDraggedInfo({ orderId, fromStatus });
    
    const handleDrop = (toStatus: StatutCommande) => {
        if (!draggedInfo || draggedInfo.fromStatus === toStatus) { setDraggedInfo(null); return; }
        const order = commandes.find(c => c.id === draggedInfo.orderId);
        if (!order) return;
        
        const fromStatus = draggedInfo.fromStatus as StatutCommande;
        const currentQty = order.repartitionStatuts ? (order.repartitionStatuts[fromStatus] || 0) : (order.statut === fromStatus ? order.quantite : 0);
        if (currentQty <= 0) { setDraggedInfo(null); return; }

        setKanbanMoveModal({ order, fromStatus, toStatus, maxQty: currentQty, qty: currentQty, assignTailorId: '' });
        setDraggedInfo(null);
    };

    const executeKanbanMove = () => {
        if (!kanbanMoveModal) return;
        const { order, fromStatus, toStatus, qty, assignTailorId } = kanbanMoveModal;
        
        const newRepartition = { ...(order.repartitionStatuts || { [order.statut]: order.quantite }) };
        newRepartition[fromStatus] = (newRepartition[fromStatus] || 0) - qty;
        if (newRepartition[fromStatus] <= 0) delete newRepartition[fromStatus];
        newRepartition[toStatus] = (newRepartition[toStatus] || 0) + qty;

        let mostAdvanced = order.statut as StatutCommande;
        KANBAN_STATUS_ORDER.forEach(s => { if ((newRepartition[s] || 0) > 0) mostAdvanced = s as StatutCommande; });

        let updatedTaches = [...(order.taches || [])];
        if (assignTailorId) {
            let action: ActionProduction = 'COUTURE';
            if (toStatus === StatutCommande.EN_COUPE) action = 'COUPE';
            if (toStatus === StatutCommande.FINITION) action = 'FINITION';
            
            updatedTaches.push({
                id: `TASK_KB_${Date.now()}`,
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

    const handleSaveTask = () => {
        const order = commandes.find(c => c.id === newTaskData.orderId);
        const tailorId = newTaskData.tailleurId || planningTarget?.tailorId;
        const taskDate = planningTarget?.date ? planningTarget.date.toISOString().split('T')[0] : new Date().toISOString().split('T')[0];

        if (!order || !tailorId) {
            alert("Sélectionnez une commande et un tailleur.");
            return;
        }

        const newTask: TacheProduction = {
            id: `TASK_${Date.now()}`,
            commandeId: order.id,
            action: newTaskData.action,
            quantite: newTaskData.quantite,
            tailleurId: tailorId,
            date: taskDate,
            statut: 'A_FAIRE',
            note: newTaskData.note
        };

        onUpdateOrder({ ...order, taches: [...(order.taches || []), newTask] });
        setTaskModalOpen(false);
        setNewTaskData({ orderId: '', action: 'COUTURE', quantite: 1, note: '', tailleurId: '' });
    };

    const handleDeliverItems = () => {
        if (!deliveryModal) return;
        const { order, qty } = deliveryModal;
        const newRepartition = { ...(order.repartitionStatuts || {}) };
        const readyQty = newRepartition[StatutCommande.PRET] || 0;
        const toDeliver = Math.min(qty, readyQty);

        newRepartition[StatutCommande.PRET] = readyQty - toDeliver;
        if (newRepartition[StatutCommande.PRET] <= 0) delete newRepartition[StatutCommande.PRET];
        newRepartition[StatutCommande.LIVRE] = (newRepartition[StatutCommande.LIVRE] || 0) + toDeliver;

        const totalDelivered = (newRepartition[StatutCommande.LIVRE] || 0);
        let globalStatus = order.statut as StatutCommande;
        if (totalDelivered >= order.quantite) globalStatus = StatutCommande.LIVRE;

        onUpdateOrder({ ...order, repartitionStatuts: newRepartition, statut: globalStatus });
        setDeliveryModal(null);
    };

    const handleConfirmPayment = () => {
        if (!selectedOrderForPayment || payAmount <= 0 || !payAccount) return;
        onAddPayment(selectedOrderForPayment.id, payAmount, payMethod, "Acompte", payDate, payAccount);
        setPaymentModalOpen(false);
        setSelectedOrderForPayment(null);
    };

    const openCreateModal = () => {
        setNewOrderData({ clientId: '', description: '', prixTotal: 0, avance: 0, elements: [], dateLivraisonPrevue: '' });
        setOrderModalOpen(true);
    };

    /**
     * Fix for "Cannot find name 'handleSaveQuickOrder'"
     * Handles the creation of a new production order from the quick modal.
     */
    const handleSaveQuickOrder = () => {
        if (!newOrderData.clientId || !newOrderData.description || !newOrderData.dateLivraisonPrevue || !newOrderData.prixTotal) {
            alert("Veuillez remplir tous les champs obligatoires (Client, Description, Prix, Date).");
            return;
        }

        const client = clients.find(c => c.id === newOrderData.clientId);
        const orderId = `CMD_PRD_${Date.now()}`;
        const totalQty = (newOrderData.elements || []).reduce((acc, el) => acc + el.quantite, 0) || 1;

        const newOrder: Commande = {
            id: orderId,
            clientId: newOrderData.clientId!,
            clientNom: client?.nom || 'Inconnu',
            description: newOrderData.description!,
            dateCommande: new Date().toISOString().split('T')[0],
            dateLivraisonPrevue: newOrderData.dateLivraisonPrevue!,
            statut: StatutCommande.EN_ATTENTE,
            tailleursIds: [],
            prixTotal: newOrderData.prixTotal!,
            avance: newOrderData.avance || 0,
            reste: Math.max(0, (newOrderData.prixTotal || 0) - (newOrderData.avance || 0)),
            type: 'SUR_MESURE',
            quantite: totalQty,
            elements: newOrderData.elements || [],
            repartitionStatuts: { [StatutCommande.EN_ATTENTE]: totalQty },
            taches: [],
            paiements: (newOrderData.avance || 0) > 0 ? [{
                id: `PAY_${Date.now()}`,
                date: new Date().toISOString().split('T')[0],
                montant: newOrderData.avance!,
                moyenPaiement: 'ESPECE',
                note: 'Avance à la commande'
            }] : []
        };

        onCreateOrder(newOrder, [], 'ESPECE', payAccount || undefined);
        setOrderModalOpen(false);
        setNewOrderData({ clientId: '', description: '', prixTotal: 0, avance: 0, elements: [], dateLivraisonPrevue: '' });
        setPayAccount('');
    };

    const getOverdueTaskCount = () => {
        const todayStr = new Date().toISOString().split('T')[0];
        return commandes.flatMap(c => c.taches || [])
            .filter(t => t.statut === 'A_FAIRE' && t.date < todayStr).length;
    };

    return (
        <div className="space-y-6 h-[calc(100vh-8rem)] flex flex-col">
            {/* HEADER */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 shrink-0">
                <div className="flex items-center gap-3">
                    <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2"><Scissors className="text-brand-600"/> Atelier Production</h2>
                    <div className="flex gap-2">
                        <button onClick={openCreateModal} className="bg-brand-600 text-white px-3 py-1.5 rounded-lg flex items-center gap-2 text-xs font-bold hover:bg-brand-700 shadow-md"><Plus size={14}/> Nouvelle Commande</button>
                        <button onClick={() => setIsScannerOpen(true)} className="bg-gray-800 text-white px-3 py-1.5 rounded-lg flex items-center gap-2 text-xs font-bold hover:bg-black shadow-sm"><Camera size={14}/> Scanner Badge</button>
                    </div>
                </div>
                <div className="flex flex-wrap bg-white border p-1 rounded-lg shadow-sm">
                    {[
                        {id: 'PLANNING', label: 'Agenda', icon: Calendar},
                        {id: 'KANBAN', label: 'Kanban', icon: Columns},
                        {id: 'ORDERS', label: 'Liste', icon: LayoutList},
                        {id: 'TAILORS', label: 'Tailleurs', icon: Users},
                        {id: 'PERFORMANCE', label: 'Performance', icon: Trophy},
                        {id: 'HISTORY', label: 'Historique', icon: History}
                    ].map((mode) => (
                        <button key={mode.id} onClick={() => setViewMode(mode.id as any)} className={`px-3 py-1.5 text-xs font-bold rounded flex items-center gap-1 ${viewMode === mode.id ? 'bg-brand-50 text-brand-700' : 'text-gray-500 hover:bg-gray-50'}`}>
                            <mode.icon size={14}/> <span>{mode.label}</span>
                        </button>
                    ))}
                </div>
            </div>

            <div className="flex-1 overflow-hidden">
                {/* AGENDA AVEC ALERTES RETARD */}
                {viewMode === 'PLANNING' && (
                    <div className="bg-white border rounded-xl shadow-sm h-full flex flex-col overflow-hidden">
                        <div className="p-3 border-b bg-gray-50 flex justify-between items-center shrink-0">
                            <div className="flex gap-2">
                                <button onClick={() => { const d = new Date(agendaBaseDate); d.setDate(d.getDate()-7); setAgendaBaseDate(d); }} className="p-1.5 hover:bg-gray-200 rounded"><ChevronLeft size={18}/></button>
                                <button onClick={() => { const d = new Date(agendaBaseDate); d.setDate(d.getDate()+7); setAgendaBaseDate(d); }} className="p-1.5 hover:bg-gray-200 rounded"><ChevronRight size={18}/></button>
                                <span className="font-bold text-sm flex items-center px-2">Agenda Production</span>
                            </div>
                            {getOverdueTaskCount() > 0 && (
                                <div className="bg-red-100 text-red-700 px-3 py-1 rounded-full text-xs font-bold flex items-center gap-2 animate-pulse">
                                    <AlertTriangle size={14}/> {getOverdueTaskCount()} tâches en retard !
                                </div>
                            )}
                        </div>
                        <div className="flex-1 overflow-auto">
                            <table className="w-full border-collapse table-fixed min-w-[1000px]">
                                <thead className="sticky top-0 z-20 bg-gray-100">
                                    <tr>
                                        <th className="w-40 p-3 border-b border-r text-left text-[10px] font-bold text-gray-500 uppercase">Tailleur</th>
                                        {Array.from({length: 7}, (_, i) => {
                                            const d = new Date(agendaBaseDate); d.setDate(d.getDate() + i);
                                            const isToday = d.toISOString().split('T')[0] === new Date().toISOString().split('T')[0];
                                            return <th key={i} className={`p-2 border-b text-center text-[10px] font-bold ${isToday ? 'bg-brand-50 text-brand-700' : 'text-gray-500'}`}>{d.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric' })}</th>;
                                        })}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {tailleurs.map(tailor => (
                                        <tr key={tailor.id} className="hover:bg-gray-50/30">
                                            <td className="p-3 border-r bg-gray-50 font-bold text-xs sticky left-0 z-10">{tailor.nom}</td>
                                            {Array.from({length: 7}, (_, i) => {
                                                const d = new Date(agendaBaseDate); d.setDate(d.getDate() + i);
                                                const dateStr = d.toISOString().split('T')[0];
                                                const todayStr = new Date().toISOString().split('T')[0];
                                                const tasks = commandes.flatMap(o => (o.taches || []).map(t => ({...t, order: o}))).filter(t => t.tailleurId === tailor.id && t.date === dateStr);
                                                
                                                return (
                                                    <td key={i} className="p-1 border-r h-28 vertical-top relative cursor-pointer hover:bg-brand-50/10" 
                                                        onClick={() => { setPlanningTarget({ tailorId: tailor.id, tailorName: tailor.nom, date: d }); setTaskModalOpen(true); }}>
                                                        <div className="space-y-1 h-full overflow-y-auto no-scrollbar">
                                                            {tasks.map(t => {
                                                                const isLate = t.statut === 'A_FAIRE' && t.date < todayStr;
                                                                const isTodayUndone = t.statut === 'A_FAIRE' && t.date === todayStr;
                                                                return (
                                                                    <div key={t.id} onClick={(e) => { e.stopPropagation(); handleTaskStatusChange(t.order, t, t.statut === 'A_FAIRE' ? 'FAIT' : 'A_FAIRE'); }}
                                                                        className={`p-1 rounded text-[9px] border shadow-sm transition-all hover:scale-105 ${
                                                                            t.statut === 'FAIT' ? 'bg-green-100 text-green-800 border-green-200' :
                                                                            isLate ? 'bg-red-500 text-white border-red-600 animate-pulse' :
                                                                            isTodayUndone ? 'bg-orange-100 text-orange-800 border-orange-300 border-l-4 border-l-orange-600' :
                                                                            'bg-brand-50 text-brand-800 border-brand-200'
                                                                        }`}>
                                                                        <div className="flex justify-between items-center font-bold">
                                                                            <span className="truncate">{t.action} x{t.quantite}</span>
                                                                            {t.statut === 'FAIT' ? <CheckCircle size={10} /> : isLate ? <AlertTriangle size={10}/> : null}
                                                                        </div>
                                                                        <div className="truncate opacity-80">{t.order.clientNom}</div>
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

                {/* KANBAN */}
                {viewMode === 'KANBAN' && (
                    <div className="flex gap-4 h-full overflow-x-auto pb-4 custom-scrollbar">
                        {KANBAN_STATUS_ORDER.map((status, index) => (
                            <div key={status} className="flex-1 min-w-[280px] bg-gray-100/50 rounded-xl flex flex-col border border-gray-200" onDragOver={e => e.preventDefault()} onDrop={() => handleDrop(status as StatutCommande)}>
                                <div className="p-3 border-b flex justify-between items-center bg-white rounded-t-xl">
                                    <h3 className="text-sm font-bold text-gray-700">{status}</h3>
                                    <span className="bg-gray-200 text-gray-600 text-[10px] px-2 py-0.5 rounded-full font-bold">{filteredCommandes.reduce((acc, c) => acc + (c.repartitionStatuts?.[status] || (c.statut === status ? c.quantite : 0)), 0)}</span>
                                </div>
                                <div className="flex-1 overflow-y-auto p-2 space-y-3">
                                    {filteredCommandes.filter(c => (c.repartitionStatuts?.[status] || 0) > 0 || (!c.repartitionStatuts && c.statut === status)).map(order => {
                                        const repartition = order.repartitionStatuts || { [order.statut]: order.quantite };
                                        const safeReached = Math.min(KANBAN_STATUS_ORDER.slice(index).reduce((acc, s) => acc + (repartition[s] || 0), 0), order.quantite);
                                        return (
                                            <div key={order.id} draggable onDragStart={() => handleDragStart(order.id, status)} className="bg-white p-3 rounded-lg shadow-sm border border-gray-200 cursor-grab hover:border-brand-300">
                                                <div className="flex justify-between items-start mb-1 text-[10px] font-mono text-gray-400"><span>#{order.id.slice(-5)}</span><span className="bg-brand-50 text-brand-700 px-1.5 rounded font-bold">Qté: {repartition[status] || 0}</span></div>
                                                <p className="font-bold text-gray-800 text-sm mb-1">{order.clientNom}</p>
                                                <div className="mt-2 flex items-center gap-2">
                                                    <div className="flex-1 h-1 bg-gray-100 rounded-full overflow-hidden"><div className="h-full bg-brand-500" style={{ width: `${(safeReached/order.quantite)*100}%` }}></div></div>
                                                    <span className="text-[8px] font-bold text-brand-600">{safeReached}/{order.quantite}</span>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {/* LISTE ET HISTORIQUE */}
                {(viewMode === 'ORDERS' || viewMode === 'HISTORY') && (
                    <div className="bg-white border rounded-xl overflow-hidden shadow-sm h-full flex flex-col">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-gray-50 text-gray-600 font-bold border-b sticky top-0 z-10">
                                <tr>
                                    <th className="p-3">Client / Commande</th>
                                    <th className="p-3 text-right">Reste</th>
                                    <th className="p-3">Répartition Flux</th>
                                    <th className="p-3 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 overflow-y-auto">
                                {filteredCommandes.map(order => (
                                    <tr key={order.id} className="hover:bg-gray-50">
                                        <td className="p-3">
                                            <div className="font-bold text-gray-800">{order.clientNom}</div>
                                            <div className="text-[10px] text-orange-600 font-bold">Livraison: {new Date(order.dateLivraisonPrevue).toLocaleDateString()}</div>
                                        </td>
                                        <td className={`p-3 text-right font-bold ${order.reste > 0 ? 'text-red-600' : 'text-green-600'}`}>{order.reste.toLocaleString()} F</td>
                                        <td className="p-3">
                                            <div className="flex flex-wrap gap-1">
                                                {KANBAN_STATUS_ORDER.map(s => (order.repartitionStatuts?.[s] || 0) > 0 && (
                                                    <span key={s} className="px-1.5 py-0.5 bg-brand-50 text-brand-700 rounded text-[9px] font-bold border border-brand-100">{s}({order.repartitionStatuts![s]})</span>
                                                ))}
                                                {(order.repartitionStatuts?.[StatutCommande.LIVRE] || 0) > 0 && (
                                                    <span className="px-1.5 py-0.5 bg-green-50 text-green-700 rounded text-[9px] font-bold border border-green-100">LIVRÉ({order.repartitionStatuts![StatutCommande.LIVRE]})</span>
                                                )}
                                            </div>
                                        </td>
                                        <td className="p-3 text-right">
                                            <div className="flex justify-end gap-1">
                                                {(order.repartitionStatuts?.[StatutCommande.PRET] || 0) > 0 && (
                                                    <button onClick={() => setDeliveryModal({ order, maxQty: order.repartitionStatuts![StatutCommande.PRET], qty: order.repartitionStatuts![StatutCommande.PRET] })} className="px-2 py-1 text-green-600 bg-green-50 hover:bg-green-100 rounded text-[10px] font-bold flex items-center gap-1 shadow-sm"><Truck size={14}/> LIVRER</button>
                                                )}
                                                {order.reste > 0 && <button onClick={() => {setSelectedOrderForPayment(order); setPayAmount(order.reste); setPaymentModalOpen(true);}} className="p-1.5 text-orange-600 hover:bg-orange-50 rounded"><DollarSign size={18}/></button>}
                                                <button onClick={() => { setNewTaskData({...newTaskData, orderId: order.id}); setTaskModalOpen(true); }} className="p-1.5 text-brand-600 hover:bg-brand-50 rounded" title="Assigner un tailleur"><UserPlus size={18}/></button>
                                                <button onClick={() => alert(`Acomptes:\n${order.paiements?.map(p => `- ${new Date(p.date).toLocaleDateString()} : ${p.montant} F`).join('\n') || 'Aucun.'}`)} className="p-1.5 text-blue-500 hover:bg-blue-50 rounded"><Eye size={18}/></button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* MODALS */}
            
            {/* MODAL ASSIGNATION TAILLEUR (FIXÉ) */}
            {taskModalOpen && (
                <div className="fixed inset-0 bg-black/60 z-[160] flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm p-6 animate-in zoom-in duration-200">
                        <div className="flex justify-between items-center mb-4"><h3 className="font-bold text-gray-800 flex items-center gap-2"><UserPlus size={20} className="text-brand-600"/> Nouvelle Assignation</h3><button onClick={() => setTaskModalOpen(false)}><X size={20}/></button></div>
                        <div className="space-y-4">
                            <div><label className="block text-xs font-bold text-gray-500 uppercase mb-1">Commande</label>
                                <select className="w-full p-2 border rounded text-sm" value={newTaskData.orderId} onChange={e => setNewTaskData({...newTaskData, orderId: e.target.value})}>
                                    <option value="">-- Sélectionner Commande --</option>
                                    {commandes.filter(c => c.statut !== StatutCommande.LIVRE).map(c => <option key={c.id} value={c.id}>{c.clientNom} (#{c.id.slice(-5)})</option>)}
                                </select>
                            </div>
                            <div><label className="block text-xs font-bold text-gray-500 uppercase mb-1">Tailleur</label>
                                <select className="w-full p-2 border rounded text-sm bg-indigo-50" value={newTaskData.tailleurId} onChange={e => setNewTaskData({...newTaskData, tailleurId: e.target.value})}>
                                    <option value="">-- Choisir Tailleur --</option>
                                    {tailleurs.map(t => <option key={t.id} value={t.id}>{t.nom}</option>)}
                                </select>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div><label className="block text-xs font-bold text-gray-500 uppercase mb-1">Action</label><select className="w-full p-2 border rounded text-sm" value={newTaskData.action} onChange={e => setNewTaskData({...newTaskData, action: e.target.value as any})}><option value="COUPE">Coupe</option><option value="COUTURE">Couture</option><option value="FINITION">Finition</option></select></div>
                                <div><label className="block text-xs font-bold text-gray-500 uppercase mb-1">Quantité</label><input type="number" className="w-full p-2 border rounded text-sm font-bold" value={newTaskData.quantite} onChange={e => setNewTaskData({...newTaskData, quantite: parseInt(e.target.value)||1})}/></div>
                            </div>
                        </div>
                        <div className="flex justify-end gap-3 mt-6"><button onClick={() => setTaskModalOpen(false)} className="px-4 py-2 text-gray-500 font-bold">Annuler</button><button onClick={handleSaveTask} className="px-6 py-2 bg-brand-600 text-white rounded-lg font-bold shadow-md">Assigner</button></div>
                    </div>
                </div>
            )}

            {/* LIVRAISON PARTIELLE */}
            {deliveryModal && (
                <div className="fixed inset-0 bg-black/60 z-[150] flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm animate-in zoom-in duration-200 p-6">
                        <div className="p-4 border-b bg-gray-50 flex justify-between items-center"><h3 className="font-bold text-gray-800 flex items-center gap-2"><Truck size={20} className="text-green-600"/> Livraison Client</h3><button onClick={() => setDeliveryModal(null)}><X size={20}/></button></div>
                        <div className="p-6 space-y-4">
                            <p className="text-xs text-gray-500 italic">Combien de pièces prêtes voulez-vous livrer sur les {deliveryModal.maxQty} ?</p>
                            <div><label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Quantité à livrer</label><input type="number" min="1" max={deliveryModal.maxQty} className="w-full p-2 border rounded-lg font-bold text-lg" value={deliveryModal.qty} onChange={e => setDeliveryModal({...deliveryModal, qty: Math.min(deliveryModal.maxQty, parseInt(e.target.value)||1)})}/></div>
                        </div>
                        <div className="p-4 bg-gray-50 border-t flex justify-end gap-2"><button onClick={() => setDeliveryModal(null)} className="px-4 py-2 text-gray-500 font-bold">Annuler</button><button onClick={handleDeliverItems} className="px-6 py-2 bg-green-600 text-white rounded-lg font-bold shadow-md">Valider Livraison</button></div>
                    </div>
                </div>
            )}

            {/* NOUVELLE COMMANDE */}
            {orderModalOpen && (
                <div className="fixed inset-0 bg-black/60 z-[110] flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-md animate-in zoom-in duration-200 flex flex-col max-h-[90vh]">
                        <div className="p-4 border-b bg-gray-50 rounded-t-xl flex justify-between items-center shrink-0"><h3 className="font-bold text-gray-800 flex items-center gap-2"><Plus size={18} className="text-brand-600"/> Nouvelle Commande Production</h3><button onClick={() => setOrderModalOpen(false)}><X size={20}/></button></div>
                        <div className="p-6 overflow-y-auto flex-1 space-y-4">
                            <div><label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Client</label><select className="w-full p-2 border rounded-lg text-sm bg-white" value={newOrderData.clientId} onChange={e => setNewOrderData({...newOrderData, clientId: e.target.value})}><option value="">-- Sélectionner --</option>{clients.map(c => <option key={c.id} value={c.id}>{c.nom}</option>)}</select></div>
                            <div><label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Description Global</label><input type="text" className="w-full p-2 border rounded-lg text-sm" value={newOrderData.description} onChange={e => setNewOrderData({...newOrderData, description: e.target.value})} placeholder="Ex: Mariage M. Diop" /></div>
                            
                            <div className="bg-gray-50 p-3 rounded-lg border border-gray-200">
                                <label className="block text-[10px] font-bold text-gray-400 uppercase mb-2">Ajouter Articles</label>
                                <div className="flex gap-2">
                                    <input type="text" placeholder="Nom article..." className="flex-1 p-2 text-xs border rounded" value={tempElement.nom} onChange={e => setTempElement({...tempElement, nom: e.target.value})} />
                                    <input type="number" className="w-16 p-2 text-xs border rounded" value={tempElement.quantite} onChange={e => setTempElement({...tempElement, quantite: parseInt(e.target.value)||1})} />
                                    <button onClick={() => { if(tempElement.nom) { setNewOrderData({...newOrderData, elements: [...(newOrderData.elements||[]), {...tempElement}]}); setTempElement({nom:'', quantite:1}); } }} className="bg-gray-800 text-white p-2 rounded"><Plus size={16}/></button>
                                </div>
                                <div className="mt-2 space-y-1">
                                    {newOrderData.elements?.map((el, idx) => (
                                        <div key={idx} className="flex justify-between items-center bg-white p-2 border rounded text-xs"><span>{el.nom} x{el.quantite}</span><button onClick={() => setNewOrderData({...newOrderData, elements: newOrderData.elements?.filter((_, i) => i !== idx)})} className="text-red-500"><Trash2 size={14}/></button></div>
                                    ))}
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div><label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Total (FCFA)</label><input type="number" className="w-full p-2 border rounded-lg text-sm font-bold" value={newOrderData.prixTotal || ''} onChange={e => setNewOrderData({...newOrderData, prixTotal: parseInt(e.target.value)||0})}/></div>
                                <div><label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Avance (FCFA)</label><input type="number" className="w-full p-2 border rounded-lg text-sm font-bold bg-green-50" value={newOrderData.avance || ''} onChange={e => setNewOrderData({...newOrderData, avance: parseInt(e.target.value)||0})}/></div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div><label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Date Livraison</label><input type="date" className="w-full p-2 border rounded-lg text-sm" value={newOrderData.dateLivraisonPrevue} onChange={e => setNewOrderData({...newOrderData, dateLivraisonPrevue: e.target.value})}/></div>
                                <div><label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Caisse d'encaissement</label><select className="w-full p-2 border rounded-lg text-sm bg-blue-50" value={payAccount} onChange={e => setPayAccount(e.target.value)}><option value="">-- Choisir --</option>{comptes.map(c => <option key={c.id} value={c.id}>{c.nom}</option>)}</select></div>
                            </div>
                        </div>
                        <div className="p-4 bg-gray-50 border-t flex justify-end gap-3 rounded-b-xl shrink-0"><button onClick={() => setOrderModalOpen(false)} className="px-4 py-2 text-gray-500 font-bold">Annuler</button><button onClick={handleSaveQuickOrder} className="px-6 py-2 bg-brand-600 text-white rounded-lg font-bold shadow-lg hover:bg-brand-700">Enregistrer</button></div>
                    </div>
                </div>
            )}

            {paymentModalOpen && selectedOrderForPayment && (
                <div className="fixed inset-0 bg-black/60 z-[160] flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm p-6 animate-in zoom-in duration-200">
                        <div className="flex justify-between items-center mb-4"><h3 className="text-xl font-bold flex items-center gap-2 text-green-600"><Wallet size={24}/> Encaisser</h3><button onClick={() => setPaymentModalOpen(false)}><X size={20}/></button></div>
                        <div className="space-y-4">
                            <div><label className="block text-xs font-bold text-gray-500 uppercase mb-1">Montant Reçu (Reste: {selectedOrderForPayment.reste} F)</label><input type="number" className="w-full p-2 border rounded font-bold text-lg text-brand-700" value={payAmount} onChange={e => setPayAmount(parseInt(e.target.value)||0)}/></div>
                            <div><label className="block text-xs font-bold text-gray-500 uppercase mb-1">Caisse</label><select className="w-full p-2 border rounded text-sm" value={payAccount} onChange={e => setPayAccount(e.target.value)}><option value="">-- Choisir Caisse --</option>{comptes.map(c => <option key={c.id} value={c.id}>{c.nom} ({c.solde.toLocaleString()} F)</option>)}</select></div>
                        </div>
                        <div className="flex justify-end gap-3 mt-6"><button onClick={() => setPaymentModalOpen(false)} className="px-4 py-2 text-gray-500 font-bold">Annuler</button><button onClick={handleConfirmPayment} disabled={!payAccount} className="px-6 py-2 bg-green-600 text-white rounded-lg font-bold">Valider</button></div>
                    </div>
                </div>
            )}

            {isScannerOpen && <QRScannerModal isOpen={isScannerOpen} onClose={() => setIsScannerOpen(false)} onScan={(text) => { const emp = employes.find(e => e.id === text.trim()); if (emp) setSearchTerm(emp.nom); setIsScannerOpen(false); }} />}
        </div>
    );
};

export default ProductionView;
