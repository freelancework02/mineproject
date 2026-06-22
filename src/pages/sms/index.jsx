import { useEffect, useState } from "react";
import SupabaseSetupNotice from "@/components/auth/SupabaseSetupNotice";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { useProtectedRoute } from "@/hooks/useProtectedRoute";
import { LEAD_STATUS_OPTIONS } from "@/lib/leadConstants";
import { authApi } from "@/utils/api";
import { parseCsvText, tableToLeads } from "@/utils/leadImport";

export default function SmsPage() {
  const { configured, loading } = useProtectedRoute();
  const [templates, setTemplates] = useState([]);
  const [templateForm, setTemplateForm] = useState({ name: "", message: "" });
  const [campaign, setCampaign] = useState({
    name: "",
    message: "",
    status: "",
    source: ""
  });
  const [uploadedRecipients, setUploadedRecipients] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    if (!configured || loading) return;
    loadTemplates();
  }, [configured, loading]);

  if (!configured) return <SupabaseSetupNotice />;

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-cloud text-sm text-slate-600">
        Loading secure workspace...
      </main>
    );
  }

  async function loadTemplates() {
    try {
      const client = await authApi();
      const { data } = await client.get("/api/sms/templates");
      setTemplates(data.templates);
    } catch {
      setTemplates([]);
    }
  }

  async function createTemplate(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setNotice("");

    try {
      const client = await authApi();
      await client.post("/api/sms/templates", templateForm);
      setTemplateForm({ name: "", message: "" });
      await loadTemplates();
      setNotice("SMS template saved.");
    } catch (templateError) {
      setError(templateError.response?.data?.error || "Unable to save template.");
    } finally {
      setBusy(false);
    }
  }

  async function handleRecipientFile(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    setError("");

    try {
      if (!file.name.toLowerCase().endsWith(".csv")) {
        throw new Error("Upload a CSV file with name, phone, email, source headers.");
      }

      const rows = tableToLeads(parseCsvText(await file.text()), file.name);
      setUploadedRecipients(rows.filter((row) => row.phone).map((row) => ({ name: row.name, phone: row.phone })));
    } catch (fileError) {
      setUploadedRecipients([]);
      setError(fileError.message || "Unable to read recipient file.");
    }
  }

  async function sendBulk(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setNotice("");

    try {
      const client = await authApi();
      const { data } = await client.post("/api/sms/bulk", {
        name: campaign.name || "Bulk SMS Campaign",
        message: campaign.message,
        filters: {
          status: campaign.status || undefined,
          source: campaign.source || undefined
        },
        uploadedRecipients
      });
      setNotice(
        `${data.campaign.sent_count} messages sent. ${data.campaign.failed_count} failed. ${data.campaign.total_recipients} recipients processed.`
      );
      setCampaign({ name: "", message: "", status: "", source: "" });
      setUploadedRecipients([]);
    } catch (bulkError) {
      setError(bulkError.response?.data?.error || "Unable to send bulk SMS.");
    } finally {
      setBusy(false);
    }
  }

  function applyTemplate(message) {
    setCampaign((current) => ({ ...current, message }));
  }

  return (
    <DashboardLayout>
      {error ? <p className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-coral">{error}</p> : null}
      {notice ? <p className="mb-4 rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{notice}</p> : null}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
        <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm font-semibold uppercase tracking-wide text-moss">Bulk SMS</p>
          <h1 className="mt-1 text-2xl font-semibold text-ink">Campaign sender</h1>

          <form className="mt-5 space-y-4" onSubmit={sendBulk}>
            <label className="block">
              <span className="text-sm font-medium text-slate-700">Campaign Name</span>
              <input
                value={campaign.name}
                onChange={(event) => setCampaign((current) => ({ ...current, name: event.target.value }))}
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
                placeholder="June follow-up"
              />
            </label>

            <label className="block">
              <span className="text-sm font-medium text-slate-700">Message</span>
              <textarea
                value={campaign.message}
                onChange={(event) => setCampaign((current) => ({ ...current, message: event.target.value }))}
                rows="6"
                maxLength="1600"
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
                placeholder="Write campaign message"
              />
              <span className="mt-1 block text-xs text-slate-500">{campaign.message.length}/1600</span>
            </label>

            <div className="grid gap-3 md:grid-cols-2">
              <label className="block">
                <span className="text-sm font-medium text-slate-700">Filtered Leads Status</span>
                <select
                  value={campaign.status}
                  onChange={(event) => setCampaign((current) => ({ ...current, status: event.target.value }))}
                  className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
                >
                  <option value="">Any status</option>
                  {LEAD_STATUS_OPTIONS.map((status) => (
                    <option key={status.value} value={status.value}>
                      {status.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="text-sm font-medium text-slate-700">Filtered Leads Source</span>
                <input
                  value={campaign.source}
                  onChange={(event) => setCampaign((current) => ({ ...current, source: event.target.value }))}
                  className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
                  placeholder="Google Sheet"
                />
              </label>
            </div>

            <label className="block">
              <span className="text-sm font-medium text-slate-700">Uploaded List CSV</span>
              <input
                type="file"
                accept=".csv,text/csv"
                onChange={handleRecipientFile}
                className="mt-2 block w-full rounded-md border border-slate-300 text-sm text-slate-700 file:mr-4 file:border-0 file:bg-brand file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white"
              />
              <span className="mt-1 block text-xs text-slate-500">{uploadedRecipients.length} uploaded recipients</span>
            </label>

            <button
              type="submit"
              disabled={busy || !campaign.message.trim()}
              className="rounded-md bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand/90 disabled:cursor-not-allowed disabled:opacity-70"
            >
              Send Bulk SMS
            </button>
          </form>
        </section>

        <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm font-semibold uppercase tracking-wide text-moss">SMS Templates</p>

          <form className="mt-4 space-y-3" onSubmit={createTemplate}>
            <input
              value={templateForm.name}
              onChange={(event) => setTemplateForm((current) => ({ ...current, name: event.target.value }))}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
              placeholder="Template name"
            />
            <textarea
              value={templateForm.message}
              onChange={(event) => setTemplateForm((current) => ({ ...current, message: event.target.value }))}
              rows="4"
              maxLength="1600"
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
              placeholder="Template message"
            />
            <button
              type="submit"
              disabled={busy || !templateForm.name.trim() || !templateForm.message.trim()}
              className="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-ink disabled:cursor-not-allowed disabled:opacity-50"
            >
              Save Template
            </button>
          </form>

          <div className="mt-5 space-y-3">
            {templates.map((template) => (
              <article key={template.id} className="rounded-lg border border-slate-200 p-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="text-sm font-semibold text-ink">{template.name}</h2>
                    <p className="mt-1 text-sm text-slate-600">{template.message}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => applyTemplate(template.message)}
                    className="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-ink"
                  >
                    Use
                  </button>
                </div>
              </article>
            ))}
            {templates.length === 0 ? (
              <p className="rounded-lg border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">
                No templates yet.
              </p>
            ) : null}
          </div>
        </section>
      </div>
    </DashboardLayout>
  );
}
