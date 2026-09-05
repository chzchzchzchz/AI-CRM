import { useRef, useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Upload, Loader2, FileUp, CheckCircle2, AlertCircle } from "lucide-react";
import { toast } from "sonner";

/**
 * Getting a customer's own accounts into their own workspace.
 *
 * `SIGNUP_MODE=self-serve` gives every new customer an empty organization, and until this
 * page there was no way to put anything in one. Salesforce and 6sense sync need operator-
 * level credentials in the deployment's environment; the CSV Processor produces a file for
 * import into Salesforce or HubSpot and writes nothing here; the Lead Processor parses and
 * returns. So a paying customer could sign up, land on an empty dashboard, and have no
 * route to their own data at all.
 *
 * The server half already existed and was already tested — `clayImport.importRawData`
 * parses pasted CSV/TSV/JSON, maps it onto real account columns, scopes both the lookup
 * and the write to `ctx.orgId`, and reports honest counts. It was listed as
 * automation-only in server/inventory.ts because nothing in the app called it: built,
 * tested and unreachable, the same shape as the email-verification router and
 * `twoFA.verify` before them. This page is the missing screen, not new machinery.
 *
 * What it will not do is claim more than the import returned. The procedure counts a row
 * with no usable website as an error and skips it — a Clay or Salesforce export whose
 * domain column is named something unexpected fails EVERY row that way — so the result
 * says which number is which instead of totalling them into a success.
 */
export default function ImportAccounts() {
  const [raw, setRaw] = useState("");
  const [result, setResult] = useState<{
    success: boolean;
    imported: number;
    updated: number;
    errors: number;
    total: number;
  } | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const utils = trpc.useUtils();

  const importData = trpc.clayImport.importRawData.useMutation({
    onSuccess: res => {
      setResult(res);
      // The lists this just changed are cached. Without this a customer imports 400
      // accounts, clicks through to Accounts, and sees the empty workspace they were
      // trying to leave.
      utils.accounts.invalidate();
      utils.people.invalidate();
    },
    onError: err => {
      setResult(null);
      toast.error(err.message);
    },
  });

  async function readFile(file: File) {
    try {
      const text = await file.text();
      setRaw(text);
      setResult(null);
    } catch {
      // A file the browser refuses to read is a real outcome, not a reason to leave the
      // box looking empty for no stated reason.
      toast.error("Couldn't read that file — try pasting its contents instead.");
    }
  }

  const rowGuess = raw.trim() ? raw.trim().split(/\r?\n/).length - 1 : 0;

  return (
    <div className="text-foreground">
      <div className="container py-1 max-w-4xl">
        <div className="mb-8">
          <div className="flex flex-wrap items-center gap-3 mb-2">
            <div className="p-2 bg-muted border border-border-strong rounded-md">
              <Upload className="h-6 w-6 text-accent" />
            </div>
            <div>
              <h1 className="text-xl font-semibold">Import accounts</h1>
              <p className="text-muted-foreground">
                Bring your own accounts into this workspace — no connector required.
              </p>
            </div>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Paste rows, or choose a file</CardTitle>
            <CardDescription>
              CSV, TSV, or JSON — copying straight out of a spreadsheet works. Each row needs
              a company website or domain; that is what an account is matched on, so rows
              without one are skipped rather than guessed at. A column named{" "}
              <code className="text-xs">domain</code>, <code className="text-xs">website</code>{" "}
              or <code className="text-xs">url</code> is found automatically, as is{" "}
              <code className="text-xs">name</code> or <code className="text-xs">company</code>.
              Importing the same list twice updates those accounts instead of duplicating them.
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-4">
            <input
              ref={fileInput}
              type="file"
              accept=".csv,.tsv,.txt,.json"
              className="hidden"
              onChange={e => {
                const f = e.target.files?.[0];
                if (f) readFile(f);
                // Cleared so choosing the same file twice fires change again.
                e.target.value = "";
              }}
            />

            <Textarea
              value={raw}
              onChange={e => {
                setRaw(e.target.value);
                setResult(null);
              }}
              rows={12}
              spellCheck={false}
              placeholder={"name,domain,employees\nAcme Corp,acme.com,1200\nGlobex,globex.io,340"}
              className="font-mono text-xs"
              aria-label="Rows to import"
            />

            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                disabled={!raw.trim() || importData.isPending}
                onClick={() => importData.mutate({ rawData: raw })}
              >
                {importData.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Upload className="mr-2 h-4 w-4" />
                )}
                Import{rowGuess > 0 ? ` ${rowGuess.toLocaleString()} rows` : ""}
              </Button>

              <Button type="button" variant="outline" onClick={() => fileInput.current?.click()}>
                <FileUp className="mr-2 h-4 w-4" />
                Choose a file
              </Button>

              {raw ? (
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => {
                    setRaw("");
                    setResult(null);
                  }}
                >
                  Clear
                </Button>
              ) : null}
            </div>

            {result ? <ImportResult {...result} /> : null}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

/**
 * What actually happened, in the import's own numbers.
 *
 * `imported + updated` is the only figure that means anything landed. Reporting `total`
 * as the outcome would call an import of 400 rows a success when all 400 were skipped for
 * having no domain — which is exactly what a mis-named column does.
 */
function ImportResult({
  success,
  imported,
  updated,
  errors,
  total,
}: {
  success: boolean;
  imported: number;
  updated: number;
  errors: number;
  total: number;
}) {
  const landed = imported + updated;
  const nothingLanded = landed === 0;

  return (
    <div
      className={`rounded-md border p-3 text-sm ${
        nothingLanded || !success
          ? "border-caution/40 bg-caution-subtle"
          : "border-positive/40 bg-positive-subtle"
      }`}
    >
      <p className="flex items-center gap-2 font-medium">
        {nothingLanded || !success ? (
          <AlertCircle className="h-4 w-4 text-caution" />
        ) : (
          <CheckCircle2 className="h-4 w-4 text-positive" />
        )}
        {nothingLanded
          ? "Nothing was imported."
          : `${landed.toLocaleString()} account${landed === 1 ? "" : "s"} in your workspace.`}
      </p>

      <p className="mt-1 text-xs text-ink-muted">
        {imported.toLocaleString()} new · {updated.toLocaleString()} updated ·{" "}
        {errors.toLocaleString()} skipped · {total.toLocaleString()} rows read
      </p>

      {errors > 0 ? (
        <p className="mt-2 text-xs text-ink-muted">
          Skipped rows had no usable website or domain. If that is every row, the column
          holding it is probably named something this doesn't recognise — rename it to{" "}
          <code>domain</code> and import again. Nothing was written for those rows, so
          re-importing is safe.
        </p>
      ) : null}
    </div>
  );
}
