import { useState, useEffect } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { trpc } from "@/lib/trpc";
import { Search, Building2, User, Phone, Loader2 } from "lucide-react";
import { useLocation } from "wouter";

interface GlobalSearchProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function GlobalSearch({ open, onOpenChange }: GlobalSearchProps) {
  const [query, setQuery] = useState("");
  const [, setLocation] = useLocation();

  const { data: accounts, isLoading: accountsLoading } = trpc.accounts.list.useQuery(
    undefined,
    { enabled: open && query.length > 0 }
  );

  const { data: people, isLoading: peopleLoading } = trpc.people.list.useQuery(
    undefined,
    { enabled: open && query.length > 0 }
  );

  const { data: calls, isLoading: callsLoading } = trpc.gong.list.useQuery(
    undefined,
    { enabled: open && query.length > 0 }
  );

  const isLoading = accountsLoading || peopleLoading || callsLoading;

  const filteredAccounts = accounts?.filter(account => {
    const q = query.toLowerCase();
    return (
      account.name?.toLowerCase().includes(q) ||
      account.domain?.toLowerCase().includes(q) ||
      account.industry?.toLowerCase().includes(q)
    );
  }).slice(0, 5);

  const filteredPeople = people?.filter(person => {
    const q = query.toLowerCase();
    return (
      person.name?.toLowerCase().includes(q) ||
      person.title?.toLowerCase().includes(q) ||
      person.company?.toLowerCase().includes(q) ||
      person.email?.toLowerCase().includes(q)
    );
  }).slice(0, 5);

  const filteredCalls = calls?.filter(call => {
    const q = query.toLowerCase();
    return (
      call.title?.toLowerCase().includes(q) ||
      String(call.accountId || '').toLowerCase().includes(q) ||
      String((call as any).participants || '').toLowerCase().includes(q)
    );
  }).slice(0, 5);

  const handleSelect = (type: 'account' | 'contact' | 'call', id: number) => {
    onOpenChange(false);
    setQuery("");
    
    if (type === 'account') {
      setLocation(`/accounts/${id}`);
    } else if (type === 'contact') {
      // Navigate to contacts page for now
      setLocation('/contacts');
    } else if (type === 'call') {
      setLocation('/calls');
    }
  };

  // Reset query when dialog closes
  useEffect(() => {
    if (!open) {
      setQuery("");
    }
  }, [open]);

  const hasResults = (filteredAccounts?.length ?? 0) > 0 || 
                     (filteredPeople?.length ?? 0) > 0 || 
                     (filteredCalls?.length ?? 0) > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl p-0 gap-0 bg-slate-900 border-slate-800">
        <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-800">
          <Search className="h-5 w-5 text-slate-400" />
          <Input
            placeholder="Search accounts, contacts, or calls..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="border-0 bg-transparent text-white placeholder:text-slate-500 focus-visible:ring-0 focus-visible:ring-offset-0"
            autoFocus
          />
          {isLoading && <Loader2 className="h-4 w-4 animate-spin text-cyan-500" />}
        </div>

        <div className="max-h-[60vh] overflow-y-auto p-2">
          {query.length === 0 ? (
            <div className="py-12 text-center text-slate-500 text-sm">
              Type to search across accounts, contacts, and calls
            </div>
          ) : !hasResults && !isLoading ? (
            <div className="py-12 text-center text-slate-500 text-sm">
              No results found for "{query}"
            </div>
          ) : (
            <div className="space-y-4">
              {/* Accounts */}
              {filteredAccounts && filteredAccounts.length > 0 && (
                <div>
                  <div className="px-2 py-1 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                    Accounts
                  </div>
                  <div className="space-y-1">
                    {filteredAccounts.map((account) => (
                      <button
                        key={account.id}
                        onClick={() => handleSelect('account', account.id)}
                        className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-slate-800/50 transition-colors text-left"
                      >
                        <div className="p-2 rounded-lg bg-cyan-500/10 border border-cyan-500/20">
                          <Building2 className="h-4 w-4 text-cyan-500" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-white truncate">{account.name}</div>
                          <div className="text-sm text-slate-400 truncate">
                            {account.domain || account.industry || 'No additional info'}
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* People */}
              {filteredPeople && filteredPeople.length > 0 && (
                <div>
                  <div className="px-2 py-1 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                    Contacts
                  </div>
                  <div className="space-y-1">
                    {filteredPeople.map((person) => (
                      <button
                        key={person.id}
                        onClick={() => handleSelect('contact', person.id)}
                        className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-slate-800/50 transition-colors text-left"
                      >
                        <div className="p-2 rounded-lg bg-purple-500/10 border border-purple-500/20">
                          <User className="h-4 w-4 text-purple-500" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-white truncate">{person.name}</div>
                          <div className="text-sm text-slate-400 truncate">
                            {person.title} {person.company && `at ${person.company}`}
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Calls */}
              {filteredCalls && filteredCalls.length > 0 && (
                <div>
                  <div className="px-2 py-1 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                    Calls
                  </div>
                  <div className="space-y-1">
                    {filteredCalls.map((call) => (
                      <button
                        key={call.id}
                        onClick={() => handleSelect('call', call.id)}
                        className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-slate-800/50 transition-colors text-left"
                      >
                        <div className="p-2 rounded-lg bg-green-500/10 border border-green-500/20">
                          <Phone className="h-4 w-4 text-green-500" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-white truncate">{call.title || 'Untitled Call'}</div>
                          <div className="text-sm text-slate-400 truncate">
                            {call.accountId || 'No company'} • {(call as any).participants || 'No speakers'}
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="px-4 py-2 border-t border-slate-800 text-xs text-slate-500 flex items-center justify-between">
          <span>Press ESC to close</span>
          <span>⌘K to open</span>
        </div>
      </DialogContent>
    </Dialog>
  );
}
