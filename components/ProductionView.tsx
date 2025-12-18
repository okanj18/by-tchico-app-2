import React, { useState, useMemo, useEffect } from 'react';
import { Commande, Employe, Client, Article, StatutCommande, RoleEmploye, ModePaiement, CompteFinancier, CompanyAssets, TacheProduction, ActionProduction, ElementCommande, PaiementClient } from '../types';
import { COMPANY_CONFIG } from '../config';
import { Scissors, LayoutGrid, List, LayoutList, Users, BarChart2, Archive, Search, Camera, Filter, Plus, X, Trophy, Activity, AlertTriangle, Clock, AlertCircle, QrCode, Edit2, Shirt, Calendar, MessageSquare, History, EyeOff, Printer, MessageCircle, Wallet, CheckSquare, Ban, Save, Trash2, ArrowUpDown, Ruler, ChevronRight, RefreshCw, Columns, CheckCircle, Eye, AlertOctagon, FileText, CreditCard, CalendarRange, ChevronLeft, Zap, PenTool, PieChart } from 'lucide-react';
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
    
    // MODALS PAIEMENT
    const [paymentModalOpen, setPaymentModalOpen] = useState(false);
    const [selectedOrderForPayment, setSelectedOrderForPayment] = useState<Commande | null>(null);
    const [payAmount, setPayAmount] = useState(0);
    const [payMethod, setPayMethod] = useState<ModePaiement>('ESPECE');
    const [payAccount, setPayAccount] = useState('');
    const [payDate, setPayDate] = useState(new Date().toISOString().split('T')[0]);

    // MODAL HISTORIQUE PAIEMENT
    const [historyPaymentOrder, setHistoryPaymentOrder] = useState<Commande | null>(null);

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

    // NOUVEAU : Répartition pour gestion fractionnée
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
        setPrixBase((cmd.prixTotal || 0) + (cmd.remise || 0) - (cmd.tva || 0));
        setAvance(cmd.avance);
        setRemise(cmd.remise || 0);
        setTvaEnabled(!!cmd.tva && cmd.tva > 0);
        setVentilation(cmd.repartitionStatuts || { [cmd.statut]: cmd.quantite });
        if (cmd.elements && cmd.elements.length > 0) {
            setOrderElements(cmd.elements.map((el, i) => ({ id: `el_${i}`, nom: el.nom, quantite: el.quantite })));
        } else {
            setOrderElements([{ id: '1', nom: cmd.description, quantite: cmd.quantite }]);
        }
        setIsModalOpen(true);
    };

    const handleSaveOrder = () => {
        if (!selectedClientId || !dateLivraison) return;
        const validElements = orderElements.filter(e => e.nom.trim() !== '');
        if (validElements.length === 0) return;
        
        const totalQty = validElements.reduce((acc, e) => acc + e.quantite, 0);
        const totalVentilation = Object.values(ventilation).reduce((a, b) => a + b, 0);

        if (totalVentilation !== totalQty) {
            alert(`Attention: La somme de la ventilation (${totalVentilation}) doit être égale à la quantité totale (${totalQty}).`);
            return;
        }

        const subTotal = prixBase;
        const tvaAmount = tvaEnabled ? Math.round((subTotal - remise) * COMPANY_CONFIG.tvaRate) : 0;
        const totalTTC = subTotal - remise + tvaAmount;

        const client = clients.find(c => c.id === selectedClientId);
        const orderData: Commande = {
            id: selectedOrderId || `CMD${Date.now()}`,
            clientId: selectedClientId, clientNom: client?.nom || 'Inconnu',
            description: validElements.map(e => `${e.quantite} ${e.nom}`).join(', '),
            notes, quantite: totalQty,
            elements: validElements.map(e => ({ nom: e.nom, quantite: e.quantite })),
            dateCommande: isEditingOrder ? (commandes.find(c => c.id === selectedOrderId)?.dateCommande || new Date().toISOString()) : new Date().toISOString(),
            dateLivraisonPrevue: dateLivraison,
            statut: isEditingOrder ? (commandes.find(c => c.id === selectedOrderId)?.statut || StatutCommande.EN_ATTENTE) : StatutCommande.EN_ATTENTE,
            tailleursIds: selectedTailleurs,
            prixTotal: totalTTC, avance, reste: totalTTC - avance, type: 'SUR_MESURE',
            tva: tvaAmount, tvaRate: tvaEnabled ? (COMPANY_CONFIG.tvaRate * 100) : 0,
            remise: remise,
            repartitionStatuts: ventilation,
            paiements: isEditingOrder ? (commandes.find(c => c.id === selectedOrderId)?.paiements || []) : [],
            taches: isEditingOrder ? (commandes.find(c => c.id === selectedOrderId)?.taches || []) : []
        };
        if (isEditingOrder) onUpdateOrder(orderData, initialAccountId, initialPaymentMethod); 
        else onCreateOrder(orderData, [], initialPaymentMethod, initialAccountId);
        setIsModalOpen(false);
    };

    const handleConfirmPayment = () => {
        if (!selectedOrderForPayment || payAmount <= 0) return;
        if (!payAccount) { alert("Veuillez choisir un compte d'encaissement."); return; }
        onAddPayment(selectedOrderForPayment.id, payAmount, payMethod, "Versement atelier", payDate, payAccount);
        setPaymentModalOpen(false);
    };

    const handleSaveTask = () => {
        if (!newTaskData.orderId || !planningTarget) return;
        const order = commandes.find(c => c.id === newTaskData.orderId);
        if (!order) return;
        const newTask: TacheProduction = {
            id: `TASK_${Date.now()}`, commandeId: order.id, action: newTaskData.action,
            quantite: newTaskData.quantite, note: newTaskData.note, elementNom: newTaskData.elementNom,
            date: planningTarget.date.toISOString().split('T')[0], tailleurId: planningTarget.tailorId, statut: 'A_FAIRE'
        };
        const updatedOrder: Commande = { ...order, taches: [...(order.taches || []), newTask] };
        onUpdateOrder(updatedOrder);
        setTaskModalOpen(false);
        setNewTaskData({ orderId: '', action: 'COUTURE', quantite: 1, note: '', elementNom: '' });
    };

    const handlePrintInvoice = (order: Commande) => {
        const printWindow = window.open('', '', 'width=400,height=600');
        if (!printWindow) return;

        const dateStr = new Date(order.dateCommande).toLocaleDateString();
        const livraisonStr = new Date(order.dateLivraisonPrevue).toLocaleDateString();
        const isPaid = order.reste <= 0;
        const stampText = isPaid ? "PAYÉ" : "NON SOLDÉ";
        const stampColor = isPaid ? "#16a34a" : "#dc2626";

        const elementsHtml = order.elements?.map(el => `
            <div style="display:flex; justify-content:space-between; margin-bottom: 5px;">
                <span>${el.nom} x${el.quantite}</span>
            </div>
        `).join('') || `<div>${order.description}</div>`;

        const logoUrl = companyAssets?.logoStr || `${window.location.origin}${COMPANY_CONFIG.logoUrl}`;
        const signatureUrl = companyAssets?.signatureStr || '';

        const html = `
            <html>
            <head>
                <title>Facture #${order.id.slice(-6)}</title>
                <style>
                    body { font-family: 'Courier New', Courier, monospace; padding: 20px; font-size: 12px; max-width: 400px; margin: auto; color: #333; }
                    .header { text-align: center; margin-bottom: 20px; border-bottom: 1px dashed #000; padding-bottom: 10px; }
                    .logo img { max-height: 80px; margin-bottom: 5px; }
                    .info { margin-bottom: 15px; }
                    .total { border-top: 1px dashed black; margin-top: 10px; padding-top: 5px; }
                    .row { display: flex; justify-content: space-between; margin-bottom: 3px; }
                    .bold { font-weight: bold; }
                    .stamp { text-align: center; font-size: 24px; color: ${stampColor}; font-weight: bold; border: 3px solid ${stampColor}; padding: 5px; margin: 20px 0; transform: rotate(-5deg); }
                    .signature-area { margin-top: 30px; text-align: right; }
                    .signature-area img { max-height: 60px; margin-top: 5px; opacity: 0.8; }
                    .footer { text-align:center; margin-top: 20px; font-size: 10px; border-top: 1px dashed #000; padding-top: 10px; }
                </style>
            </head>
            <body>
                <div class="header">
                    <div class="logo"><img src="${logoUrl}" alt="Logo" onerror="this.style.display='none'"/></div>
                    <h3>${COMPANY_CONFIG.name}</h3>
                    <p>${COMPANY_CONFIG.address}<br/>${COMPANY_CONFIG.phone}</p>
                    <p><strong>FACTURE SUR MESURE</strong></p>
                </div>
                <div class="info">
                    <p><strong>CLIENT:</strong> ${order.clientNom}</p>
                    <p><strong>DATE:</strong> ${dateStr}</p>
                    <p><strong>LIVRAISON PRÉVUE:</strong> ${livraisonStr}</p>
                    <p><strong>REF:</strong> #${order.id.slice(-6)}</p>
                </div>
                <div style="border-bottom: 1px solid #eee; margin-bottom: 10px; padding-bottom: 5px; font-weight:bold;">DESCRIPTION:</div>
                <div class="items">${elementsHtml}</div>
                <div class="total">
                    <div class="row"><span>Sous-total</span><span>${((order.prixTotal||0) + (order.remise||0) - (order.tva||0)).toLocaleString()}</span></div>
                    ${order.remise ? `<div class="row"><span>Remise</span><span>-${order.remise.toLocaleString()}</span></div>` : ''}
                    ${order.tva ? `<div class="row"><span>TVA (${order.tvaRate}%)</span><span>${order.tva.toLocaleString()}</span></div>` : ''}
                    <div class="row bold" style="font-size: 14px; margin-top: 5px;"><span>TOTAL TTC</span><span>${order.prixTotal?.toLocaleString()} F</span></div>
                    <div class="row" style="margin-top: 8px;"><span>Déjà Versé</span><span style="color: green;">${order.avance.toLocaleString()} F</span></div>
                    <div class="row bold"><span>RESTE À PAYER</span><span style="color: ${order.reste > 0 ? 'red' : 'green'};">${order.reste.toLocaleString()} F</span></div>
                </div>
                <div class="stamp">${stampText}</div>
                
                ${signatureUrl ? `
                <div class="signature-area">
                    <p>Cachet & Signature:</p>
                    <img src="${signatureUrl}" alt="Signature" />
                </div>` : ''}

                <div class="footer">
                    <p>Merci de votre confiance !<br/>Les mesures sont conservées 1 an.</p>
                </div>
                <script>setTimeout(() => { window.print(); window.close(); }, 500);</script>
            </body>
            </html>
        `;
        printWindow.document.write(html);
        printWindow.document.close();
    };

    const getStatusColor = (s: string) => {
        switch(s) {
            case StatutCommande.EN_ATTENTE: return 'bg-gray-100 text-gray-700';
            case StatutCommande.EN_COUPE: return 'bg-blue-100 text-blue-700';
            case StatutCommande.COUTURE: return 'bg-indigo-100 text-indigo-700';
            case StatutCommande.FINITION: return 'bg-purple-100 text-purple-700';
            case StatutCommande.PRET: return 'bg-green-100 text-green-700';
            case StatutCommande.LIVRE: return 'bg-gray-800 text-white';
            case StatutCommande.ANNULE: return 'bg-red-100 text-red-700';
            default: return 'bg-gray-50';
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
                        <button onClick={() => { setIsEditingOrder(false); setOrderElements([{id: '1', nom: '', quantite: 1}]); setPrixBase(0); setAvance(0); setRemise(0); setTvaEnabled(false); setVentilation({}); setIsModalOpen(true); }} className="bg-brand-600 text-white px-4 py-1.5 rounded-lg flex items-center gap-2 text-xs font-bold hover:bg-brand-700 transition-all shadow-md"><Plus size={14}/> Créer</button>
                    </div>
                </div>
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

            {/* VIEWS */}
            <div className="flex-1 overflow-hidden flex flex-col">
                {/* AGENDA... (inchangé) */}
                {viewMode === 'PLANNING' && (
                    <div className="flex-1 bg-white rounded-xl shadow-sm border border-gray-200 flex flex-col overflow-hidden">
                        <div className="p-4 bg-gray-50 border-b flex justify-between items-center shrink-0">
                            <h3 className="font-bold text-gray-700">Planning de Production</h3>
                            <div className="flex items-center bg-white border rounded-lg">
                                <button onClick={() => setAgendaBaseDate(new Date(agendaBaseDate.setDate(agendaBaseDate.getDate() - 7)))} className="p-1.5 hover:bg-gray-100"><ChevronLeft size={18}/></button>
                                <button onClick={() => setAgendaBaseDate(new Date())} className="px-3 py-1 text-xs font-bold border-x">Aujourd'hui</button>
                                <button onClick={() => setAgendaBaseDate(new Date(agendaBaseDate.setDate(agendaBaseDate.getDate() + 7)))} className="p-1.5 hover:bg-gray-100"><ChevronRight size={18}/></button>
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
                                                <div key={d.toISOString()} className="w-48 shrink-0 p-2 border-r flex flex-col gap-1 min-h-[120px] cursor-pointer hover:bg-brand-50/10" onClick={() => { setPlanningTarget({ tailorId: t.id, tailorName: t.nom, date: d }); setTaskModalOpen(true); }}>
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

                {/* HISTORIQUE... (inchangé) */}
                {viewMode === 'HISTORY' && (
                    <div className="flex-1 bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex flex-col">
                        <div className="overflow-x-auto flex-1">
                            <table className="w-full text-sm text-left">
                                <thead className="bg-gray-50 text-gray-600 font-bold border-b sticky top-0">
                                    <tr>
                                        <th className="p-4">Date</th>
                                        <th className="p-4">Client</th>
                                        <th className="p-4">Description</th>
                                        <th className="p-4 text-center">Statut</th>
                                        <th className="p-4 text-right">Total</th>
                                        <th className="p-4 text-right">Reste</th>
                                        <th className="p-4 text-center">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {filteredCommandes.map(cmd => (
                                        <tr key={cmd.id} className="hover:bg-gray-50">
                                            <td className="p-4 text-gray-500">{new Date(cmd.dateCommande).toLocaleDateString()}</td>
                                            <td className="p-4 font-bold uppercase">{cmd.clientNom}</td>
                                            <td className="p-4 text-gray-600 truncate max-w-[200px]">{cmd.description}</td>
                                            <td className="p-4 text-center">
                                                <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase ${getStatusColor(cmd.statut)}`}>{cmd.statut}</span>
                                            </td>
                                            <td className="p-4 text-right font-bold">{cmd.prixTotal?.toLocaleString()} F</td>
                                            <td className={`p-4 text-right font-bold ${cmd.reste > 0 ? 'text-red-600' : 'text-green-600'}`}>
                                                {cmd.reste <= 0 ? 'Soldé' : `${cmd.reste.toLocaleString()} F`}
                                            </td>
                                            <td className="p-4 text-center">
                                                <div className="flex justify-center gap-1">
                                                    <button onClick={() => handlePrintInvoice(cmd)} className="p-1.5 text-gray-700 hover:bg-gray-100 rounded border border-gray-200" title="Imprimer Facture"><Printer size={16}/></button>
                                                    <button onClick={() => handleOpenEditModal(cmd)} className="p-1.5 text-blue-500 hover:bg-blue-50 rounded" title="Modifier"><Edit2 size={16}/></button>
                                                    {cmd.reste > 0 && cmd.statut !== StatutCommande.ANNULE && (
                                                        <button onClick={() => { setSelectedOrderForPayment(cmd); setPayAmount(cmd.reste); setPaymentModalOpen(true); }} className="p-1.5 text-green-600 hover:bg-green-50 rounded" title="Encaisser"><Wallet size={16}/></button>
                                                    )}
                                                    <button onClick={() => setHistoryPaymentOrder(cmd)} className="p-1.5 text-gray-500 hover:bg-gray-50 rounded" title="Détails versements"><Eye size={16}/></button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {/* KANBAN FRACTIONNÉ (MODIFIÉ) */}
                {viewMode === 'KANBAN' && (
                    <div className="flex-1 overflow-x-auto pb-4">
                        <div className="flex gap-4 h-full min-w-max">
                            {[StatutCommande.EN_ATTENTE, StatutCommande.EN_COUPE, StatutCommande.COUTURE, StatutCommande.FINITION, StatutCommande.PRET].map(status => {
                                // On filtre les commandes qui ont au moins 1 unité dans ce statut
                                const ordersInStatus = filteredCommandes.filter(c => {
                                    if (!c.repartitionStatuts) return c.statut === status;
                                    return (c.repartitionStatuts[status] || 0) > 0;
                                });

                                return (
                                    <div key={status} className="w-72 shrink-0 bg-gray-50 rounded-xl border flex flex-col">
                                        <div className="p-3 font-bold border-b bg-white rounded-t-xl flex justify-between uppercase text-xs tracking-wider">
                                            <span>{status}</span>
                                            <span className="bg-gray-100 px-2 rounded-full">{ordersInStatus.length}</span>
                                        </div>
                                        <div className="flex-1 p-2 space-y-2 overflow-y-auto">
                                            {ordersInStatus.map(cmd => {
                                                const qtyInThisStatus = cmd.repartitionStatuts ? (cmd.repartitionStatuts[status] || 0) : cmd.quantite;
                                                return (
                                                    <div key={`${cmd.id}-${status}`} className="bg-white p-3 rounded-lg border shadow-sm group relative border-l-4 border-l-brand-400">
                                                        <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 flex gap-1">
                                                            <button onClick={() => handleOpenEditModal(cmd)} className="p-1 text-blue-500 hover:bg-blue-50 rounded"><Edit2 size={12}/></button>
                                                        </div>
                                                        <div className="flex justify-between items-start">
                                                            <div className="font-bold text-sm text-gray-800 uppercase">{cmd.clientNom}</div>
                                                            <span className="bg-brand-100 text-brand-700 px-1.5 rounded text-[10px] font-black">x{qtyInThisStatus}</span>
                                                        </div>
                                                        <div className="text-[10px] text-gray-500 line-clamp-2 mt-1">{cmd.description}</div>
                                                        {cmd.quantite > 1 && cmd.repartitionStatuts && Object.keys(cmd.repartitionStatuts).length > 1 && (
                                                            <div className="mt-2 pt-2 border-t flex flex-wrap gap-1">
                                                                {Object.entries(cmd.repartitionStatuts).map(([s, q]) => (
                                                                    q > 0 && s !== status && <span key={s} className="text-[8px] bg-gray-100 px-1 rounded text-gray-400">{s.charAt(0)}:{q}</span>
                                                                ))}
                                                            </div>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}

                {/* AUTRES VUES... (inchangées pour la concision) */}
                {viewMode === 'TAILORS' && (
                    <div className="flex-1 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 overflow-y-auto p-1">
                        {tailleurs.map(t => {
                            const activeCmds = commandes.filter(c => c.statut !== StatutCommande.LIVRE && c.tailleursIds.includes(t.id));
                            return (
                                <div key={t.id} className="bg-white p-6 rounded-xl border shadow-sm flex flex-col items-center text-center group hover:border-brand-300 transition-all">
                                    <div className="w-16 h-16 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center text-2xl font-bold mb-4">{t.nom.charAt(0)}</div>
                                    <h3 className="text-lg font-bold text-gray-800">{t.nom}</h3>
                                    <p className="text-xs text-gray-500 mb-4 font-bold uppercase">{t.role}</p>
                                    <div className="w-full grid grid-cols-2 gap-2 mt-auto pt-4 border-t">
                                        <div className="bg-gray-50 p-2 rounded">
                                            <p className="text-[10px] text-gray-400 uppercase font-bold">En cours</p>
                                            <p className="text-lg font-bold text-brand-600">{activeCmds.length}</p>
                                        </div>
                                        <div className="bg-gray-50 p-2 rounded">
                                            <p className="text-[10px] text-gray-400 uppercase font-bold">Urgents</p>
                                            <p className="text-lg font-bold text-red-600">{activeCmds.filter(c => {
                                                const diff = new Date(c.dateLivraisonPrevue).getTime() - new Date().getTime();
                                                return diff < (1000 * 60 * 60 * 24 * 3);
                                            }).length}</p>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}

                {viewMode === 'ORDERS' && (
                    <div className="flex-1 overflow-y-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 pb-10 p-1">
                        {filteredCommandes.map(cmd => (
                            <div key={cmd.id} className="bg-white rounded-xl border p-5 shadow-sm relative flex flex-col h-full group hover:border-brand-300 transition-colors">
                                <div className="absolute top-4 right-4 flex gap-1">
                                    <button onClick={() => handleOpenEditModal(cmd)} className="p-1.5 text-gray-400 hover:text-blue-600 rounded-full border bg-white shadow-sm"><Edit2 size={16}/></button>
                                    <button onClick={() => onUpdateStatus(cmd.id, StatutCommande.LIVRE)} className="p-1.5 text-gray-400 hover:text-green-600 rounded-full border bg-white shadow-sm"><CheckCircle size={16}/></button>
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
            </div>

            {/* MODAL CREATION/MODIF (MODIFIÉ POUR VENTILATION) */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-black bg-opacity-60 z-[80] flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[95vh] flex flex-col animate-in zoom-in duration-200 overflow-hidden">
                        <div className="p-4 border-b flex justify-between items-center bg-gray-50">
                            <h3 className="font-bold text-lg">{isEditingOrder ? 'Modifier' : 'Nouvelle'} Commande</h3>
                            <button onClick={() => setIsModalOpen(false)}><X size={24} className="text-gray-400"/></button>
                        </div>
                        <div className="p-6 overflow-y-auto flex-1 space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div><label className="block text-sm font-medium mb-1 text-gray-500">Client</label><select className="w-full p-2 border rounded font-bold" value={selectedClientId} onChange={e => setSelectedClientId(e.target.value)} disabled={isEditingOrder}><option value="">-- Client --</option>{clients.map(c => <option key={c.id} value={c.id}>{c.nom}</option>)}</select></div>
                                <div><label className="block text-sm font-medium mb-1 text-gray-500">Date Livraison Prévue</label><input type="date" className="w-full p-2 border rounded font-bold" value={dateLivraison} onChange={e => setDateLivraison(e.target.value)}/></div>
                            </div>
                            
                            <div className="bg-gray-50 p-4 rounded border border-gray-200">
                                <h4 className="font-bold text-sm mb-2 text-gray-700">Articles à réaliser</h4>
                                {orderElements.map((el) => (
                                    <div key={el.id} className="flex gap-2 mb-2">
                                        <input type="text" className="flex-1 p-2 border rounded text-sm" placeholder="Article (ex: Robe...)" value={el.nom} onChange={(e) => setOrderElements(orderElements.map(x => x.id === el.id ? {...x, nom: e.target.value} : x))} />
                                        <input type="number" className="w-20 p-2 border rounded text-sm text-center" min="1" value={el.quantite} onChange={(e) => {
                                            const newQty = parseInt(e.target.value) || 1;
                                            setOrderElements(orderElements.map(x => x.id === el.id ? {...x, quantite: newQty} : x));
                                        }} />
                                    </div>
                                ))}
                                <button onClick={() => setOrderElements([...orderElements, {id:Date.now().toString(), nom:'', quantite:1}])} className="text-xs text-brand-600 font-bold flex items-center gap-1 mt-1"><Plus size={14}/> Ajouter ligne</button>
                            </div>

                            {/* NOUVELLE SECTION: VENTILATION KANBAN */}
                            <div className="bg-blue-50 p-4 rounded border border-blue-100">
                                <h4 className="font-bold text-sm mb-3 text-blue-800 flex items-center gap-2"><LayoutGrid size={16}/> Ventilation par Statut (Gestion Fractionnée)</h4>
                                <p className="text-[10px] text-blue-600 mb-3 uppercase font-bold italic">Répartissez les pièces selon leur avancement réel.</p>
                                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
                                    {[StatutCommande.EN_ATTENTE, StatutCommande.EN_COUPE, StatutCommande.COUTURE, StatutCommande.FINITION, StatutCommande.PRET].map(s => (
                                        <div key={s} className="bg-white p-2 rounded border border-blue-200">
                                            <label className="block text-[9px] font-bold text-gray-400 uppercase mb-1">{s}</label>
                                            <input 
                                                type="number" 
                                                min="0"
                                                className="w-full p-1 text-center font-black text-brand-700 bg-gray-50 rounded"
                                                value={ventilation[s] || 0}
                                                onChange={e => setVentilation({...ventilation, [s]: parseInt(e.target.value) || 0})}
                                            />
                                        </div>
                                    ))}
                                </div>
                                <div className="mt-3 flex justify-between items-center">
                                    <span className="text-xs font-bold text-blue-700">Total ventilé: {Object.values(ventilation).reduce((a,b)=>a+b, 0)} pièces</span>
                                    <span className="text-xs font-bold text-gray-500">Total requis: {orderElements.reduce((a,b)=>a+b.quantite, 0)}</span>
                                </div>
                            </div>

                            {/* ... RESTE DU FORMULAIRE (Prix, TVA, Tailleurs) ... */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Tailleurs assignés</label>
                                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                                    {tailleurs.map(t => (
                                        <label key={t.id} className={`flex items-center gap-2 p-2 border rounded text-xs cursor-pointer transition-colors ${selectedTailleurs.includes(t.id) ? 'bg-brand-50 border-brand-200 font-bold text-brand-700' : 'hover:bg-gray-50'}`}>
                                            <input type="checkbox" checked={selectedTailleurs.includes(t.id)} onChange={e => {
                                                if(e.target.checked) setSelectedTailleurs([...selectedTailleurs, t.id]);
                                                else setSelectedTailleurs(selectedTailleurs.filter(id => id !== t.id));
                                            }} className="rounded text-brand-600"/> {t.nom}
                                        </label>
                                    ))}
                                </div>
                            </div>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                <div className="md:col-span-2">
                                    <label className="block text-sm font-medium mb-1 text-gray-500">Prix de Base (HT)</label>
                                    <input type="number" className="w-full p-2 border rounded font-bold text-lg" value={prixBase} onChange={e => setPrixBase(parseInt(e.target.value) || 0)}/>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium mb-1 text-gray-500">Remise</label>
                                    <input type="number" className="w-full p-2 border rounded font-bold text-lg text-red-600" value={remise} onChange={e => setRemise(parseInt(e.target.value) || 0)}/>
                                </div>
                                <div className="flex items-end pb-2">
                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <input type="checkbox" checked={tvaEnabled} onChange={e => setTvaEnabled(e.target.checked)} className="rounded text-brand-600"/>
                                        <span className="text-sm font-bold text-gray-600">TVA ({COMPANY_CONFIG.tvaRate*100}%)</span>
                                    </label>
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-1 text-gray-500">Acompte à l'inscription</label>
                                <input type="number" className="w-full p-2 border rounded font-bold text-lg text-green-700 bg-green-50" value={avance} onChange={e => setAvance(parseInt(e.target.value) || 0)} disabled={isEditingOrder}/>
                            </div>
                        </div>
                        <div className="p-4 border-t bg-gray-50 flex justify-between items-center">
                            <div className="text-lg font-bold">Total: <span className="text-brand-600">{Math.max(0, prixBase - remise + (tvaEnabled ? Math.round((prixBase-remise)*COMPANY_CONFIG.tvaRate) : 0)).toLocaleString()} F</span></div>
                            <div className="flex gap-3">
                                <button onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-gray-600">Annuler</button>
                                <button onClick={handleSaveOrder} className="px-8 py-2 bg-brand-600 text-white rounded font-bold shadow-lg">Enregistrer</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
            
            {/* AUTRES MODALS... (inchangés) */}
            {isScannerOpen && <QRScannerModal isOpen={isScannerOpen} onClose={() => setIsScannerOpen(false)} onScan={(id) => {
                const cmd = commandes.find(c => c.id === id);
                if(cmd) { handleOpenEditModal(cmd); setIsScannerOpen(false); }
                else alert("Commande introuvable");
            }} />}

            {paymentModalOpen && selectedOrderForPayment && (
                <div className="fixed inset-0 bg-black bg-opacity-60 z-[90] flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm p-6 animate-in zoom-in duration-200">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-xl font-bold flex items-center gap-2 text-green-700"><Wallet size={24}/> Encaissement</h3>
                            <button onClick={() => setPaymentModalOpen(false)}><X size={20} className="text-gray-400"/></button>
                        </div>
                        <div className="space-y-4">
                            <div className="bg-gray-50 p-3 rounded text-xs"><p>Client: <strong className="uppercase">{selectedOrderForPayment.clientNom}</strong></p><p>Reste dû: <strong className="text-red-600 text-sm">{selectedOrderForPayment.reste.toLocaleString()} F</strong></p></div>
                            <div><label className="block text-sm font-medium text-gray-700 mb-1">Montant versé</label><input type="number" className="w-full p-2 border rounded font-bold text-lg bg-green-50 border-green-200" value={payAmount} onChange={e => setPayAmount(parseInt(e.target.value) || 0)} max={selectedOrderForPayment.reste} /></div>
                            <div><label className="block text-sm font-medium text-gray-700 mb-1">Caisse de réception</label><select className="w-full p-2 border rounded" value={payAccount} onChange={e => setPayAccount(e.target.value)}><option value="">-- Choisir Compte --</option>{comptes.map(acc => <option key={acc.id} value={acc.id}>{acc.nom} ({acc.solde.toLocaleString()} F)</option>)}</select></div>
                            <div className="flex justify-end gap-3 mt-6"><button onClick={() => setPaymentModalOpen(false)} className="px-4 py-2 text-gray-600">Annuler</button><button onClick={handleConfirmPayment} disabled={!payAccount || payAmount <= 0} className="px-4 py-2 bg-green-600 text-white rounded font-bold shadow-md disabled:opacity-50">Valider</button></div>
                        </div>
                    </div>
                </div>
            )}

            {historyPaymentOrder && (
                <div className="fixed inset-0 bg-black bg-opacity-60 z-[90] flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-md flex flex-col h-[70vh] overflow-hidden">
                        <div className="p-4 border-b bg-gray-50 flex justify-between items-center shrink-0"><h3 className="font-bold text-gray-800">Versements : {historyPaymentOrder.clientNom}</h3><button onClick={() => setHistoryPaymentOrder(null)}><X size={24} className="text-gray-400"/></button></div>
                        <div className="p-6 flex-1 overflow-y-auto space-y-4">
                            <div className="grid grid-cols-2 gap-4 text-xs font-bold bg-brand-50 p-4 rounded-lg">
                                <div className="text-gray-500 uppercase">Prix Total : <span className="text-gray-900 block text-lg">{historyPaymentOrder.prixTotal?.toLocaleString()} F</span></div>
                                <div className="text-red-500 uppercase">Reste : <span className="block text-lg">{historyPaymentOrder.reste.toLocaleString()} F</span></div>
                            </div>
                            {historyPaymentOrder.paiements && historyPaymentOrder.paiements.length > 0 ? (
                                <div className="space-y-2">
                                    {historyPaymentOrder.paiements.map((p, i) => (
                                        <div key={i} className="flex justify-between items-center p-3 border rounded-lg bg-white shadow-sm">
                                            <div><div className="text-sm font-bold text-gray-800">{new Date(p.date).toLocaleDateString()}</div><div className="text-[10px] text-gray-500 uppercase font-medium">{p.moyenPaiement}</div></div>
                                            <div className="text-green-600 font-bold">{p.montant.toLocaleString()} F</div>
                                        </div>
                                    ))}
                                </div>
                            ) : (<div className="text-center py-10 text-gray-400 italic text-sm">Aucun versement enregistré.</div>)}
                        </div>
                    </div>
                </div>
            )}

            {taskModalOpen && planningTarget && (
                <div className="fixed inset-0 bg-black bg-opacity-70 z-[100] flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm p-6 animate-in zoom-in duration-200">
                        <div className="flex justify-between items-center mb-4"><h3 className="text-xl font-bold">Assigner Tâche</h3><button onClick={() => setTaskModalOpen(false)}><X size={20}/></button></div>
                        <div className="bg-gray-50 p-3 rounded mb-4 text-xs"><p><strong>Tailleur :</strong> {planningTarget.tailorName}</p><p><strong>Date :</strong> {planningTarget.date.toLocaleDateString()}</p></div>
                        <div className="space-y-4">
                            <div><label className="block text-sm font-medium mb-1">Commande</label><select className="w-full p-2 border rounded" value={newTaskData.orderId} onChange={e => setNewTaskData({...newTaskData, orderId: e.target.value})}>
                                <option value="">-- Choisir --</option>
                                {commandes.filter(c => c.statut !== StatutCommande.LIVRE && c.type === 'SUR_MESURE').map(c => <option key={c.id} value={c.id}>{c.clientNom} - {c.description}</option>)}
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