import { duplicateKey, normalizePhone, validateLeadRows } from "@/utils/leadImport";

export async function buildLeadPreview(supabase, rows) {
  const validatedRows = validateLeadRows(rows);
  const validRows = validatedRows.filter((row) => row.valid);
  const emails = [...new Set(validRows.map((row) => row.email).filter(Boolean))];
  const phones = [...new Set(validRows.map((row) => row.phoneNormalized || normalizePhone(row.phone)).filter(Boolean))];
  const existing = await findExistingLeads(supabase, emails, phones);
  const existingKeys = new Map();

  existing.forEach((lead) => {
    if (lead.email_normalized) existingKeys.set(`email:${lead.email_normalized}`, lead);
    if (lead.phone_normalized) existingKeys.set(`phone:${lead.phone_normalized}`, lead);
  });

  const rowsWithDuplicates = validatedRows.map((row) => {
    const emailMatch = row.email ? existingKeys.get(`email:${row.email}`) : null;
    const phoneMatch = row.phoneNormalized ? existingKeys.get(`phone:${row.phoneNormalized}`) : null;
    const duplicateLead = emailMatch || phoneMatch || null;

    return {
      ...row,
      duplicate: Boolean(duplicateLead),
      duplicateLead: duplicateLead
        ? {
            id: duplicateLead.id,
            name: duplicateLead.name,
            email: duplicateLead.email,
            phone: duplicateLead.phone
          }
        : null
    };
  });

  return {
    rows: rowsWithDuplicates,
    summary: summarizeRows(rowsWithDuplicates)
  };
}

export async function importLeadRows(supabase, userId, fileName, rows, duplicateActions = {}) {
  const preview = await buildLeadPreview(supabase, rows);
  const deduped = new Set();
  const rowsToImport = preview.rows.filter((row) => {
    if (!row.valid) return false;
    if (deduped.has(duplicateKey(row))) return false;
    deduped.add(duplicateKey(row));

    if (!row.duplicate) return true;
    return duplicateActions[String(row.rowNumber)] === "import";
  });

  let importedRecords = 0;

  if (rowsToImport.length > 0) {
    const { data, error } = await supabase
      .from("leads")
      .insert(
        rowsToImport.map((row) => ({
          name: row.name,
          email: row.email,
          phone: row.phone,
          source: row.source,
          owner_id: userId
        }))
      )
      .select("id");

    if (error) throw error;
    importedRecords = data.length;
  }

  const { error: importError } = await supabase.from("lead_imports").insert({
    file_name: fileName || "Import",
    total_records: preview.rows.length,
    duplicate_records: preview.summary.duplicates,
    imported_records: importedRecords,
    created_by: userId
  });

  if (importError) throw importError;

  return {
    importedRecords,
    skippedRecords: preview.rows.length - importedRecords,
    summary: preview.summary
  };
}

async function findExistingLeads(supabase, emails, phones) {
  const byEmail = emails.length
    ? await supabase.from("leads").select("id,name,email,phone,email_normalized,phone_normalized").in("email_normalized", emails)
    : { data: [], error: null };

  if (byEmail.error) throw byEmail.error;

  const byPhone = phones.length
    ? await supabase.from("leads").select("id,name,email,phone,email_normalized,phone_normalized").in("phone_normalized", phones)
    : { data: [], error: null };

  if (byPhone.error) throw byPhone.error;

  return [...byEmail.data, ...byPhone.data].filter(
    (lead, index, all) => all.findIndex((candidate) => candidate.id === lead.id) === index
  );
}

function summarizeRows(rows) {
  return {
    total: rows.length,
    valid: rows.filter((row) => row.valid).length,
    invalid: rows.filter((row) => !row.valid).length,
    duplicates: rows.filter((row) => row.duplicate).length
  };
}
