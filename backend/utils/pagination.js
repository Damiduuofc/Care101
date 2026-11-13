// Opt-in pagination for list endpoints. Returns null when the request sends neither
// `page` nor `limit`, so older clients (the doctor app, the nurse queue screens) keep
// getting the full array they expect.
export const parsePagination = (query = {}, { defaultLimit = 20, maxLimit = 200 } = {}) => {
  if (query.page === undefined && query.limit === undefined) return null;
  const limit = Math.min(Math.max(parseInt(query.limit, 10) || defaultLimit, 1), maxLimit);
  const page = Math.max(parseInt(query.page, 10) || 1, 1);
  return { page, limit, skip: (page - 1) * limit };
};

export const pageResponse = (items, total, { page, limit }, extra = {}) => ({
  items,
  total,
  page,
  limit,
  totalPages: Math.max(1, Math.ceil(total / limit)),
  ...extra,
});
