/* eslint-disable @typescript-eslint/no-explicit-any */
// Tremor hasOnlyOneValueForKey — vendorizado sem alteração (github.com/tremorlabs/tremor).
export function hasOnlyOneValueForKey(array: any[], keyToCheck: string): boolean {
  const val: any[] = [];

  for (const obj of array) {
    if (Object.prototype.hasOwnProperty.call(obj, keyToCheck)) {
      val.push(obj[keyToCheck]);
      if (val.length > 1) {
        return false;
      }
    }
  }

  return true;
}
