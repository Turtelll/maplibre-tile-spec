import SpaceFillingCurve from "./spaceFillingCurve";

export default class ZOrderCurve extends SpaceFillingCurve {
    encode(vertex: { x: number; y: number }): number {
        this.validateCoordinates(vertex);
        const shiftedX = vertex.x + this._coordinateShift;
        const shiftedY = vertex.y + this._coordinateShift;
        let mortonCode = 0;
        for (let i = 0; i < this._numBits; i++) {
            mortonCode |= ((shiftedX & (1 << i)) << i) | ((shiftedY & (1 << i)) << (i + 1));
        }
        return mortonCode;
    }

    decode(mortonCode: number): { x: number; y: number } {
        const x = this.decodeMorton(mortonCode) - this._coordinateShift;
        const y = this.decodeMorton(mortonCode >> 1) - this._coordinateShift;
        return { x, y };
    }

    private decodeMorton(code: number): number {
        let coordinate = 0;
        for (let i = 0; i < this._numBits; i++) {
            coordinate |= (code & (1 << (2 * i))) >> i;
        }
        return coordinate;
    }
}

export function decodeZOrderCurve(mortonCode: number, numBits: number, coordinateShift: number): { x: number; y: number } {
    const x = decodeMortonCoordinate(mortonCode, numBits) - coordinateShift;
    const y = decodeMortonCoordinate(mortonCode >> 1, numBits) - coordinateShift;
    return { x, y };
}

export function decodeMortonCoordinate(code: number, numBits: number): number {
    let coordinate = 0;
    for (let i = 0; i < numBits; i++) {
        coordinate |= (code & (1 << (2 * i))) >> i;
    }
    return coordinate;
}
