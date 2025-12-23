
import React, { useState, useMemo } from 'react';
import { Employe, Boutique, Depense, Pointage, SessionUser, RoleEmploye, TransactionPaie, CompteFinancier, TransactionTresorerie } from '../types';
import { Users, DollarSign, Plus, Edit2, Trash2, Search, Clock, Briefcase, X, History, UserMinus, RotateCcw, QrCode, Camera, Printer, PieChart, TrendingUp, Filter, User } from 'lucide-react';
import { QRScannerModal } from './QRTools';
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

const HRView: React.FC<HRViewProps> = ({ 
    employes, boutiques, onAddEmploye, onUpdateEmploye, onDeleteEmploye, onArchiveEmploye,
    onAddDepense, depenses, onDeleteDepense, onUpdateDepense, 
    pointages, onAddPointage, onUpdatePointage, currentUser, 
    comptes, onUpdateComptes, onAddTransaction 
}) => {
    const isGardien = currentUser?.role === RoleEmploye.GARDIEN;
    const [activeTab, setActiveTab] = useState<'EMPLOYEES' | 'POINTAGE'>(isGardien ? 'POINTAGE' : 'EMPLOYEES');
    const [searchTerm, setSearchTerm] = useState('');
    const [showArchived, setShowArchived] = useState(false);
    
    // Config horaires
    const WORK_START_HOUR = 10;
    const TOLERANCE_MINUTES = 15;

    // --- STATES MODALS ---
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingEmployee, setEditingEmployee] = useState<Employe | null>(null);
    const [formData, setFormData] = useState<Partial<Employe>>({
        nom: '', role: RoleEmploye.STAGIAIRE, telephone: '', salaireBase: 0, typeContrat: 'STAGE'
    });

    // Paiement et historique
    const [payModalOpen, setPayModalOpen] = useState(false);
    const [selectedEmployeeForPay, setSelectedEmployeeForPay] = useState<Employe | null>(null);
    const [paymentAccountId, setPaymentAccountId] = useState<string>('');
    const [transactionData, setTransactionData] = useState({ date: new Date().toISOString().split('T')[0], type: 'ACOMPTE', montant: 0, note: '' });
    
    const [historyModalOpen, setHistoryModalOpen] = useState(false);
    const [selectedEmployeeForHistory, setSelectedEmployeeForHistory] = useState<Employe | null>(null);
    
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

    const dailyPointages = pointages.filter(p => p.date === pointageDate);

    // Stats
    const hrStats = useMemo(() => {
        if (isGardien) return null;
        const activeEmployees = employes.filter(e => e.actif !== false);
        const totalBaseSalary = activeEmployees.reduce((acc, e) => acc + (e.salaireBase || 0), 0);
        const today = new Date().toISOString().split('T')[0];
        const presentToday = pointages.filter(p => p.date === today && (p.statut === 'PRESENT' || p.statut === 'RETARD')).length;
        return { totalBaseSalary, presentToday, totalActive: activeEmployees.length };
    }, [employes, pointages, isGardien]);

    // --- ACTIONS POINTAGE ---
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
            <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2"><Briefcase className="text-brand-600" /> Ressources Humaines</h2>
                
                <div className="flex gap-2">
                    {!isGardien && (
                        <div className="flex bg-gray-100 p-1 rounded-lg">
                            <button onClick={() => setActiveTab('EMPLOYEES')} className={`px-3 py-1.5 text-xs font-bold rounded flex items-center gap-1 ${activeTab === 'EMPLOYEES' ? 'bg-white shadow text-brand-700' : 'text-gray-500'}`}><Users size={14} /> Employés</button>
                            <button onClick={() => setActiveTab('POINTAGE')} className={`px-3 py-1.5 text-xs font-bold rounded flex items-center gap-1 ${activeTab === 'POINTAGE' ? 'bg-white shadow text-brand-700' : 'text-gray-500'}`}><Clock size={14} /> Pointage</button>
                        </div>
                    )}
                    {activeTab === 'EMPLOYEES' && !isGardien && (
                        <button onClick={() => { setFormData({ role: RoleEmploye.STAGIAIRE, salaireBase: 0 }); setIsModalOpen(true); }} className="bg-brand-600 hover:bg-brand-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 font-medium text-sm"><Plus size={16} /> Nouveau</button>
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
                        <button onClick={() => setShowArchived(!showArchived)} className={`px-3 py-2 border rounded-lg text-xs font-bold ${showArchived ? 'bg-gray-800 text-white' : 'bg-white'}`}>{showArchived ? 'Voir Actifs' : 'Voir Archivés'}</button>
                    </div>
                    <div className="overflow-x-auto flex-1">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-white text-gray-600 font-medium border-b border-gray-100"><tr><th className="py-3 px-4">Nom</th><th className="py-3 px-4">Rôle</th><th className="py-3 px-4 text-right">Salaire</th><th className="py-3 px-4 text-center">Badge</th><th className="py-3 px-4 text-center">Actions</th></tr></thead>
                            <tbody className="divide-y divide-gray-100">
                                {filteredEmployes.map(emp => (
                                    <tr key={emp.id} className="hover:bg-gray-50">
                                        <td className="py-3 px-4 font-bold text-gray-800 uppercase">{emp.nom}</td>
                                        <td className="py-3 px-4 text-xs font-bold text-brand-700">{emp.role}</td>
                                        <td className="py-3 px-4 text-right font-bold">{emp.salaireBase.toLocaleString()} F</td>
                                        <td className="py-3 px-4 text-center">
                                            <button onClick={() => { setSelectedEmployeeForBadge(emp); setQrBadgeModalOpen(true); }} className="p-1.5 bg-gray-100 hover:bg-gray-200 rounded text-gray-600" title="Générer Badge"><QrCode size={16}/></button>
                                        </td>
                                        <td className="py-3 px-4 text-center">
                                            <div className="flex justify-center gap-1">
                                                <button onClick={() => { setSelectedEmployeeForHistory(emp); setHistoryModalOpen(true); }} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded" title="Historique Paie"><History size={16}/></button>
                                                <button onClick={() => { setSelectedEmployeeForPay(emp); setPayModalOpen(true); }} className="p-1.5 text-green-600 hover:bg-green-50 rounded" title="Payer"><DollarSign size={16}/></button>
                                                <button onClick={() => { setEditingEmployee(emp); setFormData(emp); setIsModalOpen(true); }} className="p-1.5 text-gray-400 hover:text-brand-600 rounded"><Edit2 size={16}/></button>
                                                <button onClick={() => onArchiveEmploye?.(emp.id)} className="p-1.5 text-gray-400 hover:text-orange-600 rounded" title={emp.actif ? "Archiver" : "Restaurer"}>{emp.actif ? <UserMinus size={16}/> : <RotateCcw size={16}/>}</button>
                                                <button onClick={() => onDeleteEmploye(emp.id)} className="p-1.5 text-red-300 hover:text-red-600 rounded" title="SUPPRIMER DÉFINITIVEMENT"><Trash2 size={16}/></button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
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
                    </div>
                    <div className="overflow-x-auto flex-1">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-white text-gray-600 font-medium border-b border-gray-100"><tr><th className="py-3 px-4">Employé</th><th className="py-3 px-4 text-center">Statut</th><th className="py-3 px-4 text-center">Arrivée</th><th className="py-3 px-4 text-center">Départ</th><th className="py-3 px-4 text-center">Action</th></tr></thead>
                            <tbody className="divide-y divide-gray-100">
                                {employes.filter(e => e.actif !== false).map(emp => {
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
                                                        <button onClick={() => handleMarkAbsent(emp.id)} className="bg-red-100 text-red-600 px-3 py-1 rounded text-xs hover:bg-red-200 border border-red-200">Absent</button>
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

            {/* --- MODAL RAPPORT POINTAGE (RESTAURÉ) --- */}
            {isReportModalOpen && (
                <div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl flex flex-col max-h-[90vh]">
                        <div className="p-4 border-b bg-gray-50 flex justify-between items-center rounded-t-xl shrink-0">
                            <h3 className="font-bold text-lg flex items-center gap-2"><PieChart className="text-brand-600"/> Registres de Présence</h3>
                            <button onClick={() => setIsReportModalOpen(false)}><X size={24}/></button>
                        </div>
                        
                        <div className="p-4 bg-white border-b flex flex-wrap gap-4 items-end shrink-0">
                            <div className="flex bg-gray-100 p-1 rounded-lg">
                                <button onClick={() => setReportType('GLOBAL')} className={`px-3 py-1 text-xs font-bold rounded ${reportType === 'GLOBAL' ? 'bg-white shadow' : 'text-gray-500'}`}>Vue Globale</button>
                                <button onClick={() => setReportType('INDIVIDUAL')} className={`px-3 py-1 text-xs font-bold rounded ${reportType === 'INDIVIDUAL' ? 'bg-white shadow' : 'text-gray-500'}`}>Vue Individuelle</button>
                            </div>
                            <div><label className="block text-[10px] font-bold text-gray-400 uppercase">Mois</label><input type="month" value={reportMonth} onChange={e => setReportMonth(e.target.value)} className="p-1.5 border rounded text-xs font-bold" /></div>
                            {reportType === 'INDIVIDUAL' && (
                                <div><label className="block text-[10px] font-bold text-gray-400 uppercase">Employé</label>
                                    <select value={reportEmployeeId} onChange={e => setReportEmployeeId(e.target.value)} className="p-1.5 border rounded text-xs font-bold">
                                        <option value="">-- Choisir --</option>
                                        {employes.map(e => <option key={e.id} value={e.id}>{e.nom}</option>)}
                                    </select>
                                </div>
                            )}
                            <button onClick={() => window.print()} className="ml-auto p-2 bg-gray-100 hover:bg-gray-200 rounded text-gray-700 flex items-center gap-1 text-xs font-bold"><Printer size={14}/> Imprimer</button>
                        </div>

                        <div className="flex-1 overflow-auto p-6" id="printable-report">
                            {reportType === 'GLOBAL' ? (
                                <table className="w-full text-xs text-left border-collapse">
                                    <thead className="bg-gray-100 sticky top-0">
                                        <tr><th className="p-2 border">Employé</th><th className="p-2 border text-center">Rôle</th><th className="p-2 border text-center">Présences</th><th className="p-2 border text-center">Retards</th><th className="p-2 border text-center">Absences</th></tr>
                                    </thead>
                                    <tbody>
                                        {employes.filter(e => e.actif !== false).map(emp => {
                                            const pts = pointages.filter(p => p.employeId === emp.id && p.date.startsWith(reportMonth));
                                            return (
                                                <tr key={emp.id} className="hover:bg-gray-50">
                                                    <td className="p-2 border font-bold uppercase">{emp.nom}</td>
                                                    <td className="p-2 border text-center text-gray-500 uppercase">{emp.role}</td>
                                                    <td className="p-2 border text-center text-green-600 font-bold">{pts.filter(p => p.statut === 'PRESENT').length}</td>
                                                    <td className="p-2 border text-center text-orange-600 font-bold">{pts.filter(p => p.statut === 'RETARD').length}</td>
                                                    <td className="p-2 border text-center text-red-600 font-bold">{pts.filter(p => p.statut === 'ABSENT').length}</td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            ) : (
                                <div>
                                    {!reportEmployeeId ? <p className="text-center text-gray-400 py-20 font-bold">Veuillez sélectionner un employé pour voir le détail.</p> : (
                                        <table className="w-full text-xs text-left border-collapse">
                                            <thead className="bg-gray-100 sticky top-0">
                                                <tr><th className="p-2 border">Date</th><th className="p-2 border">Statut</th><th className="p-2 border text-center">Arrivée</th><th className="p-2 border text-center">Départ</th></tr>
                                            </thead>
                                            <tbody>
                                                {pointages.filter(p => p.employeId === reportEmployeeId && p.date.startsWith(reportMonth)).sort((a,b) => b.date.localeCompare(a.date)).map(pt => (
                                                    <tr key={pt.id} className="hover:bg-gray-50">
                                                        <td className="p-2 border font-mono">{pt.date}</td>
                                                        <td className="p-2 border"><span className={`px-2 py-0.5 rounded text-[10px] font-bold ${getPointageStatusColor(pt.statut)}`}>{pt.statut}</span></td>
                                                        <td className="p-2 border text-center font-mono">{pt.heureArrivee || '-'}</td>
                                                        <td className="p-2 border text-center font-mono">{pt.heureDepart || '-'}</td>
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

            {/* --- MODAL BADGE QR (RESTAURÉ) --- */}
            {qrBadgeModalOpen && selectedEmployeeForBadge && (
                <div className="fixed inset-0 bg-black bg-opacity-70 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-sm w-full flex flex-col items-center animate-in zoom-in duration-200">
                        <div className="flex justify-between w-full mb-6">
                            <h3 className="font-bold text-gray-800">Badge d'identification</h3>
                            <button onClick={() => setQrBadgeModalOpen(false)}><X size={24} className="text-gray-400 hover:text-gray-600"/></button>
                        </div>
                        <div className="p-6 border-4 border-brand-100 rounded-2xl bg-white shadow-inner mb-6">
                            <QRCodeCanvas value={selectedEmployeeForBadge.id} size={200} level="H" />
                        </div>
                        <h4 className="text-2xl font-black text-gray-900 uppercase tracking-tight">{selectedEmployeeForBadge.nom}</h4>
                        <p className="text-brand-600 font-black text-sm uppercase tracking-widest mt-1">{selectedEmployeeForBadge.role}</p>
                        <p className="text-[10px] text-gray-300 mt-4 font-mono select-all">ID: {selectedEmployeeForBadge.id}</p>
                        <div className="w-full mt-8 flex flex-col gap-3">
                            <button onClick={() => window.print()} className="w-full py-4 bg-gray-900 text-white rounded-xl flex items-center justify-center gap-2 font-black uppercase text-xs tracking-widest hover:bg-black transition-all shadow-lg">
                                <Printer size={18}/> Imprimer le Badge
                            </button>
                            <p className="text-[9px] text-center text-gray-400 italic">Ce code permet de pointer l'arrivée et le départ via le scanneur.</p>
                        </div>
                    </div>
                </div>
            )}

            {isScannerOpen && <QRScannerModal isOpen={isScannerOpen} onClose={() => setIsScannerOpen(false)} onScan={handleScanAttendance} />}
            
            {/* Modal Historique Paie */}
            {historyModalOpen && selectedEmployeeForHistory && (
                <div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6 flex flex-col max-h-[80vh]">
                        <div className="flex justify-between items-center mb-4 border-b pb-2"><h3 className="font-bold flex items-center gap-2"><History className="text-blue-600"/> Historique Paie : {selectedEmployeeForHistory.nom}</h3><button onClick={() => setHistoryModalOpen(false)}><X size={20}/></button></div>
                        <div className="flex-1 overflow-y-auto space-y-2">
                            {!selectedEmployeeForHistory.historiquePaie || selectedEmployeeForHistory.historiquePaie.length === 0 ? <p className="text-center text-gray-400 py-10">Aucun historique de paie.</p> : (
                                selectedEmployeeForHistory.historiquePaie.map(h => (
                                    <div key={h.id} className="p-3 border rounded bg-gray-50 flex justify-between items-center shadow-sm">
                                        <div><p className="text-xs font-bold text-gray-500 uppercase">{h.type}</p><p className="text-xs text-gray-400">{new Date(h.date).toLocaleDateString()}</p></div>
                                        <p className="font-bold text-gray-900">{h.montant.toLocaleString()} F</p>
                                    </div>
                                ))
                            )}
                        </div>
                        <div className="mt-6 flex justify-end"><button onClick={() => setHistoryModalOpen(false)} className="px-6 py-2 bg-gray-800 text-white rounded font-bold">Fermer</button></div>
                    </div>
                </div>
            )}

            {/* Modal Paiement Paie */}
            {payModalOpen && selectedEmployeeForPay && (
                <div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm p-6">
                        <div className="flex justify-between items-center mb-4"><h3 className="font-bold flex items-center gap-2"><DollarSign className="text-green-600"/> Règlement {selectedEmployeeForPay.nom}</h3><button onClick={() => setPayModalOpen(false)}><X size={20}/></button></div>
                        <div className="space-y-4">
                            <div><label className="block text-xs font-bold text-gray-500 uppercase mb-1">Date</label><input type="date" className="w-full p-2 border rounded" value={transactionData.date} onChange={e => setTransactionData({...transactionData, date: e.target.value})} /></div>
                            <div><label className="block text-xs font-bold text-gray-500 uppercase mb-1">Type</label><select className="w-full p-2 border rounded" value={transactionData.type} onChange={e => setTransactionData({...transactionData, type: e.target.value})}><option value="ACOMPTE">Acompte</option><option value="SALAIRE_NET">Salaire Net</option><option value="PRIME">Prime</option></select></div>
                            <div><label className="block text-xs font-bold text-gray-500 uppercase mb-1">Montant (F)</label><input type="number" className="w-full p-3 border rounded text-xl font-bold bg-green-50" value={transactionData.montant} onChange={e => setTransactionData({...transactionData, montant: parseInt(e.target.value)||0})} /></div>
                            <div><label className="block text-xs font-bold text-gray-500 uppercase mb-1">Compte Source</label><select className="w-full p-2 border rounded" value={paymentAccountId} onChange={e => setPaymentAccountId(e.target.value)}><option value="">-- Choisir Caisse --</option>{comptes.map(c => <option key={c.id} value={c.id}>{c.nom} ({c.solde.toLocaleString()} F)</option>)}</select></div>
                        </div>
                        <div className="flex justify-end gap-3 mt-6"><button onClick={() => setPayModalOpen(false)} className="px-4 py-2 text-gray-400">Annuler</button><button onClick={() => {
                            if (!paymentAccountId || transactionData.montant <= 0) return;
                            const newTrans: TransactionPaie = { id: `TP_${Date.now()}`, date: transactionData.date, type: transactionData.type as any, montant: transactionData.montant, description: transactionData.type };
                            onUpdateEmploye({ ...selectedEmployeeForPay, historiquePaie: [...(selectedEmployeeForPay.historiquePaie || []), newTrans] });
                            onAddTransaction({ id: `TR_PAY_${Date.now()}`, date: transactionData.date, type: 'DECAISSEMENT', montant: transactionData.montant, compteId: paymentAccountId, description: `Paie ${selectedEmployeeForPay.nom}`, categorie: 'SALAIRE' });
                            onUpdateComptes(comptes.map(c => c.id === paymentAccountId ? { ...c, solde: c.solde - transactionData.montant } : c));
                            setPayModalOpen(false);
                        }} disabled={!paymentAccountId} className="px-6 py-2 bg-green-600 text-white rounded font-bold shadow-lg disabled:opacity-50">Valider Paie</button></div>
                    </div>
                </div>
            )}
            
            {/* Modal Formulaire Employé */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg p-6 animate-in zoom-in duration-200">
                        <div className="flex justify-between items-center mb-6"><h3 className="text-xl font-bold">{editingEmployee ? 'Modifier Employé' : 'Nouvel Employé'}</h3><button onClick={() => setIsModalOpen(false)}><X size={24}/></button></div>
                        <div className="space-y-4">
                            <div><label className="block text-sm font-medium mb-1">Nom Complet</label><input type="text" className="w-full p-2 border rounded" value={formData.nom} onChange={e => setFormData({...formData, nom: e.target.value.toUpperCase()})} /></div>
                            <div className="grid grid-cols-2 gap-4">
                                <div><label className="block text-sm font-medium mb-1">Rôle</label><select className="w-full p-2 border rounded" value={formData.role} onChange={e => setFormData({...formData, role: e.target.value as any})}><option value="TAILLEUR">Tailleur</option><option value="VENDEUR">Vendeur</option><option value="CHEF_ATELIER">Chef Atelier</option><option value="STAGIAIRE">Stagiaire</option><option value="LIVREUR">Livreur</option><option value="GARDIEN">Gardien</option><option value="GERANT">Gérant</option></select></div>
                                <div><label className="block text-sm font-medium mb-1">Téléphone</label><input type="text" className="w-full p-2 border rounded" value={formData.telephone} onChange={e => setFormData({...formData, telephone: e.target.value})} /></div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div><label className="block text-sm font-medium mb-1">Salaire de Base</label><input type="number" className="w-full p-2 border rounded font-bold" value={formData.salaireBase} onChange={e => setFormData({...formData, salaireBase: parseInt(e.target.value)||0})} /></div>
                                <div><label className="block text-sm font-medium mb-1">Type Contrat</label><select className="w-full p-2 border rounded" value={formData.typeContrat} onChange={e => setFormData({...formData, typeContrat: e.target.value})}><option value="CDI">CDI</option><option value="CDD">CDD</option><option value="STAGE">Stage</option><option value="PRESTATAIRE">Prestataire</option></select></div>
                            </div>
                        </div>
                        <div className="flex justify-end gap-3 mt-6"><button onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-gray-500">Annuler</button><button onClick={() => {
                            if (!formData.nom) return;
                            if (editingEmployee) onUpdateEmploye({ ...editingEmployee, ...formData as Employe });
                            else onAddEmploye({ id: `E${Date.now()}`, ...formData as Employe, historiquePaie: [], absences: [], actif: true });
                            setIsModalOpen(false);
                        }} className="px-6 py-2 bg-brand-600 text-white rounded font-bold">Enregistrer</button></div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default HRView;
