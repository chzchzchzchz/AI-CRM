import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";
import { REP_TERRITORIES, matchesTerritory as matchesTerritoryShared, territoryFor, type RepEmail } from "@shared/territories";

// Re-exported so existing importers (RepSwitcher, TopAccounts, Home) keep working.
export { REP_TERRITORIES };
export type { RepEmail };

// Rep territory definitions.
// This is the SINGLE demo roster used across the app (dropdowns, TopAccounts,

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
  // The predicate lives in @shared/territories so the server applies the identical rule.
  //
  // Stable per rep. It used to be a new function on every render, so a list memoised on it
  // either recomputed constantly or — on the accounts page, which left it out of its
  // dependencies — never noticed the rep changing at all: picking a territory there left
  // all 1,000 accounts on screen. Its identity now changes exactly when the rep does.
  const matchesTerritory = useCallback(
    (region: string, employeeCount: number): boolean =>
      matchesTerritoryShared(territoryFor(selectedRep), region, employeeCount),
    [selectedRep]
  );

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

// Rep options for dropdown (derived from REP_TERRITORIES so there's one source of truth)
export const REP_OPTIONS = [
  { value: "all", label: "All Accounts (General View)", email: "" as RepEmail },
  ...(Object.entries(REP_TERRITORIES).map(([email, info]) => ({
    value: info.name.split(" ")[0].toLowerCase(),
    label: `${info.name} (${info.label})`,
    email: email as RepEmail,
  }))),
];
