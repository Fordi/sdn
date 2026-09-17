export const ansiEscRx = /\x1b\[([\d;]+)m/g;

export function sliceAnsi(text, start, end) {
  let i = 0, j = 0;
  text = [...text];
  for (; i < start; i++, j++) {
    if (text[j] === '\x1b') {
      const m = text.slice(j).join('').match(ansiEscRx);
      j += m[0].length;
    }
  }
  const aStart = j;
  let aEnd = text.length - 1;
  if (end) {
    for (; i <= end; i++, j++) {
      if (text[j] === '\x1b') {
        const m = text.slice(j).join('').match(ansiEscRx);
        j += m[0].length;
      }
    }
    aEnd = j;
  }
  let append = '';
  if (aEnd < text.length - 1) {
    aEnd = aEnd - 1;
    append = '⇶'
  }

  return [...text.slice(aStart, aEnd), append].join('');
}
