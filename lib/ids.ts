/**
 * Clients generate the id for rows they create, so an optimistic row *is* the
 * real row. Without this, acting on something before the server has answered —
 * adding a subtask to a brand new task, opening a list you just created —
 * sends a placeholder id and fails.
 *
 * Ids are not capabilities: every access check is by ownership or share, never
 * by knowing an id. Accepting one from the client therefore only has to keep
 * the shape sane; a colliding id fails on the primary key like any other
 * conflict.
 */
const CLIENT_ID = /^[a-z0-9]{16,32}$/;

export function parseClientId(value: unknown): string | undefined {
  return typeof value === 'string' && CLIENT_ID.test(value) ? value : undefined;
}
