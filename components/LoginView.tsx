
import React, { useState } from 'react';
import { SessionUser, RoleEmploye } from '../types';
import { Lock, Mail, ArrowRight, AlertCircle, Loader } from 'lucide-react';
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
                        <div className="bg-yellow-50 border-l-4 border-yellow-500 p-3 text-yellow-700 text-xs flex items-center gap-2">
                            <AlertCircle size={16} /> 
                            <span>Mode Démo : Entrez n'importe quel email contenant 'admin', 'gerant' ou 'vendeur' pour tester les rôles.</span>
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
