declare const __APP_VERSION__: string;
declare const __GIT_COMMIT__: string;

export const APP_VERSION: string =
  typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '0.0.0';

export const GIT_COMMIT: string =
  typeof __GIT_COMMIT__ !== 'undefined' ? __GIT_COMMIT__ : '000000';

export const VERSION_LABEL = `v${APP_VERSION} · ${GIT_COMMIT}`;
