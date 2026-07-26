import { useState, useCallback, useRef } from"react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from"@/components/ui/card";
import { Button } from"@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from"@/components/ui/tabs";
import { Badge } from"@/components/ui/badge";
import { Progress } from"@/components/ui/progress";
import { trpc } from"@/lib/trpc";
import { toast } from"sonner";
import { 
  Upload, FileSpreadsheet, Sparkles, Loader2, Download, 
  CheckCircle2, XCircle, AlertTriangle, Database, 
  Users, Building2, Phone, Mail, Zap, Brain, FileText
} from"lucide-react";

type DataType = 'auto' | 'leads' | 'accounts' | 'contacts' | 'enrichment';
type ProcessingStatus = 'idle' | 'uploading' | 'analyzing' | 'processing' | 'complete' | 'error';

interface ProcessingResult {
  originalCount: number;
  cleanedCount: number;
  removedCount: number;
  issues: string[];
  cleanedData: any[];
  dataType: DataType;
  fieldMappings: Record<string, string>;
}

export default function DataHub() {
  const [files, setFiles] = useState<File[]>([]);
  const [status, setStatus] = useState<ProcessingStatus>('idle');
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<ProcessingResult | null>(null);
  const [detectedType, setDetectedType] = useState<DataType>('auto');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const kbInputRef = useRef<HTMLInputElement>(null);

  const processLeadsMutation = trpc.tools.processLeads.useMutation();
  const uploadDocMutation = trpc.tools.uploadDocument.useMutation({
    onSuccess: (_r, vars) => toast.success(`Added"${vars.fileName}" to the knowledge base`),
    onError: (e) => toast.error(e.message ||"Upload failed"),
  });

  // Knowledge-base upload: read a text document and index it for AI context.
  const handleKbUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (e.target) e.target.value ="";
    if (!file) return;
    const ext = file.name.split(".").pop()?.toLowerCase() ||"";
    if (!["txt","md","csv","json","html"].includes(ext)) {
      toast.error("Text documents only (.txt, .md, .csv, .json, .html).");
      return;
    }
    const content = await file.text();
    uploadDocMutation.mutate({ fileName: file.name, content, mimeType: file.type ||"text/plain", category:"general" });
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const droppedFiles = Array.from(e.dataTransfer.files).filter(
      f => f.name.endsWith('.csv') || f.name.endsWith('.xlsx')
    );
    if (droppedFiles.length > 0) {
      setFiles(droppedFiles);
      setResult(null);
    }
  }, []);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const selectedFiles = Array.from(e.target.files).filter(
        f => f.name.endsWith('.csv') || f.name.endsWith('.xlsx')
      );
      if (selectedFiles.length > 0) {
        setFiles(selectedFiles);
        setResult(null);
      }
    }
  };

  const detectDataType = (headers: string[]): DataType => {
    const headerSet = new Set(headers.map(h => h.toLowerCase()));
    
    // Check for lead-specific fields
    if (headerSet.has('attendance') || headerSet.has('registration') || headerSet.has('webinar')) {
      return 'leads';
    }
    
    // Check for contact-specific fields
    if ((headerSet.has('firstname') || headerSet.has('first name')) && 
        (headerSet.has('email') || headerSet.has('phone'))) {
      return 'contacts';
    }
    
    // Check for account/company fields
    if (headerSet.has('domain') || headerSet.has('website') || 
        (headerSet.has('company') && headerSet.has('industry'))) {
      return 'accounts';
    }
    
    // Check for enrichment data
    if (headerSet.has('techstack') || headerSet.has('tech stack') || 
        headerSet.has('funding') || headerSet.has('revenue')) {
      return 'enrichment';
    }
    
    return 'auto';
  };

  const processFiles = async () => {
    if (files.length === 0) return;

    setStatus('uploading');
    setProgress(10);

    try {
      // Read file contents
      const fileContents: string[] = [];
      const fileNames: string[] = [];

      for (const file of files) {
        const content = await file.text();
        fileContents.push(content);
        fileNames.push(file.name);
      }

      setStatus('analyzing');
      setProgress(30);

      // Detect data type from first file
      const firstContent = fileContents[0];
      const firstLine = firstContent.split('\n')[0];
      const headers = firstLine.split(',').map(h => h.trim().replace(/^"|"$/g, ''));
      const detected = detectDataType(headers);
      setDetectedType(detected);

      setStatus('processing');
      setProgress(50);

      // Process through AI
      const result = await processLeadsMutation.mutateAsync({
        fileContents,
        fileNames
      });

      setProgress(90);

      setResult({
        ...result,
        dataType: detected,
        fieldMappings: {} // Would come from server
      });

      setStatus('complete');
      setProgress(100);
      toast.success(`Processed ${result.cleanedCount} records successfully!`);

    } catch (error) {
      console.error('Processing error:', error);
      setStatus('error');
      toast.error('Failed to process files. Please try again.');
    }
  };

  const downloadCleanedData = () => {
    if (!result?.cleanedData) return;

    const headers = Object.keys(result.cleanedData[0] || {});
    const csv = [
      headers.join(','),
      ...result.cleanedData.map(row => 
        headers.map(h => `"${String(row[h] || '').replace(/"/g, '""')}"`).join(',')
      )
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cleaned_data_${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const getDataTypeIcon = (type: DataType) => {
    switch (type) {
      case 'leads': return <Users className="h-4 w-4" />;
      case 'accounts': return <Building2 className="h-4 w-4" />;
      case 'contacts': return <Mail className="h-4 w-4" />;
      case 'enrichment': return <Database className="h-4 w-4" />;
      default: return <FileSpreadsheet className="h-4 w-4" />;
    }
  };

  const getDataTypeColor = (type: DataType) => {
    switch (type) {
      case 'leads': return 'bg-accent-subtle text-accent border-accent/30';
      case 'accounts': return 'bg-accent-subtle text-accent border-accent/30';
      case 'contacts': return 'bg-positive-subtle text-positive border-positive/30';
      case 'enrichment': return 'bg-caution-subtle text-caution border-caution/30';
      default: return 'bg-muted text-ink-muted border-border';
    }
  };

  return (
    <div className="text-foreground">
    <div className="container py-1 max-w-6xl">
      {/* Header */}
      <div className="mb-8">
        <div className="flex flex-wrap items-center gap-3 mb-2">
          <div className="p-2 bg-muted border border-border-strong rounded-md">
            <Brain className="h-6 w-6 text-accent" />
          </div>
          <div>
            <h1 className="text-xl font-semibold">AI Data Hub</h1>
            <p className="text-muted-foreground">
              Intelligent data processing that learns from your corrections
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Upload Section */}
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex flex-wrap items-center gap-2">
                <Upload className="h-5 w-5 text-accent" />
                Upload Data
              </CardTitle>
              <CardDescription>
                Drop any CSV or Excel file - AI will detect the data type and apply smart processing
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div
                onDrop={handleDrop}
                onDragOver={(e) => e.preventDefault()}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-md p-8 text-center cursor-pointer transition-all ${files.length > 0 ? 'border-accent/30 bg-accent-subtle' : 'border-border hover:border-accent/30 hover:bg-accent-subtle'}`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,.xlsx"
                  multiple
                  onChange={handleFileSelect}
                  className="hidden"
                />
                
                {files.length > 0 ? (
                  <div className="space-y-3">
                    <FileSpreadsheet className="h-12 w-12 mx-auto text-accent" />
                    <div>
                      <p className="font-medium">{files.length} file(s) selected</p>
                      <p className="text-sm text-muted-foreground">
                        {files.map(f => f.name).join(', ')}
                      </p>
                    </div>
                    {detectedType !== 'auto' && (
                      <Badge className={getDataTypeColor(detectedType)}>
                        {getDataTypeIcon(detectedType)}
                        <span className="ml-1 capitalize">{detectedType} Data Detected</span>
                      </Badge>
                    )}
                  </div>
                ) : (
                  <div className="space-y-3">
                    <Upload className="h-12 w-12 mx-auto text-muted-foreground" />
                    <div>
                      <p className="font-medium">Drop files here or click to browse</p>
                      <p className="text-sm text-muted-foreground">
                        Supports CSV and Excel files
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* Processing Status */}
              {status !== 'idle' && status !== 'complete' && (
                <div className="mt-6 space-y-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="flex flex-wrap items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      {status === 'uploading' && 'Uploading files...'}
                      {status === 'analyzing' && 'AI analyzing data structure...'}
                      {status === 'processing' && 'Applying smart transformations...'}
                    </span>
                    <span>{progress}%</span>
                  </div>
                  <Progress value={progress} className="h-2" />
                </div>
              )}

              {/* Action Buttons */}
              <div className="mt-6 flex flex-wrap gap-3">
                <Button
                  onClick={processFiles}
                  disabled={files.length === 0 || status === 'processing' || status === 'analyzing'}
                  className="flex-1"
                >
                  {status === 'processing' || status === 'analyzing' ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-4 w-4 mr-2" />
                      Process with AI
                    </>
                  )}
                </Button>
                
                {result && (
                  <Button variant="outline" onClick={downloadCleanedData}>
                    <Download className="h-4 w-4 mr-2" />
                    Download Clean Data
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Results */}
          {result && (
            <Card>
              <CardHeader>
                <CardTitle className="flex flex-wrap items-center gap-2">
                  <CheckCircle2 className="h-5 w-5 text-positive" />
                  Processing Complete
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 gap-4 mb-6">
                  <div className="text-center p-4 bg-muted/50 rounded-sm">
                    <p className="text-2xl font-semibold text-accent">{result.originalCount}</p>
                    <p className="text-sm text-muted-foreground">Total Records</p>
                  </div>
                  <div className="text-center p-4 bg-positive-subtle rounded-sm">
                    <p className="text-2xl font-semibold text-positive">{result.cleanedCount}</p>
                    <p className="text-sm text-muted-foreground">Cleaned</p>
                  </div>
                  <div className="text-center p-4 bg-critical-subtle rounded-sm">
                    <p className="text-2xl font-semibold text-critical">{result.removedCount}</p>
                    <p className="text-sm text-muted-foreground">Removed</p>
                  </div>
                </div>

                {result.issues.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-sm font-medium flex flex-wrap items-center gap-2">
                      <AlertTriangle className="h-4 w-4 text-caution" />
                      Issues Found ({result.issues.length})
                    </p>
                    <div className="max-h-40 overflow-y-auto space-y-1">
                      {result.issues.slice(0, 10).map((issue, i) => (
                        <p key={i} className="text-xs text-muted-foreground bg-muted/50 px-2 py-1 rounded">
                          {issue}
                        </p>
                      ))}
                      {result.issues.length > 10 && (
                        <p className="text-xs text-muted-foreground">
                          +{result.issues.length - 10} more issues
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>

        {/* Sidebar - Processing Rules & Knowledge */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex flex-wrap items-center gap-2">
                <Zap className="h-4 w-4 text-caution" />
                AI Processing Rules
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {[
                { icon: <Mail className="h-4 w-4" />, label: 'Email validation & deduplication' },
                { icon: <Phone className="h-4 w-4" />, label: 'Phone number formatting' },
                { icon: <Building2 className="h-4 w-4" />, label: 'Company name standardization' },
                { icon: <Users className="h-4 w-4" />, label: 'Title normalization' },
                { icon: <Database className="h-4 w-4" />, label: 'Field mapping & merging' },
                { icon: <XCircle className="h-4 w-4" />, label: 'Personal email filtering' },
              ].map((rule, i) => (
                <div key={i} className="flex flex-wrap items-center gap-2 text-sm">
                  <div className="text-positive">{rule.icon}</div>
                  <span>{rule.label}</span>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base flex flex-wrap items-center gap-2">
                <Brain className="h-4 w-4 text-accent" />
                Learning from You
              </CardTitle>
              <CardDescription>
                The AI improves based on your corrections
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="text-sm text-muted-foreground">
                <p>When you edit processed data, the AI learns:</p>
                <ul className="list-disc list-inside mt-2 space-y-1">
                  <li>Your field naming preferences</li>
                  <li>Custom validation rules</li>
                  <li>Industry-specific formatting</li>
                  <li>Data quality standards</li>
                </ul>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <FileText className="h-4 w-4 text-accent" />
                Knowledge Base
              </CardTitle>
              <CardDescription>
                Upload docs to enhance AI context
              </CardDescription>
            </CardHeader>
            <CardContent>
              <input ref={kbInputRef} type="file" accept=".txt,.md,.csv,.json,.html" className="hidden" onChange={handleKbUpload} />
              <Button variant="outline" className="w-full" disabled={uploadDocMutation.isPending} onClick={() => kbInputRef.current?.click()}>
                <Upload className="h-4 w-4 mr-2" />
                {uploadDocMutation.isPending ?"Uploading…" :"Upload Documents"}
              </Button>
              <p className="text-xs text-muted-foreground mt-2">
                Battle cards, playbooks, and product docs will be used to enrich AI outputs
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
    </div>
  );
}
