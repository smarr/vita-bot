function replaceAll(str: string, search: RegExp, replace: string) {
  return str.replace(search, replace);
}

export function encodeForHtmlComment(str: string) {
  const safeBackslashes = replaceAll(str, /\\/g, "\\\\");
  const safeMinus = replaceAll(safeBackslashes, /-/g, "\\-");
  return safeMinus;
}

export function decodeFromHtmlComment(str: string) {
  const decodedMinus = replaceAll(str, /\\-/g, "-");
  const decodedBackslashes = replaceAll(decodedMinus, /\\\\/g, "\\");
  return decodedBackslashes;
}

const dataRegex = /\n<!-- vita-bot (.*) -->\n/mg;

export function withData(str: string, obj: any): string {
  const json = JSON.stringify(obj);
  const strWithoutPreviousData = withoutData(str);
  return strWithoutPreviousData + "\n<!-- vita-bot " + encodeForHtmlComment(json) + " -->\n";
}

export function readData(str: string): any | null {
  const m = dataRegex.exec(str);
  if (m === null) {
    return null;
  }
  const data = m[1];
  const decoded = decodeFromHtmlComment(data);
  return JSON.parse(decoded);
}

export function withoutData(str: string) {
  return str.replace(dataRegex, "");
}
