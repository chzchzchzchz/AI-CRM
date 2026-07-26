import { useState, useRef, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Sparkles, Building2, Loader2, Copy, Check, Search, Users, Mail, ExternalLink, ChevronDown, ChevronUp, FileText, Paperclip, X, File, RefreshCw, Send } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { stripXmlReasoning, extractReasoning } from "@/lib/stripXmlReasoning";

export default function Outreach() {
  const { data: accounts, isLoading } = trpc.accounts.list.useQuery();
  const { data: allContacts } = trpc.people.list.useQuery();
  
  // Single selection - ONE account, ONE contact
  const [selectedAccountId, setSelectedAccountId] = useState<number | null>(null);
  const [selectedContactId, setSelectedContactId] = useState<number | null>(null);
  const [context, setContext] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [contactSearchQuery, setContactSearchQuery] = useState("");
  
  // Two-pass output
  const [strategy, setStrategy] = useState("");
  const [generatedEmail, setGeneratedEmail] = useState("");
  const [rawReasoning, setRawReasoning] = useState("");
  const [isReasoningOpen, setIsReasoningOpen] = useState(false);
  const [isStrategyOpen, setIsStrategyOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  
  // Refinement input
  const [refinementInput, setRefinementInput] = useState("");
  const [conversationHistory, setConversationHistory] = useState<Array<{role: 'user' | 'assistant', content: string}>>([]);
  
  // File attachments
  const [attachedFiles, setAttachedFiles] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const validFiles = files.filter(f => {
      const ext = f.name.split('.').pop()?.toLowerCase();
      return ['pdf', 'docx', 'pptx', 'txt', 'md', 'csv'].includes(ext || '');
    });
    if (validFiles.length < files.length) {
      toast.error("Some files were skipped. Supported: PDF, DOCX, PPTX, TXT, MD, CSV");
    }
    setAttachedFiles(prev => [...prev, ...validFiles]);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removeFile = (index: number) => {
    setAttachedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const generateMutation = trpc.outreach.generateEmail.useMutation({
    onSuccess: (data) => {
      // Get the clean email directly - no more strategy section
      const content = typeof data.content === 'string' ? data.content : '';
      
      // Strip any XML reasoning tags (just in case)
      const cleanEmail = stripXmlReasoning(content).trim();
      
      // Set the email directly - no strategy parsing needed
      setGeneratedEmail(cleanEmail);
      setStrategy(''); // Clear any old strategy
      setRawReasoning(''); // No reasoning to show
      
      // Add to conversation history
      setConversationHistory(prev => [
        ...prev,
        { role: 'assistant', content: cleanEmail }
      ]);
      
      toast.success("Email generated!");
    },
    onError: (error) => {
      toast.error(`Failed to generate: ${error.message}`);
    },
  });
  
  // Refinement mutation - uses dedicated refine endpoint
  const refineMutation = trpc.outreach.refineEmail.useMutation({
    onSuccess: (data) => {
      const content = typeof data.content === 'string' ? data.content : '';
      const cleanEmail = stripXmlReasoning(content).trim();
      
      setGeneratedEmail(cleanEmail);
      setConversationHistory(prev => [
        ...prev,
        { role: 'assistant', content: cleanEmail }
      ]);
      setRefinementInput('');
      toast.success("Email refined!");
    },
    onError: (error) => {
      toast.error(`Failed to refine: ${error.message}`);
    },
  });

  const handleGenerate = async () => {
    if (!selectedAccountId) {
      toast.error("Please select an account first");
      return;
    }

    // Clear previous state
    setConversationHistory([]);
    setRawReasoning('');

    // Read file contents if attached
    let fileContext = "";
    if (attachedFiles.length > 0) {
      for (const file of attachedFiles) {
        try {
          const text = await file.text();
          fileContext += `\n\n--- ${file.name} ---\n${text.slice(0, 10000)}`;
        } catch (e) {
          console.error(`Failed to read ${file.name}`);
        }
      }
    }

    const fullContext = fileContext 
      ? `${context || ''}\n\nAttached reference materials:${fileContext}`
      : context || undefined;

    generateMutation.mutate({
      accountIds: [selectedAccountId],
      contactIds: selectedContactId ? [selectedContactId] : [],
      prompt: fullContext,
    });
  };
  
  const handleRefine = () => {
    if (!refinementInput.trim()) {
      toast.error("Please enter your feedback or adjustment request");
      return;
    }
    
    // Add user message to history
    setConversationHistory(prev => [
      ...prev,
      { role: 'user', content: refinementInput }
    ]);
    
    // Use the dedicated refine endpoint
    refineMutation.mutate({
      currentEmail: generatedEmail,
      feedback: refinementInput,
      accountName: selectedAccount?.name || undefined,
      contactName: selectedContact?.name || undefined,
    });
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(generatedEmail);
    setCopied(true);
    toast.success("Copied to clipboard!");
    setTimeout(() => setCopied(false), 2000);
  };

  const selectAccount = (id: number) => {
    if (selectedAccountId === id) {
      // Deselect
      setSelectedAccountId(null);
      setSelectedContactId(null); // Clear contact when account changes
    } else {
      setSelectedAccountId(id);
      setSelectedContactId(null); // Clear contact when account changes
    }
  };

  const selectContact = (id: number) => {
    if (selectedContactId === id) {
      setSelectedContactId(null);
    } else {
      setSelectedContactId(id);
    }
  };

  // Sort accounts by intent score (highest first)
  const sortedAccounts = useMemo(() => {
    if (!accounts) return [];
    return [...accounts].sort((a, b) => {
      const scoreA = parseInt(String(a.intentScore || 0), 10);
      const scoreB = parseInt(String(b.intentScore || 0), 10);
      return scoreB - scoreA;
    });
  }, [accounts]);

  const filteredAccounts = useMemo(() => {
    if (!sortedAccounts) return [];
    if (!searchQuery.trim()) return sortedAccounts.slice(0, 100); // Limit to top 100
    const query = searchQuery.toLowerCase();
    return sortedAccounts.filter(account =>
      account.name.toLowerCase().includes(query) ||
      (account.industry && account.industry.toLowerCase().includes(query))
    ).slice(0, 100);
  }, [sortedAccounts, searchQuery]);

  // ONLY show contacts for the selected account - sorted by title relevance
  const filteredContacts = useMemo(() => {
    if (!allContacts || !selectedAccountId) return [];
    
    // Filter to ONLY contacts from selected account
    let filtered = allContacts.filter((contact: any) => 
      contact.accountId === selectedAccountId
    );
    
    // Sort by title relevance (security/IT roles first)
    const priorityTitles = ['ciso', 'cio', 'cto', 'vp', 'vice president', 'director', 'head', 'chief', 'security', 'it '];
    filtered.sort((a: any, b: any) => {
      const titleA = (a.title || '').toLowerCase();
      const titleB = (b.title || '').toLowerCase();
      const scoreA = priorityTitles.some(t => titleA.includes(t)) ? 1 : 0;
      const scoreB = priorityTitles.some(t => titleB.includes(t)) ? 1 : 0;
      return scoreB - scoreA;
    });
    
    // Apply search filter
    if (contactSearchQuery.trim()) {
      const query = contactSearchQuery.toLowerCase();
      filtered = filtered.filter((contact: any) =>
        (contact.name && contact.name.toLowerCase().includes(query)) ||
        (contact.title && contact.title.toLowerCase().includes(query))
      );
    }
    
    return filtered.slice(0, 20); // Top 20 contacts max
  }, [allContacts, selectedAccountId, contactSearchQuery]);

  const selectedAccount = accounts?.find((a: any) => a.id === selectedAccountId);
  const selectedContact = allContacts?.find((c: any) => c.id === selectedContactId);

  // Build Gmail/Outlook URLs
  const getGmailUrl = () => {
    const subject = selectedAccount ? `Quick question for ${selectedAccount.name}` : 'Quick question';
    const to = selectedContact?.email || '';
    return `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(to)}&su=${encodeURIComponent(subject)}&body=${encodeURIComponent(generatedEmail)}`;
  };

  const getOutlookUrl = () => {
    const subject = selectedAccount ? `Quick question for ${selectedAccount.name}` : 'Quick question';
    const to = selectedContact?.email || '';
    return `https://outlook.office.com/mail/deeplink/compose?to=${encodeURIComponent(to)}&subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(generatedEmail)}`;
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-accent" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface">
      <div className="container py-1 max-w-7xl">
        <div className="mb-8">
          <h1 className="text-xl font-semibold text-foreground mb-2 flex items-center gap-3">
            <Sparkles className="h-10 w-10 text-accent" />
            AI-Powered Outreach
          </h1>
          <p className="text-ink-muted">Generate personalized emails using account intelligence</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left Column - Selection */}
          <div className="space-y-6">
            {/* Step 1: Select ONE Account */}
            <Card className="card-elevated">
              <CardHeader>
                <CardTitle className="text-foreground flex items-center gap-2">
                  <Building2 className="h-5 w-5 text-accent" />
                  1. Select Target Account
                </CardTitle>
                <CardDescription>Choose ONE account (sorted by intent score)</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="mb-4">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-ink-muted" />
                    <Input
                      placeholder="Search accounts..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-10 bg-muted border-border-strong text-foreground placeholder:text-ink-subtle"
                    />
                  </div>
                </div>
                <div className="space-y-2 max-h-[300px] overflow-y-auto">
                  {filteredAccounts.map((account) => {
                    const isSelected = selectedAccountId === account.id;
                    const intentScore = parseInt(String(account.intentScore || 0), 10);
                    return (
                      <div
                        key={account.id}
                        onClick={() => selectAccount(account.id)}
                        className={`flex items-center gap-3 p-3 rounded-sm cursor-pointer transition-all ${ isSelected ? 'bg-accent-subtle border border-accent/30' : 'bg-muted hover:bg-muted border border-transparent' }`}
                      >
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-foreground truncate">{account.name}</div>
                          <div className="text-sm text-ink-muted">{account.industry || "Unknown"}</div>
                        </div>
                        <Badge className={`${ intentScore >= 70 ? 'bg-critical-subtle text-critical border-critical/30' : intentScore >= 40 ? 'bg-caution-subtle text-caution border-caution/30' : 'bg-muted text-ink-muted border-border' }`}>
                          {intentScore}
                        </Badge>
                      </div>
                    );
                  })}
                </div>
                {selectedAccount && (
                  <div className="mt-4 p-3 bg-accent-subtle rounded-sm border border-accent/30">
                    <div className="text-sm text-accent">Selected: <strong>{selectedAccount.name}</strong></div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Step 2: Select ONE Contact (only shows after account selected) */}
            <Card className={`card-elevated transition-opacity ${selectedAccountId ? 'opacity-100' : 'opacity-50 pointer-events-none'}`}>
              <CardHeader>
                <CardTitle className="text-foreground flex items-center gap-2">
                  <Users className="h-5 w-5 text-accent" />
                  2. Select Contact
                </CardTitle>
                <CardDescription>
                  {selectedAccountId 
                    ? `Choose ONE contact from ${selectedAccount?.name} (top 20 by role)`
                    : 'Select an account first'}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {selectedAccountId && (
                  <>
                    <div className="mb-4">
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-ink-muted" />
                        <Input
                          placeholder="Search contacts..."
                          value={contactSearchQuery}
                          onChange={(e) => setContactSearchQuery(e.target.value)}
                          className="pl-10 bg-muted border-border-strong text-foreground placeholder:text-ink-subtle"
                        />
                      </div>
                    </div>
                    <div className="space-y-2 max-h-[250px] overflow-y-auto">
                      {filteredContacts.length === 0 ? (
                        <div className="text-center py-8 text-ink-subtle">
                          No contacts found for this account
                        </div>
                      ) : (
                        filteredContacts.map((contact: any) => {
                          const isSelected = selectedContactId === contact.id;
                          return (
                            <div
                              key={contact.id}
                              onClick={() => selectContact(contact.id)}
                              className={`flex items-center gap-3 p-3 rounded-sm cursor-pointer transition-all ${ isSelected ? 'bg-accent-subtle border border-accent/30' : 'bg-muted hover:bg-muted border border-transparent' }`}
                            >
                              <div className="flex-1 min-w-0">
                                <div className="font-medium text-foreground truncate">{contact.name}</div>
                                <div className="text-sm text-ink-muted truncate">{contact.title || "No title"}</div>
                                {contact.email && (
                                  <div className="text-xs text-ink-subtle truncate">{contact.email}</div>
                                )}
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                    {selectedContact && (
                      <div className="mt-4 p-3 bg-accent-subtle rounded-sm border border-accent/30">
                        <div className="text-sm text-accent">
                          Selected: <strong>{selectedContact.name}</strong>
                          {selectedContact.email && <span className="text-accent"> ({selectedContact.email})</span>}
                        </div>
                      </div>
                    )}
                  </>
                )}
              </CardContent>
            </Card>

            {/* Step 3: Optional Context */}
            <Card className="card-elevated">
              <CardHeader>
                <CardTitle className="text-foreground">3. Add Context (Optional)</CardTitle>
                <CardDescription>Pain points, goals, messaging angle, or attach reference docs</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Textarea
                  placeholder="e.g., Focus on their pain points, mention recent news, emphasize your key differentiators..."
                  value={context}
                  onChange={(e) => setContext(e.target.value)}
                  className="min-h-[100px] bg-muted border-border-strong text-foreground placeholder:text-ink-subtle"
                />
                
                {/* File Attachments */}
                <div className="space-y-2">
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileSelect}
                    accept=".pdf,.docx,.pptx,.txt,.md,.csv"
                    multiple
                    className="hidden"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => fileInputRef.current?.click()}
                    className="border-border-strong text-ink-muted hover:bg-muted"
                  >
                    <Paperclip className="h-4 w-4 mr-2" />
                    Attach Reference Docs (PDF, DOCX, PPTX)
                  </Button>
                  
                  {attachedFiles.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-2">
                      {attachedFiles.map((file, i) => (
                        <Badge key={i} variant="secondary" className="flex items-center gap-1 bg-muted">
                          <File className="h-3 w-3" />
                          <span className="max-w-[150px] truncate text-xs">{file.name}</span>
                          <button onClick={() => removeFile(i)} className="ml-1 hover:text-critical">
                            <X className="h-3 w-3" />
                          </button>
                        </Badge>
                      ))}
                    </div>
                  )}
                  <p className="text-xs text-ink-subtle">Attach case studies, product docs, or competitor info to enhance the email</p>
                </div>
              </CardContent>
            </Card>

            {/* Generate Button */}
            <Button
              onClick={handleGenerate}
              disabled={generateMutation.isPending || !selectedAccountId}
              className="w-full bg-accent text-accent-foreground py-6 text-lg"
            >
              {generateMutation.isPending ? (
                <>
                  <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                  Generating Strategy & Email...
                </>
              ) : (
                <>
                  <Sparkles className="h-5 w-5 mr-2" />
                  Generate Personalized Email
                </>
              )}
            </Button>
          </div>

          {/* Right Column - Generated Content */}
          <div className="space-y-4">
            {/* Strategy (Collapsible) */}
            {strategy && (
              <Collapsible open={isStrategyOpen} onOpenChange={setIsStrategyOpen}>
                <Card className="bg-card border-border">
                  <CollapsibleTrigger asChild>
                    <CardHeader className="cursor-pointer hover:bg-muted transition-colors">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-foreground flex items-center gap-2">
                          <FileText className="h-5 w-5 text-caution" />
                          Strategy & Notes
                        </CardTitle>
                        {isStrategyOpen ? (
                          <ChevronUp className="h-5 w-5 text-ink-muted" />
                        ) : (
                          <ChevronDown className="h-5 w-5 text-ink-muted" />
                        )}
                      </div>
                      <CardDescription>Internal notes (not for sending)</CardDescription>
                    </CardHeader>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <CardContent>
                      <div className="whitespace-pre-wrap text-ink-muted bg-muted p-4 rounded-sm border border-border-strong text-sm">
                        {strategy}
                      </div>
                    </CardContent>
                  </CollapsibleContent>
                </Card>
              </Collapsible>
            )}

            {/* Generated Email */}
            <Card className="bg-card border-border sticky top-8">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-foreground flex items-center gap-2">
                    <Mail className="h-5 w-5 text-positive" />
                    Ready-to-Send Email
                  </CardTitle>
                  {generatedEmail && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleCopy}
                      className="border-border-strong"
                    >
                      {copied ? (
                        <>
                          <Check className="h-4 w-4 mr-2" />
                          Copied!
                        </>
                      ) : (
                        <>
                          <Copy className="h-4 w-4 mr-2" />
                          Copy
                        </>
                      )}
                    </Button>
                  )}
                </div>
                <CardDescription>Copy or open directly in your email client</CardDescription>
              </CardHeader>
              <CardContent>
                {generatedEmail ? (
                  <div className="space-y-4">
                    <div className="whitespace-pre-wrap text-ink-muted bg-muted p-4 rounded-sm border border-border-strong">
                      {generatedEmail}
                    </div>
                    
                    {/* Refinement Input */}
                    <div className="space-y-2">
                      <div className="flex gap-2">
                        <Input
                          placeholder="Make it shorter, add urgency, change tone..."
                          value={refinementInput}
                          onChange={(e) => setRefinementInput(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleRefine()}
                          className="flex-1 bg-muted border-border-strong text-foreground placeholder:text-ink-subtle"
                        />
                        <Button
                          onClick={handleRefine}
                          disabled={refineMutation.isPending || !refinementInput.trim()}
                          className="bg-accent hover:bg-accent"
                        >
                          {refineMutation.isPending ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <>
                              <RefreshCw className="h-4 w-4 mr-1" />
                              Refine
                            </>
                          )}
                        </Button>
                      </div>
                      <p className="text-xs text-ink-subtle">Press Enter or click Refine to adjust the email</p>
                    </div>
                    
                    {/* View Reasoning (Optional) */}
                    {rawReasoning && (
                      <Collapsible open={isReasoningOpen} onOpenChange={setIsReasoningOpen}>
                        <CollapsibleTrigger className="flex items-center gap-1 text-xs text-ink-subtle hover:text-ink-muted">
                          {isReasoningOpen ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                          {isReasoningOpen ? 'Hide' : 'View'} AI reasoning
                        </CollapsibleTrigger>
                        <CollapsibleContent>
                          <div className="mt-2 p-3 bg-card rounded border border-border max-h-[200px] overflow-y-auto">
                            <code className="text-xs text-ink-subtle whitespace-pre-wrap break-all">
                              {rawReasoning}
                            </code>
                          </div>
                        </CollapsibleContent>
                      </Collapsible>
                    )}
                    
                    {/* Send Buttons */}
                    <div className="flex gap-3">
                      <Button
                        asChild
                        className="flex-1 bg-critical hover:bg-critical text-critical-foreground"
                      >
                        <a
                          href={getGmailUrl()}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <Mail className="h-4 w-4 mr-2" />
                          Open in Gmail
                          <ExternalLink className="h-3 w-3 ml-2" />
                        </a>
                      </Button>
                      <Button
                        asChild
                        className="flex-1 bg-accent hover:bg-accent text-accent-foreground"
                      >
                        <a
                          href={getOutlookUrl()}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <Mail className="h-4 w-4 mr-2" />
                          Open in Outlook
                          <ExternalLink className="h-3 w-3 ml-2" />
                        </a>
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <Sparkles className="h-12 w-12 text-ink-subtle mb-4" />
                    <p className="text-ink-subtle">
                      Select an account and click Generate to create a personalized email
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
