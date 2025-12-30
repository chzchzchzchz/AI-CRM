import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Navigation } from "@/components/Navigation";
import { AIAssistant } from "@/components/AIAssistant";
import { trpc } from "@/lib/trpc";
import { 
  Mail, Sparkles, Loader2, Copy, Check, User, Building2, 
  RefreshCw, Send, FileText, Zap
} from "lucide-react";
import { toast } from "sonner";
import { Streamdown } from "streamdown";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export default function EmailGenerator() {
  const [selectedAccountId, setSelectedAccountId] = useState<number | null>(null);
  const [selectedContactId, setSelectedContactId] = useState<number | null>(null);
  const [additionalContext, setAdditionalContext] = useState("");
  const [generatedEmail, setGeneratedEmail] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const { data: accounts } = trpc.accounts.list.useQuery();
  const { data: allContacts } = trpc.people.list.useQuery();
  
  const selectedAccount = accounts?.find(a => a.id === selectedAccountId);
  const contactsForAccount = allContacts?.filter(c => c.company === selectedAccount?.name);

  const generateEmailMutation = trpc.ai.generateEmail.useMutation();

  const handleGenerate = async () => {
    if (!selectedAccountId || !selectedContactId) {
      toast.error("Please select both an account and a contact");
      return;
    }

    try {
      const result = await generateEmailMutation.mutateAsync({
        accountId: selectedAccountId,
        contactId: selectedContactId,
        context: additionalContext || undefined
      });
      setGeneratedEmail(result);
      toast.success("Email generated successfully!");
    } catch (error) {
      toast.error("Failed to generate email");
    }
  };

  const copyToClipboard = () => {
    if (generatedEmail) {
      navigator.clipboard.writeText(generatedEmail);
      setCopied(true);
      toast.success("Email copied to clipboard");
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      <Navigation />
      <AIAssistant context={{ type: "general" }} />
      
      <div className="container py-8 space-y-6 max-w-5xl">
        {/* Header */}
        <div>
          <h1 className="text-4xl font-bold text-white mb-2">AI Email Generator</h1>
          <p className="text-slate-400">
            Generate personalized outreach emails using AI and account intelligence
          </p>
        </div>

        {/* Configuration */}
        <Card className="bg-slate-900/50 border-slate-800">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <Zap className="h-5 w-5 text-cyan-500" />
              Email Configuration
            </CardTitle>
            <CardDescription className="text-slate-400">
              Select target account and contact for personalized outreach
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              {/* Account Selection */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-300">Target Account</label>
                <Select 
                  value={selectedAccountId?.toString() || ""} 
                  onValueChange={(val) => {
                    setSelectedAccountId(parseInt(val));
                    setSelectedContactId(null);
                  }}
                >
                  <SelectTrigger className="bg-slate-950 border-slate-700 text-white">
                    <SelectValue placeholder="Select an account..." />
                  </SelectTrigger>
                  <SelectContent>
                    {accounts?.map(account => (
                      <SelectItem key={account.id} value={account.id.toString()}>
                        <div className="flex items-center gap-2">
                          <Building2 className="h-4 w-4" />
                          {account.name}
                          {account.intentScore && parseInt(account.intentScore) >= 70 && (
                            <Badge variant="outline" className="border-green-500/30 text-green-400 ml-2">
                              Hot
                            </Badge>
                          )}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {selectedAccount && (
                  <div className="text-xs text-slate-500 mt-1">
                    {selectedAccount.industry} • {selectedAccount.employeeCount} employees
                  </div>
                )}
              </div>

              {/* Contact Selection */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-300">Target Contact</label>
                <Select 
                  value={selectedContactId?.toString() || ""} 
                  onValueChange={(val) => setSelectedContactId(parseInt(val))}
                  disabled={!selectedAccountId}
                >
                  <SelectTrigger className="bg-slate-950 border-slate-700 text-white">
                    <SelectValue placeholder={selectedAccountId ? "Select a contact..." : "Select account first"} />
                  </SelectTrigger>
                  <SelectContent>
                    {contactsForAccount?.map(contact => (
                      <SelectItem key={contact.id} value={contact.id.toString()}>
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4" />
                          {contact.name}
                          {contact.title && (
                            <span className="text-xs text-slate-500">• {contact.title}</span>
                          )}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Additional Context */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-300">
                Additional Context (Optional)
              </label>
              <Textarea
                placeholder="Add any specific talking points, recent events, or personalization details..."
                value={additionalContext}
                onChange={(e) => setAdditionalContext(e.target.value)}
                className="bg-slate-950 border-slate-700 text-white placeholder:text-slate-500 min-h-24"
              />
            </div>

            {/* Generate Button */}
            <Button
              onClick={handleGenerate}
              disabled={!selectedAccountId || !selectedContactId || generateEmailMutation.isPending}
              className="w-full bg-cyan-600 hover:bg-cyan-700"
              size="lg"
            >
              {generateEmailMutation.isPending ? (
                <>
                  <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                  Generating Email...
                </>
              ) : (
                <>
                  <Sparkles className="h-5 w-5 mr-2" />
                  Generate Personalized Email
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Generated Email */}
        {generatedEmail && (
          <Card className="bg-gradient-to-br from-cyan-950/20 to-blue-950/20 border-cyan-500/30">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-white flex items-center gap-2">
                  <Mail className="h-5 w-5 text-cyan-400" />
                  Generated Email
                </CardTitle>
                <div className="flex gap-2">
                  <Button
                    onClick={handleGenerate}
                    variant="outline"
                    size="sm"
                    className="border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/10"
                  >
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Regenerate
                  </Button>
                  <Button
                    onClick={copyToClipboard}
                    variant="outline"
                    size="sm"
                    className="border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/10"
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
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="bg-slate-950/50 p-6 rounded-lg border border-cyan-500/20">
                <Streamdown className="text-slate-300 leading-relaxed whitespace-pre-wrap">
                  {generatedEmail}
                </Streamdown>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Tips */}
        <Card className="bg-slate-900/50 border-slate-800">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2 text-lg">
              <FileText className="h-5 w-5 text-cyan-500" />
              Email Generation Tips
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 text-sm text-slate-300">
              <div className="flex items-start gap-3">
                <div className="p-1.5 bg-cyan-500/10 rounded shrink-0 mt-0.5">
                  <Sparkles className="h-4 w-4 text-cyan-400" />
                </div>
                <div>
                  <p className="font-semibold text-white mb-1">AI uses account intelligence</p>
                  <p className="text-slate-400">
                    The generator automatically pulls tech stack, buying signals, recent calls, and 6sense data to personalize your email.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="p-1.5 bg-purple-500/10 rounded shrink-0 mt-0.5">
                  <User className="h-4 w-4 text-purple-400" />
                </div>
                <div>
                  <p className="font-semibold text-white mb-1">Contact-specific personalization</p>
                  <p className="text-slate-400">
                    Emails reference the contact's title, company role, and any previous conversations from Gong calls.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="p-1.5 bg-green-500/10 rounded shrink-0 mt-0.5">
                  <Zap className="h-4 w-4 text-green-400" />
                </div>
                <div>
                  <p className="font-semibold text-white mb-1">Add context for better results</p>
                  <p className="text-slate-400">
                    Include recent news, mutual connections, or specific pain points in the context field for highly targeted messaging.
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
