import { createContext, useContext, useState, useEffect, ReactNode } from "react";

// Rep territory definitions
export const REP_TERRITORIES = {
  "zane.torres@{COMPANY_EMAIL_DOMAIN}": { name: "Zane Torres", region: "Central", sizeFilter: "<2000", label: "Central <2K" },
  "morgan.iler@{COMPANY_EMAIL_DOMAIN}": { name: "Morgan Iler", region: "West", sizeFilter: "<2000", label: "West <2K" },
  "miranda.thomas@{COMPANY_EMAIL_DOMAIN}": { name: "Miranda Thomas", region: "East", sizeFilter: "<2000", label: "East <2K" },
  "jeff.klein@{COMPANY_EMAIL_DOMAIN}": { name: "Jeff Klein", region: "Central", sizeFilter: ">=2000", label: "Central 2K+" },
  "dan.hamilton@{COMPANY_EMAIL_DOMAIN}": { name: "Dan Hamilton", region: "West", sizeFilter: ">=2000", label: "West 2K+" },
  "kevin.huelster@{COMPANY_EMAIL_DOMAIN}": { name: "Kevin Huelster", region: "East", sizeFilter: ">=2000", label: "East 2K+" },
} as const;

export type RepEmail = keyof typeof REP_TERRITORIES | "";

export interface RepInfo {
  email: RepEmail;
  name: string;
  region: string;
  sizeFilter: string;
  label: string;
}

interface RepContextType {
  selectedRep: RepEmail;
  setSelectedRep: (email: RepEmail) => void;
  repInfo: RepInfo | null;
  isRepMode: boolean;
  // Helper to check if an account matches the rep's territory
  matchesTerritory: (region: string, employeeCount: number) => boolean;
}

const RepContext = createContext<RepContextType | undefined>(undefined);

const REP_STORAGE_KEY = "selected-rep-email";

export function RepProvider({ children }: { children: ReactNode }) {
  const [selectedRep, setSelectedRepState] = useState<RepEmail>(() => {
    // Load from localStorage on init
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem(REP_STORAGE_KEY);
      if (saved && (saved === "" || saved in REP_TERRITORIES)) {
        return saved as RepEmail;
      }
    }
    return "";
  });

  // Persist to localStorage when changed
  useEffect(() => {
    localStorage.setItem(REP_STORAGE_KEY, selectedRep);
  }, [selectedRep]);

  const setSelectedRep = (email: RepEmail) => {
    setSelectedRepState(email);
  };

  const repInfo: RepInfo | null = selectedRep && REP_TERRITORIES[selectedRep]
    ? {
        email: selectedRep,
        ...REP_TERRITORIES[selectedRep],
      }
    : null;

  const isRepMode = !!repInfo;

  // Helper function to check if an account matches the rep's territory
  const matchesTerritory = (region: string, employeeCount: number): boolean => {
    if (!repInfo) return true; // No rep selected = show all
    
    // Check region match
    if (region !== repInfo.region) return false;
    
    // Check size filter
    if (repInfo.sizeFilter === "<2000") {
      return employeeCount < 2000;
    } else if (repInfo.sizeFilter === ">=2000") {
      return employeeCount >= 2000;
    }
    
    return true;
  };

  return (
    <RepContext.Provider value={{ selectedRep, setSelectedRep, repInfo, isRepMode, matchesTerritory }}>
      {children}
    </RepContext.Provider>
  );
}

export function useRep() {
  const context = useContext(RepContext);
  if (context === undefined) {
    throw new Error("useRep must be used within a RepProvider");
  }
  return context;
}

// Rep options for dropdown
export const REP_OPTIONS = [
  { value: "all", label: "All Accounts (General View)", email: "" as RepEmail },
  { value: "zane", label: "Zane Torres (Central <2K)", email: "zane.torres@{COMPANY_EMAIL_DOMAIN}" as RepEmail },
  { value: "morgan", label: "Morgan Iler (West <2K)", email: "morgan.iler@{COMPANY_EMAIL_DOMAIN}" as RepEmail },
  { value: "miranda", label: "Miranda Thomas (East <2K)", email: "miranda.thomas@{COMPANY_EMAIL_DOMAIN}" as RepEmail },
  { value: "jeff", label: "Jeff Klein (Central 2K+)", email: "jeff.klein@{COMPANY_EMAIL_DOMAIN}" as RepEmail },
  { value: "dan", label: "Dan Hamilton (West 2K+)", email: "dan.hamilton@{COMPANY_EMAIL_DOMAIN}" as RepEmail },
  { value: "kevin", label: "Kevin Huelster (East 2K+)", email: "kevin.huelster@{COMPANY_EMAIL_DOMAIN}" as RepEmail },
];
