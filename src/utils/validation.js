import { ApiError } from './errors.js';

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const schemas = {
  members: {
    member_code: { required: true, max: 50 },
    name: { required: true, max: 150 },
    email: { nullable: true, max: 254, email: true },
  },
  books: {
    title: { required: true, max: 200 },
    author: { required: true, max: 150 },
    isbn: { nullable: true, max: 32 },
  },
  loans: {
    member_id: { required: true, uuid: true },
    book_id: { required: true, uuid: true },
    borrowed_at: { required: true, date: true },
    due_at: { required: true, date: true },
    returned_at: { nullable: true, date: true },
    notes: { nullable: true, max: 1000 },
  },
};

export function validateId(value) {
  if (typeof value !== 'string' || !uuidPattern.test(value)) {
    throw new ApiError(400, 'ID harus berupa UUID yang valid.');
  }
  return value;
}

export function isDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value && value >= '0001-01-01';
}

export function validateBody(resource, body, partial = false) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new ApiError(400, 'Body harus berupa object JSON.');
  }
  const schema = schemas[resource];
  const fields = Object.keys(body);
  const issues = [];
  const result = {};
  if (!fields.length) issues.push('Body tidak boleh kosong.');
  for (const field of fields) {
    if (!Object.hasOwn(schema, field)) issues.push(`Field ${field} tidak diizinkan.`);
  }
  for (const [field, rule] of Object.entries(schema)) {
    if (!Object.hasOwn(body, field)) {
      if (!partial && rule.required) issues.push(`${field} wajib diisi.`);
      continue;
    }
    const value = body[field];
    if (value === null && rule.nullable) { result[field] = null; continue; }
    if (typeof value !== 'string' || !value.trim()) {
      issues.push(`${field} harus berupa teks yang tidak kosong.`);
      continue;
    }
    const normalized = value.trim();
    if (rule.uuid && !uuidPattern.test(normalized)) issues.push(`${field} harus berupa UUID.`);
    if (rule.date && !isDate(normalized)) issues.push(`${field} harus berupa tanggal valid YYYY-MM-DD.`);
    if (rule.max && normalized.length > rule.max) issues.push(`${field} maksimal ${rule.max} karakter.`);
    if (rule.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) issues.push('email tidak valid.');
    result[field] = normalized;
  }
  if (resource === 'loans') {
    if (result.borrowed_at && result.due_at && result.due_at < result.borrowed_at) issues.push('due_at tidak boleh sebelum borrowed_at.');
    if (result.borrowed_at && result.returned_at && result.returned_at < result.borrowed_at) issues.push('returned_at tidak boleh sebelum borrowed_at.');
  }
  if (issues.length) throw new ApiError(400, 'Validasi gagal.', issues);
  return result;
}

export function validateQuery(resource, query) {
  const allowed = resource === 'loans' ? ['status', 'member_id', 'book_id', 'limit', 'offset'] : ['limit', 'offset'];
  const issues = [];
  for (const [name, value] of Object.entries(query)) {
    if (!allowed.includes(name)) issues.push(`Query ${name} tidak diizinkan.`);
    if (typeof value !== 'string') issues.push(`Query ${name} hanya boleh diberikan satu kali.`);
  }
  const result = { limit: 20, offset: 0 };
  for (const name of ['limit', 'offset']) {
    if (query[name] === undefined) continue;
    const value = query[name];
    if (typeof value !== 'string' || !/^\d+$/.test(value) || !Number.isSafeInteger(Number(value))) {
      issues.push(`${name} harus berupa bilangan bulat.`);
      continue;
    }
    result[name] = Number(value);
  }
  if (result.limit < 1 || result.limit > 100) issues.push('limit harus antara 1 dan 100.');
  if (result.offset < 0 || !Number.isSafeInteger(result.offset + result.limit)) issues.push('offset tidak valid.');
  if (query.status !== undefined) {
    if (!['Dipinjam', 'Dikembalikan', 'Terlambat'].includes(query.status)) issues.push('status harus Dipinjam, Dikembalikan, atau Terlambat.');
    else result.status = query.status;
  }
  for (const name of ['member_id', 'book_id']) {
    if (query[name] !== undefined) {
      if (typeof query[name] !== 'string' || !uuidPattern.test(query[name])) issues.push(`${name} harus berupa UUID.`);
      else result[name] = query[name];
    }
  }
  if (issues.length) throw new ApiError(400, 'Query tidak valid.', issues);
  return result;
}
