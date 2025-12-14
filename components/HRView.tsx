import React, { useState, useMemo, useEffect } from 'react';
import { Employe, Boutique, Depense, Pointage, SessionUser, RoleEmploye, TransactionPaie, CompteFinancier, TransactionTresorerie, Absence } from '../types';
import { Users, Calendar, DollarSign, Plus, Edit2, Trash2, CheckCircle, XCircle, Search, Clock, Briefcase, Wallet, X, Bus, CheckSquare, History, UserMinus, AlertTriangle, Printer, Lock, RotateCcw, Banknote, QrCode, Camera, Archive, Calculator, ChevronRight, FileText, PieChart, TrendingUp, AlertOctagon, CreditCard } from 'lucide-react';
import { QRGeneratorModal, QRScannerModal } from './QRTools';
import { QRCodeCanvas } from 'qrcode.react';

interface HRViewProps {
    employes: Employe[];
    boutiques: Boutique[];
    onAddEmploye: (e: Employe) => void;
    onUpdateEmploye: (e: Employe) => void;
    onDeleteEmploye: (id: string) => void;
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

const HRView: React.FC<HRViewProps> = ({ 
    employes, boutiques, onAddEmploye, onUpdateEmploye, onDeleteEmploye, 
    onAddDepense, depenses, onDeleteDepense, onUpdateDepense, 
    pointages, onAddPointage, onUpdatePointage, currentUser, 
    comptes, onUpdateComptes, onAddTransaction 
}) => {
    const isPointageOnly = currentUser?.role === RoleEmploye.GARDIEN;
    const [activeTab, setActiveTab] = useState<'EMPLOYEES' | 'POINTAGE'>(isPointageOnly ? 'POINTAGE' : 'EMPLOYEES');
    const [searchTerm, setSearchTerm] = useState('');
    const [showArchived, setShowArchived] = useState(false);
    
    // Config horaires
    const WORK_START_HOUR = 10;
    const TOLERANCE_MINUTES = 15;

    // Employee Modal
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingEmployee, setEditingEmployee] = useState<Employe | null>(null);
    const [formData, setFormData] = useState<Partial<Employe>>({
        nom: '', role: RoleEmploye.STAGIAIRE, telephone: '', salaireBase: 0, typeContrat: 'STAGE', numeroCNI: ''
    });

    // Transport Bulk
    const [transportModalOpen, setTransportModalOpen] = useState(false);
    const [transportSelection, setTransportSelection] = useState<string[]>([]);
    const [transportAmount, setTransportAmount] = useState(1000);
    const [transportAccountId, setTransportAccountId] = useState('');

    // Pay Modal
    const [payModalOpen, setPayModalOpen] = useState(false);
    const [selectedEmployeeForPay, setSelectedEmployeeForPay] = useState<Employe | null>(null);
    const [payTab, setPayTab] = useState<'TRANSACTION' | 'SALAIRE'>('TRANSACTION');
    const [paymentAccountId, setPaymentAccountId] = useState<string>('');
    const [transactionData, setTransactionData] = useState({ date: new Date().toISOString().split('T')[0], type: 'ACOMPTE', montant: 0, note: '' });
    
    // Salary Month State
    const [salaryMonth, setSalaryMonth] = useState(new Date().toISOString().slice(0, 7)); // YYYY-MM

    // History Modal
    const [historyModalOpen, setHistoryModalOpen] = useState(false);
    const [selectedEmployeeForHistory, setSelectedEmployeeForHistory] = useState<Employe | null>(null);

    // Individual Presence Report Modal
    const [selectedEmployeeForPresence, setSelectedEmployeeForPresence] = useState<Employe | null>(null);
    const [individualReportMonth, setIndividualReportMonth] = useState(new Date().toISOString().slice(0, 7));

    // Edit/Delete Transaction Logic
    const [actionTransactionModalOpen, setActionTransactionModalOpen] = useState(false);
    const [currentActionTransaction, setCurrentActionTransaction] = useState<TransactionPaie | null>(null);
    const [actionType, setActionType] = useState<'EDIT' | 'DELETE'>('DELETE');
    const [refundAccountId, setRefundAccountId] = useState('');
    const [newEditAmount, setNewEditAmount] = useState<number>(0);

    // Pointage Logic
    const [pointageDate, setPointageDate] = useState(new Date().toISOString().split('T')[0]);
    const [isScannerOpen, setIsScannerOpen] = useState(false);
    const [manualBadgeId, setManualBadgeId] = useState('');
    
    // Global Report Modal
    const [isReportModalOpen, setIsReportModalOpen] = useState(false);
    const [reportMonth, setReportMonth] = useState(new Date().toISOString().slice(0, 7)); // YYYY-MM

    // Correction Pointage
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

    // QR Badge
    const [badgeEmployee, setBadgeEmployee] = useState<Employe | null>(null);
    const [showBatchBadges, setShowBatchBadges] = useState(false);

    // Filtered Data
    const filteredEmployes = employes.filter(e => {
        const matchesSearch = e.nom.toLowerCase().includes(searchTerm.toLowerCase()) || 
                              e.role.toLowerCase().includes(searchTerm.toLowerCase());
        return showArchived ? matchesSearch && e.actif === false : matchesSearch && e.actif !== false;
    });

    const dailyPointages = pointages.filter(p => p.date === pointageDate);

    // --- DASHBOARD STATISTICS ---
    const hrStats = useMemo(() => {
        const activeEmployees = employes.filter(e => e.actif !== false);
        const totalBaseSalary = activeEmployees.reduce((acc, e) => acc + (e.salaireBase || 0), 0);
        
        const today = new Date().toISOString().split('T')[0];
        const presentToday = pointages.filter(p => p.date === today && (p.statut === 'PRESENT' || p.statut === 'RETARD')).length;
        
        const currentMonth = new Date().toISOString().slice(0, 7);
        const paidThisMonth = employes.reduce((acc, emp) => {
            const empMonthPay = emp.historiquePaie
                ?.filter(t => t.date.startsWith(currentMonth))
                .reduce((sum, t) => sum + t.montant, 0) || 0;
            return acc + empMonthPay;
        }, 0);

        const latesThisMonth = pointages.filter(p => p.date.startsWith(currentMonth) && p.statut === 'RETARD').length;

        return {
            totalBaseSalary,
            presentToday,
            totalActive: activeEmployees.length,
            paidThisMonth,
            latesThisMonth
        };
    }, [employes, pointages]);

    // --- CALCUL SALAIRE ---
    const calculateSalaryDetails = (emp: Employe, monthStr: string) => {
        const [year, month] = monthStr.split('-').map(Number);
        
        // Filtrer les transactions du mois
        const monthTransactions = emp.historiquePaie?.filter(t => {
            const d = new Date(t.date);
            return d.getFullYear() === year && d.getMonth() + 1 === month;
        }) || [];

        const acomptes = monthTransactions.filter(t => t.type === 'ACOMPTE').reduce((sum, t) => sum + t.montant, 0);
        const primes = monthTransactions.filter(t => t.type === 'PRIME').reduce((sum, t) => sum + t.montant, 0);
        const dejaPaye = monthTransactions.filter(t => t.type === 'SALAIRE_NET').reduce((sum, t) => sum + t.montant, 0);

        const salaireBase = emp.salaireBase || 0;
        const netAPayer = Math.max(0, salaireBase + primes - acomptes - dejaPaye);

        return { salaireBase, acomptes, primes, dejaPaye, netAPayer, monthTransactions };
    };

    // --- REPORT GENERATION ---
    const generateMonthlyStats = () => {
        return employes.filter(e => e.actif !== false).map(emp => {
            const empPointages = pointages.filter(p => 
                p.employeId === emp.id && 
                p.date.startsWith(reportMonth)
            );

            const presentCount = empPointages.filter(p => p.statut === 'PRESENT').length;
            const retardCount = empPointages.filter(p => p.statut === 'RETARD').length;
            const absentCount = empPointages.filter(p => p.statut === 'ABSENT').length;
            const congeCount = empPointages.filter(p => p.statut === 'CONGE').length;

            return {
                id: emp.id,
                nom: emp.nom,
                present: presentCount,
                retard: retardCount,
                absent: absentCount,
                conge: congeCount,
                total: presentCount + retardCount + absentCount + congeCount
            };
        });
    };

    const handlePrintReport = () => {
        const content = document.getElementById('attendance-report')?.innerHTML;
        const printWindow = window.open('', '', 'height=600,width=800');
        if (printWindow && content) {
            printWindow.document.write('<html><head><title>Rapport Pointage</title>');
            printWindow.document.write('<style>body{font-family: sans-serif;} table{width:100%; border-collapse:collapse;} th, td{border:1px solid #ddd; padding:8px; text-align:left;} th{background-color:#f2f2f2;} .text-red-600{color:red;} .text-orange-600{color:orange;} .font-bold{font-weight:bold;}</style>');
            printWindow.document.write('</head><body>');
            printWindow.document.write(`<h2>Rapport de Présence - ${new Date(reportMonth).toLocaleDateString('fr-FR', {month: 'long', year: 'numeric'})}</h2>`);
            printWindow.document.write(content);
            printWindow.document.write('</body></html>');
            printWindow.document.close();
            printWindow.print();
        }
    };

    const handlePrintIndividualReport = () => {
        const content = document.getElementById('individual-report-content')?.innerHTML;
        const printWindow = window.open('', '', 'height=600,width=800');
        if (printWindow && content && selectedEmployeeForPresence) {
            printWindow.document.write('<html><head><title>Rapport Individuel</title>');
            printWindow.document.write('<style>body{font-family: sans-serif;} table{width:100%; border-collapse:collapse;} th, td{border:1px solid #ddd; padding:8px; text-align:left;} th{background-color:#f2f2f2;} .text-red-600{color:red;} .text-orange-600{color:orange;} .font-bold{font-weight:bold;}</style>');
            printWindow.document.write('</head><body>');
            printWindow.document.write(`<h2>Rapport Individuel: ${selectedEmployeeForPresence.nom}</h2>`);
            printWindow.document.write(`<h3>Période: ${new Date(individualReportMonth).toLocaleDateString('fr-FR', {month: 'long', year: 'numeric'})}</h3>`);
            printWindow.document.write(content);
            printWindow.document.write('</body></html>');
            printWindow.document.close();
            printWindow.print();
        }
    }

    // --- ACTIONS POINTAGE ---

    const getPointageStatusColor = (status: string) => {
        switch(status) {
            case 'PRESENT': return 'bg-green-100 text-green-800';
            case 'RETARD': return 'bg-orange-100 text-orange-800';
            case 'ABSENT': return 'bg-red-100 text-red-800';
            case 'CONGE': return 'bg-blue-100 text-blue-800';
            default: return 'bg-gray-100';
        }
    };

    const handleClockIn = (employeId: string) => {
        const now = new Date();
        const timeString = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
        
        // AUTO-CALCUL DU STATUT RETARD
        // Règle: Travail commence à 10h00. Tolérance 15 min (donc jusqu'à 10h15 inclus c'est OK).
        const currentHour = now.getHours();
        const currentMinute = now.getMinutes();
        
        let calculatedStatut: 'PRESENT' | 'RETARD' = 'PRESENT';
        
        // Si il est plus de 10h
        if (currentHour > WORK_START_HOUR) {
            calculatedStatut = 'RETARD';
        } 
        // Si il est 10h mais que les minutes dépassent la tolérance
        else if (currentHour === WORK_START_HOUR && currentMinute > TOLERANCE_MINUTES) {
            calculatedStatut = 'RETARD';
        }

        onAddPointage({
            id: `PT_${Date.now()}`,
            employeId,
            date: pointageDate,
            heureArrivee: timeString,
            statut: calculatedStatut 
        });
    };

    const handleClockOut = (pt: Pointage) => {
        const now = new Date();
        const timeString = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
        onUpdatePointage({ ...pt, heureDepart: timeString });
    };

    const handleMarkAbsent = (employeId: string) => {
        onAddPointage({
            id: `PT_${Date.now()}`,
            employeId,
            date: pointageDate,
            statut: 'ABSENT' 
        });
    };

    const handleScanAttendance = (scannedText: string) => {
        // Nettoyage input si manuel
        const empId = scannedText.trim();
        const employe = employes.find(e => e.id === empId);
        
        if (!employe) { 
            if (!isScannerOpen) alert("Badge inconnu !"); // Alert seulement si manuel pour éviter spam scanner
            return; 
        }

        const today = new Date().toISOString().split('T')[0];
        if (pointageDate !== today) {
            if(!window.confirm(`Vous pointez pour le ${today}, mais l'affichage est sur le ${pointageDate}. Basculer à aujourd'hui ?`)) return;
            setPointageDate(today);
        }

        const existingPt = pointages.find(p => p.employeId === employe.id && p.date === today);

        if (!existingPt) {
            handleClockIn(employe.id);
            if (!isScannerOpen) alert(`✅ ${employe.nom} : Arrivée enregistrée !`);
        } else if (!existingPt.heureDepart && existingPt.statut !== 'ABSENT') {
            handleClockOut(existingPt);
            if (!isScannerOpen) alert(`👋 ${employe.nom} : Départ enregistré !`);
        } else {
            if (!isScannerOpen) alert(`⚠️ ${employe.nom} a déjà terminé sa journée ou est absent.`);
        }
        
        // Reset manuel
        setManualBadgeId('');
        // Fermer scanner si ouvert
        if (isScannerOpen) {
            setIsScannerOpen(false);
            alert(`Pointage réussi pour ${employe.nom}`);
        }
    };

    const openCorrectionModal = (emp: Employe, pt?: Pointage) => {
        setEditingPointage({
            id: pt ? pt.id : null,
            employeId: emp.id,
            employeNom: emp.nom,
            date: pt ? pt.date : pointageDate,
            heureArrivee: pt?.heureArrivee || '',
            heureDepart: pt?.heureDepart || '',
            statut: pt?.statut || 'PRESENT'
        });
        setCorrectionModalOpen(true);
    };

    const handleSaveCorrection = () => {
        if (!editingPointage) return;
        const pt: Pointage = {
            id: editingPointage.id || `PT_${Date.now()}`,
            employeId: editingPointage.employeId,
            date: editingPointage.date,
            heureArrivee: editingPointage.heureArrivee,
            heureDepart: editingPointage.heureDepart,
            statut: editingPointage.statut
        };
        if (editingPointage.id) onUpdatePointage(pt);
        else onAddPointage(pt);
        setCorrectionModalOpen(false);
    };

    // --- ACTIONS PAIE / TRANSACTION ---

    const handleBulkTransport = () => {
        if (!transportAccountId) { alert("Veuillez choisir la caisse d'où sort l'argent."); return; }
        if (transportSelection.length === 0) { alert("Aucun employé sélectionné."); return; }

        const totalAmount = transportAmount * transportSelection.length;
        const account = comptes.find(c => c.id === transportAccountId);
        if (account && account.solde < totalAmount) {
            alert(`Solde insuffisant sur ${account.nom}. Il faut ${totalAmount.toLocaleString()} F.`);
            return;
        }

        const dateIso = new Date().toISOString();
        const dateShort = dateIso.split('T')[0];

        transportSelection.forEach((empId, index) => {
            const emp = employes.find(e => e.id === empId);
            if (emp) {
                const uniqueId = Date.now() + index;
                // 1. Historique Employé
                const transaction: TransactionPaie = { 
                    id: `TR_TRANS_${uniqueId}_${empId}`, 
                    date: dateIso, 
                    type: 'ACOMPTE', 
                    montant: transportAmount, 
                    description: `Transport Quotidien` 
                };
                const updatedEmp = { ...emp, historiquePaie: [transaction, ...(emp.historiquePaie || [])] };
                onUpdateEmploye(updatedEmp);

                // 2. Création Dépense (Débit Caisse via App.tsx)
                onAddDepense({
                    id: `D_TRANS_${uniqueId}_${empId}`,
                    date: dateShort,
                    montant: transportAmount,
                    categorie: 'SALAIRE',
                    description: `Transport ${emp.nom}`,
                    boutiqueId: emp.boutiqueId || 'ATELIER',
                    compteId: transportAccountId
                });
            }
        });
        setTransportModalOpen(false);
        alert(`Transport validé pour ${transportSelection.length} employés.`);
    };

    const handleSaveTransaction = () => {
        if (!selectedEmployeeForPay || transactionData.montant <= 0) return;
        
        if (transactionData.type === 'ACOMPTE') {
            if (!paymentAccountId) { alert("Veuillez sélectionner un compte de paiement."); return; }
            const account = comptes.find(c => c.id === paymentAccountId);
            if (account && account.solde < transactionData.montant) {
                alert(`Solde insuffisant sur ${account.nom}.`);
                return;
            }
        }

        const transaction: TransactionPaie = { 
            id: `TR_${Date.now()}`, 
            date: new Date(transactionData.date).toISOString(), 
            type: transactionData.type as any, 
            montant: transactionData.montant, 
            description: `${transactionData.type === 'ACOMPTE' ? 'Avance' : 'Prime'} : ${transactionData.note}` 
        };

        const updatedEmp = { ...selectedEmployeeForPay, historiquePaie: [transaction, ...(selectedEmployeeForPay.historiquePaie || [])] };
        onUpdateEmploye(updatedEmp);
        
        if (transactionData.type === 'ACOMPTE') {
            onAddDepense({ 
                id: `D_ACOMPTE_${Date.now()}`, 
                date: transactionData.date, 
                montant: transactionData.montant, 
                categorie: 'SALAIRE', 
                description: `Acompte (${selectedEmployeeForPay.nom}): ${transactionData.note}`, 
                boutiqueId: selectedEmployeeForPay.boutiqueId || 'ATELIER',
                compteId: paymentAccountId
            });
        }

        setSelectedEmployeeForPay(updatedEmp);
        setTransactionData({ ...transactionData, montant: 0, note: '' });
        alert("Opération enregistrée !");
    };

    const handlePaySalaryNet = (stats: any) => {
        if (!selectedEmployeeForPay) return;
        if (!paymentAccountId) { alert("Veuillez sélectionner la caisse de paiement."); return; }
        if (stats.netAPayer <= 0) { alert("Aucun montant à payer."); return; }

        const account = comptes.find(c => c.id === paymentAccountId);
        if (account && account.solde < stats.netAPayer) {
            alert(`Solde insuffisant sur ${account.nom}.`);
            return;
        }

        const transaction: TransactionPaie = {
            id: `TR_SAL_${Date.now()}`,
            date: new Date().toISOString(),
            type: 'SALAIRE_NET',
            montant: stats.netAPayer,
            description: `Solde Salaire ${salaryMonth}`
        };

        const updatedEmp = { ...selectedEmployeeForPay, historiquePaie: [transaction, ...(selectedEmployeeForPay.historiquePaie || [])] };
        onUpdateEmploye(updatedEmp);

        onAddDepense({
            id: `D_SAL_${Date.now()}`,
            date: new Date().toISOString().split('T')[0],
            montant: stats.netAPayer,
            categorie: 'SALAIRE',
            description: `Solde Salaire ${selectedEmployeeForPay.nom} (${salaryMonth})`,
            boutiqueId: selectedEmployeeForPay.boutiqueId || 'ATELIER',
            compteId: paymentAccountId
        });

        setSelectedEmployeeForPay(updatedEmp);
        alert("Salaire validé et payé !");
    };

    const openActionTransactionModal = (t: TransactionPaie, action: 'EDIT' | 'DELETE') => {
        if (t.type === 'SALAIRE_NET') {
            alert("Les salaires nets validés ne peuvent pas être modifiés directement.");
            return;
        }
        setCurrentActionTransaction(t);
        setActionType(action);
        setRefundAccountId('');
        setNewEditAmount(t.montant);
        setActionTransactionModalOpen(true);
    };

    const handleProcessTransactionAction = () => {
        if (!currentActionTransaction || !selectedEmployeeForHistory || !refundAccountId) {
            alert("Veuillez sélectionner un compte pour la régularisation financière.");
            return;
        }

        const account = comptes.find(c => c.id === refundAccountId);
        if (!account) return;

        let amountDiff = 0;
        let descLog = '';

        if (actionType === 'DELETE') {
            // Remboursement total (Annulation)
            amountDiff = currentActionTransaction.montant; // On remet l'argent dans la caisse
            descLog = `Annulation ${currentActionTransaction.type} - ${selectedEmployeeForHistory.nom}`;
            
            // Mise à jour employé
            const newHistory = selectedEmployeeForHistory.historiquePaie?.filter(t => t.id !== currentActionTransaction.id) || [];
            const updatedEmp = { ...selectedEmployeeForHistory, historiquePaie: newHistory };
            onUpdateEmploye(updatedEmp);
            setSelectedEmployeeForHistory(updatedEmp);

        } else if (actionType === 'EDIT') {
            const oldAmount = currentActionTransaction.montant;
            const newAmount = newEditAmount;
            amountDiff = oldAmount - newAmount; // Si on baisse l'acompte, on rend l'argent (positif). Si on augmente, on prend (négatif).

            if (amountDiff < 0 && account.solde < Math.abs(amountDiff)) {
                alert(`Solde insuffisant pour ajouter ${(Math.abs(amountDiff)).toLocaleString()} F.`);
                return;
            }

            descLog = `Correction ${currentActionTransaction.type} (${oldAmount} -> ${newAmount}) - ${selectedEmployeeForHistory.nom}`;

            // Mise à jour employé
            const newHistory = selectedEmployeeForHistory.historiquePaie?.map(t => 
                t.id === currentActionTransaction.id ? { ...t, montant: newAmount, description: t.description + ' (Modifié)' } : t
            ) || [];
            const updatedEmp = { ...selectedEmployeeForHistory, historiquePaie: newHistory };
            onUpdateEmploye(updatedEmp);
            setSelectedEmployeeForHistory(updatedEmp);
        }

        // Création Transaction de Régularisation Financière
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
            
            // Mise à jour solde compte
            const updatedComptes = comptes.map(c => c.id === refundAccountId ? { ...c, solde: c.solde + amountDiff } : c);
            onUpdateComptes(updatedComptes);
        }

        alert("Opération effectuée avec succès.");
        setActionTransactionModalOpen(false);
        setCurrentActionTransaction(null);
    };

    // --- MODALS & STATE SETTERS ---
    const handleSaveEmployee = () => {
        if (!formData.nom) return;
        if (editingEmployee) {
            onUpdateEmploye({ ...editingEmployee, ...formData as Employe });
        } else {
            onAddEmploye({ id: `E_${Date.now()}`, ...formData as Employe, actif: true, historiquePaie: [], absences: [] });
        }
        setIsModalOpen(false);
    };

    const openEditModal = (e: Employe) => { setEditingEmployee(e); setFormData(e); setIsModalOpen(true); };
    const openAddModal = () => { setEditingEmployee(null); setFormData({ nom: '', role: RoleEmploye.TAILLEUR, numeroCNI: '' }); setIsModalOpen(true); };
    const openPayModal = (e: Employe) => { setSelectedEmployeeForPay(e); setPayTab('TRANSACTION'); setPaymentAccountId(''); setTransactionData({ date: new Date().toISOString().split('T')[0], type: 'ACOMPTE', montant: 0, note: '' }); setPayModalOpen(true); };
    const toggleTransportSelection = (id: string) => setTransportSelection(prev => prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]);
    const selectAllTransport = () => setTransportSelection(transportSelection.length === filteredEmployes.length ? [] : filteredEmployes.map(e => e.id));

    return (
        <div className="h-[calc(100vh-8rem)] flex flex-col space-y-6">
            {/* ... (Header, Dashboard, and Stats Cards remain unchanged) ... */}
            <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2"><Briefcase className="text-brand-600" /> Ressources Humaines</h2>
                <div className="flex gap-2">
                    {!isPointageOnly && (
                        <div className="flex bg-gray-100 p-1 rounded-lg">
                            <button onClick={() => setActiveTab('EMPLOYEES')} className={`px-3 py-1.5 text-xs font-bold rounded ${activeTab === 'EMPLOYEES' ? 'bg-white shadow text-brand-700' : 'text-gray-500'}`}><Users size={14} /> Employés</button>
                            <button onClick={() => setActiveTab('POINTAGE')} className={`px-3 py-1.5 text-xs font-bold rounded ${activeTab === 'POINTAGE' ? 'bg-white shadow text-brand-700' : 'text-gray-500'}`}><Clock size={14} /> Pointage</button>
                        </div>
                    )}
                    {activeTab === 'EMPLOYEES' && !isPointageOnly && (
                        <div className="flex gap-2">
                            <button onClick={() => setTransportModalOpen(true)} className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded-lg flex items-center gap-2 font-medium text-sm"><Bus size={16} /> Transport Groupé</button>
                            <button onClick={() => setShowBatchBadges(true)} className="bg-gray-800 text-white px-3 py-2 rounded-lg flex items-center gap-2 font-medium text-sm"><QrCode size={16} /> Badges</button>
                            <button onClick={() => setShowArchived(!showArchived)} className="px-3 py-2 border rounded-lg text-sm font-medium bg-white hover:bg-gray-50"><Archive size={16} /></button>
                            <button onClick={openAddModal} className="bg-brand-600 hover:bg-brand-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 font-medium text-sm"><Users size={16} /> Nouveau</button>
                        </div>
                    )}
                </div>
            </div>

            {/* DASHBOARD SUMMARY */}
            {activeTab === 'EMPLOYEES' && !isPointageOnly && !showArchived && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="bg-white p-3 rounded-xl border border-gray-200 shadow-sm flex items-center justify-between">
                        <div>
                            <p className="text-xs text-gray-500 uppercase font-bold">Présents Auj.</p>
                            <div className="flex items-baseline gap-1">
                                <p className="text-2xl font-bold text-gray-900">{hrStats.presentToday}</p>
                                <span className="text-xs text-gray-400">/ {hrStats.totalActive}</span>
                            </div>
                        </div>
                        <div className="p-2 bg-blue-50 text-blue-600 rounded-full"><Users size={20}/></div>
                    </div>
                    
                    <div className="bg-white p-3 rounded-xl border border-gray-200 shadow-sm flex items-center justify-between">
                        <div>
                            <p className="text-xs text-gray-500 uppercase font-bold">Retards (Mois)</p>
                            <p className="text-2xl font-bold text-orange-600">{hrStats.latesThisMonth}</p>
                        </div>
                        <div className="p-2 bg-orange-50 text-orange-600 rounded-full"><Clock size={20}/></div>
                    </div>

                    <div className="bg-white p-3 rounded-xl border border-gray-200 shadow-sm flex items-center justify-between">
                        <div>
                            <p className="text-xs text-gray-500 uppercase font-bold">Masse Salariale</p>
                            <p className="text-2xl font-bold text-gray-900">{(hrStats.totalBaseSalary/1000).toFixed(0)}k <span className="text-xs font-normal">F</span></p>
                        </div>
                        <div className="p-2 bg-gray-100 text-gray-600 rounded-full"><TrendingUp size={20}/></div>
                    </div>

                    <div className="bg-white p-3 rounded-xl border border-gray-200 shadow-sm flex items-center justify-between">
                        <div>
                            <p className="text-xs text-gray-500 uppercase font-bold">Payé (Mois)</p>
                            <p className="text-2xl font-bold text-green-600">{(hrStats.paidThisMonth/1000).toFixed(0)}k <span className="text-xs font-normal">F</span></p>
                        </div>
                        <div className="p-2 bg-green-50 text-green-600 rounded-full"><Banknote size={20}/></div>
                    </div>
                </div>
            )}

            {/* TAB EMPLOYEES */}
            {activeTab === 'EMPLOYEES' && !isPointageOnly && (
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex-1 flex flex-col">
                    <div className="p-4 border-b border-gray-100 flex gap-4">
                        <div className="relative flex-1"><Search className="absolute left-3 top-2.5 text-gray-400" size={18} /><input type="text" placeholder="Rechercher..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm" /></div>
                        {showArchived && <div className="flex items-center px-4 bg-orange-100 text-orange-800 rounded-lg text-xs font-bold">ARCHIVES</div>}
                    </div>
                    <div className="overflow-x-auto flex-1">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-gray-50 text-gray-600 font-medium"><tr><th className="py-3 px-4">Nom</th><th className="py-3 px-4">Rôle</th><th className="py-3 px-4">Contact</th><th className="py-3 px-4">Contrat</th><th className="py-3 px-4 text-right">Salaire</th><th className="py-3 px-4 text-center">Actions</th></tr></thead>
                            <tbody className="divide-y divide-gray-100">
                                {filteredEmployes.map(emp => (
                                    <tr key={emp.id} className="hover:bg-gray-50">
                                        <td className="py-3 px-4">
                                            <div className="font-bold text-gray-800">{emp.nom}</div>
                                            {emp.numeroCNI && <div className="text-[10px] text-gray-500 font-mono flex items-center gap-1"><CreditCard size={10}/> {emp.numeroCNI}</div>}
                                        </td>
                                        <td className="py-3 px-4"><span className="bg-brand-50 text-brand-800 px-2 py-1 rounded text-xs">{emp.role}</span></td>
                                        <td className="py-3 px-4 text-gray-600">{emp.telephone}</td>
                                        <td className="py-3 px-4 text-gray-600">{emp.typeContrat}</td>
                                        <td className="py-3 px-4 text-right font-medium">{emp.salaireBase.toLocaleString()} F</td>
                                        <td className="py-3 px-4 text-center">
                                            <div className="flex justify-center gap-1">
                                                {!showArchived ? (
                                                    <>
                                                        <button onClick={() => setBadgeEmployee(emp)} className="p-1.5 text-gray-500 hover:bg-gray-100 rounded" title="Badge"><QrCode size={16}/></button>
                                                        <button onClick={() => setSelectedEmployeeForPresence(emp)} className="p-1.5 text-purple-600 hover:bg-purple-50 rounded" title="Rapport Présence"><FileText size={16}/></button>
                                                        <button onClick={() => openPayModal(emp)} className="p-1.5 text-green-600 hover:bg-green-50 rounded" title="Paie"><Banknote size={16}/></button>
                                                        <button onClick={() => { setSelectedEmployeeForHistory(emp); setHistoryModalOpen(true); }} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded" title="Historique"><History size={16}/></button>
                                                        <button onClick={() => openEditModal(emp)} className="p-1.5 text-gray-500 hover:bg-gray-100 rounded"><Edit2 size={16}/></button>
                                                        <button onClick={() => {
                                                            if (window.confirm("Êtes-vous sûr de vouloir archiver cet employé ? Il ne sera plus visible dans la liste active.")) {
                                                                onDeleteEmploye(emp.id);
                                                            }
                                                        }} className="p-1.5 text-red-500 hover:bg-red-50 rounded"><Archive size={16}/></button>
                                                    </>
                                                ) : (
                                                    <button onClick={() => onUpdateEmploye({...emp, actif: true})} className="p-1.5 text-green-600 hover:bg-green-50 rounded"><RotateCcw size={16}/></button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* TAB POINTAGE (Unchanged) */}
            {activeTab === 'POINTAGE' && (
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex-1 flex flex-col">
                    <div className="p-4 border-b border-gray-100 flex flex-wrap justify-between items-center bg-gray-50 gap-4">
                        <div className="flex items-center gap-4">
                            <div className="flex items-center gap-2 bg-white border border-gray-300 rounded px-3 py-1.5">
                                <Calendar size={18} className="text-gray-500"/>
                                <input type="date" value={pointageDate} onChange={(e) => setPointageDate(e.target.value)} className="bg-transparent border-none font-bold text-gray-700 focus:ring-0 text-sm"/>
                            </div>
                            <button 
                                onClick={() => setIsScannerOpen(true)}
                                className="bg-brand-600 hover:bg-brand-700 text-white px-4 py-1.5 rounded font-bold text-sm flex items-center gap-2"
                            >
                                <Camera size={16} /> Scanner Badge
                            </button>
                            {!isPointageOnly && (
                                <button
                                    onClick={() => setIsReportModalOpen(true)}
                                    className="bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 px-4 py-1.5 rounded font-medium text-sm flex items-center gap-2"
                                >
                                    <PieChart size={16} /> Rapports
                                </button>
                            )}
                        </div>
                        
                        <div className="flex items-center gap-2">
                            <input 
                                type="text" 
                                placeholder="ID Badge Manuel" 
                                className="p-1.5 text-sm border rounded w-32"
                                value={manualBadgeId}
                                onChange={(e) => setManualBadgeId(e.target.value)}
                                onKeyPress={(e) => e.key === 'Enter' && handleScanAttendance(manualBadgeId)}
                            />
                            <button 
                                onClick={() => handleScanAttendance(manualBadgeId)}
                                className="bg-gray-200 hover:bg-gray-300 text-gray-700 px-3 py-1.5 rounded text-sm font-bold"
                            >
                                Pointer
                            </button>
                        </div>

                        {!isPointageOnly && <div className="text-xs text-gray-500 font-bold">Présents: {dailyPointages.filter(p => p.statut === 'PRESENT' || p.statut === 'RETARD').length}</div>}
                    </div>
                    <div className="overflow-x-auto flex-1">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-white text-gray-600 font-medium border-b border-gray-100"><tr><th className="py-3 px-4">Employé</th><th className="py-3 px-4 text-center">Statut</th><th className="py-3 px-4 text-center">Arrivée</th><th className="py-3 px-4 text-center">Départ</th><th className="py-3 px-4 text-center">Action</th></tr></thead>
                            <tbody className="divide-y divide-gray-100">
                                {employes.filter(e => e.actif !== false).map(emp => {
                                    const pt = dailyPointages.find(p => p.employeId === emp.id);
                                    return (
                                        <tr key={emp.id} className="hover:bg-gray-50">
                                            <td className="py-3 px-4 font-bold text-gray-800">{emp.nom} <span className="text-xs text-gray-400 font-normal">({emp.role})</span><br/><span className="text-[10px] text-gray-400 font-mono">ID: {emp.id}</span></td>
                                            <td className="py-3 px-4 text-center">{pt ? <span className={`px-2 py-1 rounded text-xs font-bold ${getPointageStatusColor(pt.statut)}`}>{pt.statut}</span> : <span className="text-gray-400 text-xs">NON POINTÉ</span>}</td>
                                            <td className="py-3 px-4 text-center">{pt?.heureArrivee || '-'}</td>
                                            <td className="py-3 px-4 text-center">{pt?.heureDepart || '-'}</td>
                                            <td className="py-3 px-4 text-center">
                                                {!pt ? (
                                                    <div className="flex justify-center gap-2"><button onClick={() => handleClockIn(emp.id)} className="bg-green-600 text-white px-3 py-1 rounded text-xs hover:bg-green-700">Arrivée</button><button onClick={() => handleMarkAbsent(emp.id)} className="bg-red-100 text-red-600 px-3 py-1 rounded text-xs hover:bg-red-200">Absent</button></div>
                                                ) : (
                                                    <div className="flex justify-center gap-2">
                                                        {pt.statut !== 'ABSENT' && !pt.heureDepart && (<button onClick={() => handleClockOut(pt)} className="bg-blue-600 text-white px-3 py-1 rounded text-xs hover:bg-blue-700">Départ</button>)}
                                                        {!isPointageOnly && (<button onClick={() => openCorrectionModal(emp, pt)} className="text-gray-400 hover:text-gray-600 bg-white border border-gray-300 rounded p-1"><Edit2 size={14}/></button>)}
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

            {/* ... (Modals: Scanner, Badge, Batch Badge, Presence Report, Monthly Report, Correction Pointage, Transport, Action Transaction, Pay Modal, History Modal remain unchanged) ... */}
            
            {/* ... MODAL SCANNER ... */}
            {isScannerOpen && (
                <QRScannerModal isOpen={isScannerOpen} onClose={() => setIsScannerOpen(false)} onScan={handleScanAttendance} />
            )}

            {/* ... MODAL SINGLE BADGE ... */}
            {badgeEmployee && (
                <QRGeneratorModal 
                    isOpen={!!badgeEmployee} 
                    onClose={() => setBadgeEmployee(null)} 
                    value={badgeEmployee.id} 
                    title={badgeEmployee.nom} 
                    subtitle={badgeEmployee.role}
                />
            )}

            {/* ... MODAL BATCH BADGES ... */}
            {showBatchBadges && (
                <div className="fixed inset-0 bg-white z-[100] overflow-auto">
                    <div className="p-4 bg-gray-900 text-white flex justify-between items-center print:hidden sticky top-0">
                        <h3 className="font-bold flex items-center gap-2"><QrCode size={20}/> Planche Badges</h3>
                        <div className="flex gap-2">
                            <button onClick={() => window.print()} className="bg-brand-600 px-4 py-2 rounded font-bold flex items-center gap-2"><Printer size={16}/> Imprimer</button>
                            <button onClick={() => setShowBatchBadges(false)} className="bg-gray-700 px-4 py-2 rounded"><X size={16}/></button>
                        </div>
                    </div>
                    <div className="p-8 grid grid-cols-2 md:grid-cols-3 gap-8 print:grid-cols-2">
                        {filteredEmployes.map(emp => (
                            <div key={emp.id} className="border-2 border-black rounded-xl p-6 flex flex-col items-center text-center break-inside-avoid">
                                <h2 className="font-bold text-xl uppercase mb-4 tracking-widest border-b-2 border-black w-full pb-2">BY TCHICO</h2>
                                <QRCodeCanvas value={emp.id} size={150} level="H" />
                                <div className="mt-4 w-full">
                                    <p className="font-bold text-2xl uppercase truncate">{emp.nom}</p>
                                    <p className="text-sm font-bold uppercase mt-1 bg-black text-white inline-block px-3 py-1 rounded">{emp.role}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* ... MODAL INDIVIDUAL PRESENCE REPORT ... */}
            {selectedEmployeeForPresence && (
                <div className="fixed inset-0 bg-black bg-opacity-60 z-[90] flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl p-6 flex flex-col max-h-[90vh]">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-xl font-bold flex items-center gap-2 text-gray-800">
                                <FileText className="text-purple-600" /> Rapport Présence: {selectedEmployeeForPresence.nom}
                            </h3>
                            <button onClick={() => setSelectedEmployeeForPresence(null)}><X size={24} className="text-gray-500 hover:text-gray-700"/></button>
                        </div>

                        <div className="flex items-center gap-4 mb-4 bg-gray-50 p-3 rounded-lg border border-gray-100">
                            <label className="text-sm font-bold text-gray-600">Mois :</label>
                            <input 
                                type="month" 
                                value={individualReportMonth} 
                                onChange={(e) => setIndividualReportMonth(e.target.value)} 
                                className="border rounded p-2 text-sm font-bold"
                            />
                            <div className="flex-1 text-right">
                                <button onClick={handlePrintIndividualReport} className="bg-gray-800 text-white px-3 py-2 rounded text-sm font-bold flex items-center gap-2 ml-auto hover:bg-gray-900">
                                    <Printer size={16}/> Imprimer
                                </button>
                            </div>
                        </div>

                        <div className="flex-1 overflow-auto border rounded-lg" id="individual-report-content">
                            {(() => {
                                const empId = selectedEmployeeForPresence.id;
                                const empPointages = pointages.filter(p => 
                                    p.employeId === empId && 
                                    p.date.startsWith(individualReportMonth)
                                ).sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime());

                                const present = empPointages.filter(p => p.statut === 'PRESENT').length;
                                const retard = empPointages.filter(p => p.statut === 'RETARD').length;
                                const absent = empPointages.filter(p => p.statut === 'ABSENT').length;

                                return (
                                    <>
                                        <div className="bg-gray-100 p-4 mb-4 rounded-lg grid grid-cols-3 gap-4 text-center">
                                            <div><p className="text-xs text-gray-500 font-bold uppercase">Présences</p><p className="text-xl font-bold text-green-600">{present}</p></div>
                                            <div><p className="text-xs text-gray-500 font-bold uppercase">Retards</p><p className="text-xl font-bold text-orange-600">{retard}</p></div>
                                            <div><p className="text-xs text-gray-500 font-bold uppercase">Absences</p><p className="text-xl font-bold text-red-600">{absent}</p></div>
                                        </div>
                                        <table className="w-full text-sm text-left">
                                            <thead className="bg-gray-50 text-gray-700 font-bold">
                                                <tr>
                                                    <th className="p-3">Date</th>
                                                    <th className="p-3 text-center">Statut</th>
                                                    <th className="p-3 text-center">Arrivée</th>
                                                    <th className="p-3 text-center">Départ</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-gray-200">
                                                {empPointages.map(pt => (
                                                    <tr key={pt.id} className="hover:bg-gray-50">
                                                        <td className="p-3">{new Date(pt.date).toLocaleDateString()}</td>
                                                        <td className="p-3 text-center"><span className={`px-2 py-1 rounded text-xs font-bold ${getPointageStatusColor(pt.statut)}`}>{pt.statut}</span></td>
                                                        <td className="p-3 text-center text-gray-600">{pt.heureArrivee || '-'}</td>
                                                        <td className="p-3 text-center text-gray-600">{pt.heureDepart || '-'}</td>
                                                    </tr>
                                                ))}
                                                {empPointages.length === 0 && <tr><td colSpan={4} className="p-4 text-center text-gray-400 italic">Aucun pointage ce mois-ci.</td></tr>}
                                            </tbody>
                                        </table>
                                        <div className="mt-4 pt-4 border-t border-gray-200 text-xs text-gray-500 italic">
                                            Rapport généré automatiquement. Retard comptabilisé après {WORK_START_HOUR}h{TOLERANCE_MINUTES}.
                                        </div>
                                    </>
                                );
                            })()}
                        </div>
                    </div>
                </div>
            )}

            {/* ... MODAL REPORT MENSUEL ... */}
            {isReportModalOpen && (
                <div className="fixed inset-0 bg-black bg-opacity-60 z-[90] flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl p-6 flex flex-col max-h-[90vh]">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-xl font-bold flex items-center gap-2 text-gray-800">
                                <PieChart className="text-brand-600" /> Rapport Mensuel des Présences (Global)
                            </h3>
                            <button onClick={() => setIsReportModalOpen(false)}><X size={24} className="text-gray-500 hover:text-gray-700"/></button>
                        </div>

                        <div className="flex items-center gap-4 mb-4 bg-gray-50 p-3 rounded-lg border border-gray-100">
                            <label className="text-sm font-bold text-gray-600">Sélectionner le Mois :</label>
                            <input 
                                type="month" 
                                value={reportMonth} 
                                onChange={(e) => setReportMonth(e.target.value)} 
                                className="border rounded p-2 text-sm font-bold"
                            />
                            <div className="flex-1 text-right">
                                <button onClick={handlePrintReport} className="bg-gray-800 text-white px-3 py-2 rounded text-sm font-bold flex items-center gap-2 ml-auto hover:bg-gray-900">
                                    <Printer size={16}/> Imprimer
                                </button>
                            </div>
                        </div>

                        <div className="flex-1 overflow-auto border rounded-lg" id="attendance-report">
                            <table className="w-full text-sm text-left">
                                <thead className="bg-gray-100 text-gray-700 font-bold sticky top-0">
                                    <tr>
                                        <th className="p-3">Employé</th>
                                        <th className="p-3 text-center">Présence (Jours)</th>
                                        <th className="p-3 text-center text-orange-700">Retards (Jours)</th>
                                        <th className="p-3 text-center text-red-700">Absences (Jours)</th>
                                        <th className="p-3 text-center">Congés (Jours)</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-200">
                                    {generateMonthlyStats().map(stat => (
                                        <tr key={stat.id} className="hover:bg-gray-50">
                                            <td className="p-3 font-medium">{stat.nom}</td>
                                            <td className="p-3 text-center font-bold text-green-600">{stat.present}</td>
                                            <td className={`p-3 text-center font-bold ${stat.retard > 0 ? 'text-orange-600 bg-orange-50' : 'text-gray-400'}`}>{stat.retard}</td>
                                            <td className={`p-3 text-center font-bold ${stat.absent > 0 ? 'text-red-600 bg-red-50' : 'text-gray-400'}`}>{stat.absent}</td>
                                            <td className="p-3 text-center text-blue-600">{stat.conge}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                            <div className="p-4 text-xs text-gray-500 italic mt-2 border-t border-gray-100">
                                * Retard : Arrivée après {WORK_START_HOUR}h{TOLERANCE_MINUTES}.
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* ... MODAL CORRECTION POINTAGE ... */}
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

            {/* ... MODAL TRANSPORT ... */}
            {transportModalOpen && (
                <div className="fixed inset-0 bg-black bg-opacity-60 z-[75] flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg p-6 flex flex-col max-h-[90vh]">
                        <div className="flex justify-between items-center mb-4 shrink-0">
                            <h3 className="text-xl font-bold flex items-center gap-2 text-indigo-700"><Bus size={24}/> Transport Groupé</h3>
                            <button onClick={() => setTransportModalOpen(false)}><X size={20}/></button>
                        </div>
                        
                        <div className="mb-4 shrink-0 space-y-3">
                            <div className="flex gap-4">
                                <div className="flex-1">
                                    <label className="block text-xs font-bold text-gray-500 mb-1">Montant / Pers.</label>
                                    <input type="number" className="w-full p-2 border rounded font-bold" value={transportAmount} onChange={e => setTransportAmount(parseInt(e.target.value)||0)}/>
                                </div>
                                <div className="flex-1">
                                    <label className="block text-xs font-bold text-gray-500 mb-1">Caisse de sortie</label>
                                    <select className="w-full p-2 border rounded bg-indigo-50" value={transportAccountId} onChange={e => setTransportAccountId(e.target.value)}>
                                        <option value="">-- Choisir --</option>
                                        {comptes.map(c => <option key={c.id} value={c.id}>{c.nom} ({c.solde.toLocaleString()} F)</option>)}
                                    </select>
                                </div>
                            </div>
                            <div className="flex justify-between items-center bg-gray-50 p-2 rounded">
                                <span className="text-sm font-bold text-gray-600">Sélectionnés: {transportSelection.length}</span>
                                <button onClick={selectAllTransport} className="text-xs text-blue-600 underline">Tout cocher</button>
                            </div>
                        </div>

                        <div className="flex-1 overflow-y-auto border rounded-lg p-2 space-y-1">
                            {filteredEmployes.map(emp => (
                                <div key={emp.id} className={`flex items-center justify-between p-2 rounded cursor-pointer ${transportSelection.includes(emp.id) ? 'bg-indigo-50 border border-indigo-200' : 'hover:bg-gray-50 border border-transparent'}`} onClick={() => toggleTransportSelection(emp.id)}>
                                    <span className="text-sm font-medium">{emp.nom}</span>
                                    {transportSelection.includes(emp.id) ? <CheckSquare size={18} className="text-indigo-600"/> : <div className="w-4 h-4 border rounded border-gray-300"></div>}
                                </div>
                            ))}
                        </div>

                        <div className="mt-4 pt-4 border-t shrink-0 flex justify-between items-center">
                            <div className="text-sm">Total: <strong>{(transportAmount * transportSelection.length).toLocaleString()} F</strong></div>
                            <button onClick={handleBulkTransport} className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 font-bold disabled:opacity-50" disabled={transportSelection.length === 0}>Valider Sortie</button>
                        </div>
                    </div>
                </div>
            )}

            {/* ... MODAL ACTION TRANSACTION ... */}
            {actionTransactionModalOpen && currentActionTransaction && (
                <div className="fixed inset-0 bg-black bg-opacity-60 z-[80] flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm p-6 animate-in zoom-in duration-200">
                        <div className="flex items-center gap-3 text-gray-800 mb-4 border-b border-gray-100 pb-3">
                            {actionType === 'DELETE' ? <Trash2 className="text-red-600" size={24}/> : <Edit2 className="text-blue-600" size={24}/>}
                            <h3 className="text-lg font-bold">{actionType === 'DELETE' ? 'Annuler Transaction' : 'Modifier Transaction'}</h3>
                        </div>
                        <div className="mb-4 text-sm bg-gray-50 p-3 rounded text-gray-700"><p><strong>Type :</strong> {currentActionTransaction.type}</p><p><strong>Montant Actuel :</strong> {currentActionTransaction.montant.toLocaleString()} F</p></div>
                        {actionType === 'EDIT' && (<div className="mb-4"><label className="block text-sm font-medium text-gray-700 mb-1">Nouveau Montant</label><input type="number" value={newEditAmount} onChange={e => setNewEditAmount(parseInt(e.target.value) || 0)} className="w-full p-2 border border-gray-300 rounded font-bold"/></div>)}
                        <div className="mb-6"><label className="block text-sm font-medium text-gray-700 mb-1">{actionType === 'DELETE' ? 'Rembourser (créditer) sur le compte :' : 'Ajuster différence sur le compte :'}</label><select className="w-full p-2 border border-gray-300 rounded bg-blue-50 border-blue-200 text-sm" value={refundAccountId} onChange={(e) => setRefundAccountId(e.target.value)}><option value="">-- Choisir Caisse / Banque --</option>{comptes.map(acc => (<option key={acc.id} value={acc.id}>{acc.nom} ({acc.solde.toLocaleString()} F)</option>))}</select><p className="text-[10px] text-gray-500 mt-1">{actionType === 'DELETE' ? "Le montant sera rajouté au solde de ce compte." : "La différence sera débitée ou créditée sur ce compte."}</p></div>
                        <div className="flex justify-end gap-3"><button onClick={() => setActionTransactionModalOpen(false)} className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-lg font-medium">Annuler</button><button onClick={handleProcessTransactionAction} disabled={!refundAccountId} className={`px-4 py-2 text-white rounded-lg font-bold shadow-md disabled:opacity-50 ${actionType === 'DELETE' ? 'bg-red-600 hover:bg-red-700' : 'bg-blue-600 hover:bg-blue-700'}`}>Confirmer</button></div>
                    </div>
                </div>
            )}

            {/* ... MODAL PAIE INDIVIDUELLE ... */}
            {payModalOpen && selectedEmployeeForPay && (
                <div className="fixed inset-0 bg-black bg-opacity-60 z-[60] flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in duration-200">
                        <div className="bg-gray-800 p-4 text-white flex justify-between items-center">
                            <h3 className="font-bold flex items-center gap-2"><Banknote size={20} /> Paie: {selectedEmployeeForPay.nom}</h3>
                            <button onClick={() => setPayModalOpen(false)}><X size={20}/></button>
                        </div>
                        <div className="p-6 space-y-4">
                            <div className="flex gap-4">
                                <button onClick={() => setPayTab('TRANSACTION')} className={`flex-1 py-2 rounded text-sm font-bold ${payTab === 'TRANSACTION' ? 'bg-brand-100 text-brand-800' : 'bg-gray-100'}`}>Acompte / Prime</button>
                                <button onClick={() => setPayTab('SALAIRE')} className={`flex-1 py-2 rounded text-sm font-bold ${payTab === 'SALAIRE' ? 'bg-green-100 text-green-800' : 'bg-gray-100'}`}>Salaire Fin de Mois</button>
                            </div>

                            {payTab === 'TRANSACTION' ? (
                                <div className="space-y-4">
                                    <div className="grid grid-cols-2 gap-4">
                                        <div><label className="block text-xs font-bold mb-1">Date</label><input type="date" className="w-full p-2 border rounded" value={transactionData.date} onChange={e => setTransactionData({...transactionData, date: e.target.value})}/></div>
                                        <div><label className="block text-xs font-bold mb-1">Type</label><select className="w-full p-2 border rounded" value={transactionData.type} onChange={e => setTransactionData({...transactionData, type: e.target.value})}><option value="ACOMPTE">Acompte</option><option value="PRIME">Prime</option></select></div>
                                    </div>
                                    {transactionData.type === 'ACOMPTE' && (
                                        <div><label className="block text-xs font-bold mb-1">Compte Caisse</label><select className="w-full p-2 border rounded" value={paymentAccountId} onChange={e => setPaymentAccountId(e.target.value)}><option value="">-- Choisir --</option>{comptes.map(c => <option key={c.id} value={c.id}>{c.nom} ({c.solde.toLocaleString()} F)</option>)}</select></div>
                                    )}
                                    <div><label className="block text-xs font-bold mb-1">Montant</label><input type="number" className="w-full p-2 border rounded font-bold" value={transactionData.montant || ''} placeholder="0" onChange={e => setTransactionData({...transactionData, montant: parseInt(e.target.value)||0})}/></div>
                                    <div><label className="block text-xs font-bold mb-1">Note</label><input type="text" className="w-full p-2 border rounded" value={transactionData.note} onChange={e => setTransactionData({...transactionData, note: e.target.value})}/></div>
                                    <button onClick={handleSaveTransaction} className="w-full bg-brand-600 text-white p-2 rounded font-bold mt-2">Enregistrer</button>
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    <div className="flex items-center gap-2 mb-2">
                                        <Calendar size={16} className="text-gray-500" />
                                        <input 
                                            type="month" 
                                            className="border rounded p-1" 
                                            value={salaryMonth} 
                                            onChange={e => setSalaryMonth(e.target.value)} 
                                        />
                                    </div>
                                    
                                    {(() => {
                                        const stats = calculateSalaryDetails(selectedEmployeeForPay, salaryMonth);
                                        return (
                                            <div className="bg-gray-50 rounded-lg p-4 border border-gray-200 space-y-2 text-sm">
                                                <div className="flex justify-between"><span>Salaire de Base</span><span className="font-bold">{stats.salaireBase.toLocaleString()} F</span></div>
                                                <div className="flex justify-between text-green-600"><span>+ Primes</span><span>+{stats.primes.toLocaleString()} F</span></div>
                                                <div className="flex justify-between text-orange-600"><span>- Acomptes</span><span>-{stats.acomptes.toLocaleString()} F</span></div>
                                                {stats.dejaPaye > 0 && <div className="flex justify-between text-blue-600"><span>- Déjà Payé</span><span>-{stats.dejaPaye.toLocaleString()} F</span></div>}
                                                <div className="border-t border-gray-300 my-2 pt-2 flex justify-between text-lg font-bold">
                                                    <span>Net à Payer</span>
                                                    <span>{stats.netAPayer.toLocaleString()} F</span>
                                                </div>

                                                {stats.netAPayer > 0 ? (
                                                    <div className="pt-2 mt-2 border-t border-gray-200">
                                                        <label className="block text-xs font-bold mb-1">Caisse de paiement</label>
                                                        <select className="w-full p-2 border rounded mb-2" value={paymentAccountId} onChange={e => setPaymentAccountId(e.target.value)}>
                                                            <option value="">-- Choisir Caisse --</option>
                                                            {comptes.map(c => <option key={c.id} value={c.id}>{c.nom} ({c.solde.toLocaleString()} F)</option>)}
                                                        </select>
                                                        <button 
                                                            onClick={() => handlePaySalaryNet(stats)}
                                                            className="w-full bg-green-600 text-white p-2 rounded font-bold hover:bg-green-700"
                                                        >
                                                            Valider Paiement Salaire
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <div className="text-center text-gray-500 italic mt-2">Salaire entièrement réglé pour ce mois.</div>
                                                )}
                                            </div>
                                        );
                                    })()}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* ... MODAL HISTORIQUE PAIE ... */}
            {historyModalOpen && selectedEmployeeForHistory && (
                <div className="fixed inset-0 bg-black bg-opacity-60 z-[70] flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
                        <div className="bg-gray-800 text-white p-4 flex justify-between items-center shrink-0"><h3 className="font-bold">Historique: {selectedEmployeeForHistory.nom}</h3><button onClick={() => setHistoryModalOpen(false)}><X size={20}/></button></div>
                        <div className="p-6 overflow-y-auto flex-1">
                            <table className="w-full text-sm text-left">
                                <thead className="bg-gray-50 font-medium"><tr><th className="p-2">Date</th><th className="p-2">Type</th><th className="p-2">Description</th><th className="p-2 text-right">Montant</th><th className="p-2 text-center">Action</th></tr></thead>
                                <tbody>
                                    {selectedEmployeeForHistory.historiquePaie?.map(tr => (
                                        <tr key={tr.id} className="border-b">
                                            <td className="p-2">{new Date(tr.date).toLocaleDateString()}</td>
                                            <td className="p-2"><span className={`px-2 py-0.5 rounded text-xs font-bold ${tr.type === 'SALAIRE_NET' ? 'bg-green-100 text-green-800' : 'bg-blue-100 text-blue-800'}`}>{tr.type}</span></td>
                                            <td className="p-2 text-gray-600 truncate max-w-[150px]">{tr.description}</td>
                                            <td className="p-2 text-right font-bold">{tr.montant.toLocaleString()} F</td>
                                            <td className="p-2 text-center">
                                                {tr.type !== 'SALAIRE_NET' && (
                                                    <div className="flex justify-center gap-2">
                                                        <button onClick={() => openActionTransactionModal(tr, 'EDIT')} className="text-blue-500 hover:text-blue-700" title="Modifier"><Edit2 size={14}/></button>
                                                        <button onClick={() => openActionTransactionModal(tr, 'DELETE')} className="text-red-500 hover:text-red-700" title="Supprimer"><Trash2 size={14}/></button>
                                                    </div>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                    {(!selectedEmployeeForHistory.historiquePaie || selectedEmployeeForHistory.historiquePaie.length === 0) && (
                                        <tr><td colSpan={5} className="p-4 text-center text-gray-400">Aucun historique.</td></tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {/* MODAL EMPLOYEE ADD/EDIT */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg p-6 animate-in zoom-in duration-200">
                        <div className="flex justify-between items-center mb-6"><h3 className="text-xl font-bold">{editingEmployee ? 'Modifier Employé' : 'Nouvel Employé'}</h3><button onClick={() => setIsModalOpen(false)}><X size={24}/></button></div>
                        <div className="space-y-4">
                            <div><label className="block text-sm font-medium mb-1">Nom Complet</label><input type="text" className="w-full p-2 border rounded" value={formData.nom} onChange={e => setFormData({...formData, nom: e.target.value})}/></div>
                            <div>
                                <label className="block text-sm font-medium mb-1">Numéro CNI (Carte d'Identité)</label>
                                <input type="text" className="w-full p-2 border rounded font-mono text-sm" value={formData.numeroCNI} onChange={e => setFormData({...formData, numeroCNI: e.target.value})} placeholder="Numéro d'identification nationale"/>
                            </div>
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
                        <div className="flex justify-end gap-3 mt-6"><button onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-gray-600 bg-gray-100 rounded">Annuler</button><button onClick={handleSaveEmployee} className="px-4 py-2 bg-brand-600 text-white rounded font-bold">Enregistrer</button></div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default HRView;