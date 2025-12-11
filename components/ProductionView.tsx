
// ... (imports)
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
    companyAssets?: CompanyAssets; // Ajout prop
}

const ProductionView: React.FC<ProductionViewProps> = ({ 
    commandes, employes, clients, articles, userRole, 
    onUpdateStatus, onCreateOrder, onUpdateOrder, onAddPayment, onArchiveOrder, comptes, companyAssets 
}) => {
    // ... (Tout le state reste inchangé)
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

    // ... (MEASUREMENT_FIELDS et autres useMemo conservés) ...
    // LISTE DES CHAMPS DE MESURE (Même que ClientsView)
    const MEASUREMENT_FIELDS = [
        { key: 'tourCou', label: 'T. Cou' },
        { key: 'epaule', label: 'Épaule' },
        { key: 'poitrine', label: 'TOUR POITRINE' }, 
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

    // ... (Filtres Logic conservé) ...
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

    const montantApresRemise = Math.max(0, prixBase - remise);
    const montantTva = applyTva ? Math.round(montantApresRemise * COMPANY_CONFIG.tvaRate) : 0;
    const montantTotalTTC = montantApresRemise + montantTva;
    const montantReste = Math.max(0, montantTotalTTC - avance);

    // ... (Handlers conservés : resetFilters, toggleArchives, setQuickDateFilter, handleOpenCreateModal, handleOpenEditModal, handleCreateOrUpdate, toggleTailleurSelection, addConsommation, removeConsommation, openQRModal, handleScan) ...
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

    // --- Print Function Updated ---
    const generatePrintContent = (orderData: Partial<Commande>, mode: 'TICKET' | 'DEVIS' | 'LIVRAISON' = 'TICKET') => {
        const printWindow = window.open('', '', 'width=800,height=800');
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
        const totalHT = totalTTC - tva + remise;
        
        const isPaid = resteAPayer <= 0;
        const stampText = isPaid ? "PAYÉ" : "NON SOLDÉ";
        const stampColor = isPaid ? "#16a34a" : "#dc2626"; 
        const showStamp = mode !== 'DEVIS'; 

        // Récupération de l'URL de base pour les images (Important pour window.open)
        const baseUrl = window.location.origin;
        // Priorité aux assets base64 personnalisés
        const logoUrl = companyAssets?.logoStr || `${baseUrl}${COMPANY_CONFIG.logoUrl}`;
        const stampUrl = companyAssets?.stampStr || `${baseUrl}${COMPANY_CONFIG.stampUrl}`;
        const signatureUrl = companyAssets?.signatureStr || `${baseUrl}${COMPANY_CONFIG.signatureUrl}`;

        const html = `
            <html>
            <head>
                <title>${docTitle}</title>
                <style>
                    body { font-family: 'Courier New', monospace; padding: 20px; font-size: 14px; position: relative; max-width: 800px; margin: auto; }
                    .header { text-align: center; margin-bottom: 20px; border-bottom: 2px solid #333; padding-bottom: 10px; }
                    .logo { text-align: center; margin-bottom: 15px; }
                    .logo img { max-height: 80px; width: auto; object-fit: contain; }
                    .info-section { display: flex; justify-content: space-between; margin-bottom: 20px; }
                    .info-block { width: 48%; }
                    .info-title { font-weight: bold; text-transform: uppercase; margin-bottom: 5px; text-decoration: underline; }
                    .items-table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
                    .items-table th, .items-table td { border-bottom: 1px dashed #ccc; padding: 8px; text-align: left; }
                    .items-table th { border-bottom: 1px solid #000; }
                    .total-section { display: flex; justify-content: flex-end; margin-top: 10px; }
                    .total-box { width: 250px; }
                    .row { display: flex; justify-content: space-between; margin-bottom: 5px; }
                    .bold { font-weight: bold; font-size: 16px; }
                    .stamp {
                        position: absolute; top: 300px; left: 50%; transform: translate(-50%, -50%) rotate(-15deg);
                        font-size: 48px; font-weight: bold; color: ${stampColor}; border: 4px solid ${stampColor};
                        padding: 10px 40px; border-radius: 10px; opacity: 0.25; z-index: 0; pointer-events: none;
                        text-transform: uppercase; font-family: sans-serif;
                    }
                    .signatures { display: flex; justify-content: space-between; margin-top: 50px; margin-bottom: 20px; align-items: flex-start; page-break-inside: avoid; }
                    .sign-box { width: 45%; text-align: center; position: relative; min-height: 120px; }
                    .sign-title { font-weight: bold; text-decoration: underline; margin-bottom: 40px; display: block; }
                    .stamp-container { position: absolute; bottom: 0; left: 50%; transform: translateX(-50%); width: 150px; height: 100px; display: flex; align-items: center; justify-content: center; }
                    /* Images Cachet & Signature */
                    .stamp-img { position: absolute; width: 100px; opacity: 0.8; transform: rotate(-10deg); z-index: 1; }
                    .sig-img { position: absolute; width: 80px; z-index: 2; margin-top: 10px; }
                    /* Fallback si image manquante */
                    .missing-img { border: 2px dashed #ccc; color: #ccc; width: 100px; height: 60px; display: flex; align-items: center; justify-content: center; font-size: 10px; }
                    
                    .footer { text-align:center; margin-top: 40px; font-size: 12px; border-top: 1px solid #eee; padding-top: 10px; }
                    .content { position: relative; z-index: 1; }
                </style>
            </head>
            <body>
                <div class="content">
                    <div class="header">
                        <div class="logo">
                            <img src="${logoUrl}" alt="${COMPANY_CONFIG.name}" onerror="this.style.display='none'; this.nextElementSibling.style.display='block';" />
                            <div style="display:none; font-size:24px; font-weight:bold; color:#bf602a;">${COMPANY_CONFIG.name}</div>
                        </div>
                        <h2>${COMPANY_CONFIG.name}</h2>
                        <p>${COMPANY_CONFIG.address} | ${COMPANY_CONFIG.phone}</p>
                        <h3>${docTitle}</h3>
                    </div>

                    <div class="info-section">
                        <div class="info-block">
                            <div class="info-title">Client</div>
                            <p><strong>${orderData.clientNom || 'Client de passage'}</strong></p>
                            <p>Réf Commande: <strong>#${orderData.id ? orderData.id.slice(-6) : 'N/A'}</strong></p>
                        </div>
                        <div class="info-block" style="text-align: right;">
                            <div class="info-title">Détails</div>
                            <p>Date: ${dateStr}</p>
                            <p>Livraison: ${orderData.dateLivraisonPrevue ? new Date(orderData.dateLivraisonPrevue).toLocaleDateString() : 'N/A'}</p>
                        </div>
                    </div>

                    <table class="items-table">
                        <thead>
                            <tr>
                                <th>Désignation</th>
                                <th style="text-align:center;">Qté</th>
                                <th style="text-align:right;">Montant</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr>
                                <td>
                                    <strong>${orderData.description || 'Confection sur mesure'}</strong>
                                    ${orderData.notes ? `<br/><small><i>${orderData.notes}</i></small>` : ''}
                                </td>
                                <td style="text-align:center;">${orderData.quantite || 1}</td>
                                <td style="text-align:right;">${(totalHT + remise).toLocaleString()}</td>
                            </tr>
                        </tbody>
                    </table>
                    
                    <div class="total-section">
                        <div class="total-box">
                            <div class="row">
                                <span>Sous-total HT :</span>
                                <span>${totalHT.toLocaleString()}</span>
                            </div>
                            ${remise > 0 ? `
                            <div class="row">
                                <span>Remise :</span>
                                <span>-${remise.toLocaleString()}</span>
                            </div>` : ''}
                            ${tva > 0 ? `
                            <div class="row">
                                <span>TVA (${orderData.tvaRate || 18}%) :</span>
                                <span>${tva.toLocaleString()}</span>
                            </div>` : ''}
                            
                            <div class="row bold" style="margin-top: 10px; border-top: 2px solid #000; padding-top: 5px;">
                                <span>TOTAL TTC :</span>
                                <span>${totalTTC.toLocaleString()} ${COMPANY_CONFIG.currency}</span>
                            </div>

                            ${mode !== 'DEVIS' ? `
                            <div class="row" style="margin-top: 10px;">
                                <span>Avance Reçue :</span>
                                <span>${avanceRecue.toLocaleString()}</span>
                            </div>
                            <div class="row bold">
                                <span>Reste à Payer :</span>
                                <span>${resteAPayer.toLocaleString()}</span>
                            </div>
                            ` : ''}
                        </div>
                    </div>

                    <!-- SIGNATURES SECTION -->
                    <div class="signatures">
                        <div class="sign-box">
                            <span class="sign-title">Signature Client</span>
                            <br/><br/>
                        </div>
                        <div class="sign-box">
                            <span class="sign-title">Direction</span>
                            <div class="stamp-container">
                                <!-- CACHET -->
                                <img src="${stampUrl}" class="stamp-img" alt="Cachet" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';" />
                                <div class="missing-img" style="display:none; border:3px double #16a34a; color:#16a34a; border-radius:50%; width:100px; height:100px; transform:rotate(-10deg);">CACHET</div>
                                
                                <!-- SIGNATURE -->
                                <img src="${signatureUrl}" class="sig-img" alt="Signature" onerror="this.style.display='none'; this.nextElementSibling.style.display='block';" />
                                <div class="missing-img" style="display:none; border:none; border-bottom:1px solid #000; width:100px; height:40px; margin-top:20px;">Signature</div>
                            </div>
                        </div>
                    </div>

                    <div class="footer">
                        <p>Merci de votre confiance !</p>
                        <p>Les articles confectionnés ne sont ni repris ni échangés après livraison.</p>
                    </div>
                </div>
                ${showStamp ? `<div class="stamp">${stampText}</div>` : ''}
                <script>
                    window.onload = function() {
                        var imgs = document.getElementsByTagName('img');
                        var loaded = 0;
                        if (imgs.length === 0) { window.print(); return; }
                        
                        function check() {
                            loaded++;
                            if (loaded === imgs.length) { window.print(); }
                        }
                        
                        for(var i=0; i<imgs.length; i++) {
                            if(imgs[i].complete) loaded++;
                            else {
                                imgs[i].onload = check;
                                imgs[i].onerror = check;
                            }
                        }
                        if(loaded === imgs.length) window.print();
                    };
                </script>
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
            {/* ... (Reste du JSX identique) ... */}
            {/* Je réutilise le JSX précédent car seule la logique d'impression et de props a changé */}
            
            {/* HEADER & VIEW SWITCHER */}
            <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4">
                <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                    <Scissors className="text-brand-600" />
                    Atelier de Production
                </h2>
                {/* ... */}
                <div className="flex flex-col sm:flex-row gap-3 w-full xl:w-auto items-center">
                    <div className="flex gap-2 self-start">
                        {/* ... */}
                        <div className="bg-gray-100 p-1 rounded-lg flex overflow-x-auto max-w-full">
                            <button onClick={() => setViewMode('ORDERS')} className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all flex items-center gap-2 whitespace-nowrap ${viewMode === 'ORDERS' ? 'bg-white text-brand-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}><LayoutList size={14} /> <span className="hidden sm:inline">Commandes</span></button>
                            {/* ... */}
                        </div>
                    </div>
                    {/* ... */}
                    {!showArchived && (
                        <button onClick={handleOpenCreateModal} className="bg-brand-600 hover:bg-brand-700 text-white px-4 py-1.5 rounded-lg flex items-center gap-2 font-medium transition-colors shadow-sm whitespace-nowrap text-sm"><Plus size={18} /> <span className="hidden sm:inline">Nouvelle Commande</span></button>
                    )}
                </div>
            </div>

            {/* ... (Reste du composant identique) ... */}
            {/* FILTERS PANEL */}
            {/* ... */}
            {/* PERFORMANCE */}
            {/* ... */}
            {/* MAIN CONTENT */}
            {viewMode === 'ORDERS' && (
                orderDisplayMode === 'GRID' ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {filteredCommandes.map(cmd => {
                            const deadlineInfo = getDeadlineInfo(cmd);
                            const isLateState = deadlineInfo.status === 'LATE' && !showArchived;
                            const isUrgent = deadlineInfo.status === 'URGENT' && !showArchived;
                            const isCancelled = cmd.statut === StatutCommande.ANNULE;
                            // ...
                            return (
                                <div key={cmd.id} className={`bg-white rounded-xl shadow-sm border p-5 hover:shadow-md transition-shadow relative group ${isLateState ? 'border-red-200' : isUrgent ? 'border-orange-300 bg-orange-50/10' : 'border-gray-100'} ${isCancelled ? 'opacity-75 border-red-100' : ''}`}>
                                    {/* ... */}
                                    <div className="absolute top-2 right-2 flex gap-1 z-[500]">
                                        <button onClick={() => openQRModal(cmd)} className="p-1.5 bg-white border border-gray-200 text-gray-500 hover:text-brand-600 rounded shadow-sm hover:bg-gray-50 cursor-pointer"><QrCode size={14} /></button>
                                        {onUpdateOrder && !isCancelled && cmd.statut !== StatutCommande.LIVRE && !showArchived && (
                                            <button onClick={() => handleOpenEditModal(cmd)} className="p-1.5 bg-white border border-gray-200 text-gray-500 hover:text-brand-600 rounded shadow-sm hover:bg-gray-50 cursor-pointer"><Edit2 size={14} /></button>
                                        )}
                                    </div>
                                    <div className="mt-6 flex justify-between items-start mb-4 pl-3 relative z-10">
                                        <div><span className="font-bold text-lg text-gray-800 block">{cmd.clientNom}</span><span className="text-xs text-gray-400">#{cmd.id.slice(-6)}</span></div>
                                        <span className={`px-2 py-1 rounded-full text-xs font-semibold ${getStatusColor(cmd.statut)}`}>{cmd.statut}</span>
                                    </div>
                                    <div className="flex items-start gap-3 mb-4 pl-3 relative z-10"><div className="p-2 bg-brand-50 rounded-lg shrink-0"><Shirt className="text-brand-600" size={20} /></div><div className="flex-1 min-w-0"><h3 className="text-sm font-medium text-gray-900 line-clamp-2">{cmd.quantite && cmd.quantite > 1 && (<span className="inline-flex items-center justify-center bg-gray-900 text-white text-[10px] font-bold h-5 min-w-[1.25rem] px-1 rounded-full mr-2">{cmd.quantite}x</span>)}{cmd.description}</h3><p className={`text-xs flex items-center gap-1 mt-1 ${isLateState ? 'text-red-600 font-bold' : isUrgent ? 'text-orange-600 font-medium' : 'text-gray-500'}`}><Calendar size={12}/> Livraison: {new Date(cmd.dateLivraisonPrevue).toLocaleDateString()}</p></div></div>
                                    {/* ... */}
                                    <div className="mt-4 pt-3 border-t border-gray-100 flex flex-wrap gap-2 pl-3 items-center relative z-50">
                                        {!showArchived && cmd.statut !== StatutCommande.LIVRE && !isCancelled && (<div className="flex-1 min-w-[120px]"><select className="block w-full text-xs border-gray-300 rounded shadow-sm focus:border-brand-500 focus:ring focus:ring-brand-200 p-1.5" value={cmd.statut} onChange={(e) => onUpdateStatus(cmd.id, e.target.value as StatutCommande)}>{Object.values(StatutCommande).filter(s => { if (!canDeliverOrCancel) { return s !== StatutCommande.LIVRE && s !== StatutCommande.ANNULE; } return true; }).map(s => (<option key={s} value={s}>{s}</option>))}</select></div>)}
                                        {!showArchived && !isCancelled && (
                                            <>
                                                {canSeeFinance && (<button onClick={() => handlePrintInvoice(cmd)} className="p-1.5 bg-gray-100 text-gray-600 hover:bg-gray-200 rounded transition-colors" title="Imprimer Facture"><Printer size={16} /></button>)}
                                                {/* ... */}
                                                {canSeeFinance && cmd.reste > 0 && (<button onClick={() => openPaymentModal(cmd)} className="bg-brand-100 text-brand-800 px-3 py-1.5 rounded text-xs font-bold flex items-center gap-1 hover:bg-brand-200 transition-colors" title="Encaisser un paiement"><Wallet size={14} /> ENCAISSER</button>)}
                                            </>
                                        )}
                                        {/* ... */}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                ) : (
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm text-left">
                                {/* ... */}
                                <tbody className="divide-y divide-gray-100">
                                    {filteredCommandes.map(cmd => (
                                        <tr key={cmd.id} className="hover:bg-gray-50 transition-colors">
                                            {/* ... */}
                                            <td className="py-3 px-4 text-center">
                                                <div className="flex justify-center items-center gap-1">
                                                    <button onClick={() => handlePrintInvoice(cmd)} className="p-1.5 text-gray-500 hover:bg-gray-100 rounded transition-colors" title="Imprimer Facture"><Printer size={16} /></button>
                                                    {/* ... */}
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )
            )}
            
            {/* ... (Modals) ... */}
            {/* ... */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex items-center justify-center p-4">
                    {/* ... */}
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col animate-in fade-in zoom-in duration-200">
                        {/* ... */}
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
