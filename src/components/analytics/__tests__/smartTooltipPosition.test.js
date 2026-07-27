import { getSmartTooltipPosition, intersectRects } from '../smartTooltipPosition';

const chartRect = { left: 100, top: 100, right: 500, bottom: 400, width: 400, height: 300 };
const boundaryRect = chartRect;
const tooltipSize = { width: 120, height: 80 };

describe('getSmartTooltipPosition', () => {
    it('places a tooltip to the right and above when there is space', () => {
        expect(getSmartTooltipPosition({ coordinate: { x: 160, y: 180 }, tooltipSize, chartRect, boundaryRect }))
            .toEqual({ x: 172, y: 88 });
    });

    it('flips left at the right edge', () => {
        expect(getSmartTooltipPosition({ coordinate: { x: 380, y: 180 }, tooltipSize, chartRect, boundaryRect }))
            .toEqual({ x: 248, y: 88 });
    });

    it('flips below at the top edge', () => {
        expect(getSmartTooltipPosition({ coordinate: { x: 160, y: 20 }, tooltipSize, chartRect, boundaryRect }))
            .toEqual({ x: 172, y: 32 });
    });

    it('keeps the tooltip within the available area for a small chart', () => {
        const smallBoundary = { left: 100, top: 100, right: 250, bottom: 200, width: 150, height: 100 };
        expect(getSmartTooltipPosition({ coordinate: { x: 145, y: 95 }, tooltipSize, chartRect, boundaryRect: smallBoundary }))
            .toEqual({ x: 13, y: 8 });
    });
});

describe('intersectRects', () => {
    it('returns the shared visible area', () => {
        expect(intersectRects(
            { left: 0, top: 0, right: 100, bottom: 100, width: 100, height: 100 },
            { left: 20, top: 10, right: 80, bottom: 70, width: 60, height: 60 },
        )).toMatchObject({ left: 20, top: 10, right: 80, bottom: 70, width: 60, height: 60 });
    });
});
