
import React, { useMemo } from 'react';
import { LayoutDashboard, Scissors, Users, ShoppingBag, Wallet, Store, Menu, Truck, Tag, Box, Briefcase, ShoppingCart, CreditCard, LogOut, Settings, Grid, Image, Wifi, WifiOff, AlertCircle, Bell } from 'lucide-react';
import { SessionUser, RoleEmploye, Commande, Article, StatutCommande } from '../types';
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
    commandes: Commande[];
    articles: Article[];
}

const Sidebar: React.FC<SidebarProps> = React.memo(({ currentView, setView, isOpen, setIsOpen, availableViews, user, onLogout, commandes, articles }) => {
    
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

    const urgentCount = useMemo(() => {
        const today = new Date();
        today.setHours(0,0,0,0);
        
        const lateOrders = commandes.filter(c => {
            if (c.statut === StatutCommande.LIVRE || c.statut === StatutCommande.ANNULE || c.archived) return false;
            return new Date(c.dateLivraisonPrevue) < today;
        }).length;

        const lowStock = articles.filter(a => {
            const total = Object.values(a.stockParLieu).reduce((acc: number, place) => 
                acc + Object.values(place).reduce((acc2: number, qty: any) => acc2 + Number(qty), 0)
            , 0);
            return total <= a.seuilAlerte;
        }).length;

        return lateOrders + lowStock;
    }, [commandes, articles]);

    const visibleItems = allMenuItems.filter(item => {
        if (user?.role === RoleEmploye.ADMIN) return true;
        const perm = user?.permissions?.[item.permKey as keyof typeof user.permissions];
        if (perm === 'NONE') return false;
        return availableViews.includes(item.id);
    });

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
                        {isConnected ? 'EN LIGNE' : 'HORS LIGNE'}
                    </div>
                </div>

                {urgentCount > 0 && (
                    <div className="mx-3 mt-4 p-3 bg-red-600 rounded-xl flex items-center gap-3 animate-pulse shadow-lg">
                        <AlertCircle size={20} className="shrink-0"/>
                        <div>
                            <p className="text-[10px] font-black uppercase tracking-tighter">Centre d'Urgences</p>
                            <p className="text-xs font-bold">{urgentCount} alertes détectées</p>
                        </div>
                    </div>
                )}

                <nav className="flex-1 px-3 py-2 mt-2 space-y-1 overflow-y-auto custom-scrollbar">
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
                                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg transition-colors ${
                                    isActive 
                                    ? 'bg-brand-700 text-white shadow-md' 
                                    : 'text-brand-200 hover:bg-brand-800 hover:text-white'
                                }`}
                            >
                                <div className="flex items-center space-x-3">
                                    <Icon size={18} />
                                    <span className="font-medium text-sm">{item.label}</span>
                                </div>
                                {item.id === 'production' && urgentCount > 0 && (
                                    <span className="w-5 h-5 bg-red-500 rounded-full flex items-center justify-center text-[10px] font-bold">{urgentCount}</span>
                                )}
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
                                <span className="font-medium text-sm">Paramètres</span>
                            </button>
                        </>
                    )}
                </nav>

                <div className="p-3 border-t border-brand-800 space-y-2 shrink-0">
                    {user && (
                        <div className="flex items-center gap-3 px-3 py-2 bg-brand-800 rounded-xl border border-brand-700">
                             <div className="w-8 h-8 bg-brand-600 rounded-full flex items-center justify-center font-black text-xs">{user.nom.charAt(0)}</div>
                             <div className="flex-1 min-w-0">
                                 <p className="text-[10px] font-black text-brand-300 uppercase truncate">{user.nom}</p>
                                 <p className="text-[8px] text-brand-500 uppercase">{user.role}</p>
                             </div>
                             <button onClick={onLogout} className="text-brand-400 hover:text-red-400"><LogOut size={16}/></button>
                        </div>
                    )}
                    <div className="text-[8px] text-brand-400 text-center uppercase tracking-widest opacity-50">v{COMPANY_CONFIG.version} BY TCHICO</div>
                </div>
            </div>
        </>
    );
});

export default Sidebar;
