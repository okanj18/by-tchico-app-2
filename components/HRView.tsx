import React, { useState, useMemo } from 'react';
import { Employe, Boutique, Depense, Pointage, SessionUser, RoleEmploye, TransactionPaie, CompteFinancier, TransactionTresorerie } from '../types';
import { Users, Calendar, DollarSign, Plus, Edit2, Trash2, CheckCircle, XCircle, Search, Clock, Briefcase, Wallet, X, Bus, CheckSquare } from 'lucide-react';

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
    const [activeTab, setActiveTab] = useState<'EMPLOYEES' | 'ATTENDANCE'>('EMPLOYEES');
    const [searchTerm, setSearchTerm] = useState('');
    
    // Modal Employee
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [employeeFormData, setEmployeeFormData] = useState<Partial<Employe>>({
        nom: '', role: RoleEmploye.STAGIAIRE, telephone: '', salaireBase: 0, typeContrat: 'STAGE'
    });

    // Transport Bulk
    const [transportModalOpen, setTransportModalOpen] = useState(false);
    const [transportSelection, setTransportSelection] = useState<string[]>([]);
    const [transportAmount, setTransportAmount] = useState(2000);
    const [transportAccountId, setTransportAccountId] = useState('');

    const filteredEmployes = employes.filter(e => 
        e.actif !== false && (e.nom.toLowerCase().includes(searchTerm.toLowerCase()) || e.role.toLowerCase().includes(searchTerm.toLowerCase()))
    );

    const handleSaveEmployee = () => {
        if (!employeeFormData.nom || !employeeFormData.role) return;
        
        if (isEditing && employeeFormData.id) {
            onUpdateEmploye(employeeFormData as Employe);
        } else {
            onAddEmploye({
                id: `E${Date.now()}`,
                ...employeeFormData as Employe,
                historiquePaie: [],
                absences: [],
                actif: true
            });
        }
        setIsModalOpen(false);
    };

    const handleOpenEdit = (emp: Employe) => {
        setEmployeeFormData({ ...emp });
        setIsEditing(true);
        setIsModalOpen(true);
    };

    const handleOpenAdd = () => {
        setEmployeeFormData({
            nom: '', role: RoleEmploye.STAGIAIRE, telephone: '', salaireBase: 50000, typeContrat: 'STAGE', boutiqueId: 'ATELIER'
        });
        setIsEditing(false);
        setIsModalOpen(true);
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

        // Boucle sur les employés
        transportSelection.forEach(empId => {
            const emp = employes.find(e => e.id === empId);
            if (emp) {
                // 1. Enregistrer dans le dossier employé (Historique Paie)
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

                // 2. Créer la dépense (Ce qui déclenche automatiquement le débit du compte et la transaction dans App.tsx)
                onAddDepense({
                    id: `D_TRANS_${Date.now()}_${empId}`,
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
        alert(`Transport distribué à ${transportSelection.length} employés. Le montant total a été déduit de la caisse.`);
    };

    const toggleTransportSelection = (id: string) => {
        if (transportSelection.includes(id)) {
            setTransportSelection(transportSelection.filter(sid => sid !== id));
        } else {
            setTransportSelection([...transportSelection, id]);
        }
    };

    const selectAllTransport = () => {
        if (transportSelection.length === filteredEmployes.length) {
            setTransportSelection([]);
        } else {
            setTransportSelection(filteredEmployes.map(e => e.id));
        }
    };

    return (
        <div className="h-[calc(100vh-8rem)] flex flex-col space-y-6">
            <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                    <Briefcase className="text-brand-600" /> Ressources Humaines
                </h2>
                <div className="flex bg-gray-100 p-1 rounded-lg">
                    <button onClick={() => setActiveTab('EMPLOYEES')} className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === 'EMPLOYEES' ? 'bg-white text-brand-700 shadow-sm' : 'text-gray-500'}`}>Employés</button>
                    <button onClick={() => setActiveTab('ATTENDANCE')} className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === 'ATTENDANCE' ? 'bg-white text-brand-700 shadow-sm' : 'text-gray-500'}`}>Pointages</button>
                </div>
            </div>

            {/* TAB EMPLOYEES */}
            {activeTab === 'EMPLOYEES' && (
                <div className="flex-1 flex flex-col bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                    <div className="p-4 border-b border-gray-100 flex justify-between items-center gap-4">
                        <div className="relative flex-1 max-w-md">
                            <Search className="absolute left-3 top-2.5 text-gray-400" size={18}/>
                            <input 
                                type="text" 
                                placeholder="Rechercher employé..." 
                                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm"
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                            />
                        </div>
                        <div className="flex gap-2">
                            <button onClick={() => setTransportModalOpen(true)} className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 text-sm font-bold">
                                <Bus size={16} /> Transport
                            </button>
                            <button onClick={handleOpenAdd} className="bg-brand-600 hover:bg-brand-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 text-sm font-bold">
                                <Plus size={16} /> Ajouter
                            </button>
                        </div>
                    </div>

                    <div className="flex-1 overflow-y-auto">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-gray-50 text-gray-600 font-medium border-b border-gray-200">
                                <tr>
                                    <th className="py-3 px-4">Nom</th>
                                    <th className="py-3 px-4">Rôle</th>
                                    <th className="py-3 px-4">Contrat</th>
                                    <th className="py-3 px-4">Boutique</th>
                                    <th className="py-3 px-4 text-right">Salaire Base</th>
                                    <th className="py-3 px-4 text-center">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {filteredEmployes.map(emp => (
                                    <tr key={emp.id} className="hover:bg-gray-50">
                                        <td className="py-3 px-4 font-medium text-gray-800">{emp.nom}</td>
                                        <td className="py-3 px-4 text-gray-600">{emp.role}</td>
                                        <td className="py-3 px-4 text-gray-600">{emp.typeContrat}</td>
                                        <td className="py-3 px-4 text-gray-600">{boutiques.find(b => b.id === emp.boutiqueId)?.nom || '-'}</td>
                                        <td className="py-3 px-4 text-right font-bold">{emp.salaireBase.toLocaleString()} F</td>
                                        <td className="py-3 px-4 text-center">
                                            <div className="flex justify-center gap-2">
                                                <button onClick={() => handleOpenEdit(emp)} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded"><Edit2 size={16}/></button>
                                                <button onClick={() => { if(window.confirm('Supprimer ?')) onDeleteEmploye(emp.id); }} className="p-1.5 text-red-600 hover:bg-red-50 rounded"><Trash2 size={16}/></button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* TAB ATTENDANCE (Simplified for brevity) */}
            {activeTab === 'ATTENDANCE' && (
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 text-center text-gray-500">
                    <Clock size={48} className="mx-auto mb-4 opacity-20" />
                    <p>Module de pointage en cours de développement.</p>
                </div>
            )}

            {/* Modal Add/Edit Employee */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg p-6">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-xl font-bold">{isEditing ? 'Modifier Employé' : 'Nouvel Employé'}</h3>
                            <button onClick={() => setIsModalOpen(false)}><X size={24}/></button>
                        </div>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium mb-1">Nom</label>
                                <input type="text" className="w-full p-2 border rounded" value={employeeFormData.nom} onChange={e => setEmployeeFormData({...employeeFormData, nom: e.target.value})} />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium mb-1">Rôle</label>
                                    <select className="w-full p-2 border rounded" value={employeeFormData.role} onChange={e => setEmployeeFormData({...employeeFormData, role: e.target.value as any})}>
                                        {Object.values(RoleEmploye).map(r => <option key={r} value={r}>{r}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium mb-1">Contrat</label>
                                    <select className="w-full p-2 border rounded" value={employeeFormData.typeContrat} onChange={e => setEmployeeFormData({...employeeFormData, typeContrat: e.target.value})}>
                                        <option value="CDI">CDI</option><option value="CDD">CDD</option><option value="STAGE">Stage</option><option value="PRESTATAIRE">Prestataire</option>
                                    </select>
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-1">Salaire Base</label>
                                <input type="number" className="w-full p-2 border rounded" value={employeeFormData.salaireBase} onChange={e => setEmployeeFormData({...employeeFormData, salaireBase: parseInt(e.target.value) || 0})} />
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-1">Boutique Affectation</label>
                                <select className="w-full p-2 border rounded" value={employeeFormData.boutiqueId} onChange={e => setEmployeeFormData({...employeeFormData, boutiqueId: e.target.value})}>
                                    <option value="ATELIER">Atelier Central</option>
                                    {boutiques.map(b => <option key={b.id} value={b.id}>{b.nom}</option>)}
                                </select>
                            </div>
                        </div>
                        <div className="mt-6 flex justify-end gap-3">
                            <button onClick={() => setIsModalOpen(false)} className="px-4 py-2 border rounded hover:bg-gray-50">Annuler</button>
                            <button onClick={handleSaveEmployee} className="px-4 py-2 bg-brand-600 text-white rounded hover:bg-brand-700">Enregistrer</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal Bulk Transport */}
            {transportModalOpen && (
                <div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg p-6 flex flex-col max-h-[90vh]">
                        <div className="flex justify-between items-center mb-4 shrink-0">
                            <h3 className="text-xl font-bold flex items-center gap-2">
                                <Bus size={24} className="text-indigo-600"/> Transport Groupé
                            </h3>
                            <button onClick={() => setTransportModalOpen(false)}><X size={24}/></button>
                        </div>
                        
                        <div className="mb-4 shrink-0 space-y-3">
                            <div>
                                <label className="block text-sm font-medium mb-1">Montant par personne</label>
                                <input type="number" className="w-full p-2 border rounded font-bold" value={transportAmount} onChange={e => setTransportAmount(parseInt(e.target.value) || 0)} />
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-1">Compte Caisse (Source)</label>
                                <select className="w-full p-2 border rounded bg-indigo-50" value={transportAccountId} onChange={e => setTransportAccountId(e.target.value)}>
                                    <option value="">-- Choisir Caisse --</option>
                                    {comptes.map(c => <option key={c.id} value={c.id}>{c.nom} ({c.solde.toLocaleString()} F)</option>)}
                                </select>
                            </div>
                        </div>

                        <div className="flex items-center justify-between mb-2 shrink-0">
                            <span className="text-sm font-bold text-gray-700">Sélectionner Employés ({transportSelection.length})</span>
                            <button onClick={selectAllTransport} className="text-xs text-blue-600 hover:underline">Tout cocher/décocher</button>
                        </div>

                        <div className="flex-1 overflow-y-auto border rounded-lg p-2 space-y-1">
                            {filteredEmployes.map(emp => (
                                <div key={emp.id} className={`flex items-center justify-between p-2 rounded cursor-pointer ${transportSelection.includes(emp.id) ? 'bg-indigo-50 border border-indigo-200' : 'hover:bg-gray-50 border border-transparent'}`} onClick={() => toggleTransportSelection(emp.id)}>
                                    <span className="text-sm font-medium">{emp.nom}</span>
                                    {transportSelection.includes(emp.id) && <CheckCircle size={16} className="text-indigo-600"/>}
                                </div>
                            ))}
                        </div>

                        <div className="mt-4 pt-4 border-t shrink-0 flex justify-between items-center">
                            <div className="text-sm">
                                Total: <strong>{(transportAmount * transportSelection.length).toLocaleString()} F</strong>
                            </div>
                            <button onClick={handleBulkTransport} className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 font-bold disabled:opacity-50" disabled={transportSelection.length === 0}>
                                Valider Paiement
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default HRView;