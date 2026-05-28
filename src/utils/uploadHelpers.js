import * as XLSX from 'xlsx';

export const ACCEPTED_UPLOAD_FORMATS = '.xlsx, .xls, .csv';

export const isSupportedFile = (file) => /\.(xlsx|xls|csv)$/i.test(file?.name || '');

export const normalizeHeaderKey = (value = '') =>
    String(value)
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '');

export const createHeaderMapper = (headerAliases = {}) => (header) => {
    const normalized = normalizeHeaderKey(header);
    return headerAliases[normalized] || String(header || '').trim();
};

export const formatFileSize = (size = 0) => {
    if (!size) return '0 KB';
    const units = ['B', 'KB', 'MB', 'GB'];
    const unitIndex = Math.min(Math.floor(Math.log(size) / Math.log(1024)), units.length - 1);
    const value = size / 1024 ** unitIndex;
    return `${value.toFixed(unitIndex === 0 ? 0 : 2)} ${units[unitIndex]}`;
};

export const buildPreviewFromFile = async (
    file,
    {
        headerAliases = {},
        requiredColumns = [],
        emptyMessage = 'The selected workbook is empty.',
        validateRow = null,
        maxRowIssues = 10,
    } = {}
) => {
    const toCanonicalHeader = createHeaderMapper(headerAliases);
    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: 'array', cellFormula: false, cellHTML: false, cellNF: false });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];

    if (!worksheet) {
        throw new Error('The selected workbook does not contain a readable sheet.');
    }

    const rows = XLSX.utils.sheet_to_json(worksheet, { defval: '', raw: false });
    const headerRow = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' })[0] || [];
    const canonicalHeaders = [...new Set(headerRow.map(toCanonicalHeader).filter(Boolean))];

    if (!rows.length) {
        throw new Error(emptyMessage);
    }

    const normalizedRows = rows.map((row, index) => {
        const normalizedRow = { __rowNumber: index + 2 };

        Object.entries(row).forEach(([key, value]) => {
            normalizedRow[toCanonicalHeader(key)] = value;
        });

        return normalizedRow;
    });

    const missingColumns = requiredColumns.filter((column) => !canonicalHeaders.includes(column));
    const rowIssues = normalizedRows
        .flatMap((row) => {
            const missingValues = requiredColumns.filter((column) => !String(row[column] ?? '').trim());
            const customIssues = typeof validateRow === 'function' ? validateRow(row) : [];

            const messages = [];
            if (missingValues.length) {
                messages.push(`Missing ${missingValues.join(', ')}`);
            }
            if (Array.isArray(customIssues)) {
                messages.push(...customIssues.filter(Boolean));
            }

            if (!messages.length) return [];

            return [
                {
                    row: row.__rowNumber,
                    reason: messages.join(' | '),
                },
            ];
        })
        .slice(0, maxRowIssues);

    return {
        headers: canonicalHeaders.length ? canonicalHeaders : requiredColumns,
        rows: normalizedRows.slice(0, 5),
        totalRows: normalizedRows.length,
        missingColumns,
        rowIssues,
    };
};
