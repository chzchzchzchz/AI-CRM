import { useState, useRef, useMemo } from "react";
import { Navigation } from "@/components/Navigation";
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
      // Parse the two-pass response
      const content = typeof data.content === 'string' ? data.content : '';
      
      // Extract and store raw reasoning for optional viewing
      const reasoning = extractReasoning(content);
      if (reasoning) {
        setRawReasoning(reasoning);
      }
      
      // Strip XML reasoning tags to get clean email
      const cleanContent = stripXmlReasoning(content);
      
      // Check if response has strategy section
      if (cleanContent.includes('---EMAIL---')) {
        const parts = cleanContent.split('---EMAIL---');
        setStrategy(stripXmlReasoning(parts[0].replace('---STRATEGY---', '').trim()));
        setGeneratedEmail(stripXmlReasoning(parts[1].trim()));
      } else {
        // Fallback - treat entire response as email
        setGeneratedEmail(cleanContent);
        setStrategy('');
      }
      
      // Add to conversation history
      setConversationHistory(prev => [
        ...prev,
        { role: 'assistant', content: cleanContent }
      ]);
      
      toast.success("Email generated successfully!");
    },
    onError: (error) => {
      toast.error(`Failed to generate: ${error.message}`);
    },
  });
  
  // Refinement mutation
  const refineMutation = trpc.outreach.generateEmail.useMutation({
    onSuccess: (data) => {
      const content = typeof data.content === 'string' ? data.content : '';
      const cleanContent = stripXmlReasoning(content);
      
      // Extract reasoning
      const reasoning = extractReasoning(content);
      if (reasoning) {
        setRawReasoning(reasoning);
      }
      
      setGeneratedEmail(cleanContent);
      setConversationHistory(prev => [
        ...prev,
        { role: 'assistant', content: cleanContent }
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
    
    // Build context with current email and refinement request
    const refinementPrompt = `Current email:\n\n${generatedEmail}\n\n---\n\nUser's adjustment request: ${refinementInput}\n\nPlease revise the email based on this feedback. Output ONLY the revised email, no explanations.`;
    
    refineMutation.mutate({
      accountIds: selectedAccountId ? [selectedAccountId] : [],
      contactIds: selectedContactId ? [selectedContactId] : [],
      prompt: refinementPrompt,
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
    let filtered = allContacts.filter(contact => 
      contact.accountId === selectedAccountId
    );
    
    // Sort by title relevance (security/IT roles first)
    const priorityTitles = ['ciso', 'cio', 'cto', 'vp', 'vice president', 'director', 'head', 'chief', 'security', 'it '];
    filtered.sort((a, b) => {
      const titleA = (a.title || '').toLowerCase();
      const titleB = (b.title || '').toLowerCase();
      const scoreA = priorityTitles.some(t => titleA.includes(t)) ? 1 : 0;
      const scoreB = priorityTitles.some(t => titleB.includes(t)) ? 1 : 0;
      return scoreB - scoreA;
    });
    
    // Apply search filter
    if (contactSearchQuery.trim()) {
      const query = contactSearchQuery.toLowerCase();
      filtered = filtered.filter(contact =>
        (contact.name && contact.name.toLowerCase().includes(query)) ||
        (contact.title && contact.title.toLowerCase().includes(query))
      );
    }
    
    return filtered.slice(0, 20); // Top 20 contacts max
  }, [allContacts, selectedAccountId, contactSearchQuery]);

  const selectedAccount = accounts?.find(a => a.id === selectedAccountId);
  const selectedContact = allContacts?.find(c => c.id === selectedContactId);

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
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-cyan-500" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      <Navigation />
      <div className="container py-8 max-w-7xl">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-white mb-2 flex items-center gap-3">
            <Sparkles className="h-10 w-10 text-cyan-400" />
            AI-Powered Outreach
          </h1>
          <p className="text-slate-400">Generate personalized emails using account intelligence</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left Column - Selection */}
          <div className="space-y-6">
            {/* Step 1: Select ONE Account */}
            <Card className="card-elevated">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <Building2 className="h-5 w-5 text-cyan-400" />
                  1. Select Target Account
                </CardTitle>
                <CardDescription>Choose ONE account (sorted by intent score)</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="mb-4">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <Input
                      placeholder="Search accounts..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-10 bg-slate-800/50 border-slate-700 text-white placeholder:text-slate-500"
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
                        className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-all ${
                          isSelected 
                            ? 'bg-cyan-600/30 border border-cyan-500' 
                            : 'bg-slate-800/50 hover:bg-slate-800 border border-transparent'
                        }`}
                      >
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-white truncate">{account.name}</div>
                          <div className="text-sm text-slate-400">{account.industry || "Unknown"}</div>
                        </div>
                        <Badge className={`${
                          intentScore >= 70 ? 'bg-red-500/20 text-red-400 border-red-500/30' :
                          intentScore >= 40 ? 'bg-orange-500/20 text-orange-400 border-orange-500/30' :
                          'bg-slate-500/20 text-slate-400 border-slate-500/30'
                        }`}>
                          {intentScore}
                        </Badge>
                      </div>
                    );
                  })}
                </div>
                {selectedAccount && (
                  <div className="mt-4 p-3 bg-cyan-900/30 rounded-lg border border-cyan-700">
                    <div className="text-sm text-cyan-300">Selected: <strong>{selectedAccount.name}</strong></div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Step 2: Select ONE Contact (only shows after account selected) */}
            <Card className={`card-elevated transition-opacity ${selectedAccountId ? 'opacity-100' : 'opacity-50 pointer-events-none'}`}>
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <Users className="h-5 w-5 text-purple-400" />
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
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                        <Input
                          placeholder="Search contacts..."
                          value={contactSearchQuery}
                          onChange={(e) => setContactSearchQuery(e.target.value)}
                          className="pl-10 bg-slate-800/50 border-slate-700 text-white placeholder:text-slate-500"
                        />
                      </div>
                    </div>
                    <div className="space-y-2 max-h-[250px] overflow-y-auto">
                      {filteredContacts.length === 0 ? (
                        <div className="text-center py-8 text-slate-500">
                          No contacts found for this account
                        </div>
                      ) : (
                        filteredContacts.map((contact) => {
                          const isSelected = selectedContactId === contact.id;
                          return (
                            <div
                              key={contact.id}
                              onClick={() => selectContact(contact.id)}
                              className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-all ${
                                isSelected 
                                  ? 'bg-purple-600/30 border border-purple-500' 
                                  : 'bg-slate-800/50 hover:bg-slate-800 border border-transparent'
                              }`}
                            >
                              <div className="flex-1 min-w-0">
                                <div className="font-medium text-white truncate">{contact.name}</div>
                                <div className="text-sm text-slate-400 truncate">{contact.title || "No title"}</div>
                                {contact.email && (
                                  <div className="text-xs text-slate-500 truncate">{contact.email}</div>
                                )}
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                    {selectedContact && (
                      <div className="mt-4 p-3 bg-purple-900/30 rounded-lg border border-purple-700">
                        <div className="text-sm text-purple-300">
                          Selected: <strong>{selectedContact.name}</strong>
                          {selectedContact.email && <span className="text-purple-400"> ({selectedContact.email})</span>}
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
                <CardTitle className="text-white">3. Add Context (Optional)</CardTitle>
                <CardDescription>Pain points, goals, messaging angle, or attach reference docs</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Textarea
                  placeholder="e.g., Focus on phishing prevention, mention recent breaches, emphasize passwordless benefits..."
                  value={context}
                  onChange={(e) => setContext(e.target.value)}
                  className="min-h-[100px] bg-slate-800/50 border-slate-700 text-white placeholder:text-slate-500"
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
                    className="border-slate-700 text-slate-300 hover:bg-slate-800"
                  >
                    <Paperclip className="h-4 w-4 mr-2" />
                    Attach Reference Docs (PDF, DOCX, PPTX)
                  </Button>
                  
                  {attachedFiles.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-2">
                      {attachedFiles.map((file, i) => (
                        <Badge key={i} variant="secondary" className="flex items-center gap-1 bg-slate-800">
                          <File className="h-3 w-3" />
                          <span className="max-w-[150px] truncate text-xs">{file.name}</span>
                          <button onClick={() => removeFile(i)} className="ml-1 hover:text-red-400">
                            <X className="h-3 w-3" />
                          </button>
                        </Badge>
                      ))}
                    </div>
                  )}
                  <p className="text-xs text-slate-500">Attach case studies, product docs, or competitor info to enhance the email</p>
                </div>
              </CardContent>
            </Card>

            {/* Generate Button */}
            <Button
              onClick={handleGenerate}
              disabled={generateMutation.isPending || !selectedAccountId}
              className="w-full bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-700 hover:to-blue-700 text-white py-6 text-lg"
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
                <Card className="bg-slate-900/50 border-slate-800">
                  <CollapsibleTrigger asChild>
                    <CardHeader className="cursor-pointer hover:bg-slate-800/30 transition-colors">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-white flex items-center gap-2">
                          <FileText className="h-5 w-5 text-amber-400" />
                          Strategy & Notes
                        </CardTitle>
                        {isStrategyOpen ? (
                          <ChevronUp className="h-5 w-5 text-slate-400" />
                        ) : (
                          <ChevronDown className="h-5 w-5 text-slate-400" />
                        )}
                      </div>
                      <CardDescription>Internal notes (not for sending)</CardDescription>
                    </CardHeader>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <CardContent>
                      <div className="whitespace-pre-wrap text-slate-400 bg-slate-800/50 p-4 rounded-lg border border-slate-700 text-sm">
                        {strategy}
                      </div>
                    </CardContent>
                  </CollapsibleContent>
                </Card>
              </Collapsible>
            )}

            {/* Generated Email */}
            <Card className="bg-slate-900/50 border-slate-800 sticky top-8">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-white flex items-center gap-2">
                    <Mail className="h-5 w-5 text-green-400" />
                    Ready-to-Send Email
                  </CardTitle>
                  {generatedEmail && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleCopy}
                      className="border-slate-700"
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
                    <div className="whitespace-pre-wrap text-slate-300 bg-slate-800/50 p-4 rounded-lg border border-slate-700">
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
                          className="flex-1 bg-slate-800/50 border-slate-700 text-white placeholder:text-slate-500"
                        />
                        <Button
                          onClick={handleRefine}
                          disabled={refineMutation.isPending || !refinementInput.trim()}
                          className="bg-purple-600 hover:bg-purple-700"
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
                      <p className="text-xs text-slate-500">Press Enter or click Refine to adjust the email</p>
                    </div>
                    
                    {/* View Reasoning (Optional) */}
                    {rawReasoning && (
                      <Collapsible open={isReasoningOpen} onOpenChange={setIsReasoningOpen}>
                        <CollapsibleTrigger className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-400">
                          {isReasoningOpen ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                          {isReasoningOpen ? 'Hide' : 'View'} AI reasoning
                        </CollapsibleTrigger>
                        <CollapsibleContent>
                          <div className="mt-2 p-3 bg-slate-900 rounded border border-slate-800 max-h-[200px] overflow-y-auto">
                            <code className="text-xs text-slate-500 whitespace-pre-wrap break-all">
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
                        className="flex-1 bg-red-600 hover:bg-red-700 text-white"
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
                        className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
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
                    <Sparkles className="h-12 w-12 text-slate-600 mb-4" />
                    <p className="text-slate-500">
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
