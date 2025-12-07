import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";
import { 
  Users, Mail, Phone, Linkedin, Building2, Calendar, 
  TrendingUp, ArrowLeft, Sparkles 
} from "lucide-react";
import { useRoute, Link } from "wouter";
import { Streamdown } from "streamdown";
import { useState } from "react";

export default function ContactDetail() {
  const [, params] = useRoute("/contacts/:id");
  const contactId = params?.id ? parseInt(params.id) : 0;
  const [generatingOutreach, setGeneratingOutreach] = useState(false);

  const { data: contact, isLoading } = trpc.contacts.getById.useQuery({ id: contactId });
  const { data: account } = trpc.accounts.getById.useQuery(
    { id: contact?.accountId || 0 },
    { enabled: !!contact?.accountId }
  );

  const generateOutreach = trpc.ai.generateOutreachRecommendation.useMutation({
    onSuccess: () => {
      setGeneratingOutreach(false);
    },
  });

  const handleGenerateOutreach = async () => {
    if (!contact || !account) return;
    setGeneratingOutreach(true);
    await generateOutreach.mutateAsync({
      accountId: account.id,
      accountName: account.name,
      contactName: `${contact.firstName} ${contact.lastName}`,
      contactTitle: contact.title || undefined,
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

  if (!contact) {
    return (
      <DashboardLayout>
        <div className="flex flex-col items-center justify-center py-12">
          <Users className="h-12 w-12 text-muted-foreground mb-4" />
          <p className="text-lg font-medium">Contact not found</p>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Link href="/contacts">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div className="flex-1">
            <h1 className="text-3xl font-bold tracking-tight">
              {contact.firstName} {contact.lastName}
            </h1>
            <p className="text-muted-foreground mt-1">{contact.title || 'No title'}</p>
          </div>
          <Button onClick={handleGenerateOutreach} disabled={generatingOutreach || !account}>
            <Sparkles className="h-4 w-4 mr-2" />
            {generatingOutreach ? 'Generating...' : 'Generate Outreach'}
          </Button>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Contact Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {contact.email && (
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-blue-50">
                      <Mail className="h-4 w-4 text-blue-600" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">Email</p>
                      <a href={`mailto:${contact.email}`} className="text-sm text-blue-600 hover:underline">
                        {contact.email}
                      </a>
                    </div>
                  </div>
                )}
                
                {contact.phone && (
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-green-50">
                      <Phone className="h-4 w-4 text-green-600" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">Phone</p>
                      <a href={`tel:${contact.phone}`} className="text-sm text-muted-foreground">
                        {contact.phone}
                      </a>
                    </div>
                  </div>
                )}

                {contact.linkedinUrl && (
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-blue-50">
                      <Linkedin className="h-4 w-4 text-blue-600" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">LinkedIn</p>
                      <a href={contact.linkedinUrl} target="_blank" rel="noopener noreferrer" className="text-sm text-blue-600 hover:underline">
                        View Profile
                      </a>
                    </div>
                  </div>
                )}

                {account && (
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-purple-50">
                      <Building2 className="h-4 w-4 text-purple-600" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">Account</p>
                      <Link href={`/accounts/${account.id}`}>
                        <span className="text-sm text-blue-600 hover:underline cursor-pointer">
                          {account.name}
                        </span>
                      </Link>
                    </div>
                  </div>
                )}

                {contact.department && (
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-orange-50">
                      <Users className="h-4 w-4 text-orange-600" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">Department</p>
                      <p className="text-sm text-muted-foreground">{contact.department}</p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {generateOutreach.data && (
              <Card>
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-5 w-5 text-purple-600" />
                    <CardTitle>AI-Generated Outreach Recommendation</CardTitle>
                  </div>
                  <CardDescription>Personalized messaging strategy</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="prose prose-sm max-w-none">
                    <Streamdown>{generateOutreach.data.recommendation}</Streamdown>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Engagement</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">




                {contact.clayRecordId && (
                  <div>
                    <Badge variant="secondary" className="w-full justify-center">
                      Enriched by Clay
                    </Badge>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
