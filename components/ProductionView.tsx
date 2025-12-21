
import React, { useState, useMemo } from 'react';
import { Commande, Employe, Client, Article, StatutCommande, RoleEmploye, ModePaiement, CompteFinancier, CompanyAssets, TacheProduction, ActionProduction } from '../types';
import { Scissors, LayoutList, Users, History, Search, Camera, Plus, X, Activity, Clock, Shirt, Calendar, CheckCircle, Zap, PenTool, PieChart, MoveRight, UserPlus, BarChart2, CheckSquare, RefreshCw, Columns, ChevronLeft, ChevronRight, Trophy, AlertTriangle } from 'lucide-react';
import { QRGeneratorModal, QRScannerModal } from './QRTools';

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

const PRODUCTION_ACTIONS: { id: ActionProduction, label: string, icon: any, color: string }[] = [
    { id: 'COUPE', label: 'Coupe', icon: Scissors, color: 'text-blue-600 bg-blue-50 border-blue-200' },
    { id: 'COUTURE', label: 'Couture / Montage', icon: Shirt, color: 'text-indigo-600 bg-indigo-50 border-indigo-200' },
    { id: 'BRODERIE', label: 'Broderie', icon: PenTool, color: 'text-amber-600 bg-amber-50 border-amber-200' },
    { id: 'FINITION', label: 'Finition', icon: CheckCircle, color: 'text-purple-600 bg-purple-50 border-purple-200' },
    { id: 'REPASSAGE', label: 'Repassage', icon: Zap, color: 'text-orange-600 bg-orange-50 border-orange-200' },
    { id: 'AUTRE', label: 'Autre', icon: Activity, color: 'text-gray-600 bg-gray-50 border-gray-200' },
];

const ProductionView: React.FC<ProductionViewProps> = ({ 
    commandes, employes, clients, articles, userRole, 
    onUpdateStatus, onCreateOrder, onUpdateOrder, onAddPayment, onArchiveOrder, comptes, companyAssets 
}) => {
    const [viewMode, setViewMode] = useState<'ORDERS' | 'TAILORS' | 'PERFORMANCE' | 'KANBAN' | 'HISTORY' | 'PLANNING'>('KANBAN');
    const [searchTerm, setSearchTerm] = useState('');
    const [agendaBaseDate, setAgendaBaseDate] = useState(() => {
        const d = new Date();
        d.setHours(0,0,0,0);
        return d;
    });

    const [isScannerOpen, setIsScannerOpen] = useState(false);
    const [taskModalOpen, setTaskModalOpen] = useState(false);
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

    const tailleurs = employes.filter(e => e.role === RoleEmploye.TAILLEUR || e.role === RoleEmploye.CHEF_ATELIER || e.role === RoleEmploye.STAGIAIRE);

    const filteredCommandes = useMemo(() => {
        return commandes.filter(c => {
            if (c.type !== 'SUR_MESURE') return false; 
            const isCompleted = c.statut === StatutCommande.LIVRE || c.statut === StatutCommande.ANNULE;
            
            // Logique de filtrage par onglet
            if (viewMode === 'HISTORY') {
                if (!isCompleted) return false;
            } else if (viewMode !== 'PERFORMANCE') {
                if (isCompleted) return false;
            }

            const matchesSearch = c.clientNom.toLowerCase().includes(searchTerm.toLowerCase()) || 
                                  c.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
                                  c.description.toLowerCase().includes(searchTerm.toLowerCase());
            return matchesSearch;
        }).sort((a, b) => new Date(b.dateCommande).getTime() - new Date(a.dateCommande).getTime());
    }, [commandes, searchTerm, viewMode]);

    // --- LOGIQUE PERFORMANCE ---
    const performanceStats = useMemo(() => {
        const stats: Record<string, { done: number, pending: number, name: string }> = {};
        tailleurs.forEach(t => { stats[t.id] = { done: 0, pending: 0, name: t.nom }; });

        commandes.forEach(order => {
            order.taches?.forEach(t => {
                if (stats[t.tailleurId]) {
                    if (t.statut === 'FAIT') stats[t.tailleurId].done += t.quantite;
                    else stats[t.tailleurId].pending += t.quantite;
                }
            });
        });

        return Object.entries(stats)
            .map(([id, data]) => ({ id, ...data }))
            .sort((a, b) => b.done - a.done);
    }, [commandes, tailleurs]);

    const handleDragStart = (orderId: string, fromStatus: string) => setDraggedInfo({ orderId, fromStatus });

    const handleDrop = (toStatus: string) => {
        if (!draggedInfo || draggedInfo.fromStatus === toStatus) {
            setDraggedInfo(null);
            return;
        }
        const order = commandes.find(c => c.id === draggedInfo.orderId);
        if (!order) return;
        const currentQtyInSource = order.repartitionStatuts ? (order.repartitionStatuts[draggedInfo.fromStatus] || 0) : order.quantite;
        if (currentQtyInSource === 1) executeMove(order, draggedInfo.fromStatus, toStatus, 1);
        else setMoveModal({ order, fromStatus: draggedInfo.fromStatus, toStatus, maxQty: currentQtyInSource, qty: currentQtyInSource });
        setDraggedInfo(null);
    };

    const executeMove = (order: Commande, from: string, to: string, qty: number) => {
        const newRepartition = { ...(order.repartitionStatuts || { [order.statut]: order.quantite }) };
        newRepartition[from] = (newRepartition[from] || 0) - qty;
        if (newRepartition[from] <= 0) delete newRepartition[from];
        newRepartition[to] = (newRepartition[to] || 0) + qty;

        const statusOrder = [StatutCommande.EN_ATTENTE, StatutCommande.EN_COUPE, StatutCommande.COUTURE, StatutCommande.FINITION, StatutCommande.PRET];
        let mostAdvanced = order.statut as string;
        statusOrder.forEach(s => { if (newRepartition[s] > 0) mostAdvanced = s; });

        onUpdateOrder({ ...order, repartitionStatuts: newRepartition, statut: mostAdvanced });
        setMoveModal(null);

        const productionMapping: Record<string, ActionProduction> = {
            [StatutCommande.EN_COUPE]: 'COUPE',
            [StatutCommande.COUTURE]: 'COUTURE',
            [StatutCommande.FINITION]: 'FINITION'
        };

        if (productionMapping[to]) {
            setNewTaskData({
                orderId: order.id,
                action: productionMapping[to],
                quantite: qty,
                note: `Sync Kanban`,
                elementNom: order.description
            });
            setPlanningTarget(null);
            setTaskModalOpen(true);
        }
    };

    const handleSaveTask = () => {
        if (!newTaskData.orderId || !planningTarget?.tailorId) return;
        const order = commandes.find(c => c.id === newTaskData.orderId);
        if (!order) return;

        const newTask: TacheProduction = {
            id: `TASK_${Date.now()}`, 
            commandeId: order.id, 
            action: newTaskData.action,
            quantite: newTaskData.quantite, 
            date: planningTarget.date.toISOString().split('T')[0], 
            tailleurId: planningTarget.tailorId, 
            statut: 'A_FAIRE',
            note: newTaskData.note,
            elementNom: newTaskData.elementNom
        };

        onUpdateOrder({ ...order, taches: [...(order.taches || []), newTask] });
        setTaskModalOpen(false);
    };

    const getTasksForTailor = (tailorId: string, date: Date) => {
        const dateStr = date.toISOString().split('T')[0];
        const result: { task: TacheProduction, order: Commande }[] = [];
        commandes.forEach(o => o.taches?.forEach(t => {
            if (t.tailleurId === tailorId && t.date === dateStr) result.push({ task: t, order: o });
        }));
        return result;
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
            {/* HEADER NAVIGATION */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 shrink-0">
                <div className="flex items-center gap-4">
                    <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2"><Scissors className="text-brand-600"/> Atelier Production</h2>
                    <button onClick={() => setIsScannerOpen(true)} className="bg-gray-800 text-white px-3 py-1.5 rounded-lg flex items-center gap-2 text-xs font-bold hover:bg-black transition-all shadow-sm"><Camera size={14}/> Scanner Badge</button>
                </div>
                <div className="flex flex-wrap bg-white border p-1 rounded-lg shadow-sm">
                    <button onClick={() => setViewMode('PLANNING')} className={`px-3 py-1.5 text-xs font-bold rounded flex items-center gap-1 ${viewMode === 'PLANNING' ? 'bg-brand-50 text-brand-700' : 'text-gray-500'}`}><Calendar size={14}/> Agenda</button>
                    <button onClick={() => setViewMode('KANBAN')} className={`px-3 py-1.5 text-xs font-bold rounded flex items-center gap-1 ${viewMode === 'KANBAN' ? 'bg-brand-50 text-brand-700' : 'text-gray-500'}`}><Columns size={14}/> Kanban</button>
                    <button onClick={() => setViewMode('ORDERS')} className={`px-3 py-1.5 text-xs font-bold rounded flex items-center gap-1 ${viewMode === 'ORDERS' ? 'bg-brand-50 text-brand-700' : 'text-gray-500'}`}><LayoutList size={14}/> Liste</button>
                    <button onClick={() => setViewMode('TAILORS')} className={`px-3 py-1.5 text-xs font-bold rounded flex items-center gap-1 ${viewMode === 'TAILORS' ? 'bg-brand-50 text-brand-700' : 'text-gray-500'}`}><Users size={14}/> Tailleurs</button>
                    <button onClick={() => setViewMode('PERFORMANCE')} className={`px-3 py-1.5 text-xs font-bold rounded flex items-center gap-1 ${viewMode === 'PERFORMANCE' ? 'bg-brand-50 text-brand-700' : 'text-gray-500'}`}><Trophy size={14}/> Performance</button>
                    <button onClick={() => setViewMode('HISTORY')} className={`px-3 py-1.5 text-xs font-bold rounded flex items-center gap-1 ${viewMode === 'HISTORY' ? 'bg-brand-50 text-brand-700' : 'text-gray-500'}`}><History size={14}/> Historique</button>
                </div>
            </div>

            {/* BARRE DE RECHERCHE */}
            <div className="bg-white p-3 rounded-lg border flex gap-3 shrink-0">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-2.5 text-gray-400" size={16}/>
                    <input 
                        type="text" 
                        placeholder="Rechercher une commande, client, tailleur..." 
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-brand-500"
                    />
                </div>
                {viewMode === 'PLANNING' && (
                    <div className="flex gap-2 items-center">
                        <button onClick={() => setAgendaBaseDate(d => { const n = new Date(d); n.setDate(n.getDate() - 7); return n; })} className="p-2 border rounded hover:bg-gray-50"><ChevronLeft size={16}/></button>
                        <span className="text-xs font-bold text-gray-600 min-w-[120px] text-center">Secteur: {agendaBaseDate.toLocaleDateString('fr-FR', { month: 'short', day: 'numeric' })}</span>
                        <button onClick={() => setAgendaBaseDate(d => { const n = new Date(d); n.setDate(n.getDate() + 7); return n; })} className="p-2 border rounded hover:bg-gray-50"><ChevronRight size={16}/></button>
                    </div>
                )}
            </div>

            {/* CONTENU PRINCIPAL */}
            <div className="flex-1 overflow-hidden">
                {/* --- AGENDA / PLANNING --- */}
                {viewMode === 'PLANNING' && (
                    <div className="bg-white border rounded-xl shadow-sm h-full flex flex-col overflow-hidden">
                        <div className="flex-1 overflow-auto">
                            <table className="w-full border-collapse table-fixed min-w-[1000px]">
                                <thead className="sticky top-0 z-20 bg-gray-50">
                                    <tr>
                                        <th className="w-48 p-3 border-b border-r text-left text-xs font-bold text-gray-500 uppercase">Tailleur</th>
                                        {Array.from({length: 7}, (_, i) => {
                                            const d = new Date(agendaBaseDate); d.setDate(d.getDate() + i);
                                            return (
                                                <th key={i} className="p-3 border-b text-center text-xs font-bold text-gray-500 uppercase">
                                                    {d.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric' })}
                                                </th>
                                            );
                                        })}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {tailleurs.map(tailor => (
                                        <tr key={tailor.id} className="hover:bg-gray-50/50">
                                            <td className="p-3 border-r bg-gray-50/30 sticky left-0 font-bold text-xs">{tailor.nom}</td>
                                            {Array.from({length: 7}, (_, i) => {
                                                const d = new Date(agendaBaseDate); d.setDate(d.getDate() + i);
                                                const tasks = getTasksForTailor(tailor.id, d);
                                                return (
                                                    <td key={i} className="p-2 border-r last:border-r-0 h-24 vertical-top relative cursor-pointer hover:bg-brand-50/20" 
                                                        onClick={() => { setPlanningTarget({ tailorId: tailor.id, tailorName: tailor.nom, date: d }); setTaskModalOpen(true); }}>
                                                        <div className="space-y-1">
                                                            {tasks.map(({task, order}) => (
                                                                <div key={task.id} className={`p-1 rounded text-[9px] border ${task.statut === 'FAIT' ? 'bg-green-50 text-green-700' : 'bg-brand-50 text-brand-800 border-brand-200'}`}>
                                                                    <div className="font-bold">{task.action} x{task.quantite}</div>
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

                {/* --- KANBAN --- */}
                {viewMode === 'KANBAN' && (
                    <div className="flex gap-4 h-full overflow-x-auto pb-4 custom-scrollbar">
                        {[StatutCommande.EN_ATTENTE, StatutCommande.EN_COUPE, StatutCommande.COUTURE, StatutCommande.FINITION, StatutCommande.PRET].map(status => (
                            <div key={status} className="flex-1 min-w-[280px] bg-gray-100/50 rounded-xl flex flex-col border border-gray-200" onDragOver={e => e.preventDefault()} onDrop={() => handleDrop(status)}>
                                <div className="p-3 border-b flex justify-between items-center bg-white rounded-t-xl">
                                    <h3 className="text-sm font-bold text-gray-700 flex items-center gap-2">{getStatusIcon(status)} {status}</h3>
                                    <span className="bg-gray-200 text-gray-600 text-[10px] px-2 py-0.5 rounded-full font-bold">
                                        {filteredCommandes.reduce((acc, c) => acc + (c.repartitionStatuts?.[status] || (c.statut === status ? c.quantite : 0)), 0)}
                                    </span>
                                </div>
                                <div className="flex-1 overflow-y-auto p-2 space-y-3">
                                    {filteredCommandes.filter(c => (c.repartitionStatuts?.[status] || 0) > 0 || (!c.repartitionStatuts && c.statut === status)).map(order => (
                                        <div key={order.id} draggable onDragStart={() => handleDragStart(order.id, status)} className="bg-white p-3 rounded-lg shadow-sm border border-gray-200 cursor-grab hover:border-brand-300">
                                            <div className="flex justify-between items-start mb-1 text-[10px] font-mono text-gray-400">
                                                <span>#{order.id.slice(-5)}</span>
                                                <span className="bg-brand-50 text-brand-700 px-1.5 rounded font-bold">Qté: {order.repartitionStatuts?.[status] || order.quantite}</span>
                                            </div>
                                            <p className="font-bold text-gray-800 text-sm mb-1">{order.clientNom}</p>
                                            <p className="text-[10px] text-gray-500 line-clamp-2">{order.description}</p>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {/* --- LISTE ACTIVE --- */}
                {viewMode === 'ORDERS' && (
                    <div className="bg-white border rounded-xl overflow-hidden shadow-sm h-full flex flex-col">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-gray-50 text-gray-600 font-bold border-b sticky top-0">
                                <tr><th className="p-3">Client / Réf</th><th className="p-3">Description</th><th className="p-3">Livraison</th><th className="p-3">Statut</th><th className="p-3 text-right">Actions</th></tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 overflow-y-auto">
                                {filteredCommandes.map(order => (
                                    <tr key={order.id} className="hover:bg-gray-50">
                                        <td className="p-3"><div className="font-bold">{order.clientNom}</div><div className="text-[10px] font-mono text-gray-400">#{order.id.slice(-6)}</div></td>
                                        <td className="p-3 text-xs text-gray-500 truncate max-w-xs">{order.description}</td>
                                        <td className="p-3 font-bold text-orange-600">{new Date(order.dateLivraisonPrevue).toLocaleDateString()}</td>
                                        <td className="p-3"><span className="px-2 py-1 bg-gray-100 rounded text-[10px] font-bold uppercase">{order.statut}</span></td>
                                        <td className="p-3 text-right"><button onClick={() => { setNewTaskData({...newTaskData, orderId: order.id}); setTaskModalOpen(true); }} className="p-1.5 text-brand-600 hover:bg-brand-50 rounded"><UserPlus size={18}/></button></td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}

                {/* --- GESTION TAILLEURS (RESTORED) --- */}
                {viewMode === 'TAILORS' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 overflow-y-auto h-full p-1">
                        {tailleurs.map(tailor => {
                            const activeTasks = (commandes.flatMap(o => o.taches || [])).filter(t => t.tailleurId === tailor.id && t.statut === 'A_FAIRE');
                            return (
                                <div key={tailor.id} className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
                                    <div className="flex items-center gap-4 mb-4">
                                        <div className="w-12 h-12 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center font-bold text-lg">{tailor.nom.charAt(0)}</div>
                                        <div>
                                            <h3 className="font-bold text-gray-800">{tailor.nom}</h3>
                                            <p className="text-xs text-gray-500 uppercase tracking-tighter">{tailor.role}</p>
                                        </div>
                                        <div className={`ml-auto w-3 h-3 rounded-full ${tailor.actif !== false ? 'bg-green-500' : 'bg-gray-300'}`}></div>
                                    </div>
                                    <div className="space-y-3">
                                        <div className="flex justify-between text-sm">
                                            <span className="text-gray-500">Tâches en cours</span>
                                            <span className="font-bold text-brand-600">{activeTasks.length}</span>
                                        </div>
                                        <div className="w-full bg-gray-100 h-2 rounded-full overflow-hidden">
                                            <div className="bg-brand-500 h-full transition-all" style={{ width: `${Math.min(100, activeTasks.length * 20)}%` }}></div>
                                        </div>
                                        <div className="pt-2 border-t border-gray-50">
                                            <p className="text-[10px] font-bold text-gray-400 uppercase mb-2">Dernières assignations</p>
                                            {activeTasks.slice(0, 3).map(t => (
                                                <div key={t.id} className="flex justify-between text-[10px] py-1 border-b border-gray-50 last:border-0">
                                                    <span>{t.action} x{t.quantite}</span>
                                                    <span className="text-gray-400">{new Date(t.date).toLocaleDateString()}</span>
                                                </div>
                                            ))}
                                            {activeTasks.length === 0 && <p className="text-[10px] italic text-gray-400">Disponible pour de nouvelles tâches.</p>}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}

                {/* --- PERFORMANCE (RESTORED) --- */}
                {viewMode === 'PERFORMANCE' && (
                    <div className="space-y-6 overflow-y-auto h-full p-1">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex items-center justify-between">
                                <div><p className="text-xs text-gray-500 font-bold uppercase">Productivité Globale</p><p className="text-2xl font-bold text-gray-900">{commandes.flatMap(o => o.taches || []).filter(t => t.statut === 'FAIT').length} <span className="text-xs font-normal">Tâches finies</span></p></div>
                                <div className="p-3 bg-green-50 text-green-600 rounded-full"><Zap size={24}/></div>
                            </div>
                            <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex items-center justify-between">
                                <div><p className="text-xs text-gray-500 font-bold uppercase">Taux de Complétion</p><p className="text-2xl font-bold text-gray-900">{Math.round((commandes.flatMap(o => o.taches || []).filter(t => t.statut === 'FAIT').length / (commandes.flatMap(o => o.taches || []).length || 1)) * 100)}%</p></div>
                                <div className="p-3 bg-blue-50 text-blue-600 rounded-full"><BarChart2 size={24}/></div>
                            </div>
                            <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex items-center justify-between">
                                <div><p className="text-xs text-gray-500 font-bold uppercase">Meilleur Tailleur</p><p className="text-2xl font-bold text-brand-600">{performanceStats[0]?.name || 'N/A'}</p></div>
                                <div className="p-3 bg-brand-50 text-brand-600 rounded-full"><Trophy size={24}/></div>
                            </div>
                        </div>

                        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                            <div className="p-4 bg-gray-50 border-b border-gray-200 flex justify-between items-center">
                                <h3 className="font-bold text-gray-800">Classement Productivité (Tâches validées)</h3>
                            </div>
                            <div className="p-4 space-y-4">
                                {performanceStats.map((stat, index) => (
                                    <div key={stat.id} className="flex items-center gap-4">
                                        <div className="w-8 font-bold text-gray-400">#{index + 1}</div>
                                        <div className="flex-1">
                                            <div className="flex justify-between mb-1">
                                                <span className="text-sm font-bold text-gray-800">{stat.name}</span>
                                                <span className="text-sm font-bold text-brand-600">{stat.done} unités</span>
                                            </div>
                                            <div className="w-full bg-gray-100 h-3 rounded-full overflow-hidden flex">
                                                <div className="bg-green-500 h-full" style={{ width: `${(stat.done / (stat.done + stat.pending || 1)) * 100}%` }}></div>
                                                <div className="bg-orange-300 h-full" style={{ width: `${(stat.pending / (stat.done + stat.pending || 1)) * 100}%` }}></div>
                                            </div>
                                            <div className="flex gap-4 mt-1">
                                                <span className="text-[10px] flex items-center gap-1 text-green-600"><CheckSquare size={10}/> Terminées: {stat.done}</span>
                                                <span className="text-[10px] flex items-center gap-1 text-orange-600"><Clock size={10}/> En cours: {stat.pending}</span>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                )}

                {/* --- HISTORIQUE (RESTORED) --- */}
                {viewMode === 'HISTORY' && (
                    <div className="bg-white border rounded-xl overflow-hidden shadow-sm h-full flex flex-col">
                        <div className="p-3 bg-gray-50 border-b flex items-center gap-2 text-xs font-bold text-orange-800">
                            <AlertTriangle size={14}/> Les commandes livrées ou annulées sont archivées ici.
                        </div>
                        <table className="w-full text-sm text-left">
                            <thead className="bg-gray-50 text-gray-600 font-bold border-b sticky top-0">
                                <tr><th className="p-3">Client / Date</th><th className="p-3">Description</th><th className="p-3">Statut Final</th><th className="p-3 text-right">Total</th><th className="p-3 text-center">Actions</th></tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 overflow-y-auto">
                                {filteredCommandes.map(order => (
                                    <tr key={order.id} className="hover:bg-gray-50 opacity-80">
                                        <td className="p-3">
                                            <div className="font-bold text-gray-800">{order.clientNom}</div>
                                            <div className="text-[10px] text-gray-400">{new Date(order.dateCommande).toLocaleDateString()}</div>
                                        </td>
                                        <td className="p-3 text-xs text-gray-500 truncate max-w-xs">{order.description}</td>
                                        <td className="p-3">
                                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${order.statut === StatutCommande.LIVRE ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                                {order.statut.toUpperCase()}
                                            </span>
                                        </td>
                                        <td className="p-3 text-right font-bold text-gray-700">{order.prixTotal.toLocaleString()} F</td>
                                        <td className="p-3 text-center"><button onClick={() => alert("Impression du dossier technique...")} className="p-1.5 text-gray-400 hover:text-gray-600"><History size={18}/></button></td>
                                    </tr>
                                ))}
                                {filteredCommandes.length === 0 && <tr><td colSpan={5} className="p-10 text-center text-gray-400">Aucune commande archivée trouvée.</td></tr>}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* MODAL PLANIFICATION */}
            {taskModalOpen && (
                <div className="fixed inset-0 bg-black/60 z-[110] flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-md animate-in zoom-in duration-200">
                        <div className="p-4 border-b bg-gray-50 rounded-t-xl flex justify-between items-center">
                            <h3 className="font-bold text-gray-800 flex items-center gap-2"><Calendar size={18} className="text-brand-600"/> Assigner une tâche</h3>
                            <button onClick={() => setTaskModalOpen(false)}><X size={20}/></button>
                        </div>
                        <div className="p-6 space-y-5">
                            <div>
                                <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Commande</label>
                                <select className="w-full p-2.5 border rounded-lg text-sm bg-white" value={newTaskData.orderId} onChange={e => {
                                    const o = commandes.find(c => c.id === e.target.value);
                                    setNewTaskData({...newTaskData, orderId: e.target.value, quantite: o?.quantite || 1, elementNom: o?.description || ''});
                                }}>
                                    <option value="">-- Choisir Commande --</option>
                                    {commandes.filter(c => c.statut !== StatutCommande.LIVRE && c.statut !== StatutCommande.ANNULE).map(c => <option key={c.id} value={c.id}>{c.clientNom} (#{c.id.slice(-5)})</option>)}
                                </select>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Action</label>
                                    <select className="w-full p-2.5 border rounded-lg text-sm" value={newTaskData.action} onChange={e => setNewTaskData({...newTaskData, action: e.target.value as ActionProduction})}>
                                        {PRODUCTION_ACTIONS.map(a => <option key={a.id} value={a.id}>{a.label}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Quantité</label>
                                    <input type="number" className="w-full p-2.5 border rounded-lg text-sm font-bold" value={newTaskData.quantite} onChange={e => setNewTaskData({...newTaskData, quantite: parseInt(e.target.value)||1})}/>
                                </div>
                            </div>
                            <div>
                                <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Tailleur & Date</label>
                                <div className="grid grid-cols-2 gap-2">
                                    <select className="w-full p-2.5 border rounded-lg text-sm bg-indigo-50 border-indigo-100 font-bold" value={planningTarget?.tailorId || ''} onChange={e => {
                                        const t = tailleurs.find(t => t.id === e.target.value);
                                        if (t) setPlanningTarget({ ...(planningTarget || { date: new Date() }), tailorId: t.id, tailorName: t.nom });
                                    }}>
                                        <option value="">-- Choisir --</option>
                                        {tailleurs.map(t => <option key={t.id} value={t.id}>{t.nom}</option>)}
                                    </select>
                                    <input type="date" className="w-full p-2.5 border rounded-lg text-sm" value={planningTarget?.date.toISOString().split('T')[0] || new Date().toISOString().split('T')[0]} onChange={e => setPlanningTarget({... (planningTarget || {tailorId: '', tailorName: ''}), date: new Date(e.target.value)})}/>
                                </div>
                            </div>
                        </div>
                        <div className="p-4 bg-gray-50 border-t flex justify-end gap-3 rounded-b-xl">
                            <button onClick={() => setTaskModalOpen(false)} className="px-4 py-2 text-gray-500 font-bold hover:bg-gray-200">Annuler</button>
                            <button onClick={handleSaveTask} disabled={!newTaskData.orderId || !planningTarget?.tailorId} className="px-6 py-2 bg-brand-600 text-white rounded-lg font-bold shadow-lg hover:bg-brand-700 disabled:opacity-50">Confirmer</button>
                        </div>
                    </div>
                </div>
            )}

            {/* MODAL TRANSFERT (KANBAN) */}
            {moveModal && (
                <div className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm p-6">
                        <div className="flex items-center gap-3 text-brand-600 mb-4"><RefreshCw size={24}/><h3 className="text-lg font-bold">Passer en {moveModal.toStatus}</h3></div>
                        <p className="text-sm text-gray-600 mb-4">Combien de pièces voulez-vous transférer ?</p>
                        <div className="space-y-4">
                            <div className="flex items-center gap-4">
                                <input type="range" min="1" max={moveModal.maxQty} value={moveModal.qty} onChange={e => setMoveModal({...moveModal, qty: parseInt(e.target.value)})} className="flex-1 accent-brand-600"/>
                                <span className="font-bold text-xl text-brand-700 bg-brand-50 px-4 py-2 rounded-lg border border-brand-200">{moveModal.qty} / {moveModal.maxQty}</span>
                            </div>
                            <div className="flex justify-end gap-3 pt-2">
                                <button onClick={() => setMoveModal(null)} className="px-4 py-2 text-gray-500 font-bold">Annuler</button>
                                <button onClick={() => executeMove(moveModal.order, moveModal.fromStatus, moveModal.toStatus, moveModal.qty)} className="px-6 py-2 bg-brand-600 text-white rounded-lg font-bold hover:bg-brand-700 shadow-lg">Confirmer</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ProductionView;
