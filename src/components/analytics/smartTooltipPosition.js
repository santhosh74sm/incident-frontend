const clamp = (value, minimum, maximum) => {
    if (maximum < minimum) return minimum;
    return Math.min(Math.max(value, minimum), maximum);
};

export const intersectRects = (...rects) => {
    const validRects = rects.filter((rect) => rect && rect.width >= 0 && rect.height >= 0);
    if (validRects.length === 0) return null;

    const left = Math.max(...validRects.map((rect) => rect.left));
    const top = Math.max(...validRects.map((rect) => rect.top));
    const right = Math.min(...validRects.map((rect) => rect.right));
    const bottom = Math.min(...validRects.map((rect) => rect.bottom));

    return {
        left,
        top,
        right: Math.max(left, right),
        bottom: Math.max(top, bottom),
        width: Math.max(0, right - left),
        height: Math.max(0, bottom - top),
    };
};

// Returns Recharts-local coordinates. Horizontal placement prefers the right;
// vertical placement prefers above the active point, then flips on collision.
export const getSmartTooltipPosition = ({ coordinate, tooltipSize, chartRect, boundaryRect, offset = 12, inset = 8 }) => {
    if (!coordinate || !tooltipSize || !chartRect || !boundaryRect) return null;

    const minX = boundaryRect.left - chartRect.left + inset;
    const minY = boundaryRect.top - chartRect.top + inset;
    const maxX = boundaryRect.right - chartRect.left - tooltipSize.width - inset;
    const maxY = boundaryRect.bottom - chartRect.top - tooltipSize.height - inset;

    const rightX = coordinate.x + offset;
    const leftX = coordinate.x - tooltipSize.width - offset;
    const aboveY = coordinate.y - tooltipSize.height - offset;
    const belowY = coordinate.y + offset;

    const x = rightX <= maxX ? rightX : leftX >= minX ? leftX : clamp(rightX, minX, maxX);
    const y = aboveY >= minY ? aboveY : belowY <= maxY ? belowY : clamp(aboveY, minY, maxY);

    return { x: Math.round(x), y: Math.round(y) };
};
