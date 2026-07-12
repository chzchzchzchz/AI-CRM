import { createContext, useContext, useState, useEffect, ReactNode } from "react";

// Rep territory definitions.
// This is the SINGLE demo roster used across the app (dropdowns, TopAccounts,
// territory filtering). Replace these entries with your own reps — the email is
// just an opaque identifier; filtering is driven by region + sizeFilter.
export const REP_TERRITORIES = {
  "alex.rivera@demo.example.com": { name: "Alex Rivera", region: "Central", sizeFilter: "<2000", label: "Central <2K" },
  "jordan.bailey@demo.example.com": { name: "Jordan Bailey", region: "West", sizeFilter: "<2000", label: "West <2K" },
  "sam.okoye@demo.example.com": { name: "Sam Okoye", region: "East", sizeFilter: "<2000", label: "East <2K" },
  "taylor.brooks@demo.example.com": { name: "Taylor Brooks", region: "Central", sizeFilter: ">=2000", label: "Central 2K+" },
  "casey.morgan@demo.example.com": { name: "Casey Morgan", region: "West", sizeFilter: ">=2000", label: "West 2K+" },
  "riley.nguyen@demo.example.com": { name: "Riley Nguyen", region: "East", sizeFilter: ">=2000", label: "East 2K+" },
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

// Rep options for dropdown (derived from REP_TERRITORIES so there's one source of truth)
export const REP_OPTIONS = [
  { value: "all", label: "All Accounts (General View)", email: "" as RepEmail },
  ...(Object.entries(REP_TERRITORIES).map(([email, info]) => ({
    value: info.name.split(" ")[0].toLowerCase(),
    label: `${info.name} (${info.label})`,
    email: email as RepEmail,
  }))),
];
