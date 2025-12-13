
import React, { useState, useMemo } from 'react';
import { Commande, Employe, Client, Article, StatutCommande, RoleEmploye, ModePaiement, CompteFinancier, CompanyAssets } from '../types';
import { COMPANY_CONFIG } from '../config';
import { Scissors, LayoutGrid, List, LayoutList, Users, BarChart2, Archive, Search, Camera, Filter, Plus, X, Trophy, Activity, AlertTriangle, Clock, AlertCircle, QrCode, Edit2, Shirt, Calendar, MessageSquare, History, EyeOff, Printer, MessageCircle, Wallet, CheckSquare, Ban, Save, Trash2, ArrowUpDown, Ruler } from 'lucide-react';
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
    const [viewMode, setViewMode] = useState<'ORDERS' | 'TAILORS' | 'PERFORMANCE'>('ORDERS');
    const [orderDisplayMode, setOrderDisplayMode] = useState<'GRID' | 'LIST'>('GRID');
    const [showArchived, setShowArchived] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [isScannerOpen, setIsScannerOpen] = useState(false);

    // FILTERS & SORT STATE
    const [showFiltersPanel, setShowFiltersPanel] = useState(false);
    const [filterStatus, setFilterStatus] = useState('ALL');
    const [filterTailor, setFilterTailor] = useState('ALL');
    const [filterClient, setFilterClient] = useState('ALL');
    const [filterDateStart, setFilterDateStart] = useState('');
    const [filterDateEnd, setFilterDateEnd] = useState('');
    const [filterDeliveryDateStart, setFilterDeliveryDateStart] = useState('');
    const [filterDeliveryDateEnd, setFilterDeliveryDateEnd] = useState('');
    
    // Sort State
    const [sortOption, setSortOption] = useState<'DELIVERY_ASC' | 'DELIVERY_DESC' | 'ORDER_DESC' | 'ORDER_ASC' | 'STATUS'>('DELIVERY_ASC');

    // MODAL STATE - QR
    const [qrModalOpen, setQrModalOpen] = useState(false);
    const [qrOrder, setQrOrder] = useState<Commande | null>(null);

    // MODAL STATE - PAYMENT
    const [paymentModalOpen, setPaymentModalOpen] = useState(false);
    const [selectedOrderForPayment, setSelectedOrderForPayment] = useState<Commande | null>(null);
    const [paymentAmount, setPaymentAmount] = useState(0);
    const [paymentMethod, setPaymentMethod] = useState<ModePaiement>('ESPECE');
    const [paymentNote, setPaymentNote] = useState('');
    const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0]);
    const [paymentAccountId, setPaymentAccountId] = useState('');
    
    // MODAL STATE - CREATE/EDIT ORDER
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isEditingOrder, setIsEditingOrder] = useState(false);
    const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
    
    // FORM STATE
    const [selectedClientId, setSelectedClientId] = useState('');
    const [description, setDescription] = useState('');
    const [notes, setNotes] = useState('');
    const [dateLivraison, setDateLivraison] = useState('');
    const [quantite, setQuantite] = useState(1);
    const [selectedTailleurs, setSelectedTailleurs] = useState<string[]>([]);
    const [consommations, setConsommations] = useState<{ id: string, articleId: string, variante: string, quantite: number }[]>([]);
    const [tempConso, setTempConso] = useState<{ articleId: string, variante: string, quantite: number }>({ articleId: '', variante: '', quantite: 0 });

    // FINANCE FORM STATE
    const [applyTva, setApplyTva] = useState(false);
    const [prixBase, setPrixBase] = useState(0);
    const [remise, setRemise] = useState(0);
    const [avance, setAvance] = useState(0);
    const [initialPaymentMethod, setInitialPaymentMethod] = useState<ModePaiement>('ESPECE');
    const [initialAccountId, setInitialAccountId] = useState('');

    // DERIVED VALUES
    const isProductionStaff = userRole === RoleEmploye.TAILLEUR || userRole === RoleEmploye.CHEF_ATELIER;
    const canSeeFinance = userRole === RoleEmploye.ADMIN || userRole === RoleEmploye.GERANT;
    const canDeliverOrCancel = !isProductionStaff;
    const tailleurs = employes.filter(e => e.role === RoleEmploye.TAILLEUR || e.role === RoleEmploye.CHEF_ATELIER || e.role === RoleEmploye.STAGIAIRE);
    const matieresPremieres = articles.filter(a => a.typeArticle === 'MATIERE_PREMIERE');

    // Filter Logic
    const filteredCommandes = useMemo(() => {
        return commandes.filter(c => {
            if (c.type !== 'SUR_MESURE') return false; 

            const matchesSearch = c.clientNom.toLowerCase().includes(searchTerm.toLowerCase()) || 
                                  c.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
                                  c.description.toLowerCase().includes(searchTerm.toLowerCase());
            
            const matchesArchive = showArchived ? c.archived === true : c.archived !== true;
            
            let matchesStatus = true;
            if (filterStatus !== 'ALL') {
                if (filterStatus === 'EN_COURS') {
                    matchesStatus = c.statut !== StatutCommande.LIVRE && c.statut !== StatutCommande.ANNULE;
                } else {
                    matchesStatus = c.statut === filterStatus;
                }
            }

            const matchesTailor = filterTailor === 'ALL' ? true : filterTailor === 'UNASSIGNED' ? c.tailleursIds.length === 0 : c.tailleursIds.includes(filterTailor);
            const matchesClient = filterClient === 'ALL' ? true : c.clientId === filterClient;
            
            let matchesOrderDate = true;
            if (filterDateStart) matchesOrderDate = new Date(c.dateCommande).getTime() >= new Date(filterDateStart).getTime();
            if (filterDateEnd && matchesOrderDate) matchesOrderDate = new Date(c.dateCommande).getTime() <= new Date(filterDateEnd).setHours(23,59,59);

            let matchesDeliveryDate = true;
            if (filterDeliveryDateStart) matchesDeliveryDate = new Date(c.dateLivraisonPrevue).getTime() >= new Date(filterDeliveryDateStart).getTime();
            if (filterDeliveryDateEnd && matchesDeliveryDate) matchesDeliveryDate = new Date(c.dateLivraisonPrevue).getTime() <= new Date(filterDeliveryDateEnd).setHours(23,59,59);

            return matchesSearch && matchesArchive && matchesStatus && matchesTailor && matchesClient && matchesOrderDate && matchesDeliveryDate;
        }).sort((a, b) => {
            switch (sortOption) {
                case 'DELIVERY_ASC': return new Date(a.dateLivraisonPrevue).getTime() - new Date(b.dateLivraisonPrevue).getTime();
                case 'DELIVERY_DESC': return new Date(b.dateLivraisonPrevue).getTime() - new Date(a.dateLivraisonPrevue).getTime();
                case 'ORDER_DESC': return new Date(b.dateCommande).getTime() - new Date(a.dateCommande).getTime();
                case 'ORDER_ASC': return new Date(a.dateCommande).getTime() - new Date(b.dateCommande).getTime();
                case 'STATUS': return a.statut.localeCompare(b.statut);
                default: return 0;
            }
        });
    }, [commandes, searchTerm, showArchived, filterStatus, filterTailor, filterClient, filterDateStart, filterDateEnd, filterDeliveryDateStart, filterDeliveryDateEnd, sortOption]);

    const activeFiltersCount = (filterStatus !== 'ALL' ? 1 : 0) + (filterTailor !== 'ALL' ? 1 : 0) + (filterClient !== 'ALL' ? 1 : 0) + (filterDateStart ? 1 : 0) + (filterDeliveryDateStart ? 1 : 0);

    const montantApresRemise = Math.max(0, prixBase - remise);
    const montantTva = applyTva ? Math.round(montantApresRemise * COMPANY_CONFIG.tvaRate) : 0;
    const montantTotalTTC = montantApresRemise + montantTva;
    const montantReste = Math.max(0, montantTotalTTC - avance);

    // Handlers
    const handleOpenCreateModal = () => {
        setIsEditingOrder(false);
        setSelectedOrderId(null);
        setSelectedClientId('');
        setDescription('');
        setNotes('');
        setDateLivraison('');
        setQuantite(1);
        setSelectedTailleurs([]);
        setConsommations([]);
        setPrixBase(0); setRemise(0); setAvance(0); setApplyTva(false); setInitialAccountId('');
        setIsModalOpen(true);
    };

    const handleOpenEditModal = (cmd: Commande) => {
        setIsEditingOrder(true);
        setSelectedOrderId(cmd.id);
        setSelectedClientId(cmd.clientId || '');
        setDescription(cmd.description);
        setNotes(cmd.notes || '');
        setDateLivraison(cmd.dateLivraisonPrevue.split('T')[0]);
        setQuantite(cmd.quantite || 1);
        setSelectedTailleurs(cmd.tailleursIds);
        setConsommations(cmd.consommations ? cmd.consommations.map(c => ({...c, id: `c_${Date.now()}_${Math.random()}`})) : []);
        
        setApplyTva(!!cmd.tva && cmd.tva > 0);
        const tva = cmd.tva || 0;
        const remiseVal = cmd.remise || 0;
        const total = cmd.prixTotal;
        setPrixBase(total - tva + remiseVal);
        setRemise(remiseVal);
        setAvance(cmd.avance);
        setInitialAccountId('');
        setInitialPaymentMethod('ESPECE');
        setIsModalOpen(true);
    };

    const handleCreateOrUpdate = () => {
        if (!selectedClientId || !description || !dateLivraison) {
            alert("Veuillez remplir les champs obligatoires (Client, Description, Date Livraison).");
            return;
        }

        const client = clients.find(c => c.id === selectedClientId);
        const orderData: Commande = {
            id: selectedOrderId || `CMD${Date.now()}`,
            clientId: selectedClientId,
            clientNom: client?.nom || 'Client Inconnu',
            description,
            notes,
            quantite,
            dateCommande: isEditingOrder && selectedOrderId ? (commandes.find(c => c.id === selectedOrderId)?.dateCommande || new Date().toISOString()) : new Date().toISOString(),
            dateLivraisonPrevue: dateLivraison,
            statut: isEditingOrder ? (commandes.find(c => c.id === selectedOrderId)?.statut || StatutCommande.EN_ATTENTE) : StatutCommande.EN_ATTENTE,
            tailleursIds: selectedTailleurs,
            prixTotal: montantTotalTTC,
            tva: montantTva,
            tvaRate: applyTva ? (COMPANY_CONFIG.tvaRate * 100) : 0,
            remise,
            avance,
            reste: montantReste,
            type: 'SUR_MESURE',
            paiements: isEditingOrder ? (commandes.find(c => c.id === selectedOrderId)?.paiements || []) : (avance > 0 ? [{ id: `PAY_INIT_${Date.now()}`, date: new Date().toISOString(), montant: avance, moyenPaiement: initialPaymentMethod, note: 'Acompte initial' }] : []),
            consommations: consommations.map(c => ({ articleId: c.articleId, variante: c.variante, quantite: c.quantite }))
        };

        if (isEditingOrder) {
            onUpdateOrder(orderData, initialAccountId, initialPaymentMethod);
        } else {
            if (avance > 0 && !initialAccountId) {
                alert("Veuillez sélectionner un compte pour l'encaissement de l'avance.");
                return;
            }
            onCreateOrder(orderData, consommations.map(c => ({ articleId: c.articleId, variante: c.variante, quantite: c.quantite })), initialPaymentMethod, initialAccountId);
        }
        setIsModalOpen(false);
    };

    const toggleTailleurSelection = (id: string) => {
        setSelectedTailleurs(prev => prev.includes(id) ? prev.filter(tid => tid !== id) : [...prev, id]);
    };

    const addConsommation = () => {
        if (!tempConso.articleId || !tempConso.quantite) return;
        setConsommations([...consommations, { ...tempConso, id: `c_${Date.now()}` }]);
        setTempConso({ articleId: '', variante: '', quantite: 0 });
    };

    const removeConsommation = (id: string) => {
        setConsommations(prev => prev.filter(c => c.id !== id));
    };

    const openQRModal = (cmd: Commande) => {
        setQrOrder(cmd);
        setQrModalOpen(true);
    };

    // --- PRINT FUNCTION RESTORED ---
    const generatePrintContent = (orderData: Partial<Commande>, mode: 'TICKET' | 'DEVIS' | 'LIVRAISON' = 'TICKET') => {
        const printWindow = window.open('', '', 'width=800,height=800');
        if (!printWindow) return;

        const dateStr = orderData.dateCommande ? new Date(orderData.dateCommande).toLocaleDateString() : new Date().toLocaleDateString();
        let docTitle = "TICKET DE COMMANDE";
        if (mode === 'DEVIS') docTitle = "DEVIS ESTIMATIF";
        if (mode === 'LIVRAISON') docTitle = "BON DE LIVRAISON";
        
        const totalTTC = orderData.prixTotal || 0;
        const tva = orderData.tva || 0;
        const remise = orderData.remise || 0;
        const avanceRecue = orderData.avance || 0;
        const resteAPayer = Math.max(0, totalTTC - avanceRecue);
        const totalHT = totalTTC - tva + remise;
        
        const logoUrl = companyAssets?.logoStr || `${window.location.origin}${COMPANY_CONFIG.logoUrl}`;

        const html = `
            <html>
            <head>
                <title>${docTitle}</title>
                <style>
                    body { font-family: 'Courier New', monospace; padding: 20px; font-size: 14px; max-width: 800px; margin: auto; }
                    .header { text-align: center; margin-bottom: 20px; border-bottom: 2px solid #333; padding-bottom: 10px; }
                    .logo { text-align: center; margin-bottom: 15px; }
                    .logo img { max-height: 80px; width: auto; object-fit: contain; }
                    .info-section { display: flex; justify-content: space-between; margin-bottom: 20px; }
                    .items-table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
                    .items-table th, .items-table td { border-bottom: 1px dashed #ccc; padding: 8px; text-align: left; }
                    .total-section { display: flex; justify-content: flex-end; margin-top: 10px; }
                    .row { display: flex; justify-content: space-between; margin-bottom: 5px; width: 250px; }
                    .bold { font-weight: bold; }
                </style>
            </head>
            <body>
                <div class="header">
                    <div class="logo"><img src="${logoUrl}" alt="Logo" onerror="this.style.display='none'"/></div>
                    <h2>${COMPANY_CONFIG.name}</h2>
                    <p>${COMPANY_CONFIG.address} | ${COMPANY_CONFIG.phone}</p>
                    <h3>${docTitle}</h3>
                </div>
                <div class="info-section">
                    <div>
                        <p><strong>Client:</strong> ${orderData.clientNom}</p>
                        <p><strong>Réf:</strong> #${orderData.id ? orderData.id.slice(-6) : 'N/A'}</p>
                    </div>
                    <div style="text-align: right;">
                        <p>Date: ${dateStr}</p>
                        <p>Livraison: ${orderData.dateLivraisonPrevue ? new Date(orderData.dateLivraisonPrevue).toLocaleDateString() : 'N/A'}</p>
                    </div>
                </div>
                <table class="items-table">
                    <thead><tr><th>Désignation</th><th style="text-align:right;">Montant</th></tr></thead>
                    <tbody>
                        <tr>
                            <td>
                                <strong>${orderData.description}</strong>
                                ${orderData.notes ? `<br/><small><i>${orderData.notes}</i></small>` : ''}
                            </td>
                            <td style="text-align:right;">${(totalHT + remise).toLocaleString()}</td>
                        </tr>
                    </tbody>
                </table>
                <div class="total-section">
                    <div>
                        <div class="row"><span>Sous-total HT :</span><span>${totalHT.toLocaleString()}</span></div>
                        ${tva > 0 ? `<div class="row"><span>TVA :</span><span>${tva.toLocaleString()}</span></div>` : ''}
                        <div class="row bold" style="border-top: 1px solid #000; margin-top:5px; padding-top:5px;"><span>TOTAL TTC :</span><span>${totalTTC.toLocaleString()} ${COMPANY_CONFIG.currency}</span></div>
                        ${mode !== 'DEVIS' ? `<div class="row"><span>Avance :</span><span>${avanceRecue.toLocaleString()}</span></div><div class="row bold"><span>Reste :</span><span>${resteAPayer.toLocaleString()}</span></div>` : ''}
                    </div>
                </div>
                <script>setTimeout(() => window.print(), 1000);</script>
            </body>
            </html>
        `;
        printWindow.document.write(html);
        printWindow.document.close();
    };

    const openPaymentModal = (cmd: Commande) => {
        setSelectedOrderForPayment(cmd);
        setPaymentAmount(cmd.reste);
        setPaymentAccountId('');
        setPaymentModalOpen(true);
    };

    const submitPayment = () => {
        if (!selectedOrderForPayment || paymentAmount <= 0) return;
        if (!paymentAccountId) { alert("Veuillez sélectionner un compte de destination (Caisse/Banque)."); return; }
        onAddPayment(selectedOrderForPayment.id, paymentAmount, paymentMethod, paymentNote, paymentDate || new Date().toISOString(), paymentAccountId);
        setPaymentModalOpen(false);
        setSelectedOrderForPayment(null);
    };

    const getStatusColor = (status: StatutCommande | string) => {
        switch (status) {
            case StatutCommande.EN_ATTENTE: return 'bg-gray-100 text-gray-800';
            case StatutCommande.EN_COUPE: return 'bg-blue-100 text-blue-800';
            case StatutCommande.COUTURE: return 'bg-indigo-100 text-indigo-800';
            case StatutCommande.FINITION: return 'bg-purple-100 text-purple-800';
            case StatutCommande.PRET: return 'bg-green-100 text-green-800';
            case StatutCommande.LIVRE: return 'bg-gray-200 text-gray-600 line-through';
            case StatutCommande.ANNULE: return 'bg-red-100 text-red-800';
            default: return 'bg-gray-100';
        }
    };

    const selectedArticleObj = articles.find(a => a.id === tempConso.articleId);

    // --- RENDER ---
    return (
        <div className="space-y-4">
            {/* HEADER */}
            <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4">
                <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2"><Scissors className="text-brand-600" /> Atelier de Production</h2>
                <div className="flex flex-col sm:flex-row gap-3 w-full xl:w-auto items-center">
                    {/* FILTRE ET VIEW MODES */}
                    <div className="flex gap-2">
                        <div className="relative">
                            <input 
                                type="text" 
                                placeholder="Rechercher..." 
                                className="pl-8 pr-3 py-1.5 border border-gray-300 rounded-lg text-sm w-40 sm:w-64 focus:ring-2 focus:ring-brand-500"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                            <Search className="absolute left-2.5 top-2 text-gray-400" size={14}/>
                        </div>
                        <button 
                            onClick={() => setShowFiltersPanel(!showFiltersPanel)}
                            className={`p-2 rounded-lg border transition-colors ${showFiltersPanel ? 'bg-brand-100 border-brand-300 text-brand-700' : 'bg-white border-gray-300 text-gray-600'}`}
                            title="Filtres"
                        >
                            <Filter size={18} />
                        </button>
                    </div>

                    <div className="flex bg-gray-100 p-1 rounded-lg">
                        <button onClick={() => setViewMode('ORDERS')} className={`px-3 py-1.5 text-xs font-medium rounded-md ${viewMode === 'ORDERS' ? 'bg-white text-brand-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}><LayoutList size={14} /> Commandes</button>
                        <button onClick={() => setViewMode('TAILORS')} className={`px-3 py-1.5 text-xs font-medium rounded-md ${viewMode === 'TAILORS' ? 'bg-white text-brand-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}><Users size={14} /> Suivi Tailleurs</button>
                        <button onClick={() => setViewMode('PERFORMANCE')} className={`px-3 py-1.5 text-xs font-medium rounded-md ${viewMode === 'PERFORMANCE' ? 'bg-white text-brand-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}><Trophy size={14} /> Performance</button>
                    </div>
                    {!showArchived && (
                        <button onClick={handleOpenCreateModal} className="bg-brand-600 hover:bg-brand-700 text-white px-4 py-1.5 rounded-lg flex items-center gap-2 font-medium text-sm"><Plus size={18} /> Nouvelle Commande</button>
                    )}
                </div>
            </div>

            {/* FILTER PANEL */}
            {showFiltersPanel && (
                <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 animate-in slide-in-from-top-2">
                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Statut</label>
                        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="w-full p-2 border rounded text-sm">
                            <option value="ALL">Tout</option>
                            <option value="EN_COURS">En Cours (Actifs)</option>
                            {Object.values(StatutCommande).map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Tailleur</label>
                        <select value={filterTailor} onChange={e => setFilterTailor(e.target.value)} className="w-full p-2 border rounded text-sm">
                            <option value="ALL">Tous</option>
                            <option value="UNASSIGNED">Non assigné</option>
                            {tailleurs.map(t => <option key={t.id} value={t.id}>{t.nom}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Période (Livraison)</label>
                        <div className="flex gap-2">
                            <input type="date" className="w-full p-1 border rounded text-xs" value={filterDeliveryDateStart} onChange={e => setFilterDeliveryDateStart(e.target.value)} placeholder="Du"/>
                            <input type="date" className="w-full p-1 border rounded text-xs" value={filterDeliveryDateEnd} onChange={e => setFilterDeliveryDateEnd(e.target.value)} placeholder="Au"/>
                        </div>
                    </div>
                    <div className="flex items-end">
                        <button onClick={() => { setFilterStatus('ALL'); setFilterTailor('ALL'); setFilterDeliveryDateStart(''); setFilterDeliveryDateEnd(''); setSearchTerm(''); }} className="text-red-500 text-xs font-bold hover:underline mb-2">Réinitialiser Filtres</button>
                    </div>
                </div>
            )}

            {/* MAIN CONTENT */}
            {viewMode === 'ORDERS' && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {filteredCommandes.map(cmd => {
                        const isCancelled = cmd.statut === StatutCommande.ANNULE;
                        return (
                            <div key={cmd.id} className={`bg-white rounded-xl shadow-sm border p-5 hover:shadow-md transition-shadow relative group border-gray-100 ${isCancelled ? 'opacity-75' : ''}`}>
                                <div className="absolute top-2 right-2 flex gap-1 z-[50]">
                                    <button onClick={() => openQRModal(cmd)} className="p-1.5 bg-white border border-gray-200 text-gray-500 hover:text-brand-600 rounded"><QrCode size={14} /></button>
                                    {!showArchived && !isCancelled && cmd.statut !== StatutCommande.LIVRE && (
                                        <button onClick={() => handleOpenEditModal(cmd)} className="p-1.5 bg-white border border-gray-200 text-gray-500 hover:text-brand-600 rounded"><Edit2 size={14} /></button>
                                    )}
                                </div>
                                <div className="mt-6 flex justify-between items-start mb-4 pl-3 relative z-10">
                                    <div><span className="font-bold text-lg text-gray-800 block">{cmd.clientNom}</span><span className="text-xs text-gray-400">#{cmd.id.slice(-6)}</span></div>
                                    <span className={`px-2 py-1 rounded-full text-xs font-semibold ${getStatusColor(cmd.statut)}`}>{cmd.statut}</span>
                                </div>
                                <div className="flex items-start gap-3 mb-4 pl-3 relative z-10">
                                    <div className="p-2 bg-brand-50 rounded-lg shrink-0"><Shirt className="text-brand-600" size={20} /></div>
                                    <div className="flex-1 min-w-0">
                                        <h3 className="text-sm font-medium text-gray-900 line-clamp-2">{cmd.quantite > 1 && <span className="bg-gray-900 text-white text-[10px] px-1 rounded mr-1">{cmd.quantite}x</span>}{cmd.description}</h3>
                                        <p className="text-xs flex items-center gap-1 mt-1 text-gray-500"><Calendar size={12}/> Livraison: {new Date(cmd.dateLivraisonPrevue).toLocaleDateString()}</p>
                                    </div>
                                </div>
                                <div className="mt-4 pt-3 border-t border-gray-100 flex flex-wrap gap-2 pl-3 items-center relative z-20">
                                    {!showArchived && cmd.statut !== StatutCommande.LIVRE && !isCancelled && (
                                        <div className="flex-1 min-w-[120px]">
                                            <select className="block w-full text-xs border-gray-300 rounded p-1.5" value={cmd.statut} onChange={(e) => onUpdateStatus(cmd.id, e.target.value as StatutCommande)}>
                                                {Object.values(StatutCommande).filter(s => canDeliverOrCancel || (s !== StatutCommande.LIVRE && s !== StatutCommande.ANNULE)).map(s => <option key={s} value={s}>{s}</option>)}
                                            </select>
                                        </div>
                                    )}
                                    {!showArchived && !isCancelled && (
                                        <>
                                            <button onClick={() => generatePrintContent(cmd, 'TICKET')} className="p-1.5 bg-gray-100 text-gray-600 hover:bg-gray-200 rounded"><Printer size={16} /></button>
                                            {canSeeFinance && cmd.reste > 0 && (
                                                <button 
                                                    onClick={(e) => { e.stopPropagation(); openPaymentModal(cmd); }} 
                                                    className="bg-brand-100 text-brand-800 px-3 py-1.5 rounded text-xs font-bold flex items-center gap-1 hover:bg-brand-200"
                                                >
                                                    <Wallet size={14} /> ENCAISSER
                                                </button>
                                            )}
                                        </>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* TAILORS VIEW */}
            {viewMode === 'TAILORS' && (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                    {tailleurs.map(tailor => {
                        const assignedOrders = commandes.filter(c => c.tailleursIds.includes(tailor.id) && c.statut !== StatutCommande.LIVRE && c.statut !== StatutCommande.ANNULE && !c.archived);
                        return (
                            <div key={tailor.id} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                                <div className="bg-gray-50 p-4 border-b border-gray-100 flex justify-between items-center">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-full bg-brand-100 flex items-center justify-center text-brand-700 font-bold">{tailor.nom.charAt(0)}</div>
                                        <div><h3 className="font-bold text-gray-800">{tailor.nom}</h3><p className="text-xs text-gray-500">{tailor.role}</p></div>
                                    </div>
                                    <span className="bg-white px-2 py-1 rounded text-xs font-bold border border-gray-200">{assignedOrders.length} Tâches</span>
                                </div>
                                <div className="p-4 space-y-3 max-h-[300px] overflow-y-auto">
                                    {assignedOrders.length > 0 ? assignedOrders.map(order => (
                                        <div key={order.id} className="flex items-start gap-2 p-2 rounded bg-gray-50 border border-gray-100">
                                            <div className="mt-1"><AlertCircle size={14} className={new Date(order.dateLivraisonPrevue) < new Date() ? "text-red-500" : "text-gray-400"} /></div>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-xs font-bold text-gray-800 truncate">{order.clientNom}</p>
                                                <p className="text-[10px] text-gray-600 truncate">{order.description}</p>
                                                <div className="flex justify-between mt-1">
                                                    <span className={`text-[10px] px-1.5 rounded ${getStatusColor(order.statut)}`}>{order.statut}</span>
                                                    <span className="text-[10px] text-gray-400">{new Date(order.dateLivraisonPrevue).toLocaleDateString()}</span>
                                                </div>
                                            </div>
                                        </div>
                                    )) : (
                                        <p className="text-center text-gray-400 text-sm py-4 italic">Aucune commande en cours.</p>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* PERFORMANCE VIEW (SIMPLE) */}
            {viewMode === 'PERFORMANCE' && (
                <div className="p-8 text-center text-gray-400">
                    <Trophy size={48} className="mx-auto mb-2 opacity-20"/>
                    <p>Module de performance en cours de développement.</p>
                </div>
            )}

            {/* QR Modal */}
            {qrOrder && (
                <QRGeneratorModal isOpen={qrModalOpen} onClose={() => setQrModalOpen(false)} value={qrOrder.id} title={qrOrder.clientNom} subtitle={qrOrder.description} />
            )}

            {/* Payment Modal */}
            {paymentModalOpen && selectedOrderForPayment && (
                <div className="fixed inset-0 bg-black bg-opacity-60 z-[100] flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm p-6 animate-in zoom-in duration-200">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-xl font-bold flex items-center gap-2 text-gray-800"><Wallet size={24} className="text-green-600"/> Encaissement</h3>
                            <button onClick={() => setPaymentModalOpen(false)}><X size={20} className="text-gray-400"/></button>
                        </div>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Montant</label>
                                <input type="number" className="w-full p-2 border border-gray-300 rounded font-bold text-lg bg-gray-50" value={paymentAmount} onChange={e => setPaymentAmount(parseInt(e.target.value) || 0)} max={selectedOrderForPayment.reste} />
                                <p className="text-xs text-gray-500 mt-1">Reste dû : {selectedOrderForPayment.reste.toLocaleString()} F</p>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Moyen Paiement</label>
                                <select className="w-full p-2 border border-gray-300 rounded" value={paymentMethod} onChange={e => setPaymentMethod(e.target.value as ModePaiement)}><option value="ESPECE">Espèce</option><option value="WAVE">Wave</option><option value="ORANGE_MONEY">Orange Money</option><option value="CHEQUE">Chèque</option></select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Compte Destination</label>
                                <select className="w-full p-2 border border-gray-300 rounded" value={paymentAccountId} onChange={e => setPaymentAccountId(e.target.value)}><option value="">-- Choisir --</option>{comptes.map(acc => <option key={acc.id} value={acc.id}>{acc.nom} ({acc.solde.toLocaleString()} F)</option>)}</select>
                            </div>
                        </div>
                        <div className="flex justify-end gap-3 mt-6">
                            <button onClick={() => setPaymentModalOpen(false)} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded">Annuler</button>
                            <button onClick={submitPayment} className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 font-bold">Valider</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Create/Edit Order Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
                        <div className="p-4 border-b border-gray-100 bg-gray-50 flex justify-between items-center shrink-0">
                            <h3 className="font-bold text-lg text-gray-800">{isEditingOrder ? 'Modifier Commande' : 'Nouvelle Commande'}</h3>
                            <button onClick={() => setIsModalOpen(false)}><X size={20}/></button>
                        </div>
                        <div className="p-6 overflow-y-auto flex-1 space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div><label className="block text-sm font-medium mb-1">Client</label><select className="w-full p-2 border rounded" value={selectedClientId} onChange={e => setSelectedClientId(e.target.value)}><option value="">-- Sélectionner --</option>{clients.map(c => <option key={c.id} value={c.id}>{c.nom}</option>)}</select></div>
                                <div><label className="block text-sm font-medium mb-1">Date Livraison</label><input type="date" className="w-full p-2 border rounded" value={dateLivraison} onChange={e => setDateLivraison(e.target.value)}/></div>
                            </div>
                            <div><label className="block text-sm font-medium mb-1">Description</label><input type="text" className="w-full p-2 border rounded" value={description} onChange={e => setDescription(e.target.value)} placeholder="Ex: Robe soie..."/></div>
                            <div><label className="block text-sm font-medium mb-1">Notes (Mesures, etc.)</label><textarea className="w-full p-2 border rounded" value={notes} onChange={e => setNotes(e.target.value)} rows={3}/></div>
                            <div className="grid grid-cols-3 gap-4">
                                <div><label className="block text-sm font-medium mb-1">Quantité</label><input type="number" className="w-full p-2 border rounded" value={quantite} onChange={e => setQuantite(parseInt(e.target.value) || 1)}/></div>
                                <div><label className="block text-sm font-medium mb-1">Prix Total (TTC)</label><input type="number" className="w-full p-2 border rounded" value={prixBase} onChange={e => setPrixBase(parseInt(e.target.value) || 0)}/></div>
                                <div><label className="block text-sm font-medium mb-1">Avance</label><input type="number" className="w-full p-2 border rounded" value={avance} onChange={e => setAvance(parseInt(e.target.value) || 0)}/></div>
                            </div>
                            
                            {/* ASSIGNATION TAILLEURS */}
                            <div className="bg-gray-50 p-3 rounded border border-gray-200">
                                <label className="block text-sm font-medium mb-2">Assigner à des tailleurs</label>
                                <div className="flex flex-wrap gap-2">
                                    {tailleurs.map(t => (
                                        <button
                                            key={t.id}
                                            onClick={() => toggleTailleurSelection(t.id)}
                                            className={`px-3 py-1.5 rounded-full text-xs font-bold border transition-colors ${selectedTailleurs.includes(t.id) ? 'bg-brand-600 text-white border-brand-600' : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-100'}`}
                                        >
                                            {t.nom}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* CONSOMMATION MATIERES */}
                            <div className="bg-gray-50 p-3 rounded border border-gray-200">
                                <label className="block text-sm font-medium mb-2">Matériel utilisé (Stock)</label>
                                <div className="flex gap-2 mb-2">
                                    <select className="flex-1 text-xs p-1.5 border rounded" value={tempConso.articleId} onChange={e => setTempConso({...tempConso, articleId: e.target.value, variante: ''})}>
                                        <option value="">-- Article --</option>
                                        {matieresPremieres.map(a => <option key={a.id} value={a.id}>{a.nom}</option>)}
                                    </select>
                                    {selectedArticleObj && selectedArticleObj.variantes.length > 0 && (
                                        <select className="flex-1 text-xs p-1.5 border rounded" value={tempConso.variante} onChange={e => setTempConso({...tempConso, variante: e.target.value})}>
                                            <option value="">-- Variante --</option>
                                            {selectedArticleObj.variantes.map(v => <option key={v} value={v}>{v}</option>)}
                                        </select>
                                    )}
                                    <input type="number" className="w-20 text-xs p-1.5 border rounded" placeholder="Qté" value={tempConso.quantite || ''} onChange={e => setTempConso({...tempConso, quantite: parseFloat(e.target.value) || 0})}/>
                                    <button onClick={addConsommation} className="bg-gray-800 text-white p-1.5 rounded"><Plus size={16}/></button>
                                </div>
                                <div className="space-y-1">
                                    {consommations.map(c => {
                                        const artName = articles.find(a => a.id === c.articleId)?.nom || '???';
                                        return (
                                            <div key={c.id} className="flex justify-between items-center bg-white p-2 rounded border border-gray-100 text-xs">
                                                <span>{artName} ({c.variante || 'Std'}) x {c.quantite}</span>
                                                <button onClick={() => removeConsommation(c.id)} className="text-red-500"><X size={14}/></button>
                                            </div>
                                        )
                                    })}
                                </div>
                            </div>

                            {avance > 0 && !isEditingOrder && (
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Compte Encaissement Avance</label>
                                    <select className="w-full p-2 border border-gray-300 rounded" value={initialAccountId} onChange={e => setInitialAccountId(e.target.value)}>
                                        <option value="">-- Choisir Caisse/Banque --</option>
                                        {comptes.map(acc => <option key={acc.id} value={acc.id}>{acc.nom}</option>)}
                                    </select>
                                </div>
                            )}
                        </div>
                        <div className="p-4 border-t border-gray-100 bg-gray-50 flex justify-end gap-3 shrink-0">
                            <button onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50">Annuler</button>
                            <button onClick={handleCreateOrUpdate} className="px-4 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 flex items-center gap-2"><Save size={18} /> {isEditingOrder ? 'Enregistrer' : 'Créer'}</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ProductionView;
