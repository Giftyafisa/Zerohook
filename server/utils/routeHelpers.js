const mongoose = require('mongoose');

/**
 * Safely parse pagination query params with NaN protection.
 * @param {{ page?: string|number, limit?: string|number }} opts
 * @param {number} [maxLimit=100]
 * @returns {{ page: number, limit: number, skip: number }}
 */
function safePagination({ page, limit } = {}, maxLimit = 100) {
  const p = Math.max(1, parseInt(page, 10) || 1);
  const l = Math.min(maxLimit, Math.max(1, parseInt(limit, 10) || 20));
  return { page: p, limit: l, skip: (p - 1) * l };
}

/**
 * Validate a value as a valid MongoDB ObjectId.
 * @param {string} id
 * @param {string} [label='ID']
 * @returns {{ valid: boolean, label: string }}
 */
function validateObjectId(id, label = 'ID') {
  if (!id || !mongoose.Types.ObjectId.isValid(id)) {
    return { valid: false, label };
  }
  return { valid: true, label };
}

module.exports = { safePagination, validateObjectId };
