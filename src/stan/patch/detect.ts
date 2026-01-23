/**
 * Early-input detection helpers for patch service; pure string checks; no IO.
 * @module
 */
import { isUnifiedDiff } from './common/diff';
export const seemsUnifiedDiff = (t: string): boolean => isUnifiedDiff(t);
