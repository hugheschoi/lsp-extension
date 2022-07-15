import { Diagnostic } from "vscode-languageserver/node";
import { TEMPLATE_PROP_SORTS } from "../utils/const";
import { AstTemplateInterface } from "../utils/type";
import { genDiagnostics, getRange } from "../utils/diagnostic";
export default function analyzeTemplate(template: any) {
  const diagnostics: Diagnostic[] = [];
  deepLoopData(template.children, templateHandler, diagnostics);
  return diagnostics;
}
export function deepLoopData(
  data: AstTemplateInterface[],
  handler: any,
  diagnostics: Diagnostic[]
) {
  function dfs(data: AstTemplateInterface[]) {
    for (let i = 0; i < data.length; i++) {
      handler(data[i], diagnostics);
      if (data[i]?.children?.length) {
        dfs(data[i].children);
      } else {
        continue;
      }
    }
  }
  dfs(data);
}

function templateHandler(
  currData: AstTemplateInterface,
  diagnostics: Diagnostic[]
) {
  if (!currData || !currData?.props) return;
  const { props } = currData;
  if (props.length) {
    // 检查属性的顺序
    const { isGoodSort, newText } = attributeOrderValidator(
      props,
      currData.loc.source
    );
    if (!isGoodSort) {
      const range = {
        start: {
          line: props[0].loc.start.line - 1,
          character: props[0].loc.start.column - 1,
        },
        end: {
          line: props[props.length - 1].loc.end.line - 1,
          character: props[props.length - 1].loc.end.column - 1,
        },
      };
      const diagnostic: Diagnostic = genDiagnostics(
        "vue template 上的属性顺序",
        range
      );
      if (newText) {
        diagnostic.data = {
          title: "按照 Code Review 指南的顺序修复",
          newText,
        };
      }
      diagnostics.push(diagnostic);
    }
    const noGoodPropNames = propNameValidator(props);
    if (noGoodPropNames.length) {
      noGoodPropNames.forEach((item) => {
        const range = getRange(item);
        const text = item.name === "bind" ? item.arg.content : item.name;
        range.start.character =
          item.name === "bind"
            ? range.start.character + 1
            : range.start.character;
        range.end.character = range.start.character + text.length;
        const diagnostic: Diagnostic = genDiagnostics(
          "所有属性名称都使用小写字母加 - 方式",
          range
        );
        const newText = transformLowerCaseName(text);
        diagnostic.data = {
          title: `修复成 ${newText}`,
          newText,
        };
        diagnostics.push(diagnostic);
      });
    }
  }
}

function attributeOrderValidator(props: any[], source: string) {
  const propsName = props.map((prop) => {
    const isAttr = TEMPLATE_PROP_SORTS.some(
      (item) => item.indexOf(prop.name) >= 0
    );
    if (!isAttr) {
      if (prop.value === undefined) {
        return {
          ...prop,
          name: "defaultValueProp",
        };
      } else if (
        prop.value &&
        prop.value.type === 2 &&
        typeof prop.value.content === "string"
      ) {
        return {
          ...prop,
          name: "attribute",
        };
      }
      return {
        ...prop,
        name: "bind",
      };
    }
    if (prop.name === "bind") {
      if (["key", "ref"].includes(prop.content)) {
        prop.name = prop.content;
      }
    }
    return prop;
  });
  const data = JSON.parse(JSON.stringify(propsName));
  const sortPropsName = getAfterSortProps(data);
  const isGoodSort =
    propsName.map((prop) => prop.name).join() ===
    sortPropsName.map((prop) => prop.name).join();
  let newText = "";
  try {
    const splitMatch = source.match(/[\n\s]+/);
    if (!isGoodSort && splitMatch) {
      const split = splitMatch[0];
      newText = sortPropsName.map((prop) => prop.loc.source).join(split);
    }
  } catch (error) {
    console.log(error);
  }
  return {
    isGoodSort,
    newText,
  };
}

function propNameValidator(props: any[]) {
  const res = [];
  for (let i = 0; i < props.length; i++) {
    const item = props[i];
    if (
      /[A-Z]+/g.test(item.name) ||
      (item.name === "bind" && /[A-Z]+/g.test(item.arg.content))
    ) {
      res.push(item);
    }
  }
  return res;
}

function transformLowerCaseName(text: string) {
  // 找到大写的位置，然后将
  const strArr = [];
  for (let i = 0; i < text.length; i++) {
    const textCharCode = text[i].charCodeAt(0);
    if (
      textCharCode >= "A".charCodeAt(0) &&
      textCharCode <= "Z".charCodeAt(0)
    ) {
      const lowerText = text[i].toLocaleLowerCase();
      strArr.push(i === 0 ? lowerText : `-${lowerText}`);
    } else {
      strArr.push(text[i]);
    }
  }
  return strArr.join("");
}

function getAfterSortProps(props: any[]) {
  // 1. 首先常量是prop ast中的名称
  // 2. 从常量中找到符合条件的，并且记录 index 值
  // 3. 对比 index 值，再 sort
  const sortHandler = (firstEl: any, secondEl: any) => {
    let firstElIndex = -1;
    let secondElIndex = -1;
    TEMPLATE_PROP_SORTS.forEach((value: string, index: number) => {
      const values = value.split(",");
      for (let i = 0; i < values.length; i++) {
        if (firstEl.name === values[i]) {
          firstElIndex = index;
        }
        if (secondEl.name === values[i]) {
          secondElIndex = index;
        }
      }
    });
    return firstElIndex - secondElIndex;
  };
  const sortPropsName = props.sort(sortHandler);
  return sortPropsName;
}
