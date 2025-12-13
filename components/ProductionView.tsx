
import React, { useState, useMemo, useEffect } from 'react';
import { Commande, Employe, Client, Article, StatutCommande, RoleEmploye, ModePaiement, CompteFinancier, CompanyAssets } from '../types';
import { COMPANY_CONFIG } from '../config';
import { Scissors, LayoutGrid, List, LayoutList, Users, BarChart2, Archive, Search, Camera, Filter, Plus, X, Trophy, Activity, AlertTriangle, Clock, AlertCircle, QrCode, Edit2, Shirt, Calendar, MessageSquare, History, EyeOff, Printer, MessageCircle, Wallet, CheckSquare, Ban, Save, Trash2, ArrowUpDown, Ruler, ChevronRight } from 'lucide-react';
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
    // Correction : Le Chef d'Atelier DOIT pouvoir encaisser
    const canSeeFinance = userRole === RoleEmploye.ADMIN || userRole === RoleEmploye.GERANT || userRole === RoleEmploye.CHEF_ATELIER;
    
    const tailleurs = employes.filter(e => e.role === RoleEmploye.TAILLEUR || e.role === RoleEmploye.CHEF_ATELIER || e.role === RoleEmploye.STAGIAIRE);
    const matieresPremieres = articles.filter(a => a.typeArticle === 'MATIERE_PREMIERE');

    const filteredCommandes = useMemo(() => {
        return commandes.filter(c => {
            if (c.type !== 'SUR_MESURE') return false; 

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
        }).sort((a, b) => new Date(a.dateLivraisonPrevue).getTime() - new Date(b.dateLivraisonPrevue).getTime());
    }, [commandes, searchTerm, showArchived, filterStatus, filterTailor, filterDeliveryDateStart, filterDeliveryDateEnd]);

    // Calculate totals for form
    const montantTotalTTC = Math.max(0, prixBase - remise) + (applyTva ? Math.round(Math.max(0, prixBase - remise) * COMPANY_CONFIG.tvaRate) : 0);

    // --- ACTIONS ---

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
            paiements: [], 
            consommations: consommations.map(c => ({ articleId: c.articleId, variante: c.variante, quantite: c.quantite }))
        };

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

    const handleConfirmPayment = () => {
        if (!selectedOrderForPayment || paymentAmount <= 0) return;
        if (!paymentAccountId) { alert("Sélectionnez un compte."); return; }
        
        onAddPayment(selectedOrderForPayment.id, paymentAmount, paymentMethod, "Paiement Production", new Date().toISOString(), paymentAccountId);
        setPaymentModalOpen(false);
        setSelectedOrderForPayment(null);
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
        // Si le code correspond exactement à une commande, on pourrait l'ouvrir
        const exactMatch = commandes.find(c => c.id === decodedText);
        if (exactMatch) {
            // Optionnel: Ouvrir directement le détail ou faire une action
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
        <div className="space-y-6">
            {/* HEADER */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2"><Scissors className="text-brand-600"/> Atelier Production</h2>
                    <p className="text-sm text-gray-500">Gestion des commandes sur mesure et suivi atelier.</p>
                </div>
                <div className="flex flex-wrap gap-2 items-center">
                    {/* BOUTON SCANNER RÉINTÉGRÉ */}
                    <button 
                        onClick={() => setIsScannerOpen(true)} 
                        className="bg-gray-800 text-white p-2 rounded-lg hover:bg-gray-900 transition-colors shadow-sm flex items-center gap-2"
                        title="Scanner QR Code"
                    >
                        <Camera size={18} /> <span className="hidden sm:inline text-sm font-bold">Scanner</span>
                    </button>

                    <div className="flex bg-white border border-gray-200 p-1 rounded-lg">
                        <button onClick={() => setViewMode('ORDERS')} className={`px-3 py-1.5 text-xs font-bold rounded ${viewMode === 'ORDERS' ? 'bg-gray-100 text-brand-700' : 'text-gray-500'}`}><LayoutList size={14}/> Commandes</button>
                        <button onClick={() => setViewMode('TAILORS')} className={`px-3 py-1.5 text-xs font-bold rounded ${viewMode === 'TAILORS' ? 'bg-gray-100 text-brand-700' : 'text-gray-500'}`}><Users size={14}/> Tailleurs</button>
                        <button onClick={() => setViewMode('PERFORMANCE')} className={`px-3 py-1.5 text-xs font-bold rounded ${viewMode === 'PERFORMANCE' ? 'bg-gray-100 text-brand-700' : 'text-gray-500'}`}><Trophy size={14}/> Performance</button>
                    </div>
                    {!showArchived && (
                        <button onClick={handleOpenCreateModal} className="bg-brand-600 text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 hover:bg-brand-700"><Plus size={16}/> Créer</button>
                    )}
                </div>
            </div>

            {/* FILTERS */}
            {viewMode === 'ORDERS' && (
                <div className="bg-white p-3 rounded-lg border border-gray-200 flex flex-wrap gap-3 items-center">
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

            {/* VIEW: ORDERS */}
            {viewMode === 'ORDERS' && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {filteredCommandes.map(cmd => (
                        <div key={cmd.id} className="bg-white rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-all relative overflow-hidden flex flex-col">
                            {/* Status Bar */}
                            <div className={`h-1.5 w-full ${getStatusColor(cmd.statut).split(' ')[0].replace('bg', 'bg-gradient-to-r from-transparent to')}`}></div>
                            
                            <div className="p-5 flex-1">
                                <div className="flex justify-between items-start mb-2">
                                    <h3 className="font-bold text-lg text-gray-800 truncate pr-2">{cmd.clientNom}</h3>
                                    <span className={`text-[10px] px-2 py-1 rounded font-bold uppercase tracking-wider ${getStatusColor(cmd.statut)}`}>{cmd.statut}</span>
                                </div>
                                <p className="text-sm text-gray-600 mb-3 line-clamp-2">{cmd.description}</p>
                                
                                <div className="flex items-center gap-4 text-xs text-gray-500 mb-4">
                                    <div className="flex items-center gap-1"><Calendar size={12}/> {new Date(cmd.dateLivraisonPrevue).toLocaleDateString()}</div>
                                    <div className="flex items-center gap-1"><Shirt size={12}/> Qté: {cmd.quantite}</div>
                                </div>

                                <div className="flex flex-wrap gap-1 mb-4">
                                    {cmd.tailleursIds.map(tid => {
                                        const t = tailleurs.find(emp => emp.id === tid);
                                        return t ? <span key={tid} className="text-[10px] bg-gray-100 px-2 py-0.5 rounded text-gray-600">{t.nom}</span> : null;
                                    })}
                                    {cmd.tailleursIds.length === 0 && <span className="text-[10px] text-red-400 italic">Non assigné</span>}
                                </div>
                            </div>

                            <div className="p-3 bg-gray-50 border-t border-gray-100 flex items-center justify-between">
                                <div className="text-xs">
                                    {cmd.reste > 0 ? <span className="text-red-600 font-bold">Reste: {cmd.reste.toLocaleString()} F</span> : <span className="text-green-600 font-bold flex items-center gap-1"><CheckSquare size={10}/> Payé</span>}
                                </div>
                                <div className="flex gap-1 items-center">
                                    <button onClick={() => {setQrOrder(cmd); setQrModalOpen(true);}} className="p-1.5 text-gray-500 hover:bg-white rounded hover:text-brand-600"><QrCode size={16}/></button>
                                    {!showArchived && cmd.statut !== StatutCommande.LIVRE && cmd.statut !== StatutCommande.ANNULE && (
                                        <button onClick={() => handleOpenEditModal(cmd)} className="p-1.5 text-gray-500 hover:bg-white rounded hover:text-blue-600"><Edit2 size={16}/></button>
                                    )}
                                    <button onClick={() => generatePrintContent(cmd)} className="p-1.5 text-gray-500 hover:bg-white rounded hover:text-gray-800"><Printer size={16}/></button>
                                    
                                    {canSeeFinance && cmd.reste > 0 && (
                                        <button 
                                            onClick={(e) => { 
                                                e.preventDefault(); 
                                                e.stopPropagation(); 
                                                openPaymentModal(cmd); 
                                            }}
                                            className="px-3 py-1 bg-brand-600 text-white text-xs font-bold rounded hover:bg-brand-700 ml-2 relative z-[10]"
                                        >
                                            Encaisser
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* VIEW: TAILORS */}
            {viewMode === 'TAILORS' && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {tailleurs.map(t => {
                        const tasks = commandes.filter(c => c.tailleursIds.includes(t.id) && c.statut !== StatutCommande.LIVRE && c.statut !== StatutCommande.ANNULE && !c.archived);
                        return (
                            <div key={t.id} className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
                                <div className="flex items-center gap-3 mb-4 pb-3 border-b border-gray-100">
                                    <div className="w-10 h-10 rounded-full bg-blue-50 text-blue-700 flex items-center justify-center font-bold text-lg">{t.nom.charAt(0)}</div>
                                    <div><h3 className="font-bold text-gray-800">{t.nom}</h3><p className="text-xs text-gray-500">{t.role}</p></div>
                                    <span className="ml-auto bg-gray-100 text-gray-700 px-2 py-1 rounded text-xs font-bold">{tasks.length} Tâches</span>
                                </div>
                                <div className="space-y-2 max-h-[300px] overflow-y-auto">
                                    {tasks.length > 0 ? tasks.map(task => (
                                        <div key={task.id} className="p-2 bg-gray-50 rounded border border-gray-100 text-sm">
                                            <div className="flex justify-between mb-1"><span className="font-bold text-gray-700">{task.clientNom}</span><span className={`text-[10px] px-1.5 rounded ${getStatusColor(task.statut)}`}>{task.statut}</span></div>
                                            <p className="text-gray-500 text-xs mb-1">{task.description}</p>
                                            <div className="flex items-center gap-1 text-[10px] text-orange-600 font-medium"><Clock size={10}/> Livraison: {new Date(task.dateLivraisonPrevue).toLocaleDateString()}</div>
                                        </div>
                                    )) : <p className="text-center text-gray-400 text-xs italic py-4">Aucune tâche en cours.</p>}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* VIEW: PERFORMANCE */}
            {viewMode === 'PERFORMANCE' && (
                <div className="space-y-6">
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

            {/* MODAL PAYMENT (FIXED Z-INDEX) */}
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
        </div>
    );
};

export default ProductionView;
