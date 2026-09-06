export type DiagnosticSeverity = 'info' | 'warning' | 'error';

export type ThemeDiagnostic = {
  severity: DiagnosticSeverity;
  code: string;
  message: string;
  path?: string;
};

export class ThemeCompilationError extends Error {
  readonly diagnostics: readonly ThemeDiagnostic[];

  constructor(message: string, diagnostics: readonly ThemeDiagnostic[]) {
    super(message);
    this.name = 'ThemeCompilationError';
    this.diagnostics = diagnostics;
  }
}

export function errorDiagnostic(
  code: string,
  message: string,
  path?: string,
): ThemeDiagnostic {
  return { severity: 'error', code, message, ...(path ? { path } : {}) };
}

