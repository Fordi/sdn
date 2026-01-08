export function shellQuote(s, ...rest) {
  if (Array.isArray(s)) {
    return s.map((item) => shellQuote(item)).join(' ');
  }
  if (rest.length) {
    return [s, ...rest].map((item) => shellQuote(item)).join(' ');
  }
  if (s === '') return `''`;
  if (!/[^%+,-.\/:=@_0-9A-Za-z]/.test(s)) return s;
  return `'` + s.replace(/'/g, `'\''`) + `'`;
}