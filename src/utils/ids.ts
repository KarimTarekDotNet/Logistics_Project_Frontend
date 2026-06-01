export const emptyGuid = "00000000-0000-0000-0000-000000000000";
const guidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isValidId(id?: string | null): id is string {
  return Boolean(id && guidPattern.test(id) && id !== emptyGuid);
}
