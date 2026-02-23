export const VERSION = "0.1.0";

export interface SteerConfig {
  name: string;
  version: string;
}

export function createConfig(name: string): SteerConfig {
  return { name, version: VERSION };
}
