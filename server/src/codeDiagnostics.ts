import { Diagnostic, DiagnosticSeverity } from 'vscode-languageserver/node';

import { TextDocument } from 'vscode-languageserver-textdocument';
import analyzeScript from './ast-analysis/js';
import analyzeTemplate from './ast-analysis/vue-html';
import analyzeStyle from './ast-analysis/style';
import VueParser = require('@vue/compiler-dom');

export const FIX_MSG = 'fix it';
export const WMS_EXTENSION_RULES = 'wms rules';

export function getDiagnostics(textDocument: TextDocument, settings: any): Diagnostic[] {
	const text = textDocument.getText();
	const res = VueParser.parse(text);
	const [template, script, style] = res.children;
	return [
		...analyzeTemplate(template),
		...analyzeScript(script, textDocument),
		...analyzeStyle(style),
	];
}