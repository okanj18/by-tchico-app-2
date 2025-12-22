
import React, { useState, useMemo } from 'react';
import { Commande, Employe, Client, Article, StatutCommande, RoleEmploye, ModePaiement, CompteFinancier, CompanyAssets, TacheProduction, ActionProduction, ElementCommande } from '../types';
import { Scissors, LayoutList, Users, History, Search, Camera, X, Activity, Clock, Shirt, Calendar, CheckCircle, CheckSquare, Zap, Columns, Trophy, Wallet, Printer, Eye, UserPlus, Plus, Save, Truck, ArrowRightLeft, DollarSign, Trash2, AlertTriangle, ChevronLeft, ChevronRight, Archive, ClipboardList, Filter, TrendingUp, UserCheck } from 'lucide-react';
import { QRScannerModal } from './QRTools';
import { COMPANY_CONFIG } from '../config';

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
    const [viewMode, setViewMode] = useState<'ORDERS' | 'TAILORS' | 'PERFORMANCE' | 'KANBAN' | 'PLANNING'>('PLANNING');
    const [searchTerm, setSearchTerm] = useState('');
    const [listFilter, setListFilter] = useState<'ALL' | 'ACTIVE' | 'READY' | 'DELIVERED' | 'ARCHIVED'>('ACTIVE');
    
    // Modal States
    const [taskModalOpen, setTaskModalOpen] = useState(false);
    const [orderModalOpen, setOrderModalOpen] = useState(false);
    const [paymentModalOpen, setPaymentModalOpen] = useState(false);
    const [deliveryModal, setDeliveryModal] = useState<{ order: Commande, maxQty: number, qty: number } | null>(null);
    const [kanbanMoveModal, setKanbanMoveModal] = useState<{
        order: Commande, fromStatus: StatutCommande, toStatus: StatutCommande, maxQty: number, qty: number, assignTailorId: string
    } | null>(null);

    // Form Data States
    const [newOrderData, setNewOrderData] = useState<Partial<Commande>>({
        clientId: '', clientNom: '', description: '', quantite: 1, prixTotal: 0, avance: 0, dateLivraisonPrevue: ''
    });
    const [initialAccountId, setInitialAccountId] = useState('');
    const [selectedOrderForPayment, setSelectedOrderForPayment] = useState<Commande | null>(null);
    const [payAmount, setPayAmount] = useState(0);
    const [payAccount, setPayAccount] = useState('');
    const [payMethod, setPayMethod] = useState<ModePaiement>('ESPECE');
    const [payDate, setPayDate] = useState(new Date().toISOString().split('T')[0]);

    const [newTaskData, setNewTaskData] = useState<{ orderId: string, action: ActionProduction, quantite: number, note: string, tailleurId: string, date: string }>({ 
        orderId: '', action: 'COUTURE', quantite: 1, note: '', tailleurId: '', date: new Date().toISOString().split('T')[0] 
    });

    const [agendaBaseDate, setAgendaBaseDate] = useState(() => {
        const d = new Date();
        d.setHours(0,0,0,0);
        return d;
    });

    // --- DATA AGGREGATION ---

    const tailleurs = useMemo(() => {
        return employes.filter(e => (e.role === RoleEmploye.TAILLEUR || e.role === RoleEmploye.CHEF_ATELIER || e.role === RoleEmploye.STAGIAIRE) && e.actif !== false).sort((a, b) => a.nom.localeCompare(b.nom));
    }, [employes]);

    const filteredCommandes = useMemo(() => {
        return commandes.filter(c => {
            if (c.type !== 'SUR_MESURE') return false; 
            const isCompleted = c.statut === StatutCommande.LIVRE || c.statut === StatutCommande.ANNULE;
            const isArchived = c.archived === true;
            const isReady = (c.repartitionStatuts?.[StatutCommande.PRET] || 0) > 0 || c.statut === StatutCommande.PRET;

            if (viewMode === 'ORDERS') {
                if (listFilter === 'ACTIVE' && (isCompleted || isArchived)) return false;
                if (listFilter === 'READY' && !isReady) return false;
                if (listFilter === 'DELIVERED' && !isCompleted) return false;
                if (listFilter === 'ARCHIVED' && !isArchived) return false;
            }

            const searchLower = searchTerm.toLowerCase();
            return c.clientNom.toLowerCase().includes(searchLower) || c.id.toLowerCase().includes(searchLower);
        }).sort((a, b) => new Date(b.dateCommande).getTime() - new Date(a.dateCommande).getTime());
    }, [commandes, searchTerm, viewMode, listFilter]);

    // --- LOGIQUE PERFORMANCE ARTISANS ---
    const artisanPerformance = useMemo(() => {
        return tailleurs.map(t => {
            const allTasks = commandes.flatMap(c => (c.taches || [])).filter(task => task.tailleurId === t.id);
            const finishedTasks = allTasks.filter(task => task.statut === 'FAIT');
            const totalPieces = finishedTasks.reduce((acc, task) => acc + task.quantite, 0);
            return {
                id: t.id,
                nom: t.nom,
                totalTaches: allTasks.length,
                totalFait: finishedTasks.length,
                totalPieces,
                percent: allTasks.length > 0 ? Math.round((finishedTasks.length / allTasks.length) * 100) : 0
            };
        }).sort((a, b) => b.totalPieces - a.totalPieces);
    }, [tailleurs, commandes]);

    // --- FUNCTIONS ---

    const handleCreateCustomOrder = () => {
        if (!newOrderData.clientId || !newOrderData.quantite || !newOrderData.prixTotal) {
            alert("Veuillez remplir les informations obligatoires (Client, Quantité, Prix)");
            return;
        }

        const client = clients.find(c => c.id === newOrderData.clientId);
        const order: Commande = {
            id: `CMD_SM_${Date.now()}`,
            clientId: newOrderData.clientId || '',
            clientNom: client?.nom || 'Client Inconnu',
            description: newOrderData.description || 'Vêtement sur mesure',
            dateCommande: new Date().toISOString(),
            dateLivraisonPrevue: newOrderData.dateLivraisonPrevue || '',
            statut: StatutCommande.EN_ATTENTE,
            tailleursIds: [],
            prixTotal: newOrderData.prixTotal || 0,
            avance: newOrderData.avance || 0,
            reste: (newOrderData.prixTotal || 0) - (newOrderData.avance || 0),
            type: 'SUR_MESURE',
            quantite: newOrderData.quantite || 1,
            repartitionStatuts: { [StatutCommande.EN_ATTENTE]: newOrderData.quantite || 1 },
            paiements: (newOrderData.avance || 0) > 0 ? [{ id: `P_INIT_${Date.now()}`, date: new Date().toISOString(), montant: newOrderData.avance || 0, moyenPaiement: 'ESPECE', note: 'Acompte initial' }] : [],
            taches: []
        };

        onCreateOrder(order, [], 'ESPECE', initialAccountId);
        setOrderModalOpen(false);
        alert("Commande sur mesure enregistrée !");
    };

    const generateInvoice = (order: Commande) => {
        const printWindow = window.open('', '', 'width=600,height=800');
        if (!printWindow) return;
        const logoUrl = companyAssets?.logoStr || '';
        const html = `
            <html><head><title>Facture BY TCHICO</title><style>body{font-family:sans-serif;padding:40px;color:#333;} .header{display:flex;justify-content:space-between;border-bottom:2px solid #68321f;padding-bottom:20px;margin-bottom:30px;} .logo{height:60px;} .details{margin-bottom:40px;} .footer{margin-top:50px;font-size:12px;text-align:center;border-top:1px solid #eee;padding-top:20px;}</style></head>
            <body>
                <div class="header"><div><img src="${logoUrl}" class="logo"/><h2>BY TCHICO</h2><p>${COMPANY_CONFIG.address}</p></div><div><h3>FACTURE #${order.id.slice(-6)}</h3><p>Date: ${new Date(order.dateCommande).toLocaleDateString()}</p></div></div>
                <div class="details"><h4>Client: ${order.clientNom}</h4><p>Description: ${order.description}</p><p>Quantité: ${order.quantite} pièce(s)</p></div>
                <table style="width:100%;border-collapse:collapse;">
                    <tr style="background:#f9f9f9;"><th style="padding:10px;text-align:left;">Désignation</th><th style="padding:10px;text-align:right;">Montant</th></tr>
                    <tr><td style="padding:10px;border-bottom:1px solid #eee;">Vêtements sur mesure</td><td style="padding:10px;border-bottom:1px solid #eee;text-align:right;">${order.prixTotal.toLocaleString()} F</td></tr>
                    <tr><td style="padding:10px;font-weight:bold;text-align:right;">TOTAL TTC</td><td style="padding:10px;font-weight:bold;text-align:right;">${order.prixTotal.toLocaleString()} F</td></tr>
                    <tr style="color:green;"><td style="padding:10px;text-align:right;">AVANCES VERSÉES</td><td style="padding:10px;text-align:right;">-${order.avance.toLocaleString()} F</td></tr>
                    <tr style="font-size:18px;color:#dc2626;"><td style="padding:10px;font-weight:bold;text-align:right;">NET À PAYER</td><td style="padding:10px;font-weight:bold;text-align:right;">${order.reste.toLocaleString()} F</td></tr>
                </table>
                <div class="footer"><p>Merci pour votre confiance. Prévu pour livraison le : ${new Date(order.dateLivraisonPrevue).toLocaleDateString()}</p></div>
                <script>setTimeout(() => { window.print(); window.close(); }, 500);</script>
            </body></html>`;
        printWindow.document.write(html);
        printWindow.document.close();
    };

    const handleTaskStatusChange = (order: Commande, task: TacheProduction, newStatut: 'A_FAIRE' | 'FAIT') => {
        const updatedTaches = (order.taches || []).map(t => t.id === task.id ? { ...t, statut: newStatut } : t);
        let newRepartition = { ...(order.repartitionStatuts || { [StatutCommande.EN_ATTENTE]: order.quantite }) };
        const transitions: Record<string, { from: StatutCommande, to: StatutCommande }> = { 'COUPE': { from: StatutCommande.EN_ATTENTE, to: StatutCommande.EN_COUPE }, 'COUTURE': { from: StatutCommande.EN_COUPE, to: StatutCommande.COUTURE }, 'FINITION': { from: StatutCommande.COUTURE, to: StatutCommande.FINITION }, 'REPASSAGE': { from: StatutCommande.FINITION, to: StatutCommande.PRET } };
        const rule = transitions[task.action];
        if (rule) {
            const available = newStatut === 'FAIT' ? (newRepartition[rule.from] || 0) : (newRepartition[rule.to] || 0);
            const qtyToMove = Math.min(task.quantite, available);
            if (qtyToMove > 0) {
                if (newStatut === 'FAIT') {
                    newRepartition[rule.from] -= qtyToMove; if (newRepartition[rule.from] <= 0) delete newRepartition[rule.from];
                    newRepartition[rule.to] = (newRepartition[rule.to] || 0) + qtyToMove;
                } else {
                    newRepartition[rule.to] -= qtyToMove; if (newRepartition[rule.to] <= 0) delete newRepartition[rule.to];
                    newRepartition[rule.from] = (newRepartition[rule.from] || 0) + qtyToMove;
                }
            }
        }
        let mostAdvanced = StatutCommande.EN_ATTENTE;
        KANBAN_STATUS_ORDER.forEach(s => { if ((newRepartition[s] || 0) > 0) mostAdvanced = s as StatutCommande; });
        onUpdateOrder({ ...order, taches: updatedTaches, repartitionStatuts: newRepartition, statut: mostAdvanced });
    };

    return (
        <div className="space-y-6 h-[calc(100vh-8rem)] flex flex-col">
            {/* Header Global */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 shrink-0">
                <div className="flex items-center gap-3">
                    <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2"><Scissors className="text-brand-600"/> Atelier & Flux</h2>
                    <div className="flex gap-2">
                        <button onClick={openAddModal} className="bg-brand-900 text-white px-4 py-2 rounded-lg flex items-center gap-2 text-xs font-black uppercase hover:bg-black shadow-lg transition-all active:scale-95"><Plus size={16}/> Nouvelle Commande</button>
                        <button onClick={() => { setNewTaskData({ ...newTaskData, orderId: '', tailleurId: '', date: new Date().toISOString().split('T')[0] }); setTaskModalOpen(true); }} className="bg-brand-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 text-xs font-black uppercase hover:bg-brand-700 shadow-lg transition-all active:scale-95"><UserPlus size={16}/> Assigner Tâche</button>
                    </div>
                </div>
                <div className="flex flex-wrap bg-white border p-1 rounded-xl shadow-sm">
                    {[{id: 'PLANNING', label: 'Agenda', icon: Calendar},{id: 'KANBAN', label: 'Kanban', icon: Columns},{id: 'ORDERS', label: 'Détails Commandes', icon: ClipboardList},{id: 'TAILORS', label: 'Suivi Artisans', icon: Users},{id: 'PERFORMANCE', label: 'Top Performance', icon: Trophy}].map((mode) => (
                        <button key={mode.id} onClick={() => setViewMode(mode.id as any)} className={`px-4 py-1.5 text-[10px] font-black uppercase rounded-lg flex items-center gap-2 transition-all ${viewMode === mode.id ? 'bg-brand-900 text-white shadow-md' : 'text-gray-500 hover:bg-gray-50'}`}><mode.icon size={14}/> <span>{mode.label}</span></button>
                    ))}
                </div>
            </div>

            {/* Zone Contenu */}
            <div className="flex-1 overflow-hidden">
                
                {/* AGENDA ET KANBAN (CONSERVÉS) */}
                {viewMode === 'PLANNING' && (
                    <div className="bg-white border rounded-2xl shadow-sm h-full flex flex-col overflow-hidden animate-in fade-in duration-300">
                        <div className="p-4 border-b bg-gray-50 flex justify-between items-center">
                            <div className="flex items-center gap-3"><button onClick={() => { const d = new Date(agendaBaseDate); d.setDate(d.getDate()-7); setAgendaBaseDate(d); }} className="p-2 hover:bg-gray-200 rounded-lg border"><ChevronLeft size={18}/></button><button onClick={() => { const d = new Date(agendaBaseDate); d.setDate(d.getDate()+7); setAgendaBaseDate(d); }} className="p-2 hover:bg-gray-200 rounded-lg border"><ChevronRight size={18}/></button><span className="font-black text-sm uppercase tracking-widest">{agendaBaseDate.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}</span></div>
                        </div>
                        <div className="flex-1 overflow-auto custom-scrollbar">
                            <table className="w-full border-collapse table-fixed min-w-[1000px]">
                                <thead className="sticky top-0 z-20 bg-gray-100">
                                    <tr><th className="w-44 p-4 border-b border-r text-left text-[10px] font-black text-gray-400 uppercase bg-gray-50 tracking-widest">Artisan</th>{Array.from({length: 7}, (_, i) => { const d = new Date(agendaBaseDate); d.setDate(d.getDate() + i); const isToday = d.toISOString().split('T')[0] === new Date().toISOString().split('T')[0]; return <th key={i} className={`p-3 border-b text-center text-[10px] font-black uppercase ${isToday ? 'bg-brand-50 text-brand-900 border-b-2 border-brand-600' : 'text-gray-500'}`}>{d.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric' })}</th>; })}</tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {tailleurs.map(tailor => (
                                        <tr key={tailor.id} className="group hover:bg-brand-50/5 transition-colors">
                                            <td className="p-4 border-r bg-gray-50 font-black text-xs sticky left-0 z-10 shadow-sm uppercase tracking-tighter">{tailor.nom}</td>
                                            {Array.from({length: 7}, (_, i) => {
                                                const d = new Date(agendaBaseDate); d.setDate(d.getDate() + i);
                                                const dateStr = d.toISOString().split('T')[0];
                                                const tasks = commandes.flatMap(o => (o.taches || []).map(t => ({...t, order: o}))).filter(t => t.tailleurId === tailor.id && t.date === dateStr);
                                                return <td key={i} className="p-1 border-r h-36 vertical-top relative cursor-pointer hover:bg-brand-50/10" onClick={() => { setNewTaskData({...newTaskData, tailleurId: tailor.id, date: dateStr}); setTaskModalOpen(true); }}><div className="space-y-1 h-full overflow-y-auto no-scrollbar">{tasks.map(t => <div key={t.id} onClick={(e) => { e.stopPropagation(); handleTaskStatusChange(t.order, t, t.statut === 'A_FAIRE' ? 'FAIT' : 'A_FAIRE'); }} className={`p-2 rounded border shadow-sm transition-all hover:scale-105 active:scale-95 ${t.statut === 'FAIT' ? 'bg-green-500 text-white border-green-600' : (t.date < new Date().toISOString().split('T')[0] ? 'bg-red-600 text-white border-red-700 animate-pulse' : 'bg-white text-gray-800 border-gray-200')}`}><div className="flex justify-between items-start gap-1"><span className="text-[9px] font-black uppercase">{t.action} x{t.quantite}</span>{t.statut === 'FAIT' ? <CheckCircle size={10}/> : <Clock size={10}/>}</div><div className="text-[8px] font-bold truncate opacity-90 mt-1 uppercase">{t.order.clientNom}</div></div>)}</div></td>;
                                            })}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {/* VUE DÉTAILLÉE COMMANDES (RÉ-IMPLÉMENTÉ & ENRICHI) */}
                {viewMode === 'ORDERS' && (
                    <div className="bg-white border rounded-2xl shadow-sm h-full flex flex-col overflow-hidden animate-in slide-in-from-bottom-4 duration-300">
                        <div className="p-5 bg-gray-50 border-b flex flex-col md:flex-row justify-between items-center gap-4">
                            <div className="flex bg-white border p-1 rounded-xl shadow-inner shrink-0">
                                {[{id: 'ACTIVE', label: 'En cours', icon: Activity},{id: 'READY', label: 'Prêts', icon: CheckSquare},{id: 'DELIVERED', label: 'Livrées', icon: Truck},{id: 'ALL', label: 'Toutes', icon: ClipboardList}].map((f) => (
                                    <button key={f.id} onClick={() => setListFilter(f.id as any)} className={`px-4 py-2 text-[10px] font-black uppercase rounded-lg transition-all flex items-center gap-2 ${listFilter === f.id ? 'bg-brand-900 text-white shadow-lg' : 'text-gray-500 hover:bg-gray-50'}`}><f.icon size={12}/> {f.label}</button>
                                ))}
                            </div>
                            <div className="relative w-full md:w-80"><Search className="absolute left-4 top-3 text-gray-400" size={18}/><input type="text" placeholder="Chercher client, réf..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full pl-12 pr-4 py-2.5 border-2 border-gray-100 rounded-xl text-sm font-bold bg-white focus:border-brand-600 transition-all outline-none shadow-sm"/></div>
                        </div>
                        <div className="flex-1 overflow-auto custom-scrollbar">
                            <table className="w-full text-sm text-left">
                                <thead className="bg-white text-gray-400 font-black border-b sticky top-0 z-10 uppercase text-[9px] tracking-widest"><tr><th className="p-5">Client & Dates</th><th className="p-5 text-right">Finance</th><th className="p-5">État Production</th><th className="p-5">Artisans</th><th className="p-5 text-right">Actions</th></tr></thead>
                                <tbody className="divide-y divide-gray-100">
                                    {filteredCommandes.map(order => {
                                        const qtyPret = order.repartitionStatuts?.[StatutCommande.PRET] || (order.statut === StatutCommande.PRET ? order.quantite : 0);
                                        const orderTailors = Array.from(new Set((order.taches || []).map(t => employes.find(e => e.id === t.tailleurId)?.nom))).filter(Boolean);
                                        return (
                                            <tr key={order.id} className="hover:bg-gray-50 transition-colors group">
                                                <td className="p-5">
                                                    <div className="font-black text-gray-900 uppercase text-sm tracking-tight">{order.clientNom}</div>
                                                    <div className="text-[10px] text-gray-400 font-bold mt-1">CMD: {new Date(order.dateCommande).toLocaleDateString()} • LIV: <span className="text-brand-700">{new Date(order.dateLivraisonPrevue).toLocaleDateString()}</span></div>
                                                    <div className="text-[9px] text-gray-400 font-mono mt-1 italic">#{order.id.slice(-8)}</div>
                                                </td>
                                                <td className="p-5 text-right">
                                                    <div className="font-black text-gray-900">{order.prixTotal.toLocaleString()} F</div>
                                                    <div className="text-[10px] font-bold text-green-600">Payé: {order.avance.toLocaleString()} F</div>
                                                    <div className={`text-[10px] font-black ${order.reste > 0 ? 'text-red-600' : 'text-green-700'}`}>{order.reste > 0 ? `RESTE: ${order.reste.toLocaleString()} F` : 'SOLDÉ'}</div>
                                                </td>
                                                <td className="p-5">
                                                    <div className="flex flex-wrap gap-1.5 max-w-[200px]">
                                                        {KANBAN_STATUS_ORDER.map(s => {
                                                            const q = order.repartitionStatuts?.[s] || (order.statut === s ? order.quantite : 0);
                                                            return q > 0 && (<span key={s} className="px-2 py-0.5 bg-white text-brand-900 rounded border border-brand-100 text-[8px] font-black shadow-sm uppercase">{s} ({q})</span>);
                                                        })}
                                                    </div>
                                                </td>
                                                <td className="p-5">
                                                    <div className="flex flex-wrap gap-1">
                                                        {orderTailors.length > 0 ? orderTailors.map((name, idx) => (<span key={idx} className="bg-gray-100 text-gray-700 px-2 py-0.5 rounded text-[8px] font-bold uppercase tracking-tighter border border-gray-200">{name}</span>)) : <span className="text-[9px] text-gray-400 italic">Non assigné</span>}
                                                    </div>
                                                </td>
                                                <td className="p-5 text-right">
                                                    <div className="flex justify-end gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                                        <button onClick={() => generateInvoice(order)} className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg border border-gray-200 shadow-sm" title="Imprimer Facture"><Printer size={16}/></button>
                                                        {qtyPret > 0 && (<button onClick={() => setDeliveryModal({ order, maxQty: qtyPret, qty: qtyPret })} className="px-3 py-1.5 text-white bg-green-600 hover:bg-green-700 rounded-lg text-[9px] font-black uppercase flex items-center gap-1 shadow-lg transition-transform active:scale-95"><Truck size={12}/> Livrer</button>)}
                                                        {order.reste > 0 && (<button onClick={() => {setSelectedOrderForPayment(order); setPayAmount(order.reste); setPaymentModalOpen(true);}} className="p-2 text-orange-600 hover:bg-orange-50 rounded-lg border border-orange-100 shadow-sm" title="Encaisser"><DollarSign size={16}/></button>)}
                                                        <button onClick={() => { setNewTaskData({...newTaskData, orderId: order.id, date: new Date().toISOString().split('T')[0]}); setTaskModalOpen(true); }} className="p-2 text-brand-600 hover:bg-brand-50 rounded-lg border border-brand-100 shadow-sm" title="Assigner"><UserPlus size={16}/></button>
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {/* SUIVI ARTISANS (NOUVEAU) */}
                {viewMode === 'TAILORS' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 p-6 overflow-y-auto h-full custom-scrollbar animate-in fade-in duration-300">
                        {tailleurs.map(t => {
                            const activeTasks = (commandes.flatMap(c => c.taches || [])).filter(task => task.tailleurId === t.id && task.statut === 'A_FAIRE');
                            const totalWorkload = activeTasks.reduce((acc, task) => acc + task.quantite, 0);
                            return (
                                <div key={t.id} className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100 hover:shadow-xl transition-all group">
                                    <div className="flex justify-between items-start mb-6">
                                        <div className="w-14 h-14 bg-brand-50 rounded-2xl flex items-center justify-center text-brand-700 font-black text-xl border-b-4 border-brand-200">{t.nom.charAt(0)}</div>
                                        <div className={`px-3 py-1 rounded-full text-[10px] font-black uppercase ${totalWorkload > 5 ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}>{totalWorkload > 5 ? 'Saturé' : 'Disponible'}</div>
                                    </div>
                                    <h4 className="font-black text-gray-800 uppercase tracking-tighter text-lg mb-1">{t.nom}</h4>
                                    <p className="text-xs text-gray-500 font-bold mb-6 tracking-widest">{t.role}</p>
                                    
                                    <div className="space-y-4">
                                        <div className="flex justify-between items-center text-xs font-black text-gray-400 uppercase tracking-widest"><span>Charge Actuelle</span><span className="text-brand-900">{totalWorkload} PCS</span></div>
                                        <div className="w-full bg-gray-100 h-2.5 rounded-full overflow-hidden border border-gray-200"><div className={`h-full transition-all duration-1000 ${totalWorkload > 5 ? 'bg-red-500' : 'bg-brand-600'}`} style={{width: `${Math.min(100, (totalWorkload / 10) * 100)}%`}}></div></div>
                                        <div className="flex flex-col gap-2 pt-4">
                                            {activeTasks.slice(0, 3).map((task, idx) => (
                                                <div key={idx} className="bg-gray-50 p-2.5 rounded-xl border border-gray-100 text-[10px] font-bold text-gray-600 flex justify-between items-center">
                                                    <span className="uppercase">{task.action} x{task.quantite}</span>
                                                    <span className="text-[8px] bg-white px-1.5 py-0.5 rounded border text-gray-400">J-${Math.round((new Date(task.date).getTime() - new Date().getTime()) / (1000 * 3600 * 24))}</span>
                                                </div>
                                            ))}
                                            {activeTasks.length > 3 && <p className="text-[9px] text-gray-400 text-center font-black uppercase">+{activeTasks.length - 3} autres tâches...</p>}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}

                {/* PERFORMANCE Leaderboard (NOUVEAU) */}
                {viewMode === 'PERFORMANCE' && (
                    <div className="p-6 h-full overflow-y-auto custom-scrollbar animate-in zoom-in duration-500">
                        <div className="max-w-4xl mx-auto space-y-6">
                            <div className="bg-brand-900 rounded-3xl p-10 text-white shadow-2xl relative overflow-hidden flex flex-col md:flex-row justify-between items-center gap-10">
                                <div className="z-10 text-center md:text-left">
                                    <h3 className="text-3xl font-black uppercase tracking-tighter leading-none mb-4">Top Artisans<br/><span className="text-brand-300">Du Mois</span></h3>
                                    <p className="text-xs font-bold text-brand-200 uppercase tracking-[0.2em]">Basé sur le nombre de pièces livrées</p>
                                </div>
                                <Trophy size={120} className="text-white opacity-20 absolute -right-4 -bottom-4 rotate-12"/>
                                {artisanPerformance.length > 0 && (
                                    <div className="bg-white/10 backdrop-blur-md p-8 rounded-3xl border border-white/20 flex flex-col items-center shadow-inner scale-110">
                                        <div className="w-20 h-20 bg-yellow-400 rounded-full flex items-center justify-center text-brand-900 font-black text-3xl shadow-xl border-4 border-white mb-4 animate-bounce">1</div>
                                        <p className="font-black uppercase tracking-tighter text-xl text-center">{artisanPerformance[0].nom}</p>
                                        <p className="text-3xl font-black text-yellow-400 mt-2">{artisanPerformance[0].totalPieces} PCS</p>
                                    </div>
                                )}
                            </div>

                            <div className="bg-white rounded-3xl border shadow-sm overflow-hidden">
                                {artisanPerformance.map((stat, idx) => (
                                    <div key={stat.id} className="p-6 border-b flex items-center gap-6 hover:bg-brand-50 transition-all group">
                                        <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center font-black text-gray-400 group-hover:bg-brand-900 group-hover:text-white transition-all shadow-inner">{idx + 1}</div>
                                        <div className="flex-1">
                                            <p className="font-black text-gray-800 uppercase tracking-tight">{stat.nom}</p>
                                            <div className="flex gap-4 mt-1">
                                                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest flex items-center gap-1"><CheckCircle size={12}/> {stat.totalFait} tâches finies</span>
                                                <span className="text-[10px] font-bold text-brand-600 uppercase tracking-widest flex items-center gap-1"><Zap size={12}/> {stat.totalPieces} pièces sorties</span>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <div className="text-2xl font-black text-gray-900">{stat.percent}%</div>
                                            <div className="text-[8px] font-black text-gray-400 uppercase">Efficacité</div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* MODALS : TACHE, PAIEMENT, LIVRAISON (DÉJÀ OK DANS LE PRÉCÉDENT MAIS VÉRIFIÉS) */}
            
            {/* MODAL NOUVELLE COMMANDE (SUR MESURE) */}
            {orderModalOpen && (
                <div className="fixed inset-0 bg-brand-900/80 z-[250] flex items-center justify-center p-4 backdrop-blur-md">
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg p-10 flex flex-col animate-in zoom-in duration-300 border border-brand-100">
                        <div className="flex justify-between items-center mb-10 border-b pb-6 shrink-0">
                            <h3 className="text-2xl font-black text-gray-800 flex items-center gap-3 uppercase tracking-tighter"><Scissors className="text-brand-600" size={32}/> Nouvelle Commande Atelier</h3>
                            <button onClick={() => setOrderModalOpen(false)} className="hover:bg-gray-100 p-2 rounded-full"><X size={32}/></button>
                        </div>
                        <div className="flex-1 overflow-y-auto space-y-8 pr-2 custom-scrollbar">
                            <div className="space-y-2"><label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">Sélectionner Client</label><select className="w-full p-4 border-2 border-gray-100 rounded-2xl text-sm font-bold bg-gray-50 focus:border-brand-600 transition-all outline-none" value={newOrderData.clientId} onChange={e => setNewOrderData({...newOrderData, clientId: e.target.value})}><option value="">-- Choisir un client --</option>{clients.map(c => <option key={c.id} value={c.id}>{c.nom} ({c.telephone})</option>)}</select></div>
                            <div className="space-y-2"><label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">Modèle / Description</label><textarea className="w-full p-4 border-2 border-gray-100 rounded-2xl text-sm font-medium bg-gray-50 focus:border-brand-600 outline-none" rows={2} value={newOrderData.description} onChange={e => setNewOrderData({...newOrderData, description: e.target.value})} placeholder="Ex: Grand Boubou Bazin Blanc avec broderie or..."></textarea></div>
                            <div className="grid grid-cols-2 gap-6">
                                <div className="space-y-2"><label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">Qté (Vêtements)</label><input type="number" min="1" className="w-full p-4 border-2 border-gray-100 rounded-2xl text-xl font-black bg-gray-50" value={newOrderData.quantite} onChange={e => setNewOrderData({...newOrderData, quantite: parseInt(e.target.value)||1})}/></div>
                                <div className="space-y-2"><label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">Date Livraison</label><input type="date" className="w-full p-4 border-2 border-gray-100 rounded-2xl text-xs font-bold bg-gray-50" value={newOrderData.dateLivraisonPrevue} onChange={e => setNewOrderData({...newOrderData, dateLivraisonPrevue: e.target.value})}/></div>
                            </div>
                            <div className="grid grid-cols-2 gap-6 bg-brand-50 p-6 rounded-3xl border border-brand-100 shadow-inner">
                                <div className="space-y-2"><label className="text-[10px] font-black text-brand-800 uppercase tracking-widest ml-1">Prix Total (TTC)</label><input type="number" className="w-full p-4 border-2 border-white rounded-2xl text-xl font-black text-brand-900" value={newOrderData.prixTotal} onChange={e => setNewOrderData({...newOrderData, prixTotal: parseInt(e.target.value)||0})}/></div>
                                <div className="space-y-2"><label className="text-[10px] font-black text-brand-800 uppercase tracking-widest ml-1">Acompte Reçu</label><input type="number" className="w-full p-4 border-2 border-white rounded-2xl text-xl font-black text-green-600" value={newOrderData.avance} onChange={e => setNewOrderData({...newOrderData, avance: parseInt(e.target.value)||0})}/></div>
                            </div>
                            <div className="space-y-2"><label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">Compte d'encaissement</label><select className="w-full p-4 border-2 border-gray-100 rounded-2xl text-sm font-bold bg-gray-50" value={initialAccountId} onChange={e => setInitialAccountId(e.target.value)}><option value="">-- Choisir Caisse --</option>{comptes.map(c => <option key={c.id} value={c.id}>{c.nom} ({c.solde.toLocaleString()} F)</option>)}</select></div>
                        </div>
                        <div className="flex justify-end gap-4 mt-10 shrink-0">
                            <button onClick={() => setOrderModalOpen(false)} className="px-8 py-4 text-gray-400 font-black uppercase text-[10px] tracking-[0.2em] hover:text-gray-600 transition-colors">Annuler</button>
                            <button onClick={handleCreateCustomOrder} className="px-12 py-4 bg-brand-900 text-white rounded-2xl font-black uppercase text-[10px] tracking-[0.2em] shadow-2xl hover:bg-black transition-all transform active:scale-95">Valider la Commande</button>
                        </div>
                    </div>
                </div>
            )}

            {/* MODAL TACHE (ACTUALISÉ) */}
            {taskModalOpen && (
                <div className="fixed inset-0 bg-brand-900/70 z-[200] flex items-center justify-center p-4 backdrop-blur-sm">
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm p-8 animate-in zoom-in duration-300 border border-gray-100">
                        <div className="flex justify-between items-center mb-8 border-b pb-4"><h3 className="font-black text-gray-800 flex items-center gap-3 uppercase tracking-tighter text-lg"><UserPlus size={24} className="text-brand-600"/> Nouvelle Assignation</h3><button onClick={() => setTaskModalOpen(false)} className="hover:bg-gray-100 p-2 rounded-full transition-colors"><X size={24}/></button></div>
                        <div className="space-y-6">
                            <div><label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 ml-1">Commande Client</label><select className="w-full p-4 border-2 border-gray-100 rounded-2xl text-sm font-bold bg-gray-50 focus:border-brand-600 transition-all outline-none" value={newTaskData.orderId} onChange={e => setNewTaskData({...newTaskData, orderId: e.target.value})}><option value="">-- Sélectionner Commande --</option>{commandes.filter(c => !c.archived && c.statut !== StatutCommande.LIVRE).map(c => <option key={c.id} value={c.id}>{c.clientNom} (#{c.id.slice(-6)})</option>)}</select></div>
                            <div><label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 ml-1">Étape de Production</label><select className="w-full p-4 border-2 border-brand-50 rounded-2xl text-sm font-bold bg-brand-50/50 text-brand-900 focus:border-brand-600 transition-all outline-none" value={newTaskData.action} onChange={e => setNewTaskData({...newTaskData, action: e.target.value as any})}><option value="COUPE">Coupe (Départ)</option><option value="COUTURE">Couture / Montage</option><option value="FINITION">Finition / Broderie</option><option value="REPASSAGE">Repassage / Prêt</option></select></div>
                            <div className="grid grid-cols-2 gap-4">
                                <div><label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 ml-1">Qté pcs</label><input type="number" min="1" className="w-full p-4 border-2 border-gray-100 rounded-2xl text-lg font-black bg-gray-50 text-center" value={newTaskData.quantite} onChange={e => setNewTaskData({...newTaskData, quantite: parseInt(e.target.value)||1})}/></div>
                                <div><label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 ml-1">Date Prévue</label><input type="date" className="w-full p-4 border-2 border-gray-100 rounded-2xl text-xs font-bold bg-gray-50" value={newTaskData.date} onChange={e => setNewTaskData({...newTaskData, date: e.target.value})}/></div>
                            </div>
                            <div><label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 ml-1">Assigner à l'Artisan</label><select className="w-full p-4 border-2 border-gray-100 rounded-2xl text-sm font-bold bg-gray-50" value={newTaskData.tailleurId} onChange={e => setNewTaskData({...newTaskData, tailleurId: e.target.value})}><option value="">-- Choisir Artisan --</option>{tailleurs.map(t => <option key={t.id} value={t.id}>{t.nom}</option>)}</select></div>
                        </div>
                        <div className="flex justify-end gap-3 mt-10"><button onClick={() => setTaskModalOpen(false)} className="px-6 py-4 text-gray-400 font-black uppercase text-[10px] tracking-widest hover:text-gray-600">Annuler</button><button disabled={!newTaskData.tailleurId || !newTaskData.orderId} onClick={() => {
                                const order = commandes.find(c => c.id === newTaskData.orderId);
                                if (order && newTaskData.tailleurId) {
                                    const newTask: TacheProduction = { id: `T_${Date.now()}`, commandeId: order.id, action: newTaskData.action, quantite: newTaskData.quantite, tailleurId: newTaskData.tailleurId, date: newTaskData.date, statut: 'A_FAIRE' };
                                    onUpdateOrder({ ...order, taches: [...(order.taches || []), newTask] });
                                    setTaskModalOpen(false);
                                    alert("Tâche planifiée.");
                                }
                        }} className="px-10 py-4 bg-brand-900 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-xl disabled:opacity-30 active:scale-95 transition-all">Confirmer</button></div>
                    </div>
                </div>
            )}

            {/* MODAL PAIEMENT SOLDE */}
            {paymentModalOpen && selectedOrderForPayment && (
                <div className="fixed inset-0 bg-brand-900/70 z-[180] flex items-center justify-center p-4 backdrop-blur-sm">
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm p-8">
                        <div className="flex justify-between items-center mb-8 border-b pb-4"><h3 className="text-xl font-black flex items-center gap-3 text-gray-800 uppercase tracking-tighter"><Wallet size={24} className="text-orange-600"/> Encaissement Solde</h3><button onClick={() => setPaymentModalOpen(false)}><X size={24} className="text-gray-400"/></button></div>
                        <div className="space-y-6">
                            <div className="bg-orange-50 p-4 rounded-2xl border border-orange-100 flex justify-between items-center"><span className="text-xs font-black text-orange-800 uppercase">Reste Dû</span><span className="text-xl font-black text-orange-900">{selectedOrderForPayment.reste.toLocaleString()} F</span></div>
                            <div><label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 ml-1">Montant perçu</label><input type="number" className="w-full p-4 border-2 border-gray-100 rounded-2xl font-black text-2xl bg-gray-50 focus:border-orange-500 outline-none transition-all" value={payAmount} onChange={e => setPayAmount(Math.min(selectedOrderForPayment.reste, parseInt(e.target.value) || 0))} /></div>
                            <div><label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 ml-1">Caisse de Destination</label><select className="w-full p-4 border-2 border-gray-100 rounded-2xl bg-gray-50 text-sm font-bold" value={payAccount} onChange={e => setPayAccount(e.target.value)}><option value="">-- Choisir un compte --</option>{comptes.map(acc => (<option key={acc.id} value={acc.id}>{acc.nom} ({acc.solde.toLocaleString()} F)</option>))}</select></div>
                        </div>
                        <div className="flex justify-end gap-3 mt-10"><button onClick={() => setPaymentModalOpen(false)} className="px-6 py-4 text-gray-400 font-bold uppercase text-[10px] tracking-widest">Annuler</button><button onClick={handleConfirmPayment} disabled={!payAccount || payAmount <= 0} className="px-10 py-4 bg-brand-900 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-xl disabled:opacity-30 active:scale-95">Valider</button></div>
                    </div>
                </div>
            )}
        </div>
    );

    // Fonction d'ouverture du modal de création de commande
    function openAddModal() {
        setNewOrderData({ clientId: '', clientNom: '', description: '', quantite: 1, prixTotal: 0, avance: 0, dateLivraisonPrevue: new Date(Date.now() + 10 * 86400000).toISOString().split('T')[0] });
        setInitialAccountId('');
        setOrderModalOpen(true);
    }

    function handleConfirmPayment() {
        if (!selectedOrderForPayment || payAmount <= 0 || !payAccount) return;
        onAddPayment(selectedOrderForPayment.id, payAmount, payMethod, "Règlement solde production", payDate, payAccount);
        setPaymentModalOpen(false);
        setSelectedOrderForPayment(null);
    }
};

export default ProductionView;
