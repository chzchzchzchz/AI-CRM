import { useRef, useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Upload, Loader2, FileUp, CheckCircle2, AlertCircle } from "lucide-react";
import { toast } from "sonner";

/**
 * Getting a customer's own data into their own workspace.
 *
 * `SIGNUP_MODE=self-serve` gives every new customer an empty organization, and until this
 * page there was no way to put anything in one. Salesforce and 6sense sync need operator-
 * level credentials in the deployment's environment; the CSV Processor produces a file for
 * import into Salesforce or HubSpot and writes nothing here; the Lead Processor parses and
 * returns. So a paying customer could sign up, land on an empty dashboard, and have no
 * route to their own data at all.
 *
 * Accounts AND contacts, from the same paste, because that is how a lead list is actually
 * shaped: one row per person with their company beside them. An accounts-only import left
 * the contacts page's empty state pointing at something that could not fill it — a
 * smaller copy of the dead end this page exists to remove.
 *
 * What it will not do is claim more than the import returned. A row with no usable
 * website and no usable email is skipped, and a Clay or Salesforce export whose columns
 * are named unexpectedly fails EVERY row that way — so the result reports accounts,
 * contacts and skipped rows separately instead of totalling them into a success.
 */
export default function ImportAccounts() {
  const [raw, setRaw] = useState("");
  const [result, setResult] = useState<{
    success: boolean;
    accounts: { imported: number; updated: number };
    contacts: { imported: number; updated: number };
    skipped: number;
    total: number;
  } | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const utils = trpc.useUtils();

  const importData = trpc.dataImport.importRows.useMutation({
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
              <h1 className="text-xl font-semibold">Import your data</h1>
              <p className="text-muted-foreground">
                Bring your own accounts and contacts into this workspace — no connector
                required.
              </p>
            </div>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Paste rows, or choose a file</CardTitle>
            <CardDescription>
              CSV, TSV, or JSON — copying straight out of a spreadsheet works. A row with a{" "}
              <code className="text-xs">website</code> or <code className="text-xs">domain</code>{" "}
              becomes an account; a row with an <code className="text-xs">email</code> becomes a
              contact; a lead list with both becomes both, with the person attached to their
              company. Columns like <code className="text-xs">first name</code>,{" "}
              <code className="text-xs">job title</code>, <code className="text-xs">company</code>{" "}
              and <code className="text-xs">mobile</code> are recognised however they're spelled.
              Rows with neither a website nor an email are skipped rather than guessed at, and
              importing the same list twice updates those records instead of duplicating them.
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
              placeholder={
                "first name,last name,email,job title,company,website\n" +
                "Jordan,Okonkwo,jordan@acme.com,VP Engineering,Acme Corp,acme.com\n" +
                "Priya,Raman,priya@globex.io,Head of Security,Globex,globex.io"
              }
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
 * Records written is the only figure that means anything landed. Reporting `total` as the
 * outcome would call an import of 400 rows a success when all 400 were skipped for having
 * no matchable column — which is exactly what a mis-named export does.
 */
function ImportResult({
  success,
  accounts,
  contacts,
  skipped,
  total,
}: {
  success: boolean;
  accounts: { imported: number; updated: number };
  contacts: { imported: number; updated: number };
  skipped: number;
  total: number;
}) {
  const accountsLanded = accounts.imported + accounts.updated;
  const contactsLanded = contacts.imported + contacts.updated;
  const landed = accountsLanded + contactsLanded;
  const nothingLanded = landed === 0;
  const plural = (n: number, one: string) => `${n.toLocaleString()} ${one}${n === 1 ? "" : "s"}`;

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
          : [
              accountsLanded > 0 ? plural(accountsLanded, "account") : null,
              contactsLanded > 0 ? plural(contactsLanded, "contact") : null,
            ]
              .filter(Boolean)
              .join(" and ") + " in your workspace."}
      </p>

      <p className="mt-1 text-xs text-ink-muted">
        Accounts: {accounts.imported.toLocaleString()} new, {accounts.updated.toLocaleString()}{" "}
        updated · Contacts: {contacts.imported.toLocaleString()} new,{" "}
        {contacts.updated.toLocaleString()} updated · {skipped.toLocaleString()} rows skipped ·{" "}
        {total.toLocaleString()} rows read
      </p>

      {skipped > 0 ? (
        <p className="mt-2 text-xs text-ink-muted">
          {skipped === total
            ? "No row had a usable website or email, so the columns holding them are probably named something this doesn't recognise. "
            : "Skipped rows had neither a usable website nor a usable email. "}
          Rename the column to <code>domain</code> or <code>email</code> and import again —
          nothing was written for those rows, so re-importing is safe.
        </p>
      ) : null}
    </div>
  );
}
