
import React from 'react';
import { LayoutDashboard, Scissors, Users, ShoppingBag, Wallet, Store, Menu, Truck, Tag, Box, Briefcase, ShoppingCart, CreditCard, LogOut, Settings, Grid, Image, Wifi, WifiOff } from 'lucide-react';
import { SessionUser, RoleEmploye } from '../types';
import { COMPANY_CONFIG } from '../config';
import app from '../services/firebase';

interface SidebarProps {
    currentView: string;
    setView: (view: string) => void;
    isOpen: boolean;
    setIsOpen: (val: boolean) => void;
    availableViews: string[]; 
    user: SessionUser | null;
    onLogout: () => void;
}

const Sidebar: React.FC<SidebarProps> = React.memo(({ currentView, setView, isOpen, setIsOpen, availableViews, user, onLogout }) => {
    
    const allMenuItems = [
        { id: 'dashboard', label: 'Tableau de Bord', icon: LayoutDashboard, permKey: 'dashboard' },
        { id: 'ventes', label: 'Ventes / Caisse', icon: ShoppingBag, permKey: 'ventes' },
        { id: 'catalogue-public', label: 'Catalogue Digital', icon: Grid, permKey: 'catalogue' }, 
        { id: 'galerie', label: 'Galerie & Modèles', icon: Image, permKey: 'catalogue' }, 
        { id: 'production', label: 'Atelier & Production', icon: Scissors, permKey: 'production' },
        { id: 'catalogue', label: 'Gestion Articles', icon: Tag, permKey: 'catalogue' },
        { id: 'stock', label: 'Stock & Boutiques', icon: Box, permKey: 'stock' },
        { id: 'approvisionnement', label: 'Approvisionnement', icon: ShoppingCart, permKey: 'approvisionnement' },
        { id: 'fournisseurs', label: 'Fournisseurs', icon: Truck, permKey: 'fournisseurs' },
        { id: 'rh', label: 'Ressources Humaines', icon: Briefcase, permKey: 'rh' },
        { id: 'clients', label: 'Clients & Mesures', icon: Users, permKey: 'clients' },
        { id: 'finance', label: 'Finance & Rentabilité', icon: Wallet, permKey: 'finance' },
    ];

    // Filtrage dynamique selon les permissions de l'utilisateur
    const visibleItems = allMenuItems.filter(item => {
        if (user?.role === RoleEmploye.ADMIN) return true;
        
        // Vérification des permissions granulaires
        const perm = user?.permissions?.[item.permKey as keyof typeof user.permissions];
        if (perm === 'NONE') return false;
        
        return availableViews.includes(item.id);
    });

    // Autorise l'accès aux réglages si Admin, Gérant ou si la permission 'settings' n'est pas 'NONE'
    const showSettings = user?.role === RoleEmploye.ADMIN || 
                       user?.role === RoleEmploye.GERANT || 
                       (user?.permissions?.settings && user.permissions.settings !== 'NONE');
                       
    const isConnected = !!app;

    return (
        <>
            {isOpen && (
                <div 
                    className="fixed inset-0 bg-black bg-opacity-50 z-20 md:hidden"
                    onClick={() => setIsOpen(false)}
                />
            )}

            <div className={`fixed inset-y-0 left-0 z-30 w-64 bg-brand-900 text-white transform transition-transform duration-300 ease-in-out ${isOpen ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0 md:static md:inset-0 shadow-xl flex flex-col h-full max-h-screen`}>
                <div className="p-4 flex flex-col items-center justify-center border-b border-brand-800 shrink-0">
                    <h1 className="text-xl font-bold tracking-wider text-brand-100 text-center">{COMPANY_CONFIG.name}</h1>
                    
                    <div className={`mt-2 flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold border ${isConnected ? 'bg-green-900/30 border-green-700 text-green-400' : 'bg-red-900/30 border-red-700 text-red-400'}`}>
                        {isConnected ? <Wifi size={10} /> : <WifiOff size={10} />}
                        {isConnected ? 'EN LIGNE (SYNC)' : 'HORS LIGNE'}
                    </div>

                    {user && (
                        <div className="mt-2 flex flex-col items-center">
                            <span className="text-[10px] bg-brand-800 px-2 py-0.5 rounded text-brand-200 border border-brand-700 uppercase">
                                {user.role}
                            </span>
                            <span className="text-[9px] text-brand-400 mt-1 font-black uppercase">{user.nom}</span>
                        </div>
                    )}
                </div>

                <nav className="flex-1 px-3 py-2 space-y-1 overflow-y-auto custom-scrollbar">
                    {visibleItems.map((item) => {
                        const Icon = item.icon;
                        const isActive = currentView === item.id;
                        return (
                            <button
                                key={item.id}
                                onClick={() => {
                                    setView(item.id);
                                    setIsOpen(false);
                                }}
                                className={`w-full flex items-center space-x-3 px-3 py-2.5 rounded-lg transition-colors ${
                                    isActive 
                                    ? 'bg-brand-700 text-white shadow-md' 
                                    : 'text-brand-200 hover:bg-brand-800 hover:text-white'
                                }`}
                            >
                                <Icon size={18} />
                                <span className="font-medium text-sm">{item.label}</span>
                            </button>
                        );
                    })}

                    {showSettings && (
                        <>
                            <div className="border-t border-brand-800 my-2 pt-2"></div>
                            <button
                                onClick={() => {
                                    setView('settings');
                                    setIsOpen(false);
                                }}
                                className={`w-full flex items-center space-x-3 px-3 py-2.5 rounded-lg transition-colors ${
                                    currentView === 'settings'
                                    ? 'bg-brand-700 text-white shadow-md' 
                                    : 'text-brand-200 hover:bg-brand-800 hover:text-white'
                                }`}
                            >
                                <Settings size={18} />
                                <span className="font-medium text-sm">Paramètres & Exports</span>
                            </button>
                        </>
                    )}
                </nav>

                <div className="p-3 border-t border-brand-800 space-y-2 shrink-0">
                    <button 
                        onClick={onLogout}
                        className="w-full flex items-center space-x-3 px-3 py-2 rounded-lg text-red-200 hover:bg-red-900/30 hover:text-red-100 transition-colors"
                    >
                        <LogOut size={18} />
                        <span className="font-medium text-sm">Déconnexion</span>
                    </button>
                    
                    <div className="bg-brand-800 rounded-lg p-2 text-[10px] text-brand-200 text-center opacity-80">
                        <p>v{COMPANY_CONFIG.version}</p>
                    </div>
                </div>
            </div>
        </>
    );
});

export default Sidebar;
