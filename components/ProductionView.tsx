
import React, { useState, useMemo } from 'react';
import { Commande, Employe, Client, Article, StatutCommande, RoleEmploye, ModePaiement, CompteFinancier } from '../types';
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
}

const ProductionView: React.FC<ProductionViewProps> = ({ 
    commandes, employes, clients, articles, userRole, 
    onUpdateStatus, onCreateOrder, onUpdateOrder, onAddPayment, onArchiveOrder, comptes 
}) => {
    // VIEW STATE
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
    
    // MODAL STATE - HISTORY (ID only to ensure freshness)
    const [viewPaymentHistoryOrderId, setViewPaymentHistoryOrderId] = useState<string | null>(null);

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
    const [showMeasurements, setShowMeasurements] = useState(false); // Toggle measurements display

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
    // On permet au gérant et admin d'annuler/livrer via le SELECT, mais on cache les boutons rapides.
    const canDeliverOrCancel = !isProductionStaff;
    const tailleurs = employes.filter(e => e.role === RoleEmploye.TAILLEUR || e.role === RoleEmploye.CHEF_ATELIER || e.role === RoleEmploye.STAGIAIRE);
    const matieresPremieres = articles.filter(a => a.typeArticle === 'MATIERE_PREMIERE');

    // LISTE DES CHAMPS DE MESURE (Même que ClientsView)
    const MEASUREMENT_FIELDS = [
        { key: 'tourCou', label: 'T. Cou' },
        { key: 'epaule', label: 'Épaule' },
        { key: 'poitrine', label: 'TOUR POITRINE' }, // AJOUTÉ ICI POUR COHÉRENCE
        { key: 'longueurManche', label: 'L. Manche' },
        { key: 'tourBras', label: 'T. Bras' },
        { key: 'tourPoignet', label: 'T. Poignet' },
        { key: 'longueurBoubou1', label: 'L. Boubou' },
        { key: 'longueurChemise', label: 'L. Chemise' },
        { key: 'carrureDos', label: 'Carr. Dos' },
        { key: 'carrureDevant', label: 'Carr. Dev' },
        { key: 'taille', label: 'Taille' },
        { key: 'blouse', label: 'Blouse' },
        { key: 'ceinture', label: 'Ceinture' },
        { key: 'tourFesse', label: 'T. Fesse' },
        { key: 'tourCuisse', label: 'T. Cuisse' },
        { key: 'entreJambe', label: 'E. Jambe' },
        { key: 'longueurPantalon', label: 'L. Pant' },
        { key: 'genou1', label: 'Genou' },
        { key: 'bas', label: 'Bas' },
    ];

    // Active Order for History Modal
    const activeHistoryOrder = useMemo(() => {
        if (!viewPaymentHistoryOrderId) return null;
        return commandes.find(c => c.id === viewPaymentHistoryOrderId) || null;
    }, [viewPaymentHistoryOrderId, commandes]);

    // ... (Reste des filtres et handlers inchangés) ...
    // FILTERS LOGIC
    const filteredCommandes = useMemo(() => {
        return commandes.filter(c => {
            if (c.type !== 'SUR_MESURE') return false; 

            const matchesSearch = c.clientNom.toLowerCase().includes(searchTerm.toLowerCase()) || 
                                  c.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
                                  c.description.toLowerCase().includes(searchTerm.toLowerCase());
            
            // Standard Archive Logic
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
            
            // Filter by Order Date
            let matchesOrderDate = true;
            if (filterDateStart) {
                matchesOrderDate = new Date(c.dateCommande).getTime() >= new Date(filterDateStart).getTime();
            }
            if (filterDateEnd && matchesOrderDate) {
                matchesOrderDate = new Date(c.dateCommande).getTime() <= new Date(filterDateEnd).setHours(23,59,59);
            }

            // Filter by Delivery Date
            let matchesDeliveryDate = true;
            if (filterDeliveryDateStart) {
                matchesDeliveryDate = new Date(c.dateLivraisonPrevue).getTime() >= new Date(filterDeliveryDateStart).getTime();
            }
            if (filterDeliveryDateEnd && matchesDeliveryDate) {
                matchesDeliveryDate = new Date(c.dateLivraisonPrevue).getTime() <= new Date(filterDeliveryDateEnd).setHours(23,59,59);
            }

            return matchesSearch && matchesArchive && matchesStatus && matchesTailor && matchesClient && matchesOrderDate && matchesDeliveryDate;
        }).sort((a, b) => {
            switch (sortOption) {
                case 'DELIVERY_ASC':
                    return new Date(a.dateLivraisonPrevue).getTime() - new Date(b.dateLivraisonPrevue).getTime();
                case 'DELIVERY_DESC':
                    return new Date(b.dateLivraisonPrevue).getTime() - new Date(a.dateLivraisonPrevue).getTime();
                case 'ORDER_DESC':
                    return new Date(b.dateCommande).getTime() - new Date(a.dateCommande).getTime();
                case 'ORDER_ASC':
                    return new Date(a.dateCommande).getTime() - new Date(b.dateCommande).getTime();
                case 'STATUS':
                    return a.statut.localeCompare(b.statut);
                default:
                    return 0;
            }
        });
    }, [commandes, searchTerm, showArchived, filterStatus, filterTailor, filterClient, filterDateStart, filterDateEnd, filterDeliveryDateStart, filterDeliveryDateEnd, sortOption]);

    const activeFiltersCount = (filterStatus !== 'ALL' ? 1 : 0) + (filterTailor !== 'ALL' ? 1 : 0) + (filterClient !== 'ALL' ? 1 : 0) + (filterDateStart ? 1 : 0) + (filterDeliveryDateStart ? 1 : 0);

    // FINANCE CALCS
    const montantApresRemise = Math.max(0, prixBase - remise);
    const montantTva = applyTva ? Math.round(montantApresRemise * COMPANY_CONFIG.tvaRate) : 0;
    const montantTotalTTC = montantApresRemise + montantTva;
    const montantReste = Math.max(0, montantTotalTTC - avance);

    // HANDLERS
    const resetFilters = () => {
        setFilterStatus('ALL'); 
        setFilterTailor('ALL'); 
        setFilterClient('ALL'); 
        setFilterDateStart(''); 
        setFilterDateEnd('');
        setFilterDeliveryDateStart('');
        setFilterDeliveryDateEnd('');
        setSortOption('DELIVERY_ASC');
    };

    const toggleArchives = () => {
        const nextState = !showArchived;
        setShowArchived(nextState);
        setFilterStatus('ALL'); // Reset status filter to show everything in archives
    };

    const setQuickDateFilter = (type: 'TODAY' | 'WEEK' | 'MONTH', field: 'ORDER' | 'DELIVERY') => {
        const now = new Date();
        const start = new Date();
        if (type === 'WEEK') start.setDate(now.getDate() - 7);
        if (type === 'MONTH') start.setMonth(now.getMonth() - 1);
        
        const endStr = now.toISOString().split('T')[0];
        const startStr = start.toISOString().split('T')[0];

        if (field === 'ORDER') {
            setFilterDateEnd(endStr);
            setFilterDateStart(startStr);
        } else {
            setFilterDeliveryDateEnd(endStr);
            setFilterDeliveryDateStart(startStr);
        }
    };

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
        setShowMeasurements(false);
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
        setShowMeasurements(false);
        
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
            const originalOrder = commandes.find(c => c.id === selectedOrderId);
            if (originalOrder) {
                const oldAvance = originalOrder.avance;
                const newAvance = orderData.avance;
                if (newAvance !== oldAvance && !initialAccountId) {
                    alert(`⚠️ MODIFICATION FINANCIÈRE DÉTECTÉE\n\nLe montant versé a changé. Veuillez sélectionner un compte de trésorerie.`);
                    return; 
                }
            }
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

    const handleScan = (decodedText: string) => {
        setSearchTerm(decodedText);
        setIsScannerOpen(false);
    };

    // ... (Print functions unchanged) ...
    const generatePrintContent = (orderData: Partial<Commande>, mode: 'TICKET' | 'DEVIS' | 'LIVRAISON' = 'TICKET') => {
        // ... (Existing implementation) ...
        const printWindow = window.open('', '', 'width=450,height=650');
        if (!printWindow) return;

        const dateStr = orderData.dateCommande ? new Date(orderData.dateCommande).toLocaleDateString() : new Date().toLocaleDateString();
        let docTitle = "TICKET DE COMMANDE";
        if (mode === 'DEVIS') docTitle = "DEVIS ESTIMATIF";
        if (mode === 'LIVRAISON') docTitle = "BON DE LIVRAISON";
        
        // CALCULS FINANCIERS
        const totalTTC = orderData.prixTotal || 0;
        const tva = orderData.tva || 0;
        const remise = orderData.remise || 0;
        const avanceRecue = orderData.avance || 0;
        const resteAPayer = Math.max(0, totalTTC - avanceRecue);
        
        // Reconstitution HT
        // Total TTC = (HT - Remise) + TVA
        // Donc HT = Total TTC - TVA + Remise
        const totalHT = totalTTC - tva + remise;
        
        const isPaid = resteAPayer <= 0;
        const stampText = isPaid ? "PAYÉ" : "NON SOLDÉ";
        const stampColor = isPaid ? "#16a34a" : "#dc2626"; 
        const showStamp = mode !== 'DEVIS'; 

        const html = `
            <html>
            <head>
                <title>${docTitle}</title>
                <style>
                    body { font-family: monospace; padding: 20px; font-size: 12px; position: relative; }
                    .header { text-align: center; margin-bottom: 20px; }
                    .logo { text-align: center; margin-bottom: 10px; }
                    .logo img { max-width: 120px; height: auto; }
                    .info { margin-bottom: 15px; border-bottom: 1px dashed black; padding-bottom: 10px; }
                    .total { border-top: 1px dashed black; margin-top: 10px; padding-top: 5px; }
                    .footer { text-align:center; margin-top: 20px; font-size: 10px; }
                    .item { display: flex; justify-content: space-between; margin-bottom: 5px; }
                    .row { display: flex; justify-content: space-between; margin-bottom: 3px; }
                    .bold { font-weight: bold; }
                    .stamp {
                        position: absolute; top: 40%; left: 50%; transform: translate(-50%, -50%) rotate(-15deg);
                        font-size: 32px; font-weight: bold; color: ${stampColor}; border: 3px solid ${stampColor};
                        padding: 10px 30px; border-radius: 8px; opacity: 0.3; z-index: 0; pointer-events: none;
                        text-transform: uppercase; font-family: sans-serif;
                    }
                    .signatures { display: flex; justify-content: space-between; margin-top: 30px; margin-bottom: 10px; align-items: flex-start; }
                    .sign-box { width: 45%; text-align: center; }
                    .sign-title { font-weight: bold; text-decoration: underline; margin-bottom: 30px; display: block; }
                    .stamp-container { position: relative; height: 60px; margin-top: -20px; }
                    .stamp-img { position: absolute; top: 0; left: 50%; transform: translateX(-50%) rotate(-10deg); width: 80px; opacity: 0.7; }
                    .sig-img { position: absolute; top: 10px; left: 50%; transform: translateX(-50%); width: 60px; z-index: 2; }
                    .content { position: relative; z-index: 1; }
                </style>
            </head>
            <body>
                <div class="content">
                    <div class="header">
                        <div class="logo"><img src="${COMPANY_CONFIG.logoUrl}" alt="${COMPANY_CONFIG.name}" onerror="this.style.display='none'" /></div>
                        <h3>${COMPANY_CONFIG.name}</h3>
                        <p>${COMPANY_CONFIG.address}<br/>${COMPANY_CONFIG.phone}</p>
                        <p><strong>${docTitle}</strong></p>
                    </div>
                    <div class="info">
                        <p>Ref: #${orderData.id ? orderData.id.slice(-6) : 'N/A'}<br/>Date: ${dateStr}</p>
                        <p>Client: <strong>${orderData.clientNom || 'Client'}</strong></p>
                        <p>Livraison prévue: ${orderData.dateLivraisonPrevue ? new Date(orderData.dateLivraisonPrevue).toLocaleDateString() : 'N/A'}</p>
                    </div>
                    <div class="items">
                        <div class="item"><span>${orderData.description || 'Confection sur mesure'}</span></div>
                        ${orderData.quantite && orderData.quantite > 1 ? `<div class="item"><span>Quantité</span><span>x${orderData.quantite}</span></div>` : ''}
                    </div>
                    
                    <div class="total">
                        <div class="row">
                            <span>Sous-total HT</span>
                            <span>${totalHT.toLocaleString()}</span>
                        </div>
                        ${remise > 0 ? `
                        <div class="row">
                            <span>Remise</span>
                            <span>-${remise.toLocaleString()}</span>
                        </div>` : ''}
                        ${tva > 0 ? `
                        <div class="row">
                            <span>TVA (${orderData.tvaRate || 18}%)</span>
                            <span>${tva.toLocaleString()}</span>
                        </div>` : ''}
                        
                        <div class="row bold" style="font-size: 14px; margin-top: 5px; border-top: 1px solid #ddd; padding-top: 5px;">
                            <span>TOTAL TTC</span>
                            <span>${totalTTC.toLocaleString()} ${COMPANY_CONFIG.currency}</span>
                        </div>

                        ${mode !== 'DEVIS' ? `
                        <div class="row" style="margin-top: 10px;">
                            <span>Avance Reçue</span>
                            <span>${avanceRecue.toLocaleString()}</span>
                        </div>
                        <div class="row bold">
                            <span>Reste à Payer</span>
                            <span>${resteAPayer.toLocaleString()}</span>
                        </div>
                        ` : ''}
                    </div>

                    <!-- SIGNATURES SECTION -->
                    <div class="signatures">
                        <div class="sign-box">
                            <span class="sign-title">Client</span>
                        </div>
                        <div class="sign-box">
                            <span class="sign-title">Direction</span>
                            <div class="stamp-container">
                                <img src="${COMPANY_CONFIG.stampUrl}" class="stamp-img" onerror="this.style.display='none'" />
                                <img src="${COMPANY_CONFIG.signatureUrl}" class="sig-img" onerror="this.style.display='none'" />
                            </div>
                        </div>
                    </div>

                    <div class="footer"><p>Merci de votre confiance !</p></div>
                </div>
                ${showStamp ? `<div class="stamp">${stampText}</div>` : ''}
                <script>window.print(); setTimeout(() => window.close(), 1000);</script>
            </body>
            </html>
        `;
        printWindow.document.write(html);
        printWindow.document.close();
    };

    const handlePrintInvoice = (cmd: Commande) => { generatePrintContent(cmd, 'TICKET'); };

    const handleWhatsAppNotification = (cmd: Commande) => {
        const phone = clients.find(c => c.id === cmd.clientId)?.telephone || '';
        if (phone) {
            const msg = `Bonjour ${cmd.clientNom}, votre commande "${cmd.description}" est au statut : ${cmd.statut}.`;
            window.open(`https://wa.me/${phone.replace(/\s+/g, '').replace('+', '')}?text=${encodeURIComponent(msg)}`, '_blank');
        } else {
            alert("Pas de numéro de téléphone pour ce client.");
        }
    };

    const handlePrintQuote = () => {
        if (!selectedClientId || !description) {
            alert("Veuillez au moins sélectionner un client et une description pour le devis.");
            return;
        }
        const client = clients.find(c => c.id === selectedClientId);
        const dummyOrder: Partial<Commande> = {
            id: 'DEVIS-' + new Date().toLocaleTimeString().replace(/:/g,''),
            clientNom: client?.nom || 'Client Inconnu',
            description: description,
            notes: notes,
            quantite: quantite,
            dateCommande: new Date().toISOString(),
            dateLivraisonPrevue: dateLivraison || new Date().toISOString(),
            prixTotal: montantTotalTTC,
            tva: montantTva,
            tvaRate: applyTva ? (COMPANY_CONFIG.tvaRate * 100) : 0,
            remise: remise,
            avance: 0,
            reste: montantTotalTTC
        };
        generatePrintContent(dummyOrder, 'DEVIS');
    };

    const openPaymentModal = (cmd: Commande) => {
        setSelectedOrderForPayment(cmd);
        setPaymentAmount(cmd.reste);
        setPaymentAccountId('');
        setPaymentModalOpen(true);
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

    const submitPayment = () => {
        if (!selectedOrderForPayment || paymentAmount <= 0) return;
        if (!paymentAccountId) { alert("Veuillez sélectionner un compte de destination (Caisse/Banque)."); return; }
        onAddPayment(selectedOrderForPayment.id, paymentAmount, paymentMethod, paymentNote, paymentDate || new Date().toISOString(), paymentAccountId);
        setPaymentModalOpen(false);
        setSelectedOrderForPayment(null);
    };

    const selectedArticleObj = articles.find(a => a.id === tempConso.articleId);

    const getDeadlineInfo = (cmd: Commande) => {
        if (cmd.statut === StatutCommande.LIVRE || cmd.statut === StatutCommande.ANNULE) { return { status: 'DONE', days: 0 }; }
        const today = new Date(); today.setHours(0, 0, 0, 0); 
        const deadline = new Date(cmd.dateLivraisonPrevue); deadline.setHours(0, 0, 0, 0);
        const diffTime = deadline.getTime() - today.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        if (diffDays < 0) return { status: 'LATE', days: Math.abs(diffDays) };
        if (diffDays <= 3) return { status: 'URGENT', days: diffDays }; 
        return { status: 'NORMAL', days: diffDays };
    };

    const tvaPercent = Math.round(COMPANY_CONFIG.tvaRate * 100);

    // --- PERFORMANCE METRICS LOGIC ---
    const performanceData = useMemo(() => {
        return tailleurs.map(tailleur => {
            const tailorOrders = commandes.filter(c => c.tailleursIds.includes(tailleur.id) && !c.archived);
            const activeOrders = tailorOrders.filter(c => c.statut !== StatutCommande.LIVRE && c.statut !== StatutCommande.ANNULE && c.statut !== StatutCommande.PRET);
            const completedOrders = tailorOrders.filter(c => c.statut === StatutCommande.LIVRE || c.statut === StatutCommande.PRET);
            const lateOrders = activeOrders.filter(c => {
                const deadline = new Date(c.dateLivraisonPrevue);
                const today = new Date();
                return deadline < today;
            });
            const score = Math.max(0, (completedOrders.length * 10) - (lateOrders.length * 5) + (activeOrders.length * 2));

            return {
                id: tailleur.id,
                name: tailleur.nom,
                role: tailleur.role,
                totalAssigned: tailorOrders.length,
                activeCount: activeOrders.length,
                completedCount: completedOrders.length,
                lateCount: lateOrders.length,
                score: score
            };
        }).sort((a,b) => b.score - a.score);
    }, [commandes, tailleurs]);

    return (
        <div className="space-y-4">
            {/* HEADER & VIEW SWITCHER */}
            {/* ... */}
            {/* ... (Previous content kept, just modal content updated) ... */}
            
            {/* ... (Start of Main Content) ... */}
            <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4">
                <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                    <Scissors className="text-brand-600" />
                    Atelier de Production
                </h2>
                <div className="flex flex-col sm:flex-row gap-3 w-full xl:w-auto items-center">
                    <div className="flex gap-2 self-start">
                        {viewMode === 'ORDERS' && (
                            <div className="flex bg-gray-100 p-1 rounded-lg shrink-0">
                                <button onClick={() => setOrderDisplayMode('GRID')} className={`p-1.5 rounded-md transition-all ${orderDisplayMode === 'GRID' ? 'bg-white shadow text-brand-600' : 'text-gray-500 hover:text-gray-700'}`} title="Vue Grille"><LayoutGrid size={16} /></button>
                                <button onClick={() => setOrderDisplayMode('LIST')} className={`p-1.5 rounded-md transition-all ${orderDisplayMode === 'LIST' ? 'bg-white shadow text-brand-600' : 'text-gray-500 hover:text-gray-700'}`} title="Vue Liste"><List size={16} /></button>
                            </div>
                        )}
                        <div className="bg-gray-100 p-1 rounded-lg flex overflow-x-auto max-w-full">
                            <button onClick={() => setViewMode('ORDERS')} className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all flex items-center gap-2 whitespace-nowrap ${viewMode === 'ORDERS' ? 'bg-white text-brand-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}><LayoutList size={14} /> <span className="hidden sm:inline">Commandes</span></button>
                            <button onClick={() => setViewMode('TAILORS')} className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all flex items-center gap-2 whitespace-nowrap ${viewMode === 'TAILORS' ? 'bg-white text-brand-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}><Users size={14} /> <span className="hidden sm:inline">Tailleurs</span></button>
                            {!isProductionStaff && (
                                <button onClick={() => setViewMode('PERFORMANCE')} className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all flex items-center gap-2 whitespace-nowrap ${viewMode === 'PERFORMANCE' ? 'bg-white text-brand-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}><BarChart2 size={14} /> <span className="hidden sm:inline">Performance</span></button>
                            )}
                        </div>
                    </div>
                    <button onClick={toggleArchives} className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all flex items-center gap-2 border ${showArchived ? 'bg-gray-800 text-white border-gray-800' : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'}`}><Archive size={14} /> {showArchived ? 'Voir Actifs' : 'Archives'}</button>
                    <div className="relative flex-1 min-w-[180px]">
                        <input type="text" placeholder="Rechercher..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-8 pr-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-500 focus:border-transparent" />
                        <Search className="absolute left-2.5 top-2 text-gray-400" size={14} />
                    </div>
                    <button onClick={() => setIsScannerOpen(true)} className="p-1.5 bg-gray-800 text-white rounded-lg hover:bg-gray-900 transition-colors shadow-sm" title="Scanner Bon de Commande"><Camera size={18} /></button>

                    {viewMode === 'ORDERS' && !showArchived && (
                        <button onClick={() => setShowFiltersPanel(!showFiltersPanel)} className={`px-3 py-1.5 rounded-lg border flex items-center gap-2 transition-colors text-sm font-medium ${showFiltersPanel || activeFiltersCount > 0 ? 'bg-brand-50 border-brand-300 text-brand-700' : 'bg-white border-gray-300 text-gray-600 hover:bg-gray-50'}`}><Filter size={16} /><span className="hidden sm:inline">Filtres</span>{activeFiltersCount > 0 && (<span className="bg-brand-600 text-white text-[10px] w-5 h-5 flex items-center justify-center rounded-full">{activeFiltersCount}</span>)}</button>
                    )}
                    {!showArchived && (
                        <button onClick={handleOpenCreateModal} className="bg-brand-600 hover:bg-brand-700 text-white px-4 py-1.5 rounded-lg flex items-center gap-2 font-medium transition-colors shadow-sm whitespace-nowrap text-sm"><Plus size={18} /> <span className="hidden sm:inline">Nouvelle Commande</span></button>
                    )}
                </div>
            </div>

            {/* FILTERS PANEL */}
            {viewMode === 'ORDERS' && showFiltersPanel && (
                <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm animate-in slide-in-from-top-2">
                    {/* ... (Previous filters content) ... */}
                    <div className="flex justify-between items-center mb-3">
                        <h4 className="text-sm font-bold text-gray-700 flex items-center gap-2"><Filter size={16} className="text-brand-600" /> Filtres Avancés</h4>
                        <button onClick={resetFilters} className="text-xs text-red-500 hover:text-red-700 flex items-center gap-1"><X size={12} /> Réinitialiser</button>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
                        <div><label className="block text-xs font-medium text-gray-500 mb-1">Statut</label><select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="w-full p-2 border border-gray-300 rounded text-sm"><option value="ALL">Tous les statuts</option><option value="EN_COURS">En cours de production</option>{Object.values(StatutCommande).map(s => <option key={s} value={s}>{s}</option>)}</select></div>
                        <div><label className="block text-xs font-medium text-gray-500 mb-1">Tailleur / Responsable</label><select value={filterTailor} onChange={(e) => setFilterTailor(e.target.value)} className="w-full p-2 border border-gray-300 rounded text-sm"><option value="ALL">Tous les tailleurs</option><option value="UNASSIGNED">Non assigné</option>{tailleurs.map(t => <option key={t.id} value={t.id}>{t.nom}</option>)}</select></div>
                        <div><label className="block text-xs font-medium text-gray-500 mb-1">Client</label><select value={filterClient} onChange={(e) => setFilterClient(e.target.value)} className="w-full p-2 border border-gray-300 rounded text-sm"><option value="ALL">Tous les clients</option>{clients.sort((a,b) => a.nom.localeCompare(b.nom)).map(c => (<option key={c.id} value={c.id}>{c.nom}</option>))}</select></div>
                        <div>
                            <div className="flex justify-between items-center mb-1">
                                <label className="block text-xs font-medium text-gray-500">Date Commande</label>
                                <div className="flex gap-1"><button onClick={() => setQuickDateFilter('TODAY', 'ORDER')} className="text-[10px] bg-gray-100 hover:bg-gray-200 px-1.5 rounded">Auj.</button><button onClick={() => setQuickDateFilter('WEEK', 'ORDER')} className="text-[10px] bg-gray-100 hover:bg-gray-200 px-1.5 rounded">7 Jours</button><button onClick={() => setQuickDateFilter('MONTH', 'ORDER')} className="text-[10px] bg-gray-100 hover:bg-gray-200 px-1.5 rounded">Ce Mois</button></div>
                            </div>
                            <div className="flex gap-2">
                                <input type="date" value={filterDateStart} onChange={(e) => setFilterDateStart(e.target.value)} className="w-1/2 p-2 border border-gray-300 rounded text-xs" />
                                <input type="date" value={filterDateEnd} onChange={(e) => setFilterDateEnd(e.target.value)} className="w-1/2 p-2 border border-gray-300 rounded text-xs" />
                            </div>
                        </div>
                        <div>
                            <div className="flex justify-between items-center mb-1">
                                <label className="block text-xs font-medium text-gray-500">Date Livraison Prévue</label>
                                <div className="flex gap-1"><button onClick={() => setQuickDateFilter('TODAY', 'DELIVERY')} className="text-[10px] bg-gray-100 hover:bg-gray-200 px-1.5 rounded">Auj.</button><button onClick={() => setQuickDateFilter('WEEK', 'DELIVERY')} className="text-[10px] bg-gray-100 hover:bg-gray-200 px-1.5 rounded">7 Jours</button><button onClick={() => setQuickDateFilter('MONTH', 'DELIVERY')} className="text-[10px] bg-gray-100 hover:bg-gray-200 px-1.5 rounded">Ce Mois</button></div>
                            </div>
                            <div className="flex gap-2">
                                <input type="date" value={filterDeliveryDateStart} onChange={(e) => setFilterDeliveryDateStart(e.target.value)} className="w-1/2 p-2 border border-gray-300 rounded text-xs" />
                                <input type="date" value={filterDeliveryDateEnd} onChange={(e) => setFilterDeliveryDateEnd(e.target.value)} className="w-1/2 p-2 border border-gray-300 rounded text-xs" />
                            </div>
                        </div>
                        {/* New Sort Filter */}
                        <div>
                            <label className="block text-xs font-medium text-gray-500 mb-1 flex items-center gap-1"><ArrowUpDown size={12}/> Trier par</label>
                            <select value={sortOption} onChange={(e) => setSortOption(e.target.value as any)} className="w-full p-2 border border-gray-300 rounded text-sm bg-gray-50">
                                <option value="DELIVERY_ASC">Livraison (Proche → Lointain)</option>
                                <option value="DELIVERY_DESC">Livraison (Lointain → Proche)</option>
                                <option value="ORDER_DESC">Date Commande (Récent → Ancien)</option>
                                <option value="ORDER_ASC">Date Commande (Ancien → Récent)</option>
                                <option value="STATUS">Statut (A-Z)</option>
                            </select>
                        </div>
                    </div>
                </div>
            )}
            
            {/* ... (Performance & Lists unchanged) ... */}
            {viewMode === 'PERFORMANCE' && (
                <div className="space-y-6 animate-in fade-in duration-300">
                    {/* ... (Performance UI hidden for brevity) ... */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-end">
                        {performanceData.slice(0,3).map((p, idx) => (
                            <div key={p.id} className={`bg-white rounded-xl shadow-sm border p-4 flex flex-col items-center relative ${idx === 0 ? 'order-2 border-yellow-200 bg-yellow-50/30 transform -translate-y-4' : idx === 1 ? 'order-1 border-gray-200' : 'order-3 border-orange-100'}`}>
                                <div className={`w-16 h-16 rounded-full flex items-center justify-center font-bold text-xl mb-3 shadow-md ${idx === 0 ? 'bg-yellow-100 text-yellow-700' : idx === 1 ? 'bg-gray-100 text-gray-600' : 'bg-orange-100 text-orange-700'}`}>{p.name.charAt(0)}<div className="absolute -top-2 -right-2 bg-white rounded-full p-1 shadow-sm"><Trophy size={16} className={idx === 0 ? 'text-yellow-500' : idx === 1 ? 'text-gray-400' : 'text-orange-400'} /></div></div>
                                <h3 className="font-bold text-gray-800 text-center">{p.name}</h3>
                                <p className="text-xs text-gray-500">{p.completedCount} commandes terminées</p>
                                <div className="mt-3 flex items-center gap-1 bg-white px-3 py-1 rounded-full text-xs font-bold shadow-sm border border-gray-100"><Activity size={12} className="text-brand-500"/> Score: {p.score}</div>
                            </div>
                        ))}
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {performanceData.map(p => (
                            <div key={p.id} className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
                                <div className="flex justify-between items-start mb-4"><div className="flex items-center gap-3"><div className="w-10 h-10 rounded-full bg-brand-50 text-brand-700 flex items-center justify-center font-bold">{p.name.charAt(0)}</div><div><h4 className="font-bold text-gray-800">{p.name}</h4><span className="text-xs text-gray-500">{p.role}</span></div></div><div className={`px-2 py-1 rounded text-xs font-bold ${p.lateCount > 0 ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-600'}`}>{p.lateCount > 0 ? `${p.lateCount} Retard(s)` : 'À l\'heure'}</div></div>
                                <div className="grid grid-cols-3 gap-2 mb-4 text-center"><div className="bg-gray-50 rounded p-2"><p className="text-xs text-gray-500 mb-1">En Cours</p><p className="font-bold text-gray-800 text-lg">{p.activeCount}</p></div><div className="bg-green-50 rounded p-2"><p className="text-xs text-green-600 mb-1">Terminées</p><p className="font-bold text-green-700 text-lg">{p.completedCount}</p></div><div className="bg-blue-50 rounded p-2"><p className="text-xs text-blue-600 mb-1">Total</p><p className="font-bold text-blue-700 text-lg">{p.totalAssigned}</p></div></div>
                                <div className="space-y-2"><div className="flex justify-between text-xs text-gray-500"><span>Efficacité Globale</span><span>{p.totalAssigned > 0 ? Math.round((p.completedCount / p.totalAssigned) * 100) : 0}%</span></div><div className="w-full bg-gray-100 rounded-full h-1.5"><div className="bg-brand-500 h-1.5 rounded-full transition-all duration-500" style={{ width: `${p.totalAssigned > 0 ? (p.completedCount / p.totalAssigned) * 100 : 0}%` }}></div></div>{p.activeCount > 3 && (<p className="text-xs text-orange-500 flex items-center gap-1 mt-2"><AlertTriangle size={12}/> Charge de travail élevée</p>)}</div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* MAIN CONTENT (GRID/LIST) */}
            {viewMode === 'ORDERS' ? (
                orderDisplayMode === 'GRID' ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {filteredCommandes.map(cmd => {
                            const deadlineInfo = getDeadlineInfo(cmd);
                            const isLateState = deadlineInfo.status === 'LATE' && !showArchived;
                            const isUrgent = deadlineInfo.status === 'URGENT' && !showArchived;
                            const isCancelled = cmd.statut === StatutCommande.ANNULE;
                            const isDelivered = cmd.statut === StatutCommande.LIVRE;
                            
                            // Logique de fin de commande : Livrée ET Payée
                            const isPaid = cmd.reste <= 0;
                            const isTerminated = isDelivered && isPaid;
                            
                            return (
                                <div key={cmd.id} className={`bg-white rounded-xl shadow-sm border p-5 hover:shadow-md transition-shadow relative group ${isLateState ? 'border-red-200' : isUrgent ? 'border-orange-300 bg-orange-50/10' : 'border-gray-100'} ${isCancelled ? 'opacity-75 border-red-100' : ''}`}>
                                    
                                    {/* FILIGRANE COMMANDE TERMINEE */}
                                    {isTerminated && (
                                        <div className="absolute inset-0 flex items-center justify-center z-0 pointer-events-none overflow-hidden">
                                            <div className="border-4 border-green-600/20 text-green-600/20 font-black text-2xl sm:text-3xl -rotate-12 px-6 py-4 rounded-xl uppercase tracking-widest whitespace-nowrap">
                                                COMMANDE TERMINÉE
                                            </div>
                                        </div>
                                    )}

                                    <div className={`absolute top-0 left-0 w-1 h-full ${cmd.statut === StatutCommande.LIVRE ? 'bg-gray-300' : cmd.statut === StatutCommande.PRET ? 'bg-green-500' : cmd.statut === StatutCommande.ANNULE ? 'bg-red-400' : isLateState ? 'bg-red-500' : isUrgent ? 'bg-orange-500' : cmd.statut === StatutCommande.EN_ATTENTE ? 'bg-gray-400' : 'bg-brand-500'}`}></div>
                                    
                                    {/* BADGES À GAUCHE */}
                                    {isLateState && <div className="absolute top-2 left-4 text-red-500 flex items-center gap-1 text-[10px] font-bold bg-red-50 px-2 py-0.5 rounded-full border border-red-100 animate-pulse z-10"><Clock size={12} /> RETARD J+{deadlineInfo.days}</div>}
                                    {isUrgent && !isLateState && <div className="absolute top-2 left-4 text-orange-600 flex items-center gap-1 text-[10px] font-bold bg-orange-50 px-2 py-0.5 rounded-full border border-orange-100 z-10"><AlertCircle size={12} /> URGENT J-{deadlineInfo.days}</div>}
                                    
                                    {/* Action Buttons - POSITION FIXE HAUT DROITE */}
                                    <div className="absolute top-2 right-2 flex gap-1 z-[500]">
                                        <button 
                                            type="button"
                                            onClick={() => openQRModal(cmd)} 
                                            className="p-1.5 bg-white border border-gray-200 text-gray-500 hover:text-brand-600 rounded shadow-sm hover:bg-gray-50 cursor-pointer" 
                                            title="Code QR"
                                        >
                                            <QrCode size={14} />
                                        </button>
                                        
                                        {/* BOUTON ARCHIVER RETIRÉ ICI COMME DEMANDÉ */}

                                        {onUpdateOrder && !isCancelled && cmd.statut !== StatutCommande.LIVRE && !showArchived && (
                                            <button 
                                                type="button"
                                                onClick={() => handleOpenEditModal(cmd)} 
                                                className="p-1.5 bg-white border border-gray-200 text-gray-500 hover:text-brand-600 rounded shadow-sm hover:bg-gray-50 cursor-pointer" 
                                                title="Modifier"
                                            >
                                                <Edit2 size={14} />
                                            </button>
                                        )}
                                    </div>

                                    {/* Content - Margin top added to avoid overlap with badges */}
                                    <div className="mt-6 flex justify-between items-start mb-4 pl-3 relative z-10">
                                        <div>
                                            <span className="font-bold text-lg text-gray-800 block">{cmd.clientNom}</span>
                                            <span className="text-xs text-gray-400">#{cmd.id.slice(-6)}</span>
                                        </div>
                                        <span className={`px-2 py-1 rounded-full text-xs font-semibold ${getStatusColor(cmd.statut)}`}>{cmd.statut}</span>
                                    </div>
                                    <div className="flex items-start gap-3 mb-4 pl-3 relative z-10"><div className="p-2 bg-brand-50 rounded-lg shrink-0"><Shirt className="text-brand-600" size={20} /></div><div className="flex-1 min-w-0"><h3 className="text-sm font-medium text-gray-900 line-clamp-2">{cmd.quantite && cmd.quantite > 1 && (<span className="inline-flex items-center justify-center bg-gray-900 text-white text-[10px] font-bold h-5 min-w-[1.25rem] px-1 rounded-full mr-2">{cmd.quantite}x</span>)}{cmd.description}</h3><p className={`text-xs flex items-center gap-1 mt-1 ${isLateState ? 'text-red-600 font-bold' : isUrgent ? 'text-orange-600 font-medium' : 'text-gray-500'}`}><Calendar size={12}/> Livraison: {new Date(cmd.dateLivraisonPrevue).toLocaleDateString()}</p></div></div>
                                    {cmd.notes && (<div className="mb-4 pl-3 relative z-10"><div className="bg-yellow-50 p-2 rounded border border-yellow-100 flex items-start gap-2"><MessageSquare size={12} className="text-yellow-600 mt-0.5 shrink-0" /><p className="text-xs text-yellow-800 italic line-clamp-2">{cmd.notes}</p></div></div>)}
                                    <div className="space-y-3 border-t border-gray-100 pt-3 pl-3 relative z-10">
                                        <div><p className="text-xs font-semibold text-gray-500 uppercase mb-1">Responsables</p><div className="flex flex-wrap gap-2">{cmd.tailleursIds.map(tid => { const t = employes.find(e => e.id === tid); return t ? (<span key={tid} className="bg-gray-100 text-gray-700 text-[10px] px-2 py-0.5 rounded border border-gray-200">{t.nom}</span>) : null; })}{cmd.tailleursIds.length === 0 && <span className="text-[10px] text-red-400 italic bg-red-50 px-2 py-0.5 rounded">Non assigné</span>}</div></div>
                                        {canSeeFinance ? (
                                            <div className="flex justify-between items-center text-sm bg-gray-50 p-2 rounded"><span className="text-gray-500 flex items-center gap-1">{cmd.reste > 0 && <AlertTriangle size={12} className="text-orange-500" />}Reste à payer</span><div className="flex items-center gap-2"><span className={`font-bold ${cmd.reste > 0 ? 'text-red-600' : 'text-green-600'}`}>{cmd.reste.toLocaleString()} F</span><button onClick={() => setViewPaymentHistoryOrderId(cmd.id)} className="p-1 hover:bg-gray-200 rounded text-gray-500" title="Historique Paiements"><History size={14}/></button></div></div>
                                        ) : (<div className="flex items-center justify-center text-xs text-gray-400 bg-gray-50 p-1.5 rounded gap-1"><EyeOff size={12} /> Données financières masquées</div>)}
                                    </div>
                                    <div className="mt-4 pt-3 border-t border-gray-100 flex flex-wrap gap-2 pl-3 items-center relative z-50">
                                        {!showArchived && cmd.statut !== StatutCommande.LIVRE && !isCancelled && (<div className="flex-1 min-w-[120px]"><select className="block w-full text-xs border-gray-300 rounded shadow-sm focus:border-brand-500 focus:ring focus:ring-brand-200 p-1.5" value={cmd.statut} onChange={(e) => onUpdateStatus(cmd.id, e.target.value as StatutCommande)}>{Object.values(StatutCommande).filter(s => { if (!canDeliverOrCancel) { return s !== StatutCommande.LIVRE && s !== StatutCommande.ANNULE; } return true; }).map(s => (<option key={s} value={s}>{s}</option>))}</select></div>)}
                                        
                                        {!showArchived && !isCancelled && (
                                            <>
                                                {canSeeFinance && (<button onClick={() => handlePrintInvoice(cmd)} className="p-1.5 bg-gray-100 text-gray-600 hover:bg-gray-200 rounded transition-colors" title="Imprimer Facture"><Printer size={16} /></button>)}
                                                {canSeeFinance && (<button onClick={() => handleWhatsAppNotification(cmd)} className="p-1.5 bg-green-50 text-green-600 hover:bg-green-100 rounded transition-colors" title="Notifier par WhatsApp"><MessageCircle size={16} /></button>)}
                                                {canSeeFinance && cmd.reste > 0 && (<button onClick={() => openPaymentModal(cmd)} className="bg-brand-100 text-brand-800 px-3 py-1.5 rounded text-xs font-bold flex items-center gap-1 hover:bg-brand-200 transition-colors" title="Encaisser un paiement"><Wallet size={14} /> ENCAISSER</button>)}
                                            </>
                                        )}
                                        
                                        {isCancelled && !showArchived && (<div className="flex-1 text-center text-red-600 bg-red-50 rounded border border-red-100 text-xs font-bold py-1.5 flex items-center justify-center gap-2"><Ban size={14} /> Commande Annulée</div>)}
                                        {showArchived && (<div className="w-full text-center text-gray-400 text-xs italic py-1">Archivé le {new Date().toLocaleDateString()}</div>)}
                                    </div>
                                </div>
                            );
                        })}
                        {filteredCommandes.length === 0 && (<div className="col-span-full text-center py-12 bg-white rounded-lg border border-dashed border-gray-300"><Scissors className="mx-auto h-12 w-12 text-gray-300" /><h3 className="mt-2 text-sm font-medium text-gray-900">Aucune commande trouvée</h3><p className="mt-1 text-sm text-gray-500">{showArchived ? "Les archives sont vides." : "Essayez de modifier vos filtres."}</p></div>)}
                    </div>
                ) : (
                    // LIST VIEW
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm text-left">
                                <thead className="bg-gray-50 text-gray-600 font-medium border-b border-gray-200 sticky top-0 z-10">
                                    <tr><th className="py-3 px-4 w-32">Référence</th><th className="py-3 px-4">Client</th><th className="py-3 px-4 w-1/4">Description</th><th className="py-3 px-4">Tailleurs</th><th className="py-3 px-4">Livraison</th><th className="py-3 px-4">Statut</th>{canSeeFinance && <th className="py-3 px-4 text-right">Reste Dû</th>}<th className="py-3 px-4 text-center">Actions</th></tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {filteredCommandes.map(cmd => {
                                        const deadlineInfo = getDeadlineInfo(cmd);
                                        const isLate = deadlineInfo.status === 'LATE';
                                        const isUrgent = deadlineInfo.status === 'URGENT';
                                        const isCancelled = cmd.statut === StatutCommande.ANNULE;
                                        const isDelivered = cmd.statut === StatutCommande.LIVRE;
                                        const isPaid = cmd.reste <= 0;
                                        const isTerminated = isDelivered && isPaid;

                                        return (
                                            <tr key={cmd.id} className={`hover:bg-gray-50 transition-colors ${isCancelled ? 'opacity-60 bg-gray-50' : ''}`}>
                                                <td className="py-3 px-4"><span className="font-mono text-xs text-gray-500 block">{cmd.id.slice(-6)}</span><span className="text-xs text-gray-400">{new Date(cmd.dateCommande).toLocaleDateString()}</span></td>
                                                <td className="py-3 px-4 font-bold text-gray-800">{cmd.clientNom}</td>
                                                <td className="py-3 px-4"><div className="flex items-center gap-2">{cmd.quantite && cmd.quantite > 1 && (<span className="bg-gray-900 text-white text-[10px] font-bold px-1.5 rounded-full">{cmd.quantite}x</span>)}<span className="truncate max-w-xs block" title={cmd.description}>{cmd.description}</span></div>{cmd.notes && <p className="text-xs text-gray-400 italic truncate max-w-xs">{cmd.notes}</p>}</td>
                                                <td className="py-3 px-4"><div className="flex flex-wrap gap-1">{cmd.tailleursIds.length > 0 ? cmd.tailleursIds.map(tid => { const t = employes.find(e => e.id === tid); return t ? <span key={tid} className="text-[10px] bg-gray-100 px-2 py-0.5 rounded border border-gray-200 text-gray-600">{t.nom.split(' ')[0]}</span> : null; }) : <span className="text-xs text-gray-400 italic">--</span>}</div></td>
                                                <td className="py-3 px-4"><div className="flex flex-col"><span>{new Date(cmd.dateLivraisonPrevue).toLocaleDateString()}</span>{!showArchived && !isCancelled && cmd.statut !== StatutCommande.LIVRE && (<>{isLate && <span className="text-[10px] text-red-600 font-bold bg-red-50 px-1 rounded w-fit">RETARD J+{deadlineInfo.days}</span>}{isUrgent && !isLate && <span className="text-[10px] text-orange-600 font-bold bg-orange-50 px-1 rounded w-fit">J-{deadlineInfo.days}</span>}</>)}</div></td>
                                                <td className="py-3 px-4">
                                                    {!showArchived && !isCancelled && cmd.statut !== StatutCommande.LIVRE ? (
                                                        <select className={`text-xs border-gray-300 rounded shadow-sm focus:border-brand-500 focus:ring focus:ring-brand-200 p-1 py-0.5 ${getStatusColor(cmd.statut)} bg-opacity-20 border-opacity-20`} value={cmd.statut} onChange={(e) => onUpdateStatus(cmd.id, e.target.value as StatutCommande)}>{Object.values(StatutCommande).filter(s => !canDeliverOrCancel ? (s !== StatutCommande.LIVRE && s !== StatutCommande.ANNULE) : true).map(s => (<option key={s} value={s}>{s}</option>))}</select>
                                                    ) : (
                                                        <span className={`px-2 py-1 rounded text-xs font-bold ${getStatusColor(cmd.statut)}`}>
                                                            {cmd.statut}
                                                            {isTerminated && <span className="ml-1 text-[9px] bg-green-200 text-green-800 px-1 rounded">TERMINÉE</span>}
                                                        </span>
                                                    )}
                                                </td>
                                                {canSeeFinance && (<td className="py-3 px-4 text-right">{cmd.reste > 0 ? (<span className="font-bold text-red-600">{cmd.reste.toLocaleString()} F</span>) : (<span className="text-xs font-bold text-green-600 bg-green-50 px-2 py-1 rounded">PAYÉ</span>)}</td>)}
                                                <td className="py-3 px-4 text-center"><div className="flex justify-center items-center gap-1"><button onClick={() => openQRModal(cmd)} className="p-1.5 text-gray-500 hover:text-brand-600 hover:bg-brand-50 rounded transition-colors" title="Code QR"><QrCode size={16} /></button>{onUpdateOrder && !isCancelled && !showArchived && cmd.statut !== StatutCommande.LIVRE && (<button onClick={() => handleOpenEditModal(cmd)} className="p-1.5 text-gray-500 hover:bg-gray-100 hover:text-brand-600 rounded transition-colors" title="Modifier"><Edit2 size={16} /></button>)}{canSeeFinance && cmd.reste > 0 && !isCancelled && !showArchived && (<button onClick={() => openPaymentModal(cmd)} className="p-1.5 text-green-600 hover:bg-green-50 rounded transition-colors" title="Encaisser"><Wallet size={16} /></button>)}{canSeeFinance && (<><button onClick={() => handlePrintInvoice(cmd)} className="p-1.5 text-gray-500 hover:bg-gray-100 rounded transition-colors" title="Imprimer Facture"><Printer size={16} /></button><button onClick={() => setViewPaymentHistoryOrderId(cmd.id)} className="p-1.5 text-gray-500 hover:bg-gray-100 rounded transition-colors" title="Historique Paiements"><History size={16} /></button></>)}</div></td>
                                            </tr>
                                        );
                                    })}
                                    {filteredCommandes.length === 0 && (<tr><td colSpan={canSeeFinance ? 8 : 7} className="py-8 text-center text-gray-400 italic">Aucune commande trouvée.</td></tr>)}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )
            ) : viewMode === 'TAILORS' ? (
                // ... (TAILORS VIEW UNCHANGED) ...
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {tailleurs.map(tailleur => {
                        const activeOrders = commandes.filter(c => c.tailleursIds.includes(tailleur.id) && c.statut !== StatutCommande.LIVRE && c.statut !== StatutCommande.ANNULE && !c.archived);
                        const loadLevel = activeOrders.length === 0 ? 'Libre' : activeOrders.length < 3 ? 'Faible' : activeOrders.length < 5 ? 'Moyenne' : 'Élevée';
                        const loadColor = activeOrders.length === 0 ? 'text-green-600 bg-green-50' : activeOrders.length < 3 ? 'text-blue-600 bg-blue-50' : activeOrders.length < 5 ? 'text-orange-600 bg-orange-50' : 'text-red-600 bg-red-50';
                        return (
                            <div key={tailleur.id} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                                <div className="p-4 border-b border-gray-100 flex items-center justify-between bg-gray-50"><div className="flex items-center gap-3"><div className="w-10 h-10 rounded-full bg-brand-200 text-brand-800 flex items-center justify-center font-bold">{tailleur.nom.charAt(0)}</div><div><h3 className="font-bold text-gray-800">{tailleur.nom}</h3><span className="text-xs text-gray-500 uppercase">{tailleur.role}</span></div></div><span className={`px-2 py-1 rounded text-xs font-bold ${loadColor}`}>{loadLevel}</span></div>
                                <div className="p-4"><div className="flex justify-between items-center mb-4"><span className="text-sm font-medium text-gray-600">Commandes en cours</span><span className="text-xl font-bold text-gray-900">{activeOrders.length}</span></div><div className="space-y-3">{activeOrders.length > 0 ? activeOrders.map(cmd => { const dl = getDeadlineInfo(cmd); const isUrg = dl.status === 'URGENT' || dl.status === 'LATE'; return (<div key={cmd.id} className={`bg-white border rounded p-2 shadow-sm text-sm ${isUrg ? 'border-orange-200 bg-orange-50' : 'border-gray-100'}`}><div className="flex justify-between items-start mb-1"><span className="font-bold text-gray-700 truncate">{cmd.clientNom}</span><span className={`text-[10px] px-1.5 py-0.5 rounded-full ${getStatusColor(cmd.statut)}`}>{cmd.statut}</span></div><p className="text-gray-500 text-xs line-clamp-1">{cmd.description}</p><div className="mt-1 flex justify-between items-center text-xs"><span className={dl.status === 'LATE' ? 'text-red-600 font-bold' : dl.status === 'URGENT' ? 'text-orange-600 font-bold' : 'text-gray-400'}>{new Date(cmd.dateLivraisonPrevue).toLocaleDateString()}</span></div></div>); }) : (<p className="text-center text-sm text-gray-400 py-4 italic">Aucune commande assignée.</p>)}</div></div>
                            </div>
                        );
                    })}
                </div>
            ) : null}
            
            {/* ... Other modals (QR, Scanner, Payment History, Payment) unchanged ... */}
            {/* Modal QR Code */}
            {qrOrder && (
                <QRGeneratorModal
                    isOpen={qrModalOpen}
                    onClose={() => setQrModalOpen(false)}
                    value={qrOrder.id}
                    title={qrOrder.clientNom}
                    subtitle={`Livraison: ${new Date(qrOrder.dateLivraisonPrevue).toLocaleDateString()}`}
                    price={qrOrder.prixTotal}
                />
            )}

            {/* SCANNER MODAL */}
            <QRScannerModal 
                isOpen={isScannerOpen} 
                onClose={() => setIsScannerOpen(false)}
                onScan={handleScan}
            />

            {/* Payment History Modal */}
            {activeHistoryOrder && (
                // ... (Payment History Modal Content Unchanged) ...
                <div className="fixed inset-0 bg-black bg-opacity-60 z-[70] flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg flex flex-col animate-in fade-in zoom-in duration-200">
                        <div className="bg-brand-700 text-white p-4 flex justify-between items-center rounded-t-xl shrink-0">
                            <h3 className="text-lg font-bold flex items-center gap-2">
                                <History size={20} /> Historique Paiements
                            </h3>
                            <button onClick={() => setViewPaymentHistoryOrderId(null)} className="hover:bg-brand-600 p-1 rounded-full transition-colors">
                                <X size={20} />
                            </button>
                        </div>
                        {/* ... (Rest of Payment History) ... */}
                        <div className="p-6 overflow-y-auto max-h-[70vh]">
                            <div className="mb-4 text-sm text-gray-600 border-b border-gray-100 pb-3">
                                <p><strong>Commande:</strong> #{activeHistoryOrder.id}</p>
                                <p><strong>Client:</strong> {activeHistoryOrder.clientNom}</p>
                                <p className="truncate"><strong>Description:</strong> {activeHistoryOrder.description}</p>
                            </div>

                            <table className="w-full text-sm text-left">
                                <thead className="bg-gray-50 text-gray-600 font-medium">
                                    <tr>
                                        <th className="py-2 px-3">Date</th>
                                        <th className="py-2 px-3">Moyen</th>
                                        <th className="py-2 px-3">Détails/Note</th>
                                        <th className="py-2 px-3 text-right">Montant</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {/* LOGIQUE D'AFFICHAGE DU VERSEMENT INITIAL SI MANQUANT DANS L'HISTORIQUE DETAILLE */}
                                    {(() => {
                                        const payments = activeHistoryOrder.paiements || [];
                                        const totalRecorded = payments.reduce((acc, p) => acc + p.montant, 0);
                                        const initialAdvance = activeHistoryOrder.avance || 0;
                                        const hiddenInitialPayment = initialAdvance - totalRecorded;

                                        return (
                                            <>
                                                {hiddenInitialPayment > 0 && (
                                                    <tr className="bg-yellow-50">
                                                        <td className="py-3 px-3 text-gray-700">
                                                            {new Date(activeHistoryOrder.dateCommande).toLocaleDateString()}
                                                        </td>
                                                        <td className="py-3 px-3">
                                                            <span className="text-xs bg-gray-200 px-2 py-1 rounded text-gray-700 font-bold">ESPECE/AUTRE</span>
                                                        </td>
                                                        <td className="py-3 px-3 text-xs text-gray-600 italic">
                                                            Versement Initial (Ancien solde)
                                                        </td>
                                                        <td className="py-3 px-3 text-right font-bold text-green-700">
                                                            {hiddenInitialPayment.toLocaleString()} F
                                                        </td>
                                                    </tr>
                                                )}
                                                {payments.map((p) => (
                                                    <tr key={p.id}>
                                                        <td className="py-3 px-3 text-gray-700">
                                                            {new Date(p.date).toLocaleDateString()} 
                                                        </td>
                                                        <td className="py-3 px-3">
                                                            <span className="text-xs bg-gray-100 px-2 py-1 rounded text-gray-600 font-bold">{p.moyenPaiement || 'Espèce'}</span>
                                                        </td>
                                                        <td className="py-3 px-3 text-xs text-gray-500 italic">
                                                            {p.note || '-'}
                                                        </td>
                                                        <td className={`py-3 px-3 text-right font-bold ${p.montant >= 0 ? 'text-green-700' : 'text-red-600'}`}>
                                                            {p.montant >= 0 ? '' : ''} {p.montant.toLocaleString()} F
                                                        </td>
                                                    </tr>
                                                ))}
                                                {payments.length === 0 && hiddenInitialPayment <= 0 && (
                                                    <tr>
                                                        <td colSpan={4} className="text-center py-6 text-gray-400 italic">Aucun paiement enregistré.</td>
                                                    </tr>
                                                )}
                                            </>
                                        );
                                    })()}
                                </tbody>
                            </table>
                            {/* ... (Totals summary) ... */}
                            <div className="mt-6 pt-4 border-t border-gray-200 text-sm">
                                <div className="flex justify-between mb-2">
                                    <span className="text-gray-600">Total TTC Commande</span>
                                    <span className="font-bold">{activeHistoryOrder.prixTotal.toLocaleString()} F</span>
                                </div>
                                <div className="flex justify-between mb-2">
                                    <span className="text-gray-600">Total Versé</span>
                                    <span className="font-bold text-green-600">{activeHistoryOrder.avance.toLocaleString()} F</span>
                                </div>
                                <div className="flex justify-between pt-2 border-t border-dashed border-gray-300">
                                    <span className="font-bold text-gray-800">Reste à Payer</span>
                                    <span className={`font-bold ${activeHistoryOrder.reste > 0 ? 'text-red-600' : 'text-green-600'}`}>
                                        {activeHistoryOrder.reste.toLocaleString()} F
                                    </span>
                                </div>
                            </div>
                        </div>
                        <div className="p-4 bg-gray-50 rounded-b-xl border-t border-gray-100 text-right">
                            <button onClick={() => setViewPaymentHistoryOrderId(null)} className="px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100 font-medium">Fermer</button>
                        </div>
                    </div>
                </div>
            )}
            
            {/* Modal Payment (Short Version) */}
            {paymentModalOpen && selectedOrderForPayment && (
                // ... (Payment Modal Content Unchanged) ...
                <div className="fixed inset-0 bg-black bg-opacity-60 z-[60] flex items-center justify-center p-4">
                     <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm p-6 animate-in fade-in zoom-in duration-200">
                        <h3 className="text-xl font-bold mb-4 flex items-center gap-2 text-gray-800">
                            <Wallet className="text-brand-600" /> Encaissement Client
                        </h3>
                        <p className="text-sm text-gray-600 mb-4">
                            Commande de <strong>{selectedOrderForPayment.clientNom}</strong><br/>
                            Reste actuel: <span className="font-bold text-red-600">{selectedOrderForPayment.reste.toLocaleString()} FCFA</span>
                        </p>
                        <div className="mb-4">
                            <label className="block text-sm font-medium text-gray-700 mb-1">Date du paiement</label>
                            <input type="date" value={paymentDate} onChange={(e) => setPaymentDate(e.target.value)} className="w-full p-2 border border-gray-300 rounded font-medium text-gray-700" />
                        </div>
                        <div className="mb-4">
                            <label className="block text-sm font-medium text-gray-700 mb-1">Moyen de Paiement</label>
                            <select className="w-full p-2 border border-gray-300 rounded font-bold text-gray-700 bg-white" value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value as ModePaiement)}>
                                <option value="ESPECE">Espèce</option><option value="WAVE">Wave</option><option value="ORANGE_MONEY">Orange Money</option><option value="VIREMENT">Virement Bancaire</option><option value="CHEQUE">Chèque</option>
                            </select>
                        </div>
                        <div className="mb-4">
                            <label className="block text-sm font-medium text-gray-700 mb-1">Compte de Destination</label>
                            <select className="w-full p-2 border border-gray-300 rounded text-sm text-gray-700" value={paymentAccountId} onChange={(e) => setPaymentAccountId(e.target.value)}>
                                <option value="">-- Choisir Compte --</option>
                                {comptes.map(acc => (<option key={acc.id} value={acc.id}>{acc.nom} ({acc.type})</option>))}
                            </select>
                        </div>
                        <div className="mb-4">
                            <label className="block text-sm font-medium text-gray-700 mb-1">Montant Reçu</label>
                            <input type="number" max={selectedOrderForPayment.reste} value={paymentAmount} onChange={(e) => setPaymentAmount(parseInt(e.target.value) || 0)} className="w-full p-2 border border-gray-300 rounded font-bold text-lg text-green-700" />
                        </div>
                        <div className="mb-4">
                            <label className="block text-sm font-medium text-gray-700 mb-1">Note / Détails (Optionnel)</label>
                            <textarea rows={2} value={paymentNote} onChange={(e) => setPaymentNote(e.target.value)} className="w-full p-2 border border-gray-300 rounded text-sm text-gray-700" placeholder="Ex: Avance Wave, Reliquat à la livraison..." />
                        </div>
                        <div className="flex justify-end gap-3">
                             <button onClick={() => setPaymentModalOpen(false)} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded">Annuler</button>
                             <button onClick={submitPayment} disabled={!paymentAccountId || paymentAmount <= 0} className={`px-4 py-2 text-white rounded font-bold shadow ${!paymentAccountId || paymentAmount <= 0 ? 'bg-gray-300 cursor-not-allowed' : 'bg-green-600 hover:bg-green-700'}`}>Valider</button>
                        </div>
                     </div>
                </div>
            )}

            {/* Modal Création/Édition Commande */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col animate-in fade-in zoom-in duration-200">
                        <div className="bg-brand-600 text-white p-4 flex justify-between items-center shadow-md shrink-0">
                            <h2 className="text-xl font-bold flex items-center gap-2">
                                {isEditingOrder ? <Edit2 size={24} /> : <Plus size={24} />}
                                {isEditingOrder ? 'Modifier Commande' : 'Nouvelle Commande Atelier'}
                            </h2>
                            <button onClick={() => setIsModalOpen(false)} className="hover:bg-brand-700 p-1 rounded-full"><X size={24} /></button>
                        </div>
                        <div className="p-6 overflow-y-auto flex-1 space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="md:col-span-2"><label className="block text-sm font-medium text-gray-700 mb-1">Client *</label><select value={selectedClientId} onChange={e => setSelectedClientId(e.target.value)} className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-brand-500"><option value="">-- Sélectionner Client --</option>{clients.map(c => (<option key={c.id} value={c.id}>{c.nom} ({c.telephone})</option>))}</select>{clients.length === 0 && <p className="text-xs text-red-500 mt-1">Veuillez d'abord créer des clients.</p>}</div>
                                
                                {/* NOUVELLE SECTION MESURES DANS LE MODAL PRODUCTION */}
                                {selectedClientId && (
                                    <div className="md:col-span-2 bg-indigo-50 border border-indigo-100 rounded-lg p-3">
                                        <div className="flex justify-between items-center mb-2">
                                            <h4 className="font-bold text-xs text-indigo-900 flex items-center gap-2"><Ruler size={14}/> Mesures Client</h4>
                                            <button 
                                                type="button" 
                                                onClick={() => setShowMeasurements(!showMeasurements)}
                                                className="text-xs text-indigo-600 hover:text-indigo-800 underline"
                                            >
                                                {showMeasurements ? 'Masquer' : 'Voir'}
                                            </button>
                                        </div>
                                        
                                        {showMeasurements && (
                                            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 animate-in slide-in-from-top-1">
                                                {(() => {
                                                    const client = clients.find(c => c.id === selectedClientId);
                                                    if (!client) return null;
                                                    
                                                    return MEASUREMENT_FIELDS.map(field => {
                                                        // Gestion affichage spécial pour double valeur
                                                        let displayVal = client.mesures?.[field.key] || '-';
                                                        if (field.key === 'longueurBoubou1') {
                                                            displayVal = `${client.mesures?.longueurBoubou1 || 0} / ${client.mesures?.longueurBoubou2 || 0}`;
                                                        } else if (field.key === 'genou1') {
                                                            displayVal = `${client.mesures?.genou1 || 0} / ${client.mesures?.genou2 || 0}`;
                                                        }

                                                        return (
                                                            <div key={field.key} className="bg-white p-1.5 rounded border border-indigo-100 text-center">
                                                                <span className="block text-[9px] text-gray-400 uppercase">{field.label}</span>
                                                                <span className="block font-bold text-gray-800 text-xs">{displayVal}</span>
                                                            </div>
                                                        );
                                                    });
                                                })()}
                                            </div>
                                        )}
                                        {!showMeasurements && (
                                            <p className="text-xs text-gray-500 italic">Sélectionnez "Voir" pour consulter les mesures prises (dont Poitrine, Épaule, etc.)</p>
                                        )}
                                    </div>
                                )}

                                <div className="md:col-span-2"><label className="block text-sm font-medium text-gray-700 mb-1">Modèle / Description *</label><textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="Ex: Robe en Bazin Bleu avec broderie dorée..." className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-brand-500" rows={2} /></div>
                                <div className="md:col-span-2"><label className="block text-sm font-medium text-gray-700 mb-1">Notes & Commentaires (Interne)</label><textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Détails spécifiques, mesures particulières, rappel..." className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-brand-500" rows={2} /></div>
                                <div><label className="block text-sm font-medium text-gray-700 mb-1">Date Livraison Prévue *</label><input type="date" value={dateLivraison} onChange={e => setDateLivraison(e.target.value)} className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-brand-500" /></div>
                                <div><label className="block text-sm font-medium text-gray-700 mb-1">Quantité</label><input type="number" min="1" value={quantite} onChange={e => setQuantite(parseInt(e.target.value) || 1)} className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-brand-500" /></div>
                            </div>
                            <div className="bg-gray-50 p-3 rounded-lg border border-gray-100"><label className="block text-sm font-bold text-gray-700 mb-2">Assigner Tailleurs</label><div className="flex flex-wrap gap-2">{tailleurs.map(t => (<button key={t.id} onClick={() => toggleTailleurSelection(t.id)} className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${selectedTailleurs.includes(t.id) ? 'bg-brand-600 text-white border-brand-600' : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-100'}`}>{t.nom}</button>))}</div></div>
                            {!isEditingOrder && (<div className="bg-blue-50 p-3 rounded-lg border border-blue-100"><h4 className="font-bold text-sm text-blue-800 mb-2 flex items-center gap-2"><Scissors size={14} /> Sortie Stock (Tissus & Fournitures)</h4><div className="flex gap-2 items-end mb-2"><div className="flex-1"><label className="block text-[10px] text-blue-700 mb-0.5">Article</label><select value={tempConso.articleId} onChange={e => { setTempConso({...tempConso, articleId: e.target.value, variante: ''}); }} className="w-full p-1.5 text-sm border border-blue-200 rounded"><option value="">-- Choisir --</option>{matieresPremieres.map(a => (<option key={a.id} value={a.id}>{a.nom}</option>))}</select></div><div className="w-1/3"><label className="block text-[10px] text-blue-700 mb-0.5">Variante</label>{selectedArticleObj && selectedArticleObj.variantes.length > 0 ? (<select value={tempConso.variante} onChange={e => setTempConso({...tempConso, variante: e.target.value})} className="w-full p-1.5 text-sm border border-blue-200 rounded"><option value="">-- Choisir --</option>{selectedArticleObj.variantes.map(v => (<option key={v} value={v}>{v}</option>))}</select>) : (<input type="text" disabled className="w-full p-1.5 text-sm border border-gray-200 bg-gray-100 rounded cursor-not-allowed" placeholder="Standard" />)}</div><div className="w-20"><label className="block text-[10px] text-blue-700 mb-0.5">Qté ({selectedArticleObj?.unite || 'U'})</label><input type="number" min="0.1" step="0.1" value={tempConso.quantite || ''} onChange={e => setTempConso({...tempConso, quantite: parseFloat(e.target.value) || 0})} className="w-full p-1.5 text-sm border border-blue-200 rounded" /></div><button onClick={addConsommation} className="bg-blue-600 text-white p-1.5 rounded hover:bg-blue-700" title="Ajouter la ligne à la liste"><Plus size={16} /></button></div>{consommations.length > 0 && (<div className="space-y-1 mt-2">{consommations.map(c => { const art = articles.find(a => a.id === c.articleId); return (<div key={c.id} className="flex justify-between items-center bg-white p-2 rounded text-xs border border-blue-100"><span>{art?.nom} {c.variante ? `(${c.variante})` : ''}</span><div className="flex items-center gap-2"><span className="font-bold">{c.quantite} {art?.unite}</span><button onClick={() => removeConsommation(c.id)} className="text-red-400 hover:text-red-600"><Trash2 size={12}/></button></div></div>) })}</div>)}</div>)}
                            {isEditingOrder && (<div className="p-3 bg-yellow-50 border border-yellow-100 rounded-lg text-xs text-yellow-800 flex gap-2"><AlertTriangle size={16} className="shrink-0"/><p>En mode modification, la gestion des stocks consommés est désactivée pour éviter les erreurs d'inventaire. Veuillez ajuster le stock manuellement si nécessaire.</p></div>)}
                            {canSeeFinance && (
                                <div className="grid grid-cols-2 gap-4 border-t border-gray-100 pt-4">
                                    <div className="col-span-2 flex justify-end gap-4 items-center">
                                        <label className="inline-flex items-center cursor-pointer"><input type="checkbox" className="sr-only peer" checked={applyTva} onChange={e => setApplyTva(e.target.checked)} /><div className="relative w-9 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-brand-600"></div><span className="ms-3 text-sm font-medium text-gray-700">Appliquer TVA ({tvaPercent}%)</span></label>
                                    </div>
                                    <div><label className="block text-sm font-medium text-gray-700 mb-1">Montant Base (Avant Remise)</label><input type="number" value={prixBase === 0 ? '' : prixBase} onChange={e => setPrixBase(parseInt(e.target.value) || 0)} className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-brand-500 font-bold" placeholder="0" /></div>
                                    <div><label className="block text-sm font-medium text-gray-700 mb-1">Remise</label><input type="number" value={remise === 0 ? '' : remise} onChange={e => setRemise(parseInt(e.target.value) || 0)} className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-brand-500 text-orange-600 font-bold" placeholder="0" /></div>
                                    
                                    <div className="col-span-2 bg-gray-50 p-2 rounded text-sm text-gray-600 space-y-1">
                                        <div className="flex justify-between"><span>Net Commercial (HT):</span><span className="font-bold">{montantApresRemise.toLocaleString()} F</span></div>
                                        {applyTva && (<div className="flex justify-between text-xs"><span>+ TVA ({tvaPercent}%):</span><span>{montantTva.toLocaleString()} F</span></div>)}
                                        <div className="flex justify-between border-t border-gray-200 pt-1 mt-1 font-bold text-gray-900 text-lg"><span>Total à Payer (TTC):</span><span>{montantTotalTTC.toLocaleString()} F</span></div>
                                    </div>

                                    <div className="col-span-2"><label className="block text-sm font-medium text-gray-700 mb-1">Avance Reçue (FCFA)</label><input type="number" value={avance === 0 ? '' : avance} onChange={e => setAvance(parseInt(e.target.value) || 0)} className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-brand-500 text-green-700 font-bold" placeholder="0" /></div>
                                    
                                    {(avance > 0 || (isEditingOrder && avance !== (commandes.find(c => c.id === selectedOrderId)?.avance || 0))) && (
                                        <div className="col-span-2 bg-green-50 p-3 rounded-lg border border-green-100">
                                            <p className="text-xs font-bold text-green-800 mb-2">
                                                {isEditingOrder ? "Compte (Si modification montant)" : "Détails Avance"}
                                            </p>
                                            <div className="flex gap-4">
                                                <div className="flex-1">
                                                    <label className="block text-[10px] font-medium text-gray-600 mb-1">Moyen Paiement</label>
                                                    <select className="w-full p-1.5 border border-gray-300 rounded text-xs" value={initialPaymentMethod} onChange={e => setInitialPaymentMethod(e.target.value as ModePaiement)}>
                                                        <option value="ESPECE">Espèce</option><option value="WAVE">Wave</option><option value="ORANGE_MONEY">Orange Money</option><option value="VIREMENT">Virement</option>
                                                    </select>
                                                </div>
                                                <div className="flex-1">
                                                    <label className="block text-[10px] font-medium text-gray-600 mb-1">Compte Destination</label>
                                                    <select className="w-full p-1.5 border border-gray-300 rounded text-xs" value={initialAccountId} onChange={e => setInitialAccountId(e.target.value)}>
                                                        <option value="">-- Choisir --</option>
                                                        {comptes.map(acc => (<option key={acc.id} value={acc.id}>{acc.nom}</option>))}
                                                    </select>
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    <div className="col-span-2 text-right text-sm border-t border-dashed border-gray-200 pt-2 mt-1">Reste à payer: <span className="font-bold text-red-600 text-lg">{montantReste.toLocaleString()} FCFA</span></div>
                                </div>
                            )}
                            {!canSeeFinance && (<div className="text-center p-4 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-500 italic flex flex-col items-center gap-1"><EyeOff size={20} /><span>Les informations financières seront renseignées par le gérant.</span></div>)}
                        </div>
                        <div className="p-4 border-t border-gray-100 bg-gray-50 flex justify-end gap-3 shrink-0">
                            {canSeeFinance && (
                                <button 
                                    onClick={handlePrintQuote}
                                    className="mr-auto px-4 py-2 border border-gray-300 text-gray-700 bg-white rounded-lg hover:bg-gray-100 flex items-center gap-2"
                                    title="Imprimer un devis sans créer la commande"
                                >
                                    <Printer size={18} /> Imprimer Devis
                                </button>
                            )}
                            <button onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50">Annuler</button>
                            <button onClick={handleCreateOrUpdate} className="px-4 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 flex items-center gap-2"><Save size={18} /> {isEditingOrder ? 'Enregistrer Modifications' : 'Créer Commande'}</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ProductionView;
