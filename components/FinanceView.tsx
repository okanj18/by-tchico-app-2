import React, { useState, useMemo, useEffect } from 'react';
import { Depense, Commande, Boutique, RoleEmploye, Fournisseur, CommandeFournisseur, Client, CompteFinancier, TransactionTresorerie, TypeCompte, StatutCommande, StatutCommandeFournisseur } from '../types';
import { Wallet, TrendingUp, TrendingDown, DollarSign, Plus, Trash2, Building, Store, Scissors, BarChart2, FileText, Calendar, X, Printer, AlertOctagon, ArrowUpCircle, ArrowDownCircle, Landmark, Banknote, Smartphone, ArrowRightLeft, ArrowRight, Edit2 } from 'lucide-react';

interface FinanceViewProps {
    depenses: Depense[];
    commandes: Commande[];
    boutiques: Boutique[];
    onAddDepense: (d: Depense) => void;
    onDeleteDepense: (id: string) => void;
    onUpdateDepense: (d: Depense) => void; // Nouvelle prop
    userRole: RoleEmploye;
    userBoutiqueId?: string;
    fournisseurs: Fournisseur[];
    commandesFournisseurs: CommandeFournisseur[];
    clients: Client[];
    // NOUVELLES PROPS POUR LA GESTION CENTRALISÉE
    comptes: CompteFinancier[];
    transactions: TransactionTresorerie[];
    onUpdateComptes: (comptes: CompteFinancier[]) => void;
    onAddTransaction: (t: TransactionTresorerie) => void;
}

const FinanceView: React.FC<FinanceViewProps> = ({ 
    depenses, 
    commandes, 
    boutiques, 
    onAddDepense, 
    onDeleteDepense,
    onUpdateDepense,
    userRole, 
    userBoutiqueId,
    fournisseurs,
    commandesFournisseurs,
    clients,
    comptes,
    transactions,
    onUpdateComptes,
    onAddTransaction
}) => {
    // Si c'est un vendeur, on force l'onglet TREASURY par défaut
    const initialTab = userRole === RoleEmploye.VENDEUR ? 'TREASURY' : 'OVERVIEW';
    const [activeTab, setActiveTab] = useState<'OVERVIEW' | 'EXPENSES' | 'PROFITABILITY' | 'REPORTS' | 'TREASURY'>(initialTab);
    const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false);
    
    // Global Dashboard Date Filters
    const [dateStart, setDateStart] = useState('');
    const [dateEnd, setDateEnd] = useState('');

    // Filters for Expenses List
    const [expenseFilterBoutique, setExpenseFilterBoutique] = useState('ALL');
    const [expenseFilterCat, setExpenseFilterCat] = useState('ALL');

    // Report Filter States - CLIENTS
    const [showClientDebtModal, setShowClientDebtModal] = useState(false);
    const [clientDebtFilterStart, setClientDebtFilterStart] = useState('');
    const [clientDebtFilterEnd, setClientDebtFilterEnd] = useState('');
    const [clientDebtFilterId, setClientDebtFilterId] = useState('ALL'); 
    
    // Report Filter States - FOURNISSEURS
    const [showSupplierDebtModal, setShowSupplierDebtModal] = useState(false);
    const [supplierDebtFilter, setSupplierDebtFilter] = useState('ALL');
    const [supplierDebtFilterStart, setSupplierDebtFilterStart] = useState('');
    const [supplierDebtFilterEnd, setSupplierDebtFilterEnd] = useState('');

    // --- TREASURY STATE ---
    const [isAccountModalOpen, setIsAccountModalOpen] = useState(false);
    const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
    const [isOperationModalOpen, setIsOperationModalOpen] = useState(false); // Deposit/Withdraw
    
    const [newAccount, setNewAccount] = useState<Partial<CompteFinancier>>({ type: 'CAISSE', solde: 0, nom: '' });
    const [transferData, setTransferData] = useState({ sourceId: '', destId: '', montant: 0, description: '' });
    const [operationData, setOperationData] = useState({ compteId: '', type: 'ENCAISSEMENT' as 'ENCAISSEMENT' | 'DECAISSEMENT', montant: 0, description: '' });

    // Expense Form State
    const [isEditingExpense, setIsEditingExpense] = useState(false);
    const [editingExpenseId, setEditingExpenseId] = useState<string | null>(null);
    const [newExpense, setNewExpense] = useState<Partial<Depense>>({
        date: new Date().toISOString().split('T')[0],
        montant: 0,
        categorie: 'AUTRE',
        description: '',
        boutiqueId: userBoutiqueId || '',
        compteId: '' // Pour lier au compte
    });

    const isVendeur = userRole === RoleEmploye.VENDEUR;

    // Auto-set boutique if user is restricted
    useEffect(() => {
        if (userBoutiqueId) {
            setNewExpense(prev => ({ ...prev, boutiqueId: userBoutiqueId }));
            setExpenseFilterBoutique(userBoutiqueId);
        }
    }, [userBoutiqueId]);

    // --- FILTER LOGIC ---
    const isInDateRange = (dateStr: string) => {
        if (!dateStart && !dateEnd) return true;
        const d = new Date(dateStr).getTime();
        const start = dateStart ? new Date(dateStart).getTime() : -Infinity;
        // End date needs to include the full day
        const end = dateEnd ? new Date(dateEnd).setHours(23, 59, 59, 999) : Infinity;
        return d >= start && d <= end;
    };

    // Filtered Datasets for Calculations
    const statsCommandes = useMemo(() => commandes.filter(c => isInDateRange(c.dateCommande)), [commandes, dateStart, dateEnd]);
    const statsDepenses = useMemo(() => depenses.filter(d => isInDateRange(d.date)), [depenses, dateStart, dateEnd]);

    // --- CALCULATIONS (Based on Filtered Data) ---

    // 1. Overview Metrics
    const totalRecettes = statsCommandes.reduce((acc, c) => acc + c.avance, 0); 
    const totalDepenses = statsDepenses.reduce((acc, d) => acc + d.montant, 0);
    const soldeGlobal = totalRecettes - totalDepenses;

    // 2. Profitability Per Shop Logic
    const getBoutiqueStats = (bId: string) => {
        // Revenue: Based on Commandes linked to this shop
        const shopRevenue = statsCommandes
            .filter(c => c.boutiqueId === bId)
            .reduce((acc, c) => acc + c.avance, 0); // Cash in hand (Avances)

        const shopExpenses = statsDepenses
            .filter(d => d.boutiqueId === bId)
            .reduce((acc, d) => acc + d.montant, 0);

        return {
            revenue: shopRevenue,
            expenses: shopExpenses,
            profit: shopRevenue - shopExpenses
        };
    };

    // 3. Sales Reports Logic
    const salesReportData = useMemo(() => {
        const now = new Date();
        const currentMonth = now.getMonth();
        const currentYear = now.getFullYear();

        const report = boutiques.map(b => {
            // Filter only PRET_A_PORTER orders for this boutique
            const shopSales = commandes.filter(c => 
                c.boutiqueId === b.id && 
                c.type === 'PRET_A_PORTER' &&
                (c.statut === 'Livré' || c.reste === 0) 
            );

            // Calculate Month Total
            const monthTotal = shopSales
                .filter(c => {
                    const d = new Date(c.dateCommande);
                    return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
                })
                .reduce((acc, c) => acc + c.prixTotal, 0);

            // Calculate Year Total
            const yearTotal = shopSales
                .filter(c => new Date(c.dateCommande).getFullYear() === currentYear)
                .reduce((acc, c) => acc + c.prixTotal, 0);

            return {
                id: b.id,
                name: b.nom,
                monthTotal,
                yearTotal
            };
        });

        // Add Global Totals
        const globalMonth = report.reduce((acc, r) => acc + r.monthTotal, 0);
        const globalYear = report.reduce((acc, r) => acc + r.yearTotal, 0);

        return { data: report, globalMonth, globalYear };
    }, [commandes, boutiques]);

    // Calcul des impayés Clients pour le rapport avec filtres de période et client
    const reportClientDebts = useMemo(() => {
        return commandes.filter(c => {
            const isUnpaid = c.reste > 0;
            const notCancelled = c.statut !== StatutCommande.ANNULE;
            
            const date = new Date(c.dateCommande).getTime();
            const start = clientDebtFilterStart ? new Date(clientDebtFilterStart).getTime() : -Infinity;
            const end = clientDebtFilterEnd ? new Date(clientDebtFilterEnd).setHours(23, 59, 59, 999) : Infinity;
            
            const matchesClient = clientDebtFilterId === 'ALL' || c.clientId === clientDebtFilterId;

            return isUnpaid && notCancelled && date >= start && date <= end && matchesClient;
        }).sort((a, b) => new Date(a.dateCommande).getTime() - new Date(b.dateCommande).getTime());
    }, [commandes, clientDebtFilterStart, clientDebtFilterEnd, clientDebtFilterId]);

    const reportClientTotal = reportClientDebts.reduce((acc, c) => acc + c.reste, 0);

    // Calcul des dettes Fournisseurs pour le rapport avec filtres de période
    const reportSupplierDebts = useMemo(() => {
        return commandesFournisseurs.filter(c => {
            const unpaid = c.montantTotal - c.montantPaye;
            const matchesSupplier = supplierDebtFilter === 'ALL' || c.fournisseurId === supplierDebtFilter;
            
            const date = new Date(c.dateCommande).getTime();
            const start = supplierDebtFilterStart ? new Date(supplierDebtFilterStart).getTime() : -Infinity;
            const end = supplierDebtFilterEnd ? new Date(supplierDebtFilterEnd).setHours(23, 59, 59, 999) : Infinity;

            return unpaid > 0 && matchesSupplier && c.statut !== StatutCommandeFournisseur.ANNULE && date >= start && date <= end;
        }).sort((a, b) => new Date(a.dateCommande).getTime() - new Date(b.dateCommande).getTime());
    }, [commandesFournisseurs, supplierDebtFilter, supplierDebtFilterStart, supplierDebtFilterEnd]);

    const reportSupplierTotal = reportSupplierDebts.reduce((acc, c) => acc + (c.montantTotal - c.montantPaye), 0);

    const handlePrintReport = (title: string, elementId: string) => {
        const content = document.getElementById(elementId)?.innerHTML;
        if (!content) return;
        
        const printWindow = window.open('', '', 'width=900,height=600');
        if (!printWindow) return;

        printWindow.document.write(`
            <html>
                <head>
                    <title>${title}</title>
                    <style>
                        body { font-family: system-ui, -apple-system, sans-serif; padding: 20px; color: #333; }
                        h2 { text-align: center; margin-bottom: 5px; }
                        .subtitle { text-align: center; font-size: 12px; color: #666; margin-bottom: 20px; }
                        table { width: 100%; border-collapse: collapse; font-size: 12px; }
                        th { background-color: #f3f4f6; font-weight: bold; text-align: left; padding: 8px; border-bottom: 2px solid #ddd; }
                        td { padding: 8px; border-bottom: 1px solid #eee; }
                        .text-right { text-align: right; }
                        .font-bold { font-weight: bold; }
                        .text-red-600 { color: #dc2626; }
                        .total-row td { border-top: 2px solid #333; font-weight: bold; background-color: #fafafa; }
                    </style>
                </head>
                <body>
                    <h2>${title}</h2>
                    <div class="subtitle">Généré le ${new Date().toLocaleString()}</div>
                    ${content}
                    <script>
                        window.print();
                        setTimeout(() => window.close(), 1000);
                    </script>
                </body>
            </html>
        `);
        printWindow.document.close();
    };

    // --- TREASURY HANDLERS ---
    const handleAddAccount = () => {
        if (!newAccount.nom) return;
        const compte: CompteFinancier = {
            id: `CPT_${Date.now()}`,
            nom: newAccount.nom,
            type: newAccount.type || 'CAISSE',
            solde: newAccount.solde || 0,
            numero: newAccount.numero,
            boutiqueId: newAccount.boutiqueId
        };
        onUpdateComptes([...comptes, compte]);
        setIsAccountModalOpen(false);
        setNewAccount({ type: 'CAISSE', solde: 0, nom: '' });
    };

    const handleTransfer = () => {
        if (!transferData.sourceId || !transferData.destId || transferData.montant <= 0) return;
        
        const source = comptes.find(c => c.id === transferData.sourceId);
        if (!source || source.solde < transferData.montant) {
            alert("Solde insuffisant sur le compte source.");
            return;
        }

        // Update Balances
        const updatedComptes = comptes.map(c => {
            if (c.id === transferData.sourceId) return { ...c, solde: c.solde - transferData.montant };
            if (c.id === transferData.destId) return { ...c, solde: c.solde + transferData.montant };
            return c;
        });
        onUpdateComptes(updatedComptes);

        // Record Transactions
        const tOut: TransactionTresorerie = {
            id: `TR_${Date.now()}_OUT`,
            date: new Date().toISOString(),
            type: 'VIREMENT_SORTANT',
            montant: transferData.montant,
            compteId: transferData.sourceId,
            compteDestinationId: transferData.destId,
            description: transferData.description || 'Virement sortant',
            categorie: 'VIREMENT'
        };
        const tIn: TransactionTresorerie = {
            id: `TR_${Date.now()}_IN`,
            date: new Date().toISOString(),
            type: 'VIREMENT_ENTRANT',
            montant: transferData.montant,
            compteId: transferData.destId,
            description: transferData.description || 'Virement entrant',
            categorie: 'VIREMENT'
        };

        onAddTransaction(tOut);
        onAddTransaction(tIn);
        setIsTransferModalOpen(false);
        setTransferData({ sourceId: '', destId: '', montant: 0, description: '' });
    };

    const handleOperation = () => {
        if (!operationData.compteId || operationData.montant <= 0) return;

        const compte = comptes.find(c => c.id === operationData.compteId);
        if (!compte) return;

        if (operationData.type === 'DECAISSEMENT' && compte.solde < operationData.montant) {
            alert("Solde insuffisant.");
            return;
        }

        const updatedComptes = comptes.map(c => {
            if (c.id === operationData.compteId) {
                return {
                    ...c,
                    solde: operationData.type === 'ENCAISSEMENT' ? c.solde + operationData.montant : c.solde - operationData.montant
                };
            }
            return c;
        });
        onUpdateComptes(updatedComptes);

        const t: TransactionTresorerie = {
            id: `TR_${Date.now()}_OP`,
            date: new Date().toISOString(),
            type: operationData.type,
            montant: operationData.montant,
            compteId: operationData.compteId,
            description: operationData.description || (operationData.type === 'ENCAISSEMENT' ? 'Dépôt manuel' : 'Retrait manuel'),
            categorie: 'MANUEL'
        };

        onAddTransaction(t);
        setIsOperationModalOpen(false);
        setOperationData({ compteId: '', type: 'ENCAISSEMENT', montant: 0, description: '' });
    };

    const openAddExpenseModal = () => {
        setNewExpense({
            date: new Date().toISOString().split('T')[0],
            montant: 0,
            categorie: 'AUTRE',
            description: '',
            boutiqueId: userBoutiqueId || '',
            compteId: ''
        });
        setIsEditingExpense(false);
        setEditingExpenseId(null);
        setIsExpenseModalOpen(true);
    };

    const openEditExpenseModal = (d: Depense) => {
        setNewExpense({ ...d });
        setIsEditingExpense(true);
        setEditingExpenseId(d.id);
        setIsExpenseModalOpen(true);
    };

    const handleSaveExpense = () => {
        if (!newExpense.montant || !newExpense.description) {
            alert("Montant et description requis.");
            return;
        }

        // Si on crée une nouvelle dépense avec compte, vérif solde
        if (!isEditingExpense && newExpense.compteId) {
            const compte = comptes.find(c => c.id === newExpense.compteId);
            if (compte && compte.solde < (newExpense.montant || 0)) {
                if(!window.confirm(`⚠️ ATTENTION: Solde insuffisant sur ${compte.nom} (${compte.solde.toLocaleString()} F). Le solde sera négatif. Continuer ?`)) {
                    return;
                }
            }
        }

        if (isEditingExpense && editingExpenseId) {
            // MODE MODIFICATION
            const updated: Depense = {
                id: editingExpenseId,
                date: newExpense.date || new Date().toISOString(),
                montant: newExpense.montant || 0,
                categorie: newExpense.categorie as any,
                description: newExpense.description || '',
                boutiqueId: newExpense.boutiqueId || undefined,
                compteId: newExpense.compteId // On garde l'id compte, attention aux changements
            };
            
            onUpdateDepense(updated);

        } else {
            // MODE CRÉATION
            const d: Depense = {
                id: `D${Date.now()}`,
                date: newExpense.date || new Date().toISOString(),
                montant: newExpense.montant || 0,
                categorie: newExpense.categorie as any,
                description: newExpense.description || '',
                boutiqueId: newExpense.boutiqueId || undefined,
                compteId: newExpense.compteId
            };
            onAddDepense(d);
        }

        setIsExpenseModalOpen(false);
    };

    const handleDeleteClick = (id: string) => {
        if(window.confirm("Êtes-vous sûr de vouloir supprimer cette dépense ?")) {
            onDeleteDepense(id);
        }
    };

    // ... (Filter Logic and other UI helper functions unchanged) ...
    const filteredDepensesList = depenses.filter(d => {
        if (!isInDateRange(d.date)) return false;
        if (expenseFilterBoutique !== 'ALL') {
            if (expenseFilterBoutique === 'GENERAL') {
                if (d.boutiqueId) return false;
            } else {
                if (d.boutiqueId !== expenseFilterBoutique) return false;
            }
        }
        if (expenseFilterCat !== 'ALL') {
            if (d.categorie !== expenseFilterCat) return false;
        }
        return true;
    }).sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    // NOUVEAU : FILTRAGE DES TRANSACTIONS POUR LA VUE TRESORERIE
    const filteredTransactions = useMemo(() => {
        return transactions
            .filter(t => isInDateRange(t.date))
            .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }, [transactions, dateStart, dateEnd]);

    const getAccountIcon = (type: TypeCompte) => {
        switch(type) {
            case 'BANQUE': return <Landmark size={24} className="text-blue-600" />;
            case 'MOBILE_MONEY': return <Smartphone size={24} className="text-orange-600" />;
            default: return <Banknote size={24} className="text-green-600" />;
        }
    };

    return (
        <div className="h-[calc(100vh-8rem)] flex flex-col space-y-6">
            {/* ... (Header and Tabs code unchanged) ... */}
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                        <Wallet className="text-brand-600" />
                        Finance & Rentabilité
                    </h2>
                    {/* Period Indicator */}
                    <div className="flex items-center gap-2 text-xs text-gray-500 mt-1">
                        <Calendar size={12} />
                        {dateStart || dateEnd ? (
                            <span>
                                Période : 
                                <span className="font-bold text-brand-700 ml-1">
                                    {dateStart ? new Date(dateStart).toLocaleDateString() : 'Début'} 
                                    {' → '} 
                                    {dateEnd ? new Date(dateEnd).toLocaleDateString() : 'Aujourd\'hui'}
                                </span>
                            </span>
                        ) : (
                            <span>Période : <span className="font-bold text-gray-700">Tout l'historique</span></span>
                        )}
                        {(dateStart || dateEnd) && (
                            <button onClick={() => { setDateStart(''); setDateEnd(''); }} className="text-red-500 hover:underline ml-2" title="Effacer filtres">
                                <X size={12} />
                            </button>
                        )}
                    </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-3 w-full lg:w-auto items-end">
                    {/* Date Filters */}
                    <div className="flex items-center bg-white border border-gray-300 rounded-lg p-1 shadow-sm">
                        <div className="px-2 border-r border-gray-200">
                            <span className="text-[10px] text-gray-400 uppercase font-bold block">Du</span>
                            <input 
                                type="date" 
                                className="text-xs font-medium bg-transparent focus:outline-none text-gray-700"
                                value={dateStart}
                                onChange={e => setDateStart(e.target.value)}
                            />
                        </div>
                        <div className="px-2">
                            <span className="text-[10px] text-gray-400 uppercase font-bold block">Au</span>
                            <input 
                                type="date" 
                                className="text-xs font-medium bg-transparent focus:outline-none text-gray-700"
                                value={dateEnd}
                                onChange={e => setDateEnd(e.target.value)}
                            />
                        </div>
                    </div>

                    <div className="flex bg-gray-100 p-1 rounded-lg overflow-x-auto max-w-full">
                        {!isVendeur && (
                            <button 
                                onClick={() => setActiveTab('OVERVIEW')}
                                className={`px-3 py-1.5 text-xs sm:text-sm font-medium rounded-md transition-all whitespace-nowrap ${activeTab === 'OVERVIEW' ? 'bg-white text-brand-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                            >
                                Vue d'ensemble
                            </button>
                        )}
                        <button 
                            onClick={() => setActiveTab('TREASURY')}
                            className={`px-3 py-1.5 text-xs sm:text-sm font-medium rounded-md transition-all whitespace-nowrap flex items-center gap-1 ${activeTab === 'TREASURY' ? 'bg-white text-brand-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                        >
                            <Building size={14} /> Trésorerie
                        </button>
                        {!isVendeur && (
                            <button 
                                onClick={() => setActiveTab('PROFITABILITY')}
                                className={`px-3 py-1.5 text-xs sm:text-sm font-medium rounded-md transition-all whitespace-nowrap ${activeTab === 'PROFITABILITY' ? 'bg-white text-brand-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                            >
                                Rentabilité
                            </button>
                        )}
                        {!isVendeur && (
                            <button 
                                onClick={() => setActiveTab('REPORTS')}
                                className={`px-3 py-1.5 text-xs sm:text-sm font-medium rounded-md transition-all whitespace-nowrap flex items-center gap-1 ${activeTab === 'REPORTS' ? 'bg-white text-brand-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                            >
                                <BarChart2 size={14} /> Rapports
                            </button>
                        )}
                        <button 
                            onClick={() => setActiveTab('EXPENSES')}
                            className={`px-3 py-1.5 text-xs sm:text-sm font-medium rounded-md transition-all whitespace-nowrap ${activeTab === 'EXPENSES' ? 'bg-white text-brand-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                        >
                            Dépenses
                        </button>
                    </div>
                </div>
            </div>

            {/* TAB CONTENT */}
            <div className="flex-1 overflow-y-auto">
                {activeTab === 'OVERVIEW' && !isVendeur && (
                    <div className="space-y-6">
                        {/* KPI Cards */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <div className="bg-white p-6 rounded-xl shadow-sm border-l-4 border-green-500">
                                <div className="flex items-center justify-between mb-2">
                                    <h3 className="text-gray-500 font-medium text-sm">Recettes (Période)</h3>
                                    <TrendingUp className="text-green-500" size={20} />
                                </div>
                                <p className="text-3xl font-bold text-gray-900">{totalRecettes.toLocaleString()} <span className="text-sm font-normal text-gray-500">F</span></p>
                            </div>
                            <div className="bg-white p-6 rounded-xl shadow-sm border-l-4 border-red-500">
                                <div className="flex items-center justify-between mb-2">
                                    <h3 className="text-gray-500 font-medium text-sm">Dépenses (Période)</h3>
                                    <TrendingDown className="text-red-500" size={20} />
                                </div>
                                <p className="text-3xl font-bold text-gray-900">{totalDepenses.toLocaleString()} <span className="text-sm font-normal text-gray-500">F</span></p>
                            </div>
                            <div className="bg-white p-6 rounded-xl shadow-sm border-l-4 border-brand-500">
                                <div className="flex items-center justify-between mb-2">
                                    <h3 className="text-gray-500 font-medium text-sm">Résultat (Période)</h3>
                                    <DollarSign className="text-brand-500" size={20} />
                                </div>
                                <p className={`text-3xl font-bold ${soldeGlobal >= 0 ? 'text-gray-900' : 'text-red-600'}`}>
                                    {soldeGlobal.toLocaleString()} <span className="text-sm font-normal text-gray-500">F</span>
                                </p>
                            </div>
                        </div>

                         {/* Quick Actions */}
                         <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <button
                                onClick={openAddExpenseModal}
                                className="bg-white p-5 rounded-xl border-2 border-dashed border-red-200 hover:border-red-400 hover:bg-red-50 transition-all group text-left shadow-sm"
                            >
                                <div className="flex items-center gap-3 mb-2">
                                    <div className="p-3 bg-red-100 text-red-600 rounded-full group-hover:bg-red-200 transition-colors">
                                        <Plus size={24} />
                                    </div>
                                    <div>
                                        <h3 className="font-bold text-red-700 text-lg">Nouvelle Dépense</h3>
                                        <p className="text-sm text-gray-500">Loyer, Électricité, Restauration...</p>
                                    </div>
                                </div>
                                <div className="flex items-center text-xs text-red-600 font-medium mt-2">
                                    Enregistrer une sortie d'argent <ArrowRight size={12} className="ml-1" />
                                </div>
                            </button>

                            <div className="bg-blue-50 p-6 rounded-xl border border-blue-100 flex items-start gap-4">
                                <Store className="text-blue-600 shrink-0 mt-1" />
                                <div>
                                    <h3 className="font-bold text-blue-900">Conseil de Gestion</h3>
                                    <p className="text-blue-800 text-sm mt-1">
                                        Pour une gestion précise, sélectionnez le compte (Caisse/Banque) lors de la création d'une dépense. Cela mettra à jour votre trésorerie automatiquement.
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'TREASURY' && (
                    <div className="space-y-6">
                        {/* ... Treasury Content Unchanged ... */}
                        <div className="flex justify-between items-center">
                            <h3 className="text-lg font-bold text-gray-700">Comptes Financiers / Caisse</h3>
                            <div className="flex gap-2">
                                <button onClick={() => { setOperationData({...operationData, type: 'ENCAISSEMENT'}); setIsOperationModalOpen(true); }} className="bg-green-600 hover:bg-green-700 text-white px-3 py-2 rounded-lg text-sm font-bold flex items-center gap-2">
                                    <ArrowUpCircle size={16} /> Dépôt
                                </button>
                                <button onClick={() => { setOperationData({...operationData, type: 'DECAISSEMENT'}); setIsOperationModalOpen(true); }} className="bg-red-600 hover:bg-red-700 text-white px-3 py-2 rounded-lg text-sm font-bold flex items-center gap-2">
                                    <ArrowDownCircle size={16} /> Retrait
                                </button>
                                {!isVendeur && (
                                    <>
                                        <button onClick={() => setIsTransferModalOpen(true)} className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded-lg text-sm font-bold flex items-center gap-2">
                                            <ArrowRightLeft size={16} /> Virement
                                        </button>
                                        <button onClick={() => setIsAccountModalOpen(true)} className="bg-gray-800 hover:bg-gray-900 text-white px-3 py-2 rounded-lg text-sm font-bold flex items-center gap-2">
                                            <Plus size={16} /> Créer Compte
                                        </button>
                                    </>
                                )}
                            </div>
                        </div>

                        {/* Account Cards */}
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {comptes.map(compte => (
                                <div key={compte.id} className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 relative overflow-hidden">
                                    <div className="flex justify-between items-start mb-4">
                                        <div className="flex items-center gap-3">
                                            <div className="p-2 bg-gray-50 rounded-lg border border-gray-100">
                                                {getAccountIcon(compte.type)}
                                            </div>
                                            <div>
                                                <h4 className="font-bold text-gray-800">{compte.nom}</h4>
                                                <span className="text-xs text-gray-500 uppercase">{compte.type}</span>
                                            </div>
                                        </div>
                                        {compte.boutiqueId && (
                                            <span className="bg-gray-100 text-gray-600 text-[10px] px-2 py-1 rounded-full">
                                                {boutiques.find(b => b.id === compte.boutiqueId)?.nom}
                                            </span>
                                        )}
                                    </div>
                                    <div className="text-2xl font-bold text-gray-900 mb-1">{compte.solde.toLocaleString()} F</div>
                                    <div className="text-xs text-gray-400 font-mono">{compte.numero || 'Aucun numéro'}</div>
                                    
                                    {/* Mini graph/trend placeholder */}
                                    <div className="absolute -bottom-4 -right-4 text-gray-100 opacity-50">
                                        {getAccountIcon(compte.type)}
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Recent Transactions - FILTRED */}
                        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                            <div className="p-4 border-b border-gray-100 bg-gray-50">
                                <h3 className="font-bold text-gray-700 text-sm uppercase">
                                    {dateStart || dateEnd ? 'Mouvements (Filtrés)' : 'Derniers Mouvements'}
                                </h3>
                            </div>
                            <table className="w-full text-sm text-left">
                                <thead className="bg-white text-gray-500 border-b border-gray-100">
                                    <tr>
                                        <th className="px-4 py-3">Date</th>
                                        <th className="px-4 py-3">Type</th>
                                        <th className="px-4 py-3">Compte</th>
                                        <th className="px-4 py-3">Description</th>
                                        <th className="px-4 py-3 text-right">Montant</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {filteredTransactions.map(t => {
                                        const compte = comptes.find(c => c.id === t.compteId);
                                        const isPositive = t.type === 'ENCAISSEMENT' || t.type === 'VIREMENT_ENTRANT';
                                        return (
                                            <tr key={t.id} className="hover:bg-gray-50">
                                                <td className="px-4 py-3 text-gray-500">{new Date(t.date).toLocaleDateString()}</td>
                                                <td className="px-4 py-3">
                                                    <span className={`px-2 py-1 rounded text-xs font-bold ${
                                                        t.type.includes('VIREMENT') ? 'bg-blue-50 text-blue-700' :
                                                        t.type === 'ENCAISSEMENT' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
                                                    }`}>
                                                        {t.type.replace('_', ' ')}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3 font-medium text-gray-800">{compte?.nom}</td>
                                                <td className="px-4 py-3 text-gray-600">{t.description}</td>
                                                <td className={`px-4 py-3 text-right font-bold ${isPositive ? 'text-green-600' : 'text-red-600'}`}>
                                                    {isPositive ? '+' : '-'}{t.montant.toLocaleString()}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                    {filteredTransactions.length === 0 && (
                                        <tr>
                                            <td colSpan={5} className="text-center py-8 text-gray-400">Aucune transaction enregistrée dans cette période.</td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {/* ... (Existing Profitability & Reports sections unchanged) ... */}
                {activeTab === 'PROFITABILITY' && !isVendeur && (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {boutiques.map(boutique => {
                            const stats = getBoutiqueStats(boutique.id);
                            const isProfitable = stats.profit >= 0;
                            const isAtelier = boutique.id === 'ATELIER';
                            
                            return (
                                <div key={boutique.id} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                                    <div className="bg-gray-50 p-4 border-b border-gray-100 flex justify-between items-center">
                                        <div className="flex items-center gap-3">
                                            <div className="p-2 bg-white rounded-lg border border-gray-200">
                                                {isAtelier ? <Scissors size={20} className="text-gray-600"/> : <Store size={20} className="text-brand-600"/>}
                                            </div>
                                            <div>
                                                <h3 className="font-bold text-gray-800">{boutique.nom}</h3>
                                                <p className="text-xs text-gray-500">{boutique.lieu}</p>
                                            </div>
                                        </div>
                                        <span className={`px-2 py-1 rounded text-xs font-bold ${isProfitable ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                            {isProfitable ? 'Bénéficiaire' : 'Déficitaire'}
                                        </span>
                                    </div>
                                    <div className="p-6">
                                        <div className="grid grid-cols-2 gap-y-4">
                                            <div className="text-sm text-gray-500">Chiffre d'Affaires</div>
                                            <div className="text-right font-bold text-gray-900">{stats.revenue.toLocaleString()} F</div>
                                            
                                            <div className="text-sm text-gray-500">Dépenses & Charges</div>
                                            <div className="text-right font-bold text-red-600">-{stats.expenses.toLocaleString()} F</div>
                                            
                                            <div className="col-span-2 border-t border-gray-100 my-2"></div>
                                            
                                            <div className="font-bold text-gray-800">Résultat Net</div>
                                            <div className={`text-right font-bold text-xl ${isProfitable ? 'text-green-600' : 'text-red-600'}`}>
                                                {stats.profit.toLocaleString()} F
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                        
                        {!userBoutiqueId && (
                             <div className="bg-gray-100 rounded-xl shadow-sm border border-gray-200 overflow-hidden opacity-80">
                                <div className="p-4 border-b border-gray-200 flex justify-between items-center">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2 bg-white rounded-lg border border-gray-200">
                                            <Building size={20} className="text-gray-600"/>
                                        </div>
                                        <div>
                                            <h3 className="font-bold text-gray-700">Charges Générales (Siège)</h3>
                                            <p className="text-xs text-gray-500">Non affectées à une boutique</p>
                                        </div>
                                    </div>
                                </div>
                                <div className="p-6">
                                    <div className="flex justify-between items-center">
                                        <span className="text-gray-600">Total Charges Communes</span>
                                        <span className="font-bold text-red-600 text-xl">
                                            -{statsDepenses.filter(d => !d.boutiqueId).reduce((acc, d) => acc + d.montant, 0).toLocaleString()} F
                                        </span>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* ... (REPORTS Tab UNCHANGED) ... */}
                {activeTab === 'REPORTS' && !isVendeur && (
                    <div className="flex flex-col gap-6">
                        {/* ... (Same Report UI) ... */}
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                            {/* Card 1: Client Debts */}
                            <div className="bg-white rounded-xl shadow-sm border border-red-100 p-4 relative overflow-hidden group">
                                <div className="absolute right-0 top-0 h-full w-1 bg-red-500"></div>
                                <div className="flex justify-between items-start mb-2">
                                    <div>
                                        <p className="text-xs font-bold text-gray-500 uppercase">Créances Clients</p>
                                        <h3 className="text-2xl font-bold text-red-600 mt-1">{reportClientTotal.toLocaleString()} F</h3>
                                    </div>
                                    <div className="p-2 bg-red-50 rounded-full text-red-500"><AlertOctagon size={20}/></div>
                                </div>
                                <button 
                                    onClick={() => setShowClientDebtModal(true)}
                                    className="w-full mt-2 py-1.5 text-xs font-bold text-red-600 bg-red-50 hover:bg-red-100 rounded transition-colors flex items-center justify-center gap-1"
                                >
                                    <Printer size={12} /> Voir Liste Impayés
                                </button>
                            </div>

                            {/* Card 2: Supplier Debts */}
                            <div className="bg-white rounded-xl shadow-sm border border-orange-100 p-4 relative overflow-hidden group">
                                <div className="absolute right-0 top-0 h-full w-1 bg-orange-500"></div>
                                <div className="flex justify-between items-start mb-2">
                                    <div>
                                        <p className="text-xs font-bold text-gray-500 uppercase">Dettes Fournisseurs</p>
                                        <h3 className="text-2xl font-bold text-orange-600 mt-1">{reportSupplierTotal.toLocaleString()} F</h3>
                                    </div>
                                    <div className="p-2 bg-orange-50 rounded-full text-orange-500"><ArrowDownCircle size={20}/></div>
                                </div>
                                <button 
                                    onClick={() => setShowSupplierDebtModal(true)}
                                    className="w-full mt-2 py-1.5 text-xs font-bold text-orange-600 bg-orange-50 hover:bg-orange-100 rounded transition-colors flex items-center justify-center gap-1"
                                >
                                    <Printer size={12} /> Voir Liste Dettes
                                </button>
                            </div>

                            {/* Card 3: Net Cash Flow (Theoretical) */}
                            <div className="bg-white rounded-xl shadow-sm border border-blue-100 p-4 relative overflow-hidden group">
                                <div className="absolute right-0 top-0 h-full w-1 bg-blue-500"></div>
                                <div className="flex justify-between items-start mb-2">
                                    <div>
                                        <p className="text-xs font-bold text-gray-500 uppercase">Trésorerie (Période)</p>
                                        <h3 className={`text-2xl font-bold mt-1 ${soldeGlobal >= 0 ? 'text-blue-600' : 'text-red-500'}`}>
                                            {soldeGlobal > 0 ? '+' : ''}{soldeGlobal.toLocaleString()} F
                                        </h3>
                                    </div>
                                    <div className="p-2 bg-blue-50 rounded-full text-blue-500"><Wallet size={20}/></div>
                                </div>
                                <div className="text-[10px] text-gray-400 mt-3 italic text-center">
                                    Recettes - Dépenses (Calculé sur filtres date)
                                </div>
                            </div>

                            {/* Card 4: Placeholder / Stock Value */}
                            <div className="bg-gray-50 rounded-xl shadow-sm border border-gray-200 p-4 flex flex-col justify-center items-center text-center opacity-70">
                                <BarChart2 size={24} className="text-gray-400 mb-2"/>
                                <p className="text-xs text-gray-500">Plus de rapports à venir...</p>
                            </div>
                        </div>

                        {/* Detailed Reports Grid */}
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-full">
                            {/* Sales Report Table */}
                            <div className="bg-white rounded-xl shadow-sm border border-gray-200 flex flex-col h-full">
                                <div className="p-4 border-b border-gray-100 bg-gray-50 rounded-t-xl">
                                    <div className="flex items-center gap-2">
                                        <FileText size={18} className="text-brand-600"/>
                                        <h3 className="font-bold text-gray-700">Performance Commerciale</h3>
                                    </div>
                                </div>
                                <div className="p-4 overflow-auto">
                                    <table className="w-full text-left border-collapse">
                                        <thead>
                                            <tr className="bg-white text-gray-500 text-xs border-b border-gray-100 uppercase tracking-wider">
                                                <th className="py-2 px-3 font-bold">Boutique</th>
                                                <th className="py-2 px-3 font-bold text-right">Mois en Cours</th>
                                                <th className="py-2 px-3 font-bold text-right">Année en Cours</th>
                                            </tr>
                                        </thead>
                                        <tbody className="text-sm">
                                            {salesReportData.data.map(item => (
                                                <tr key={item.id} className="border-b border-gray-50 hover:bg-gray-50">
                                                    <td className="py-3 px-3 font-medium text-gray-800">{item.name}</td>
                                                    <td className="py-3 px-3 text-right font-medium text-blue-700">
                                                        {item.monthTotal.toLocaleString()} F
                                                    </td>
                                                    <td className="py-3 px-3 text-right font-medium text-gray-900">
                                                        {item.yearTotal.toLocaleString()} F
                                                    </td>
                                                </tr>
                                            ))}
                                            <tr className="bg-brand-50 font-bold text-brand-900">
                                                <td className="py-3 px-3 text-xs uppercase">Total Global</td>
                                                <td className="py-3 px-3 text-right">{salesReportData.globalMonth.toLocaleString()} F</td>
                                                <td className="py-3 px-3 text-right">{salesReportData.globalYear.toLocaleString()} F</td>
                                            </tr>
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'EXPENSES' && (
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 flex flex-col h-full">
                        {/* ... Existing Expenses Tab Content ... */}
                        <div className="p-4 border-b border-gray-100 flex flex-col sm:flex-row justify-between items-center gap-4">
                            <div className="flex gap-2 w-full sm:w-auto">
                                {!userBoutiqueId && (
                                    <select 
                                        className="p-2 border border-gray-300 rounded text-sm"
                                        value={expenseFilterBoutique}
                                        onChange={e => setExpenseFilterBoutique(e.target.value)}
                                    >
                                        <option value="ALL">Toutes les Boutiques</option>
                                        <option value="GENERAL">Général (Siège)</option>
                                        {boutiques.map(b => <option key={b.id} value={b.id}>{b.nom}</option>)}
                                    </select>
                                )}
                                <select 
                                    className="p-2 border border-gray-300 rounded text-sm"
                                    value={expenseFilterCat}
                                    onChange={e => setExpenseFilterCat(e.target.value)}
                                >
                                    <option value="ALL">Toutes Catégories</option>
                                    <option value="LOYER">Loyer</option>
                                    <option value="SALAIRE">Salaire</option>
                                    <option value="MATIERE_PREMIERE">Matière Première</option>
                                    <option value="LOGISTIQUE">Logistique</option>
                                    <option value="FOIRE_EXPO">Foire & Exposition</option>
                                    <option value="ELECTRICITE">Électricité / Eau / Internet</option>
                                    <option value="RESTAURATION">Restauration</option>
                                    <option value="AUTRE">Autre</option>
                                </select>
                            </div>
                            <button 
                                onClick={openAddExpenseModal}
                                className="bg-brand-600 hover:bg-brand-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 font-medium transition-colors"
                            >
                                <Plus size={18} /> Nouvelle Dépense
                            </button>
                        </div>
                        <div className="flex-1 overflow-auto">
                             <table className="w-full text-sm text-left">
                                <thead className="bg-gray-50 text-gray-500 font-medium sticky top-0">
                                    <tr>
                                        <th className="px-4 py-3">Date</th>
                                        <th className="px-4 py-3">Catégorie</th>
                                        <th className="px-4 py-3">Description</th>
                                        <th className="px-4 py-3">Affectation / Compte</th>
                                        <th className="px-4 py-3 text-right">Montant</th>
                                        <th className="px-4 py-3 w-10 text-center">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {filteredDepensesList.map(d => {
                                        const shopName = d.boutiqueId ? boutiques.find(b => b.id === d.boutiqueId)?.nom : 'Général / Siège';
                                        const compteName = d.compteId ? comptes.find(c => c.id === d.compteId)?.nom : null;
                                        return (
                                            <tr key={d.id} className="hover:bg-gray-50">
                                                <td className="px-4 py-3 text-gray-500">{new Date(d.date).toLocaleDateString()}</td>
                                                <td className="px-4 py-3">
                                                    <span className="px-2 py-1 bg-gray-100 rounded text-xs text-gray-600 font-medium border border-gray-200">
                                                        {d.categorie}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3 text-gray-800">{d.description}</td>
                                                <td className="px-4 py-3 text-gray-500 text-xs italic">
                                                    <div>{shopName}</div>
                                                    {compteName && <div className="text-[10px] text-blue-600 font-bold flex items-center gap-1 mt-0.5"><Wallet size={10}/> {compteName}</div>}
                                                </td>
                                                <td className="px-4 py-3 text-right font-bold text-red-600">-{d.montant.toLocaleString()}</td>
                                                <td className="px-4 py-3 text-right">
                                                    <div className="flex items-center justify-end gap-1">
                                                        <button onClick={() => openEditExpenseModal(d)} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors" title="Modifier">
                                                            <Edit2 size={16} />
                                                        </button>
                                                        <button onClick={() => handleDeleteClick(d.id)} className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors" title="Supprimer">
                                                            <Trash2 size={16} />
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                    {filteredDepensesList.length === 0 && (
                                        <tr>
                                            <td colSpan={6} className="text-center py-8 text-gray-400">Aucune dépense trouvée pour cette période.</td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </div>

            {/* Modal Dépense */}
            {isExpenseModalOpen && (
                <div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg p-6 animate-in fade-in zoom-in duration-200">
                        <h3 className="text-xl font-bold mb-4 flex items-center gap-2 text-gray-800">
                            {isEditingExpense ? <Edit2 className="text-blue-600" /> : <TrendingDown className="text-red-600" />}
                            {isEditingExpense ? 'Modifier Dépense' : 'Enregistrer Dépense'}
                        </h3>
                        
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
                                <input 
                                    type="date" 
                                    className="w-full p-2 border border-gray-300 rounded"
                                    value={newExpense.date}
                                    onChange={e => setNewExpense({...newExpense, date: e.target.value})}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Montant (FCFA)</label>
                                <input 
                                    type="number" 
                                    className="w-full p-2 border border-gray-300 rounded font-bold"
                                    value={newExpense.montant || ''}
                                    onChange={e => setNewExpense({...newExpense, montant: parseInt(e.target.value) || 0})}
                                    placeholder="0"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Catégorie</label>
                                <select 
                                    className="w-full p-2 border border-gray-300 rounded"
                                    value={newExpense.categorie}
                                    onChange={e => setNewExpense({...newExpense, categorie: e.target.value as any})}
                                >
                                    <option value="MATIERE_PREMIERE">Matière Première</option>
                                    <option value="SALAIRE">Salaire</option>
                                    <option value="LOYER">Loyer</option>
                                    <option value="LOGISTIQUE">Logistique / Transport</option>
                                    <option value="FOIRE_EXPO">Foire & Exposition</option>
                                    <option value="ELECTRICITE">Électricité / Eau / Internet</option>
                                    <option value="RESTAURATION">Restauration</option>
                                    <option value="AUTRE">Autre</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Compte de Paiement (Source)</label>
                                <select 
                                    className={`w-full p-2 border border-gray-300 rounded bg-blue-50 border-blue-200 ${isEditingExpense ? 'opacity-70 cursor-not-allowed' : ''}`}
                                    value={newExpense.compteId || ''}
                                    onChange={e => setNewExpense({...newExpense, compteId: e.target.value})}
                                    disabled={isEditingExpense && !!newExpense.compteId} // On évite de changer le compte en édition pour simplifier la logique
                                >
                                    <option value="">-- Aucun (Non débité) --</option>
                                    {comptes.map(c => (
                                        <option key={c.id} value={c.id}>{c.nom} (Solde: {c.solde.toLocaleString()} F)</option>
                                    ))}
                                </select>
                                <p className="text-[10px] text-gray-500 mt-1">
                                    {isEditingExpense 
                                        ? "Le compte ne peut pas être modifié lors de l'édition pour garantir l'intégrité comptable." 
                                        : "Si sélectionné, le montant sera automatiquement retiré du compte choisi."}
                                </p>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Affectation Boutique (Centre de Coût)</label>
                                <select 
                                    className={`w-full p-2 border border-gray-300 rounded ${userBoutiqueId ? 'bg-gray-100 cursor-not-allowed' : ''}`}
                                    value={newExpense.boutiqueId || ''}
                                    onChange={e => setNewExpense({...newExpense, boutiqueId: e.target.value})}
                                    disabled={!!userBoutiqueId}
                                >
                                    {!userBoutiqueId && <option value="">-- Général / Siège --</option>}
                                    {boutiques.map(b => (
                                        <option key={b.id} value={b.id}>{b.nom}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                                <input 
                                    type="text" 
                                    className="w-full p-2 border border-gray-300 rounded"
                                    value={newExpense.description}
                                    onChange={e => setNewExpense({...newExpense, description: e.target.value})}
                                    placeholder="Ex: Facture Senelec..."
                                />
                            </div>
                        </div>

                        <div className="flex justify-end gap-3 mt-6">
                            <button onClick={() => setIsExpenseModalOpen(false)} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded">Annuler</button>
                            <button onClick={handleSaveExpense} className={`px-4 py-2 text-white rounded font-bold ${isEditingExpense ? 'bg-blue-600 hover:bg-blue-700' : 'bg-brand-600 hover:bg-brand-700'}`}>
                                {isEditingExpense ? 'Enregistrer Modifications' : 'Valider Dépense'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* --- MODAL CREATION COMPTE --- */}
            {isAccountModalOpen && (
                <div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm p-6 animate-in fade-in zoom-in duration-200">
                        <h3 className="text-xl font-bold mb-4 flex items-center gap-2 text-gray-800">
                            <Wallet className="text-brand-600" /> Nouveau Compte
                        </h3>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Nom du compte</label>
                                <input type="text" className="w-full p-2 border border-gray-300 rounded" value={newAccount.nom} onChange={e => setNewAccount({...newAccount, nom: e.target.value})} placeholder="Ex: Caisse Boutique 1" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
                                <select className="w-full p-2 border border-gray-300 rounded" value={newAccount.type} onChange={e => setNewAccount({...newAccount, type: e.target.value as any})}>
                                    <option value="CAISSE">Caisse (Espèce)</option>
                                    <option value="BANQUE">Compte Bancaire</option>
                                    <option value="MOBILE_MONEY">Mobile Money (Wave/OM)</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Solde Initial</label>
                                <input type="number" className="w-full p-2 border border-gray-300 rounded" value={newAccount.solde} onChange={e => setNewAccount({...newAccount, solde: parseInt(e.target.value) || 0})} />
                            </div>
                            {newAccount.type !== 'CAISSE' && (
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Numéro (IBAN/Tél)</label>
                                    <input type="text" className="w-full p-2 border border-gray-300 rounded" value={newAccount.numero || ''} onChange={e => setNewAccount({...newAccount, numero: e.target.value})} />
                                </div>
                            )}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Lier à une Boutique (Optionnel)</label>
                                <select className="w-full p-2 border border-gray-300 rounded" value={newAccount.boutiqueId || ''} onChange={e => setNewAccount({...newAccount, boutiqueId: e.target.value})}>
                                    <option value="">-- Aucune --</option>
                                    {boutiques.map(b => <option key={b.id} value={b.id}>{b.nom}</option>)}
                                </select>
                            </div>
                        </div>
                        <div className="flex justify-end gap-3 mt-6">
                            <button onClick={() => setIsAccountModalOpen(false)} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded">Annuler</button>
                            <button onClick={handleAddAccount} className="px-4 py-2 bg-brand-600 text-white rounded hover:bg-brand-700">Créer</button>
                        </div>
                    </div>
                </div>
            )}

            {/* --- MODAL VIREMENT --- */}
            {isTransferModalOpen && (
                <div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6 animate-in fade-in zoom-in duration-200">
                        <h3 className="text-xl font-bold mb-4 flex items-center gap-2 text-gray-800">
                            <ArrowRightLeft className="text-blue-600" /> Virement Interne
                        </h3>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Compte Source (Débit)</label>
                                <select className="w-full p-2 border border-gray-300 rounded" value={transferData.sourceId} onChange={e => setTransferData({...transferData, sourceId: e.target.value})}>
                                    <option value="">-- Choisir --</option>
                                    {comptes.map(c => <option key={c.id} value={c.id}>{c.nom} ({c.solde.toLocaleString()} F)</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Compte Destination (Crédit)</label>
                                <select className="w-full p-2 border border-gray-300 rounded" value={transferData.destId} onChange={e => setTransferData({...transferData, destId: e.target.value})}>
                                    <option value="">-- Choisir --</option>
                                    {comptes.filter(c => c.id !== transferData.sourceId).map(c => <option key={c.id} value={c.id}>{c.nom}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Montant</label>
                                <input type="number" className="w-full p-2 border border-gray-300 rounded font-bold" value={transferData.montant} onChange={e => setTransferData({...transferData, montant: parseInt(e.target.value) || 0})} />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Motif</label>
                                <input type="text" className="w-full p-2 border border-gray-300 rounded" value={transferData.description} onChange={e => setTransferData({...transferData, description: e.target.value})} placeholder="Ex: Versement espèce banque" />
                            </div>
                        </div>
                        <div className="flex justify-end gap-3 mt-6">
                            <button onClick={() => setIsTransferModalOpen(false)} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded">Annuler</button>
                            <button onClick={handleTransfer} className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">Valider Virement</button>
                        </div>
                    </div>
                </div>
            )}

            {/* --- MODAL OPERATION (DEPOT/RETRAIT) --- */}
            {isOperationModalOpen && (
                <div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm p-6 animate-in fade-in zoom-in duration-200">
                        <h3 className={`text-xl font-bold mb-4 flex items-center gap-2 ${operationData.type === 'ENCAISSEMENT' ? 'text-green-700' : 'text-red-700'}`}>
                            {operationData.type === 'ENCAISSEMENT' ? <ArrowUpCircle /> : <ArrowDownCircle />}
                            {operationData.type === 'ENCAISSEMENT' ? 'Dépôt / Entrée' : 'Retrait / Sortie'}
                        </h3>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Compte</label>
                                <select className="w-full p-2 border border-gray-300 rounded" value={operationData.compteId} onChange={e => setOperationData({...operationData, compteId: e.target.value})}>
                                    <option value="">-- Choisir Compte --</option>
                                    {comptes.map(c => <option key={c.id} value={c.id}>{c.nom} ({c.solde.toLocaleString()} F)</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Montant</label>
                                <input type="number" className="w-full p-2 border border-gray-300 rounded font-bold" value={operationData.montant} onChange={e => setOperationData({...operationData, montant: parseInt(e.target.value) || 0})} />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Motif</label>
                                <input type="text" className="w-full p-2 border border-gray-300 rounded" value={operationData.description} onChange={e => setOperationData({...operationData, description: e.target.value})} placeholder={operationData.type === 'ENCAISSEMENT' ? "Ex: Apport personnel" : "Ex: Retrait Gérant"} />
                            </div>
                        </div>
                        <div className="flex justify-end gap-3 mt-6">
                            <button onClick={() => setIsOperationModalOpen(false)} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded">Annuler</button>
                            <button onClick={handleOperation} className={`px-4 py-2 text-white rounded font-bold ${operationData.type === 'ENCAISSEMENT' ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'}`}>Valider</button>
                        </div>
                    </div>
                </div>
            )}

            {/* --- MODAL IMPAYÉS CLIENTS --- */}
            {showClientDebtModal && (
                <div className="fixed inset-0 bg-black bg-opacity-60 z-[80] flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col animate-in zoom-in duration-200">
                        <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50 rounded-t-xl">
                            <h3 className="font-bold text-lg text-gray-800 flex items-center gap-2">
                                <AlertOctagon className="text-red-600" /> Créances Clients (Impayés)
                            </h3>
                            <button onClick={() => setShowClientDebtModal(false)}><X size={20} className="text-gray-500 hover:text-gray-700"/></button>
                        </div>
                        
                        <div className="p-4 border-b border-gray-100 flex flex-wrap gap-4 items-end bg-white">
                            <div>
                                <label className="block text-xs font-bold text-gray-500 mb-1">Période (Du)</label>
                                <input type="date" className="p-1.5 border rounded text-sm" value={clientDebtFilterStart} onChange={e => setClientDebtFilterStart(e.target.value)} />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-500 mb-1">Au</label>
                                <input type="date" className="p-1.5 border rounded text-sm" value={clientDebtFilterEnd} onChange={e => setClientDebtFilterEnd(e.target.value)} />
                            </div>
                            <div className="flex-1">
                                <label className="block text-xs font-bold text-gray-500 mb-1">Client</label>
                                <select className="w-full p-1.5 border rounded text-sm" value={clientDebtFilterId} onChange={e => setClientDebtFilterId(e.target.value)}>
                                    <option value="ALL">Tous les clients</option>
                                    {clients.map(c => <option key={c.id} value={c.id}>{c.nom}</option>)}
                                </select>
                            </div>
                            <button onClick={() => handlePrintReport("Rapport Impayés Clients", "client-debt-report")} className="bg-gray-800 text-white px-3 py-1.5 rounded text-sm flex items-center gap-2 hover:bg-gray-900">
                                <Printer size={16} /> Imprimer
                            </button>
                        </div>

                        <div className="flex-1 overflow-auto p-4" id="client-debt-report">
                            <table className="w-full text-sm text-left">
                                <thead className="bg-gray-50 text-gray-600 font-medium">
                                    <tr>
                                        <th className="py-2 px-3">Date</th>
                                        <th className="py-2 px-3">Client</th>
                                        <th className="py-2 px-3">Description</th>
                                        <th className="py-2 px-3 text-right">Montant Total</th>
                                        <th className="py-2 px-3 text-right">Avance</th>
                                        <th className="py-2 px-3 text-right text-red-600">Reste Dû</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {reportClientDebts.map(cmd => (
                                        <tr key={cmd.id}>
                                            <td className="py-2 px-3">{new Date(cmd.dateCommande).toLocaleDateString()}</td>
                                            <td className="py-2 px-3 font-medium">{cmd.clientNom}</td>
                                            <td className="py-2 px-3 text-xs text-gray-500 truncate max-w-[200px]">{cmd.description}</td>
                                            <td className="py-2 px-3 text-right">{cmd.prixTotal.toLocaleString()}</td>
                                            <td className="py-2 px-3 text-right text-green-600">{cmd.avance.toLocaleString()}</td>
                                            <td className="py-2 px-3 text-right font-bold text-red-600">{cmd.reste.toLocaleString()}</td>
                                        </tr>
                                    ))}
                                    {reportClientDebts.length === 0 && (
                                        <tr><td colSpan={6} className="text-center py-8 text-gray-400">Aucun impayé trouvé.</td></tr>
                                    )}
                                </tbody>
                                <tfoot className="bg-gray-50 font-bold text-gray-800 total-row">
                                    <tr>
                                        <td colSpan={3} className="py-3 px-3 text-right">TOTAL IMPAYÉS</td>
                                        <td className="py-3 px-3 text-right">{reportClientDebts.reduce((sum, c) => sum + c.prixTotal, 0).toLocaleString()}</td>
                                        <td className="py-3 px-3 text-right">{reportClientDebts.reduce((sum, c) => sum + c.avance, 0).toLocaleString()}</td>
                                        <td className="py-3 px-3 text-right text-red-600 text-lg">{reportClientTotal.toLocaleString()} F</td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {/* --- MODAL DETTES FOURNISSEURS --- */}
            {showSupplierDebtModal && (
                <div className="fixed inset-0 bg-black bg-opacity-60 z-[80] flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col animate-in zoom-in duration-200">
                        <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50 rounded-t-xl">
                            <h3 className="font-bold text-lg text-gray-800 flex items-center gap-2">
                                <ArrowDownCircle className="text-orange-600" /> Dettes Fournisseurs
                            </h3>
                            <button onClick={() => setShowSupplierDebtModal(false)}><X size={20} className="text-gray-500 hover:text-gray-700"/></button>
                        </div>
                        
                        <div className="p-4 border-b border-gray-100 flex flex-wrap gap-4 items-end bg-white">
                            <div>
                                <label className="block text-xs font-bold text-gray-500 mb-1">Période (Du)</label>
                                <input type="date" className="p-1.5 border rounded text-sm" value={supplierDebtFilterStart} onChange={e => setSupplierDebtFilterStart(e.target.value)} />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-500 mb-1">Au</label>
                                <input type="date" className="p-1.5 border rounded text-sm" value={supplierDebtFilterEnd} onChange={e => setSupplierDebtFilterEnd(e.target.value)} />
                            </div>
                            <div className="flex-1">
                                <label className="block text-xs font-bold text-gray-500 mb-1">Fournisseur</label>
                                <select className="w-full p-1.5 border rounded text-sm" value={supplierDebtFilter} onChange={e => setSupplierDebtFilter(e.target.value)}>
                                    <option value="ALL">Tous les fournisseurs</option>
                                    {fournisseurs.map(f => <option key={f.id} value={f.id}>{f.nomEntreprise}</option>)}
                                </select>
                            </div>
                            <button onClick={() => handlePrintReport("Rapport Dettes Fournisseurs", "supplier-debt-report")} className="bg-gray-800 text-white px-3 py-1.5 rounded text-sm flex items-center gap-2 hover:bg-gray-900">
                                <Printer size={16} /> Imprimer
                            </button>
                        </div>

                        <div className="flex-1 overflow-auto p-4" id="supplier-debt-report">
                            <table className="w-full text-sm text-left">
                                <thead className="bg-gray-50 text-gray-600 font-medium">
                                    <tr>
                                        <th className="py-2 px-3">Date</th>
                                        <th className="py-2 px-3">Fournisseur</th>
                                        <th className="py-2 px-3">Réf Commande</th>
                                        <th className="py-2 px-3 text-right">Montant Total</th>
                                        <th className="py-2 px-3 text-right">Déjà Payé</th>
                                        <th className="py-2 px-3 text-right text-orange-600">Reste à Payer</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {reportSupplierDebts.map(cmd => {
                                        const supplier = fournisseurs.find(f => f.id === cmd.fournisseurId);
                                        const reste = cmd.montantTotal - cmd.montantPaye;
                                        return (
                                            <tr key={cmd.id}>
                                                <td className="py-2 px-3">{new Date(cmd.dateCommande).toLocaleDateString()}</td>
                                                <td className="py-2 px-3 font-medium">{supplier?.nomEntreprise || 'Inconnu'}</td>
                                                <td className="py-2 px-3 text-xs text-gray-500">#{cmd.id}</td>
                                                <td className="py-2 px-3 text-right">{cmd.montantTotal.toLocaleString()}</td>
                                                <td className="py-2 px-3 text-right text-green-600">{cmd.montantPaye.toLocaleString()}</td>
                                                <td className="py-2 px-3 text-right font-bold text-orange-600">{reste.toLocaleString()}</td>
                                            </tr>
                                        );
                                    })}
                                    {reportSupplierDebts.length === 0 && (
                                        <tr><td colSpan={6} className="text-center py-8 text-gray-400">Aucune dette trouvée.</td></tr>
                                    )}
                                </tbody>
                                <tfoot className="bg-gray-50 font-bold text-gray-800 total-row">
                                    <tr>
                                        <td colSpan={3} className="py-3 px-3 text-right">TOTAL DETTES</td>
                                        <td className="py-3 px-3 text-right">{reportSupplierDebts.reduce((sum, c) => sum + c.montantTotal, 0).toLocaleString()}</td>
                                        <td className="py-3 px-3 text-right">{reportSupplierDebts.reduce((sum, c) => sum + c.montantPaye, 0).toLocaleString()}</td>
                                        <td className="py-3 px-3 text-right text-orange-600 text-lg">{reportSupplierTotal.toLocaleString()} F</td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default FinanceView;