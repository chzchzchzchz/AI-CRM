import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";
import { Phone, Search, Plus, Calendar, Clock, Building2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useState } from "react";

export default function Calls() {
  const [searchQuery, setSearchQuery] = useState("");
  const { data: calls, isLoading } = trpc.calls.list.useQuery();
  const { data: accounts } = trpc.accounts.list.useQuery();

  const getAccountName = (accountId: number | null) => {
    if (!accountId) return 'No account';
    return accounts?.find(a => a.id === accountId)?.name || 'Unknown Account';
  };

  const filteredCalls = calls?.filter(call =>
    call.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    getAccountName(call.accountId).toLowerCase().includes(searchQuery.toLowerCase())
  ) || [];

  const getSentimentColor = (sentiment: string | null) => {
    if (!sentiment) return 'secondary';
    const s = sentiment.toLowerCase();
    if (s.includes('positive')) return 'default';
    if (s.includes('negative')) return 'destructive';
    return 'secondary';
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Calls</h1>
            <p className="text-muted-foreground mt-2">
              Track sales conversations and insights
            </p>
          </div>
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            Add Call
          </Button>
        </div>

        <div className="flex items-center gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search calls..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        {isLoading ? (
          <div className="space-y-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-32 skeleton rounded-xl" />
            ))}
          </div>
        ) : filteredCalls.length > 0 ? (
          <div className="space-y-4">
            {filteredCalls.map((call) => (
              <Card key={call.id} className="hover:shadow-lg transition-shadow">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <CardTitle className="text-lg">{call.title || 'Untitled Call'}</CardTitle>
                      <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <Calendar className="h-4 w-4" />
                          <span>{call.callDate ? new Date(call.callDate).toLocaleDateString() : 'No date'}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Clock className="h-4 w-4" />
                          <span>{call.duration ? `${Math.floor(call.duration / 60)}m ${call.duration % 60}s` : 'N/A'}</span>
                        </div>
                        {call.accountId && (
                          <div className="flex items-center gap-1">
                            <Building2 className="h-4 w-4" />
                            <span>{getAccountName(call.accountId)}</span>
                          </div>
                        )}
                      </div>
                    </div>
                    {call.sentiment && (
                      <Badge variant={getSentimentColor(call.sentiment) as any}>
                        {call.sentiment}
                      </Badge>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {call.keyTopics && (() => {
                    try {
                      const topics = JSON.parse(call.keyTopics);
                      return topics.length > 0 && (
                        <div>
                          <p className="text-sm font-medium mb-2">Key Topics</p>
                          <div className="flex flex-wrap gap-2">
                            {topics.map((topic: string, idx: number) => (
                              <Badge key={idx} variant="secondary">{topic}</Badge>
                            ))}
                          </div>
                        </div>
                      );
                    } catch {
                      return null;
                    }
                  })()}
                  
                  {call.recordingUrl && (
                    <div>
                      <a href={call.recordingUrl} target="_blank" rel="noopener noreferrer" className="text-sm text-blue-600 hover:underline">
                        View Recording
                      </a>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Phone className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-lg font-medium">No calls found</p>
              <p className="text-sm text-muted-foreground mt-2">
                {searchQuery ? 'Try adjusting your search' : 'Get started by adding your first call'}
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}
