
import React, { useState, useMemo, useEffect } from 'react';
import { Employe, Boutique, Depense, RoleEmploye, Pointage, SessionUser, TransactionPaie, Absence, CompteFinancier, TransactionTresorerie } from '../types';
import { Users, UserPlus, Clock, Calendar, Save, X, Edit2, Trash2, CheckCircle, XCircle, Search, Filter, Briefcase, DollarSign, Banknote, UserMinus, History, ArrowUpCircle, ArrowDownCircle, AlertCircle, Plus, TrendingUp, AlertTriangle, Archive, RotateCcw, AlertOctagon, Lock, Mail, Key } from 'lucide-react';
import { createAuthUser } from '../services/firebase';

interface HRViewProps {
    employes: Employe[];
    boutiques: Boutique[];
    onAddEmploye: (e: Employe) => void;
    onUpdateEmploye: (e: Employe) => void;
    onDeleteEmploye: (id: string) => void;
    onAddDepense: (d: Depense) => void;
    pointages: Pointage[];
    onAddPointage: (p: Pointage) => void;
    onUpdatePointage: (p: Pointage) => void;
    currentUser: SessionUser | null;
    comptes: CompteFinancier[]; 
    onUpdateComptes: (comptes: CompteFinancier[]) => void;
    onAddTransaction: (t: TransactionTresorerie) => void;
}

const HRView: React.FC<HRViewProps> = ({ 
    employes, 
    boutiques, 
    onAddEmploye, 
    onUpdateEmploye, 
    onDeleteEmploye, 
    onAddDepense,
    pointages,
    onAddPointage,
    onUpdatePointage,
    currentUser,
    comptes,
    onUpdateComptes,
    onAddTransaction
}) => {
    const isPointageOnly = currentUser?.role === RoleEmploye.GARDIEN;
    const [activeTab, setActiveTab] = useState<'EMPLOYEES' | 'POINTAGE'>(isPointageOnly ? 'POINTAGE' : 'EMPLOYEES');
    const [searchTerm, setSearchTerm] = useState('');
    const [showArchived, setShowArchived] = useState(false);
    
    // Employee Modal
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingEmployee, setEditingEmployee] = useState<Employe | null>(null);
    const [formData, setFormData] = useState<Partial<Employe>>({
        nom: '',
        telephone: '',
        email: '',
        role: RoleEmploye.TAILLEUR,
        salaireBase: 0,
        typeContrat: 'CDI'
    });

    // --- STATES GESTION ACCES ---
    const [accessModalOpen, setAccessModalOpen] = useState(false);
    const [accessEmployee, setAccessEmployee] = useState<Employe | null>(null);
    const [newPassword, setNewPassword] = useState('');
    const [isCreatingAccess, setIsCreatingAccess] = useState(false);

    // --- STATES GESTION PAIE & ABSENCE ---
    const [payModalOpen, setPayModalOpen] = useState(false);
    const [selectedEmployeeForPay, setSelectedEmployeeForPay] = useState<Employe | null>(null);
    const [payTab, setPayTab] = useState<'TRANSACTION' | 'SALAIRE'>('TRANSACTION');
    const [paymentAccountId, setPaymentAccountId] = useState<string>('');
    
    // Transaction Form (Acompte/Prime)
    const [transactionData, setTransactionData] = useState({
        date: new Date().toISOString().split('T')[0],
        type: 'ACOMPTE' as 'ACOMPTE' | 'PRIME',
        montant: 0,
        note: ''
    });

    // Salary Form
    const [salaryData, setSalaryData] = useState({ 
        period: '', 
        note: '' 
    });
    const [extraPrimes, setExtraPrimes] = useState<{label: string, amount: number}[]>([]);
    const [newPrimeLine, setNewPrimeLine] = useState({label: '', amount: 0});

    // Absence Modal
    const [absenceModalOpen, setAbsenceModalOpen] = useState(false);
    const [selectedEmployeeForAbsence, setSelectedEmployeeForAbsence] = useState<Employe | null>(null);
    const [absenceData, setAbsenceData] = useState({ date: '', motif: '', nombreJours: 1, montantRetenue: 0 });

    // History Modal (Paie)
    const [historyModalOpen, setHistoryModalOpen] = useState(false);
    const [selectedEmployeeForHistory, setSelectedEmployeeForHistory] = useState<Employe | null>(null);

    // --- TRANSACTION MODIFICATION / DELETION STATE ---
    const [actionTransactionModalOpen, setActionTransactionModalOpen] = useState(false);
    const [currentActionTransaction, setCurrentActionTransaction] = useState<TransactionPaie | null>(null);
    const [actionType, setActionType] = useState<'EDIT' | 'DELETE'>('DELETE');
    const [refundAccountId, setRefundAccountId] = useState('');
    const [newEditAmount, setNewEditAmount] = useState<number>(0);

    // History Modal (Attendance) - NOUVEAU
    const [attendanceHistoryModalOpen, setAttendanceHistoryModalOpen] = useState(false);
    const [selectedEmployeeForAttendance, setSelectedEmployeeForAttendance] = useState<Employe | null>(null);

    // --- CONFIRM ARCHIVE MODAL STATE ---
    const [archiveConfirmId, setArchiveConfirmId] = useState<string | null>(null);

    // --- Pointage & Correction State ---
    const [pointageDate, setPointageDate] = useState(new Date().toISOString().split('T')[0]);
    const [correctionModalOpen, setCorrectionModalOpen] = useState(false);
    const [editingPointage, setEditingPointage] = useState<{
        id: string | null,
        employeId: string,
        employeNom: string,
        date: string, // Ajout de la date pour l'édition historique
        heureArrivee: string,
        heureDepart: string,
        statut: 'PRESENT' | 'RETARD' | 'ABSENT' | 'CONGE'
    } | null>(null);

    // Derived Data
    const filteredEmployes = employes.filter(e => {
        const matchesSearch = e.nom.toLowerCase().includes(searchTerm.toLowerCase()) || 
                              e.role.toLowerCase().includes(searchTerm.toLowerCase());
        
        if (showArchived) {
            return matchesSearch && e.actif === false;
        } else {
            return matchesSearch && e.actif !== false;
        }
    });

    const employeesToShowInPointage = employes.filter(e => e.actif !== false && (e.nom.toLowerCase().includes(searchTerm.toLowerCase())));
    const dailyPointages = pointages.filter(p => p.date === pointageDate);

    useEffect(() => {
        if (isPointageOnly) {
            setActiveTab('POINTAGE');
        }
    }, [isPointageOnly]);

    // Helpers
    const getPointageStatusColor = (status: string) => {
        switch(status) {
            case 'PRESENT': return 'bg-green-100 text-green-800';
            case 'RETARD': return 'bg-orange-100 text-orange-800';
            case 'ABSENT': return 'bg-red-100 text-red-800';
            case 'CONGE': return 'bg-blue-100 text-blue-800';
            default: return 'bg-gray-100';
        }
    };

    // ... (Code Pointage Inchangé) ...
    // --- ACTIONS POINTAGE ---
    const handleClockIn = (employeId: string) => {
        const now = new Date();
        const timeString = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
        const newPointage: Pointage = {
            id: `PT_${Date.now()}`,
            employeId,
            date: pointageDate,
            heureArrivee: timeString,
            statut: 'PRESENT' 
        };
        onAddPointage(newPointage);
    };

    const handleClockOut = (pt: Pointage) => {
        const now = new Date();
        const timeString = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
        onUpdatePointage({ ...pt, heureDepart: timeString });
    };

    const handleMarkAbsent = (employeId: string) => {
        const newPointage: Pointage = {
            id: `PT_${Date.now()}`,
            employeId,
            date: pointageDate,
            statut: 'ABSENT' 
        };
        onAddPointage(newPointage);
    };

    const handleManualTimeChange = (pt: Pointage, field: 'heureArrivee' | 'heureDepart', value: string) => {
        if (isPointageOnly) return; 
        onUpdatePointage({ ...pt, [field]: value });
    };

    // --- LOGIQUE CORRECTION POINTAGE ---
    const openCorrectionModal = (emp: Employe, existingPt?: Pointage) => {
        const dateToUse = existingPt ? existingPt.date : pointageDate;
        setEditingPointage({
            id: existingPt ? existingPt.id : null,
            employeId: emp.id,
            employeNom: emp.nom,
            date: dateToUse,
            heureArrivee: existingPt?.heureArrivee || '',
            heureDepart: existingPt?.heureDepart || '',
            statut: existingPt?.statut || 'PRESENT'
        });
        setCorrectionModalOpen(true);
    };

    const handleSaveCorrection = () => {
        if (!editingPointage) return;
        if (editingPointage.statut === 'PRESENT' || editingPointage.statut === 'RETARD') {
            if (!editingPointage.heureArrivee) {
                alert("L'heure d'arrivée est requise pour le statut Présent/Retard.");
                return;
            }
        }
        const pointageToSave: Pointage = {
            id: editingPointage.id || `PT_${Date.now()}`,
            employeId: editingPointage.employeId,
            date: editingPointage.date, 
            heureArrivee: editingPointage.heureArrivee,
            heureDepart: editingPointage.heureDepart,
            statut: editingPointage.statut
        };
        if (editingPointage.id) {
            onUpdatePointage(pointageToSave);
        } else {
            onAddPointage(pointageToSave);
        }
        setCorrectionModalOpen(false);
        setEditingPointage(null);
    };

    const openAttendanceHistory = (e: Employe) => {
        setSelectedEmployeeForAttendance(e);
        setAttendanceHistoryModalOpen(true);
    };

    // --- ACTIONS PAIE & RH ---

    // 1. Transaction Handlers (Edit / Delete)
    const openActionTransactionModal = (t: TransactionPaie, action: 'EDIT' | 'DELETE') => {
        if (t.type === 'SALAIRE_NET') {
            alert("Les salaires nets ne peuvent pas être modifiés ici pour des raisons de complexité comptable. Veuillez gérer cela via des régularisations.");
            return;
        }
        setCurrentActionTransaction(t);
        setActionType(action);
        setRefundAccountId('');
        setNewEditAmount(t.montant);
        setActionTransactionModalOpen(true);
    };

    const handleProcessTransactionAction = () => {
        if (!currentActionTransaction || !selectedEmployeeForHistory) return;
        
        // Validation Compte
        if (!refundAccountId) {
            alert("Veuillez sélectionner un compte pour l'impact financier.");
            return;
        }

        const account = comptes.find(c => c.id === refundAccountId);
        if (!account) return;

        let amountDiff = 0; // Positif = Ajouter au compte, Négatif = Retirer du compte
        let descLog = '';

        if (actionType === 'DELETE') {
            // Annulation complète : On remet l'argent dans la caisse
            amountDiff = currentActionTransaction.montant; 
            descLog = `Annulation ${currentActionTransaction.type} - ${selectedEmployeeForHistory.nom}`;
            
            // Update Employee: Remove Transaction
            const newHistory = selectedEmployeeForHistory.historiquePaie?.filter(t => t.id !== currentActionTransaction.id) || [];
            onUpdateEmploye({ ...selectedEmployeeForHistory, historiquePaie: newHistory });
            
            // Update state local pour le modal historique
            setSelectedEmployeeForHistory({ ...selectedEmployeeForHistory, historiquePaie: newHistory });

        } else if (actionType === 'EDIT') {
            const oldAmount = currentActionTransaction.montant;
            const newAmount = newEditAmount;
            
            // Si on augmente l'avance (ex: 1000 -> 1500), on doit sortir 500 de plus (diff = -500 sur compte)
            // Si on diminue l'avance (ex: 1500 -> 1000), on doit remettre 500 sur compte (diff = +500 sur compte)
            amountDiff = oldAmount - newAmount; 
            
            // Check Solde si on retire de l'argent
            if (amountDiff < 0 && account.solde < Math.abs(amountDiff)) {
                alert(`Solde insuffisant sur ${account.nom} pour ajouter ${(Math.abs(amountDiff)).toLocaleString()} F.`);
                return;
            }

            descLog = `Correction ${currentActionTransaction.type} (${oldAmount} -> ${newAmount}) - ${selectedEmployeeForHistory.nom}`;

            // Update Employee: Modify Transaction
            const newHistory = selectedEmployeeForHistory.historiquePaie?.map(t => 
                t.id === currentActionTransaction.id ? { ...t, montant: newAmount, description: t.description + ' (Modifié)' } : t
            ) || [];
            onUpdateEmploye({ ...selectedEmployeeForHistory, historiquePaie: newHistory });
            
            // Update state local
            setSelectedEmployeeForHistory({ ...selectedEmployeeForHistory, historiquePaie: newHistory });
        }

        // Update Finance Account
        const updatedComptes = comptes.map(c => c.id === refundAccountId ? { ...c, solde: c.solde + amountDiff } : c);
        onUpdateComptes(updatedComptes);

        // Log Financial Transaction
        if (amountDiff !== 0) {
            const transac: TransactionTresorerie = {
                id: `TR_CORRECT_${Date.now()}`,
                date: new Date().toISOString(),
                type: amountDiff > 0 ? 'ENCAISSEMENT' : 'DECAISSEMENT',
                montant: Math.abs(amountDiff),
                compteId: refundAccountId,
                description: descLog,
                categorie: 'SALAIRE_CORRECTION'
            };
            onAddTransaction(transac);
        }

        setActionTransactionModalOpen(false);
        setCurrentActionTransaction(null);
        alert("Opération effectuée avec succès. La trésorerie a été ajustée.");
    };

    const openPayModal = (e: Employe) => {
        const currentDate = new Date();
        const periodStr = currentDate.toLocaleString('default', { month: 'long', year: 'numeric' });
        setSelectedEmployeeForPay(e);
        setPayTab('TRANSACTION');
        setPaymentAccountId(''); // Reset account selection
        
        setTransactionData({
            date: new Date().toISOString().split('T')[0],
            type: 'ACOMPTE',
            montant: 0,
            note: ''
        });

        setSalaryData({ 
            period: `Salaire ${periodStr.charAt(0).toUpperCase() + periodStr.slice(1)}`, 
            note: '' 
        });
        setExtraPrimes([]); 
        setNewPrimeLine({label: '', amount: 0});
        setPayModalOpen(true);
    };

    // Helper pour vérifier si le salaire a déjà été payé
    const isSalaryAlreadyPaid = (emp: Employe): boolean => {
        if (!emp.historiquePaie) return false;
        const currentDate = new Date();
        return emp.historiquePaie.some(t => 
            t.type === 'SALAIRE_NET' && 
            new Date(t.date).getMonth() === currentDate.getMonth() &&
            new Date(t.date).getFullYear() === currentDate.getFullYear()
        );
    };

    const handleSaveTransaction = () => {
        if (!selectedEmployeeForPay || transactionData.montant <= 0) return;
        
        if (transactionData.type === 'ACOMPTE' && !paymentAccountId) {
            alert("Veuillez sélectionner un compte de paiement (Caisse ou Banque) pour sortir l'argent.");
            return;
        }

        // Logic Check Solde
        if (transactionData.type === 'ACOMPTE') {
            const account = comptes.find(c => c.id === paymentAccountId);
            if (account && account.solde < transactionData.montant) {
                alert(`Solde insuffisant sur ${account.nom}.`);
                return;
            }
        }

        const transaction: TransactionPaie = { 
            id: `TR_${Date.now()}`, 
            date: new Date(transactionData.date).toISOString(), 
            type: transactionData.type, 
            montant: transactionData.montant, 
            description: `${transactionData.type === 'ACOMPTE' ? 'Avance sur salaire' : 'Prime/Bonus'} : ${transactionData.note}` 
        };

        const updatedEmp = { ...selectedEmployeeForPay, historiquePaie: [transaction, ...(selectedEmployeeForPay.historiquePaie || [])] };
        onUpdateEmploye(updatedEmp);
        
        if (transactionData.type === 'ACOMPTE') {
            const depense: Depense = { 
                id: `D_ACOMPTE_${Date.now()}`, 
                date: transactionData.date, 
                montant: transactionData.montant, 
                categorie: 'SALAIRE', 
                description: `Acompte (${selectedEmployeeForPay.nom}): ${transactionData.note}`, 
                boutiqueId: selectedEmployeeForPay.boutiqueId || 'ATELIER',
                compteId: paymentAccountId
            };
            onAddDepense(depense);
        }

        setSelectedEmployeeForPay(updatedEmp);
        setTransactionData({ ...transactionData, montant: 0, note: '' });
        alert(`${transactionData.type === 'ACOMPTE' ? 'Acompte' : 'Prime'} enregistré(e) et caisse mise à jour !`);
    };

    const handleConfirmSalaire = () => {
        if (!selectedEmployeeForPay) return;
        
        if (isSalaryAlreadyPaid(selectedEmployeeForPay)) {
            alert(`Attention : Le salaire de ce mois pour ${selectedEmployeeForPay.nom} a DÉJÀ été payé !`);
            return;
        }

        if (!paymentAccountId) {
            alert("Veuillez sélectionner le compte (Caisse/Banque) utilisé pour le paiement.");
            return;
        }
        
        const currentDate = new Date(); 
        const base = selectedEmployeeForPay.salaireBase || 0;
        
        const acomptesMonth = (selectedEmployeeForPay.historiquePaie || [])
            .filter(t => t.type === 'ACOMPTE' && new Date(t.date).getMonth() === new Date().getMonth() && new Date(t.date).getFullYear() === currentDate.getFullYear())
            .reduce((acc, t) => acc + t.montant, 0);

        const historyPrimesMonth = (selectedEmployeeForPay.historiquePaie || [])
            .filter(t => t.type === 'PRIME' && new Date(t.date).getMonth() === new Date().getMonth() && new Date(t.date).getFullYear() === currentDate.getFullYear())
            .reduce((acc, t) => acc + t.montant, 0);
        
        const extraPrimesTotal = extraPrimes.reduce((acc, p) => acc + p.amount, 0);
        const totalPrimes = historyPrimesMonth + extraPrimesTotal;

        const retenuesAbsence = (selectedEmployeeForPay.absences || [])
            .filter(a => !a.reglee && new Date(a.date).getMonth() === new Date().getMonth())
            .reduce((acc, a) => acc + a.montantRetenue, 0);

        const net = base + totalPrimes - retenuesAbsence - acomptesMonth;

        if (net < 0) { alert("Erreur: Le salaire net ne peut pas être négatif."); return; }

        // Check Solde
        const account = comptes.find(c => c.id === paymentAccountId);
        if (account && account.solde < net) {
            alert(`Solde insuffisant sur ${account.nom}.`);
            return;
        }

        const dateIso = new Date().toISOString();
        
        let desc = `${salaryData.period}. Base: ${base}`;
        if (totalPrimes > 0) desc += `, Primes: +${totalPrimes}`;
        if (retenuesAbsence > 0) desc += `, Retenues: -${retenuesAbsence}`;
        if (acomptesMonth > 0) desc += `, Acomptes déduits: -${acomptesMonth}`;

        const transactionSalaire: TransactionPaie = { 
            id: `TR_SAL_${Date.now()}`, 
            date: dateIso, 
            type: 'SALAIRE_NET', 
            montant: net, 
            description: desc
        };

        const updatedAbsences = (selectedEmployeeForPay.absences || []).map(a => { 
            if (!a.reglee && new Date(a.date).getMonth() === currentDate.getMonth()) { return { ...a, reglee: true }; } 
            return a; 
        });

        const updatedEmp = { ...selectedEmployeeForPay, historiquePaie: [transactionSalaire, ...(selectedEmployeeForPay.historiquePaie || [])], absences: updatedAbsences };
        onUpdateEmploye(updatedEmp);
        
        const depense: Depense = { 
            id: `D_SALAIRE_${Date.now()}`, 
            date: dateIso.split('T')[0], 
            montant: net, 
            categorie: 'SALAIRE', 
            description: `Salaire ${salaryData.period} - ${selectedEmployeeForPay.nom}`, 
            boutiqueId: selectedEmployeeForPay.boutiqueId || 'ATELIER',
            compteId: paymentAccountId
        };
        onAddDepense(depense);
        setPayModalOpen(false);
    };

    // ... (Code existant pour AbsenceModal, Employee CRUD, Restore, Access, etc. inchangé) ...
    // Absence Actions
    const openAbsenceModal = (e: Employe) => {
        setSelectedEmployeeForAbsence(e);
        const dailyRate = e.salaireBase ? Math.round(e.salaireBase / 26) : 0;
        setAbsenceData({ date: new Date().toISOString().split('T')[0], motif: '', nombreJours: 1, montantRetenue: dailyRate });
        setAbsenceModalOpen(true);
    };

    const handleSaveAbsence = () => {
        if (!selectedEmployeeForAbsence || !absenceData.motif) return;
        const newAbsence: Absence = { 
            id: `ABS_${Date.now()}`, 
            date: absenceData.date, 
            motif: absenceData.motif, 
            nombreJours: absenceData.nombreJours, 
            montantRetenue: absenceData.montantRetenue, 
            reglee: false 
        };
        const updatedEmp = { ...selectedEmployeeForAbsence, absences: [newAbsence, ...(selectedEmployeeForAbsence.absences || [])] };
        onUpdateEmploye(updatedEmp);
        setAbsenceModalOpen(false);
    };

    // Employee CRUD
    const handleSaveEmployee = () => {
        if (!formData.nom || !formData.telephone) return;
        if (editingEmployee) {
            onUpdateEmploye({ ...editingEmployee, ...formData as Employe });
        } else {
            const newEmp: Employe = {
                id: `E_${Date.now()}`,
                ...formData as Employe,
                actif: true,
                historiquePaie: [],
                absences: []
            };
            onAddEmploye(newEmp);
        }
        setIsModalOpen(false);
    };

    const openEditModal = (e: Employe) => { setEditingEmployee(e); setFormData(e); setIsModalOpen(true); };
    const openAddModal = () => { setEditingEmployee(null); setFormData({ nom: '', telephone: '', email: '', role: RoleEmploye.TAILLEUR, salaireBase: 0, typeContrat: 'CDI' }); setIsModalOpen(true); };
    const openHistoryModal = (e: Employe) => { setSelectedEmployeeForHistory(e); setHistoryModalOpen(true); };
    const handleRestoreEmployee = (emp: Employe) => { onUpdateEmploye({ ...emp, actif: true }); };
    const triggerArchive = (e: React.MouseEvent, id: string) => { e.preventDefault(); e.stopPropagation(); setArchiveConfirmId(id); };
    const confirmArchive = () => { if (archiveConfirmId) { onDeleteEmploye(archiveConfirmId); setArchiveConfirmId(null); } };
    const openAccessModal = (e: Employe) => { setAccessEmployee(e); setNewPassword(''); setAccessModalOpen(true); };
    const handleCreateAccess = async () => { /* ... existing code ... */ setIsCreatingAccess(true); try { await createAuthUser(accessEmployee!.email!, newPassword); alert(`Compte créé.`); setAccessModalOpen(false); } catch (error: any) { alert("Erreur: " + error.message); } finally { setIsCreatingAccess(false); } };

    return (
        <div className="h-[calc(100vh-8rem)] flex flex-col space-y-6">
            {/* ... (Header et Tableaux inchangés) ... */}
            {/* Je reprends le JSX existant pour la structure globale */}
            <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                    <Briefcase className="text-brand-600" /> Ressources Humaines
                </h2>
                <div className="flex gap-2">
                    {!isPointageOnly && (
                        <div className="flex bg-gray-100 p-1 rounded-lg">
                            <button onClick={() => setActiveTab('EMPLOYEES')} className={`px-3 py-1.5 text-xs font-bold rounded flex items-center gap-1 ${activeTab === 'EMPLOYEES' ? 'bg-white shadow text-brand-700' : 'text-gray-500'}`}><Users size={14} /> Employés</button>
                            <button onClick={() => setActiveTab('POINTAGE')} className={`px-3 py-1.5 text-xs font-bold rounded flex items-center gap-1 ${activeTab === 'POINTAGE' ? 'bg-white shadow text-brand-700' : 'text-gray-500'}`}><Clock size={14} /> Pointage</button>
                        </div>
                    )}
                    {activeTab === 'EMPLOYEES' && !isPointageOnly && (
                        <div className="flex gap-2">
                            <button onClick={() => setShowArchived(!showArchived)} className={`px-3 py-2 rounded-lg flex items-center gap-2 font-medium transition-colors text-sm border ${showArchived ? 'bg-gray-800 text-white border-gray-800' : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'}`}><Archive size={16} />{showArchived ? 'Voir Actifs' : 'Archives'}</button>
                            {!showArchived && (<button onClick={openAddModal} className="bg-brand-600 hover:bg-brand-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 font-medium transition-colors text-sm"><UserPlus size={16} /> Nouveau</button>)}
                        </div>
                    )}
                </div>
            </div>

            {/* LISTE DES EMPLOYES (Partial render for brevity, assuming existing table structure) */}
            {activeTab === 'EMPLOYEES' && !isPointageOnly && (
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex-1 flex flex-col">
                    <div className={`p-4 border-b border-gray-100 flex gap-4 ${showArchived ? 'bg-gray-50' : ''}`}>
                        <div className="relative flex-1"><Search className="absolute left-3 top-2.5 text-gray-400" size={18} /><input type="text" placeholder="Rechercher employé..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm" /></div>
                        {showArchived && <div className="flex items-center px-4 bg-orange-100 text-orange-800 rounded-lg text-xs font-bold"><Archive size={14} className="mr-2"/> MODE ARCHIVES</div>}
                    </div>
                    <div className="overflow-x-auto flex-1">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-gray-50 text-gray-600 font-medium">
                                <tr><th className="py-3 px-4">Nom</th><th className="py-3 px-4">Rôle</th><th className="py-3 px-4">Téléphone / Email</th><th className="py-3 px-4">Contrat</th><th className="py-3 px-4 text-right">Salaire Base</th><th className="py-3 px-4 text-center">Actions</th></tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {filteredEmployes.map(emp => (
                                    <tr key={emp.id} className={`hover:bg-gray-50 ${showArchived ? 'opacity-70 bg-gray-50' : ''}`}>
                                        <td className="py-3 px-4 font-bold text-gray-800">{emp.nom}</td>
                                        <td className="py-3 px-4"><span className="bg-brand-50 text-brand-800 px-2 py-1 rounded text-xs border border-brand-100">{emp.role}</span></td>
                                        <td className="py-3 px-4 text-gray-600"><div>{emp.telephone}</div>{emp.email && <div className="text-xs text-blue-500">{emp.email}</div>}</td>
                                        <td className="py-3 px-4 text-gray-600">{emp.typeContrat}</td>
                                        <td className="py-3 px-4 text-right font-medium">{emp.salaireBase.toLocaleString()} F</td>
                                        <td className="py-3 px-4 text-center">
                                            <div className="flex justify-center gap-1">
                                                {!showArchived ? (
                                                    <>
                                                        <button onClick={() => openAttendanceHistory(emp)} className="p-1.5 text-purple-600 hover:bg-purple-50 rounded" title="Historique Pointage"><Calendar size={16}/></button>
                                                        {emp.email && (<button onClick={() => openAccessModal(emp)} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded" title="Gérer Accès Connexion"><Lock size={16}/></button>)}
                                                        <button onClick={() => openAbsenceModal(emp)} className="p-1.5 text-red-500 hover:bg-red-50 rounded" title="Absence"><UserMinus size={16}/></button>
                                                        <button onClick={() => openHistoryModal(emp)} className="p-1.5 text-blue-500 hover:bg-blue-50 rounded" title="Historique Paie"><History size={16}/></button>
                                                        <button onClick={() => openPayModal(emp)} className="p-1.5 text-green-600 hover:bg-green-50 rounded" title="Payer"><Banknote size={16}/></button>
                                                        <button onClick={() => openEditModal(emp)} className="p-1.5 text-gray-500 hover:bg-gray-100 rounded" title="Modifier"><Edit2 size={16}/></button>
                                                        <button onClick={(e) => triggerArchive(e, emp.id)} className="p-1.5 text-orange-500 hover:bg-orange-50 rounded transition-colors" title="Archiver"><Archive size={16}/></button>
                                                    </>
                                                ) : (
                                                    <button onClick={() => handleRestoreEmployee(emp)} className="p-1.5 text-green-600 hover:bg-green-50 rounded flex items-center gap-1 font-medium bg-white border border-gray-200 shadow-sm" title="Restaurer"><RotateCcw size={14}/> Restaurer</button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                                {filteredEmployes.length === 0 && (<tr><td colSpan={6} className="py-8 text-center text-gray-400 italic">{showArchived ? "Aucun employé archivé." : "Aucun employé trouvé."}</td></tr>)}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* ... (ACCESS MODAL, CONFIRM ARCHIVE, POINTAGE VIEW, CORRECTION MODAL, ATTENDANCE HISTORY - Inchangés) ... */}
            {/* Je réinclus les composants pour garder le fichier complet valide */}
            {accessModalOpen && accessEmployee && (
                <div className="fixed inset-0 bg-black bg-opacity-60 z-[80] flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm p-6 animate-in zoom-in duration-200">
                        <div className="flex items-center gap-3 text-brand-600 mb-4 border-b border-gray-100 pb-3">
                            <Key size={24} />
                            <h3 className="text-lg font-bold text-gray-800">Créer Compte Connexion</h3>
                        </div>
                        <div className="mb-4">
                            <p className="text-sm text-gray-600 mb-2">Employé : <strong>{accessEmployee.nom}</strong></p>
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Email</label>
                            <input type="text" disabled value={accessEmployee.email} className="w-full p-2 border border-gray-200 rounded bg-gray-50 text-gray-600" />
                        </div>
                        <div className="mb-6">
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Nouveau Mot de Passe</label>
                            <input type="text" value={newPassword} onChange={e => setNewPassword(e.target.value)} className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-brand-500" placeholder="Min. 6 caractères" />
                        </div>
                        <div className="flex justify-end gap-3">
                            <button onClick={() => setAccessModalOpen(false)} className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-lg font-medium">Annuler</button>
                            <button onClick={handleCreateAccess} disabled={isCreatingAccess || !newPassword} className="px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-lg font-bold shadow-md disabled:opacity-50">{isCreatingAccess ? 'Création...' : 'Créer Accès'}</button>
                        </div>
                    </div>
                </div>
            )}

            {archiveConfirmId && (
                <div className="fixed inset-0 bg-black bg-opacity-60 z-[90] flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm p-6 animate-in zoom-in duration-200">
                        <div className="flex items-center gap-3 text-orange-600 mb-3"><AlertOctagon size={28} /><h3 className="text-lg font-bold text-gray-900">Confirmer l'archivage ?</h3></div>
                        <p className="text-sm text-gray-600 mb-6">L'employé ne sera plus visible dans la liste active.</p>
                        <div className="flex justify-end gap-3">
                            <button onClick={() => setArchiveConfirmId(null)} className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-lg font-medium">Annuler</button>
                            <button onClick={confirmArchive} className="px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg font-bold shadow-md">Oui, Archiver</button>
                        </div>
                    </div>
                </div>
            )}

            {activeTab === 'POINTAGE' && (
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex-1 flex flex-col">
                    <div className="p-4 border-b border-gray-100 flex flex-col sm:flex-row justify-between items-center gap-4">
                        <h3 className="font-bold text-gray-700 flex items-center gap-2"><Clock size={18}/> Feuille de Présence</h3>
                        <div className="flex gap-2 items-center">
                            <Calendar size={16} className="text-gray-500"/>
                            <input type="date" value={pointageDate} onChange={(e) => setPointageDate(e.target.value)} className="border border-gray-300 rounded p-1 text-sm" />
                        </div>
                    </div>
                    <div className="overflow-x-auto flex-1">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-gray-50 text-gray-600 font-medium">
                                <tr>
                                    <th className="py-3 px-4">Employé</th><th className="py-3 px-4">Rôle</th><th className="py-3 px-4 text-center">Arrivée</th><th className="py-3 px-4 text-center">Départ</th><th className="py-3 px-4 text-center">Statut</th><th className="py-3 px-4 text-center">Action</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {employeesToShowInPointage.map(emp => {
                                    const pt = dailyPointages.find(p => p.employeId === emp.id);
                                    return (
                                        <tr key={emp.id} className="hover:bg-gray-50">
                                            <td className="py-3 px-4 font-medium text-gray-800">{emp.nom}</td>
                                            <td className="py-3 px-4 text-gray-500 text-xs">{emp.role}</td>
                                            <td className="py-3 px-4 text-center">{pt ? <input type="time" value={pt.heureArrivee || ''} disabled={isPointageOnly || pt.statut === 'ABSENT' || pt.statut === 'CONGE'} onChange={(e) => handleManualTimeChange(pt, 'heureArrivee', e.target.value)} className="p-1 border border-gray-200 rounded text-center w-24 disabled:bg-transparent disabled:border-none disabled:text-gray-400" /> : '-'}</td>
                                            <td className="py-3 px-4 text-center">{pt ? <input type="time" value={pt.heureDepart || ''} disabled={!pt.heureArrivee || isPointageOnly || pt.statut === 'ABSENT' || pt.statut === 'CONGE'} onChange={(e) => handleManualTimeChange(pt, 'heureDepart', e.target.value)} className="p-1 border border-gray-200 rounded text-center w-24 disabled:bg-transparent disabled:border-none disabled:text-gray-400" /> : '-'}</td>
                                            <td className="py-3 px-4 text-center">{pt ? <span className={`px-2 py-1 rounded text-xs font-bold ${getPointageStatusColor(pt.statut)}`}>{pt.statut}</span> : <span className="text-gray-400 italic text-xs">Non pointé</span>}</td>
                                            <td className="py-3 px-4 text-center">
                                                <div className="flex items-center justify-center gap-2">
                                                    {!pt ? (
                                                        <>
                                                            <button onClick={() => handleClockIn(emp.id)} className="bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded text-xs font-bold shadow-sm">Arrivée</button>
                                                            {!isPointageOnly && (<button onClick={() => handleMarkAbsent(emp.id)} className="text-red-500 hover:text-red-700 hover:bg-red-50 p-1 rounded" title="Marquer Absent"><XCircle size={20} /></button>)}
                                                        </>
                                                    ) : (
                                                        <>
                                                            {!pt.heureDepart && pt.statut !== 'ABSENT' && pt.statut !== 'CONGE' && (<button onClick={() => handleClockOut(pt)} className="bg-gray-800 hover:bg-gray-900 text-white px-3 py-1 rounded text-xs font-bold shadow-sm">Départ</button>)}
                                                            {!isPointageOnly && (<button onClick={() => openCorrectionModal(emp, pt)} className="p-1.5 text-blue-500 hover:bg-blue-50 rounded transition-colors" title="Corriger / Modifier"><Edit2 size={16} /></button>)}
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

            {correctionModalOpen && editingPointage && (
                <div className="fixed inset-0 bg-black bg-opacity-60 z-[70] flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm p-6 animate-in fade-in zoom-in duration-200">
                        <div className="flex justify-between items-center mb-4"><h3 className="text-xl font-bold flex items-center gap-2 text-gray-800"><Clock className="text-blue-600" /> Corriger Pointage</h3><button onClick={() => setCorrectionModalOpen(false)} className="text-gray-400 hover:text-gray-600"><X size={24} /></button></div>
                        <div className="mb-4 text-sm text-gray-600 bg-gray-50 p-3 rounded border border-gray-100"><strong>Employé :</strong> {editingPointage.employeNom}<br/><strong>Date :</strong> {new Date(editingPointage.date).toLocaleDateString()}</div>
                        <div className="space-y-4">
                            <div><label className="block text-sm font-medium text-gray-700 mb-1">Statut</label><select className="w-full p-2 border border-gray-300 rounded" value={editingPointage.statut} onChange={(e) => setEditingPointage({...editingPointage, statut: e.target.value as any})}><option value="PRESENT">Présent</option><option value="RETARD">Retard</option><option value="ABSENT">Absent</option><option value="CONGE">Congé</option></select></div>
                            {(editingPointage.statut === 'PRESENT' || editingPointage.statut === 'RETARD') && (<div className="grid grid-cols-2 gap-4"><div><label className="block text-sm font-medium text-gray-700 mb-1">Heure Arrivée</label><input type="time" className="w-full p-2 border border-gray-300 rounded" value={editingPointage.heureArrivee} onChange={(e) => setEditingPointage({...editingPointage, heureArrivee: e.target.value})} /></div><div><label className="block text-sm font-medium text-gray-700 mb-1">Heure Départ</label><input type="time" className="w-full p-2 border border-gray-300 rounded" value={editingPointage.heureDepart} onChange={(e) => setEditingPointage({...editingPointage, heureDepart: e.target.value})} /></div></div>)}
                        </div>
                        <div className="flex justify-end gap-3 mt-6"><button onClick={() => setCorrectionModalOpen(false)} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded">Annuler</button><button onClick={handleSaveCorrection} className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 font-bold">Valider Correction</button></div>
                    </div>
                </div>
            )}

            {attendanceHistoryModalOpen && selectedEmployeeForAttendance && (
                <div className="fixed inset-0 bg-black bg-opacity-60 z-[70] flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl overflow-hidden animate-in fade-in zoom-in duration-200 flex flex-col max-h-[90vh]">
                        <div className="bg-gray-800 text-white p-4 flex justify-between items-center shrink-0"><h3 className="text-lg font-bold flex items-center gap-2"><Clock size={20} /> Historique Pointage : {selectedEmployeeForAttendance.nom}</h3><button onClick={() => setAttendanceHistoryModalOpen(false)} className="text-gray-400 hover:text-white"><X size={24} /></button></div>
                        <div className="p-6 overflow-y-auto flex-1">
                            <table className="w-full text-sm text-left">
                                <thead className="bg-gray-50 text-gray-600 font-medium border-b border-gray-200"><tr><th className="py-2 px-3">Date</th><th className="py-2 px-3 text-center">Arrivée</th><th className="py-2 px-3 text-center">Départ</th><th className="py-2 px-3 text-center">Statut</th><th className="py-2 px-3 text-center">Actions</th></tr></thead>
                                <tbody className="divide-y divide-gray-100">
                                    {pointages.filter(p => p.employeId === selectedEmployeeForAttendance.id).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map(pt => (
                                        <tr key={pt.id} className="hover:bg-gray-50">
                                            <td className="py-2 px-3">{new Date(pt.date).toLocaleDateString()}</td><td className="py-2 px-3 text-center">{pt.heureArrivee || '-'}</td><td className="py-2 px-3 text-center">{pt.heureDepart || '-'}</td>
                                            <td className="py-2 px-3 text-center"><span className={`px-2 py-1 rounded text-xs font-bold ${getPointageStatusColor(pt.statut)}`}>{pt.statut}</span></td>
                                            <td className="py-2 px-3 text-center"><button onClick={() => openCorrectionModal(selectedEmployeeForAttendance, pt)} className="p-1 text-blue-500 hover:bg-blue-50 rounded" title="Modifier"><Edit2 size={16} /></button></td>
                                        </tr>
                                    ))}
                                    {pointages.filter(p => p.employeId === selectedEmployeeForAttendance.id).length === 0 && (<tr><td colSpan={5} className="text-center py-8 text-gray-400">Aucun historique de pointage.</td></tr>)}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {historyModalOpen && selectedEmployeeForHistory && (
                <div className="fixed inset-0 bg-black bg-opacity-60 z-[70] flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden animate-in fade-in zoom-in duration-200 flex flex-col max-h-[90vh]">
                        <div className="bg-gray-800 text-white p-4 flex justify-between items-center shrink-0">
                            <h3 className="text-lg font-bold flex items-center gap-2"><History size={20} /> Historique Paie : {selectedEmployeeForHistory.nom}</h3>
                            <button onClick={() => setHistoryModalOpen(false)} className="text-gray-400 hover:text-white"><X size={24} /></button>
                        </div>
                        <div className="p-6 overflow-y-auto flex-1">
                            {selectedEmployeeForHistory.historiquePaie && selectedEmployeeForHistory.historiquePaie.length > 0 ? (
                                <table className="w-full text-sm text-left">
                                    <thead className="bg-gray-50 text-gray-600 font-medium border-b border-gray-200">
                                        <tr>
                                            <th className="py-2 px-3">Date</th>
                                            <th className="py-2 px-3">Type</th>
                                            <th className="py-2 px-3">Description</th>
                                            <th className="py-2 px-3 text-right">Montant</th>
                                            <th className="py-2 px-3 text-center">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                        {selectedEmployeeForHistory.historiquePaie.sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map(tr => (
                                            <tr key={tr.id} className="hover:bg-gray-50">
                                                <td className="py-3 px-3 text-gray-500">{new Date(tr.date).toLocaleDateString()}</td>
                                                <td className="py-3 px-3"><span className={`px-2 py-1 rounded text-xs font-bold ${tr.type === 'SALAIRE_NET' ? 'bg-blue-100 text-blue-800' : tr.type === 'ACOMPTE' ? 'bg-orange-100 text-orange-800' : 'bg-green-100 text-green-800'}`}>{tr.type.replace('_', ' ')}</span></td>
                                                <td className="py-3 px-3 text-gray-700">{tr.description}</td>
                                                <td className="py-3 px-3 text-right font-bold">{tr.montant.toLocaleString()} F</td>
                                                <td className="py-3 px-3 text-center">
                                                    {tr.type !== 'SALAIRE_NET' && (
                                                        <div className="flex items-center justify-center gap-2">
                                                            <button 
                                                                onClick={() => openActionTransactionModal(tr, 'EDIT')} 
                                                                className="text-blue-500 hover:bg-blue-50 p-1 rounded" 
                                                                title="Modifier"
                                                            >
                                                                <Edit2 size={14}/>
                                                            </button>
                                                            <button 
                                                                onClick={() => openActionTransactionModal(tr, 'DELETE')} 
                                                                className="text-red-500 hover:bg-red-50 p-1 rounded" 
                                                                title="Annuler/Supprimer"
                                                            >
                                                                <Trash2 size={14}/>
                                                            </button>
                                                        </div>
                                                    )}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            ) : (<div className="text-center py-10 text-gray-400"><History size={48} className="mx-auto mb-2 opacity-20" />Aucun historique.</div>)}
                        </div>
                    </div>
                </div>
            )}

            {/* MODAL ACTION TRANSACTION (EDIT / DELETE) */}
            {actionTransactionModalOpen && currentActionTransaction && (
                <div className="fixed inset-0 bg-black bg-opacity-60 z-[80] flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm p-6 animate-in zoom-in duration-200">
                        <div className="flex items-center gap-3 text-gray-800 mb-4 border-b border-gray-100 pb-3">
                            {actionType === 'DELETE' ? <Trash2 className="text-red-600" size={24}/> : <Edit2 className="text-blue-600" size={24}/>}
                            <h3 className="text-lg font-bold">
                                {actionType === 'DELETE' ? 'Annuler Transaction' : 'Modifier Transaction'}
                            </h3>
                        </div>
                        
                        <div className="mb-4 text-sm bg-gray-50 p-3 rounded text-gray-700">
                            <p><strong>Type :</strong> {currentActionTransaction.type}</p>
                            <p><strong>Montant Actuel :</strong> {currentActionTransaction.montant.toLocaleString()} F</p>
                        </div>

                        {actionType === 'EDIT' && (
                            <div className="mb-4">
                                <label className="block text-sm font-medium text-gray-700 mb-1">Nouveau Montant</label>
                                <input 
                                    type="number" 
                                    value={newEditAmount} 
                                    onChange={e => setNewEditAmount(parseInt(e.target.value) || 0)}
                                    className="w-full p-2 border border-gray-300 rounded font-bold"
                                />
                            </div>
                        )}

                        <div className="mb-6">
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                {actionType === 'DELETE' ? 'Reverser les fonds sur le compte :' : 'Ajuster la différence sur le compte :'}
                            </label>
                            <select 
                                className="w-full p-2 border border-gray-300 rounded bg-blue-50 border-blue-200 text-sm"
                                value={refundAccountId}
                                onChange={(e) => setRefundAccountId(e.target.value)}
                            >
                                <option value="">-- Choisir Caisse / Banque --</option>
                                {comptes.map(acc => (
                                    <option key={acc.id} value={acc.id}>{acc.nom} ({acc.solde.toLocaleString()} F)</option>
                                ))}
                            </select>
                            <p className="text-[10px] text-gray-500 mt-1">
                                {actionType === 'DELETE' 
                                    ? "Le montant sera rajouté à ce solde." 
                                    : "La différence sera débitée ou créditée sur ce compte."}
                            </p>
                        </div>

                        <div className="flex justify-end gap-3">
                            <button onClick={() => setActionTransactionModalOpen(false)} className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-lg font-medium">Annuler</button>
                            <button 
                                onClick={handleProcessTransactionAction}
                                disabled={!refundAccountId}
                                className={`px-4 py-2 text-white rounded-lg font-bold shadow-md disabled:opacity-50 ${actionType === 'DELETE' ? 'bg-red-600 hover:bg-red-700' : 'bg-blue-600 hover:bg-blue-700'}`}
                            >
                                Confirmer
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ... (Existing code for PayModal, AbsenceModal, Add/Edit Employee Modals - UNCHANGED) ... */}
            {payModalOpen && selectedEmployeeForPay && (
                <div className="fixed inset-0 bg-black bg-opacity-60 z-[60] flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in duration-200">
                        {/* Content identical to previous, handled above */}
                        <div className="bg-gray-800 p-4 text-white flex justify-between items-center">
                            <div><h3 className="text-lg font-bold flex items-center gap-2"><Banknote size={20} className="text-green-400" /> Gestion Paie</h3><p className="text-sm text-gray-400">{selectedEmployeeForPay.nom} • Base: {selectedEmployeeForPay.salaireBase?.toLocaleString()} F</p></div>
                            <button onClick={() => setPayModalOpen(false)} className="text-gray-400 hover:text-white"><X size={24} /></button>
                        </div>
                        <div className="flex border-b border-gray-200">
                            <button onClick={() => setPayTab('TRANSACTION')} className={`flex-1 py-3 text-sm font-bold text-center transition-colors ${payTab === 'TRANSACTION' ? 'text-brand-600 border-b-2 border-brand-600 bg-brand-50' : 'text-gray-500 hover:bg-gray-50'}`}>Avances / Primes</button>
                            <button onClick={() => setPayTab('SALAIRE')} className={`flex-1 py-3 text-sm font-bold text-center transition-colors ${payTab === 'SALAIRE' ? 'text-green-600 border-b-2 border-green-600 bg-green-50' : 'text-gray-500 hover:bg-gray-50'}`}>Salaire Fin de Mois</button>
                        </div>
                        <div className="p-6 overflow-y-auto max-h-[70vh]">
                            {payTab === 'TRANSACTION' ? (
                                <div className="space-y-4">
                                    <div className="grid grid-cols-2 gap-4">
                                        <div><label className="block text-sm font-medium text-gray-700 mb-1">Date</label><input type="date" value={transactionData.date} onChange={e => setTransactionData({...transactionData, date: e.target.value})} className="w-full p-2 border border-gray-300 rounded" /></div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
                                            <select value={transactionData.type} onChange={e => setTransactionData({...transactionData, type: e.target.value as any})} className="w-full p-2 border border-gray-300 rounded">
                                                <option value="ACOMPTE">Acompte / Avance</option>
                                                <option value="PRIME">Prime / Bonus</option>
                                            </select>
                                        </div>
                                    </div>
                                    
                                    {transactionData.type === 'ACOMPTE' && (
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">Compte de Paiement (Source)</label>
                                            <select 
                                                className="w-full p-2 border border-gray-300 rounded bg-orange-50 border-orange-200"
                                                value={paymentAccountId}
                                                onChange={(e) => setPaymentAccountId(e.target.value)}
                                            >
                                                <option value="">-- Choisir Compte --</option>
                                                {comptes.map(acc => (
                                                    <option key={acc.id} value={acc.id}>{acc.nom} ({acc.solde.toLocaleString()} F)</option>
                                                ))}
                                            </select>
                                            <p className="text-xs text-orange-600 mt-1 flex items-center gap-1"><AlertCircle size={10} /> Débitera la caisse/banque sélectionnée.</p>
                                        </div>
                                    )}

                                    <div><label className="block text-sm font-medium text-gray-700 mb-1">Montant</label><input type="number" value={transactionData.montant} onChange={e => setTransactionData({...transactionData, montant: parseInt(e.target.value) || 0})} className="w-full p-3 border border-gray-300 rounded font-bold text-lg" placeholder="0" /></div>
                                    <div><label className="block text-sm font-medium text-gray-700 mb-1">Motif</label><input type="text" value={transactionData.note} onChange={e => setTransactionData({...transactionData, note: e.target.value})} className="w-full p-2 border border-gray-300 rounded" placeholder="Ex: Tabaski..." /></div>
                                    <div className="pt-2 flex justify-end">
                                        <button onClick={handleSaveTransaction} className={`px-6 py-2 text-white rounded-lg font-bold flex items-center gap-2 ${transactionData.type === 'ACOMPTE' ? 'bg-orange-600 hover:bg-orange-700' : 'bg-green-600 hover:bg-green-700'}`}>
                                            {transactionData.type === 'ACOMPTE' ? <ArrowUpCircle size={18} /> : <TrendingUp size={18} />} 
                                            Enregistrer {transactionData.type === 'ACOMPTE' ? 'Acompte' : 'Prime'}
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    {isSalaryAlreadyPaid(selectedEmployeeForPay) ? (
                                        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-center">
                                            <Lock size={32} className="mx-auto text-red-500 mb-2"/>
                                            <h4 className="font-bold text-red-700">Salaire Déjà Payé</h4>
                                            <p className="text-sm text-red-600">Le salaire pour ce mois a déjà été validé dans l'historique.</p>
                                        </div>
                                    ) : (
                                        <>
                                            <div><label className="block text-sm font-medium text-gray-700 mb-1">Période</label><input type="text" value={salaryData.period} onChange={e => setSalaryData({...salaryData, period: e.target.value})} className="w-full p-2 border border-gray-300 rounded bg-gray-50" /></div>
                                            <div className="bg-gray-50 p-4 rounded-lg border border-gray-200 space-y-3">
                                                <div className="flex justify-between items-center text-sm"><span className="text-gray-600">Salaire de Base</span><span className="font-bold">{(selectedEmployeeForPay.salaireBase || 0).toLocaleString()} F</span></div>
                                                <div className="flex justify-between items-center text-sm text-orange-600">
                                                    <span className="flex items-center gap-1"><ArrowDownCircle size={12}/> Acomptes Mois</span>
                                                    <span className="font-medium">
                                                        -{(selectedEmployeeForPay.historiquePaie || [])
                                                            .filter(t => t.type === 'ACOMPTE' && new Date(t.date).getMonth() === new Date().getMonth())
                                                            .reduce((acc, t) => acc + t.montant, 0).toLocaleString()} F
                                                    </span>
                                                </div>
                                                {selectedEmployeeForPay.absences && selectedEmployeeForPay.absences.filter(a => !a.reglee).length > 0 && (
                                                    <div className="flex justify-between items-center text-sm text-red-600">
                                                        <span className="flex items-center gap-1"><AlertCircle size={12}/> Retenues Absences</span>
                                                        <span className="font-medium">
                                                            -{selectedEmployeeForPay.absences.filter(a => !a.reglee).reduce((acc, a) => acc + a.montantRetenue, 0).toLocaleString()} F
                                                        </span>
                                                    </div>
                                                )}
                                                <div className="border-t border-gray-300 pt-2 mt-2 flex justify-between items-center font-bold text-lg">
                                                    <span>NET À PAYER</span>
                                                    <span className="text-brand-700">
                                                        {(() => {
                                                            const base = selectedEmployeeForPay.salaireBase || 0;
                                                            const acomptes = (selectedEmployeeForPay.historiquePaie || []).filter(t => t.type === 'ACOMPTE' && new Date(t.date).getMonth() === new Date().getMonth()).reduce((acc, t) => acc + t.montant, 0);
                                                            const absences = (selectedEmployeeForPay.absences || []).filter(a => !a.reglee && new Date(a.date).getMonth() === new Date().getMonth()).reduce((acc, a) => acc + a.montantRetenue, 0);
                                                            const historyPrimes = (selectedEmployeeForPay.historiquePaie || []).filter(t => t.type === 'PRIME' && new Date(t.date).getMonth() === new Date().getMonth()).reduce((acc, t) => acc + t.montant, 0);
                                                            const addedPrimes = extraPrimes.reduce((acc, p) => acc + p.amount, 0);
                                                            return (base + historyPrimes + addedPrimes - acomptes - absences).toLocaleString();
                                                        })()} F
                                                    </span>
                                                </div>
                                            </div>

                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-1">Compte de Paiement (Débit)</label>
                                                <select 
                                                    className="w-full p-2 border border-gray-300 rounded bg-green-50 border-green-200"
                                                    value={paymentAccountId}
                                                    onChange={(e) => setPaymentAccountId(e.target.value)}
                                                >
                                                    <option value="">-- Choisir Compte --</option>
                                                    {comptes.map(acc => (
                                                        <option key={acc.id} value={acc.id}>{acc.nom} ({acc.solde.toLocaleString()} F)</option>
                                                    ))}
                                                </select>
                                                <p className="text-xs text-gray-500 mt-1">Le montant net sera déduit de ce compte.</p>
                                            </div>

                                            <div className="pt-2 flex justify-end"><button onClick={handleConfirmSalaire} className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-bold flex items-center gap-2"><CheckCircle size={18} /> Payer Salaire</button></div>
                                        </>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {absenceModalOpen && selectedEmployeeForAbsence && (
                <div className="fixed inset-0 bg-black bg-opacity-60 z-[60] flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm p-6 animate-in fade-in zoom-in duration-200">
                        <h3 className="text-xl font-bold mb-4 flex items-center gap-2 text-gray-800"><UserMinus className="text-red-500" /> Signaler Absence</h3>
                        <p className="text-sm text-gray-600 mb-4 font-medium">{selectedEmployeeForAbsence.nom}</p>
                        <div className="space-y-4">
                            <div><label className="block text-sm font-medium text-gray-700 mb-1">Date</label><input type="date" value={absenceData.date} onChange={e => setAbsenceData({...absenceData, date: e.target.value})} className="w-full p-2 border border-gray-300 rounded" /></div>
                            <div><label className="block text-sm font-medium text-gray-700 mb-1">Jours</label><input type="number" min="0.5" step="0.5" value={absenceData.nombreJours} onChange={e => { const days = parseFloat(e.target.value) || 0; const dailyRate = selectedEmployeeForAbsence.salaireBase ? Math.round(selectedEmployeeForAbsence.salaireBase / 26) : 0; setAbsenceData({...absenceData, nombreJours: days, montantRetenue: days * dailyRate}); }} className="w-full p-2 border border-gray-300 rounded" /></div>
                             <div><label className="block text-sm font-medium text-gray-700 mb-1">Motif</label><select value={absenceData.motif} onChange={e => setAbsenceData({...absenceData,motif: e.target.value})} className="w-full p-2 border border-gray-300 rounded"><option value="">-- Sélectionner --</option><option value="Maladie">Maladie</option><option value="Permission">Permission</option><option value="Injustifiée">Injustifiée</option><option value="Retard">Retard</option></select></div>
                             <div className="bg-red-50 p-3 rounded border border-red-100"><label className="block text-xs font-bold text-red-700 mb-1 uppercase">Retenue Estimée</label><input type="number" value={absenceData.montantRetenue} onChange={e => setAbsenceData({...absenceData, montantRetenue: parseInt(e.target.value) || 0})} className="w-full p-2 border border-red-200 rounded text-red-700 font-bold bg-white" /></div>
                        </div>
                        <div className="flex justify-end gap-3 mt-6"><button onClick={() => setAbsenceModalOpen(false)} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded">Annuler</button><button onClick={handleSaveAbsence} className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 font-bold">Confirmer</button></div>
                    </div>
                </div>
            )}

            {/* Modal Add/Edit Employee with Email */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg p-6 animate-in fade-in zoom-in duration-200">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-xl font-bold text-gray-800">
                                {editingEmployee ? 'Modifier Employé' : 'Nouvel Employé'}
                            </h3>
                            <button onClick={() => setIsModalOpen(false)}><X size={24} className="text-gray-500 hover:text-gray-700"/></button>
                        </div>
                        
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Nom Complet</label>
                                <input type="text" className="w-full p-2 border border-gray-300 rounded" value={formData.nom} onChange={e => setFormData({...formData, nom: e.target.value})} />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Téléphone</label>
                                <input type="text" className="w-full p-2 border border-gray-300 rounded" value={formData.telephone} onChange={e => setFormData({...formData, telephone: e.target.value})} />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-1"><Mail size={12}/> Email (Compte Connexion)</label>
                                <input 
                                    type="email" 
                                    className="w-full p-2 border border-gray-300 rounded bg-blue-50 focus:ring-2 focus:ring-blue-500" 
                                    value={formData.email || ''} 
                                    onChange={e => setFormData({...formData, email: e.target.value})}
                                    placeholder="ex: gerant@by-tchico.com"
                                />
                                <p className="text-xs text-blue-600 mt-1">L'utilisateur pourra se connecter avec cet email et le rôle défini ici.</p>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Rôle</label>
                                    <select className="w-full p-2 border border-gray-300 rounded" value={formData.role} onChange={e => setFormData({...formData, role: e.target.value as RoleEmploye})}>
                                        {Object.values(RoleEmploye).map(r => <option key={r} value={r}>{r}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Contrat</label>
                                    <select className="w-full p-2 border border-gray-300 rounded" value={formData.typeContrat} onChange={e => setFormData({...formData, typeContrat: e.target.value as any})}>
                                        <option value="CDI">CDI</option>
                                        <option value="CDD">CDD</option>
                                        <option value="PRESTATAIRE">Prestataire</option>
                                        <option value="STAGE">Stage</option>
                                    </select>
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Salaire de Base</label>
                                <input type="number" className="w-full p-2 border border-gray-300 rounded" value={formData.salaireBase} onChange={e => setFormData({...formData, salaireBase: parseInt(e.target.value) || 0})} />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Boutique / Lieu (Optionnel)</label>
                                <select className="w-full p-2 border border-gray-300 rounded" value={formData.boutiqueId || ''} onChange={e => setFormData({...formData, boutiqueId: e.target.value})}>
                                    <option value="">-- Non assigné (Atelier) --</option>
                                    <option value="ATELIER">Atelier Central</option>
                                    {boutiques.filter(b => b.id !== 'ATELIER').map(b => <option key={b.id} value={b.id}>{b.nom}</option>)}
                                </select>
                            </div>
                        </div>

                        <div className="flex justify-end gap-3 mt-6">
                            <button onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded">Annuler</button>
                            <button onClick={handleSaveEmployee} className="px-4 py-2 bg-brand-600 text-white rounded hover:bg-brand-700 flex items-center gap-2"><Save size={18} /> Enregistrer</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default HRView;
