import React, { useState } from 'react';
import { SessionUser, RoleEmploye } from '../types';
import { Lock, Mail, ArrowRight, AlertCircle, Loader, CheckCircle, XCircle, HelpCircle } from 'lucide-react';
import { COMPANY_CONFIG } from '../config';
import { getAuth, signInWithEmailAndPassword } from "firebase/auth";
import app from '../services/firebase'; // Assure l'init

interface LoginViewProps {
    employes: any[]; // On ne l'utilise plus vraiment pour le login direct
    onLogin: (user: SessionUser) => void;
}

const LoginView: React.FC<LoginViewProps> = ({ onLogin }) => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [showHelp, setShowHelp] = useState(false);

    // Helper pour vérifier les variables (avec ou sans FIREBASE_)
    const getEnvCheck = (key: string) => {
        const env = (import.meta as any).env || {};
        const shortKey = key.replace('_FIREBASE_', '_');
        return !!(env[key] || env[shortKey]);
    };

    // Vérification de la présence des clés pour le diagnostic
    const envCheck = {
        apiKey: getEnvCheck('VITE_FIREBASE_API_KEY'),
        authDomain: getEnvCheck('VITE_FIREBASE_AUTH_DOMAIN'),
        projectId: getEnvCheck('VITE_FIREBASE_PROJECT_ID'),
    };

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        // --- MODE DÉMO (SI FIREBASE MANQUANT) ---
        if (!app) {
            console.log("Firebase not init, using demo login");
            setTimeout(() => {
                let role = RoleEmploye.STAGIAIRE;
                let nom = "Utilisateur Démo";
                let boutiqueId = undefined;

                // Logique de rôle simulée basée sur l'email
                if (email.includes('admin')) { role = RoleEmploye.ADMIN; nom = "Administrateur"; }
                else if (email.includes('gerant')) { role = RoleEmploye.GERANT; nom = "Gérant"; }
                else if (email.includes('atelier')) { role = RoleEmploye.CHEF_ATELIER; nom = "Chef Atelier"; boutiqueId = 'ATELIER'; }
                else if (email.includes('vendeur')) { role = RoleEmploye.VENDEUR; nom = "Vendeur Boutique"; boutiqueId = 'B1'; }
                else if (email.includes('tailleur')) { role = RoleEmploye.TAILLEUR; nom = "Tailleur"; }
                else if (email.includes('gardien')) { role = RoleEmploye.GARDIEN; nom = "Sécurité"; }

                onLogin({
                    id: "demo_user_" + Date.now(),
                    nom: nom,
                    role: role,
                    boutiqueId: boutiqueId
                });
                setLoading(false);
            }, 800);
            return;
        }

        // --- MODE FIREBASE AUTH ---
        const auth = getAuth(app);

        try {
            const userCredential = await signInWithEmailAndPassword(auth, email, password);
            const user = userCredential.user;

            let role = RoleEmploye.STAGIAIRE;
            let nom = "Utilisateur";
            let boutiqueId = undefined;

            if (email.includes('admin')) { role = RoleEmploye.ADMIN; nom = "Administrateur"; }
            else if (email.includes('gerant')) { role = RoleEmploye.GERANT; nom = "Gérant"; }
            else if (email.includes('atelier')) { role = RoleEmploye.CHEF_ATELIER; nom = "Chef Atelier"; boutiqueId = 'ATELIER'; }
            else if (email.includes('vendeur')) { role = RoleEmploye.VENDEUR; nom = "Vendeur Boutique"; boutiqueId = 'B1'; }
            else if (email.includes('tailleur')) { role = RoleEmploye.TAILLEUR; nom = "Tailleur"; }
            else if (email.includes('gardien')) { role = RoleEmploye.GARDIEN; nom = "Sécurité"; }

            onLogin({
                id: user.uid,
                nom: user.displayName || nom,
                role: role,
                boutiqueId: boutiqueId
            });

        } catch (err: any) {
            console.error(err);
            if (err.code === 'auth/invalid-credential') {
                setError("Email ou mot de passe incorrect.");
            } else if (err.code === 'auth/too-many-requests') {
                setError("Trop de tentatives. Veuillez patienter.");
            } else {
                setError("Erreur de connexion. Vérifiez votre internet ou la configuration.");
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-brand-900 to-gray-900 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-300">
                <div className="p-8 bg-brand-600 text-white text-center">
                    <div className="w-20 h-20 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-4 backdrop-blur-sm">
                        <Lock size={40} className="text-white" />
                    </div>
                    <h1 className="text-2xl font-bold tracking-wider">{COMPANY_CONFIG.name}</h1>
                    <p className="text-brand-100 opacity-80 text-sm mt-1">
                        {app ? "Accès Sécurisé Cloud" : "Mode Démo / Hors Ligne"}
                    </p>
                </div>
                
                <form onSubmit={handleLogin} className="p-8 space-y-5">
                    {!app && (
                        <div className="bg-orange-50 border-l-4 border-orange-500 p-4 text-orange-800 text-xs space-y-2">
                            <div className="flex items-center gap-2 font-bold text-sm">
                                <AlertCircle size={16} /> 
                                <span>Configuration Cloud incomplète</span>
                            </div>
                            <p>Les données ne sont pas synchronisées. Vérifiez vos variables dans Vercel :</p>
                            
                            <div className="mt-2 pt-2 border-t border-orange-200">
                                <ul className="space-y-1 font-mono text-[10px]">
                                    <li className="flex items-center justify-between">
                                        <span title="Ou VITE_API_KEY">VITE_FIREBASE_API_KEY</span>
                                        {envCheck.apiKey ? <span className="text-green-600 font-bold">OK</span> : <span className="text-red-600 font-bold">MANQUANT</span>}
                                    </li>
                                    <li className="flex items-center justify-between">
                                        <span title="Ou VITE_AUTH_DOMAIN">VITE_FIREBASE_AUTH_DOMAIN</span>
                                        {envCheck.authDomain ? <span className="text-green-600 font-bold">OK</span> : <span className="text-red-600 font-bold">MANQUANT</span>}
                                    </li>
                                    <li className="flex items-center justify-between">
                                        <span title="Ou VITE_PROJECT_ID">VITE_FIREBASE_PROJECT_ID</span>
                                        {envCheck.projectId ? <span className="text-green-600 font-bold">OK</span> : <span className="text-red-600 font-bold">MANQUANT</span>}
                                    </li>
                                </ul>
                                <button 
                                    type="button"
                                    onClick={() => setShowHelp(!showHelp)}
                                    className="mt-2 text-blue-600 underline flex items-center gap-1 cursor-pointer hover:text-blue-800"
                                >
                                    <HelpCircle size={12} /> Comment corriger ?
                                </button>
                                {showHelp && (
                                    <div className="mt-2 p-2 bg-white rounded border border-orange-200">
                                        1. Allez sur Vercel &gt; Settings &gt; Env Variables.<br/>
                                        2. Vérifiez l'orthographe EXACTE des noms.<br/>
                                        3. Le système accepte aussi les noms courts (ex: VITE_PROJECT_ID).<br/>
                                        4. Redéployez l'application après modification.
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {error && (
                        <div className="bg-red-50 border-l-4 border-red-500 p-3 text-red-700 text-sm flex items-center gap-2">
                            <AlertCircle size={16} /> {error}
                        </div>
                    )}

                    <div>
                        <label className="block text-sm font-bold text-gray-700 mb-2">Email Professionnel</label>
                        <div className="relative">
                            <Mail className="absolute left-3 top-3 text-gray-400" size={20} />
                            <input 
                                type="email" 
                                required
                                className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500 transition-all"
                                placeholder="ex: admin@by-tchico.com"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-bold text-gray-700 mb-2">Mot de Passe</label>
                        <div className="relative">
                            <Lock className="absolute left-3 top-3 text-gray-400" size={20} />
                            <input 
                                type="password" 
                                required
                                className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500 transition-all"
                                placeholder="••••••••"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                            />
                        </div>
                    </div>

                    <button 
                        type="submit"
                        disabled={loading}
                        className={`w-full py-3 rounded-lg font-bold text-white flex items-center justify-center gap-2 transition-all ${
                            loading 
                            ? 'bg-brand-400 cursor-wait' 
                            : 'bg-brand-700 hover:bg-brand-800 shadow-lg hover:shadow-xl hover:-translate-y-0.5'
                        }`}
                    >
                        {loading ? <Loader className="animate-spin" /> : <>Se connecter <ArrowRight size={20} /></>}
                    </button>

                    <div className="text-center text-xs text-gray-400 mt-4">
                        <p>Problème d'accès ? Contactez l'administrateur système.</p>
                        <p className="mt-2">v{COMPANY_CONFIG.version} • {app ? "Cloud Connected" : "Local Mode"}</p>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default LoginView;