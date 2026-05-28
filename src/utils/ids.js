export const getRecordId = (record) => {
    if (record == null) return '';
    if (typeof record === 'string' || typeof record === 'number') return String(record);
    return String(record.id ?? record._id ?? '');
};

export const hasRecordId = (record) => Boolean(getRecordId(record));

export const sameRecordId = (left, right) => {
    const leftId = getRecordId(left);
    const rightId = getRecordId(right);
    return Boolean(leftId && rightId && leftId === rightId);
};
