export const pad = (n, l = 2) => String(n).padStart(l, '0');

export const formatDateTime = (date) => {
  const d = `${pad(date.getFullYear())}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  const g = date.getHours();
  const h = g % 12 || 12;
  const a = g < 12 ? 'a' : 'p';
  const t = `${pad(h)}:${pad(date.getMinutes())}:${pad(date.getSeconds())}${a}`;
  return `${d} ${t}`;
}
