import { useState } from "react";
import { Navigation } from "@/components/Navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Mail, Phone, Linkedin, Clock, Plus, Trash2, GripVertical, Save, Play, Copy } from "lucide-react";
import { toast } from "sonner";

type StepType = "email" | "call" | "linkedin" | "wait";

interface SequenceStep {
  id: string;
  type: StepType;
  day: number;
  subject?: string;
  content?: string;
  notes?: string;
}

interface SequenceTemplate {
  name: string;
  description: string;
  steps: Omit<SequenceStep, 'id'>[];
}

const MFA_TEMPLATES: SequenceTemplate[] = [
  {
    name: "MFA Quick Strike (7 Days)",
    description: "Fast-paced sequence for hot leads showing MFA intent",
    steps: [
      { type: "email", day: 0, subject: "Quick question about {{company}}'s MFA strategy", content: "Hi {{firstName}},\n\nI noticed {{company}} is evaluating MFA solutions. We're helping companies like {{competitor}} eliminate phishing attacks with passwordless authentication.\n\nWorth a 15-min conversation?" },
      { type: "wait", day: 2, notes: "Wait 2 days for response" },
      { type: "linkedin", day: 2, notes: "Send LinkedIn connection request with note about MFA" },
      { type: "call", day: 3, notes: "Call attempt - reference email" },
      { type: "email", day: 5, subject: "Following up - MFA demo for {{company}}", content: "Hi {{firstName}},\n\nWanted to follow up on my previous email. I have a 10-minute demo that shows how {{competitor}} reduced helpdesk tickets by 70% after switching to {COMPANY_NAME}.\n\nAre you available this week?" },
      { type: "call", day: 7, notes: "Final call attempt before moving to nurture" }
    ]
  },
  {
    name: "SSO Enterprise (14 Days)",
    description: "Consultative approach for enterprise SSO deals",
    steps: [
      { type: "email", day: 0, subject: "SSO modernization at {{company}}", content: "Hi {{firstName}},\n\nI work with {{industry}} companies modernizing their SSO infrastructure. Given {{company}}'s growth, I thought you might be interested in how we're helping similar organizations:\n\n• Reduce SSO deployment time by 60%\n• Support 100+ app integrations out of the box\n• Eliminate password-related helpdesk tickets\n\nWorth exploring?" },
      { type: "wait", day: 3, notes: "Wait for response" },
      { type: "linkedin", day: 3, notes: "Connect on LinkedIn" },
      { type: "email", day: 5, subject: "Case study: {{competitor}} SSO migration", content: "Hi {{firstName}},\n\nAttaching a case study of how {{competitor}} migrated 5,000 users to our SSO platform in 3 weeks.\n\nKey results:\n• 95% user adoption in first month\n• $200K annual savings on legacy IAM costs\n• Zero security incidents post-migration\n\nHappy to walk through their approach if relevant." },
      { type: "call", day: 7, notes: "Discovery call - understand current SSO pain points" },
      { type: "wait", day: 3, notes: "Wait after call" },
      { type: "email", day: 10, subject: "Custom SSO roadmap for {{company}}", content: "Hi {{firstName}},\n\nBased on our conversation, I've outlined a potential SSO modernization roadmap for {{company}}.\n\nCan we schedule 30 minutes to review?" },
      { type: "call", day: 14, notes: "Follow-up call to discuss roadmap" }
    ]
  },
  {
    name: "Zero Trust Nurture (21 Days)",
    description: "Long-term nurture for zero trust architecture adoption",
    steps: [
      { type: "email", day: 0, subject: "Zero trust security at {{company}}", content: "Hi {{firstName}},\n\nAs {{company}} scales, traditional perimeter security becomes less effective. We're helping {{industry}} companies implement zero trust architecture.\n\nWould you be interested in a maturity assessment?" },
      { type: "wait", day: 5, notes: "Wait for response" },
      { type: "linkedin", day: 5, notes: "Connect and share zero trust content" },
      { type: "email", day: 7, subject: "Zero trust maturity assessment", content: "Hi {{firstName}},\n\nI've prepared a zero trust maturity assessment specifically for {{industry}} companies.\n\nIt takes 10 minutes and provides:\n• Current security posture score\n• Gap analysis vs. industry leaders\n• Prioritized roadmap\n\nInterested?" },
      { type: "call", day: 10, notes: "Call to discuss assessment results" },
      { type: "wait", day: 4, notes: "Wait after call" },
      { type: "email", day: 14, subject: "{{company}}'s zero trust roadmap", content: "Hi {{firstName}},\n\nBased on our assessment, here's a phased zero trust implementation plan for {{company}}.\n\nPhase 1 (Q1): Passwordless MFA\nPhase 2 (Q2): Device trust\nPhase 3 (Q3): Continuous authentication\n\nShall we dive deeper into Phase 1?" },
      { type: "call", day: 18, notes: "Technical deep-dive call" },
      { type: "email", day: 21, subject: "Next steps for {{company}}", content: "Hi {{firstName}},\n\nGreat speaking with your team. Next steps:\n\n1. Technical proof of concept (2 weeks)\n2. Pilot with IT team (4 weeks)\n3. Full rollout\n\nShall I send over the POC agreement?" }
    ]
  }
];

const AI_SECURITY_TEMPLATES: SequenceTemplate[] = [
  {
    name: "AI Security Discovery (Coming Soon)",
    description: "Agentic security tool outreach - templates to be added",
    steps: [
      { type: "email", day: 0, subject: "[STUB] AI Security intro", content: "Template coming soon for AI Security product line" }
    ]
  }
];

const GONG_TEMPLATES = [...MFA_TEMPLATES, ...AI_SECURITY_TEMPLATES];

const STEP_ICONS: Record<StepType, any> = {
  email: Mail,
  call: Phone,
  linkedin: Linkedin,
  wait: Clock
};

const STEP_COLORS: Record<StepType, string> = {
  email: "bg-cyan-500/20 border-cyan-500/50 text-cyan-400",
  call: "bg-purple-500/20 border-purple-500/50 text-purple-400",
  linkedin: "bg-blue-500/20 border-blue-500/50 text-blue-400",
  wait: "bg-slate-500/20 border-slate-500/50 text-slate-400"
};

export default function SequenceBuilder() {
  const [sequenceName, setSequenceName] = useState("");
  const [steps, setSteps] = useState<SequenceStep[]>([]);
  const [editingStep, setEditingStep] = useState<string | null>(null);

  const addStep = (type: StepType) => {
    const lastDay = steps.length > 0 ? Math.max(...steps.map(s => s.day)) : 0;
    const newStep: SequenceStep = {
      id: `step-${Date.now()}`,
      type,
      day: lastDay + (type === 'wait' ? 2 : 1),
      subject: type === 'email' ? '' : undefined,
      content: type === 'email' ? '' : undefined,
      notes: type !== 'email' ? '' : undefined
    };
    setSteps([...steps, newStep]);
    setEditingStep(newStep.id);
  };

  const removeStep = (id: string) => {
    setSteps(steps.filter(s => s.id !== id));
    if (editingStep === id) setEditingStep(null);
  };

  const updateStep = (id: string, updates: Partial<SequenceStep>) => {
    setSteps(steps.map(s => s.id === id ? { ...s, ...updates } : s));
  };

  const loadTemplate = (template: SequenceTemplate) => {
    setSequenceName(template.name);
    setSteps(template.steps.map((step, index) => ({
      ...step,
      id: `step-${Date.now()}-${index}`
    })));
    toast.success(`Loaded template: ${template.name}`);
  };

  const saveSequence = () => {
    if (!sequenceName) {
      toast.error("Please enter a sequence name");
      return;
    }
    if (steps.length === 0) {
      toast.error("Please add at least one step");
      return;
    }
    
    // In a real app, this would save to the database
    const sequenceData = { name: sequenceName, steps };
    console.log("Saving sequence:", sequenceData);
    toast.success("Sequence saved successfully");
  };

  const totalDays = steps.length > 0 ? Math.max(...steps.map(s => s.day)) : 0;
  const emailCount = steps.filter(s => s.type === 'email').length;
  const callCount = steps.filter(s => s.type === 'call').length;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      <Navigation />

      <div className="container py-8 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold text-white mb-2">Sequence Builder</h1>
            <p className="text-slate-400">
              Create custom outreach sequences with Gong-style cadences
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Badge variant="outline" className="border-cyan-500/30 text-cyan-400">
              {totalDays} days • {emailCount} emails • {callCount} calls
            </Badge>
            <Button
              onClick={saveSequence}
              className="bg-cyan-600 hover:bg-cyan-700 gap-2"
            >
              <Save className="h-4 w-4" />
              Save Sequence
            </Button>
          </div>
        </div>

        {/* Sequence Name */}
        <Card className="bg-slate-900/50 border-slate-800">
          <CardContent className="p-6">
            <Input
              placeholder="Enter sequence name (e.g., 'Enterprise MFA Outreach')"
              value={sequenceName}
              onChange={(e) => setSequenceName(e.target.value)}
              className="bg-slate-950 border-slate-700 text-white text-lg"
            />
          </CardContent>
        </Card>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Templates */}
          <Card className="bg-slate-900/50 border-slate-800">
            <CardHeader>
              <CardTitle className="text-white text-sm">Gong-Style Templates</CardTitle>
              <CardDescription className="text-slate-400 text-xs">
                Pre-built sequences for MFA/SSO and AI Security
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {GONG_TEMPLATES.map((template, index) => (
                <div
                  key={index}
                  className="p-3 bg-slate-950/50 rounded-lg border border-slate-800 hover:border-cyan-500/50 transition-all cursor-pointer group"
                  onClick={() => loadTemplate(template)}
                >
                  <h4 className="font-semibold text-white text-sm mb-1 group-hover:text-cyan-400 transition-colors">
                    {template.name}
                  </h4>
                  <p className="text-xs text-slate-400 mb-2">{template.description}</p>
                  <div className="flex items-center gap-2 text-xs text-slate-500">
                    <span>{template.steps.length} steps</span>
                    <span>•</span>
                    <span>{Math.max(...template.steps.map(s => s.day))} days</span>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Sequence Builder */}
          <Card className="lg:col-span-2 bg-slate-900/50 border-slate-800">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-white">Sequence Flow</CardTitle>
                  <CardDescription className="text-slate-400">
                    Drag to reorder, click to edit
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    onClick={() => addStep('email')}
                    variant="outline"
                    size="sm"
                    className="border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/10"
                  >
                    <Mail className="h-4 w-4 mr-1" />
                    Email
                  </Button>
                  <Button
                    onClick={() => addStep('call')}
                    variant="outline"
                    size="sm"
                    className="border-purple-500/30 text-purple-400 hover:bg-purple-500/10"
                  >
                    <Phone className="h-4 w-4 mr-1" />
                    Call
                  </Button>
                  <Button
                    onClick={() => addStep('linkedin')}
                    variant="outline"
                    size="sm"
                    className="border-blue-500/30 text-blue-400 hover:bg-blue-500/10"
                  >
                    <Linkedin className="h-4 w-4 mr-1" />
                    LinkedIn
                  </Button>
                  <Button
                    onClick={() => addStep('wait')}
                    variant="outline"
                    size="sm"
                    className="border-slate-500/30 text-slate-400 hover:bg-slate-500/10"
                  >
                    <Clock className="h-4 w-4 mr-1" />
                    Wait
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {steps.length === 0 ? (
                <div className="text-center py-12">
                  <Play className="h-12 w-12 text-slate-600 mx-auto mb-4" />
                  <p className="text-slate-500 mb-4">No steps yet. Add your first step or load a template.</p>
                  <Button
                    onClick={() => addStep('email')}
                    variant="outline"
                    className="border-cyan-500/30 text-cyan-400"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add First Step
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  {steps.map((step, index) => {
                    const Icon = STEP_ICONS[step.type];
                    const isEditing = editingStep === step.id;

                    return (
                      <div
                        key={step.id}
                        className={`p-4 rounded-lg border transition-all ${
                          isEditing
                            ? 'bg-slate-950 border-cyan-500'
                            : 'bg-slate-950/50 border-slate-800 hover:border-slate-700'
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <GripVertical className="h-5 w-5 text-slate-600 mt-1 cursor-move" />
                          <div className="flex-1">
                            <div className="flex items-center justify-between mb-3">
                              <div className="flex items-center gap-3">
                                <Badge className={STEP_COLORS[step.type]}>
                                  <Icon className="h-3 w-3 mr-1" />
                                  {step.type.charAt(0).toUpperCase() + step.type.slice(1)}
                                </Badge>
                                <span className="text-sm text-slate-400">Day {step.day}</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <Button
                                  onClick={() => setEditingStep(isEditing ? null : step.id)}
                                  variant="ghost"
                                  size="sm"
                                  className="text-slate-400 hover:text-white"
                                >
                                  {isEditing ? 'Done' : 'Edit'}
                                </Button>
                                <Button
                                  onClick={() => removeStep(step.id)}
                                  variant="ghost"
                                  size="sm"
                                  className="text-red-400 hover:text-red-300"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>

                            {isEditing ? (
                              <div className="space-y-3">
                                <div>
                                  <label className="text-xs text-slate-400 mb-1 block">Day</label>
                                  <Input
                                    type="number"
                                    value={step.day}
                                    onChange={(e) => updateStep(step.id, { day: parseInt(e.target.value) || 0 })}
                                    className="bg-slate-900 border-slate-700 text-white"
                                  />
                                </div>
                                {step.type === 'email' && (
                                  <>
                                    <div>
                                      <label className="text-xs text-slate-400 mb-1 block">Subject</label>
                                      <Input
                                        value={step.subject || ''}
                                        onChange={(e) => updateStep(step.id, { subject: e.target.value })}
                                        placeholder="Email subject line"
                                        className="bg-slate-900 border-slate-700 text-white"
                                      />
                                    </div>
                                    <div>
                                      <label className="text-xs text-slate-400 mb-1 block">Content</label>
                                      <Textarea
                                        value={step.content || ''}
                                        onChange={(e) => updateStep(step.id, { content: e.target.value })}
                                        placeholder="Email body (use {{firstName}}, {{company}}, etc.)"
                                        rows={6}
                                        className="bg-slate-900 border-slate-700 text-white font-mono text-sm"
                                      />
                                    </div>
                                  </>
                                )}
                                {step.type !== 'email' && (
                                  <div>
                                    <label className="text-xs text-slate-400 mb-1 block">Notes</label>
                                    <Textarea
                                      value={step.notes || ''}
                                      onChange={(e) => updateStep(step.id, { notes: e.target.value })}
                                      placeholder="Notes for this step"
                                      rows={3}
                                      className="bg-slate-900 border-slate-700 text-white"
                                    />
                                  </div>
                                )}
                              </div>
                            ) : (
                              <div className="text-sm">
                                {step.type === 'email' && (
                                  <>
                                    <p className="font-semibold text-white mb-1">{step.subject || 'No subject'}</p>
                                    <p className="text-slate-400 line-clamp-2">{step.content || 'No content'}</p>
                                  </>
                                )}
                                {step.type !== 'email' && (
                                  <p className="text-slate-400">{step.notes || 'No notes'}</p>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
