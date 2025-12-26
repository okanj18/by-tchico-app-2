
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Employe, Boutique, Depense, Pointage, SessionUser, RoleEmploye, TransactionPaie, CompteFinancier, TransactionTresorerie, NiveauAcces, PermissionsUtilisateur } from '../types';
import { Users, DollarSign, Plus, Edit2, Trash2, Search, Clock, Briefcase, X, History, UserMinus, RotateCcw, QrCode, Camera, Printer, PieChart, TrendingUp, Filter, User, Cloud, ShieldCheck, Loader, Mail, Lock, Truck, CheckSquare, Square, Save, Image as ImageIcon, Upload, Shield, Eye, AlertTriangle, Calendar, CreditCard, BarChart3, ChevronLeft, ChevronRight, UserX } from 'lucide-react';
import { QRScannerModal, QRGeneratorModal } from './QRTools';
import { uploadImageToCloud } from '../services/storageService';

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
    onUpdateEmployes?: (updates: Employe[]) => void;
}

const DEFAULT_PERMISSIONS: PermissionsUtilisateur = {
    dashboard: 'READ', ventes: 'READ', production: 'READ', stock: 'READ', approvisionnement: 'READ',
    fournisseurs: 'READ', rh: 'NONE', clients: 'READ', finance: 'NONE', catalogue: 'READ', settings: 'NONE'
};

const HRView: React.FC<HRViewProps> = ({ 
    employes, boutiques, onAddEmploye, onUpdateEmploye, onDeleteEmploye, onArchiveEmploye,
    onAddDepense, depenses, onDeleteDepense, onUpdateDepense, 
    pointages, onAddPointage, onUpdatePointage, currentUser, 
    comptes, onUpdateComptes, onAddTransaction, onUpdateEmployes
}) => {
    // --- DROITS ---
    const userRole = currentUser?.role;
    const rhPerm = currentUser?.permissions?.rh || 'NONE';
    const canManageFullHR = userRole === 'ADMIN' || userRole === 'GERANT' || rhPerm === 'WRITE';
    const onlyPointage = rhPerm === 'READ' && !canManageFullHR;
    const isGardien = userRole === RoleEmploye.GARDIEN;

    const [activeTab, setActiveTab] = useState<'EMPLOYEES' | 'POINTAGE'>( (onlyPointage || isGardien) ? 'POINTAGE' : 'EMPLOYEES');
    const [searchTerm, setSearchTerm] = useState('');
    const [showArchived, setShowArchived] = useState(false);
    
    const WORK_START_HOUR = 10;
    const TOLERANCE_MINUTES = 15;

    // --- MODALS STATES ---
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [modalSubTab, setModalSubTab] = useState<'INFOS' | 'DOCS' | 'PERMISSIONS'>('INFOS');
    const [editingEmployee, setEditingEmployee] = useState<Employe | null>(null);
    const [isUploading, setIsUploading] = useState<'recto' | 'verso' | null>(null);
    const [formData, setFormData] = useState<Partial<Employe>>({
        nom: '', role: RoleEmploye.TAILLEUR, telephone: '', password: '', salaireBase: 0, email: '', cniRecto: '', cniVerso: '', permissions: {...DEFAULT_PERMISSIONS}
    });

    // History & Recap States
    const [ptGlobalHistoryOpen, setPtGlobalHistoryOpen] = useState(false);
    const [ptGlobalMode, setPtGlobalMode] = useState<'LIST' | 'RECAP'>('LIST');
    const [recapMonth, setRecapMonth] = useState(new Date().toISOString().slice(0, 7)); // YYYY-MM
    
    const [selectedEmployeeForPtHistory, setSelectedEmployeeForPtHistory] = useState<Employe | null>(null);
    const [historyModalOpen, setHistoryModalOpen] = useState(false);
    const [selectedEmployeeForHistory, setSelectedEmployeeForHistory] = useState<Employe | null>(null);
    const [editingPayEntry, setEditingPayEntry] = useState<TransactionPaie | null>(null);

    // Manual Pointage Edit
    const [editingPointage, setEditingPointage] = useState<Pointage | null>(null);

    // Transport Modal
    const [transportModalOpen, setTransportModalOpen] = useState(false);
    const [transportData, setTransportData] = useState({ 
        montantUnitaire: 1000, date: new Date().toISOString().split('T')[0], compteId: '', boutiqueId: 'ATELIER' 
    });
    const [selectedTransportEmpIds, setSelectedTransportEmpIds] = useState<string[]>([]);

    const currentTransportTotal = useMemo(() => {
        return selectedTransportEmpIds.length * transportData.montantUnitaire;
    }, [selectedTransportEmpIds, transportData.montantUnitaire]);

    // Pay Modal
    const [payModalOpen, setPayModalOpen] = useState(false);
    const [selectedEmployeeForPay, setSelectedEmployeeForPay] = useState<Employe | null>(null);
    const [paymentAccountId, setPaymentAccountId] = useState<string>('');
    const [transactionData, setTransactionData] = useState({ 
        date: new Date().toISOString().split('T')[0], type: 'ACOMPTE' as 'ACOMPTE' | 'PRIME' | 'SALAIRE_NET', montant: 0, note: '' 
    });

    // Pointage logic
    const [pointageDate, setPointageDate] = useState(new Date().toISOString().split('T')[0]);
    const [isScannerOpen, setIsScannerOpen] = useState(false);
    const [qrBadgeModalOpen, setQrBadgeModalOpen] = useState(false);
    const [selectedEmployeeForBadge, setSelectedEmployeeForBadge] = useState<Employe | null>(null);

    const filteredEmployes = employes.filter(e => {
        const matchesSearch = e.nom.toLowerCase().includes(searchTerm.toLowerCase()) || 
                              e.role.toLowerCase().includes(searchTerm.toLowerCase());
        return showArchived ? matchesSearch && e.actif === false : matchesSearch && e.actif !== false;
    });

    const activeEmployes = useMemo(() => employes.filter(e => e.actif !== false), [employes]);
    const dailyPointages = pointages.filter(p => p.date === pointageDate);

    // --- RECAPITULATIF CALCULATIONS ---
    const getEmployeeRecap = (empId: string, monthStr: string) => {
        const empPointages = pointages.filter(p => p.employeId === empId && p.date.startsWith(monthStr));
        const present = empPointages.filter(p => p.statut === 'PRESENT').length;
        const retard = empPointages.filter(p => p.statut === 'RETARD').length;
        const absent = empPointages.filter(p => p.statut === 'ABSENT').length;
        return { total: empPointages.length, present, retard, absent };
    };

    const getMonthlyPayStats = (emp: Employe, forDate?: string) => {
        const monthToQuery = forDate ? forDate.slice(0, 7) : new Date().toISOString().slice(0, 7);
        const historique = emp.historiquePaie || [];
        const primes = historique.filter(h => h.date.startsWith(monthToQuery) && h.type === 'PRIME').reduce((acc, h) => acc + h.montant, 0);
        const acomptes = historique.filter(h => h.date.startsWith(monthToQuery) && h.type === 'ACOMPTE').reduce((acc, h) => acc + h.montant, 0);
        const dejaPayeNet = historique.filter(h => h.date.startsWith(monthToQuery) && h.type === 'SALAIRE_NET').reduce((acc, h) => acc + h.montant, 0);
        const totalDu = emp.salaireBase + primes;
        const resteAPayer = totalDu - acomptes - dejaPayeNet;
        return { primes, acomptes, dejaPayeNet, totalDu, resteAPayer };
    };

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

    const handleMarkAbsent = (employeId: string) => {
        if (window.confirm("Marquer cet employé comme absent pour aujourd'hui ?")) {
            onAddPointage({ id: `PT_ABS_${Date.now()}`, employeId, date: pointageDate, statut: 'ABSENT' });
        }
    };

    const handleClockOut = (pt: Pointage) => {
        const now = new Date();
        const timeString = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
        onUpdatePointage({ ...pt, heureDepart: timeString });
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, side: 'recto' | 'verso') => {
        const file = e.target.files?.[0];
        if (!file) return;
        setIsUploading(side);
        try {
            const url = await uploadImageToCloud(file, 'cni');
            setFormData(prev => ({ ...prev, [side === 'recto' ? 'cniRecto' : 'cniVerso']: url }));
        } catch (error) {
            alert("Erreur upload image");
        } finally {
            setIsUploading(null);
        }
    };

    const handleSaveTransport = () => {
        if (!transportData.compteId || selectedTransportEmpIds.length === 0) return;
        const selectedEmps = activeEmployes.filter(e => selectedTransportEmpIds.includes(e.id));
        const depense: Depense = {
            id: `D_TR_${Date.now()}`, date: transportData.date, montant: currentTransportTotal, categorie: 'LOGISTIQUE',
            description: `Transport Groupe: ${selectedTransportEmpIds.length} pers.`,
            boutiqueId: transportData.boutiqueId, compteId: transportData.compteId, createdBy: currentUser?.nom
        };
        onAddDepense(depense);
        const updatedEmployees = selectedEmps.map(emp => {
            const transportEntry: TransactionPaie = {
                id: `TP_TR_${Date.now()}_${emp.id}`, date: transportData.date, type: 'ACOMPTE', description: `Transport Quotidien`, montant: transportData.montantUnitaire, createdBy: currentUser?.nom
            };
            return { ...emp, historiquePaie: [transportEntry, ...(emp.historiquePaie || [])] };
        });
        if (onUpdateEmployes) onUpdateEmployes(updatedEmployees);
        else updatedEmployees.forEach(e => onUpdateEmploye(e));
        setTransportModalOpen(false);
        setSelectedTransportEmpIds([]);
        alert("Transport enregistré !");
    };

    const handleSaveEmployee = () => {
        if (!formData.nom || !formData.telephone) return;
        const employeeData = { ...formData, permissions: formData.permissions || { ...DEFAULT_PERMISSIONS } } as Employe;
        if (editingEmployee) onUpdateEmploye(employeeData);
        else onAddEmploye({ ...employeeData, id: `E${Date.now()}`, actif: true, historiquePaie: [], absences: [] });
        setIsModalOpen(false);
    };

    const handleDeletePayEntry = (entryId: string) => {
        if (!selectedEmployeeForHistory || !window.confirm("Supprimer ce règlement ?")) return;
        const updatedHistory = (selectedEmployeeForHistory.historiquePaie || []).filter(h => h.id !== entryId);
        const updatedEmp = { ...selectedEmployeeForHistory, historiquePaie: updatedHistory };
        onUpdateEmploye(updatedEmp);
        setSelectedEmployeeForHistory(updatedEmp);
    };

    const handleUpdatePayEntry = () => {
        if (!selectedEmployeeForHistory || !editingPayEntry) return;
        const updatedHistory = (selectedEmployeeForHistory.historiquePaie || []).map(h => 
            h.id === editingPayEntry.id ? editingPayEntry : h
        );
        const updatedEmp = { ...selectedEmployeeForHistory, historiquePaie: updatedHistory };
        onUpdateEmploye(updatedEmp);
        setSelectedEmployeeForHistory(updatedEmp);
        setEditingPayEntry(null);
    };

    const handleConfirmPayment = () => {
        if (!selectedEmployeeForPay || transactionData.montant <= 0) return;
        
        if (transactionData.type !== 'PRIME' && !paymentAccountId) {
            alert("Veuillez choisir une caisse pour ce règlement.");
            return;
        }

        const entry: TransactionPaie = { 
            id:`TP_${Date.now()}`, 
            date: transactionData.date, 
            type: transactionData.type, 
            montant: transactionData.montant, 
            description: transactionData.type === 'PRIME' ? 'Prime Exceptionnelle' : transactionData.type, 
            createdBy: currentUser?.nom 
        };

        onUpdateEmploye({ ...selectedEmployeeForPay, historiquePaie: [entry, ...(selectedEmployeeForPay.historiquePaie || [])] });

        if (transactionData.type !== 'PRIME' && paymentAccountId) {
            onAddTransaction({ 
                id:`TR_P_${Date.now()}`, 
                date: transactionData.date, 
                type: 'DECAISSEMENT', 
                montant: transactionData.montant, 
                compteId: paymentAccountId, 
                description: `Paie ${selectedEmployeeForPay.nom} (${transactionData.type})`, 
                categorie: 'SALAIRE' 
            });
            onUpdateComptes(comptes.map(c => c.id === paymentAccountId ? {...c, solde: c.solde - transactionData.montant} : c));
        }

        setPayModalOpen(false);
        alert(transactionData.type === 'PRIME' ? "Prime ajoutée au compte employé !" : "Paiement validé !");
    };

    const getPointageStatusColor = (status: string) => {
        switch(status) {
            case 'PRESENT': return 'bg-green-100 text-green-800';
            case 'RETARD': return 'bg-orange-100 text-orange-800';
            case 'ABSENT': return 'bg-red-100 text-red-800';
            case 'CONGE': return 'bg-blue-100 text-blue-800';
            default: return 'bg-gray-100';
        }
    };

    return (
        <div className="h-[calc(100vh-8rem)] flex flex-col space-y-6">
            {/* --- HEADER --- */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 shrink-0">
                <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2"><Briefcase className="text-brand-600" /> Ressources Humaines</h2>
                <div className="flex flex-wrap gap-2 w-full md:w-auto">
                    <div className="flex bg-gray-100 p-1 rounded-lg">
                        {!onlyPointage && (
                            <button onClick={() => setActiveTab('EMPLOYEES')} className={`px-4 py-2 text-xs font-bold rounded-lg flex items-center gap-2 ${activeTab === 'EMPLOYEES' ? 'bg-white shadow text-brand-700' : 'text-gray-500'}`}><Users size={16} /> Employés</button>
                        )}
                        <button onClick={() => setActiveTab('POINTAGE')} className={`px-4 py-2 text-xs font-bold rounded-lg flex items-center gap-2 ${activeTab === 'POINTAGE' ? 'bg-white shadow text-brand-700' : 'text-gray-500'}`}><Clock size={16} /> Pointage</button>
                    </div>
                    {canManageFullHR && (
                        <>
                            <button onClick={() => { setSelectedTransportEmpIds([]); setTransportModalOpen(true); }} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 font-black uppercase text-[10px] tracking-widest shadow-md active:scale-95 transition-all"><Truck size={16} /> Transport Groupe</button>
                            <button onClick={() => { setFormData({ nom: '', role: RoleEmploye.TAILLEUR, telephone: '', password: '', salaireBase: 0, email: '', cniRecto: '', cniVerso: '', permissions: {...DEFAULT_PERMISSIONS} }); setEditingEmployee(null); setModalSubTab('INFOS'); setIsModalOpen(true); }} className="bg-brand-600 hover:bg-brand-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 font-black uppercase text-[10px] tracking-widest shadow-md active:scale-95 transition-all"><Plus size={16} /> Nouveau</button>
                        </>
                    )}
                </div>
            </div>

            {/* --- ONGLET EMPLOYES --- */}
            {activeTab === 'EMPLOYEES' && !onlyPointage && (
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex-1 flex flex-col min-h-0">
                    <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50 shrink-0">
                        <div className="relative w-64">
                            <Search className="absolute left-3 top-2.5 text-gray-400" size={16} />
                            <input type="text" placeholder="Chercher un nom..." className="w-full pl-10 pr-4 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-brand-500 outline-none" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
                        </div>
                        <button onClick={() => setShowArchived(!showArchived)} className={`px-4 py-2 border rounded-lg text-xs font-bold transition-all ${showArchived ? 'bg-gray-800 text-white shadow-md' : 'bg-white hover:bg-gray-100'}`}>{showArchived ? 'Voir les Archivés' : 'Voir les Actifs'}</button>
                    </div>
                    <div className="overflow-x-auto flex-1 custom-scrollbar">
                        <table className="w-full text-sm text-left min-w-[1000px]">
                            <thead className="bg-white text-gray-600 font-medium border-b sticky top-0 z-10">
                                <tr><th className="py-4 px-6">Artisan / Employé</th><th className="py-4 px-4">Rôle</th><th className="py-4 px-4 text-right">Salaire Base</th><th className="py-4 px-4 text-right text-orange-600">Acomptes</th><th className="py-4 px-4 text-right font-black">Reste à payer</th><th className="py-4 px-6 text-center">Actions</th></tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {filteredEmployes.map(emp => {
                                    const pay = getMonthlyPayStats(emp);
                                    const isArchived = emp.actif === false;
                                    return (
                                        <tr key={emp.id} className={`hover:bg-gray-50 transition-colors ${isArchived ? 'opacity-50 grayscale bg-gray-50' : ''}`}>
                                            <td className="py-4 px-6 font-bold text-gray-800 uppercase flex items-center gap-2">{emp.nom} {isArchived && <span className="text-[8px] bg-red-100 text-red-600 px-2 py-0.5 rounded font-black uppercase">Archivé</span>}</td>
                                            <td className="py-4 px-4 text-xs font-bold text-brand-700">{emp.role}</td>
                                            <td className="py-4 px-4 text-right font-medium">{emp.salaireBase.toLocaleString()} F</td>
                                            <td className="py-4 px-4 text-right text-orange-600 font-bold">{pay.acomptes.toLocaleString()} F</td>
                                            <td className={`py-4 px-4 text-right font-black ${pay.resteAPayer <= 0 ? 'text-green-600' : 'text-red-700'}`}>{pay.resteAPayer.toLocaleString()} F</td>
                                            <td className="py-4 px-6 text-center">
                                                <div className="flex justify-center gap-1">
                                                    <button onClick={() => { setSelectedEmployeeForBadge(emp); setQrBadgeModalOpen(true); }} className="p-2 bg-gray-100 hover:bg-gray-200 rounded-lg" title="Badge QR"><QrCode size={16}/></button>
                                                    <button onClick={() => { setSelectedEmployeeForHistory(emp); setHistoryModalOpen(true); }} className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg" title="Histo. Paie"><History size={16}/></button>
                                                    {canManageFullHR && !isArchived && <button onClick={() => { setSelectedEmployeeForPay(emp); setPaymentAccountId(''); setTransactionData({ date: new Date().toISOString().split('T')[0], type: 'ACOMPTE', montant: 0, note: '' }); setPayModalOpen(true); }} className="p-2 text-green-600 hover:bg-green-50 rounded-lg" title="Règlement"><DollarSign size={16}/></button>}
                                                    {canManageFullHR && (
                                                        <>
                                                            <button onClick={() => { setEditingEmployee(emp); setFormData({...emp, permissions: emp.permissions || {...DEFAULT_PERMISSIONS}}); setModalSubTab('INFOS'); setIsModalOpen(true); }} className="p-2 text-gray-400 hover:text-brand-600 rounded-lg" title="Editer"><Edit2 size={16}/></button>
                                                            <button onClick={() => onArchiveEmploye?.(emp.id)} className={`p-2 rounded-lg transition-colors ${isArchived ? 'text-green-500' : 'text-orange-500'}`} title={isArchived ? "Restaurer" : "Archiver"}>{isArchived ? <RotateCcw size={16}/> : <UserMinus size={16}/>}</button>
                                                            <button onClick={() => { if(window.confirm(`Supprimer définitivement ${emp.nom} ?`)) onDeleteEmploye(emp.id) }} className="p-2 text-red-300 hover:text-red-600 rounded-lg" title="Supprimer"><Trash2 size={16}/></button>
                                                        </>
                                                    )}
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

            {/* --- ONGLET POINTAGE --- */}
            {activeTab === 'POINTAGE' && (
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex-1 flex flex-col min-h-0">
                    <div className="p-4 border-b border-gray-100 flex flex-wrap justify-between items-center bg-gray-50 gap-4 shrink-0">
                        <div className="flex items-center gap-4">
                            <input type="date" value={pointageDate} onChange={(e) => setPointageDate(e.target.value)} className="p-2 border rounded-lg text-sm font-bold shadow-sm" />
                            {canManageFullHR && <button onClick={() => setIsScannerOpen(true)} className="bg-brand-900 hover:bg-black text-white px-5 py-2 rounded-lg font-black uppercase text-[10px] tracking-widest flex items-center gap-2 shadow-lg active:scale-95"><Camera size={16} /> Scanner Badge</button>}
                        </div>
                        <button onClick={() => setPtGlobalHistoryOpen(true)} className="px-4 py-2 text-xs font-bold text-gray-600 border rounded-lg bg-white hover:bg-gray-50 flex items-center gap-2 shadow-sm"><History size={14}/> Historique & Récapitulatif Global</button>
                    </div>
                    <div className="overflow-x-auto flex-1 custom-scrollbar">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-gray-50 text-gray-600 font-medium border-b sticky top-0 z-10"><tr><th className="py-4 px-6">Employé</th><th className="py-4 px-4 text-center">Statut</th><th className="py-4 px-4 text-center">Heure Arrivée</th><th className="py-4 px-4 text-center">Heure Départ</th><th className="py-4 px-6 text-center">Actions</th></tr></thead>
                            <tbody className="divide-y divide-gray-100">
                                {activeEmployes.map(emp => {
                                    const pt = dailyPointages.find(p => p.employeId === emp.id);
                                    return (
                                        <tr key={emp.id} className="hover:bg-gray-50 group">
                                            <td className="py-4 px-6 font-bold uppercase flex items-center justify-between">
                                                {emp.nom}
                                                <button onClick={() => setSelectedEmployeeForPtHistory(emp)} className="opacity-0 group-hover:opacity-100 p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-all" title="Récapitulatif Individuel"><Clock size={16}/></button>
                                            </td>
                                            <td className="py-4 px-4 text-center">{pt ? <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase ${getPointageStatusColor(pt.statut)}`}>{pt.statut}</span> : <span className="text-gray-300 text-xs font-bold">NON POINTÉ</span>}</td>
                                            <td className="py-4 px-4 text-center font-mono font-bold text-gray-600">{pt?.heureArrivee || '--:--'}</td>
                                            <td className="py-4 px-4 text-center font-mono font-bold text-gray-600">{pt?.heureDepart || '--:--'}</td>
                                            <td className="py-4 px-6 text-center">
                                                <div className="flex items-center justify-center gap-2">
                                                    {!pt ? (
                                                        <>
                                                            <button onClick={() => handleClockIn(emp.id)} className="bg-green-600 text-white px-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest hover:bg-green-700 shadow-md">Arrivée</button>
                                                            <button onClick={() => handleMarkAbsent(emp.id)} className="bg-red-50 text-red-600 px-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest hover:bg-red-100 shadow-sm border border-red-200">Absent</button>
                                                        </>
                                                    ) : (
                                                        <>
                                                            {pt.statut !== 'ABSENT' && pt.statut !== 'CONGE' && !pt.heureDepart && (
                                                                <button onClick={() => handleClockOut(pt)} className="bg-brand-600 text-white px-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest hover:bg-blue-700 shadow-md">Départ</button>
                                                            )}
                                                            <button onClick={() => setEditingPointage(pt)} className="p-2 text-gray-400 hover:text-brand-600 rounded-lg border border-gray-100" title="Modifier manuellement"><Edit2 size={16}/></button>
                                                        </>
                                                    )}
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

            {/* --- MODAL MODIFICATION MANUELLE POINTAGE --- */}
            {editingPointage && (
                <div className="fixed inset-0 bg-brand-900/80 z-[600] flex items-center justify-center p-4 backdrop-blur-sm">
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm p-8 animate-in zoom-in duration-200">
                        <div className="flex justify-between items-center mb-8 border-b pb-4">
                            <h3 className="font-black text-gray-800 flex items-center gap-3 uppercase text-lg tracking-tighter">
                                <Clock className="text-brand-600" /> Modifier Pointage
                            </h3>
                            <button onClick={() => setEditingPointage(null)}><X size={28}/></button>
                        </div>
                        
                        <div className="space-y-6">
                            <div className="bg-gray-50 p-4 rounded-2xl text-center border">
                                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Employé</p>
                                <p className="text-sm font-black text-gray-900 uppercase">{activeEmployes.find(e => e.id === editingPointage.employeId)?.nom}</p>
                            </div>

                            <div>
                                <label className="block text-[10px] font-black text-gray-400 uppercase mb-2 ml-1">Statut Présence</label>
                                <select 
                                    className="w-full p-4 border-2 border-gray-100 rounded-2xl font-bold bg-white"
                                    value={editingPointage.statut}
                                    onChange={e => setEditingPointage({...editingPointage, statut: e.target.value as any})}
                                >
                                    <option value="PRESENT">Présent</option>
                                    <option value="RETARD">Retard</option>
                                    <option value="ABSENT">Absent</option>
                                    <option value="CONGE">Congé</option>
                                </select>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-[10px] font-black text-gray-400 uppercase mb-2 ml-1">Heure Arrivée</label>
                                    <input 
                                        type="time" 
                                        className="w-full p-4 border-2 border-gray-100 rounded-2xl font-mono font-bold"
                                        value={editingPointage.heureArrivee || ''}
                                        onChange={e => setEditingPointage({...editingPointage, heureArrivee: e.target.value})}
                                    />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-black text-gray-400 uppercase mb-2 ml-1">Heure Départ</label>
                                    <input 
                                        type="time" 
                                        className="w-full p-4 border-2 border-gray-100 rounded-2xl font-mono font-bold"
                                        value={editingPointage.heureDepart || ''}
                                        onChange={e => setEditingPointage({...editingPointage, heureDepart: e.target.value})}
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="flex justify-end gap-3 mt-10 pt-4 border-t">
                            <button onClick={() => setEditingPointage(null)} className="px-6 py-4 text-gray-400 font-black uppercase text-[10px] tracking-widest">Annuler</button>
                            <button 
                                onClick={() => { onUpdatePointage(editingPointage); setEditingPointage(null); alert("Pointage mis à jour !"); }}
                                className="px-10 py-4 bg-brand-900 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-xl active:scale-95 transition-all"
                            >
                                Enregistrer
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* --- MODAL EMPLOYE (INFOS + DOCS + DROITS) --- */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-brand-900/80 z-[300] flex items-center justify-center p-4 backdrop-blur-sm">
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in duration-200 border border-brand-100">
                        <div className="p-6 bg-white border-b flex justify-between items-center">
                            <h3 className="text-xl font-black text-gray-800 uppercase tracking-tighter flex items-center gap-3">
                                <Edit2 className="text-brand-600" /> {editingEmployee ? 'Modifier Profil' : 'Nouvel Artisan'}
                            </h3>
                            <button onClick={() => setIsModalOpen(false)}><X size={28} className="text-gray-400" /></button>
                        </div>

                        <div className="bg-gray-50 p-2 flex justify-center border-b shrink-0">
                            <div className="flex bg-white rounded-xl p-1 shadow-sm border">
                                <button onClick={() => setModalSubTab('INFOS')} className={`px-4 py-2 rounded-lg text-xs font-black uppercase tracking-widest transition-all ${modalSubTab === 'INFOS' ? 'bg-brand-900 text-white' : 'text-gray-400'}`}>Informations</button>
                                <button onClick={() => setModalSubTab('DOCS')} className={`px-4 py-2 rounded-lg text-xs font-black uppercase tracking-widest transition-all ${modalSubTab === 'DOCS' ? 'bg-brand-900 text-white' : 'text-gray-400'}`}>Documents (CNI)</button>
                                <button onClick={() => setModalSubTab('PERMISSIONS')} className={`px-4 py-2 rounded-lg text-xs font-black uppercase tracking-widest transition-all ${modalSubTab === 'PERMISSIONS' ? 'bg-brand-900 text-white' : 'text-gray-400'}`}>Accès & Droits</button>
                            </div>
                        </div>

                        <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
                            {modalSubTab === 'INFOS' ? (
                                <div className="space-y-6">
                                    <div className="grid grid-cols-2 gap-4">
                                        <div><label className="block text-[10px] font-black text-gray-400 uppercase mb-1 ml-1">Nom Complet</label><input type="text" className="w-full p-3 border-2 border-gray-100 rounded-xl font-bold uppercase" value={formData.nom} onChange={e => setFormData({...formData, nom: e.target.value.toUpperCase()})} /></div>
                                        <div><label className="block text-[10px] font-black text-gray-400 uppercase mb-1 ml-1">Rôle</label><select className="w-full p-3 border-2 border-gray-100 rounded-xl font-bold" value={formData.role} onChange={e => setFormData({...formData, role: e.target.value as RoleEmploye})}><option value={RoleEmploye.TAILLEUR}>Tailleur</option><option value={RoleEmploye.VENDEUR}>Vendeur</option><option value={RoleEmploye.GERANT}>Gérant</option><option value={RoleEmploye.CHEF_ATELIER}>Chef Atelier</option><option value={RoleEmploye.GARDIEN}>Gardien</option><option value={RoleEmploye.LIVREUR}>Livreur</option></select></div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div><label className="block text-[10px] font-black text-gray-400 uppercase mb-1 ml-1">Téléphone / ID</label><input type="text" className="w-full p-3 border-2 border-gray-100 rounded-xl font-bold" value={formData.telephone} onChange={e => setFormData({...formData, telephone: e.target.value})} /></div>
                                        <div><label className="block text-[10px] font-black text-gray-400 uppercase mb-1 ml-1">Mot de passe</label><input type="text" className="w-full p-3 border-2 border-gray-100 rounded-xl font-bold" value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} placeholder="Par déf. : téléphone" /></div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div><label className="block text-[10px] font-black text-gray-400 uppercase mb-1 ml-1">Salaire de Base (F)</label><input type="number" className="w-full p-3 border-2 border-gray-100 rounded-xl font-black text-brand-700" value={formData.salaireBase} onChange={e => setFormData({...formData, salaireBase: parseInt(e.target.value)||0})} /></div>
                                        <div><label className="block text-[10px] font-black text-gray-400 uppercase mb-1 ml-1">Email</label><input type="email" className="w-full p-3 border-2 border-gray-100 rounded-xl font-bold" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} /></div>
                                    </div>
                                </div>
                            ) : modalSubTab === 'DOCS' ? (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="space-y-3">
                                        <label className="block text-[10px] font-black text-gray-400 uppercase mb-1 ml-1">Carte d'Identité (Recto)</label>
                                        <div className="w-full aspect-[1.6/1] bg-gray-50 border-2 border-dashed border-gray-200 rounded-2xl flex flex-col items-center justify-center relative overflow-hidden group">
                                            {formData.cniRecto ? (
                                                <img src={formData.cniRecto} alt="Recto" className="w-full h-full object-cover" />
                                            ) : (
                                                <ImageIcon className="text-gray-300" size={32} />
                                            )}
                                            {isUploading === 'recto' ? <Loader className="animate-spin text-brand-600" /> : (
                                                <label className="absolute inset-0 cursor-pointer flex items-center justify-center opacity-0 group-hover:opacity-100 bg-black/20 transition-opacity">
                                                    <input type="file" className="hidden" accept="image/*" onChange={e => handleFileUpload(e, 'recto')} />
                                                    <Upload className="text-white" size={24} />
                                                </label>
                                            )}
                                        </div>
                                    </div>
                                    <div className="space-y-3">
                                        <label className="block text-[10px] font-black text-gray-400 uppercase mb-1 ml-1">Carte d'Identité (Verso)</label>
                                        <div className="w-full aspect-[1.6/1] bg-gray-50 border-2 border-dashed border-gray-200 rounded-2xl flex flex-col items-center justify-center relative overflow-hidden group">
                                            {formData.cniVerso ? (
                                                <img src={formData.cniVerso} alt="Verso" className="w-full h-full object-cover" />
                                            ) : (
                                                <ImageIcon className="text-gray-300" size={32} />
                                            )}
                                            {isUploading === 'verso' ? <Loader className="animate-spin text-brand-600" /> : (
                                                <label className="absolute inset-0 cursor-pointer flex items-center justify-center opacity-0 group-hover:opacity-100 bg-black/20 transition-opacity">
                                                    <input type="file" className="hidden" accept="image/*" onChange={e => handleFileUpload(e, 'verso')} />
                                                    <Upload className="text-white" size={24} />
                                                </label>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {(Object.keys(DEFAULT_PERMISSIONS) as Array<keyof PermissionsUtilisateur>).map((key) => (
                                        <div key={key} className="flex items-center justify-between p-4 bg-gray-50 rounded-2xl border border-gray-100">
                                            <span className="text-[10px] font-black text-gray-600 uppercase tracking-widest">{key === 'settings' ? 'PARAMÈTRES & EXPORT' : key}</span>
                                            <div className="flex bg-white rounded-lg p-1 border shadow-inner">
                                                {(['NONE', 'READ', 'WRITE'] as NiveauAcces[]).map((level) => (
                                                    <button key={level} onClick={() => setFormData(prev => ({...prev, permissions: {...(prev.permissions || DEFAULT_PERMISSIONS), [key]: level}}))} className={`px-3 py-1 rounded-md text-[9px] font-black transition-all ${formData.permissions?.[key] === level ? 'bg-brand-900 text-white shadow-md' : 'text-gray-300'}`}>{level}</button>
                                                ))}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        <div className="p-6 bg-gray-50 border-t flex justify-end gap-3 shrink-0">
                            <button onClick={() => setIsModalOpen(false)} className="px-6 py-3 text-gray-400 font-black uppercase text-xs tracking-widest">Annuler</button>
                            <button onClick={handleSaveEmployee} className="px-10 py-3 bg-brand-900 text-white rounded-xl font-black uppercase text-xs tracking-widest shadow-xl active:scale-95 transition-all">Enregistrer</button>
                        </div>
                    </div>
                </div>
            )}

            {/* --- MODAL HISTORIQUE PAIE --- */}
            {historyModalOpen && selectedEmployeeForHistory && (
                <div className="fixed inset-0 bg-brand-900/80 z-[500] flex items-center justify-center p-4 backdrop-blur-sm">
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg p-8 animate-in zoom-in duration-200 flex flex-col max-h-[90vh]">
                        <div className="flex justify-between items-center mb-6 border-b pb-4 shrink-0">
                            <h3 className="font-black text-gray-800 flex items-center gap-3 uppercase text-lg tracking-tighter"><History className="text-blue-600" /> Historique Paie : {selectedEmployeeForHistory.nom}</h3>
                            <button onClick={() => { setHistoryModalOpen(false); setEditingPayEntry(null); }}><X size={28}/></button>
                        </div>

                        {editingPayEntry ? (
                            <div className="p-6 bg-blue-50 rounded-2xl border-2 border-blue-100 mb-6 space-y-4 animate-in slide-in-from-top-4">
                                <h4 className="font-black text-blue-800 text-xs uppercase tracking-widest">Modifier le règlement</h4>
                                <div className="grid grid-cols-2 gap-4">
                                    <div><label className="block text-[10px] font-black text-blue-400 uppercase mb-1">Date</label><input type="date" className="w-full p-2 rounded-lg border font-bold text-sm" value={editingPayEntry.date} onChange={e => setEditingPayEntry({...editingPayEntry, date: e.target.value})}/></div>
                                    <div><label className="block text-[10px] font-black text-blue-400 uppercase mb-1">Montant (F)</label><input type="number" className="w-full p-2 rounded-lg border font-black text-sm text-blue-900" value={editingPayEntry.montant} onChange={e => setEditingPayEntry({...editingPayEntry, montant: parseInt(e.target.value)||0})}/></div>
                                </div>
                                <div><label className="block text-[10px] font-black text-blue-400 uppercase mb-1">Libellé</label><input type="text" className="w-full p-2 rounded-lg border font-bold text-sm" value={editingPayEntry.description} onChange={e => setEditingPayEntry({...editingPayEntry, description: e.target.value})}/></div>
                                <div className="flex gap-2 pt-2"><button onClick={() => setEditingPayEntry(null)} className="flex-1 py-2 bg-white text-gray-500 rounded-lg font-bold text-xs">Annuler</button><button onClick={handleUpdatePayEntry} className="flex-1 py-2 bg-blue-600 text-white rounded-lg font-bold text-xs shadow-lg">Enregistrer</button></div>
                            </div>
                        ) : (
                            <div className="flex-1 overflow-y-auto space-y-3 pr-2 custom-scrollbar">
                                {(selectedEmployeeForHistory.historiquePaie || []).length > 0 ? (
                                    selectedEmployeeForHistory.historiquePaie?.map(h => (
                                        <div key={h.id} className="bg-gray-50 p-4 rounded-2xl border flex justify-between items-center group transition-all hover:border-blue-200">
                                            <div>
                                                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{new Date(h.date).toLocaleDateString()}</p>
                                                <p className="text-sm font-bold text-gray-800">{h.description}</p>
                                                <span className="text-[9px] font-black bg-white px-2 py-0.5 rounded border uppercase">{h.type}</span>
                                            </div>
                                            <div className="flex items-center gap-4">
                                                <p className="text-lg font-black text-gray-900">{h.montant.toLocaleString()} F</p>
                                                {canManageFullHR && (
                                                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                        <button onClick={() => setEditingPayEntry(h)} className="p-2 text-blue-600 hover:bg-blue-100 rounded-lg transition-colors"><Edit2 size={16}/></button>
                                                        <button onClick={() => handleDeletePayEntry(h.id)} className="p-2 text-red-600 hover:bg-red-100 rounded-lg transition-colors"><Trash2 size={16}/></button>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    ))
                                ) : (
                                    <p className="text-center text-gray-400 font-bold py-10 uppercase italic">Aucun historique de paie</p>
                                )}
                            </div>
                        )}
                        <div className="mt-6 pt-4 border-t flex justify-end shrink-0"><button onClick={() => setHistoryModalOpen(false)} className="px-8 py-3 bg-gray-800 text-white rounded-xl font-black uppercase text-xs tracking-widest shadow-lg">Fermer</button></div>
                    </div>
                </div>
            )}

            {/* --- MODAL HISTORIQUE GLOBAL & RECAPITULATIF POINTAGE --- */}
            {ptGlobalHistoryOpen && (
                <div className="fixed inset-0 bg-brand-900/95 z-[500] flex items-center justify-center p-4 backdrop-blur-md">
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-4xl flex flex-col h-[85vh] animate-in slide-in-from-bottom-8 duration-300 border border-brand-100">
                        <div className="p-6 border-b bg-gray-50 flex justify-between items-center rounded-t-3xl shrink-0">
                            <div className="flex items-center gap-6">
                                <h3 className="text-xl font-black text-gray-800 uppercase tracking-tighter flex items-center gap-2"><History className="text-brand-600" /> Historique & Récapitulatif Global</h3>
                                <div className="flex bg-white border rounded-xl p-1 shadow-inner">
                                    <button onClick={() => setPtGlobalMode('LIST')} className={`px-4 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all ${ptGlobalMode === 'LIST' ? 'bg-brand-900 text-white shadow-md' : 'text-gray-400'}`}>Journal</button>
                                    <button onClick={() => setPtGlobalMode('RECAP')} className={`px-4 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all ${ptGlobalMode === 'RECAP' ? 'bg-brand-900 text-white shadow-md' : 'text-gray-400'}`}>Récapitulatif</button>
                                </div>
                            </div>
                            <div className="flex items-center gap-4">
                                <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-xl border shadow-sm">
                                    <button onClick={() => {
                                        const d = new Date(recapMonth + "-01");
                                        d.setMonth(d.getMonth() - 1);
                                        setRecapMonth(d.toISOString().slice(0, 7));
                                    }} className="p-1 hover:bg-gray-100 rounded-lg text-brand-600"><ChevronLeft size={18}/></button>
                                    <span className="font-black text-xs uppercase tracking-widest px-2">{new Date(recapMonth + "-01").toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}</span>
                                    <button onClick={() => {
                                        const d = new Date(recapMonth + "-01");
                                        d.setMonth(d.getMonth() + 1);
                                        setRecapMonth(d.toISOString().slice(0, 7));
                                    }} className="p-1 hover:bg-gray-100 rounded-lg text-brand-600"><ChevronRight size={18}/></button>
                                </div>
                                <button onClick={() => setPtGlobalHistoryOpen(false)} className="p-2 hover:bg-gray-200 rounded-full transition-colors"><X size={28}/></button>
                            </div>
                        </div>

                        <div className="flex-1 overflow-y-auto custom-scrollbar">
                            {ptGlobalMode === 'LIST' ? (
                                <table className="w-full text-sm text-left">
                                    <thead className="bg-gray-100 text-gray-500 font-black uppercase text-[9px] tracking-widest sticky top-0 z-10 shadow-sm"><tr><th className="p-4">Date</th><th className="p-4">Employé</th><th className="p-4">Statut</th><th className="p-4">Arrivée</th><th className="p-4">Départ</th></tr></thead>
                                    <tbody className="divide-y divide-gray-100">
                                        {pointages.filter(p => p.date.startsWith(recapMonth)).sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map(p => {
                                            const emp = employes.find(e => e.id === p.employeId);
                                            return (
                                                <tr key={p.id} className="hover:bg-gray-50">
                                                    <td className="p-4 font-bold text-gray-400">{new Date(p.date).toLocaleDateString()}</td>
                                                    <td className="p-4 font-black text-gray-800 uppercase">{emp?.nom || 'Inconnu'}</td>
                                                    <td className="p-4"><span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase ${getPointageStatusColor(p.statut)}`}>{p.statut}</span></td>
                                                    <td className="p-4 font-mono text-xs text-gray-600">{p.heureArrivee || '--:--'}</td>
                                                    <td className="p-4 font-mono text-xs text-gray-600">{p.heureDepart || '--:--'}</td>
                                                </tr>
                                            );
                                        })}
                                        {pointages.filter(p => p.date.startsWith(recapMonth)).length === 0 && (
                                            <tr><td colSpan={5} className="py-20 text-center text-gray-400 italic font-bold">Aucune donnée pour ce mois.</td></tr>
                                        )}
                                    </tbody>
                                </table>
                            ) : (
                                <div className="p-6">
                                    <div className="grid grid-cols-4 gap-4 mb-8">
                                        <div className="bg-gray-50 p-4 rounded-2xl border flex flex-col items-center">
                                            <span className="text-[10px] font-black text-gray-400 uppercase mb-1">Total Passages</span>
                                            <span className="text-2xl font-black text-gray-800">{pointages.filter(p => p.date.startsWith(recapMonth)).length}</span>
                                        </div>
                                        <div className="bg-green-50 p-4 rounded-2xl border border-green-100 flex flex-col items-center text-green-700">
                                            <span className="text-[10px] font-black opacity-60 uppercase mb-1">Ponctuels</span>
                                            <span className="text-2xl font-black">{pointages.filter(p => p.date.startsWith(recapMonth) && p.statut === 'PRESENT').length}</span>
                                        </div>
                                        <div className="bg-orange-50 p-4 rounded-2xl border border-orange-100 flex flex-col items-center text-orange-700">
                                            <span className="text-[10px] font-black opacity-60 uppercase mb-1">Retards</span>
                                            <span className="text-2xl font-black">{pointages.filter(p => p.date.startsWith(recapMonth) && p.statut === 'RETARD').length}</span>
                                        </div>
                                        <div className="bg-red-50 p-4 rounded-2xl border border-red-100 flex flex-col items-center text-red-700">
                                            <span className="text-[10px] font-black opacity-60 uppercase mb-1">Absences</span>
                                            <span className="text-2xl font-black">{pointages.filter(p => p.date.startsWith(recapMonth) && p.statut === 'ABSENT').length}</span>
                                        </div>
                                    </div>
                                    <table className="w-full text-sm text-left border rounded-2xl overflow-hidden shadow-sm">
                                        <thead className="bg-gray-100 text-gray-500 font-black uppercase text-[10px] tracking-widest">
                                            <tr><th className="p-4">Artisan / Employé</th><th className="p-4 text-center">Taux Présence</th><th className="p-4 text-center">Présent</th><th className="p-4 text-center">Retards</th><th className="p-4 text-center">Absents</th></tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-100 bg-white">
                                            {activeEmployes.sort((a,b) => a.nom.localeCompare(b.nom)).map(emp => {
                                                const stats = getEmployeeRecap(emp.id, recapMonth);
                                                const totalDays = stats.present + stats.retard + stats.absent;
                                                const rate = totalDays > 0 ? Math.round(((stats.present + stats.retard) / totalDays) * 100) : 0;
                                                return (
                                                    <tr key={emp.id} className="hover:bg-gray-50">
                                                        <td className="p-4 font-black text-gray-800 uppercase text-xs">{emp.nom}</td>
                                                        <td className="p-4 text-center">
                                                            <div className="flex items-center gap-2 justify-center">
                                                                <div className="w-16 h-1.5 bg-gray-100 rounded-full overflow-hidden shadow-inner">
                                                                    <div className={`h-full ${rate > 80 ? 'bg-green-500' : rate > 50 ? 'bg-orange-500' : 'bg-red-500'}`} style={{ width: `${rate}%` }}></div>
                                                                </div>
                                                                <span className="font-bold text-xs">{rate}%</span>
                                                            </div>
                                                        </td>
                                                        <td className="p-4 text-center font-bold text-green-600">{stats.present}</td>
                                                        <td className="p-4 text-center font-bold text-orange-600">{stats.retard}</td>
                                                        <td className="p-4 text-center font-bold text-red-600">{stats.absent}</td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                        <div className="p-4 border-t bg-gray-50 flex justify-end shrink-0 rounded-b-3xl">
                            <button onClick={() => {
                                const data = activeEmployes.map(emp => {
                                    const stats = getEmployeeRecap(emp.id, recapMonth);
                                    return `${emp.nom},${stats.present},${stats.retard},${stats.absent}`;
                                }).join('\n');
                                const blob = new Blob([`Employe,Present,Retard,Absent\n${data}`], { type: 'text/csv' });
                                const url = URL.createObjectURL(blob);
                                const a = document.createElement('a');
                                a.href = url;
                                a.download = `Recap_Pointage_${recapMonth}.csv`;
                                a.click();
                            }} className="flex items-center gap-2 text-xs font-black uppercase text-brand-700 hover:text-brand-900 bg-white px-4 py-2 rounded-xl border shadow-sm transition-all"><Printer size={16}/> Exporter PDF/Excel</button>
                        </div>
                    </div>
                </div>
            )}

            {/* --- MODAL HISTORIQUE INDIVIDUEL POINTAGE AVEC RECAP --- */}
            {selectedEmployeeForPtHistory && (
                <div className="fixed inset-0 bg-brand-900/90 z-[500] flex items-center justify-center p-4 backdrop-blur-md">
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg flex flex-col h-[80vh] animate-in zoom-in duration-300 border border-blue-100">
                        <div className="p-6 border-b bg-gray-50 flex justify-between items-center rounded-t-3xl shrink-0">
                            <div>
                                <h3 className="text-lg font-black text-gray-800 uppercase tracking-tighter flex items-center gap-2"><Calendar className="text-blue-600" /> Présences : {selectedEmployeeForPtHistory.nom}</h3>
                                <p className="text-[10px] text-gray-400 font-black uppercase tracking-widest mt-1">Historique des 12 derniers mois</p>
                            </div>
                            <button onClick={() => setSelectedEmployeeForPtHistory(null)}><X size={28}/></button>
                        </div>
                        <div className="p-4 bg-blue-50 border-b flex justify-around shrink-0">
                            {(() => {
                                const m = new Date().toISOString().slice(0, 7);
                                const stats = getEmployeeRecap(selectedEmployeeForPtHistory.id, m);
                                return (
                                    <>
                                        <div className="text-center">
                                            <p className="text-[8px] font-black text-blue-400 uppercase tracking-widest">Ce mois</p>
                                            <p className="text-lg font-black text-blue-900">{stats.present + stats.retard}</p>
                                        </div>
                                        <div className="text-center">
                                            <p className="text-[8px] font-black text-blue-400 uppercase tracking-widest">Ponctualité</p>
                                            <p className="text-lg font-black text-green-600">{stats.present}</p>
                                        </div>
                                        <div className="text-center">
                                            <p className="text-[8px] font-black text-blue-400 uppercase tracking-widest">Retards</p>
                                            <p className="text-lg font-black text-orange-600">{stats.retard}</p>
                                        </div>
                                        <div className="text-center">
                                            <p className="text-[8px] font-black text-blue-400 uppercase tracking-widest">Absences</p>
                                            <p className="text-lg font-black text-red-600">{stats.absent}</p>
                                        </div>
                                    </>
                                );
                            })()}
                        </div>
                        <div className="flex-1 overflow-y-auto p-6 space-y-2 custom-scrollbar bg-gray-50/30">
                            {pointages.filter(p => p.employeId === selectedEmployeeForPtHistory.id).sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map(p => (
                                <div key={p.id} className="flex justify-between items-center p-4 bg-white rounded-xl border border-gray-100 group hover:border-blue-200 transition-all shadow-sm">
                                    <div>
                                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{new Date(p.date).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
                                        <p className="font-mono font-bold text-sm text-gray-700">{p.heureArrivee || '--:--'} à {p.heureDepart || 'En poste'}</p>
                                    </div>
                                    <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase ${getPointageStatusColor(p.statut)}`}>{p.statut}</span>
                                </div>
                            ))}
                            {pointages.filter(p => p.employeId === selectedEmployeeForPtHistory.id).length === 0 && (
                                <div className="text-center py-20 text-gray-400 italic font-bold">Aucun pointage enregistré pour cet employé.</div>
                            )}
                        </div>
                        <div className="p-4 border-t bg-white rounded-b-3xl shrink-0 flex justify-end"><button onClick={() => setSelectedEmployeeForPtHistory(null)} className="px-8 py-3 bg-gray-800 text-white rounded-xl font-black uppercase text-xs tracking-widest">Fermer</button></div>
                    </div>
                </div>
            )}

            {/* --- MODAL TRANSPORT GROUPE --- */}
            {transportModalOpen && (
                <div className="fixed inset-0 bg-brand-900/80 z-[400] flex items-center justify-center p-4 backdrop-blur-sm">
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg p-8 animate-in zoom-in duration-200 flex flex-col max-h-[90vh] border border-blue-100">
                        <div className="flex justify-between items-center mb-6 border-b pb-4 shrink-0">
                            <h3 className="font-black text-gray-800 flex items-center gap-3 uppercase text-lg tracking-tighter"><Truck size={24} className="text-blue-600"/> Transport Groupe</h3>
                            <button onClick={() => setTransportModalOpen(false)}><X size={24}/></button>
                        </div>
                        <div className="flex-1 overflow-y-auto space-y-6 pr-2 custom-scrollbar">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="bg-blue-50 p-5 rounded-2xl border-2 border-blue-100">
                                    <label className="block text-[10px] font-black text-blue-400 uppercase mb-2 tracking-widest">Montant / Pers. (F)</label>
                                    <input type="number" className="w-full p-2 bg-transparent text-2xl font-black text-blue-900 outline-none" value={transportData.montantUnitaire} onChange={e => setTransportData({...transportData, montantUnitaire: parseInt(e.target.value)||0})} />
                                </div>
                                <div className="bg-brand-900 p-5 rounded-2xl shadow-xl flex flex-col justify-center">
                                    <label className="block text-[10px] font-black text-brand-300 uppercase mb-1 tracking-widest">Total (F)</label>
                                    <p className="text-3xl font-black text-white">{currentTransportTotal.toLocaleString()}</p>
                                </div>
                            </div>
                            <div className="bg-gray-50 p-5 rounded-2xl border border-gray-200">
                                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-4">Équipe ({selectedTransportEmpIds.length})</label>
                                <div className="grid grid-cols-2 gap-2">
                                    {activeEmployes.map(emp => (
                                        <button key={emp.id} onClick={() => setSelectedTransportEmpIds(prev => prev.includes(emp.id) ? prev.filter(x => x !== emp.id) : [...prev, emp.id])} className={`flex items-center gap-3 p-4 rounded-xl border-2 transition-all ${selectedTransportEmpIds.includes(emp.id) ? 'bg-blue-600 border-blue-600 text-white shadow-lg' : 'bg-white border-gray-100 text-gray-600 hover:border-blue-200'}`}>
                                            {selectedTransportEmpIds.includes(emp.id) ? <CheckSquare size={18}/> : <Square size={18} className="text-gray-200"/>}
                                            <span className="text-xs font-black uppercase truncate">{emp.nom}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="p-4 bg-white rounded-2xl border-2 border-gray-100">
                                    <label className="block text-[10px] font-black text-gray-400 uppercase mb-2 tracking-widest">Source Caisse</label>
                                    <select className="w-full bg-transparent font-bold text-sm outline-none" value={transportData.compteId} onChange={e => setTransportData({...transportData, compteId: e.target.value})}><option value="">-- Choisir --</option>{comptes.map(c => <option key={c.id} value={c.id}>{c.nom} ({c.solde.toLocaleString()} F)</option>)}</select>
                                </div>
                                <div className="p-4 bg-white rounded-2xl border-2 border-gray-100">
                                    <label className="block text-[10px] font-black text-gray-400 uppercase mb-2 tracking-widest">Date</label>
                                    <input type="date" className="w-full bg-transparent font-bold text-sm outline-none" value={transportData.date} onChange={e => setTransportData({...transportData, date: e.target.value})} />
                                </div>
                            </div>
                        </div>
                        <div className="flex justify-end gap-3 mt-10 shrink-0 pt-4 border-t">
                            <button onClick={() => setTransportModalOpen(false)} className="px-8 py-4 text-gray-400 font-black uppercase text-[10px] tracking-widest">Annuler</button>
                            <button onClick={handleSaveTransport} disabled={!transportData.compteId || selectedTransportEmpIds.length === 0} className={`px-12 py-4 rounded-2xl font-black uppercase text-[11px] tracking-widest shadow-2xl transition-all ${(!transportData.compteId || selectedTransportEmpIds.length === 0) ? 'bg-gray-200 text-gray-400 cursor-not-allowed' : 'bg-blue-600 text-white hover:bg-blue-700 shadow-blue-200'}`}>Valider Transport</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal Paiement Paie */}
            {payModalOpen && selectedEmployeeForPay && (
                <div className="fixed inset-0 bg-brand-900/80 z-[500] flex items-center justify-center p-4 backdrop-blur-sm">
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm p-8 animate-in zoom-in duration-200">
                        <div className="flex justify-between items-center mb-8 border-b pb-4"><h3 className="font-black text-gray-800 flex items-center gap-3 uppercase text-lg tracking-tighter"><DollarSign className="text-green-600" size={28}/> Règlement Paie</h3><button onClick={() => setPayModalOpen(false)}><X size={28}/></button></div>
                        <div className="space-y-6">
                            <div className="text-center bg-gray-50 p-4 rounded-2xl border-2 border-dashed border-gray-200"><p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Bénéficiaire</p><p className="text-lg font-black text-gray-900 uppercase">{selectedEmployeeForPay.nom}</p></div>
                            <div className="grid grid-cols-2 gap-4">
                                <div><label className="block text-[10px] font-black text-gray-400 mb-1 ml-1 uppercase">Type</label><select className="w-full p-3 border-2 border-gray-100 rounded-xl text-xs font-bold" value={transactionData.type} onChange={e => setTransactionData({...transactionData, type: e.target.value as any})}><option value="ACOMPTE">Acompte</option><option value="SALAIRE_NET">Salaire Net</option><option value="PRIME">Prime</option></select></div>
                                <div><label className="block text-[10px] font-black text-gray-400 mb-1 ml-1 uppercase">Date</label><input type="date" className="w-full p-3 border-2 border-gray-100 rounded-xl text-xs font-bold" value={transactionData.date} onChange={e => setTransactionData({...transactionData, date: e.target.value})} /></div>
                            </div>
                            <div>
                                <label className="block text-[10px] font-black text-gray-400 mb-1 ml-1 uppercase">Montant (F)</label>
                                <input type="number" className="w-full p-4 border-2 border-brand-900/10 rounded-2xl text-2xl font-black bg-brand-50 text-brand-900" value={transactionData.montant || ''} onChange={e => setTransactionData({...transactionData, montant: parseInt(e.target.value)||0})} placeholder="0" />
                            </div>

                            {transactionData.type !== 'PRIME' && (
                                <div className="animate-in fade-in duration-300">
                                    <label className="block text-[10px] font-black text-gray-400 mb-1 ml-1 uppercase">Caisse Source</label>
                                    <select className="w-full p-3 border-2 border-gray-100 rounded-xl text-xs font-bold" value={paymentAccountId} onChange={e => setPaymentAccountId(e.target.value)}><option value="">-- Choisir Caisse --</option>{comptes.map(c => <option key={c.id} value={c.id}>{c.nom} ({c.solde.toLocaleString()} F)</option>)}</select>
                                </div>
                            )}

                            {transactionData.type === 'PRIME' && (
                                <div className="bg-blue-50 p-4 rounded-xl border border-blue-100 text-blue-700 text-[10px] font-bold uppercase leading-tight animate-in slide-in-from-bottom-2">
                                    💡 Les primes sont ajoutées directement à la fiche de paie de l'employé sans décaissement immédiat.
                                </div>
                            )}
                        </div>
                        <div className="flex justify-end gap-3 mt-10 pt-4 border-t">
                            <button onClick={() => setPayModalOpen(false)} className="px-6 py-4 text-gray-400 font-black uppercase text-[10px] tracking-widest">Annuler</button>
                            <button onClick={handleConfirmPayment} className="px-10 py-4 bg-green-600 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-xl active:scale-95 transition-all">Valider</button>
                        </div>
                    </div>
                </div>
            )}

            {/* SCANNER QR MODAL */}
            {isScannerOpen && (
                <QRScannerModal isOpen={isScannerOpen} onClose={() => setIsScannerOpen(false)} onScan={(id) => {
                    const emp = employes.find(e => e.id === id && e.actif !== false);
                    if (emp) {
                        const pt = dailyPointages.find(p => p.employeId === emp.id);
                        if(!pt) handleClockIn(emp.id);
                        else handleClockOut(pt);
                        setIsScannerOpen(false);
                        alert(`Pointage validé : ${emp.nom}`);
                    } else alert("Badge invalide ou employé inactif.");
                }} />
            )}

            {/* BADGE GENERATOR */}
            {selectedEmployeeForBadge && (
                <QRGeneratorModal isOpen={qrBadgeModalOpen} onClose={() => setQrBadgeModalOpen(false)} value={selectedEmployeeForBadge.id} title={selectedEmployeeForBadge.nom} subtitle={selectedEmployeeForBadge.role} />
            )}
        </div>
    );
};

export default HRView;
