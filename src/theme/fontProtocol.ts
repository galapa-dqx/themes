import type { FontRequest } from './controlCompiler';

export type FontLicenseMetadata = {
  identifier?: string;
  copyright?: string;
  description?: string;
  url?: string;
};

export type FontWorkerRequest = {
  id: number;
  bytes: Uint8Array;
  request: FontRequest;
};

export type FontWorkerSuccess = {
  id: number;
  ok: true;
  bytes: Uint8Array;
  extension: 'ttf' | 'otf';
  license: FontLicenseMetadata;
};

export type FontWorkerFailure = {
  id: number;
  ok: false;
  message: string;
};

export type FontWorkerResponse = FontWorkerSuccess | FontWorkerFailure;

