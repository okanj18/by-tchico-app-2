
import React, { useState, useMemo } from 'react';
import { Commande, Employe, Client, Article, StatutCommande, RoleEmploye, ModePaiement, CompteFinancier, CompanyAssets, TacheProduction, ActionProduction } from '../types';
import { COMPANY_CONFIG } from '../config';
import { Scissors, LayoutList, Users, History, Search, Camera, X, Activity, Clock, Shirt, Calendar, CheckCircle, Zap, PenTool, Columns, ChevronLeft, ChevronRight, Trophy, Wallet, Printer, Eye, UserPlus, Plus, Save } from 'lucide-react';
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

// Actions simplifiées pour une synchronisation robuste
const PRODUCTION_ACTIONS: { id: ActionProduction, label: string, icon: any, color: string }[] = [
    { id: 'COUPE', label: 'Coupe', icon: Scissors, color: 'text-blue-600 bg-blue-50 border-blue-200' },
    { id: 'COUTURE', label: 'Couture / Montage', icon: Shirt, color: 'text-indigo-600 bg-indigo-50 border-indigo-200' },
    { id: 'FINITION', label: 'Finition / Repassage', icon: CheckCircle, color: 'text-purple-600 bg-purple-50 border-purple-200' }
];

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
    const [historyFilterPayment, setHistoryFilterPayment] = useState<string>('ALL');
    const [isScannerOpen, setIsScannerOpen] = useState(false);
    
    const [agendaBaseDate, setAgendaBaseDate] = useState(() => {
        const d = new Date();
        d.setHours(0,0,0,0);
        return d;
    });

    const [taskModalOpen, setTaskModalOpen] = useState(false);
    const [orderModalOpen, setOrderModalOpen] = useState(false);
    const [paymentModalOpen, setPaymentModalOpen] = useState(false);
    const [selectedOrderForPayment, setSelectedOrderForPayment] = useState<Commande | null>(null);
    const [payAmount, setPayAmount] = useState(0);
    const [payAccount, setPayAccount] = useState('');
    const [payMethod, setPayMethod] = useState<ModePaiement>('ESPECE');
    const [payDate, setPayDate] = useState(new Date().toISOString().split('T')[0]);

    const [planningTarget, setPlanningTarget] = useState<{ tailorId: string, tailorName: string, date: Date } | null>(null);
    const [draggedInfo, setDraggedInfo] = useState<{orderId: string, fromStatus: string} | null>(null);
    const [moveModal, setMoveModal] = useState<{order: Commande, fromStatus: string, toStatus: string, maxQty: number, qty: number} | null>(null);

    const [newTaskData, setNewTaskData] = useState<{ 
        orderId: string, 
        action: ActionProduction, 
        quantite: number, 
        note: string,
        elementNom: string 
    }>({ orderId: '', action: 'COUTURE', quantite: 1, note: '', elementNom: '' });

    const [newOrderData, setNewOrderData] = useState<Partial<Commande>>({
        clientId: '', clientNom: '', description: '', quantite: 1, prixTotal: 0, avance: 0, dateLivraisonPrevue: ''
    });

    const tailleurs = useMemo(() => {
        return employes.filter(e => {
            const isTailleur = e.role === RoleEmploye.TAILLEUR || e.role === RoleEmploye.CHEF_ATELIER || e.role === RoleEmploye.STAGIAIRE;
            const matchesSearch = e.nom.toLowerCase().includes(searchTerm.toLowerCase());
            return isTailleur && e.actif !== false && matchesSearch;
        });
    }, [employes, searchTerm]);

    const filteredCommandes = useMemo(() => {
        return commandes.filter(c => {
            if (c.type !== 'SUR_MESURE') return false; 
            const isCompleted = c.statut === StatutCommande.LIVRE || c.statut === StatutCommande.ANNULE;
            if (viewMode === 'HISTORY') {
                if (historyFilterStatus !== 'ALL' && c.statut !== historyFilterStatus) return false;
                if (historyFilterPayment === 'UNPAID' && c.reste <= 0) return false;
                if (historyFilterPayment === 'PAID' && c.reste > 0) return false;
            } else if (viewMode !== 'PERFORMANCE') {
                if (isCompleted) return false;
            }
            const matchesSearch = c.clientNom.toLowerCase().includes(searchTerm.toLowerCase()) || 
                                  c.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
                                  c.description.toLowerCase().includes(searchTerm.toLowerCase());
            return matchesSearch;
        }).sort((a, b) => new Date(b.dateCommande).getTime() - new Date(a.dateCommande).getTime());
    }, [commandes, searchTerm, viewMode, historyFilterStatus, historyFilterPayment]);

    const renderDetailedStatus = (order: Commande) => {
        if (!order.repartitionStatuts || Object.keys(order.repartitionStatuts).length <= 1) {
            return <span className="px-2 py-1 bg-gray-100 rounded text-[10px] font-bold uppercase border border-gray-200">{order.statut}</span>;
        }
        return (
            <div className="flex flex-wrap gap-1">
                {KANBAN_STATUS_ORDER.map(s => {
                    const qty = order.repartitionStatuts?.[s];
                    if (!qty || qty <= 0) return null;
                    return (
                        <span key={s} className="px-1.5 py-0.5 bg-brand-50 text-brand-700 rounded text-[9px] font-bold border border-brand-100 shadow-sm">
                            {s}({qty})
                        </span>
                    );
                })}
            </div>
        );
    };

    // --- SYNCHRONISATION AGENDA (ACTIONS) -> BUCKETS ---
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
                const availableInSource = newRepartition[rule.from] || 0;
                const qtyToMove = Math.min(task.quantite, availableInSource);
                
                if (qtyToMove > 0) {
                    newRepartition[rule.from] -= qtyToMove;
                    if (newRepartition[rule.from] <= 0) delete newRepartition[rule.from];
                    newRepartition[rule.to] = (newRepartition[rule.to] || 0) + qtyToMove;
                }
            }
        }

        // Calculer le statut global comme étant l'étape la plus avancée contenant au moins une pièce
        let mostAdvanced = StatutCommande.EN_ATTENTE;
        KANBAN_STATUS_ORDER.forEach(s => { if ((newRepartition[s] || 0) > 0) mostAdvanced = s as StatutCommande; });

        onUpdateOrder({ ...order, taches: updatedTaches, repartitionStatuts: newRepartition, statut: mostAdvanced });
    };

    const handleTaskClick = (order: Commande, task: TacheProduction) => {
        const action = window.confirm(
            `Action: ${task.action} x${task.quantite} pour ${order.clientNom}\n\n` +
            `OK: Valider comme TERMINÉ (Déplacera les pièces) ?\n` +
            `ANNULER: Supprimer cette assignation ?`
        );
        if (action) handleTaskStatusChange(order, task, task.statut === 'A_FAIRE' ? 'FAIT' : 'A_FAIRE');
        else if (window.confirm("Supprimer l'assignation ?")) {
            const updatedTaches = (order.taches || []).filter(t => t.id !== task.id);
            onUpdateOrder({ ...order, taches: updatedTaches });
        }
    };

    const handleSaveQuickOrder = () => {
        if (!newOrderData.clientId || !newOrderData.quantite || !newOrderData.prixTotal) return;
        const client = clients.find(c => c.id === newOrderData.clientId);
        const order: Commande = {
            id: `CMD_SM_${Date.now()}`,
            clientId: newOrderData.clientId!,
            clientNom: client?.nom || 'Client Inconnu',
            description: newOrderData.description || 'Sur-Mesure',
            dateCommande: new Date().toISOString(),
            dateLivraisonPrevue: newOrderData.dateLivraisonPrevue || new Date(Date.now() + 7 * 86400000).toISOString(),
            statut: StatutCommande.EN_ATTENTE,
            tailleursIds: [],
            prixTotal: newOrderData.prixTotal!,
            avance: newOrderData.avance || 0,
            reste: Math.max(0, newOrderData.prixTotal! - (newOrderData.avance || 0)),
            type: 'SUR_MESURE',
            quantite: newOrderData.quantite!,
            repartitionStatuts: { [StatutCommande.EN_ATTENTE]: newOrderData.quantite! }
        };
        onCreateOrder(order, [], 'ESPECE', payAccount);
        setOrderModalOpen(false);
        setNewOrderData({ clientId: '', quantite: 1, prixTotal: 0, avance: 0 });
    };

    const performanceStats = useMemo(() => {
        const stats: Record<string, { done: number, pending: number, name: string, points: number }> = {};
        tailleurs.forEach(t => { stats[t.id] = { done: 0, pending: 0, name: t.nom, points: 0 }; });
        commandes.forEach(order => {
            order.taches?.forEach(t => {
                if (stats[t.tailleurId]) {
                    if (t.statut === 'FAIT') {
                        stats[t.tailleurId].done += t.quantite;
                        stats[t.tailleurId].points += (t.quantite * 10); 
                    } else {
                        stats[t.tailleurId].pending += t.quantite;
                    }
                }
            });
        });
        return Object.entries(stats).map(([id, data]) => ({ id, ...data })).sort((a, b) => b.points - a.points);
    }, [commandes, tailleurs]);

    const handleDragStart = (orderId: string, fromStatus: string) => setDraggedInfo({ orderId, fromStatus });
    const handleDrop = (toStatus: string) => {
        if (!draggedInfo || draggedInfo.fromStatus === toStatus) { setDraggedInfo(null); return; }
        const order = commandes.find(c => c.id === draggedInfo.orderId);
        if (!order) return;
        const currentQtyInSource = order.repartitionStatuts ? (order.repartitionStatuts[draggedInfo.fromStatus] || 0) : (order.statut === draggedInfo.fromStatus ? order.quantite : 0);
        if (currentQtyInSource === 1) executeMove(order, draggedInfo.fromStatus, toStatus, 1);
        else if (currentQtyInSource > 1) setMoveModal({ order, fromStatus: draggedInfo.fromStatus, toStatus, maxQty: currentQtyInSource, qty: currentQtyInSource });
        setDraggedInfo(null);
    };

    const executeMove = (order: Commande, from: string, to: string, qty: number) => {
        const newRepartition = { ...(order.repartitionStatuts || { [order.statut]: order.quantite }) };
        newRepartition[from] = (newRepartition[from] || 0) - qty;
        if (newRepartition[from] <= 0) delete newRepartition[from];
        newRepartition[to] = (newRepartition[to] || 0) + qty;
        let mostAdvanced = order.statut as StatutCommande;
        KANBAN_STATUS_ORDER.forEach(s => { if ((newRepartition[s] || 0) > 0) mostAdvanced = s as StatutCommande; });
        onUpdateOrder({ ...order, repartitionStatuts: newRepartition, statut: mostAdvanced });
        setMoveModal(null);
    };

    const handleSaveTask = () => {
        if (!newTaskData.orderId || !planningTarget?.tailorId) return;
        const order = commandes.find(c => c.id === newTaskData.orderId);
        if (!order) return;
        const newTask: TacheProduction = {
            id: `TASK_${Date.now()}`, 
            commandeId: order.id, 
            action: newTaskData.action,
            quantite: Math.min(newTaskData.quantite, order.quantite), 
            date: planningTarget.date.toISOString().split('T')[0], 
            tailleurId: planningTarget.tailorId, 
            statut: 'A_FAIRE',
            note: newTaskData.note
        };
        onUpdateOrder({ ...order, taches: [...(order.taches || []), newTask] });
        setTaskModalOpen(false);
    };

    const getStatusIcon = (s: string) => {
        switch(s) {
            case StatutCommande.EN_ATTENTE: return <Clock size={16} />;
            case StatutCommande.EN_COUPE: return <Scissors size={16} />;
            case StatutCommande.COUTURE: return <Shirt size={16} />;
            case StatutCommande.FINITION: return <Zap size={16} />;
            case StatutCommande.PRET: return <CheckCircle size={16} />;
            default: return <Activity size={16} />;
        }
    };

    return (
        <div className="space-y-6 h-[calc(100vh-8rem)] flex flex-col">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 shrink-0">
                <div className="flex items-center gap-3">
                    <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2"><Scissors className="text-brand-600"/> Atelier Production</h2>
                    <div className="flex gap-2">
                        <button onClick={() => setOrderModalOpen(true)} className="bg-brand-600 text-white px-3 py-1.5 rounded-lg flex items-center gap-2 text-xs font-bold hover:bg-brand-700 shadow-md"><Plus size={14}/> Nouvelle Commande</button>
                        <button onClick={() => setIsScannerOpen(true)} className="bg-gray-800 text-white px-3 py-1.5 rounded-lg flex items-center gap-2 text-xs font-bold hover:bg-black shadow-sm"><Camera size={14}/> Scanner Badge</button>
                    </div>
                </div>
                <div className="flex flex-wrap bg-white border p-1 rounded-lg shadow-sm">
                    {['PLANNING', 'KANBAN', 'ORDERS', 'TAILORS', 'PERFORMANCE', 'HISTORY'].map((mode: any) => (
                        <button key={mode} onClick={() => setViewMode(mode)} className={`px-3 py-1.5 text-xs font-bold rounded flex items-center gap-1 ${viewMode === mode ? 'bg-brand-50 text-brand-700' : 'text-gray-500'}`}>
                            {mode === 'PLANNING' && <Calendar size={14}/>} {mode === 'KANBAN' && <Columns size={14}/>} {mode === 'ORDERS' && <LayoutList size={14}/>} {mode === 'TAILORS' && <Users size={14}/>} {mode === 'PERFORMANCE' && <Trophy size={14}/>} {mode === 'HISTORY' && <History size={14}/>}
                            <span className="capitalize">{mode.toLowerCase()}</span>
                        </button>
                    ))}
                </div>
            </div>

            <div className="bg-white p-3 rounded-lg border flex flex-wrap gap-3 shrink-0 shadow-sm items-center">
                <div className="relative flex-1 min-w-[200px]"><Search className="absolute left-3 top-2.5 text-gray-400" size={16}/><input type="text" placeholder="Rechercher..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-10 pr-4 py-2 border rounded-lg text-sm" /></div>
            </div>

            <div className="flex-1 overflow-hidden">
                {viewMode === 'KANBAN' && (
                    <div className="flex gap-4 h-full overflow-x-auto pb-4 custom-scrollbar">
                        {KANBAN_STATUS_ORDER.map((status, index) => (
                            <div key={status} className="flex-1 min-w-[280px] bg-gray-100/50 rounded-xl flex flex-col border border-gray-200" onDragOver={e => e.preventDefault()} onDrop={() => handleDrop(status)}>
                                <div className="p-3 border-b flex justify-between items-center bg-white rounded-t-xl">
                                    <h3 className="text-sm font-bold text-gray-700 flex items-center gap-2">{getStatusIcon(status)} {status}</h3>
                                    <span className="bg-gray-200 text-gray-600 text-[10px] px-2 py-0.5 rounded-full font-bold">{filteredCommandes.reduce((acc, c) => acc + (c.repartitionStatuts?.[status] || (c.statut === status ? c.quantite : 0)), 0)}</span>
                                </div>
                                <div className="flex-1 overflow-y-auto p-2 space-y-3">
                                    {filteredCommandes.filter(c => (c.repartitionStatuts?.[status] || 0) > 0 || (!c.repartitionStatuts && c.statut === status)).map(order => {
                                        const repartition = order.repartitionStatuts || { [order.statut]: order.quantite };
                                        const reachedOrPassed = KANBAN_STATUS_ORDER.slice(index).reduce((acc, s) => acc + (repartition[s] || 0), 0);
                                        const safeReached = Math.min(reachedOrPassed, order.quantite);
                                        return (
                                            <div key={order.id} draggable onDragStart={() => handleDragStart(order.id, status)} className="bg-white p-3 rounded-lg shadow-sm border border-gray-200 cursor-grab hover:border-brand-300">
                                                <div className="flex justify-between items-start mb-1 text-[10px] font-mono text-gray-400"><span>#{order.id.slice(-5)}</span><span className="bg-brand-50 text-brand-700 px-1.5 rounded font-bold">Qté: {repartition[status] || 0}</span></div>
                                                <p className="font-bold text-gray-800 text-sm mb-1">{order.clientNom}</p>
                                                <div className="mt-2 flex items-center gap-2">
                                                    <div className="flex-1 h-1 bg-gray-100 rounded-full overflow-hidden"><div className={`h-full ${safeReached >= order.quantite ? 'bg-green-500' : 'bg-brand-500'}`} style={{ width: `${(safeReached/order.quantite)*100}%` }}></div></div>
                                                    <span className={`text-[8px] font-bold ${safeReached >= order.quantite ? 'text-green-600' : 'text-brand-600'}`}>{safeReached}/{order.quantite} pc.</span>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {viewMode === 'ORDERS' && (
                    <div className="bg-white border rounded-xl overflow-hidden shadow-sm h-full flex flex-col">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-gray-50 text-gray-600 font-bold border-b sticky top-0 z-10"><tr><th className="p-3">Client / Réf</th><th className="p-3">Livraison</th><th className="p-3">Statut Réel (Flux)</th><th className="p-3 text-right">Actions</th></tr></thead>
                            <tbody className="divide-y divide-gray-100 overflow-y-auto">
                                {filteredCommandes.map(order => (
                                    <tr key={order.id} className="hover:bg-gray-50 transition-colors">
                                        <td className="p-3"><div className="font-bold text-gray-800">{order.clientNom}</div><div className="text-[10px] font-mono text-gray-400">#{order.id.slice(-6)}</div></td>
                                        <td className="p-3 font-bold text-orange-600">{new Date(order.dateLivraisonPrevue).toLocaleDateString()}</td>
                                        <td className="p-3">{renderDetailedStatus(order)}</td>
                                        <td className="p-3 text-right">
                                            <div className="flex justify-end gap-1">
                                                <button onClick={() => { setNewTaskData({...newTaskData, orderId: order.id}); setTaskModalOpen(true); }} className="p-1.5 text-brand-600 hover:bg-brand-50 rounded"><UserPlus size={18}/></button>
                                                <button onClick={() => alert(`Acomptes:\n${order.paiements?.map(p => `- ${new Date(p.date).toLocaleDateString()} : ${p.montant} F`).join('\n') || 'Aucun.'}`)} className="p-1.5 text-blue-500 hover:bg-blue-50 rounded"><Eye size={18}/></button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}

                {viewMode === 'PLANNING' && (
                    <div className="bg-white border rounded-xl shadow-sm h-full flex flex-col overflow-hidden">
                        <div className="flex-1 overflow-auto">
                            <table className="w-full border-collapse table-fixed min-w-[1000px]">
                                <thead className="sticky top-0 z-20 bg-gray-50">
                                    <tr>
                                        <th className="w-48 p-3 border-b border-r text-left text-xs font-bold text-gray-500 uppercase">Tailleur</th>
                                        {Array.from({length: 7}, (_, i) => {
                                            const d = new Date(agendaBaseDate); d.setDate(d.getDate() + i);
                                            return <th key={i} className="p-3 border-b text-center text-xs font-bold text-gray-500 uppercase">{d.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric' })}</th>;
                                        })}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {tailleurs.map(tailor => (
                                        <tr key={tailor.id} className="hover:bg-gray-50/50">
                                            <td className="p-3 border-r bg-gray-50/30 sticky left-0 font-bold text-xs">{tailor.nom}</td>
                                            {Array.from({length: 7}, (_, i) => {
                                                const d = new Date(agendaBaseDate); d.setDate(d.getDate() + i);
                                                const dateStr = d.toISOString().split('T')[0];
                                                const tasks: {task: TacheProduction, order: Commande}[] = [];
                                                commandes.forEach(o => o.taches?.forEach(t => { if (t.tailleurId === tailor.id && t.date === dateStr) tasks.push({task: t, order: o}); }));
                                                return (
                                                    <td key={i} className="p-2 border-r h-28 vertical-top relative cursor-pointer hover:bg-brand-50/20" 
                                                        onClick={() => { setPlanningTarget({ tailorId: tailor.id, tailorName: tailor.nom, date: d }); setTaskModalOpen(true); }}>
                                                        <div className="space-y-1 h-full overflow-y-auto no-scrollbar">
                                                            {tasks.map(({task, order}) => (
                                                                <div key={task.id} onClick={(e) => { e.stopPropagation(); handleTaskClick(order, task); }}
                                                                    className={`p-1 rounded text-[9px] border shadow-sm transition-all hover:scale-105 ${task.statut === 'FAIT' ? 'bg-green-100 text-green-800 border-green-200' : 'bg-brand-50 text-brand-800 border-brand-200 border-l-4 border-l-brand-500'}`}>
                                                                    <div className="flex justify-between items-center font-bold"><span>{task.action} x{task.quantite}</span>{task.statut === 'FAIT' && <CheckCircle size={10} />}</div>
                                                                    <div className="truncate opacity-75">{order.clientNom}</div>
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
            </div>

            {/* MODALS : PLANIFICATION, NOUVELLE COMMANDE */}
            {taskModalOpen && (
                <div className="fixed inset-0 bg-black/60 z-[110] flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-md animate-in zoom-in duration-200">
                        <div className="p-4 border-b bg-gray-50 flex justify-between items-center"><h3 className="font-bold text-gray-800">Assigner Tâche</h3><button onClick={() => setTaskModalOpen(false)}><X size={20}/></button></div>
                        <div className="p-6 space-y-4">
                            <div><label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Commande</label><select className="w-full p-2 border rounded-lg text-sm bg-white" value={newTaskData.orderId} onChange={e => { const o = commandes.find(c => c.id === e.target.value); setNewTaskData({...newTaskData, orderId: e.target.value, quantite: o?.quantite || 1}); }}><option value="">-- Choisir --</option>{commandes.filter(c => c.statut !== StatutCommande.LIVRE && c.statut !== StatutCommande.ANNULE).map(c => <option key={c.id} value={c.id}>{c.clientNom} (#{c.id.slice(-5)})</option>)}</select></div>
                            <div className="grid grid-cols-2 gap-4"><div><label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Action</label><select className="w-full p-2 border rounded-lg text-sm" value={newTaskData.action} onChange={e => setNewTaskData({...newTaskData, action: e.target.value as ActionProduction})}>{PRODUCTION_ACTIONS.map(a => <option key={a.id} value={a.id}>{a.label}</option>)}</select></div><div><label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Quantité</label><input type="number" className="w-full p-2 border rounded-lg text-sm font-bold" value={newTaskData.quantite} onChange={e => setNewTaskData({...newTaskData, quantite: parseInt(e.target.value)||1})}/></div></div>
                        </div>
                        <div className="p-4 bg-gray-50 border-t flex justify-end gap-3 rounded-b-xl"><button onClick={() => setTaskModalOpen(false)} className="px-4 py-2 text-gray-500 font-bold">Annuler</button><button onClick={handleSaveTask} disabled={!newTaskData.orderId || !planningTarget?.tailorId} className="px-6 py-2 bg-brand-600 text-white rounded-lg font-bold shadow-lg hover:bg-brand-700 disabled:opacity-50">Confirmer</button></div>
                    </div>
                </div>
            )}

            {orderModalOpen && (
                <div className="fixed inset-0 bg-black/60 z-[110] flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-md animate-in zoom-in duration-200">
                        <div className="p-4 border-b bg-gray-50 rounded-t-xl flex justify-between items-center"><h3 className="font-bold text-gray-800 flex items-center gap-2"><Plus size={18} className="text-brand-600"/> Nouvelle Commande</h3><button onClick={() => setOrderModalOpen(false)}><X size={20}/></button></div>
                        <div className="p-6 space-y-4">
                            <div><label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Client</label><select className="w-full p-2 border rounded-lg text-sm bg-white" value={newOrderData.clientId} onChange={e => setNewOrderData({...newOrderData, clientId: e.target.value})}><option value="">-- Sélectionner --</option>{clients.map(c => <option key={c.id} value={c.id}>{c.nom}</option>)}</select></div>
                            <div className="grid grid-cols-2 gap-4"><div><label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Quantité</label><input type="number" className="w-full p-2 border rounded-lg text-sm font-bold" value={newOrderData.quantite} onChange={e => setNewOrderData({...newOrderData, quantite: parseInt(e.target.value)||1})}/></div><div><label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Livraison</label><input type="date" className="w-full p-2 border rounded-lg text-sm" value={newOrderData.dateLivraisonPrevue} onChange={e => setNewOrderData({...newOrderData, dateLivraisonPrevue: e.target.value})}/></div></div>
                            <div className="grid grid-cols-2 gap-4"><div><label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Prix Total</label><input type="number" className="w-full p-2 border rounded-lg text-sm font-bold" value={newOrderData.prixTotal || ''} onChange={e => setNewOrderData({...newOrderData, prixTotal: parseInt(e.target.value)||0})}/></div><div><label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Avance</label><input type="number" className="w-full p-2 border rounded-lg text-sm font-bold bg-green-50" value={newOrderData.avance || ''} onChange={e => setNewOrderData({...newOrderData, avance: parseInt(e.target.value)||0})}/></div></div>
                        </div>
                        <div className="p-4 bg-gray-50 border-t flex justify-end gap-3 rounded-b-xl"><button onClick={() => setOrderModalOpen(false)} className="px-4 py-2 text-gray-500 font-bold">Annuler</button><button onClick={handleSaveQuickOrder} className="px-6 py-2 bg-brand-600 text-white rounded-lg font-bold">Enregistrer</button></div>
                    </div>
                </div>
            )}

            {isScannerOpen && <QRScannerModal isOpen={isScannerOpen} onClose={() => setIsScannerOpen(false)} onScan={(text) => { const emp = employes.find(e => e.id === text.trim()); if (emp) setSearchTerm(emp.nom); setIsScannerOpen(false); }} />}
        </div>
    );
};

export default ProductionView;
