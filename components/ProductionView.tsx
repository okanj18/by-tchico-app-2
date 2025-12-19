
import React, { useState, useMemo, useEffect } from 'react';
import { Commande, Employe, Client, Article, StatutCommande, RoleEmploye, ModePaiement, CompteFinancier, CompanyAssets, TacheProduction, ActionProduction, ElementCommande, PaiementClient } from '../types';
import { COMPANY_CONFIG } from '../config';
import { Scissors, LayoutGrid, List, LayoutList, Users, BarChart2, Archive, Search, Camera, Filter, Plus, X, Trophy, Activity, AlertTriangle, Clock, AlertCircle, QrCode, Edit2, Shirt, Calendar, MessageSquare, History, EyeOff, Printer, MessageCircle, Wallet, CheckSquare, Ban, Save, Trash2, ArrowUpDown, Ruler, ChevronRight, RefreshCw, Columns, CheckCircle, Eye, AlertOctagon, FileText, CreditCard, CalendarRange, ChevronLeft, Zap, PenTool, PieChart, MoveRight, UserPlus } from 'lucide-react';
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
    { id: 'AUTRE', label: 'Autre', icon: FileText, color: 'text-gray-600 bg-gray-50 border-gray-200' },
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
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isEditingOrder, setIsEditingOrder] = useState(false);
    const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
    const [taskModalOpen, setTaskModalOpen] = useState(false);
    const [planningTarget, setPlanningTarget] = useState<{ tailorId: string, tailorName: string, date: Date } | null>(null);
    
    // DRAG & DROP STATE
    const [draggedInfo, setDraggedInfo] = useState<{orderId: string, fromStatus: string} | null>(null);
    const [moveModal, setMoveModal] = useState<{order: Commande, fromStatus: string, toStatus: string, maxQty: number, qty: number} | null>(null);

    const [newTaskData, setNewTaskData] = useState<{ 
        orderId: string, 
        action: ActionProduction, 
        quantite: number, 
        note: string,
        elementNom: string 
    }>({ orderId: '', action: 'COUTURE', quantite: 1, note: '', elementNom: '' });

    const [selectedClientId, setSelectedClientId] = useState('');
    const [notes, setNotes] = useState('');
    const [dateLivraison, setDateLivraison] = useState('');
    const [selectedTailleurs, setSelectedTailleurs] = useState<string[]>([]);
    const [orderElements, setOrderElements] = useState<{id: string, nom: string, quantite: number}[]>([{id: '1', nom: '', quantite: 1}]);
    const [prixBase, setPrixBase] = useState(0);
    const [avance, setAvance] = useState(0);
    const [tvaEnabled, setTvaEnabled] = useState(false);
    const [remise, setRemise] = useState(0);
    const [initialPaymentMethod, setInitialPaymentMethod] = useState<ModePaiement>('ESPECE');
    const [initialAccountId, setInitialAccountId] = useState('');
    const [ventilation, setVentilation] = useState<Record<string, number>>({});

    const tailleurs = employes.filter(e => e.role === RoleEmploye.TAILLEUR || e.role === RoleEmploye.CHEF_ATELIER || e.role === RoleEmploye.STAGIAIRE);

    const filteredCommandes = useMemo(() => {
        return commandes.filter(c => {
            if (c.type !== 'SUR_MESURE') return false; 
            const isCompleted = c.statut === StatutCommande.LIVRE || c.statut === StatutCommande.ANNULE;
            if (viewMode !== 'HISTORY' && viewMode !== 'PERFORMANCE') {
                 if (isCompleted) return false;
            }
            const matchesSearch = c.clientNom.toLowerCase().includes(searchTerm.toLowerCase()) || 
                                  c.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
                                  c.description.toLowerCase().includes(searchTerm.toLowerCase());
            return matchesSearch;
        }).sort((a, b) => new Date(b.dateCommande).getTime() - new Date(a.dateCommande).getTime());
    }, [commandes, searchTerm, viewMode]);

    const planningData = useMemo(() => {
        const today = new Date();
        today.setHours(0,0,0,0);
        const days = Array.from({length: 7}, (_, i) => {
            const d = new Date(agendaBaseDate);
            d.setDate(agendaBaseDate.getDate() + i);
            return d;
        });
        return { days, today };
    }, [agendaBaseDate]);

    const handleDragStart = (orderId: string, fromStatus: string) => {
        setDraggedInfo({ orderId, fromStatus });
    };

    const handleDrop = (toStatus: string) => {
        if (!draggedInfo || draggedInfo.fromStatus === toStatus) {
            setDraggedInfo(null);
            return;
        }

        const order = commandes.find(c => c.id === draggedInfo.orderId);
        if (!order) return;

        const currentQtyInSource = order.repartitionStatuts ? (order.repartitionStatuts[draggedInfo.fromStatus] || 0) : order.quantite;

        if (currentQtyInSource === 1) {
            executeMove(order, draggedInfo.fromStatus, toStatus, 1);
        } else {
            setMoveModal({ order, fromStatus: draggedInfo.fromStatus, toStatus, maxQty: currentQtyInSource, qty: currentQtyInSource });
        }
        setDraggedInfo(null);
    };

    const executeMove = (order: Commande, from: string, to: string, qty: number) => {
        const newRepartition = { ...(order.repartitionStatuts || { [order.statut]: order.quantite }) };
        
        // Déduction
        newRepartition[from] = (newRepartition[from] || 0) - qty;
        if (newRepartition[from] <= 0) delete newRepartition[from];
        
        // Ajout
        newRepartition[to] = (newRepartition[to] || 0) + qty;

        // Calcul du statut principal (le plus avancé)
        const statusOrder = [StatutCommande.EN_ATTENTE, StatutCommande.EN_COUPE, StatutCommande.COUTURE, StatutCommande.FINITION, StatutCommande.PRET];
        let mostAdvanced = order.statut as string;
        statusOrder.forEach(s => {
            if (newRepartition[s] > 0) mostAdvanced = s;
        });

        onUpdateOrder({ ...order, repartitionStatuts: newRepartition, statut: mostAdvanced });
        setMoveModal(null);

        // --- SYNCHRONISATION AUTOMATIQUE AGENDA (KANBAN -> AGENDA) ---
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
                note: `Généré automatiquement via Kanban`,
                elementNom: order.description
            });
            // Réinitialiser la cible pour forcer l'utilisateur à choisir le tailleur/date sur la vue agenda ou dans la modal
            setPlanningTarget(null);
            setTaskModalOpen(true);
        }
    };

    const handleSaveTask = () => {
        if (!newTaskData.orderId || !newTaskData.action) return;
        
        const order = commandes.find(c => c.id === newTaskData.orderId);
        if (!order) return;

        const dateToUse = planningTarget?.date.toISOString().split('T')[0] || new Date().toISOString().split('T')[0];
        const tailorToUse = planningTarget?.tailorId || '';

        if (!tailorToUse) {
            alert("Veuillez sélectionner un tailleur pour l'assignation.");
            return;
        }

        const newTask: TacheProduction = {
            id: `TASK_${Date.now()}`, 
            commandeId: order.id, 
            action: newTaskData.action,
            quantite: newTaskData.quantite, 
            note: newTaskData.note, 
            elementNom: newTaskData.elementNom,
            date: dateToUse, 
            tailleurId: tailorToUse, 
            statut: 'A_FAIRE'
        };

        const updatedOrder: Commande = { ...order, taches: [...(order.taches || []), newTask] };
        onUpdateOrder(updatedOrder);
        setTaskModalOpen(false);
        setNewTaskData({ orderId: '', action: 'COUTURE', quantite: 1, note: '', elementNom: '' });
        setPlanningTarget(null);
    };

    const getTasksForTailor = (tailorId: string, date: Date) => {
        const dateStr = date.toISOString().split('T')[0];
        const tasks: { task: TacheProduction, order: Commande }[] = [];
        commandes.forEach(order => {
            if (order.taches) {
                order.taches.forEach(t => {
                    if (t.tailleurId === tailorId && t.date === dateStr) {
                        tasks.push({ task: t, order });
                    }
                });
            }
        });
        return tasks;
    };

    const columns = [
        StatutCommande.EN_ATTENTE,
        StatutCommande.EN_COUPE,
        StatutCommande.COUTURE,
        StatutCommande.FINITION,
        StatutCommande.PRET
    ];

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
            {/* HEADER */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 shrink-0">
                <div className="flex items-center gap-4">
                    <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2"><Scissors className="text-brand-600"/> Atelier Production</h2>
                    <div className="flex gap-2">
                        <button onClick={() => setIsScannerOpen(true)} className="bg-gray-800 text-white px-3 py-1.5 rounded-lg flex items-center gap-2 text-xs font-bold hover:bg-black transition-all shadow-sm"><Camera size={14}/> Scanner</button>
                        <button onClick={() => setViewMode('KANBAN')} className="bg-brand-600 text-white px-4 py-1.5 rounded-lg flex items-center gap-2 text-xs font-bold hover:bg-brand-700 transition-all shadow-md"><Columns size={14}/> Kanban</button>
                    </div>
                </div>
                <div className="flex flex-wrap bg-white border p-1 rounded-lg">
                    <button onClick={() => setViewMode('PLANNING')} className={`px-3 py-1.5 text-xs font-bold rounded flex items-center gap-1 ${viewMode === 'PLANNING' ? 'bg-gray-100 text-brand-700' : 'text-gray-500'}`}><CalendarRange size={14}/> Agenda</button>
                    <button onClick={() => setViewMode('KANBAN')} className={`px-3 py-1.5 text-xs font-bold rounded flex items-center gap-1 ${viewMode === 'KANBAN' ? 'bg-gray-100 text-brand-700' : 'text-gray-500'}`}><Columns size={14}/> Kanban</button>
                    <button onClick={() => setViewMode('ORDERS')} className={`px-3 py-1.5 text-xs font-bold rounded flex items-center gap-1 ${viewMode === 'ORDERS' ? 'bg-gray-100 text-brand-700' : 'text-gray-500'}`}><LayoutList size={14}/> Liste</button>
                    <button onClick={() => setViewMode('HISTORY')} className={`px-3 py-1.5 text-xs font-bold rounded flex items-center gap-1 ${viewMode === 'HISTORY' ? 'bg-gray-100 text-brand-700' : 'text-gray-500'}`}><History size={14}/> Historique</button>
                    <button onClick={() => setViewMode('TAILORS')} className={`px-3 py-1.5 text-xs font-bold rounded flex items-center gap-1 ${viewMode === 'TAILORS' ? 'bg-gray-100 text-brand-700' : 'text-gray-500'}`}><Users size={14}/> Tailleurs</button>
                </div>
            </div>

            {/* SEARCH */}
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
                        <span className="text-xs font-bold text-gray-600 whitespace-nowrap min-w-[120px] text-center">
                            {planningData.days[0].toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })} - {planningData.days[6].toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
                        </span>
                        <button onClick={() => setAgendaBaseDate(d => { const n = new Date(d); n.setDate(n.getDate() + 7); return n; })} className="p-2 border rounded hover:bg-gray-50"><ChevronRight size={16}/></button>
                        <button onClick={() => setAgendaBaseDate(new Date())} className="px-3 py-2 text-xs font-bold border rounded hover:bg-gray-50">Aujourd'hui</button>
                    </div>
                )}
            </div>

            {/* MAIN CONTENT AREA */}
            <div className="flex-1 overflow-hidden">
                {viewMode === 'PLANNING' && (
                    <div className="bg-white border rounded-xl shadow-sm h-full flex flex-col overflow-hidden">
                        <div className="flex-1 overflow-auto">
                            <table className="w-full border-collapse table-fixed min-w-[1200px]">
                                <thead className="sticky top-0 z-20 bg-gray-50">
                                    <tr>
                                        <th className="w-48 p-3 border-b border-r bg-gray-50 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Tailleur</th>
                                        {planningData.days.map((day, i) => {
                                            const isToday = day.toISOString().split('T')[0] === planningData.today.toISOString().split('T')[0];
                                            return (
                                                <th key={i} className={`p-3 border-b text-center text-xs font-bold uppercase tracking-wider ${isToday ? 'bg-brand-50 text-brand-700' : 'text-gray-500'}`}>
                                                    {day.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric' })}
                                                </th>
                                            );
                                        })}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {tailleurs.map(tailor => (
                                        <tr key={tailor.id} className="hover:bg-gray-50/50 group">
                                            <td className="p-3 border-r bg-gray-50/30 sticky left-0 z-10">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-8 h-8 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center font-bold text-xs uppercase">{tailor.nom.charAt(0)}</div>
                                                    <div>
                                                        <p className="text-xs font-bold text-gray-800 truncate w-32">{tailor.nom}</p>
                                                        <p className="text-[10px] text-gray-400 uppercase tracking-tighter">{tailor.role}</p>
                                                    </div>
                                                </div>
                                            </td>
                                            {planningData.days.map((day, i) => {
                                                const tasks = getTasksForTailor(tailor.id, day);
                                                return (
                                                    <td 
                                                        key={i} 
                                                        className="p-2 border-r last:border-r-0 h-32 vertical-top relative cursor-pointer hover:bg-brand-50/30 transition-colors"
                                                        onClick={() => {
                                                            setPlanningTarget({ tailorId: tailor.id, tailorName: tailor.nom, date: day });
                                                            setNewTaskData({ ...newTaskData, orderId: '' }); // Force selection order
                                                            setTaskModalOpen(true);
                                                        }}
                                                    >
                                                        <div className="space-y-1.5 h-full overflow-y-auto no-scrollbar">
                                                            {tasks.map(({task, order}) => (
                                                                <div 
                                                                    key={task.id} 
                                                                    className={`p-1.5 rounded border text-[10px] shadow-sm relative group/task ${task.statut === 'FAIT' ? 'bg-green-50 border-green-200 text-green-700 opacity-60' : 'bg-white border-brand-200 text-brand-900 border-l-4 border-l-brand-500'}`}
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        if (task.statut === 'A_FAIRE' && window.confirm("Marquer cette tâche comme terminée ?")) {
                                                                            const updatedTaches = (order.taches || []).map(t => t.id === task.id ? { ...t, statut: 'FAIT' as const } : t);
                                                                            onUpdateOrder({ ...order, taches: updatedTaches });
                                                                        }
                                                                    }}
                                                                >
                                                                    <div className="flex justify-between items-start">
                                                                        <span className="font-bold truncate pr-1">{task.action} x{task.quantite}</span>
                                                                        {task.statut === 'FAIT' && <CheckCircle size={10} className="text-green-600 shrink-0"/>}
                                                                    </div>
                                                                    <p className="opacity-70 truncate">{order.clientNom}</p>
                                                                </div>
                                                            ))}
                                                            {tasks.length === 0 && <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"><Plus size={16} className="text-brand-300" /></div>}
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
                    <div className="flex gap-4 h-full overflow-x-auto pb-4 custom-scrollbar">
                        {columns.map(status => (
                            <div 
                                key={status} 
                                className="flex-1 min-w-[280px] bg-gray-100/50 rounded-xl flex flex-col h-full border border-gray-200"
                                onDragOver={(e) => e.preventDefault()}
                                onDrop={() => handleDrop(status)}
                            >
                                <div className="p-3 border-b flex justify-between items-center bg-white rounded-t-xl shrink-0">
                                    <h3 className="text-sm font-bold text-gray-700 flex items-center gap-2">
                                        {getStatusIcon(status)} {status}
                                    </h3>
                                    <span className="bg-gray-200 text-gray-600 text-[10px] px-2 py-0.5 rounded-full font-bold">
                                        {filteredCommandes.reduce((acc, c) => acc + (c.repartitionStatuts?.[status] || (c.statut === status ? c.quantite : 0)), 0)}
                                    </span>
                                </div>
                                <div className="flex-1 overflow-y-auto p-2 space-y-3">
                                    {filteredCommandes.filter(c => (c.repartitionStatuts?.[status] || 0) > 0 || (!c.repartitionStatuts && c.statut === status)).map(order => (
                                        <div 
                                            key={order.id} 
                                            draggable 
                                            onDragStart={() => handleDragStart(order.id, status)}
                                            className="bg-white p-3 rounded-lg shadow-sm border border-gray-200 cursor-grab active:cursor-grabbing hover:border-brand-300 hover:shadow-md transition-all group relative"
                                        >
                                            <div className="flex justify-between items-start mb-2">
                                                <span className="text-[10px] font-mono text-gray-400">#{order.id.slice(-5)}</span>
                                                <span className="bg-brand-50 text-brand-700 text-[10px] px-1.5 py-0.5 rounded font-bold">
                                                    Qté: {order.repartitionStatuts?.[status] || order.quantite}
                                                </span>
                                            </div>
                                            <p className="font-bold text-gray-800 text-sm mb-1">{order.clientNom}</p>
                                            <p className="text-[10px] text-gray-500 line-clamp-2">{order.description}</p>
                                            <div className="mt-3 flex justify-between items-center text-[9px] font-bold">
                                                <span className="text-orange-600 flex items-center gap-1"><Calendar size={10}/> {new Date(order.dateLivraisonPrevue).toLocaleDateString()}</span>
                                                {order.taches && order.taches.filter(t => t.statut === 'A_FAIRE').length > 0 && (
                                                    <span className="text-brand-600 bg-brand-50 px-1 rounded">Assigné</span>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {viewMode === 'ORDERS' && (
                    <div className="bg-white border rounded-xl overflow-hidden shadow-sm h-full flex flex-col">
                        <div className="overflow-y-auto flex-1">
                            <table className="w-full text-sm text-left">
                                <thead className="bg-gray-50 text-gray-600 font-bold border-b sticky top-0 z-10">
                                    <tr>
                                        <th className="p-3">Ref / Client</th>
                                        <th className="p-3">Description</th>
                                        <th className="p-3">Livraison</th>
                                        <th className="p-3 text-center">Statut Actuel</th>
                                        <th className="p-3 text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {filteredCommandes.map(order => (
                                        <tr key={order.id} className="hover:bg-gray-50">
                                            <td className="p-3">
                                                <div className="font-bold text-gray-800 truncate w-32">{order.clientNom}</div>
                                                <div className="text-[10px] text-gray-400 font-mono">#{order.id.slice(-6)}</div>
                                            </td>
                                            <td className="p-3 text-gray-500 text-xs truncate max-w-xs">{order.description}</td>
                                            <td className="p-3 text-gray-600">
                                                <div className="font-bold">{new Date(order.dateLivraisonPrevue).toLocaleDateString()}</div>
                                            </td>
                                            <td className="p-3 text-center">
                                                <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider border ${
                                                    order.statut === StatutCommande.PRET ? 'bg-green-50 text-green-700 border-green-200' :
                                                    order.statut === StatutCommande.EN_COUPE ? 'bg-blue-50 text-blue-700 border-blue-200' :
                                                    'bg-gray-50 text-gray-600 border-gray-200'
                                                }`}>
                                                    {order.statut}
                                                </span>
                                            </td>
                                            <td className="p-3 text-right">
                                                <button 
                                                    onClick={() => {
                                                        setNewTaskData({ orderId: order.id, action: 'COUTURE', quantite: order.quantite, note: '', elementNom: order.description });
                                                        setTaskModalOpen(true);
                                                    }}
                                                    className="p-1.5 text-brand-600 hover:bg-brand-50 rounded"
                                                    title="Assigner"
                                                >
                                                    <UserPlus size={18}/>
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </div>

            {/* MODAL MOVE QTY */}
            {moveModal && (
                <div className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm p-6 animate-in zoom-in duration-200">
                        <div className="flex items-center gap-3 text-brand-600 mb-4">
                            <RefreshCw size={24} />
                            <h3 className="text-lg font-bold">Transfert Progressif</h3>
                        </div>
                        <p className="text-sm text-gray-600 mb-4">
                            Combien de pièces voulez-vous passer de <strong>{moveModal.fromStatus}</strong> vers <strong>{moveModal.toStatus}</strong> ?
                        </p>
                        <div className="space-y-4">
                            <div className="flex items-center gap-4">
                                <input 
                                    type="range" 
                                    min="1" 
                                    max={moveModal.maxQty} 
                                    value={moveModal.qty} 
                                    onChange={(e) => setMoveModal({ ...moveModal, qty: parseInt(e.target.value) })}
                                    className="flex-1 accent-brand-600"
                                />
                                <span className="font-bold text-xl text-brand-700 bg-brand-50 px-4 py-2 rounded-lg border border-brand-200">
                                    {moveModal.qty} / {moveModal.maxQty}
                                </span>
                            </div>
                            <div className="flex justify-end gap-3 pt-2">
                                <button onClick={() => setMoveModal(null)} className="px-4 py-2 text-gray-500 hover:bg-gray-100 rounded-lg font-bold">Annuler</button>
                                <button 
                                    onClick={() => executeMove(moveModal.order, moveModal.fromStatus, moveModal.toStatus, moveModal.qty)}
                                    className="px-6 py-2 bg-brand-600 text-white rounded-lg font-bold hover:bg-brand-700 shadow-lg"
                                >
                                    Confirmer le passage
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* MODAL PLANIFICATION TACHE */}
            {taskModalOpen && (
                <div className="fixed inset-0 bg-black/60 z-[110] flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-md animate-in zoom-in duration-200 flex flex-col max-h-[90vh]">
                        <div className="p-4 border-b flex justify-between items-center bg-gray-50 rounded-t-xl shrink-0">
                            <h3 className="font-bold text-gray-800 flex items-center gap-2">
                                <Calendar size={18} className="text-brand-600"/>
                                Planifier Production
                            </h3>
                            <button onClick={() => setTaskModalOpen(false)}><X size={20}/></button>
                        </div>
                        
                        <div className="p-6 space-y-5 overflow-y-auto">
                            <div>
                                <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Commande</label>
                                <select 
                                    className="w-full p-2.5 border border-gray-300 rounded-lg text-sm bg-white"
                                    value={newTaskData.orderId}
                                    onChange={(e) => {
                                        const order = commandes.find(c => c.id === e.target.value);
                                        setNewTaskData({ ...newTaskData, orderId: e.target.value, quantite: order?.quantite || 1, elementNom: order?.description || '' });
                                    }}
                                >
                                    <option value="">-- Sélectionner Commande --</option>
                                    {filteredCommandes.map(c => <option key={c.id} value={c.id}>{c.clientNom} (#{c.id.slice(-5)})</option>)}
                                </select>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Action</label>
                                    <div className="grid grid-cols-2 gap-2">
                                        {PRODUCTION_ACTIONS.map(a => (
                                            <button
                                                key={a.id}
                                                onClick={() => setNewTaskData({ ...newTaskData, action: a.id })}
                                                className={`p-2 rounded-lg border flex flex-col items-center gap-1 transition-all ${newTaskData.action === a.id ? 'bg-brand-600 border-brand-600 text-white shadow-md' : 'bg-white text-gray-500 border-gray-200 hover:border-brand-200'}`}
                                            >
                                                <a.icon size={16} />
                                                <span className="text-[10px] font-bold uppercase">{a.label}</span>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Quantité</label>
                                        <input 
                                            type="number" 
                                            className="w-full p-2.5 border rounded-lg font-bold text-center text-lg"
                                            value={newTaskData.quantite}
                                            onChange={(e) => setNewTaskData({ ...newTaskData, quantite: parseInt(e.target.value) || 1 })}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Tailleur / Agent</label>
                                        <select 
                                            className="w-full p-2.5 border border-gray-300 rounded-lg text-sm bg-indigo-50 border-indigo-200 font-bold"
                                            value={planningTarget?.tailorId || ''}
                                            onChange={(e) => {
                                                const t = tailleurs.find(t => t.id === e.target.value);
                                                if (t) setPlanningTarget({ ...(planningTarget || { date: new Date() }), tailorId: t.id, tailorName: t.nom });
                                            }}
                                        >
                                            <option value="">-- Choisir Tailleur --</option>
                                            {tailleurs.map(t => <option key={t.id} value={t.id}>{t.nom}</option>)}
                                        </select>
                                    </div>
                                </div>
                            </div>

                            <div>
                                <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Date Planifiée</label>
                                <input 
                                    type="date" 
                                    className="w-full p-2.5 border rounded-lg text-sm bg-white"
                                    value={planningTarget?.date.toISOString().split('T')[0] || new Date().toISOString().split('T')[0]}
                                    onChange={(e) => setPlanningTarget({ ...(planningTarget || { tailorId: '', tailorName: '' }), date: new Date(e.target.value) })}
                                />
                            </div>

                            <div>
                                <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Note (Opt.)</label>
                                <textarea 
                                    className="w-full p-2 border rounded-lg text-xs" 
                                    rows={2} 
                                    placeholder="Instructions spécifiques..."
                                    value={newTaskData.note}
                                    onChange={(e) => setNewTaskData({ ...newTaskData, note: e.target.value })}
                                />
                            </div>
                        </div>

                        <div className="p-4 bg-gray-50 border-t flex justify-end gap-3 shrink-0 rounded-b-xl">
                            <button onClick={() => setTaskModalOpen(false)} className="px-4 py-2 text-gray-500 font-bold hover:bg-gray-200 rounded-lg">Fermer</button>
                            <button 
                                onClick={handleSaveTask}
                                disabled={!newTaskData.orderId || !planningTarget?.tailorId}
                                className="px-6 py-2 bg-brand-600 text-white rounded-lg font-bold shadow-lg hover:bg-brand-700 disabled:opacity-50 flex items-center gap-2"
                            >
                                <CheckSquare size={18} /> Confirmer la planification
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ProductionView;
