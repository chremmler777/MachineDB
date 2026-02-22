import React, { createContext, useContext, useState } from 'react';

type Language = 'en' | 'es' | 'de';

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string) => string;
}

const translations: Record<Language, Record<string, string>> = {
  en: {
    'nav.dashboard': 'Dashboard',
    'nav.machines': 'Machines',
    'nav.finder': 'Machine Finder',
    'nav.admin': 'Admin',
    'dashboard.title': 'Dashboard',
    'dashboard.overview': 'Machine Overview',
    'machines.title': 'Machines',
    'machines.search': 'Search',
    'machines.plant': 'Plant',
    'machines.resetFilters': 'Reset Filters',
    'machines.loading': 'Loading...',
    'machines.noFound': 'No machines found',
    'machines.machinesCount': 'Machines',
    'machines.view': 'View',
    'finder.title': 'Machine Finder',
    'language': 'Language',
  },
  es: {
    'nav.dashboard': 'Panel de control',
    'nav.machines': 'Máquinas',
    'nav.finder': 'Buscador de máquinas',
    'nav.admin': 'Administrador',
    'dashboard.title': 'Panel de control',
    'dashboard.overview': 'Descripción general de máquinas',
    'machines.title': 'Máquinas',
    'machines.search': 'Buscar',
    'machines.plant': 'Planta',
    'machines.resetFilters': 'Restablecer filtros',
    'machines.loading': 'Cargando...',
    'machines.noFound': 'No se encontraron máquinas',
    'machines.machinesCount': 'Máquinas',
    'machines.view': 'Ver',
    'finder.title': 'Buscador de máquinas',
    'language': 'Idioma',
  },
  de: {
    'nav.dashboard': 'Dashboard',
    'nav.machines': 'Maschinen',
    'nav.finder': 'Maschinen Finder',
    'nav.admin': 'Administrator',
    'dashboard.title': 'Dashboard',
    'dashboard.overview': 'Maschinenübersicht',
    'machines.title': 'Maschinen',
    'machines.search': 'Suchen',
    'machines.plant': 'Werk',
    'machines.resetFilters': 'Filter zurücksetzen',
    'machines.loading': 'Lädt...',
    'machines.noFound': 'Keine Maschinen gefunden',
    'machines.machinesCount': 'Maschinen',
    'machines.view': 'Anzeigen',
    'finder.title': 'Maschinen Finder',
    'language': 'Sprache',
  },
};

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [language, setLanguage] = useState<Language>('en');

  const t = (key: string): string => {
    return translations[language][key] || key;
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within LanguageProvider');
  }
  return context;
};
