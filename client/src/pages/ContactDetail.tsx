import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Navigation } from "@/components/Navigation";
import { AIAssistant } from "@/components/AIAssistant";
import { trpc } from "@/lib/trpc";
import { 
  ArrowLeft, Loader2, ExternalLink, Building2, Phone, Calendar, 
  Mail, MapPin, Linkedin, Sparkles, Copy, Check, FileText, TrendingUp,
  User, MessageSquare, Users
} from "lucide-react";
import { Link, useParams } from "wouter";
import { Streamdown } from "streamdown";
import { toast } from "sonner";

export default function ContactDetail() {
  const { id } = useParams<{ id: string }>();
  const personId = parseInt(id || "0");
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [showFullTranscript, setShowFullTranscript] = useState<Record<number, boolean>>({});

  const { data: person, isLoading } = trpc.people.list.useQuery();
  const contact = person?.find(p => p.id === personId);

  const { data: gongCalls } = trpc.gong.list.useQuery();
  const contactCalls = gongCalls?.filter(call => 
    call.contactId === personId
  );

  const { data: accounts } = trpc.accounts.list.useQuery();
  const relatedAccount = accounts?.find(a => a.name === contact?.company);

  const generateSummaryMutation = trpc.ai.generateContactSummary.useMutation();
  const [aiSummary, setAiSummary] = useState<string | null>(null);
  const [isGeneratingSummary, setIsGeneratingSummary] = useState(false);

  const handleGenerateSummary = async () => {
    setIsGeneratingSummary(true);
    try {
      const summary = await generateSummaryMutation.mutateAsync({ contactId: personId });
      setAiSummary(summary);
      toast.success("AI summary generated!");
    } catch (error) {
      toast.error("Failed to generate summary");
    } finally {
      setIsGeneratingSummary(false);
    }
  };

  const copyToClipboard = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    toast.success("Copied to clipboard");
    setTimeout(() => setCopiedField(null), 2000);
  };

  let rawDataParsed: any = null;
  // rawData field removed from schema
  rawDataParsed = {};

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20">
        <Navigation />
        <div className="container py-12 space-y-8 max-w-7xl">
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 skeleton rounded-2xl" />
            <div className="space-y-2 flex-1">
              <div className="h-10 w-96 skeleton" />
              <div className="h-6 w-64 skeleton" />
            </div>
          </div>
          <div className="grid gap-6 md:grid-cols-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-32 skeleton rounded-xl" />
            ))}
          </div>
          <div className="h-96 skeleton rounded-xl" />
        </div>
      </div>
    );
  }

  // Not found state
  if (!contact) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20">
        <Navigation />
        <div className="container py-20 max-w-2xl">
          <Card className="card-elevated">
            <CardContent className="py-16 text-center">
              <User className="h-16 w-16 mx-auto text-muted-foreground/50 mb-4" />
              <h3 className="text-2xl font-semibold mb-2">Contact not found</h3>
              <p className="text-muted-foreground mb-6">This contact doesn't exist or has been removed</p>
              <Button asChild>
                <Link href="/contacts">
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Back to Contacts
                </Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20">
      <Navigation />
      <AIAssistant context={{ type: "contact", id: personId, name: contact.name || undefined }} />

      <div className="container py-12 space-y-8 max-w-7xl">
        {/* Header */}
        <div className="flex items-start justify-between gap-6">
          <div className="flex items-start gap-4 flex-1 min-w-0">
            <Button variant="outline" size="icon" asChild className="flex-shrink-0">
              <Link href="/contacts">
                <ArrowLeft className="h-5 w-5" />
              </Link>
            </Button>
            
            <div className="flex items-start gap-4 flex-1 min-w-0">
              <div className="p-4 bg-gradient-to-br from-purple-600 to-pink-600 rounded-2xl shadow-lg flex-shrink-0">
                <User className="h-8 w-8 text-white" />
              </div>
              
              <div className="flex-1 min-w-0">
                <h1 className="text-4xl font-bold tracking-tight line-clamp-1 mb-2">{contact.name}</h1>
                
                <div className="flex flex-wrap items-center gap-4 text-muted-foreground">
                  {contact.title && (
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4" />
                      <span>{contact.title}</span>
                    </div>
                  )}
                  {contact.company && (
                    <div className="flex items-center gap-2">
                      <Building2 className="h-4 w-4" />
                      {relatedAccount ? (
                        <span 
                          className="hover:text-primary transition-colors cursor-pointer"
                          onClick={() => window.location.href = `/accounts/${relatedAccount.id}`}
                        >
                          {contact.company}
                        </span>
                      ) : (
                        <span>{contact.company}</span>
                      )}
                    </div>
                  )}
                  {contact.location && (
                    <div className="flex items-center gap-2">
                      <MapPin className="h-4 w-4" />
                      <span>{contact.location}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="flex gap-2 flex-shrink-0 flex-wrap">
            {contact.phone && (
              <Button variant="outline" className="border-green-500 text-green-600 hover:bg-green-50" asChild>
                <a href={`tel:${contact.phone}`}>
                  <Phone className="mr-2 h-4 w-4" />
                  Call
                </a>
              </Button>
            )}
            {contact.email && (
              <Button className="gradient-primary text-white" asChild>
                <a href={`mailto:${contact.email}`}>
                  <Mail className="mr-2 h-4 w-4" />
                  Email
                </a>
              </Button>
            )}
            {contact.linkedinUrl && (
              <Button variant="outline" asChild>
                <a href={contact.linkedinUrl} target="_blank" rel="noopener noreferrer">
                  <Linkedin className="mr-2 h-4 w-4" />
                  LinkedIn
                </a>
              </Button>
            )}
            {(contact as any).sfdcContactId && (
              <Button variant="outline" className="border-blue-500 text-blue-600 hover:bg-blue-50" asChild>
                <a href={`https://company.lightning.force.com/lightning/r/Contact/${(contact as any).sfdcContactId}/view`} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="mr-2 h-4 w-4" />
                  Salesforce
                </a>
              </Button>
            )}
          </div>
        </div>

        {/* Quick Stats */}
        <div className="grid gap-6 md:grid-cols-4">
          <Card className="card-elevated border-l-4 border-l-cyan-500">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Phone className="h-4 w-4 text-cyan-500" />
                Calls
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{contactCalls?.length || 0}</div>
              <p className="text-xs text-muted-foreground mt-1">Recorded calls</p>
            </CardContent>
          </Card>

          <Card className="card-elevated border-l-4 border-l-purple-500">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Building2 className="h-4 w-4 text-purple-500" />
                Company
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold line-clamp-1">{contact.company}</div>
              <p className="text-xs text-muted-foreground mt-1">{relatedAccount?.industry || "Unknown industry"}</p>
            </CardContent>
          </Card>

          <Card className="card-elevated border-l-4 border-l-indigo-500">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-indigo-500" />
                Account Intent
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className={`text-3xl font-bold ${Number(relatedAccount?.intentScore) >= 70 ? 'text-red-500' : Number(relatedAccount?.intentScore) >= 40 ? 'text-amber-500' : ''}`}>
                {relatedAccount?.intentScore || "N/A"}%
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {Number(relatedAccount?.intentScore) >= 70 ? 'Hot lead' : Number(relatedAccount?.intentScore) >= 40 ? 'Warm lead' : 'Cold lead'}
              </p>
            </CardContent>
          </Card>

          <Card className="card-elevated border-l-4 border-l-green-500">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Users className="h-4 w-4 text-green-500" />
                Company Size
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{relatedAccount?.employeeCount?.toLocaleString() || "N/A"}</div>
              <p className="text-xs text-muted-foreground mt-1">{relatedAccount?.region || "Unknown region"}</p>
            </CardContent>
          </Card>
        </div>

        {/* Tech Stack & Security Stack */}
        {(relatedAccount?.techStack || relatedAccount?.securityStack) && (
          <div className="grid gap-6 md:grid-cols-2">
            {relatedAccount?.techStack && (
              <Card className="card-elevated">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium">Tech Stack</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2">
                    {relatedAccount.techStack.split(',').map((tech, i) => (
                      <Badge key={i} variant="outline">{tech.trim()}</Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
            {relatedAccount?.securityStack && (
              <Card className="card-elevated">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium">Security Stack</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2">
                    {relatedAccount.securityStack.split(',').map((sec, i) => (
                      <Badge key={i} variant="secondary">{sec.trim()}</Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {/* Contact Information */}
        <Card className="card-elevated">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              Contact Information
            </CardTitle>
            <CardDescription>Direct contact details and professional links</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2">
              {contact.email && (
                <div className="flex items-center justify-between gap-4 p-4 rounded-lg bg-muted/50">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <Mail className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium mb-1">Email</div>
                      <a 
                        href={`mailto:${contact.email}`}
                        className="text-sm text-primary hover:underline line-clamp-1"
                      >
                        {contact.email}
                      </a>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="flex-shrink-0"
                    onClick={() => copyToClipboard(contact.email!, "email")}
                  >
                    {copiedField === "email" ? (
                      <Check className="h-4 w-4 text-green-500" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              )}

              {contact.linkedinUrl && (
                <div className="flex items-center justify-between gap-4 p-4 rounded-lg bg-muted/50">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <Linkedin className="h-5 w-5 text-blue-500 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium mb-1">LinkedIn</div>
                      <a 
                        href={contact.linkedinUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-primary hover:underline line-clamp-1 flex items-center gap-1"
                      >
                        View Profile
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="flex-shrink-0"
                    onClick={() => copyToClipboard(contact.linkedinUrl!, "linkedin")}
                  >
                    {copiedField === "linkedin" ? (
                      <Check className="h-4 w-4 text-green-500" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              )}

              {contact.location && (
                <div className="flex items-center gap-3 p-4 rounded-lg bg-muted/50">
                  <MapPin className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                  <div>
                    <div className="text-sm font-medium mb-1">Location</div>
                    <div className="text-sm text-muted-foreground">{contact.location}</div>
                  </div>
                </div>
              )}

              {contact.title && (
                <div className="flex items-center gap-3 p-4 rounded-lg bg-muted/50">
                  <FileText className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                  <div>
                    <div className="text-sm font-medium mb-1">Title</div>
                    <div className="text-sm text-muted-foreground">{contact.title}</div>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Related Account */}
        {relatedAccount && (
          <Card className="card-elevated">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5" />
                Related Account
              </CardTitle>
              <CardDescription>Company information and account details</CardDescription>
            </CardHeader>
            <CardContent>
              <Link href={`/accounts/${relatedAccount.id}`}>
                <div className="flex items-start justify-between gap-4 p-6 rounded-lg bg-muted/50 hover:bg-muted transition-colors cursor-pointer group">
                  <div className="flex items-start gap-4 flex-1 min-w-0">
                    <div className="p-3 bg-gradient-to-br from-indigo-600 to-purple-600 rounded-xl shadow-lg flex-shrink-0">
                      <Building2 className="h-6 w-6 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-xl font-semibold mb-2 group-hover:text-primary transition-colors">
                        {relatedAccount.name}
                      </h3>
                      <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                        {relatedAccount.industry && (
                          <span>{relatedAccount.industry}</span>
                        )}
                        {relatedAccount.employeeCount && (
                          <span>{relatedAccount.employeeCount} employees</span>
                        )}
                        {relatedAccount.region && (
                          <span>{relatedAccount.region}</span>
                        )}
                      </div>
                    </div>
                  </div>
                  {relatedAccount.intentScore && (
                    <Badge className="badge-primary flex-shrink-0">
                      Intent: {relatedAccount.intentScore}
                    </Badge>
                  )}
                </div>
              </Link>
            </CardContent>
          </Card>
        )}

        {/* Call History */}
        {contactCalls && contactCalls.length > 0 && (
          <Card className="card-elevated">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Phone className="h-5 w-5" />
                Call History ({contactCalls.length})
              </CardTitle>
              <CardDescription>Recorded conversations with this contact</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {contactCalls.map((call) => (
                  <div key={call.id} className="p-4 rounded-lg bg-muted/50 space-y-3">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <h4 className="font-semibold line-clamp-1">{call.title || "Untitled Call"}</h4>
                        <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
                          {call.callDate && (
                            <span className="flex items-center gap-1">
                              <Calendar className="h-4 w-4" />
                              {new Date(call.callDate).toLocaleDateString()}
                            </span>
                          )}
                          {call.duration && <span>{call.duration}</span>}
                        </div>
                      </div>
                      {call.recordingUrl && (
                        <Button variant="outline" size="sm" asChild>
                          <a href={call.recordingUrl} target="_blank" rel="noopener noreferrer">
                            View in Gong
                            <ExternalLink className="ml-2 h-4 w-4" />
                          </a>
                        </Button>
                      )}
                    </div>
                    {call.transcriptUrl && (
                      <div className="text-sm text-muted-foreground">
                        {showFullTranscript[call.id] ? (
                          <div className="whitespace-pre-wrap">{call.transcriptUrl}</div>
                        ) : (
                          <div className="line-clamp-3">{call.transcriptUrl}</div>
                        )}
                        {call.transcriptUrl.length > 200 && (
                          <Button
                            variant="link"
                            size="sm"
                            className="mt-2 p-0 h-auto"
                            onClick={() => setShowFullTranscript(prev => ({
                              ...prev,
                              [call.id]: !prev[call.id]
                            }))}
                          >
                            {showFullTranscript[call.id] ? "Show less" : "Show more"}
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* AI Insights */}
        <Card className="card-elevated">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-purple-500" />
              AI-Generated Summary
            </CardTitle>
            <CardDescription>Get an AI-powered summary of this contact</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button 
              onClick={handleGenerateSummary}
              disabled={isGeneratingSummary}
              className="gradient-primary text-white"
            >
              {isGeneratingSummary ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Sparkles className="mr-2 h-4 w-4" />
                  Generate AI Summary
                </>
              )}
            </Button>
            
            {aiSummary && (
              <div className="prose prose-sm max-w-none dark:prose-invert p-4 rounded-lg bg-muted/50">
                <Streamdown>{aiSummary}</Streamdown>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
