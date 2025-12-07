import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Copy, CheckCircle2, Webhook, ArrowRight } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export default function ClayWebhookSetup() {
  const [copied, setCopied] = useState(false);
  
  const webhookUrl = `${window.location.origin}/api/trpc/clayWebhook.receive`;
  
  const copyToClipboard = () => {
    navigator.clipboard.writeText(webhookUrl);
    setCopied(true);
    toast.success("Webhook URL copied!");
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <div>
          <h1 className="text-4xl font-bold text-white mb-2">Clay Webhook Setup</h1>
          <p className="text-slate-400">
            Connect Clay to automatically push enriched data to your dashboard
          </p>
        </div>

        {/* Webhook URL Card */}
        <Card className="bg-slate-900/50 border-slate-700">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-white">
              <Webhook className="w-5 h-5 text-cyan-400" />
              Your Webhook URL
            </CardTitle>
            <CardDescription>
              Use this URL in Clay's HTTP API integration
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2">
              <div className="flex-1 bg-slate-950 p-3 rounded border border-slate-700 font-mono text-sm text-cyan-400 overflow-x-auto">
                {webhookUrl}
              </div>
              <Button
                onClick={copyToClipboard}
                variant="outline"
                className="shrink-0"
              >
                {copied ? (
                  <>
                    <CheckCircle2 className="w-4 h-4 mr-2 text-green-400" />
                    Copied!
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4 mr-2" />
                    Copy
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Setup Instructions */}
        <Card className="bg-slate-900/50 border-slate-700">
          <CardHeader>
            <CardTitle className="text-white">Setup Instructions</CardTitle>
            <CardDescription>
              Follow these steps to connect Clay to your dashboard
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Step 1 */}
            <div className="flex gap-4">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-cyan-500/20 flex items-center justify-center text-cyan-400 font-bold">
                1
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-white mb-2">Open your Clay table</h3>
                <p className="text-slate-400 text-sm">
                  Navigate to the Clay table containing your enriched account data
                </p>
              </div>
            </div>

            {/* Step 2 */}
            <div className="flex gap-4">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-cyan-500/20 flex items-center justify-center text-cyan-400 font-bold">
                2
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-white mb-2">Add HTTP API column</h3>
                <p className="text-slate-400 text-sm mb-2">
                  Click "Add enrichment" → Search for "HTTP API" → Select it
                </p>
                <div className="bg-slate-950 p-3 rounded border border-slate-700 text-sm space-y-2">
                  <div><span className="text-slate-500">Method:</span> <span className="text-white">POST</span></div>
                  <div><span className="text-slate-500">Endpoint:</span> <span className="text-cyan-400 font-mono text-xs break-all">{webhookUrl}</span></div>
                </div>
              </div>
            </div>

            {/* Step 3 */}
            <div className="flex gap-4">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-cyan-500/20 flex items-center justify-center text-cyan-400 font-bold">
                3
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-white mb-2">Configure the body</h3>
                <p className="text-slate-400 text-sm mb-2">
                  In the "Body" field, map your Clay columns to send all enrichment data:
                </p>
                <div className="bg-slate-950 p-3 rounded border border-slate-700 font-mono text-xs text-slate-300 overflow-x-auto">
                  <pre>{`{
  "domain": {{domain}},
  "name": {{company_name}},
  "tech_stack": {{tech_stack_column}},
  "research": {{research_column}},
  "triggers": {{buying_signals_column}},
  "employee_count": {{employee_count}},
  "industry": {{industry}}
}`}</pre>
                </div>
                <p className="text-slate-400 text-xs mt-2">
                  Replace <code className="bg-slate-800 px-1 rounded">{"{{column_name}}"}</code> with your actual Clay column references
                </p>
              </div>
            </div>

            {/* Step 4 */}
            <div className="flex gap-4">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-cyan-500/20 flex items-center justify-center text-cyan-400 font-bold">
                4
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-white mb-2">Run the enrichment</h3>
                <p className="text-slate-400 text-sm">
                  Click "Run" on the HTTP API column for all rows. Clay will send each row's data to your dashboard automatically.
                </p>
              </div>
            </div>

            {/* Step 5 */}
            <div className="flex gap-4">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-green-500/20 flex items-center justify-center text-green-400 font-bold">
                ✓
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-white mb-2">Verify the import</h3>
                <p className="text-slate-400 text-sm">
                  Check your Accounts page to see the enriched data appear with full JSON fields (no more placeholders!)
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Tips Card */}
        <Card className="bg-slate-900/50 border-slate-700">
          <CardHeader>
            <CardTitle className="text-white">💡 Pro Tips</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-slate-300">
            <div className="flex gap-2">
              <ArrowRight className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
              <p>The webhook automatically categorizes fields into stack, research, and triggers based on column names</p>
            </div>
            <div className="flex gap-2">
              <ArrowRight className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
              <p>If an account already exists (matched by domain), it will be updated with new data</p>
            </div>
            <div className="flex gap-2">
              <ArrowRight className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
              <p>All JSON objects are preserved - no more "✅ 726 Technologies Found" placeholders!</p>
            </div>
            <div className="flex gap-2">
              <ArrowRight className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
              <p>You can run this on existing rows or set it to auto-run on new rows added to Clay</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
