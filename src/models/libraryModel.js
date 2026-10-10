import { getSupabase } from '../config/supabaseClient.js';
import { databaseError } from '../utils/errors.js';

export function createRepository(client) {
  const readTable = (resource) => resource === 'loans' ? 'loan_details' : resource;
  const unwrap = ({ data, error }) => {
    if (error) throw databaseError(error);
    return data;
  };
  const repository = {
    async list(resource, { limit, offset, ...filters }) {
      let query = client.from(readTable(resource)).select('*', { count: 'exact' });
      for (const [field, value] of Object.entries(filters)) query = query.eq(field, value);
      const response = await query.order('created_at', { ascending: false }).order('id', { ascending: false }).range(offset, offset + limit - 1);
      return { data: unwrap(response), total: response.count ?? 0 };
    },
    async get(resource, id) {
      return unwrap(await client.from(readTable(resource)).select('*').eq('id', id).maybeSingle());
    },
    async create(resource, payload) {
      const row = unwrap(await client.from(resource).insert(payload).select('*').single());
      return resource === 'loans' ? repository.get(resource, row.id) : row;
    },
    async update(resource, id, payload) {
      const row = unwrap(await client.from(resource).update(payload).eq('id', id).select('*').maybeSingle());
      return resource === 'loans' && row ? repository.get(resource, id) : row;
    },
    async remove(resource, id) {
      return unwrap(await client.from(resource).delete().eq('id', id).select('id').maybeSingle());
    },
    async health() {
      unwrap(await client.from('loans').select('id').limit(1));
      unwrap(await client.from('loan_details').select('id').limit(1));
    },
  };
  return repository;
}

let repository;
export function getRepository() {
  repository ??= createRepository(getSupabase());
  return repository;
}
