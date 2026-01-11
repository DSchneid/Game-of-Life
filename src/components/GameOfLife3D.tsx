import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { PerspectiveCamera, OrbitControls } from '@react-three/drei';
import { VRButton, XR, Controllers, Hands, Interactive, useXR } from '@react-three/xr';
import * as THREE from 'three';

// --- Types ---
type Grid3DType = Uint8Array; 

const WIDTH = 32;
const HEIGHT = 32;
const DEPTH = 32;
const TOTAL_CELLS = WIDTH * HEIGHT * DEPTH;
const SPACING = 0.5;

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

const getIndex = (x: number, y: number, z: number) => x + y * WIDTH + z * WIDTH * HEIGHT;

const getCoords = (index: number) => {
    const z = Math.floor(index / (WIDTH * HEIGHT));
    const rem = index % (WIDTH * HEIGHT);
    const y = Math.floor(rem / WIDTH);
    const x = rem % WIDTH;
    return { x, y, z };
};

// Helper to check if a coordinate is on the "Shell" (Faces of the cube)
const isShell = (x: number, y: number, z: number) => {
    return x === 0 || x === WIDTH - 1 || y === 0 || y === HEIGHT - 1 || z === 0 || z === DEPTH - 1;
};

// --- Logic Helpers ---

const generateEmptyGrid = (): Grid3DType => new Uint8Array(TOTAL_CELLS);

const generateRandomGrid = (): Grid3DType => {
    const grid = new Uint8Array(TOTAL_CELLS);
    for (let x = 0; x < WIDTH; x++) {
        for (let y = 0; y < HEIGHT; y++) {
            for (let z = 0; z < DEPTH; z++) {
                if (isShell(x, y, z)) {
                    const idx = getIndex(x, y, z);
                    grid[idx] = Math.random() > 0.75 ? 1 : 0;
                }
            }
        }
    }
    return grid;
};

// --- VR / Desktop Interaction Components ---



const InteractionLayer = ({ onToggleCell, onTogglePause }: { 

    onToggleCell: (x: number, y: number, z: number) => void,

    onTogglePause: () => void 

}) => {

    const { controllers, isPresenting } = useXR();

    const lastAButtonPressed = useRef(false);

    const [cursorPos, setCursorPos] = useState<[number, number, number] | null>(null);



    // --- XR Controller Logic ---

    useFrame(() => {

        const rightController = controllers.find(c => c.inputSource.handedness === 'right');

        if (rightController?.inputSource.gamepad) {

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



    const updateCursor = (point: THREE.Vector3) => {

        const { gx, gy, gz } = getGridFromPoint(point);

        const offset = (WIDTH - 1) / 2;

        const wx = (gx - offset) * SPACING;

        const wy = (gy - offset) * SPACING;

        const wz = (gz - offset) * SPACING;

        setCursorPos([wx, wy, wz]);

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

        if (e.intersection) updateCursor(e.intersection.point);

        else setCursorPos(null);

    };



    // Desktop: Click

    const handlePointerDown = (e: any) => {

        // Prevent interaction if we are just rotating the camera

        // (OrbitControls handles drag, but click might fire. We usually check delta, but simple is ok for now)

        e.stopPropagation(); 

        const { gx, gy, gz } = getGridFromPoint(e.point);

        onToggleCell(gx, gy, gz);

    };



    // Desktop: Hover

    const handlePointerMove = (e: any) => {

        e.stopPropagation();

        updateCursor(e.point);

    };



    const wallSize = WIDTH * SPACING;

    const halfSize = wallSize / 2;



    // We use standard <mesh> events for Desktop and <Interactive> for VR

    const PlaneMesh = (props: any) => (

        <mesh 

            {...props} 

            onPointerDown={!isPresenting ? handlePointerDown : undefined}

            onPointerMove={!isPresenting ? handlePointerMove : undefined}

            onPointerOut={() => setCursorPos(null)}

        >

            <planeGeometry args={[wallSize, wallSize]} />

            <meshBasicMaterial visible={false} />

        </mesh>

    );



    return (

        <group>

            {/* Visual Cursor */}

            {cursorPos && (

                <mesh position={cursorPos}>

                    <boxGeometry args={[SPACING * 1.1, SPACING * 1.1, SPACING * 1.1]} />

                    <meshBasicMaterial color="#ffff00" wireframe transparent opacity={0.5} />

                </mesh>

            )}



            {/* Desktop Orbit Controls (Only active if not in VR) */}

            {!isPresenting && <OrbitControls makeDefault enablePan={false} minDistance={1} maxDistance={50} />}



            {/* Sensing Planes */}

            <Interactive onSelect={handleSelect} onMove={handleMove}>

                <PlaneMesh position={[0, 0, halfSize]} rotation={[0, Math.PI, 0]} />

            </Interactive>

            <Interactive onSelect={handleSelect} onMove={handleMove}>

                <PlaneMesh position={[0, 0, -halfSize]} rotation={[0, 0, 0]} />

            </Interactive>

            <Interactive onSelect={handleSelect} onMove={handleMove}>

                <PlaneMesh position={[-halfSize, 0, 0]} rotation={[0, Math.PI / 2, 0]} />

            </Interactive>

            <Interactive onSelect={handleSelect} onMove={handleMove}>

                <PlaneMesh position={[halfSize, 0, 0]} rotation={[0, -Math.PI / 2, 0]} />

            </Interactive>

            <Interactive onSelect={handleSelect} onMove={handleMove}>

                <PlaneMesh position={[0, halfSize, 0]} rotation={[Math.PI / 2, 0, 0]} />

            </Interactive>

            <Interactive onSelect={handleSelect} onMove={handleMove}>

                <PlaneMesh position={[0, -halfSize, 0]} rotation={[-Math.PI / 2, 0, 0]} />

            </Interactive>

        </group>

    );

};



// --- Components ---



const CellInstancedMesh = ({ grid, colorMode }: { grid: Grid3DType, colorMode: 'neon' | 'heat' }) => {

    const meshRef = useRef<THREE.InstancedMesh>(null);

    const dummy = useMemo(() => new THREE.Object3D(), []);

    const colorHelper = useMemo(() => new THREE.Color(), []);



    useEffect(() => {

        if (!meshRef.current) return;

        

        // Centering Offset

        const offset = (WIDTH - 1) / 2;



        for (let i = 0; i < TOTAL_CELLS; i++) {

            const age = grid[i];

            if (age > 0) {

                const { x, y, z } = getCoords(i);

                

                // New Centered Positioning

                dummy.position.set(

                    (x - offset) * SPACING,

                    (y - offset) * SPACING,

                    (z - offset) * SPACING

                );



                // Flatten the cells based on which wall they are on to look like 2D panels

                let sx = 0.9, sy = 0.9, sz = 0.9;

                if (x === 0 || x === WIDTH - 1) sx = 0.05;

                if (y === 0 || y === HEIGHT - 1) sy = 0.05;

                if (z === 0 || z === DEPTH - 1) sz = 0.05;



                dummy.scale.set(sx * SPACING, sy * SPACING, sz * SPACING);

                dummy.updateMatrix();

                meshRef.current.setMatrixAt(i, dummy.matrix);

                

                if (colorMode === 'neon') {

                     const hue = (x * 5 + y * 5 + z * 5 + age * 10) % 360;

                     colorHelper.setHSL(hue / 360, 1.0, 0.6); 

                } else {

                     const intensity = Math.min(age * 0.1, 1);

                     colorHelper.setHSL(0.1 - (intensity * 0.1), 1, 0.5 + (intensity * 0.4));

                }

                

                meshRef.current.setColorAt(i, colorHelper);

            } else {

                dummy.scale.set(0, 0, 0);

                dummy.updateMatrix();

                meshRef.current.setMatrixAt(i, dummy.matrix);

            }

        }

        

        meshRef.current.instanceMatrix.needsUpdate = true;

        if (meshRef.current.instanceColor) meshRef.current.instanceColor.needsUpdate = true;

    }, [grid, colorMode, dummy, colorHelper]);



    return (

        <instancedMesh ref={meshRef} args={[undefined, undefined, TOTAL_CELLS]}>

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



// --- Main Component ---



interface GameOfLife3DProps {

    enableUI?: boolean;

}



const GameOfLife3D: React.FC<GameOfLife3DProps> = ({ enableUI = true }) => {

    const [grid, setGrid] = useState<Grid3DType>(generateRandomGrid);

    const [running, setRunning] = useState(false);

    const [speed, setSpeed] = useState(100);

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

                        if (!isShell(x, y, z)) continue;



                        const idx = getIndex(x, y, z);

                        const selfAlive = prevGrid[idx] > 0;

                        

                        let neighbors = 0;

                        

                        // Check 26 neighbors in 3D space

                        for (let dx = -1; dx <= 1; dx++) {

                            for (let dy = -1; dy <= 1; dy++) {

                                for (let dz = -1; dz <= 1; dz++) {

                                    if (dx === 0 && dy === 0 && dz === 0) continue;

                                    

                                    const nx = (x + dx + WIDTH) % WIDTH;

                                    const ny = (y + dy + HEIGHT) % HEIGHT;

                                    const nz = (z + dz + DEPTH) % DEPTH;

                                    

                                    // CRITICAL: Only count neighbors that are ALSO on the shell

                                    // This prevents growth into the void

                                    if (isShell(nx, ny, nz) && prevGrid[getIndex(nx, ny, nz)] > 0) {

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

        if (!isShell(x,y,z)) return; // Prevent painting in void

        setGrid(prev => {

            const next = new Uint8Array(prev);

            const idx = getIndex(x, y, z);

            next[idx] = next[idx] > 0 ? 0 : 1;

            return next;

        });

    }, []);



    return (

        <div className="game-container immersive 3d-mode" style={{ position: 'relative', width: '100%', height: '100%' }}>

            <VRButton />

            <Canvas shadows dpr={[1, 2]}>

                <color attach="background" args={['#050505']} />

                <fog attach="fog" args={['#050505', 10, 50]} />

                

                <XR>

                    <PerspectiveCamera makeDefault position={[0, 0, 0]} fov={70} />

                    

                    <ambientLight intensity={0.6} />

                    <pointLight position={[0, 0, 0]} intensity={2} distance={20} decay={2} />

                    <pointLight position={[10, 10, 10]} intensity={1.5} color="#bd34fe" />

                    <pointLight position={[-10, -10, -10]} intensity={1.5} color="#61dafb" />

                    

                    <Controllers />

                    <Hands />



                    <group position={[0, 0, 0]}>

                        <CellInstancedMesh grid={grid} colorMode="neon" />

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
