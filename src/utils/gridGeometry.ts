import * as THREE from 'three';

export const getIndex = (x: number, y: number, z: number, width: number, height: number) => x + y * width + z * width * height;

export const getCoords = (index: number, width: number, height: number) => {
    const z = Math.floor(index / (width * height));
    const rem = index % (width * height);
    const y = Math.floor(rem / width);
    const x = rem % width;
    return { x, y, z };
};

export const isShell = (x: number, y: number, z: number, width: number, height: number, depth: number) => {
    return x === 0 || x === width - 1 || y === 0 || y === height - 1 || z === 0 || z === depth - 1;
};

export const calculateCellTransform = (
    x: number, y: number, z: number,
    width: number, height: number, depth: number,
    spacing: number,
    dummy: THREE.Object3D
) => {
    // Centering Offset
    const offset = (width - 1) / 2;

    // Position
    dummy.position.set(
        (x - offset) * spacing,
        (y - offset) * spacing,
        (z - offset) * spacing
    );
    
    // Calculate Surface Normal based on position
    const normal = new THREE.Vector3();
    if (x === 0) normal.x -= 1;
    else if (x === width - 1) normal.x += 1;
    
    if (y === 0) normal.y -= 1;
    else if (y === height - 1) normal.y += 1;
    
    if (z === 0) normal.z -= 1;
    else if (z === depth - 1) normal.z += 1;
    
    normal.normalize();

    // Align Z-axis of the box (local "thickness") to the surface normal
    // Default up for lookAt or quaternion alignment is usually +Y or +Z depending on helper
    // We want the 'flat' face (XY plane of the box) to face outward.
    // So the Box's Z axis should point along 'normal'.
    const up = new THREE.Vector3(0, 0, 1);
    dummy.quaternion.setFromUnitVectors(up, normal);

    // Scale: Wide on X/Y (local), Thin on Z (local)
    // This creates a flat panel oriented correctly.
    // For edges/corners, this creates a chamfered panel.
    const panelSize = 0.9 * spacing;
    const thickness = 0.05 * spacing;

    dummy.scale.set(panelSize, panelSize, thickness);
    dummy.updateMatrix();
};
