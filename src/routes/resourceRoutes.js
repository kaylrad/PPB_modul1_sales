import { Router } from 'express';
import { ApiError } from '../utils/errors.js';
import { validateBody, validateId, validateQuery } from '../utils/validation.js';

const labels = { members: 'Anggota', books: 'Buku', loans: 'Peminjaman' };

export function resourceRoutes(resource, getRepository) {
  const router = Router();
  const requireRow = (row) => {
    if (!row) throw new ApiError(404, `${labels[resource]} tidak ditemukan.`);
    return row;
  };
  router.get('/', async (req, res) => {
    const query = validateQuery(resource, req.query);
    const { data, total } = await getRepository().list(resource, query);
    res.json({ data, pagination: { total, limit: query.limit, offset: query.offset } });
  });
  router.get('/:id', async (req, res) => {
    const id = validateId(req.params.id);
    res.json({ data: requireRow(await getRepository().get(resource, id)) });
  });
  router.post('/', async (req, res) => {
    const payload = validateBody(resource, req.body);
    const row = await getRepository().create(resource, payload);
    res.location(`/${resource}/${row.id}`).status(201).json({ data: row });
  });
  const update = async (req, res) => {
    const id = validateId(req.params.id);
    const payload = validateBody(resource, req.body, true);
    res.json({ data: requireRow(await getRepository().update(resource, id, payload)) });
  };
  router.put('/:id', update);
  router.patch('/:id', update);
  router.delete('/:id', async (req, res) => {
    const id = validateId(req.params.id);
    requireRow(await getRepository().remove(resource, id));
    res.json({ message: `${labels[resource]} berhasil dihapus.` });
  });
  return router;
}
