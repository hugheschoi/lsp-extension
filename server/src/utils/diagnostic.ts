import { Diagnostic, DiagnosticSeverity } from 'vscode-languageserver/node';
export function getRange(currData: any) {
  return {
    start: {
      line: currData.loc.start.line - 1,
      character: currData.loc.start.column - 1,
    },
    end: {
      line: currData.loc.end.line - 1,
      character: currData.loc.end.column - 1,
    },
  }
}

export function genDiagnostics(message: string, range: any, source = 'Code Review 指南'): Diagnostic {
  return {
    severity: DiagnosticSeverity.Warning,
    range,
    message,
    source,
  }
}