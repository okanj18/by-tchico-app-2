
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Employe, Boutique, Depense, Pointage, SessionUser, RoleEmploye, TransactionPaie, CompteFinancier, TransactionTresorerie, NiveauAcces, PermissionsUtilisateur } from '../types';
import { Users, DollarSign, Plus, Edit2, Trash2, Search, Clock, Briefcase, X, History, UserMinus, RotateCcw, QrCode, Camera, Printer, PieChart, TrendingUp, Filter, User, Cloud, ShieldCheck, Loader, Mail, Lock, Truck, CheckSquare, Square, Save, Image as ImageIcon, Upload, Shield, Eye, AlertTriangle } from 'lucide-react';
import { QRScannerModal, QRGeneratorModal } from './QRTools';

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
    onUpdateEmployes?: (updates: Employe[]) => void; // Optionnel pour les batch updates
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
    // --- GESTION DES DROITS ---
    const userRole = currentUser?.role;
    const rhPerm = currentUser?.permissions?.rh || 'NONE';
    
    // Accès complet si ADMIN, GERANT ou permission WRITE
    const canManageFullHR = userRole === 'ADMIN' || userRole === 'GERANT' || rhPerm === 'WRITE';
    // Accès restreint au pointage si permission READ
    const onlyPointage = rhPerm === 'READ' && !canManageFullHR;
    const isGardien = userRole === RoleEmploye.GARDIEN;

    const [activeTab, setActiveTab] = useState<'EMPLOYEES' | 'POINTAGE'>( (onlyPointage || isGardien) ? 'POINTAGE' : 'EMPLOYEES');
    const [searchTerm, setSearchTerm] = useState('');
    const [showArchived, setShowArchived] = useState(false);
    
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
        montantUnitaire: 1000, date: new Date().toISOString().split('T')[0], compteId: '', boutiqueId: 'ATELIER' 
    });
    const [selectedTransportEmpIds, setSelectedTransportEmpIds] = useState<string[]>([]);

    // CALCUL DYNAMIQUE DU TOTAL TRANSPORT (FIXED)
    const currentTransportTotal = useMemo(() => {
        return selectedTransportEmpIds.length * transportData.montantUnitaire;
    }, [selectedTransportEmpIds, transportData.montantUnitaire]);

    // Paiement et historique
    const [payModalOpen, setPayModalOpen] = useState(false);
    const [selectedEmployeeForPay, setSelectedEmployeeForPay] = useState<Employe | null>(null);
    const [paymentAccountId, setPaymentAccountId] = useState<string>('');
    const [transactionData, setTransactionData] = useState({ 
        date: new Date().toISOString().split('T')[0], type: 'ACOMPTE', montant: 0, note: '' 
    });
    
    const [historyModalOpen, setHistoryModalOpen] = useState(false);
    const [selectedEmployeeForHistory, setSelectedEmployeeForHistory] = useState<Employe | null>(null);

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

    const hrStats = useMemo(() => {
        const todayStr = new Date().toISOString().split('T')[0];
        const presentToday = pointages.filter(p => p.date === todayStr && (p.statut === 'PRESENT' || p.statut === 'RETARD')).length;
        const totalActive = activeEmployes.length;
        const totalBaseSalary = activeEmployes.reduce((acc, e) => acc + (e.salaireBase || 0), 0);
        return { presentToday, totalActive, totalBaseSalary };
    }, [activeEmployes, pointages]);

    // --- FONCTIONS DE CALCUL SALAIRE ET SECURITÉ ---
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

    const handleClockOut = (pt: Pointage) => {
        const now = new Date();
        const timeString = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
        onUpdatePointage({ ...pt, heureDepart: timeString });
    };

    const handleSaveTransport = () => {
        if (!transportData.compteId) {
            alert("Veuillez sélectionner une caisse.");
            return;
        }
        if (selectedTransportEmpIds.length === 0) {
            alert("Veuillez sélectionner au moins un artisan.");
            return;
        }

        const selectedEmps = activeEmployes.filter(e => selectedTransportEmpIds.includes(e.id));
        const depense: Depense = {
            id: `D_TR_${Date.now()}`, date: transportData.date, montant: currentTransportTotal, categorie: 'LOGISTIQUE',
            description: `Transport Groupe: ${selectedTransportEmpIds.length} pers. (${selectedEmps.map(e => e.nom).join(', ')})`,
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
        if (!formData.nom || !formData.telephone) {
            alert("Nom et téléphone requis.");
            return;
        }

        const employeeData = {
            ...formData,
            permissions: formData.permissions || { ...DEFAULT_PERMISSIONS }
        } as Employe;

        if (editingEmployee) {
            onUpdateEmploye(employeeData);
        } else {
            onAddEmploye({
                ...employeeData,
                id: `E${Date.now()}`,
                actif: true,
                historiquePaie: [],
                absences: []
            });
        }
        setIsModalOpen(false);
    };

    const togglePermission = (key: keyof PermissionsUtilisateur, level: NiveauAcces) => {
        setFormData(prev => ({
            ...prev,
            permissions: {
                ...(prev.permissions || { ...DEFAULT_PERMISSIONS }),
                [key]: level
            }
        }));
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
                    <div className="flex bg-gray-100 p-1 rounded-lg">
                        {!onlyPointage && (
                            <button onClick={() => setActiveTab('EMPLOYEES')} className={`px-4 py-2 text-xs font-bold rounded-lg flex items-center gap-2 ${activeTab === 'EMPLOYEES' ? 'bg-white shadow text-brand-700' : 'text-gray-500'}`}><Users size={16} /> Employés</button>
                        )}
                        <button onClick={() => setActiveTab('POINTAGE')} className={`px-4 py-2 text-xs font-bold rounded-lg flex items-center gap-2 ${activeTab === 'POINTAGE' ? 'bg-white shadow text-brand-700' : 'text-gray-500'}`}><Clock size={16} /> Pointage</button>
                    </div>
                    
                    {canManageFullHR && (
                        <>
                            <button onClick={() => { setSelectedTransportEmpIds([]); setTransportModalOpen(true); }} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 font-black uppercase text-[10px] tracking-widest shadow-md active:scale-95 transition-all"><Truck size={16} /> Transport Groupe</button>
                            <button onClick={() => { setFormData({ nom: '', role: RoleEmploye.STAGIAIRE, telephone: '', password: '', salaireBase: 0, email: '', cniRecto: '', cniVerso: '', permissions: {...DEFAULT_PERMISSIONS} }); setEditingEmployee(null); setModalSubTab('INFOS'); setIsModalOpen(true); }} className="bg-brand-600 hover:bg-brand-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 font-black uppercase text-[10px] tracking-widest shadow-md active:scale-95 transition-all"><Plus size={16} /> Nouveau</button>
                        </>
                    )}
                </div>
            </div>

            {hrStats && !onlyPointage && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="bg-white p-3 rounded-xl border border-gray-200 shadow-sm flex items-center justify-between"><div><p className="text-xs text-gray-500 uppercase font-bold">Effectif</p><p className="text-2xl font-bold text-gray-900">{hrStats.totalActive}</p></div><Users size={20} className="text-blue-500"/></div>
                    <div className="bg-white p-3 rounded-xl border border-gray-200 shadow-sm flex items-center justify-between"><div><p className="text-xs text-gray-500 uppercase font-bold">Masse Salariale</p><p className="text-2xl font-bold text-gray-900">{(hrStats.totalBaseSalary/1000).toFixed(0)}k F</p></div><TrendingUp size={20} className="text-green-500"/></div>
                </div>
            )}

            {/* --- VUE EMPLOYES --- */}
            {activeTab === 'EMPLOYEES' && !onlyPointage && (
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex-1 flex flex-col">
                    <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                        <div className="relative w-64">
                            <Search className="absolute left-3 top-2.5 text-gray-400" size={16} />
                            <input type="text" placeholder="Rechercher..." className="w-full pl-10 pr-4 py-2 border rounded-lg text-sm" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
                        </div>
                        <button onClick={() => setShowArchived(!showArchived)} className={`px-4 py-2 border rounded-lg text-xs font-bold transition-all ${showArchived ? 'bg-gray-800 text-white shadow-md' : 'bg-white hover:bg-gray-100'}`}>
                            {showArchived ? 'Voir les Archivés' : 'Voir les Actifs'}
                        </button>
                    </div>
                    <div className="overflow-x-auto flex-1">
                        <table className="w-full text-sm text-left min-w-[1000px]">
                            <thead className="bg-white text-gray-600 font-medium border-b border-gray-100">
                                <tr>
                                    <th className="py-4 px-6">Employé</th>
                                    <th className="py-4 px-4">Rôle</th>
                                    <th className="py-4 px-4 text-right">Salaire Base</th>
                                    <th className="py-4 px-4 text-right text-orange-600">Acomptes</th>
                                    <th className="py-4 px-4 text-right font-black">Reste à payer</th>
                                    <th className="py-4 px-6 text-center">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {filteredEmployes.map(emp => {
                                    const pay = getMonthlyPayStats(emp);
                                    const isArchived = emp.actif === false;
                                    return (
                                        <tr key={emp.id} className={`hover:bg-gray-50 transition-colors ${isArchived ? 'opacity-50 grayscale bg-gray-50' : ''}`}>
                                            <td className="py-4 px-6 font-bold text-gray-800 uppercase flex items-center gap-2">
                                                {emp.nom}
                                                {isArchived && <span className="text-[8px] bg-red-100 text-red-600 px-2 py-0.5 rounded font-black uppercase">Archivé</span>}
                                            </td>
                                            <td className="py-4 px-4 text-xs font-bold text-brand-700">{emp.role}</td>
                                            <td className="py-4 px-4 text-right font-medium">{emp.salaireBase.toLocaleString()} F</td>
                                            <td className="py-4 px-4 text-right text-orange-600 font-bold">{pay.acomptes.toLocaleString()} F</td>
                                            <td className={`py-4 px-4 text-right font-black ${pay.resteAPayer <= 0 ? 'text-green-600' : 'text-red-700'}`}>
                                                {pay.resteAPayer.toLocaleString()} F
                                            </td>
                                            <td className="py-4 px-6 text-center">
                                                <div className="flex justify-center gap-1">
                                                    <button onClick={() => { setSelectedEmployeeForBadge(emp); setQrBadgeModalOpen(true); }} className="p-2 bg-gray-100 hover:bg-gray-200 rounded-lg" title="Badge QR"><QrCode size={16}/></button>
                                                    <button onClick={() => { setSelectedEmployeeForHistory(emp); setHistoryModalOpen(true); }} className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg" title="Historique Paie"><History size={16}/></button>
                                                    {canManageFullHR && !isArchived && (
                                                        <button onClick={() => { setSelectedEmployeeForPay(emp); setPaymentAccountId(''); setTransactionData({ date: new Date().toISOString().split('T')[0], type: 'ACOMPTE', montant: 0, note: '' }); setPayModalOpen(true); }} className="p-2 text-green-600 hover:bg-green-50 rounded-lg" title="Payer"><DollarSign size={16}/></button>
                                                    )}
                                                    {canManageFullHR && (
                                                        <>
                                                            <button onClick={() => { setEditingEmployee(emp); setFormData({...emp, permissions: emp.permissions || {...DEFAULT_PERMISSIONS}}); setModalSubTab('INFOS'); setIsModalOpen(true); }} className="p-2 text-gray-400 hover:text-brand-600 rounded-lg" title="Modifier"><Edit2 size={16}/></button>
                                                            <button onClick={() => { if(window.confirm(`${isArchived ? 'Réactiver' : 'Archiver'} ${emp.nom} ?`)) onArchiveEmploye?.(emp.id) }} className={`p-2 rounded-lg transition-colors ${isArchived ? 'text-green-500 hover:bg-green-50' : 'text-orange-500 hover:bg-orange-50'}`} title={isArchived ? 'Réactiver' : 'Archiver'}>
                                                                {isArchived ? <RotateCcw size={16}/> : <UserMinus size={16}/>}
                                                            </button>
                                                            <button onClick={() => { if(window.confirm(`SUPPRESSION DÉFINITIVE DE ${emp.nom} ?`)) onDeleteEmploye(emp.id) }} className="p-2 text-red-300 hover:text-red-600 rounded-lg" title="Supprimer"><Trash2 size={16}/></button>
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

            {/* --- VUE POINTAGE --- */}
            {activeTab === 'POINTAGE' && (
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex-1 flex flex-col">
                    <div className="p-4 border-b border-gray-100 flex flex-wrap justify-between items-center bg-gray-50 gap-4">
                        <div className="flex items-center gap-4">
                            <input type="date" value={pointageDate} onChange={(e) => setPointageDate(e.target.value)} className="p-2 border rounded-lg text-sm font-bold shadow-sm" />
                            {canManageFullHR && <button onClick={() => setIsScannerOpen(true)} className="bg-brand-900 hover:bg-black text-white px-5 py-2 rounded-lg font-black uppercase text-[10px] tracking-widest flex items-center gap-2 shadow-lg"><Camera size={16} /> Scanner QR</button>}
                        </div>
                    </div>
                    <div className="overflow-x-auto flex-1">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-gray-50 text-gray-600 font-medium border-b"><tr><th className="py-4 px-6">Employé</th><th className="py-4 px-4 text-center">Statut</th><th className="py-4 px-4 text-center">Arrivée</th><th className="py-4 px-4 text-center">Départ</th><th className="py-4 px-6 text-center">Action</th></tr></thead>
                            <tbody className="divide-y divide-gray-100">
                                {activeEmployes.map(emp => {
                                    const pt = dailyPointages.find(p => p.employeId === emp.id);
                                    return (
                                        <tr key={emp.id} className="hover:bg-gray-50">
                                            <td className="py-4 px-6 font-bold uppercase">{emp.nom}</td>
                                            <td className="py-4 px-4 text-center">{pt ? <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase ${getPointageStatusColor(pt.statut)}`}>{pt.statut}</span> : <span className="text-gray-300 text-xs">NON POINTÉ</span>}</td>
                                            <td className="py-4 px-4 text-center font-mono font-bold text-gray-600">{pt?.heureArrivee || '--:--'}</td>
                                            <td className="py-4 px-4 text-center font-mono font-bold text-gray-600">{pt?.heureDepart || '--:--'}</td>
                                            <td className="py-4 px-6 text-center">
                                                {!pt ? (
                                                    <div className="flex justify-center gap-2">
                                                        <button onClick={() => handleClockIn(emp.id)} className="bg-green-600 text-white px-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest hover:bg-green-700 shadow-md">Arrivée</button>
                                                    </div>
                                                ) : (
                                                    <div className="flex justify-center gap-2">
                                                        {pt.statut !== 'ABSENT' && !pt.heureDepart && (
                                                            <button onClick={() => handleClockOut(pt)} className="bg-brand-600 text-white px-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest hover:bg-blue-700 shadow-md">Départ</button>
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

            {/* --- MODAL EMPLOYE (ADD/EDIT) AVEC DROITS --- */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-brand-900/80 z-[300] flex items-center justify-center p-4 backdrop-blur-sm">
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in duration-200">
                        <div className="p-6 bg-white border-b flex justify-between items-center">
                            <h3 className="text-xl font-black text-gray-800 uppercase tracking-tighter flex items-center gap-3">
                                <Edit2 className="text-brand-600" /> {editingEmployee ? 'Modifier Profil' : 'Nouvel Artisan'}
                            </h3>
                            <button onClick={() => setIsModalOpen(false)}><X size={28} className="text-gray-400" /></button>
                        </div>

                        <div className="bg-gray-50 p-2 flex justify-center border-b">
                            <div className="flex bg-white rounded-xl p-1 shadow-sm border">
                                <button onClick={() => setModalSubTab('INFOS')} className={`px-8 py-2 rounded-lg text-xs font-black uppercase tracking-widest transition-all ${modalSubTab === 'INFOS' ? 'bg-brand-900 text-white' : 'text-gray-400'}`}>Informations</button>
                                <button onClick={() => setModalSubTab('PERMISSIONS')} className={`px-8 py-2 rounded-lg text-xs font-black uppercase tracking-widest transition-all ${modalSubTab === 'PERMISSIONS' ? 'bg-brand-900 text-white' : 'text-gray-400'}`}>Accès & Droits</button>
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
                            ) : (
                                <div className="space-y-3">
                                    {(Object.keys(DEFAULT_PERMISSIONS) as Array<keyof PermissionsUtilisateur>).map((key) => (
                                        <div key={key} className="flex items-center justify-between p-4 bg-gray-50 rounded-2xl border border-gray-100">
                                            <span className="text-[10px] font-black text-gray-600 uppercase tracking-widest">{key === 'settings' ? 'PARAMÈTRES & EXPORT' : key}</span>
                                            <div className="flex bg-white rounded-lg p-1 border shadow-inner">
                                                {(['NONE', 'READ', 'WRITE'] as NiveauAcces[]).map((level) => (
                                                    <button 
                                                        key={level}
                                                        onClick={() => togglePermission(key, level)}
                                                        className={`px-3 py-1 rounded-md text-[9px] font-black transition-all ${formData.permissions?.[key] === level ? 'bg-brand-900 text-white shadow-md' : 'text-gray-300'}`}
                                                    >
                                                        {level}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        <div className="p-6 bg-gray-50 border-t flex justify-end gap-3">
                            <button onClick={() => setIsModalOpen(false)} className="px-6 py-3 text-gray-400 font-black uppercase text-xs tracking-widest">Annuler</button>
                            <button onClick={handleSaveEmployee} className="px-10 py-3 bg-brand-900 text-white rounded-xl font-black uppercase text-xs tracking-widest shadow-xl active:scale-95 transition-all">Enregistrer</button>
                        </div>
                    </div>
                </div>
            )}

            {/* --- MODAL TRANSPORT GROUPE --- */}
            {transportModalOpen && (
                <div className="fixed inset-0 bg-brand-900/80 z-[400] flex items-center justify-center p-4 backdrop-blur-sm">
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg p-8 animate-in zoom-in duration-200 flex flex-col max-h-[90vh]">
                        <div className="flex justify-between items-center mb-6 border-b pb-4 shrink-0">
                            <h3 className="font-black text-gray-800 flex items-center gap-3 uppercase text-lg tracking-tighter"><Truck size={24} className="text-blue-600"/> Transport Groupe</h3>
                            <button onClick={() => setTransportModalOpen(false)}><X size={24}/></button>
                        </div>
                        <div className="flex-1 overflow-y-auto space-y-6 pr-2 custom-scrollbar">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="bg-blue-50 p-5 rounded-2xl border-2 border-blue-100">
                                    <label className="block text-[10px] font-black text-blue-400 uppercase mb-2 ml-1 tracking-widest">Montant Unitaire (F)</label>
                                    <input type="number" className="w-full p-2 bg-transparent text-2xl font-black text-blue-900 outline-none" value={transportData.montantUnitaire} onChange={e => setTransportData({...transportData, montantUnitaire: parseInt(e.target.value)||0})} placeholder="1000" />
                                </div>
                                <div className="bg-brand-900 p-5 rounded-2xl shadow-xl flex flex-col justify-center">
                                    <label className="block text-[10px] font-black text-brand-300 uppercase mb-1 ml-1 tracking-widest">Montant Total (F)</label>
                                    <p className="text-3xl font-black text-white">{currentTransportTotal.toLocaleString()}</p>
                                </div>
                            </div>
                            <div className="bg-gray-50 p-5 rounded-2xl border border-gray-200">
                                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-4 ml-1">Sélectionner l'équipe ({selectedTransportEmpIds.length})</label>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                    {activeEmployes.map(emp => (
                                        <button key={emp.id} onClick={() => setSelectedTransportEmpIds(prev => prev.includes(emp.id) ? prev.filter(x => x !== emp.id) : [...prev, emp.id])} className={`flex items-center gap-3 p-4 rounded-xl border-2 transition-all ${selectedTransportEmpIds.includes(emp.id) ? 'bg-blue-600 border-blue-600 text-white shadow-lg scale-[1.02]' : 'bg-white border-gray-100 text-gray-600 hover:border-blue-200'}`}>
                                            {selectedTransportEmpIds.includes(emp.id) ? <CheckSquare size={20}/> : <Square size={20} className="text-gray-200"/>}
                                            <span className="text-xs font-black uppercase truncate">{emp.nom}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className={`p-4 rounded-2xl border-2 transition-all ${!transportData.compteId ? 'bg-red-50 border-red-200' : 'bg-white border-gray-100'}`}>
                                    <label className="block text-[10px] font-black text-gray-400 uppercase mb-2 ml-1 tracking-widest">Caisse Source</label>
                                    <select className="w-full bg-transparent font-bold text-sm outline-none" value={transportData.compteId} onChange={e => setTransportData({...transportData, compteId: e.target.value})}><option value="">-- Choisir --</option>{comptes.map(c => <option key={c.id} value={c.id}>{c.nom} ({c.solde.toLocaleString()} F)</option>)}</select>
                                </div>
                                <div className="p-4 bg-white rounded-2xl border-2 border-gray-100">
                                    <label className="block text-[10px] font-black text-gray-400 uppercase mb-2 ml-1 tracking-widest">Date</label>
                                    <input type="date" className="w-full bg-transparent font-bold text-sm outline-none" value={transportData.date} onChange={e => setTransportData({...transportData, date: e.target.value})} />
                                </div>
                            </div>
                        </div>
                        <div className="flex justify-end gap-3 mt-10 shrink-0 pt-4 border-t">
                            <button onClick={() => setTransportModalOpen(false)} className="px-8 py-4 text-gray-400 font-black uppercase text-[10px] tracking-widest hover:text-gray-600">Annuler</button>
                            <button 
                                onClick={handleSaveTransport} 
                                disabled={!transportData.compteId || currentTransportTotal <= 0} 
                                className={`px-12 py-4 rounded-2xl font-black uppercase text-[11px] tracking-widest shadow-2xl transition-all active:scale-95 ${(!transportData.compteId || currentTransportTotal <= 0) ? 'bg-gray-200 text-gray-400 cursor-not-allowed' : 'bg-blue-600 text-white hover:bg-blue-700 shadow-blue-200'}`}
                            >
                                Valider le Transport
                            </button>
                        </div>
                    </div>
                </div>
            )}
            
            {/* --- SCANNER & BADGE MODALS --- */}
            {isScannerOpen && <QRScannerModal isOpen={isScannerOpen} onClose={() => setIsScannerOpen(false)} onScan={(id) => {
                const emp = employes.find(e => e.id === id && e.actif !== false);
                if (emp) {
                    const pt = dailyPointages.find(p => p.employeId === emp.id);
                    if(!pt) handleClockIn(emp.id);
                    else handleClockOut(pt);
                    setIsScannerOpen(false);
                    alert(`Pointage validé pour ${emp.nom}`);
                } else alert("Badge invalide ou employé inactif.");
            }} />}

            {selectedEmployeeForBadge && (
                <QRGeneratorModal isOpen={qrBadgeModalOpen} onClose={() => setQrBadgeModalOpen(false)} value={selectedEmployeeForBadge.id} title={selectedEmployeeForBadge.nom} subtitle={selectedEmployeeForBadge.role} />
            )}

            {/* Modal Paiement Paie */}
            {payModalOpen && selectedEmployeeForPay && (
                <div className="fixed inset-0 bg-brand-900/80 z-[500] flex items-center justify-center p-4 backdrop-blur-sm">
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm p-8 animate-in zoom-in duration-200">
                        <div className="flex justify-between items-center mb-8 border-b pb-4"><h3 className="font-black text-gray-800 flex items-center gap-3 uppercase text-lg tracking-tighter"><DollarSign className="text-green-600" size={28}/> Règlement Salaire</h3><button onClick={() => setPayModalOpen(false)}><X size={28}/></button></div>
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
                            <div>
                                <label className="block text-[10px] font-black text-gray-400 mb-1 ml-1 uppercase">Caisse Source</label>
                                <select className="w-full p-3 border-2 border-gray-100 rounded-xl text-xs font-bold" value={paymentAccountId} onChange={e => setPaymentAccountId(e.target.value)}><option value="">-- Choisir Caisse --</option>{comptes.map(c => <option key={c.id} value={c.id}>{c.nom} ({c.solde.toLocaleString()} F)</option>)}</select>
                            </div>
                        </div>
                        <div className="flex justify-end gap-3 mt-10 pt-4 border-t">
                            <button onClick={() => setPayModalOpen(false)} className="px-6 py-4 text-gray-400 font-black uppercase text-[10px] tracking-widest">Annuler</button>
                            <button onClick={() => {
                                if(!paymentAccountId || transactionData.montant <= 0) return;
                                const entry: TransactionPaie = { id:`TP_${Date.now()}`, date: transactionData.date, type: transactionData.type as any, montant: transactionData.montant, description: transactionData.note || transactionData.type, createdBy: currentUser?.nom };
                                onUpdateEmploye({ ...selectedEmployeeForPay, historiquePaie: [entry, ...(selectedEmployeeForPay.historiquePaie || [])] });
                                onAddTransaction({ id:`TR_P_${Date.now()}`, date: transactionData.date, type: 'DECAISSEMENT', montant: transactionData.montant, compteId: paymentAccountId, description: `Paie ${selectedEmployeeForPay.nom} (${transactionData.type})`, categorie: 'SALAIRE' });
                                onUpdateComptes(comptes.map(c => c.id === paymentAccountId ? {...c, solde: c.solde - transactionData.montant} : c));
                                setPayModalOpen(false);
                                alert("Paiement validé !");
                            }} className="px-10 py-4 bg-green-600 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-xl active:scale-95 transition-all">Valider Paie</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Historique Modal */}
            {historyModalOpen && selectedEmployeeForHistory && (
                <div className="fixed inset-0 bg-brand-900/80 z-[500] flex items-center justify-center p-4 backdrop-blur-sm">
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg p-8 animate-in zoom-in duration-200 flex flex-col max-h-[90vh]">
                        <div className="flex justify-between items-center mb-6 border-b pb-4 shrink-0">
                            <h3 className="font-black text-gray-800 flex items-center gap-3 uppercase text-lg tracking-tighter"><History className="text-blue-600" /> Historique Paie : {selectedEmployeeForHistory.nom}</h3>
                            <button onClick={() => setHistoryModalOpen(false)}><X size={28}/></button>
                        </div>
                        <div className="flex-1 overflow-y-auto space-y-3 pr-2 custom-scrollbar">
                            {(selectedEmployeeForHistory.historiquePaie || []).length > 0 ? (
                                selectedEmployeeForHistory.historiquePaie?.map(h => (
                                    <div key={h.id} className="bg-gray-50 p-4 rounded-2xl border flex justify-between items-center">
                                        <div>
                                            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{new Date(h.date).toLocaleDateString()}</p>
                                            <p className="text-sm font-bold text-gray-800">{h.description}</p>
                                            <span className="text-[9px] font-black bg-white px-2 py-0.5 rounded border uppercase">{h.type}</span>
                                        </div>
                                        <p className="text-lg font-black text-gray-900">{h.montant.toLocaleString()} F</p>
                                    </div>
                                ))
                            ) : (
                                <p className="text-center text-gray-400 font-bold py-10 uppercase italic">Aucun historique de paiement</p>
                            )}
                        </div>
                        <div className="mt-6 pt-4 border-t flex justify-end shrink-0">
                            <button onClick={() => setHistoryModalOpen(false)} className="px-8 py-3 bg-gray-800 text-white rounded-xl font-black uppercase text-xs tracking-widest">Fermer</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default HRView;
