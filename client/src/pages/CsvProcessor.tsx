import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { 
  Upload, FileSpreadsheet, Sparkles, Download, ArrowRight, 
  CheckCircle2, AlertCircle, Loader2, Trash2, Eye, Settings,
  HelpCircle, Wand2, RefreshCw
} from "lucide-react";
import { trpc } from "@/lib/trpc";

interface UploadedFile {
  name: string;
  headers: string[];
  rows: Record<string, string>[];
  rowCount: number;
}

interface FieldMapping {
  [targetField: string]: string | null;
}

interface Transformation {
  field: string;
  type: string;
  description: string;
}

export default function CsvProcessor() {
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [combinedData, setCombinedData] = useState<{ headers: string[]; rows: Record<string, string>[] } | null>(null);
  const [mappings, setMappings] = useState<FieldMapping>({});
  const [transformations, setTransformations] = useState<Transformation[]>([]);
  const [eventName, setEventName] = useState("");
  const [defaultStatus, setDefaultStatus] = useState("Registered");
  const [contactOwner, setContactOwner] = useState("");
  const [processedCsv, setProcessedCsv] = useState<string | null>(null);
  const [previewData, setPreviewData] = useState<Record<string, string>[] | null>(null);
  const [step, setStep] = useState<"upload" | "configure" | "map" | "preview" | "export">("upload");
  const [warnings, setWarnings] = useState<string[]>([]);
  const [confidence, setConfidence] = useState<number>(0);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  const { data: templateInfo } = trpc.csvProcessor.getTemplateInfo.useQuery();
  const analyzeAndMapMutation = trpc.csvProcessor.analyzeAndMap.useMutation();
  const processDataMutation = trpc.csvProcessor.processData.useMutation();

  // Parse CSV file
  const parseCSV = (text: string): { headers: string[]; rows: Record<string, string>[] } => {
    const lines = text.split(/\r?\n/).filter(line => line.trim());
    if (lines.length === 0) return { headers: [], rows: [] };

    // Parse header
    const headers = parseCSVLine(lines[0]);
    
    // Parse rows
    const rows: Record<string, string>[] = [];
    for (let i = 1; i < lines.length; i++) {
      const values = parseCSVLine(lines[i]);
      const row: Record<string, string> = {};
      headers.forEach((header, idx) => {
        row[header] = values[idx] || "";
      });
      rows.push(row);
    }

    return { headers, rows };
  };

  // Parse a single CSV line handling quotes
  const parseCSVLine = (line: string): string[] => {
    const result: string[] = [];
    let current = "";
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === "," && !inQuotes) {
        result.push(current.trim());
        current = "";
      } else {
        current += char;
      }
    }
    result.push(current.trim());
    return result;
  };

  // Handle file upload
  const handleFileUpload = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files) return;

    Array.from(files).forEach(file => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const text = e.target?.result as string;
        const { headers, rows } = parseCSV(text);
        
        setUploadedFiles(prev => [...prev, {
          name: file.name,
          headers,
          rows,
          rowCount: rows.length,
        }]);
      };
      reader.readAsText(file);
    });

    // Reset input
    event.target.value = "";
  }, []);

  // Handle drag and drop
  const handleDrop = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    const files = event.dataTransfer.files;
    
    Array.from(files).forEach(file => {
      if (file.type === "text/csv" || file.name.endsWith(".csv")) {
        const reader = new FileReader();
        reader.onload = (e) => {
          const text = e.target?.result as string;
          const { headers, rows } = parseCSV(text);
          
          setUploadedFiles(prev => [...prev, {
            name: file.name,
            headers,
            rows,
            rowCount: rows.length,
          }]);
        };
        reader.readAsText(file);
      }
    });
  }, []);

  // Remove uploaded file
  const removeFile = (index: number) => {
    setUploadedFiles(prev => prev.filter((_, i) => i !== index));
  };

  // Combine all uploaded files
  const combineFiles = () => {
    if (uploadedFiles.length === 0) return;

    // Get all unique headers
    const allHeaders = new Set<string>();
    uploadedFiles.forEach(file => {
      file.headers.forEach(h => allHeaders.add(h));
    });

    // Combine all rows
    const allRows: Record<string, string>[] = [];
    uploadedFiles.forEach(file => {
      file.rows.forEach(row => {
        const newRow: Record<string, string> = {};
        allHeaders.forEach(h => {
          newRow[h] = row[h] || "";
        });
        allRows.push(newRow);
      });
    });

    setCombinedData({
      headers: Array.from(allHeaders),
      rows: allRows,
    });
    setStep("configure");
  };

  // AI-powered field mapping
  const runAIMapping = async () => {
    if (!combinedData) return;

    setIsAnalyzing(true);
    try {
      const result = await analyzeAndMapMutation.mutateAsync({
        sourceHeaders: combinedData.headers,
        sampleRows: combinedData.rows.slice(0, 5),
        eventName,
        defaultStatus,
      });

      if (result.success) {
        setMappings(result.mappings);
        setTransformations(result.transformations);
        setWarnings(result.warnings);
        setConfidence(result.confidence);
        setStep("map");
      }
    } catch (error) {
      console.error("AI mapping error:", error);
      setWarnings(["AI mapping failed. Please map fields manually."]);
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Update a single mapping
  const updateMapping = (targetField: string, sourceField: string | null) => {
    setMappings(prev => ({
      ...prev,
      [targetField]: sourceField,
    }));
  };

  // Process the data
  const processData = async () => {
    if (!combinedData) return;

    setIsProcessing(true);
    try {
      const result = await processDataMutation.mutateAsync({
        rows: combinedData.rows,
        mappings,
        transformations,
        eventName,
        defaultStatus,
        contactOwner: contactOwner === "__blank__" ? "" : (contactOwner || undefined),
      });

      if (result.success) {
        setProcessedCsv(result.csvContent);
        setPreviewData(result.preview);
        setStep("preview");
      }
    } catch (error) {
      console.error("Processing error:", error);
    } finally {
      setIsProcessing(false);
    }
  };

  // Download processed CSV
  const downloadCsv = () => {
    if (!processedCsv) return;

    const blob = new Blob([processedCsv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${eventName || "processed"}_import.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Reset everything
  const reset = () => {
    setUploadedFiles([]);
    setCombinedData(null);
    setMappings({});
    setTransformations([]);
    setEventName("");
    setDefaultStatus("Registered");
    setContactOwner("");
    setProcessedCsv(null);
    setPreviewData(null);
    setStep("upload");
    setWarnings([]);
    setConfidence(0);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20">
      <div className="container py-8 max-w-6xl">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-3 bg-gradient-to-br from-emerald-600 to-teal-600 rounded-2xl shadow-lg">
              <FileSpreadsheet className="h-8 w-8 text-white" />
            </div>
            <div>
              <h1 className="text-4xl font-bold tracking-tight">AI CSV Processor</h1>
              <p className="text-muted-foreground text-lg">
                Transform any CSV into SFDC/HubSpot webinar import format
              </p>
            </div>
          </div>
        </div>

        {/* Progress Steps */}
        <div className="flex items-center gap-2 mb-8 overflow-x-auto pb-2">
          {["upload", "configure", "map", "preview", "export"].map((s, i) => (
            <div key={s} className="flex items-center">
              <div className={`flex items-center gap-2 px-4 py-2 rounded-full ${
                step === s 
                  ? "bg-emerald-600 text-white" 
                  : ["upload", "configure", "map", "preview", "export"].indexOf(step) > i
                    ? "bg-emerald-600/20 text-emerald-400"
                    : "bg-muted text-muted-foreground"
              }`}>
                <span className="font-medium capitalize">{i + 1}. {s}</span>
              </div>
              {i < 4 && <ArrowRight className="h-4 w-4 mx-2 text-muted-foreground" />}
            </div>
          ))}
        </div>

        {/* Instructions Card */}
        <Card className="mb-6 border-emerald-500/30 bg-emerald-500/5">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <HelpCircle className="h-5 w-5 text-emerald-500" />
              How It Works
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-2">
            <p><strong>1. Upload:</strong> Drag & drop any CSV files - messy, enriched, or raw data from any source (Wistia, HubSpot, event platforms, etc.)</p>
            <p><strong>2. Configure:</strong> Set your Salesforce campaign name and default attendee status</p>
            <p><strong>3. Map:</strong> AI automatically maps your columns to the SFDC template - review and adjust as needed</p>
            <p><strong>4. Preview:</strong> Check the transformed data before downloading</p>
            <p><strong>5. Export:</strong> Download the properly formatted CSV ready for import</p>
          </CardContent>
        </Card>

        {/* Main Content */}
        <Card>
          <CardContent className="p-6">
            {/* Step 1: Upload */}
            {step === "upload" && (
              <div className="space-y-6">
                <div
                  onDrop={handleDrop}
                  onDragOver={(e) => e.preventDefault()}
                  className="border-2 border-dashed border-muted-foreground/30 rounded-xl p-12 text-center hover:border-emerald-500/50 transition-colors cursor-pointer"
                >
                  <input
                    type="file"
                    accept=".csv"
                    multiple
                    onChange={handleFileUpload}
                    className="hidden"
                    id="csv-upload"
                  />
                  <label htmlFor="csv-upload" className="cursor-pointer">
                    <Upload className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                    <p className="text-lg font-medium mb-2">Drop CSV files here or click to upload</p>
                    <p className="text-sm text-muted-foreground">
                      Upload any number of CSV files - they'll be combined automatically
                    </p>
                  </label>
                </div>

                {uploadedFiles.length > 0 && (
                  <div className="space-y-3">
                    <h3 className="font-semibold">Uploaded Files ({uploadedFiles.length})</h3>
                    {uploadedFiles.map((file, i) => (
                      <div key={i} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                        <div className="flex items-center gap-3">
                          <FileSpreadsheet className="h-5 w-5 text-emerald-500" />
                          <div>
                            <p className="font-medium">{file.name}</p>
                            <p className="text-sm text-muted-foreground">
                              {file.rowCount} rows • {file.headers.length} columns
                            </p>
                          </div>
                        </div>
                        <Button variant="ghost" size="sm" onClick={() => removeFile(i)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                    <Button onClick={combineFiles} className="w-full bg-emerald-600 hover:bg-emerald-700">
                      Continue to Configuration
                      <ArrowRight className="h-4 w-4 ml-2" />
                    </Button>
                  </div>
                )}
              </div>
            )}

            {/* Step 2: Configure */}
            {step === "configure" && (
              <div className="space-y-6">
                <div className="grid gap-6 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="eventName">Salesforce Campaign Name *</Label>
                    <Input
                      id="eventName"
                      placeholder="e.g., 2025-01-15-WBN-Security-Best-Practices"
                      value={eventName}
                      onChange={(e) => setEventName(e.target.value)}
                    />
                    <p className="text-xs text-muted-foreground">
                      This will populate the "Recent Event" column
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="defaultStatus">Default Attendee Status *</Label>
                    <Select value={defaultStatus} onValueChange={setDefaultStatus}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {templateInfo?.statusOptions.map(status => (
                          <SelectItem key={status} value={status}>{status}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="contactOwner">Contact Owner (optional)</Label>
                    <Select value={contactOwner} onValueChange={setContactOwner}>
                      <SelectTrigger>
                        <SelectValue placeholder="Leave blank for SDR routing" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__blank__">Leave blank (SDR routing)</SelectItem>
                        {templateInfo?.contactOwners.map(owner => (
                          <SelectItem key={owner} value={owner}>{owner}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      Required for "Met with sales" status
                    </p>
                  </div>
                </div>

                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>Data Summary</AlertTitle>
                  <AlertDescription>
                    {combinedData?.rows.length} total rows from {uploadedFiles.length} file(s) • {combinedData?.headers.length} columns detected
                  </AlertDescription>
                </Alert>

                <div className="flex gap-3">
                  <Button variant="outline" onClick={() => setStep("upload")}>
                    Back
                  </Button>
                  <Button 
                    onClick={runAIMapping} 
                    disabled={!eventName || isAnalyzing}
                    className="flex-1 bg-emerald-600 hover:bg-emerald-700"
                  >
                    {isAnalyzing ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        AI Analyzing Fields...
                      </>
                    ) : (
                      <>
                        <Wand2 className="h-4 w-4 mr-2" />
                        Auto-Map Fields with AI
                      </>
                    )}
                  </Button>
                </div>
              </div>
            )}

            {/* Step 3: Map Fields */}
            {step === "map" && (
              <div className="space-y-6">
                {warnings.length > 0 && (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Warnings</AlertTitle>
                    <AlertDescription>
                      <ul className="list-disc list-inside">
                        {warnings.map((w, i) => <li key={i}>{w}</li>)}
                      </ul>
                    </AlertDescription>
                  </Alert>
                )}

                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold">Field Mappings</h3>
                    <p className="text-sm text-muted-foreground">
                      AI confidence: {Math.round(confidence * 100)}% • Review and adjust as needed
                    </p>
                  </div>
                  <Button variant="outline" size="sm" onClick={runAIMapping}>
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Re-analyze
                  </Button>
                </div>

                <div className="grid gap-3 max-h-[400px] overflow-y-auto pr-2">
                  {templateInfo?.fields.map(field => (
                    <div key={field.name} className="flex items-center gap-4 p-3 bg-muted/30 rounded-lg">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{field.name}</span>
                          {field.required && (
                            <Badge variant="destructive" className="text-xs">Required</Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground truncate">{field.description}</p>
                      </div>
                      <ArrowRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                      <Select
                        value={mappings[field.name] || "__unmapped__"}
                        onValueChange={(v) => updateMapping(field.name, v === "__unmapped__" ? null : v)}
                      >
                        <SelectTrigger className="w-[200px]">
                          <SelectValue placeholder="Select source column" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__unmapped__">-- Not mapped --</SelectItem>
                          {combinedData?.headers.map(h => (
                            <SelectItem key={h} value={h}>{h}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  ))}
                </div>

                <div className="flex gap-3">
                  <Button variant="outline" onClick={() => setStep("configure")}>
                    Back
                  </Button>
                  <Button 
                    onClick={processData}
                    disabled={isProcessing}
                    className="flex-1 bg-emerald-600 hover:bg-emerald-700"
                  >
                    {isProcessing ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Processing...
                      </>
                    ) : (
                      <>
                        <Sparkles className="h-4 w-4 mr-2" />
                        Process & Preview
                      </>
                    )}
                  </Button>
                </div>
              </div>
            )}

            {/* Step 4: Preview */}
            {step === "preview" && (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold flex items-center gap-2">
                      <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                      Processing Complete
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      {combinedData?.rows.length} rows transformed • Preview first 5 rows below
                    </p>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        {templateInfo?.fields.slice(0, 8).map(f => (
                          <th key={f.name} className="text-left p-2 font-medium whitespace-nowrap">
                            {f.name}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {previewData?.map((row, i) => (
                        <tr key={i} className="border-b">
                          {templateInfo?.fields.slice(0, 8).map(f => (
                            <td key={f.name} className="p-2 whitespace-nowrap max-w-[150px] truncate">
                              {row[f.name] || "-"}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="flex gap-3">
                  <Button variant="outline" onClick={() => setStep("map")}>
                    Back to Mapping
                  </Button>
                  <Button 
                    onClick={downloadCsv}
                    className="flex-1 bg-emerald-600 hover:bg-emerald-700"
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Download Processed CSV
                  </Button>
                </div>

                <Button variant="outline" onClick={reset} className="w-full">
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Start Over with New Files
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
