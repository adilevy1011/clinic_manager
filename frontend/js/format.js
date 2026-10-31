export const money = (value) => new Intl.NumberFormat('en-US', {
  style: 'currency', currency: 'ILS', minimumFractionDigits: 2,
}).format(Number(value || 0));

export const monthLabel = (month) => new Intl.DateTimeFormat('en-US', {
  month: 'long', year: 'numeric',
}).format(new Date(`${month}-01T12:00:00`));

export const escapeHtml = (value) => String(value ?? '').replace(/[&<>'"]/g, (char) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;',
}[char]));
