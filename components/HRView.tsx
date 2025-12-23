
import React, { useState, useMemo, useEffect } from 'react';
import { Employe, Boutique, Depense, Pointage, SessionUser, RoleEmploye, TransactionPaie, CompteFinancier, TransactionTresorerie, Absence } from '../types';
import { Users, Calendar, DollarSign, Plus, Edit2, Trash2, CheckCircle, XCircle, Search, Clock, Briefcase, Wallet, X, Bus, CheckSquare, History, UserMinus, AlertTriangle, Printer, Lock, RotateCcw, Banknote, QrCode, Camera, Archive, Calculator, ChevronRight, FileText, PieChart, TrendingUp, AlertOctagon, CreditCard, Upload, Image as ImageIcon, Loader, Eye, ChevronLeft } from 'lucide-react';
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
        nom: '', role: RoleEmploye.STAGIAIRE, telephone: '', salaireBase: 0, typeContrat: 'STAGE', numeroCNI: '', cniRecto: '', cniVerso: ''
    });
    const [isUploading, setIsUploading] = useState(false);

    // Paiement et historique
    const [payModalOpen, setPayModalOpen] = useState(false);
    const [selectedEmployeeForPay, setSelectedEmployeeForPay] = useState<Employe | null>(null);
    const [payTab, setPayTab] = useState<'TRANSACTION' | 'SALAIRE'>('TRANSACTION');
    const [paymentAccountId, setPaymentAccountId] = useState<string>('');
    const [transactionData, setTransactionData] = useState({ date: new Date().toISOString().split('T')[0], type: 'ACOMPTE', montant: 0, note: '' });
    
    const [historyModalOpen, setHistoryModalOpen] = useState(false);
    const [selectedEmployeeForHistory, setSelectedEmployeeForHistory] = useState<Employe | null>(null);
    
    // Pointage
    const [pointageDate, setPointageDate] = useState(new Date().toISOString().split('T')[0]);
    const [isScannerOpen, setIsScannerOpen] = useState(false);
    const [manualBadgeId, setManualBadgeId] = useState('');
    const [correctionModalOpen, setCorrectionModalOpen] = useState(false);
    const [editingPointage, setEditingPointage] = useState<any>(null);

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

    // --- ACTIONS EMPLOYES ---
    const handleSaveEmployee = () => {
        if (!formData.nom || !formData.telephone) return;
        if (editingEmployee) {
            onUpdateEmploye({ ...editingEmployee, ...formData as Employe });
        } else {
            onAddEmploye({ id: `E${Date.now()}`, ...formData as Employe, historiquePaie: [], absences: [], actif: true });
        }
        setIsModalOpen(false);
        setEditingEmployee(null);
    };

    const openEditEmployee = (emp: Employe) => {
        setEditingEmployee(emp);
        setFormData({ ...emp });
        setIsModalOpen(true);
    };

    // --- ACTIONS PAIE ---
    const handleAddPayment = () => {
        if (!selectedEmployeeForPay || !paymentAccountId || transactionData.montant <= 0) return;
        const compte = comptes.find(c => c.id === paymentAccountId);
        if (compte && compte.solde < transactionData.montant) {
            if(!window.confirm("Solde insuffisant. Continuer quand même ?")) return;
        }

        const newTrans: TransactionPaie = {
            id: `TP_${Date.now()}`,
            date: transactionData.date,
            type: transactionData.type as any,
            montant: transactionData.montant,
            description: transactionData.note || transactionData.type
        };

        const updatedEmp = { ...selectedEmployeeForPay, historiquePaie: [...(selectedEmployeeForPay.historiquePaie || []), newTrans] };
        onUpdateEmploye(updatedEmp);

        // Sortie de caisse
        const t: TransactionTresorerie = {
            id: `TR_PAY_${Date.now()}`,
            date: transactionData.date,
            type: 'DECAISSEMENT',
            montant: transactionData.montant,
            compteId: paymentAccountId,
            description: `Paie ${selectedEmployeeForPay.nom}: ${transactionData.type}`,
            categorie: 'SALAIRE'
        };
        onAddTransaction(t);
        onUpdateComptes(comptes.map(c => c.id === paymentAccountId ? { ...c, solde: c.solde - transactionData.montant } : c));

        setPayModalOpen(false);
        setTransactionData({ date: new Date().toISOString().split('T')[0], type: 'ACOMPTE', montant: 0, note: '' });
    };

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

    // Fix: Added handleScanAttendance to process QR code scans for employee presence tracking
    const handleScanAttendance = (decodedText: string) => {
        const emp = employes.find(e => e.id === decodedText && e.actif !== false);
        if (!emp) {
            alert("Badge non reconnu ou employé inactif.");
            setIsScannerOpen(false);
            return;
        }

        const pt = dailyPointages.find(p => p.employeId === emp.id);
        if (!pt) {
            handleClockIn(emp.id);
            alert(`Bonjour ${emp.nom} ! Pointage ARRIVÉE enregistré.`);
        } else if (pt.statut !== 'ABSENT' && !pt.heureDepart) {
            handleClockOut(pt);
            alert(`Au revoir ${emp.nom} ! Pointage DÉPART enregistré.`);
        } else {
            alert(`Pointage déjà complet pour ${emp.nom} aujourd'hui.`);
        }
        setIsScannerOpen(false);
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
                </div>
            )}

            {/* --- VUE EMPLOYES (RESTAURÉE) --- */}
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
                            <thead className="bg-white text-gray-600 font-medium border-b border-gray-100"><tr><th className="py-3 px-4">Nom</th><th className="py-3 px-4">Rôle</th><th className="py-3 px-4">Téléphone</th><th className="py-3 px-4">Boutique</th><th className="py-3 px-4 text-right">Salaire Base</th><th className="py-3 px-4 text-center">Actions</th></tr></thead>
                            <tbody className="divide-y divide-gray-100">
                                {filteredEmployes.map(emp => (
                                    <tr key={emp.id} className="hover:bg-gray-50">
                                        <td className="py-3 px-4 font-bold text-gray-800 uppercase">{emp.nom}</td>
                                        <td className="py-3 px-4 text-xs font-bold text-brand-700">{emp.role}</td>
                                        <td className="py-3 px-4">{emp.telephone}</td>
                                        <td className="py-3 px-4 text-xs">{boutiques.find(b => b.id === emp.boutiqueId)?.nom || 'Atelier'}</td>
                                        <td className="py-3 px-4 text-right font-bold text-gray-900">{emp.salaireBase.toLocaleString()} F</td>
                                        <td className="py-3 px-4 text-center">
                                            <div className="flex justify-center gap-1">
                                                <button onClick={() => { setSelectedEmployeeForHistory(emp); setHistoryModalOpen(true); }} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded" title="Historique Paie"><History size={16}/></button>
                                                <button onClick={() => { setSelectedEmployeeForPay(emp); setPayModalOpen(true); }} className="p-1.5 text-green-600 hover:bg-green-50 rounded" title="Payer"><DollarSign size={16}/></button>
                                                <button onClick={() => openEditEmployee(emp)} className="p-1.5 text-gray-400 hover:text-brand-600 rounded" title="Modifier"><Edit2 size={16}/></button>
                                                <button onClick={() => onDeleteEmploye(emp.id)} className="p-1.5 text-red-400 hover:text-red-600 rounded" title={emp.actif ? "Archiver" : "Restaurer"}>{emp.actif ? <UserMinus size={16}/> : <RotateCcw size={16}/>}</button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* --- VUE POINTAGE (MAINTENUE) --- */}
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
                                                        <button onClick={() => handleClockIn(emp.id)} className="bg-green-600 text-white px-3 py-1 rounded text-xs hover:bg-green-700 font-bold">Arrivée</button>
                                                        <button onClick={() => handleMarkAbsent(emp.id)} className="bg-red-100 text-red-600 px-3 py-1 rounded text-xs border border-red-200">Absent</button>
                                                    </div>
                                                ) : (
                                                    <div className="flex justify-center gap-2">
                                                        {pt.statut !== 'ABSENT' && !pt.heureDepart && (
                                                            <button onClick={() => handleClockOut(pt)} className="bg-blue-600 text-white px-3 py-1 rounded text-xs hover:bg-blue-700 font-bold">Départ</button>
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

            {/* --- MODAL FORM EMPLOYE --- */}
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
                                <div><label className="block text-sm font-medium text-gray-700 mb-1">Affectation</label><select className="w-full p-2 border rounded" value={formData.boutiqueId} onChange={e => setFormData({...formData, boutiqueId: e.target.value})}><option value="ATELIER">Atelier Central</option>{boutiques.map(b => <option key={b.id} value={b.id}>{b.nom}</option>)}</select></div>
                            </div>
                        </div>
                        <div className="flex justify-end gap-3 mt-6"><button onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-gray-500">Annuler</button><button onClick={handleSaveEmployee} className="px-6 py-2 bg-brand-600 text-white rounded font-bold">Enregistrer</button></div>
                    </div>
                </div>
            )}

            {/* --- MODAL PAIEMENT PAIE --- */}
            {payModalOpen && selectedEmployeeForPay && (
                <div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm p-6">
                        <div className="flex justify-between items-center mb-4"><h3 className="font-bold flex items-center gap-2"><DollarSign className="text-green-600"/> Règlement {selectedEmployeeForPay.nom}</h3><button onClick={() => setPayModalOpen(false)}><X size={20}/></button></div>
                        <div className="space-y-4">
                            <div><label className="block text-xs font-bold text-gray-500 uppercase mb-1">Date</label><input type="date" className="w-full p-2 border rounded" value={transactionData.date} onChange={e => setTransactionData({...transactionData, date: e.target.value})} /></div>
                            <div><label className="block text-xs font-bold text-gray-500 uppercase mb-1">Type de Versement</label><select className="w-full p-2 border rounded" value={transactionData.type} onChange={e => setTransactionData({...transactionData, type: e.target.value})}><option value="ACOMPTE">Acompte</option><option value="SALAIRE_NET">Salaire Final (Net)</option><option value="PRIME">Prime</option></select></div>
                            <div><label className="block text-xs font-bold text-gray-500 uppercase mb-1">Montant (F)</label><input type="number" className="w-full p-3 border rounded text-xl font-bold bg-green-50" value={transactionData.montant} onChange={e => setTransactionData({...transactionData, montant: parseInt(e.target.value)||0})} /></div>
                            <div><label className="block text-xs font-bold text-gray-500 uppercase mb-1">Source (Compte)</label><select className="w-full p-2 border rounded" value={paymentAccountId} onChange={e => setPaymentAccountId(e.target.value)}><option value="">-- Choisir Caisse --</option>{comptes.map(c => <option key={c.id} value={c.id}>{c.nom} ({c.solde.toLocaleString()} F)</option>)}</select></div>
                        </div>
                        <div className="flex justify-end gap-3 mt-6"><button onClick={() => setPayModalOpen(false)} className="px-4 py-2 text-gray-400">Annuler</button><button onClick={handleAddPayment} disabled={!paymentAccountId} className="px-6 py-2 bg-green-600 text-white rounded font-bold shadow-lg disabled:opacity-50">Valider Paie</button></div>
                    </div>
                </div>
            )}

            {/* QR Scanner Modal */}
            {isScannerOpen && <QRScannerModal isOpen={isScannerOpen} onClose={() => setIsScannerOpen(false)} onScan={handleScanAttendance} />}
            
            {historyModalOpen && selectedEmployeeForHistory && (
                <div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6 flex flex-col max-h-[80vh]">
                        <div className="flex justify-between items-center mb-4 border-b pb-2"><h3 className="font-bold flex items-center gap-2"><History className="text-blue-600"/> Historique Paie : {selectedEmployeeForHistory.nom}</h3><button onClick={() => setHistoryModalOpen(false)}><X size={20}/></button></div>
                        <div className="flex-1 overflow-y-auto space-y-2">
                            {selectedEmployeeForHistory.historiquePaie?.length === 0 ? <p className="text-center text-gray-400 py-10">Aucun historique de paie.</p> : (
                                selectedEmployeeForHistory.historiquePaie?.map(h => (
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
        </div>
    );
};

export default HRView;
