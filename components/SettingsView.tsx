
import React, { useRef, useState, useEffect } from 'react';
import { Download, Upload, RefreshCw, AlertTriangle, FileText, Database, CheckCircle, Save, Trash2, Wifi, WifiOff, Lock, Code, Image as ImageIcon, Users, Truck, ShoppingBag, Scissors, Briefcase, Clock, FileDown } from 'lucide-react';
import { doc, setDoc, getDoc } from "firebase/firestore";
import { db } from "../services/firebase";
import { CompanyAssets } from '../types';

interface SettingsViewProps {
    fullData: any; 
    onRestore: (data: any) => void;
    onImport: (type: 'CLIENTS' | 'ARTICLES' | 'EMPLOYES' | 'FOURNISSEURS' | 'DEPENSES' | 'POINTAGE', data: any[]) => void;
    onClearData?: () => void; 
    companyAssets?: CompanyAssets;
    onUpdateAssets?: (assets: CompanyAssets) => void;
}

const SettingsView: React.FC<SettingsViewProps> = ({ fullData, onRestore, onImport, onClearData, companyAssets, onUpdateAssets }) => {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const csvInputRef = useRef<HTMLInputElement>(null);
    
    const logoInputRef = useRef<HTMLInputElement>(null);
    const stampInputRef = useRef<HTMLInputElement>(null);
    const signatureInputRef = useRef<HTMLInputElement>(null);

    const [importType, setImportType] = useState<'CLIENTS' | 'ARTICLES' | 'EMPLOYES' | 'FOURNISSEURS' | 'DEPENSES' | 'POINTAGE'>('CLIENTS');
    const [statusMessage, setStatusMessage] = useState<{type: 'success'|'error', text: string} | null>(null);

    const handleBackup = () => {
        const dataStr = JSON.stringify(fullData, null, 2);
        const blob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const date = new Date().toISOString().split('T')[0];
        const link = document.createElement('a');
        link.href = url;
        link.download = `by_tchico_backup_complet_${date}.json`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        setStatusMessage({type: 'success', text: 'Sauvegarde complète JSON téléchargée.'});
    };

    const handleRestoreClick = () => fileInputRef.current?.click();

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const json = JSON.parse(event.target?.result as string);
                onRestore(json); 
            } catch (err) {
                setStatusMessage({type: 'error', text: 'Erreur JSON : Fichier corrompu ou invalide.'});
            }
        };
        reader.readAsText(file);
        e.target.value = '';
    };

    const handleCSVExport = () => {
        let headers: string[] = [];
        let rows: any[] = [];
        const date = new Date().toISOString().split('T')[0];
        let filename = `by_tchico_export_${importType.toLowerCase()}_${date}.csv`;

        if (importType === 'CLIENTS') {
            headers = ['Nom', 'Telephone', 'Email', 'Ville', 'Notes', 'Tour Cou', 'Epaule', 'Poitrine', 'Manche', 'Taille', 'Ceinture', 'Bassin', 'Cuisse', 'Long Boubou', 'Long Pantalon'];
            rows = (fullData.clients || []).map((c: any) => [
                c.nom, c.telephone, c.email || '', c.ville || '', c.notes || '',
                c.mesures?.tourCou || 0, c.mesures?.epaule || 0, c.mesures?.poitrine || 0,
                c.mesures?.longueurManche || 0, c.mesures?.taille || 0, c.mesures?.ceinture || 0,
                c.mesures?.tourFesse || 0, c.mesures?.tourCuisse || 0, c.mesures?.longueurBoubou || 0, c.mesures?.longueurPantalon || 0
            ]);
        } else if (importType === 'FOURNISSEURS') {
            headers = ['Entreprise', 'Contact', 'Telephone', 'Adresse', 'Categories', 'Notes'];
            rows = (fullData.fournisseurs || []).map((f: any) => [
                f.nomEntreprise, f.contactPersonne, f.telephone, f.adresse, (f.categories || []).join(', '), f.notes || ''
            ]);
        } else if (importType === 'ARTICLES') {
            headers = ['Nom', 'Categorie', 'Type', 'Prix Achat', 'Prix Vente', 'Unite', 'Variantes'];
            rows = (fullData.articles || []).map((a: any) => [
                a.nom, a.categorie, a.typeArticle, a.prixAchatDefault, a.prixVenteDefault, a.unite, (a.variantes || []).join('/')
            ]);
        } else if (importType === 'EMPLOYES') {
            headers = ['Nom', 'Role', 'Telephone', 'Email', 'Salaire Base', 'Contrat', 'Actif'];
            rows = (fullData.employes || []).map((e: any) => [
                e.nom, e.role, e.telephone, e.email || '', e.salaireBase, e.typeContrat, e.actif ? 'OUI' : 'NON'
            ]);
        } else if (importType === 'DEPENSES') {
            headers = ['Date', 'Montant', 'Categorie', 'Description'];
            rows = (fullData.depenses || []).map((d: any) => [
                new Date(d.date).toLocaleDateString(), d.montant, d.categorie, d.description
            ]);
        } else if (importType === 'POINTAGE') {
            headers = ['Date', 'Employe', 'Statut', 'Arrivee', 'Depart'];
            rows = (fullData.pointages || []).map((p: any) => {
                const emp = fullData.employes?.find((e: any) => e.id === p.employeId);
                return [p.date, emp?.nom || 'Inconnu', p.statut, p.heureArrivee || '', p.heureDepart || ''];
            });
        }

        // CSV Construction (Semicolon separator for French Excel)
        const csvContent = [
            headers.join(';'),
            ...rows.map(row => row.map((cell: any) => `"${(cell || '').toString().replace(/"/g, '""')}"`).join(';'))
        ].join('\n');

        const blob = new Blob(["\ufeff" + csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', filename);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        setStatusMessage({type: 'success', text: `Export ${importType} terminé.`});
    };

    const handleCSVImportClick = () => csvInputRef.current?.click();

    const handleCSVFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            const text = event.target?.result as string;
            const lines = text.split(/\r?\n/).filter(line => line.trim() !== '');
            if (lines.length < 2) {
                setStatusMessage({type: 'error', text: "Le fichier semble vide."});
                return;
            }

            const firstLine = lines[0];
            const commaCount = (firstLine.match(/,/g) || []).length;
            const semiCount = (firstLine.match(/;/g) || []).length;
            const delimiter = semiCount > commaCount ? ';' : ',';

            const headers = firstLine.split(delimiter).map(h => h.trim().replace(/"/g, '').toLowerCase());
            const resultData = [];

            for (let i = 1; i < lines.length; i++) {
                const values = lines[i].split(delimiter).map(v => v.trim().replace(/"/g, ''));
                if (values.length >= headers.length) {
                    const obj: any = {};
                    headers.forEach((header, index) => {
                        obj[header] = values[index];
                    });
                    resultData.push(obj);
                }
            }

            const p = (val: any) => {
                if (!val) return 0;
                const num = parseFloat(val.toString().replace(',', '.').replace(/[^\d.-]/g, ''));
                return isNaN(num) ? 0 : num;
            };

            const mappedData = resultData.map((row: any) => {
                const find = (keys: string[]) => {
                    for (const k of keys) {
                        const lowK = k.toLowerCase();
                        if (row[lowK] !== undefined) return row[lowK];
                    }
                    return undefined;
                };

                if (importType === 'CLIENTS') {
                    return {
                        id: `C_IMP_${Date.now()}_${Math.random()}`,
                        nom: find(['nom', 'name', 'client', 'full name']) || 'Inconnu',
                        telephone: find(['telephone', 'phone', 'tel', 'contact']) || '',
                        ville: find(['ville', 'city', 'adresse']) || '',
                        notes: find(['notes', 'note', 'observation']) || '',
                        mesures: {
                            tourCou: p(find(['cou', 'tour cou'])),
                            epaule: p(find(['epaule'])),
                            poitrine: p(find(['poitrine'])),
                            longueurManche: p(find(['manche', 'longueur manche'])),
                            taille: p(find(['taille'])),
                            ceinture: p(find(['ceinture'])),
                            tourFesse: p(find(['bassin', 'fesse'])),
                            tourCuisse: p(find(['cuisse'])),
                            longueurBoubou: p(find(['boubou', 'longueur boubou'])),
                            longueurPantalon: p(find(['pantalon', 'longueur pantalon']))
                        }
                    };
                } else if (importType === 'FOURNISSEURS') {
                    return {
                        id: `F_IMP_${Date.now()}_${Math.random()}`,
                        nomEntreprise: find(['entreprise', 'fournisseur', 'societe', 'nom']) || 'Fournisseur',
                        contactPersonne: find(['contact', 'responsable', 'nom contact']) || '',
                        telephone: find(['telephone', 'tel', 'phone']) || '',
                        adresse: find(['adresse', 'lieu']) || '',
                        categories: find(['categories', 'type']) ? find(['categories', 'type']).split(/[;|,]/) : [],
                        delaiLivraisonMoyen: p(find(['delai', 'livraison'])),
                        notes: find(['notes', 'description']) || ''
                    };
                } else if (importType === 'ARTICLES') {
                    return {
                        id: `A_IMP_${Date.now()}_${Math.random()}`,
                        nom: find(['nom', 'article', 'produit']) || 'Article',
                        categorie: find(['categorie', 'classe']) || 'Importé',
                        typeArticle: (find(['type']) || '').includes('FINI') ? 'PRODUIT_FINI' : 'MATIERE_PREMIERE',
                        prixAchatDefault: p(find(['achat', 'prix achat'])),
                        prixVenteDefault: p(find(['vente', 'prix vente'])),
                        unite: find(['unite']) || 'Pièce',
                        stockParLieu: { 'ATELIER': { 'Standard': p(find(['stock', 'quantite'])) } },
                        variantes: []
                    };
                } else if (importType === 'EMPLOYES') {
                    return {
                        id: `E_IMP_${Date.now()}_${Math.random()}`,
                        nom: find(['nom', 'employe', 'nom complet']) || 'Employé',
                        role: find(['role', 'poste']) || 'TAILLEUR',
                        telephone: find(['telephone', 'tel']) || '',
                        salaireBase: p(find(['salaire', 'base'])),
                        typeContrat: find(['contrat']) || 'CDI',
                        actif: true, historiquePaie: [], absences: []
                    };
                } else if (importType === 'DEPENSES') {
                    return {
                        id: `D_IMP_${Date.now()}_${Math.random()}`,
                        date: find(['date']) ? new Date(find(['date'])).toISOString() : new Date().toISOString(),
                        montant: p(find(['montant', 'somme'])),
                        categorie: find(['categorie']) || 'AUTRE',
                        description: find(['description', 'libelle']) || 'Dépense importée'
                    };
                }
                return null;
            }).filter(x => x !== null);

            if (mappedData.length > 0) {
                if (window.confirm(`Importer ${mappedData.length} lignes dans ${importType} ?`)) {
                    onImport(importType, mappedData);
                    setStatusMessage({type: 'success', text: `${mappedData.length} éléments importés.`});
                }
            } else {
                setStatusMessage({type: 'error', text: "Aucune donnée compatible trouvée."});
            }
        };
        reader.readAsText(file);
        e.target.value = '';
    };

    const handleAssetUpload = (e: React.ChangeEvent<HTMLInputElement>, type: 'logo' | 'stamp' | 'signature') => {
        const file = e.target.files?.[0];
        if (!file || !onUpdateAssets) return;
        const reader = new FileReader();
        reader.onloadend = () => {
            const base64 = reader.result as string;
            onUpdateAssets({ ...(companyAssets || {}), [`${type}Str`]: base64 });
        };
        reader.readAsDataURL(file);
    };

    return (
        <div className="max-w-4xl mx-auto space-y-8 pb-10">
            <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2"><Database className="text-brand-600" /> Paramètres & Gestion des Données</h2>

            {/* SECTION SAUVEGARDE COMPLÈTE */}
            <div className="bg-white rounded-xl shadow-sm border border-brand-200 overflow-hidden ring-4 ring-brand-50">
                <div className="bg-brand-900 text-white p-4">
                    <h3 className="font-bold flex items-center gap-2"><Save size={20} /> Sauvegarde Intégrale (JSON)</h3>
                    <p className="text-xs opacity-80 mt-1">Indispensable pour changer d'appareil ou réinstaller l'app sans rien perdre.</p>
                </div>
                <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
                    <button onClick={handleBackup} className="flex items-center justify-center gap-3 p-4 bg-green-600 text-white rounded-xl font-bold hover:bg-green-700 transition-all shadow-lg">
                        <Download size={24}/> TÉLÉCHARGER TOUT (.JSON)
                    </button>
                    <button onClick={handleRestoreClick} className="flex items-center justify-center gap-3 p-4 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-all shadow-lg">
                        <Upload size={24}/> RESTAURER TOUT (.JSON)
                    </button>
                    <input type="file" accept=".json" ref={fileInputRef} className="hidden" onChange={handleFileChange} />
                </div>
            </div>

            {/* SECTION EXPORT/IMPORT CSV */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="bg-gray-50 p-4 border-b">
                    <h3 className="font-bold text-gray-800 flex items-center gap-2"><FileText size={20} /> Listes Excel (CSV)</h3>
                    <p className="text-xs text-gray-500 mt-1">Pour travailler vos listes sur Excel ou importer des données existantes.</p>
                </div>
                <div className="p-6 space-y-6">
                    <div>
                        <label className="block text-[10px] font-black text-gray-400 uppercase mb-2 tracking-widest">1. Choisir la catégorie</label>
                        <select value={importType} onChange={(e) => setImportType(e.target.value as any)} className="w-full p-4 border-2 border-gray-100 rounded-xl font-bold bg-white focus:border-brand-500 outline-none transition-all">
                            <option value="CLIENTS">Clients (Répertoire & Mesures)</option>
                            <option value="FOURNISSEURS">Fournisseurs (Carnet d'adresses)</option>
                            <option value="ARTICLES">Catalogue Articles (Stock initial)</option>
                            <option value="EMPLOYES">Personnel (Liste employés)</option>
                            <option value="DEPENSES">Dépenses (Journal des frais)</option>
                            <option value="POINTAGE">Pointages (Historique présence)</option>
                        </select>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <button onClick={handleCSVExport} className="py-4 bg-white border-2 border-brand-900 text-brand-900 rounded-xl font-black uppercase text-xs tracking-widest hover:bg-brand-50 transition-all flex items-center justify-center gap-2">
                            <FileDown size={18} /> Exporter vers Excel
                        </button>
                        <button onClick={handleCSVImportClick} className="py-4 bg-brand-900 text-white rounded-xl font-black uppercase text-xs tracking-widest hover:bg-black shadow-lg transition-all flex items-center justify-center gap-2">
                            <Upload size={18} /> Importer depuis Excel
                        </button>
                        <input type="file" accept=".csv" ref={csvInputRef} className="hidden" onChange={handleCSVFileChange} />
                    </div>
                </div>
            </div>

            {statusMessage && (
                <div className={`p-4 rounded-xl flex items-center gap-3 animate-in fade-in duration-300 ${statusMessage.type === 'success' ? 'bg-green-100 text-green-800 border border-green-200' : 'bg-red-100 text-red-800 border border-red-200'}`}>
                    {statusMessage.type === 'success' ? <CheckCircle size={24}/> : <AlertTriangle size={24}/>}
                    <span className="font-bold">{statusMessage.text}</span>
                </div>
            )}

            {/* IDENTITÉ VISUELLE */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <h3 className="font-bold text-gray-800 flex items-center gap-2 mb-6"><ImageIcon size={20} className="text-brand-600"/> Identité Visuelle</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                    {['logo', 'stamp', 'signature'].map(type => (
                        <div key={type} className="flex flex-col items-center gap-4">
                            <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{type === 'logo' ? 'Logo Entreprise' : type === 'stamp' ? 'Cachet Officiel' : 'Signature Gérant'}</span>
                            <div className="w-32 h-32 bg-gray-50 border-2 border-dashed border-gray-200 rounded-2xl flex items-center justify-center overflow-hidden">
                                {(companyAssets as any)[`${type}Str`] ? <img src={(companyAssets as any)[`${type}Str`]} className="max-w-full max-h-full object-contain" /> : <ImageIcon size={32} className="text-gray-200"/>}
                            </div>
                            <button onClick={() => (type === 'logo' ? logoInputRef : type === 'stamp' ? stampInputRef : signatureInputRef).current?.click()} className="text-[10px] font-black uppercase text-brand-600 hover:underline">Changer l'image</button>
                            <input type="file" accept="image/*" className="hidden" ref={type === 'logo' ? logoInputRef : type === 'stamp' ? stampInputRef : signatureInputRef} onChange={(e) => handleAssetUpload(e, type as any)} />
                        </div>
                    ))}
                </div>
            </div>

            {onClearData && (
                <div className="bg-red-50 border border-red-100 rounded-xl p-6 flex items-center justify-between">
                    <div><h4 className="font-bold text-red-800">Zone de Danger</h4><p className="text-xs text-red-600">Supprimer définitivement TOUTES les données de l'application.</p></div>
                    <button onClick={onClearData} className="px-6 py-3 bg-white border border-red-200 text-red-600 hover:bg-red-600 hover:text-white rounded-xl font-bold transition-all shadow-sm flex items-center gap-2"><Trash2 size={18}/> Tout effacer</button>
                </div>
            )}
        </div>
    );
};

export default SettingsView;
