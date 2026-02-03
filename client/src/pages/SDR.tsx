import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Navigation } from "@/components/Navigation";
import { AIAssistant } from "@/components/AIAssistant";
import { trpc } from "@/lib/trpc";
import {
  Copy, Download, FileJson, Sparkles, Search, Filter, ChevronRight,
  Building2, User, Mail, Loader2
} from "lucide-react";
import { toast } from "sonner";

export default function SDR() {
  const [selectedAccounts, setSelectedAccounts] = useState<number[]>([]);
  const [selectedContacts, setSelectedContacts] = useState<number[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterIndustry, setFilterIndustry] = useState<string>("");
  const [isExporting, setIsExporting] = useState(false);

  // Fetch accounts
  const { data: accounts, isLoading: accountsLoading } = trpc.accounts.list.useQuery();

  // Fetch contacts
  const { data: contacts, isLoading: contactsLoading } = trpc.people.list.useQuery();

  // SDR Export mutation
  const sdrExportMutation = trpc.sdr.export.useMutation();

  // Filter accounts
  const filteredAccounts = (accounts?.data || []).filter((acc: any) => {
    const matchesSearch = acc.name?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesIndustry = !filterIndustry || acc.industry === filterIndustry;
    return matchesSearch && matchesIndustry;
  });

  // Filter contacts
  const filteredContacts = (contacts?.data || []).filter((contact: any) => {
    const matchesSearch =
      contact.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      contact.email?.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesSearch;
  });

  const handleExportSelected = async () => {
    if (selectedAccounts.length === 0 && selectedContacts.length === 0) {
      toast.error("Select at least one account or contact");
      return;
    }

    setIsExporting(true);
    try {
      const exports = [];

      // Export selected accounts with their contacts
      for (const accountId of selectedAccounts) {
        const accountContacts = selectedContacts.filter((cId) => {
          const contact = (contacts?.data || []).find((c: any) => c.id === cId);
          return contact?.accountId === accountId;
        });

        if (accountContacts.length === 0) {
          // Export account without specific contact
          const result = await sdrExportMutation.mutateAsync({
            accountId,
            contactId: undefined as any,
          });
          if (result.success) {
            exports.push(result.data);
          }
        } else {
          // Export account with each selected contact
          for (const contactId of accountContacts) {
            const result = await sdrExportMutation.mutateAsync({
              accountId,
              contactId: contactId as any,
            });
            if (result.success) {
              exports.push(result.data);
            }
          }
        }
      }

      // Export selected contacts without specific account
      for (const contactId of selectedContacts) {
        const contact = (contacts?.data || []).find((c: any) => c.id === contactId);
        if (contact?.accountId && !selectedAccounts.includes(contact.accountId)) {
          const result = await sdrExportMutation.mutateAsync({
            accountId: contact.accountId,
            contactId: contactId as any,
          });
          if (result.success) {
            exports.push(result.data);
          }
        }
      }

      // Combine all exports
      const combinedPayload = {
        exportCount: exports.length,
        timestamp: new Date().toISOString(),
        exports,
      };

      const payload = JSON.stringify(combinedPayload, null, 2);
      await navigator.clipboard.writeText(payload);
      toast.success(`${exports.length} records exported to clipboard! Paste into Claude.`);
    } catch (error) {
      console.error("Export error:", error);
      toast.error("Failed to export SDR data");
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportJSON = async () => {
    if (selectedAccounts.length === 0 && selectedContacts.length === 0) {
      toast.error("Select at least one account or contact");
      return;
    }

    try {
      const exports = [];

      for (const accountId of selectedAccounts) {
        const result = await sdrExportMutation.mutateAsync({
          accountId,
          contactId: undefined as any,
        });
        if (result.success) {
          exports.push(result.data);
        }
      }

      const combinedPayload = {
        exportCount: exports.length,
        timestamp: new Date().toISOString(),
        exports,
      };

      const payload = JSON.stringify(combinedPayload, null, 2);
      const blob = new Blob([payload], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `sdr-export-${Date.now()}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Export downloaded!");
    } catch (error) {
      toast.error("Failed to download export");
    }
  };

  const toggleAccount = (id: number) => {
    setSelectedAccounts((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const toggleContact = (id: number) => {
    setSelectedContacts((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const toggleAllAccounts = () => {
    if (selectedAccounts.length === filteredAccounts.length) {
      setSelectedAccounts([]);
    } else {
      setSelectedAccounts(filteredAccounts.map((a: any) => a.id));
    }
  };

  const toggleAllContacts = () => {
    if (selectedContacts.length === filteredContacts.length) {
      setSelectedContacts([]);
    } else {
      setSelectedContacts(filteredContacts.map((c: any) => c.id));
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <AIAssistant context={{ type: "contact" }} />

      <div className="container py-6 space-y-6 max-w-7xl">
        {/* Header */}
        <div className="space-y-2">
          <h1 className="text-3xl font-bold">SDR Export</h1>
          <p className="text-muted-foreground">
            Export account and contact data for Claude AI-powered email generation
          </p>
        </div>

        {/* Export Actions */}
        <div className="flex gap-2 flex-wrap">
          <Button
            onClick={handleExportSelected}
            disabled={isExporting || (selectedAccounts.length === 0 && selectedContacts.length === 0)}
            className="gap-2"
          >
            {isExporting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Exporting...
              </>
            ) : (
              <>
                <Copy className="h-4 w-4" />
                Copy to Clipboard
              </>
            )}
          </Button>
          <Button
            variant="outline"
            onClick={handleExportJSON}
            disabled={selectedAccounts.length === 0 && selectedContacts.length === 0}
            className="gap-2"
          >
            <Download className="h-4 w-4" />
            Download JSON
          </Button>
          <div className="flex-1" />
          <div className="flex gap-2">
            <Input
              placeholder="Search accounts or contacts..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="max-w-sm"
            />
            <Button variant="outline" size="icon">
              <Filter className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Selection Summary */}
        {(selectedAccounts.length > 0 || selectedContacts.length > 0) && (
          <Card className="bg-blue-50 border-blue-200">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <p className="font-semibold">
                    {selectedAccounts.length} accounts, {selectedContacts.length} contacts selected
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Ready to export for Claude AI email generation
                  </p>
                </div>
                <Sparkles className="h-5 w-5 text-blue-600" />
              </div>
            </CardContent>
          </Card>
        )}

        {/* Accounts Section */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">Accounts ({filteredAccounts.length})</h2>
            <Button
              variant="ghost"
              size="sm"
              onClick={toggleAllAccounts}
              className="text-xs"
            >
              {selectedAccounts.length === filteredAccounts.length ? "Deselect All" : "Select All"}
            </Button>
          </div>

          {accountsLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="grid gap-2 max-h-96 overflow-y-auto">
              {filteredAccounts.map((account: any) => (
                <Card
                  key={account.id}
                  className={`cursor-pointer transition-all ${
                    selectedAccounts.includes(account.id)
                      ? "ring-2 ring-blue-500 bg-blue-50"
                      : "hover:bg-muted"
                  }`}
                  onClick={() => toggleAccount(account.id)}
                >
                  <CardContent className="py-3 px-4">
                    <div className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={selectedAccounts.includes(account.id)}
                        onChange={() => {}}
                        className="h-4 w-4"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <Building2 className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                          <p className="font-medium truncate">{account.name}</p>
                        </div>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                          {account.industry && <Badge variant="outline">{account.industry}</Badge>}
                          {account.employees && (
                            <span>{account.employees.toLocaleString()} employees</span>
                          )}
                        </div>
                      </div>
                      <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>

        {/* Contacts Section */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">Contacts ({filteredContacts.length})</h2>
            <Button
              variant="ghost"
              size="sm"
              onClick={toggleAllContacts}
              className="text-xs"
            >
              {selectedContacts.length === filteredContacts.length ? "Deselect All" : "Select All"}
            </Button>
          </div>

          {contactsLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="grid gap-2 max-h-96 overflow-y-auto">
              {filteredContacts.map((contact: any) => (
                <Card
                  key={contact.id}
                  className={`cursor-pointer transition-all ${
                    selectedContacts.includes(contact.id)
                      ? "ring-2 ring-green-500 bg-green-50"
                      : "hover:bg-muted"
                  }`}
                  onClick={() => toggleContact(contact.id)}
                >
                  <CardContent className="py-3 px-4">
                    <div className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={selectedContacts.includes(contact.id)}
                        onChange={() => {}}
                        className="h-4 w-4"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                          <p className="font-medium truncate">{contact.name}</p>
                        </div>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                          {contact.title && <span>{contact.title}</span>}
                          {contact.email && (
                            <a
                              href={`mailto:${contact.email}`}
                              className="flex items-center gap-1 hover:text-primary"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <Mail className="h-3 w-3" />
                              {contact.email}
                            </a>
                          )}
                        </div>
                      </div>
                      <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
