/**
 * pages.config.js - Page routing configuration with lazy loading
 */
import { lazy } from 'react';
import __Layout from './Layout.jsx';

const AideVendeur = lazy(() => import('./pages/AideVendeur'));
const CatalogueVendeur = lazy(() => import('./pages/CatalogueVendeur'));
const Categories = lazy(() => import('./pages/Categories'));
const Commandes = lazy(() => import('./pages/Commandes'));
const CommandesVendeurs = lazy(() => import('./pages/CommandesVendeurs'));
const Commissions = lazy(() => import('./pages/Commissions'));
const ConfigurationAdminPassword = lazy(() => import('./pages/ConfigurationAdminPassword'));
const ConfigurationApp = lazy(() => import('./pages/ConfigurationApp'));
const Connexion = lazy(() => import('./pages/Connexion'));
const DemandePaiement = lazy(() => import('./pages/DemandePaiement'));
const EnAttenteValidation = lazy(() => import('./pages/EnAttenteValidation'));
const EspaceSousAdmin = lazy(() => import('./pages/EspaceSousAdmin'));
const EspaceVendeur = lazy(() => import('./pages/EspaceVendeur'));
const GestionCommandes = lazy(() => import('./pages/GestionCommandes'));
const GestionKYC = lazy(() => import('./pages/GestionKYC'));
const GestionPermissionsAdmin = lazy(() => import('./pages/GestionPermissionsAdmin'));
const GestionSousAdmins = lazy(() => import('./pages/GestionSousAdmins'));
const InscriptionVendeur = lazy(() => import('./pages/InscriptionVendeur'));
const JournalAudit = lazy(() => import('./pages/JournalAudit'));
const Livraisons = lazy(() => import('./pages/Livraisons'));
const MesCommandesVendeur = lazy(() => import('./pages/MesCommandesVendeur'));
const NotificationsVendeur = lazy(() => import('./pages/NotificationsVendeur'));
const NouvelleCommandeVendeur = lazy(() => import('./pages/NouvelleCommandeVendeur'));
const NouvelleVente = lazy(() => import('./pages/NouvelleVente'));
const PaiementsVendeurs = lazy(() => import('./pages/PaiementsVendeurs'));
const Produits = lazy(() => import('./pages/Produits'));
const ProfilVendeur = lazy(() => import('./pages/ProfilVendeur'));
const RapportsVentes = lazy(() => import('./pages/RapportsVentes'));
const ResetPassword = lazy(() => import('./pages/ResetPassword'));
const RetoursAdmin = lazy(() => import('./pages/RetoursAdmin'));
const SupportAdmin = lazy(() => import('./pages/SupportAdmin'));
const TableauDeBord = lazy(() => import('./pages/TableauDeBord'));
const Vendeurs = lazy(() => import('./pages/Vendeurs'));
const VideoFormation = lazy(() => import('./pages/VideoFormation'));

export const PAGES = {
    "AideVendeur": AideVendeur,
    "CatalogueVendeur": CatalogueVendeur,
    "Categories": Categories,
    "Commandes": Commandes,
    "CommandesVendeurs": CommandesVendeurs,
    "Commissions": Commissions,
    "ConfigurationAdminPassword": ConfigurationAdminPassword,
    "ConfigurationApp": ConfigurationApp,
    "Connexion": Connexion,
    "DemandePaiement": DemandePaiement,
    "EnAttenteValidation": EnAttenteValidation,
    "EspaceSousAdmin": EspaceSousAdmin,
    "EspaceVendeur": EspaceVendeur,
    "GestionCommandes": GestionCommandes,
    "GestionKYC": GestionKYC,
    "GestionPermissionsAdmin": GestionPermissionsAdmin,
    "GestionSousAdmins": GestionSousAdmins,
    "InscriptionVendeur": InscriptionVendeur,
    "JournalAudit": JournalAudit,
    "Livraisons": Livraisons,
    "MesCommandesVendeur": MesCommandesVendeur,
    "NotificationsVendeur": NotificationsVendeur,
    "NouvelleCommandeVendeur": NouvelleCommandeVendeur,
    "NouvelleVente": NouvelleVente,
    "PaiementsVendeurs": PaiementsVendeurs,
    "Produits": Produits,
    "ProfilVendeur": ProfilVendeur,
    "RapportsVentes": RapportsVentes,
    "ResetPassword": ResetPassword,
    "RetoursAdmin": RetoursAdmin,
    "SupportAdmin": SupportAdmin,
    "TableauDeBord": TableauDeBord,
    "Vendeurs": Vendeurs,
    "VideoFormation": VideoFormation,
}

export const pagesConfig = {
    mainPage: "Connexion",
    Pages: PAGES,
    Layout: __Layout,
};
