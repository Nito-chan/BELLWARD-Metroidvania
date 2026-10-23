/**
 * Run persistence. The storage key and document version live here so the save loader,
 * the debug overlay and the tests all agree on one contract.
 */
export const SAVE = {
  /**
   * Version of the persisted run document. Bump this whenever the shape changes; the
   * loader migrates known old versions and treats every other version as unreadable.
   */
  version: 3,
  /** localStorage key. The `.v1` suffix is convention, not the validation version. */
  storageKey: 'bellward.save.v1',
} as const;
