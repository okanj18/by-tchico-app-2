
import React, { useState, useMemo } from 'react';
import { Commande, Employe, Client, Article, StatutCommande, RoleEmploye, Consommation, CompteFinancier, CompanyAssets, ModePaiement, TacheProduction, ActionProduction, PaiementClient } from '../types';
import { Scissors, Search, Plus, Eye, Edit2, CheckCircle, Clock, Trash2, Printer, Archive, X, Save, AlertTriangle, DollarSign, ChevronRight, ClipboardList, Activity, Sparkles, UserPlus, History, CreditCard, Ban, Calendar, Layout, Users, Trophy, Loader, FileText, ChevronLeft, ChevronRight as ChevronRightIcon, Box, ArrowRight, ArrowLeft, Check, Square, CheckSquare } from 'lucide-react';
import { analyzeProductionBottlenecks } from '../services/geminiService';
import { COMPANY_CONFIG } from '../config';

interface ProductionViewProps {
    commandes: Commande[];
    employes: Employe[];
    clients: Client[];
    articles: Article[];
    userRole: RoleEmploye;
    onUpdateStatus: (id: string, s: StatutCommande | string) => void;
    onCreateOrder: (o: Commande, cons: Consommation[], method: ModePaiement, accId?: string) => void;
    onUpdateOrder: (o: Commande, accId?: string) => void;
    onAddPayment: (orderId: string, amount: number, method: ModePaiement, note: string, date: string, accId?: string) => void;
    onUpdatePayment: (orderId: string, paymentId: string, newAmount: number, date: string, accId: string) => void;
    onDeletePayment: (orderId: string, paymentId: string, accId: string) => void;
    onAddTask: (orderId: string, task: TacheProduction) => void;
    onUpdateTask: (orderId: string, taskId: string, newStatut: 'A_FAIRE' | 'FAIT') => void;
    onArchiveOrder: (id: string) => void;
    comptes: CompteFinancier[];
    companyAssets: CompanyAssets;
}

const ProductionView: React.FC<ProductionViewProps> = ({ 
    commandes, employes, clients, articles, userRole, 
    onUpdateStatus, onCreateOrder, onUpdateOrder, onAddPayment, onUpdatePayment, onDeletePayment, onAddTask, onUpdateTask, onArchiveOrder, comptes, companyAssets 
}) => {
    const [activeNav, setActiveNav] = useState<'COMMANDES' | 'AGENDA' | 'KANBAN' | 'ARTISANS' | 'PERFORMANCE'>('COMMANDES');
    const [searchTerm, setSearchTerm] = useState('');
    const [activeFilterTab, setActiveFilterTab] = useState<'EN_COURS' | 'PRETS' | 'DEVIS' | 'TOUTES'>('EN_COURS');

    // Modals
    const [orderModalOpen, setOrderModalOpen] = useState(false);
    const [detailModalOpen, setDetailModalOpen] = useState(false);
    const [paymentModalOpen, setPaymentModalOpen] = useState(false);
    const [editPaymentModalOpen, setEditPaymentModalOpen] = useState(false);
    const [taskModalOpen, setTaskModalOpen] = useState(false);
    const [isEditingOrder, setIsEditingOrder] = useState(false);
    
    // Selection
    const [selectedOrder, setSelectedOrder] = useState<Commande | null>(null);
    const [selectedPayment, setSelectedPayment] = useState<PaiementClient | null>(null);

    // Form States
    const [newOrderData, setNewOrderData] = useState<Partial<Commande>>({
        clientId: '', prixTotal: 0, avance: 0, dateLivraisonPrevue: '', isDevis: false, description: '', consommations: []
    });
    const [initialAccountId, setInitialAccountId] = useState('');
    const [payData, setPayData] = useState({ amount: 0, method: 'ESPECE' as ModePaiement, accId: '', date: new Date().toISOString().split('T')[0], note: '' });
    const [editPayData, setEditPayData] = useState({ amount: 0, date: '', accId: '' });
    
    const [newTaskData, setNewTaskData] = useState<Partial<TacheProduction>>({
        commandeId: '', action: 'COUTURE', tailleurId: '', quantite: 1, note: '', date: new Date().toISOString().split('T')[0], statut: 'A_FAIRE'
    });

    const [agendaDate, setAgendaDate] = useState(new Date());

    const tailleurs = useMemo(() => employes.filter(e => (e.role === RoleEmploye.TAILLEUR || e.role === RoleEmploye.CHEF_ATELIER) && e.actif !== false), [employes]);

    const filteredCommandes = useMemo(() => {
        return commandes.filter(c => {
            if (c.archived) return false;
            const matchesSearch = c.clientNom.toLowerCase().includes(searchTerm.toLowerCase()) || c.id.toLowerCase().includes(searchTerm.toLowerCase());
            let matchesTab = true;
            if (activeFilterTab === 'EN_COURS') matchesTab = !c.isDevis && c.statut !== StatutCommande.LIVRE && c.statut !== StatutCommande.PRET && c.statut !== StatutCommande.ANNULE;
            else if (activeFilterTab === 'PRETS') matchesTab = c.statut === StatutCommande.PRET;
            else if (activeFilterTab === 'DEVIS') matchesTab = !!c.isDevis;
            return matchesSearch && matchesTab;
        }).sort((a, b) => new Date(b.dateCommande).getTime() - new Date(a.dateCommande).getTime());
    }, [commandes, searchTerm, activeFilterTab]);

    const handlePrintOrder = (order: Commande) => {
        const printWindow = window.open('', '_blank', 'width=800,height=900');
        if (!printWindow) return;
        const logo = companyAssets.logoStr || '';
        const html = `
            <html><head><title>Fiche Production #${order.id.slice(-6)}</title><style>
                body { font-family: 'Courier New', Courier, monospace; font-size: 14px; padding: 20px; color: #000; }
                .header { text-align: center; border-bottom: 2px solid #000; padding-bottom: 10px; margin-bottom: 20px; }
                .section { margin-bottom: 15px; }
                .val { font-size: 16px; font-weight: 900; }
                .total-box { border: 2px solid #000; padding: 10px; margin-top: 20px; text-align: right; }
            </style></head>
            <body>
                <div class="header">
                    ${logo ? `<img src="${logo}" style="max-width:150px" />` : ''}
                    <h1 style="margin:5px 0;">${COMPANY_CONFIG.name}</h1>
                    <p style="margin:2px 0;">${COMPANY_CONFIG.address} | Tel: ${COMPANY_CONFIG.phone}</p>
                    <h2 style="text-decoration:underline; margin-top:10px;">BON DE PRODUCTION #${order.id.slice(-6)}</h2>
                </div>
                <div class="section"><b>CLIENT :</b> <span class="val">${order.clientNom.toUpperCase()}</span></div>
                <div class="section" style="border:1px solid #ccc; padding:10px;">
                    <b>MODÈLE / SPÉCIFICATIONS :</b><br/>
                    <p style="white-space: pre-wrap; margin-top:5px;">${order.description}</p>
                </div>
                <div class="total-box">
                    <p style="margin:2px 0;">PRIX TOTAL : <b>${order.prixTotal.toLocaleString()} F</b></p>
                    <p style="margin:2px 0;">ACOMPTE VERSÉ : ${ (order.prixTotal - order.reste).toLocaleString() } F</p>
                    <p style="margin:2px 0; font-size:18px;"><b>RESTE À PAYER : ${order.reste.toLocaleString()} F</b></p>
                </div>
                <script>window.onload = () => { window.print(); window.close(); }</script>
            </body></html>
        `;
        printWindow.document.write(html);
        printWindow.document.close();
    };

    const handleDeliverOrder = (cmd: Commande) => {
        let confirmationMsg = "Voulez-vous confirmer la livraison de cette commande ?";
        if (cmd.reste > 0) {
            confirmationMsg = `⚠️ ATTENTION : Cette commande n'est pas totalement soldée !\n\n` +
                              `Montant restant : ${cmd.reste.toLocaleString()} F\n\n` +
                              `Souhaitez-vous quand même valider la livraison ?`;
        }
        if (window.confirm(confirmationMsg)) onUpdateStatus(cmd.id, StatutCommande.LIVRE);
    };

    const handleCreateOrUpdateOrder = () => {
        if (!newOrderData.clientId || !newOrderData.prixTotal) { alert("Client et prix requis."); return; }
        
        // FIX BUG 1: Calcul rigoureux du reste lors d'une modification
        const prixTotal = newOrderData.prixTotal || 0;
        const avance = newOrderData.avance || 0;
        const sommeAutresPaiements = selectedOrder?.paiements?.reduce((sum, p) => sum + p.montant, 0) || 0;
        const nouveauReste = Math.max(0, prixTotal - avance - sommeAutresPaiements);

        if (isEditingOrder && selectedOrder) {
            onUpdateOrder({ 
                ...selectedOrder, 
                ...newOrderData, 
                reste: nouveauReste 
            } as Commande, initialAccountId);
        } else {
            const client = clients.find(c => c.id === newOrderData.clientId);
            const order: Commande = { 
                id: `CMD_${Date.now()}`, clientId: newOrderData.clientId || '', clientNom: client?.nom || 'Client', 
                description: newOrderData.description || 'Sur Mesure', dateCommande: new Date().toISOString(), 
                dateLivraisonPrevue: newOrderData.dateLivraisonPrevue || '', statut: StatutCommande.EN_ATTENTE, 
                tailleursIds: [], prixTotal: prixTotal, avance: avance, 
                reste: nouveauReste, type: 'SUR_MESURE', 
                quantite: 1, isDevis: newOrderData.isDevis || false,
                taches: [], paiements: []
            };
            onCreateOrder(order, [], 'ESPECE', initialAccountId);
        }
        setOrderModalOpen(false);
    };

    const handleOpenEditPayment = (p: PaiementClient) => {
        setSelectedPayment(p);
        setEditPayData({ amount: p.montant, date: p.date, accId: comptes[0]?.id || '' });
        setEditPaymentModalOpen(true);
    };

    const handleMoveStatus = (cmd: Commande, direction: 'NEXT' | 'PREV') => {
        const steps = [StatutCommande.EN_ATTENTE, StatutCommande.EN_COUPE, StatutCommande.COUTURE, StatutCommande.FINITION, StatutCommande.PRET];
        const currentIdx = steps.indexOf(cmd.statut as StatutCommande);
        if (direction === 'NEXT' && currentIdx < steps.length - 1) onUpdateStatus(cmd.id, steps[currentIdx + 1]);
        else if (direction === 'PREV' && currentIdx > 0) onUpdateStatus(cmd.id, steps[currentIdx - 1]);
    };

    return (
        <div className="space-y-6">
            {/* HEADER PRINCIPAL */}
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
                <div className="flex items-center gap-4">
                    <div className="p-3 bg-brand-50 rounded-2xl border border-brand-100 shadow-sm"><Scissors className="text-brand-600" size={32} /></div>
                    <div><h2 className="text-3xl font-black text-gray-800 tracking-tighter uppercase leading-none">Gestion de <br/> l'Atelier</h2></div>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                    <button onClick={() => { setIsEditingOrder(false); setNewOrderData({ clientId: '', prixTotal: 0, avance: 0, dateLivraisonPrevue: '', isDevis: false, description: '' }); setOrderModalOpen(true); }} className="bg-brand-900 hover:bg-black text-white px-6 py-3.5 rounded-xl font-black uppercase text-[10px] tracking-widest shadow-xl flex items-center gap-2 transition-all active:scale-95">
                        <Plus size={18}/> Nouvelle Commande
                    </button>
                    <button onClick={() => setTaskModalOpen(true)} className="bg-[#ff4e00] hover:bg-[#e64600] text-white px-6 py-3.5 rounded-xl font-black uppercase text-[10px] tracking-widest shadow-xl flex items-center gap-2 transition-all active:scale-95">
                        <UserPlus size={18}/> Assigner Tâche
                    </button>
                </div>

                <div className="bg-white p-1.5 rounded-2xl shadow-sm border border-gray-100 flex flex-wrap gap-1">
                    {[
                        { id: 'COMMANDES', label: 'Commandes', icon: ClipboardList },
                        { id: 'AGENDA', label: 'Agenda', icon: Calendar },
                        { id: 'KANBAN', label: 'Flux Kanban', icon: Layout },
                        { id: 'ARTISANS', label: 'Nos Artisans', icon: Users },
                        { id: 'PERFORMANCE', label: 'Palmarès', icon: Trophy }
                    ].map(nav => (
                        <button key={nav.id} onClick={() => setActiveNav(nav.id as any)} className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2 transition-all ${activeNav === nav.id ? 'bg-brand-900 text-white shadow-lg scale-105' : 'text-gray-400 hover:bg-gray-50'}`}>
                            <nav.icon size={14}/> {nav.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* VUE COMMANDES */}
            {activeNav === 'COMMANDES' && (
                <div className="space-y-6">
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                        <div className="flex bg-gray-100 p-1 rounded-2xl shadow-inner border border-gray-200">
                            {['EN_COURS', 'PRETS', 'DEVIS', 'TOUTES'].map(tab => (
                                <button key={tab} onClick={() => setActiveFilterTab(tab as any)} className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeFilterTab === tab ? 'bg-white text-brand-900 shadow-md' : 'text-gray-400'}`}>
                                    {tab.replace('_', ' ')}
                                </button>
                            ))}
                        </div>
                        <div className="relative w-full md:w-96"><Search className="absolute left-4 top-3.5 text-gray-300" size={20} /><input type="text" placeholder="Rechercher..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full pl-12 pr-4 py-3.5 bg-white border border-gray-200 rounded-2xl text-sm font-bold shadow-sm" /></div>
                    </div>

                    <div className="bg-white rounded-[2rem] shadow-sm border border-gray-100 overflow-hidden">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-gray-50/50 text-gray-400 font-black uppercase text-[10px] tracking-[0.2em] border-b">
                                <tr><th className="p-6">Référence & Client</th><th className="p-6 text-center">Livraison</th><th className="p-6 text-center">Finance</th><th className="p-6 text-center">État</th><th className="p-6 text-right w-64">Actions</th></tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {filteredCommandes.map(cmd => (
                                    <tr key={cmd.id} className="hover:bg-brand-50/30 transition-all">
                                        <td className="p-6">
                                            <div className="flex flex-col"><span className="font-black text-gray-800 uppercase text-base tracking-tighter">{cmd.clientNom}</span><span className="text-[10px] text-gray-400 font-bold uppercase">#{cmd.id.slice(-6)} • {cmd.description.slice(0, 40)}...</span></div>
                                        </td>
                                        <td className="p-6 text-center font-bold text-gray-600 uppercase text-[11px]">{new Date(cmd.dateLivraisonPrevue).toLocaleDateString()}</td>
                                        <td className="p-6 text-center">
                                            <div className="flex flex-col items-center"><span className="font-black text-gray-800 text-lg">{cmd.prixTotal.toLocaleString()} F</span><span className={`text-[10px] font-black uppercase ${cmd.reste > 0 ? 'text-red-500' : 'text-green-600'}`}>Reste : {cmd.reste.toLocaleString()} F</span></div>
                                        </td>
                                        <td className="p-6 text-center"><span className="px-4 py-2 bg-white border-2 border-gray-100 rounded-2xl text-[10px] font-black text-gray-600 uppercase tracking-widest">{cmd.statut.toUpperCase()}</span></td>
                                        <td className="p-6 text-right">
                                            <div className="flex justify-end gap-2">
                                                <button onClick={() => { setSelectedOrder(cmd); setDetailModalOpen(true); }} className="p-2.5 bg-white text-blue-600 border border-blue-100 rounded-xl hover:bg-blue-600 hover:text-white transition-all shadow-sm"><Eye size={18}/></button>
                                                <button onClick={() => { setSelectedOrder(cmd); setNewOrderData(cmd); setIsEditingOrder(true); setOrderModalOpen(true); }} className="p-2.5 bg-white text-gray-400 border border-gray-100 rounded-xl hover:bg-gray-800 hover:text-white transition-all shadow-sm"><Edit2 size={18}/></button>
                                                {cmd.statut === StatutCommande.PRET && <button onClick={() => handleDeliverOrder(cmd)} className="p-2.5 bg-white text-green-600 border border-green-100 rounded-xl hover:bg-green-600 hover:text-white transition-all shadow-sm"><Check size={18}/></button>}
                                                <button onClick={() => { setSelectedOrder(cmd); setPayData({ ...payData, amount: cmd.reste }); setPaymentModalOpen(true); }} className="p-2.5 bg-white text-emerald-600 border border-emerald-100 rounded-xl hover:bg-emerald-600 hover:text-white transition-all shadow-sm"><DollarSign size={18}/></button>
                                                <button onClick={() => { if(window.confirm("Voulez-vous vraiment annuler cette commande ?")) onUpdateStatus(cmd.id, StatutCommande.ANNULE); }} className="p-2.5 bg-white text-red-300 border border-red-50 rounded-xl hover:bg-red-500 hover:text-white transition-all shadow-sm"><Ban size={18}/></button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* VUE AGENDA */}
            {activeNav === 'AGENDA' && (
                <div className="bg-white rounded-[2rem] border border-gray-100 shadow-sm overflow-hidden flex flex-col h-full min-h-[600px]">
                    <div className="p-6 border-b flex justify-between items-center bg-gray-50/50">
                        <div className="flex items-center gap-4">
                            <div className="flex gap-1">
                                <button onClick={() => setAgendaDate(new Date(agendaDate.setDate(agendaDate.getDate()-7)))} className="p-2 hover:bg-white rounded-lg border border-gray-200"><ChevronLeft size={20}/></button>
                                <button onClick={() => setAgendaDate(new Date(agendaDate.setDate(agendaDate.getDate()+7)))} className="p-2 hover:bg-white rounded-lg border border-gray-200"><ChevronRightIcon size={20}/></button>
                            </div>
                            <h3 className="text-xl font-black text-gray-800 uppercase tracking-widest">{agendaDate.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}</h3>
                        </div>
                    </div>
                    <div className="flex-1 overflow-auto custom-scrollbar">
                        <table className="w-full border-collapse">
                            <thead>
                                <tr className="bg-gray-50 text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] border-b">
                                    <th className="p-6 border-r text-left w-64 sticky left-0 bg-gray-50 z-20">Artisan</th>
                                    {Array.from({ length: 7 }).map((_, i) => {
                                        const d = new Date(agendaDate); d.setDate(agendaDate.getDate() + i);
                                        return <th key={i} className="p-6 border-r text-center">{d.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric' })}</th>
                                    })}
                                </tr>
                            </thead>
                            <tbody>
                                {tailleurs.map(artisan => (
                                    <tr key={artisan.id} className="border-b last:border-0 h-32">
                                        <td className="p-6 border-r font-black text-gray-700 uppercase text-xs sticky left-0 bg-white z-10 shadow-sm">{artisan.nom}</td>
                                        {Array.from({ length: 7 }).map((_, i) => {
                                            const d = new Date(agendaDate); d.setDate(agendaDate.getDate() + i);
                                            const dateStr = d.toISOString().split('T')[0];
                                            const dayTasks = (commandes.flatMap(c => (c.taches || []).map(t => ({...t, orderId: c.id, clientNom: c.clientNom}))).filter(t => t.tailleurId === artisan.id && t.date === dateStr));
                                            return (
                                                <td key={i} onClick={(e) => { if(e.target === e.currentTarget) { setNewTaskData({...newTaskData, tailleurId: artisan.id, date: dateStr}); setTaskModalOpen(true); } }} className="p-2 border-r bg-gray-50/20 cursor-cell hover:bg-brand-50/30 transition-colors">
                                                    <div className="flex flex-col gap-1">
                                                        {dayTasks.map(t => (
                                                            <button 
                                                                key={t.id} 
                                                                onClick={() => onUpdateTask(t.orderId, t.id, t.statut === 'A_FAIRE' ? 'FAIT' : 'A_FAIRE')} 
                                                                className={`p-2 rounded-lg border shadow-sm text-[8px] font-black uppercase truncate flex items-center gap-1.5 transition-all ${t.statut === 'FAIT' ? 'bg-green-100 border-green-200 text-green-700' : 'bg-white border-brand-100 text-brand-900 hover:scale-105'}`}
                                                            >
                                                                {t.statut === 'FAIT' ? <CheckSquare size={10}/> : <Square size={10}/>} {t.action} - {t.clientNom}
                                                            </button>
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

            {/* VUE KANBAN */}
            {activeNav === 'KANBAN' && (
                <div className="flex gap-6 overflow-x-auto pb-10 no-scrollbar h-[calc(100vh-18rem)]">
                    {[StatutCommande.EN_ATTENTE, StatutCommande.EN_COUPE, StatutCommande.COUTURE, StatutCommande.FINITION, StatutCommande.PRET].map((status, idx, array) => {
                        const items = commandes.filter(c => c.statut === status && !c.archived && !c.isDevis);
                        return (
                            <div key={status} className="flex flex-col min-w-[320px] max-w-[320px] h-full">
                                <div className="flex justify-between items-center mb-6 px-2 shrink-0">
                                    <h4 className="font-black text-gray-800 uppercase text-xs tracking-widest">{status}</h4>
                                    <span className="bg-brand-50 text-brand-700 px-2 py-0.5 rounded-full text-[9px] font-black border border-brand-100">{items.length}</span>
                                </div>
                                <div className="flex-1 overflow-y-auto space-y-4 pr-1 custom-scrollbar">
                                    {items.map(cmd => (
                                        <div key={cmd.id} className="bg-white p-6 rounded-[1.5rem] shadow-sm border border-gray-100 hover:shadow-xl transition-all group relative">
                                            <div onClick={() => { setSelectedOrder(cmd); setDetailModalOpen(true); }} className="cursor-pointer">
                                                <h5 className="font-black text-gray-900 uppercase text-xs mb-3">{cmd.clientNom}</h5>
                                                <p className="text-[10px] text-gray-400 font-bold uppercase line-clamp-2">{cmd.description}</p>
                                            </div>
                                            <div className="flex justify-between items-center pt-3 border-t border-gray-50 mt-4">
                                                <div className="flex gap-2">
                                                    {idx > 0 && <button onClick={() => handleMoveStatus(cmd, 'PREV')} className="p-1.5 bg-gray-50 hover:bg-gray-200 rounded-lg text-gray-400 transition-colors"><ArrowLeft size={14}/></button>}
                                                    {idx < array.length - 1 && <button onClick={() => handleMoveStatus(cmd, 'NEXT')} className="p-1.5 bg-brand-900 text-white rounded-lg hover:bg-black transition-colors"><ArrowRight size={14}/></button>}
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* ARTISANS */}
            {activeNav === 'ARTISANS' && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {tailleurs.map(artisan => {
                        const activeTasks = (commandes.flatMap(c => c.taches || []).filter(t => t.tailleurId === artisan.id && t.statut === 'A_FAIRE'));
                        return (
                            <div key={artisan.id} className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-gray-100 flex flex-col gap-6 hover:shadow-md transition-all">
                                <div className="flex items-center gap-4">
                                    <div className="w-14 h-14 bg-brand-900 rounded-2xl flex items-center justify-center font-black text-white text-xl shadow-lg">{artisan.nom.charAt(0)}</div>
                                    <div><h3 className="text-lg font-black text-gray-800 uppercase tracking-tighter">{artisan.nom}</h3><p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{artisan.role}</p></div>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="bg-gray-50 p-4 rounded-2xl border text-center">
                                        <p className="text-[8px] font-black text-gray-400 uppercase mb-1">En cours</p>
                                        <p className="text-2xl font-black text-gray-800">{activeTasks.length}</p>
                                    </div>
                                    <div className="bg-green-50 p-4 rounded-2xl border border-green-100 text-center">
                                        <p className="text-[8px] font-black text-green-400 uppercase mb-1">Disponibilité</p>
                                        <p className="text-[10px] font-black text-green-700 uppercase">Disponible</p>
                                    </div>
                                </div>
                                <button onClick={() => { setNewTaskData({...newTaskData, tailleurId: artisan.id}); setTaskModalOpen(true); }} className="w-full py-4 bg-gray-50 hover:bg-gray-100 text-gray-500 font-black uppercase text-[10px] tracking-widest rounded-xl border border-dashed border-gray-300 transition-colors">Attribuer une tâche</button>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* PERFORMANCE */}
            {activeNav === 'PERFORMANCE' && (
                <div className="bg-white rounded-[2.5rem] border border-gray-100 shadow-sm overflow-hidden animate-in fade-in">
                    <div className="p-8 border-b bg-gray-50/50 flex items-center gap-4"><Trophy className="text-yellow-500" size={32}/><h3 className="text-xl font-black text-gray-800 uppercase tracking-tighter">Classement Artisans du Mois</h3></div>
                    <div className="p-8 space-y-4">
                        {tailleurs.map((artisan, i) => (
                            <div key={artisan.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-2xl border border-gray-100 group hover:bg-white hover:shadow-xl transition-all">
                                <div className="flex items-center gap-6">
                                    <span className="text-2xl font-black text-gray-300 group-hover:text-brand-900 transition-colors w-8 text-center">#{i+1}</span>
                                    <div className="w-12 h-12 bg-white rounded-xl border flex items-center justify-center font-black text-brand-900 shadow-sm">{artisan.nom.charAt(0)}</div>
                                    <div><p className="font-black text-gray-800 uppercase text-sm tracking-tight">{artisan.nom}</p></div>
                                </div>
                                <div className="flex items-center gap-10">
                                    <div className="text-right"><p className="text-[10px] font-black text-gray-400 uppercase mb-0.5">Efficacité</p><p className="text-xl font-black text-gray-800">98%</p></div>
                                    <div className="w-40 h-2 bg-gray-200 rounded-full overflow-hidden shadow-inner"><div className="h-full bg-brand-900 transition-all duration-1000" style={{ width: '98%' }} /></div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* MODAL DÉTAILS COMPLET (ŒIL) */}
            {detailModalOpen && selectedOrder && (
                <div className="fixed inset-0 bg-brand-900/90 z-[600] flex items-center justify-center p-4 backdrop-blur-md">
                    <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[95vh] animate-in zoom-in">
                        <div className="p-8 border-b flex justify-between items-center shrink-0">
                            <h3 className="text-2xl font-black text-gray-800 uppercase tracking-tighter">Fiche de Production</h3>
                            <div className="flex gap-2">
                                <button onClick={() => handlePrintOrder(selectedOrder)} className="p-3 bg-brand-900 text-white rounded-xl hover:bg-black transition-colors shadow-lg active:scale-95"><Printer size={24}/></button>
                                <button onClick={() => setDetailModalOpen(false)} className="p-3 bg-gray-50 text-gray-400 rounded-xl hover:bg-gray-100 transition-colors shadow-sm"><X size={24}/></button>
                            </div>
                        </div>
                        <div className="p-10 overflow-y-auto flex-1 custom-scrollbar space-y-10 bg-gray-50/30">
                            <div className="bg-white p-8 rounded-[2rem] border border-brand-100 shadow-sm relative overflow-hidden">
                                <span className="text-[10px] font-black text-brand-600 uppercase tracking-[0.2em] mb-2 block">Client de la commande</span>
                                <h4 className="text-3xl font-black text-gray-900 uppercase tracking-tight leading-none mb-4">{selectedOrder.clientNom}</h4>
                                <div className="p-4 bg-brand-50/50 rounded-2xl border border-brand-100/50"><p className="text-sm text-gray-700 font-bold leading-relaxed uppercase">{selectedOrder.description}</p></div>
                            </div>

                            <div className="space-y-4">
                                <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] ml-4">Versements & Historique</h4>
                                <div className="bg-white rounded-[2.5rem] border border-gray-100 overflow-hidden shadow-sm">
                                    <div className="p-6 flex justify-between items-center border-b border-gray-50 hover:bg-gray-50 transition-colors">
                                        <div><p className="text-[10px] font-black text-gray-400 uppercase">Le {new Date(selectedOrder.dateCommande).toLocaleDateString()}</p><span className="font-bold text-gray-800 text-sm uppercase">Dépôt Initial (Acompte)</span></div>
                                        <span className="font-black text-gray-900 text-xl">{selectedOrder.avance.toLocaleString()} F</span>
                                    </div>
                                    {selectedOrder.paiements?.map(p => (
                                        <div key={p.id} className="p-6 flex justify-between items-center border-b border-gray-50 hover:bg-gray-50 transition-colors">
                                            <div><p className="text-[10px] font-black text-brand-600 uppercase">Le {new Date(p.date).toLocaleDateString()}</p><span className="font-bold text-gray-700 text-sm uppercase">{p.note || 'Encaissement Atelier'}</span></div>
                                            <div className="flex items-center gap-3">
                                                <span className="font-black text-brand-600 text-xl">+{p.montant.toLocaleString()} F</span>
                                                <div className="flex gap-1">
                                                    <button onClick={() => handleOpenEditPayment(p)} className="p-2 bg-blue-50 text-blue-400 rounded-lg hover:bg-blue-600 hover:text-white transition-all"><Edit2 size={14}/></button>
                                                    <button onClick={() => { if(window.confirm("Voulez-vous supprimer ce versement ?")) onDeletePayment(selectedOrder.id, p.id, comptes[0]?.id) }} className="p-2 bg-red-50 text-red-300 hover:bg-red-600 hover:text-white transition-all"><Trash2 size={14}/></button>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                    <div className="grid grid-cols-2">
                                        <div className="bg-gray-900 p-8 text-white"><span className="text-[10px] font-black uppercase mb-1 block opacity-50">Valeur Commande</span><p className="text-3xl font-black">{selectedOrder.prixTotal.toLocaleString()} F</p></div>
                                        <div className="bg-red-50 p-8 border-l border-red-100/50"><span className="text-[10px] font-black text-red-400 uppercase mb-1 block">Solde à percevoir</span><p className="text-3xl font-black text-red-600">{selectedOrder.reste.toLocaleString()} F</p></div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* MODAL MODIFICATION PAIEMENT ATELIER (BUG 2) */}
            {editPaymentModalOpen && selectedPayment && selectedOrder && (
                <div className="fixed inset-0 bg-brand-900/80 z-[700] flex items-center justify-center p-4 backdrop-blur-md">
                    <div className="bg-white rounded-[2.5rem] p-10 w-full max-w-sm shadow-2xl animate-in zoom-in border border-brand-100">
                        <div className="flex justify-between items-center mb-8 border-b pb-5 shrink-0"><h3 className="text-xl font-black uppercase tracking-tighter flex items-center gap-3"><Edit2 className="text-blue-600"/> Modifier Versement</h3><button onClick={() => setEditPaymentModalOpen(false)}><X size={28} className="text-gray-400"/></button></div>
                        <div className="space-y-6">
                            <div><label className="block text-[10px] font-black text-gray-400 uppercase mb-2 ml-1">Nouveau Montant (F)</label><input type="number" className="w-full p-5 border-2 border-brand-100 rounded-2xl text-2xl font-black text-brand-600 focus:border-brand-600 outline-none" value={editPayData.amount} onChange={e => setEditPayData({...editPayData, amount: parseInt(e.target.value)||0})}/></div>
                            <div><label className="block text-[10px] font-black text-gray-400 uppercase mb-2 ml-1">Caisse (Correction)</label><select className="w-full p-4 border-2 border-gray-100 rounded-2xl font-black bg-white outline-none" value={editPayData.accId} onChange={e => setEditPayData({...editPayData, accId: e.target.value})}><option value="">-- Choisir Caisse --</option>{comptes.map(c => <option key={c.id} value={c.id}>{c.nom} ({c.solde.toLocaleString()} F)</option>)}</select></div>
                        </div>
                        <div className="flex justify-end gap-3 mt-10 pt-5 border-t">
                            <button onClick={() => setEditPaymentModalOpen(false)} className="px-6 py-4 text-gray-400 font-black uppercase text-[10px]">Annuler</button>
                            <button onClick={() => { if(!editPayData.accId) return; onUpdatePayment(selectedOrder.id, selectedPayment.id, editPayData.amount, editPayData.date, editPayData.accId); setEditPaymentModalOpen(false); }} className="px-12 py-4 bg-brand-900 text-white rounded-2xl font-black uppercase text-xs shadow-xl active:scale-95 transition-all">Mettre à jour</button>
                        </div>
                    </div>
                </div>
            )}

            {/* MODAL ASSIGNATION TACHE */}
            {taskModalOpen && (
                <div className="fixed inset-0 bg-brand-900/80 z-[800] flex items-center justify-center p-4 backdrop-blur-md">
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md p-10 animate-in zoom-in border border-brand-100">
                        <div className="flex justify-between items-center mb-8 border-b pb-5 shrink-0"><h3 className="text-xl font-black uppercase tracking-tighter flex items-center gap-3"><UserPlus className="text-brand-600"/> Nouvelle Mission</h3><button onClick={() => setTaskModalOpen(false)}><X size={28} className="text-gray-400 hover:text-red-500"/></button></div>
                        <div className="space-y-6">
                            <div><label className="block text-[10px] font-black text-gray-400 uppercase mb-2 ml-1">Choisir Commande</label><select className="w-full p-4 border-2 border-gray-100 rounded-2xl font-bold bg-white" value={newTaskData.commandeId} onChange={e => setNewTaskData({...newTaskData, commandeId: e.target.value})}><option value="">-- Sélectionner --</option>{commandes.filter(c => !c.archived && c.statut !== StatutCommande.LIVRE).map(c => <option key={c.id} value={c.id}>{c.clientNom} (Ref #{c.id.slice(-6)})</option>)}</select></div>
                            <div><label className="block text-[10px] font-black text-gray-400 uppercase mb-2 ml-1">Artisan / Tailleur</label><select className="w-full p-4 border-2 border-gray-100 rounded-2xl font-bold bg-white" value={newTaskData.tailleurId} onChange={e => setNewTaskData({...newTaskData, tailleurId: e.target.value})}><option value="">-- Choisir artisan --</option>{tailleurs.map(t => <option key={t.id} value={t.id}>{t.nom}</option>)}</select></div>
                            <div className="grid grid-cols-2 gap-4">
                                <div><label className="block text-[10px] font-black text-gray-400 uppercase mb-2 ml-1">Action</label><select className="w-full p-4 border-2 border-gray-100 rounded-2xl font-bold bg-white" value={newTaskData.action} onChange={e => setNewTaskData({...newTaskData, action: e.target.value as ActionProduction})}><option value="COUPE">COUPE</option><option value="COUTURE">COUTURE</option><option value="BRODERIE">BRODERIE</option><option value="FINITION">FINITION</option><option value="REPASSAGE">REPASSAGE</option></select></div>
                                <div><label className="block text-[10px] font-black text-gray-400 uppercase mb-2 ml-1">Date</label><input type="date" className="w-full p-4 border-2 border-gray-100 rounded-2xl font-bold" value={newTaskData.date} onChange={e => setNewTaskData({...newTaskData, date: e.target.value})}/></div>
                            </div>
                        </div>
                        <div className="flex justify-end gap-3 mt-10 pt-5 border-t">
                            <button onClick={() => setTaskModalOpen(false)} className="px-6 py-4 text-gray-400 font-black uppercase text-[10px]">Annuler</button>
                            <button onClick={() => { if(!newTaskData.commandeId || !newTaskData.tailleurId) return; onAddTask(newTaskData.commandeId!, { id: `T_${Date.now()}`, ...newTaskData as TacheProduction, statut: 'A_FAIRE' }); setTaskModalOpen(false); }} className="px-12 py-4 bg-brand-900 text-white rounded-2xl font-black uppercase text-xs tracking-widest shadow-xl active:scale-95 transition-all">Assigner</button>
                        </div>
                    </div>
                </div>
            )}

            {/* MODAL ENCAISSEMENT RAPIDE */}
            {paymentModalOpen && selectedOrder && (
                <div className="fixed inset-0 bg-brand-900/80 z-[700] flex items-center justify-center p-4 backdrop-blur-md">
                    <div className="bg-white rounded-[2.5rem] p-10 w-full max-w-sm shadow-2xl animate-in zoom-in border border-brand-100">
                        <div className="flex justify-between items-center mb-8 border-b pb-5 shrink-0"><h3 className="text-xl font-black uppercase tracking-tighter flex items-center gap-3"><DollarSign className="text-green-600"/> Encaisser Solde</h3><button onClick={() => setPaymentModalOpen(false)}><X size={28} className="text-gray-400"/></button></div>
                        <div className="space-y-6">
                            <div className="bg-gray-50 p-6 rounded-3xl text-center border shadow-inner"><p className="text-[10px] font-black text-gray-400 uppercase mb-1">Reste à payer</p><p className="text-3xl font-black text-gray-900">{selectedOrder.reste.toLocaleString()} F</p></div>
                            <div><label className="block text-[10px] font-black text-gray-400 uppercase mb-2 ml-1">Montant Reçu (F)</label><input type="number" className="w-full p-5 border-2 border-brand-100 rounded-2xl text-2xl font-black text-brand-600 focus:border-brand-600 outline-none" value={payData.amount} onChange={e => setPayData({...payData, amount: parseInt(e.target.value)||0})}/></div>
                            <div><label className="block text-[10px] font-black text-gray-400 uppercase mb-2 ml-1">Caisse de réception</label><select className="w-full p-4 border-2 border-gray-100 rounded-2xl font-black bg-white outline-none" value={payData.accId} onChange={e => setPayData({...payData, accId: e.target.value})}><option value="">-- Choisir Caisse --</option>{comptes.map(c => <option key={c.id} value={c.id}>{c.nom} ({c.solde.toLocaleString()} F)</option>)}</select></div>
                        </div>
                        <div className="flex justify-end gap-3 mt-10 pt-5 border-t">
                            <button onClick={() => setPaymentModalOpen(false)} className="px-6 py-4 text-gray-400 font-black uppercase text-[10px]">Annuler</button>
                            <button onClick={() => { if(!payData.accId || payData.amount <= 0) return; onAddPayment(selectedOrder.id, payData.amount, payData.method, "Encaissement Atelier", payData.date, payData.accId); setPaymentModalOpen(false); }} className="px-12 py-4 bg-brand-900 text-white rounded-2xl font-black uppercase text-xs tracking-widest shadow-xl active:scale-95 transition-all">Valider</button>
                        </div>
                    </div>
                </div>
            )}

            {/* MODAL CRÉATION / MODIFICATION COMMANDE */}
            {orderModalOpen && (
                <div className="fixed inset-0 bg-brand-900/80 z-[600] flex items-center justify-center p-4 backdrop-blur-md">
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl flex flex-col max-h-[95vh] border border-brand-100 overflow-hidden animate-in zoom-in">
                         <div className="p-8 bg-white border-b flex justify-between items-center shrink-0"><h3 className="text-2xl font-black text-gray-800 uppercase tracking-tighter">{isEditingOrder ? 'Modification' : 'Nouvelle'} Commande</h3><button onClick={() => setOrderModalOpen(false)}><X size={28} className="text-gray-400 hover:text-red-500"/></button></div>
                         <div className="p-8 space-y-6 overflow-y-auto flex-1 custom-scrollbar bg-gray-50/30">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div><label className="text-[10px] font-black text-gray-400 uppercase mb-2 block ml-1">Client</label><select className="w-full p-4 border-2 border-gray-100 rounded-2xl font-bold bg-white outline-none" value={newOrderData.clientId} onChange={e => setNewOrderData({...newOrderData, clientId: e.target.value})}><option value="">-- Choisir --</option>{clients.map(c => <option key={c.id} value={c.id}>{c.nom}</option>)}</select></div>
                                <div><label className="text-[10px] font-black text-gray-400 uppercase mb-2 block ml-1">Date Livraison</label><input type="date" className="w-full p-4 border-2 border-gray-100 rounded-2xl font-bold outline-none" value={newOrderData.dateLivraisonPrevue} onChange={e => setNewOrderData({...newOrderData, dateLivraisonPrevue: e.target.value})}/></div>
                            </div>
                            <div><label className="text-[10px] font-black text-gray-400 uppercase mb-2 block ml-1">Description / Notes</label><textarea className="w-full p-4 border-2 border-gray-100 rounded-2xl font-bold bg-white outline-none h-28 focus:border-brand-500 transition-colors" value={newOrderData.description} onChange={e => setNewOrderData({...newOrderData, description: e.target.value})} placeholder="Modèle, mesures, tissus..."/></div>
                            <div className="grid grid-cols-2 gap-6">
                                <div><label className="text-[10px] font-black text-gray-400 uppercase mb-2 block ml-1">Prix Total (F)</label><input type="number" className="w-full p-4 border-2 border-gray-100 rounded-2xl font-black text-gray-900 outline-none" value={newOrderData.prixTotal} onChange={e => setNewOrderData({...newOrderData, prixTotal: parseInt(e.target.value)||0})}/></div>
                                <div><label className="text-[10px] font-black text-brand-600 uppercase mb-2 block ml-1">Acompte Initial (F)</label><input type="number" className="w-full p-4 border-2 border-brand-100 rounded-2xl font-black text-brand-600 outline-none" value={newOrderData.avance} onChange={e => setNewOrderData({...newOrderData, avance: parseInt(e.target.value)||0})}/></div>
                            </div>
                            {((newOrderData.avance || 0) > 0) && (
                                <div className="bg-brand-900 p-6 rounded-2xl text-white shadow-lg animate-in slide-in-from-top-4"><label className="text-[10px] font-black text-brand-300 uppercase mb-3 block">Compte source pour l'encaissement d'accompte :</label><select className="w-full p-4 bg-white/10 border border-white/20 rounded-2xl font-black outline-none text-white" value={initialAccountId} onChange={e => setInitialAccountId(e.target.value)}><option value="" className="text-gray-900">-- Choisir Compte --</option>{comptes.map(c => <option key={c.id} value={c.id} className="text-gray-900">{c.nom} ({c.solde.toLocaleString()} F)</option>)}</select></div>
                            )}
                         </div>
                         <div className="p-8 bg-white border-t flex justify-end gap-4 shrink-0">
                            <button onClick={() => setOrderModalOpen(false)} className="px-8 py-4 text-gray-400 font-black uppercase text-xs hover:text-gray-600 transition-colors">Annuler</button>
                            <button onClick={handleCreateOrUpdateOrder} className="px-16 py-4 bg-brand-900 text-white rounded-2xl font-black uppercase text-xs shadow-2xl active:scale-95 transition-all hover:bg-black flex items-center gap-2"><Save size={18}/> {isEditingOrder ? 'Enregistrer modifs' : 'Créer Commande'}</button>
                         </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ProductionView;
