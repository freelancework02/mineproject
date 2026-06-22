import readXlsxFile from "read-excel-file/browser";
import { useMemo, useState } from "react";
import SupabaseSetupNotice from "@/components/auth/SupabaseSetupNotice";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { useProtectedRoute } from "@/hooks/useProtectedRoute";
import { authApi } from "@/utils/api";
import { parseCsvText, tableToLeads } from "@/utils/leadImport";

export default function LeadImportPage() {
  const { configured, loading } = useProtectedRoute();
  const [fileName, setFileName] = useState("");
  const [rows, setRows] = useState([]);
  const [preview, setPreview] = useState(null);
  const [duplicateActions, setDuplicateActions] = useState({});
  const [sheetUrl, setSheetUrl] = useState("");
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const duplicateRows = useMemo(() => preview?.rows.filter((row) => row.duplicate) || [], [preview]);
  const invalidRows = useMemo(() => preview?.rows.filter((row) => !row.valid) || [], [preview]);

  if (!configured) {
    return <SupabaseSetupNotice />;
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-cloud text-sm text-slate-600">
        Loading secure workspace...
      </main>
    );
  }

  async function handleFileChange(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    setBusy(true);
    setError("");
    setStatus("");
    setPreview(null);
    setDuplicateActions({});
    setFileName(file.name);

    try {
      const extension = file.name.split(".").pop()?.toLowerCase();
      let parsedRows = [];

      if (extension === "csv") {
        parsedRows = tableToLeads(parseCsvText(await file.text()), file.name);
      } else if (extension === "xlsx") {
        parsedRows = tableToLeads(await readXlsxFile(file), file.name);
      } else {
        throw new Error("Upload a CSV or XLSX file.");
      }

      await previewRows(parsedRows);
    } catch (uploadError) {
      setRows([]);
      setError(uploadError.message || "Unable to read the selected file.");
    } finally {
      setBusy(false);
    }
  }

  async function handleGoogleSheet(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setStatus("");
    setPreview(null);
    setDuplicateActions({});

    try {
      const client = await authApi();
      const { data } = await client.post("/api/leads/google-sheet", { url: sheetUrl });
      setFileName(data.fileName);
      await previewRows(data.rows);
    } catch (sheetError) {
      setRows([]);
      setError(sheetError.response?.data?.error || "Unable to import Google Sheet.");
    } finally {
      setBusy(false);
    }
  }

  async function previewRows(nextRows) {
    setRows(nextRows);
    const client = await authApi();
    const { data } = await client.post("/api/leads/preview", { rows: nextRows });
    setPreview(data);
    setStatus(`${data.summary.total} records loaded.`);
  }

  function setDuplicateAction(rowNumber, action) {
    setDuplicateActions((current) => ({
      ...current,
      [String(rowNumber)]: action
    }));
  }

  async function handleImport() {
    setBusy(true);
    setError("");
    setStatus("");

    try {
      const client = await authApi();
      const { data } = await client.post("/api/leads/import", {
        fileName,
        rows,
        duplicateActions
      });
      setStatus(`${data.importedRecords} leads imported. ${data.skippedRecords} records skipped.`);
      setRows([]);
      setPreview(null);
      setDuplicateActions({});
    } catch (importError) {
      setError(importError.response?.data?.error || "Unable to import leads.");
    } finally {
      setBusy(false);
    }
  }

  function cancelImport() {
    setRows([]);
    setPreview(null);
    setDuplicateActions({});
    setStatus("");
    setError("");
    setFileName("");
  }

  return (
    <DashboardLayout>
      <div className="grid gap-6 xl:grid-cols-[minmax(0,420px)_1fr]">
        <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm font-semibold uppercase tracking-wide text-moss">Lead import</p>
          <h1 className="mt-2 text-2xl font-semibold text-ink">Upload leads</h1>

          <div className="mt-5 space-y-5">
            <label className="block">
              <span className="text-sm font-medium text-slate-700">CSV or XLSX file</span>
              <input
                type="file"
                accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                onChange={handleFileChange}
                className="mt-2 block w-full rounded-md border border-slate-300 text-sm text-slate-700 file:mr-4 file:border-0 file:bg-brand file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white"
              />
            </label>

            <div className="border-t border-slate-200 pt-5">
              <form className="space-y-3" onSubmit={handleGoogleSheet}>
                <label className="block">
                  <span className="text-sm font-medium text-slate-700">Google Sheet URL</span>
                  <input
                    type="url"
                    value={sheetUrl}
                    onChange={(event) => setSheetUrl(event.target.value)}
                    className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-ink outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20"
                    placeholder="https://docs.google.com/spreadsheets/d/..."
                  />
                </label>
                <button
                  type="submit"
                  disabled={busy || !sheetUrl}
                  className="rounded-md bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand/90 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  Fetch sheet
                </button>
              </form>
            </div>
          </div>

          {status ? <p className="mt-5 rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{status}</p> : null}
          {error ? <p className="mt-5 rounded-md bg-red-50 px-3 py-2 text-sm text-coral">{error}</p> : null}
        </section>

        <section className="min-h-[480px] rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-3 border-b border-slate-200 pb-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-wide text-moss">Review</p>
              <h2 className="mt-1 text-xl font-semibold text-ink">{fileName || "No import selected"}</h2>
            </div>
            {preview ? (
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={cancelImport}
                  className="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-ink hover:bg-slate-50"
                >
                  Cancel import
                </button>
                <button
                  type="button"
                  onClick={handleImport}
                  disabled={busy || preview.summary.valid === 0}
                  className="rounded-md bg-brand px-3 py-2 text-sm font-semibold text-white hover:bg-brand/90 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  Import leads
                </button>
              </div>
            ) : null}
          </div>

          {preview ? (
            <>
              <div className="mt-4 grid gap-3 sm:grid-cols-4">
                <Summary label="Total" value={preview.summary.total} />
                <Summary label="Valid" value={preview.summary.valid} />
                <Summary label="Invalid" value={preview.summary.invalid} />
                <Summary label="Duplicates" value={preview.summary.duplicates} />
              </div>

              {duplicateRows.length ? (
                <div className="mt-5 rounded-lg border border-amber-200 bg-amber-50 p-4">
                  <h3 className="text-sm font-semibold text-amber-900">Duplicate Found</h3>
                  <div className="mt-3 space-y-3">
                    {duplicateRows.map((row) => (
                      <div key={row.rowNumber} className="rounded-md border border-amber-200 bg-white p-3">
                        <div className="grid gap-2 text-sm sm:grid-cols-3">
                          <p>
                            <span className="block text-xs font-medium text-slate-500">Lead Name</span>
                            {row.name}
                          </p>
                          <p>
                            <span className="block text-xs font-medium text-slate-500">Email</span>
                            {row.email}
                          </p>
                          <p>
                            <span className="block text-xs font-medium text-slate-500">Phone</span>
                            {row.phone}
                          </p>
                        </div>
                        <div className="mt-3 flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => setDuplicateAction(row.rowNumber, "skip")}
                            className={`rounded-md px-3 py-2 text-sm font-medium ${
                              duplicateActions[String(row.rowNumber)] !== "import"
                                ? "bg-amber-800 text-white"
                                : "border border-slate-300 text-ink"
                            }`}
                          >
                            Skip Duplicate
                          </button>
                          <button
                            type="button"
                            onClick={() => setDuplicateAction(row.rowNumber, "import")}
                            className={`rounded-md px-3 py-2 text-sm font-medium ${
                              duplicateActions[String(row.rowNumber)] === "import"
                                ? "bg-brand text-white"
                                : "border border-slate-300 text-ink"
                            }`}
                          >
                            Import Anyway
                          </button>
                          <button
                            type="button"
                            onClick={cancelImport}
                            className="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-ink hover:bg-slate-50"
                          >
                            Cancel Import
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              {invalidRows.length ? (
                <div className="mt-5 rounded-lg border border-red-200 bg-red-50 p-4">
                  <h3 className="text-sm font-semibold text-coral">Invalid rows</h3>
                  <ul className="mt-3 space-y-2 text-sm text-slate-700">
                    {invalidRows.map((row) => (
                      <li key={row.rowNumber}>
                        Row {row.rowNumber}: {row.errors.join(" ")}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              <div className="mt-5 overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-200 text-sm">
                  <thead>
                    <tr className="text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                      <th className="px-3 py-2">Row</th>
                      <th className="px-3 py-2">Name</th>
                      <th className="px-3 py-2">Phone</th>
                      <th className="px-3 py-2">Email</th>
                      <th className="px-3 py-2">Source</th>
                      <th className="px-3 py-2">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {preview.rows.map((row) => (
                      <tr key={row.rowNumber}>
                        <td className="px-3 py-2 text-slate-500">{row.rowNumber}</td>
                        <td className="px-3 py-2 text-ink">{row.name}</td>
                        <td className="px-3 py-2 text-slate-700">{row.phone}</td>
                        <td className="px-3 py-2 text-slate-700">{row.email}</td>
                        <td className="px-3 py-2 text-slate-700">{row.source}</td>
                        <td className="px-3 py-2">
                          <span
                            className={`rounded-full px-2 py-1 text-xs font-medium ${
                              !row.valid
                                ? "bg-red-100 text-coral"
                                : row.duplicate
                                  ? "bg-amber-100 text-amber-800"
                                  : "bg-emerald-100 text-emerald-700"
                            }`}
                          >
                            {!row.valid ? "Invalid" : row.duplicate ? "Duplicate" : "Ready"}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          ) : (
            <div className="flex min-h-[360px] items-center justify-center text-sm text-slate-500">
              Select a file or fetch a Google Sheet.
            </div>
          )}
        </section>
      </div>
    </DashboardLayout>
  );
}

function Summary({ label, value }) {
  return (
    <div className="rounded-lg border border-slate-200 p-3">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-xl font-semibold text-ink">{value}</p>
    </div>
  );
}
