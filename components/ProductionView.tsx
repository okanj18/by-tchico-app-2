
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

    // NEW: PAYMENT HISTORY DETAILS MODAL
    const [paymentHistoryModalOpen, setPaymentHistoryModalOpen] = useState(false);
    const [selectedOrderForHistory, setSelectedOrderForHistory] = useState<Commande | null>(null);
    
    // NEW: TASK PLANNING MODAL
    const [taskModalOpen, setTaskModalOpen] = useState(false);
    const [planningTarget, setPlanningTarget] = useState<{ tailorId: string, tailorName: string, date: Date } | null>(null);
    
    // Updated Task Data State
    const [newTaskData, setNewTaskData] = useState<{ 
        orderId: string, 
        action: ActionProduction, 
        quantite: number, 
        note: string,
        elementNom: string 
    }>({ orderId: '', action: 'COUTURE', quantite: 1, note: '', elementNom: '' });

    // FORM ORDER
    const [selectedClientId, setSelectedClientId] = useState('');
    const [notes, setNotes] = useState('');
    const [dateLivraison, setDateLivraison] = useState('');
    const [selectedTailleurs, setSelectedTailleurs] = useState<string[]>([]);
    const [consommations, setConsommations] = useState<{ id: string, articleId: string, variante: string, quantite: number }[]>([]);
    const [tempConso, setTempConso] = useState<{ articleId: string, variante: string, quantite: number }>({ articleId: '', variante: '', quantite: 0 });
    
    // Multi-Item Order State
    const [orderElements, setOrderElements] = useState<{id: string, nom: string, quantite: number}[]>([{id: '1', nom: '', quantite: 1}]);

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

    // Planning Data updated to use agendaBaseDate
    const planningData = useMemo(() => {
        const today = new Date();
        today.setHours(0,0,0,0);
        
        // Generate 7 days starting from agendaBaseDate
        const days = Array.from({length: 7}, (_, i) => {
            const d = new Date(agendaBaseDate);
            d.setDate(agendaBaseDate.getDate() + i);
            return d;
        });

        return { days, today };
    }, [agendaBaseDate]);

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

    // --- NAVIGATION HANDLERS ---
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

    const handleForceRefresh = () => {
        window.location.reload();
    };

    const handleOpenCreateModal = () => {
        setIsEditingOrder(false); setSelectedOrderId(null);
        setSelectedClientId(''); setNotes('');
        setDateLivraison(''); setSelectedTailleurs([]);
        setConsommations([]); setPrixBase(0); setRemise(0); setAvance(0);
        setApplyTva(false); setInitialAccountId('');
        setOrderElements([{id: '1', nom: '', quantite: 1}]); // Reset elements
        setIsModalOpen(true);
    };

    const handleOpenEditModal = (cmd: Commande) => {
        setIsEditingOrder(true); setSelectedOrderId(cmd.id);
        setSelectedClientId(cmd.clientId); 
        setNotes(cmd.notes || '');
        setDateLivraison(cmd.dateLivraisonPrevue.split('T')[0]);
        setSelectedTailleurs(cmd.tailleursIds);
        setConsommations(cmd.consommations ? cmd.consommations.map(c => ({...c, id: `c_${Math.random()}`})) : []);
        setApplyTva(!!cmd.tva && cmd.tva > 0);
        setPrixBase((cmd.prixTotal || 0) - (cmd.tva || 0) + (cmd.remise || 0));
        setRemise(cmd.remise || 0);
        setAvance(cmd.avance);
        
        // Restore elements or fallback to description/quantite
        if (cmd.elements && cmd.elements.length > 0) {
            setOrderElements(cmd.elements.map((el, i) => ({ id: `el_${i}`, nom: el.nom, quantite: el.quantite })));
        } else {
            setOrderElements([{ id: '1', nom: cmd.description, quantite: cmd.quantite }]);
        }

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
        // Validation basic
        if (!selectedClientId || !dateLivraison) { alert("Champs requis manquants."); return; }
        // Validation elements
        const validElements = orderElements.filter(e => e.nom.trim() !== '');
        if (validElements.length === 0) { alert("Ajoutez au moins un article (ex: Robe, Bazin)."); return; }

        const client = clients.find(c => c.id === selectedClientId);
        
        // Generate description from elements
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
            elements: validElements.map(e => ({ nom: e.nom, quantite: e.quantite })), // Save structure
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

    const handleAddOrderElement = () => {
        setOrderElements([...orderElements, { id: `el_${Date.now()}`, nom: '', quantite: 1 }]);
    };

    const handleRemoveOrderElement = (id: string) => {
        if (orderElements.length > 1) {
            setOrderElements(orderElements.filter(e => e.id !== id));
        }
    };

    const handleUpdateOrderElement = (id: string, field: 'nom' | 'quantite', value: any) => {
        setOrderElements(orderElements.map(e => e.id === id ? { ...e, [field]: value } : e));
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
        setNewTaskData({ orderId: '', action: 'COUTURE', quantite: 1, note: '', elementNom: '' });
        setTaskModalOpen(true);
    };

    const handleSaveTask = () => {
        if (!planningTarget || !newTaskData.orderId) return;
        
        const order = commandes.find(c => c.id === newTaskData.orderId);
        if (!order) return;

        // Auto description based on action if no note
        const actionLabel = PRODUCTION_ACTIONS.find(a => a.id === newTaskData.action)?.label || newTaskData.action;
        const desc = newTaskData.note ? `${actionLabel} - ${newTaskData.note}` : actionLabel;

        const newTask: TacheProduction = {
            id: `TASK_${Date.now()}`,
            commandeId: order.id,
            description: desc,
            action: newTaskData.action,
            quantite: newTaskData.quantite,
            note: newTaskData.note,
            elementNom: newTaskData.elementNom || undefined, // Save the specific item name
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

    const getActionStyle = (actionId: string) => {
        const action = PRODUCTION_ACTIONS.find(a => a.id === actionId);
        return action ? action.color : 'text-gray-600 bg-gray-50 border-gray-200';
    };

    const getActionIcon = (actionId: string) => {
        const action = PRODUCTION_ACTIONS.find(a => a.id === actionId);
        const Icon = action ? action.icon : FileText;
        return <Icon size={12} />;
    };

    // Helper to get selected order object in task modal
    const selectedTaskOrder = filteredCommandes.find(c => c.id === newTaskData.orderId);

    return (
        <div className="space-y-6 h-[calc(100vh-8rem)] flex flex-col">
            {/* --- HEADER --- */}
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

            {/* --- FILTERS --- */}
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

            {/* --- VIEW: AGENDA (WITH TEMPORAL NAVIGATION) --- */}
            {viewMode === 'PLANNING' && (
                <div className="flex-1 bg-white rounded-xl shadow-sm border border-gray-200 flex flex-col overflow-hidden">
                    <div className="p-4 bg-gray-50 border-b border-gray-200 flex flex-col sm:flex-row justify-between items-center gap-4">
                        <div className="flex items-center gap-3">
                            <h3 className="font-bold text-gray-700 flex items-center gap-2"><CalendarRange size={18}/> Agenda Quotidien</h3>
                            <div className="flex items-center bg-white border border-gray-200 rounded-lg p-1 shadow-sm ml-2">
                                <button 
                                    onClick={() => navigateAgenda('PREV')}
                                    className="p-1.5 hover:bg-gray-100 rounded text-gray-600 transition-colors"
                                    title="Semaine précédente"
                                >
                                    <ChevronLeft size={18} />
                                </button>
                                <button 
                                    onClick={resetToToday}
                                    className="px-3 py-1 text-xs font-bold text-brand-700 border-x border-gray-100 hover:bg-brand-50"
                                >
                                    Aujourd'hui
                                </button>
                                <button 
                                    onClick={() => navigateAgenda('NEXT')}
                                    className="p-1.5 hover:bg-gray-100 rounded text-gray-600 transition-colors"
                                    title="Semaine suivante"
                                >
                                    <ChevronRight size={18} />
                                </button>
                            </div>
                        </div>
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
                                                    const isGlobalDone = order.statut === StatutCommande.LIVRE || order.statut === StatutCommande.PRET;
                                                    const isDone = task.statut === 'FAIT' || isGlobalDone;
                                                    const style = isDone ? 'bg-green-50 border-green-500 opacity-60 line-through decoration-gray-400' : getActionStyle(task.action || 'AUTRE');

                                                    return (
                                                        <div 
                                                            key={task.id} 
                                                            onClick={(e) => { e.stopPropagation(); handleToggleTaskStatus(task, order); }}
                                                            className={`p-2 rounded shadow-sm text-xs cursor-pointer border-l-4 relative group/task ${style} border`}
                                                        >
                                                            <div className="font-bold truncate text-gray-800" title={order.clientNom}>{order.clientNom}</div>
                                                            <div className="text-[10px] text-gray-600 truncate mb-0.5 font-medium" title={task.elementNom || order.description}>
                                                                {task.elementNom ? task.elementNom : order.description}
                                                            </div>
                                                            <div className="flex items-center gap-1 font-bold mt-0.5">
                                                                {getActionIcon(task.action)} 
                                                                <span>{task.action || 'Tâche'}</span>
                                                                {task.quantite > 1 && <span className="ml-auto bg-white/50 px-1 rounded text-[10px]">x{task.quantite}</span>}
                                                            </div>
                                                            {task.note && <div className="text-[10px] italic mt-1 truncate opacity-80">{task.note}</div>}
                                                            
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

            {/* ... (AUTRES VUES: KANBAN, ORDERS, HISTORY, TAILORS, PERFORMANCE restent inchangées) ... */}
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

            {/* GRID VIEW */}
            {viewMode === 'ORDERS' && (
                <div className="flex-1 overflow-y-auto">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pb-20">
                        {filteredCommandes.map(cmd => (
                            <div key={cmd.id} className="bg-white rounded-xl border border-gray-200 shadow-sm flex flex-col h-full overflow-hidden">
                                <div className="p-5 flex-1 relative">
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
                                    {cmd.elements && cmd.elements.length > 0 ? (
                                        <div className="mb-3 space-y-1">
                                            {cmd.elements.map((el, i) => (
                                                <div key={i} className="text-sm text-gray-600 flex justify-between bg-gray-50 px-2 py-1 rounded">
                                                    <span>{el.nom}</span>
                                                    <span className="font-bold">x{el.quantite}</span>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <p className="text-sm text-gray-600 mb-3 line-clamp-2">{cmd.description}</p>
                                    )}
                                    <div className="flex items-center gap-4 text-xs text-gray-500 mb-4">
                                        <div className="flex items-center gap-1"><Calendar size={12}/> {new Date(cmd.dateLivraisonPrevue).toLocaleDateString()}</div>
                                        <div className="flex items-center gap-1"><Shirt size={12}/> Qté Total: {cmd.quantite}</div>
                                    </div>
                                </div>
                                <div className="p-3 bg-gray-50 border-t border-gray-100 flex items-center justify-between z-20 relative">
                                    <div className="text-xs">
                                        {cmd.reste > 0 ? <span className="text-red-600 font-bold">Reste: {cmd.reste.toLocaleString()} F</span> : <span className="text-green-600 font-bold flex items-center gap-1"><CheckSquare size={10}/> Payé</span>}
                                    </div>
                                    {canSeeFinance && cmd.reste > 0 && (
                                        <button onClick={(e) => { e.preventDefault(); e.stopPropagation(); openPaymentModal(cmd); }} className="px-4 py-2 bg-brand-600 text-white text-xs font-bold rounded shadow hover:bg-brand-700 cursor-pointer active:scale-95 transition-transform" style={{ zIndex: 50, position: 'relative' }}>ENCAISSER</button>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* ... MODALS (RESTE DES MODALS IDENTIQUES) ... */}
            {qrOrder && (
                <QRGeneratorModal isOpen={qrModalOpen} onClose={() => setQrModalOpen(false)} value={qrOrder.id} title={qrOrder.clientNom} subtitle={qrOrder.description} />
            )}

            {isScannerOpen && (
                <QRScannerModal isOpen={isScannerOpen} onClose={() => setIsScannerOpen(false)} onScan={handleScan} />
            )}

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
                            <div className="bg-gray-50 p-4 rounded border border-gray-200">
                                <h4 className="font-bold text-sm text-gray-700 mb-2">Détail des articles</h4>
                                {orderElements.map((element, index) => (
                                    <div key={element.id} className="flex gap-2 mb-2 items-center">
                                        <input type="text" className="flex-1 p-2 border rounded text-sm" placeholder="Article (ex: Robe, Costume...)" value={element.nom} onChange={(e) => handleUpdateOrderElement(element.id, 'nom', e.target.value)} />
                                        <input type="number" className="w-20 p-2 border rounded text-sm text-center" min="1" value={element.quantite} onChange={(e) => handleUpdateOrderElement(element.id, 'quantite', parseInt(e.target.value) || 1)} />
                                        <button onClick={() => handleRemoveOrderElement(element.id)} className="p-2 text-red-400 hover:text-red-600" disabled={orderElements.length === 1}><Trash2 size={16}/></button>
                                    </div>
                                ))}
                                <button onClick={handleAddOrderElement} className="text-xs text-brand-600 font-bold flex items-center gap-1 mt-2"><Plus size={14}/> Ajouter un autre article</button>
                            </div>
                            <div><label className="block text-sm font-medium mb-1">Notes</label><textarea className="w-full p-2 border rounded" rows={2} value={notes} onChange={e => setNotes(e.target.value)}/></div>
                            <div className="grid grid-cols-2 gap-4">
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
                                <select className="w-full p-2 border border-gray-300 rounded" value={newTaskData.orderId} onChange={e => { const ord = filteredCommandes.find(c => c.id === e.target.value); setNewTaskData({ ...newTaskData, orderId: e.target.value, elementNom: '', quantite: ord ? ord.quantite : 1 }); }}>
                                    <option value="">-- Choisir Commande --</option>
                                    {filteredCommandes.filter(c => c.statut !== StatutCommande.LIVRE && c.statut !== StatutCommande.ANNULE).map(c => (
                                        <option key={c.id} value={c.id}>{c.clientNom} - {c.description} (Total: {c.quantite})</option>
                                    ))}
                                </select>
                            </div>
                            {newTaskData.orderId && (
                                <>
                                    {selectedTaskOrder && selectedTaskOrder.elements && selectedTaskOrder.elements.length > 0 && (
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">Article concerné</label>
                                            <select className="w-full p-2 border border-gray-300 rounded bg-blue-50 border-blue-200" value={newTaskData.elementNom} onChange={e => { const selectedEl = selectedTaskOrder.elements?.find(el => el.nom === e.target.value); setNewTaskData({ ...newTaskData, elementNom: e.target.value, quantite: selectedEl ? selectedEl.quantite : 1 }); }}>
                                                <option value="">-- Tout / Général --</option>
                                                {selectedTaskOrder.elements.map((el, i) => ( <option key={i} value={el.nom}>{el.nom} (Qté: {el.quantite})</option> ))}
                                            </select>
                                        </div>
                                    )}
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">Action</label>
                                            <select className="w-full p-2 border border-gray-300 rounded bg-white" value={newTaskData.action} onChange={e => setNewTaskData({...newTaskData, action: e.target.value as ActionProduction})}>
                                                {PRODUCTION_ACTIONS.map(act => ( <option key={act.id} value={act.id}>{act.label}</option> ))}
                                            </select>
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">Quantité traitée</label>
                                            <input type="number" className="w-full p-2 border border-gray-300 rounded font-bold text-center" value={newTaskData.quantite} min={1} onChange={e => setNewTaskData({...newTaskData, quantite: parseInt(e.target.value) || 1})} />
                                        </div>
                                    </div>
                                </>
                            )}
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
