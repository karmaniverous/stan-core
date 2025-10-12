/* src/stan/patch/detect.ts
 * Early-input detection helpers for patch service.
 */
import { isUnifiedDiff } from './common/diff';
export const seemsUnifiedDiff = (t: string): boolean => isUnifiedDiff(t);
