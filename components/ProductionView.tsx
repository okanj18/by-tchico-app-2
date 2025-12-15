
import React, { useState, useMemo, useEffect } from 'react';
import { Commande, Employe, Client, Article, StatutCommande, RoleEmploye, ModePaiement, CompteFinancier, CompanyAssets, TacheProduction } from '../types';
import { COMPANY_CONFIG } from '../config';
import { Scissors, LayoutGrid, List, LayoutList, Users, BarChart2, Archive, Search, Camera, Filter, Plus, X, Trophy, Activity, AlertTriangle, Clock, AlertCircle, QrCode, Edit2, Shirt, Calendar, MessageSquare, History, EyeOff, Printer, MessageCircle, Wallet, CheckSquare, Ban, Save, Trash2, ArrowUpDown, Ruler, ChevronRight, RefreshCw, Columns, CheckCircle, Eye, AlertOctagon, FileText, CreditCard, CalendarRange, ChevronLeft, Zap } from 'lucide-react';
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

const ProductionView: React.FC<ProductionViewProps> = ({ 
    commandes, employes, clients, articles, userRole, 
    onUpdateStatus, onCreateOrder, onUpdateOrder, onAddPayment, onArchiveOrder, comptes, companyAssets 
}) => {
    // --- STATE ---
    const [viewMode, setViewMode] = useState<'ORDERS' | 'TAILORS' | 'PERFORMANCE' | 'KANBAN' | 'HISTORY' | 'PLANNING'>('PLANNING');
    const [showArchived, setShowArchived] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    
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

    // NEW: PAYMENT HISTORY DETAILS MODAL
    const [paymentHistoryModalOpen, setPaymentHistoryModalOpen] = useState(false);
    const [selectedOrderForHistory, setSelectedOrderForHistory] = useState<Commande | null>(null);
    
    // NEW: TASK PLANNING MODAL
    const [taskModalOpen, setTaskModalOpen] = useState(false);
    const [planningTarget, setPlanningTarget] = useState<{ tailorId: string, tailorName: string, date: Date } | null>(null);
    const [newTaskData, setNewTaskData] = useState<{ orderId: string, description: string }>({ orderId: '', description: '' });

    // FORM ORDER
    const [selectedClientId, setSelectedClientId] = useState('');
    const [description, setDescription] = useState('');
    const [notes, setNotes] = useState('');
    const [dateLivraison, setDateLivraison] = useState('');
    const [quantite, setQuantite] = useState(1);
    const [selectedTailleurs, setSelectedTailleurs] = useState<string[]>([]);
    const [consommations, setConsommations] = useState<{ id: string, articleId: string, variante: string, quantite: number }[]>([]);
    const [tempConso, setTempConso] = useState<{ articleId: string, variante: string, quantite: number }>({ articleId: '', variante: '', quantite: 0 });

    // FINANCE FORM
    const [applyTva, setApplyTva] = useState(false);
    const [prixBase, setPrixBase] = useState(0);
    const [remise, setRemise] = useState(0);
    const [avance, setAvance] = useState(0);
    const [initialPaymentMethod, setInitialPaymentMethod] = useState<ModePaiement>('ESPECE');
    const [initialAccountId, setInitialAccountId] = useState('');

    // --- DERIVED DATA ---
    const canSeeFinance = userRole === RoleEmploye.ADMIN || userRole === RoleEmploye.GERANT || userRole === RoleEmploye.CHEF_ATELIER;
    
    const tailleurs = employes.filter(e => e.role === RoleEmploye.TAILLEUR || e.role === RoleEmploye.CHEF_ATELIER || e.role === RoleEmploye.STAGIAIRE);
    const matieresPremieres = articles.filter(a => a.typeArticle === 'MATIERE_PREMIERE');

    const filteredCommandes = useMemo(() => {
        return commandes.filter(c => {
            if (c.type !== 'SUR_MESURE') return false; 

            // Filtre View Mode (Active vs History)
            const isCompleted = c.statut === StatutCommande.LIVRE || c.statut === StatutCommande.ANNULE;
            if (viewMode === 'HISTORY') {
                if (!isCompleted) return false;
                // Sub-filter for history: Show only unpaid debts
                if (historyFilterDebt && c.reste <= 0) return false;
            } else if (['KANBAN', 'ORDERS', 'TAILORS', 'PLANNING'].includes(viewMode)) {
                if (isCompleted) return false; // Hide completed in active views
            }

            const matchesSearch = c.clientNom.toLowerCase().includes(searchTerm.toLowerCase()) || 
                                  c.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
                                  c.description.toLowerCase().includes(searchTerm.toLowerCase());
            
            const matchesArchive = showArchived ? c.archived === true : c.archived !== true;
            
            let matchesStatus = true;
            if (filterStatus !== 'ALL') {
                if (filterStatus === 'EN_COURS') matchesStatus = c.statut !== StatutCommande.LIVRE && c.statut !== StatutCommande.ANNULE;
                else matchesStatus = c.statut === filterStatus;
            }

            const matchesTailor = filterTailor === 'ALL' ? true : filterTailor === 'UNASSIGNED' ? c.tailleursIds.length === 0 : c.tailleursIds.includes(filterTailor);
            
            let matchesDeliveryDate = true;
            if (filterDeliveryDateStart) matchesDeliveryDate = new Date(c.dateLivraisonPrevue).getTime() >= new Date(filterDeliveryDateStart).getTime();
            if (filterDeliveryDateEnd && matchesDeliveryDate) matchesDeliveryDate = new Date(c.dateLivraisonPrevue).getTime() <= new Date(filterDeliveryDateEnd).setHours(23,59,59);

            return matchesSearch && matchesArchive && matchesStatus && matchesTailor && matchesDeliveryDate;
        }).sort((a, b) => new Date(b.dateLivraisonPrevue).getTime() - new Date(a.dateLivraisonPrevue).getTime());
    }, [commandes, searchTerm, showArchived, filterStatus, filterTailor, filterDeliveryDateStart, filterDeliveryDateEnd, viewMode, historyFilterDebt]);

    // Planning Data
    const planningData = useMemo(() => {
        const today = new Date();
        today.setHours(0,0,0,0);
        
        // Generate next 6 days
        const days = Array.from({length: 6}, (_, i) => {
            const d = new Date(today);
            d.setDate(today.getDate() + i);
            return d;
        });

        return { days, today };
    }, []);

    // Calculate totals for form
    const montantTotalTTC = Math.max(0, prixBase - remise) + (applyTva ? Math.round(Math.max(0, prixBase - remise) * COMPANY_CONFIG.tvaRate) : 0);

    // --- KANBAN CONFIG ---
    const KANBAN_COLUMNS = [
        { id: StatutCommande.EN_ATTENTE, label: 'En Attente', color: 'border-gray-300 bg-gray-50' },
        { id: StatutCommande.EN_COUPE, label: 'Coupe', color: 'border-blue-300 bg-blue-50' },
        { id: StatutCommande.COUTURE, label: 'Couture', color: 'border-indigo-300 bg-indigo-50' },
        { id: StatutCommande.FINITION, label: 'Finition', color: 'border-purple-300 bg-purple-50' },
        { id: StatutCommande.PRET, label: 'Prêt', color: 'border-green-300 bg-green-50' }
    ];

    // --- HELPER FUNCTIONS ---
    const formatPaymentMethod = (method: string) => {
        switch(method) {
            case 'ORANGE_MONEY': return 'Orange Money';
            case 'WAVE': return 'Wave';
            case 'ESPECE': return 'Espèce';
            case 'VIREMENT': return 'Virement';
            case 'CHEQUE': return 'Chèque';
            default: return method;
        }
    };

    const getPaymentColor = (method: string) => {
        switch(method) {
            case 'ORANGE_MONEY': return 'bg-orange-50 text-orange-700 border-orange-200';
            case 'WAVE': return 'bg-blue-50 text-blue-700 border-blue-200';
            case 'ESPECE': return 'bg-green-50 text-green-700 border-green-200';
            default: return 'bg-gray-100 text-gray-700 border-gray-200';
        }
    };

    // Récupérer les tâches planifiées pour un tailleur et une date donnée
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

    // --- ACTIONS ---

    const handleForceRefresh = () => {
        window.location.reload();
    };

    const handleOpenCreateModal = () => {
        setIsEditingOrder(false); setSelectedOrderId(null);
        setSelectedClientId(''); setDescription(''); setNotes('');
        setDateLivraison(''); setQuantite(1); setSelectedTailleurs([]);
        setConsommations([]); setPrixBase(0); setRemise(0); setAvance(0);
        setApplyTva(false); setInitialAccountId('');
        setIsModalOpen(true);
    };

    const handleOpenEditModal = (cmd: Commande) => {
        setIsEditingOrder(true); setSelectedOrderId(cmd.id);
        setSelectedClientId(cmd.clientId); setDescription(cmd.description);
        setNotes(cmd.notes || '');
        setDateLivraison(cmd.dateLivraisonPrevue.split('T')[0]);
        setQuantite(cmd.quantite || 1);
        setSelectedTailleurs(cmd.tailleursIds);
        setConsommations(cmd.consommations ? cmd.consommations.map(c => ({...c, id: `c_${Math.random()}`})) : []);
        setApplyTva(!!cmd.tva && cmd.tva > 0);
        setPrixBase((cmd.prixTotal || 0) - (cmd.tva || 0) + (cmd.remise || 0));
        setRemise(cmd.remise || 0);
        setAvance(cmd.avance);
        setIsModalOpen(true);
    };

    const handleMarkAsDelivered = (orderId: string) => {
        const order = commandes.find(c => c.id === orderId);
        if (!order) return;

        let message = "Confirmer la livraison (Sortie Atelier) de cette commande ?";
        
        // Logique de dette à la livraison
        if (order.reste > 0) {
            message = `⚠️ ATTENTION : Ce client doit encore ${order.reste.toLocaleString()} F.\n\nÊtes-vous sûr de vouloir livrer la commande SANS encaisser le solde maintenant ?\n\nSi oui, la commande ira dans l'historique avec le statut 'Non Soldé'.`;
        } else {
            message = "La commande est soldée. Confirmer la livraison au client ?";
        }

        if(window.confirm(message)) {
            onUpdateStatus(orderId, StatutCommande.LIVRE);
        }
    };

    const handleSaveOrder = () => {
        if (!selectedClientId || !description || !dateLivraison) { alert("Champs requis manquants."); return; }
        
        const client = clients.find(c => c.id === selectedClientId);
        const orderData: Commande = {
            id: selectedOrderId || `CMD${Date.now()}`,
            clientId: selectedClientId,
            clientNom: client?.nom || 'Inconnu',
            description, notes, quantite,
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

        // Si c'est une création et qu'il y a une avance, on ajoute le paiement initial à l'historique
        if (!isEditingOrder && avance > 0) {
            orderData.paiements = [{
                id: `PAY_INIT_${Date.now()}`,
                date: new Date().toISOString(),
                montant: avance,
                moyenPaiement: initialPaymentMethod,
                note: "Avance à la commande"
            }];
        }

        if (isEditingOrder) {
            onUpdateOrder(orderData, initialAccountId, initialPaymentMethod);
        } else {
            if (avance > 0 && !initialAccountId) { alert("Sélectionnez un compte pour l'avance."); return; }
            onCreateOrder(orderData, consommations, initialPaymentMethod, initialAccountId);
        }
        setIsModalOpen(false);
    };

    const openPaymentModal = (cmd: Commande) => {
        setSelectedOrderForPayment(cmd);
        setPaymentAmount(cmd.reste);
        setPaymentAccountId('');
        setPaymentModalOpen(true);
    };

    const openPaymentHistoryModal = (cmd: Commande) => {
        setSelectedOrderForHistory(cmd);
        setPaymentHistoryModalOpen(true);
    };

    const handleConfirmPayment = () => {
        if (!selectedOrderForPayment || paymentAmount <= 0) return;
        if (!paymentAccountId) { alert("Sélectionnez un compte."); return; }
        
        onAddPayment(selectedOrderForPayment.id, paymentAmount, paymentMethod, "Paiement Production", new Date().toISOString(), paymentAccountId);
        setPaymentModalOpen(false);
        setSelectedOrderForPayment(null);
    };

    // --- PLANNING HANDLERS ---
    
    const openTaskModal = (tailorId: string, date: Date) => {
        const tailor = tailleurs.find(t => t.id === tailorId);
        if (!tailor) return;
        
        setPlanningTarget({ tailorId, tailorName: tailor.nom, date });
        setNewTaskData({ orderId: '', description: 'Avancement' });
        setTaskModalOpen(true);
    };

    const handleSaveTask = () => {
        if (!planningTarget || !newTaskData.orderId) return;
        
        const order = commandes.find(c => c.id === newTaskData.orderId);
        if (!order) return;

        const newTask: TacheProduction = {
            id: `TASK_${Date.now()}`,
            commandeId: order.id,
            description: newTaskData.description || 'Travail sur commande',
            date: planningTarget.date.toISOString().split('T')[0],
            tailleurId: planningTarget.tailorId,
            statut: 'A_FAIRE'
        };

        // SYNC: Add Tailor to Order if not present
        const updatedTailorIds = order.tailleursIds.includes(planningTarget.tailorId)
            ? order.tailleursIds
            : [...order.tailleursIds, planningTarget.tailorId];

        // Update the order with the new task and new tailors list
        const updatedOrder = {
            ...order,
            tailleursIds: updatedTailorIds,
            taches: [...(order.taches || []), newTask]
        };

        onUpdateOrder(updatedOrder);
        setTaskModalOpen(false);
    };

    const handleToggleTaskStatus = (task: TacheProduction, order: Commande) => {
        const newStatus: 'A_FAIRE' | 'FAIT' = task.statut === 'A_FAIRE' ? 'FAIT' : 'A_FAIRE';
        const updatedTasks = order.taches?.map(t => t.id === task.id ? { ...t, statut: newStatus } : t);
        const updatedOrder = { ...order, taches: updatedTasks };
        onUpdateOrder(updatedOrder);
    };

    const handleDeleteTask = (task: TacheProduction, order: Commande) => {
        if (window.confirm("Supprimer cette tâche du planning ?")) {
            const updatedTasks = order.taches?.filter(t => t.id !== task.id);
            const updatedOrder = { ...order, taches: updatedTasks };
            onUpdateOrder(updatedOrder);
        }
    };

    const generatePrintContent = (orderData: Partial<Commande>) => {
        const printWindow = window.open('', '', 'width=800,height=800');
        if (!printWindow) return;
        
        const logoUrl = companyAssets?.logoStr || `${window.location.origin}${COMPANY_CONFIG.logoUrl}`;
        const html = `
            <html><head><title>Ticket</title>
            <style>body { font-family: monospace; padding: 20px; text-align: center; } .logo { max-width: 100px; margin: 0 auto; display: block; }</style>
            </head><body>
            <img src="${logoUrl}" class="logo" onerror="this.style.display='none'"/>
            <h2>${COMPANY_CONFIG.name}</h2>
            <h3>${orderData.clientNom}</h3>
            <p>${orderData.description}</p>
            <p><strong>Total: ${orderData.prixTotal?.toLocaleString()} F</strong></p>
            <p>Avance: ${orderData.avance?.toLocaleString()} F</p>
            <p>Reste: ${orderData.reste?.toLocaleString()} F</p>
            <script>window.print();</script>
            </body></html>
        `;
        printWindow.document.write(html);
        printWindow.document.close();
    };

    const handleScan = (decodedText: string) => {
        setIsScannerOpen(false);
        setSearchTerm(decodedText);
    };

    // --- DRAG AND DROP HANDLERS ---
    const handleDragStart = (e: React.DragEvent, orderId: string) => {
        e.dataTransfer.setData("orderId", orderId);
        e.dataTransfer.effectAllowed = "move";
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
    };

    const handleDrop = (e: React.DragEvent, newStatus: string) => {
        e.preventDefault();
        const orderId = e.dataTransfer.getData("orderId");
        if (orderId) {
            onUpdateStatus(orderId, newStatus as StatutCommande);
        }
    };

    // --- RENDER HELPERS ---
    const getStatusColor = (s: string) => {
        switch(s) {
            case StatutCommande.EN_ATTENTE: return 'bg-gray-100 text-gray-700';
            case StatutCommande.EN_COUPE: return 'bg-blue-100 text-blue-700';
            case StatutCommande.COUTURE: return 'bg-indigo-100 text-indigo-700';
            case StatutCommande.FINITION: return 'bg-purple-100 text-purple-700';
            case StatutCommande.PRET: return 'bg-green-100 text-green-700';
            case StatutCommande.LIVRE: return 'bg-gray-200 text-gray-500 line-through';
            case StatutCommande.ANNULE: return 'bg-red-100 text-red-700';
            default: return 'bg-gray-50';
        }
    };

    return (
        <div className="space-y-6 h-[calc(100vh-8rem)] flex flex-col">
            {/* HEADER */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 shrink-0">
                <div>
                    <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2"><Scissors className="text-brand-600"/> Atelier Production</h2>
                    <p className="text-sm text-gray-500">Gestion des commandes sur mesure et suivi atelier.</p>
                </div>
                <div className="flex flex-wrap gap-2 items-center">
                    <button 
                        onClick={handleForceRefresh} 
                        className="bg-white border border-gray-300 text-gray-600 p-2 rounded-lg hover:bg-gray-50 transition-colors shadow-sm"
                        title="Forcer la synchronisation"
                    >
                        <RefreshCw size={18} />
                    </button>

                    <button 
                        onClick={() => setIsScannerOpen(true)} 
                        className="bg-gray-800 text-white p-2 rounded-lg hover:bg-gray-900 transition-colors shadow-sm flex items-center gap-2"
                        title="Scanner QR Code"
                    >
                        <Camera size={18} /> <span className="hidden sm:inline text-sm font-bold">Scanner</span>
                    </button>

                    <div className="flex bg-white border border-gray-200 p-1 rounded-lg">
                        <button onClick={() => setViewMode('KANBAN')} className={`px-3 py-1.5 text-xs font-bold rounded flex items-center gap-1 ${viewMode === 'KANBAN' ? 'bg-gray-100 text-brand-700' : 'text-gray-500'}`}><Columns size={14}/> Kanban</button>
                        <button onClick={() => setViewMode('PLANNING')} className={`px-3 py-1.5 text-xs font-bold rounded flex items-center gap-1 ${viewMode === 'PLANNING' ? 'bg-gray-100 text-brand-700' : 'text-gray-500'}`}><CalendarRange size={14}/> Agenda</button>
                        <button onClick={() => setViewMode('ORDERS')} className={`px-3 py-1.5 text-xs font-bold rounded flex items-center gap-1 ${viewMode === 'ORDERS' ? 'bg-gray-100 text-brand-700' : 'text-gray-500'}`}><LayoutList size={14}/> Liste</button>
                        <button onClick={() => setViewMode('HISTORY')} className={`px-3 py-1.5 text-xs font-bold rounded flex items-center gap-1 ${viewMode === 'HISTORY' ? 'bg-gray-100 text-brand-700' : 'text-gray-500'}`}><History size={14}/> Historique</button>
                        <button onClick={() => setViewMode('TAILORS')} className={`px-3 py-1.5 text-xs font-bold rounded flex items-center gap-1 ${viewMode === 'TAILORS' ? 'bg-gray-100 text-brand-700' : 'text-gray-500'}`}><Users size={14}/> Tailleurs</button>
                        <button onClick={() => setViewMode('PERFORMANCE')} className={`px-3 py-1.5 text-xs font-bold rounded flex items-center gap-1 ${viewMode === 'PERFORMANCE' ? 'bg-gray-100 text-brand-700' : 'text-gray-500'}`}><Trophy size={14}/> Stats</button>
                    </div>
                    {!showArchived && (
                        <button onClick={handleOpenCreateModal} className="bg-brand-600 text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 hover:bg-brand-700"><Plus size={16}/> Créer</button>
                    )}
                </div>
            </div>

            {/* FILTERS */}
            {viewMode !== 'PERFORMANCE' && viewMode !== 'TAILORS' && (
                <div className="bg-white p-3 rounded-lg border border-gray-200 flex flex-wrap gap-3 items-center shrink-0">
                    <div className="relative flex-1 min-w-[200px]">
                        <Search className="absolute left-3 top-2.5 text-gray-400" size={16}/>
                        <input type="text" className="w-full pl-9 pr-4 py-2 bg-gray-50 border-none rounded-lg text-sm" placeholder="Rechercher client, description..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)}/>
                    </div>
                    <button onClick={() => setShowFiltersPanel(!showFiltersPanel)} className={`p-2 rounded-lg border ${showFiltersPanel ? 'bg-brand-50 border-brand-200 text-brand-700' : 'bg-white border-gray-200 text-gray-500'}`}><Filter size={18}/></button>
                    {showFiltersPanel && (
                        <div className="w-full grid grid-cols-1 md:grid-cols-4 gap-3 mt-2 pt-2 border-t border-gray-100">
                            <select className="p-2 border rounded text-sm" value={filterStatus} onChange={e => setFilterStatus(e.target.value)}><option value="ALL">Tous Statuts</option><option value="EN_COURS">En Cours</option>{Object.values(StatutCommande).map(s => <option key={s} value={s}>{s}</option>)}</select>
                            <select className="p-2 border rounded text-sm" value={filterTailor} onChange={e => setFilterTailor(e.target.value)}><option value="ALL">Tous Tailleurs</option><option value="UNASSIGNED">Non Assigné</option>{tailleurs.map(t => <option key={t.id} value={t.id}>{t.nom}</option>)}</select>
                            <input type="date" className="p-2 border rounded text-sm" value={filterDeliveryDateStart} onChange={e => setFilterDeliveryDateStart(e.target.value)} />
                            <input type="date" className="p-2 border rounded text-sm" value={filterDeliveryDateEnd} onChange={e => setFilterDeliveryDateEnd(e.target.value)} />
                        </div>
                    )}
                </div>
            )}

            {/* VIEW: AGENDA (NEW PLANNING) */}
            {viewMode === 'PLANNING' && (
                <div className="flex-1 bg-white rounded-xl shadow-sm border border-gray-200 flex flex-col overflow-hidden">
                    <div className="p-4 bg-gray-50 border-b border-gray-200 flex justify-between items-center">
                        <h3 className="font-bold text-gray-700 flex items-center gap-2"><CalendarRange size={18}/> Agenda Quotidien</h3>
                        <div className="text-xs text-gray-500 flex gap-4">
                            <div className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-blue-100 border border-blue-300"></span> À Faire</div>
                            <div className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-green-100 border border-green-300"></span> Fait</div>
                        </div>
                    </div>
                    <div className="flex-1 overflow-x-auto overflow-y-auto">
                        <div className="min-w-[1000px]">
                            {/* Header Dates */}
                            <div className="flex border-b border-gray-200 bg-white sticky top-0 z-10 shadow-sm">
                                <div className="w-48 p-3 font-bold text-gray-600 border-r border-gray-100 sticky left-0 bg-white z-20">Tailleur</div>
                                {planningData.days.map(d => {
                                    const isToday = d.toDateString() === planningData.today.toDateString();
                                    return (
                                        <div key={d.toISOString()} className={`flex-1 min-w-[140px] p-2 text-center border-r border-gray-100 ${isToday ? 'bg-brand-50' : ''}`}>
                                            <div className={`text-xs uppercase ${isToday ? 'text-brand-600 font-bold' : 'text-gray-500'}`}>{d.toLocaleDateString(undefined, {weekday: 'short'})}</div>
                                            <div className={`font-bold ${isToday ? 'text-brand-800' : 'text-gray-800'}`}>{d.toLocaleDateString(undefined, {day: 'numeric', month: 'short'})}</div>
                                        </div>
                                    )
                                })}
                            </div>

                            {/* Rows */}
                            {tailleurs.map(t => (
                                <div key={t.id} className="flex border-b border-gray-100 hover:bg-gray-50 transition-colors">
                                    <div className="w-48 p-3 border-r border-gray-100 sticky left-0 bg-white z-10 flex items-center gap-2">
                                        <div className="w-8 h-8 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center font-bold text-xs">{t.nom.charAt(0)}</div>
                                        <div className="truncate font-medium text-sm text-gray-700">{t.nom}</div>
                                    </div>
                                    
                                    {/* Days Columns */}
                                    {planningData.days.map(d => {
                                        const tasks = getTasksForTailor(t.id, d);
                                        const isToday = d.toDateString() === planningData.today.toDateString();

                                        return (
                                            <div 
                                                key={d.toISOString()} 
                                                className={`flex-1 min-w-[140px] p-2 border-r border-gray-100 flex flex-col gap-1 min-h-[80px] group cursor-pointer transition-colors ${isToday ? 'bg-brand-50/30' : ''} hover:bg-gray-100`}
                                                onClick={() => openTaskModal(t.id, d)}
                                            >
                                                {/* Tasks List */}
                                                {tasks.map(({task, order}) => {
                                                    // VISUAL SYNC: If global order is delivered/ready, mark task visually as done even if subtask status isn't updated
                                                    const isGlobalDone = order.statut === StatutCommande.LIVRE || order.statut === StatutCommande.PRET;
                                                    const isDone = task.statut === 'FAIT' || isGlobalDone;

                                                    return (
                                                        <div 
                                                            key={task.id} 
                                                            onClick={(e) => { e.stopPropagation(); handleToggleTaskStatus(task, order); }}
                                                            className={`p-2 rounded shadow-sm text-xs cursor-pointer border-l-2 relative group/task ${isDone ? 'bg-green-50 border-green-500 opacity-60 line-through decoration-gray-400' : 'bg-white border-blue-500 hover:shadow-md'}`}
                                                        >
                                                            <div className="font-bold truncate text-gray-800">{order.clientNom}</div>
                                                            <div className="text-gray-500 truncate">{task.description}</div>
                                                            <button 
                                                                onClick={(e) => { e.stopPropagation(); handleDeleteTask(task, order); }}
                                                                className="absolute top-1 right-1 text-red-400 opacity-0 group-hover/task:opacity-100 hover:text-red-600 p-0.5"
                                                            >
                                                                <Trash2 size={10} />
                                                            </button>
                                                        </div>
                                                    )
                                                })}
                                                
                                                {/* Add Button visible on hover */}
                                                <div className="mt-auto pt-2 flex justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <button className="text-[10px] text-gray-400 bg-white border border-gray-200 px-2 py-0.5 rounded-full flex items-center gap-1 hover:text-brand-600 hover:border-brand-300 shadow-sm">
                                                        <Plus size={10} /> Ajouter
                                                    </button>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* VIEW: KANBAN */}
            {viewMode === 'KANBAN' && (
                <div className="flex-1 overflow-x-auto overflow-y-hidden pb-2">
                    <div className="flex gap-4 h-full min-w-max">
                        {KANBAN_COLUMNS.map(column => {
                            const columnOrders = filteredCommandes.filter(c => c.statut === column.id);
                            return (
                                <div 
                                    key={column.id} 
                                    className={`w-[280px] md:w-[320px] flex flex-col h-full rounded-xl border ${column.color} transition-colors`}
                                    onDragOver={handleDragOver}
                                    onDrop={(e) => handleDrop(e, column.id)}
                                >
                                    <div className="p-3 font-bold text-gray-700 flex justify-between items-center border-b border-gray-200/50 bg-white/50 rounded-t-xl shrink-0">
                                        <span>{column.label}</span>
                                        <span className="bg-white px-2 py-0.5 rounded-full text-xs shadow-sm">{columnOrders.length}</span>
                                    </div>
                                    <div className="flex-1 overflow-y-auto p-2 space-y-3 custom-scrollbar">
                                        {columnOrders.map(cmd => (
                                            <div 
                                                key={cmd.id} 
                                                className="bg-white p-3 rounded-lg shadow-sm border border-gray-100 cursor-grab active:cursor-grabbing hover:shadow-md transition-shadow group relative"
                                                draggable
                                                onDragStart={(e) => handleDragStart(e, cmd.id)}
                                            >
                                                {/* Mini Quick Actions */}
                                                <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1 bg-white/90 rounded p-0.5 z-10">
                                                    <button onClick={() => handleOpenEditModal(cmd)} className="p-1 hover:text-blue-600" title="Modifier"><Edit2 size={12}/></button>
                                                    <button onClick={() => {setQrOrder(cmd); setQrModalOpen(true);}} className="p-1 hover:text-brand-600" title="QR Code"><QrCode size={12}/></button>
                                                    <button onClick={() => handleMarkAsDelivered(cmd.id)} className="p-1 hover:text-green-600" title="Marquer Livré"><CheckCircle size={12}/></button>
                                                </div>

                                                <div className="font-bold text-gray-800 text-sm mb-1">{cmd.clientNom}</div>
                                                <p className="text-xs text-gray-500 mb-2 line-clamp-2">{cmd.description}</p>
                                                
                                                <div className="flex justify-between items-end mt-2">
                                                    <div className="flex items-center gap-1 text-[10px] text-gray-400 bg-gray-50 px-1.5 py-0.5 rounded">
                                                        <Clock size={10}/> {new Date(cmd.dateLivraisonPrevue).toLocaleDateString(undefined, {month:'numeric', day:'numeric'})}
                                                    </div>
                                                    <div className="flex -space-x-1">
                                                        {cmd.tailleursIds.map(tid => {
                                                            const t = tailleurs.find(emp => emp.id === tid);
                                                            return t ? (
                                                                <div key={tid} className="w-5 h-5 rounded-full bg-blue-100 border border-white text-[8px] flex items-center justify-center text-blue-800 font-bold" title={t.nom}>
                                                                    {t.nom.charAt(0)}
                                                                </div>
                                                            ) : null;
                                                        })}
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* VIEW: ORDERS (GRID - ACTIVE ONLY) */}
            {viewMode === 'ORDERS' && (
                <div className="flex-1 overflow-y-auto">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pb-20">
                        {filteredCommandes.map(cmd => (
                            <div key={cmd.id} className="bg-white rounded-xl border border-gray-200 shadow-sm flex flex-col h-full overflow-hidden">
                                {/* Card Body - Clickable space reduced to specific areas to avoid conflicts */}
                                <div className="p-5 flex-1 relative">
                                    {/* Absolute Actions */}
                                    <div className="absolute top-2 right-2 flex gap-1 z-10">
                                        <button onClick={() => {setQrOrder(cmd); setQrModalOpen(true);}} className="p-1.5 text-gray-400 hover:text-brand-600 bg-white/80 rounded-full hover:bg-gray-100"><QrCode size={16}/></button>
                                        {!showArchived && cmd.statut !== StatutCommande.LIVRE && cmd.statut !== StatutCommande.ANNULE && (
                                            <>
                                                <button onClick={() => handleOpenEditModal(cmd)} className="p-1.5 text-gray-400 hover:text-blue-600 bg-white/80 rounded-full hover:bg-gray-100"><Edit2 size={16}/></button>
                                                <button onClick={() => handleMarkAsDelivered(cmd.id)} className="p-1.5 text-gray-400 hover:text-green-600 bg-white/80 rounded-full hover:bg-gray-100" title="Livrer"><CheckCircle size={16}/></button>
                                            </>
                                        )}
                                        <button onClick={() => generatePrintContent(cmd)} className="p-1.5 text-gray-400 hover:text-gray-800 bg-white/80 rounded-full hover:bg-gray-100"><Printer size={16}/></button>
                                    </div>

                                    <div className="flex justify-between items-start mb-2 pr-12">
                                        <h3 className="font-bold text-lg text-gray-800 truncate">{cmd.clientNom}</h3>
                                    </div>
                                    
                                    <span className={`inline-block text-[10px] px-2 py-1 rounded font-bold uppercase tracking-wider mb-2 ${getStatusColor(cmd.statut)}`}>{cmd.statut}</span>
                                    <p className="text-sm text-gray-600 mb-3 line-clamp-2">{cmd.description}</p>
                                    
                                    <div className="flex items-center gap-4 text-xs text-gray-500 mb-4">
                                        <div className="flex items-center gap-1"><Calendar size={12}/> {new Date(cmd.dateLivraisonPrevue).toLocaleDateString()}</div>
                                        <div className="flex items-center gap-1"><Shirt size={12}/> Qté: {cmd.quantite}</div>
                                    </div>

                                    <div className="flex flex-wrap gap-1">
                                        {cmd.tailleursIds.map(tid => {
                                            const t = tailleurs.find(emp => emp.id === tid);
                                            return t ? <span key={tid} className="text-[10px] bg-gray-100 px-2 py-0.5 rounded text-gray-600">{t.nom}</span> : null;
                                        })}
                                    </div>
                                </div>

                                {/* Card Footer - Explicitly separate stacking context */}
                                <div className="p-3 bg-gray-50 border-t border-gray-100 flex items-center justify-between z-20 relative">
                                    <div className="text-xs">
                                        {cmd.reste > 0 ? <span className="text-red-600 font-bold">Reste: {cmd.reste.toLocaleString()} F</span> : <span className="text-green-600 font-bold flex items-center gap-1"><CheckSquare size={10}/> Payé</span>}
                                    </div>
                                    
                                    {canSeeFinance && cmd.reste > 0 && (
                                        <button 
                                            onClick={(e) => { 
                                                e.preventDefault(); 
                                                e.stopPropagation(); 
                                                openPaymentModal(cmd); 
                                            }}
                                            className="px-4 py-2 bg-brand-600 text-white text-xs font-bold rounded shadow hover:bg-brand-700 cursor-pointer active:scale-95 transition-transform"
                                            style={{ zIndex: 50, position: 'relative' }} // FORCE Z-INDEX ON WINDOWS
                                        >
                                            ENCAISSER
                                        </button>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* VIEW: HISTORY (DELIVERED / CANCELLED) */}
            {viewMode === 'HISTORY' && (
                <div className="flex-1 flex flex-col overflow-hidden bg-white rounded-xl shadow-sm border border-gray-200">
                    <div className="p-4 border-b border-gray-100 bg-gray-50 flex justify-between items-center">
                        <h3 className="font-bold text-gray-700 flex items-center gap-2">
                            <History size={18} /> Historique des Livraisons
                        </h3>
                        <div className="flex items-center gap-2">
                            <label className="flex items-center gap-2 cursor-pointer select-none text-sm font-medium text-gray-700 bg-white px-3 py-1.5 rounded border border-gray-300 shadow-sm hover:bg-gray-50">
                                <input 
                                    type="checkbox" 
                                    checked={historyFilterDebt} 
                                    onChange={e => setHistoryFilterDebt(e.target.checked)} 
                                    className="rounded text-brand-600 focus:ring-brand-500"
                                />
                                <AlertOctagon size={16} className={historyFilterDebt ? "text-red-500" : "text-gray-400"} />
                                Afficher Dettes Uniquement
                            </label>
                        </div>
                    </div>
                    <div className="flex-1 overflow-y-auto">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-white text-gray-600 font-medium border-b border-gray-100 sticky top-0 z-10">
                                <tr>
                                    <th className="py-3 px-4">Date Livraison</th>
                                    <th className="py-3 px-4">Client</th>
                                    <th className="py-3 px-4">Description</th>
                                    <th className="py-3 px-4 text-right">Montant</th>
                                    <th className="py-3 px-4 text-right">Payé</th>
                                    <th className="py-3 px-4 text-right">Reste</th>
                                    <th className="py-3 px-4 text-center">Statut</th>
                                    <th className="py-3 px-4 text-center">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {filteredCommandes.map(cmd => (
                                    <tr key={cmd.id} className="hover:bg-gray-50">
                                        <td className="py-3 px-4 text-gray-500">{new Date(cmd.dateLivraisonPrevue).toLocaleDateString()}</td>
                                        <td className="py-3 px-4 font-bold text-gray-800">{cmd.clientNom}</td>
                                        <td className="py-3 px-4 text-gray-600">{cmd.description}</td>
                                        <td className="py-3 px-4 text-right font-medium">{cmd.prixTotal.toLocaleString()} F</td>
                                        <td 
                                            className="py-3 px-4 text-right text-green-600 cursor-pointer hover:bg-green-50 transition-colors rounded flex items-center justify-end gap-1"
                                            onClick={() => openPaymentHistoryModal(cmd)}
                                            title="Voir détail des paiements"
                                        >
                                            <List size={12} className="opacity-50"/> {cmd.avance.toLocaleString()} F
                                        </td>
                                        <td className={`py-3 px-4 text-right font-bold ${cmd.reste > 0 ? 'text-red-600' : 'text-gray-400'}`}>
                                            {cmd.reste > 0 ? `${cmd.reste.toLocaleString()} F` : '-'}
                                        </td>
                                        <td className="py-3 px-4 text-center">
                                            <span className={`px-2 py-1 rounded text-xs font-bold ${cmd.statut === StatutCommande.LIVRE ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                                {cmd.statut}
                                            </span>
                                        </td>
                                        <td className="py-3 px-4 text-center">
                                            <div className="flex justify-center gap-2">
                                                {canSeeFinance && cmd.reste > 0 && (
                                                    <button 
                                                        onClick={() => openPaymentModal(cmd)}
                                                        className="flex items-center gap-1 bg-green-600 hover:bg-green-700 text-white px-2 py-1 rounded text-xs font-bold shadow-sm transition-colors"
                                                        title="Encaisser le reste"
                                                    >
                                                        <Wallet size={12}/>
                                                    </button>
                                                )}
                                                <button onClick={() => openPaymentHistoryModal(cmd)} className="text-gray-500 hover:text-purple-600 p-1 bg-gray-100 rounded" title="Historique Paiements"><List size={16}/></button>
                                                <button onClick={() => generatePrintContent(cmd)} className="text-gray-500 hover:text-gray-800 p-1" title="Réimprimer"><Printer size={16}/></button>
                                                <button onClick={() => handleOpenEditModal(cmd)} className="text-gray-500 hover:text-blue-600 p-1" title="Voir/Modifier"><Eye size={16}/></button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                                {filteredCommandes.length === 0 && (
                                    <tr>
                                        <td colSpan={8} className="py-8 text-center text-gray-400 italic">Aucune commande trouvée dans l'historique.</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* VIEW: TAILORS */}
            {viewMode === 'TAILORS' && (
                <div className="flex-1 overflow-y-auto">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pb-20">
                        {tailleurs.map(t => {
                            const today = new Date();
                            const todayTasks = getTasksForTailor(t.id, today);
                            const tasks = commandes.filter(c => c.tailleursIds.includes(t.id) && c.statut !== StatutCommande.LIVRE && c.statut !== StatutCommande.ANNULE && !c.archived);
                            
                            return (
                                <div key={t.id} className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 flex flex-col h-full">
                                    <div className="flex items-center gap-3 mb-4 pb-3 border-b border-gray-100">
                                        <div className="w-10 h-10 rounded-full bg-blue-50 text-blue-700 flex items-center justify-center font-bold text-lg">{t.nom.charAt(0)}</div>
                                        <div><h3 className="font-bold text-gray-800">{t.nom}</h3><p className="text-xs text-gray-500">{t.role}</p></div>
                                        <span className="ml-auto bg-gray-100 text-gray-700 px-2 py-1 rounded text-xs font-bold">{tasks.length} Cmds</span>
                                    </div>

                                    {/* AGENDA DU JOUR */}
                                    <div className="mb-4">
                                        <h4 className="text-xs font-bold text-brand-600 uppercase mb-2 flex items-center gap-1"><Zap size={12}/> Planning du Jour</h4>
                                        {todayTasks.length > 0 ? (
                                            <div className="space-y-1">
                                                {todayTasks.map(({task, order}) => (
                                                    <div key={task.id} className="bg-brand-50 border border-brand-100 p-2 rounded text-xs">
                                                        <div className="font-bold text-gray-800 truncate">{order.clientNom}</div>
                                                        <div className="text-gray-600">{task.description}</div>
                                                        {task.statut === 'FAIT' && <div className="text-green-600 font-bold text-[10px] mt-1 text-right">FAIT</div>}
                                                    </div>
                                                ))}
                                            </div>
                                        ) : (
                                            <div className="text-xs text-gray-400 italic p-2 bg-gray-50 rounded border border-dashed border-gray-200">Rien de prévu spécifiquement aujourd'hui.</div>
                                        )}
                                    </div>

                                    <h4 className="text-xs font-bold text-gray-500 uppercase mb-2">Toutes les commandes</h4>
                                    <div className="space-y-2 flex-1 overflow-y-auto max-h-[200px] custom-scrollbar">
                                        {tasks.length > 0 ? tasks.map(task => (
                                            <div key={task.id} className="p-2 bg-gray-50 rounded border border-gray-100 text-sm">
                                                <div className="flex justify-between mb-1"><span className="font-bold text-gray-700">{task.clientNom}</span><span className={`text-[10px] px-1.5 rounded ${getStatusColor(task.statut)}`}>{task.statut}</span></div>
                                                <p className="text-gray-500 text-xs mb-1">{task.description}</p>
                                                <div className="flex items-center gap-1 text-[10px] text-orange-600 font-medium"><Clock size={10}/> Livraison: {new Date(task.dateLivraisonPrevue).toLocaleDateString()}</div>
                                            </div>
                                        )) : <p className="text-center text-gray-400 text-xs italic py-4">Aucune autre tâche.</p>}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* VIEW: PERFORMANCE */}
            {viewMode === 'PERFORMANCE' && (
                <div className="flex-1 overflow-y-auto">
                    <div className="space-y-6 pb-20">
                        {/* Global Stats */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex items-center justify-between">
                                <div><p className="text-xs text-gray-500 uppercase font-bold">Total Commandes (Mois)</p><p className="text-2xl font-bold text-gray-900">{commandes.filter(c => !c.archived).length}</p></div>
                                <div className="p-2 bg-blue-50 text-blue-600 rounded-full"><LayoutList size={24}/></div>
                            </div>
                            <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex items-center justify-between">
                                <div><p className="text-xs text-gray-500 uppercase font-bold">Chiffre d'Affaires Prod.</p><p className="text-2xl font-bold text-gray-900">{commandes.filter(c => c.type === 'SUR_MESURE' && !c.archived).reduce((acc, c) => acc + c.prixTotal, 0).toLocaleString()} F</p></div>
                                <div className="p-2 bg-green-50 text-green-600 rounded-full"><Wallet size={24}/></div>
                            </div>
                            <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex items-center justify-between">
                                <div><p className="text-xs text-gray-500 uppercase font-bold">Tailleurs Actifs</p><p className="text-2xl font-bold text-gray-900">{tailleurs.length}</p></div>
                                <div className="p-2 bg-purple-50 text-purple-600 rounded-full"><Users size={24}/></div>
                            </div>
                        </div>

                        {/* Tailor Performance Table */}
                        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                            <div className="p-4 bg-gray-50 border-b border-gray-100"><h3 className="font-bold text-gray-700 flex items-center gap-2"><Activity size={18}/> Performance Individuelle</h3></div>
                            <table className="w-full text-sm text-left">
                                <thead className="bg-white text-gray-500 font-medium border-b border-gray-100">
                                    <tr><th className="p-4">Tailleur</th><th className="p-4 text-center">En Cours</th><th className="p-4 text-center">Terminés (Total)</th><th className="p-4 text-right">Valeur Produite</th></tr>
                                </thead>
                                <tbody>
                                    {tailleurs.map(t => {
                                        const totalDone = commandes.filter(c => c.tailleursIds.includes(t.id) && (c.statut === StatutCommande.LIVRE || c.statut === StatutCommande.PRET)).length;
                                        const inProgress = commandes.filter(c => c.tailleursIds.includes(t.id) && c.statut !== StatutCommande.LIVRE && c.statut !== StatutCommande.PRET && c.statut !== StatutCommande.ANNULE).length;
                                        const valueProduced = commandes.filter(c => c.tailleursIds.includes(t.id)).reduce((acc, c) => acc + c.prixTotal, 0);
                                        
                                        return (
                                            <tr key={t.id} className="border-b border-gray-50 hover:bg-gray-50">
                                                <td className="p-4 font-bold text-gray-800">{t.nom}</td>
                                                <td className="p-4 text-center"><span className="bg-blue-100 text-blue-700 px-2 py-1 rounded text-xs font-bold">{inProgress}</span></td>
                                                <td className="p-4 text-center"><span className="bg-green-100 text-green-700 px-2 py-1 rounded text-xs font-bold">{totalDone}</span></td>
                                                <td className="p-4 text-right font-medium text-gray-600">{valueProduced.toLocaleString()} F</td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {/* MODAL QR CODE */}
            {qrOrder && (
                <QRGeneratorModal isOpen={qrModalOpen} onClose={() => setQrModalOpen(false)} value={qrOrder.id} title={qrOrder.clientNom} subtitle={qrOrder.description} />
            )}

            {/* MODAL SCANNER */}
            {isScannerOpen && (
                <QRScannerModal 
                    isOpen={isScannerOpen} 
                    onClose={() => setIsScannerOpen(false)} 
                    onScan={handleScan} 
                />
            )}

            {/* MODAL CREATE / EDIT ORDER */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-black bg-opacity-60 z-[80] flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col animate-in zoom-in duration-200">
                        <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50 rounded-t-xl">
                            <h3 className="font-bold text-lg text-gray-800">{isEditingOrder ? 'Modifier Commande' : 'Nouvelle Commande'}</h3>
                            <button onClick={() => setIsModalOpen(false)}><X size={24} className="text-gray-400 hover:text-gray-600"/></button>
                        </div>
                        <div className="p-6 overflow-y-auto flex-1 space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div><label className="block text-sm font-medium mb-1">Client</label><select className="w-full p-2 border rounded" value={selectedClientId} onChange={e => setSelectedClientId(e.target.value)}><option value="">-- Client --</option>{clients.map(c => <option key={c.id} value={c.id}>{c.nom}</option>)}</select></div>
                                <div><label className="block text-sm font-medium mb-1">Date Livraison</label><input type="date" className="w-full p-2 border rounded" value={dateLivraison} onChange={e => setDateLivraison(e.target.value)}/></div>
                            </div>
                            <div><label className="block text-sm font-medium mb-1">Description</label><input type="text" className="w-full p-2 border rounded" value={description} onChange={e => setDescription(e.target.value)} placeholder="Ex: Robe Bazin..."/></div>
                            <div><label className="block text-sm font-medium mb-1">Notes</label><textarea className="w-full p-2 border rounded" rows={2} value={notes} onChange={e => setNotes(e.target.value)}/></div>
                            
                            <div className="bg-gray-50 p-4 rounded border border-gray-200">
                                <h4 className="font-bold text-sm text-gray-700 mb-2">Assignation</h4>
                                <div className="flex flex-wrap gap-2">
                                    {tailleurs.map(t => (
                                        <button key={t.id} onClick={() => setSelectedTailleurs(prev => prev.includes(t.id) ? prev.filter(id => id !== t.id) : [...prev, t.id])} className={`px-3 py-1 rounded-full text-xs font-bold border ${selectedTailleurs.includes(t.id) ? 'bg-brand-600 text-white border-brand-600' : 'bg-white text-gray-600 border-gray-300'}`}>{t.nom}</button>
                                    ))}
                                </div>
                            </div>

                            <div className="grid grid-cols-3 gap-4">
                                <div><label className="block text-sm font-medium mb-1">Quantité</label><input type="number" className="w-full p-2 border rounded" value={quantite} onChange={e => setQuantite(parseInt(e.target.value) || 1)}/></div>
                                <div><label className="block text-sm font-medium mb-1">Prix TTC</label><input type="number" className="w-full p-2 border rounded font-bold" value={prixBase} onChange={e => setPrixBase(parseInt(e.target.value) || 0)}/></div>
                                <div><label className="block text-sm font-medium mb-1">Avance</label><input type="number" className="w-full p-2 border rounded font-bold text-green-700" value={avance} onChange={e => setAvance(parseInt(e.target.value) || 0)}/></div>
                            </div>

                            {avance > 0 && !isEditingOrder && (
                                <div><label className="block text-sm font-medium mb-1">Compte Encaissement</label><select className="w-full p-2 border rounded bg-green-50 border-green-200" value={initialAccountId} onChange={e => setInitialAccountId(e.target.value)}><option value="">-- Choisir Caisse --</option>{comptes.map(c => <option key={c.id} value={c.id}>{c.nom} ({c.solde.toLocaleString()} F)</option>)}</select></div>
                            )}
                        </div>
                        <div className="p-4 border-t bg-gray-50 flex justify-end gap-3 rounded-b-xl">
                            <button onClick={() => setIsModalOpen(false)} className="px-4 py-2 bg-white border rounded text-gray-700 hover:bg-gray-100">Annuler</button>
                            <button onClick={handleSaveOrder} className="px-4 py-2 bg-brand-600 text-white rounded hover:bg-brand-700 font-bold">Enregistrer</button>
                        </div>
                    </div>
                </div>
            )}

            {/* MODAL PAYMENT HISTORY (NEW) */}
            {paymentHistoryModalOpen && selectedOrderForHistory && (
                <div className="fixed inset-0 bg-black bg-opacity-60 z-[90] flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in duration-200 flex flex-col max-h-[80vh]">
                        <div className="bg-gray-800 text-white p-4 flex justify-between items-center shrink-0">
                            <h3 className="font-bold flex items-center gap-2"><List size={18}/> Historique Paiements</h3>
                            <button onClick={() => setPaymentHistoryModalOpen(false)}><X size={20}/></button>
                        </div>
                        
                        <div className="p-4 bg-gray-50 border-b border-gray-200 shrink-0">
                            <div className="flex justify-between items-end mb-2">
                                <div>
                                    <p className="text-xs text-gray-500 font-bold uppercase">Commande</p>
                                    <p className="font-bold text-gray-800">#{selectedOrderForHistory.id.slice(-6)} - {selectedOrderForHistory.clientNom}</p>
                                </div>
                                <div className="text-right">
                                    <p className="text-xs text-gray-500 font-bold uppercase">Total</p>
                                    <p className="font-bold text-brand-600">{selectedOrderForHistory.prixTotal.toLocaleString()} F</p>
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-2 mt-3">
                                <div className="bg-green-100 p-2 rounded border border-green-200 text-center">
                                    <span className="text-xs text-green-800 block">Déjà Payé</span>
                                    <span className="font-bold text-green-900">{selectedOrderForHistory.avance.toLocaleString()} F</span>
                                </div>
                                <div className="bg-red-100 p-2 rounded border border-red-200 text-center">
                                    <span className="text-xs text-red-800 block">Reste à Payer</span>
                                    <span className="font-bold text-red-900">{selectedOrderForHistory.reste.toLocaleString()} F</span>
                                </div>
                            </div>
                        </div>

                        <div className="flex-1 overflow-y-auto p-4">
                            {selectedOrderForHistory.paiements && selectedOrderForHistory.paiements.length > 0 ? (
                                <table className="w-full text-sm text-left">
                                    <thead className="bg-white border-b border-gray-200 text-gray-500 font-medium text-xs uppercase">
                                        <tr>
                                            <th className="py-2">Date</th>
                                            <th className="py-2">Mode</th>
                                            <th className="py-2">Note</th>
                                            <th className="py-2 text-right">Montant</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                        {selectedOrderForHistory.paiements.map((p, idx) => (
                                            <tr key={idx} className="hover:bg-gray-50">
                                                <td className="py-2.5 text-gray-600">
                                                    <div className="flex flex-col">
                                                        <span className="font-medium text-gray-900">{new Date(p.date).toLocaleDateString()}</span>
                                                        <span className="text-[10px] text-gray-400">{new Date(p.date).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                                                    </div>
                                                </td>
                                                <td className="py-2.5">
                                                    <span className={`px-2 py-1 rounded text-xs font-bold border ${
                                                        p.moyenPaiement === 'ESPECE' ? 'bg-green-50 text-green-700 border-green-200' :
                                                        p.moyenPaiement === 'WAVE' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                                                        p.moyenPaiement === 'ORANGE_MONEY' ? 'bg-orange-50 text-orange-700 border-orange-200' :
                                                        'bg-gray-100 text-gray-700 border-gray-200'
                                                    }`}>
                                                        {formatPaymentMethod(p.moyenPaiement)}
                                                    </span>
                                                </td>
                                                <td className="py-2.5 text-xs text-gray-500 italic max-w-[120px] truncate">{p.note || '-'}</td>
                                                <td className="py-2.5 text-right font-bold text-green-600">+{p.montant.toLocaleString()} F</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            ) : (
                                <div className="text-center py-8 text-gray-400">
                                    <CreditCard size={32} className="mx-auto mb-2 opacity-20"/>
                                    <p>Aucun paiement enregistré.</p>
                                </div>
                            )}
                        </div>

                        <div className="p-3 border-t bg-gray-50 text-right shrink-0">
                            <button onClick={() => setPaymentHistoryModalOpen(false)} className="px-4 py-2 bg-white border rounded text-gray-600 hover:bg-gray-100 text-sm font-medium">Fermer</button>
                        </div>
                    </div>
                </div>
            )}

            {/* MODAL PAYMENT (FIXED Z-INDEX FOR WINDOWS) */}
            {paymentModalOpen && selectedOrderForPayment && (
                <div className="fixed inset-0 bg-black bg-opacity-70 z-[9999] flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm p-6 animate-in zoom-in duration-200 relative" onClick={e => e.stopPropagation()}>
                        <h3 className="text-xl font-bold flex items-center gap-2 mb-4 text-gray-800"><Wallet className="text-green-600"/> Encaissement</h3>
                        
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Montant</label>
                                <input type="number" className="w-full p-3 border border-gray-300 rounded font-bold text-lg text-brand-600" value={paymentAmount} onChange={e => setPaymentAmount(parseInt(e.target.value) || 0)} max={selectedOrderForPayment.reste}/>
                                <p className="text-xs text-gray-500 mt-1">Reste à payer : {selectedOrderForPayment.reste.toLocaleString()} F</p>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Mode de Paiement</label>
                                <select className="w-full p-2 border rounded" value={paymentMethod} onChange={e => setPaymentMethod(e.target.value as ModePaiement)}><option value="ESPECE">Espèce</option><option value="WAVE">Wave</option><option value="ORANGE_MONEY">Orange Money</option><option value="CHEQUE">Chèque</option><option value="VIREMENT">Virement</option></select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Compte Destination</label>
                                <select className="w-full p-2 border rounded bg-gray-50" value={paymentAccountId} onChange={e => setPaymentAccountId(e.target.value)}><option value="">-- Choisir --</option>{comptes.map(c => <option key={c.id} value={c.id}>{c.nom} ({c.solde.toLocaleString()} F)</option>)}</select>
                            </div>
                        </div>

                        <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-gray-100">
                            <button onClick={() => setPaymentModalOpen(false)} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded">Annuler</button>
                            <button onClick={handleConfirmPayment} disabled={!paymentAccountId || paymentAmount <= 0} className="px-4 py-2 bg-green-600 text-white rounded font-bold hover:bg-green-700 disabled:opacity-50">Valider</button>
                        </div>
                    </div>
                </div>
            )}

            {/* MODAL TASK PLANNING */}
            {taskModalOpen && planningTarget && (
                <div className="fixed inset-0 bg-black bg-opacity-70 z-[100] flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm p-6 animate-in zoom-in duration-200">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-xl font-bold text-gray-800">Assigner Tâche</h3>
                            <button onClick={() => setTaskModalOpen(false)}><X size={20}/></button>
                        </div>
                        
                        <div className="bg-gray-50 p-3 rounded mb-4 text-sm text-gray-600">
                            <p><strong>Tailleur :</strong> {planningTarget.tailorName}</p>
                            <p><strong>Date :</strong> {planningTarget.date.toLocaleDateString(undefined, {weekday: 'long', day: 'numeric', month: 'long'})}</p>
                        </div>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Commande à traiter</label>
                                <select 
                                    className="w-full p-2 border border-gray-300 rounded" 
                                    value={newTaskData.orderId} 
                                    onChange={e => setNewTaskData({...newTaskData, orderId: e.target.value})}
                                >
                                    <option value="">-- Choisir Commande --</option>
                                    {filteredCommandes.filter(c => c.statut !== StatutCommande.LIVRE && c.statut !== StatutCommande.ANNULE).map(c => (
                                        <option key={c.id} value={c.id}>{c.clientNom} - {c.description}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Tâche à effectuer</label>
                                <input 
                                    type="text" 
                                    className="w-full p-2 border border-gray-300 rounded" 
                                    value={newTaskData.description} 
                                    onChange={e => setNewTaskData({...newTaskData, description: e.target.value})}
                                    placeholder="Ex: Coupe, Montage, Finition..."
                                />
                            </div>
                        </div>

                        <div className="flex justify-end gap-3 mt-6">
                            <button onClick={() => setTaskModalOpen(false)} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded">Annuler</button>
                            <button onClick={handleSaveTask} disabled={!newTaskData.orderId} className="px-4 py-2 bg-brand-600 text-white rounded font-bold hover:bg-brand-700 disabled:opacity-50">Assigner</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ProductionView;
