
import React, { useRef, useState, useEffect } from 'react';
import { Download, Upload, RefreshCw, AlertTriangle, FileText, Database, CheckCircle, Save, Trash2, Wifi, WifiOff, Lock, Code, Image as ImageIcon, Users, Truck, ShoppingBag, Scissors, Briefcase, Clock } from 'lucide-react';
import { doc, setDoc, getDoc } from "firebase/firestore";
import { db } from "../services/firebase";
import { CompanyAssets } from '../types';

interface SettingsViewProps {
    fullData: any; // L'objet contenant tout l'état de l'application
    onRestore: (data: any) => void;
    onImport: (type: 'CLIENTS' | 'ARTICLES', data: any[]) => void;
    onClearData?: () => void; // Nouvelle prop pour effacer les données
    companyAssets?: CompanyAssets;
    onUpdateAssets?: (assets: CompanyAssets) => void;
}

const SettingsView: React.FC<SettingsViewProps> = ({ fullData, onRestore, onImport, onClearData, companyAssets, onUpdateAssets }) => {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const csvInputRef = useRef<HTMLInputElement>(null);
    
    // Refs pour les inputs images
    const logoInputRef = useRef<HTMLInputElement>(null);
    const stampInputRef = useRef<HTMLInputElement>(null);
    const signatureInputRef = useRef<HTMLInputElement>(null);

    const [importType, setImportType] = useState<'CLIENTS' | 'ARTICLES'>('CLIENTS');
    const [statusMessage, setStatusMessage] = useState<{type: 'success'|'error', text: string} | null>(null);

    // --- DIAGNOSTIC CONNEXION ---
    const [connectionStatus, setConnectionStatus] = useState<'CHECKING' | 'OK' | 'PERMISSION_DENIED' | 'OFFLINE' | 'ERROR'>('CHECKING');
    const [diagnosticDetails, setDiagnosticDetails] = useState('');

    useEffect(() => {
        checkConnectivity();
    }, []);

    const checkConnectivity = async () => {
        if (!db) {
            setConnectionStatus('OFFLINE');
            return;
        }

        setConnectionStatus('CHECKING');
        try {
            // Test d'écriture simple pour vérifier les règles de sécurité
            // Utilise une collection de debug
            const testRef = doc(db, "_diagnostics", "connection_test_" + Date.now());
            await setDoc(testRef, { 
                lastCheck: new Date().toISOString(),
                platform: navigator.userAgent
            });
            setConnectionStatus('OK');
        } catch (error: any) {
            console.error("Diagnostic Error:", error);
            if (error.code === 'permission-denied') {
                setConnectionStatus('PERMISSION_DENIED');
            } else if (error.code === 'unavailable' || error.message.includes('offline')) {
                setConnectionStatus('OFFLINE');
            } else {
                setConnectionStatus('ERROR');
                setDiagnosticDetails(error.message);
            }
        }
    };

    const handleForceRefresh = () => {
        window.location.reload();
    };

    // --- ASSET UPLOAD LOGIC ---
    const handleAssetUpload = (e: React.ChangeEvent<HTMLInputElement>, type: 'logo' | 'stamp' | 'signature') => {
        const file = e.target.files?.[0];
        if (!file || !onUpdateAssets) return;

        const reader = new FileReader();
        reader.onloadend = () => {
            const base64 = reader.result as string;
            const newAssets = { ...(companyAssets || {}), [`${type}Str`]: base64 };
            onUpdateAssets(newAssets);
            setStatusMessage({type: 'success', text: `Image ${type} mise à jour avec succès !`});
        };
        reader.readAsDataURL(file);
    };

    const handleClearAsset = (type: 'logo' | 'stamp' | 'signature') => {
        if (!onUpdateAssets) return;
        if (window.confirm("Supprimer cette image personnalisée ?")) {
            const newAssets = { ...(companyAssets || {}), [`${type}Str`]: '' };
            onUpdateAssets(newAssets);
        }
    };

    // --- BACKUP LOGIC (JSON) ---
    const handleBackup = () => {
        const dataStr = JSON.stringify(fullData, null, 2);
        const blob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        
        const date = new Date().toISOString().split('T')[0];
        const link = document.createElement('a');
        link.href = url;
        link.download = `by_tchico_backup_${date}.json`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        setStatusMessage({type: 'success', text: 'Sauvegarde téléchargée avec succès.'});
    };

    // --- RESTORE LOGIC (JSON) ---
    const handleRestoreClick = () => {
        fileInputRef.current?.click();
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const json = JSON.parse(event.target?.result as string);
                // Le onRestore gère maintenant la confirmation dans App.tsx ou ici
                onRestore(json); 
            } catch (err) {
                console.error(err);
                setStatusMessage({type: 'error', text: 'Erreur lors de la lecture du fichier. Le format est invalide.'});
            }
        };
        reader.readAsText(file);
        // Reset input
        e.target.value = '';
    };

    // --- EXPORT CSV LOGIC ---
    const convertToCSV = (objArray: any[]) => {
        if (!objArray || objArray.length === 0) return '';
        // Flatten objects if needed inside map before calling convertToCSV
        
        // Collect all keys from all objects to ensure we have headers even if some objects miss keys
        let headers = new Set<string>();
        objArray.forEach((obj: any) => {
            Object.keys(obj).forEach(key => {
                if (typeof obj[key] !== 'object') headers.add(key); // Skip nested objects
            });
        });
        const headerArray = Array.from(headers);
        
        let str = headerArray.join(',') + '\r\n';

        for (let i = 0; i < objArray.length; i++) {
            let line = '';
            for (let index in headerArray) {
                if (line !== '') line += ',';
                let val = objArray[i][headerArray[index]];
                // Escape quotes and handle commas
                if (typeof val === 'string') {
                    val = `"${val.replace(/"/g, '""')}"`;
                }
                line += val !== undefined ? val : '';
            }
            str += line + '\r\n';
        }
        return str;
    };

    const handleExportCSV = (type: 'CLIENTS' | 'ARTICLES' | 'EMPLOYES' | 'FOURNISSEURS' | 'DEPENSES' | 'POINTAGE') => {
        let data: any[] = [];
        let filename = '';

        if (type === 'CLIENTS') {
            data = fullData.clients.map((c: any) => ({
                Nom: c.nom,
                Telephone: c.telephone,
                Ville: c.ville || '',
                Note: c.notes || '',
                // Mesures (Aplaties pour CSV)
                'Cou': c.mesures?.tourCou || '',
                'Epaule': c.mesures?.epaule || '',
                'Poitrine': c.mesures?.poitrine || '',
                'Manche': c.mesures?.longueurManche || '',
                'Taille': c.mesures?.taille || '',
                'Ceinture': c.mesures?.ceinture || '',
                'Bassin': c.mesures?.tourFesse || '',
                'Cuisse': c.mesures?.tourCuisse || '',
                'L_Boubou': c.mesures?.longueurBoubou1 || '',
                'L_Pantalon': c.mesures?.longueurPantalon || ''
            }));
            filename = 'clients_mesures_by_tchico.csv';
        } else if (type === 'ARTICLES') {
            data = fullData.articles.map((a: any) => ({
                Nom: a.nom,
                Categorie: a.categorie,
                Type: a.typeArticle,
                PrixAchat: a.prixAchatDefault,
                PrixVente: a.prixVenteDefault,
                Unite: a.unite,
                StockTotal: Object.values(a.stockParLieu).reduce((acc:any, v:any) => acc + Object.values(v).reduce((acc2:any, q:any)=>acc2+Number(q),0), 0)
            }));
            filename = 'articles_stock_by_tchico.csv';
        } else if (type === 'EMPLOYES') {
            data = fullData.employes.map((e: any) => ({
                Nom: e.nom,
                Role: e.role,
                Telephone: e.telephone,
                Email: e.email || '',
                Contrat: e.typeContrat,
                SalaireBase: e.salaireBase,
                Boutique: fullData.boutiques.find((b:any) => b.id === e.boutiqueId)?.nom || 'Atelier Central'
            }));
            filename = 'rh_employes_by_tchico.csv';
        } else if (type === 'FOURNISSEURS') {
            data = fullData.fournisseurs.map((f: any) => ({
                Entreprise: f.nomEntreprise,
                Contact: f.contactPersonne,
                Telephone: f.telephone,
                Adresse: f.adresse,
                Categories: f.categories ? f.categories.join('; ') : '',
                DelaiLivraison: f.delaiLivraisonMoyen,
                Notes: f.notes || ''
            }));
            filename = 'fournisseurs_by_tchico.csv';
        } else if (type === 'DEPENSES') {
            data = fullData.depenses.map((d: any) => ({
                Date: new Date(d.date).toLocaleDateString(),
                Montant: d.montant,
                Categorie: d.categorie,
                Description: d.description,
                Boutique: fullData.boutiques.find((b:any) => b.id === d.boutiqueId)?.nom || 'Siège/Général',
                Compte: fullData.comptes.find((c:any) => c.id === d.compteId)?.nom || ''
            }));
            filename = 'depenses_by_tchico.csv';
        } else if (type === 'POINTAGE') {
            data = fullData.pointages.map((p: any) => {
                const emp = fullData.employes.find((e:any) => e.id === p.employeId);
                return {
                    Date: new Date(p.date).toLocaleDateString(),
                    Employe: emp ? emp.nom : 'Inconnu',
                    Role: emp ? emp.role : '',
                    Statut: p.statut,
                    Arrivee: p.heureArrivee || '',
                    Depart: p.heureDepart || ''
                };
            });
            // Trier par date
            data.sort((a, b) => new Date(b.Date).getTime() - new Date(a.Date).getTime());
            filename = 'pointage_presence_by_tchico.csv';
        }

        const csvStr = convertToCSV(data);
        const blob = new Blob([csvStr], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        link.click();
        setStatusMessage({type: 'success', text: `Export ${type} généré avec succès.`});
    };

    // --- IMPORT CSV LOGIC (Simple) ---
    const handleCSVImportClick = () => {
        csvInputRef.current?.click();
    };

    const handleCSVFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            const text = event.target?.result as string;
            const rows = text.split('\n').filter(row => row.trim() !== '');
            const headers = rows[0].split(',').map(h => h.trim().replace(/"/g, ''));
            
            const resultData = [];
            for (let i = 1; i < rows.length; i++) {
                const values = rows[i].split(',').map(v => v.trim().replace(/"/g, ''));
                if (values.length === headers.length) {
                    const obj: any = {};
                    headers.forEach((header, index) => {
                        obj[header] = values[index];
                    });
                    resultData.push(obj);
                }
            }

            const mappedData = resultData.map((row: any) => {
                if (importType === 'CLIENTS') {
                    // Fonction utilitaire pour parser les nombres proprement
                    const p = (val: any) => {
                        if (!val) return 0;
                        const num = parseFloat(val.replace(',', '.').replace(/[^\d.-]/g, ''));
                        return isNaN(num) ? 0 : num;
                    };

                    return {
                        id: `C_IMP_${Date.now()}_${Math.random()}`,
                        nom: row.Nom || row.Name || row.nom || 'Client Inconnu',
                        telephone: row.Telephone || row.Phone || row.telephone || '',
                        ville: row.Ville || '',
                        notes: row.Note || '',
                        mesures: {
                            tourCou: p(row['Cou']),
                            epaule: p(row['Epaule']),
                            poitrine: p(row['Poitrine']),
                            longueurManche: p(row['Manche']),
                            taille: p(row['Taille']),
                            ceinture: p(row['Ceinture']),
                            tourFesse: p(row['Bassin']), // Mappage Bassin -> tourFesse
                            tourCuisse: p(row['Cuisse']),
                            longueurBoubou1: p(row['L_Boubou']),
                            longueurPantalon: p(row['L_Pantalon'])
                        }
                    };
                } else { // ARTICLES
                    return {
                        id: `A_IMP_${Date.now()}_${Math.random()}`,
                        nom: row.Nom || row.nom || 'Article Inconnu',
                        categorie: row.Categorie || 'Importé',
                        typeArticle: 'MATIERE_PREMIERE', 
                        prixAchatDefault: parseInt(row.PrixAchat || '0'),
                        prixVenteDefault: parseInt(row.PrixVente || '0'),
                        unite: 'Pièce',
                        stockParLieu: {},
                        variantes: []
                    };
                }
            });

            if (mappedData.length > 0) {
                if (window.confirm(`Vous êtes sur le point d'importer ${mappedData.length} éléments dans ${importType}. Confirmer ?`)) {
                    onImport(importType, mappedData);
                    setStatusMessage({type: 'success', text: `${mappedData.length} éléments importés avec succès.`});
                }
            } else {
                setStatusMessage({type: 'error', text: "Impossible de lire les données. Vérifiez le format CSV (séparateur virgule)."});
            }
        };
        reader.readAsText(file);
        e.target.value = '';
    };

    return (
        <div className="max-w-4xl mx-auto space-y-8 pb-10">
            <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                <Database className="text-brand-600" /> Paramètres & Données
            </h2>

            {/* --- SECTION EXPORT (PRIORITÉ HAUTE) --- */}
            <div className="bg-white rounded-xl shadow-sm border border-brand-200 overflow-hidden ring-4 ring-brand-50">
                <div className="bg-brand-50 p-4 border-b border-brand-200">
                    <h3 className="font-bold text-brand-900 flex items-center gap-2">
                        <FileText size={20} /> Exportation de Données (Excel/CSV)
                    </h3>
                    <p className="text-xs text-brand-700 mt-1">
                        Cliquez ci-dessous pour télécharger vos fichiers Excel/CSV.
                    </p>
                </div>
                <div className="p-6 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                    <button onClick={() => handleExportCSV('CLIENTS')} className="flex flex-col items-center justify-center p-4 border border-gray-200 rounded-lg hover:bg-blue-50 hover:border-blue-200 transition-colors group">
                        <Users className="text-blue-500 mb-2 group-hover:scale-110 transition-transform" size={24}/>
                        <span className="text-xs font-bold text-gray-700 text-center">Clients & Mesures</span>
                    </button>
                    
                    <button onClick={() => handleExportCSV('EMPLOYES')} className="flex flex-col items-center justify-center p-4 border border-gray-200 rounded-lg hover:bg-purple-50 hover:border-purple-200 transition-colors group">
                        <Briefcase className="text-purple-500 mb-2 group-hover:scale-110 transition-transform" size={24}/>
                        <span className="text-xs font-bold text-gray-700 text-center">Ressources Humaines</span>
                    </button>

                    <button onClick={() => handleExportCSV('POINTAGE')} className="flex flex-col items-center justify-center p-4 border border-gray-200 rounded-lg hover:bg-teal-50 hover:border-teal-200 transition-colors group">
                        <Clock className="text-teal-500 mb-2 group-hover:scale-110 transition-transform" size={24}/>
                        <span className="text-xs font-bold text-gray-700 text-center">Pointages</span>
                    </button>

                    <button onClick={() => handleExportCSV('FOURNISSEURS')} className="flex flex-col items-center justify-center p-4 border border-gray-200 rounded-lg hover:bg-orange-50 hover:border-orange-200 transition-colors group">
                        <Truck className="text-orange-500 mb-2 group-hover:scale-110 transition-transform" size={24}/>
                        <span className="text-xs font-bold text-gray-700 text-center">Fournisseurs</span>
                    </button>

                    <button onClick={() => handleExportCSV('ARTICLES')} className="flex flex-col items-center justify-center p-4 border border-gray-200 rounded-lg hover:bg-brand-50 hover:border-brand-200 transition-colors group">
                        <ShoppingBag className="text-brand-500 mb-2 group-hover:scale-110 transition-transform" size={24}/>
                        <span className="text-xs font-bold text-gray-700 text-center">Gestion Articles</span>
                    </button>

                    <button onClick={() => handleExportCSV('DEPENSES')} className="flex flex-col items-center justify-center p-4 border border-gray-200 rounded-lg hover:bg-red-50 hover:border-red-200 transition-colors group">
                        <FileText className="text-red-500 mb-2 group-hover:scale-110 transition-transform" size={24}/>
                        <span className="text-xs font-bold text-gray-700 text-center">Dépenses</span>
                    </button>
                </div>
            </div>

            {/* --- SECTION IMPORT CSV --- */}
            <div className="bg-white rounded-xl shadow-sm border border-blue-200 overflow-hidden mt-6">
                <div className="bg-blue-50 p-4 border-b border-blue-100">
                    <h3 className="font-bold text-blue-900 flex items-center gap-2">
                        <Upload size={20} /> Importation de Données (CSV)
                    </h3>
                    <p className="text-xs text-blue-700 mt-1">
                        Restaurez vos clients ou articles à partir d'un fichier CSV précédemment exporté.
                    </p>
                </div>
                <div className="p-6">
                    <div className="flex gap-4 items-end">
                        <div className="flex-1">
                            <label className="block text-sm font-medium text-gray-700 mb-1">Type de données à importer</label>
                            <select 
                                value={importType} 
                                onChange={(e) => setImportType(e.target.value as any)}
                                className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                            >
                                <option value="CLIENTS">Clients & Mesures</option>
                                <option value="ARTICLES">Articles & Stocks</option>
                            </select>
                        </div>
                        <div className="flex-1">
                            <input type="file" accept=".csv" ref={csvInputRef} className="hidden" onChange={handleCSVFileChange} />
                            <button 
                                onClick={handleCSVImportClick}
                                className="w-full px-4 py-2 bg-blue-600 text-white rounded font-bold hover:bg-blue-700 flex items-center justify-center gap-2"
                            >
                                <Upload size={18} /> Choisir Fichier CSV & Importer
                            </button>
                        </div>
                    </div>
                    <div className="mt-2 text-xs text-gray-500">
                        <strong>Note :</strong> Pour les clients, les mesures (Cou, Epaule, Poitrine, etc.) seront automatiquement récupérées si les colonnes existent dans le CSV.
                    </div>
                </div>
            </div>

            {/* --- DIAGNOSTIC PANEL --- */}
            <div className={`rounded-xl shadow-sm border p-4 ${
                connectionStatus === 'OK' ? 'bg-green-50 border-green-200' : 
                connectionStatus === 'PERMISSION_DENIED' ? 'bg-red-50 border-red-200' : 'bg-gray-50 border-gray-200'
            }`}>
                <div className="flex items-start gap-3">
                    <div className={`p-2 rounded-full ${
                        connectionStatus === 'OK' ? 'bg-green-100 text-green-600' :
                        connectionStatus === 'PERMISSION_DENIED' ? 'bg-red-100 text-red-600' : 'bg-gray-200 text-gray-600'
                    }`}>
                        {connectionStatus === 'OK' ? <Wifi size={24}/> : 
                         connectionStatus === 'PERMISSION_DENIED' ? <Lock size={24}/> : 
                         <WifiOff size={24}/>}
                    </div>
                    <div className="flex-1">
                        <h3 className={`font-bold text-lg ${
                            connectionStatus === 'OK' ? 'text-green-800' :
                            connectionStatus === 'PERMISSION_DENIED' ? 'text-red-800' : 'text-gray-800'
                        }`}>
                            État de la Connexion Cloud
                        </h3>
                        <p className="text-sm mt-1 mb-2">
                            {connectionStatus === 'CHECKING' && "Vérification de la connexion..."}
                            {connectionStatus === 'OK' && "Tout fonctionne parfaitement ! Vos données sont synchronisées en temps réel."}
                            {connectionStatus === 'OFFLINE' && "Mode Hors Ligne. Les variables d'environnement Firebase manquent ou internet est coupé."}
                            {connectionStatus === 'PERMISSION_DENIED' && "Erreur de Permissions ! La base de données refuse l'accès."}
                            {connectionStatus === 'ERROR' && `Erreur inattendue : ${diagnosticDetails}`}
                        </p>

                        <div className="mt-2">
                            <button onClick={handleForceRefresh} className="text-xs text-blue-600 hover:underline flex items-center gap-1">
                                <RefreshCw size={12}/> Rafraîchir l'application (peut corriger les bugs de sync)
                            </button>
                        </div>

                        {connectionStatus === 'PERMISSION_DENIED' && (
                            <div className="mt-4 bg-white border border-red-200 rounded-lg p-3">
                                <p className="text-xs text-red-700 font-bold mb-2 flex items-center gap-1"><AlertTriangle size={12}/> ACTION REQUISE SUR LA CONSOLE FIREBASE</p>
                                <p className="text-xs text-gray-600 mb-2">
                                    Allez dans <strong>Firestore Database &gt; Règles</strong>, effacez tout et collez ceci :
                                </p>
                                <div className="bg-gray-900 text-green-400 p-3 rounded font-mono text-xs overflow-x-auto relative group">
                                    <pre>{`rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if true;
    }
  }
}`}</pre>
                                </div>
                                <div className="mt-2 text-right">
                                    <button onClick={checkConnectivity} className="text-xs bg-red-100 text-red-700 px-3 py-1 rounded hover:bg-red-200 font-bold">
                                        Réessayer la connexion
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {statusMessage && (
                <div className={`p-4 rounded-lg flex items-center gap-2 ${statusMessage.type === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                    {statusMessage.type === 'success' ? <CheckCircle size={20}/> : <AlertTriangle size={20}/>}
                    {statusMessage.text}
                </div>
            )}

            {/* SECTION 0: IDENTITÉ VISUELLE */}
            {onUpdateAssets && companyAssets && (
                <div className="bg-white rounded-xl shadow-sm border border-brand-200 overflow-hidden">
                    <div className="bg-brand-50 p-4 border-b border-brand-100">
                        <h3 className="font-bold text-brand-900 flex items-center gap-2">
                            <ImageIcon size={20} /> Identité Visuelle (Impression)
                        </h3>
                        <p className="text-xs text-brand-700 mt-1">
                            Personnalisez les factures avec vos propres images.
                        </p>
                    </div>
                    <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-6">
                        {/* LOGO */}
                        <div className="border border-gray-200 rounded-lg p-4 flex flex-col items-center text-center">
                            <h4 className="font-bold text-gray-800 mb-2">Logo</h4>
                            <div className="w-32 h-32 bg-gray-50 border border-gray-200 flex items-center justify-center mb-4 rounded overflow-hidden">
                                {companyAssets.logoStr ? (
                                    <img src={companyAssets.logoStr} alt="Logo" className="max-w-full max-h-full object-contain" />
                                ) : (
                                    <span className="text-xs text-gray-400">Aucun logo</span>
                                )}
                            </div>
                            <input type="file" accept="image/*" className="hidden" ref={logoInputRef} onChange={(e) => handleAssetUpload(e, 'logo')} />
                            <div className="flex gap-2 w-full">
                                <button onClick={() => logoInputRef.current?.click()} className="flex-1 bg-gray-100 hover:bg-gray-200 py-2 rounded text-xs font-bold">Changer</button>
                                {companyAssets.logoStr && <button onClick={() => handleClearAsset('logo')} className="bg-red-100 hover:bg-red-200 p-2 rounded text-red-600"><Trash2 size={14}/></button>}
                            </div>
                        </div>

                        {/* CACHET */}
                        <div className="border border-gray-200 rounded-lg p-4 flex flex-col items-center text-center">
                            <h4 className="font-bold text-gray-800 mb-2">Cachet</h4>
                            <div className="w-32 h-32 bg-gray-50 border border-gray-200 flex items-center justify-center mb-4 rounded overflow-hidden">
                                {companyAssets.stampStr ? (
                                    <img src={companyAssets.stampStr} alt="Cachet" className="max-w-full max-h-full object-contain" />
                                ) : (
                                    <span className="text-xs text-gray-400">Aucun cachet</span>
                                )}
                            </div>
                            <input type="file" accept="image/*" className="hidden" ref={stampInputRef} onChange={(e) => handleAssetUpload(e, 'stamp')} />
                            <div className="flex gap-2 w-full">
                                <button onClick={() => stampInputRef.current?.click()} className="flex-1 bg-gray-100 hover:bg-gray-200 py-2 rounded text-xs font-bold">Changer</button>
                                {companyAssets.stampStr && <button onClick={() => handleClearAsset('stamp')} className="bg-red-100 hover:bg-red-200 p-2 rounded text-red-600"><Trash2 size={14}/></button>}
                            </div>
                        </div>

                        {/* SIGNATURE */}
                        <div className="border border-gray-200 rounded-lg p-4 flex flex-col items-center text-center">
                            <h4 className="font-bold text-gray-800 mb-2">Signature</h4>
                            <div className="w-32 h-32 bg-gray-50 border border-gray-200 flex items-center justify-center mb-4 rounded overflow-hidden">
                                {companyAssets.signatureStr ? (
                                    <img src={companyAssets.signatureStr} alt="Signature" className="max-w-full max-h-full object-contain" />
                                ) : (
                                    <span className="text-xs text-gray-400">Aucune signature</span>
                                )}
                            </div>
                            <input type="file" accept="image/*" className="hidden" ref={signatureInputRef} onChange={(e) => handleAssetUpload(e, 'signature')} />
                            <div className="flex gap-2 w-full">
                                <button onClick={() => signatureInputRef.current?.click()} className="flex-1 bg-gray-100 hover:bg-gray-200 py-2 rounded text-xs font-bold">Changer</button>
                                {companyAssets.signatureStr && <button onClick={() => handleClearAsset('signature')} className="bg-red-100 hover:bg-red-200 p-2 rounded text-red-600"><Trash2 size={14}/></button>}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* SECTION 1: SYSTEM BACKUP */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="bg-gray-50 p-4 border-b border-gray-200">
                    <h3 className="font-bold text-gray-800 flex items-center gap-2">
                        <Save size={20} /> Sauvegarde & Restauration Système (JSON)
                    </h3>
                    <p className="text-xs text-gray-500 mt-1">
                        Utilisez cette section pour une sauvegarde complète technique (fichier JSON non lisible sur Excel).
                    </p>
                </div>
                <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="border border-gray-200 rounded-lg p-4 flex flex-col items-center text-center hover:bg-gray-50 transition-colors">
                        <Download size={32} className="text-green-600 mb-3" />
                        <h4 className="font-bold text-gray-800 mb-2">Sauvegarder les données</h4>
                        <p className="text-xs text-gray-500 mb-4">Télécharger un fichier .json contenant toutes vos commandes, clients, stocks, etc.</p>
                        <button onClick={handleBackup} className="px-4 py-2 bg-green-600 text-white rounded-lg font-bold hover:bg-green-700 transition-colors w-full">
                            Télécharger Sauvegarde
                        </button>
                    </div>

                    <div className="border border-gray-200 rounded-lg p-4 flex flex-col items-center text-center hover:bg-gray-50 transition-colors">
                        <Upload size={32} className="text-blue-600 mb-3" />
                        <h4 className="font-bold text-gray-800 mb-2">Restaurer une sauvegarde</h4>
                        <p className="text-xs text-gray-500 mb-4">Recharger un fichier .json précédent. <strong className="text-red-500">Écrase les données actuelles.</strong></p>
                        <input type="file" accept=".json" ref={fileInputRef} className="hidden" onChange={handleFileChange} />
                        <button onClick={handleRestoreClick} className="px-4 py-2 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 transition-colors w-full">
                            Choisir Fichier & Restaurer
                        </button>
                    </div>
                </div>
            </div>

            {/* SECTION 4: DANGER ZONE */}
            {onClearData && (
                <div className="bg-white rounded-xl shadow-sm border border-red-200 overflow-hidden">
                    <div className="bg-red-50 p-4 border-b border-red-100">
                        <h3 className="font-bold text-red-900 flex items-center gap-2">
                            <AlertTriangle size={20} /> Zone de Danger
                        </h3>
                    </div>
                    <div className="p-6 flex items-center justify-between">
                        <div>
                            <h4 className="font-bold text-gray-800">Effacer toutes les données</h4>
                            <p className="text-xs text-gray-500 mt-1">Supprime toutes les données de démonstration pour commencer à zéro (Clients, Articles, etc.).</p>
                        </div>
                        <button onClick={onClearData} className="px-4 py-2 bg-white border border-red-300 text-red-600 hover:bg-red-50 rounded-lg font-bold flex items-center gap-2">
                            <Trash2 size={16} /> Tout Effacer
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default SettingsView;
