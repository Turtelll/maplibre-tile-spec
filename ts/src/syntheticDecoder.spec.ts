import { expect, describe, it } from "vitest";
import { readdirSync, readFileSync } from "fs";
import { join } from "path";
import { decodeTile, type FeatureTable, type Feature, GEOMETRY_TYPE } from ".";

describe("Synthetic MLT decoder validation", () => {
    const syntheticDir = "../test/synthetic/0x01";
    const mltFiles = readdirSync(syntheticDir)
        .filter((f) => f.endsWith(".mlt"))
        .sort();

    // FastPFOR tests to skip until decoder implements FastPFOR encoding
    // TODO: Remove these skips after implementing FastPFOR support
    const fastPforTests = [
        "polygon-fpf",
        "polygon-hole-fpf",
        "polygon-morton-tess",
        "polygon-multi-fpf",
    ];

    for (const mltFile of mltFiles) {
        const baseName = mltFile.replace(".mlt", "");
        const shouldSkip = fastPforTests.includes(baseName);

        const testFn = shouldSkip ? it.skip : it;

        testFn(`should decode ${baseName}`, () => {
            const mltPath = join(syntheticDir, mltFile);
            const mltBytes = new Uint8Array(readFileSync(mltPath));

            const jsonPath = join(syntheticDir, `${baseName}.json`);
            const reference = JSON.parse(readFileSync(jsonPath, "utf-8"));

            const tables = decodeTile(mltBytes);
            expect(tables.length).toBe(1);

            validateFeatureTable(tables[0], reference);
        });
    }
});

function validateFeatureTable(table: FeatureTable, reference: any) {
    expect(table.name).toBe("layer1");
    expect(table.extent).toBe(4096);
    expect(table.numFeatures).toBe(reference.features.length);

    const features = table.getFeatures();
    expect(features.length).toBe(reference.features.length);

    // Convert MLT FeatureTable to GeoJSON FeatureCollection (like Rust's to_geojson())
    const actual = toGeoJSON(table);

    // Single assertion on entire structure (Rust approach)
    expect(actual).toEqual(reference);
}

// Convert FeatureTable to GeoJSON FeatureCollection (mimics rust/mlt-nom/src/geojson.rs)
function toGeoJSON(table: FeatureTable): any {
    const features = table.getFeatures();

    return {
        type: "FeatureCollection",
        features: features.map((feature) => ({
            type: "Feature",
            geometry: toGeoJSONGeometry(feature.geometry),
            id: toGeoJSONId(feature.id),
            properties: toGeoJSONProperties(feature.properties, table.name),
        })),
    };
}

// Convert MLT geometry to GeoJSON geometry
function toGeoJSONGeometry(geometry: any): any {
    const type = mapGeometryTypeToString(geometry.type);
    let coords = geometry.coordinates;

    // Unwrap MLT coordinate nesting to match GeoJSON format
    if (Array.isArray(coords) && coords.length > 0) {
        if (type === "Point") {
            coords = coords[0];
            if (Array.isArray(coords) && coords.length > 0) {
                coords = coords[0];
            }
        } else if (type === "LineString" || type === "MultiPoint") {
            coords = coords[0];
        }
    }

    // Convert Point objects {x, y} to [x, y] arrays
    coords = convertPointsToArrays(coords);

    return {
        type,
        coordinates: coords,
        crs: {
            type: "name",
            properties: {
                name: "EPSG:0",
            },
        },
    };
}

// Convert Point objects to coordinate arrays
function convertPointsToArrays(coords: any): any {
    if (!coords) return coords;

    if (typeof coords === "object" && "x" in coords && "y" in coords) {
        return [coords.x, coords.y];
    }

    if (Array.isArray(coords)) {
        return coords.map((c) => convertPointsToArrays(c));
    }

    return coords;
}

// Convert MLT ID to GeoJSON ID
function toGeoJSONId(id: number | bigint | null | undefined): number {
    if (id === null || id === undefined) return 0;
    return typeof id === "bigint" ? Number(id) : id;
}

// Convert MLT properties to GeoJSON properties (adds "layer" field like Rust)
function toGeoJSONProperties(properties: Record<string, any>, layerName: string): Record<string, any> {
    const props: Record<string, any> = {};

    // Convert bigint values to numbers
    for (const [key, value] of Object.entries(properties)) {
        props[key] = typeof value === "bigint" ? Number(value) : value;
    }

    // Add layer property (matching reference JSON)
    props.layer = layerName;

    return props;
}

// Convert GEOMETRY_TYPE enum to GeoJSON type string
function mapGeometryTypeToString(type: number): string {
    const mapping: Record<number, string> = {
        [GEOMETRY_TYPE.POINT]: "Point",
        [GEOMETRY_TYPE.LINESTRING]: "LineString",
        [GEOMETRY_TYPE.POLYGON]: "Polygon",
        [GEOMETRY_TYPE.MULTIPOINT]: "MultiPoint",
        [GEOMETRY_TYPE.MULTILINESTRING]: "MultiLineString",
        [GEOMETRY_TYPE.MULTIPOLYGON]: "MultiPolygon",
    };
    return mapping[type];
}
