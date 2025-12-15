import { useState, useMemo, useRef } from "react";
import { Navigation } from "@/components/Navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Sparkles, Building2, Loader2, Copy, Check, Search, Users, Paperclip, X, FileText, File } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { Checkbox } from "@/components/ui/checkbox";

interface Attachment {
  name: string;
  size: number;
  type: string;
  file: File;
}

export default function Outreach() {
  const { data: accounts, isLoading } = trpc.accounts.list.useQuery();
  const { data: contacts } = trpc.people.list.useQuery();
  
  const [selectedAccounts, setSelectedAccounts] = useState<number[]>([]);
  const [selectedContacts, setSelectedContacts] = useState<number[]>([]);
  const [context, setContext] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [contactSearchQuery, setContactSearchQuery] = useState("");
  const [generatedContent, setGeneratedContent] = useState("");
  const [copied, setCopied] = useState(false);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const generateMutation = trpc.outreach.generateEmail.useMutation({
    onSuccess: (data) => {
      setGeneratedContent(typeof data.content === 'string' ? data.content : '');
      toast.success("Email generated successfully!");
    },
    onError: (error) => {
      toast.error(`Failed to generate: ${error.message}`);
    },
  });

  const handleGenerate = () => {
    if (selectedAccounts.length === 0) {
      toast.error("Please select at least one account");
      return;
    }

    // Include attachment names in the context for AI to reference
    let enhancedContext = context;
    if (attachments.length > 0) {
      const attachmentList = attachments.map(a => a.name).join(", ");
      enhancedContext = `${context}\n\n[ATTACHMENTS TO REFERENCE: ${attachmentList}]`;
    }

    generateMutation.mutate({
      accountIds: selectedAccounts,
      contactIds: selectedContacts,
      prompt: enhancedContext || undefined,
    });
  };

  const handleCopy = () => {
    // Include attachment note in copied content
    let copyContent = generatedContent;
    if (attachments.length > 0) {
      copyContent += `\n\n---\nAttachments:\n${attachments.map(a => `• ${a.name}`).join('\n')}`;
    }
    navigator.clipboard.writeText(copyContent);
    setCopied(true);
    toast.success("Copied to clipboard!");
    setTimeout(() => setCopied(false), 2000);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    const newAttachments: Attachment[] = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      // Limit file size to 10MB
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
    // Reset input
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

  const toggleAccount = (id: number) => {
    setSelectedAccounts(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const toggleContact = (id: number) => {
    setSelectedContacts(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const filteredAccounts = useMemo(() => {
    if (!accounts) return [];
    if (!searchQuery.trim()) return accounts;
    const query = searchQuery.toLowerCase();
    return accounts.filter(account =>
      account.name.toLowerCase().includes(query) ||
      (account.industry && account.industry.toLowerCase().includes(query))
    );
  }, [accounts, searchQuery]);

  const filteredContacts = useMemo(() => {
    if (!contacts) return [];
    
    // Filter by selected accounts first
    let filtered = contacts;
    if (selectedAccounts.length > 0) {
      filtered = contacts.filter(contact => 
        contact.accountId && selectedAccounts.includes(contact.accountId)
      );
    }
    
    // Then apply search query
    if (!contactSearchQuery.trim()) return filtered;
    const query = contactSearchQuery.toLowerCase();
    return filtered.filter(contact =>
      (contact.name && contact.name.toLowerCase().includes(query)) ||
      (contact.title && contact.title.toLowerCase().includes(query))
    );
  }, [contacts, contactSearchQuery, selectedAccounts, accounts]);

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
          <p className="text-slate-400">Generate personalized emails using account data and AI</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left Column - Selection */}
          <div className="space-y-6">
            {/* Step 1: Select Accounts */}
            <Card className="card-elevated">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <Building2 className="h-5 w-5 text-cyan-400" />
                  1. Select Target Accounts
                </CardTitle>
                <CardDescription>Choose accounts to personalize outreach</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="mb-4">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <Input
                      placeholder="Search accounts by name or industry..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-10 bg-slate-800/50 border-slate-700 text-white placeholder:text-slate-500"
                    />
                  </div>
                </div>
                <div className="space-y-2 max-h-[400px] overflow-y-auto">
                  {filteredAccounts.map((account) => (
                    <div
                      key={account.id}
                      className="flex items-center gap-3 p-3 rounded-lg bg-slate-800/50 hover:bg-slate-800 transition-colors"
                    >
                      <Checkbox
                        checked={selectedAccounts.includes(account.id)}
                        onCheckedChange={() => toggleAccount(account.id)}
                        className="cursor-pointer"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-white truncate">{account.name}</div>
                        <div className="text-sm text-slate-400">{account.industry || "Unknown"}</div>
                      </div>
                      {account.intentScore && Number(account.intentScore) >= 70 && (
                        <Badge className="bg-green-500/20 text-green-400 border-green-500/30">
                          Hot
                        </Badge>
                      )}
                    </div>
                  ))}
                </div>
                <div className="mt-4 text-sm text-slate-400">
                  {selectedAccounts.length} account{selectedAccounts.length !== 1 ? 's' : ''} selected
                </div>
              </CardContent>
            </Card>

            {/* Step 2: Select Contacts (Optional) */}
            <Card className="card-elevated">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <Users className="h-5 w-5 text-purple-400" />
                  2. Select Contacts (Optional)
                </CardTitle>
                <CardDescription>Choose specific decision makers to personalize for</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="mb-4">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <Input
                      placeholder="Search contacts by name or title..."
                      value={contactSearchQuery}
                      onChange={(e) => setContactSearchQuery(e.target.value)}
                      className="pl-10 bg-slate-800/50 border-slate-700 text-white placeholder:text-slate-500"
                    />
                  </div>
                </div>
                <div className="space-y-2 max-h-[300px] overflow-y-auto">
                  {filteredContacts.slice(0, 50).map((contact) => (
                    <div
                      key={contact.id}
                      className="flex items-center gap-3 p-3 rounded-lg bg-slate-800/50 hover:bg-slate-800 transition-colors"
                    >
                      <Checkbox
                        checked={selectedContacts.includes(contact.id)}
                        onCheckedChange={() => toggleContact(contact.id)}
                        className="cursor-pointer"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-white truncate">{contact.name}</div>
                        <div className="text-sm text-slate-400 truncate">{contact.title || "No title"}</div>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mt-4 text-sm text-slate-400">
                  {selectedContacts.length} contact{selectedContacts.length !== 1 ? 's' : ''} selected
                </div>
              </CardContent>
            </Card>

            {/* Step 3: Add Attachments */}
            <Card className="card-elevated">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <Paperclip className="h-5 w-5 text-orange-400" />
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
                  accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.png,.jpg,.jpeg"
                  className="hidden"
                />
                <Button
                  variant="outline"
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full border-dashed border-2 border-slate-600 hover:border-orange-500 bg-slate-800/30 text-slate-300 hover:text-white py-6"
                >
                  <Paperclip className="h-5 w-5 mr-2" />
                  Click to add attachments
                </Button>
                
                {attachments.length > 0 && (
                  <div className="mt-4 space-y-2">
                    {attachments.map((attachment, index) => (
                      <div
                        key={index}
                        className="flex items-center gap-3 p-3 rounded-lg bg-slate-800/50 border border-slate-700"
                      >
                        {getFileIcon(attachment.type)}
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-white truncate text-sm">{attachment.name}</div>
                          <div className="text-xs text-slate-500">{formatFileSize(attachment.size)}</div>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeAttachment(index)}
                          className="h-8 w-8 p-0 text-slate-400 hover:text-red-400"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                    <p className="text-xs text-slate-500 mt-2">
                      AI will reference these attachments in the generated email
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Step 4: Optional Context */}
            <Card className="card-elevated">
              <CardHeader>
                <CardTitle className="text-white">4. Add Context (Optional)</CardTitle>
                <CardDescription>Describe pain points, goals, or specific messaging</CardDescription>
              </CardHeader>
              <CardContent>
                <Textarea
                  placeholder="e.g., Focus on phishing prevention, mention recent breaches, emphasize passwordless benefits..."
                  value={context}
                  onChange={(e) => setContext(e.target.value)}
                  className="min-h-[120px] bg-slate-800/50 border-slate-700 text-white placeholder:text-slate-500"
                />
              </CardContent>
            </Card>

            {/* Step 5: Generate */}
            <Button
              onClick={handleGenerate}
              disabled={generateMutation.isPending || selectedAccounts.length === 0}
              className="w-full bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-700 hover:to-blue-700 text-white py-6 text-lg"
            >
              {generateMutation.isPending ? (
                <>
                  <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                  Generating...
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
          <div>
            <Card className="bg-slate-900/50 border-slate-800 sticky top-8">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-white">Generated Email</CardTitle>
                  {generatedContent && (
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
                <CardDescription>AI-personalized using account data</CardDescription>
              </CardHeader>
              <CardContent>
                {generatedContent ? (
                  <div className="prose prose-invert max-w-none">
                    <div className="whitespace-pre-wrap text-slate-300 bg-slate-800/50 p-4 rounded-lg border border-slate-700">
                      {generatedContent}
                    </div>
                    {attachments.length > 0 && (
                      <div className="mt-4 p-3 bg-orange-500/10 border border-orange-500/30 rounded-lg">
                        <p className="text-sm text-orange-400 font-medium mb-2">
                          <Paperclip className="h-4 w-4 inline mr-1" />
                          Attachments to include:
                        </p>
                        <ul className="text-sm text-slate-400 space-y-1">
                          {attachments.map((a, i) => (
                            <li key={i}>• {a.name}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <Sparkles className="h-12 w-12 text-slate-600 mb-4" />
                    <p className="text-slate-500">
                      Select accounts and click Generate to create personalized content
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
