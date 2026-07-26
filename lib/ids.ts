/**
 * Clients generate the id for rows they create, so an optimistic row *is* the
 * real row. Without this, acting on something before the server has answered —
 * adding a subtask to a brand new task, opening a list you just created —
 * sends a placeholder id and fails.
 *
 * Ids are not capabilities: every access check is by ownership or share, never
 * by knowing an id. Accepting one from the client therefore only has to keep
 * the shape sane — see insertWithClientId for what happens if one collides.
 */
const CLIENT_ID = /^[a-z0-9]{16,32}$/;

export function parseClientId(value: unknown): string | undefined {
  return typeof value === 'string' && CLIENT_ID.test(value) ? value : undefined;
}

/**
 * Inserts with the client's id, falling back to a server-generated one if that
 * id is already taken.
 *
 * A collision is impossible by accident — cuid2 ids are 24 random characters —
 * so this exists for the deliberate case. Letting the conflict surface would
 * answer "does this id still exist?" for anyone who ever saw it: a former
 * collaborator could re-probe a revoked list forever by watching 201 vs 500.
 * Retrying silently means every caller gets 201 and the id in the response is
 * the authoritative one, which clients already reconcile against.
 */
export async function insertWithClientId<T>(
  insert: (id: string | undefined) => Promise<T>,
  id: string | undefined,
): Promise<T> {
  try {
    return await insert(id);
  } catch (error) {
    if (!id || !isDuplicateIdError(error)) throw error;
    return await insert(undefined);
  }
}

function isDuplicateIdError(error: unknown): boolean {
  for (let cause: unknown = error; cause instanceof Error; cause = cause.cause) {
    if (/UNIQUE constraint failed|SQLITE_CONSTRAINT_PRIMARYKEY/i.test(cause.message)) return true;
  }
  return false;
}
