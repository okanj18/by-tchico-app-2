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
                if (!isCompleted && historyFilterStatus === 'ALL') return false;
                if (historyFilterStatus !== 'ALL' && c.statut !== historyFilterStatus) return false;
            } else if (viewMode !== 'PERFORMANCE' && viewMode !== 'PLANNING') {
                if (isCompleted) return false;
            }

            return c.clientNom.toLowerCase().includes(searchTerm.toLowerCase()) || c.id.toLowerCase().includes(searchTerm.toLowerCase());
        }).sort((a, b) => new Date(b.dateCommande).getTime() - new Date(a.dateCommande).getTime());
    }, [commandes, searchTerm, viewMode, historyFilterStatus]);

    // --- LOGIQUE DE SYNCHRONISATION ---

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
            const action: ActionProduction = toStatus === StatutCommande.EN_COUPE ? 'COUPE' : toStatus === StatutCommande.COUTURE ? 'COUTURE' : 'FINITION';
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
            alert("Remplissez client, articles, prix et choisissez une caisse.");
            return;
        }
        const client = clients.find(c => c.id === newOrderData.clientId);
        const order: Commande = {
            id: `CMD_PRD_${Date.now()}`,
            clientId: newOrderData.clientId!,
            clientNom: client?.nom || 'Inconnu',
            description: newOrderData.description || 'Sans description',
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
        if (!payAccount) {
            alert("Veuillez sélectionner un compte de destination.");
            return;
        }
        onAddPayment(selectedOrderForPayment.id, payAmount, payMethod, "Règlement solde production", payDate, payAccount);
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
                {/* AGENDA AVEC ALERTES VISUELLES */}
                {viewMode === 'PLANNING' && (
                    <div className="bg-white border rounded-xl shadow-sm h-full flex flex-col overflow-hidden">
                        <div className="p-3 border-b bg-gray-50 flex justify-between items-center shrink-0">
                            <div className="flex gap-2">
                                <button onClick={() => { const d = new Date(agendaBaseDate); d.setDate(d.getDate()-7); setAgendaBaseDate(d); }} className="p-1.5 hover:bg-gray-200 rounded border"><ChevronLeft size={18}/></button>
                                <button onClick={() => { const d = new Date(agendaBaseDate); d.setDate(d.getDate()+7); setAgendaBaseDate(d); }} className="p-1.5 hover:bg-gray-200 rounded border"><ChevronRight size={18}/></button>
                                <span className="font-bold text-sm flex items-center px-4">Calendrier de Production</span>
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
                                        <th className="w-40 p-3 border-b border-r text-left text-[10px] font-bold text-gray-500 uppercase">Artisan</th>
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
                                                                            'bg-brand-50 text-brand-800 border-brand-200'
                                                                        }`}>
                                                                        <div className="flex justify-between items-center font-bold">
                                                                            <span className="truncate">{t.action} x{t.quantite}</span>
                                                                            {t.statut === 'FAIT' ? <CheckCircle size={10} /> : isLate ? <AlertTriangle size={10}/> : isTodayUndone ? <Clock size={10}/> : null}
                                                                        </div>
                                                                        <div className="truncate opacity-80 uppercase">{t.order.clientNom}</div>
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

                {/* KANBAN (Synchronisé) */}
                {viewMode === 'KANBAN' && (
                    <div className="flex gap-4 h-full overflow-x-auto pb-4 custom-scrollbar">
                        {KANBAN_STATUS_ORDER.map((status, index) => (
                            <div key={status} className="flex-1 min-w-[280px] bg-gray-100/50 rounded-xl flex flex-col border border-gray-200" onDragOver={e => e.preventDefault()} onDrop={(e) => {
                                const data = JSON.parse(e.dataTransfer.getData('orderMove'));
                                handleDrop(data.id, data.from, status as StatutCommande);
                            }}>
                                <div className="p-3 border-b flex justify-between items-center bg-white rounded-t-xl">
                                    <h3 className="text-sm font-bold text-gray-700">{status}</h3>
                                    <span className="bg-gray-200 text-gray-600 text-[10px] px-2 py-0.5 rounded-full font-bold">{filteredCommandes.reduce((acc, c) => acc + (c.repartitionStatuts?.[status] || (c.statut === status ? c.quantite : 0)), 0)}</span>
                                </div>
                                <div className="flex-1 overflow-y-auto p-2 space-y-3">
                                    {filteredCommandes.filter(c => (c.repartitionStatuts?.[status] || 0) > 0 || (!c.repartitionStatuts && c.statut === status)).map(order => {
                                        const repartition = order.repartitionStatuts || { [order.statut]: order.quantite };
                                        return (
                                            <div key={order.id} draggable onDragStart={(e) => e.dataTransfer.setData('orderMove', JSON.stringify({id: order.id, from: status}))} className="bg-white p-3 rounded-lg shadow-sm border border-gray-200 cursor-grab hover:border-brand-300">
                                                <div className="flex justify-between items-start mb-1 text-[10px] font-mono text-gray-400"><span>#{order.id.slice(-5)}</span><span className="bg-brand-50 text-brand-700 px-1.5 rounded font-bold">Qté: {repartition[status] || 0}</span></div>
                                                <p className="font-bold text-gray-800 text-sm mb-1">{order.clientNom}</p>
                                                <p className="text-[10px] text-gray-500 italic line-clamp-1">{order.description}</p>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {/* HISTORIQUE ET ACTIONS RESTAURÉES */}
                {(viewMode === 'ORDERS' || viewMode === 'HISTORY') && (
                    <div className="bg-white border rounded-xl overflow-hidden shadow-sm h-full flex flex-col">
                        <div className="p-3 bg-gray-50 border-b flex items-center justify-between">
                            <div className="relative w-64"><Search className="absolute left-2 top-2 text-gray-400" size={14}/><input type="text" placeholder="Rechercher..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full pl-8 pr-3 py-1.5 border rounded text-xs"/></div>
                            {viewMode === 'HISTORY' && (
                                <select className="text-xs p-1.5 border rounded" value={historyFilterStatus} onChange={e => setHistoryFilterStatus(e.target.value)}>
                                    <option value="ALL">Tout l'historique terminé</option>
                                    <option value={StatutCommande.LIVRE}>Livrés</option>
                                    <option value={StatutCommande.ANNULE}>Annulés</option>
                                </select>
                            )}
                        </div>
                        <table className="w-full text-sm text-left">
                            <thead className="bg-white text-gray-500 font-bold border-b sticky top-0 z-10 uppercase text-[10px]">
                                <tr>
                                    <th className="p-3">Client / Commande</th>
                                    <th className="p-3 text-right">Reste</th>
                                    <th className="p-3">Flux Production</th>
                                    <th className="p-3 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 overflow-y-auto">
                                {filteredCommandes.map(order => (
                                    <tr key={order.id} className={`hover:bg-gray-50 ${order.archived ? 'opacity-60 bg-gray-50' : ''}`}>
                                        <td className="p-3">
                                            <div className="font-bold text-gray-800">{order.clientNom}</div>
                                            <div className="text-[10px] text-gray-400">#{order.id.slice(-6)} • {order.description}</div>
                                            <div className="text-[10px] text-orange-600 font-bold">Livraison: {new Date(order.dateLivraisonPrevue).toLocaleDateString()}</div>
                                        </td>
                                        <td className={`p-3 text-right font-bold ${order.reste > 0 ? 'text-red-600' : 'text-green-600'}`}>{order.reste.toLocaleString()} F</td>
                                        <td className="p-3">
                                            <div className="flex flex-wrap gap-1">
                                                {KANBAN_STATUS_ORDER.map(s => (order.repartitionStatuts?.[s] || 0) > 0 && (
                                                    <span key={s} className="px-1.5 py-0.5 bg-brand-50 text-brand-700 rounded text-[9px] font-bold border border-brand-100">{s}({order.repartitionStatuts![s]})</span>
                                                ))}
                                                {order.statut === StatutCommande.LIVRE && <span className="px-1.5 py-0.5 bg-green-50 text-green-700 rounded text-[9px] font-bold">LIVRÉ</span>}
                                            </div>
                                        </td>
                                        <td className="p-3 text-right">
                                            <div className="flex justify-end gap-1">
                                                {(order.repartitionStatuts?.[StatutCommande.PRET] || 0) > 0 && (
                                                    <button onClick={() => setDeliveryModal({ order, maxQty: order.repartitionStatuts![StatutCommande.PRET], qty: order.repartitionStatuts![StatutCommande.PRET] })} className="px-2 py-1 text-green-600 bg-green-50 border border-green-200 hover:bg-green-100 rounded text-[10px] font-bold flex items-center gap-1 shadow-sm"><Truck size={14}/> LIVRER</button>
                                                )}
                                                {order.reste > 0 && !order.archived && <button onClick={() => {setSelectedOrderForPayment(order); setPayAmount(order.reste); setPaymentModalOpen(true);}} className="p-1.5 text-orange-600 hover:bg-orange-50 rounded" title="Encaisser"><DollarSign size={18}/></button>}
                                                <button onClick={() => { setNewTaskData({...newTaskData, orderId: order.id}); setTaskModalOpen(true); }} className="p-1.5 text-brand-600 hover:bg-brand-50 rounded" title="Assigner un tailleur"><UserPlus size={18}/></button>
                                                <button onClick={() => alert(`Acomptes:\n${order.paiements?.map(p => `- ${new Date(p.date).toLocaleDateString()} : ${p.montant} F`).join('\n') || 'Aucun.'}`)} className="p-1.5 text-blue-500 hover:bg-blue-50 rounded" title="Détails versements"><Eye size={18}/></button>
                                                {!order.archived && (order.statut === StatutCommande.LIVRE || order.statut === StatutCommande.ANNULE) && (
                                                    <button onClick={() => onArchiveOrder(order.id)} className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded" title="Archiver la commande"><Archive size={18}/></button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}

                {/* PERFORMANCE (Leaderboard) */}
                {viewMode === 'PERFORMANCE' && (
                    <div className="bg-white border rounded-xl p-8 shadow-sm h-full overflow-y-auto">
                        <h3 className="text-xl font-bold mb-8 flex items-center gap-3"><Trophy className="text-yellow-500" size={24}/> Performance des Artisans</h3>
                        <div className="space-y-6 max-w-2xl">
                            {tailleurs.map((tailor, i) => {
                                const done = (commandes.flatMap(o => o.taches || [])).filter(t => t.tailleurId === tailor.id && t.statut === 'FAIT').reduce((acc, t) => acc + t.quantite, 0);
                                return (
                                    <div key={tailor.id} className="flex items-center gap-6">
                                        <div className={`w-10 h-10 flex items-center justify-center rounded-full font-bold ${i === 0 ? 'bg-yellow-100 text-yellow-700' : 'bg-gray-100 text-gray-500'}`}>#{i+1}</div>
                                        <div className="flex-1">
                                            <div className="flex justify-between text-sm mb-2 font-bold text-gray-700"><span>{tailor.nom}</span><span className="bg-brand-50 text-brand-700 px-2 py-0.5 rounded">{done} pièces terminées</span></div>
                                            <div className="w-full bg-gray-100 h-3 rounded-full overflow-hidden shadow-inner"><div className="bg-brand-500 h-full transition-all duration-1000" style={{width: `${Math.min(100, done * 4)}%`}}></div></div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}

                {/* TAILLEURS (Cartes de charge) */}
                {viewMode === 'TAILORS' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 overflow-y-auto h-full p-1">
                        {tailleurs.map(tailor => {
                            const activeTasks = (commandes.flatMap(o => o.taches || [])).filter(t => t.tailleurId === tailor.id && t.statut === 'A_FAIRE');
                            return (
                                <div key={tailor.id} className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 flex flex-col hover:border-brand-300 transition-colors">
                                    <div className="flex items-center gap-4 mb-4">
                                        <div className="w-12 h-12 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center font-bold text-lg">{tailor.nom.charAt(0)}</div>
                                        <div><h3 className="font-bold text-gray-800">{tailor.nom}</h3><p className="text-[10px] text-gray-400 font-bold uppercase">{tailor.role}</p></div>
                                    </div>
                                    <div className="space-y-2 mt-auto">
                                        <div className="flex justify-between text-xs font-bold"><span className="text-gray-500">Tâches en cours</span><span className="text-brand-600">{activeTasks.length}</span></div>
                                        <div className="flex justify-between text-xs font-bold"><span className="text-gray-500">Volume pièces</span><span className="text-brand-600">{(Object.values(activeTasks) as any[]).reduce((acc, t) => acc + t.quantite, 0)}</span></div>
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
                        <div className="p-4 border-b bg-gray-50 flex justify-between items-center"><h3 className="font-bold text-gray-800 flex items-center gap-2"><Plus size={18} className="text-brand-600"/> Nouvelle Commande</h3><button onClick={() => setOrderModalOpen(false)}><X size={20}/></button></div>
                        <div className="p-6 overflow-y-auto flex-1 space-y-4">
                            <div><label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Client</label><select className="w-full p-2 border rounded-lg text-sm" value={newOrderData.clientId} onChange={e => setNewOrderData({...newOrderData, clientId: e.target.value})}><option value="">-- Sélectionner --</option>{clients.map(c => <option key={c.id} value={c.id}>{c.nom}</option>)}</select></div>
                            <div><label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Description (Opt.)</label><input type="text" className="w-full p-2 border rounded-lg text-sm" value={newOrderData.description} onChange={e => setNewOrderData({...newOrderData, description: e.target.value})} placeholder="Ex: Mariage Diop..." /></div>
                            
                            <div className="bg-gray-50 p-3 rounded-lg border border-gray-200">
                                <label className="block text-[10px] font-bold text-gray-400 uppercase mb-2">Articles</label>
                                <div className="flex gap-2 mb-2">
                                    <input type="text" placeholder="Article..." className="flex-1 p-2 text-xs border rounded" value={tempElement.nom} onChange={e => setTempElement({...tempElement, nom: e.target.value})} />
                                    <input type="number" className="w-16 p-2 text-xs border rounded" value={tempElement.quantite} onChange={e => setTempElement({...tempElement, quantite: parseInt(e.target.value)||1})} />
                                    <button onClick={() => { if(tempElement.nom) { setNewOrderData({...newOrderData, elements: [...(newOrderData.elements||[]), {...tempElement}]}); setTempElement({nom:'', quantite:1}); } }} className="bg-gray-800 text-white p-2 rounded hover:bg-black"><Plus size={16}/></button>
                                </div>
                                <div className="space-y-1">
                                    {newOrderData.elements?.map((el, idx) => (
                                        <div key={idx} className="flex justify-between items-center bg-white p-2 border rounded text-xs shadow-sm"><span>{el.nom} x{el.quantite}</span><button onClick={() => setNewOrderData({...newOrderData, elements: newOrderData.elements?.filter((_, i) => i !== idx)})} className="text-red-500"><Trash2 size={14}/></button></div>
                                    ))}
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div><label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Prix Total</label><input type="number" className="w-full p-2 border rounded-lg text-sm font-bold" value={newOrderData.prixTotal || ''} onChange={e => setNewOrderData({...newOrderData, prixTotal: parseInt(e.target.value)||0})}/></div>
                                <div><label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Avance</label><input type="number" className="w-full p-2 border rounded-lg text-sm font-bold bg-green-50" value={newOrderData.avance || ''} onChange={e => setNewOrderData({...newOrderData, avance: parseInt(e.target.value)||0})}/></div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div><label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Date Livraison</label><input type="date" className="w-full p-2 border rounded-lg text-sm" value={newOrderData.dateLivraisonPrevue} onChange={e => setNewOrderData({...newOrderData, dateLivraisonPrevue: e.target.value})}/></div>
                                <div><label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Caisse</label><select className="w-full p-2 border rounded-lg text-sm bg-blue-50" value={payAccount} onChange={e => setPayAccount(e.target.value)}><option value="">-- Choisir --</option>{comptes.map(c => <option key={c.id} value={c.id}>{c.nom}</option>)}</select></div>
                            </div>
                        </div>
                        <div className="p-4 bg-gray-50 border-t flex justify-end gap-3 rounded-b-xl"><button onClick={() => setOrderModalOpen(false)} className="px-4 py-2 text-gray-500 font-bold">Annuler</button><button onClick={handleSaveQuickOrder} className="px-6 py-2 bg-brand-600 text-white rounded-lg font-bold shadow-lg hover:bg-brand-700">Enregistrer</button></div>
                    </div>
                </div>
            )}

            {/* MODAL ASSIGNATION TAILLEUR */}
            {taskModalOpen && (
                <div className="fixed inset-0 bg-black/60 z-[170] flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm p-6 animate-in zoom-in duration-200">
                        <div className="flex justify-between items-center mb-6"><h3 className="font-bold text-gray-800 flex items-center gap-2"><UserPlus size={20} className="text-brand-600"/> Assigner Travail</h3><button onClick={() => setTaskModalOpen(false)}><X size={20}/></button></div>
                        <div className="space-y-4">
                            <div><label className="block text-[10px] font-bold text-gray-500 mb-1">Commande Client</label><select className="w-full p-2 border rounded text-sm bg-gray-50" value={newTaskData.orderId} onChange={e => setNewTaskData({...newTaskData, orderId: e.target.value})}><option value="">-- Sélectionner Commande --</option>{commandes.filter(c => c.statut !== StatutCommande.LIVRE && !c.archived).map(c => <option key={c.id} value={c.id}>{c.clientNom} (#{c.id.slice(-5)})</option>)}</select></div>
                            <div><label className="block text-[10px] font-bold text-gray-500 mb-1">Action Requise</label><select className="w-full p-2 border rounded text-sm" value={newTaskData.action} onChange={e => setNewTaskData({...newTaskData, action: e.target.value as any})}><option value="COUPE">Coupe</option><option value="COUTURE">Couture</option><option value="FINITION">Finition / Repassage</option></select></div>
                            <div><label className="block text-[10px] font-bold text-gray-500 mb-1">Nombre de pièces</label><input type="number" className="w-full p-2 border rounded text-sm font-bold" value={newTaskData.quantite} onChange={e => setNewTaskData({...newTaskData, quantite: parseInt(e.target.value)||1})}/></div>
                            <div><label className="block text-[10px] font-bold text-gray-500 mb-1">Tailleur</label><select className="w-full p-2 border rounded text-sm" value={newTaskData.tailleurId} onChange={e => setNewTaskData({...newTaskData, tailleurId: e.target.value})}><option value="">-- Choisir Tailleur --</option>{tailleurs.map(t => <option key={t.id} value={t.id}>{t.nom}</option>)}</select></div>
                        </div>
                        <div className="flex justify-end gap-3 mt-8"><button onClick={() => setTaskModalOpen(false)} className="px-4 py-2 text-gray-500 font-bold">Annuler</button><button onClick={() => {
                            const order = commandes.find(c => c.id === newTaskData.orderId);
                            if (order && (newTaskData.tailleurId || true)) {
                                const newTask: TacheProduction = { id: `T_${Date.now()}`, commandeId: order.id, action: newTaskData.action, quantite: newTaskData.quantite, tailleurId: newTaskData.tailleurId, date: new Date().toISOString().split('T')[0], statut: 'A_FAIRE', note: newTaskData.note };
                                onUpdateOrder({ ...order, taches: [...(order.taches || []), newTask] });
                                setTaskModalOpen(false);
                            } else { alert("Veuillez choisir une commande et un tailleur."); }
                        }} className="px-6 py-2 bg-brand-600 text-white rounded-lg font-bold shadow-md">Assigner</button></div>
                    </div>
                </div>
            )}

            {/* LIVRAISON PARTIELLE */}
            {deliveryModal && (
                <div className="fixed inset-0 bg-black/60 z-[150] flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm animate-in zoom-in duration-200 p-6">
                        <div className="flex justify-between items-center mb-6"><h3 className="font-bold text-gray-800 flex items-center gap-2"><Truck size={20} className="text-green-600"/> Livraison Partielle</h3><button onClick={() => setDeliveryModal(null)}><X size={20}/></button></div>
                        <p className="text-xs text-gray-500 mb-4">Combien de pièces (sur les {deliveryModal.maxQty} prêtes) livrez-vous aujourd'hui ?</p>
                        <input type="number" min="1" max={deliveryModal.maxQty} className="w-full p-3 border rounded-lg font-bold text-lg text-center bg-gray-50" value={deliveryModal.qty} onChange={e => setDeliveryModal({...deliveryModal, qty: Math.min(deliveryModal.maxQty, parseInt(e.target.value)||1)})}/>
                        <div className="flex justify-end gap-3 mt-8"><button onClick={() => setDeliveryModal(null)} className="px-4 py-2 text-gray-500 font-bold">Annuler</button><button onClick={() => {
                            const { order, qty } = deliveryModal;
                            const newRep = { ...(order.repartitionStatuts || {}) };
                            newRep[StatutCommande.PRET] = (newRep[StatutCommande.PRET] || 0) - qty;
                            if (newRep[StatutCommande.PRET] <= 0) delete newRep[StatutCommande.PRET];
                            newRep[StatutCommande.LIVRE] = (newRep[StatutCommande.LIVRE] || 0) + qty;
                            const totalLivre = (Object.values(newRep) as number[]).reduce((acc, v) => acc + v, 0) === (newRep[StatutCommande.LIVRE] || 0);
                            onUpdateOrder({ ...order, repartitionStatuts: newRep, statut: totalLivre ? StatutCommande.LIVRE : order.statut as StatutCommande });
                            setDeliveryModal(null);
                        }} className="px-6 py-2 bg-green-600 text-white rounded-lg font-bold shadow-md">Valider</button></div>
                    </div>
                </div>
            )}

            {/* ENCAISSEMENT MODAL */}
            {paymentModalOpen && selectedOrderForPayment && (
                <div className="fixed inset-0 bg-black/60 z-[160] flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm p-6">
                        <div className="flex justify-between items-center mb-6"><h3 className="text-xl font-bold flex items-center gap-2 text-green-600"><Wallet size={24}/> Encaisser</h3><button onClick={() => setPaymentModalOpen(false)}><X size={20}/></button></div>
                        <div className="space-y-4">
                            <div><label className="block text-xs font-bold text-gray-500 mb-1">Montant Reçu (Reste: {selectedOrderForPayment.reste} F)</label><input type="number" className="w-full p-2 border rounded font-bold text-lg text-brand-700 bg-gray-50" value={payAmount} onChange={e => setPayAmount(parseInt(e.target.value)||0)}/></div>
                            <div><label className="block text-xs font-bold text-gray-500 mb-1">Caisse d'entrée</label><select className="w-full p-2 border rounded text-sm bg-blue-50" value={payAccount} onChange={e => setPayAccount(e.target.value)}><option value="">-- Choisir Caisse --</option>{comptes.map(c => <option key={c.id} value={c.id}>{c.nom}</option>)}</select></div>
                        </div>
                        <div className="flex justify-end gap-3 mt-8"><button onClick={() => setPaymentModalOpen(false)} className="px-4 py-2 text-gray-500 font-bold">Annuler</button><button onClick={handleConfirmPayment} disabled={!payAccount} className="px-6 py-2 bg-green-600 text-white rounded-lg font-bold disabled:opacity-50">Confirmer</button></div>
                    </div>
                </div>
            )}

            {isScannerOpen && <QRScannerModal isOpen={isScannerOpen} onClose={() => setIsScannerOpen(false)} onScan={(text) => { const emp = employes.find(e => e.id === text.trim()); if (emp) setSearchTerm(emp.nom); setIsScannerOpen(false); }} />}
        </div>
    );
};

export default ProductionView;