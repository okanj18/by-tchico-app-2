import React, { useState, useMemo } from 'react';
import { Commande, Employe, Client, Article, StatutCommande, RoleEmploye, ModePaiement, CompteFinancier, CompanyAssets, TacheProduction, ActionProduction, ElementCommande } from '../types';
import { Scissors, LayoutList, Users, History, Search, Camera, X, Activity, Clock, Shirt, Calendar, CheckCircle, Zap, Columns, Trophy, Wallet, Printer, Eye, UserPlus, Plus, Save, Truck, ArrowRightLeft, DollarSign, Trash2, AlertTriangle, ChevronLeft, ChevronRight, Archive, ClipboardList } from 'lucide-react';
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
            const isCompleted = c.statut === StatutCommande.LIVRE || c.statut === StatutCommande.ANNULE || c.archived;
            
            if (viewMode === 'HISTORY') {
                if (!isCompleted && !c.archived && historyFilterStatus === 'ALL') return false;
                if (historyFilterStatus !== 'ALL' && c.statut !== historyFilterStatus) return false;
            } else if (viewMode !== 'PERFORMANCE' && viewMode !== 'PLANNING') {
                if (isCompleted) return false;
            }

            return c.clientNom.toLowerCase().includes(searchTerm.toLowerCase()) || c.id.toLowerCase().includes(searchTerm.toLowerCase());
        }).sort((a, b) => new Date(b.dateCommande).getTime() - new Date(a.dateCommande).getTime());
    }, [commandes, searchTerm, viewMode, historyFilterStatus]);

    // --- LOGIQUE DE SYNCHRONISATION AGENDA -> KANBAN ---

    const handleTaskStatusChange = (order: Commande, task: TacheProduction, newStatut: 'A_FAIRE' | 'FAIT') => {
        const updatedTaches = (order.taches || []).map(t => t.id === task.id ? { ...t, statut: newStatut } : t);
        let newRepartition = { ...(order.repartitionStatuts || { [StatutCommande.EN_ATTENTE]: order.quantite }) };
        
        if (newStatut === 'FAIT') {
            // Le principe : Une action terminée fait passer les pièces au statut suivant dans KANBAN_STATUS_ORDER
            // On identifie le statut source associé à l'action
            const actionToStatus: Record<string, StatutCommande> = {
                'COUPE': StatutCommande.EN_COUPE,
                'COUTURE': StatutCommande.COUTURE,
                'FINITION': StatutCommande.FINITION,
                'REPASSAGE': StatutCommande.FINITION // Repassage fait partie de la finition
            };

            const sourceStatus = actionToStatus[task.action];
            if (sourceStatus) {
                const currentIdx = KANBAN_STATUS_ORDER.indexOf(sourceStatus);
                const targetStatus = KANBAN_STATUS_ORDER[currentIdx + 1] || StatutCommande.PRET;
                
                const availableInSource = newRepartition[sourceStatus] || 0;
                const qtyToMove = Math.min(task.quantite, availableInSource);
                
                if (qtyToMove > 0) {
                    newRepartition[sourceStatus] -= qtyToMove;
                    if (newRepartition[sourceStatus] <= 0) delete newRepartition[sourceStatus];
                    newRepartition[targetStatus] = (newRepartition[targetStatus] || 0) + qtyToMove;
                }
            }
        }

        // Recalculer le statut global de la commande (le plus avancé avec des pièces)
        let mostAdvanced = StatutCommande.EN_ATTENTE;
        KANBAN_STATUS_ORDER.forEach(s => { if ((newRepartition[s] || 0) > 0) mostAdvanced = s as StatutCommande; });
        if ((newRepartition[StatutCommande.LIVRE] || 0) > 0 && Object.keys(newRepartition).length === 1) mostAdvanced = StatutCommande.LIVRE;

        onUpdateOrder({ ...order, taches: updatedTaches, repartitionStatuts: newRepartition, statut: mostAdvanced });
    };

    // --- LOGIQUE DE SYNCHRONISATION KANBAN -> AGENDA ---

    const handleDrop = (orderId: string, fromStatus: string, toStatus: StatutCommande) => {
        if (fromStatus === toStatus) return;
        const order = commandes.find(c => c.id === orderId);
        if (!order) return;
        
        // On récupère la quantité présente dans la colonne source
        const currentQty = order.repartitionStatuts ? (order.repartitionStatuts[fromStatus] || 0) : (order.statut === fromStatus ? order.quantite : 0);
        if (currentQty <= 0) return;

        setKanbanMoveModal({ 
            order, 
            fromStatus: fromStatus as StatutCommande, 
            toStatus, 
            maxQty: currentQty, 
            qty: currentQty, 
            assignTailorId: '' 
        });
    };

    const executeKanbanMove = () => {
        if (!kanbanMoveModal) return;
        const { order, fromStatus, toStatus, qty, assignTailorId } = kanbanMoveModal;
        const newRepartition = { ...(order.repartitionStatuts || { [order.statut]: order.quantite }) };
        
        // Soustraire de la source, ajouter à la destination
        newRepartition[fromStatus] = (newRepartition[fromStatus] || 0) - qty;
        if (newRepartition[fromStatus] <= 0) delete newRepartition[fromStatus];
        newRepartition[toStatus] = (newRepartition[toStatus] || 0) + qty;

        // Statut global : Le plus avancé dans le flux KANBAN_STATUS_ORDER qui a au moins 1 pièce
        let mostAdvanced = StatutCommande.EN_ATTENTE;
        KANBAN_STATUS_ORDER.forEach(s => { if ((newRepartition[s] || 0) > 0) mostAdvanced = s as StatutCommande; });

        let updatedTaches = [...(order.taches || [])];
        if (assignTailorId) {
            // Associer une action selon la colonne cible
            let action: ActionProduction = 'COUTURE';
            if (toStatus === StatutCommande.EN_COUPE) action = 'COUPE';
            else if (toStatus === StatutCommande.FINITION) action = 'FINITION';
            else if (toStatus === StatutCommande.PRET) action = 'REPASSAGE';

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

    const handleSaveQuickOrder = () => {
        const totalQty = (newOrderData.elements || []).reduce((acc, el) => acc + el.quantite, 0);
        if (!newOrderData.clientId || totalQty <= 0 || !newOrderData.prixTotal || !payAccount) {
            alert("Veuillez remplir : client, articles, prix total et choisir une caisse.");
            return;
        }
        const client = clients.find(c => c.id === newOrderData.clientId);
        const order: Commande = {
            id: `CMD_PRD_${Date.now()}`,
            clientId: newOrderData.clientId!,
            clientNom: client?.nom || 'Inconnu',
            description: newOrderData.description || 'Production sur mesure',
            dateCommande: new Date().toISOString().split('T')[0],
            dateLivraisonPrevue: newOrderData.dateLivraisonPrevue || '',
            statut: StatutCommande.EN_ATTENTE,
            tailleursIds: [],
            prixTotal: newOrderData.prixTotal!,
            avance: newOrderData.avance || 0,
            reste: Math.max(0, newOrderData.prixTotal! - (newOrderData.avance || 0)),
            type: 'SUR_MESURE',
            quantite: totalQty,
            elements: newOrderData.elements,
            repartitionStatuts: { [StatutCommande.EN_ATTENTE]: totalQty },
            taches: []
        };
        onCreateOrder(order, [], 'ESPECE', payAccount);
        setOrderModalOpen(false);
        setNewOrderData({ clientId: '', description: '', prixTotal: 0, avance: 0, elements: [] });
    };

    const handleConfirmPayment = () => {
        if (!selectedOrderForPayment || payAmount <= 0) return;
        if (!payAccount) { alert("Veuillez sélectionner un compte."); return; }
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
            {/* NAVIGATION HEADER */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 shrink-0">
                <div className="flex items-center gap-3">
                    <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2"><Scissors className="text-brand-600"/> Atelier Production</h2>
                    <button onClick={() => setOrderModalOpen(true)} className="bg-brand-600 text-white px-3 py-2 rounded-lg flex items-center gap-2 text-xs font-bold hover:bg-brand-700 shadow-md"><Plus size={14}/> Nouvelle Commande</button>
                </div>
                <div className="flex flex-wrap bg-white border p-1 rounded-lg shadow-sm">
                    {[
                        {id: 'PLANNING', label: 'Agenda', icon: Calendar},
                        {id: 'KANBAN', label: 'Kanban', icon: Columns},
                        {id: 'ORDERS', label: 'Liste Active', icon: LayoutList},
                        {id: 'TAILORS', label: 'Tailleurs', icon: Users},
                        {id: 'PERFORMANCE', label: 'Performance', icon: Trophy},
                        {id: 'HISTORY', label: 'Historique', icon: History}
                    ].map((mode) => (
                        <button key={mode.id} onClick={() => setViewMode(mode.id as any)} className={`px-3 py-1.5 text-xs font-bold rounded flex items-center gap-1 transition-colors ${viewMode === mode.id ? 'bg-brand-50 text-brand-700' : 'text-gray-500 hover:bg-gray-50'}`}>
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
                                <div className="bg-red-100 text-red-700 px-4 py-1.5 rounded-full text-xs font-bold flex items-center gap-2 animate-pulse">
                                    <AlertTriangle size={14}/> {getOverdueCount()} tâches en retard critique !
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
                                            <td className="p-3 border-r bg-gray-50 font-bold text-xs sticky left-0 z-10">{tailor.nom}</td>
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
                                                                const isTodayUndone = t.statut === 'A_FAIRE' && t.date === todayStr;
                                                                return (
                                                                    <div key={t.id} onClick={(e) => { e.stopPropagation(); handleTaskStatusChange(t.order, t, t.statut === 'A_FAIRE' ? 'FAIT' : 'A_FAIRE'); }}
                                                                        className={`p-1.5 rounded text-[9px] border shadow-sm transition-all hover:scale-105 ${
                                                                            t.statut === 'FAIT' ? 'bg-green-100 text-green-800 border-green-200 opacity-60' :
                                                                            isLate ? 'bg-red-500 text-white border-red-600 font-bold' :
                                                                            isTodayUndone ? 'bg-orange-100 text-orange-800 border-orange-300 border-l-4 border-l-orange-600' :
                                                                            'bg-white text-brand-800 border-brand-200'
                                                                        }`}>
                                                                        <div className="flex justify-between items-center font-bold">
                                                                            <span className="truncate">{t.action} x{t.quantite}</span>
                                                                            {t.statut === 'FAIT' ? <CheckCircle size={10} /> : isLate ? <AlertTriangle size={10}/> : isTodayUndone ? <Clock size={10}/> : null}
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

                {/* 2. KANBAN (Flux de pièces) */}
                {viewMode === 'KANBAN' && (
                    <div className="flex gap-4 h-full overflow-x-auto pb-4 custom-scrollbar">
                        {KANBAN_STATUS_ORDER.map((status) => (
                            <div key={status} className="flex-1 min-w-[280px] bg-gray-100/50 rounded-xl flex flex-col border border-gray-200" onDragOver={e => e.preventDefault()} onDrop={(e) => {
                                try {
                                    const data = JSON.parse(e.dataTransfer.getData('orderMove'));
                                    handleDrop(data.id, data.from, status as StatutCommande);
                                } catch(e) {}
                            }}>
                                <div className="p-3 border-b flex justify-between items-center bg-white rounded-t-xl">
                                    <h3 className="text-sm font-bold text-gray-700">{status}</h3>
                                    <span className="bg-gray-200 text-gray-700 text-[10px] px-2 py-0.5 rounded-full font-bold">{filteredCommandes.reduce((acc, c) => acc + (c.repartitionStatuts?.[status] || (c.statut === status ? c.quantite : 0)), 0)}</span>
                                </div>
                                <div className="flex-1 overflow-y-auto p-2 space-y-3">
                                    {filteredCommandes.filter(c => (c.repartitionStatuts?.[status] || 0) > 0 || (!c.repartitionStatuts && c.statut === status)).map(order => {
                                        const repartition = order.repartitionStatuts || { [order.statut]: order.quantite };
                                        const qtyInColumn = repartition[status] || 0;
                                        return (
                                            <div key={order.id} draggable onDragStart={(e) => e.dataTransfer.setData('orderMove', JSON.stringify({id: order.id, from: status}))} className="bg-white p-3 rounded-lg shadow-sm border border-gray-200 cursor-grab hover:border-brand-300 transition-shadow">
                                                <div className="flex justify-between items-start mb-1 text-[10px] font-mono text-gray-400"><span>#{order.id.slice(-6)}</span><span className="bg-brand-50 text-brand-700 px-1.5 rounded font-bold">Qté: {qtyInColumn}</span></div>
                                                <p className="font-bold text-gray-800 text-sm mb-1">{order.clientNom}</p>
                                                <p className="text-[10px] text-gray-500 italic line-clamp-1 border-l pl-2">{order.description}</p>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {/* 3. LISTE ACTIVE ET HISTORIQUE */}
                {(viewMode === 'ORDERS' || viewMode === 'HISTORY') && (
                    <div className="bg-white border rounded-xl overflow-hidden shadow-sm h-full flex flex-col">
                        <div className="p-3 bg-gray-50 border-b flex items-center justify-between shrink-0">
                            <div className="relative w-64"><Search className="absolute left-2 top-2 text-gray-400" size={14}/><input type="text" placeholder="Rechercher..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full pl-8 pr-3 py-1.5 border rounded-lg text-xs bg-white focus:ring-2 focus:ring-brand-500"/></div>
                            {viewMode === 'HISTORY' && (
                                <select className="text-xs p-1.5 border rounded-lg bg-white font-bold" value={historyFilterStatus} onChange={e => setHistoryFilterStatus(e.target.value)}>
                                    <option value="ALL">Tout l'historique archivé</option>
                                    <option value={StatutCommande.LIVRE}>Livrés</option>
                                    <option value={StatutCommande.ANNULE}>Annulés</option>
                                </select>
                            )}
                        </div>
                        <div className="flex-1 overflow-auto">
                            <table className="w-full text-sm text-left border-collapse">
                                <thead className="bg-white text-gray-500 font-bold border-b sticky top-0 z-10 uppercase text-[10px] tracking-widest">
                                    <tr>
                                        <th className="p-3">Client / Commande</th>
                                        <th className="p-3 text-right">Reste</th>
                                        <th className="p-3">Flux Production</th>
                                        <th className="p-3 text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {filteredCommandes.map(order => (
                                        <tr key={order.id} className={`hover:bg-gray-50 transition-colors ${order.archived ? 'opacity-60 bg-gray-50' : ''}`}>
                                            <td className="p-3">
                                                <div className="font-bold text-gray-800">{order.clientNom}</div>
                                                <div className="text-[10px] text-gray-400 mt-0.5">#{order.id.slice(-6)} • {order.description}</div>
                                                <div className="text-[10px] text-orange-600 font-bold mt-1">Livraison: {new Date(order.dateLivraisonPrevue).toLocaleDateString()}</div>
                                            </td>
                                            <td className={`p-3 text-right font-bold ${order.reste > 0 ? 'text-red-600' : 'text-green-600'}`}>{order.reste.toLocaleString()} F</td>
                                            <td className="p-3">
                                                <div className="flex flex-wrap gap-1">
                                                    {KANBAN_STATUS_ORDER.map(s => (order.repartitionStatuts?.[s] || 0) > 0 && (
                                                        <span key={s} className="px-1.5 py-0.5 bg-brand-50 text-brand-700 rounded text-[9px] font-bold border border-brand-100">{s}({order.repartitionStatuts![s]})</span>
                                                    ))}
                                                    {(order.repartitionStatuts?.[StatutCommande.LIVRE] || 0) > 0 && (
                                                        <span className="px-1.5 py-0.5 bg-green-50 text-green-700 rounded text-[9px] font-bold border border-green-200">LIVRÉ({order.repartitionStatuts![StatutCommande.LIVRE]})</span>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="p-3 text-right">
                                                <div className="flex justify-end gap-1">
                                                    {(order.repartitionStatuts?.[StatutCommande.PRET] || 0) > 0 && (
                                                        <button onClick={() => setDeliveryModal({ order, maxQty: order.repartitionStatuts![StatutCommande.PRET], qty: order.repartitionStatuts![StatutCommande.PRET] })} className="px-2 py-1 text-green-600 bg-green-50 border border-green-200 hover:bg-green-100 rounded text-[10px] font-bold flex items-center gap-1 shadow-sm transition-transform active:scale-95"><Truck size={14}/> LIVRER</button>
                                                    )}
                                                    {order.reste > 0 && !order.archived && <button onClick={() => {setSelectedOrderForPayment(order); setPayAmount(order.reste); setPaymentModalOpen(true);}} className="p-1.5 text-orange-600 hover:bg-orange-50 rounded-lg transition-all" title="Encaisser"><DollarSign size={18}/></button>}
                                                    <button onClick={() => alert(`Acomptes:\n${order.paiements?.map(p => `- ${new Date(p.date).toLocaleDateString()} : ${p.montant} F`).join('\n') || 'Aucun versement.'}`)} className="p-1.5 text-blue-500 hover:bg-blue-50 rounded-lg transition-all" title="Historique règlements"><Eye size={18}/></button>
                                                    {!order.archived && (order.statut === StatutCommande.LIVRE || order.statut === StatutCommande.ANNULE) && (
                                                        <button onClick={() => onArchiveOrder(order.id)} className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-all" title="Archiver la commande"><Archive size={18}/></button>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {/* 4. PERFORMANCE / TOP ARTISANS */}
                {viewMode === 'PERFORMANCE' && (
                    <div className="bg-white border rounded-xl p-8 shadow-sm h-full overflow-y-auto animate-in zoom-in duration-300">
                        <div className="max-w-2xl mx-auto">
                            <h3 className="text-xl font-bold mb-8 flex items-center gap-3"><Trophy className="text-yellow-500" size={24}/> Classement des Artisans</h3>
                            <div className="space-y-6">
                                {tailleurs.map((tailor, i) => {
                                    const done = (commandes.flatMap(o => o.taches || [])).filter(t => t.tailleurId === tailor.id && t.statut === 'FAIT').reduce((acc, t) => acc + t.quantite, 0);
                                    return (
                                        <div key={tailor.id} className="flex items-center gap-6 group">
                                            <div className={`w-10 h-10 flex items-center justify-center rounded-xl font-bold transition-transform group-hover:scale-110 ${i === 0 ? 'bg-yellow-100 text-yellow-700' : i === 1 ? 'bg-gray-100 text-gray-500' : 'bg-gray-50 text-gray-300'}`}>#{i+1}</div>
                                            <div className="flex-1">
                                                <div className="flex justify-between items-center text-sm mb-2">
                                                    <span className="font-bold text-gray-700">{tailor.nom}</span>
                                                    <span className="bg-brand-50 text-brand-700 px-2 py-0.5 rounded font-bold">{done} pièces terminées</span>
                                                </div>
                                                <div className="w-full bg-gray-100 h-3 rounded-full overflow-hidden shadow-inner">
                                                    <div className="bg-brand-500 h-full transition-all duration-1000 ease-out" style={{width: `${Math.min(100, done * 4)}%`}}></div>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                )}

                {/* 5. TAILLEURS (Cartes de charge) */}
                {viewMode === 'TAILORS' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 overflow-y-auto h-full p-2 animate-in fade-in duration-300">
                        {tailleurs.map(tailor => {
                            const activeTasks = (commandes.flatMap(o => o.taches || [])).filter(t => t.tailleurId === tailor.id && t.statut === 'A_FAIRE');
                            const volume = activeTasks.reduce((acc, t) => acc + t.quantite, 0);
                            return (
                                <div key={tailor.id} className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 flex flex-col hover:border-brand-400 hover:shadow-md transition-all group">
                                    <div className="flex items-center gap-4 mb-6">
                                        <div className="w-12 h-12 rounded-xl bg-brand-600 text-white flex items-center justify-center font-bold text-xl group-hover:rotate-6 transition-transform">{tailor.nom.charAt(0)}</div>
                                        <div><h3 className="font-bold text-gray-800 text-lg">{tailor.nom}</h3><p className="text-[10px] text-brand-600 font-bold uppercase tracking-tight">{tailor.role}</p></div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-4 mt-auto">
                                        <div className="p-2 bg-gray-50 rounded-lg text-center"><p className="text-[10px] font-bold text-gray-400 uppercase">Tâches</p><p className="text-lg font-bold text-gray-800">{activeTasks.length}</p></div>
                                        <div className="p-2 bg-brand-50 rounded-lg text-center"><p className="text-[10px] font-bold text-brand-600 uppercase">Pièces</p><p className="text-lg font-bold text-brand-700">{volume}</p></div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* MODALS RESTAURÉS */}
            
            {orderModalOpen && (
                <div className="fixed inset-0 bg-black/60 z-[160] flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-md animate-in zoom-in duration-200 flex flex-col max-h-[90vh]">
                        <div className="p-4 border-b bg-gray-50 flex justify-between items-center"><h3 className="font-bold text-gray-800 flex items-center gap-2 uppercase tracking-tighter"><Plus size={18} className="text-brand-600"/> Nouvelle Production</h3><button onClick={() => setOrderModalOpen(false)} className="hover:bg-gray-200 p-1 rounded-full"><X size={20}/></button></div>
                        <div className="p-6 overflow-y-auto flex-1 space-y-4">
                            <div><label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1">Client</label><select className="w-full p-2 border border-gray-300 rounded-lg text-sm font-bold bg-gray-50" value={newOrderData.clientId} onChange={e => setNewOrderData({...newOrderData, clientId: e.target.value})}><option value="">-- Sélectionner --</option>{clients.map(c => <option key={c.id} value={c.id}>{c.nom}</option>)}</select></div>
                            <div><label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1">Description (Projet)</label><input type="text" className="w-full p-2 border border-gray-300 rounded-lg text-sm" value={newOrderData.description} onChange={e => setNewOrderData({...newOrderData, description: e.target.value})} placeholder="Ex: Mariage Diop - 3 Tenues" /></div>
                            
                            <div className="bg-brand-50 p-4 rounded-xl border border-brand-100">
                                <label className="block text-[10px] font-bold text-brand-700 uppercase tracking-widest mb-2">Articles</label>
                                <div className="flex gap-2 mb-3">
                                    <input type="text" placeholder="Article..." className="flex-1 p-2 text-xs border rounded-lg" value={tempElement.nom} onChange={e => setTempElement({...tempElement, nom: e.target.value})} />
                                    <input type="number" className="w-16 p-2 text-xs border rounded-lg text-center" value={tempElement.quantite} onChange={e => setTempElement({...tempElement, quantite: parseInt(e.target.value)||1})} />
                                    <button onClick={() => { if(tempElement.nom) { setNewOrderData({...newOrderData, elements: [...(newOrderData.elements||[]), {...tempElement}]}); setTempElement({nom:'', quantite:1}); } }} className="bg-gray-800 text-white p-2 rounded-lg hover:bg-black transition-colors"><Plus size={16}/></button>
                                </div>
                                <div className="space-y-1.5">
                                    {newOrderData.elements?.map((el, idx) => (
                                        <div key={idx} className="flex justify-between items-center bg-white p-2 border rounded-lg text-xs font-bold shadow-sm"><span>{el.nom} x{el.quantite}</span><button onClick={() => setNewOrderData({...newOrderData, elements: newOrderData.elements?.filter((_, i) => i !== idx)})} className="text-red-500 hover:bg-red-50 p-1 rounded-md"><Trash2 size={14}/></button></div>
                                    ))}
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div><label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Prix Total (F)</label><input type="number" className="w-full p-2 border border-gray-300 rounded-lg text-sm font-bold text-brand-700" value={newOrderData.prixTotal || ''} onChange={e => setNewOrderData({...newOrderData, prixTotal: parseInt(e.target.value)||0})}/></div>
                                <div><label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Avance Reçue (F)</label><input type="number" className="w-full p-2 border border-green-300 rounded-lg text-sm font-bold text-green-700 bg-green-50" value={newOrderData.avance || ''} onChange={e => setNewOrderData({...newOrderData, avance: parseInt(e.target.value)||0})}/></div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div><label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Date Livraison</label><input type="date" className="w-full p-2 border border-gray-300 rounded-lg text-sm font-bold" value={newOrderData.dateLivraisonPrevue} onChange={e => setNewOrderData({...newOrderData, dateLivraisonPrevue: e.target.value})}/></div>
                                <div><label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Compte Caisse</label><select className="w-full p-2 border border-blue-300 rounded-lg text-sm bg-blue-50" value={payAccount} onChange={e => setPayAccount(e.target.value)}><option value="">-- Choisir --</option>{comptes.map(c => <option key={c.id} value={c.id}>{c.nom} ({c.solde.toLocaleString()} F)</option>)}</select></div>
                            </div>
                        </div>
                        <div className="p-4 bg-gray-50 border-t flex justify-end gap-3 rounded-b-xl shrink-0"><button onClick={() => setOrderModalOpen(false)} className="px-6 py-2 text-gray-500 font-bold uppercase text-xs">Annuler</button><button onClick={handleSaveQuickOrder} className="px-10 py-2 bg-brand-600 text-white rounded-lg font-bold shadow-lg shadow-brand-100 uppercase text-xs">Enregistrer</button></div>
                    </div>
                </div>
            )}

            {/* MODAL ASSIGNATION TAILLEUR (AGENDA) */}
            {taskModalOpen && (
                <div className="fixed inset-0 bg-black/60 z-[170] flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm p-8 animate-in zoom-in duration-200">
                        <div className="flex justify-between items-center mb-8 border-b pb-4"><h3 className="font-bold text-gray-800 flex items-center gap-2 uppercase tracking-tighter"><UserPlus size={22} className="text-brand-600"/> Nouvelle Tâche</h3><button onClick={() => setTaskModalOpen(false)}><X size={24}/></button></div>
                        <div className="space-y-5">
                            <div><label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Commande Client</label><select className="w-full p-2.5 border-2 border-gray-100 rounded-xl text-sm font-bold bg-gray-50" value={newTaskData.orderId} onChange={e => setNewTaskData({...newTaskData, orderId: e.target.value})}><option value="">-- Choisir Commande --</option>{commandes.filter(c => !c.archived && c.statut !== StatutCommande.LIVRE).map(c => <option key={c.id} value={c.id}>{c.clientNom} (#{c.id.slice(-6)})</option>)}</select></div>
                            <div><label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Action Requise</label><select className="w-full p-2.5 border-2 border-brand-100 rounded-xl text-sm font-bold bg-brand-50 text-brand-700" value={newTaskData.action} onChange={e => setNewTaskData({...newTaskData, action: e.target.value as any})}><option value="COUPE">Coupe (S-M-L)</option><option value="COUTURE">Couture / Montage</option><option value="FINITION">Finition / Broderie</option><option value="REPASSAGE">Repassage / Prêt</option></select></div>
                            <div><label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Nb Pièces</label><input type="number" className="w-full p-2.5 border-2 border-gray-100 rounded-xl text-lg font-black bg-gray-50" value={newTaskData.quantite} onChange={e => setNewTaskData({...newTaskData, quantite: parseInt(e.target.value)||1})}/></div>
                            <div><label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Artisan</label><select className="w-full p-2.5 border-2 border-gray-100 rounded-xl text-sm font-bold bg-gray-50" value={newTaskData.tailleurId} onChange={e => setNewTaskData({...newTaskData, tailleurId: e.target.value})}><option value="">-- Choisir Tailleur --</option>{tailleurs.map(t => <option key={t.id} value={t.id}>{t.nom}</option>)}</select></div>
                        </div>
                        <div className="flex justify-end gap-3 mt-10"><button onClick={() => setTaskModalOpen(false)} className="px-6 py-2 text-gray-500 font-bold uppercase text-xs">Annuler</button><button onClick={() => {
                            const order = commandes.find(c => c.id === newTaskData.orderId);
                            if (order && newTaskData.tailleurId) {
                                const newTask: TacheProduction = { id: `T_${Date.now()}`, commandeId: order.id, action: newTaskData.action, quantite: newTaskData.quantite, tailleurId: newTaskData.tailleurId, date: new Date().toISOString().split('T')[0], statut: 'A_FAIRE', note: newTaskData.note };
                                onUpdateOrder({ ...order, taches: [...(order.taches || []), newTask] });
                                setTaskModalOpen(false);
                            } else { alert("Données manquantes (Commande et Tailleur)."); }
                        }} className="px-8 py-3 bg-brand-600 text-white rounded-xl font-bold uppercase text-xs shadow-lg shadow-brand-100">Confirmer</button></div>
                    </div>
                </div>
            )}

            {/* MODAL DEPLACEMENT KANBAN */}
            {kanbanMoveModal && (
                <div className="fixed inset-0 bg-black/60 z-[180] flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm p-8 animate-in zoom-in duration-200 border-2 border-brand-500">
                        <h3 className="text-xl font-bold text-gray-800 mb-6 flex items-center gap-2 uppercase tracking-tighter"><ArrowRightLeft className="text-brand-600"/> Déplacer Flux</h3>
                        <div className="space-y-4">
                            <p className="text-xs text-gray-500 font-bold">Déplacer de <span className="text-gray-800">{kanbanMoveModal.fromStatus}</span> vers <span className="text-brand-600">{kanbanMoveModal.toStatus}</span>.</p>
                            <div><label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Nombre de pièces</label><input type="number" min="1" max={kanbanMoveModal.maxQty} className="w-full p-2.5 border-2 border-gray-100 rounded-xl text-lg font-black bg-gray-50" value={kanbanMoveModal.qty} onChange={e => setKanbanMoveModal({...kanbanMoveModal, qty: Math.min(kanbanMoveModal.maxQty, parseInt(e.target.value)||1)})}/></div>
                            <div className="bg-blue-50 p-4 rounded-xl border border-blue-100 mt-4">
                                <label className="block text-[10px] font-bold text-blue-600 uppercase mb-2 tracking-widest">Assigner l'étape ? (Optionnel)</label>
                                <select className="w-full p-2 border-2 border-blue-200 rounded-lg text-xs font-bold" value={kanbanMoveModal.assignTailorId} onChange={e => setKanbanMoveModal({...kanbanMoveModal, assignTailorId: e.target.value})}><option value="">-- Ne pas assigner --</option>{tailleurs.map(t => <option key={t.id} value={t.id}>{t.nom}</option>)}</select>
                            </div>
                        </div>
                        <div className="flex justify-end gap-3 mt-8"><button onClick={() => setKanbanMoveModal(null)} className="px-6 py-2 text-gray-500 font-bold uppercase text-xs">Annuler</button><button onClick={executeKanbanMove} className="px-8 py-3 bg-brand-600 text-white rounded-xl font-bold uppercase text-xs">Valider Flux</button></div>
                    </div>
                </div>
            )}

            {/* MODAL ENCAISSEMENT */}
            {paymentModalOpen && selectedOrderForPayment && (
                <div className="fixed inset-0 bg-black/60 z-[160] flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm p-8 animate-in zoom-in duration-200">
                        <div className="flex justify-between items-center mb-8"><h3 className="text-xl font-bold flex items-center gap-2 text-green-700 uppercase tracking-tighter"><Wallet size={24}/> Encaisser Reliquat</h3><button onClick={() => setPaymentModalOpen(false)}><X size={24}/></button></div>
                        <div className="space-y-6">
                            <div><label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Montant Reçu (Reste: {selectedOrderForPayment.reste} F)</label><input type="number" className="w-full p-4 border-2 border-gray-100 rounded-2xl font-black text-xl text-brand-700 bg-gray-50 outline-none" value={payAmount} onChange={e => setPayAmount(parseInt(e.target.value)||0)}/></div>
                            <div><label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Caisse de destination</label><select className="w-full p-3 border-2 border-blue-300 rounded-xl text-sm font-bold bg-blue-50 outline-none" value={payAccount} onChange={e => setPayAccount(e.target.value)}><option value="">-- Choisir Caisse --</option>{comptes.map(c => <option key={c.id} value={c.id}>{c.nom} ({c.solde.toLocaleString()} F)</option>)}</select></div>
                        </div>
                        <div className="flex justify-end gap-3 mt-10"><button onClick={() => setPaymentModalOpen(false)} className="px-6 py-2 text-gray-500 font-bold uppercase text-xs">Annuler</button><button onClick={handleConfirmPayment} disabled={!payAccount} className="px-10 py-3 bg-green-600 text-white rounded-xl font-bold uppercase text-xs shadow-lg shadow-green-100 disabled:opacity-50">Confirmer</button></div>
                    </div>
                </div>
            )}

            {/* MODAL LIVRAISON PARTIELLE */}
            {deliveryModal && (
                <div className="fixed inset-0 bg-black/60 z-[150] flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm animate-in zoom-in duration-200 p-8">
                        <div className="flex justify-between items-center mb-8"><h3 className="font-bold text-gray-800 flex items-center gap-2 uppercase tracking-tighter text-green-700"><Truck size={24}/> Livraison Client</h3><button onClick={() => setDeliveryModal(null)}><X size={24}/></button></div>
                        <p className="text-xs text-gray-500 mb-6 font-bold leading-relaxed uppercase tracking-tight">Combien de pièces sur les <strong className="text-gray-800">{deliveryModal.maxQty}</strong> prêtes souhaitez-vous livrer au client ?</p>
                        <div className="mb-6"><label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2 text-center">Quantité à livrer</label><input type="number" min="1" max={deliveryModal.maxQty} className="w-full p-4 border-2 border-green-300 rounded-2xl font-black text-3xl text-center bg-green-50 outline-none" value={deliveryModal.qty} onChange={e => setDeliveryModal({...deliveryModal, qty: Math.min(deliveryModal.maxQty, parseInt(e.target.value)||1)})}/></div>
                        <div className="flex justify-end gap-3"><button onClick={() => setDeliveryModal(null)} className="px-6 py-2 text-gray-500 font-bold uppercase text-xs">Annuler</button><button onClick={() => {
                            const { order, qty } = deliveryModal;
                            const newRep = { ...(order.repartitionStatuts || {}) };
                            newRep[StatutCommande.PRET] = (newRep[StatutCommande.PRET] || 0) - qty;
                            if (newRep[StatutCommande.PRET] <= 0) delete newRep[StatutCommande.PRET];
                            newRep[StatutCommande.LIVRE] = (newRep[StatutCommande.LIVRE] || 0) + qty;
                            
                            // Si toutes les pièces du total sont livrées
                            const piecesRestantes = Object.keys(newRep).filter(k => k !== StatutCommande.LIVRE).reduce((acc, k) => acc + (newRep[k] || 0), 0);
                            const fullyDelivered = piecesRestantes === 0;
                            
                            onUpdateOrder({ ...order, repartitionStatuts: newRep, statut: fullyDelivered ? StatutCommande.LIVRE : order.statut as StatutCommande });
                            setDeliveryModal(null);
                        }} className="px-8 py-3 bg-green-600 text-white rounded-xl font-bold uppercase text-xs shadow-lg shadow-green-100">Valider</button></div>
                    </div>
                </div>
            )}

            {isScannerOpen && <QRScannerModal isOpen={isScannerOpen} onClose={() => setIsScannerOpen(false)} onScan={(text) => { const emp = employes.find(e => e.id === text.trim()); if (emp) { setSearchTerm(emp.nom); setViewMode('PLANNING'); } setIsScannerOpen(false); }} />}
        </div>
    );
};

export default ProductionView;