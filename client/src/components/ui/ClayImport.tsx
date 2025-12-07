import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Navigation } from "@/components/Navigation";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Upload, Database, CheckCircle, XCircle, Loader2 } from "lucide-react";

export default function ClayImport() {
  const [jsonData, setJsonData] = useState("");
  const [importing, setImporting] = useState(false);
  
  const importMutation = trpc.clayImport.importRawData.useMutation();
  const { data: stats, refetch: refetchStats } = trpc.clayImport.getImportStats.useQuery();

  const handleImport = async () => {
    if (!jsonData.trim()) {
      toast.error("Please paste data (CSV, TSV, JSON, or Excel)");
      return;
    }

    setImporting(true);
    try {
      const result = await importMutation.mutateAsync({ rawData: jsonData });
      
      toast.success(`Import complete! ${result.imported} imported, ${result.updated} updated`);
      if (result.errors > 0) {
        toast.warning(`${result.errors} errors occurred`);
      }
      
      setJsonData("");
      refetchStats();
    } catch (error: any) {
      toast.error(`Import failed: ${error.message}`);
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-cyan-950 to-slate-950">
      <Navigation />
      
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-white mb-2">Clay Data Import</h1>
          <p className="text-slate-400">Import enriched account data from Clay with full JSON fields</p>
        </div>

        <div className="grid gap-6 md:grid-cols-2 mb-6">
          <Card className="bg-slate-900/50 border-slate-700">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <Database className="w-5 h-5 text-cyan-400" />
                Current Database Stats
              </CardTitle>
            </CardHeader>
            <CardContent>
              {stats ? (
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Total Accounts:</span>
                    <span className="text-white font-bold">{stats.total}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">With Tech Stack:</span>
                    <span className="text-white font-bold">{stats.withStack}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">With Research:</span>
                    <span className="text-white font-bold">{stats.withResearch}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">With Triggers:</span>
                    <span className="text-white font-bold">{stats.withTriggers}</span>
                  </div>
                </div>
              ) : (
                <div className="text-slate-400">Loading...</div>
              )}
            </CardContent>
          </Card>

          <Card className="bg-slate-900/50 border-slate-700">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <Upload className="w-5 h-5 text-cyan-400" />
                How to Extract Clay Data
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-slate-300 space-y-2">
              <p><strong>✨ Paste ANY Format - It Just Works!</strong></p>
              <ol className="list-decimal list-inside space-y-1 text-slate-400">
                <li><strong>From Clay:</strong> Select all rows → Copy (Cmd/Ctrl+C) → Paste below</li>
                <li><strong>From Excel/Sheets:</strong> Select cells → Copy → Paste below</li>
                <li><strong>From CSV file:</strong> Open in text editor → Copy all → Paste below</li>
                <li><strong>From JSON:</strong> Just paste the JSON directly</li>
              </ol>
              
              <p className="mt-4"><strong>Supported Formats:</strong></p>
              <ul className="list-disc list-inside text-slate-400 space-y-1">
                <li>Tab-separated (TSV) - from Excel/Sheets copy-paste</li>
                <li>Comma-separated (CSV)</li>
                <li>Pipe-separated (|)</li>
                <li>JSON arrays or objects</li>
              </ul>
              
              <p className="mt-4 text-cyan-400"><strong>The parser automatically:</strong></p>
              <ul className="list-disc list-inside text-slate-400 space-y-1">
                <li>Detects the format and delimiter</li>
                <li>Maps columns to the right fields (stack, research, triggers)</li>
                <li>Parses JSON values within cells</li>
                <li>Handles quoted values and special characters</li>
              </ul>
            </CardContent>
          </Card>
        </div>

        <Card className="bg-slate-900/50 border-slate-700">
          <CardHeader>
            <CardTitle className="text-white">Import JSON Data</CardTitle>
            <CardDescription className="text-slate-400">
              Paste the JSON array of enriched accounts below
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Textarea
              value={jsonData}
              onChange={(e) => setJsonData(e.target.value)}
              placeholder='Paste your data here (CSV, TSV, JSON, or Excel copy-paste)...\n\nExample:\nName\tDomain\tTech Stack\tResearch\nCompany A\tcompanya.com\t{"tools": [...]}\t{"insights": [...]}\nCompany B\tcompanyb.com\t{"tools": [...]}\t{"insights": [...]}'
              className="min-h-[300px] font-mono text-sm bg-slate-950 border-slate-700 text-white"
            />
            
            <div className="flex gap-4">
              <Button
                onClick={handleImport}
                disabled={importing || !jsonData.trim()}
                className="bg-cyan-600 hover:bg-cyan-700"
              >
                {importing ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Importing...
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4 mr-2" />
                    Import Data
                  </>
                )}
              </Button>
              
              <Button
                variant="outline"
                onClick={() => setJsonData("")}
                disabled={importing}
                className="border-slate-600 text-slate-300 hover:bg-slate-800"
              >
                Clear
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-slate-900/50 border-slate-700 mt-6">
          <CardHeader>
            <CardTitle className="text-white">Clay Extraction Script</CardTitle>
            <CardDescription className="text-slate-400">
              Copy this script and run it in your Clay table's browser console
            </CardDescription>
          </CardHeader>
          <CardContent>
            <pre className="bg-slate-950 p-4 rounded text-xs overflow-x-auto text-slate-300">
{`// Paste this in Clay's browser console (F12)
// It will attempt to extract all visible row data
(function() {
  const rows = document.querySelectorAll('[data-row-id], tr[data-id]');
  const data = [];
  
  rows.forEach(row => {
    const cells = row.querySelectorAll('td');
    if (cells.length > 0) {
      const rowData = {
        name: cells[0]?.textContent?.trim() || '',
        domain: cells[1]?.textContent?.trim() || '',
        stack: {},
        research: {},
        trigger: {},
        rawData: {}
      };
      data.push(rowData);
    }
  });
  
  console.log(JSON.stringify(data, null, 2));
  
  // Download as file
  const blob = new Blob([JSON.stringify(data, null, 2)], {type: 'application/json'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'clay-export.json';
  a.click();
})();`}
            </pre>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
