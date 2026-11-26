/**
 * Validates a CSV export request for an authenticated user.
 * Role: One use case for export requests: kind check and user lookup, returning what the
 *   caller needs to build or queue the CSV.
 * Not in this file: CSV building (src/domain/exportProcessing.js), job state
 *   (src/domain/exportJobs.js), or how a caller delivers the file.
 * Key dependencies: src/domain/exportProcessing.js; src/domain/useCaseCodes.js.
 * See also: src/routes/exportRoutes.js.
 */

const { EXPORT_KINDS, EXPORT_FILE_NAMES } = require("./exportProcessing");
const {
  INVALID_REQUEST_CODE,
  USER_NOT_FOUND_CODE,
  findUserById,
} = require("./useCaseCodes");

/**
 * Validates one export request.
 *
 * @param {{ jsonStore: object, userId: string, payload: { kind?: unknown } | null | undefined }} exportInput - Store, caller, and requested kind.
 * @returns {Promise<{ ok: true, result: { user: object, kind: string, fileName: string } } | { ok: false, code: string }>} The resolved request, or a failure code.
 */
async function requestExport({ jsonStore, userId, payload }) {
  const kind = payload?.kind;
  if (!Object.values(EXPORT_KINDS).includes(kind)) {
    return { ok: false, code: INVALID_REQUEST_CODE };
  }

  const user = await findUserById(jsonStore, userId);
  if (!user) {
    return { ok: false, code: USER_NOT_FOUND_CODE };
  }

  return { ok: true, result: { user, kind, fileName: EXPORT_FILE_NAMES[kind] } };
}

module.exports = { requestExport };
