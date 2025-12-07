import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";
import { FileText, Search, Plus, Calendar, DollarSign, Building2, ExternalLink } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useState } from "react";

export default function RFPs() {
  const [searchQuery, setSearchQuery] = useState("");
  const { data: rfps, isLoading } = trpc.rfps.list.useQuery();

  const filteredRFPs = rfps?.filter(rfp =>
    rfp.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    rfp.agency?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    rfp.solicitationNumber?.toLowerCase().includes(searchQuery.toLowerCase())
  ) || [];

  const getStatusColor = (status: string | null) => {
    if (!status) return 'secondary';
    const s = status.toLowerCase();
    if (s === 'active') return 'default';
    if (s === 'closed') return 'secondary';
    if (s === 'awarded') return 'outline';
    return 'secondary';
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">RFPs & Opportunities</h1>
            <p className="text-muted-foreground mt-2">
              Monitor government contracts and opportunities
            </p>
          </div>
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            Add RFP
          </Button>
        </div>

        <div className="flex items-center gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search RFPs..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        {isLoading ? (
          <div className="space-y-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-40 skeleton rounded-xl" />
            ))}
          </div>
        ) : filteredRFPs.length > 0 ? (
          <div className="space-y-4">
            {filteredRFPs.map((rfp) => (
              <Card key={rfp.id} className="hover:shadow-lg transition-shadow">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <CardTitle className="text-lg">{rfp.title}</CardTitle>
                        {rfp.status && (
                          <Badge variant={getStatusColor(rfp.status) as any}>
                            {rfp.status}
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        {rfp.agency && (
                          <div className="flex items-center gap-1">
                            <Building2 className="h-4 w-4" />
                            <span>{rfp.agency}</span>
                          </div>
                        )}
                        {rfp.solicitationNumber && (
                          <div className="flex items-center gap-1">
                            <FileText className="h-4 w-4" />
                            <span>{rfp.solicitationNumber}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {rfp.description && (
                    <p className="text-sm text-muted-foreground line-clamp-2">
                      {rfp.description}
                    </p>
                  )}
                  
                  <div className="flex items-center gap-6 text-sm">
                    {rfp.postedDate && (
                      <div className="flex items-center gap-1 text-muted-foreground">
                        <Calendar className="h-4 w-4" />
                        <span>Posted: {new Date(rfp.postedDate).toLocaleDateString()}</span>
                      </div>
                    )}
                    {rfp.responseDeadline && (
                      <div className="flex items-center gap-1 text-orange-600">
                        <Calendar className="h-4 w-4" />
                        <span>Deadline: {new Date(rfp.responseDeadline).toLocaleDateString()}</span>
                      </div>
                    )}
                    {rfp.awardAmount && (
                      <div className="flex items-center gap-1 text-green-600">
                        <DollarSign className="h-4 w-4" />
                        <span>{rfp.awardAmount}</span>
                      </div>
                    )}
                  </div>

                  {rfp.url && (
                    <div>
                      <a 
                        href={rfp.url} 
                        target="_blank" 
                        rel="noopener noreferrer" 
                        className="inline-flex items-center gap-1 text-sm text-blue-600 hover:underline"
                      >
                        View on SAM.gov
                        <ExternalLink className="h-3 w-3" />
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
              <FileText className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-lg font-medium">No RFPs found</p>
              <p className="text-sm text-muted-foreground mt-2">
                {searchQuery ? 'Try adjusting your search' : 'Get started by adding your first RFP'}
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}
