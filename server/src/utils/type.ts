export interface positionInterface {
  column: number;
  line: number;
  offset: number;
}
export interface LocInterface {
  start: positionInterface;
  end: positionInterface;
  source: string;
}
export interface AstTemplateInterface {
  tagType: number;
  tag: string;
  props: any[];
  ns: number;
  loc: LocInterface;
  isSelfClosing:false
  type:1
  children: AstTemplateInterface[];
  codegenNode: any;
}
