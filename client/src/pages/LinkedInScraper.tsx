import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { 
  Linkedin, 
  Users, 
  AlertTriangle, 
  Play, 
  Clock, 
  Shield,
  ExternalLink,
  Copy,
  CheckCircle,
  XCircle,
  Info
} from "lucide-react";

export default function LinkedInScraper() {
  const [selectedAccounts, setSelectedAccounts] = useState<number[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  
  const { data: status, isLoading } = trpc.linkedinScraper.getStatus.useQuery();
  const { data: queue } = trpc.linkedinScraper.getScrapingQueue.useQuery({ limit: 20 });
  const { data: instructions } = trpc.linkedinScraper.getInstructions.useQuery();
  
  const generateCommands = trpc.linkedinScraper.generateScrapeCommands.useMutation({
    onSuccess: (data) => {
      toast.success("Commands generated! Copy and run them in terminal.");
    }
  });

  const handleSelectAccount = (accountId: number) => {
    setSelectedAccounts(prev => 
      prev.includes(accountId) 
        ? prev.filter(id => id !== accountId)
        : [...prev, accountId]
    );
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copied to clipboard!");
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Linkedin className="h-6 w-6 text-[#0A66C2]" />
            LinkedIn Contact Scraper
          </h1>
          <p className="text-muted-foreground mt-1">
            Extract contacts from LinkedIn company pages with anti-detection measures
          </p>
        </div>
        <Badge variant={status?.isBusinessHours ? "default" : "destructive"} className="gap-1">
          <Clock className="h-3 w-3" />
          {status?.isBusinessHours ? "Business Hours - Safe to Scrape" : "Outside Business Hours"}
        </Badge>
      </div>

      {/* Safety Warning */}
      <Card className="border-yellow-500/50 bg-yellow-500/10">
        <CardHeader className="pb-2">
          <CardTitle className="text-yellow-500 flex items-center gap-2 text-lg">
            <AlertTriangle className="h-5 w-5" />
            Important Safety Guidelines
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm space-y-2">
          <p>LinkedIn actively detects and bans automated scraping. Follow these rules:</p>
          <ul className="list-disc list-inside space-y-1 text-muted-foreground">
            <li>Max <strong>{status?.config.maxContactsPerDay} contacts</strong> per day</li>
            <li>Max <strong>{status?.config.maxCompaniesPerDay} companies</strong> per day</li>
            <li>Only scrape during business hours (9am-6pm)</li>
            <li>Take 15-minute breaks every 30 profiles</li>
            <li>If you see a CAPTCHA, <strong>STOP immediately</strong> and wait 24 hours</li>
          </ul>
        </CardContent>
      </Card>

      {/* Instructions Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Info className="h-5 w-5 text-cyan-500" />
            How to Scrape LinkedIn Contacts
          </CardTitle>
          <CardDescription>
            Follow these steps to safely extract contacts from LinkedIn
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {instructions?.steps.map((step, i) => (
              <div key={i} className="flex gap-4">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-cyan-500/20 text-cyan-500 flex items-center justify-center font-bold">
                  {step.step}
                </div>
                <div>
                  <h4 className="font-medium">{step.title}</h4>
                  <p className="text-sm text-muted-foreground">{step.description}</p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Scraping Queue */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5 text-cyan-500" />
            Accounts Needing Contacts
            <Badge variant="outline" className="ml-2">{queue?.length || 0} accounts</Badge>
          </CardTitle>
          <CardDescription>
            High-intent accounts with LinkedIn URLs but few contacts. Prioritized by intent score.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {queue?.map((account) => (
              <div 
                key={account.id}
                className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <Checkbox
                    checked={selectedAccounts.includes(account.id)}
                    onCheckedChange={() => handleSelectAccount(account.id)}
                  />
                  <div>
                    <div className="font-medium flex items-center gap-2">
                      {account.name}
                      <Badge variant="outline" className="text-xs">
                        Intent: {account.intentScore}
                      </Badge>
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {account.industry} • {account.employeeCount?.toLocaleString()} employees
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {account.linkedinCompanyUrl && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => window.open(account.linkedinCompanyUrl!, '_blank')}
                    >
                      <ExternalLink className="h-4 w-4 mr-1" />
                      LinkedIn
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      if (account.linkedinCompanyUrl) {
                        generateCommands.mutate({
                          accountId: account.id,
                          linkedinUrl: account.linkedinCompanyUrl
                        });
                      }
                    }}
                    disabled={!account.linkedinCompanyUrl}
                  >
                    <Copy className="h-4 w-4 mr-1" />
                    Get Commands
                  </Button>
                </div>
              </div>
            ))}
          </div>

          {queue?.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              <CheckCircle className="h-12 w-12 mx-auto mb-2 text-green-500" />
              <p>All accounts have sufficient contacts!</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Manual Import Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-green-500" />
            Recommended: Use Evaboot or Phantombuster
          </CardTitle>
          <CardDescription>
            For safer scraping, use established tools that handle anti-detection automatically
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <a 
              href="https://evaboot.com" 
              target="_blank" 
              rel="noopener noreferrer"
              className="p-4 rounded-lg border hover:bg-accent/50 transition-colors"
            >
              <h4 className="font-medium">Evaboot</h4>
              <p className="text-sm text-muted-foreground">
                Best for Sales Navigator exports. $9/mo for 100 credits.
              </p>
            </a>
            <a 
              href="https://phantombuster.com" 
              target="_blank" 
              rel="noopener noreferrer"
              className="p-4 rounded-lg border hover:bg-accent/50 transition-colors"
            >
              <h4 className="font-medium">Phantombuster</h4>
              <p className="text-sm text-muted-foreground">
                Versatile scraping platform. $69/mo for 5 phantoms.
              </p>
            </a>
          </div>
          <p className="text-sm text-muted-foreground">
            After exporting contacts from these tools, upload the CSV to the Contacts page to import them into the dashboard.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
