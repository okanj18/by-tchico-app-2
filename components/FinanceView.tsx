
import React, { useState, useMemo } from 'react';
import { Depense, Commande, Boutique, RoleEmploye, Fournisseur, CommandeFournisseur, Client, CompteFinancier, TransactionTresorerie, TypeCompte, StatutCommande, StatutCommandeFournisseur, SessionUser, StatutPaiement } from '../types';
import { Wallet, TrendingUp, TrendingDown, DollarSign, Plus, Trash2, Building, Store, Scissors, BarChart2, FileText, Calendar, X, Printer, AlertOctagon, ArrowUpCircle, ArrowDownCircle, Landmark, Banknote, Smartphone, ArrowRightLeft, ArrowRight, Edit2, PieChart, Info, Percent, CheckCircle, AlertCircle, ChevronDown, ListFilter, BarChart3, MinusCircle, PlusCircle, Search, Lightbulb } from 'lucide-react';
import { COMPANY_CONFIG } from '../config';

interface FinanceViewProps {
    depenses: Depense[];
    commandes: Commande[];
    boutiques: Boutique[];
    onAddDepense: (d: Depense) => void;
    onDeleteDepense: (id: string) => void;
    onUpdateDepense: (d: Depense) => void;
    userRole: RoleEmploye;
    userBoutiqueId?: string;
    fournisseurs: Fournisseur[];
    commandesFournisseurs: CommandeFournisseur[];
    clients: Client[];
    comptes: CompteFinancier[];
    transactions: TransactionTresorerie[];
    onUpdateComptes: (comptes: CompteFinancier[]) => void;
    onAddTransaction: (t: TransactionTresorerie) => void;
    currentUser: SessionUser | null;
}

const FinanceView: React.FC<FinanceViewProps> = ({ 
    depenses, commandes, boutiques, onAddDepense, onDeleteDepense, onUpdateDepense, userRole, 
    userBoutiqueId, fournisseurs, commandesFournisseurs, clients, comptes, transactions, 
    onUpdateComptes, onAddTransaction, currentUser 
}) => {
    // --- DROITS ---
    const financePerm = currentUser?.permissions?.finance || 'NONE';
    const canWriteFinance = userRole === 'ADMIN' || userRole === 'GERANT' || financePerm === 'WRITE';

    const [activeTab, setActiveTab] = useState<'OVERVIEW' | 'TREASURY' | 'RENTABILITY' | 'REPORTS' | 'EXPENSES'>('OVERVIEW');
    
    // Filtres Dates
    const [dateStart, setDateStart] = useState('');
    const [dateEnd, setDateEnd] = useState('');

    // Filtres Spécifiques Dépenses
    const [expenseBoutiqueFilter, setExpenseBoutiqueFilter] = useState('ALL');
    const [expenseCategoryFilter, setExpenseCategoryFilter] = useState('ALL');

    // Modals
    const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false);
    const [isAccountModalOpen, setIsAccountModalOpen] = useState(false);
    const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
    const [isDepositModalOpen, setIsDepositModalOpen] = useState(false);
    const [isWithdrawalModalOpen, setIsWithdrawalModalOpen] = useState(false);

    // Form States
    const [newExpense, setNewExpense] = useState<Partial<Depense>>({
        date: new Date().toISOString().split('T')[0], montant: 0, categorie: 'AUTRE', description: '', boutiqueId: userBoutiqueId || 'ATELIER', compteId: ''
    });

    const [newAccount, setNewAccount] = useState<Partial<CompteFinancier>>({
        nom: '', type: 'CAISSE', solde: 0, numero: '', boutiqueId: 'ATELIER'
    });

    const [transferData, setTransferData] = useState({
        sourceId: '', destId: '', montant: 0, note: '', date: new Date().toISOString().split('T')[0]
    });

    const [quickTransaction, setQuickTransaction] = useState({
        compteId: '', montant: 0, motif: '', date: new Date().toISOString().split('T')[0]
    });

    // --- LOGIQUE DE CALCUL ---
    const isInDateRange = (dateStr: string) => {
        if (!dateStart && !dateEnd) return true;
        const d = new Date(dateStr).getTime();
        const start = dateStart ? new Date(dateStart).getTime() : -Infinity;
        const end = dateEnd ? new Date(dateEnd).setHours(23, 59, 59, 999) : Infinity;
        return d >= start && d <= end;
    };

    const statsCommandes = useMemo(() => commandes.filter(c => isInDateRange(c.dateCommande) && c.statut !== StatutCommande.ANNULE), [commandes, dateStart, dateEnd]);
    
    // Dépenses avec filtres spécifiques
    const statsDepensesFiltered = useMemo(() => {
        return depenses.filter(d => {
            const matchesDate = isInDateRange(d.date);
            const matchesBoutique = expenseBoutiqueFilter === 'ALL' || d.boutiqueId === expenseBoutiqueFilter;
            const matchesCategory = expenseCategoryFilter === 'ALL' || d.categorie === expenseCategoryFilter;
            return matchesDate && matchesBoutique && matchesCategory;
        }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }, [depenses, dateStart, dateEnd, expenseBoutiqueFilter, expenseCategoryFilter]);

    // Dépenses globales pour les indicateurs (uniquement filtre date)
    const statsDepensesGlobal = useMemo(() => depenses.filter(d => isInDateRange(d.date)), [depenses, dateStart, dateEnd]);

    const totalRecettes = useMemo(() => statsCommandes.reduce((acc, c) => acc + (c.avance + (c.paiements?.reduce((pAcc, p) => pAcc + p.montant, 0) || 0)), 0), [statsCommandes]); 
    const totalChargesPériode = useMemo(() => statsDepensesGlobal.reduce((acc, d) => acc + d.montant, 0), [statsDepensesGlobal]);
    const profitNet = totalRecettes - totalChargesPériode;

    const creancesClientsTotal = useMemo(() => commandes.filter(c => c.statut !== StatutCommande.ANNULE && !c.archived).reduce((acc, c) => acc + c.reste, 0), [commandes]);
    const dettesFournisseursTotal = useMemo(() => commandesFournisseurs.filter(c => c.statut !== StatutCommandeFournisseur.ANNULE && !c.archived).reduce((acc, c) => acc + (c.montantTotal - c.montantPaye), 0), [commandesFournisseurs]);

    const performanceParBoutique = useMemo(() => {
        const now = new Date();
        const thisMonthStr = now.toISOString().slice(0, 7);
        const thisYearStr = now.getFullYear().toString();
        return boutiques.map(b => {
            const ordersBoutique = commandes.filter(c => c.boutiqueId === b.id && c.statut !== StatutCommande.ANNULE);
            const moisEnCours = ordersBoutique.filter(c => c.dateCommande.startsWith(thisMonthStr)).reduce((acc, c) => acc + (c.avance + (c.paiements?.reduce((pAcc, p) => pAcc + p.montant, 0) || 0)), 0);
            const anneeEnCours = ordersBoutique.filter(c => c.dateCommande.startsWith(thisYearStr)).reduce((acc, c) => acc + (c.avance + (c.paiements?.reduce((pAcc, p) => pAcc + p.montant, 0) || 0)), 0);
            return { id: b.id, nom: b.nom, moisEnCours, anneeEnCours };
        });
    }, [boutiques, commandes]);

    const rentabiliteParBoutique = useMemo(() => {
        return boutiques.map(b => {
            const revenue = statsCommandes.filter(c => c.boutiqueId === b.id).reduce((acc, c) => acc + (c.avance + (c.paiements?.reduce((pAcc, p) => pAcc + p.montant, 0) || 0)), 0);
            const charges = statsDepensesGlobal.filter(d => d.boutiqueId === b.id).reduce((acc, d) => acc + d.montant, 0);
            const result = revenue - charges;
            return { ...b, revenue, charges, result, isBeneficiaire: result >= 0 };
        });
    }, [boutiques, statsCommandes, statsDepensesGlobal]);

    const chargesGenerales = useMemo(() => statsDepensesGlobal.filter(d => !d.boutiqueId || d.boutiqueId === 'ATELIER').reduce((acc, d) => acc + d.montant, 0), [statsDepensesGlobal]);

    const filteredTransactions = useMemo(() => {
        return transactions.filter(t => isInDateRange(t.date)).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }, [transactions, dateStart, dateEnd]);

    // --- HANDLERS ---
    const handleSaveExpense = () => {
        if (!newExpense.montant || !newExpense.description || !newExpense.compteId || !newExpense.boutiqueId) {
            alert("Montant, description, boutique et compte source requis.");
            return;
        }
        const selectedAccount = comptes.find(c => c.id === newExpense.compteId);
        if (selectedAccount && selectedAccount.solde < (newExpense.montant || 0)) {
            alert(`Solde insuffisant sur ${selectedAccount.nom}.`);
            return;
        }
        const exp: Depense = { id: `D${Date.now()}`, ...newExpense as Depense };
        onAddDepense(exp);
        onAddTransaction({
            id: `TR_EXP_${Date.now()}`, date: exp.date, type: 'DECAISSEMENT', montant: exp.montant, compteId: exp.compteId || '',
            description: `Dépense [${exp.categorie}]: ${exp.description}`, categorie: exp.categorie, createdBy: currentUser?.nom
        });
        onUpdateComptes(comptes.map(c => c.id === exp.compteId ? { ...c, solde: c.solde - exp.montant } : c));
        setIsExpenseModalOpen(false);
    };

    const handleQuickTransaction = (type: 'ENCAISSEMENT' | 'DECAISSEMENT') => {
        const { compteId, montant, motif, date } = quickTransaction;
        if (!compteId || montant <= 0 || !motif) { alert("Veuillez remplir tous les champs."); return; }
        const selectedAccount = comptes.find(c => c.id === compteId);
        if (type === 'DECAISSEMENT' && selectedAccount && selectedAccount.solde < montant) { alert(`Solde insuffisant sur ${selectedAccount.nom}.`); return; }
        onAddTransaction({
            id: `TR_Q_${Date.now()}`, date, type, montant, compteId, description: motif, categorie: type === 'ENCAISSEMENT' ? 'AUTRE_ENTREE' : 'AUTRE_SORTIE', createdBy: currentUser?.nom
        });
        onUpdateComptes(comptes.map(c => c.id === compteId ? { ...c, solde: type === 'ENCAISSEMENT' ? c.solde + montant : c.solde - montant } : c));
        setIsDepositModalOpen(false); setIsWithdrawalModalOpen(false);
        setQuickTransaction({ compteId: '', montant: 0, motif: '', date: new Date().toISOString().split('T')[0] });
    };

    const handleSaveAccount = () => {
        if (!newAccount.nom || !newAccount.type) return;
        const acc: CompteFinancier = { 
            id: `CPT_${Date.now()}`, nom: newAccount.nom.toUpperCase(), type: newAccount.type as TypeCompte, 
            solde: newAccount.solde || 0, numero: newAccount.numero, boutiqueId: newAccount.boutiqueId 
        };
        onUpdateComptes([...comptes, acc]);
        setIsAccountModalOpen(false);
        setNewAccount({ nom: '', type: 'CAISSE', solde: 0, numero: '', boutiqueId: 'ATELIER' });
    };

    const handleTransfer = () => {
        const { sourceId, destId, montant, date, note } = transferData;
        if (!sourceId || !destId || montant <= 0) return;
        const source = comptes.find(c => c.id === sourceId);
        if (source && source.solde < montant) { alert("Solde insuffisant."); return; }
        onAddTransaction({
            id: `TR_V_OUT_${Date.now()}`, date, type: 'VIREMENT_SORTANT', montant, compteId: sourceId, compteDestinationId: destId, 
            description: `Virement vers ${comptes.find(c => c.id === destId)?.nom}. ${note}`, categorie: 'TRANSFERT'
        });
        onAddTransaction({
            id: `TR_V_IN_${Date.now()}`, date, type: 'VIREMENT_ENTRANT', montant, compteId: destId, 
            description: `Virement depuis ${source?.nom}. ${note}`, categorie: 'TRANSFERT'
        });
        onUpdateComptes(comptes.map(c => {
            if (c.id === sourceId) return { ...c, solde: c.solde - montant };
            if (c.id === destId) return { ...c, solde: c.solde + montant };
            return c;
        }));
        setIsTransferModalOpen(false);
        setTransferData({ sourceId: '', destId: '', montant: 0, note: '', date: new Date().toISOString().split('T')[0] });
    };

    const expenseCategories = [
        { key: 'LOYER', label: 'Loyer' },
        { key: 'SALAIRE', label: 'Salaire' },
        { key: 'MATIERE_PREMIERE', label: 'Matière Première' },
        { key: 'LOGISTIQUE', label: 'Logistique' },
        { key: 'FOIRE_EXPO', label: 'Foire & Exposition' },
        { key: 'ELECTRICITE', label: 'Électricité / Eau / Internet' },
        { key: 'RESTAURATION', label: 'Restauration' },
        { key: 'AUTRE', label: 'Autre' }
    ];

    return (
        <div className="h-[calc(100vh-8rem)] flex flex-col space-y-6">
            {/* HEADER DESIGN LUXE */}
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 shrink-0">
                <div className="flex items-center gap-4">
                    <div className="p-3 bg-brand-50 rounded-2xl border border-brand-100 shadow-sm">
                        <Wallet className="text-brand-600" size={32} />
                    </div>
                    <div>
                        <h2 className="text-3xl font-black text-gray-800 tracking-tighter">Finance & Rentabilité</h2>
                        <div className="flex items-center gap-2 mt-1">
                            <Calendar size={14} className="text-gray-400" />
                            <p className="text-[11px] font-black text-gray-400 uppercase tracking-widest">
                                Période : <span className="text-brand-600">{(!dateStart && !dateEnd) ? "Tout l'historique" : `${dateStart || '...'} au ${dateEnd || '...'}`}</span>
                            </p>
                        </div>
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                    <div className="flex bg-gray-100 p-1 rounded-2xl shadow-inner border border-gray-200">
                        {[
                            {id: 'OVERVIEW', label: 'Vue d\'ensemble'},
                            {id: 'TREASURY', label: 'Trésorerie'},
                            {id: 'RENTABILITY', label: 'Rentabilité'},
                            {id: 'REPORTS', label: 'Rapports'},
                            {id: 'EXPENSES', label: 'Dépenses'}
                        ].map((tab) => (
                            <button 
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id as any)} 
                                className={`px-5 py-2.5 text-[11px] font-black uppercase rounded-xl transition-all ${activeTab === tab.id ? 'bg-white text-brand-900 shadow-lg scale-105 ring-1 ring-black/5' : 'text-gray-500 hover:bg-gray-200'}`}
                            >
                                {tab.label}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* FILTRES DATE GÉNÉRAUX */}
            <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm flex flex-wrap gap-8 items-center shrink-0">
                <div className="flex items-center gap-4">
                    <div className="flex flex-col">
                        <label className="text-[10px] font-black text-gray-400 uppercase ml-1 mb-1.5 tracking-tighter">DU</label>
                        <input type="date" value={dateStart} onChange={e => setDateStart(e.target.value)} className="p-2.5 border-2 border-gray-100 rounded-xl text-xs font-bold focus:ring-2 focus:ring-brand-500 outline-none w-44 shadow-sm" />
                    </div>
                    <div className="flex flex-col">
                        <label className="text-[10px] font-black text-gray-400 uppercase ml-1 mb-1.5 tracking-tighter">AU</label>
                        <input type="date" value={dateEnd} onChange={e => setDateEnd(e.target.value)} className="p-2.5 border-2 border-gray-100 rounded-xl text-xs font-bold focus:ring-2 focus:ring-brand-500 outline-none w-44 shadow-sm" />
                    </div>
                </div>
                <div className="h-12 w-px bg-gray-100 mx-2 hidden md:block"></div>
                <div className="flex gap-3">
                    <button onClick={() => { setDateStart(''); setDateEnd(''); }} className="px-5 py-2.5 text-[10px] font-black uppercase text-gray-400 hover:text-brand-900 border-2 border-transparent hover:border-gray-200 rounded-xl transition-all">Tout l'historique</button>
                    <button onClick={() => { 
                        const now = new Date();
                        setDateStart(new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0]);
                        setDateEnd(new Date().toISOString().split('T')[0]);
                    }} className="px-6 py-2.5 text-[10px] font-black uppercase text-brand-600 bg-brand-50 rounded-xl hover:bg-brand-100 border border-brand-100 transition-all shadow-sm">Mois en cours</button>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar pr-1 pb-10">
                
                {/* --- VUE D'ENSEMBLE --- */}
                {activeTab === 'OVERVIEW' && (
                    <div className="space-y-8 animate-in fade-in duration-500">
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            <div className="bg-white p-8 rounded-[2.5rem] border-l-[8px] border-green-500 shadow-sm relative overflow-hidden flex flex-col justify-between min-h-[160px] group hover:shadow-md transition-shadow">
                                <div className="flex justify-between items-start">
                                    <div><p className="text-[11px] font-black text-gray-400 uppercase tracking-widest">Recettes (Période)</p><p className="text-4xl font-black text-gray-900 mt-3">{totalRecettes.toLocaleString()} F</p></div>
                                    <div className="p-3 text-green-500 group-hover:scale-110 transition-transform"><TrendingUp size={32}/></div>
                                </div>
                            </div>
                            <div className="bg-white p-8 rounded-[2.5rem] border-l-[8px] border-red-500 shadow-sm relative overflow-hidden flex flex-col justify-between min-h-[160px] group hover:shadow-md transition-shadow">
                                <div className="flex justify-between items-start">
                                    <div><p className="text-[11px] font-black text-gray-400 uppercase tracking-widest">Dépenses (Période)</p><p className="text-4xl font-black text-gray-900 mt-3">{totalChargesPériode.toLocaleString()} F</p></div>
                                    <div className="p-3 text-red-500 group-hover:scale-110 transition-transform"><TrendingDown size={32}/></div>
                                </div>
                            </div>
                            <div className="bg-white p-8 rounded-[2.5rem] border-l-[8px] border-orange-500 shadow-sm relative overflow-hidden flex flex-col justify-between min-h-[160px] group hover:shadow-md transition-shadow">
                                <div className="flex justify-between items-start">
                                    <div><p className="text-[11px] font-black text-gray-400 uppercase tracking-widest">Résultat (Période)</p><p className={`text-4xl font-black mt-3 ${profitNet >= 0 ? 'text-gray-900' : 'text-red-600'}`}>{profitNet.toLocaleString()} F</p></div>
                                    <div className="p-3 text-orange-500 group-hover:scale-110 transition-transform"><DollarSign size={32}/></div>
                                </div>
                            </div>
                        </div>
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch">
                            <div onClick={() => setIsExpenseModalOpen(true)} className="bg-white p-8 rounded-[2.5rem] border-2 border-dashed border-red-200 cursor-pointer group hover:bg-red-50/30 transition-all flex items-center gap-6 shadow-sm">
                                <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center text-red-600 group-hover:scale-110 transition-transform shadow-inner"><Plus size={32} strokeWidth={3}/></div>
                                <div><h3 className="text-2xl font-black text-red-700 uppercase tracking-tighter">Nouvelle Dépense</h3><p className="text-xs font-bold text-gray-400 mt-1 uppercase tracking-widest">Loyer, Électricité, Restauration...</p><p className="text-[10px] font-black text-red-500 uppercase mt-2 flex items-center gap-1 group-hover:gap-2 transition-all underline decoration-2 underline-offset-4">Enregistrer une sortie d'argent <ArrowRight size={12}/></p></div>
                            </div>
                            <div className="bg-blue-50/80 p-8 rounded-[2.5rem] border border-blue-100 flex items-start gap-6 shadow-sm relative overflow-hidden group">
                                <div className="absolute top-0 right-0 p-4 opacity-10 text-blue-900 -rotate-12 group-hover:rotate-0 transition-transform"><Lightbulb size={100}/></div>
                                <div className="w-14 h-14 bg-white rounded-2xl flex items-center justify-center text-blue-600 shadow-sm border border-blue-100 shrink-0 relative z-10"><Store size={28}/></div>
                                <div className="relative z-10"><h3 className="text-lg font-black text-blue-900 uppercase tracking-tight">Conseil de Gestion</h3><p className="text-sm text-blue-700 font-bold leading-relaxed mt-2 max-w-sm">Pour une gestion précise, sélectionnez le compte <span className="underline">(Caisse/Banque)</span> lors de la création d'une dépense. Cela mettra à jour votre trésorerie automatiquement.</p></div>
                            </div>
                        </div>
                    </div>
                )}

                {/* --- RAPPORTS --- */}
                {activeTab === 'REPORTS' && (
                    <div className="space-y-8 animate-in fade-in duration-500">
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                            <div className="bg-white p-6 rounded-[2rem] border-l-[8px] border-red-500 shadow-sm relative overflow-hidden flex flex-col justify-between h-44 group hover:shadow-md transition-shadow">
                                <div className="flex justify-between items-start">
                                    <div><p className="text-[11px] font-black text-gray-400 uppercase tracking-widest">CRÉANCES CLIENTS</p><p className="text-3xl font-black text-gray-900 mt-2">{creancesClientsTotal.toLocaleString()} F</p></div>
                                    <div className="p-3 bg-red-50 rounded-full text-red-600 shadow-inner group-hover:scale-110 transition-transform"><AlertCircle size={28}/></div>
                                </div>
                                <button className="mt-4 w-full py-2.5 bg-red-50 text-red-700 text-[10px] font-black uppercase rounded-xl hover:bg-red-100 transition-all border border-red-100 flex items-center justify-center gap-2"><Printer size={14}/> Voir Liste Impayés</button>
                            </div>
                            <div className="bg-white p-6 rounded-[2rem] border-l-[8px] border-orange-500 shadow-sm relative overflow-hidden flex flex-col justify-between h-44 group hover:shadow-md transition-shadow">
                                <div className="flex justify-between items-start">
                                    <div><p className="text-[11px] font-black text-gray-400 uppercase tracking-widest">DETTES FOURNISSEURS</p><p className="text-3xl font-black text-gray-900 mt-2">{dettesFournisseursTotal.toLocaleString()} F</p></div>
                                    <div className="p-3 bg-orange-50 rounded-full text-orange-600 shadow-inner group-hover:scale-110 transition-transform"><TrendingDown size={28}/></div>
                                </div>
                                <button className="mt-4 w-full py-2.5 bg-orange-50 text-orange-700 text-[10px] font-black uppercase rounded-xl hover:bg-orange-100 transition-all border border-orange-100 flex items-center justify-center gap-2"><Printer size={14}/> Voir Liste Dettes</button>
                            </div>
                            <div className="bg-white p-6 rounded-[2rem] border-l-[8px] border-blue-500 shadow-sm relative overflow-hidden flex flex-col justify-between h-44 ring-2 ring-blue-50 group hover:shadow-md transition-shadow">
                                <div className="flex justify-between items-start">
                                    <div><p className="text-[11px] font-black text-blue-400 uppercase tracking-widest">TRÉSORERIE (PÉRIODE)</p><p className={`text-3xl font-black mt-2 ${profitNet >= 0 ? 'text-blue-600' : 'text-red-600'}`}>{profitNet.toLocaleString()} F</p></div>
                                    <div className="p-3 bg-blue-50 rounded-full text-blue-600 shadow-inner group-hover:scale-110 transition-transform"><Landmark size={28}/></div>
                                </div>
                                <p className="text-[10px] text-gray-400 font-bold italic leading-tight uppercase opacity-70">Recettes - Dépenses (Sur période)</p>
                            </div>
                            <div className="bg-gray-50 p-6 rounded-[2rem] border-2 border-dashed border-gray-200 flex flex-col items-center justify-center h-44 text-gray-400"><BarChart3 size={40} className="opacity-20 mb-3"/><p className="text-[11px] font-black uppercase tracking-widest opacity-50">Plus de rapports à venir...</p></div>
                        </div>
                        <div className="bg-white rounded-[2.5rem] border border-gray-200 shadow-sm overflow-hidden animate-in slide-in-from-bottom-4 duration-700">
                            <div className="p-7 bg-gray-50/50 border-b flex items-center gap-4"><div className="p-2 bg-white rounded-lg shadow-sm border border-gray-100"><TrendingUp className="text-brand-600" size={24}/></div><h3 className="text-xl font-black text-gray-800 uppercase tracking-tighter">Performance Commerciale</h3></div>
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm text-left">
                                    <thead className="bg-white text-gray-400 font-black uppercase text-[11px] tracking-[0.2em] border-b"><tr><th className="p-7">BOUTIQUE</th><th className="p-7 text-right">MOIS EN COURS</th><th className="p-7 text-right">ANNÉE EN COURS</th></tr></thead>
                                    <tbody className="divide-y divide-gray-50">
                                        {performanceParBoutique.map(p => (
                                            <tr key={p.id} className="hover:bg-brand-50/30 transition-all group">
                                                <td className="p-7 font-black text-gray-700 uppercase group-hover:text-brand-900 tracking-tight">{p.nom}</td>
                                                <td className="p-7 text-right font-black text-blue-600 text-lg">{p.moisEnCours.toLocaleString()} F</td>
                                                <td className="p-7 text-right font-black text-gray-800 text-lg">{p.anneeEnCours.toLocaleString()} F</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                    <tfoot className="bg-gray-100/50 border-t-4 border-white font-black"><tr><td className="p-8 text-brand-900 uppercase tracking-[0.3em] text-sm">TOTAL GLOBAL</td><td className="p-8 text-right text-brand-700 text-2xl">{performanceParBoutique.reduce((acc, p) => acc + p.moisEnCours, 0).toLocaleString()} F</td><td className="p-8 text-right text-gray-900 text-2xl">{performanceParBoutique.reduce((acc, p) => acc + p.anneeEnCours, 0).toLocaleString()} F</td></tr></tfoot>
                                </table>
                            </div>
                        </div>
                    </div>
                )}

                {/* --- RENTABILITÉ --- */}
                {activeTab === 'RENTABILITY' && (
                    <div className="space-y-8 animate-in fade-in duration-500">
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                            {rentabiliteParBoutique.map(item => (
                                <div key={item.id} className="bg-white p-8 rounded-[2.5rem] border border-gray-100 shadow-sm flex flex-col group hover:shadow-md transition-shadow">
                                    <div className="flex justify-between items-start mb-10">
                                        <div className="flex items-center gap-5">
                                            <div className="w-14 h-14 bg-gray-50 rounded-2xl flex items-center justify-center border border-gray-100 shadow-inner group-hover:scale-105 transition-transform">{item.id === 'ATELIER' ? <Scissors className="text-gray-400" size={28}/> : <Store className="text-brand-500" size={28}/>}</div>
                                            <div><h3 className="text-xl font-black text-gray-800 uppercase tracking-tight">{item.nom}</h3><p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{item.lieu}</p></div>
                                        </div>
                                        <div className={`px-4 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest border ${item.isBeneficiaire ? 'bg-green-50 text-green-600 border-green-100' : 'bg-red-50 text-red-600 border-red-100'}`}>{item.isBeneficiaire ? 'Bénéficiaire' : 'Déficitaire'}</div>
                                    </div>
                                    <div className="space-y-6 flex-1"><div className="flex justify-between items-center py-2"><span className="text-xs font-bold text-gray-400 uppercase tracking-widest">Chiffre d'Affaires</span><span className="text-2xl font-black text-gray-900 tracking-tighter">{item.revenue.toLocaleString()} F</span></div><div className="flex justify-between items-center py-2"><span className="text-xs font-bold text-gray-400 uppercase tracking-widest">Dépenses & Charges</span><span className="text-2xl font-black text-red-500 tracking-tighter">-{item.charges.toLocaleString()} F</span></div></div>
                                    <div className="mt-10 pt-8 border-t-2 border-dashed border-gray-100 flex justify-between items-center"><span className="text-sm font-black text-gray-800 uppercase tracking-[0.2em]">Résultat Net</span><span className={`text-4xl font-black tracking-tighter ${item.isBeneficiaire ? 'text-green-500' : 'text-red-600'}`}>{item.result.toLocaleString()} F</span></div>
                                </div>
                            ))}
                        </div>
                        <div className="bg-white p-8 rounded-[2.5rem] border border-gray-100 shadow-sm animate-in slide-in-from-bottom-4 duration-700">
                             <div className="flex items-center gap-5 mb-8"><div className="w-12 h-12 bg-gray-50 rounded-xl flex items-center justify-center border border-gray-100 shadow-inner"><Building className="text-gray-300" size={24}/></div><div><h3 className="text-lg font-black text-gray-800 uppercase tracking-tight">Charges Générales (Siège)</h3><p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Non affectées à une boutique</p></div></div>
                             <div className="flex justify-between items-center bg-gray-50/50 p-6 rounded-3xl border border-gray-100"><span className="text-xs font-black text-gray-500 uppercase tracking-[0.2em]">Total Charges Communes</span><span className="text-2xl font-black text-red-500">-{chargesGenerales.toLocaleString()} F</span></div>
                        </div>
                    </div>
                )}

                {/* --- TRÉSORERIE --- */}
                {activeTab === 'TREASURY' && (
                    <div className="space-y-8 animate-in slide-in-from-right-4 duration-300">
                        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 shrink-0 px-2">
                            <h3 className="text-xl font-black text-gray-800 uppercase tracking-tighter">Comptes Financiers / Caisse</h3>
                            <div className="flex flex-wrap gap-2">
                                <button onClick={() => setIsDepositModalOpen(true)} className="bg-[#00a859] hover:bg-[#008f4c] text-white px-5 py-2.5 rounded-xl text-[11px] font-black uppercase tracking-widest flex items-center gap-2 shadow-lg transition-all"><PlusCircle size={18}/> Dépôt</button>
                                <button onClick={() => setIsWithdrawalModalOpen(true)} className="bg-[#ed1c24] hover:bg-[#d61921] text-white px-5 py-2.5 rounded-xl text-[11px] font-black uppercase tracking-widest flex items-center gap-2 shadow-lg transition-all"><MinusCircle size={18}/> Retrait</button>
                                <button onClick={() => setIsTransferModalOpen(true)} className="bg-[#0054ff] hover:bg-[#0047d9] text-white px-5 py-2.5 rounded-xl text-[11px] font-black uppercase tracking-widest flex items-center gap-2 shadow-lg transition-all"><ArrowRightLeft size={18}/> Virement</button>
                                <button onClick={() => setIsAccountModalOpen(true)} className="bg-[#1a1a1a] hover:bg-black text-white px-6 py-2.5 rounded-xl text-[11px] font-black uppercase tracking-widest flex items-center gap-2 shadow-xl transition-all"><Plus size={20}/> Créer Compte</button>
                            </div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 px-2">
                            {comptes.map(compte => {
                                const boutique = boutiques.find(b => b.id === compte.boutiqueId) || (compte.boutiqueId === 'ATELIER' ? {nom: 'Atelier Central'} : null);
                                return (
                                    <div key={compte.id} className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm hover:shadow-md transition-all group flex flex-col justify-between h-[160px]">
                                        <div className="flex justify-between items-start">
                                            <div className="flex items-center gap-4">
                                                <div className={`p-3 rounded-2xl shadow-inner ${compte.type === 'CAISSE' ? 'bg-[#e6f6ee] text-[#00a859]' : compte.type === 'MOBILE_MONEY' ? 'bg-[#fff5f5] text-[#ed1c24]' : 'bg-[#e6eeff] text-[#0054ff]'}`}>{compte.type === 'CAISSE' ? <Banknote size={24}/> : <Smartphone size={24}/>}</div>
                                                <div><h4 className="font-black text-gray-800 uppercase text-xs tracking-tight">{compte.nom}</h4><p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">{compte.type.replace('_', ' ')}</p></div>
                                            </div>
                                            {boutique && <span className="text-[8px] bg-gray-50 text-gray-400 border border-gray-100 px-2 py-1 rounded-lg uppercase font-black">{boutique.nom}</span>}
                                        </div>
                                        <div className="mt-4"><p className="text-3xl font-black text-gray-900 tracking-tighter">{compte.solde.toLocaleString()} F</p><p className="text-[10px] font-bold text-gray-300 mt-1 uppercase tracking-widest">{compte.numero || 'Aucun numéro'}</p></div>
                                    </div>
                                );
                            })}
                        </div>
                        <div className="bg-white rounded-[2rem] border border-gray-200 shadow-sm overflow-hidden flex flex-col mx-2">
                            <div className="p-6 bg-gray-50/50 border-b shrink-0"><h3 className="font-black text-gray-600 uppercase text-[11px] tracking-widest">DERNIERS MOUVEMENTS</h3></div>
                            <div className="overflow-x-auto"><table className="w-full text-sm text-left"><thead className="bg-white text-gray-400 font-black uppercase text-[10px] tracking-widest border-b"><tr><th className="p-6">Date</th><th className="p-6">Type</th><th className="p-6">Compte</th><th className="p-6">Description</th><th className="p-6 text-right">Montant</th></tr></thead><tbody className="divide-y divide-gray-50">{filteredTransactions.map(t => { const isEncaiss = t.type.includes('ENCAISSEMENT') || t.type === 'VIREMENT_ENTRANT'; const compte = comptes.find(c => c.id === t.compteId); return (<tr key={t.id} className="hover:bg-gray-50 group transition-colors"><td className="p-6 text-[11px] font-bold text-gray-400">{new Date(t.date).toLocaleDateString()}</td><td className="p-6"><span className={`px-3 py-1 rounded-lg text-[9px] font-black uppercase border ${isEncaiss ? 'bg-green-50 text-green-700 border-green-100' : 'bg-red-50 text-red-700 border-red-100'}`}>{t.type.replace('_', ' ')}</span></td><td className="p-6 font-black text-gray-500 text-[10px] uppercase tracking-wider">{compte?.nom}</td><td className="p-6 font-bold text-gray-800 text-sm tracking-tight">{t.description}</td><td className={`p-6 text-right font-black text-lg ${isEncaiss ? 'text-green-600' : 'text-red-600'}`}>{isEncaiss ? '+' : ''}{t.montant.toLocaleString()}</td></tr>); })}</tbody></table></div>
                        </div>
                    </div>
                )}

                {/* --- DÉPENSES (RÉPLIQUE CAPTURE) --- */}
                {activeTab === 'EXPENSES' && (
                    <div className="space-y-6 animate-in slide-in-from-left-4 duration-300">
                        <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm flex flex-col md:flex-row justify-between items-center gap-4 shrink-0">
                            <div className="flex flex-wrap gap-4 items-center">
                                <select className="p-3 border-2 border-gray-100 rounded-xl font-bold text-sm bg-gray-50 focus:border-brand-500 outline-none transition-all" value={expenseBoutiqueFilter} onChange={e => setExpenseBoutiqueFilter(e.target.value)}><option value="ALL">Toutes les Boutiques</option><option value="ATELIER">Atelier Central</option>{boutiques.map(b => <option key={b.id} value={b.id}>{b.nom}</option>)}</select>
                                <select className="p-3 border-2 border-gray-100 rounded-xl font-bold text-sm bg-gray-50 focus:border-brand-500 outline-none transition-all" value={expenseCategoryFilter} onChange={e => setExpenseCategoryFilter(e.target.value)}><option value="ALL">Toutes Catégories</option>{expenseCategories.map(cat => <option key={cat.key} value={cat.key}>{cat.label}</option>)}</select>
                            </div>
                            {canWriteFinance && <button onClick={() => setIsExpenseModalOpen(true)} className="bg-[#d45d1e] hover:bg-[#b54a16] text-white px-8 py-3.5 rounded-2xl font-black uppercase text-xs tracking-widest shadow-xl active:scale-95 transition-all flex items-center gap-2"><Plus size={20}/> Nouvelle Dépense</button>}
                        </div>
                        <div className="bg-white rounded-[2.5rem] border border-gray-200 shadow-sm flex flex-col overflow-hidden">
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm text-left">
                                    <thead className="bg-gray-50 text-gray-400 font-black uppercase text-[11px] tracking-widest border-b">
                                        <tr><th className="p-6">Date</th><th className="p-6">Catégorie</th><th className="p-6">Description</th><th className="p-6">Affectation / Compte</th><th className="p-6 text-right">Montant</th><th className="p-6 text-center w-20">Actions</th></tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-50">
                                        {statsDepensesFiltered.map(d => {
                                            const boutique = boutiques.find(b => b.id === d.boutiqueId) || (d.boutiqueId === 'ATELIER' ? {nom: 'Atelier Central'} : null);
                                            const compte = comptes.find(c => c.id === d.compteId);
                                            const catLabel = expenseCategories.find(c => c.key === d.categorie)?.label || d.categorie;
                                            return (
                                                <tr key={d.id} className="hover:bg-gray-50 transition-colors group">
                                                    <td className="p-6 text-xs font-bold text-gray-400">{new Date(d.date).toLocaleDateString()}</td>
                                                    <td className="p-6"><span className="px-3 py-1 bg-gray-100 text-gray-600 text-[9px] font-black uppercase rounded-lg border border-gray-200">{catLabel}</span></td>
                                                    <td className="p-6 font-bold text-gray-800 text-sm tracking-tight">{d.description}</td>
                                                    <td className="p-6">
                                                        <div className="flex flex-col">
                                                            <div className="flex items-center gap-1.5 text-[10px] font-black text-gray-400 uppercase tracking-tighter"><Store size={10} className="text-gray-300"/> {boutique?.nom || 'Atelier Central'}</div>
                                                            <div className="flex items-center gap-1.5 text-[10px] font-black text-blue-600 uppercase tracking-widest mt-1"><Wallet size={10}/> {compte?.nom || 'Inconnu'}</div>
                                                        </div>
                                                    </td>
                                                    <td className="p-6 text-right font-black text-red-600 text-lg">-{d.montant.toLocaleString()}</td>
                                                    <td className="p-6 text-center">
                                                        {canWriteFinance && (
                                                            <div className="flex gap-1 justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                                                <button onClick={() => { setNewExpense({...d}); setIsExpenseModalOpen(true); }} className="p-2 text-gray-400 hover:text-blue-600 transition-colors"><Edit2 size={16}/></button>
                                                                <button onClick={() => { if(window.confirm("Supprimer cette dépense ?")) onDeleteDepense(d.id) }} className="p-2 text-gray-300 hover:text-red-600 transition-colors"><Trash2 size={16}/></button>
                                                            </div>
                                                        )}
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* MODAL DEPENSE (REDESIGNED) */}
            {isExpenseModalOpen && (
                <div className="fixed inset-0 bg-brand-900/80 z-[500] flex items-center justify-center p-4 backdrop-blur-md">
                    <div className="bg-white rounded-[2.5rem] p-10 w-full max-w-sm shadow-2xl animate-in zoom-in duration-200 border border-brand-100">
                        <div className="flex justify-between items-center mb-8 border-b pb-5 shrink-0"><h3 className="text-xl font-black uppercase tracking-tighter flex items-center gap-3"><TrendingDown className="text-red-600"/> Nouvelle Dépense</h3><button onClick={() => setIsExpenseModalOpen(false)} className="p-1 hover:bg-gray-100 rounded-full transition-colors"><X size={28}/></button></div>
                        <div className="space-y-5">
                            <div><label className="text-[10px] font-black text-gray-400 uppercase ml-1 tracking-widest">Montant (F)</label><input type="number" className="w-full p-4 border-2 border-red-100 rounded-2xl text-2xl font-black text-red-600 bg-red-50 focus:border-red-600 outline-none transition-all shadow-sm" value={newExpense.montant || ''} onChange={e => setNewExpense({...newExpense, montant: parseInt(e.target.value)||0})} placeholder="0" /></div>
                            <div><label className="text-[10px] font-black text-gray-400 uppercase ml-1 tracking-widest">Libellé / Détail</label><input type="text" className="w-full p-4 border-2 border-gray-100 rounded-2xl font-bold bg-gray-50 focus:border-brand-600 outline-none shadow-sm" value={newExpense.description} onChange={e => setNewExpense({...newExpense, description: e.target.value})} placeholder="Ex: Transport, Facture Senelec..." /></div>
                            <div className="grid grid-cols-2 gap-4">
                                <div><label className="text-[10px] font-black text-gray-400 uppercase ml-1 tracking-widest">Boutique</label><select className="w-full p-3 border-2 border-gray-100 rounded-xl font-black bg-gray-50 outline-none text-[10px]" value={newExpense.boutiqueId} onChange={e => setNewExpense({...newExpense, boutiqueId: e.target.value})}><option value="ATELIER">ATELIER CENTRAL</option>{boutiques.map(b => <option key={b.id} value={b.id}>{b.nom}</option>)}</select></div>
                                <div><label className="text-[10px] font-black text-gray-400 uppercase ml-1 tracking-widest">Catégorie</label><select className="w-full p-3 border-2 border-gray-100 rounded-xl font-black bg-gray-50 outline-none text-[10px]" value={newExpense.categorie} onChange={e => setNewExpense({...newExpense, categorie: e.target.value as any})}>{expenseCategories.map(cat => <option key={cat.key} value={cat.key}>{cat.label}</option>)}</select></div>
                            </div>
                            <div><label className="text-[10px] font-black text-gray-400 uppercase ml-1 tracking-widest">Compte Source</label><select className="w-full p-4 border-2 border-gray-100 rounded-2xl font-black bg-gray-50 outline-none text-xs" value={newExpense.compteId} onChange={e => setNewExpense({...newExpense, compteId: e.target.value})}><option value="">-- Choisir Caisse --</option>{comptes.map(c => <option key={c.id} value={c.id}>{c.nom} ({c.solde.toLocaleString()} F)</option>)}</select></div>
                        </div>
                        <div className="flex justify-end gap-3 mt-10 pt-5 border-t"><button onClick={() => setIsExpenseModalOpen(false)} className="px-6 py-4 text-gray-400 font-black uppercase text-[10px] tracking-widest">Annuler</button><button onClick={handleSaveExpense} className="px-12 py-4 bg-red-600 text-white rounded-2xl font-black uppercase text-xs tracking-widest shadow-xl shadow-red-200 active:scale-95 transition-all">Valider</button></div>
                    </div>
                </div>
            )}

            {/* MODALS DEPOT / RETRAIT / VIREMENT (Identiques au reste de l'app) */}
            {(isDepositModalOpen || isWithdrawalModalOpen) && (
                <div className="fixed inset-0 bg-brand-900/80 z-[500] flex items-center justify-center p-4 backdrop-blur-md"><div className="bg-white rounded-[2.5rem] p-10 w-full max-w-sm shadow-2xl border border-brand-100"><div className="flex justify-between items-center mb-8 border-b pb-5 shrink-0"><h3 className={`text-xl font-black uppercase tracking-tighter flex items-center gap-3 ${isDepositModalOpen ? 'text-green-600' : 'text-red-600'}`}>{isDepositModalOpen ? <PlusCircle size={28}/> : <MinusCircle size={28}/>}{isDepositModalOpen ? 'Dépôt / Entrée' : 'Retrait / Sortie'}</h3><button onClick={() => { setIsDepositModalOpen(false); setIsWithdrawalModalOpen(false); }} className="p-1 hover:bg-gray-100 rounded-full transition-colors"><X size={28}/></button></div><div className="space-y-6"><div><label className="block text-[11px] font-black text-gray-400 uppercase mb-2 tracking-widest">Compte</label><select className="w-full p-3 border-2 border-gray-100 rounded-xl font-bold bg-gray-50 outline-none" value={quickTransaction.compteId} onChange={e => setQuickTransaction({...quickTransaction, compteId: e.target.value})}><option value="">-- Choisir Compte --</option>{comptes.map(c => <option key={c.id} value={c.id}>{c.nom} ({c.solde.toLocaleString()} F)</option>)}</select></div><div><label className="block text-[11px] font-black text-gray-400 uppercase mb-2 tracking-widest">Montant</label><input type="number" className={`w-full p-4 border-2 rounded-2xl text-2xl font-black focus:ring-0 outline-none transition-all ${isDepositModalOpen ? 'border-green-100 text-green-600 bg-green-50 focus:border-green-600' : 'border-red-100 text-red-600 bg-red-50 focus:border-red-600'}`} value={quickTransaction.montant || ''} onChange={e => setQuickTransaction({...quickTransaction, montant: parseInt(e.target.value)||0})} placeholder="0" /></div><div><label className="block text-[11px] font-black text-gray-400 uppercase mb-2 tracking-widest">Motif</label><input type="text" className="w-full p-4 border-2 border-gray-100 rounded-2xl font-bold bg-gray-50 focus:border-brand-600 outline-none shadow-sm" value={quickTransaction.motif} onChange={e => setQuickTransaction({...quickTransaction, motif: e.target.value})} placeholder={isDepositModalOpen ? "Ex: Apport personnel" : "Ex: Frais divers"} /></div></div><div className="flex justify-end gap-3 mt-10 pt-5 border-t"><button onClick={() => { setIsDepositModalOpen(false); setIsWithdrawalModalOpen(false); }} className="px-6 py-4 text-gray-400 font-black uppercase text-[10px] tracking-widest">Annuler</button><button onClick={() => handleQuickTransaction(isDepositModalOpen ? 'ENCAISSEMENT' : 'DECAISSEMENT')} className={`px-12 py-4 text-white rounded-2xl font-black uppercase text-xs tracking-widest shadow-xl active:scale-95 transition-all ${isDepositModalOpen ? 'bg-green-600 shadow-green-100' : 'bg-red-600 shadow-red-100'}`}>Valider</button></div></div></div>
            )}

            {isTransferModalOpen && (<div className="fixed inset-0 bg-brand-900/80 z-[500] flex items-center justify-center p-4 backdrop-blur-md"><div className="bg-white rounded-[2.5rem] p-10 w-full max-w-sm shadow-2xl border border-brand-100"><div className="flex justify-between items-center mb-8 border-b pb-5 shrink-0"><h3 className="text-xl font-black uppercase tracking-tighter flex items-center gap-3 text-blue-600"><ArrowRightLeft size={32}/> Virement Interne</h3><button onClick={() => setIsTransferModalOpen(false)} className="p-1 hover:bg-gray-100 rounded-full transition-colors"><X size={28}/></button></div><div className="space-y-6"><div><label className="block text-[10px] font-black text-gray-400 uppercase ml-1 tracking-widest mb-1.5">Montant à transférer</label><input type="number" className="w-full p-4 border-2 border-blue-50 rounded-2xl text-2xl font-black text-blue-900 bg-blue-50/30 outline-none" value={transferData.montant || ''} onChange={e => setTransferData({...transferData, montant: parseInt(e.target.value)||0})} placeholder="0" /></div><div className="grid grid-cols-2 gap-4"><div><label className="block text-[10px] font-black text-gray-400 uppercase ml-1 tracking-widest mb-1.5">Source</label><select className="w-full p-3 border-2 border-gray-100 rounded-xl font-bold text-xs" value={transferData.sourceId} onChange={e => setTransferData({...transferData, sourceId: e.target.value})}><option value="">-- Choisir --</option>{comptes.map(c => <option key={c.id} value={c.id}>{c.nom} ({c.solde.toLocaleString()} F)</option>)}</select></div><div><label className="block text-[10px] font-black text-gray-400 uppercase ml-1 tracking-widest mb-1.5">Destination</label><select className="w-full p-3 border-2 border-gray-100 rounded-xl font-bold text-xs" value={transferData.destId} onChange={e => setTransferData({...transferData, destId: e.target.value})}><option value="">-- Choisir --</option>{comptes.map(c => <option key={c.id} value={c.id}>{c.nom}</option>)}</select></div></div></div><div className="flex justify-end gap-3 mt-10 pt-4 border-t"><button onClick={() => setIsTransferModalOpen(false)} className="px-6 py-4 text-gray-400 font-black uppercase text-[10px] tracking-widest">Annuler</button><button onClick={handleTransfer} disabled={transferData.montant <= 0 || !transferData.sourceId || !transferData.destId} className="px-12 py-4 bg-blue-600 text-white rounded-2xl font-black uppercase text-xs tracking-widest shadow-xl shadow-blue-100 active:scale-95 transition-all">Confirmer</button></div></div></div>)}

            {isAccountModalOpen && (<div className="fixed inset-0 bg-brand-900/80 z-[500] flex items-center justify-center p-4 backdrop-blur-md"><div className="bg-white rounded-[2.5rem] p-10 w-full max-w-sm shadow-2xl border border-brand-100"><div className="flex justify-between items-center mb-8 border-b pb-5 shrink-0"><h3 className="text-xl font-black uppercase tracking-tighter flex items-center gap-3"><Plus size={32} className="text-brand-600"/> Nouveau Compte</h3><button onClick={() => setIsAccountModalOpen(false)} className="p-1 hover:bg-gray-100 rounded-full transition-colors"><X size={28}/></button></div><div className="space-y-6"><div><label className="text-[10px] font-black text-gray-400 uppercase ml-1 tracking-widest mb-1.5">Nom du compte</label><input type="text" className="w-full p-4 border-2 border-gray-100 rounded-2xl font-black bg-gray-50 uppercase focus:border-brand-600 outline-none shadow-sm" value={newAccount.nom} onChange={e => setNewAccount({...newAccount, nom: e.target.value})} placeholder="Ex: Caisse Boutique" /></div><div><label className="text-[10px] font-black text-gray-400 uppercase ml-1 tracking-widest mb-1.5">Type</label><select className="w-full p-4 border-2 border-gray-100 rounded-2xl font-black bg-gray-50 outline-none text-xs" value={newAccount.type} onChange={e => setNewAccount({...newAccount, type: e.target.value as any})}><option value="CAISSE">Caisse (Espèce)</option><option value="BANQUE">Banque (Virement/Chèque)</option><option value="MOBILE_MONEY">Mobile Money (Wave/OM)</option></select></div><div><label className="text-[10px] font-black text-gray-400 uppercase ml-1 tracking-widest mb-1.5">Solde Initial</label><input type="number" className="w-full p-4 border-2 border-gray-100 rounded-2xl font-black bg-gray-50 focus:border-brand-600 outline-none" value={newAccount.solde || ''} onChange={e => setNewAccount({...newAccount, solde: parseInt(e.target.value)||0})} placeholder="0" /></div></div><div className="flex justify-end gap-3 mt-10 pt-5 border-t"><button onClick={() => setIsAccountModalOpen(false)} className="px-6 py-4 text-gray-400 font-black uppercase text-[10px] tracking-widest">Annuler</button><button onClick={handleSaveAccount} className="px-12 py-4 bg-brand-900 text-white rounded-2xl font-black uppercase text-xs tracking-widest shadow-xl active:scale-95 transition-all">Créer Compte</button></div></div></div>)}
        </div>
    );
};

export default FinanceView;
