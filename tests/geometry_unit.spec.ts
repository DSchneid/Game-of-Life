import { test, expect } from '@playwright/test';
import * as THREE from 'three';
import { calculateCellTransform } from '../src/utils/gridGeometry';

test.describe('Grid Geometry Logic', () => {
    const WIDTH = 32;
    const HEIGHT = 32;
    const DEPTH = 32;
    const SPACING = 0.5;

    test('Face cells should be flat panels', () => {
        const dummy = new THREE.Object3D();
        // Middle of Front Face (z=0)
        calculateCellTransform(16, 16, 0, WIDTH, HEIGHT, DEPTH, SPACING, dummy);
        
        const { x, y, z } = dummy.scale;
        // Should be thin in Z
        expect(z).toBeLessThan(0.1 * SPACING);
        // Should be wide in X and Y
        expect(x).toBeCloseTo(0.9 * SPACING);
        expect(y).toBeCloseTo(0.9 * SPACING);
    });

    test('Corner cells should NOT be cubes (Target Behavior)', () => {
        const dummy = new THREE.Object3D();
        // Corner (0,0,0)
        calculateCellTransform(0, 0, 0, WIDTH, HEIGHT, DEPTH, SPACING, dummy);

        const { x, y, z } = dummy.scale;



        // We want it to be "flat-ish" in at least one dimension
        const minScale = Math.min(x, y, z);
        const maxScale = Math.max(x, y, z);

        // Expectation: It should be thin (like a panel)
        expect(minScale).toBeLessThan(0.2 * SPACING); 
        
        // Expectation: It should still have size (not a point)
        expect(maxScale).toBeGreaterThan(0.5 * SPACING);
    });

    test('Edge cells should NOT be cubes (Target Behavior)', () => {
        const dummy = new THREE.Object3D();
        // Edge between Left and Bottom (x=0, y=0, z=16)
        calculateCellTransform(0, 0, 16, WIDTH, HEIGHT, DEPTH, SPACING, dummy);

        const { x, y, z } = dummy.scale;



        const minScale = Math.min(x, y, z);
        
        // Expectation: It should be thin
        expect(minScale).toBeLessThan(0.2 * SPACING);
    });
});
