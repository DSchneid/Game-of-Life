import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, PerspectiveCamera } from '@react-three/drei';
import * as THREE from 'three';

// --- Types ---
type Grid3DType = Uint8Array; // Flattened 3D array: x + y*WIDTH + z*WIDTH*HEIGHT

const WIDTH = 20;
const HEIGHT = 20;
const DEPTH = 20;
const TOTAL_CELLS = WIDTH * HEIGHT * DEPTH;

interface RuleSet3D {
  name: string;
  born: number[];
  survive: number[];
}

// 3D Life Rules
// Notation: Bx/Sy where x=neighbors to be born, y=neighbors to survive
const RULE_SETS_3D: RuleSet3D[] = [
    { name: '4555 (Standard 3D)', born: [4], survive: [5] },
    { name: '5766 (HighLife 3D)', born: [5, 6, 7], survive: [6] },
    { name: 'Clouds 13/13/13', born: [13,14,15,16,17,18,19], survive: [13] }, // Dense
    { name: 'Construction (B4/S4)', born: [4], survive: [4] },
];

const getIndex = (x: number, y: number, z: number) => x + y * WIDTH + z * WIDTH * HEIGHT;

const getCoords = (index: number) => {
    const z = Math.floor(index / (WIDTH * HEIGHT));
    const rem = index % (WIDTH * HEIGHT);
    const y = Math.floor(rem / WIDTH);
    const x = rem % WIDTH;
    return { x, y, z };
};

// --- Logic Helper ---

const generateEmptyGrid = (): Grid3DType => new Uint8Array(TOTAL_CELLS);

const generateRandomGrid = (): Grid3DType => {
    const grid = new Uint8Array(TOTAL_CELLS);
    for (let i = 0; i < TOTAL_CELLS; i++) {
        grid[i] = Math.random() > 0.85 ? 1 : 0; // Sparse random
    }
    return grid;
};

// --- Components ---

const CellInstancedMesh = ({ grid, colorMode }: { grid: Grid3DType, colorMode: 'neon' | 'heat' }) => {
    const meshRef = useRef<THREE.InstancedMesh>(null);
    const dummy = useMemo(() => new THREE.Object3D(), []);
    
    // Color Helpers
    const colorHelper = useMemo(() => new THREE.Color(), []);

    // Update instances
    useEffect(() => {
        if (!meshRef.current) return;
        
        for (let i = 0; i < TOTAL_CELLS; i++) {
            const age = grid[i];
            const { x, y, z } = getCoords(i);
            
            // Position centered
            dummy.position.set(
                x - WIDTH / 2,
                y - HEIGHT / 2,
                z - DEPTH / 2
            );

            // Scale based on state (0 = hidden/tiny)
            // To prevent massive overdraw, we scale 0 cells to 0
            if (age > 0) {
                dummy.scale.set(0.8, 0.8, 0.8);
                dummy.updateMatrix();
                meshRef.current.setMatrixAt(i, dummy.matrix);
                
                // Color Logic
                if (colorMode === 'neon') {
                     // HSL based on position or age? Let's do position for cool gradients
                     const hue = (x * 10 + y * 10 + z * 10) % 360;
                     colorHelper.setHSL(hue / 360, 1, 0.5);
                } else {
                     // Heat: White -> Red
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
                roughness={0.1} 
                metalness={0.1}
                emissive={new THREE.Color(0x222222)}
                emissiveIntensity={0.2}
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
    const [speed, setSpeed] = useState(200);
    const [selectedRule, setSelectedRule] = useState(RULE_SETS_3D[0]);
    
    const runningRef = useRef(running);
    runningRef.current = running;
    
    const speedRef = useRef(speed);
    speedRef.current = speed;

    const ruleRef = useRef(selectedRule);
    ruleRef.current = selectedRule;

    // Simulation Step
    const runStep = useCallback(() => {
        setGrid((prevGrid) => {
            const nextGrid = new Uint8Array(TOTAL_CELLS);
            const { born, survive } = ruleRef.current;

            // Neighbor Offsets (26)
            // Pre-calculate this ideally, but loops are fast enough for 8000 cells
            for (let x = 0; x < WIDTH; x++) {
                for (let y = 0; y < HEIGHT; y++) {
                    for (let z = 0; z < DEPTH; z++) {
                        const idx = getIndex(x, y, z);
                        const selfAlive = prevGrid[idx] > 0;
                        
                        let neighbors = 0;
                        
                        // Check 3x3x3 block around cell
                        for (let dx = -1; dx <= 1; dx++) {
                            for (let dy = -1; dy <= 1; dy++) {
                                for (let dz = -1; dz <= 1; dz++) {
                                    if (dx === 0 && dy === 0 && dz === 0) continue;
                                    
                                    // Wrap coordinates
                                    const nx = (x + dx + WIDTH) % WIDTH;
                                    const ny = (y + dy + HEIGHT) % HEIGHT;
                                    const nz = (z + dz + DEPTH) % DEPTH;
                                    
                                    if (prevGrid[getIndex(nx, ny, nz)] > 0) {
                                        neighbors++;
                                    }
                                }
                            }
                        }

                        if (selfAlive) {
                            if (survive.includes(neighbors)) {
                                nextGrid[idx] = Math.min(prevGrid[idx] + 1, 255); // Age
                            } else {
                                nextGrid[idx] = 0;
                            }
                        } else {
                            if (born.includes(neighbors)) {
                                nextGrid[idx] = 1; // Born
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
        if (running) {
            runSimulation();
        }
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

    return (
        <div className="game-container immersive 3d-mode" style={{ position: 'relative', width: '100%', height: '100%' }}>
            <Canvas shadows dpr={[1, 2]}>
                <PerspectiveCamera makeDefault position={[30, 30, 30]} fov={50} />
                <OrbitControls autoRotate={running} autoRotateSpeed={0.5} />
                
                <ambientLight intensity={0.5} />
                <pointLight position={[20, 20, 20]} intensity={1} />
                <pointLight position={[-20, -20, -20]} color="blue" intensity={1} />
                
                {/* Visualizer Helper */}
                <gridHelper args={[WIDTH, WIDTH]} position={[0, -HEIGHT/2 - 0.5, 0]} />
                <gridHelper args={[WIDTH, WIDTH]} position={[0, HEIGHT/2 + 0.5, 0]} />

                <CellInstancedMesh grid={grid} colorMode="neon" />
            </Canvas>

            {/* HUD */}
            {enableUI && (
                <div className="glass-hud-container" style={{ pointerEvents: 'none' }}>
                    <div className="glass-hud" style={{ pointerEvents: 'all' }}>
                        <div className="hud-group">
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
