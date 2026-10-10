export class ApiError extends Error {
  constructor(status, message, details) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

export function databaseError(error) {
  if (error.code === '23503' || error.code === '23001') return new ApiError(409, 'Anggota atau buku tidak ditemukan, atau data masih digunakan oleh peminjaman.');
  if (error.code === '23505') return new ApiError(409, 'Kode anggota atau ISBN sudah digunakan.');
  if (error.code === '23514' || error.code === '22007' || error.code === '22008') {
    return new ApiError(400, 'Tanggal atau nilai data tidak memenuhi aturan database.');
  }
  return new ApiError(503, 'Database tidak dapat diakses. Periksa koneksi, schema, dan konfigurasi Supabase.');
}

export function errorHandler(error, req, res, next) {
  if (res.headersSent) return next(error);
  if (error.type === 'entity.parse.failed') {
    return res.status(400).json({ error: { message: 'Body harus berupa JSON yang valid.' } });
  }
  if (error.type === 'entity.too.large') {
    return res.status(413).json({ error: { message: 'Body melebihi batas 100 KB.' } });
  }
  const status = error instanceof ApiError ? error.status : 500;
  const message = error instanceof ApiError ? error.message : 'Terjadi kesalahan pada server.';
  const body = { message };
  if (error instanceof ApiError && error.details) body.details = error.details;
  res.status(status).json({ error: body });
}
