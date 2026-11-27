/**
 * Escapes untrusted text before interpolating it into HTML strings
 * (e.g. Leaflet tooltips / divIcon). Reseller & outlet names come from uploaded Excel files.
 */
export function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"'`]/g, (ch) => {
    switch (ch) {
      case '&':
        return '&amp;';
      case '<':
        return '&lt;';
      case '>':
        return '&gt;';
      case '"':
        return '&quot;';
      case "'":
        return '&#39;';
      default:
        return '&#96;';
    }
  });
}

/**
 * Quotes a CSV cell and neutralizes spreadsheet formula injection (= + - @ tab CR).
 */
export function csvCell(value) {
  let text = String(value ?? '');
  if (/^[=+\-@\t\r]/.test(text) && !/^-?\d+(\.\d+)?$/.test(text)) {
    text = `'${text}`;
  }
  return `"${text.replace(/"/g, '""')}"`;
}
