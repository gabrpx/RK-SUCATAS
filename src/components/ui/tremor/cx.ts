// Tremor cx — vendorizado sem alteração (github.com/tremorlabs/tremor).
import clsx, { type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cx(...args: ClassValue[]) {
  return twMerge(clsx(...args));
}
