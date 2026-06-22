const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_PATTERN = /^\+?[0-9][0-9 ()-]{6,20}$/;

const FIELD_ALIASES = {
  name: ["name", "lead name", "full name", "customer name"],
  phone: ["phone", "phone number", "mobile", "mobile number", "contact number"],
  email: ["email", "email address", "mail"],
  source: ["source", "lead source", "campaign"]
};

export function parseCsvText(text) {
  const rows = [];
  let row = [];
  let cell = "";
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];

    if (char === '"' && quoted && next === '"') {
      cell += '"';
      index += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === "," && !quoted) {
      row.push(cell);
      cell = "";
    } else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && next === "\n") index += 1;
      row.push(cell);
      if (row.some((value) => String(value).trim() !== "")) rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += char;
    }
  }

  row.push(cell);
  if (row.some((value) => String(value).trim() !== "")) rows.push(row);
  return rows;
}

export function tableToLeads(tableRows, fallbackSource = "Import") {
  if (!Array.isArray(tableRows) || tableRows.length === 0) return [];

  const headers = tableRows[0].map((header) => normalizeHeader(header));
  const indexes = Object.fromEntries(
    Object.entries(FIELD_ALIASES).map(([field, aliases]) => [
      field,
      headers.findIndex((header) => aliases.includes(header))
    ])
  );

  return tableRows.slice(1).map((row, index) => ({
    rowNumber: index + 2,
    name: valueAt(row, indexes.name),
    phone: valueAt(row, indexes.phone),
    email: valueAt(row, indexes.email),
    source: valueAt(row, indexes.source) || fallbackSource
  }));
}

export function normalizeLeadRows(rows) {
  return rows.map((row, index) => ({
    rowNumber: Number(row.rowNumber || index + 1),
    name: clean(row.name),
    phone: clean(row.phone),
    email: clean(row.email).toLowerCase(),
    source: clean(row.source) || "Import"
  }));
}

export function validateLeadRows(rows) {
  const seenEmails = new Map();
  const seenPhones = new Map();

  return normalizeLeadRows(rows).map((row) => {
    const errors = [];
    const normalizedPhone = normalizePhone(row.phone);

    if (!row.name) errors.push("Name is required.");
    if (!row.email) errors.push("Email is required.");
    if (row.email && !EMAIL_PATTERN.test(row.email)) errors.push("Email is invalid.");
    if (!row.phone) errors.push("Phone is required.");
    if (row.phone && !PHONE_PATTERN.test(row.phone)) errors.push("Phone is invalid.");

    if (row.email && seenEmails.has(row.email)) {
      errors.push(`Duplicate email in import at row ${seenEmails.get(row.email)}.`);
    }

    if (normalizedPhone && seenPhones.has(normalizedPhone)) {
      errors.push(`Duplicate phone in import at row ${seenPhones.get(normalizedPhone)}.`);
    }

    if (row.email && !seenEmails.has(row.email)) seenEmails.set(row.email, row.rowNumber);
    if (normalizedPhone && !seenPhones.has(normalizedPhone)) seenPhones.set(normalizedPhone, row.rowNumber);

    return {
      ...row,
      phoneNormalized: normalizedPhone,
      valid: errors.length === 0,
      errors
    };
  });
}

export function normalizePhone(phone) {
  return clean(phone).replace(/[^0-9+]/g, "");
}

export function googleSheetCsvUrl(inputUrl) {
  let url;

  try {
    url = new URL(inputUrl);
  } catch {
    throw new Error("Enter a valid Google Sheet URL.");
  }

  if (url.hostname !== "docs.google.com") {
    throw new Error("Enter a valid Google Sheet URL.");
  }

  const match = url.pathname.match(/\/spreadsheets\/d\/([^/]+)/);
  if (!match) {
    throw new Error("Google Sheet URL must include a spreadsheet id.");
  }

  const gid = url.searchParams.get("gid") || "0";
  return `https://docs.google.com/spreadsheets/d/${match[1]}/export?format=csv&gid=${encodeURIComponent(gid)}`;
}

export function duplicateKey(row) {
  return `${row.email}|${row.phoneNormalized || normalizePhone(row.phone)}`;
}

function valueAt(row, index) {
  if (index < 0) return "";
  return clean(row[index]);
}

function clean(value) {
  return String(value ?? "").trim();
}

function normalizeHeader(value) {
  return clean(value).toLowerCase().replace(/\s+/g, " ");
}
