// Hand-authored mock providers for the mock execution harness. Two physical
// seams are replaced:
//   * the governed HTTP exchange's fetch (effectContext.fetch), matched by URL;
//   * the declared-read provider's query runner, matched by statement text.
// Everything else in the execution path is the real declared ground.

const text = value => (typeof value === 'string' ? value : JSON.stringify(value));

export function createMockFetch(fixture, hits) {
  const fetchEntries = fixture.fetch ?? [];
  return async function mockFetch(url, options = {}) {
    const href = typeof url === 'string' ? url : url?.url ?? String(url);
    const entry = fetchEntries.find(candidate => href.includes(candidate.match));
    if (!entry) {
      hits.unmatched ??= [];
      hits.unmatched.push({ url: href, method: options.method ?? 'GET' });
      const error = new Error(`MOCK_FETCH_UNMATCHED: '${href}'`);
      error.code = 'MOCK_FETCH_UNMATCHED';
      throw error;
    }
    hits.fetch.push({ url: href, match: entry.match, status: entry.status ?? 200, method: options.method ?? 'GET' });
    const body = entry.body === undefined ? '' : text(entry.body);
    return new Response(body, {
      status: entry.status ?? 200,
      headers: { 'content-type': 'application/json', ...(entry.headers ?? {}) }
    });
  };
}

export function wrapReadQuery(readQuery, fixture, hits) {
  const readEntries = fixture.read ?? [];
  return async function mockReadQuery(statement, options = {}) {
    const entry = readEntries.find(candidate => String(statement).includes(candidate.match));
    if (!entry) return readQuery(statement, options);
    const resultColumn = entry.resultColumn ?? 'value';
    hits.read.push({ match: entry.match, resultColumn });
    return {
      snapshotId: 'mock', projectionDigest: 'mock', viewDefinitionDigest: null,
      queryDigest: 'sha256:mock', resultDigest: 'sha256:mock', resultObjectDigest: 'sha256:mock',
      resultCanonicalization: 'mock-recordset.v1', objectRetention: 'MEMORY_ONLY',
      rowLimit: options.rowLimit ?? 1, truncated: false, rowCounts: [1],
      disposition: 'READ_QUERY_COMPLETE',
      recordsets: [[{ [resultColumn]: text(entry.value) }]]
    };
  };
}
