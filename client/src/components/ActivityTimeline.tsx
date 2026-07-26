import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  Phone, Mail, Calendar, MessageSquare, Users, 
  TrendingUp, FileText, Clock, Building2, User
} from "lucide-react";

interface Activity {
  id: string;
  type: "call" | "email" | "meeting" | "note" | "intent_spike" | "engagement";
  title: string;
  description?: string;
  date: Date;
  metadata?: {
    duration?: string;
    sentiment?: "positive" | "neutral" | "negative";
    participants?: string[];
    score?: number;
  };
}

interface ActivityTimelineProps {
  activities: Activity[];
  isLoading?: boolean;
  maxItems?: number;
}

const activityConfig = {
  call: {
    icon: Phone,
    color: "text-accent",
    bgColor: "bg-accent-subtle",
    borderColor: "border-accent/30",
    label: "Call"
  },
  email: {
    icon: Mail,
    color: "text-accent",
    bgColor: "bg-accent-subtle",
    borderColor: "border-accent/30",
    label: "Email"
  },
  meeting: {
    icon: Calendar,
    color: "text-accent",
    bgColor: "bg-accent-subtle",
    borderColor: "border-accent/30",
    label: "Meeting"
  },
  note: {
    icon: MessageSquare,
    color: "text-caution",
    bgColor: "bg-caution-subtle",
    borderColor: "border-caution/30",
    label: "Note"
  },
  intent_spike: {
    icon: TrendingUp,
    color: "text-critical",
    bgColor: "bg-critical-subtle",
    borderColor: "border-critical/30",
    label: "Intent Spike"
  },
  engagement: {
    icon: Users,
    color: "text-positive",
    bgColor: "bg-positive-subtle",
    borderColor: "border-positive/30",
    label: "Engagement"
  }
};

function formatRelativeDate(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
  if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`;
  return `${Math.floor(diffDays / 365)} years ago`;
}

function formatDate(date: Date): string {
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric"
  });
}

export function ActivityTimeline({ activities, isLoading, maxItems = 20 }: ActivityTimelineProps) {
  const sortedActivities = useMemo(() => {
    return [...activities]
      .sort((a, b) => b.date.getTime() - a.date.getTime())
      .slice(0, maxItems);
  }, [activities, maxItems]);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex flex-wrap items-center gap-2">
            <Clock className="h-5 w-5 text-accent" />
            Activity Timeline
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[1, 2, 3, 4, 5].map(i => (
              <div key={i} className="flex flex-wrap gap-4">
                <div className="w-10 h-10 skeleton rounded-sm" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-32 skeleton" />
                  <div className="h-3 w-48 skeleton" />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (activities.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex flex-wrap items-center gap-2">
            <Clock className="h-5 w-5 text-accent" />
            Activity Timeline
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <Clock className="h-12 w-12 mx-auto text-muted-foreground/50 mb-3" />
            <p className="text-muted-foreground">No activities recorded yet</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Group activities by date
  const groupedActivities = useMemo(() => {
    const groups: { [key: string]: Activity[] } = {};
    sortedActivities.forEach(activity => {
      const dateKey = formatDate(activity.date);
      if (!groups[dateKey]) {
        groups[dateKey] = [];
      }
      groups[dateKey].push(activity);
    });
    return groups;
  }, [sortedActivities]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span className="flex flex-wrap items-center gap-2">
            <Clock className="h-5 w-5 text-accent" />
            Activity Timeline
          </span>
          <Badge variant="outline" className="text-xs">
            {activities.length} activities
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="relative">
          {/* Timeline line */}
          <div className="absolute left-5 top-0 bottom-0 w-px bg-border" />
          
          <div className="space-y-6">
            {Object.entries(groupedActivities).map(([dateKey, dateActivities]) => (
              <div key={dateKey}>
                {/* Date header */}
                <div className="flex flex-wrap items-center gap-3 mb-4">
                  {/* Auto width, not w-10: the label is a phrase ("3 weeks ago"), and a
                      40px box broke it across three lines. */}
                  <div className="inline-flex h-6 shrink-0 items-center whitespace-nowrap rounded bg-muted px-2 text-xs font-medium text-muted-foreground">
                    {formatRelativeDate(dateActivities[0].date)}
                  </div>
                  <span className="text-xs text-muted-foreground">{dateKey}</span>
                </div>
                
                {/* Activities for this date */}
                <div className="space-y-3 ml-1">
                  {dateActivities.map(activity => {
                    const config = activityConfig[activity.type];
                    const Icon = config.icon;
                    
                    return (
                      <div key={activity.id} className="flex flex-wrap gap-3 group">
                        {/* Icon */}
                        <div className={`relative z-10 w-8 h-8 rounded-sm ${config.bgColor} border ${config.borderColor} flex items-center justify-center flex-shrink-0`}>
                          <Icon className={`h-4 w-4 ${config.color}`} />
                        </div>
                        
                        {/* Content */}
                        <div className="flex-1 min-w-0 pb-3">
                          <div className="flex flex-wrap items-start justify-between gap-2">
                            <div>
                              <p className="font-medium text-sm line-clamp-1">
                                {activity.title}
                              </p>
                              {activity.description && (
                                <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                                  {activity.description}
                                </p>
                              )}
                            </div>
                            <Badge variant="outline" className={`text-xs flex-shrink-0 ${config.color} ${config.borderColor}`}>
                              {config.label}
                            </Badge>
                          </div>
                          
                          {/* Metadata */}
                          {activity.metadata && (
                            <div className="flex flex-wrap items-center gap-3 mt-2 text-xs text-muted-foreground">
                              {activity.metadata.duration && (
                                <span className="flex flex-wrap items-center gap-1">
                                  <Clock className="h-3 w-3" />
                                  {activity.metadata.duration}
                                </span>
                              )}
                              {activity.metadata.participants && activity.metadata.participants.length > 0 && (
                                <span className="flex flex-wrap items-center gap-1">
                                  <User className="h-3 w-3" />
                                  {activity.metadata.participants.slice(0, 2).join(", ")}
                                  {activity.metadata.participants.length > 2 && ` +${activity.metadata.participants.length - 2}`}
                                </span>
                              )}
                              {activity.metadata.sentiment && (
                                <Badge 
                                  variant="outline" 
                                  className={`text-xs ${ activity.metadata.sentiment === "positive" ? "text-positive border-positive/30" : activity.metadata.sentiment === "negative" ? "text-critical border-critical/30" : "text-muted-foreground" }`}
                                >
                                  {activity.metadata.sentiment}
                                </Badge>
                              )}
                              {activity.metadata.score !== undefined && (
                                <span className="flex flex-wrap items-center gap-1">
                                  <TrendingUp className="h-3 w-3" />
                                  +{activity.metadata.score} intent
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export type { Activity };
