
import React, { useState, useMemo } from 'react';
import { Depense, Commande, Boutique, Fournisseur, CommandeFournisseur, Client, CompteFinancier, TransactionTresorerie, RoleEmploye } from '../types';
import { Wallet, TrendingUp, TrendingDown, Plus, Trash2, Search, Filter, PieChart, FileText, ArrowRightLeft, DollarSign, Calendar } from 'lucide-react';

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

    const handleSaveExpense = () => {
        if (!newExpense.montant || !newExpense.description || !newExpense.compteId) {
            alert("Veuillez remplir tous les champs obligatoires (Montant, Description, Compte).");
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
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                    <div className="flex justify-between items-center mb-4">
                        <span className="text-gray-500 font-bold text-xs uppercase">Trésorerie Totale</span>
                        <div className="p-2 bg-green-50 text-green-600 rounded-full"><Wallet size={20}/></div>
                    </div>
                    <p className="text-3xl font-bold text-gray-900">{comptes.reduce((acc, c) => acc + c.solde, 0).toLocaleString()} F</p>
                </div>
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                    <div className="flex justify-between items-center mb-4">
                        <span className="text-gray-500 font-bold text-xs uppercase">Dépenses (Mois)</span>
                        <div className="p-2 bg-red-50 text-red-600 rounded-full"><TrendingDown size={20}/></div>
                    </div>
                    <p className="text-3xl font-bold text-gray-900">{totalExpenses.toLocaleString()} F</p>
                </div>
                <div className="bg-brand-900 p-6 rounded-xl shadow-lg text-white flex flex-col justify-center">
                    <button onClick={() => setIsAddModalOpen(true)} className="flex items-center justify-center gap-2 bg-white/10 hover:bg-white/20 py-3 rounded-lg font-bold transition-colors">
                        <Plus size={20}/> Enregistrer une Dépense
                    </button>
                </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="p-4 border-b bg-gray-50">
                    <h3 className="font-bold text-gray-800">Historique des Dépenses</h3>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-white text-gray-600 font-medium border-b">
                            <tr>
                                <th className="py-3 px-4">Date</th>
                                <th className="py-3 px-4">Description</th>
                                <th className="py-3 px-4">Catégorie</th>
                                <th className="py-3 px-4 text-right">Montant</th>
                                <th className="py-3 px-4 text-center">Action</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y">
                            {depenses.map(d => (
                                <tr key={d.id} className="hover:bg-gray-50">
                                    <td className="py-3 px-4 text-gray-500">{new Date(d.date).toLocaleDateString()}</td>
                                    <td className="py-3 px-4 font-medium text-gray-800">{d.description}</td>
                                    <td className="py-3 px-4"><span className="px-2 py-0.5 bg-gray-100 rounded text-[10px] font-bold uppercase">{d.categorie}</span></td>
                                    <td className="py-3 px-4 text-right font-bold text-red-600">{d.montant.toLocaleString()} F</td>
                                    <td className="py-3 px-4 text-center">
                                        <button onClick={() => onDeleteDepense(d.id)} className="text-gray-400 hover:text-red-500"><Trash2 size={16}/></button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Modal Add Expense */}
            {isAddModalOpen && (
                <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6 animate-in zoom-in duration-200">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-xl font-bold">Nouvelle Sortie Caisse</h3>
                            <button onClick={() => setIsAddModalOpen(false)}><PieChart size={24} className="text-gray-300"/></button>
                        </div>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Montant (FCFA)</label>
                                <input 
                                    type="number" 
                                    className="w-full p-2 border border-gray-300 rounded font-bold"
                                    value={newExpense.montant || ''}
                                    onChange={e => setNewExpense({...newExpense, montant: parseInt(e.target.value) || 0})}
                                    placeholder="0"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Compte Source</label>
                                <select className="w-full p-2 border rounded" value={newExpense.compteId} onChange={e => setNewExpense({...newExpense, compteId: e.target.value})}>
                                    <option value="">-- Choisir Compte --</option>
                                    {comptes.map(c => <option key={c.id} value={c.id}>{c.nom} ({c.solde.toLocaleString()} F)</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Catégorie</label>
                                <select className="w-full p-2 border rounded" value={newExpense.categorie} onChange={e => setNewExpense({...newExpense, categorie: e.target.value as any})}>
                                    <option value="LOYER">Loyer</option>
                                    <option value="SALAIRE">Salaire / Acompte</option>
                                    <option value="MATIERE_PREMIERE">Achat Matière Première</option>
                                    <option value="ELECTRICITE">Electricité / Eau</option>
                                    <option value="LOGISTIQUE">Transport / Logistique</option>
                                    <option value="AUTRE">Autre</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                                <input type="text" className="w-full p-2 border rounded" value={newExpense.description} onChange={e => setNewExpense({...newExpense, description: e.target.value})} placeholder="Ex: Facture Senelec Octobre" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
                                <input type="date" className="w-full p-2 border rounded" value={newExpense.date} onChange={e => setNewExpense({...newExpense, date: e.target.value})} />
                            </div>
                        </div>
                        <div className="flex justify-end gap-3 mt-8">
                            <button onClick={() => setIsAddModalOpen(false)} className="px-4 py-2 text-gray-600 bg-gray-100 rounded font-medium">Annuler</button>
                            <button onClick={handleSaveExpense} className="px-6 py-2 bg-red-600 text-white rounded font-bold shadow-md hover:bg-red-700">Enregistrer Dépense</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default FinanceView;
