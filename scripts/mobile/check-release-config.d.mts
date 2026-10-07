export type ReleaseConfig = {
  webOrigin: string;
  supabaseUrl: string;
  callbackUrl: string;
  appId: string;
  appName: string;
  teamId: string;
  fingerprints: string[];
  environment: string;
};
export function validateReleaseConfig(
  env: Record<string, string | undefined>,
): ReleaseConfig;
export function linkAssociations(config: ReleaseConfig): {
  android: {
    relation: string[];
    target: {
      namespace: string;
      package_name: string;
      sha256_cert_fingerprints: string[];
    };
  }[];
  apple: {
    applinks: { apps: never[]; details: { appID: string; paths: string[] }[] };
  };
};
export function loadMobileEnv(): void;
