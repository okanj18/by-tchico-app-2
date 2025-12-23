
import React, { useState, useMemo, useEffect } from 'react';
import { Employe, Boutique, Depense, Pointage, SessionUser, RoleEmploye, TransactionPaie, CompteFinancier, TransactionTresorerie, Absence } from '../types';
import { Users, Calendar, DollarSign, Plus, Edit2, Trash2, CheckCircle, XCircle, Search, Clock, Briefcase, Wallet, X, Bus, CheckSquare, History, UserMinus, AlertTriangle, Printer, Lock, RotateCcw, Banknote, QrCode, Camera, Archive, Calculator, ChevronRight, FileText, PieChart, TrendingUp, AlertOctagon, CreditCard, Upload, Image as ImageIcon, Loader, Eye } from 'lucide-react';
import { QRGeneratorModal, QRScannerModal } from './QRTools';
import { QRCodeCanvas } from 'qrcode.react';
import { uploadImageToCloud } from '../services/storageService';

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
    // LOGIQUE DE RÔLE : Le gardien est limité au pointage strict
    const isGardien = currentUser?.role === RoleEmploye.GARDIEN;
    const isPointageOnly = isGardien;
    
    const [activeTab, setActiveTab] = useState<'EMPLOYEES' | 'POINTAGE'>(isGardien ? 'POINTAGE' : 'EMPLOYEES');
    const [searchTerm, setSearchTerm] = useState('');
    const [showArchived, setShowArchived] = useState(false);
    
    // Config horaires
    const WORK_START_HOUR = 10;
    const TOLERANCE_MINUTES = 15;

    // ... (States existants conservés)
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingEmployee, setEditingEmployee] = useState<Employe | null>(null);
    const [formData, setFormData] = useState<Partial<Employe>>({
        nom: '', role: RoleEmploye.STAGIAIRE, telephone: '', salaireBase: 0, typeContrat: 'STAGE', numeroCNI: '', cniRecto: '', cniVerso: ''
    });
    const [isUploading, setIsUploading] = useState(false);
    const [previewImage, setPreviewImage] = useState<string | null>(null);
    const [transportModalOpen, setTransportModalOpen] = useState(false);
    const [transportSelection, setTransportSelection] = useState<string[]>([]);
    const [transportAmount, setTransportAmount] = useState(1000);
    const [transportAccountId, setTransportAccountId] = useState('');
    const [payModalOpen, setPayModalOpen] = useState(false);
    const [selectedEmployeeForPay, setSelectedEmployeeForPay] = useState<Employe | null>(null);
    const [payTab, setPayTab] = useState<'TRANSACTION' | 'SALAIRE'>('TRANSACTION');
    const [paymentAccountId, setPaymentAccountId] = useState<string>('');
    const [transactionData, setTransactionData] = useState({ date: new Date().toISOString().split('T')[0], type: 'ACOMPTE', montant: 0, note: '' });
    const [salaryMonth, setSalaryMonth] = useState(new Date().toISOString().slice(0, 7));
    const [historyModalOpen, setHistoryModalOpen] = useState(false);
    const [selectedEmployeeForHistory, setSelectedEmployeeForHistory] = useState<Employe | null>(null);
    const [selectedEmployeeForPresence, setSelectedEmployeeForPresence] = useState<Employe | null>(null);
    const [individualReportMonth, setIndividualReportMonth] = useState(new Date().toISOString().slice(0, 7));
    const [actionTransactionModalOpen, setActionTransactionModalOpen] = useState(false);
    const [currentActionTransaction, setCurrentActionTransaction] = useState<TransactionPaie | null>(null);
    const [actionType, setActionType] = useState<'EDIT' | 'DELETE'>('DELETE');
    const [refundAccountId, setRefundAccountId] = useState('');
    const [newEditAmount, setNewEditAmount] = useState<number>(0);
    const [pointageDate, setPointageDate] = useState(new Date().toISOString().split('T')[0]);
    const [isScannerOpen, setIsScannerOpen] = useState(false);
    const [manualBadgeId, setManualBadgeId] = useState('');
    const [isReportModalOpen, setIsReportModalOpen] = useState(false);
    const [reportMonth, setReportMonth] = useState(new Date().toISOString().slice(0, 7));
    const [correctionModalOpen, setCorrectionModalOpen] = useState(false);
    const [editingPointage, setEditingPointage] = useState<{ id: string | null, employeId: string, employeNom: string, date: string, heureArrivee: string, heureDepart: string, statut: 'PRESENT' | 'RETARD' | 'ABSENT' | 'CONGE' } | null>(null);
    const [badgeEmployee, setBadgeEmployee] = useState<Employe | null>(null);
    const [showBatchBadges, setShowBatchBadges] = useState(false);

    const filteredEmployes = employes.filter(e => {
        const matchesSearch = e.nom.toLowerCase().includes(searchTerm.toLowerCase()) || 
                              e.role.toLowerCase().includes(searchTerm.toLowerCase());
        return showArchived ? matchesSearch && e.actif === false : matchesSearch && e.actif !== false;
    });

    const dailyPointages = pointages.filter(p => p.date === pointageDate);

    // Statistiques RH (Masquées pour le gardien)
    const hrStats = useMemo(() => {
        if (isGardien) return null;
        const activeEmployees = employes.filter(e => e.actif !== false);
        const totalBaseSalary = activeEmployees.reduce((acc, e) => acc + (e.salaireBase || 0), 0);
        const today = new Date().toISOString().split('T')[0];
        const presentToday = pointages.filter(p => p.date === today && (p.statut === 'PRESENT' || p.statut === 'RETARD')).length;
        const currentMonth = new Date().toISOString().slice(0, 7);
        const paidThisMonth = employes.reduce((acc, emp) => {
            const empMonthPay = emp.historiquePaie?.filter(t => t.date.startsWith(currentMonth)).reduce((sum, t) => sum + t.montant, 0) || 0;
            return acc + empMonthPay;
        }, 0);
        const latesThisMonth = pointages.filter(p => p.date.startsWith(currentMonth) && p.statut === 'RETARD').length;
        return { totalBaseSalary, presentToday, totalActive: activeEmployees.length, paidThisMonth, latesThisMonth };
    }, [employes, pointages, isGardien]);

    const handleClockIn = (employeId: string) => {
        const now = new Date();
        const timeString = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
        const currentHour = now.getHours();
        const currentMinute = now.getMinutes();
        let calculatedStatut: 'PRESENT' | 'RETARD' = 'PRESENT';
        if (currentHour > WORK_START_HOUR || (currentHour === WORK_START_HOUR && currentMinute > TOLERANCE_MINUTES)) {
            calculatedStatut = 'RETARD';
        }
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

    const handleScanAttendance = (scannedText: string) => {
        const empId = scannedText.trim();
        const employe = employes.find(e => e.id === empId);
        if (!employe) { if (!isScannerOpen) alert("Badge inconnu !"); return; }
        const today = new Date().toISOString().split('T')[0];
        if (pointageDate !== today) {
            if(!window.confirm(`Vous pointez pour le ${today}, mais l'affichage est sur le ${pointageDate}. Basculer à aujourd'hui ?`)) return;
            setPointageDate(today);
        }
        const existingPt = pointages.find(p => p.employeId === employe.id && p.date === today);
        if (!existingPt) {
            handleClockIn(employe.id);
        } else if (!existingPt.heureDepart && existingPt.statut !== 'ABSENT') {
            handleClockOut(existingPt);
        } else {
            if (!isScannerOpen) alert(`⚠️ ${employe.nom} a déjà terminé sa journée ou est absent.`);
        }
        setManualBadgeId('');
        if (isScannerOpen) { setIsScannerOpen(false); }
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

    // FIX: Added missing openCorrectionModal function to set state for the correction modal.
    const openCorrectionModal = (emp: Employe, pt: Pointage) => {
        setEditingPointage({
            id: pt.id,
            employeId: emp.id,
            employeNom: emp.nom,
            date: pt.date,
            heureArrivee: pt.heureArrivee || '',
            heureDepart: pt.heureDepart || '',
            statut: pt.statut
        });
        setCorrectionModalOpen(true);
    };

    return (
        <div className="h-[calc(100vh-8rem)] flex flex-col space-y-6">
            <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2"><Briefcase className="text-brand-600" /> Ressources Humaines</h2>
                
                <div className="flex gap-2">
                    {/* LE GARDIEN NE PEUT PAS CHANGER D'ONGLET */}
                    {!isGardien && (
                        <div className="flex bg-gray-100 p-1 rounded-lg">
                            <button onClick={() => setActiveTab('EMPLOYEES')} className={`px-3 py-1.5 text-xs font-bold rounded ${activeTab === 'EMPLOYEES' ? 'bg-white shadow text-brand-700' : 'text-gray-500'}`}><Users size={14} /> Employés</button>
                            <button onClick={() => setActiveTab('POINTAGE')} className={`px-3 py-1.5 text-xs font-bold rounded ${activeTab === 'POINTAGE' ? 'bg-white shadow text-brand-700' : 'text-gray-500'}`}><Clock size={14} /> Pointage</button>
                        </div>
                    )}

                    {activeTab === 'EMPLOYEES' && !isGardien && (
                        <div className="flex gap-2">
                            <button onClick={() => setTransportModalOpen(true)} className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded-lg flex items-center gap-2 font-medium text-sm"><Bus size={16} /> Transport Groupé</button>
                            <button onClick={() => setShowBatchBadges(true)} className="bg-gray-800 text-white px-3 py-2 rounded-lg flex items-center gap-2 font-medium text-sm"><QrCode size={16} /> Badges</button>
                            <button onClick={() => setShowArchived(!showArchived)} className="px-3 py-2 border rounded-lg text-sm font-medium bg-white hover:bg-gray-50"><Archive size={16} /></button>
                            <button onClick={() => setIsModalOpen(true)} className="bg-brand-600 hover:bg-brand-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 font-medium text-sm"><Users size={16} /> Nouveau</button>
                        </div>
                    )}
                </div>
            </div>

            {/* DASHBOARD SUMMARY (Masqué pour le gardien) */}
            {hrStats && !showArchived && (
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
                        <div><p className="text-xs text-gray-500 uppercase font-bold">Retards (Mois)</p><p className="text-2xl font-bold text-orange-600">{hrStats.latesThisMonth}</p></div>
                        <div className="p-2 bg-orange-50 text-orange-600 rounded-full"><Clock size={20}/></div>
                    </div>
                    <div className="bg-white p-3 rounded-xl border border-gray-200 shadow-sm flex items-center justify-between">
                        <div><p className="text-xs text-gray-500 uppercase font-bold">Masse Salariale</p><p className="text-2xl font-bold text-gray-900">{(hrStats.totalBaseSalary/1000).toFixed(0)}k <span className="text-xs font-normal">F</span></p></div>
                        <div className="p-2 bg-gray-100 text-gray-600 rounded-full"><TrendingUp size={20}/></div>
                    </div>
                    <div className="bg-white p-3 rounded-xl border border-gray-200 shadow-sm flex items-center justify-between">
                        <div><p className="text-xs text-gray-500 uppercase font-bold">Payé (Mois)</p><p className="text-2xl font-bold text-green-600">{(hrStats.paidThisMonth/1000).toFixed(0)}k <span className="text-xs font-normal">F</span></p></div>
                        <div className="p-2 bg-green-50 text-green-600 rounded-full"><Banknote size={20}/></div>
                    </div>
                </div>
            )}

            {/* TAB POINTAGE (Vue principale du gardien) */}
            {activeTab === 'POINTAGE' && (
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex-1 flex flex-col">
                    <div className="p-4 border-b border-gray-100 flex flex-wrap justify-between items-center bg-gray-50 gap-4">
                        <div className="flex items-center gap-4">
                            {/* Le gardien peut changer la date pour consulter mais pas corriger */}
                            <div className="flex items-center gap-2 bg-white border border-gray-300 rounded px-3 py-1.5">
                                <Calendar size={18} className="text-gray-500"/>
                                <input type="date" value={pointageDate} onChange={(e) => setPointageDate(e.target.value)} className="bg-transparent border-none font-bold text-gray-700 focus:ring-0 text-sm"/>
                            </div>
                            <button 
                                onClick={() => setIsScannerOpen(true)}
                                className="bg-brand-600 hover:bg-brand-700 text-white px-4 py-1.5 rounded font-bold text-sm flex items-center gap-2 shadow-lg"
                            >
                                <Camera size={16} /> Scanner Badge QR
                            </button>
                            {!isGardien && (
                                <button onClick={() => setIsReportModalOpen(true)} className="bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 px-4 py-1.5 rounded font-medium text-sm flex items-center gap-2"><PieChart size={16} /> Rapports</button>
                            )}
                        </div>
                        
                        <div className="flex items-center gap-2">
                            <input type="text" placeholder="ID Badge Manuel" className="p-1.5 text-sm border rounded w-32 font-mono" value={manualBadgeId} onChange={(e) => setManualBadgeId(e.target.value)} onKeyPress={(e) => e.key === 'Enter' && handleScanAttendance(manualBadgeId)}/>
                            <button onClick={() => handleScanAttendance(manualBadgeId)} className="bg-gray-200 hover:bg-gray-300 text-gray-700 px-3 py-1.5 rounded text-sm font-bold">Pointer</button>
                        </div>
                    </div>
                    <div className="overflow-x-auto flex-1">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-white text-gray-600 font-medium border-b border-gray-100"><tr><th className="py-3 px-4">Employé</th><th className="py-3 px-4 text-center">Statut</th><th className="py-3 px-4 text-center">Arrivée</th><th className="py-3 px-4 text-center">Départ</th><th className="py-3 px-4 text-center">Action</th></tr></thead>
                            <tbody className="divide-y divide-gray-100">
                                {employes.filter(e => e.actif !== false).map(emp => {
                                    const pt = dailyPointages.find(p => p.employeId === emp.id);
                                    return (
                                        <tr key={emp.id} className="hover:bg-gray-50">
                                            <td className="py-3 px-4 font-bold text-gray-800">{emp.nom} <span className="text-xs text-gray-400 font-normal">({emp.role})</span></td>
                                            <td className="py-3 px-4 text-center">{pt ? <span className={`px-2 py-1 rounded text-xs font-bold ${getPointageStatusColor(pt.statut)}`}>{pt.statut}</span> : <span className="text-gray-400 text-xs font-bold">ABSENT / NON POINTÉ</span>}</td>
                                            <td className="py-3 px-4 text-center font-mono">{pt?.heureArrivee || '-'}</td>
                                            <td className="py-3 px-4 text-center font-mono">{pt?.heureDepart || '-'}</td>
                                            <td className="py-3 px-4 text-center">
                                                {!pt ? (
                                                    <div className="flex justify-center gap-2">
                                                        <button onClick={() => handleClockIn(emp.id)} className="bg-green-600 text-white px-3 py-1 rounded text-xs hover:bg-green-700 font-bold shadow-sm">Arrivée</button>
                                                        {/* Le gardien peut marquer absent s'il voit que la personne n'est pas là */}
                                                        <button onClick={() => handleMarkAbsent(emp.id)} className="bg-red-100 text-red-600 px-3 py-1 rounded text-xs hover:bg-red-200 font-bold border border-red-200">Absent</button>
                                                    </div>
                                                ) : (
                                                    <div className="flex justify-center gap-2">
                                                        {pt.statut !== 'ABSENT' && !pt.heureDepart && (
                                                            <button onClick={() => handleClockOut(pt)} className="bg-blue-600 text-white px-3 py-1 rounded text-xs hover:bg-blue-700 font-bold shadow-sm">Départ</button>
                                                        )}
                                                        {/* MASQUER LE BOUTON MODIFIER POUR LE GARDIEN */}
                                                        {!isGardien && (
                                                            <button onClick={() => openCorrectionModal(emp, pt)} className="text-gray-400 hover:text-gray-600 bg-white border border-gray-300 rounded p-1"><Edit2 size={14}/></button>
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
            
            {/* ... (Modals conservés avec restrictions similaires à l'intérieur si nécessaire) */}
            {isScannerOpen && <QRScannerModal isOpen={isScannerOpen} onClose={() => setIsScannerOpen(false)} onScan={handleScanAttendance} />}
        </div>
    );
};

export default HRView;
