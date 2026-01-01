
import React, { useState, useMemo } from 'react';
import { Commande, Employe, Client, Article, StatutCommande, RoleEmploye, ModePaiement, CompteFinancier, CompanyAssets, TacheProduction, ActionProduction } from '../types';
/* Added Star to the lucide-react import list to fix the "Cannot find name 'Star'" error on line 526 */
import { Scissors, Search, X, Activity, Clock, Calendar, CheckCircle, Columns, Eye, Plus, Edit2, UserPlus, Trophy, DollarSign, Ban, Truck, Users, ChevronLeft, ChevronRight, ClipboardList, FileText, Sparkles, Printer, Zap, TrendingUp, AlertCircle, Star } from 'lucide-react';
import { analyzeProductionBottlenecks } from '../services/geminiService';
import { COMPANY_CONFIG } from '../config';

interface ProductionViewProps {
    commandes: Commande[];
    employes: Employe[];
    clients: Client[];
    articles: Article[];
    userRole: RoleEmploye;
    onUpdateStatus: (id: string, status: StatutCommande) => void;
    onCreateOrder: (order: Commande, consommations: any[], paymentMethod?: ModePaiement, accountId?: string) => void;
    onUpdateOrder: (order: Commande) => void;
    /* Fixed: Removed duplicate onAddPayment property from interface */
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

const STATUS_COLORS: Record<string, string> = {
    [StatutCommande.EN_ATTENTE]: 'bg-gray-100 text-gray-600 border-gray-200',
    [StatutCommande.EN_COUPE]: 'bg-blue-50 text-blue-700 border-blue-100',
    [StatutCommande.COUTURE]: 'bg-indigo-50 text-indigo-700 border-indigo-100',
    [StatutCommande.FINITION]: 'bg-amber-50 text-amber-700 border-amber-100',
    [StatutCommande.PRET]: 'bg-green-50 text-green-700 border-green-100',
    [StatutCommande.LIVRE]: 'bg-emerald-100 text-emerald-800 border-emerald-200',
};

const ProductionView: React.FC<ProductionViewProps> = ({ 
    commandes, employes, clients, articles, userRole, 
    onUpdateStatus, onCreateOrder, onUpdateOrder, onAddPayment, onArchiveOrder, comptes, companyAssets 
}) => {
    const [viewMode, setViewMode] = useState<'ORDERS' | 'KANBAN' | 'PLANNING' | 'TAILORS' | 'PERFORMANCE'>('PLANNING');
    const [searchTerm, setSearchTerm] = useState('');
    const [listFilter, setListFilter] = useState<'ACTIVE' | 'READY' | 'DEVIS' | 'ALL'>('ACTIVE');
    
    // Modal States
    const [taskModalOpen, setTaskModalOpen] = useState(false);
    const [orderModalOpen, setOrderModalOpen] = useState(false);
    const [isEditingOrder, setIsEditingOrder] = useState(false);
    const [paymentModalOpen, setPaymentModalOpen] = useState<Commande | null>(null);
    const [orderDetailView, setOrderDetailView] = useState<Commande | null>(null);

    // AI Analysis State
    const [aiAnalysis, setAiAnalysis] = useState<string | null>(null);
    const [isAiLoading, setIsAiLoading] = useState(false);

    // Form Data
    const [newOrderItems, setNewOrderItems] = useState<{nom: string, qte: number}[]>([{nom: '', qte: 1}]);
    const [newOrderData, setNewOrderData] = useState<Partial<Commande>>({
        clientId: '', dateLivraisonPrevue: '', prixTotal: 0, avance: 0, isDevis: false
    });
    const [initialAccountId, setInitialAccountId] = useState('');
    const [payAmount, setPayAmount] = useState(0);
    const [payMethod, setPayMethod] = useState<ModePaiement>('ESPECE');
    const [payAccount, setPayAccount] = useState('');
    const [payDate, setPayDate] = useState(new Date().toISOString().split('T')[0]);
    const [newTaskData, setNewTaskData] = useState({ 
        orderId: '', elementNom: '', action: 'COUPE' as ActionProduction, quantite: 1, tailleurId: '', note: '', date: new Date().toISOString().split('T')[0]
    });

    // Planning Navigation
    const [planningStartDate, setPlanningStartDate] = useState(new Date());

    const tailleurs = useMemo(() => employes.filter(e => e.actif !== false && (e.role === 'TAILLEUR' || e.role === 'CHEF_ATELIER' || e.role === 'STAGIAIRE')), [employes]);

    const filteredCommandes = useMemo(() => {
        return commandes.filter(c => {
            if (c.type !== 'SUR_MESURE') return false;
            const isCompleted = c.statut === StatutCommande.LIVRE || c.statut === StatutCommande.ANNULE;
            const matchesFilter = listFilter === 'ACTIVE' ? !isCompleted && !c.isDevis :
                                 listFilter === 'READY' ? c.statut === StatutCommande.PRET :
                                 listFilter === 'DEVIS' ? c.isDevis === true : true;
            return matchesFilter && c.clientNom.toLowerCase().includes(searchTerm.toLowerCase());
        }).sort((a, b) => new Date(b.dateCommande).getTime() - new Date(a.dateCommande).getTime());
    }, [commandes, searchTerm, listFilter]);

    // --- AI ANALYSIS ---
    const handleRunAIAnalysis = async () => {
        setIsAiLoading(true);
        const result = await analyzeProductionBottlenecks(commandes.filter(c => c.statut !== StatutCommande.LIVRE && !c.isDevis), tailleurs);
        setAiAnalysis(result);
        setIsAiLoading(false);
    };

    // --- PRINT WORKSHOP SLIP ---
    const handlePrintWorkshopSlip = (order: Commande) => {
        const client = clients.find(c => c.id === order.clientId);
        const printWindow = window.open('', '', 'width=800,height=900');
        if (!printWindow) return;

        const logoUrl = companyAssets?.logoStr || `${window.location.origin}${COMPANY_CONFIG.logoUrl}`;
        const measurementsHtml = client?.mesures ? Object.entries(client.mesures).map(([k, v]) => `<div><b>${k.toUpperCase()}:</b> ${v}</div>`).join('') : 'Pas de mesures';

        const html = `
            <html>
                <head>
                    <title>FICHE ATELIER #${order.id}</title>
                    <style>
                        body { font-family: 'Inter', sans-serif; padding: 40px; color: #1a1a1a; }
                        .header { display: flex; justify-content: space-between; border-bottom: 4px solid #000; padding-bottom: 20px; }
                        .section { margin-top: 30px; }
                        .title { font-size: 24px; font-weight: 900; text-transform: uppercase; margin-bottom: 10px; }
                        .grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 15px; font-size: 14px; }
                        .elements { background: #f4f4f4; padding: 20px; border-radius: 10px; font-size: 18px; font-weight: bold; }
                        .footer { margin-top: 50px; font-size: 10px; color: #888; text-align: center; }
                    </style>
                </head>
                <body>
                    <div class="header">
                        <div>
                            <img src="${logoUrl}" style="height: 60px"/>
                            <div style="font-size: 20px; font-weight: 900;">${COMPANY_CONFIG.name}</div>
                        </div>
                        <div style="text-align: right">
                            <div class="title">FICHE D'ATELIER</div>
                            <div style="font-size: 18px; font-weight: bold;">CMD #${order.id.slice(-6)}</div>
                            <div>Livraison prévue: <b>${new Date(order.dateLivraisonPrevue).toLocaleDateString()}</b></div>
                        </div>
                    </div>
                    <div class="section">
                        <div class="title">Client: ${order.clientNom}</div>
                        <div class="elements">Composition: ${order.description}</div>
                    </div>
                    <div class="section">
                        <div class="title" style="font-size: 16px;">Mesures Techniques (CM)</div>
                        <div class="grid">${measurementsHtml}</div>
                    </div>
                    <div class="section" style="border: 2px solid #000; padding: 20px; min-height: 150px;">
                        <div class="title" style="font-size: 16px;">Notes de Coupe & Style</div>
                        <p>${client?.stylePreferences || 'Aucune note particulière.'}</p>
                    </div>
                    <div class="footer">Document généré par BY TCHICO Manager v${COMPANY_CONFIG.version}</div>
                    <script>window.print();</script>
                </body>
            </html>
        `;
        printWindow.document.write(html);
        printWindow.document.close();
    };

    // --- DRAG & DROP ---
    const onDragStart = (e: React.DragEvent, orderId: string, sourceStatus: string) => {
        e.dataTransfer.setData("orderId", orderId);
        e.dataTransfer.setData("sourceStatus", sourceStatus);
    };

    const onDrop = (e: React.DragEvent, targetStatus: StatutCommande) => {
        e.preventDefault();
        const orderId = e.dataTransfer.getData("orderId");
        const sourceStatus = e.dataTransfer.getData("sourceStatus");
        if (sourceStatus === targetStatus) return;

        const order = commandes.find(c => c.id === orderId);
        if (!order) return;

        const qtyToMove = order.repartitionStatuts?.[sourceStatus] || 0;
        if (qtyToMove <= 0) return;

        const newRepartition = { ...(order.repartitionStatuts || {}) };
        newRepartition[sourceStatus] = 0;
        newRepartition[targetStatus] = (newRepartition[targetStatus] || 0) + qtyToMove;

        onUpdateOrder({ ...order, repartitionStatuts: newRepartition, statut: targetStatus === StatutCommande.PRET ? StatutCommande.PRET : targetStatus });
    };

    // --- LOGIQUE LIVRAISON ---
    const handleDeliverParts = (order: Commande) => {
        const qtyReady = order.repartitionStatuts?.[StatutCommande.PRET] || 0;
        if (qtyReady <= 0) {
            alert("Aucune pièce n'est prête pour la livraison.");
            return;
        }

        if (!window.confirm(`Confirmer la livraison de ${qtyReady} pièce(s) prête(s) pour le client ${order.clientNom} ?`)) {
            return;
        }

        if (order.reste > 0) {
            alert(`Attention : Le client doit encore régler ${order.reste.toLocaleString()} F.`);
        }

        const newRepartition = { ...(order.repartitionStatuts || {}) };
        newRepartition[StatutCommande.PRET] = 0;
        newRepartition[StatutCommande.LIVRE] = (newRepartition[StatutCommande.LIVRE] || 0) + qtyReady;

        const deliveredOnly = newRepartition[StatutCommande.LIVRE] || 0;
        const isFullyDelivered = deliveredOnly >= order.quantite;

        const updatedOrder = {
            ...order,
            repartitionStatuts: newRepartition,
            statut: isFullyDelivered ? StatutCommande.LIVRE : order.statut,
            dateLivraisonEffective: isFullyDelivered ? new Date().toISOString() : order.dateLivraisonEffective
        };

        onUpdateOrder(updatedOrder);
        if (orderDetailView && orderDetailView.id === order.id) setOrderDetailView(updatedOrder);
        alert(`${qtyReady} pièce(s) marquée(s) comme LIVRÉES.`);
    };

    const handleToggleTaskStatus = (tk: TacheProduction) => {
        const order = commandes.find(c => c.id === tk.commandeId);
        if (!order) return;
        
        const newStatutTache = tk.statut === 'A_FAIRE' ? 'FAIT' : 'A_FAIRE';
        const updatedTaches = order.taches?.map(t => t.id === tk.id ? { ...t, statut: newStatutTache as 'A_FAIRE' | 'FAIT' } : t);
        
        let newRepartition = { ...(order.repartitionStatuts || {}) };
        const qte = tk.quantite || 1;

        if (newStatutTache === 'FAIT') {
            let source = StatutCommande.EN_ATTENTE;
            let target = StatutCommande.EN_COUPE;
            if (tk.action === 'COUPE') { source = StatutCommande.EN_ATTENTE; target = StatutCommande.EN_COUPE; }
            else if (tk.action === 'COUTURE') { source = StatutCommande.EN_COUPE; target = StatutCommande.COUTURE; }
            else if (tk.action === 'FINITION') { source = StatutCommande.COUTURE; target = StatutCommande.FINITION; }
            else if (tk.action === 'REPASSAGE') { source = StatutCommande.FINITION; target = StatutCommande.PRET; }
            newRepartition[source] = Math.max(0, (newRepartition[source] || 0) - qte);
            newRepartition[target] = (newRepartition[target] || 0) + qte;
        } else {
            let source = StatutCommande.EN_COUPE;
            let target = StatutCommande.EN_ATTENTE;
            if (tk.action === 'COUPE') { source = StatutCommande.EN_COUPE; target = StatutCommande.EN_ATTENTE; }
            else if (tk.action === 'COUTURE') { source = StatutCommande.COUTURE; target = StatutCommande.EN_COUPE; }
            else if (tk.action === 'FINITION') { source = StatutCommande.FINITION; target = StatutCommande.COUTURE; }
            else if (tk.action === 'REPASSAGE') { source = StatutCommande.PRET; target = StatutCommande.FINITION; }
            newRepartition[source] = Math.max(0, (newRepartition[source] || 0) - qte);
            newRepartition[target] = (newRepartition[target] || 0) + qte;
        }

        onUpdateOrder({ ...order, taches: updatedTaches, repartitionStatuts: newRepartition });
    };

    const handleAddTask = () => {
        if (!newTaskData.orderId || !newTaskData.tailleurId || !newTaskData.elementNom) return;
        const order = commandes.find(c => c.id === newTaskData.orderId);
        if (!order) return;
        const newTask: TacheProduction = {
            id: `T_${Date.now()}`, commandeId: order.id, action: newTaskData.action, quantite: newTaskData.quantite,
            tailleurId: newTaskData.tailleurId, date: newTaskData.date, statut: 'A_FAIRE', elementNom: newTaskData.elementNom
        };
        onUpdateOrder({ ...order, taches: [...(order.taches || []), newTask], tailleursIds: Array.from(new Set([...(order.tailleursIds || []), newTaskData.tailleurId])) });
        setTaskModalOpen(false);
    };

    const handleOpenEditOrder = (order: Commande) => {
        setNewOrderData({ ...order });
        if (order.elements) setNewOrderItems(order.elements.map(e => ({ nom: e.nom, qte: e.quantite })));
        else setNewOrderItems([{nom: '', qte: 1}]);
        setIsEditingOrder(true);
        setOrderModalOpen(true);
    };

    const handleConfirmPayment = () => {
        if (!paymentModalOpen || payAmount <= 0 || !payAccount) return;
        onAddPayment(paymentModalOpen.id, payAmount, payMethod, "Règlement Production", payDate, payAccount);
        setPaymentModalOpen(null);
    };

    const handleCreateOrUpdateOrder = () => {
        if (!newOrderData.clientId || !newOrderData.prixTotal) return;
        
        const totalQty = newOrderItems.reduce((acc, i) => acc + i.qte, 0);
        const description = newOrderItems.map(i => `${i.nom} (x${i.qte})`).join(', ');
        const prixTotal = newOrderData.prixTotal || 0;
        const avance = newOrderData.avance || 0;
        const reste = prixTotal - avance;

        if (isEditingOrder && newOrderData.id) {
            const existing = commandes.find(c => c.id === newOrderData.id);
            if (!existing) return;
            onUpdateOrder({ ...existing, ...newOrderData, description, elements: newOrderItems.map(i => ({nom: i.nom.toUpperCase(), quantite: i.qte})), quantite: totalQty, reste: reste } as Commande);
        } else {
            if (avance > 0 && !initialAccountId) { alert("Veuillez choisir une caisse pour l'acompte."); return; }
            const client = clients.find(c => c.id === newOrderData.clientId);
            const order: Commande = {
                id: `CMD_${Date.now()}`, clientId: newOrderData.clientId || '', clientNom: client?.nom || 'Client',
                description, dateCommande: new Date().toISOString(), dateLivraisonPrevue: newOrderData.dateLivraisonPrevue || '',
                statut: StatutCommande.EN_ATTENTE, tailleursIds: [], prixTotal: prixTotal,
                avance: avance, reste: reste,
                type: 'SUR_MESURE', quantite: totalQty, isDevis: newOrderData.isDevis || false,
                repartitionStatuts: { [StatutCommande.EN_ATTENTE]: totalQty },
                elements: newOrderItems.map(i => ({nom: i.nom.toUpperCase(), quantite: i.qte}))
            };
            onCreateOrder(order, [], 'ESPECE', initialAccountId);
        }
        setOrderModalOpen(false);
    };

    const planningDays = useMemo(() => {
        const days = [];
        for (let i = 0; i < 7; i++) {
            const d = new Date(planningStartDate);
            d.setDate(planningStartDate.getDate() + i);
            days.push(d);
        }
        return days;
    }, [planningStartDate]);

    const performanceStats = useMemo(() => {
        return tailleurs.map(t => {
            const finishedTasks = (commandes.flatMap(c => c.taches || [])).filter(tk => tk.tailleurId === t.id && tk.statut === 'FAIT').length;
            const ongoingTasks = (commandes.flatMap(c => c.taches || [])).filter(tk => tk.tailleurId === t.id && tk.statut === 'A_FAIRE').length;
            return { ...t, finishedTasks, ongoingTasks };
        }).sort((a, b) => b.finishedTasks - a.finishedTasks);
    }, [tailleurs, commandes]);

    return (
        <div className="space-y-6 h-[calc(100vh-8rem)] flex flex-col">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 shrink-0">
                <div className="flex items-center gap-3">
                    <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2"><Scissors className="text-brand-600"/> Atelier & Flux</h2>
                    <button onClick={() => { setIsEditingOrder(false); setOrderModalOpen(true); setNewOrderItems([{nom: '', qte: 1}]); setInitialAccountId(''); setNewOrderData({clientId: '', dateLivraisonPrevue: '', prixTotal: 0, avance: 0, isDevis: false}); }} className="bg-brand-900 text-white px-4 py-2 rounded-lg flex items-center gap-2 text-[10px] font-black uppercase hover:bg-black transition-all shadow-lg active:scale-95"><Plus size={16}/> Nouvelle Commande</button>
                    <button onClick={() => setTaskModalOpen(true)} className="bg-orange-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 text-[10px] font-black uppercase hover:bg-orange-700 transition-all shadow-lg active:scale-95"><UserPlus size={16}/> Assigner Tâche</button>
                    <button onClick={handleRunAIAnalysis} disabled={isAiLoading} className="bg-purple-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 text-[10px] font-black uppercase hover:bg-purple-700 transition-all shadow-lg active:scale-95 disabled:opacity-50">
                        {isAiLoading ? <Clock size={16} className="animate-spin"/> : <Sparkles size={16}/>} IA Analyse
                    </button>
                </div>
                <div className="flex flex-wrap bg-white border p-1 rounded-xl shadow-sm gap-1">
                    {[{id: 'PLANNING', label: 'Agenda', icon: Calendar}, {id: 'KANBAN', label: 'Kanban', icon: Columns}, {id: 'ORDERS', label: 'Commandes', icon: ClipboardList}, {id: 'TAILORS', label: 'Artisans', icon: Users}, {id: 'PERFORMANCE', label: 'Top Performance', icon: Trophy}].map((mode) => (
                        <button key={mode.id} onClick={() => setViewMode(mode.id as any)} className={`px-4 py-1.5 text-[10px] font-black uppercase rounded-lg flex items-center gap-2 transition-all ${viewMode === mode.id ? 'bg-brand-900 text-white shadow-md' : 'text-gray-500 hover:bg-gray-50'}`}><mode.icon size={14}/> {mode.label}</button>
                    ))}
                </div>
            </div>

            {aiAnalysis && (
                <div className="bg-purple-50 border-l-4 border-purple-500 p-4 rounded-r-xl shadow-sm animate-in slide-in-from-top-4 flex justify-between items-center">
                    <div className="flex items-center gap-3">
                        <Zap className="text-purple-600" size={24}/>
                        <div>
                            <p className="text-[10px] font-black text-purple-400 uppercase tracking-widest">Conseil Stratégique Gemini</p>
                            <p className="text-xs font-bold text-purple-900">{aiAnalysis}</p>
                        </div>
                    </div>
                    <button onClick={() => setAiAnalysis(null)}><X size={16} className="text-purple-400"/></button>
                </div>
            )}

            <div className="flex-1 overflow-hidden">
                {viewMode === 'ORDERS' && (
                    <div className="bg-white border rounded-2xl shadow-sm h-full flex flex-col overflow-hidden">
                        <div className="p-4 bg-gray-50 border-b flex justify-between items-center shrink-0">
                            <div className="flex bg-white border p-1 rounded-xl shadow-inner overflow-x-auto no-scrollbar">
                                {[{id: 'ACTIVE', label: 'En cours', icon: Activity},{id: 'READY', label: 'Prêts', icon: CheckCircle},{id: 'DEVIS', label: 'Devis', icon: FileText},{id: 'ALL', label: 'Toutes', icon: ClipboardList}].map((f) => (
                                    <button key={f.id} onClick={() => setListFilter(f.id as any)} className={`px-4 py-2 text-[10px] font-black uppercase rounded-lg transition-all flex items-center gap-2 whitespace-nowrap ${listFilter === f.id ? 'bg-brand-900 text-white shadow-lg' : 'text-gray-400 hover:bg-gray-50'}`}><f.icon size={12}/> {f.label}</button>
                                ))}
                            </div>
                            <div className="relative w-64 hidden md:block">
                                <Search className="absolute left-3 top-2.5 text-gray-400" size={16}/>
                                <input type="text" placeholder="Chercher client..." className="w-full pl-10 pr-4 py-2 border rounded-lg text-sm" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
                            </div>
                        </div>
                        <div className="flex-1 overflow-auto custom-scrollbar">
                            <table className="w-full text-sm text-left">
                                <thead className="bg-gray-50 text-gray-400 font-black uppercase text-[9px] tracking-widest sticky top-0 z-10 border-b">
                                    <tr><th className="p-4">Client & Artisans</th><th className="p-4 text-center">Finance</th><th className="p-4">État Production</th><th className="p-4 text-right">Actions</th></tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {filteredCommandes.map(order => (
                                        <tr key={order.id} className="hover:bg-gray-50 transition-colors">
                                            <td className="p-4">
                                                <div className="font-black uppercase text-gray-900">{order.clientNom}</div>
                                                <div className="flex flex-wrap gap-1 mt-1">
                                                    {(order.tailleursIds || []).map(tid => (
                                                        <span key={tid} className="px-1.5 py-0.5 bg-brand-50 text-brand-700 text-[8px] font-black uppercase rounded border border-brand-100">{employes.find(e => e.id === tid)?.nom}</span>
                                                    ))}
                                                </div>
                                            </td>
                                            <td className="p-4 text-center">
                                                <div className="font-black text-gray-900">{order.prixTotal.toLocaleString()} F</div>
                                                <div className={`text-[9px] font-black uppercase ${order.reste > 0 ? 'text-red-500' : 'text-green-600'}`}>{order.reste > 0 ? `Reste: ${order.reste.toLocaleString()} F` : 'Soldé'}</div>
                                            </td>
                                            <td className="p-4">
                                                <div className="flex flex-wrap gap-2">
                                                    {KANBAN_STATUS_ORDER.map(status => {
                                                        const count = order.repartitionStatuts?.[status] || 0;
                                                        if (count === 0) return null;
                                                        return <span key={status} className={`px-2 py-1 border rounded shadow-sm text-[8px] font-black uppercase ${STATUS_COLORS[status]}`}>{status} ({count})</span>;
                                                    })}
                                                </div>
                                            </td>
                                            <td className="p-4 text-right relative">
                                                <div className="flex justify-end gap-1.5 relative z-20">
                                                    <button onClick={() => setOrderDetailView(order)} className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg border shadow-sm" title="Détails"><Eye size={16}/></button>
                                                    <button onClick={() => handleOpenEditOrder(order)} className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg border shadow-sm" title="Modifier"><Edit2 size={16}/></button>
                                                    {order.reste > 0 && <button onClick={() => setPaymentModalOpen(order)} className="p-2 text-green-600 hover:bg-green-50 rounded-lg border shadow-sm" title="Encaisser"><DollarSign size={16}/></button>}
                                                    {(order.repartitionStatuts?.[StatutCommande.PRET] || 0) > 0 && (
                                                        <button onClick={() => handleDeliverParts(order)} className="px-3 py-1 bg-green-600 text-white rounded text-[9px] font-black uppercase flex items-center gap-1 shadow-sm hover:bg-green-700 transition-all"><Truck size={14}/> Livrer</button>
                                                    )}
                                                    <button onClick={() => { if(window.confirm("Annuler cette commande ?")) onUpdateStatus(order.id, StatutCommande.ANNULE) }} className="p-2 text-red-400 hover:bg-red-50 rounded-lg border shadow-sm" title="Annuler"><Ban size={16}/></button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {viewMode === 'KANBAN' && (
                    <div className="flex-1 overflow-x-auto p-4 flex gap-6 bg-gray-50 h-full">
                        {KANBAN_STATUS_ORDER.map(status => (
                            <div key={status} onDragOver={e => e.preventDefault()} onDrop={e => onDrop(e, status)} className="w-80 flex flex-col h-full min-w-[20rem]">
                                <div className="flex justify-between items-center mb-4 px-2">
                                    <h4 className="font-black text-xs uppercase tracking-widest text-gray-700">{status}</h4>
                                    <span className={`text-[10px] font-black px-3 py-1 rounded-full border shadow-sm ${STATUS_COLORS[status]}`}>
                                        {commandes.reduce((acc, c) => acc + (c.repartitionStatuts?.[status] || 0), 0)} pcs
                                    </span>
                                </div>
                                <div className="flex-1 overflow-y-auto space-y-4 custom-scrollbar pr-2 pb-10">
                                    {commandes.filter(c => (c.repartitionStatuts?.[status] || 0) > 0 && !c.isDevis && !c.archived).map(order => (
                                        <div key={order.id} draggable onDragStart={e => onDragStart(e, order.id, status)} className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 cursor-grab active:cursor-grabbing hover:shadow-md transition-all group">
                                            <div className="flex justify-between items-start mb-3">
                                                <span className="text-[9px] font-bold text-gray-300 font-mono">#{order.id.slice(-6)}</span>
                                                <span className={`text-[10px] font-black px-2 py-0.5 rounded-lg border uppercase ${STATUS_COLORS[status]}`}>QTÉ: {order.repartitionStatuts?.[status]}</span>
                                            </div>
                                            <h5 className="font-black text-sm uppercase text-gray-800 mb-2">{order.clientNom}</h5>
                                            <div className="bg-orange-50/50 p-3 rounded-xl border border-orange-100">
                                                <p className="text-[9px] font-bold text-orange-800 uppercase italic">
                                                    {order.elements?.map(e => `${e.nom} (x${e.quantite})`).join(', ')}
                                                </p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {viewMode === 'PLANNING' && (
                    <div className="flex-1 bg-white border rounded-2xl h-full flex flex-col overflow-hidden">
                        <div className="p-4 border-b bg-gray-50 flex items-center justify-between shrink-0">
                            <div className="flex items-center gap-4">
                                <div className="flex gap-1">
                                    <button onClick={() => { const d = new Date(planningStartDate); d.setDate(d.getDate() - 7); setPlanningStartDate(d); }} className="p-2 bg-white border rounded-lg hover:bg-gray-100 transition-colors shadow-sm"><ChevronLeft size={18}/></button>
                                    <button onClick={() => { const d = new Date(planningStartDate); d.setDate(d.getDate() + 7); setPlanningStartDate(d); }} className="p-2 bg-white border rounded-lg hover:bg-gray-100 transition-colors shadow-sm"><ChevronRight size={18}/></button>
                                </div>
                                <h3 className="font-black text-sm uppercase tracking-[0.2em] text-gray-700">{planningStartDate.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}</h3>
                            </div>
                        </div>
                        <div className="flex-1 overflow-auto custom-scrollbar">
                            <table className="w-full border-collapse">
                                <thead className="sticky top-0 bg-gray-50 z-20 shadow-sm">
                                    <tr>
                                        <th className="p-4 text-left border-b border-r bg-gray-100 w-64 text-[10px] font-black text-gray-400 uppercase tracking-widest">ARTISAN</th>
                                        {planningDays.map(day => (
                                            <th key={day.toISOString()} className="p-4 text-center border-b border-r min-w-[150px]">
                                                <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">{day.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric' })}</span>
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {tailleurs.map(t => (
                                        <tr key={t.id} className="border-b group">
                                            <td className="p-6 border-r font-black text-xs text-gray-800 uppercase bg-gray-50/30">{t.nom}</td>
                                            {planningDays.map(day => {
                                                const dateStr = day.toISOString().split('T')[0];
                                                const tasks = (commandes.flatMap(c => c.taches || [])).filter(tk => tk.tailleurId === t.id && tk.date === dateStr);
                                                return (
                                                    <td key={dateStr} onClick={() => { setNewTaskData({...newTaskData, tailleurId: t.id, date: dateStr, orderId: '', elementNom: ''}); setTaskModalOpen(true); }} className="p-2 border-r min-h-[100px] align-top bg-white group-hover:bg-gray-50/50 cursor-pointer">
                                                        {tasks.map(tk => (
                                                            <div key={tk.id} onClick={e => { e.stopPropagation(); handleToggleTaskStatus(tk); }} className={`mb-2 p-2 rounded-lg text-[9px] font-bold uppercase shadow-sm border-l-4 transition-all hover:scale-105 ${tk.statut === 'FAIT' ? 'bg-green-600 text-white border-green-400' : 'bg-brand-900 text-white border-brand-400'}`}>
                                                                <div className="flex justify-between"><span>{tk.elementNom}</span>{tk.statut === 'FAIT' && <CheckCircle size={10} />}</div>
                                                                <div className="mt-1 opacity-60">{tk.action}</div>
                                                            </div>
                                                        ))}
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

                {viewMode === 'TAILORS' && (
                    <div className="bg-white border rounded-2xl shadow-sm h-full flex flex-col p-6 overflow-y-auto custom-scrollbar">
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {tailleurs.map(t => {
                                const stats = performanceStats.find(p => p.id === t.id);
                                const loadPercent = Math.min(100, ((stats?.ongoingTasks || 0) / 5) * 100);
                                return (
                                    <div key={t.id} className="bg-gray-50 border rounded-2xl p-6 border-gray-100 flex flex-col gap-4 hover:shadow-md transition-all">
                                        <div className="flex items-center gap-4">
                                            <div className="w-12 h-12 bg-brand-900 text-white rounded-full flex items-center justify-center font-black text-xl">{t.nom.charAt(0)}</div>
                                            <div><p className="font-black text-gray-800 uppercase text-sm">{t.nom}</p><p className="text-[10px] font-bold text-orange-600 uppercase">{t.role}</p></div>
                                        </div>
                                        <div className="space-y-1">
                                            <div className="flex justify-between text-[8px] font-black uppercase text-gray-400"><span>Charge Actuelle</span><span>{stats?.ongoingTasks} tâches</span></div>
                                            <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden shadow-inner">
                                                <div className={`h-full transition-all duration-1000 ${loadPercent > 80 ? 'bg-red-500' : loadPercent > 50 ? 'bg-orange-400' : 'bg-green-500'}`} style={{ width: `${loadPercent}%` }}></div>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}

                {viewMode === 'PERFORMANCE' && (
                    <div className="bg-white border rounded-2xl shadow-sm h-full flex flex-col p-10 overflow-y-auto custom-scrollbar">
                        <div className="text-center mb-10"><h3 className="text-2xl font-black text-brand-900 uppercase tracking-tight flex items-center justify-center gap-3"><Trophy className="text-orange-500" size={32}/> Podium des Artisans</h3></div>
                        <div className="max-w-2xl mx-auto w-full space-y-6">
                            {performanceStats.map((t, idx) => (
                                <div key={t.id} className="bg-gray-50 p-6 rounded-2xl border border-gray-100 shadow-sm flex justify-between items-center group hover:bg-brand-50 transition-all">
                                    <div className="flex items-center gap-6">
                                        <span className={`w-10 h-10 flex items-center justify-center rounded-full font-black text-lg ${idx === 0 ? 'bg-yellow-400 text-white' : idx === 1 ? 'bg-slate-300 text-white' : idx === 2 ? 'bg-orange-300 text-white' : 'bg-gray-100 text-gray-400'}`}>{idx + 1}</span>
                                        <div><p className="font-black text-gray-800 uppercase text-lg">{t.nom}</p><div className="flex gap-2"> {Array.from({length: Math.min(5, Math.ceil(t.finishedTasks/2))}).map((_, i) => <Star key={i} size={10} className="fill-yellow-400 text-yellow-400"/>)} </div></div>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-3xl font-black text-brand-900">{t.finishedTasks}</p>
                                        <p className="text-[8px] font-black uppercase text-gray-400">Pièces Terminées</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {/* MODALS REQUIS */}
            {orderModalOpen && (
                <div className="fixed inset-0 bg-brand-900/80 z-[300] flex items-center justify-center p-4 backdrop-blur-md">
                    <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-2xl p-8 flex flex-col max-h-[95vh] animate-in zoom-in duration-200 border border-brand-100">
                        <div className="flex justify-between items-center mb-6 border-b pb-4 shrink-0"><h3 className="text-2xl font-black text-gray-800 uppercase tracking-tighter flex items-center gap-3"><Plus size={32} className="text-brand-600"/> {isEditingOrder ? 'Modifier Commande' : 'Nouvelle Commande'}</h3><button onClick={() => setOrderModalOpen(false)}><X size={28}/></button></div>
                        <div className="flex-1 overflow-y-auto space-y-6 pr-2 custom-scrollbar">
                            <div className="grid grid-cols-2 gap-4">
                                <div><label className="block text-[10px] font-black text-gray-500 uppercase mb-1 ml-1">Client</label><select className="w-full p-3 border-2 border-gray-100 rounded-xl font-bold bg-gray-50" value={newOrderData.clientId} onChange={e => setNewOrderData({...newOrderData, clientId: e.target.value})}><option value="">-- Choisir un client --</option>{clients.map(c => <option key={c.id} value={c.id}>{c.nom}</option>)}</select></div>
                                <div><label className="block text-[10px] font-black text-gray-500 uppercase mb-1 ml-1">Livraison Prévue</label><input type="date" className="w-full p-3 border-2 border-gray-100 rounded-xl font-bold bg-gray-50" value={newOrderData.dateLivraisonPrevue} onChange={e => setNewOrderData({...newOrderData, dateLivraisonPrevue: e.target.value})} /></div>
                            </div>
                            <div className="space-y-3">
                                <div className="flex justify-between items-center"><label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">Composition</label><button onClick={() => setNewOrderItems([...newOrderItems, {nom: '', qte: 1}])} className="p-1 bg-brand-50 text-brand-600 rounded"><Plus size={14}/></button></div>
                                {newOrderItems.map((it, idx) => (
                                    <div key={idx} className="flex gap-2 items-center animate-in slide-in-from-left-2">
                                        <input type="text" placeholder="Désignation" className="flex-1 p-3 border-2 border-gray-100 rounded-xl text-xs font-bold bg-gray-50 uppercase" value={it.nom} onChange={e => { const list = [...newOrderItems]; list[idx].nom = e.target.value.toUpperCase(); setNewOrderItems(list); }} />
                                        <input type="number" className="w-16 p-3 border-2 border-gray-100 rounded-xl text-center font-black" value={it.qte} onChange={e => { const list = [...newOrderItems]; list[idx].qte = parseInt(e.target.value)||1; setNewOrderItems(list); }} />
                                    </div>
                                ))}
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div><label className="block text-[10px] font-black text-brand-800 uppercase mb-1 ml-1">Prix Total (F)</label><input type="number" className="w-full p-3 border-2 border-brand-100 rounded-xl text-xl font-black text-brand-900 bg-brand-50/30" value={newOrderData.prixTotal || ''} onChange={e => setNewOrderData({...newOrderData, prixTotal: parseInt(e.target.value)||0})} /></div>
                                <div className="space-y-2">
                                    <label className="block text-[10px] font-black text-green-700 uppercase mb-1 ml-1">Acompte (F)</label>
                                    <input type="number" className="w-full p-3 border-2 border-green-100 rounded-xl text-xl font-black text-green-600 bg-green-50/30" value={newOrderData.avance || ''} onChange={e => setNewOrderData({...newOrderData, avance: parseInt(e.target.value)||0})} />
                                    {newOrderData.avance !== undefined && newOrderData.avance > 0 && !isEditingOrder && (
                                        <div className="animate-in fade-in">
                                            <label className="block text-[8px] font-black text-red-600 uppercase mb-1 ml-1 font-black">Caisse OBLIGATOIRE pour l'acompte *</label>
                                            <select className="w-full p-2 border-2 border-brand-200 rounded-lg text-[10px] font-bold" value={initialAccountId} onChange={e => setInitialAccountId(e.target.value)}>
                                                <option value="">-- Sélectionner --</option>
                                                {comptes.map(c => <option key={c.id} value={c.id}>{c.nom} ({c.solde.toLocaleString()} F)</option>)}
                                            </select>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                        <div className="flex justify-end gap-3 mt-8 pt-4 border-t shrink-0"><button onClick={() => setOrderModalOpen(false)} className="px-8 py-4 text-gray-400 font-black uppercase text-xs tracking-widest">Annuler</button><button onClick={handleCreateOrUpdateOrder} className="px-12 py-4 bg-brand-900 text-white rounded-2xl font-black uppercase text-xs tracking-widest shadow-xl active:scale-95 hover:bg-black transition-all">Valider Commande</button></div>
                    </div>
                </div>
            )}

            {paymentModalOpen && (
                <div className="fixed inset-0 bg-black/90 z-[500] flex items-center justify-center p-4 backdrop-blur-md">
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm p-8 animate-in zoom-in duration-200">
                        <div className="flex justify-between items-center mb-8 border-b pb-4"><h3 className="font-black text-gray-800 flex items-center gap-3 uppercase text-lg tracking-tighter"><DollarSign className="text-green-600" /> Encaisser Solde</h3><button onClick={() => setPaymentModalOpen(null)}><X size={28}/></button></div>
                        <div className="space-y-6">
                            <div className="bg-orange-50 p-4 rounded-xl border border-orange-100 flex justify-between"><span className="text-[10px] font-black uppercase text-orange-400">Reste Dû</span><span className="text-xl font-black text-orange-900">{paymentModalOpen.reste.toLocaleString()} F</span></div>
                            <div className="grid grid-cols-2 gap-4">
                                <div><label className="block text-[10px] font-black text-gray-400 uppercase mb-2 ml-1">Date</label><input type="date" className="w-full p-3 border-2 border-gray-100 rounded-xl font-bold" value={payDate} onChange={e => setPayDate(e.target.value)}/></div>
                                <div><label className="block text-[10px] font-black text-gray-400 uppercase mb-2 ml-1">Mode</label><select className="w-full p-3 border-2 border-gray-100 rounded-xl font-bold" value={payMethod} onChange={e => setPayMethod(e.target.value as any)}><option value="ESPECE">Espèce</option><option value="WAVE">Wave</option><option value="ORANGE_MONEY">Orange Money</option></select></div>
                            </div>
                            <div><label className="block text-[10px] font-black text-gray-400 uppercase mb-2 ml-1">Caisse de destination</label><select className="w-full p-4 border-2 border-gray-100 rounded-2xl font-bold" value={payAccount} onChange={e => setPayAccount(e.target.value)}><option value="">-- Choisir --</option>{comptes.map(c => <option key={c.id} value={c.id}>{c.nom} ({c.solde.toLocaleString()} F)</option>)}</select></div>
                            <input type="number" className="w-full p-4 border-2 border-gray-100 rounded-2xl font-black text-2xl" value={payAmount} onChange={e => setPayAmount(parseInt(e.target.value)||0)}/>
                            <button onClick={handleConfirmPayment} disabled={!payAccount || payAmount <= 0} className="w-full py-5 bg-green-600 text-white rounded-2xl font-black uppercase text-xs tracking-widest shadow-xl disabled:opacity-50 active:scale-95 transition-all">Valider Paiement</button>
                        </div>
                    </div>
                </div>
            )}

            {taskModalOpen && (
                <div className="fixed inset-0 bg-brand-900/80 z-[300] flex items-center justify-center p-4 backdrop-blur-sm">
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg p-8 animate-in zoom-in duration-200 border border-brand-100">
                        <div className="flex justify-between items-center mb-8 border-b pb-4"><h3 className="text-xl font-black text-gray-800 flex items-center gap-3 uppercase tracking-tighter"><UserPlus size={28} className="text-orange-600"/> Assigner une Tâche</h3><button onClick={() => setTaskModalOpen(false)}><X size={28}/></button></div>
                        <div className="space-y-6">
                            <div><label className="block text-[10px] font-black text-gray-400 uppercase mb-1 ml-1">Commande</label><select className="w-full p-3 border-2 border-gray-100 rounded-xl font-bold bg-gray-50" value={newTaskData.orderId} onChange={e => { const order = commandes.find(c => c.id === e.target.value); setNewTaskData({...newTaskData, orderId: e.target.value, elementNom: order?.elements?.[0]?.nom || ''}); }}><option value="">-- Choisir --</option>{commandes.filter(c => !c.isDevis && c.statut !== StatutCommande.LIVRE && c.statut !== StatutCommande.ANNULE).map(c => <option key={c.id} value={c.id}>{c.clientNom} - {c.description.slice(0, 20)}...</option>)}</select></div>
                            {newTaskData.orderId && (
                                <div className="grid grid-cols-2 gap-4 animate-in fade-in">
                                    <div><label className="block text-[10px] font-black text-gray-400 uppercase mb-1 ml-1">Élément</label><select className="w-full p-3 border-2 border-gray-100 rounded-xl font-bold bg-gray-50" value={newTaskData.elementNom} onChange={e => setNewTaskData({...newTaskData, elementNom: e.target.value})}>{commandes.find(c => c.id === newTaskData.orderId)?.elements?.map(el => <option key={el.nom} value={el.nom}>{el.nom}</option>)}</select></div>
                                    <div><label className="block text-[10px] font-black text-gray-400 uppercase mb-1 ml-1">Action</label><select className="w-full p-3 border-2 border-gray-100 rounded-xl font-bold bg-gray-50" value={newTaskData.action} onChange={e => setNewTaskData({...newTaskData, action: e.target.value as ActionProduction})}><option value="COUPE">Coupe</option><option value="COUTURE">Couture</option><option value="FINITION">Finition</option><option value="REPASSAGE">Repassage</option></select></div>
                                </div>
                            )}
                            <div className="grid grid-cols-2 gap-4">
                                <div><label className="block text-[10px] font-black text-gray-400 uppercase mb-1 ml-1">Artisan</label><select className="w-full p-3 border-2 border-gray-100 rounded-xl font-bold bg-gray-50" value={newTaskData.tailleurId} onChange={e => setNewTaskData({...newTaskData, tailleurId: e.target.value})}><option value="">-- Sélectionner --</option>{tailleurs.map(t => <option key={t.id} value={t.id}>{t.nom}</option>)}</select></div>
                                <div><label className="block text-[10px] font-black text-gray-400 uppercase mb-1 ml-1">Quantité</label><input type="number" className="w-full p-3 border-2 border-gray-100 rounded-xl font-black text-center" value={newTaskData.quantite} onChange={e => setNewTaskData({...newTaskData, quantite: parseInt(e.target.value)||1})}/></div>
                            </div>
                        </div>
                        <div className="flex justify-end gap-3 mt-10 pt-4 border-t"><button onClick={() => setTaskModalOpen(false)} className="px-8 py-4 text-gray-400 font-black uppercase text-[10px]">Annuler</button><button onClick={handleAddTask} className="px-12 py-4 bg-orange-600 text-white rounded-2xl font-black uppercase text-[10px] shadow-xl hover:bg-orange-700 transition-all active:scale-95">Valider</button></div>
                    </div>
                </div>
            )}

            {orderDetailView && (
                <div className="fixed inset-0 bg-black/60 z-[300] flex items-center justify-center p-4 backdrop-blur-sm animate-in zoom-in duration-200">
                    <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-lg p-10 animate-in zoom-in duration-200 flex flex-col max-h-[95vh] border border-brand-100">
                        <div className="flex justify-between items-center mb-6 border-b pb-4 shrink-0">
                            <h3 className="font-black text-2xl text-gray-800 uppercase tracking-tighter">Détails de Production</h3>
                            <div className="flex items-center gap-2">
                                <button onClick={() => handlePrintWorkshopSlip(orderDetailView)} className="p-2 text-gray-400 hover:text-brand-600 rounded-lg transition-all" title="Imprimer fiche atelier"><Printer size={24}/></button>
                                <button onClick={() => setOrderDetailView(null)} className="p-2 text-gray-400 hover:text-red-500 rounded-lg transition-all"><X size={32}/></button>
                            </div>
                        </div>
                        
                        <div className="space-y-6 overflow-y-auto pr-2 custom-scrollbar flex-1">
                            <div className="bg-brand-50 p-6 rounded-2xl border border-brand-100 relative overflow-hidden group">
                                <p className="text-[10px] font-black text-brand-600 uppercase tracking-widest mb-1 relative z-10">Client</p>
                                <p className="text-xl font-black text-brand-900 uppercase relative z-10">{orderDetailView.clientNom}</p>
                                <div className="mt-2 relative z-10 bg-white/50 p-2 rounded-lg border border-brand-100">
                                    <p className="text-[9px] font-black text-brand-600 uppercase tracking-widest mb-0.5">Désignation</p>
                                    <p className="text-xs font-bold text-brand-900">{orderDetailView.description}</p>
                                </div>
                                <Scissors size={80} className="absolute -right-4 -bottom-4 text-brand-900/5 rotate-12 transition-transform group-hover:scale-110"/>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="p-4 bg-gray-50 rounded-2xl border border-gray-100 flex items-center gap-3">
                                    <Calendar size={18} className="text-brand-400"/>
                                    <div><p className="text-[8px] font-black text-gray-400 uppercase tracking-widest">Date Commande</p><p className="text-xs font-black text-gray-700">{new Date(orderDetailView.dateCommande).toLocaleDateString()}</p></div>
                                </div>
                                <div className="p-4 bg-orange-50 rounded-2xl border border-orange-100 flex items-center gap-3">
                                    <Clock size={18} className="text-orange-400"/>
                                    <div><p className="text-[8px] font-black text-orange-400 uppercase tracking-widest">Livraison Prévue</p><p className="text-xs font-black text-orange-900">{new Date(orderDetailView.dateLivraisonPrevue).toLocaleDateString()}</p></div>
                                </div>
                            </div>

                            <div>
                                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3 border-b pb-1">Composition (Articles)</p>
                                <div className="bg-gray-50/50 rounded-xl p-3 border border-gray-100 space-y-2">
                                    {orderDetailView.elements?.map((el, i) => (
                                        <div key={i} className="flex justify-between items-center text-xs">
                                            <span className="font-bold text-gray-700 uppercase">{el.nom}</span>
                                            <span className="font-black text-brand-600 px-2 py-0.5 bg-white rounded border border-brand-50 shadow-sm">x {el.quantite}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* TIMELINE VISUELLE */}
                            <div className="py-4">
                                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-6 border-b pb-1">Progression Chronologique</p>
                                <div className="flex justify-between relative px-2">
                                    <div className="absolute top-1/2 left-0 w-full h-1 bg-gray-100 -translate-y-1/2 z-0"></div>
                                    {KANBAN_STATUS_ORDER.map((s, idx) => {
                                        const count = orderDetailView.repartitionStatuts?.[s] || 0;
                                        const isDone = idx < KANBAN_STATUS_ORDER.indexOf(orderDetailView.statut as StatutCommande) || orderDetailView.statut === StatutCommande.LIVRE;
                                        const isCurrent = orderDetailView.statut === s;
                                        return (
                                            <div key={s} className="relative z-10 flex flex-col items-center gap-2 group">
                                                <div className={`w-8 h-8 rounded-full flex items-center justify-center border-4 transition-all duration-500 ${isDone ? 'bg-green-500 border-green-200' : isCurrent ? 'bg-brand-900 border-brand-200 scale-125' : 'bg-white border-gray-100'}`}>
                                                    {isDone ? <CheckCircle size={14} className="text-white"/> : <span className={`text-[10px] font-black ${isCurrent ? 'text-white' : 'text-gray-300'}`}>{idx+1}</span>}
                                                </div>
                                                <span className={`text-[8px] font-black uppercase text-center max-w-[50px] transition-colors ${isCurrent ? 'text-brand-900' : 'text-gray-400'}`}>{s}</span>
                                                {count > 0 && <span className="absolute -top-4 bg-brand-900 text-white text-[8px] px-1.5 py-0.5 rounded-full font-black animate-bounce">{count}</span>}
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>

                            <div>
                                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3 border-b pb-1">Artisans sur la commande</p>
                                <div className="flex flex-wrap gap-2">
                                    {(orderDetailView.tailleursIds || []).map(tid => (
                                        <span key={tid} className="px-3 py-1.5 bg-white border border-brand-100 rounded-xl text-[10px] font-black uppercase text-brand-700 shadow-sm flex items-center gap-2"><div className="w-2 h-2 bg-brand-400 rounded-full animate-pulse"></div> {employes.find(e => e.id === tid)?.nom}</span>
                                    ))}
                                    {(!orderDetailView.tailleursIds || orderDetailView.tailleursIds.length === 0) && <span className="text-[10px] italic text-gray-400 uppercase font-black">Aucun artisan assigné</span>}
                                </div>
                            </div>

                            <div>
                                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3 border-b pb-1">Versements & Solde</p>
                                <div className="space-y-2">
                                    <div className="flex justify-between text-xs font-bold p-3 bg-gray-50 rounded-xl border border-gray-100 italic"><span>Initial (Acompte)</span><span>{orderDetailView.avance.toLocaleString()} F</span></div>
                                    {orderDetailView.paiements?.map((p, idx) => (
                                        <div key={idx} className="flex justify-between text-xs font-black p-3 bg-green-50 rounded-xl border border-green-100 text-green-700 animate-in slide-in-from-left-2">
                                            <span>{new Date(p.date).toLocaleDateString()} ({p.moyenPaiement})</span>
                                            <span>+{p.montant.toLocaleString()} F</span>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4 pt-4 border-t-2 border-dashed border-gray-100">
                                <div className="p-4 rounded-2xl bg-gray-900 text-white flex flex-col justify-center">
                                    <p className="text-[8px] font-black opacity-50 uppercase tracking-widest mb-1">Prix Total</p>
                                    <p className="text-2xl font-black tracking-tight">{orderDetailView.prixTotal.toLocaleString()} F</p>
                                </div>
                                <div className={`p-4 rounded-2xl flex flex-col justify-center border-2 ${orderDetailView.reste > 0 ? 'bg-red-50 border-red-100' : 'bg-green-50 border-green-100'}`}>
                                    <p className={`text-[8px] font-black uppercase tracking-widest mb-1 ${orderDetailView.reste > 0 ? 'text-red-400' : 'text-green-400'}`}>{orderDetailView.reste > 0 ? 'Reste à payer' : 'Statut Paiement'}</p>
                                    <p className={`text-2xl font-black tracking-tight ${orderDetailView.reste > 0 ? `${orderDetailView.reste.toLocaleString()} F` : 'SOLDÉ'}`}>{orderDetailView.reste > 0 ? `${orderDetailView.reste.toLocaleString()} F` : 'SOLDÉ'}</p>
                                </div>
                            </div>
                        </div>
                        
                        <div className="flex gap-3 shrink-0 mt-8">
                             {(orderDetailView.repartitionStatuts?.[StatutCommande.PRET] || 0) > 0 && (
                                <button onClick={() => handleDeliverParts(orderDetailView)} className="flex-1 py-5 bg-green-600 text-white rounded-2xl font-black uppercase text-xs tracking-widest shadow-xl shadow-green-100 hover:bg-green-700 transition-all flex items-center justify-center gap-3 active:scale-95"><Truck size={20}/> Livrer Pièces</button>
                            )}
                            <button onClick={() => setOrderDetailView(null)} className="flex-1 py-5 bg-gray-800 text-white rounded-2xl font-black uppercase text-xs tracking-widest shadow-lg hover:bg-black transition-all">Fermer la vue</button>
                        </div>
                    </div>
                </div>
            )}
            
            {/* STYLES ADDITIONNELS POUR LES ANIMATIONS */}
            <style>{`
                @keyframes bounce { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-5px); } }
                .animate-bounce { animation: bounce 1s infinite; }
            `}</style>
        </div>
    );
};

export default ProductionView;
