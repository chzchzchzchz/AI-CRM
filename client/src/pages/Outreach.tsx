import { useState, useMemo, useRef } from "react";
import { Navigation } from "@/components/Navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Sparkles, Building2, Loader2, Copy, Check, Search, Users, Paperclip, X, FileText, File, Mail, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";

interface Attachment {
  name: string;
  size: number;
  type: string;
  file: File;
}

export default function Outreach() {
  const { data: accounts, isLoading } = trpc.accounts.list.useQuery();
  const { data: contacts } = trpc.people.list.useQuery();
  
  // Single selection - only one account and one contact at a time
  const [selectedAccountId, setSelectedAccountId] = useState<number | null>(null);
  const [selectedContactId, setSelectedContactId] = useState<number | null>(null);
  const [context, setContext] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [contactSearchQuery, setContactSearchQuery] = useState("");
  const [generatedContent, setGeneratedContent] = useState("");
  const [generatedSubject, setGeneratedSubject] = useState("");
  const [recipientEmail, setRecipientEmail] = useState("");
  const [copied, setCopied] = useState(false);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const generateMutation = trpc.outreach.generateEmail.useMutation({
    onSuccess: (data: any) => {
      const content = typeof data.content === 'string' ? data.content : '';
      if (data.subject) {
        setGeneratedSubject(data.subject);
      } else {
        const selectedAccount = accounts?.find(a => a.id === selectedAccountId);
        setGeneratedSubject(selectedAccount ? `Security at ${selectedAccount.name}` : 'Quick question');
      }
      setGeneratedContent(content.trim());
      
      // Auto-fill recipient if a contact is selected
      if (selectedContactId) {
        const selectedContact = contacts?.find(c => c.id === selectedContactId);
        if (selectedContact?.email) {
          setRecipientEmail(selectedContact.email);
        }
      }
      
      toast.success("Email generated!");
    },
    onError: (error) => {
      toast.error(`Failed to generate: ${error.message}`);
    },
  });

  const handleGenerate = () => {
    if (!selectedAccountId) {
      toast.error("Please select an account");
      return;
    }

    let enhancedContext = context;
    if (attachments.length > 0) {
      const attachmentList = attachments.map(a => a.name).join(", ");
      enhancedContext = `${context}\n\n[ATTACHMENTS TO REFERENCE: ${attachmentList}]`;
    }

    generateMutation.mutate({
      accountIds: [selectedAccountId],
      contactIds: selectedContactId ? [selectedContactId] : [],
      prompt: enhancedContext || undefined,
    });
  };

  const handleCopy = () => {
    const fullEmail = `Subject: ${generatedSubject}\n\n${generatedContent}`;
    navigator.clipboard.writeText(fullEmail);
    setCopied(true);
    toast.success("Email copied to clipboard!");
    setTimeout(() => setCopied(false), 2000);
  };

  const handleOpenInGmail = () => {
    if (!recipientEmail) {
      toast.error("Please enter a recipient email address");
      return;
    }
    const gmailUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(recipientEmail)}&su=${encodeURIComponent(generatedSubject)}&body=${encodeURIComponent(generatedContent)}`;
    window.open(gmailUrl, '_blank');
  };

  const handleOpenInOutlook = () => {
    if (!recipientEmail) {
      toast.error("Please enter a recipient email address");
      return;
    }
    const outlookUrl = `https://outlook.office.com/mail/deeplink/compose?to=${encodeURIComponent(recipientEmail)}&subject=${encodeURIComponent(generatedSubject)}&body=${encodeURIComponent(generatedContent)}`;
    window.open(outlookUrl, '_blank');
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    const newAttachments: Attachment[] = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (file.size > 10 * 1024 * 1024) {
        toast.error(`${file.name} is too large. Max 10MB.`);
        continue;
      }
      newAttachments.push({
        name: file.name,
        size: file.size,
        type: file.type,
        file: file,
      });
    }

    setAttachments(prev => [...prev, ...newAttachments]);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const removeAttachment = (index: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== index));
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const getFileIcon = (type: string) => {
    if (type.includes('pdf')) return <FileText className="h-4 w-4 text-red-400" />;
    return <File className="h-4 w-4 text-slate-400" />;
  };

  // Single selection for account
  const selectAccount = (id: number) => {
    if (selectedAccountId === id) {
      // Deselect
      setSelectedAccountId(null);
      setSelectedContactId(null); // Clear contact when account is deselected
    } else {
      setSelectedAccountId(id);
      setSelectedContactId(null); // Clear contact when switching accounts
    }
  };

  // Single selection for contact - also auto-selects their account
  const selectContact = (id: number, accountId: number | null) => {
    if (selectedContactId === id) {
      // Deselect
      setSelectedContactId(null);
    } else {
      setSelectedContactId(id);
      // Auto-select the contact's account if different
      if (accountId && accountId !== selectedAccountId) {
        setSelectedAccountId(accountId);
      }
      // Auto-fill email
      const contact = contacts?.find(c => c.id === id);
      if (contact?.email) {
        setRecipientEmail(contact.email);
      }
    }
  };

  // Filter and sort accounts - hot leads first, filter out invalid names
  const filteredAccounts = useMemo(() => {
    if (!accounts) return [];
    
    // Filter out invalid account names
    const invalidNames = ['CHECK', '#N/A', 'Unknown', 'MATCH', 'N/A', ''];
    let filtered = accounts.filter(account => 
      account.name && 
      !invalidNames.includes(account.name.trim()) &&
      !account.name.startsWith('#')
    );
    
    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(account =>
        account.name.toLowerCase().includes(query) ||
        (account.industry && account.industry.toLowerCase().includes(query))
      );
    }
    
    // Sort by intent score (highest first)
    return filtered.sort((a, b) => (b.intentScore || 0) - (a.intentScore || 0));
  }, [accounts, searchQuery]);

  // Only show contacts when an account is selected
  const filteredContacts = useMemo(() => {
    if (!contacts || !selectedAccountId) return [];
    
    // Filter to only contacts from selected account
    let filtered = contacts.filter(contact => 
      contact.accountId === selectedAccountId
    );
    
    // Apply search filter
    if (contactSearchQuery.trim()) {
      const query = contactSearchQuery.toLowerCase();
      filtered = filtered.filter(contact =>
        (contact.name && contact.name.toLowerCase().includes(query)) ||
        (contact.title && contact.title.toLowerCase().includes(query))
      );
    }
    
    return filtered;
  }, [contacts, contactSearchQuery, selectedAccountId]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-cyan-500" />
      </div>
    );
  }

  const selectedAccount = accounts?.find(a => a.id === selectedAccountId);
  const selectedContact = contacts?.find(c => c.id === selectedContactId);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      <Navigation />
      <main className="container py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white flex items-center gap-3">
            <Sparkles className="h-8 w-8 text-purple-400" />
            AI-Powered Outreach
          </h1>
          <p className="text-slate-400 mt-2">Generate personalized emails using account data and AI</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left Column - Selection */}
          <div className="space-y-6">
            {/* Account Selection */}
            <Card className="bg-slate-900/50 border-slate-800">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2 text-white">
                  <Building2 className="h-5 w-5 text-cyan-400" />
                  1. Select Target Account
                </CardTitle>
                <CardDescription>Choose one account to personalize outreach</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="relative mb-3">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                  <Input
                    placeholder="Search accounts by name or industry..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9 bg-slate-800/50 border-slate-700 text-white"
                  />
                </div>
                <div className="max-h-64 overflow-y-auto space-y-1">
                  {filteredAccounts.slice(0, 50).map((account) => (
                    <div
                      key={account.id}
                      onClick={() => selectAccount(account.id)}
                      className={`flex items-center justify-between p-2 rounded-lg cursor-pointer transition-colors ${
                        selectedAccountId === account.id
                          ? "bg-cyan-500/20 border border-cyan-500/50"
                          : "hover:bg-slate-800/50"
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                          selectedAccountId === account.id ? "bg-cyan-400" : "bg-slate-600"
                        }`} />
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-white truncate">{account.name}</p>
                          <p className="text-xs text-slate-500 truncate">
                            {account.industry && account.industry !== 'MATCH' ? account.industry : 'Unknown Industry'}
                          </p>
                        </div>
                      </div>
                      {(account.intentScore || 0) >= 70 && (
                        <Badge variant="outline" className="bg-orange-500/20 text-orange-400 border-orange-500/50 flex-shrink-0 ml-2">
                          {account.intentScore} Hot
                        </Badge>
                      )}
                    </div>
                  ))}
                </div>
                <p className="text-xs text-slate-500 mt-2">
                  {selectedAccountId ? "1 account selected" : "0 accounts selected"}
                </p>
              </CardContent>
            </Card>

            {/* Contact Selection - Only shows when account is selected */}
            <Card className="bg-slate-900/50 border-slate-800">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2 text-white">
                  <Users className="h-5 w-5 text-purple-400" />
                  2. Select Contact (Optional)
                </CardTitle>
                <CardDescription>
                  {selectedAccountId 
                    ? `Choose a decision maker from ${selectedAccount?.name || 'selected account'}`
                    : "Select an account first to see contacts"
                  }
                </CardDescription>
              </CardHeader>
              <CardContent>
                {selectedAccountId ? (
                  <>
                    <div className="relative mb-3">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                      <Input
                        placeholder="Search contacts by name or title..."
                        value={contactSearchQuery}
                        onChange={(e) => setContactSearchQuery(e.target.value)}
                        className="pl-9 bg-slate-800/50 border-slate-700 text-white"
                      />
                    </div>
                    <div className="max-h-48 overflow-y-auto space-y-1">
                      {filteredContacts.length === 0 ? (
                        <p className="text-sm text-slate-500 text-center py-4">
                          No contacts found for this account
                        </p>
                      ) : (
                        filteredContacts.slice(0, 30).map((contact) => (
                          <div
                            key={contact.id}
                            onClick={() => selectContact(contact.id, contact.accountId)}
                            className={`flex items-center gap-3 p-2 rounded-lg cursor-pointer transition-colors ${
                              selectedContactId === contact.id
                                ? "bg-purple-500/20 border border-purple-500/50"
                                : "hover:bg-slate-800/50"
                            }`}
                          >
                            <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                              selectedContactId === contact.id ? "bg-purple-400" : "bg-slate-600"
                            }`} />
                            <div className="min-w-0">
                              <p className="text-sm font-medium text-white truncate">{contact.name}</p>
                              <p className="text-xs text-slate-500 truncate">{contact.title}</p>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                    <p className="text-xs text-slate-500 mt-2">
                      {selectedContactId ? "1 contact selected" : `${filteredContacts.length} contacts available`}
                    </p>
                  </>
                ) : (
                  <div className="text-center py-8 text-slate-500">
                    <Users className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">Select an account to see available contacts</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Attachments */}
            <Card className="bg-slate-900/50 border-slate-800">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2 text-white">
                  <Paperclip className="h-5 w-5 text-amber-400" />
                  3. Add Attachments (Optional)
                </CardTitle>
                <CardDescription>Attach case studies, one-pagers, or other collateral</CardDescription>
              </CardHeader>
              <CardContent>
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileSelect}
                  multiple
                  accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.txt,.md"
                  className="hidden"
                />
                <Button
                  variant="outline"
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full border-dashed border-slate-700 text-slate-400 hover:text-white hover:border-slate-600"
                >
                  <Paperclip className="h-4 w-4 mr-2" />
                  Click to add attachments
                </Button>
                {attachments.length > 0 && (
                  <div className="mt-3 space-y-2">
                    {attachments.map((attachment, index) => (
                      <div key={index} className="flex items-center justify-between p-2 bg-slate-800/50 rounded-lg">
                        <div className="flex items-center gap-2 min-w-0">
                          {getFileIcon(attachment.type)}
                          <span className="text-sm text-white truncate">{attachment.name}</span>
                          <span className="text-xs text-slate-500">({formatFileSize(attachment.size)})</span>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeAttachment(index)}
                          className="h-6 w-6 p-0 text-slate-400 hover:text-red-400"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Context */}
            <Card className="bg-slate-900/50 border-slate-800">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg text-white">4. Add Context (Optional)</CardTitle>
                <CardDescription>Describe pain points, goals, or specific messaging</CardDescription>
              </CardHeader>
              <CardContent>
                <Textarea
                  placeholder="e.g., Focus on phishing prevention, mention recent breaches, emphasize passwordless benefits..."
                  value={context}
                  onChange={(e) => setContext(e.target.value)}
                  className="min-h-[100px] bg-slate-800/50 border-slate-700 text-white"
                />
              </CardContent>
            </Card>

            <Button
              onClick={handleGenerate}
              disabled={!selectedAccountId || generateMutation.isPending}
              className="w-full bg-gradient-to-r from-purple-600 to-cyan-600 hover:from-purple-500 hover:to-cyan-500 text-white"
            >
              {generateMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Sparkles className="mr-2 h-4 w-4" />
                  Generate Personalized Email
                </>
              )}
            </Button>
          </div>

          {/* Right Column - Generated Content */}
          <Card className="bg-slate-900/50 border-slate-800 h-fit sticky top-4">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2 text-white">
                <Mail className="h-5 w-5 text-cyan-400" />
                Generated Email
              </CardTitle>
              <CardDescription>Review and send via your email client</CardDescription>
            </CardHeader>
            <CardContent>
              {generatedContent ? (
                <div className="space-y-4">
                  {/* To Field */}
                  <div>
                    <label className="text-xs text-slate-400 mb-1 block">To:</label>
                    <Input
                      type="email"
                      placeholder="recipient@company.com"
                      value={recipientEmail}
                      onChange={(e) => setRecipientEmail(e.target.value)}
                      className="bg-slate-800/50 border-slate-700 text-white"
                    />
                  </div>

                  {/* Subject Field */}
                  <div>
                    <label className="text-xs text-slate-400 mb-1 block">Subject:</label>
                    <Input
                      type="text"
                      placeholder="Email subject"
                      value={generatedSubject}
                      onChange={(e) => setGeneratedSubject(e.target.value)}
                      className="bg-slate-800/50 border-slate-700 text-white"
                    />
                  </div>

                  {/* Body */}
                  <div>
                    <label className="text-xs text-slate-400 mb-1 block">Body:</label>
                    <Textarea
                      value={generatedContent}
                      onChange={(e) => setGeneratedContent(e.target.value)}
                      className="min-h-[200px] bg-slate-800/50 border-slate-700 text-white font-mono text-sm"
                    />
                  </div>

                  {/* Action Buttons */}
                  <div className="flex flex-col gap-2">
                    <div className="flex gap-2">
                      <Button
                        onClick={handleOpenInGmail}
                        className="flex-1 bg-red-600 hover:bg-red-500 text-white"
                      >
                        <ExternalLink className="mr-2 h-4 w-4" />
                        Open in Gmail
                      </Button>
                      <Button
                        onClick={handleOpenInOutlook}
                        className="flex-1 bg-blue-600 hover:bg-blue-500 text-white"
                      >
                        <ExternalLink className="mr-2 h-4 w-4" />
                        Open in Outlook
                      </Button>
                    </div>
                    <Button
                      variant="outline"
                      onClick={handleCopy}
                      className="w-full border-slate-700 text-slate-300 hover:text-white"
                    >
                      {copied ? (
                        <>
                          <Check className="mr-2 h-4 w-4" />
                          Copied!
                        </>
                      ) : (
                        <>
                          <Copy className="mr-2 h-4 w-4" />
                          Copy to Clipboard
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="text-center py-12 text-slate-500">
                  <Sparkles className="h-12 w-12 mx-auto mb-4 opacity-30" />
                  <p>Select an account and click Generate to create personalized content</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
