
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Employe, Boutique, Depense, Pointage, SessionUser, RoleEmploye, TransactionPaie, CompteFinancier, TransactionTresorerie, NiveauAcces, PermissionsUtilisateur } from '../types';
import { Users, DollarSign, Plus, Edit2, Trash2, Search, Clock, Briefcase, X, History, UserMinus, RotateCcw, QrCode, Camera, Printer, PieChart, TrendingUp, Filter, User, Cloud, ShieldCheck, Loader, Mail, Lock, Truck, CheckSquare, Square, Save, Image as ImageIcon, Upload, Shield, Eye, AlertTriangle } from 'lucide-react';
import { QRScannerModal, QRGeneratorModal } from './QRTools';
import { QRCodeCanvas } from 'qrcode.react';

interface HRViewProps {
    employes: Employe[];
    boutiques: Boutique[];
    onAddEmploye: (e: Employe) => void;
    onUpdateEmploye: (e: Employe) => void;
    onDeleteEmploye: (id: string) => void;
    onArchiveEmploye?: (id: string) => void;
    onAddDepense: (d: Depense) => void;
    depenses: Depense[];
    onDeleteDepense: (id: string) => void;
    onUpdateDepense: (d: Depense) => void;
    pointages: Pointage[];
    onAddPointage: (p: Pointage) => void;
    onUpdatePointage: (p: Pointage) => void;
    currentUser: SessionUser | null;
    comptes: CompteFinancier[];
    onUpdateComptes: (c: CompteFinancier[]) => void;
    onAddTransaction: (t: TransactionTresorerie) => void;
}

const DEFAULT_PERMISSIONS: PermissionsUtilisateur = {
    dashboard: 'READ', ventes: 'READ', production: 'READ', stock: 'READ', approvisionnement: 'READ',
    fournisseurs: 'READ', rh: 'NONE', clients: 'READ', finance: 'NONE', catalogue: 'READ'
};

const HRView: React.FC<HRViewProps> = ({ 
    employes, boutiques, onAddEmploye, onUpdateEmploye, onDeleteEmploye, onArchiveEmploye,
    onAddDepense, depenses, onDeleteDepense, onUpdateDepense, 
    pointages, onAddPointage, onUpdatePointage, currentUser, 
    comptes, onUpdateComptes, onAddTransaction 
}) => {
    const isGardien = currentUser?.role === RoleEmploye.GARDIEN;
    const isVendeur = currentUser?.role === RoleEmploye.VENDEUR;
    const canManageHR = currentUser?.role === RoleEmploye.ADMIN || currentUser?.role === RoleEmploye.GERANT || currentUser?.permissions?.rh === 'WRITE';

    const [activeTab, setActiveTab] = useState<'EMPLOYEES' | 'POINTAGE'>(isGardien ? 'POINTAGE' : 'EMPLOYEES');
    const [searchTerm, setSearchTerm] = useState('');
    const [showArchived, setShowArchived] = useState(false);
    
    // Config horaires
    const WORK_START_HOUR = 10;
    const TOLERANCE_MINUTES = 15;

    // --- STATES MODALS ---
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [modalSubTab, setModalSubTab] = useState<'INFOS' | 'PERMISSIONS'>('INFOS');
    const [editingEmployee, setEditingEmployee] = useState<Employe | null>(null);
    const [formData, setFormData] = useState<Partial<Employe>>({
        nom: '', role: RoleEmploye.STAGIAIRE, telephone: '', password: '', salaireBase: 0, typeContrat: 'STAGE', email: '', cniRecto: '', cniVerso: '', permissions: {...DEFAULT_PERMISSIONS}
    });

    const rectoInputRef = useRef<HTMLInputElement>(null);
    const versoInputRef = useRef<HTMLInputElement>(null);

    // Transport Modal
    const [transportModalOpen, setTransportModalOpen] = useState(false);
    const [transportData, setTransportData] = useState({ 
        montantUnitaire: 500, montantTotal: 0, date: new Date().toISOString().split('T')[0], compteId: '', boutiqueId: 'ATELIER' 
    });
    const [selectedTransportEmpIds, setSelectedTransportEmpIds] = useState<string[]>([]);

    // Paiement et historique
    const [payModalOpen, setPayModalOpen] = useState(false);
    const [selectedEmployeeForPay, setSelectedEmployeeForPay] = useState<Employe | null>(null);
    const [paymentAccountId, setPaymentAccountId] = useState<string>('');
    const [transactionData, setTransactionData] = useState({ 
        date: new Date().toISOString().split('T')[0], type: 'ACOMPTE', montant: 0, note: '' 
    });
    
    const [historyModalOpen, setHistoryModalOpen] = useState(false);
    const [selectedEmployeeForHistory, setSelectedEmployeeForHistory] = useState<Employe | null>(null);
    const [editingHistoryItem, setEditingHistoryItem] = useState<{empId: string, item: TransactionPaie} | null>(null);

    // Rapports
    const [isReportModalOpen, setIsReportModalOpen] = useState(false);
    const [reportType, setReportType] = useState<'GLOBAL' | 'INDIVIDUAL'>('GLOBAL');
    const [reportMonth, setReportMonth] = useState(new Date().toISOString().slice(0, 7));
    const [reportEmployeeId, setReportEmployeeId] = useState<string>('');

    // Pointage
    const [pointageDate, setPointageDate] = useState(new Date().toISOString().split('T')[0]);
    const [isScannerOpen, setIsScannerOpen] = useState(false);
    const [qrBadgeModalOpen, setQrBadgeModalOpen] = useState(false);
    const [selectedEmployeeForBadge, setSelectedEmployeeForBadge] = useState<Employe | null>(null);

    // Filtres
    const filteredEmployes = employes.filter(e => {
        const matchesSearch = e.nom.toLowerCase().includes(searchTerm.toLowerCase()) || 
                              e.role.toLowerCase().includes(searchTerm.toLowerCase());
        return showArchived ? matchesSearch && e.actif === false : matchesSearch && e.actif !== false;
    });

    const activeEmployes = useMemo(() => employes.filter(e => e.actif !== false), [employes]);
    const dailyPointages = pointages.filter(p => p.date === pointageDate);

    // Added hrStats to fix "Cannot find name 'hrStats'" errors
    const hrStats = useMemo(() => {
        const todayStr = new Date().toISOString().split('T')[0];
        const todayPointages = pointages.filter(p => p.date === todayStr);
        const presentToday = todayPointages.filter(p => p.statut === 'PRESENT' || p.statut === 'RETARD').length;
        const totalActive = activeEmployes.length;
        const totalBaseSalary = activeEmployes.reduce((acc, e) => acc + (e.salaireBase || 0), 0);
        
        return { presentToday, totalActive, totalBaseSalary };
    }, [activeEmployes, pointages]);

    // --- FONCTIONS DE CALCUL SALAIRE ET SECURITÉ ---
    const getMonthlyPayStats = (emp: Employe, forDate?: string) => {
        const monthToQuery = forDate ? forDate.slice(0, 7) : new Date().toISOString().slice(0, 7);
        const historique = emp.historiquePaie || [];
        
        const primes = historique
            .filter(h => h.date.startsWith(monthToQuery) && h.type === 'PRIME')
            .reduce((acc, h) => acc + h.montant, 0);
            
        const acomptes = historique
            .filter(h => h.date.startsWith(monthToQuery) && h.type === 'ACOMPTE')
            .reduce((acc, h) => acc + h.montant, 0);
            
        const dejaPayeNet = historique
            .filter(h => h.date.startsWith(monthToQuery) && h.type === 'SALAIRE_NET')
            .reduce((acc, h) => acc + h.montant, 0);
            
        const countNetPayments = historique.filter(h => h.date.startsWith(monthToQuery) && h.type === 'SALAIRE_NET').length;
            
        const totalDu = emp.salaireBase + primes;
        const resteAPayer = totalDu - acomptes - dejaPayeNet;
        
        return { primes, acomptes, dejaPayeNet, totalDu, resteAPayer, countNetPayments };
    };

    // Auto-calcul du montant quand on choisit "Salaire Net"
    useEffect(() => {
        if (selectedEmployeeForPay && transactionData.type === 'SALAIRE_NET') {
            const stats = getMonthlyPayStats(selectedEmployeeForPay, transactionData.date);
            setTransactionData(prev => ({ ...prev, montant: Math.max(0, stats.resteAPayer) }));
        }
    }, [transactionData.type, transactionData.date, selectedEmployeeForPay]);

    // --- ACTIONS ---
    const handleClockIn = (employeId: string) => {
        const now = new Date();
        const timeString = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
        let calculatedStatut: 'PRESENT' | 'RETARD' = (now.getHours() > WORK_START_HOUR || (now.getHours() === WORK_START_HOUR && now.getMinutes() > TOLERANCE_MINUTES)) ? 'RETARD' : 'PRESENT';
        onAddPointage({ id: `PT_${Date.now()}`, employeId, date: pointageDate, heureArrivee: timeString, statut: calculatedStatut });
    };

    const handleClockOut = (pt: Pointage) => {
        const now = new Date();
        const timeString = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
        onUpdatePointage({ ...pt, heureDepart: timeString });
    };

    const handleMarkAbsent = (employeId: string) => {
        onAddPointage({ id: `PT_${Date.now()}`, employeId, date: pointageDate, statut: 'ABSENT' });
    };

    const handleScanAttendance = (decodedText: string) => {
        const emp = employes.find(e => e.id === decodedText && e.actif !== false);
        if (!emp) { alert("Badge non reconnu."); setIsScannerOpen(false); return; }
        const pt = pointages.find(p => p.employeId === emp.id && p.date === pointageDate);
        if (!pt) handleClockIn(emp.id);
        else if (!pt.heureDepart) handleClockOut(pt);
        setIsScannerOpen(false);
    };

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>, side: 'recto' | 'verso') => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onloadend = () => {
            setFormData(prev => ({ ...prev, [side === 'recto' ? 'cniRecto' : 'cniVerso']: reader.result as string }));
        };
        reader.readAsDataURL(file);
    };

    const handleSaveTransport = () => {
        if (selectedTransportEmpIds.length === 0 || !transportData.compteId) {
            alert("Veuillez sélectionner au moins un employé et choisir une caisse.");
            return;
        }
        const selectedAccount = comptes.find(c => c.id === transportData.compteId);
        if (selectedAccount && selectedAccount.solde < transportData.montantTotal) {
            if (!window.confirm(`⚠️ Solde insuffisant sur ${selectedAccount.nom}. Continuer quand même ?`)) return;
        }

        const selectedEmps = activeEmployes.filter(e => selectedTransportEmpIds.includes(e.id));
        const empNames = selectedEmps.map(e => e.nom).join(', ');

        const depense: Depense = {
            id: `D_TR_${Date.now()}`, date: transportData.date, montant: transportData.montantTotal, categorie: 'LOGISTIQUE',
            description: `Transport Groupe: ${selectedTransportEmpIds.length} pers. (${empNames})`,
            boutiqueId: transportData.boutiqueId, compteId: transportData.compteId, createdBy: currentUser?.nom
        };
        onAddDepense(depense);

        selectedTransportEmpIds.forEach((empId) => {
            const emp = employes.find(e => e.id === empId);
            if (emp) {
                const transportEntry: TransactionPaie = {
                    id: `TP_TR_${Date.now()}_${empId}`, date: transportData.date, type: 'ACOMPTE', description: `Transport Quotidien`, montant: transportData.montantUnitaire, createdBy: currentUser?.nom
                };
                onUpdateEmploye({ ...emp, historiquePaie: [transportEntry, ...(emp.historiquePaie || [])] });
            }
        });

        setTransportModalOpen(false);
        setTransportData({ montantUnitaire: 500, montantTotal: 0, date: new Date().toISOString().split('T')[0], compteId: '', boutiqueId: 'ATELIER' });
        setSelectedTransportEmpIds([]);
        alert("Transport enregistré et historiques mis à jour.");
    };

    const handleSavePayrollTransaction = () => {
        if (!selectedEmployeeForPay || transactionData.montant <= 0) {
            alert("Veuillez remplir le montant.");
            return;
        }

        const isPrime = transactionData.type === 'PRIME';
        if (!isPrime && !paymentAccountId) {
            alert("Veuillez choisir une caisse source.");
            return;
        }

        // SÉCURITÉ ANTI-DOUBLON POUR SALAIRE NET
        if (transactionData.type === 'SALAIRE_NET') {
            const stats = getMonthlyPayStats(selectedEmployeeForPay, transactionData.date);
            if (stats.countNetPayments > 0) {
                if (!window.confirm(`⚠️ ATTENTION : Un règlement de type "Salaire Net" a déjà été effectué pour cet employé ce mois-ci. Voulez-vous vraiment continuer ?`)) {
                    return;
                }
            }
        }

        const newTrans: TransactionPaie = { 
            id: `TP_${Date.now()}`, date: transactionData.date, type: transactionData.type as any, montant: transactionData.montant, 
            description: transactionData.note || transactionData.type, createdBy: currentUser?.nom
        };

        onUpdateEmploye({ ...selectedEmployeeForPay, historiquePaie: [newTrans, ...(selectedEmployeeForPay.historiquePaie || [])] });

        if (paymentAccountId) {
            onAddTransaction({ 
                id: `TR_PAY_${Date.now()}`, date: transactionData.date, type: 'DECAISSEMENT', montant: transactionData.montant, 
                compteId: paymentAccountId, description: `Paie ${selectedEmployeeForPay.nom}: ${transactionData.type}`, 
                categorie: 'SALAIRE', createdBy: currentUser?.nom
            });
            onUpdateComptes(comptes.map(c => c.id === paymentAccountId ? { ...c, solde: c.solde - transactionData.montant } : c));
        }

        setPayModalOpen(false);
        alert(`Règlement de ${transactionData.montant} F validé.`);
    };

    const handleDeletePayrollTransaction = (emp: Employe, transId: string) => {
        if (!window.confirm("Voulez-vous vraiment supprimer ce règlement de l'historique ?")) return;
        const updatedHistory = (emp.historiquePaie || []).filter(h => h.id !== transId);
        onUpdateEmploye({ ...emp, historiquePaie: updatedHistory });
        if (selectedEmployeeForHistory?.id === emp.id) {
            setSelectedEmployeeForHistory({ ...emp, historiquePaie: updatedHistory });
        }
    };

    const handleSaveEditHistory = () => {
        if (!editingHistoryItem || !selectedEmployeeForHistory) return;
        const updatedHistory = (selectedEmployeeForHistory.historiquePaie || []).map(h => 
            h.id === editingHistoryItem.item.id ? editingHistoryItem.item : h
        );
        onUpdateEmploye({ ...selectedEmployeeForHistory, historiquePaie: updatedHistory });
        setSelectedEmployeeForHistory({ ...selectedEmployeeForHistory, historiquePaie: updatedHistory });
        setEditingHistoryItem(null);
        alert("Modification enregistrée.");
    };

    const getPointageStatusColor = (status: string) => {
        switch(status) {
            case 'PRESENT': return 'bg-green-100 text-green-800';
            case 'RETARD': return 'bg-orange-100 text-orange-800';
            case 'ABSENT': return 'bg-red-100 text-red-800';
            default: return 'bg-gray-100';
        }
    };

    return (
        <div className="h-[calc(100vh-8rem)] flex flex-col space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2"><Briefcase className="text-brand-600" /> Ressources Humaines</h2>
                
                <div className="flex flex-wrap gap-2 w-full md:w-auto">
                    {!isGardien && (
                        <div className="flex bg-gray-100 p-1 rounded-lg">
                            <button onClick={() => setActiveTab('EMPLOYEES')} className={`px-3 py-1.5 text-xs font-bold rounded flex items-center gap-1 ${activeTab === 'EMPLOYEES' ? 'bg-white shadow text-brand-700' : 'text-gray-500'}`}><Users size={14} /> Employés</button>
                            <button onClick={() => setActiveTab('POINTAGE')} className={`px-3 py-1.5 text-xs font-bold rounded flex items-center gap-1 ${activeTab === 'POINTAGE' ? 'bg-white shadow text-brand-700' : 'text-gray-500'}`}><Clock size={14} /> Pointage</button>
                        </div>
                    )}
                    
                    {canManageHR && (
                        <>
                            <button onClick={() => { setSelectedTransportEmpIds([]); setTransportModalOpen(true); }} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 font-black uppercase text-[10px] tracking-widest shadow-md active:scale-95 transition-all"><Truck size={16} /> Transport Groupe</button>
                            <button onClick={() => { setFormData({ nom: '', role: RoleEmploye.STAGIAIRE, telephone: '', password: '', salaireBase: 0, email: '', cniRecto: '', cniVerso: '', permissions: {...DEFAULT_PERMISSIONS} }); setEditingEmployee(null); setModalSubTab('INFOS'); setIsModalOpen(true); }} className="bg-brand-600 hover:bg-brand-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 font-black uppercase text-[10px] tracking-widest shadow-md active:scale-95 transition-all"><Plus size={16} /> Nouveau</button>
                        </>
                    )}
                </div>
            </div>

            {hrStats && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="bg-white p-3 rounded-xl border border-gray-200 shadow-sm flex items-center justify-between"><div><p className="text-xs text-gray-500 uppercase font-bold">Présents Auj.</p><p className="text-2xl font-bold text-gray-900">{hrStats.presentToday} <span className="text-xs text-gray-400">/ {hrStats.totalActive}</span></p></div><Users size={20} className="text-blue-500"/></div>
                    <div className="bg-white p-3 rounded-xl border border-gray-200 shadow-sm flex items-center justify-between"><div><p className="text-xs text-gray-500 uppercase font-bold">Masse Salariale</p><p className="text-2xl font-bold text-gray-900">{(hrStats.totalBaseSalary/1000).toFixed(0)}k F</p></div><TrendingUp size={20} className="text-green-500"/></div>
                    <div className="bg-white p-3 rounded-xl border border-gray-200 shadow-sm flex items-center justify-between"><div><p className="text-xs text-gray-500 uppercase font-bold">Rapports</p><button onClick={() => setIsReportModalOpen(true)} className="text-brand-600 font-bold text-xs underline">Registres de présence</button></div><PieChart size={20} className="text-brand-50"/></div>
                </div>
            )}

            {/* --- VUE EMPLOYES --- */}
            {activeTab === 'EMPLOYEES' && !isGardien && (
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex-1 flex flex-col">
                    <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                        <div className="relative w-64">
                            <Search className="absolute left-3 top-2.5 text-gray-400" size={16} />
                            <input type="text" placeholder="Rechercher..." className="w-full pl-10 pr-4 py-2 border rounded-lg text-sm" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
                        </div>
                        <div className="flex items-center gap-3">
                            <label className="text-xs font-bold text-gray-500 uppercase">Filtrer :</label>
                            <button onClick={() => setShowArchived(!showArchived)} className={`px-3 py-2 border rounded-lg text-xs font-bold transition-all ${showArchived ? 'bg-gray-800 text-white shadow-md' : 'bg-white hover:bg-gray-100'}`}>
                                {showArchived ? 'Voir les Archivés' : 'Voir les Actifs'}
                            </button>
                        </div>
                    </div>
                    <div className="overflow-x-auto flex-1">
                        <table className="w-full text-sm text-left min-w-[1000px]">
                            <thead className="bg-white text-gray-600 font-medium border-b border-gray-100">
                                <tr>
                                    <th className="py-3 px-4">Nom</th>
                                    <th className="py-3 px-4">Rôle</th>
                                    <th className="py-3 px-4 text-right">Salaire Base</th>
                                    <th className="py-3 px-4 text-right text-orange-600">Acomptes (Mois)</th>
                                    <th className="py-3 px-4 text-right font-black">Reste à payer</th>
                                    <th className="py-3 px-4 text-center">Identité</th>
                                    <th className="py-3 px-4 text-center">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {filteredEmployes.map(emp => {
                                    const pay = getMonthlyPayStats(emp);
                                    return (
                                        <tr key={emp.id} className={`hover:bg-gray-50 ${emp.actif === false ? 'opacity-50 grayscale bg-gray-50' : ''}`}>
                                            <td className="py-3 px-4 font-bold text-gray-800 uppercase flex items-center gap-2">
                                                {emp.nom}
                                                {emp.actif === false && <span className="text-[8px] bg-gray-200 px-1 rounded text-gray-500">ARCHIVE</span>}
                                            </td>
                                            <td className="py-3 px-4 text-xs font-bold text-brand-700">{emp.role}</td>
                                            <td className="py-3 px-4 text-right font-medium">{emp.salaireBase.toLocaleString()} F</td>
                                            <td className="py-3 px-4 text-right text-orange-600 font-bold">{pay.acomptes.toLocaleString()} F</td>
                                            <td className={`py-3 px-4 text-right font-black ${pay.resteAPayer <= 0 ? 'text-green-600' : 'text-red-700'}`}>
                                                {pay.resteAPayer.toLocaleString()} F
                                            </td>
                                            <td className="py-3 px-4 text-center">
                                                <div className="flex gap-2 justify-center">
                                                    <span className={`w-3 h-3 rounded-full ${emp.cniRecto ? 'bg-green-500' : 'bg-gray-200'}`} title="Recto"></span>
                                                    <span className={`w-3 h-3 rounded-full ${emp.cniVerso ? 'bg-green-500' : 'bg-gray-200'}`} title="Verso"></span>
                                                </div>
                                            </td>
                                            <td className="py-3 px-4 text-center">
                                                <div className="flex justify-center gap-1">
                                                    <button onClick={() => { setSelectedEmployeeForBadge(emp); setQrBadgeModalOpen(true); }} className="p-1.5 bg-gray-100 hover:bg-gray-200 rounded text-gray-600" title="Badge QR"><QrCode size={16}/></button>
                                                    <button onClick={() => { setSelectedEmployeeForHistory(emp); setHistoryModalOpen(true); }} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded" title="Historique Paie"><History size={16}/></button>
                                                    {canManageHR && emp.actif !== false && <button onClick={() => { setSelectedEmployeeForPay(emp); setPaymentAccountId(''); setTransactionData({ date: new Date().toISOString().split('T')[0], type: 'ACOMPTE', montant: 0, note: '' }); setPayModalOpen(true); }} className="p-1.5 text-green-600 hover:bg-green-50 rounded" title="Payer"><DollarSign size={16}/></button>}
                                                    {canManageHR && <button onClick={() => { setEditingEmployee(emp); setFormData({...emp, permissions: emp.permissions || {...DEFAULT_PERMISSIONS}}); setModalSubTab('INFOS'); setIsModalOpen(true); }} className="p-1.5 text-gray-400 hover:text-brand-600 rounded" title="Modifier"><Edit2 size={16}/></button>}
                                                    {canManageHR && onArchiveEmploye && (
                                                        <button onClick={() => { if(window.confirm(`${emp.actif === false ? 'Réactiver' : 'Archiver'} ${emp.nom} ?`)) onArchiveEmploye(emp.id) }} className={`p-1.5 rounded transition-colors ${emp.actif === false ? 'text-green-500 hover:bg-green-50' : 'text-orange-500 hover:bg-orange-50'}`} title={emp.actif === false ? 'Réactiver' : 'Archiver'}>
                                                            {emp.actif === false ? <RotateCcw size={16}/> : <UserMinus size={16}/>}
                                                        </button>
                                                    )}
                                                    {canManageHR && <button onClick={() => { if(window.confirm(`⚠️ SUPPRESSION DÉFINITIVE !\n\nÊtes-vous absolument sûr de vouloir supprimer ${emp.nom} ? Cette action effacera également tout son historique de paie.`)) onDeleteEmploye(emp.id) }} className="p-1.5 text-red-300 hover:text-red-600 rounded" title="SUPPRIMER DÉFINITIVEMENT"><Trash2 size={16}/></button>}
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                                {filteredEmployes.length === 0 && (
                                    <tr><td colSpan={7} className="py-20 text-center text-gray-400 font-bold uppercase">Aucun résultat trouvé.</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* --- VUE POINTAGE --- */}
            {activeTab === 'POINTAGE' && (
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex-1 flex flex-col">
                    <div className="p-4 border-b border-gray-100 flex flex-wrap justify-between items-center bg-gray-50 gap-4">
                        <div className="flex items-center gap-4">
                            <input type="date" value={pointageDate} onChange={(e) => setPointageDate(e.target.value)} className="p-1.5 border rounded text-sm font-bold" />
                            <button onClick={() => setIsScannerOpen(true)} className="bg-brand-600 hover:bg-brand-700 text-white px-4 py-1.5 rounded font-bold text-sm flex items-center gap-2"><Camera size={16} /> Scanner QR</button>
                        </div>
                        <p className="text-xs text-gray-500 font-bold uppercase tracking-widest">Registre du {new Date(pointageDate).toLocaleDateString()}</p>
                    </div>
                    <div className="overflow-x-auto flex-1">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-gray-50 text-gray-600 font-medium border-b"><tr><th className="py-3 px-4">Employé</th><th className="py-3 px-4 text-center">Statut</th><th className="py-3 px-4 text-center">Arrivée</th><th className="py-3 px-4 text-center">Départ</th><th className="py-3 px-4 text-center">Action</th></tr></thead>
                            <tbody className="divide-y divide-gray-100">
                                {activeEmployes.map(emp => {
                                    const pt = dailyPointages.find(p => p.employeId === emp.id);
                                    return (
                                        <tr key={emp.id} className="hover:bg-gray-50">
                                            <td className="py-3 px-4 font-bold uppercase">{emp.nom}</td>
                                            <td className="py-3 px-4 text-center">{pt ? <span className={`px-2 py-1 rounded text-xs font-bold ${getPointageStatusColor(pt.statut)}`}>{pt.statut}</span> : <span className="text-gray-400 text-xs">NON POINTÉ</span>}</td>
                                            <td className="py-3 px-4 text-center font-mono">{pt?.heureArrivee || '-'}</td>
                                            <td className="py-3 px-4 text-center font-mono">{pt?.heureDepart || '-'}</td>
                                            <td className="py-3 px-4 text-center">
                                                {!pt ? (
                                                    <div className="flex justify-center gap-2">
                                                        <button onClick={() => handleClockIn(emp.id)} className="bg-green-600 text-white px-3 py-1 rounded text-xs hover:bg-green-700 font-bold shadow-sm">Arrivée</button>
                                                        <button onClick={() => handleMarkAbsent(emp.id)} className="bg-red-100 text-red-600 px-3 py-1 rounded text-xs hover:bg-red-200">Absent</button>
                                                    </div>
                                                ) : (
                                                    <div className="flex justify-center gap-2">
                                                        {pt.statut !== 'ABSENT' && !pt.heureDepart && (
                                                            <button onClick={() => handleClockOut(pt)} className="bg-blue-600 text-white px-3 py-1 rounded text-xs hover:bg-blue-700 font-bold shadow-sm">Départ</button>
                                                        )}
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
            )}

            {/* --- MODAL RAPPORT POINTAGE --- */}
            {isReportModalOpen && (
                <div className="fixed inset-0 bg-black bg-opacity-60 z-[400] flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl flex flex-col max-h-[90vh] animate-in zoom-in duration-200">
                        <div className="p-4 border-b bg-gray-50 flex justify-between items-center shrink-0 rounded-t-xl">
                            <h3 className="font-bold text-lg flex items-center gap-2 uppercase tracking-tighter"><PieChart className="text-brand-600"/> Registres de Présence</h3>
                            <button onClick={() => setIsReportModalOpen(false)}><X size={24}/></button>
                        </div>
                        <div className="p-4 bg-white border-b flex flex-wrap gap-4 items-end shrink-0">
                            <div className="flex bg-gray-100 p-1 rounded-lg">
                                <button onClick={() => setReportType('GLOBAL')} className={`px-3 py-1 text-[10px] font-black uppercase rounded ${reportType === 'GLOBAL' ? 'bg-white shadow' : 'text-gray-500'}`}>Vue Globale</button>
                                <button onClick={() => setReportType('INDIVIDUAL')} className={`px-3 py-1 text-[10px] font-black uppercase rounded ${reportType === 'INDIVIDUAL' ? 'bg-white shadow' : 'text-gray-500'}`}>Vue Individuelle</button>
                            </div>
                            <div><label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1 ml-1">Mois</label><input type="month" value={reportMonth} onChange={e => setReportMonth(e.target.value)} className="p-2 border-2 border-gray-100 rounded-lg text-xs font-bold" /></div>
                            {reportType === 'INDIVIDUAL' && (
                                <div><label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1 ml-1">Employé</label>
                                    <select value={reportEmployeeId} onChange={e => setReportEmployeeId(e.target.value)} className="p-2 border-2 border-gray-100 rounded-lg text-xs font-bold">
                                        <option value="">-- Choisir --</option>
                                        {employes.map(e => <option key={e.id} value={e.id}>{e.nom}</option>)}
                                    </select>
                                </div>
                            )}
                            <button onClick={() => window.print()} className="ml-auto p-2 bg-gray-800 text-white rounded-lg flex items-center gap-2 text-[10px] font-black uppercase tracking-widest hover:bg-black transition-all shadow-md"><Printer size={14}/> Imprimer</button>
                        </div>
                        <div className="flex-1 overflow-auto p-6" id="printable-report">
                            {reportType === 'GLOBAL' ? (
                                <table className="w-full text-xs text-left border-collapse border-2 border-gray-100">
                                    <thead className="bg-gray-50 sticky top-0 font-black uppercase text-[10px]">
                                        <tr><th className="p-3 border">Employé</th><th className="p-3 border text-center">Présences</th><th className="p-3 border text-center">Retards</th><th className="p-3 border text-center">Absences</th></tr>
                                    </thead>
                                    <tbody>
                                        {activeEmployes.map(emp => {
                                            const pts = pointages.filter(p => p.employeId === emp.id && p.date.startsWith(reportMonth));
                                            return (
                                                <tr key={emp.id} className="hover:bg-gray-50">
                                                    <td className="p-3 border font-black uppercase">{emp.nom}</td>
                                                    <td className="p-3 border text-center text-green-600 font-black">{pts.filter(p => p.statut === 'PRESENT').length}</td>
                                                    <td className="p-3 border text-center text-orange-600 font-black">{pts.filter(p => p.statut === 'RETARD').length}</td>
                                                    <td className="p-3 border text-center text-red-600 font-black">{pts.filter(p => p.statut === 'ABSENT').length}</td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            ) : (
                                <div>
                                    {!reportEmployeeId ? <p className="text-center text-gray-400 py-20 font-bold uppercase">Sélectionnez un employé pour voir le détail.</p> : (
                                        <table className="w-full text-xs text-left border-collapse border-2 border-gray-100">
                                            <thead className="bg-gray-50 sticky top-0 font-black uppercase text-[10px]">
                                                <tr><th className="p-3 border">Date</th><th className="p-3 border">Statut</th><th className="p-3 border text-center">Arrivée</th><th className="p-3 border text-center">Départ</th></tr>
                                            </thead>
                                            <tbody>
                                                {pointages.filter(p => p.employeId === reportEmployeeId && p.date.startsWith(reportMonth)).sort((a,b) => b.date.localeCompare(a.date)).map(pt => (
                                                    <tr key={pt.id} className="hover:bg-gray-50">
                                                        <td className="p-3 border font-mono">{pt.date}</td>
                                                        <td className="p-3 border"><span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${getPointageStatusColor(pt.statut)}`}>{pt.statut}</span></td>
                                                        <td className="p-3 border text-center font-mono">{pt.heureArrivee || '-'}</td>
                                                        <td className="p-3 border text-center font-mono">{pt.heureDepart || '-'}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* --- MODAL FORMULAIRE EMPLOYÉ + PERMISSIONS --- */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-brand-900/80 z-[400] flex items-center justify-center p-4 backdrop-blur-sm">
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg p-8 animate-in zoom-in duration-200 flex flex-col max-h-[95vh]">
                        <div className="flex justify-between items-center mb-6 shrink-0 border-b pb-4">
                            <h3 className="text-xl font-black flex items-center gap-3 uppercase tracking-tighter">
                                {editingEmployee ? <Edit2 className="text-blue-600"/> : <Plus className="text-brand-600"/>}
                                {editingEmployee ? 'Modifier Profil' : 'Nouvel Employé'}
                            </h3>
                            <button onClick={() => setIsModalOpen(false)}><X size={24}/></button>
                        </div>

                        {/* Onglets Modal */}
                        <div className="flex bg-gray-100 p-1 rounded-xl mb-6 shrink-0">
                            <button onClick={() => setModalSubTab('INFOS')} className={`flex-1 py-2 text-xs font-black uppercase rounded-lg transition-all ${modalSubTab === 'INFOS' ? 'bg-white shadow text-brand-900' : 'text-gray-500'}`}>Informations</button>
                            <button onClick={() => setModalSubTab('PERMISSIONS')} className={`flex-1 py-2 text-xs font-black uppercase rounded-lg transition-all ${modalSubTab === 'PERMISSIONS' ? 'bg-white shadow text-brand-900' : 'text-gray-500'}`}>Accès & Droits</button>
                        </div>

                        <div className="space-y-6 flex-1 overflow-y-auto pr-2 custom-scrollbar">
                            {modalSubTab === 'INFOS' ? (
                                <>
                                    <div>
                                        <label className="block text-[10px] font-black text-gray-400 uppercase mb-1 ml-1">Nom Complet</label>
                                        <input type="text" className="w-full p-3 border-2 border-gray-100 rounded-xl font-bold bg-gray-50 uppercase" value={formData.nom} onChange={e => setFormData({...formData, nom: e.target.value})} />
                                    </div>

                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-[10px] font-black text-gray-400 uppercase mb-1">Rôle</label>
                                            <select className="w-full p-3 border-2 border-gray-100 rounded-xl font-bold bg-gray-50" value={formData.role} onChange={e => setFormData({...formData, role: e.target.value as any})}>
                                                {Object.values(RoleEmploye).map(r => <option key={r} value={r}>{r}</option>)}
                                            </select>
                                        </div>
                                        <div>
                                            <label className="block text-[10px] font-black text-gray-400 uppercase mb-1">Téléphone</label>
                                            <input type="text" className="w-full p-3 border-2 border-gray-100 rounded-xl font-bold bg-gray-50" value={formData.telephone} onChange={e => setFormData({...formData, telephone: e.target.value})} />
                                        </div>
                                    </div>

                                    <div className="bg-brand-50 p-4 rounded-xl border-2 border-brand-100">
                                        <label className="block text-[10px] font-black text-brand-600 uppercase mb-1 ml-1">Mot de passe d'accès</label>
                                        <div className="relative">
                                            <Lock className="absolute left-3 top-3 text-brand-300" size={18}/>
                                            <input type="text" className="w-full pl-10 pr-3 py-3 border-2 border-white rounded-xl font-mono text-sm font-black bg-white shadow-sm" placeholder="Par défaut: téléphone" value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} />
                                        </div>
                                        <p className="text-[9px] text-brand-400 mt-2 italic">* Laissez vide pour utiliser le numéro de téléphone comme mot de passe.</p>
                                    </div>

                                    <div className="bg-blue-50/50 p-5 rounded-2xl border-2 border-blue-100/50">
                                        <label className="block text-[10px] font-black text-blue-400 uppercase tracking-widest mb-4 text-center">Identité Nationale (Images)</label>
                                        <div className="grid grid-cols-2 gap-3">
                                            <div onClick={() => rectoInputRef.current?.click()} className="aspect-video bg-white border-2 border-dashed border-gray-200 rounded-xl flex flex-col items-center justify-center cursor-pointer overflow-hidden relative">
                                                {formData.cniRecto ? <img src={formData.cniRecto} className="w-full h-full object-cover" /> : <div className="flex flex-col items-center gap-1"><Upload size={20} className="text-gray-300"/><span className="text-[8px] font-black text-gray-400 uppercase">Recto</span></div>}
                                                <input type="file" ref={rectoInputRef} className="hidden" accept="image/*" onChange={e => handleFileUpload(e, 'recto')} />
                                            </div>
                                            <div onClick={() => versoInputRef.current?.click()} className="aspect-video bg-white border-2 border-dashed border-gray-200 rounded-xl flex flex-col items-center justify-center cursor-pointer overflow-hidden relative">
                                                {formData.cniVerso ? <img src={formData.cniVerso} className="w-full h-full object-cover" /> : <div className="flex flex-col items-center gap-1"><Upload size={20} className="text-gray-300"/><span className="text-[8px] font-black text-gray-400 uppercase">Verso</span></div>}
                                                <input type="file" ref={versoInputRef} className="hidden" accept="image/*" onChange={e => handleFileUpload(e, 'verso')} />
                                            </div>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-[10px] font-black text-gray-400 uppercase mb-1">Salaire Base</label>
                                            <input type="number" className="w-full p-3 border-2 border-gray-100 rounded-xl font-bold bg-gray-50" value={formData.salaireBase} onChange={e => setFormData({...formData, salaireBase: parseInt(e.target.value)||0})} />
                                        </div>
                                        <div>
                                            <label className="block text-[10px] font-black text-gray-400 uppercase mb-1">Email (Accès Cloud)</label>
                                            <input type="email" className="w-full p-3 border-2 border-gray-100 rounded-xl font-bold bg-gray-50" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} placeholder="Ex: amadou@by-tchico.com" />
                                        </div>
                                    </div>
                                </>
                            ) : (
                                <div className="space-y-4">
                                    <div className="p-4 bg-amber-50 rounded-2xl border border-amber-100 flex items-start gap-3 mb-4">
                                        <Shield size={20} className="text-amber-600 shrink-0 mt-1"/>
                                        <p className="text-[10px] text-amber-800 font-bold uppercase leading-relaxed">Définissez ici ce que cet employé peut voir ou modifier dans l'application.</p>
                                    </div>
                                    
                                    <div className="space-y-2">
                                        {Object.entries(formData.permissions || DEFAULT_PERMISSIONS).map(([module, level]) => (
                                            <div key={module} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl border border-gray-100">
                                                <span className="text-[10px] font-black uppercase text-gray-600">{module.replace('approvisionnement', 'approv.')}</span>
                                                <div className="flex bg-white p-1 rounded-lg border">
                                                    {(['NONE', 'READ', 'WRITE'] as NiveauAcces[]).map(lvl => (
                                                        <button 
                                                            key={lvl} 
                                                            onClick={() => setFormData({...formData, permissions: {...(formData.permissions || DEFAULT_PERMISSIONS), [module]: lvl}})}
                                                            className={`px-2 py-1 text-[8px] font-black rounded ${level === lvl ? 'bg-brand-900 text-white shadow-sm' : 'text-gray-400'}`}
                                                        >
                                                            {lvl}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="flex justify-end gap-3 mt-8 pt-4 border-t shrink-0">
                            <button onClick={() => setIsModalOpen(false)} className="px-6 py-2 text-gray-400 font-black uppercase text-[10px]">Annuler</button>
                            <button onClick={() => {
                                if (!formData.nom) return;
                                if (editingEmployee) onUpdateEmploye({ ...editingEmployee, ...formData as Employe });
                                else onAddEmploye({ id: `E${Date.now()}`, ...formData as Employe, historiquePaie: [], absences: [], actif: true });
                                setIsModalOpen(false);
                            }} className="px-10 py-4 bg-brand-900 text-white rounded-2xl font-black uppercase text-[10px] shadow-xl active:scale-95 transition-all">Enregistrer</button>
                        </div>
                    </div>
                </div>
            )}

            {/* --- MODAL HISTORIQUE (MODIFIER/SUPPRIMER RESTAURÉS) --- */}
            {historyModalOpen && selectedEmployeeForHistory && (
                <div className="fixed inset-0 bg-brand-900/80 z-[500] flex items-center justify-center p-4 backdrop-blur-sm">
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md p-6 flex flex-col max-h-[80vh] animate-in zoom-in duration-200">
                        <div className="flex justify-between items-center mb-6 border-b pb-4">
                            <h3 className="font-black text-gray-800 flex items-center gap-3 uppercase tracking-tighter text-lg"><History className="text-blue-600"/> Historique : {selectedEmployeeForHistory.nom}</h3>
                            <button onClick={() => { setHistoryModalOpen(false); setEditingHistoryItem(null); }}><X size={24}/></button>
                        </div>
                        
                        <div className="flex-1 overflow-y-auto space-y-3 pr-2 custom-scrollbar">
                            {editingHistoryItem ? (
                                <div className="bg-blue-50 p-6 rounded-2xl border-2 border-blue-100 space-y-4 animate-in slide-in-from-top duration-300">
                                    <div className="flex justify-between items-center"><h4 className="text-xs font-black text-blue-700 uppercase tracking-widest">Modifier Transaction</h4><button onClick={() => setEditingHistoryItem(null)}><X size={18}/></button></div>
                                    <div className="grid grid-cols-2 gap-3">
                                        <div><label className="block text-[10px] font-black text-gray-400 uppercase mb-1">Date</label><input type="date" className="w-full p-2 border-2 border-white rounded-xl text-xs font-bold" value={editingHistoryItem.item.date} onChange={e => setEditingHistoryItem({...editingHistoryItem, item: {...editingHistoryItem.item, date: e.target.value}})} /></div>
                                        <div><label className="block text-[10px] font-black text-gray-400 uppercase mb-1">Type</label><select className="w-full p-2 border-2 border-white rounded-xl text-xs font-bold" value={editingHistoryItem.item.type} onChange={e => setEditingHistoryItem({...editingHistoryItem, item: {...editingHistoryItem.item, type: e.target.value as any}})}><option value="ACOMPTE">Acompte</option><option value="SALAIRE_NET">Salaire Net</option><option value="PRIME">Prime</option></select></div>
                                    </div>
                                    <div><label className="block text-[10px] font-black text-gray-400 uppercase mb-1">Montant (F)</label><input type="number" className="w-full p-3 border-2 border-white rounded-xl text-lg font-black text-blue-900" value={editingHistoryItem.item.montant} onChange={e => setEditingHistoryItem({...editingHistoryItem, item: {...editingHistoryItem.item, montant: parseInt(e.target.value)||0}})} /></div>
                                    <div><label className="block text-[10px] font-black text-gray-400 uppercase mb-1">Libellé</label><input type="text" className="w-full p-2 border-2 border-white rounded-xl text-xs font-bold" value={editingHistoryItem.item.description} onChange={e => setEditingHistoryItem({...editingHistoryItem, item: {...editingHistoryItem.item, description: e.target.value}})} /></div>
                                    <button onClick={handleSaveEditHistory} className="w-full py-3 bg-blue-600 text-white rounded-xl font-black uppercase text-[10px] shadow-lg flex items-center justify-center gap-2"><Save size={16}/> Enregistrer les changements</button>
                                </div>
                            ) : (
                                <>
                                    {!selectedEmployeeForHistory.historiquePaie || selectedEmployeeForHistory.historiquePaie.length === 0 ? <p className="text-center text-gray-400 py-10 font-bold uppercase text-xs">Aucun historique.</p> : (
                                        selectedEmployeeForHistory.historiquePaie.map(h => (
                                            <div key={h.id} className="p-4 border-2 border-gray-50 rounded-2xl bg-white flex justify-between items-center shadow-sm group hover:border-blue-100 transition-all">
                                                <div className="flex-1">
                                                    <div className="flex items-center gap-2">
                                                        <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase ${h.type === 'ACOMPTE' ? 'bg-orange-100 text-orange-700' : 'bg-green-100 text-green-700'}`}>{h.type}</span>
                                                        <p className="text-[10px] text-gray-400 font-bold">{new Date(h.date).toLocaleDateString()}</p>
                                                    </div>
                                                    <p className="font-black text-gray-800 text-sm mt-1">{h.montant.toLocaleString()} F</p>
                                                    <p className="text-[10px] text-gray-500 italic mt-0.5 line-clamp-1">{h.description}</p>
                                                    {h.createdBy && <p className="text-[8px] text-gray-300 mt-1 font-bold uppercase tracking-widest">Par: {h.createdBy}</p>}
                                                </div>
                                                {canManageHR && (
                                                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                        <button onClick={() => setEditingHistoryItem({empId: selectedEmployeeForHistory.id, item: {...h}})} className="p-2 text-blue-300 hover:text-blue-600 hover:bg-blue-50 rounded-xl" title="Modifier"><Edit2 size={16}/></button>
                                                        <button onClick={() => handleDeletePayrollTransaction(selectedEmployeeForHistory, h.id)} className="p-2 text-red-300 hover:text-red-600 hover:bg-red-50 rounded-xl" title="Supprimer"><Trash2 size={16}/></button>
                                                    </div>
                                                )}
                                            </div>
                                        ))
                                    )}
                                </>
                            )}
                        </div>
                        <div className="mt-6 pt-4 border-t flex justify-end">
                            <button onClick={() => {setHistoryModalOpen(false); setEditingHistoryItem(null);}} className="px-10 py-3 bg-gray-900 text-white rounded-2xl font-black uppercase text-[10px] shadow-lg">Fermer</button>
                        </div>
                    </div>
                </div>
            )}

            {/* --- MODAL RÈGLEMENT PAIE --- */}
            {payModalOpen && selectedEmployeeForPay && (
                <div className="fixed inset-0 bg-brand-900/80 z-[500] flex items-center justify-center p-4 backdrop-blur-sm">
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm p-8 animate-in zoom-in duration-200">
                        <div className="flex justify-between items-center mb-8 border-b pb-4">
                            <h3 className="font-black text-gray-800 flex items-center gap-3 uppercase tracking-tighter text-lg"><DollarSign className="text-green-600" size={28}/> Règlement Salaire</h3>
                            <button onClick={() => setPayModalOpen(false)}><X size={28}/></button>
                        </div>
                        <div className="space-y-6">
                            <div className="text-center bg-gray-50 p-5 rounded-2xl border-2 border-dashed border-gray-200">
                                <p className="text-[10px] font-black text-gray-400 uppercase">Employé</p>
                                <p className="text-lg font-black text-gray-900 uppercase">{selectedEmployeeForPay.nom}</p>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div><label className="block text-[10px] font-black text-gray-400 mb-1 ml-1">Date</label><input type="date" className="w-full p-3 border-2 border-gray-100 rounded-xl text-xs font-bold" value={transactionData.date} onChange={e => setTransactionData({...transactionData, date: e.target.value})} /></div>
                                <div><label className="block text-[10px] font-black text-gray-400 mb-1 ml-1">Type</label><select className="w-full p-3 border-2 border-gray-100 rounded-xl text-xs font-bold" value={transactionData.type} onChange={e => setTransactionData({...transactionData, type: e.target.value})}><option value="ACOMPTE">Acompte</option><option value="SALAIRE_NET">Salaire Net</option><option value="PRIME">Prime</option></select></div>
                            </div>
                            <div>
                                <label className="block text-[10px] font-black text-gray-400 mb-1 ml-1">Montant (F)</label>
                                <input type="number" className="w-full p-4 border-2 border-gray-100 rounded-2xl text-2xl font-black bg-green-50 text-green-900 focus:border-green-600 outline-none" value={transactionData.montant || ''} onChange={e => setTransactionData({...transactionData, montant: parseInt(e.target.value)||0})} placeholder="0" />
                                {transactionData.type === 'SALAIRE_NET' && (
                                    <p className="text-[9px] text-green-600 font-bold mt-1 uppercase italic">* Calculé : Salaire Base + Primes - Acomptes.</p>
                                )}
                            </div>
                            
                            {transactionData.type !== 'PRIME' && (
                                <div>
                                    <label className="block text-[10px] font-black text-gray-400 mb-1 ml-1">Caisse Source</label>
                                    <select className="w-full p-3 border-2 border-gray-100 rounded-xl text-xs font-bold" value={paymentAccountId} onChange={e => setPaymentAccountId(e.target.value)}>
                                        <option value="">-- Choisir Caisse --</option>
                                        {comptes.map(c => <option key={c.id} value={c.id}>{c.nom} ({c.solde.toLocaleString()} F)</option>)}
                                    </select>
                                </div>
                            )}
                        </div>
                        <div className="flex justify-end gap-3 mt-10 pt-4 border-t">
                            <button onClick={() => setPayModalOpen(false)} className="px-6 py-4 text-gray-400 font-black uppercase text-[10px]">Annuler</button>
                            <button onClick={handleSavePayrollTransaction} disabled={transactionData.montant <= 0 || (transactionData.type !== 'PRIME' && !paymentAccountId)} className="px-10 py-4 bg-green-600 text-white rounded-2xl font-black uppercase text-[10px] shadow-xl active:scale-95 transition-all">Valider Paie</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal Badge QR */}
            {selectedEmployeeForBadge && (
                <QRGeneratorModal
                    isOpen={qrBadgeModalOpen}
                    onClose={() => setQrBadgeModalOpen(false)}
                    value={selectedEmployeeForBadge.id}
                    title={selectedEmployeeForBadge.nom}
                    subtitle={selectedEmployeeForBadge.role}
                />
            )}

            {isScannerOpen && <QRScannerModal isOpen={isScannerOpen} onClose={() => setIsScannerOpen(false)} onScan={handleScanAttendance} />}
            
            {/* Modal Transport Groupe */}
            {transportModalOpen && (
                <div className="fixed inset-0 bg-brand-900/80 z-[400] flex items-center justify-center p-4 backdrop-blur-sm">
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg p-8 animate-in zoom-in duration-200 border border-blue-100 max-h-[90vh] flex flex-col">
                        <div className="flex justify-between items-center mb-6 border-b pb-4 shrink-0">
                            <h3 className="font-black text-gray-800 flex items-center gap-3 uppercase text-lg"><Truck size={24} className="text-blue-600"/> Transport Groupe</h3>
                            <button onClick={() => setTransportModalOpen(false)}><X size={24}/></button>
                        </div>
                        <div className="flex-1 overflow-y-auto space-y-6 pr-2 custom-scrollbar">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="bg-blue-50 p-4 rounded-2xl border border-blue-100">
                                    <label className="block text-[10px] font-black text-blue-400 uppercase mb-2 ml-1">Montant Unitaire (F)</label>
                                    <input type="number" className="w-full p-2 bg-transparent text-xl font-black text-blue-900 outline-none" value={transportData.montantUnitaire} onChange={e => setTransportData({...transportData, montantUnitaire: parseInt(e.target.value)||0})} placeholder="500" />
                                </div>
                                <div className="bg-brand-900 p-4 rounded-2xl shadow-inner">
                                    <label className="block text-[10px] font-black text-brand-300 uppercase mb-2 ml-1">Montant Total (F)</label>
                                    <p className="text-2xl font-black text-white">{transportData.montantTotal.toLocaleString()}</p>
                                </div>
                            </div>
                            <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100">
                                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-4 ml-1">Sélectionner l'équipe ({selectedTransportEmpIds.length})</label>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                    {activeEmployes.map(emp => (
                                        <button key={emp.id} onClick={() => setSelectedTransportEmpIds(prev => prev.includes(emp.id) ? prev.filter(x => x !== emp.id) : [...prev, emp.id])} className={`flex items-center gap-3 p-3 rounded-xl border-2 transition-all ${selectedTransportEmpIds.includes(emp.id) ? 'bg-blue-600 border-blue-600 text-white shadow-md' : 'bg-white border-gray-100 text-gray-600 hover:border-blue-200'}`}>
                                            {selectedTransportEmpIds.includes(emp.id) ? <CheckSquare size={18}/> : <Square size={18} className="text-gray-300"/>}
                                            <span className="text-xs font-black uppercase truncate">{emp.nom}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div><label className="block text-[10px] font-black text-gray-400 uppercase mb-2 ml-1">Date</label><input type="date" className="w-full p-3 border-2 border-gray-100 rounded-xl text-xs font-bold" value={transportData.date} onChange={e => setTransportData({...transportData, date: e.target.value})} /></div>
                                <div><label className="block text-[10px] font-black text-gray-400 uppercase mb-2 ml-1">Caisse</label><select className="w-full p-3 border-2 border-gray-100 rounded-xl text-xs font-bold" value={transportData.compteId} onChange={e => setTransportData({...transportData, compteId: e.target.value})}><option value="">-- Choisir --</option>{comptes.map(c => <option key={c.id} value={c.id}>{c.nom} ({c.solde.toLocaleString()} F)</option>)}</select></div>
                            </div>
                        </div>
                        <div className="flex justify-end gap-3 mt-10 shrink-0 pt-4 border-t">
                            <button onClick={() => setTransportModalOpen(false)} className="px-6 py-4 text-gray-400 font-black uppercase text-[10px] tracking-widest">Annuler</button>
                            <button onClick={handleSaveTransport} disabled={!transportData.compteId || transportData.montantTotal <= 0} className="px-10 py-4 bg-blue-600 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-xl disabled:opacity-30 active:scale-95 transition-all">Valider</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default HRView;
