/**
 * Escapes a CSV cell value by prefixing it with a single quote if it starts with =, +, -, or @,
 * and then wrapping it in double quotes if it contains a comma, double-quote, or newline.
 * @param value - The value to escape.
 * @returns The escaped CSV cell value.
 */
export function escapeCsvCell(value) {
    let strValue = String(value);
    // 🛑 THE HYPHEN MUST BE ESCAPED. This was `/^[=+-@]/`, where `+-@` is a character RANGE
    // (0x2B–0x40), not three literals — so it matched `+ , - . / 0-9 : ; < = > ? @`, i.e.
    // EVERY DIGIT. Found 2026-08-25: funding amounts exported as `'250000` and deadlines as
    // `'2026-09-30`, which Excel then treats as TEXT — the amounts will not sum and the dates
    // will not sort. Silent, and wrong in the direction that makes the export useless for the
    // one thing people export a grant tracker for.
    //
    // `-` stays in the list deliberately: a leading `-` or `+` can still begin a formula, so
    // a genuinely negative value is rendered as text. That is the accepted trade in the
    // injection guidance, and the amounts this app stores are positive.
    if (/^[=+\-@]/.test(strValue)) {
        strValue = `'${strValue}`;
    }
    if (/[,\"\n]/.test(strValue)) {
        strValue = `"${strValue.replace(/"/g, '""')}"`;
    }
    return strValue;
}
/**
 * Joins escaped CSV cells with commas and rows with CRLF to form a CSV string.
 * @param rows - The array of rows to join into a CSV string.
 * @returns The CSV string.
 */
export function toCsv(rows) {
    return rows.map(row => row.map(escapeCsvCell).join(',')).join('\r\n');
}
