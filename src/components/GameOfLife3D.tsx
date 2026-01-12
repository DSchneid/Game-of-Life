import React, { useState, useRef, useEffect, useMemo, useCallback, Suspense } from 'react';
import { Canvas, useFrame, createPortal } from '@react-three/fiber';
import { PerspectiveCamera, OrbitControls } from '@react-three/drei';
import { VRButton, XR, Controllers, Hands, Interactive, useXR } from '@react-three/xr';
import * as THREE from 'three';
import { getIndex, getCoords, isShell, calculateCellTransform } from '../utils/gridGeometry';
import { Locomotion } from './Locomotion';
import { VRLogger } from './VRLogger';

// --- Types ---
type Grid3DType = Uint8Array; 

const WIDTH = 32;
const HEIGHT = 32;
const DEPTH = 32;
const TOTAL_CELLS = WIDTH * HEIGHT * DEPTH;
const SPACING = 0.25;

interface RuleSet3D {
  name: string;
  born: number[];
  survive: number[];
}

// Switching to 2D-friendly rules for the surface simulation
const RULE_SETS_3D: RuleSet3D[] = [
    { name: 'Conway Classic (2D Surface)', born: [3], survive: [2, 3] },
    { name: 'HighLife (2D Surface)', born: [3, 6], survive: [2, 3] },
    { name: 'Day & Night (2D Surface)', born: [3, 6, 7, 8], survive: [3, 4, 6, 7, 8] },
];

// --- Logic Helpers ---

const generateEmptyGrid = (): Grid3DType => new Uint8Array(TOTAL_CELLS);

const generateRandomGrid = (): Grid3DType => {
    const grid = new Uint8Array(TOTAL_CELLS);
    for (let x = 0; x < WIDTH; x++) {
        for (let y = 0; y < HEIGHT; y++) {
            for (let z = 0; z < DEPTH; z++) {
                if (isShell(x, y, z, WIDTH, HEIGHT, DEPTH)) {
                    const idx = getIndex(x, y, z, WIDTH, HEIGHT);
                    grid[idx] = Math.random() > 0.75 ? 1 : 0;
                }
            }
        }
    }
    return grid;
};

// --- VR / Desktop Interaction Components ---

const LaserBeam = ({ controller }: { controller: any }) => {
    const beamRef = useRef<THREE.Mesh>(null);
    
    useFrame(() => {
        if (!beamRef.current) return;
        // Standard Quest beam is thin, long, and fades out
        // The beam is already attached to the controller group in XR, 
        // but we can customize its appearance here.
    });

    return (
        <mesh rotation-x={-Math.PI / 2} position={[0, 0, -5]}>
            <cylinderGeometry args={[0.005, 0.005, 10, 8]} />
            <meshBasicMaterial color="#61dafb" transparent opacity={0.5} />
        </mesh>
    );
};

const TargetRing = ({ position }: { position: [number, number, number] }) => (
    <group position={position}>
        <mesh rotation-x={-Math.PI / 2}>
            <ringGeometry args={[0.03, 0.04, 32]} />
            <meshBasicMaterial color="#61dafb" transparent opacity={0.8} />
        </mesh>
        <mesh>
            <sphereGeometry args={[0.01, 16, 16]} />
            <meshBasicMaterial color="#ffffff" />
        </mesh>
    </group>
);

const InteractionLayer = ({ onToggleCell, onTogglePause }: { 
    onToggleCell: (x: number, y: number, z: number) => void,
    onTogglePause: () => void 
}) => {
    const { controllers, isPresenting } = useXR();
    const lastAButtonPressed = useRef(false);
    
    // Store intersections per controller
    const [intersections, setIntersections] = useState<Map<number, THREE.Vector3>>(new Map());
    const [desktopCursor, setDesktopCursor] = useState<THREE.Vector3 | null>(null);

    // --- XR Controller Logic ---
    useFrame(() => {
        const rightController = controllers.find(c => c.inputSource?.handedness === 'right');
        if (rightController?.inputSource?.gamepad) {
            const gamepad = rightController.inputSource.gamepad;
            const aButtonPressed = gamepad.buttons[4]?.pressed || gamepad.buttons[5]?.pressed; 
            
            if (aButtonPressed && !lastAButtonPressed.current) {
                onTogglePause();
                if (gamepad.hapticActuators?.[0]) {
                    gamepad.hapticActuators[0].pulse(0.4, 100);
                }
            }
            lastAButtonPressed.current = !!aButtonPressed;
        }
    });

    // --- Shared Logic ---
    const getGridFromPoint = (point: THREE.Vector3) => {
        const offset = (WIDTH - 1) / 2;
        let gx = Math.round(point.x / SPACING + offset);
        let gy = Math.round(point.y / SPACING + offset);
        let gz = Math.round(point.z / SPACING + offset);

        gx = Math.max(0, Math.min(WIDTH - 1, gx));
        gy = Math.max(0, Math.min(HEIGHT - 1, gy));
        gz = Math.max(0, Math.min(DEPTH - 1, gz));
        
        return { gx, gy, gz };
    }

    // --- Event Handlers ---

    // VR: Selection
    const handleSelect = (e: any) => {
        if (!e.intersection) return;
        const { gx, gy, gz } = getGridFromPoint(e.intersection.point);
        onToggleCell(gx, gy, gz);
        
        const gamepad = e.controller?.inputSource?.gamepad;
        if (gamepad?.hapticActuators?.[0]) {
            gamepad.hapticActuators[0].pulse(0.8, 50);
        }
    };

    // VR: Hover
    const handleMove = (e: any) => {
        const id = e.controller.inputSource.handedness === 'right' ? 1 : 0;
        if (e.intersection) {
            setIntersections(prev => new Map(prev).set(id, e.intersection.point.clone()));
        } else {
            setIntersections(prev => {
                const next = new Map(prev);
                next.delete(id);
                return next;
            });
        }
    };

    const handleBlur = (e: any) => {
        const id = e.controller.inputSource.handedness === 'right' ? 1 : 0;
        setIntersections(prev => {
            const next = new Map(prev);
            next.delete(id);
            return next;
        });
    };

    // Desktop: Click
    const handlePointerDown = (e: any) => {
        e.stopPropagation(); 
        const { gx, gy, gz } = getGridFromPoint(e.point);
        onToggleCell(gx, gy, gz);
    };

    // Desktop: Hover
    const handlePointerMove = (e: any) => {
        e.stopPropagation();
        setDesktopCursor(e.point.clone());
    };

    const wallSize = WIDTH * SPACING;
    const halfSize = wallSize / 2;

    const PlaneMesh = (props: any) => (
        <mesh 
            {...props} 
            onPointerDown={!isPresenting ? handlePointerDown : undefined}
            onPointerMove={!isPresenting ? handlePointerMove : undefined}
            onPointerOut={() => setDesktopCursor(null)}
        >
            <planeGeometry args={[wallSize, wallSize]} />
            <meshBasicMaterial visible={false} />
        </mesh>
    );

    return (
        <group>
            {/* VR Beams and Targets */}
            {/* 
            {isPresenting && controllers.map((controller, i) => {
                const id = controller.inputSource?.handedness === 'right' ? 1 : 0;
                const point = intersections.get(id);
                return (
                    <React.Fragment key={i}>
                        
                        {controller.controller && createPortal(
                            <LaserBeam controller={controller} />,
                            controller.controller
                        )}
                        
                        {point && <TargetRing position={[point.x, point.y, point.z]} />}
                    </React.Fragment>
                );
            })} 
            */}

            {/* Desktop Cursor */}
            {!isPresenting && desktopCursor && (
                <TargetRing position={[desktopCursor.x, desktopCursor.y, desktopCursor.z]} />
            )}

            {!isPresenting && <OrbitControls makeDefault target={[0, 0, 0]} enablePan={false} minDistance={1} maxDistance={50} />}

            {/* Sensing Planes */}
            <Interactive onSelect={handleSelect} onMove={handleMove} onBlur={handleBlur}>
                <PlaneMesh position={[0, 0, halfSize]} rotation={[0, Math.PI, 0]} />
            </Interactive>
            <Interactive onSelect={handleSelect} onMove={handleMove} onBlur={handleBlur}>
                <PlaneMesh position={[0, 0, -halfSize]} rotation={[0, 0, 0]} />
            </Interactive>
            <Interactive onSelect={handleSelect} onMove={handleMove} onBlur={handleBlur}>
                <PlaneMesh position={[-halfSize, 0, 0]} rotation={[0, Math.PI / 2, 0]} />
            </Interactive>
            <Interactive onSelect={handleSelect} onMove={handleMove} onBlur={handleBlur}>
                <PlaneMesh position={[halfSize, 0, 0]} rotation={[0, -Math.PI / 2, 0]} />
            </Interactive>
            <Interactive onSelect={handleSelect} onMove={handleMove} onBlur={handleBlur}>
                <PlaneMesh position={[0, halfSize, 0]} rotation={[Math.PI / 2, 0, 0]} />
            </Interactive>
            <Interactive onSelect={handleSelect} onMove={handleMove} onBlur={handleBlur}>
                <PlaneMesh position={[0, -halfSize, 0]} rotation={[-Math.PI / 2, 0, 0]} />
            </Interactive>
        </group>
    );
};



// --- Components ---

const FaceInstancedMesh = ({ 
    grid, 
    colorMode, 
    faceNormal,
    faceFilter,
    fixedAxis,
    fixedValue
}: { 
    grid: Grid3DType, 
    colorMode: 'neon' | 'heat',
    faceNormal: THREE.Vector3,
    faceFilter: (x: number, y: number, z: number) => boolean,
    fixedAxis: 'x' | 'y' | 'z',
    fixedValue: number
}) => {
    const meshRef = useRef<THREE.InstancedMesh>(null);
    const dummy = useMemo(() => new THREE.Object3D(), []);
    const colorHelper = useMemo(() => new THREE.Color(), []);

    // Calculate max possible instances for this face (approx Width * Height)
    const instanceCount = TOTAL_CELLS; 

    useEffect(() => {
        if (!meshRef.current) return;
        
        const offset = (WIDTH - 1) / 2;
        let instanceIdx = 0;

        for (let i = 0; i < TOTAL_CELLS; i++) {
            const age = grid[i];
            if (age > 0) {
                const { x, y, z } = getCoords(i, WIDTH, HEIGHT);
                
                // Only render if this cell belongs to this face
                if (!faceFilter(x, y, z)) continue;

                // Position
                let px = (x - offset) * SPACING;
                let py = (y - offset) * SPACING;
                let pz = (z - offset) * SPACING;

                // PROJECT TO SURFACE
                // This ensures the cell is visually "on" the cube face, not floating inside at the grid center.
                if (fixedAxis === 'x') px = fixedValue;
                if (fixedAxis === 'y') py = fixedValue;
                if (fixedAxis === 'z') pz = fixedValue;

                dummy.position.set(px, py, pz);

                // Align Rotation: Face "up" is along the normal
                // We want the panel (XY plane usually) to face the normal.
                const up = new THREE.Vector3(0, 0, 1);
                dummy.quaternion.setFromUnitVectors(up, faceNormal);

                // Scale: Panel is flat.
                // 0.9 size, 0.05 thickness
                dummy.scale.set(0.9 * SPACING, 0.9 * SPACING, 0.05 * SPACING);
                dummy.updateMatrix();

                meshRef.current.setMatrixAt(instanceIdx, dummy.matrix);
                
                if (colorMode === 'neon') {
                     const hue = (x * 5 + y * 5 + z * 5 + age * 10) % 360;
                     colorHelper.setHSL(hue / 360, 1.0, 0.6); 
                } else {
                     const intensity = Math.min(age * 0.1, 1);
                     colorHelper.setHSL(0.1 - (intensity * 0.1), 1, 0.5 + (intensity * 0.4));
                }
                
                meshRef.current.setColorAt(instanceIdx, colorHelper);
                instanceIdx++;
            }
        }
        
        // Zero out remaining instances
        for (let j = instanceIdx; j < instanceCount; j++) {
            dummy.scale.set(0, 0, 0);
            dummy.updateMatrix();
            meshRef.current.setMatrixAt(j, dummy.matrix);
        }

        meshRef.current.instanceMatrix.needsUpdate = true;
        if (meshRef.current.instanceColor) meshRef.current.instanceColor.needsUpdate = true;
    }, [grid, colorMode, dummy, colorHelper, faceFilter, faceNormal, instanceCount, fixedAxis, fixedValue]);

    return (
        <instancedMesh ref={meshRef} args={[undefined, undefined, instanceCount]}>
            <boxGeometry args={[1, 1, 1]} />
            <meshStandardMaterial 
                transparent 
                opacity={0.9} 
                roughness={0.2} 
                metalness={0.1} 
                emissive={new THREE.Color(0x222222)} 
                emissiveIntensity={0.5}
            />
        </instancedMesh>
    );
};

const GridRenderingGroup = ({ grid, colorMode }: { grid: Grid3DType, colorMode: 'neon' | 'heat' }) => {
    // We render 6 faces. 
    // Cells on edges/corners will be picked up by multiple faces and rendered as multiple panels.
    
    // Normals
    const nRight = useMemo(() => new THREE.Vector3(1, 0, 0), []);
    const nLeft = useMemo(() => new THREE.Vector3(-1, 0, 0), []);
    const nTop = useMemo(() => new THREE.Vector3(0, 1, 0), []);
    const nBottom = useMemo(() => new THREE.Vector3(0, -1, 0), []);
    const nFront = useMemo(() => new THREE.Vector3(0, 0, 1), []);
    const nBack = useMemo(() => new THREE.Vector3(0, 0, -1), []);

    // Filters
    const fRight = useCallback((x: number, _y: number, _z: number) => x === WIDTH - 1, []);
    const fLeft = useCallback((x: number, _y: number, _z: number) => x === 0, []);
    const fTop = useCallback((_x: number, y: number, _z: number) => y === HEIGHT - 1, []);
    const fBottom = useCallback((_x: number, y: number, _z: number) => y === 0, []);
    const fFront = useCallback((_x: number, _y: number, z: number) => z === DEPTH - 1, []);
    const fBack = useCallback((_x: number, _y: number, z: number) => z === 0, []);

    // Wall Distance
    const wallDist = (WIDTH * SPACING) / 2; // 8.0

    return (
        <group>
            <FaceInstancedMesh grid={grid} colorMode={colorMode} faceNormal={nRight} faceFilter={fRight} fixedAxis="x" fixedValue={wallDist} />
            <FaceInstancedMesh grid={grid} colorMode={colorMode} faceNormal={nLeft} faceFilter={fLeft} fixedAxis="x" fixedValue={-wallDist} />
            <FaceInstancedMesh grid={grid} colorMode={colorMode} faceNormal={nTop} faceFilter={fTop} fixedAxis="y" fixedValue={wallDist} />
            <FaceInstancedMesh grid={grid} colorMode={colorMode} faceNormal={nBottom} faceFilter={fBottom} fixedAxis="y" fixedValue={-wallDist} />
            <FaceInstancedMesh grid={grid} colorMode={colorMode} faceNormal={nFront} faceFilter={fFront} fixedAxis="z" fixedValue={wallDist} />
            <FaceInstancedMesh grid={grid} colorMode={colorMode} faceNormal={nBack} faceFilter={fBack} fixedAxis="z" fixedValue={-wallDist} />
        </group>
    );
};



// --- Main Component ---



interface GameOfLife3DProps {

    enableUI?: boolean;

}



const GameOfLife3D: React.FC<GameOfLife3DProps> = ({ enableUI = true }) => {

        const [grid, setGrid] = useState<Grid3DType>(generateRandomGrid);

        const [running, setRunning] = useState(false);

        const [speed, setSpeed] = useState(150);

        const [selectedRule, setSelectedRule] = useState(RULE_SETS_3D[0]);

    

    const runningRef = useRef(running);

    runningRef.current = running;

    

    const speedRef = useRef(speed);

    speedRef.current = speed;



    const ruleRef = useRef(selectedRule);

    ruleRef.current = selectedRule;



    // Simulation Step (Shell Only)

        const runStep = useCallback(() => {

            setGrid((prevGrid) => {

                const nextGrid = new Uint8Array(TOTAL_CELLS);

                const { born, survive } = ruleRef.current;

    

                for (let x = 0; x < WIDTH; x++) {

                    for (let y = 0; y < HEIGHT; y++) {

                        for (let z = 0; z < DEPTH; z++) {

                            // Skip if inside the cube (not on shell)

                            if (!isShell(x, y, z, WIDTH, HEIGHT, DEPTH)) continue;

    

                            const idx = getIndex(x, y, z, WIDTH, HEIGHT);

                            const selfAlive = prevGrid[idx] > 0;

                            

                            let neighbors = 0;

                        

                                                // Check 26 neighbors in 3D space

                        

                                                for (let dx = -1; dx <= 1; dx++) {

                        

                                                    for (let dy = -1; dy <= 1; dy++) {

                        

                                                        for (let dz = -1; dz <= 1; dz++) {

                        

                                                            if (dx === 0 && dy === 0 && dz === 0) continue;

                        

                                                            

                        

                                                            // No Wrapping - Strict Bounds Checking

                        

                                                            // This prevents "action-at-a-distance" across the void

                        

                                                            const nx = x + dx;

                        

                                                            const ny = y + dy;

                        

                                                            const nz = z + dz;

                        

                        

                        

                                                            if (nx < 0 || nx >= WIDTH || 

                        

                                                                ny < 0 || ny >= HEIGHT || 

                        

                                                                nz < 0 || nz >= DEPTH) continue;

                        

                                                            

                        

                                                                                                                        // CRITICAL: Only count neighbors that are ALSO on the shell

                        

                                                            

                        

                                                                                    

                        

                                                            

                        

                                                                                                                        // This prevents growth into the void

                        

                                                            

                        

                                                                                    

                        

                                                            

                        

                                                                                                                        if (isShell(nx, ny, nz, WIDTH, HEIGHT, DEPTH) && prevGrid[getIndex(nx, ny, nz, WIDTH, HEIGHT)] > 0) {

                        

                                                            

                        

                                                                                    

                        

                                                            

                        

                                                                                                                            neighbors++;

                        

                                                            

                        

                                                                                    

                        

                                                            

                        

                                                                                                                        }

                        

                                                        }

                        

                                                    }

                        

                                                }



                        if (selfAlive) {

                            if (survive.includes(neighbors)) {

                                nextGrid[idx] = Math.min(prevGrid[idx] + 1, 255);

                            } else {

                                nextGrid[idx] = 0;

                            }

                        } else {

                            if (born.includes(neighbors)) {

                                nextGrid[idx] = 1;

                            }

                        }

                    }

                }

            }

            return nextGrid;

        });

    }, []);



    const runSimulation = useCallback(() => {

        if (!runningRef.current) return;

        runStep();

        setTimeout(runSimulation, speedRef.current);

    }, [runStep]);



    useEffect(() => {

        if (running) runSimulation();

    }, [running, runSimulation]);



    // Handlers

    const handleStartStop = () => setRunning(!running);

    const handleReset = () => {

        setRunning(false);

        setGrid(generateRandomGrid());

    };

    const handleClear = () => {

        setRunning(false);

        setGrid(generateEmptyGrid());

    };



    const handleToggleCell = useCallback((x: number, y: number, z: number) => {
        if (!isShell(x,y,z, WIDTH, HEIGHT, DEPTH)) return; // Prevent painting in void
        setGrid(prev => {
            const next = new Uint8Array(prev);
            const idx = getIndex(x, y, z, WIDTH, HEIGHT);
            next[idx] = next[idx] > 0 ? 0 : 1;
            return next;
        });
    }, []);

    const wallSize = WIDTH * SPACING;
    const halfSize = wallSize / 2;
    // We want the room floor to be at Y=0.
    // The GridRenderingGroup is centered at (0,0,0) by default.
    // If we move it up by halfSize, the bottom wall (y = -halfSize relative to group) will be at Y=0.
    const roomCenterY = halfSize;

    return (
        <div className="game-container immersive 3d-mode" style={{ position: 'relative', width: '100%', height: '100%' }}>
            <VRButton />
            <Canvas shadows dpr={[1, 2]}>
                <color attach="background" args={['#050505']} />
                <fog attach="fog" args={['#050505', 2, 20]} />
                
                <XR>
                    <PerspectiveCamera makeDefault position={[0, 1.6, 4]} fov={70} />
                    
                    <ambientLight intensity={0.6} />
                    <pointLight position={[0, roomCenterY, 0]} intensity={2} distance={20} decay={2} />
                    <pointLight position={[10, 10, 10]} intensity={1.5} color="#bd34fe" />
                    <pointLight position={[-10, -10, -10]} intensity={1.5} color="#61dafb" />
                    
                    <Controllers />
                    <Hands />
                    
                    <Suspense fallback={null}>
                        <VRLogger />
                    </Suspense>

                    {/* <Locomotion /> */}

                    <group position={[0, roomCenterY, 0]}>
                        <GridRenderingGroup grid={grid} colorMode="neon" />
                        <InteractionLayer onToggleCell={handleToggleCell} onTogglePause={handleStartStop} />
                    </group>
                </XR>
            </Canvas>

            {/* HUD */}

            {enableUI && (

                <div className="glass-hud-container" style={{ pointerEvents: 'none' }}>

                    <div className="glass-hud" style={{ pointerEvents: 'all' }}>

                        <div className="hud-group">

                            <div className="hud-divider"></div>

                            <button className="hud-btn primary" onClick={handleStartStop}>

                                {running ? 'PAUSE' : 'PLAY'}

                            </button>

                            <button className="hud-btn" onClick={runStep} disabled={running}>STEP</button>

                            <button className="hud-btn" onClick={handleReset}>RANDOM</button>

                            <button className="hud-btn" onClick={handleClear}>CLEAR</button>

                             <input 

                                type="range" 

                                min="10" max="1000" step="10"

                                value={speed} 

                                onChange={e => setSpeed(Number(e.target.value))}

                                style={{ width: '80px', marginLeft: '10px' }}

                                title={`Speed: ${speed}ms`}

                            />

                        </div>

                        <div className="hud-divider"></div>

                        <div className="hud-group">

                            <select 

                                className="hud-select"

                                value={selectedRule.name}

                                onChange={(e) => setSelectedRule(RULE_SETS_3D.find(r => r.name === e.target.value) || RULE_SETS_3D[0])}

                            >

                                {RULE_SETS_3D.map(r => <option key={r.name} value={r.name}>{r.name}</option>)}

                            </select>

                        </div>

                    </div>

                </div>

            )}

        </div>

    );

};



export default GameOfLife3D;
