import { useState } from "react";
import { Navigation } from "@/components/Navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";
import { Mail, Sparkles, Copy, Download, Loader2, Check, X } from "lucide-react";
import { toast } from "sonner";

export default function BulkEmail() {
  const [selectedAccounts, setSelectedAccounts] = useState<number[]>([]);
  const [emailTemplate, setEmailTemplate] = useState("");
  const [generatedEmails, setGeneratedEmails] = useState<Array<{ accountId: number; accountName: string; email: string }>>([]);
  const [isGenerating, setIsGenerating] = useState(false);

  const { data: accounts } = trpc.accounts.list.useQuery();

  const toggleAccount = (accountId: number) => {
    setSelectedAccounts(prev =>
      prev.includes(accountId)
        ? prev.filter(id => id !== accountId)
        : [...prev, accountId]
    );
  };

  const generateEmails = async () => {
    if (selectedAccounts.length === 0) {
      toast.error("Please select at least one account");
      return;
    }

    setIsGenerating(true);
    const emails: Array<{ accountId: number; accountName: string; email: string }> = [];

    for (const accountId of selectedAccounts) {
      const account = accounts?.find(a => a.id === accountId);
      if (!account) continue;

      // Extract tech stack info
      let techStackInfo = "";
      if (account.techStack) {
        try {
          const stackData = typeof account.techStack === 'string' ? JSON.parse(account.techStack) : account.techStack;
          const techs = Array.isArray(stackData) ? stackData.slice(0, 5).join(", ") : "various technologies";
          techStackInfo = `Current tech stack includes: ${techs}`;
        } catch (e) {
          techStackInfo = "Tech stack data available";
        }
      }

      // Extract research insights
      let researchInfo = "";
      if (null) {
        try {
          const researchData = typeof null === 'string' ? JSON.parse(null) : null;
          researchInfo = JSON.stringify(researchData).substring(0, 200);
        } catch (e) {
          researchInfo = "Research insights available";
        }
      }

      // Generate personalized email
      const personalizedEmail = `Subject: Enhancing Security at ${account.name}

Hi there,

I noticed ${account.name} is in the ${account.industry || 'technology'} space${account.region ? ` with operations in ${account.region}` : ''}.

${techStackInfo ? `I see you're using ${techStackInfo}. ` : ''}Many companies in your industry are modernizing their authentication infrastructure to support zero-trust security models.

the company provides passwordless MFA that eliminates phishing attacks and reduces IT overhead by 70%. ${account.employeeCount ? `For organizations of your size (~${account.employeeCount} employees), ` : ''}we typically see deployment completed in under 30 days.

${researchInfo ? `Based on recent activity, it seems ${account.name} might be evaluating security solutions. ` : ''}Would you be open to a 15-minute conversation about how we're helping companies like ${account.name} strengthen their security posture?

Best regards,
[Your Name]
the company`;

      emails.push({
        accountId: account.id,
        accountName: account.name,
        email: personalizedEmail
      });
    }

    setGeneratedEmails(emails);
    setIsGenerating(false);
    toast.success(`Generated ${emails.length} personalized emails`);
  };

  const copyEmail = (email: string) => {
    navigator.clipboard.writeText(email);
    toast.success("Email copied to clipboard");
  };

  const copyAllEmails = () => {
    const allEmails = generatedEmails.map(e => `=== ${e.accountName} ===\n\n${e.email}`).join("\n\n---\n\n");
    navigator.clipboard.writeText(allEmails);
    toast.success(`Copied ${generatedEmails.length} emails to clipboard`);
  };

  const exportToCSV = () => {
    const csv = [
      ["Account Name", "Email Subject", "Email Body"],
      ...generatedEmails.map(e => {
        const lines = e.email.split('\n');
        const subject = lines[0].replace('Subject: ', '');
        const body = lines.slice(2).join(' ');
        return [e.accountName, subject, body];
      })
    ].map(row => row.map(cell => `"${cell.replace(/"/g, '""')}"`).join(',')).join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `bulk-emails-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    toast.success("Exported to CSV");
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      <Navigation />

      <div className="container py-8 space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-4xl font-bold text-white mb-2">Bulk Email Generator</h1>
          <p className="text-slate-400">
            Select accounts and generate personalized outreach emails using AI
          </p>
        </div>

        {/* Account Selection */}
        <Card className="bg-slate-900/50 border-slate-800">
          <CardHeader>
            <CardTitle className="text-white flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Mail className="h-5 w-5 text-cyan-500" />
                Select Target Accounts
              </span>
              <Badge variant="outline" className="border-cyan-500/30 text-cyan-400">
                {selectedAccounts.length} selected
              </Badge>
            </CardTitle>
            <CardDescription className="text-slate-400">
              Choose accounts to generate personalized emails for
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-3 gap-3 max-h-96 overflow-y-auto">
              {accounts?.slice(0, 50).map(account => (
                <div
                  key={account.id}
                  onClick={() => toggleAccount(account.id)}
                  className={`p-3 rounded-lg border cursor-pointer transition-all ${
                    selectedAccounts.includes(account.id)
                      ? 'bg-cyan-500/20 border-cyan-500'
                      : 'bg-slate-950/50 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <h4 className="font-semibold text-white text-sm truncate">{account.name}</h4>
                      <p className="text-xs text-slate-400 truncate">{account.industry}</p>
                    </div>
                    {selectedAccounts.includes(account.id) && (
                      <Check className="h-4 w-4 text-cyan-400 shrink-0" />
                    )}
                  </div>
                  {account.intentScore && (
                    <Badge className="mt-2 text-xs bg-green-500/20 text-green-400 border-green-500/50">
                      Intent: {account.intentScore}
                    </Badge>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Generate Button */}
        <div className="flex items-center gap-4">
          <Button
            onClick={generateEmails}
            disabled={isGenerating || selectedAccounts.length === 0}
            className="bg-cyan-600 hover:bg-cyan-700 gap-2"
            size="lg"
          >
            {isGenerating ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Sparkles className="h-5 w-5" />
                Generate {selectedAccounts.length} Personalized Email{selectedAccounts.length !== 1 ? 's' : ''}
              </>
            )}
          </Button>

          {generatedEmails.length > 0 && (
            <>
              <Button
                onClick={copyAllEmails}
                variant="outline"
                className="border-slate-700 text-slate-300 gap-2"
              >
                <Copy className="h-4 w-4" />
                Copy All
              </Button>
              <Button
                onClick={exportToCSV}
                variant="outline"
                className="border-slate-700 text-slate-300 gap-2"
              >
                <Download className="h-4 w-4" />
                Export CSV
              </Button>
            </>
          )}
        </div>

        {/* Generated Emails */}
        {generatedEmails.length > 0 && (
          <Card className="bg-slate-900/50 border-slate-800">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <Mail className="h-5 w-5 text-cyan-500" />
                Generated Emails ({generatedEmails.length})
              </CardTitle>
              <CardDescription className="text-slate-400">
                Review and copy personalized emails for each account
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {generatedEmails.map((item, index) => (
                  <div key={index} className="p-4 bg-slate-950/50 rounded-lg border border-slate-800">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="font-semibold text-white">{item.accountName}</h4>
                      <Button
                        onClick={() => copyEmail(item.email)}
                        variant="ghost"
                        size="sm"
                        className="text-cyan-400 hover:text-cyan-300"
                      >
                        <Copy className="h-4 w-4 mr-1" />
                        Copy
                      </Button>
                    </div>
                    <pre className="text-sm text-slate-300 whitespace-pre-wrap font-sans">
                      {item.email}
                    </pre>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
