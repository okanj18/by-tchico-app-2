
import React, { useState, useMemo, useEffect } from 'react';
import { Employe, Boutique, Depense, RoleEmploye, Pointage, SessionUser, TransactionPaie, Absence, CompteFinancier, TransactionTresorerie } from '../types';
import { Users, UserPlus, Clock, Calendar, Save, X, Edit2, Trash2, CheckCircle, XCircle, Search, Filter, Briefcase, DollarSign, Banknote, UserMinus, History, ArrowUpCircle, ArrowDownCircle, AlertCircle, Plus, TrendingUp, AlertTriangle, Archive, RotateCcw, AlertOctagon, Lock, Mail, Key, QrCode, Camera, Printer, Bus, CheckSquare, Square } from 'lucide-react';
import { createAuthUser } from '../services/firebase';
import { QRGeneratorModal, QRScannerModal } from './QRTools';
import { QRCodeCanvas } from 'qrcode.react';

interface HRViewProps {
    employes: Employe[];
    boutiques: Boutique[];
    onAddEmploye: (e: Employe) => void;
    onUpdateEmploye: (e: Employe) => void;
    onDeleteEmploye: (id: string) => void;
    onAddDepense: (d: Depense) => void;
    depenses?: Depense[];
    onDeleteDepense?: (id: string) => void;
    onUpdateDepense?: (d: Depense) => void;
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
    depenses = [],
    onDeleteDepense,
    onUpdateDepense,
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
        date: string,
        heureArrivee: string,
        heureDepart: string,
        statut: 'PRESENT' | 'RETARD' | 'ABSENT' | 'CONGE'
    } | null>(null);

    // --- QR CODE BADGE SYSTEM ---
    const [badgeEmployee, setBadgeEmployee] = useState<Employe | null>(null);
    const [isScannerOpen, setIsScannerOpen] = useState(false);
    const [showBatchBadges, setShowBatchBadges] = useState(false);

    // --- TRANSPORT GROUPÉ STATE ---
    const [transportModalOpen, setTransportModalOpen] = useState(false);
    const [transportSelection, setTransportSelection] = useState<string[]>([]);
    const [transportAmount, setTransportAmount] = useState(1000);
    const [transportAccountId, setTransportAccountId] = useState('');

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

    // --- TRANSPORT GROUPÉ LOGIC ---
    const openTransportModal = () => {
        // Sélectionner par défaut tous les employés actifs
        setTransportSelection(employes.filter(e => e.actif !== false).map(e => e.id));
        setTransportAccountId('');
        setTransportModalOpen(true);
    };

    const toggleTransportSelection = (empId: string) => {
        setTransportSelection(prev => 
            prev.includes(empId) ? prev.filter(id => id !== empId) : [...prev, empId]
        );
    };

    const handleBulkTransport = () => {
        if (!transportAccountId) {
            alert("Veuillez choisir la caisse d'où sort l'argent.");
            return;
        }
        if (transportSelection.length === 0) {
            alert("Aucun employé sélectionné.");
            return;
        }

        const totalAmount = transportAmount * transportSelection.length;
        const account = comptes.find(c => c.id === transportAccountId);
        
        if (account && account.solde < totalAmount) {
            alert(`Solde insuffisant sur ${account.nom}. Il faut ${totalAmount.toLocaleString()} F.`);
            return;
        }

        const dateIso = new Date().toISOString();
        const dateShort = dateIso.split('T')[0];

        // 1. Mettre à jour le solde du compte (UNE SEULE FOIS)
        const updatedComptes = comptes.map(c => c.id === transportAccountId ? { ...c, solde: c.solde - totalAmount } : c);
        onUpdateComptes(updatedComptes);

        // 2. Boucle sur les employés
        transportSelection.forEach(empId => {
            const emp = employes.find(e => e.id === empId);
            if (emp) {
                // Créer transaction Acompte
                const transaction: TransactionPaie = { 
                    id: `TR_TRANS_${Date.now()}_${empId}`, 
                    date: dateIso, 
                    type: 'ACOMPTE', 
                    montant: transportAmount, 
                    description: `Transport Quotidien` 
                };
                
                const updatedEmp = { 
                    ...emp, 
                    historiquePaie: [transaction, ...(emp.historiquePaie || [])] 
                };
                onUpdateEmploye(updatedEmp);

                // Créer dépense individuelle (pour traçabilité)
                onAddDepense({
                    id: `D_TRANS_${Date.now()}_${empId}`,
                    date: dateShort,
                    montant: transportAmount,
                    categorie: 'SALAIRE', // ou AUTRE
                    description: `Transport ${emp.nom}`,
                    boutiqueId: emp.boutiqueId || 'ATELIER',
                    compteId: transportAccountId
                });

                // Créer transaction trésorerie individuelle
                onAddTransaction({
                    id: `TR_OUT_TRANS_${Date.now()}_${empId}`,
                    date: dateIso,
                    type: 'DECAISSEMENT',
                    montant: transportAmount,
                    compteId: transportAccountId,
                    description: `Transport ${emp.nom}`,
                    categorie: 'SALAIRE'
                });
            }
        });

        setTransportModalOpen(false);
        alert(`Transport distribué à ${transportSelection.length} employés.`);
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

    const handleScanAttendance = (scannedText: string) => {
        // Le code scanné est l'ID de l'employé
        const employe = employes.find(e => e.id === scannedText);
        if (!employe) {
            alert("Badge inconnu !");
            return;
        }

        // Vérifier si un pointage existe déjà pour aujourd'hui
        // Utiliser la date sélectionnée ou la date du jour (pour le scan on force souvent la date du jour)
        const today = new Date().toISOString().split('T')[0];
        if (pointageDate !== today) {
            if(!window.confirm(`Vous scannez pour la date du ${today}, mais l'affichage est sur le ${pointageDate}. Continuer ?`)) return;
            setPointageDate(today);
        }

        const existingPt = pointages.find(p => p.employeId === employe.id && p.date === today);

        if (!existingPt) {
            // Clock IN
            handleClockIn(employe.id);
            alert(`✅ ${employe.nom} : Arrivée enregistrée !`);
        } else if (!existingPt.heureDepart && existingPt.statut !== 'ABSENT') {
            // Clock OUT
            handleClockOut(existingPt);
            alert(`👋 ${employe.nom} : Départ enregistré !`);
        } else {
            alert(`⚠️ ${employe.nom} a déjà terminé sa journée ou est marqué absent.`);
        }
        
        // Fermer le scanner après un succès (optionnel, on peut laisser ouvert pour scanner à la chaîne)
        // setIsScannerOpen(false); 
    };

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
        try {
            if (!currentActionTransaction || !selectedEmployeeForHistory) return;
            
            if (!refundAccountId) {
                alert("Veuillez sélectionner un compte pour l'impact financier.");
                return;
            }

            const account = comptes.find(c => c.id === refundAccountId);
            if (!account) return;

            let amountDiff = 0;
            let descLog = '';

            const txDateShort = new Date(currentActionTransaction.date).toISOString().split('T')[0];
            const relatedExpense = depenses.find(d => 
                d.montant === currentActionTransaction.montant &&
                d.date === txDateShort &&
                d.categorie === 'SALAIRE' &&
                d.description.includes('Acompte') &&
                d.description.includes(selectedEmployeeForHistory.nom)
            );

            if (actionType === 'DELETE') {
                amountDiff = currentActionTransaction.montant; 
                descLog = `Annulation ${currentActionTransaction.type} - ${selectedEmployeeForHistory.nom}`;
                
                const newHistory = selectedEmployeeForHistory.historiquePaie?.filter(t => t.id !== currentActionTransaction.id) || [];
                const updatedEmp = { ...selectedEmployeeForHistory, historiquePaie: newHistory };
                onUpdateEmploye(updatedEmp);
                setSelectedEmployeeForHistory(updatedEmp);

                if (relatedExpense && onDeleteDepense) {
                    onDeleteDepense(relatedExpense.id);
                } else if (onAddDepense) {
                    onAddDepense({
                        id: `D_REFUND_${Date.now()}`,
                        date: new Date().toISOString().split('T')[0],
                        montant: -currentActionTransaction.montant,
                        categorie: 'SALAIRE',
                        description: `Annulation Acompte ${selectedEmployeeForHistory.nom}`,
                        boutiqueId: 'ATELIER',
                        compteId: refundAccountId
                    });
                }

            } else if (actionType === 'EDIT') {
                const oldAmount = currentActionTransaction.montant;
                const newAmount = newEditAmount;
                
                amountDiff = oldAmount - newAmount; 
                
                if (amountDiff < 0 && account.solde < Math.abs(amountDiff)) {
                    alert(`Solde insuffisant sur ${account.nom} pour ajouter ${(Math.abs(amountDiff)).toLocaleString()} F.`);
                    return;
                }

                descLog = `Correction ${currentActionTransaction.type} (${oldAmount} -> ${newAmount}) - ${selectedEmployeeForHistory.nom}`;

                const newHistory = selectedEmployeeForHistory.historiquePaie?.map(t => 
                    t.id === currentActionTransaction!.id ? { ...t, montant: newAmount, description: t.description + ' (Modifié)' } : t
                ) || [];
                const updatedEmp = { ...selectedEmployeeForHistory, historiquePaie: newHistory };
                onUpdateEmploye(updatedEmp);
                setSelectedEmployeeForHistory(updatedEmp);

                if (relatedExpense && onUpdateDepense) {
                    onUpdateDepense({ ...relatedExpense, montant: newAmount });
                } else if (onAddDepense) {
                    onAddDepense({
                        id: `D_ADJ_${Date.now()}`,
                        date: new Date().toISOString().split('T')[0],
                        montant: -amountDiff, 
                        categorie: 'SALAIRE',
                        description: `Ajustement Acompte ${selectedEmployeeForHistory.nom}`,
                        boutiqueId: 'ATELIER',
                        compteId: refundAccountId
                    });
                }
            }

            const updatedComptes = comptes.map(c => c.id === refundAccountId ? { ...c, solde: c.solde + amountDiff } : c);
            onUpdateComptes(updatedComptes);

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

            alert("Opération effectuée avec succès.");
        } catch (error) {
            console.error(error);
            alert("Une erreur est survenue lors du traitement.");
        } finally {
            setActionTransactionModalOpen(false);
            setCurrentActionTransaction(null);
        }
    };

    const openPayModal = (e: Employe) => {
        const currentDate = new Date();
        const periodStr = currentDate.toLocaleString('default', { month: 'long', year: 'numeric' });
        setSelectedEmployeeForPay(e);
        setPayTab('TRANSACTION');
        setPaymentAccountId('');
        setTransactionData({ date: new Date().toISOString().split('T')[0], type: 'ACOMPTE', montant: 0, note: '' });
        setSalaryData({ period: `Salaire ${periodStr.charAt(0).toUpperCase() + periodStr.slice(1)}`, note: '' });
        setExtraPrimes([]); 
        setNewPrimeLine({label: '', amount: 0});
        setPayModalOpen(true);
    };

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
            
            const updatedComptes = comptes.map(c => c.id === paymentAccountId ? { ...c, solde: c.solde - transactionData.montant } : c);
            onUpdateComptes(updatedComptes);
            
            onAddTransaction({
                id: `TR_OUT_${Date.now()}`,
                date: new Date().toISOString(),
                type: 'DECAISSEMENT',
                montant: transactionData.montant,
                compteId: paymentAccountId,
                description: `Sortie Acompte ${selectedEmployeeForPay.nom}`,
                categorie: 'SALAIRE'
            });
        }

        setSelectedEmployeeForPay(updatedEmp);
        setTransactionData({ ...transactionData, montant: 0, note: '' });
        alert(`${transactionData.type === 'ACOMPTE' ? 'Acompte' : 'Prime'} enregistré(e) !`);
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

        const updatedComptes = comptes.map(c => c.id === paymentAccountId ? { ...c, solde: c.solde - net } : c);
        onUpdateComptes(updatedComptes);
        
        onAddTransaction({
            id: `TR_SAL_OUT_${Date.now()}`,
            date: new Date().toISOString(),
            type: 'DECAISSEMENT',
            montant: net,
            compteId: paymentAccountId,
            description: `Paiement Salaire ${selectedEmployeeForPay.nom}`,
            categorie: 'SALAIRE'
        });

        setPayModalOpen(false);
    };

    const openAbsenceModal = (e: Employe) => { 
        setSelectedEmployeeForAbsence(e); 
        setAbsenceData({ date: new Date().toISOString().split('T')[0], motif: '', nombreJours: 1, montantRetenue: 0 }); 
        setAbsenceModalOpen(true); 
    };

    const handleSaveEmployee = () => { if (editingEmployee) onUpdateEmploye({...editingEmployee, ...formData as Employe}); else onAddEmploye({...formData as Employe, id: `E_${Date.now()}`, actif: true, historiquePaie: [], absences: []}); setIsModalOpen(false); };
    const openEditModal = (e: Employe) => { setEditingEmployee(e); setFormData(e); setIsModalOpen(true); };
    const openAddModal = () => { setEditingEmployee(null); setFormData({ nom: '', telephone: '', email: '', role: RoleEmploye.TAILLEUR, salaireBase: 0, typeContrat: 'CDI' }); setIsModalOpen(true); };
    const openHistoryModal = (e: Employe) => { setSelectedEmployeeForHistory(e); setHistoryModalOpen(true); };
    const handleRestoreEmployee = (emp: Employe) => { onUpdateEmploye({ ...emp, actif: true }); };
    const triggerArchive = (e: React.MouseEvent, id: string) => { e.preventDefault(); e.stopPropagation(); setArchiveConfirmId(id); };
    const confirmArchive = () => { if (archiveConfirmId) { onDeleteEmploye(archiveConfirmId); setArchiveConfirmId(null); } };
    const openAccessModal = (e: Employe) => { setAccessEmployee(e); setNewPassword(''); setAccessModalOpen(true); };
    const handleCreateAccess = async () => { setIsCreatingAccess(true); try { await createAuthUser(accessEmployee!.email!, newPassword); alert(`Compte créé.`); setAccessModalOpen(false); } catch (error: any) { alert("Erreur: " + error.message); } finally { setIsCreatingAccess(false); } };
    const handleSaveAbsence = () => { if (!selectedEmployeeForAbsence || !absenceData.motif) return; const newAbsence: Absence = { id: `ABS_${Date.now()}`, ...absenceData, reglee: false }; const updatedEmp = { ...selectedEmployeeForAbsence, absences: [newAbsence, ...(selectedEmployeeForAbsence.absences || [])] }; onUpdateEmploye(updatedEmp); setAbsenceModalOpen(false); };

    return (
        <div className="h-[calc(100vh-8rem)] flex flex-col space-y-6">
            <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2"><Briefcase className="text-brand-600" /> Ressources Humaines</h2>
                <div className="flex gap-2">
                    {!isPointageOnly && (
                        <div className="flex bg-gray-100 p-1 rounded-lg">
                            <button onClick={() => setActiveTab('EMPLOYEES')} className={`px-3 py-1.5 text-xs font-bold rounded flex items-center gap-1 ${activeTab === 'EMPLOYEES' ? 'bg-white shadow text-brand-700' : 'text-gray-500'}`}><Users size={14} /> Employés</button>
                            <button onClick={() => setActiveTab('POINTAGE')} className={`px-3 py-1.5 text-xs font-bold rounded flex items-center gap-1 ${activeTab === 'POINTAGE' ? 'bg-white shadow text-brand-700' : 'text-gray-500'}`}><Clock size={14} /> Pointage</button>
                        </div>
                    )}
                    {activeTab === 'EMPLOYEES' && !isPointageOnly && (
                        <div className="flex gap-2">
                            <button onClick={openTransportModal} className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded-lg flex items-center gap-2 font-medium transition-colors text-sm"><Bus size={16} /> Transport (1000 F)</button>
                            <button onClick={() => setShowBatchBadges(true)} className="bg-gray-800 text-white px-3 py-2 rounded-lg flex items-center gap-2 font-medium transition-colors text-sm hover:bg-gray-900"><QrCode size={16} /> Imprimer Badges</button>
                            <button onClick={() => setShowArchived(!showArchived)} className={`px-3 py-2 rounded-lg flex items-center gap-2 font-medium transition-colors text-sm border ${showArchived ? 'bg-gray-800 text-white border-gray-800' : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'}`}><Archive size={16} />{showArchived ? 'Voir Actifs' : 'Archives'}</button>
                            {!showArchived && (<button onClick={openAddModal} className="bg-brand-600 hover:bg-brand-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 font-medium transition-colors text-sm"><UserPlus size={16} /> Nouveau</button>)}
                        </div>
                    )}
                </div>
            </div>

            {/* MODAL TRANSPORT GROUPÉ */}
            {transportModalOpen && (
                <div className="fixed inset-0 bg-black bg-opacity-60 z-[75] flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg p-6 animate-in zoom-in duration-200 flex flex-col max-h-[80vh]">
                        <div className="flex justify-between items-center mb-4 border-b pb-2">
                            <h3 className="text-xl font-bold flex items-center gap-2 text-blue-700"><Bus size={24}/> Distribution Transport</h3>
                            <button onClick={() => setTransportModalOpen(false)}><X size={20} className="text-gray-500"/></button>
                        </div>
                        
                        <div className="mb-4 space-y-3">
                            <div className="flex gap-4">
                                <div className="flex-1">
                                    <label className="block text-xs font-bold text-gray-500 mb-1">Montant par personne</label>
                                    <input type="number" className="w-full p-2 border rounded font-bold text-blue-700" value={transportAmount} onChange={e => setTransportAmount(parseInt(e.target.value)||0)}/>
                                </div>
                                <div className="flex-1">
                                    <label className="block text-xs font-bold text-gray-500 mb-1">Caisse de sortie</label>
                                    <select className="w-full p-2 border rounded" value={transportAccountId} onChange={e => setTransportAccountId(e.target.value)}>
                                        <option value="">-- Choisir Caisse --</option>
                                        {comptes.map(c => <option key={c.id} value={c.id}>{c.nom} ({c.solde.toLocaleString()} F)</option>)}
                                    </select>
                                </div>
                            </div>
                            <div className="flex justify-between items-end">
                                <span className="text-sm text-gray-600">{transportSelection.length} employés sélectionnés</span>
                                <span className="font-bold text-lg text-blue-700">Total: {(transportSelection.length * transportAmount).toLocaleString()} F</span>
                            </div>
                        </div>

                        <div className="flex-1 overflow-y-auto border rounded bg-gray-50 p-2">
                            {employes.filter(e => e.actif !== false).map(emp => (
                                <div key={emp.id} className="flex items-center gap-3 p-2 hover:bg-white rounded cursor-pointer" onClick={() => toggleTransportSelection(emp.id)}>
                                    {transportSelection.includes(emp.id) 
                                        ? <CheckSquare className="text-blue-600" size={20}/> 
                                        : <Square className="text-gray-400" size={20}/>}
                                    <span className={transportSelection.includes(emp.id) ? "font-bold text-gray-800" : "text-gray-600"}>{emp.nom}</span>
                                </div>
                            ))}
                        </div>

                        <div className="flex justify-end gap-3 mt-4 pt-2 border-t">
                            <button onClick={() => setTransportModalOpen(false)} className="px-4 py-2 text-gray-600 bg-gray-100 rounded">Annuler</button>
                            <button onClick={handleBulkTransport} className="px-4 py-2 bg-blue-600 text-white rounded font-bold hover:bg-blue-700">Valider Sortie</button>
                        </div>
                    </div>
                </div>
            )}

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
                                        <td className="py-3 px-4 text-center"><div className="flex justify-center gap-1">{!showArchived ? (<><button onClick={() => setBadgeEmployee(emp)} className="p-1.5 text-gray-500 hover:bg-gray-100 rounded" title="Badge QR"><QrCode size={16}/></button><button onClick={() => openAttendanceHistory(emp)} className="p-1.5 text-purple-600 hover:bg-purple-50 rounded"><Calendar size={16}/></button>{emp.email && (<button onClick={() => openAccessModal(emp)} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded"><Lock size={16}/></button>)}<button onClick={() => openAbsenceModal(emp)} className="p-1.5 text-red-500 hover:bg-red-50 rounded"><UserMinus size={16}/></button><button onClick={() => openHistoryModal(emp)} className="p-1.5 text-blue-500 hover:bg-blue-50 rounded"><History size={16}/></button><button onClick={() => openPayModal(emp)} className="p-1.5 text-green-600 hover:bg-green-50 rounded"><Banknote size={16}/></button><button onClick={() => openEditModal(emp)} className="p-1.5 text-gray-500 hover:bg-gray-100 rounded"><Edit2 size={16}/></button><button onClick={(e) => triggerArchive(e, emp.id)} className="p-1.5 text-orange-500 hover:bg-orange-50 rounded"><Archive size={16}/></button></>) : (<button onClick={() => handleRestoreEmployee(emp)} className="p-1.5 text-green-600 hover:bg-green-50 rounded"><RotateCcw size={14}/></button>)}</div></td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Modal de Gestion de Paie avec Navigation Corrigée */}
            {payModalOpen && selectedEmployeeForPay && (
                <div className="fixed inset-0 bg-black bg-opacity-60 z-[60] flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in duration-200">
                        <div className="bg-gray-800 p-4 text-white flex justify-between items-center">
                            <div>
                                <h3 className="text-lg font-bold flex items-center gap-2"><Banknote size={20} className="text-green-400" /> Gestion Paie</h3>
                                <p className="text-sm text-gray-400">{selectedEmployeeForPay.nom}</p>
                            </div>
                            <button onClick={() => setPayModalOpen(false)}><X size={24} /></button>
                        </div>
                        
                        {/* ONGLETS DE NAVIGATION */}
                        <div className="flex border-b border-gray-200">
                            <button 
                                onClick={() => setPayTab('TRANSACTION')}
                                className={`flex-1 py-3 text-sm font-bold transition-colors ${payTab === 'TRANSACTION' ? 'text-brand-600 border-b-2 border-brand-600 bg-brand-50' : 'text-gray-500 hover:bg-gray-50'}`}
                            >
                                Acompte / Prime
                            </button>
                            <button 
                                onClick={() => setPayTab('SALAIRE')}
                                className={`flex-1 py-3 text-sm font-bold transition-colors ${payTab === 'SALAIRE' ? 'text-green-600 border-b-2 border-green-600 bg-green-50' : 'text-gray-500 hover:bg-gray-50'}`}
                            >
                                Paiement Salaire
                            </button>
                        </div>

                        <div className="p-6">
                            {payTab === 'TRANSACTION' ? (
                                <div className="space-y-4">
                                    <div className="grid grid-cols-2 gap-4">
                                        <div><label className="block text-sm">Date</label><input type="date" value={transactionData.date} onChange={e=>setTransactionData({...transactionData,date:e.target.value})} className="w-full border p-2 rounded"/></div>
                                        <div><label className="block text-sm">Type</label><select value={transactionData.type} onChange={e=>setTransactionData({...transactionData,type:e.target.value as any})} className="w-full border p-2 rounded"><option value="ACOMPTE">Acompte</option><option value="PRIME">Prime</option></select></div>
                                    </div>
                                    {transactionData.type === 'ACOMPTE' && (<div><label className="block text-sm">Compte Source</label><select value={paymentAccountId} onChange={e=>setPaymentAccountId(e.target.value)} className="w-full border p-2 rounded"><option value="">-- Choisir --</option>{comptes.map(c=><option key={c.id} value={c.id}>{c.nom} ({c.solde} F)</option>)}</select></div>)}
                                    <div><label className="block text-sm">Montant</label><input type="number" value={transactionData.montant} onChange={e=>setTransactionData({...transactionData,montant:parseInt(e.target.value)||0})} className="w-full border p-2 rounded font-bold"/></div>
                                    <div><label className="block text-sm">Motif</label><input type="text" value={transactionData.note} onChange={e=>setTransactionData({...transactionData,note:e.target.value})} className="w-full border p-2 rounded"/></div>
                                    <button onClick={handleSaveTransaction} className="w-full bg-brand-600 text-white p-2 rounded font-bold mt-2">Enregistrer</button>
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    <div><label className="block text-sm">Période</label><input type="text" value={salaryData.period} className="w-full border p-2 rounded bg-gray-100" readOnly/></div>
                                    <div><label className="block text-sm">Compte Paiement</label><select value={paymentAccountId} onChange={e=>setPaymentAccountId(e.target.value)} className="w-full border p-2 rounded"><option value="">-- Choisir --</option>{comptes.map(c=><option key={c.id} value={c.id}>{c.nom} ({c.solde.toLocaleString()} F)</option>)}</select></div>
                                    <button onClick={handleConfirmSalaire} className="w-full bg-green-600 text-white p-2 rounded font-bold">Payer Salaire</button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Other Modals */}
            {actionTransactionModalOpen && currentActionTransaction && (
                <div className="fixed inset-0 bg-black bg-opacity-60 z-[80] flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm p-6 animate-in zoom-in duration-200">
                        <div className="flex items-center gap-3 text-gray-800 mb-4 border-b border-gray-100 pb-3">
                            {actionType === 'DELETE' ? <Trash2 className="text-red-600" size={24}/> : <Edit2 className="text-blue-600" size={24}/>}
                            <h3 className="text-lg font-bold">{actionType === 'DELETE' ? 'Annuler Transaction' : 'Modifier Transaction'}</h3>
                        </div>
                        <div className="mb-4 text-sm bg-gray-50 p-3 rounded text-gray-700"><p><strong>Type :</strong> {currentActionTransaction.type}</p><p><strong>Montant Actuel :</strong> {currentActionTransaction.montant.toLocaleString()} F</p></div>
                        {actionType === 'EDIT' && (<div className="mb-4"><label className="block text-sm font-medium text-gray-700 mb-1">Nouveau Montant</label><input type="number" value={newEditAmount} onChange={e => setNewEditAmount(parseInt(e.target.value) || 0)} className="w-full p-2 border border-gray-300 rounded font-bold"/></div>)}
                        <div className="mb-6"><label className="block text-sm font-medium text-gray-700 mb-1">{actionType === 'DELETE' ? 'Reverser les fonds sur le compte :' : 'Ajuster la différence sur le compte :'}</label><select className="w-full p-2 border border-gray-300 rounded bg-blue-50 border-blue-200 text-sm" value={refundAccountId} onChange={(e) => setRefundAccountId(e.target.value)}><option value="">-- Choisir Caisse / Banque --</option>{comptes.map(acc => (<option key={acc.id} value={acc.id}>{acc.nom} ({acc.solde.toLocaleString()} F)</option>))}</select><p className="text-[10px] text-gray-500 mt-1">{actionType === 'DELETE' ? "Le montant sera rajouté à ce solde." : "La différence sera débitée ou créditée sur ce compte."}</p></div>
                        <div className="flex justify-end gap-3"><button onClick={() => setActionTransactionModalOpen(false)} className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-lg font-medium">Annuler</button><button onClick={handleProcessTransactionAction} disabled={!refundAccountId} className={`px-4 py-2 text-white rounded-lg font-bold shadow-md disabled:opacity-50 ${actionType === 'DELETE' ? 'bg-red-600 hover:bg-red-700' : 'bg-blue-600 hover:bg-blue-700'}`}>Confirmer</button></div>
                    </div>
                </div>
            )}

            {historyModalOpen && selectedEmployeeForHistory && (
                <div className="fixed inset-0 bg-black bg-opacity-60 z-[70] flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden animate-in fade-in zoom-in duration-200 flex flex-col max-h-[90vh]">
                        <div className="bg-gray-800 text-white p-4 flex justify-between items-center shrink-0"><h3 className="text-lg font-bold">Historique: {selectedEmployeeForHistory.nom}</h3><button onClick={() => setHistoryModalOpen(false)}><X size={24}/></button></div>
                        <div className="p-6 overflow-y-auto flex-1"><table className="w-full text-sm text-left"><thead className="bg-gray-50 font-medium"><tr><th className="p-2">Date</th><th className="p-2">Type</th><th className="p-2">Montant</th><th className="p-2 text-center">Action</th></tr></thead><tbody>{selectedEmployeeForHistory.historiquePaie?.map(tr => (<tr key={tr.id} className="border-b"><td className="p-2">{new Date(tr.date).toLocaleDateString()}</td><td className="p-2">{tr.type}</td><td className="p-2 font-bold">{tr.montant.toLocaleString()} F</td><td className="p-2 text-center">{tr.type !== 'SALAIRE_NET' && (<div className="flex justify-center gap-2"><button onClick={() => openActionTransactionModal(tr, 'EDIT')} className="text-blue-500"><Edit2 size={14}/></button><button onClick={() => openActionTransactionModal(tr, 'DELETE')} className="text-red-500"><Trash2 size={14}/></button></div>)}</td></tr>))}</tbody></table></div>
                    </div>
                </div>
            )}
            
            {absenceModalOpen && (
                <div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm p-6 animate-in zoom-in duration-200">
                        <div className="flex justify-between items-center mb-4"><h3 className="text-xl font-bold flex items-center gap-2"><UserMinus size={24} className="text-red-600"/> Absence</h3><button onClick={() => setAbsenceModalOpen(false)}><X size={20}/></button></div>
                        <div className="space-y-4">
                            <div><label className="block text-sm mb-1">Date</label><input type="date" className="w-full border p-2 rounded" value={absenceData.date} onChange={e => setAbsenceData({...absenceData, date: e.target.value})}/></div>
                            <div><label className="block text-sm mb-1">Motif</label><input type="text" className="w-full border p-2 rounded" value={absenceData.motif} onChange={e => setAbsenceData({...absenceData, motif: e.target.value})}/></div>
                            <div><label className="block text-sm mb-1">Jours</label><input type="number" className="w-full border p-2 rounded" value={absenceData.nombreJours} onChange={e => setAbsenceData({...absenceData, nombreJours: parseInt(e.target.value)||0})}/></div>
                            <div><label className="block text-sm mb-1">Retenue (FCFA)</label><input type="number" className="w-full border p-2 rounded" value={absenceData.montantRetenue} onChange={e => setAbsenceData({...absenceData, montantRetenue: parseInt(e.target.value)||0})}/></div>
                        </div>
                        <button onClick={handleSaveAbsence} className="w-full bg-red-600 text-white p-2 rounded font-bold mt-6">Enregistrer Absence</button>
                    </div>
                </div>
            )}

            {isModalOpen && (
                <div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg p-6 animate-in zoom-in duration-200">
                        <div className="flex justify-between items-center mb-6"><h3 className="text-xl font-bold">{editingEmployee ? 'Modifier Employé' : 'Nouvel Employé'}</h3><button onClick={() => setIsModalOpen(false)}><X size={24}/></button></div>
                        <div className="space-y-4">
                            <div><label className="block text-sm font-medium mb-1">Nom Complet</label><input type="text" className="w-full p-2 border rounded" value={formData.nom} onChange={e => setFormData({...formData, nom: e.target.value})}/></div>
                            <div className="grid grid-cols-2 gap-4">
                                <div><label className="block text-sm font-medium mb-1">Rôle</label><select className="w-full p-2 border rounded" value={formData.role} onChange={e => setFormData({...formData, role: e.target.value as any})}>{Object.values(RoleEmploye).map(r => <option key={r} value={r}>{r}</option>)}</select></div>
                                <div><label className="block text-sm font-medium mb-1">Contrat</label><select className="w-full p-2 border rounded" value={formData.typeContrat} onChange={e => setFormData({...formData, typeContrat: e.target.value})}><option value="CDI">CDI</option><option value="CDD">CDD</option><option value="STAGE">Stage</option><option value="PRESTATAIRE">Prestataire</option></select></div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div><label className="block text-sm font-medium mb-1">Téléphone</label><input type="text" className="w-full p-2 border rounded" value={formData.telephone} onChange={e => setFormData({...formData, telephone: e.target.value})}/></div>
                                <div><label className="block text-sm font-medium mb-1">Email (Opt.)</label><input type="email" className="w-full p-2 border rounded" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})}/></div>
                            </div>
                            <div><label className="block text-sm font-medium mb-1">Salaire de Base</label><input type="number" className="w-full p-2 border rounded" value={formData.salaireBase} onChange={e => setFormData({...formData, salaireBase: parseInt(e.target.value)||0})}/></div>
                            <div><label className="block text-sm font-medium mb-1">Affectation</label><select className="w-full p-2 border rounded" value={formData.boutiqueId || ''} onChange={e => setFormData({...formData, boutiqueId: e.target.value})}><option value="">-- Aucune --</option><option value="ATELIER">Atelier Central</option>{boutiques.map(b => <option key={b.id} value={b.id}>{b.nom}</option>)}</select></div>
                        </div>
                        <div className="flex justify-end gap-3 mt-6"><button onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-gray-600 bg-gray-100 rounded">Annuler</button><button onClick={handleSaveEmployee} className="px-4 py-2 bg-blue-600 text-white rounded font-bold">Enregistrer</button></div>
                    </div>
                </div>
            )}

            {accessModalOpen && accessEmployee && (
                <div className="fixed inset-0 bg-black bg-opacity-60 z-[90] flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm p-6 animate-in zoom-in duration-200">
                        <div className="flex items-center gap-3 mb-4 text-blue-600"><Lock size={24}/><h3 className="text-xl font-bold">Accès Système</h3></div>
                        <p className="text-sm text-gray-600 mb-4">Créer un compte de connexion pour <strong>{accessEmployee.nom}</strong> ({accessEmployee.email}).</p>
                        <div className="mb-4"><label className="block text-sm font-bold mb-1">Mot de Passe</label><input type="password" className="w-full p-2 border border-gray-300 rounded" value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="Minimum 6 caractères"/></div>
                        <div className="flex justify-end gap-3"><button onClick={() => setAccessModalOpen(false)} className="px-4 py-2 text-gray-600 bg-gray-100 rounded">Annuler</button><button onClick={handleCreateAccess} disabled={isCreatingAccess || newPassword.length < 6} className="px-4 py-2 bg-blue-600 text-white rounded font-bold disabled:opacity-50">{isCreatingAccess ? 'Création...' : 'Créer Accès'}</button></div>
                    </div>
                </div>
            )}

            {activeTab === 'POINTAGE' && (
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex-1 flex flex-col">
                    <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                        <div className="flex items-center gap-4">
                            <div className="flex items-center gap-2 bg-white border border-gray-300 rounded px-3 py-1">
                                <Calendar size={18} className="text-gray-500"/>
                                <input type="date" value={pointageDate} onChange={(e) => setPointageDate(e.target.value)} className="bg-transparent border-none font-bold text-gray-700 focus:ring-0 text-sm"/>
                            </div>
                            <button 
                                onClick={() => setIsScannerOpen(true)}
                                className="bg-brand-600 hover:bg-brand-700 text-white px-4 py-1.5 rounded font-bold text-sm flex items-center gap-2"
                            >
                                <Camera size={16} /> Scanner Pointage
                            </button>
                        </div>
                        {!isPointageOnly && <div className="text-xs text-gray-500 font-bold">Présents: {dailyPointages.filter(p => p.statut === 'PRESENT' || p.statut === 'RETARD').length}</div>}
                    </div>
                    <div className="overflow-x-auto flex-1">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-white text-gray-600 font-medium border-b border-gray-100"><tr><th className="py-3 px-4">Employé</th><th className="py-3 px-4 text-center">Statut</th><th className="py-3 px-4 text-center">Arrivée</th><th className="py-3 px-4 text-center">Départ</th><th className="py-3 px-4 text-center">Action</th></tr></thead>
                            <tbody className="divide-y divide-gray-100">
                                {employeesToShowInPointage.map(emp => {
                                    const pt = dailyPointages.find(p => p.employeId === emp.id);
                                    return (
                                        <tr key={emp.id} className="hover:bg-gray-50">
                                            <td className="py-3 px-4 font-bold text-gray-800">{emp.nom} <span className="text-xs text-gray-400 font-normal">({emp.role})</span></td>
                                            <td className="py-3 px-4 text-center">{pt ? <span className={`px-2 py-1 rounded text-xs font-bold ${getPointageStatusColor(pt.statut)}`}>{pt.statut}</span> : <span className="text-gray-400 text-xs">NON POINTÉ</span>}</td>
                                            <td className="py-3 px-4 text-center">{pt?.heureArrivee || '-'}</td>
                                            <td className="py-3 px-4 text-center">{pt?.heureDepart || '-'}</td>
                                            <td className="py-3 px-4 text-center">
                                                {!pt ? (
                                                    <div className="flex justify-center gap-2"><button onClick={() => handleClockIn(emp.id)} className="bg-green-600 text-white px-3 py-1 rounded text-xs hover:bg-green-700">Arrivée</button><button onClick={() => handleMarkAbsent(emp.id)} className="bg-red-100 text-red-600 px-3 py-1 rounded text-xs hover:bg-red-200">Absent</button></div>
                                                ) : (
                                                    <div className="flex justify-center gap-2">
                                                        {pt.statut !== 'ABSENT' && !pt.heureDepart && (<button onClick={() => handleClockOut(pt)} className="bg-blue-600 text-white px-3 py-1 rounded text-xs hover:bg-blue-700">Départ</button>)}
                                                        {!isPointageOnly && (<button onClick={() => openCorrectionModal(emp, pt)} className="text-gray-400 hover:text-gray-600"><Edit2 size={14}/></button>)}
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

            {correctionModalOpen && editingPointage && (
                <div className="fixed inset-0 bg-black bg-opacity-60 z-[80] flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm p-6 animate-in zoom-in duration-200">
                        <h3 className="text-lg font-bold mb-4">Correction Pointage: {editingPointage.employeNom}</h3>
                        <div className="space-y-3">
                            <div><label className="block text-xs font-bold text-gray-500 uppercase mb-1">Statut</label><select className="w-full p-2 border rounded" value={editingPointage.statut} onChange={e => setEditingPointage({...editingPointage, statut: e.target.value as any})}><option value="PRESENT">Présent</option><option value="RETARD">Retard</option><option value="ABSENT">Absent</option><option value="CONGE">Congé</option></select></div>
                            <div><label className="block text-xs font-bold text-gray-500 uppercase mb-1">Heure Arrivée</label><input type="time" className="w-full p-2 border rounded" value={editingPointage.heureArrivee} onChange={e => setEditingPointage({...editingPointage, heureArrivee: e.target.value})}/></div>
                            <div><label className="block text-xs font-bold text-gray-500 uppercase mb-1">Heure Départ</label><input type="time" className="w-full p-2 border rounded" value={editingPointage.heureDepart} onChange={e => setEditingPointage({...editingPointage, heureDepart: e.target.value})}/></div>
                        </div>
                        <div className="flex justify-end gap-3 mt-6"><button onClick={() => setCorrectionModalOpen(false)} className="px-4 py-2 text-gray-600 bg-gray-100 rounded">Annuler</button><button onClick={handleSaveCorrection} className="px-4 py-2 bg-blue-600 text-white rounded font-bold">Corriger</button></div>
                    </div>
                </div>
            )}

            {attendanceHistoryModalOpen && selectedEmployeeForAttendance && (
                <div className="fixed inset-0 bg-black bg-opacity-60 z-[70] flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg flex flex-col max-h-[80vh] animate-in zoom-in duration-200">
                        <div className="bg-purple-600 text-white p-4 flex justify-between items-center shrink-0"><h3 className="font-bold flex items-center gap-2"><Calendar size={20}/> Historique Présence : {selectedEmployeeForAttendance.nom}</h3><button onClick={() => setAttendanceHistoryModalOpen(false)}><X size={24}/></button></div>
                        <div className="p-4 overflow-y-auto flex-1">
                            <table className="w-full text-sm text-left">
                                <thead className="bg-gray-50 text-gray-600 font-medium"><tr><th className="p-2">Date</th><th className="p-2 text-center">Statut</th><th className="p-2 text-center">Arrivée</th><th className="p-2 text-center">Départ</th></tr></thead>
                                <tbody className="divide-y divide-gray-100">
                                    {pointages.filter(p => p.employeId === selectedEmployeeForAttendance.id).sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map(pt => (
                                        <tr key={pt.id}>
                                            <td className="p-2 text-gray-600">{new Date(pt.date).toLocaleDateString()}</td>
                                            <td className="p-2 text-center"><span className={`px-2 py-0.5 rounded text-xs font-bold ${getPointageStatusColor(pt.statut)}`}>{pt.statut}</span></td>
                                            <td className="p-2 text-center">{pt.heureArrivee || '-'}</td>
                                            <td className="p-2 text-center">{pt.heureDepart || '-'}</td>
                                        </tr>
                                    ))}
                                    {pointages.filter(p => p.employeId === selectedEmployeeForAttendance.id).length === 0 && (<tr><td colSpan={4} className="p-4 text-center text-gray-400 italic">Aucun historique.</td></tr>)}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {archiveConfirmId && (
                <div className="fixed inset-0 bg-black bg-opacity-60 z-[90] flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm p-6 animate-in zoom-in duration-200">
                        <div className="flex items-center gap-3 mb-4 text-orange-600"><AlertTriangle size={24}/><h3 className="text-xl font-bold">Archiver Employé ?</h3></div>
                        <p className="text-sm text-gray-600 mb-6">Cet employé ne sera plus visible dans la liste active, mais son historique sera conservé.</p>
                        <div className="flex justify-end gap-3"><button onClick={() => setArchiveConfirmId(null)} className="px-4 py-2 text-gray-600 bg-gray-100 rounded">Annuler</button><button onClick={confirmArchive} className="px-4 py-2 bg-orange-600 text-white rounded font-bold">Confirmer</button></div>
                    </div>
                </div>
            )}

            {/* QR GENERATOR MODAL */}
            {badgeEmployee && (
                <QRGeneratorModal
                    isOpen={!!badgeEmployee}
                    onClose={() => setBadgeEmployee(null)}
                    value={badgeEmployee.id}
                    title={`Badge : ${badgeEmployee.nom}`}
                    subtitle={badgeEmployee.role}
                />
            )}

            {/* QR SCANNER MODAL */}
            {isScannerOpen && (
                <QRScannerModal
                    isOpen={isScannerOpen}
                    onClose={() => setIsScannerOpen(false)}
                    onScan={handleScanAttendance}
                />
            )}
        </div>
    );
};

export default HRView;
