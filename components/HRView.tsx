
import React, { useState, useMemo, useEffect } from 'react';
import { Employe, Boutique, Depense, RoleEmploye, Pointage, SessionUser, TransactionPaie, Absence, CompteFinancier } from '../types';
import { Users, UserPlus, Clock, Calendar, Save, X, Edit2, Trash2, CheckCircle, XCircle, Search, Filter, Briefcase, DollarSign, Banknote, UserMinus, History, ArrowUpCircle, ArrowDownCircle, AlertCircle, Plus, TrendingUp, AlertTriangle, Archive, RotateCcw, AlertOctagon, Lock } from 'lucide-react';

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
    comptes: CompteFinancier[]; // Nouvelle prop
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
    comptes
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
        role: RoleEmploye.TAILLEUR,
        salaireBase: 0,
        typeContrat: 'CDI'
    });

    // --- STATES GESTION PAIE & ABSENCE ---
    const [payModalOpen, setPayModalOpen] = useState(false);
    const [selectedEmployeeForPay, setSelectedEmployeeForPay] = useState<Employe | null>(null);
    const [payTab, setPayTab] = useState<'TRANSACTION' | 'SALAIRE'>('TRANSACTION');
    const [paymentAccountId, setPaymentAccountId] = useState<string>(''); // Compte sélectionné pour le paiement
    
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

    // History Modal
    const [historyModalOpen, setHistoryModalOpen] = useState(false);
    const [selectedEmployeeForHistory, setSelectedEmployeeForHistory] = useState<Employe | null>(null);

    // --- CONFIRM ARCHIVE MODAL STATE ---
    const [archiveConfirmId, setArchiveConfirmId] = useState<string | null>(null);

    // --- Pointage & Correction State ---
    const [pointageDate, setPointageDate] = useState(new Date().toISOString().split('T')[0]);
    const [correctionModalOpen, setCorrectionModalOpen] = useState(false);
    const [editingPointage, setEditingPointage] = useState<{
        id: string | null,
        employeId: string,
        employeNom: string,
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
        setEditingPointage({
            id: existingPt ? existingPt.id : null,
            employeId: emp.id,
            employeNom: emp.nom,
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
            date: pointageDate,
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

    // --- ACTIONS PAIE & RH ---

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
        
        // Si c'est un acompte, on exige un compte de paiement pour impacter la trésorerie
        if (transactionData.type === 'ACOMPTE' && !paymentAccountId) {
            alert("Veuillez sélectionner un compte de paiement (Caisse ou Banque) pour sortir l'argent.");
            return;
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
        
        // Créer une dépense correspondante liée au compte
        if (transactionData.type === 'ACOMPTE') {
            const depense: Depense = { 
                id: `D_ACOMPTE_${Date.now()}`, 
                date: transactionData.date, 
                montant: transactionData.montant, 
                categorie: 'SALAIRE', 
                description: `Acompte (${selectedEmployeeForPay.nom}): ${transactionData.note}`, 
                boutiqueId: selectedEmployeeForPay.boutiqueId || 'ATELIER',
                compteId: paymentAccountId // LIAISON AVEC LA TRÉSORERIE
            };
            onAddDepense(depense);
        }

        setSelectedEmployeeForPay(updatedEmp);
        setTransactionData({ ...transactionData, montant: 0, note: '' });
        alert(`${transactionData.type === 'ACOMPTE' ? 'Acompte' : 'Prime'} enregistré(e) et caisse mise à jour !`);
    };

    const handleConfirmSalaire = () => {
        if (!selectedEmployeeForPay) return;
        
        // VÉRIFICATION DOUBLE PAIEMENT
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
        
        // Calculs
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

        // Marquer absences comme réglées
        const updatedAbsences = (selectedEmployeeForPay.absences || []).map(a => { 
            if (!a.reglee && new Date(a.date).getMonth() === currentDate.getMonth()) { return { ...a, reglee: true }; } 
            return a; 
        });

        const updatedEmp = { ...selectedEmployeeForPay, historiquePaie: [transactionSalaire, ...(selectedEmployeeForPay.historiquePaie || [])], absences: updatedAbsences };
        onUpdateEmploye(updatedEmp);
        
        // Créer Dépense Salaire LIÉE AU COMPTE
        const depense: Depense = { 
            id: `D_SALAIRE_${Date.now()}`, 
            date: dateIso.split('T')[0], 
            montant: net, 
            categorie: 'SALAIRE', 
            description: `Salaire ${salaryData.period} - ${selectedEmployeeForPay.nom}`, 
            boutiqueId: selectedEmployeeForPay.boutiqueId || 'ATELIER',
            compteId: paymentAccountId // IMPACTE LA CAISSE/BANQUE
        };
        onAddDepense(depense);
        setPayModalOpen(false);
    };

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

    const openEditModal = (e: Employe) => {
        setEditingEmployee(e);
        setFormData(e);
        setIsModalOpen(true);
    };

    const openAddModal = () => {
        setEditingEmployee(null);
        setFormData({ nom: '', telephone: '', role: RoleEmploye.TAILLEUR, salaireBase: 0, typeContrat: 'CDI' });
        setIsModalOpen(true);
    };

    const openHistoryModal = (e: Employe) => { setSelectedEmployeeForHistory(e); setHistoryModalOpen(true); };

    // --- RESTORE ---
    const handleRestoreEmployee = (emp: Employe) => {
        onUpdateEmploye({ ...emp, actif: true });
    };

    // --- ARCHIVE LOGIC (Trigger Modal) ---
    const triggerArchive = (e: React.MouseEvent, id: string) => {
        e.preventDefault();
        e.stopPropagation();
        setArchiveConfirmId(id);
    };

    // --- EXECUTE ARCHIVE ---
    const confirmArchive = () => {
        if (archiveConfirmId) {
            onDeleteEmploye(archiveConfirmId);
            setArchiveConfirmId(null);
        }
    };

    return (
        <div className="h-[calc(100vh-8rem)] flex flex-col space-y-6">
            {/* ... (Header et Tableaux inchangés) ... */}
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
                            <button 
                                onClick={() => setShowArchived(!showArchived)} 
                                className={`px-3 py-2 rounded-lg flex items-center gap-2 font-medium transition-colors text-sm border ${showArchived ? 'bg-gray-800 text-white border-gray-800' : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'}`}
                            >
                                <Archive size={16} />
                                {showArchived ? 'Voir Actifs' : 'Archives'}
                            </button>
                            {!showArchived && (
                                <button onClick={openAddModal} className="bg-brand-600 hover:bg-brand-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 font-medium transition-colors text-sm">
                                    <UserPlus size={16} /> Nouveau
                                </button>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {activeTab === 'EMPLOYEES' && !isPointageOnly && (
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex-1 flex flex-col">
                    <div className={`p-4 border-b border-gray-100 flex gap-4 ${showArchived ? 'bg-gray-50' : ''}`}>
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-2.5 text-gray-400" size={18} />
                            <input type="text" placeholder="Rechercher employé..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm" />
                        </div>
                        {showArchived && <div className="flex items-center px-4 bg-orange-100 text-orange-800 rounded-lg text-xs font-bold"><Archive size={14} className="mr-2"/> MODE ARCHIVES</div>}
                    </div>
                    <div className="overflow-x-auto flex-1">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-gray-50 text-gray-600 font-medium">
                                <tr>
                                    <th className="py-3 px-4">Nom</th>
                                    <th className="py-3 px-4">Rôle</th>
                                    <th className="py-3 px-4">Téléphone</th>
                                    <th className="py-3 px-4">Contrat</th>
                                    <th className="py-3 px-4 text-right">Salaire Base</th>
                                    <th className="py-3 px-4 text-center">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {filteredEmployes.map(emp => (
                                    <tr key={emp.id} className={`hover:bg-gray-50 ${showArchived ? 'opacity-70 bg-gray-50' : ''}`}>
                                        <td className="py-3 px-4 font-bold text-gray-800">{emp.nom}</td>
                                        <td className="py-3 px-4"><span className="bg-brand-50 text-brand-800 px-2 py-1 rounded text-xs border border-brand-100">{emp.role}</span></td>
                                        <td className="py-3 px-4 text-gray-600">{emp.telephone}</td>
                                        <td className="py-3 px-4 text-gray-600">{emp.typeContrat}</td>
                                        <td className="py-3 px-4 text-right font-medium">{emp.salaireBase.toLocaleString()} F</td>
                                        <td className="py-3 px-4 text-center">
                                            <div className="flex justify-center gap-1">
                                                {!showArchived ? (
                                                    <>
                                                        <button onClick={() => openAbsenceModal(emp)} className="p-1.5 text-red-500 hover:bg-red-50 rounded" title="Absence"><UserMinus size={16}/></button>
                                                        <button onClick={() => openHistoryModal(emp)} className="p-1.5 text-blue-500 hover:bg-blue-50 rounded" title="Historique"><History size={16}/></button>
                                                        <button onClick={() => openPayModal(emp)} className="p-1.5 text-green-600 hover:bg-green-50 rounded" title="Payer"><Banknote size={16}/></button>
                                                        <button onClick={() => openEditModal(emp)} className="p-1.5 text-gray-500 hover:bg-gray-100 rounded" title="Modifier"><Edit2 size={16}/></button>
                                                        <button 
                                                            onClick={(e) => triggerArchive(e, emp.id)} 
                                                            className="p-1.5 text-orange-500 hover:bg-orange-50 rounded transition-colors" 
                                                            title="Archiver"
                                                            type="button"
                                                        >
                                                            <Archive size={16}/>
                                                        </button>
                                                    </>
                                                ) : (
                                                    <button onClick={() => handleRestoreEmployee(emp)} className="p-1.5 text-green-600 hover:bg-green-50 rounded flex items-center gap-1 font-medium bg-white border border-gray-200 shadow-sm" title="Restaurer"><RotateCcw size={14}/> Restaurer</button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                                {filteredEmployes.length === 0 && (
                                    <tr>
                                        <td colSpan={6} className="py-8 text-center text-gray-400 italic">
                                            {showArchived ? "Aucun employé archivé." : "Aucun employé trouvé."}
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* CONFIRM ARCHIVE MODAL ... (inchangé) */}
            {archiveConfirmId && (
                <div className="fixed inset-0 bg-black bg-opacity-60 z-[90] flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm p-6 animate-in zoom-in duration-200">
                        <div className="flex items-center gap-3 text-orange-600 mb-3">
                            <AlertOctagon size={28} />
                            <h3 className="text-lg font-bold text-gray-900">Confirmer l'archivage ?</h3>
                        </div>
                        <p className="text-sm text-gray-600 mb-6">
                            L'employé ne sera plus visible dans la liste active mais ses données seront conservées dans les archives.
                        </p>
                        <div className="flex justify-end gap-3">
                            <button 
                                onClick={() => setArchiveConfirmId(null)} 
                                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-lg font-medium"
                            >
                                Annuler
                            </button>
                            <button 
                                onClick={confirmArchive} 
                                className="px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg font-bold shadow-md"
                            >
                                Oui, Archiver
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ... POINTAGE VIEW (inchangé) ... */}
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
                                    <th className="py-3 px-4">Employé</th>
                                    <th className="py-3 px-4">Rôle</th>
                                    <th className="py-3 px-4 text-center">Arrivée</th>
                                    <th className="py-3 px-4 text-center">Départ</th>
                                    <th className="py-3 px-4 text-center">Statut</th>
                                    <th className="py-3 px-4 text-center">Action</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {employeesToShowInPointage.map(emp => {
                                    const pt = dailyPointages.find(p => p.employeId === emp.id);
                                    return (
                                        <tr key={emp.id} className="hover:bg-gray-50">
                                            <td className="py-3 px-4 font-medium text-gray-800">{emp.nom}</td>
                                            <td className="py-3 px-4 text-gray-500 text-xs">{emp.role}</td>
                                            <td className="py-3 px-4 text-center">
                                                {pt ? (
                                                    <input 
                                                        type="time" 
                                                        value={pt.heureArrivee || ''} 
                                                        disabled={isPointageOnly || pt.statut === 'ABSENT' || pt.statut === 'CONGE'} 
                                                        onChange={(e) => handleManualTimeChange(pt, 'heureArrivee', e.target.value)}
                                                        className="p-1 border border-gray-200 rounded text-center w-24 disabled:bg-transparent disabled:border-none disabled:text-gray-400"
                                                    />
                                                ) : '-'}
                                            </td>
                                            <td className="py-3 px-4 text-center">
                                                {pt ? (
                                                    <input 
                                                        type="time" 
                                                        value={pt.heureDepart || ''} 
                                                        disabled={!pt.heureArrivee || isPointageOnly || pt.statut === 'ABSENT' || pt.statut === 'CONGE'} 
                                                        onChange={(e) => handleManualTimeChange(pt, 'heureDepart', e.target.value)}
                                                        className="p-1 border border-gray-200 rounded text-center w-24 disabled:bg-transparent disabled:border-none disabled:text-gray-400"
                                                    />
                                                ) : '-'}
                                            </td>
                                            <td className="py-3 px-4 text-center">
                                                {pt ? (
                                                    <span className={`px-2 py-1 rounded text-xs font-bold ${getPointageStatusColor(pt.statut)}`}>
                                                        {pt.statut}
                                                    </span>
                                                ) : (
                                                    <span className="text-gray-400 italic text-xs">Non pointé</span>
                                                )}
                                            </td>
                                            <td className="py-3 px-4 text-center">
                                                <div className="flex items-center justify-center gap-2">
                                                    {!pt ? (
                                                        <>
                                                            <button 
                                                                onClick={() => handleClockIn(emp.id)}
                                                                className="bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded text-xs font-bold shadow-sm"
                                                            >
                                                                Arrivée
                                                            </button>
                                                            {!isPointageOnly && (
                                                                <button 
                                                                    onClick={() => handleMarkAbsent(emp.id)}
                                                                    className="text-red-500 hover:text-red-700 hover:bg-red-50 p-1 rounded"
                                                                    title="Marquer Absent"
                                                                >
                                                                    <XCircle size={20} />
                                                                </button>
                                                            )}
                                                        </>
                                                    ) : (
                                                        <>
                                                            {!pt.heureDepart && pt.statut !== 'ABSENT' && pt.statut !== 'CONGE' && (
                                                                <button 
                                                                    onClick={() => handleClockOut(pt)}
                                                                    className="bg-gray-800 hover:bg-gray-900 text-white px-3 py-1 rounded text-xs font-bold shadow-sm"
                                                                >
                                                                    Départ
                                                                </button>
                                                            )}
                                                            {!isPointageOnly && (
                                                                <button 
                                                                    onClick={() => openCorrectionModal(emp, pt)}
                                                                    className="p-1.5 text-blue-500 hover:bg-blue-50 rounded transition-colors"
                                                                    title="Corriger / Modifier"
                                                                >
                                                                    <Edit2 size={16} />
                                                                </button>
                                                            )}
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

            {/* ... Modal Correction Pointage (inchangé) ... */}
            {correctionModalOpen && editingPointage && (
                <div className="fixed inset-0 bg-black bg-opacity-60 z-[70] flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm p-6 animate-in fade-in zoom-in duration-200">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-xl font-bold flex items-center gap-2 text-gray-800">
                                <Clock className="text-blue-600" /> Corriger Pointage
                            </h3>
                            <button onClick={() => setCorrectionModalOpen(false)} className="text-gray-400 hover:text-gray-600"><X size={24} /></button>
                        </div>
                        
                        <div className="mb-4 text-sm text-gray-600 bg-gray-50 p-3 rounded border border-gray-100">
                            <strong>Employé :</strong> {editingPointage.employeNom}<br/>
                            <strong>Date :</strong> {new Date(pointageDate).toLocaleDateString()}
                        </div>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Statut</label>
                                <select 
                                    className="w-full p-2 border border-gray-300 rounded"
                                    value={editingPointage.statut}
                                    onChange={(e) => setEditingPointage({...editingPointage, statut: e.target.value as any})}
                                >
                                    <option value="PRESENT">Présent</option>
                                    <option value="RETARD">Retard</option>
                                    <option value="ABSENT">Absent</option>
                                    <option value="CONGE">Congé</option>
                                </select>
                            </div>

                            {(editingPointage.statut === 'PRESENT' || editingPointage.statut === 'RETARD') && (
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Heure Arrivée</label>
                                        <input 
                                            type="time" 
                                            className="w-full p-2 border border-gray-300 rounded"
                                            value={editingPointage.heureArrivee}
                                            onChange={(e) => setEditingPointage({...editingPointage, heureArrivee: e.target.value})}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Heure Départ</label>
                                        <input 
                                            type="time" 
                                            className="w-full p-2 border border-gray-300 rounded"
                                            value={editingPointage.heureDepart}
                                            onChange={(e) => setEditingPointage({...editingPointage, heureDepart: e.target.value})}
                                        />
                                    </div>
                                </div>
                            )}
                            
                            {(editingPointage.statut === 'ABSENT' || editingPointage.statut === 'CONGE') && (
                                <div className="p-3 bg-yellow-50 text-yellow-800 text-xs rounded border border-yellow-100 flex items-center gap-2">
                                    <AlertTriangle size={16} />
                                    <span>Les heures ne sont pas prises en compte pour ce statut.</span>
                                </div>
                            )}
                        </div>

                        <div className="flex justify-end gap-3 mt-6">
                            <button onClick={() => setCorrectionModalOpen(false)} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded">Annuler</button>
                            <button onClick={handleSaveCorrection} className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 font-bold">Valider Correction</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal Gestion Paie - Mise à jour pour sécurisation et comptes */}
            {payModalOpen && selectedEmployeeForPay && (
                <div className="fixed inset-0 bg-black bg-opacity-60 z-[60] flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in duration-200">
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

            {/* ... Autres Modals (Absence, Historique, Add/Edit) inchangés ... */}
            {/* Modal Absence */}
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

            {/* Modal Historique */}
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
                                        <tr><th className="py-2 px-3">Date</th><th className="py-2 px-3">Type</th><th className="py-2 px-3">Description</th><th className="py-2 px-3 text-right">Montant</th></tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                        {selectedEmployeeForHistory.historiquePaie.sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map(tr => (
                                            <tr key={tr.id} className="hover:bg-gray-50">
                                                <td className="py-3 px-3 text-gray-500">{new Date(tr.date).toLocaleDateString()}</td>
                                                <td className="py-3 px-3"><span className={`px-2 py-1 rounded text-xs font-bold ${tr.type === 'SALAIRE_NET' ? 'bg-blue-100 text-blue-800' : tr.type === 'ACOMPTE' ? 'bg-orange-100 text-orange-800' : 'bg-green-100 text-green-800'}`}>{tr.type.replace('_', ' ')}</span></td>
                                                <td className="py-3 px-3 text-gray-700">{tr.description}</td>
                                                <td className="py-3 px-3 text-right font-bold">{tr.montant.toLocaleString()} F</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            ) : (<div className="text-center py-10 text-gray-400"><History size={48} className="mx-auto mb-2 opacity-20" />Aucun historique.</div>)}
                        </div>
                    </div>
                </div>
            )}

            {/* Modal Add/Edit Employee */}
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
