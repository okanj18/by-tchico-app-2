
import React, { useState, useMemo } from 'react';
import { Commande, Employe, Client, Article, StatutCommande, RoleEmploye, ModePaiement, CompteFinancier, CompanyAssets, TacheProduction, ActionProduction } from '../types';
import { COMPANY_CONFIG } from '../config';
import { Scissors, LayoutList, Users, History, Search, Camera, X, Activity, Clock, Shirt, Calendar, CheckCircle, Zap, PenTool, Columns, Trophy, Wallet, Printer, Eye, UserPlus, Plus, Save, Truck, ArrowRightLeft, DollarSign, ListFilter } from 'lucide-react';
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

const PRODUCTION_ACTIONS: { id: ActionProduction, label: string, icon: any }[] = [
    { id: 'COUPE', label: 'Coupe', icon: Scissors },
    { id: 'COUTURE', label: 'Couture / Montage', icon: Shirt },
    { id: 'FINITION', label: 'Finition / Repassage', icon: Zap }
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
    const [isScannerOpen, setIsScannerOpen] = useState(false);
    
    const [agendaBaseDate] = useState(() => {
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

    // Payment States
    const [selectedOrderForPayment, setSelectedOrderForPayment] = useState<Commande | null>(null);
    const [payAmount, setPayAmount] = useState(0);
    const [payAccount, setPayAccount] = useState('');
    const [payMethod, setPayMethod] = useState<ModePaiement>('ESPECE');
    const [payDate, setPayDate] = useState(new Date().toISOString().split('T')[0]);

    const [planningTarget, setPlanningTarget] = useState<{ tailorId: string, tailorName: string, date: Date } | null>(null);
    const [draggedInfo, setDraggedInfo] = useState<{orderId: string, fromStatus: string} | null>(null);

    const [newTaskData, setNewTaskData] = useState<{ orderId: string, action: ActionProduction, quantite: number, note: string }>({ orderId: '', action: 'COUTURE', quantite: 1, note: '' });

    const [newOrderData, setNewOrderData] = useState<Partial<Commande>>({
        clientId: '', clientNom: '', description: '', quantite: 1, prixTotal: 0, avance: 0, dateLivraisonPrevue: ''
    });

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

    // --- ACTIONS ---

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

    const handleSaveQuickOrder = () => {
        if (!newOrderData.clientId || !newOrderData.quantite || !newOrderData.prixTotal || !payAccount) {
            alert("Remplissez le client, le prix et choisissez une caisse.");
            return;
        }
        const client = clients.find(c => c.id === newOrderData.clientId);
        const order: Commande = {
            id: `CMD_SM_${Date.now()}`,
            clientId: newOrderData.clientId!,
            clientNom: client?.nom || 'Inconnu',
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

    const openPaymentModal = (order: Commande) => {
        setSelectedOrderForPayment(order);
        setPayAmount(order.reste);
        setPayAccount('');
        setPayMethod('ESPECE');
        setPaymentModalOpen(true);
    };

    const handleConfirmPayment = () => {
        if (!selectedOrderForPayment || payAmount <= 0 || !payAccount) return;
        onAddPayment(selectedOrderForPayment.id, payAmount, payMethod, "Versement acompte", payDate, payAccount);
        setPaymentModalOpen(false);
        setSelectedOrderForPayment(null);
    };

    const handleDeliverOrder = (order: Commande) => {
        if (order.reste > 0) {
            if (!window.confirm(`Il reste ${order.reste} F. Encaisser et livrer ?`)) return;
            openPaymentModal(order);
        } else {
            if (window.confirm("Confirmer la livraison finale ?")) onUpdateStatus(order.id, StatutCommande.LIVRE);
        }
    };

    return (
        <div className="space-y-6 h-[calc(100vh-8rem)] flex flex-col">
            {/* HEADER FIXE */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 shrink-0">
                <div className="flex items-center gap-3">
                    <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2"><Scissors className="text-brand-600"/> Atelier Production</h2>
                    <div className="flex gap-2">
                        <button onClick={() => setOrderModalOpen(true)} className="bg-brand-600 text-white px-3 py-1.5 rounded-lg flex items-center gap-2 text-xs font-bold hover:bg-brand-700 shadow-md"><Plus size={14}/> Nouvelle Commande</button>
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
                        <button key={mode.id} onClick={() => setViewMode(mode.id as any)} className={`px-3 py-1.5 text-xs font-bold rounded flex items-center gap-1 ${viewMode === mode.id ? 'bg-brand-50 text-brand-700' : 'text-gray-500'}`}>
                            <mode.icon size={14}/> <span>{mode.label}</span>
                        </button>
                    ))}
                </div>
            </div>

            {/* BARRE DE RECHERCHE */}
            <div className="bg-white p-3 rounded-lg border flex flex-wrap gap-3 shrink-0 shadow-sm items-center">
                <div className="relative flex-1 min-w-[200px]"><Search className="absolute left-3 top-2.5 text-gray-400" size={16}/><input type="text" placeholder="Rechercher..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-10 pr-4 py-2 border rounded-lg text-sm" /></div>
                {viewMode === 'HISTORY' && (
                    <select className="p-2 border rounded text-xs" value={historyFilterStatus} onChange={e => setHistoryFilterStatus(e.target.value)}>
                        <option value="ALL">Tous les statuts</option>
                        {Object.values(StatutCommande).map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                )}
            </div>

            <div className="flex-1 overflow-hidden">
                {/* KANBAN */}
                {viewMode === 'KANBAN' && (
                    <div className="flex gap-4 h-full overflow-x-auto pb-4 custom-scrollbar">
                        {KANBAN_STATUS_ORDER.map((status, index) => (
                            <div key={status} className="flex-1 min-w-[280px] bg-gray-100/50 rounded-xl flex flex-col border border-gray-200" onDragOver={e => e.preventDefault()} onDrop={() => handleDrop(status as StatutCommande)}>
                                <div className="p-3 border-b flex justify-between items-center bg-white rounded-t-xl">
                                    <h3 className="text-sm font-bold text-gray-700 flex items-center gap-2">{status}</h3>
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
                                    <th className="p-3">Client / Date</th>
                                    <th className="p-3 text-right">Montant</th>
                                    <th className="p-3 text-right">Reste</th>
                                    <th className="p-3">Progression Flux</th>
                                    <th className="p-3 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 overflow-y-auto">
                                {filteredCommandes.map(order => (
                                    <tr key={order.id} className="hover:bg-gray-50">
                                        <td className="p-3">
                                            <div className="font-bold text-gray-800">{order.clientNom}</div>
                                            <div className="text-[10px] text-gray-400">{new Date(order.dateCommande).toLocaleDateString()} • Livraison: <span className="text-orange-600 font-bold">{new Date(order.dateLivraisonPrevue).toLocaleDateString()}</span></div>
                                        </td>
                                        <td className="p-3 text-right font-medium">{order.prixTotal.toLocaleString()} F</td>
                                        <td className={`p-3 text-right font-bold ${order.reste > 0 ? 'text-red-600' : 'text-green-600'}`}>{order.reste.toLocaleString()} F</td>
                                        <td className="p-3">
                                            <div className="flex flex-wrap gap-1">
                                                {KANBAN_STATUS_ORDER.map(s => (order.repartitionStatuts?.[s] || 0) > 0 && (
                                                    <span key={s} className="px-1.5 py-0.5 bg-brand-50 text-brand-700 rounded text-[9px] font-bold border border-brand-100">{s}({order.repartitionStatuts![s]})</span>
                                                ))}
                                                {!order.repartitionStatuts && <span className="px-2 py-1 bg-gray-100 rounded text-[9px] font-bold uppercase">{order.statut}</span>}
                                            </div>
                                        </td>
                                        <td className="p-3 text-right">
                                            <div className="flex justify-end gap-1">
                                                {order.statut === StatutCommande.PRET && <button onClick={() => handleDeliverOrder(order)} className="px-2 py-1 text-green-600 bg-green-50 hover:bg-green-100 rounded text-[10px] font-bold flex items-center gap-1"><Truck size={14}/> LIVRER</button>}
                                                {order.reste > 0 && <button onClick={() => openPaymentModal(order)} className="p-1.5 text-orange-600 hover:bg-orange-50 rounded" title="Encaisser"><DollarSign size={18}/></button>}
                                                <button onClick={() => alert(`Historique Versements:\n${order.paiements?.map(p => `- ${new Date(p.date).toLocaleDateString()} : ${p.montant} F (${p.moyenPaiement})`).join('\n') || 'Aucun.'}`)} className="p-1.5 text-blue-500 hover:bg-blue-50 rounded"><Eye size={18}/></button>
                                                <button onClick={() => { setNewTaskData({...newTaskData, orderId: order.id}); setTaskModalOpen(true); }} className="p-1.5 text-brand-600 hover:bg-brand-50 rounded"><UserPlus size={18}/></button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}

                {/* TAILLEURS / PERFORMANCE (VUES EXISTANTES) */}
                {viewMode === 'TAILORS' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 overflow-y-auto h-full p-1">
                        {tailleurs.map(tailor => (
                            <div key={tailor.id} className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 flex flex-col">
                                <div className="flex items-center gap-4 mb-4">
                                    <div className="w-12 h-12 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center font-bold text-lg">{tailor.nom.charAt(0)}</div>
                                    <div className="flex-1"><h3 className="font-bold text-gray-800 truncate">{tailor.nom}</h3><p className="text-[10px] text-gray-500 uppercase">{tailor.role}</p></div>
                                </div>
                                <div className="flex justify-between text-sm mb-2"><span className="text-gray-500">Tâches en cours</span><span className="font-bold text-brand-600">{(commandes.flatMap(o => o.taches || [])).filter(t => t.tailleurId === tailor.id && t.statut === 'A_FAIRE').length}</span></div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* MODALS */}
            {kanbanMoveModal && (
                <div className="fixed inset-0 bg-black/60 z-[150] flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm animate-in zoom-in duration-200">
                        <div className="p-4 border-b bg-gray-50 flex justify-between items-center"><h3 className="font-bold text-gray-800 flex items-center gap-2"><ArrowRightLeft size={18} className="text-brand-600"/> Déplacer : {kanbanMoveModal.toStatus}</h3><button onClick={() => setKanbanMoveModal(null)}><X size={20}/></button></div>
                        <div className="p-6 space-y-4">
                            <div><label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Nombre d'unités</label><input type="number" min="1" max={kanbanMoveModal.maxQty} className="w-full p-2 border rounded-lg font-bold" value={kanbanMoveModal.qty} onChange={e => setKanbanMoveModal({...kanbanMoveModal, qty: Math.min(kanbanMoveModal.maxQty, parseInt(e.target.value)||1)})}/></div>
                            <div><label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Assigner Tailleur (Opt.)</label><select className="w-full p-2 border rounded-lg text-sm bg-indigo-50" value={kanbanMoveModal.assignTailorId} onChange={e => setKanbanMoveModal({...kanbanMoveModal, assignTailorId: e.target.value})}><option value="">-- Aucun --</option>{tailleurs.map(t => <option key={t.id} value={t.id}>{t.nom}</option>)}</select></div>
                        </div>
                        <div className="p-4 bg-gray-50 border-t flex justify-end gap-2"><button onClick={() => setKanbanMoveModal(null)} className="px-4 py-2 text-gray-500 font-bold">Annuler</button><button onClick={executeKanbanMove} className="px-6 py-2 bg-brand-600 text-white rounded-lg font-bold shadow-md">Confirmer</button></div>
                    </div>
                </div>
            )}

            {orderModalOpen && (
                <div className="fixed inset-0 bg-black/60 z-[110] flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-md animate-in zoom-in duration-200">
                        <div className="p-4 border-b bg-gray-50 rounded-t-xl flex justify-between items-center"><h3 className="font-bold text-gray-800 flex items-center gap-2"><Plus size={18} className="text-brand-600"/> Nouvelle Commande</h3><button onClick={() => setOrderModalOpen(false)}><X size={20}/></button></div>
                        <div className="p-6 space-y-4">
                            <div><label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Client</label><select className="w-full p-2 border rounded-lg text-sm bg-white" value={newOrderData.clientId} onChange={e => setNewOrderData({...newOrderData, clientId: e.target.value})}><option value="">-- Sélectionner --</option>{clients.map(c => <option key={c.id} value={c.id}>{c.nom}</option>)}</select></div>
                            <div className="grid grid-cols-2 gap-4"><div><label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Qté</label><input type="number" className="w-full p-2 border rounded-lg text-sm font-bold" value={newOrderData.quantite} onChange={e => setNewOrderData({...newOrderData, quantite: parseInt(e.target.value)||1})}/></div><div><label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Livraison</label><input type="date" className="w-full p-2 border rounded-lg text-sm" value={newOrderData.dateLivraisonPrevue} onChange={e => setNewOrderData({...newOrderData, dateLivraisonPrevue: e.target.value})}/></div></div>
                            <div className="grid grid-cols-2 gap-4"><div><label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Total</label><input type="number" className="w-full p-2 border rounded-lg text-sm font-bold" value={newOrderData.prixTotal || ''} onChange={e => setNewOrderData({...newOrderData, prixTotal: parseInt(e.target.value)||0})}/></div><div><label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Avance</label><input type="number" className="w-full p-2 border rounded-lg text-sm font-bold bg-green-50" value={newOrderData.avance || ''} onChange={e => setNewOrderData({...newOrderData, avance: parseInt(e.target.value)||0})}/></div></div>
                            <div><label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Caisse d'encaissement</label><select className="w-full p-2 border rounded-lg text-sm bg-blue-50 border-blue-100" value={payAccount} onChange={e => setPayAccount(e.target.value)}><option value="">-- Choisir Caisse --</option>{comptes.map(c => <option key={c.id} value={c.id}>{c.nom} ({c.solde.toLocaleString()} F)</option>)}</select></div>
                        </div>
                        <div className="p-4 bg-gray-50 border-t flex justify-end gap-3 rounded-b-xl"><button onClick={() => setOrderModalOpen(false)} className="px-4 py-2 text-gray-500 font-bold">Annuler</button><button onClick={handleSaveQuickOrder} className="px-6 py-2 bg-brand-600 text-white rounded-lg font-bold">Enregistrer</button></div>
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
