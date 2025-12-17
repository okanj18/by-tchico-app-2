
import React, { useState, useMemo } from 'react';
import { Depense, Commande, Boutique, Fournisseur, CommandeFournisseur, Client, CompteFinancier, TransactionTresorerie, RoleEmploye } from '../types';
// Added History to the imports from lucide-react
import { Wallet, TrendingUp, TrendingDown, Plus, Trash2, Search, Filter, PieChart, FileText, ArrowRightLeft, DollarSign, Calendar, X, Save, History } from 'lucide-react';

interface FinanceViewProps {
    depenses: Depense[];
    commandes: Commande[];
    boutiques: Boutique[];
    onAddDepense: (d: Depense) => void;
    onDeleteDepense: (id: string) => void;
    onUpdateDepense: (d: Depense) => void;
    userRole: RoleEmploye;
    userBoutiqueId?: string;
    fournisseurs: Fournisseur[];
    commandesFournisseurs: CommandeFournisseur[];
    clients: Client[];
    comptes: CompteFinancier[];
    transactions: TransactionTresorerie[];
    onUpdateComptes: (c: CompteFinancier[]) => void;
    onAddTransaction: (t: TransactionTresorerie) => void;
    onUpdateTransaction: (t: TransactionTresorerie) => void;
    onDeleteTransaction: (id: string) => void;
}

const FinanceView: React.FC<FinanceViewProps> = ({ 
    depenses, onAddDepense, onDeleteDepense, comptes 
}) => {
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [newExpense, setNewExpense] = useState<Partial<Depense>>({
        montant: 0,
        description: '',
        categorie: 'AUTRE',
        date: new Date().toISOString().split('T')[0],
        compteId: ''
    });

    const totalExpenses = useMemo(() => depenses.reduce((acc, d) => acc + d.montant, 0), [depenses]);
    const totalCash = useMemo(() => comptes.reduce((acc, c) => acc + c.solde, 0), [comptes]);

    const handleSaveExpense = () => {
        if (!newExpense.montant || !newExpense.description || !newExpense.compteId) {
            alert("Veuillez remplir le montant, la description et choisir un compte.");
            return;
        }

        const expense: Depense = {
            id: `D_${Date.now()}`,
            date: newExpense.date || new Date().toISOString(),
            montant: newExpense.montant,
            categorie: (newExpense.categorie as any) || 'AUTRE',
            description: newExpense.description,
            compteId: newExpense.compteId
        };

        onAddDepense(expense);
        setIsAddModalOpen(false);
        setNewExpense({ montant: 0, description: '', categorie: 'AUTRE', date: new Date().toISOString().split('T')[0], compteId: '' });
    };

    return (
        <div className="flex flex-col space-y-6">
            {/* Stats financières */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col justify-between h-32 relative overflow-hidden group">
                    <div className="relative z-10">
                        <span className="text-gray-400 font-bold text-[10px] uppercase tracking-wider">Trésorerie Totale</span>
                        <p className="text-3xl font-black text-gray-900 mt-1">{totalCash.toLocaleString()} F</p>
                    </div>
                    <div className="p-2 bg-green-50 text-green-600 rounded-full absolute top-6 right-6 group-hover:scale-110 transition-transform"><Wallet size={24}/></div>
                </div>
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col justify-between h-32 relative overflow-hidden group">
                    <div className="relative z-10">
                        <span className="text-gray-400 font-bold text-[10px] uppercase tracking-wider">Sorties (Cumulées)</span>
                        <p className="text-3xl font-black text-red-600 mt-1">{totalExpenses.toLocaleString()} F</p>
                    </div>
                    <div className="p-2 bg-red-50 text-red-600 rounded-full absolute top-6 right-6 group-hover:scale-110 transition-transform"><TrendingDown size={24}/></div>
                </div>
                <div className="bg-brand-900 p-6 rounded-2xl shadow-lg text-white flex flex-col justify-center items-center text-center">
                    <p className="text-xs text-brand-200 mb-3 font-bold uppercase tracking-widest">Opérations Rapides</p>
                    <button 
                        onClick={() => setIsAddModalOpen(true)} 
                        className="w-full bg-white text-brand-900 py-3 rounded-xl font-black flex items-center justify-center gap-2 hover:bg-brand-50 transition-colors shadow-xl"
                    >
                        <Plus size={20}/> Nouvelle Dépense
                    </button>
                </div>
            </div>

            {/* Table des dépenses */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="p-4 border-b bg-gray-50/50 flex justify-between items-center">
                    <h3 className="font-bold text-gray-800 flex items-center gap-2"><History size={18}/> Historique des Flux</h3>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-white text-gray-500 font-bold uppercase text-[10px] border-b">
                            <tr>
                                <th className="py-4 px-6">Date</th>
                                <th className="py-4 px-6">Nature / Description</th>
                                <th className="py-4 px-6">Catégorie</th>
                                <th className="py-4 px-6 text-right">Montant</th>
                                <th className="py-4 px-6 text-center">Action</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y">
                            {depenses.sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map(d => (
                                <tr key={d.id} className="hover:bg-gray-50 transition-colors">
                                    <td className="py-4 px-6 text-gray-500 font-medium">{new Date(d.date).toLocaleDateString()}</td>
                                    <td className="py-4 px-6 font-bold text-gray-800">{d.description}</td>
                                    <td className="py-4 px-6">
                                        <span className="px-2 py-0.5 bg-gray-100 rounded text-[9px] font-black uppercase text-gray-600 border border-gray-200">
                                            {d.categorie}
                                        </span>
                                    </td>
                                    <td className="py-4 px-6 text-right font-black text-red-600 text-base">{d.montant.toLocaleString()} F</td>
                                    <td className="py-4 px-6 text-center">
                                        <button onClick={() => onDeleteDepense(d.id)} className="text-gray-300 hover:text-red-500 p-2 rounded-full hover:bg-red-50 transition-all"><Trash2 size={16}/></button>
                                    </td>
                                </tr>
                            ))}
                            {depenses.length === 0 && (
                                <tr><td colSpan={5} className="py-20 text-center text-gray-400 italic">Aucune dépense enregistrée.</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Modal de dépense */}
            {isAddModalOpen && (
                <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in duration-200">
                        <div className="bg-red-600 text-white p-4 flex justify-between items-center">
                            <h3 className="font-black flex items-center gap-2 uppercase tracking-tighter"><TrendingDown size={20}/> Nouvelle Sortie de Caisse</h3>
                            <button onClick={() => setIsAddModalOpen(false)} className="hover:bg-white/10 p-1 rounded"><X size={24}/></button>
                        </div>
                        
                        <div className="p-6 space-y-4">
                            <div>
                                <label className="block text-[10px] font-black text-gray-500 uppercase mb-1">Montant à décaisser (FCFA)</label>
                                <input 
                                    type="number" 
                                    className="w-full p-3 border border-red-200 bg-red-50 rounded-xl font-black text-2xl text-red-700 focus:ring-2 focus:ring-red-500 text-center"
                                    value={newExpense.montant || ''}
                                    onChange={e => setNewExpense({...newExpense, montant: parseInt(e.target.value) || 0})}
                                    placeholder="0"
                                />
                            </div>
                            <div>
                                <label className="block text-[10px] font-black text-gray-500 uppercase mb-1">Compte Source</label>
                                <select 
                                    className="w-full p-3 border border-gray-300 rounded-xl font-bold bg-white" 
                                    value={newExpense.compteId} 
                                    onChange={e => setNewExpense({...newExpense, compteId: e.target.value})}
                                >
                                    <option value="">-- Sélectionner le compte --</option>
                                    {comptes.map(c => <option key={c.id} value={c.id}>{c.nom} (Solde: {c.solde.toLocaleString()} F)</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="block text-[10px] font-black text-gray-500 uppercase mb-1">Catégorie de charge</label>
                                <select 
                                    className="w-full p-3 border border-gray-300 rounded-xl font-bold bg-white" 
                                    value={newExpense.categorie} 
                                    onChange={e => setNewExpense({...newExpense, categorie: e.target.value as any})}
                                >
                                    <option value="SALAIRE">Salaire / Acompte</option>
                                    <option value="MATIERE_PREMIERE">Achat Matière Première</option>
                                    <option value="LOYER">Loyer / Charges fixes</option>
                                    <option value="ELECTRICITE">Électricité / Eau / Internet</option>
                                    <option value="LOGISTIQUE">Transport / Logistique</option>
                                    <option value="FOIRE_EXPO">Foires / Expos</option>
                                    <option value="RESTAURATION">Restauration</option>
                                    <option value="AUTRE">Autre dépense</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-[10px] font-black text-gray-500 uppercase mb-1">Motif / Description</label>
                                <input 
                                    type="text" 
                                    className="w-full p-3 border border-gray-300 rounded-xl font-medium" 
                                    value={newExpense.description} 
                                    onChange={e => setNewExpense({...newExpense, description: e.target.value})} 
                                    placeholder="Ex: Achat tissu Bazin chez Sylla" 
                                />
                            </div>
                            <div>
                                <label className="block text-[10px] font-black text-gray-500 uppercase mb-1">Date d'opération</label>
                                <input 
                                    type="date" 
                                    className="w-full p-3 border border-gray-300 rounded-xl font-bold" 
                                    value={newExpense.date} 
                                    onChange={e => setNewExpense({...newExpense, date: e.target.value})} 
                                />
                            </div>
                        </div>

                        <div className="p-4 bg-gray-50 border-t flex gap-3">
                            <button onClick={() => setIsAddModalOpen(false)} className="flex-1 py-3 border rounded-xl font-black text-gray-600 hover:bg-gray-100">Annuler</button>
                            <button onClick={handleSaveExpense} className="flex-[2] py-3 bg-red-600 text-white rounded-xl font-black shadow-lg hover:bg-red-700 transition-all flex items-center justify-center gap-2">
                                <Save size={20}/> Valider Décaissement
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default FinanceView;
