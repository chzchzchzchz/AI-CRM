import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { trpc } from "@/lib/trpc";
import { 
  Building2, Globe, Users, DollarSign, MapPin, Linkedin, 
  Shield, Cpu, Zap, Phone, FileText, Sparkles, ArrowLeft 
} from "lucide-react";
import { useRoute, Link } from "wouter";
import { Streamdown } from "streamdown";
import { useState } from "react";

export default function AccountDetail() {
  const [, params] = useRoute("/accounts/:id");
  const accountId = params?.id ? parseInt(params.id) : 0;
  const [generatingResearch, setGeneratingResearch] = useState(false);

  const { data: account, isLoading } = trpc.accounts.getById.useQuery({ id: accountId });
  const { data: contacts } = trpc.contacts.getByAccountId.useQuery({ accountId });
  const { data: calls } = trpc.calls.getByAccountId.useQuery({ accountId });
  const { data: intentScores } = trpc.intentScores.getByAccountId.useQuery({ accountId });
  const { data: aiContexts } = trpc.ai.getContextByAccountId.useQuery({ accountId });
  const { data: documents } = trpc.documents.getByAccountId.useQuery({ accountId });

  const generateResearch = trpc.ai.generateAccountResearch.useMutation({
    onSuccess: () => {
      setGeneratingResearch(false);
    },
  });

  const handleGenerateResearch = async () => {
    if (!account) return;
    setGeneratingResearch(true);
    await generateResearch.mutateAsync({
      accountId: account.id,
      accountName: account.name,
      industry: account.industry || undefined,
      description: account.description || undefined,
    });
  };

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="space-y-6">
          <div className="h-8 w-64 skeleton" />
          <div className="h-96 skeleton rounded-xl" />
        </div>
      </DashboardLayout>
    );
  }

  if (!account) {
    return (
      <DashboardLayout>
        <div className="flex flex-col items-center justify-center py-12">
          <Building2 className="h-12 w-12 text-muted-foreground mb-4" />
          <p className="text-lg font-medium">Account not found</p>
        </div>
      </DashboardLayout>
    );
  }

  const securityStack = account.securityStack ? JSON.parse(account.securityStack) : [];
  const techStack = account.techStack ? JSON.parse(account.techStack) : [];
  const triggerEvents = account.triggerEvents ? JSON.parse(account.triggerEvents) : [];

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Link href="/accounts">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div className="flex-1">
            <h1 className="text-3xl font-bold tracking-tight">{account.name}</h1>
            <p className="text-muted-foreground mt-1">{account.industry || 'Unknown industry'}</p>
          </div>
          <Button onClick={handleGenerateResearch} disabled={generatingResearch}>
            <Sparkles className="h-4 w-4 mr-2" />
            {generatingResearch ? 'Generating...' : 'Generate AI Research'}
          </Button>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">Website</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <Globe className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">{account.domain || 'N/A'}</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">Employees</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">{account.employeeCount?.toLocaleString() || 'N/A'}</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">Revenue</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">{account.revenue || 'N/A'}</span>
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="contacts">Contacts ({contacts?.length || 0})</TabsTrigger>
            <TabsTrigger value="calls">Calls ({calls?.length || 0})</TabsTrigger>
            <TabsTrigger value="intelligence">AI Intelligence</TabsTrigger>
            <TabsTrigger value="documents">Documents ({documents?.length || 0})</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Company Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {account.description && (
                  <div>
                    <p className="text-sm font-medium mb-2">Description</p>
                    <p className="text-sm text-muted-foreground">{account.description}</p>
                  </div>
                )}
                {account.location && (
                  <div className="flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">{account.location}</span>
                  </div>
                )}
                {account.linkedinUrl && (
                  <div className="flex items-center gap-2">
                    <Linkedin className="h-4 w-4 text-muted-foreground" />
                    <a href={account.linkedinUrl} target="_blank" rel="noopener noreferrer" className="text-sm text-blue-600 hover:underline">
                      LinkedIn Profile
                    </a>
                  </div>
                )}
              </CardContent>
            </Card>

            {securityStack.length > 0 && (
              <Card>
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <Shield className="h-5 w-5 text-blue-600" />
                    <CardTitle>Security Stack</CardTitle>
                  </div>
                  <CardDescription>Current security tools and vendors</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2">
                    {securityStack.map((tool: string, idx: number) => (
                      <Badge key={idx} variant="secondary">{tool}</Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {techStack.length > 0 && (
              <Card>
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <Cpu className="h-5 w-5 text-purple-600" />
                    <CardTitle>Technology Stack</CardTitle>
                  </div>
                  <CardDescription>Technologies and platforms in use</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2">
                    {techStack.map((tech: string, idx: number) => (
                      <Badge key={idx} variant="secondary">{tech}</Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {triggerEvents.length > 0 && (
              <Card>
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <Zap className="h-5 w-5 text-orange-600" />
                    <CardTitle>Trigger Events</CardTitle>
                  </div>
                  <CardDescription>Recent events indicating buying intent</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {triggerEvents.map((event: string, idx: number) => (
                      <div key={idx} className="flex items-start gap-2 p-2 rounded-lg bg-orange-50">
                        <Zap className="h-4 w-4 text-orange-600 mt-0.5" />
                        <span className="text-sm">{event}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="contacts" className="space-y-4">
            {contacts && contacts.length > 0 ? (
              <div className="grid gap-4 md:grid-cols-2">
                {contacts.map((contact) => (
                  <Link key={contact.id} href={`/contacts/${contact.id}`}>
                    <Card className="cursor-pointer hover:shadow-lg transition-shadow">
                      <CardHeader>
                        <CardTitle className="text-lg">
                          {contact.firstName} {contact.lastName}
                        </CardTitle>
                        <CardDescription>{contact.title || 'No title'}</CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-2">
                        {contact.email && (
                          <p className="text-sm text-muted-foreground">{contact.email}</p>
                        )}
                        {contact.department && (
                          <Badge variant="secondary">{contact.department}</Badge>
                        )}
                      </CardContent>
                    </Card>
                  </Link>
                ))}
              </div>
            ) : (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <Users className="h-12 w-12 text-muted-foreground mb-4" />
                  <p className="text-lg font-medium">No contacts yet</p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="calls" className="space-y-4">
            {calls && calls.length > 0 ? (
              <div className="space-y-4">
                {calls.map((call) => (
                  <Card key={call.id}>
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-lg">{call.title || 'Untitled Call'}</CardTitle>
                        <Badge>{call.sentiment || 'Neutral'}</Badge>
                      </div>
                      <CardDescription>
                        {call.callDate ? new Date(call.callDate).toLocaleString() : 'No date'}
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Phone className="h-4 w-4" />
                        <span>Duration: {call.duration ? `${Math.floor(call.duration / 60)}m` : 'N/A'}</span>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <Phone className="h-12 w-12 text-muted-foreground mb-4" />
                  <p className="text-lg font-medium">No calls yet</p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="intelligence" className="space-y-4">
            {aiContexts && aiContexts.length > 0 ? (
              <div className="space-y-4">
                {aiContexts.map((context) => (
                  <Card key={context.id}>
                    <CardHeader>
                      <div className="flex items-center gap-2">
                        <Sparkles className="h-5 w-5 text-purple-600" />
                        <CardTitle className="capitalize">{context.contextType}</CardTitle>
                      </div>
                      <CardDescription>
                        {context.createdAt ? new Date(context.createdAt).toLocaleString() : ''}
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="prose prose-sm max-w-none">
                        <Streamdown>{context.response || ''}</Streamdown>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <Sparkles className="h-12 w-12 text-muted-foreground mb-4" />
                  <p className="text-lg font-medium">No AI research yet</p>
                  <p className="text-sm text-muted-foreground mt-2">
                    Click "Generate AI Research" to get started
                  </p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="documents" className="space-y-4">
            {documents && documents.length > 0 ? (
              <div className="space-y-4">
                {documents.map((doc) => (
                  <Card key={doc.id}>
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-lg">{doc.fileName}</CardTitle>
                        <Badge variant="secondary">{doc.fileType}</Badge>
                      </div>
                      <CardDescription>
                        {doc.createdAt ? new Date(doc.createdAt).toLocaleString() : ''}
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <a href={doc.fileUrl} target="_blank" rel="noopener noreferrer" className="text-sm text-blue-600 hover:underline">
                        View Document
                      </a>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <FileText className="h-12 w-12 text-muted-foreground mb-4" />
                  <p className="text-lg font-medium">No documents yet</p>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
