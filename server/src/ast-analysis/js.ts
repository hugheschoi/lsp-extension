import parser = require("@babel/parser");
import { Diagnostic } from "vscode-languageserver/node";
import { FIX_MSG } from "../utils/const";
import { genDiagnostics } from "../utils/diagnostic";
import { TextDocument } from "vscode-languageserver-textdocument";
// eslint-disable-next-line @typescript-eslint/no-var-requires
const traverse = require("@babel/traverse").default;

export default function analyzeScript(script: any, textDocument: TextDocument) {
  const diagnostics: Diagnostic[] = [];
  const scriptAst = parser.parse(script.children[0]?.content, {
    sourceType: 'module',
    plugins: [
      'typescript',
      ['decorators', { decoratorsBeforeExport: true }],
      'classProperties',
      'classPrivateProperties',
    ],
  });
  const scriptStart = script.loc.start.line - 1;
  traverse(scriptAst, {
    enter(path: any) {
      const { node } = path;
      if (isNoSafeGet(node)) {
        const range = getPositionRange(node, scriptStart);
        const text = textDocument.getText(range);
        if (!text.includes('this')) {
          const diagnostic: Diagnostic = genDiagnostics(
            '取值和赋值的时候是否有 safeGet ',
            range
          );
          diagnostics.push(diagnostic);
        }
      }
      if (isExceedArguments(node)) {
        const [firstParams, endParams] = [
          node.params[0],
          node.params[node.params.length - 1],
        ];
        const range = {
          start: {
            line: firstParams.loc.start.line - 1 + scriptStart,
            character: firstParams.loc.start.column,
          },
          end: {
            line: endParams.loc.end.line - 1 + scriptStart,
            character: endParams.loc.end.column,
          },
        };
        const diagnostic: Diagnostic = genDiagnostics(
          '函数参数不多于 2 个，如果有很多参数就利用 object 传递，并使用解构',
          range
        );
        diagnostics.push(diagnostic);
      }
      if (hasNumberValue(node)) {
        const diagnostic: Diagnostic = genDiagnostics(
          '使用静态变量或枚举替换代码中的常数, 增加可读性',
          getPositionRange(node, scriptStart)
        );
        diagnostics.push(diagnostic);
      }
      if (isLongFunction(node)) {
        const diagnostic: Diagnostic = genDiagnostics(
          '单个函数不宜超过 80 行',
          getPositionRange(node, scriptStart)
        );
        diagnostics.push(diagnostic);
      }
      if (isInvalidBooleanStatement(node)) {
        let variableName = '';
        if (['ClassProperty', 'Property'].includes(node.type)) {
          variableName = node.key?.name;
        } else if (node.type === 'VariableDeclarator') {
          variableName = node?.id?.name;
        }
        const range = {
          start: {
            line: node.loc.start.line - 1 + scriptStart,
            character: node.loc.start.column,
          },
          end: {
            line: node.loc.end.line - 1 + scriptStart,
            character: node.loc.start.column + variableName.length,
          },
        };
        const diagnostic: Diagnostic = genDiagnostics(
          'boolean 类型的变量使用 is、has、can 开头',
          range
        );
        const newText = `is${variableName.replace(
          variableName[0],
          variableName[0].toUpperCase()
        )}`;
        diagnostic.data = {
          title: `修复成 ${newText}`,
          newText,
        };
        diagnostics.push(diagnostic);
      }
      if (
        node.type === 'ClassMethod' &&
        isExceedBlockStatement(node, 0)
      ) {
        const diagnostic: Diagnostic = genDiagnostics(
          '嵌套层级不超过 4 层 (if/else、循环、回调)',
          getPositionRange(node, scriptStart)
        );
        diagnostics.push(diagnostic);
      }
    },
  });
  return diagnostics;
}

function isInvalidBooleanStatement(node: Record<string, any>) {
  let variableName = '';
  let currValue;
  if (['ClassProperty', 'Property'].includes(node.type)) {
    if (node.key?.type === 'Identifier') {
      variableName = node.key?.name?.toLowerCase();
      currValue = node.value?.value;
    }
  } else if (node?.type === 'VariableDeclarator') {
    if (node.id?.type === 'Identifier') {
      variableName = node?.id?.name;
      currValue = node?.init?.value;
    }
  }
  if (variableName) {
    const isBadName = typeof currValue === 'boolean' &&
    variableName?.indexOf('is') < 0 &&
    variableName?.indexOf('has') < 0 &&
    variableName?.indexOf('can') < 0 &&
    variableName?.indexOf('visible') < 0 &&
    variableName?.indexOf('show') < 0 &&
    variableName?.indexOf('loading') < 0;
    return isBadName;
  }
  return false;
}

function isLongFunction(node: Record<string, any>) {
  return (
    node.type === 'ClassMethod' && node.loc.end.line - node.loc.start.line > 80
  );
}

// 如果一个表达式的值（只限数字，字符串用得很多，比如判断 key 的名称）缺少定义 identity ，那么可以认为它是魔术字符串
function hasNumberValue(node: Record<string, any>): boolean {
  if (!node || node.type !== 'BinaryExpression') return false;
  // 类型还需要结合多种情况定下
  // 递归 init 或 left 或 right 的类型中有 NumericLiteral 类型，说明有在表达式中
  if (
    node.type === 'BinaryExpression' &&
    (node.left.type === 'NumericLiteral' ||
      node.right.type === 'NumericLiteral')
  ) {
    return true;
  } else {
    return hasNumberValue(node.left) || hasNumberValue(node.right);
  }
}

// 超过两个参数
function isExceedArguments(node: Record<string, any>) {
  return node.type === 'ClassMethod' && node.params.length > 2;
}

// 层级超过4层
function isExceedBlockStatement(node: any, statementNum: number): any {
  if (statementNum > 4) return true;
  if (!node || !(node instanceof Object)) return false;
  if (node.type === 'BlockStatement') {
    statementNum++;
    const { body } = node;
    if (Array.isArray(body)) {
      return body.some((item) => {
        return isExceedBlockStatement(item, statementNum);
      });
    }
    return false;
  } else {
    return Object.keys(node).some((key) => {
      return isExceedBlockStatement(node[key], statementNum);
    });
  }
}

// 判断是否不安全获取 safeGet
function isNoSafeGet(node: Record<string, any>) {
  return (
    node.type === 'MemberExpression' &&
    node.object?.property?.name &&
    node.object?.type === 'MemberExpression' &&
    node.property?.type === 'Identifier' &&
    node.property?.name
    // (!node.object?.object?.object ||
    //   node.object?.object?.object?.type !== 'ThisExpression')
  );
  // 白名单（包含 this，有this 说明）
}

function getPositionRange(node: any, scriptStart: number) {
  return {
    start: {
      line: node.loc.start.line - 1 + scriptStart,
      character: node.loc.start.column,
    },
    end: {
      line: node.loc.end.line - 1 + scriptStart,
      character: node.loc.end.column,
    },
  };
}
