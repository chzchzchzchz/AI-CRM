import { useState, useCallback } from"react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from"@/components/ui/card";
import { Button } from"@/components/ui/button";
import { Badge } from"@/components/ui/badge";
import { Progress } from"@/components/ui/progress";
import { trpc } from"@/lib/trpc";
import { toast } from"sonner";
import { 
  Upload, FileSpreadsheet, Download, Sparkles, CheckCircle2, 
  AlertCircle, Loader2, X, FileText, Zap, Settings2
} from"lucide-react";

interface ProcessingResult {
  originalCount: number;
  cleanedCount: number;
  removedCount: number;
  issues: string[];
  cleanedData: any[];
}

export default function LeadProcessor() {
  const [files, setFiles] = useState<File[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<ProcessingResult | null>(null);

  const processLeadsMutation = trpc.tools.processLeads.useMutation();

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const droppedFiles = Array.from(e.dataTransfer.files).filter(f => 
      f.name.endsWith('.csv') || f.name.endsWith('.xlsx')
    );
    if (droppedFiles.length > 0) {
      setFiles(droppedFiles);
      setResult(null);
    } else {
      toast.error("Please upload CSV or XLSX files only");
    }
  }, []);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || []).filter(f =>
      f.name.endsWith('.csv') || f.name.endsWith('.xlsx')
    );
    if (selectedFiles.length > 0) {
      setFiles(selectedFiles);
      setResult(null);
    }
  };

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };

  const processFiles = async () => {
    if (files.length === 0) return;

    setIsProcessing(true);
    setProgress(0);
    setResult(null);

    try {
      // Read file contents
      const fileContents: string[] = [];
      for (const file of files) {
        const text = await file.text();
        fileContents.push(text);
      }

      setProgress(20);

      // Send to server for AI-powered processing
      const response = await processLeadsMutation.mutateAsync({
        fileContents,
        fileNames: files.map(f => f.name)
      });

      setProgress(100);
      setResult(response);
      toast.success(`Processed ${response.cleanedCount} leads successfully!`);
    } catch (error) {
      // e.g. ".xlsx" uploads throw a specific "export to CSV" error server-side —
      // flattening every failure into one generic message would hide that actionable
      // reason behind advice ("try again") that can't fix a file-format problem.
      const message = error instanceof Error && error.message ? error.message : "Failed to process files. Please try again.";
      toast.error(message);
      console.error(error);
    } finally {
      setIsProcessing(false);
    }
  };

  const downloadCSV = () => {
    if (!result?.cleanedData) return;
    if (result.cleanedData.length === 0) {
      // Every row got filtered out (personal email, unqualified title, or no
      // contact info). Downloading here would produce a header-less, empty file
      // while still telling the user "CSV downloaded!" — a success claim for an
      // action that produced nothing usable.
      toast.error("Nothing to download — every row was filtered out. See the issues list below.");
      return;
    }

    // Convert to CSV
    const headers = Object.keys(result.cleanedData[0] || {});
    const csvContent = [
      headers.join(','),
      ...result.cleanedData.map(row => 
        headers.map(h => {
          const val = row[h] || '';
          // Escape quotes and wrap in quotes if contains comma
          const escaped = String(val).replace(/"/g, '""');
          return escaped.includes(',') ? `"${escaped}"` : escaped;
        }).join(',')
      )
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'processed_leads.csv';
    a.click();
    URL.revokeObjectURL(url);
    toast.success("CSV downloaded!");
  };

  return (
    <div className="text-foreground">
    <div className="container py-1 max-w-4xl">
      {/* Header */}
      <div className="mb-8">
        <div className="flex flex-wrap items-center gap-3 mb-2">
          <div className="p-2 bg-muted border border-border-strong rounded-md">
            <Zap className="h-6 w-6 text-accent" />
          </div>
          <h1 className="text-xl font-semibold">Intelligent Lead Processor</h1>
        </div>
        <p className="text-muted-foreground">
          AI-powered lead cleaning with 90+ rules. Drag, drop, and export clean data.
        </p>
      </div>

      {/* Upload Area */}
      <Card className="mb-6">
        <CardContent className="p-6">
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`border-2 border-dashed rounded-md p-8 text-center transition-all cursor-pointer ${ isDragging ? 'border-accent/30 bg-accent-subtle' : 'border-border-strong hover:border-border-strong' }`}
            onClick={() => document.getElementById('file-input')?.click()}
          >
            <input
              id="file-input"
              type="file"
              multiple
              accept=".csv,.xlsx"
              onChange={handleFileSelect}
              className="hidden"
            />
            <Upload className="h-12 w-12 mx-auto mb-4 text-ink-muted" />
            <p className="font-semibold text-lg mb-1">Drag & Drop Your Lead Files Here</p>
            <p className="text-sm text-muted-foreground">
              Accepts <span className="text-positive font-medium">.xlsx</span> or{' '}
              <span className="text-accent font-medium">.csv</span> files
            </p>
            <Button variant="link" className="mt-2 text-accent">
              Or click to select files
            </Button>
          </div>

          {/* Selected Files */}
          {files.length > 0 && (
            <div className="mt-4 space-y-2">
              {files.map((file, i) => (
                <div key={i} className="flex items-center justify-between p-3 bg-muted rounded-sm">
                  <div className="flex flex-wrap items-center gap-2">
                    <FileSpreadsheet className="h-5 w-5 text-positive" />
                    <span className="font-medium">{file.name}</span>
                    <span className="text-xs text-muted-foreground">
                      ({(file.size / 1024).toFixed(1)} KB)
                    </span>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => removeFile(i)}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Processing Rules Info */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex flex-wrap items-center gap-2 text-lg">
            <Settings2 className="h-5 w-5 text-accent" />
            AI Processing Rules
          </CardTitle>
          <CardDescription>
            Automatically applied to your data
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {["Field name mapping","Phone number formatting","Company name cleaning","Status standardization","Email validation","Personal email filtering","Title normalization","Region mapping","Duplicate detection","Campaign name generation","Employee count parsing","Industry classification"
            ].map((rule, i) => (
              <div key={i} className="flex items-center gap-2 text-sm">
                <CheckCircle2 className="h-4 w-4 text-positive flex-shrink-0" />
                <span>{rule}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Process Button */}
      <Button
        onClick={processFiles}
        disabled={files.length === 0 || isProcessing}
        className="w-full py-6 text-lg"
      >
        {isProcessing ? (
          <>
            <Loader2 className="h-5 w-5 mr-2 animate-spin" />
            Processing...
          </>
        ) : (
          <>
            <Sparkles className="h-5 w-5 mr-2" />
            Process & Clean Leads
          </>
        )}
      </Button>

      {/* Progress */}
      {isProcessing && (
        <div className="mt-4">
          <Progress value={progress} className="h-2" />
          <p className="text-sm text-muted-foreground mt-2 text-center">
            {progress < 20 ?"Reading files..." : 
             progress < 80 ?"AI processing rules..." :"Finalizing..."}
          </p>
        </div>
      )}

      {/* Results */}
      {result && (
        <Card className="mt-6 border-positive/30">
          <CardHeader>
            <CardTitle className="flex flex-wrap items-center gap-2 text-positive">
              <CheckCircle2 className="h-5 w-5" />
              Processing Complete
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4 mb-6">
              <div className="text-center p-4 bg-muted rounded-sm">
                <p className="text-2xl font-semibold text-accent">{result.originalCount}</p>
                <p className="text-sm text-muted-foreground">Original Records</p>
              </div>
              <div className="text-center p-4 bg-muted rounded-sm">
                <p className="text-2xl font-semibold text-positive">{result.cleanedCount}</p>
                <p className="text-sm text-muted-foreground">Cleaned Records</p>
              </div>
              <div className="text-center p-4 bg-muted rounded-sm">
                <p className="text-2xl font-semibold text-critical">{result.removedCount}</p>
                <p className="text-sm text-muted-foreground">Removed/Filtered</p>
              </div>
            </div>

            {result.issues.length > 0 && (
              <div className="mb-6">
                <p className="font-medium mb-2 flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 text-caution" />
                  Issues Found:
                </p>
                <div className="space-y-1">
                  {result.issues.slice(0, 5).map((issue, i) => (
                    <p key={i} className="text-sm text-muted-foreground">• {issue}</p>
                  ))}
                  {result.issues.length > 5 && (
                    <p className="text-sm text-muted-foreground">
                      ...and {result.issues.length - 5} more
                    </p>
                  )}
                </div>
              </div>
            )}

            <Button
              onClick={downloadCSV}
              className="w-full"
              variant="outline"
              disabled={result.cleanedData.length === 0}
              title={result.cleanedData.length === 0 ? "Every row was filtered out — nothing to download" : undefined}
            >
              <Download className="h-4 w-4 mr-2" />
              {result.cleanedData.length === 0 ? "Nothing to Download" : "Download Clean CSV"}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Footer */}
      <p className="text-xs text-center text-muted-foreground mt-6">
        All processing uses AI to intelligently clean and standardize your data.
      </p>
    </div>
    </div>
  );
}
