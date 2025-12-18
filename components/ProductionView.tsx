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
    const [viewMode, setViewMode] = useState<'ORDERS' | 'TAILORS' | 'PERFORMANCE' | 'KANBAN' | 'HISTORY' | 'PLANNING'>('PLANNING');
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
    const [paymentModalOpen, setPaymentModalOpen] = useState(false);
    const [selectedOrderForPayment, setSelectedOrderForPayment] = useState<Commande | null>(null);
    const [paymentAmount, setPaymentAmount] = useState(0);
    const [paymentAccountId, setPaymentAccountId] = useState('');

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
    const [initialPaymentMethod, setInitialPaymentMethod] = useState<ModePaiement>('ESPECE');
    const [initialAccountId, setInitialAccountId] = useState('');

    const tailleurs = employes.filter(e => e.role === RoleEmploye.TAILLEUR || e.role === RoleEmploye.CHEF_ATELIER || e.role === RoleEmploye.STAGIAIRE);
    const canSeeFinance = userRole === RoleEmploye.ADMIN || userRole === RoleEmploye.GERANT || userRole === RoleEmploye.CHEF_ATELIER;

    const filteredCommandes = useMemo(() => {
        return commandes.filter(c => {
            if (c.type !== 'SUR_MESURE') return false; 
            const isCompleted = c.statut === StatutCommande.LIVRE || c.statut === StatutCommande.ANNULE;
            
            // Logique de filtrage par vue
            if (viewMode === 'HISTORY') {
                if (!isCompleted) return false;
            } else if (['PLANNING', 'KANBAN', 'ORDERS', 'TAILORS'].includes(viewMode)) {
                if (isCompleted) return false;
            }

            const matchesSearch = c.clientNom.toLowerCase().includes(searchTerm.toLowerCase()) || 
                                  c.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
                                  c.description.toLowerCase().includes(searchTerm.toLowerCase());
            return matchesSearch;
        }).sort((a, b) => new Date(b.dateLivraisonPrevue).getTime() - new Date(a.dateLivraisonPrevue).getTime());
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

    const handleOpenEditModal = (cmd: Commande) => {
        setIsEditingOrder(true); setSelectedOrderId(cmd.id);
        setSelectedClientId(cmd.clientId); setNotes(cmd.notes || '');
        setDateLivraison(cmd.dateLivraisonPrevue.split('T')[0]);
        setSelectedTailleurs(cmd.tailleursIds);
        setPrixBase(cmd.prixTotal);
        setAvance(cmd.avance);
        if (cmd.elements && cmd.elements.length > 0) {
            setOrderElements(cmd.elements.map((el, i) => ({ id: `el_${i}`, nom: el.nom, quantite: el.quantite })));
        } else {
            setOrderElements([{ id: '1', nom: cmd.description, quantite: cmd.quantite }]);
        }
        setIsModalOpen(true);
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
            id: `TASK_${Date.now()}`, commandeId: order.id, action: newTaskData.action,
            quantite: newTaskData.quantite, note: newTaskData.note, elementNom: newTaskData.elementNom || undefined,
            date: planningTarget.date.toISOString().split('T')[0], tailleurId: planningTarget.tailorId, statut: 'A_FAIRE'
        };
        onUpdateOrder({ ...order, taches: [...(order.taches || []), newTask] });
        setTaskModalOpen(false);
    };

    const handleMarkAsDelivered = (orderId: string) => {
        if(window.confirm("Confirmer la sortie de l'atelier ?")) onUpdateStatus(orderId, StatutCommande.LIVRE);
    };

    const getStatusColor = (s: string) => {
        switch(s) {
            case StatutCommande.EN_ATTENTE: return 'bg-gray-100 text-gray-700';
            case StatutCommande.EN_COUPE: return 'bg-blue-100 text-blue-700';
            case StatutCommande.COUTURE: return 'bg-indigo-100 text-indigo-700';
            case StatutCommande.PRET: return 'bg-green-100 text-green-700';
            case StatutCommande.LIVRE: return 'bg-gray-200 text-gray-500';
            default: return 'bg-gray-50';
        }
    };

    return (
        <div className="space-y-6 h-[calc(100vh-8rem)] flex flex-col">
            {/* HEADER */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 shrink-0">
                <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2"><Scissors className="text-brand-600"/> Atelier Production</h2>
                <div className="flex flex-wrap bg-white border p-1 rounded-lg">
                    <button onClick={() => setViewMode('PLANNING')} className={`px-3 py-1.5 text-xs font-bold rounded flex items-center gap-1 ${viewMode === 'PLANNING' ? 'bg-gray-100 text-brand-700' : 'text-gray-500'}`}><CalendarRange size={14}/> Agenda</button>
                    <button onClick={() => setViewMode('KANBAN')} className={`px-3 py-1.5 text-xs font-bold rounded flex items-center gap-1 ${viewMode === 'KANBAN' ? 'bg-gray-100 text-brand-700' : 'text-gray-500'}`}><Columns size={14}/> Kanban</button>
                    <button onClick={() => setViewMode('ORDERS')} className={`px-3 py-1.5 text-xs font-bold rounded flex items-center gap-1 ${viewMode === 'ORDERS' ? 'bg-gray-100 text-brand-700' : 'text-gray-500'}`}><LayoutList size={14}/> Liste</button>
                    <button onClick={() => setViewMode('HISTORY')} className={`px-3 py-1.5 text-xs font-bold rounded flex items-center gap-1 ${viewMode === 'HISTORY' ? 'bg-gray-100 text-brand-700' : 'text-gray-500'}`}><History size={14}/> Historique</button>
                    <button onClick={() => setViewMode('TAILORS')} className={`px-3 py-1.5 text-xs font-bold rounded flex items-center gap-1 ${viewMode === 'TAILORS' ? 'bg-gray-100 text-brand-700' : 'text-gray-500'}`}><Users size={14}/> Tailleurs</button>
                    <button onClick={() => setViewMode('PERFORMANCE')} className={`px-3 py-1.5 text-xs font-bold rounded flex items-center gap-1 ${viewMode === 'PERFORMANCE' ? 'bg-gray-100 text-brand-700' : 'text-gray-500'}`}><Trophy size={14}/> Stats</button>
                </div>
            </div>

            {/* SEARCH */}
            <div className="bg-white p-3 rounded-lg border flex gap-3 shrink-0">
                <Search className="text-gray-400" size={18}/>
                <input type="text" className="w-full text-sm outline-none" placeholder="Rechercher une commande, un client..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)}/>
            </div>

            {/* VIEW: AGENDA */}
            {viewMode === 'PLANNING' && (
                <div className="flex-1 bg-white rounded-xl shadow-sm border border-gray-200 flex flex-col overflow-hidden">
                    <div className="p-4 bg-gray-50 border-b flex justify-between items-center shrink-0">
                        <div className="flex items-center gap-2">
                            <h3 className="font-bold text-gray-700">Planning de Production</h3>
                            <div className="flex items-center bg-white border rounded-lg ml-4">
                                <button onClick={() => setAgendaBaseDate(new Date(agendaBaseDate.setDate(agendaBaseDate.getDate() - 7)))} className="p-1.5 hover:bg-gray-100"><ChevronLeft size={18}/></button>
                                <button onClick={() => setAgendaBaseDate(new Date())} className="px-3 py-1 text-xs font-bold border-x">Aujourd'hui</button>
                                <button onClick={() => setAgendaBaseDate(new Date(agendaBaseDate.setDate(agendaBaseDate.getDate() + 7)))} className="p-1.5 hover:bg-gray-100"><ChevronRight size={18}/></button>
                            </div>
                        </div>
                    </div>
                    <div className="flex-1 overflow-auto">
                        <div className="inline-block min-w-max">
                            <div className="flex border-b bg-gray-100 sticky top-0 z-20">
                                <div className="w-64 shrink-0 p-4 font-bold text-gray-600 border-r bg-gray-100 sticky left-0 z-30">Tailleur</div>
                                {planningData.days.map(d => (
                                    <div key={d.toISOString()} className={`w-48 shrink-0 p-3 text-center border-r ${d.toDateString() === planningData.today.toDateString() ? 'bg-brand-50' : ''}`}>
                                        <div className="text-[10px] uppercase text-gray-400 font-bold">{d.toLocaleDateString(undefined, {weekday: 'short'})}</div>
                                        <div className="font-bold text-gray-800">{d.toLocaleDateString(undefined, {day: 'numeric', month: 'short'})}</div>
                                    </div>
                                ))}
                            </div>
                            {tailleurs.map(t => (
                                <div key={t.id} className="flex border-b hover:bg-gray-50 transition-colors">
                                    <div className="w-64 shrink-0 p-4 border-r sticky left-0 bg-white z-10 flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center font-bold text-xs shrink-0">{t.nom.charAt(0)}</div>
                                        <div className="truncate font-bold text-sm text-gray-700">{t.nom}</div>
                                    </div>
                                    {planningData.days.map(d => {
                                        const tasks = getTasksForTailor(t.id, d);
                                        return (
                                            <div key={d.toISOString()} className="w-48 shrink-0 p-2 border-r flex flex-col gap-1 min-h-[120px] cursor-pointer hover:bg-brand-50/10" onClick={() => openTaskModal(t.id, d)}>
                                                {tasks.map(({task, order}) => (
                                                    <div key={task.id} className="p-2 rounded text-[10px] bg-white border border-gray-200 shadow-sm border-l-4 border-l-brand-500">
                                                        <div className="font-bold truncate uppercase">{order.clientNom}</div>
                                                        <div className="text-gray-500 truncate">{task.elementNom || order.description}</div>
                                                        <div className="mt-1 font-bold text-brand-700">{task.action}</div>
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

            {/* VIEW: HISTORIQUE */}
            {viewMode === 'HISTORY' && (
                <div className="flex-1 overflow-y-auto">
                    <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-gray-50 text-gray-600 font-bold border-b">
                                <tr>
                                    <th className="p-4">Date Livraison</th>
                                    <th className="p-4">Client</th>
                                    <th className="p-4">Description</th>
                                    <th className="p-4 text-center">Statut</th>
                                    <th className="p-4 text-right">Montant</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {filteredCommandes.map(cmd => (
                                    <tr key={cmd.id} className="hover:bg-gray-50">
                                        <td className="p-4 text-gray-500">{new Date(cmd.dateLivraisonPrevue).toLocaleDateString()}</td>
                                        <td className="p-4 font-bold">{cmd.clientNom}</td>
                                        <td className="p-4 text-gray-600">{cmd.description}</td>
                                        <td className="p-4 text-center"><span className={`px-2 py-1 rounded text-[10px] font-bold uppercase ${getStatusColor(cmd.statut)}`}>{cmd.statut}</span></td>
                                        <td className="p-4 text-right font-bold">{cmd.prixTotal.toLocaleString()} F</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* VIEW: TAILLEURS */}
            {viewMode === 'TAILORS' && (
                <div className="flex-1 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 overflow-y-auto">
                    {tailleurs.map(t => {
                        const activeTasks = commandes.filter(c => c.statut !== StatutCommande.LIVRE && c.tailleursIds.includes(t.id)).length;
                        return (
                            <div key={t.id} className="bg-white p-6 rounded-xl border shadow-sm flex flex-col items-center text-center">
                                <div className="w-16 h-16 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center text-2xl font-bold mb-4">{t.nom.charAt(0)}</div>
                                <h3 className="text-lg font-bold text-gray-800">{t.nom}</h3>
                                <p className="text-sm text-gray-500 mb-4">{t.role}</p>
                                <div className="w-full bg-gray-50 p-4 rounded-lg">
                                    <p className="text-xs text-gray-400 uppercase font-bold mb-1">Commandes en cours</p>
                                    <p className="text-2xl font-bold text-brand-600">{activeTasks}</p>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* VIEW: STATS */}
            {viewMode === 'PERFORMANCE' && (
                <div className="flex-1 space-y-6 overflow-y-auto">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="bg-white p-6 rounded-xl border shadow-sm">
                            <h4 className="text-gray-500 font-bold text-sm mb-4">REPARTITION STATUTS</h4>
                            <div className="space-y-2">
                                {Object.values(StatutCommande).slice(0,5).map(s => (
                                    <div key={s} className="flex justify-between items-center text-sm">
                                        <span className="text-gray-600">{s}</span>
                                        <span className="font-bold">{commandes.filter(c => c.statut === s).length}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                        <div className="bg-brand-600 p-6 rounded-xl shadow-sm text-white md:col-span-2">
                            <h4 className="font-bold text-sm mb-4 opacity-80 uppercase tracking-widest">Résumé Production</h4>
                            <div className="flex justify-around items-center h-24">
                                <div className="text-center">
                                    <p className="text-3xl font-bold">{commandes.filter(c => c.statut !== StatutCommande.LIVRE).length}</p>
                                    <p className="text-xs opacity-70">En Cours</p>
                                </div>
                                <div className="w-px h-12 bg-white/20"></div>
                                <div className="text-center">
                                    <p className="text-3xl font-bold">{commandes.filter(c => c.statut === StatutCommande.PRET).length}</p>
                                    <p className="text-xs opacity-70">Prêt à livrer</p>
                                </div>
                                <div className="w-px h-12 bg-white/20"></div>
                                <div className="text-center">
                                    <p className="text-3xl font-bold">{commandes.filter(c => c.statut === StatutCommande.LIVRE).length}</p>
                                    <p className="text-xs opacity-70">Livrées (Total)</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* KANBAN */}
            {viewMode === 'KANBAN' && (
                <div className="flex-1 overflow-x-auto pb-4">
                    <div className="flex gap-4 h-full min-w-max">
                        {[StatutCommande.EN_ATTENTE, StatutCommande.EN_COUPE, StatutCommande.COUTURE, StatutCommande.PRET].map(status => (
                            <div key={status} className="w-72 shrink-0 bg-gray-50 rounded-xl border flex flex-col">
                                <div className="p-3 font-bold border-b bg-white rounded-t-xl flex justify-between uppercase text-xs tracking-wider">
                                    <span>{status}</span>
                                    <span className="bg-gray-100 px-2 rounded-full">{filteredCommandes.filter(c => c.statut === status).length}</span>
                                </div>
                                <div className="flex-1 p-2 space-y-2 overflow-y-auto">
                                    {filteredCommandes.filter(c => c.statut === status).map(cmd => (
                                        <div key={cmd.id} className="bg-white p-3 rounded-lg border shadow-sm group relative">
                                            <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 flex gap-1">
                                                <button onClick={() => handleOpenEditModal(cmd)} className="p-1 text-blue-500 hover:bg-blue-50 rounded"><Edit2 size={12}/></button>
                                                <button onClick={() => handleMarkAsDelivered(cmd.id)} className="p-1 text-green-500 hover:bg-green-50 rounded"><CheckCircle size={12}/></button>
                                            </div>
                                            <div className="font-bold text-sm text-gray-800">{cmd.clientNom}</div>
                                            <div className="text-[10px] text-gray-500 line-clamp-2">{cmd.description}</div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* LIST VIEW */}
            {viewMode === 'ORDERS' && (
                <div className="flex-1 overflow-y-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pb-10">
                    {filteredCommandes.map(cmd => (
                        <div key={cmd.id} className="bg-white rounded-xl border p-5 shadow-sm relative flex flex-col h-full group hover:border-brand-300 transition-colors">
                            <div className="absolute top-4 right-4 flex gap-1">
                                <button onClick={() => handleOpenEditModal(cmd)} className="p-1.5 text-gray-400 hover:text-blue-600 rounded-full border bg-white shadow-sm"><Edit2 size={16}/></button>
                                <button onClick={() => handleMarkAsDelivered(cmd.id)} className="p-1.5 text-gray-400 hover:text-green-600 rounded-full border bg-white shadow-sm"><CheckCircle size={16}/></button>
                            </div>
                            <h3 className="font-bold text-lg text-gray-800 pr-16 truncate uppercase tracking-tight">{cmd.clientNom}</h3>
                            <span className={`inline-block text-[10px] px-2 py-0.5 rounded font-bold uppercase w-fit mt-1 mb-3 ${getStatusColor(cmd.statut)}`}>{cmd.statut}</span>
                            <p className="text-sm text-gray-600 flex-1 line-clamp-2 mb-4">{cmd.description}</p>
                            <div className="flex justify-between items-center pt-3 border-t text-xs font-bold">
                                <span className="text-gray-400 flex items-center gap-1"><Clock size={12}/> {new Date(cmd.dateLivraisonPrevue).toLocaleDateString()}</span>
                                <span className={cmd.reste > 0 ? 'text-red-600' : 'text-green-600'}>{cmd.reste > 0 ? `Reste: ${cmd.reste.toLocaleString()} F` : 'Soldé'}</span>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* MODALS (Reste de la logique inchangée) */}
            {taskModalOpen && planningTarget && (
                <div className="fixed inset-0 bg-black bg-opacity-70 z-[100] flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm p-6 animate-in zoom-in duration-200">
                        <div className="flex justify-between items-center mb-4"><h3 className="text-xl font-bold">Assigner Tâche</h3><button onClick={() => setTaskModalOpen(false)}><X size={20}/></button></div>
                        <div className="bg-gray-50 p-3 rounded mb-4 text-xs"><p><strong>Tailleur :</strong> {planningTarget.tailorName}</p><p><strong>Date :</strong> {planningTarget.date.toLocaleDateString()}</p></div>
                        <div className="space-y-4">
                            <div><label className="block text-sm font-medium mb-1">Commande</label><select className="w-full p-2 border rounded" value={newTaskData.orderId} onChange={e => setNewTaskData({...newTaskData, orderId: e.target.value})}>
                                <option value="">-- Choisir --</option>
                                {filteredCommandes.filter(c => c.statut !== StatutCommande.LIVRE).map(c => <option key={c.id} value={c.id}>{c.clientNom} - {c.description}</option>)}
                            </select></div>
                            <div className="grid grid-cols-2 gap-4">
                                <div><label className="block text-sm font-medium mb-1">Action</label><select className="w-full p-2 border rounded" value={newTaskData.action} onChange={e => setNewTaskData({...newTaskData, action: e.target.value as any})}>{PRODUCTION_ACTIONS.map(a => <option key={a.id} value={a.id}>{a.label}</option>)}</select></div>
                                <div><label className="block text-sm font-medium mb-1">Quantité</label><input type="number" className="w-full p-2 border rounded text-center" value={newTaskData.quantite} onChange={e => setNewTaskData({...newTaskData, quantite: parseInt(e.target.value)||1})} /></div>
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