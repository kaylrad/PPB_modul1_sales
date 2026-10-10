// Test-only adapter: Supabase JS speaks PostgREST; execute those requests against
// in-memory PostgreSQL so the real repository, SQL constraints, and view are used.
export function postgrestFetch(db, requests) {
  return async (input, options = {}) => {
    const url = new URL(input);
    const table = url.pathname.split('/').pop();
    if (!['members', 'books', 'loans', 'loan_details'].includes(table)) throw new Error(`Unknown test table: ${table}`);
    const method = options.method || 'GET';
    const captured = { table, method, query: url.searchParams };
    requests.push(captured);
    const values = [];
    const bind = (value) => { values.push(value); return `$${values.length}`; };
    const filters = [];
    for (const field of ['id', 'member_id', 'book_id', 'status']) {
      const value = url.searchParams.get(field);
      if (value) {
        if (!value.startsWith('eq.')) throw new Error('Unsupported test filter');
        filters.push(`"${field}" = ${bind(value.slice(3))}`);
      }
    }
    const where = filters.length ? ` WHERE ${filters.join(' AND ')}` : '';
    const select = url.searchParams.get('select') || '*';
    if (!['*', 'id'].includes(select)) throw new Error('Unsupported test select');
    const headers = new Headers(options.headers);
    const object = headers.get('accept')?.includes('vnd.pgrst.object');
    try {
      let rows;
      let count;
      if (method === 'GET') {
        count = Number((await db.query(`SELECT count(*) AS total FROM "${table}"${where}`, values)).rows[0].total);
        const order = url.searchParams.get('order');
        let sql = `SELECT ${select} FROM "${table}"${where}`;
        if (order) {
          if (order !== 'created_at.desc,id.desc') throw new Error(`Unsupported test order: ${order}`);
          sql += ' ORDER BY created_at DESC, id DESC';
        }
        const limit = url.searchParams.get('limit');
        const offset = url.searchParams.get('offset');
        if (limit) sql += ` LIMIT ${bind(Number(limit))}`;
        if (offset) sql += ` OFFSET ${bind(Number(offset))}`;
        rows = (await db.query(sql, values)).rows;
      } else if (method === 'POST' || method === 'PATCH') {
        const payload = JSON.parse(options.body);
        const fields = Object.keys(payload);
        if (fields.some((field) => !/^[a-z_]+$/.test(field))) throw new Error('Invalid test field');
        let sql;
        if (method === 'POST') {
          sql = `INSERT INTO "${table}" (${fields.map((field) => `"${field}"`).join(',')}) VALUES (${fields.map((field) => bind(payload[field])).join(',')})`;
        } else {
          sql = `UPDATE "${table}" SET ${fields.map((field) => `"${field}" = ${bind(payload[field])}`).join(',')}${where}`;
        }
        rows = (await db.query(`${sql} RETURNING ${select}`, values)).rows;
      } else if (method === 'DELETE') {
        rows = (await db.query(`DELETE FROM "${table}"${where} RETURNING ${select}`, values)).rows;
      } else throw new Error(`Unsupported test method: ${method}`);
      for (const row of rows) {
        for (const field of ['borrowed_at', 'due_at', 'returned_at']) {
          if (row[field] instanceof Date) row[field] = row[field].toISOString().slice(0, 10);
        }
      }
      if (object && rows.length !== 1) {
        return Response.json({ code: 'PGRST116', message: 'JSON object requested, multiple (or no) rows returned', details: `The result contains ${rows.length} rows` }, { status: 406 });
      }
      const responseHeaders = {};
      if (count !== undefined) responseHeaders['content-range'] = `0-${Math.max(0, rows.length - 1)}/${count}`;
      return Response.json(object ? rows[0] : rows, { status: method === 'POST' ? 201 : 200, headers: responseHeaders });
    } catch (error) {
      captured.error = { code: error.code, message: error.message };
      if (!error.code) throw error;
      return Response.json({ code: error.code, message: error.message }, { status: 400 });
    }
  };
}
