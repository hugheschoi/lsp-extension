import {
	CodeAction,
	CodeActionParams,
	DiagnosticSeverity,
	CodeActionKind,
} from 'vscode-languageserver';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { FIX_MSG } from './codeDiagnostics';

/**
 * Provide quickfix only for:
 * not fully uppercased keywords
 *
 * @export
 * @param {TextDocument} textDocument
 * @param {CodeActionParams} params
 * @returns {CodeAction[]}
 */
export function quickfix(
	textDocument: TextDocument,
	params: CodeActionParams
): CodeAction[] {
	const diagnostics = params.context.diagnostics;
	if (isNullOrUndefined(diagnostics) || diagnostics.length === 0) {
		return [];
	}

	const codeActions: CodeAction[] = [];
	diagnostics.forEach((diag) => {
		if (diag.severity === DiagnosticSeverity.Warning) {
			let newText = '';
			let title = '';
			if (diag.message.includes('v-bind')) {
				newText = '';
				title = 'change v-bind';
			}
			if (diag.data || title) {
				codeActions.push({
					title: (diag.data as any)?.title || title,
					kind: CodeActionKind.QuickFix,
					diagnostics: [diag],
					edit: {
						changes: {
							[params.textDocument.uri]: [
								{
									range: diag.range,
									newText: (diag.data as any)?.newText || newText,
								},
							],
						},
					},
				});
			} 
		}
	});

	return codeActions;
}

export function isNullOrUndefined(x: unknown): x is null | undefined {
	return x === null || x === undefined;
}
