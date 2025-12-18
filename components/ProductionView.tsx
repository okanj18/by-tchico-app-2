import React, { useState, useMemo, useEffect } from 'react';
import { Commande, Employe, Client, Article, StatutCommande, RoleEmploye, ModePaiement, CompteFinancier, CompanyAssets, TacheProduction, ActionProduction, ElementCommande } from '../types';
import { COMPANY_CONFIG } from '../config';
import { Scissors, LayoutGrid, List, LayoutList, Users, BarChart2, Archive, Search, Camera, Filter, Plus, X, Trophy, Activity, AlertTriangle, Clock, AlertCircle, QrCode, Edit2, Shirt, Calendar, MessageSquare, History, EyeOff, Printer, MessageCircle, Wallet, CheckSquare, Ban, Save, Trash2, ArrowUpDown, Ruler, ChevronRight, RefreshCw, Columns, CheckCircle, Eye, AlertOctagon, FileText, CreditCard, CalendarRange, ChevronLeft, Zap, PenTool } from 'lucide-react';
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
    // --- STATE ---
    const [viewMode, setViewMode] = useState<'ORDERS' | 'TAILORS' | 'PERFORMANCE' | 'KANBAN' | 'HISTORY' | 'PLANNING'>('PLANNING');
    const [showArchived, setShowArchived] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    
    // --- AGENDA NAVIGATION STATE ---
    const [agendaBaseDate, setAgendaBaseDate] = useState(() => {
        const d = new Date();
        d.setHours(0,0,0,0);
        return d;
    });

    // SCANNER STATE
    const [isScannerOpen, setIsScannerOpen] = useState(false);

    // FILTERS
    const [showFiltersPanel, setShowFiltersPanel] = useState(false);
    const [filterStatus, setFilterStatus] = useState('ALL');
    const [filterTailor, setFilterTailor] = useState('ALL');
    const [filterDeliveryDateStart, setFilterDeliveryDateStart] = useState('');
    const [filterDeliveryDateEnd, setFilterDeliveryDateEnd] = useState('');
    const [historyFilterDebt, setHistoryFilterDebt] = useState(false); 
    
    // MODALS
    const [qrModalOpen, setQrModalOpen] = useState(false);
    const [qrOrder, setQrOrder] = useState<Commande | null>(null);

    const [paymentModalOpen, setPaymentModalOpen] = useState(false);
    const [selectedOrderForPayment, setSelectedOrderForPayment] = useState<Commande | null>(null);
    const [paymentAmount, setPaymentAmount] = useState(0);
    const [paymentMethod, setPaymentMethod] = useState<ModePaiement>('ESPECE');
    const [paymentAccountId, setPaymentAccountId] = useState('');

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isEditingOrder, setIsEditingOrder] = useState(false);
    const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);

    const [paymentHistoryModalOpen, setPaymentHistoryModalOpen] = useState(false);
    const [selectedOrderForHistory, setSelectedOrderForHistory] = useState<Commande | null>(null);
    
    const [taskModalOpen, setTaskModalOpen] = useState(false);
    const [planningTarget, setPlanningTarget] = useState<{ tailorId: string, tailorName: string, date: Date } | null>(null);
    
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
    const [consommations, setConsommations] = useState<{ id: string, articleId: string, variante: string, quantite: number }[]>([]);
    const [orderElements, setOrderElements] = useState<{id: string, nom: string, quantite: number}[]>([{id: '1', nom: '', quantite: 1}]);

    const [applyTva, setApplyTva] = useState(false);
    const [prixBase, setPrixBase] = useState(0);
    const [remise, setRemise] = useState(0);
    const [avance, setAvance] = useState(0);
    const [initialPaymentMethod, setInitialPaymentMethod] = useState<ModePaiement>('ESPECE');
    const [initialAccountId, setInitialAccountId] = useState('');

    const canSeeFinance = userRole === RoleEmploye.ADMIN || userRole === RoleEmploye.GERANT || userRole === RoleEmploye.CHEF_ATELIER;
    const tailleurs = employes.filter(e => e.role === RoleEmploye.TAILLEUR || e.role === RoleEmploye.CHEF_ATELIER || e.role === RoleEmploye.STAGIAIRE);

    const filteredCommandes = useMemo(() => {
        return commandes.filter(c => {
            if (c.type !== 'SUR_MESURE') return false; 
            const isCompleted = c.statut === StatutCommande.LIVRE || c.statut === StatutCommande.ANNULE;
            if (viewMode === 'HISTORY') {
                if (!isCompleted) return false;
                if (historyFilterDebt && c.reste <= 0) return false;
            } else if (['KANBAN', 'ORDERS', 'TAILORS', 'PLANNING'].includes(viewMode)) {
                if (isCompleted) return false;
            }
            const matchesSearch = c.clientNom.toLowerCase().includes(searchTerm.toLowerCase()) || 
                                  c.id.toLowerCase().includes(searchTerm.toLowerCase());
            return matchesSearch;
        }).sort((a, b) => new Date(b.dateLivraisonPrevue).getTime() - new Date(a.dateLivraisonPrevue).getTime());
    }, [commandes, searchTerm, viewMode, historyFilterDebt]);

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

    const KANBAN_COLUMNS = [
        { id: StatutCommande.EN_ATTENTE, label: 'En Attente', color: 'border-gray-300 bg-gray-50' },
        { id: StatutCommande.EN_COUPE, label: 'Coupe', color: 'border-blue-300 bg-blue-50' },
        { id: StatutCommande.COUTURE, label: 'Couture', color: 'border-indigo-300 bg-indigo-50' },
        { id: StatutCommande.FINITION, label: 'Finition', color: 'border-purple-300 bg-purple-50' },
        { id: StatutCommande.PRET, label: 'Prêt', color: 'border-green-300 bg-green-50' }
    ];

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

    const navigateAgenda = (direction: 'PREV' | 'NEXT') => {
        const newDate = new Date(agendaBaseDate);
        if (direction === 'PREV') newDate.setDate(agendaBaseDate.getDate() - 7);
        else newDate.setDate(agendaBaseDate.getDate() + 7);
        setAgendaBaseDate(newDate);
    };

    const resetToToday = () => {
        const d = new Date();
        d.setHours(0,0,0,0);
        setAgendaBaseDate(d);
    };

    const handleForceRefresh = () => window.location.reload();

    const handleOpenEditModal = (cmd: Commande) => {
        setIsEditingOrder(true); setSelectedOrderId(cmd.id);
        setSelectedClientId(cmd.clientId); 
        setNotes(cmd.notes || '');
        setDateLivraison(cmd.dateLivraisonPrevue.split('T')[0]);
        setSelectedTailleurs(cmd.tailleursIds);
        setApplyTva(!!cmd.tva && cmd.tva > 0);
        setPrixBase((cmd.prixTotal || 0) - (cmd.tva || 0) + (cmd.remise || 0));
        setRemise(cmd.remise || 0);
        setAvance(cmd.avance);
        if (cmd.elements && cmd.elements.length > 0) {
            setOrderElements(cmd.elements.map((el, i) => ({ id: `el_${i}`, nom: el.nom, quantite: el.quantite })));
        } else {
            setOrderElements([{ id: '1', nom: cmd.description, quantite: cmd.quantite }]);
        }
        setIsModalOpen(true);
    };

    const handleUpdateStatus = (id: string, status: StatutCommande) => onUpdateStatus(id, status);

    const handleSaveOrder = () => {
        if (!selectedClientId || !dateLivraison) return;
        const validElements = orderElements.filter(e => e.nom.trim() !== '');
        if (validElements.length === 0) return;

        const client = clients.find(c => c.id === selectedClientId);
        const descriptionStr = validElements.map(e => `${e.quantite} ${e.nom}`).join(', ');
        const totalQuantite = validElements.reduce((acc, e) => acc + e.quantite, 0);
        const montantTotalTTC = Math.max(0, prixBase - remise) + (applyTva ? Math.round(Math.max(0, prixBase - remise) * COMPANY_CONFIG.tvaRate) : 0);

        const orderData: Commande = {
            id: selectedOrderId || `CMD${Date.now()}`,
            clientId: selectedClientId,
            clientNom: client?.nom || 'Inconnu',
            description: descriptionStr, 
            notes, 
            quantite: totalQuantite,
            elements: validElements.map(e => ({ nom: e.nom, quantite: e.quantite })),
            dateCommande: isEditingOrder ? (commandes.find(c => c.id === selectedOrderId)?.dateCommande || new Date().toISOString()) : new Date().toISOString(),
            dateLivraisonPrevue: dateLivraison,
            statut: isEditingOrder ? (commandes.find(c => c.id === selectedOrderId)?.statut || StatutCommande.EN_ATTENTE) : StatutCommande.EN_ATTENTE,
            tailleursIds: selectedTailleurs,
            prixTotal: montantTotalTTC,
            tva: applyTva ? Math.round(Math.max(0, prixBase - remise) * COMPANY_CONFIG.tvaRate) : 0,
            remise, avance, reste: Math.max(0, montantTotalTTC - avance),
            type: 'SUR_MESURE',
            paiements: isEditingOrder ? (commandes.find(c => c.id === selectedOrderId)?.paiements || []) : [],
            consommations: consommations.map(c => ({ articleId: c.articleId, variante: c.variante, quantite: c.quantite })),
            taches: isEditingOrder ? (commandes.find(c => c.id === selectedOrderId)?.taches || []) : []
        };

        if (isEditingOrder) onUpdateOrder(orderData, initialAccountId, initialPaymentMethod);
        else onCreateOrder(orderData, [], initialPaymentMethod, initialAccountId);
        setIsModalOpen(false);
    };

    const handleUpdateOrderElement = (id: string, field: 'nom' | 'quantite', value: any) => {
        setOrderElements(orderElements.map(e => e.id === id ? { ...e, [field]: value } : e));
    };

    const openTaskModal = (tailorId: string, date: Date) => {
        const tailor = tailleurs.find(t => t.id === tailorId);
        if (!tailor) return;
        setPlanningTarget({ tailorId, tailorName: tailor.nom, date });
        setNewTaskData({ orderId: '', action: 'COUTURE', quantite: 1, note: '', elementNom: '' });
        setTaskModalOpen(true);
    };

    const handleSaveTask = () => {
        if (!planningTarget || !newTaskData.orderId) return;
        const order = commandes.find(c => c.id === newTaskData.orderId);
        if (!order) return;
        const newTask: TacheProduction = {
            id: `TASK_${Date.now()}`,
            commandeId: order.id,
            action: newTaskData.action,
            quantite: newTaskData.quantite,
            note: newTaskData.note,
            elementNom: newTaskData.elementNom || undefined,
            date: planningTarget.date.toISOString().split('T')[0],
            tailleurId: planningTarget.tailorId,
            statut: 'A_FAIRE'
        };
        const updatedOrder = { ...order, taches: [...(order.taches || []), newTask] };
        onUpdateOrder(updatedOrder);
        setTaskModalOpen(false);
    };

    const getStatusColor = (s: string) => {
        switch(s) {
            case StatutCommande.EN_ATTENTE: return 'bg-gray-100 text-gray-700';
            case StatutCommande.EN_COUPE: return 'bg-blue-100 text-blue-700';
            case StatutCommande.COUTURE: return 'bg-indigo-100 text-indigo-700';
            case StatutCommande.PRET: return 'bg-green-100 text-green-700';
            default: return 'bg-gray-50';
        }
    };

    const getActionStyle = (actionId: string) => {
        const action = PRODUCTION_ACTIONS.find(a => a.id === actionId);
        return action ? action.color : 'text-gray-600 bg-gray-50 border-gray-200';
    };

    const handleMarkAsDelivered = (orderId: string) => {
        if(window.confirm("Confirmer la livraison client ?")) onUpdateStatus(orderId, StatutCommande.LIVRE);
    };

    const selectedTaskOrder = filteredCommandes.find(c => c.id === newTaskData.orderId);

    return (
        <div className="space-y-6 h-[calc(100vh-8rem)] flex flex-col">
            {/* HEADER */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 shrink-0">
                <div>
                    <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2"><Scissors className="text-brand-600"/> Atelier Production</h2>
                </div>
                <div className="flex flex-wrap gap-2 items-center">
                    <button onClick={handleForceRefresh} className="bg-white border p-2 rounded-lg"><RefreshCw size={18} /></button>
                    <div className="flex bg-white border p-1 rounded-lg">
                        <button onClick={() => setViewMode('PLANNING')} className={`px-3 py-1.5 text-xs font-bold rounded flex items-center gap-1 ${viewMode === 'PLANNING' ? 'bg-gray-100 text-brand-700' : 'text-gray-500'}`}><CalendarRange size={14}/> Agenda</button>
                        <button onClick={() => setViewMode('KANBAN')} className={`px-3 py-1.5 text-xs font-bold rounded flex items-center gap-1 ${viewMode === 'KANBAN' ? 'bg-gray-100 text-brand-700' : 'text-gray-500'}`}><Columns size={14}/> Kanban</button>
                        <button onClick={() => setViewMode('ORDERS')} className={`px-3 py-1.5 text-xs font-bold rounded flex items-center gap-1 ${viewMode === 'ORDERS' ? 'bg-gray-100 text-brand-700' : 'text-gray-500'}`}><LayoutList size={14}/> Liste</button>
                    </div>
                </div>
            </div>

            {/* SEARCH */}
            <div className="bg-white p-3 rounded-lg border flex gap-3 items-center shrink-0">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-2.5 text-gray-400" size={16}/>
                    <input type="text" className="w-full pl-9 pr-4 py-2 bg-gray-50 border-none rounded-lg text-sm" placeholder="Rechercher..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)}/>
                </div>
            </div>

            {/* VIEW: AGENDA (ALIGNMENT FIXED) */}
            {viewMode === 'PLANNING' && (
                <div className="flex-1 bg-white rounded-xl shadow-sm border border-gray-200 flex flex-col overflow-hidden">
                    <div className="p-4 bg-gray-50 border-b flex justify-between items-center shrink-0">
                        <div className="flex items-center gap-2">
                            <h3 className="font-bold text-gray-700">Planning de Production</h3>
                            <div className="flex items-center bg-white border rounded-lg ml-4">
                                <button onClick={() => navigateAgenda('PREV')} className="p-1.5 hover:bg-gray-100"><ChevronLeft size={18}/></button>
                                <button onClick={resetToToday} className="px-3 py-1 text-xs font-bold border-x">Aujourd'hui</button>
                                <button onClick={() => navigateAgenda('NEXT')} className="p-1.5 hover:bg-gray-100"><ChevronRight size={18}/></button>
                            </div>
                        </div>
                    </div>
                    <div className="flex-1 overflow-auto">
                        <div className="inline-block min-w-full">
                            {/* Head Dates */}
                            <div className="flex border-b bg-gray-50 sticky top-0 z-10">
                                <div className="w-56 shrink-0 p-3 font-bold text-gray-600 border-r sticky left-0 bg-gray-50 z-20">Tailleur</div>
                                {planningData.days.map(d => (
                                    <div key={d.toISOString()} className={`w-44 shrink-0 p-2 text-center border-r ${d.toDateString() === planningData.today.toDateString() ? 'bg-brand-50' : ''}`}>
                                        <div className="text-[10px] uppercase text-gray-400 font-bold">{d.toLocaleDateString(undefined, {weekday: 'short'})}</div>
                                        <div className="font-bold text-gray-800">{d.toLocaleDateString(undefined, {day: 'numeric', month: 'short'})}</div>
                                    </div>
                                ))}
                            </div>
                            {/* Rows */}
                            {tailleurs.map(t => (
                                <div key={t.id} className="flex border-b hover:bg-gray-50 transition-colors">
                                    <div className="w-56 shrink-0 p-3 border-r sticky left-0 bg-white z-10 flex items-center gap-2">
                                        <div className="w-8 h-8 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center font-bold text-xs shrink-0">{t.nom.charAt(0)}</div>
                                        <div className="truncate font-medium text-sm text-gray-700">{t.nom}</div>
                                    </div>
                                    {planningData.days.map(d => {
                                        const tasks = getTasksForTailor(t.id, d);
                                        return (
                                            <div 
                                                key={d.toISOString()} 
                                                className="w-44 shrink-0 p-2 border-r flex flex-col gap-1 min-h-[100px] cursor-pointer hover:bg-brand-50/20"
                                                onClick={() => openTaskModal(t.id, d)}
                                            >
                                                {tasks.map(({task, order}) => (
                                                    <div key={task.id} className={`p-2 rounded text-[10px] border-l-4 shadow-sm ${getActionStyle(task.action)}`}>
                                                        <div className="font-bold truncate">{order.clientNom}</div>
                                                        <div className="opacity-80 truncate">{task.elementNom || order.description}</div>
                                                        <div className="mt-1 font-bold">{task.action} {task.quantite > 1 && `x${task.quantite}`}</div>
                                                    </div>
                                                ))}
                                            </div>
                                        );
                                    })}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* KANBAN */}
            {viewMode === 'KANBAN' && (
                <div className="flex-1 overflow-x-auto pb-4">
                    <div className="flex gap-4 h-full min-w-max">
                        {KANBAN_COLUMNS.map(col => (
                            <div key={col.id} className={`w-72 flex flex-col rounded-xl border ${col.color}`}>
                                <div className="p-3 font-bold text-gray-700 border-b flex justify-between">
                                    <span>{col.label}</span>
                                    <span className="bg-white px-2 rounded-full text-xs">{filteredCommandes.filter(c => c.statut === col.id).length}</span>
                                </div>
                                <div className="flex-1 overflow-y-auto p-2 space-y-3">
                                    {filteredCommandes.filter(c => c.statut === col.id).map(cmd => (
                                        <div key={cmd.id} className="bg-white p-3 rounded-lg shadow-sm border border-gray-100 group relative">
                                            <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 flex gap-1">
                                                <button onClick={() => handleOpenEditModal(cmd)} className="p-1 hover:text-blue-600"><Edit2 size={12}/></button>
                                                <button onClick={() => handleMarkAsDelivered(cmd.id)} className="p-1 hover:text-green-600"><CheckCircle size={12}/></button>
                                            </div>
                                            <div className="font-bold text-sm">{cmd.clientNom}</div>
                                            <div className="text-xs text-gray-500 line-clamp-2">{cmd.description}</div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* GRID VIEW */}
            {viewMode === 'ORDERS' && (
                <div className="flex-1 overflow-y-auto">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pb-10">
                        {filteredCommandes.map(cmd => (
                            <div key={cmd.id} className="bg-white rounded-xl border shadow-sm flex flex-col overflow-hidden h-full">
                                <div className="p-5 flex-1 relative">
                                    <div className="absolute top-2 right-2 flex gap-1">
                                        <button onClick={() => handleOpenEditModal(cmd)} className="p-1.5 text-gray-400 hover:text-blue-600 bg-white shadow-sm rounded-full"><Edit2 size={16}/></button>
                                        <button onClick={() => handleMarkAsDelivered(cmd.id)} className="p-1.5 text-gray-400 hover:text-green-600 bg-white shadow-sm rounded-full"><CheckCircle size={16}/></button>
                                    </div>
                                    <h3 className="font-bold text-lg text-gray-800 truncate pr-14">{cmd.clientNom}</h3>
                                    <span className={`inline-block text-[10px] px-2 py-1 rounded font-bold uppercase tracking-wider mb-2 ${getStatusColor(cmd.statut)}`}>{cmd.statut}</span>
                                    <p className="text-sm text-gray-600 mb-3 line-clamp-2">{cmd.description}</p>
                                    <div className="flex items-center gap-4 text-xs text-gray-500">
                                        <div className="flex items-center gap-1"><Calendar size={12}/> {new Date(cmd.dateLivraisonPrevue).toLocaleDateString()}</div>
                                        <div className="flex items-center gap-1"><Shirt size={12}/> {cmd.quantite} pcs</div>
                                    </div>
                                </div>
                                <div className="p-3 bg-gray-50 border-t flex items-center justify-between">
                                    <div className="text-xs">{cmd.reste > 0 ? <span className="text-red-600 font-bold">Reste: {cmd.reste.toLocaleString()} F</span> : <span className="text-green-600 font-bold">Soldé</span>}</div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* MODALS */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-black bg-opacity-60 z-[80] flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col animate-in zoom-in duration-200">
                        <div className="p-4 border-b flex justify-between items-center bg-gray-50 rounded-t-xl">
                            <h3 className="font-bold text-lg">{isEditingOrder ? 'Modifier' : 'Nouvelle'} Commande</h3>
                            <button onClick={() => setIsModalOpen(false)}><X size={24} className="text-gray-400"/></button>
                        </div>
                        <div className="p-6 overflow-y-auto flex-1 space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div><label className="block text-sm font-medium mb-1">Client</label><select className="w-full p-2 border rounded" value={selectedClientId} onChange={e => setSelectedClientId(e.target.value)}><option value="">-- Client --</option>{clients.map(c => <option key={c.id} value={c.id}>{c.nom}</option>)}</select></div>
                                <div><label className="block text-sm font-medium mb-1">Date Livraison</label><input type="date" className="w-full p-2 border rounded" value={dateLivraison} onChange={e => setDateLivraison(e.target.value)}/></div>
                            </div>
                            <div className="bg-gray-50 p-4 rounded border">
                                <h4 className="font-bold text-sm mb-2 text-gray-700">Détail des articles</h4>
                                {orderElements.map((el) => (
                                    <div key={el.id} className="flex gap-2 mb-2">
                                        <input type="text" className="flex-1 p-2 border rounded text-sm" placeholder="Article (ex: Robe...)" value={el.nom} onChange={(e) => handleUpdateOrderElement(el.id, 'nom', e.target.value)} />
                                        <input type="number" className="w-20 p-2 border rounded text-sm text-center" min="1" value={el.quantite} onChange={(e) => handleUpdateOrderElement(el.id, 'quantite', parseInt(e.target.value) || 1)} />
                                    </div>
                                ))}
                                <button onClick={() => setOrderElements([...orderElements, {id:Date.now().toString(), nom:'', quantite:1}])} className="text-xs text-brand-600 font-bold flex items-center gap-1 mt-1"><Plus size={14}/> Ajouter article</button>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div><label className="block text-sm font-medium mb-1">Prix TTC</label><input type="number" className="w-full p-2 border rounded font-bold" value={prixBase} onChange={e => setPrixBase(parseInt(e.target.value) || 0)}/></div>
                                <div><label className="block text-sm font-medium mb-1">Avance</label><input type="number" className="w-full p-2 border rounded font-bold text-green-700" value={avance} onChange={e => setAvance(parseInt(e.target.value) || 0)}/></div>
                            </div>
                        </div>
                        <div className="p-4 border-t bg-gray-50 flex justify-end gap-3 rounded-b-xl"><button onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-gray-600">Annuler</button><button onClick={handleSaveOrder} className="px-6 py-2 bg-brand-600 text-white rounded font-bold">Enregistrer</button></div>
                    </div>
                </div>
            )}

            {taskModalOpen && planningTarget && (
                <div className="fixed inset-0 bg-black bg-opacity-70 z-[100] flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm p-6 animate-in zoom-in duration-200">
                        <div className="flex justify-between items-center mb-4"><h3 className="text-xl font-bold">Assigner Tâche</h3><button onClick={() => setTaskModalOpen(false)}><X size={20}/></button></div>
                        <div className="bg-gray-50 p-3 rounded mb-4 text-xs text-gray-600"><p><strong>Tailleur :</strong> {planningTarget.tailorName}</p><p><strong>Date :</strong> {planningTarget.date.toLocaleDateString()}</p></div>
                        <div className="space-y-4">
                            <div><label className="block text-sm font-medium mb-1">Commande</label><select className="w-full p-2 border rounded" value={newTaskData.orderId} onChange={e => setNewTaskData({...newTaskData, orderId: e.target.value})}>
                                <option value="">-- Choisir --</option>
                                {filteredCommandes.filter(c => c.statut !== StatutCommande.LIVRE).map(c => <option key={c.id} value={c.id}>{c.clientNom} - {c.description}</option>)}
                            </select></div>
                            {selectedTaskOrder?.elements && (
                                <div><label className="block text-sm font-medium mb-1">Article</label><select className="w-full p-2 border rounded" value={newTaskData.elementNom} onChange={e => setNewTaskData({...newTaskData, elementNom: e.target.value})}>
                                    <option value="">-- Général --</option>
                                    {selectedTaskOrder.elements.map((el, i) => <option key={i} value={el.nom}>{el.nom}</option>)}
                                </select></div>
                            )}
                            <div className="grid grid-cols-2 gap-4">
                                <div><label className="block text-sm font-medium mb-1">Action</label><select className="w-full p-2 border rounded" value={newTaskData.action} onChange={e => setNewTaskData({...newTaskData, action: e.target.value as any})}>{PRODUCTION_ACTIONS.map(a => <option key={a.id} value={a.id}>{a.label}</option>)}</select></div>
                                <div><label className="block text-sm font-medium mb-1">Quantité</label><input type="number" className="w-full p-2 border rounded font-bold text-center" value={newTaskData.quantite} onChange={e => setNewTaskData({...newTaskData, quantite: parseInt(e.target.value)||1})} /></div>
                            </div>
                        </div>
                        <div className="flex justify-end gap-3 mt-6"><button onClick={() => setTaskModalOpen(false)} className="px-4 py-2 text-gray-600">Annuler</button><button onClick={handleSaveTask} disabled={!newTaskData.orderId} className="px-4 py-2 bg-brand-600 text-white rounded font-bold disabled:opacity-50">Assigner</button></div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ProductionView;