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
    const [viewMode, setViewMode] = useState<'ORDERS' | 'TAILORS' | 'PERFORMANCE' | 'KANBAN' | 'PLANNING'>('KANBAN');
    const [searchTerm, setSearchTerm] = useState('');
    const [listFilter, setListFilter] = useState<'ALL' | 'ACTIVE' | 'READY' | 'DELIVERED' | 'ARCHIVED'>('ACTIVE');
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
    const [deliveryModal, setDeliveryModal] = useState<{ order: Commande, maxQty: number, qty: number } | null>(null);
    const [kanbanMoveModal, setKanbanMoveModal] = useState<{
        order: Commande, fromStatus: StatutCommande, toStatus: StatutCommande, maxQty: number, qty: number, assignTailorId: string
    } | null>(null);

    // Form States
    const [selectedOrderForPayment, setSelectedOrderForPayment] = useState<Commande | null>(null);
    const [payAmount, setPayAmount] = useState(0);
    const [payAccount, setPayAccount] = useState('');
    const [payMethod, setPayMethod] = useState<ModePaiement>('ESPECE');
    const [payDate, setPayDate] = useState(new Date().toISOString().split('T')[0]);

    const [newTaskData, setNewTaskData] = useState<{ orderId: string, action: ActionProduction, quantite: number, note: string, tailleurId: string }>({ 
        orderId: '', action: 'COUTURE', quantite: 1, note: '', tailleurId: '' 
    });

    const [newOrderData, setNewOrderData] = useState<Partial<Commande>>({
        clientId: '', clientNom: '', description: '', prixTotal: 0, avance: 0, dateLivraisonPrevue: '', elements: []
    });
    const [tempElement, setTempElement] = useState({ nom: '', quantite: 1 });

    const tailleurs = useMemo(() => {
        return employes.filter(e => {
            const isTailleur = e.role === RoleEmploye.TAILLEUR || e.role === RoleEmploye.CHEF_ATELIER || e.role === RoleEmploye.STAGIAIRE;
            return isTailleur && e.actif !== false;
        }).sort((a, b) => a.nom.localeCompare(b.nom));
    }, [employes]);

    const filteredCommandes = useMemo(() => {
        return commandes.filter(c => {
            if (c.type !== 'SUR_MESURE') return false; 
            const isCompleted = c.statut === StatutCommande.LIVRE || c.statut === StatutCommande.ANNULE;
            const isArchived = c.archived === true;
            const isReady = (c.repartitionStatuts?.[StatutCommande.PRET] || 0) > 0;

            if (viewMode === 'ORDERS') {
                if (listFilter === 'ACTIVE' && (isCompleted || isArchived)) return false;
                if (listFilter === 'READY' && !isReady) return false;
                if (listFilter === 'DELIVERED' && !isCompleted) return false;
                if (listFilter === 'ARCHIVED' && !isArchived) return false;
            } else if (viewMode === 'KANBAN') {
                if (isCompleted || isArchived) return false;
            }

            const searchLower = searchTerm.toLowerCase();
            return c.clientNom.toLowerCase().includes(searchLower) || c.id.toLowerCase().includes(searchLower) || c.description.toLowerCase().includes(searchLower);
        }).sort((a, b) => new Date(b.dateCommande).getTime() - new Date(a.dateCommande).getTime());
    }, [commandes, searchTerm, viewMode, listFilter]);

    // --- LOGIQUE CALCUL RELIQUAT POUR NOUVELLE TACHE ---

    const getTaskAvailability = (orderId: string, action: ActionProduction) => {
        const order = commandes.find(c => c.id === orderId);
        if (!order) return { total: 0, assigned: 0, remaining: 0 };

        const totalQty = order.quantite || 0;
        const alreadyAssigned = (order.taches || [])
            .filter(t => t.action === action)
            .reduce((acc, t) => acc + t.quantite, 0);
        
        return {
            total: totalQty,
            assigned: alreadyAssigned,
            remaining: Math.max(0, totalQty - alreadyAssigned)
        };
    };

    const availability = useMemo(() => {
        return getTaskAvailability(newTaskData.orderId, newTaskData.action);
    }, [newTaskData.orderId, newTaskData.action, commandes]);

    // Ajustement auto de la quantité si elle dépasse le reliquat
    React.useEffect(() => {
        if (newTaskData.quantite > availability.remaining && availability.remaining > 0) {
            setNewTaskData(prev => ({ ...prev, quantite: availability.remaining }));
        } else if (availability.remaining === 0) {
            setNewTaskData(prev => ({ ...prev, quantite: 0 }));
        }
    }, [availability.remaining]);

    // --- LOGIQUE VISIBILITÉ TAILLEURS CIBLÉE AVEC CODE COULEUR ---

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

        return (order.taches || [])
            .filter(t => t.action === targetAction)
            .map(t => {
                const emp = employes.find(e => e.id === t.tailleurId);
                return {
                    name: emp?.nom || 'Inconnu',
                    statut: t.statut,
                    isLate: t.statut === 'A_FAIRE' && t.date < todayStr
                };
            });
    };

    const getAllTailorsForOrder = (order: Commande) => {
        const tailsIds = Array.from(new Set((order.taches || []).map(t => t.tailleurId)));
        return tailsIds.map(id => employes.find(e => e.id === id)?.nom).filter(Boolean);
    };

    // --- SYNCHRONISATION AGENDA -> KANBAN ---

    const handleTaskStatusChange = (order: Commande, task: TacheProduction, newStatut: 'A_FAIRE' | 'FAIT') => {
        const updatedTaches = (order.taches || []).map(t => t.id === task.id ? { ...t, statut: newStatut } : t);
        let newRepartition = { ...(order.repartitionStatuts || { [StatutCommande.EN_ATTENTE]: order.quantite }) };
        
        if (newStatut === 'FAIT') {
            const transitions: Record<string, { from: StatutCommande, to: StatutCommande }> = {
                'COUPE': { from: StatutCommande.EN_ATTENTE, to: StatutCommande.EN_COUPE },
                'COUTURE': { from: StatutCommande.EN_COUPE, to: StatutCommande.COUTURE },
                'FINITION': { from: StatutCommande.COUTURE, to: StatutCommande.FINITION },
                'REPASSAGE': { from: StatutCommande.FINITION, to: StatutCommande.PRET }
            };

            const rule = transitions[task.action];
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

        let mostAdvanced = StatutCommande.EN_ATTENTE;
        KANBAN_STATUS_ORDER.forEach(s => { if ((newRepartition[s] || 0) > 0) mostAdvanced = s as StatutCommande; });
        
        onUpdateOrder({ ...order, taches: updatedTaches, repartitionStatuts: newRepartition, statut: mostAdvanced });
    };

    // --- LOGIQUE KANBAN -> AGENDA ---

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
        let mostAdvanced = order.statut as StatutCommande;
        KANBAN_STATUS_ORDER.forEach(s => { if ((newRepartition[s] || 0) > 0) mostAdvanced = s as StatutCommande; });
        let updatedTaches = [...(order.taches || [])];
        if (assignTailorId) {
            let action: ActionProduction = 'COUTURE';
            if (toStatus === StatutCommande.EN_COUPE) action = 'COUPE';
            else if (toStatus === StatutCommande.FINITION) action = 'FINITION';
            else if (toStatus === StatutCommande.PRET) action = 'REPASSAGE';
            updatedTaches.push({ id: `T_KB_${Date.now()}`, commandeId: order.id, action, quantite: qty, tailleurId: assignTailorId, date: new Date().toISOString().split('T')[0], statut: 'A_FAIRE' });
        }
        onUpdateOrder({ ...order, repartitionStatuts: newRepartition, statut: mostAdvanced, taches: updatedTaches });
        setKanbanMoveModal(null);
    };

    const handleSaveQuickOrder = () => {
        const totalQty = (newOrderData.elements || []).reduce((acc, el) => acc + el.quantite, 0);
        if (!newOrderData.clientId || totalQty <= 0 || !newOrderData.prixTotal || !payAccount) {
            alert("Informations incomplètes."); return;
        }
        const client = clients.find(c => c.id === newOrderData.clientId);
        const order: Commande = {
            id: `CMD_PRD_${Date.now()}`,
            clientId: newOrderData.clientId!, clientNom: client?.nom || 'Inconnu',
            description: newOrderData.description || 'Production sur mesure',
            dateCommande: new Date().toISOString().split('T')[0], dateLivraisonPrevue: newOrderData.dateLivraisonPrevue || '',
            statut: StatutCommande.EN_ATTENTE, tailleursIds: [], prixTotal: newOrderData.prixTotal!,
            avance: newOrderData.avance || 0, reste: Math.max(0, newOrderData.prixTotal! - (newOrderData.avance || 0)),
            type: 'SUR_MESURE', quantite: totalQty, elements: newOrderData.elements,
            repartitionStatuts: { [StatutCommande.EN_ATTENTE]: totalQty }, taches: []
        };
        onCreateOrder(order, [], 'ESPECE', payAccount);
        setOrderModalOpen(false);
        setNewOrderData({ clientId: '', description: '', prixTotal: 0, avance: 0, elements: [] });
    };

    const handleConfirmPayment = () => {
        if (!selectedOrderForPayment || payAmount <= 0) return;
        if (!payAccount) { alert("Compte requis."); return; }
        onAddPayment(selectedOrderForPayment.id, payAmount, payMethod, "Versement production", payDate, payAccount);
        setPaymentModalOpen(false);
        setSelectedOrderForPayment(null);
    };

    const getOverdueCount = () => {
        const todayStr = new Date().toISOString().split('T')[0];
        return commandes.flatMap(c => c.taches || []).filter(t => t.statut === 'A_FAIRE' && t.date < todayStr).length;
    };

    return (
        <div className="space-y-6 h-[calc(100vh-8rem)] flex flex-col">
            {/* HEADER NAVIGATION */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 shrink-0">
                <div className="flex items-center gap-3">
                    <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2"><Scissors className="text-brand-600"/> Atelier Production</h2>
                    <button onClick={() => setOrderModalOpen(true)} className="bg-brand-600 text-white px-3 py-2 rounded-lg flex items-center gap-2 text-xs font-bold hover:bg-brand-700 shadow-md"><Plus size={14}/> Nouvelle Commande</button>
                </div>
                <div className="flex flex-wrap bg-white border p-1 rounded-lg shadow-sm">
                    {[
                        {id: 'PLANNING', label: 'Planning / Agenda', icon: Calendar},
                        {id: 'KANBAN', label: 'Tableau Kanban', icon: Columns},
                        {id: 'ORDERS', label: 'Toutes les Commandes', icon: LayoutList},
                        {id: 'TAILORS', label: 'Charge Tailleurs', icon: Users},
                        {id: 'PERFORMANCE', label: 'Top Artisans', icon: Trophy},
                    ].map((mode) => (
                        <button key={mode.id} onClick={() => setViewMode(mode.id as any)} className={`px-3 py-1.5 text-xs font-bold rounded flex items-center gap-1 transition-colors ${viewMode === mode.id ? 'bg-brand-50 text-brand-700 shadow-inner' : 'text-gray-500 hover:bg-gray-50'}`}>
                            <mode.icon size={14}/> <span>{mode.label}</span>
                        </button>
                    ))}
                </div>
            </div>

            <div className="flex-1 overflow-hidden">
                {/* 1. AGENDA / PLANNING */}
                {viewMode === 'PLANNING' && (
                    <div className="bg-white border rounded-xl shadow-sm h-full flex flex-col overflow-hidden">
                        <div className="p-3 border-b bg-gray-50 flex justify-between items-center shrink-0">
                            <div className="flex items-center gap-2">
                                <button onClick={() => { const d = new Date(agendaBaseDate); d.setDate(d.getDate()-7); setAgendaBaseDate(d); }} className="p-1.5 hover:bg-gray-200 rounded border border-gray-300"><ChevronLeft size={18}/></button>
                                <button onClick={() => { const d = new Date(agendaBaseDate); d.setDate(d.getDate()+7); setAgendaBaseDate(d); }} className="p-1.5 hover:bg-gray-200 rounded border border-gray-300"><ChevronRight size={18}/></button>
                                <span className="font-bold text-sm ml-2">Calendrier de Production</span>
                            </div>
                            {getOverdueCount() > 0 && (
                                <div className="bg-red-500 text-white px-4 py-1.5 rounded-full text-xs font-bold flex items-center gap-2 animate-pulse shadow-sm">
                                    <AlertTriangle size={14}/> {getOverdueCount()} tâches en retard !
                                </div>
                            )}
                        </div>
                        <div className="flex-1 overflow-auto">
                            <table className="w-full border-collapse table-fixed min-w-[1000px]">
                                <thead className="sticky top-0 z-20 bg-gray-100">
                                    <tr>
                                        <th className="w-40 p-3 border-b border-r text-left text-[10px] font-bold text-gray-500 uppercase bg-gray-50">Artisan</th>
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
                                            <td className="p-3 border-r bg-gray-50 font-bold text-xs sticky left-0 z-10 shadow-sm">{tailor.nom}</td>
                                            {Array.from({length: 7}, (_, i) => {
                                                const d = new Date(agendaBaseDate); d.setDate(d.getDate() + i);
                                                const dateStr = d.toISOString().split('T')[0];
                                                const todayStr = new Date().toISOString().split('T')[0];
                                                const tasks = commandes.flatMap(o => (o.taches || []).map(t => ({...t, order: o}))).filter(t => t.tailleurId === tailor.id && t.date === dateStr);
                                                
                                                return (
                                                    <td key={i} className="p-1 border-r h-32 vertical-top relative cursor-pointer hover:bg-brand-50/10" onClick={() => { setNewTaskData({...newTaskData, tailleurId: tailor.id}); setTaskModalOpen(true); }}>
                                                        <div className="space-y-1 h-full overflow-y-auto no-scrollbar">
                                                            {tasks.map(t => {
                                                                const isLate = t.statut === 'A_FAIRE' && t.date < todayStr;
                                                                return (
                                                                    <div key={t.id} onClick={(e) => { e.stopPropagation(); handleTaskStatusChange(t.order, t, t.statut === 'A_FAIRE' ? 'FAIT' : 'A_FAIRE'); }}
                                                                        className={`p-1.5 rounded text-[9px] border shadow-sm transition-all hover:scale-105 active:scale-95 ${
                                                                            t.statut === 'FAIT' ? 'bg-green-100 text-green-800 border-green-200 opacity-60' :
                                                                            isLate ? 'bg-red-600 text-white border-red-700 font-bold' :
                                                                            'bg-white text-brand-800 border-brand-200'
                                                                        }`}>
                                                                        <div className="flex justify-between items-center font-bold">
                                                                            <span className="truncate">{t.action} x{t.quantite}</span>
                                                                            {t.statut === 'FAIT' ? <CheckCircle size={10} /> : isLate ? <AlertTriangle size={10}/> : <Clock size={10}/>}
                                                                        </div>
                                                                        <div className="truncate opacity-80 font-semibold">{t.order.clientNom}</div>
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

                {/* 2. KANBAN */}
                {viewMode === 'KANBAN' && (
                    <div className="flex gap-4 h-full overflow-x-auto pb-4 custom-scrollbar">
                        {KANBAN_STATUS_ORDER.map((status) => (
                            <div key={status} className="flex-1 min-w-[280px] bg-gray-100/50 rounded-xl flex flex-col border border-gray-200" onDragOver={e => e.preventDefault()} onDrop={(e) => {
                                try {
                                    const data = JSON.parse(e.dataTransfer.getData('orderMove'));
                                    handleDrop(data.id, data.from, status as StatutCommande);
                                } catch(e) {}
                            }}>
                                <div className="p-3 border-b flex justify-between items-center bg-white rounded-t-xl shrink-0">
                                    <h3 className="text-sm font-bold text-gray-700 uppercase tracking-tighter">{status}</h3>
                                    <span className="bg-gray-200 text-gray-700 text-[10px] px-2 py-0.5 rounded-full font-black">{filteredCommandes.reduce((acc, c) => acc + (c.repartitionStatuts?.[status] || (c.statut === status ? c.quantite : 0)), 0)}</span>
                                </div>
                                <div className="flex-1 overflow-y-auto p-2 space-y-3">
                                    {filteredCommandes.filter(c => (c.repartitionStatuts?.[status] || 0) > 0 || (!c.repartitionStatuts && c.statut === status)).map(order => {
                                        const repartition = order.repartitionStatuts || { [order.statut]: order.quantite };
                                        const qtyInColumn = repartition[status] || 0;
                                        const targetedTailors = getAssignedTailorsWithStatus(order, status);

                                        return (
                                            <div key={order.id} draggable onDragStart={(e) => e.dataTransfer.setData('orderMove', JSON.stringify({id: order.id, from: status}))} className="bg-white p-3 rounded-lg shadow-sm border border-gray-200 cursor-grab hover:border-brand-300 transition-all active:cursor-grabbing group">
                                                <div className="flex justify-between items-start mb-1 text-[10px] font-mono text-gray-400"><span>#{order.id.slice(-6)}</span><span className="bg-brand-50 text-brand-700 px-1.5 rounded font-black">Qté: {qtyInColumn}</span></div>
                                                <p className="font-bold text-gray-800 text-sm mb-1">{order.clientNom}</p>
                                                <p className="text-[10px] text-gray-500 italic line-clamp-1 border-l-2 border-gray-100 pl-2">{order.description}</p>
                                                
                                                {targetedTailors.length > 0 ? (
                                                    <div className="mt-3 pt-2 border-t border-gray-50 flex flex-wrap gap-1.5">
                                                        {targetedTailors.map((t, idx) => (
                                                            <span key={idx} className={`text-[8px] px-2 py-0.5 rounded font-black uppercase tracking-tighter flex items-center gap-1 shadow-sm border ${
                                                                t.statut === 'FAIT' ? 'bg-green-500 text-white border-green-600' : 
                                                                t.isLate ? 'bg-red-600 text-white border-red-700 animate-pulse' :
                                                                'bg-orange-500 text-white border-orange-600'
                                                            }`}>
                                                                {t.statut === 'FAIT' ? <CheckCircle size={8}/> : <Clock size={8}/>}
                                                                {t.name}
                                                            </span>
                                                        ))}
                                                    </div>
                                                ) : (status !== StatutCommande.EN_ATTENTE && status !== StatutCommande.PRET) && (
                                                    <div className="mt-3 pt-2 border-t border-red-50 flex items-center gap-1 text-[8px] text-red-500 font-bold uppercase"><AlertTriangle size={8}/> Aucun artisan assigné !</div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {/* 3. LISTE UNIFIÉE */}
                {viewMode === 'ORDERS' && (
                    <div className="bg-white border rounded-xl overflow-hidden shadow-sm h-full flex flex-col">
                        <div className="p-4 bg-gray-50 border-b flex flex-wrap items-center justify-between gap-4 shrink-0">
                            <div className="flex bg-white border border-gray-200 p-1 rounded-lg shadow-inner">
                                {[
                                    {id: 'ACTIVE', label: 'En cours', icon: Activity},
                                    {id: 'READY', label: 'Prêts', icon: CheckSquare},
                                    {id: 'DELIVERED', label: 'Livrées', icon: Truck},
                                    {id: 'ARCHIVED', label: 'Archives', icon: Archive},
                                    {id: 'ALL', label: 'Tout voir', icon: ClipboardList}
                                ].map((f) => (
                                    <button key={f.id} onClick={() => setListFilter(f.id as any)} className={`px-4 py-1.5 text-[10px] font-black uppercase tracking-wider rounded-md transition-all flex items-center gap-1.5 ${listFilter === f.id ? 'bg-brand-600 text-white shadow-md' : 'text-gray-500 hover:bg-gray-50'}`}>
                                        <f.icon size={12}/> {f.label}
                                    </button>
                                ))}
                            </div>
                            <div className="relative w-64"><Search className="absolute left-3 top-2 text-gray-400" size={16}/><input type="text" placeholder="Rechercher..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full pl-10 pr-3 py-1.5 border border-gray-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-brand-500"/></div>
                        </div>

                        <div className="flex-1 overflow-auto">
                            <table className="w-full text-sm text-left border-collapse">
                                <thead className="bg-white text-gray-500 font-bold border-b sticky top-0 z-10 uppercase text-[10px] tracking-widest">
                                    <tr><th className="p-4">Client & Projet</th><th className="p-4 text-right">Reste</th><th className="p-4">État de Production</th><th className="p-4">Équipe (Toutes étapes)</th><th className="p-4 text-right">Actions</th></tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {filteredCommandes.map(order => {
                                        const artisans = getAllTailorsForOrder(order);
                                        const isCompleted = order.statut === StatutCommande.LIVRE || order.statut === StatutCommande.ANNULE;
                                        return (
                                            <tr key={order.id} className={`hover:bg-gray-50 transition-colors ${isCompleted ? 'opacity-60 bg-gray-50' : ''} ${order.archived ? 'bg-orange-50/20' : ''}`}>
                                                <td className="p-4"><div className="font-black text-gray-800">{order.clientNom}</div><div className="text-[10px] text-gray-400 mt-0.5 font-medium">#{order.id.slice(-6)} • {order.description}</div></td>
                                                <td className={`p-4 text-right font-black ${order.reste > 0 ? 'text-red-600' : 'text-green-600'}`}>{order.reste.toLocaleString()} F</td>
                                                <td className="p-4"><div className="flex flex-wrap gap-1.5">{KANBAN_STATUS_ORDER.map(s => (order.repartitionStatuts?.[s] || 0) > 0 && (<span key={s} className="px-2 py-0.5 bg-brand-50 text-brand-700 rounded-md text-[9px] font-black border border-brand-200">{s} ({order.repartitionStatuts![s]})</span>))}</div></td>
                                                <td className="p-4"><div className="flex flex-wrap gap-1">{artisans.map(name => (<span key={name} className="text-[9px] text-gray-600 bg-gray-100 border border-gray-200 px-2 py-0.5 rounded font-bold">{name}</span>))}</div></td>
                                                <td className="p-4 text-right"><div className="flex justify-end gap-1.5">
                                                    {(order.repartitionStatuts?.[StatutCommande.PRET] || 0) > 0 && !order.archived && (<button onClick={() => setDeliveryModal({ order, maxQty: order.repartitionStatuts![StatutCommande.PRET], qty: order.repartitionStatuts![StatutCommande.PRET] })} className="px-3 py-1.5 text-green-600 bg-green-50 border border-green-200 hover:bg-green-100 rounded-lg text-[10px] font-black flex items-center gap-1.5 shadow-sm transition-transform active:scale-95"><Truck size={14}/> LIVRER</button>)}
                                                    {order.reste > 0 && !order.archived && (<button onClick={() => {setSelectedOrderForPayment(order); setPayAmount(order.reste); setPaymentModalOpen(true);}} className="p-2 text-orange-600 hover:bg-orange-50 rounded-lg border border-transparent hover:border-orange-200 transition-all"><DollarSign size={18}/></button>)}
                                                    <button onClick={() => { setNewTaskData({...newTaskData, orderId: order.id}); setTaskModalOpen(true); }} className="p-2 text-brand-600 hover:bg-brand-50 rounded-lg border border-transparent hover:border-brand-200 transition-all"><UserPlus size={18}/></button>
                                                    {!order.archived && isCompleted && (<button onClick={() => onArchiveOrder(order.id)} className="p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-all"><Archive size={18}/></button>)}
                                                </div></td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {/* 4. TAILLEURS / CHARGE */}
                {viewMode === 'TAILORS' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 overflow-y-auto h-full p-4 custom-scrollbar animate-in fade-in duration-300">
                        {tailleurs.map(tailor => {
                            const allTasks = (commandes.flatMap(o => (o.taches || []).map(t => ({...t, order: o}))));
                            const activeTasks = allTasks.filter(t => t.tailleurId === tailor.id && t.statut === 'A_FAIRE');
                            const doneTasks = allTasks.filter(t => t.tailleurId === tailor.id && t.statut === 'FAIT');
                            const piecesPending = activeTasks.reduce((acc, t) => acc + t.quantite, 0);
                            const piecesDone = doneTasks.reduce((acc, t) => acc + t.quantite, 0);
                            const todayStr = new Date().toISOString().split('T')[0];
                            const lateTasks = activeTasks.filter(t => t.date < todayStr).length;

                            return (
                                <div key={tailor.id} className="bg-white rounded-2xl shadow-lg border border-gray-100 flex flex-col hover:border-brand-500 transition-all group overflow-hidden relative">
                                    <div className={`p-1.5 text-center text-[10px] font-black uppercase tracking-widest ${lateTasks > 0 ? 'bg-red-600 text-white' : 'bg-brand-900 text-brand-100'}`}>
                                        {lateTasks > 0 ? `${lateTasks} Retards Critiques` : piecesPending > 0 ? 'En Production' : 'Disponible'}
                                    </div>
                                    <div className="p-6 flex-1 flex flex-col">
                                        <div className="flex items-center gap-4 mb-6">
                                            <div className="w-16 h-16 rounded-2xl bg-brand-50 text-brand-900 border border-brand-200 flex items-center justify-center font-black text-2xl group-hover:bg-brand-900 group-hover:text-white transition-colors shadow-sm">{tailor.nom.charAt(0)}</div>
                                            <div><h3 className="font-black text-gray-800 text-lg leading-tight uppercase tracking-tighter">{tailor.nom}</h3><p className="text-[10px] text-brand-600 font-black uppercase tracking-widest mt-1 opacity-70">{tailor.role}</p></div>
                                        </div>
                                        <div className="grid grid-cols-2 gap-3 mb-6">
                                            <div className="bg-orange-50 border border-orange-100 p-3 rounded-xl text-center"><p className="text-[9px] font-black text-orange-400 uppercase mb-1">À Faire</p><p className="text-xl font-black text-orange-700">{piecesPending}</p></div>
                                            <div className="bg-green-50 border border-green-100 p-3 rounded-xl text-center"><p className="text-[9px] font-black text-green-400 uppercase mb-1">Terminé</p><p className="text-xl font-black text-green-700">{piecesDone}</p></div>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}

                {/* 5. PERFORMANCE */}
                {viewMode === 'PERFORMANCE' && (
                    <div className="bg-white border rounded-xl p-8 shadow-sm h-full overflow-y-auto animate-in zoom-in duration-300">
                        <div className="max-w-2xl mx-auto">
                            <h3 className="text-2xl font-black mb-10 flex items-center gap-3 uppercase tracking-tighter text-gray-800"><Trophy className="text-yellow-500" size={32}/> Classement de l'Atelier</h3>
                            <div className="space-y-10">
                                {tailleurs.map((tailor, i) => {
                                    const done = (commandes.flatMap(o => o.taches || [])).filter(t => t.tailleurId === tailor.id && t.statut === 'FAIT').reduce((acc, t) => acc + t.quantite, 0);
                                    return (
                                        <div key={tailor.id} className="flex items-center gap-6 group">
                                            <div className={`w-14 h-14 flex items-center justify-center rounded-2xl font-black text-xl shadow-lg transition-transform group-hover:scale-110 ${i === 0 ? 'bg-yellow-100 text-yellow-700 ring-4 ring-yellow-50' : i === 1 ? 'bg-gray-100 text-gray-500' : 'bg-gray-50 text-gray-300'}`}>#{i+1}</div>
                                            <div className="flex-1">
                                                <div className="flex justify-between items-center text-sm mb-3">
                                                    <span className="font-black text-gray-800 text-lg uppercase tracking-tight">{tailor.nom}</span>
                                                    <span className="bg-green-50 text-green-700 px-3 py-1 rounded-full font-black ring-1 ring-green-100 uppercase text-[10px]">{done} PIÈCES TERMINÉES</span>
                                                </div>
                                                <div className="w-full bg-gray-100 h-5 rounded-xl overflow-hidden shadow-inner border border-gray-200">
                                                    <div className="bg-gradient-to-r from-brand-500 to-brand-700 h-full transition-all duration-1000 ease-out shadow-lg" style={{width: `${Math.min(100, done * 3)}%`}}></div>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* MODAL NOUVELLE TACHE (AVEC GESTION RELIQUAT) */}
            {taskModalOpen && (
                <div className="fixed inset-0 bg-black/70 z-[170] flex items-center justify-center p-4 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-8 animate-in zoom-in duration-200 border border-gray-200">
                        <div className="flex justify-between items-center mb-6 border-b pb-4"><h3 className="font-black text-gray-800 flex items-center gap-2 uppercase tracking-tighter"><UserPlus size={22} className="text-brand-600"/> Nouvelle Tâche</h3><button onClick={() => setTaskModalOpen(false)}><X size={24}/></button></div>
                        <div className="space-y-6">
                            <div><label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Commande Client</label><select className="w-full p-3 border-2 border-gray-100 rounded-xl text-sm font-bold bg-gray-50 outline-none" value={newTaskData.orderId} onChange={e => setNewTaskData({...newTaskData, orderId: e.target.value})}><option value="">-- Sélectionner --</option>{commandes.filter(c => !c.archived && c.statut !== StatutCommande.LIVRE).map(c => <option key={c.id} value={c.id}>{c.clientNom} (#{c.id.slice(-6)})</option>)}</select></div>
                            <div><label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Étape de Production</label><select className="w-full p-3 border-2 border-brand-100 rounded-xl text-sm font-bold bg-brand-50 text-brand-700 outline-none" value={newTaskData.action} onChange={e => setNewTaskData({...newTaskData, action: e.target.value as any})}><option value="COUPE">Coupe</option><option value="COUTURE">Couture / Montage</option><option value="FINITION">Finition</option><option value="REPASSAGE">Repassage / Prêt</option></select></div>
                            
                            {/* INDICATEUR DE RELIQUAT */}
                            {newTaskData.orderId && (
                                <div className="bg-gray-50 p-3 rounded-xl border border-gray-200">
                                    <div className="flex justify-between text-[10px] font-black uppercase mb-1.5"><span className="text-gray-500">Statut Étape :</span><span className={availability.remaining > 0 ? 'text-green-600' : 'text-red-600'}>{availability.assigned} / {availability.total} assignés</span></div>
                                    <div className="w-full h-1.5 bg-gray-200 rounded-full overflow-hidden shadow-inner"><div className="bg-brand-600 h-full transition-all" style={{ width: `${(availability.assigned / availability.total) * 100}%` }}></div></div>
                                    {availability.remaining > 0 ? (<p className="text-[9px] text-gray-400 mt-2 font-bold italic">Reliquat disponible : {availability.remaining} pièces</p>) : (<p className="text-[9px] text-red-600 mt-2 font-black flex items-center gap-1"><AlertTriangle size={10}/> Toutes les pièces sont déjà assignées !</p>)}
                                </div>
                            )}

                            <div><label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Nombre de Pièces</label><input type="number" min="1" max={availability.remaining} disabled={availability.remaining === 0} className="w-full p-3 border-2 border-gray-100 rounded-xl text-lg font-black bg-gray-50 outline-none focus:border-brand-500 disabled:opacity-50" value={newTaskData.quantite} onChange={e => setNewTaskData({...newTaskData, quantite: Math.min(availability.remaining, parseInt(e.target.value)||0)})}/></div>
                            <div><label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Artisan Artisan</label><select className="w-full p-3 border-2 border-gray-100 rounded-xl text-sm font-bold bg-gray-50 outline-none focus:border-brand-500" value={newTaskData.tailleurId} onChange={e => setNewTaskData({...newTaskData, tailleurId: e.target.value})}><option value="">-- Choisir Artisan --</option>{tailleurs.map(t => <option key={t.id} value={t.id}>{t.nom}</option>)}</select></div>
                        </div>
                        <div className="flex justify-end gap-3 mt-10"><button onClick={() => setTaskModalOpen(false)} className="px-6 py-3 text-gray-500 font-bold uppercase text-[10px] tracking-widest">Annuler</button><button disabled={!newTaskData.tailleurId || newTaskData.quantite <= 0} onClick={() => {
                            const order = commandes.find(c => c.id === newTaskData.orderId);
                            if (order && newTaskData.tailleurId) {
                                const newTask: TacheProduction = { id: `T_${Date.now()}`, commandeId: order.id, action: newTaskData.action, quantite: newTaskData.quantite, tailleurId: newTaskData.tailleurId, date: new Date().toISOString().split('T')[0], statut: 'A_FAIRE' };
                                onUpdateOrder({ ...order, taches: [...(order.taches || []), newTask] });
                                setTaskModalOpen(false);
                            }
                        }} className="px-8 py-3 bg-brand-600 text-white rounded-xl font-black uppercase text-[10px] tracking-widest shadow-lg shadow-brand-100 hover:bg-brand-700 transition-all disabled:opacity-50">Confirmer Assignation</button></div>
                    </div>
                </div>
            )}

            {/* MODALS REUTILISÉS (ORDEURS, KANBAN, ETC.) */}
            {orderModalOpen && (
                <div className="fixed inset-0 bg-black/70 z-[160] flex items-center justify-center p-4 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md animate-in zoom-in duration-200 flex flex-col max-h-[90vh]">
                        <div className="p-5 border-b bg-gray-50 flex justify-between items-center shrink-0"><h3 className="font-black text-gray-800 flex items-center gap-2 uppercase tracking-tighter"><Plus size={20} className="text-brand-600"/> Nouvelle Production</h3><button onClick={() => setOrderModalOpen(false)}><X size={20}/></button></div>
                        <div className="p-8 overflow-y-auto flex-1 space-y-6">
                            <div><label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-2">Client</label><select className="w-full p-3 border-2 border-gray-100 rounded-xl text-sm font-bold bg-gray-50" value={newOrderData.clientId} onChange={e => setNewOrderData({...newOrderData, clientId: e.target.value})}><option value="">-- Sélectionner --</option>{clients.map(c => <option key={c.id} value={c.id}>{c.nom}</option>)}</select></div>
                            <div><label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-2">Description</label><input type="text" className="w-full p-3 border-2 border-gray-100 rounded-xl text-sm font-bold bg-gray-50" value={newOrderData.description} onChange={e => setNewOrderData({...newOrderData, description: e.target.value})} placeholder="Ex: Ensemble Bazin 3 pièces" /></div>
                            <div className="bg-brand-50 p-5 rounded-2xl border-2 border-brand-100"><label className="block text-[10px] font-black text-brand-700 uppercase tracking-widest mb-3">Articles</label><div className="flex gap-2 mb-4"><input type="text" placeholder="Désignation..." className="flex-1 p-2.5 text-xs border rounded-lg" value={tempElement.nom} onChange={e => setTempElement({...tempElement, nom: e.target.value})} /><input type="number" className="w-16 p-2.5 text-xs border rounded-lg text-center" value={tempElement.quantite} onChange={e => setTempElement({...tempElement, quantite: parseInt(e.target.value)||1})} /><button onClick={() => { if(tempElement.nom) { setNewOrderData({...newOrderData, elements: [...(newOrderData.elements||[]), {...tempElement}]}); setTempElement({nom:'', quantite:1}); } }} className="bg-gray-800 text-white p-2.5 rounded-lg"><Plus size={18}/></button></div><div className="space-y-1.5">{newOrderData.elements?.map((el, idx) => (<div key={idx} className="flex justify-between items-center bg-white p-2 border rounded-lg text-[11px] font-bold"><span>{el.nom} x{el.quantite}</span><button onClick={() => setNewOrderData({...newOrderData, elements: newOrderData.elements?.filter((_, i) => i !== idx)})} className="text-red-500"><Trash2 size={14}/></button></div>))}</div></div>
                            <div className="grid grid-cols-2 gap-6"><div><label className="block text-[10px] font-black text-gray-500 uppercase mb-2">Prix Total</label><input type="number" className="w-full p-3 border-2 border-gray-100 rounded-xl text-lg font-black text-brand-700 bg-gray-50" value={newOrderData.prixTotal || ''} onChange={e => setNewOrderData({...newOrderData, prixTotal: parseInt(e.target.value)||0})}/></div><div><label className="block text-[10px] font-black text-gray-500 uppercase mb-2">Avance</label><input type="number" className="w-full p-3 border-2 border-green-100 rounded-xl text-lg font-black text-green-700 bg-green-50" value={newOrderData.avance || ''} onChange={e => setNewOrderData({...newOrderData, avance: parseInt(e.target.value)||0})}/></div></div>
                            <div className="grid grid-cols-2 gap-6"><div><label className="block text-[10px] font-black text-gray-500 uppercase mb-2">Échéance</label><input type="date" className="w-full p-3 border-2 border-gray-100 rounded-xl text-sm font-bold bg-gray-50" value={newOrderData.dateLivraisonPrevue} onChange={e => setNewOrderData({...newOrderData, dateLivraisonPrevue: e.target.value})}/></div><div><label className="block text-[10px] font-black text-gray-500 uppercase mb-2">Compte</label><select className="w-full p-3 border-2 border-blue-100 rounded-xl text-sm font-bold bg-blue-50" value={payAccount} onChange={e => setPayAccount(e.target.value)}><option value="">-- Choisir --</option>{comptes.map(c => <option key={c.id} value={c.id}>{c.nom}</option>)}</select></div></div>
                        </div>
                        <div className="p-6 bg-gray-50 border-t flex justify-end gap-4 rounded-b-2xl shrink-0"><button onClick={() => setOrderModalOpen(false)} className="px-6 py-3 text-gray-500 font-black uppercase text-[10px] tracking-widest hover:bg-gray-200 rounded-xl">Annuler</button><button onClick={handleSaveQuickOrder} className="px-10 py-3 bg-brand-600 text-white rounded-xl font-black uppercase text-[10px] tracking-widest shadow-xl">Enregistrer</button></div>
                    </div>
                </div>
            )}

            {isScannerOpen && <QRScannerModal isOpen={isScannerOpen} onClose={() => setIsScannerOpen(false)} onScan={(text) => { const emp = employes.find(e => e.id === text.trim()); if (emp) { setSearchTerm(emp.nom); setViewMode('PLANNING'); } setIsScannerOpen(false); }} />}
        </div>
    );
};

export default ProductionView;