import React, { useState, useCallback, useRef, useEffect } from 'react';
import { soundEngine } from '../utils/SoundEngine';

// --- Types & Constants ---

type GridType = number[][];

interface RuleSet {
  name: string;
  born: number[];
  survive: number[];
}

const RULE_SETS: RuleSet[] = [
  { name: 'Conway (Standard)', born: [3], survive: [2, 3] },
  { name: 'HighLife', born: [3, 6], survive: [2, 3] },
  { name: 'Day & Night', born: [3, 6, 7, 8], survive: [3, 4, 6, 7, 8] },
  { name: 'Seeds', born: [2], survive: [] },
  { name: 'Life without Death', born: [3], survive: [0, 1, 2, 3, 4, 5, 6, 7, 8] },
];

const PATTERNS: Record<string, number[][]> = {
  'Glider': [[0, 1], [1, 2], [2, 0], [2, 1], [2, 2]],
  'Lightweight Spaceship': [
      [0, 1], [0, 4], 
      [1, 0], 
      [2, 0], [2, 4], 
      [3, 0], [3, 1], [3, 2], [3, 3]
  ],
  'Pulsar': [
    [2, 4], [2, 5], [2, 6], [2, 10], [2, 11], [2, 12],
    [4, 2], [4, 7], [4, 9], [4, 14],
    [5, 2], [5, 7], [5, 9], [5, 14],
    [6, 2], [6, 7], [6, 9], [6, 14],
    [7, 4], [7, 5], [7, 6], [7, 10], [7, 11], [7, 12],
    [9, 4], [9, 5], [9, 6], [9, 10], [9, 11], [9, 12],
    [10, 2], [10, 7], [10, 9], [10, 14],
    [11, 2], [11, 7], [11, 9], [11, 14],
    [12, 2], [12, 7], [12, 9], [12, 14],
    [14, 4], [14, 5], [14, 6], [14, 10], [14, 11], [14, 12]
  ],
  'Gosper Glider Gun': [
    [5, 1], [5, 2], [6, 1], [6, 2],
    [5, 11], [6, 11], [7, 11], [4, 12], [8, 12], [3, 13], [9, 13], [3, 14], [9, 14], [6, 15], [4, 16], [8, 16], [5, 17], [6, 17], [7, 17], [6, 18],
    [3, 21], [4, 21], [5, 21], [3, 22], [4, 22], [5, 22], [2, 23], [6, 23], [1, 25], [2, 25], [6, 25], [7, 25],
    [3, 35], [4, 35], [3, 36], [4, 36]
  ]
};

const OPERATIONS = [
  [0, 1], [0, -1], [1, -1], [-1, 1],
  [1, 1], [-1, -1], [1, 0], [-1, 0]
];

// --- Helper Functions ---

const generateEmptyGrid = (rows: number, cols: number): GridType => {
  return Array.from({ length: rows }, () => Array(cols).fill(0));
};

// --- Component ---

const GameOfLife: React.FC = () => {
  // --- State ---
  const [numRows, setNumRows] = useState(40);
  const [numCols, setNumCols] = useState(50);
  const [grid, setGrid] = useState<GridType>(() => generateEmptyGrid(40, 50));
  
  const [running, setRunning] = useState(false);
  const [generation, setGeneration] = useState(0);
  const [speed, setSpeed] = useState(100);
  
  const [selectedRule, setSelectedRule] = useState<RuleSet>(RULE_SETS[0]);
  const [colorMode, setColorMode] = useState<'classic' | 'heat' | 'neon'>('neon');
  const [showGridLines, setShowGridLines] = useState(true);

  // Interaction State
  const [interactionMode, setInteractionMode] = useState<'draw' | 'erase' | 'stamp'>('draw');
  const [selectedStamp, setSelectedStamp] = useState<string>('Glider');
  const [isMouseDown, setIsMouseDown] = useState(false);

  // Time Travel State
  const historyRef = useRef<GridType[]>([]);
  const [historyLength, setHistoryLength] = useState(0);

  // Audio State
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [volume, setVolume] = useState(0.1);
  const [waveform, setWaveform] = useState<OscillatorType>('sine');

  // --- Refs ---
  const runningRef = useRef(running);
  runningRef.current = running;

  const speedRef = useRef(speed);
  speedRef.current = speed;
  
  const ruleRef = useRef(selectedRule);
  ruleRef.current = selectedRule;

  // Sync audio settings
  useEffect(() => {
    soundEngine.setEnabled(audioEnabled);
  }, [audioEnabled]);

  useEffect(() => {
    soundEngine.setVolume(volume);
  }, [volume]);
  
  useEffect(() => {
    soundEngine.setWaveform(waveform);
  }, [waveform]);

  // Handle global mouse up to stop dragging anywhere
  useEffect(() => {
    const handleWindowMouseUp = () => setIsMouseDown(false);
    window.addEventListener('mouseup', handleWindowMouseUp);
    return () => window.removeEventListener('mouseup', handleWindowMouseUp);
  }, []);

  // --- Simulation Logic ---

  const addToHistory = (gridState: GridType) => {
      // Deep copy to store
      const stateCopy = gridState.map(row => [...row]);
      historyRef.current.push(stateCopy);
      if (historyRef.current.length > 100) {
          historyRef.current.shift();
      }
      setHistoryLength(historyRef.current.length);
  };

  const runStep = useCallback(() => {
    setGrid((g) => {
      // Save current state to history before evolving
      addToHistory(g);

      const rows = g.length;
      const cols = g[0].length;
      const newGrid = g.map(row => [...row]);
      
      const { born, survive } = ruleRef.current;
      
      let bornCount = 0;
      let bornRowSum = 0;

      for (let i = 0; i < rows; i++) {
        for (let k = 0; k < cols; k++) {
          let neighbors = 0;
          
          // Count neighbors (wrapping around edges for infinite feel)
          OPERATIONS.forEach(([x, y]) => {
            const newI = (i + x + rows) % rows;
            const newK = (k + y + cols) % cols;
            if (g[newI][newK] > 0) {
              neighbors += 1;
            }
          });

          const isAlive = g[i][k] > 0;
          
          if (isAlive) {
            if (!survive.includes(neighbors)) {
              newGrid[i][k] = 0; // Dies
            } else {
              newGrid[i][k] += 1; // Ages
            }
          } else {
            if (born.includes(neighbors)) {
              newGrid[i][k] = 1; // Born
              bornCount++;
              bornRowSum += i;
            }
          }
        }
      }

      // Trigger Sound if births occurred
      if (bornCount > 0) {
        const avgRow = bornRowSum / bornCount;
        soundEngine.playGenerationSound(bornCount, avgRow, rows);
      }

      return newGrid;
    });

    setGeneration((gen) => gen + 1);
  }, []);

  const runSimulation = useCallback(() => {
    if (!runningRef.current) return;
    runStep();
    setTimeout(runSimulation, speedRef.current);
  }, [runStep]);

  // --- Handlers ---

  const handleStartStop = () => {
    setRunning(!running);
    if (!running) {
      runningRef.current = true;
      runSimulation();
    }
  };

  const handleNextStep = () => {
      setRunning(false);
      runningRef.current = false;
      runStep();
  };

  const handleUndo = () => {
      setRunning(false);
      if (historyRef.current.length === 0) return;

      const previousState = historyRef.current.pop();
      if (previousState) {
          setGrid(previousState);
          setGeneration(g => Math.max(0, g - 1));
          setHistoryLength(historyRef.current.length);
      }
  };

  const handleScrub = (index: number) => {
      // Index 0 = oldest in history
      // Index length = current state
      // We are scrubbing *into* the history.
      // If we scrub, we are essentially "previewing" the past.
      // If we "Resume" from there, we need to decide if we fork or restore.
      // Simple Time Travel: Overwrite current grid with history[index] and truncate future.
      
      if (!historyRef.current[index]) return;
      
      const targetState = historyRef.current[index];
      // When we scrub to 'index', we lose everything AFTER 'index'.
      // This is destructive time travel.
      
      const newHistory = historyRef.current.slice(0, index);
      historyRef.current = newHistory;
      setHistoryLength(newHistory.length);
      
      setGrid(targetState.map(row => [...row]));
      // Adjust generation count roughly (we don't track gen number in history array, so this is an estimate or we just subtract)
      // For accuracy, we'd need to store [Grid, GenNumber] in history.
      // For now, let's just subtract the difference.
      const diff = historyLength - index;
      setGeneration(g => Math.max(0, g - diff));
  };

  const handleRandomize = () => {
    addToHistory(grid); // Save state before randomizing
    const newGrid = [];
    for (let i = 0; i < numRows; i++) {
      newGrid.push(Array.from(Array(numCols), () => (Math.random() > 0.75 ? 1 : 0)));
    }
    setGrid(newGrid);
    setGeneration(0);
  };

  const handleClear = () => {
    addToHistory(grid);
    setGrid(generateEmptyGrid(numRows, numCols));
    setGeneration(0);
    setRunning(false);
  };

  // Loads pattern in the center and clears grid (Classic "Load Preset")
  const handlePatternLoad = (patternName: string) => {
    setRunning(false);
    addToHistory(grid);
    const pattern = PATTERNS[patternName];
    if (!pattern || pattern.length === 0) return;

    const newGrid = generateEmptyGrid(numRows, numCols);
    const offsetX = Math.floor(numRows / 2);
    const offsetY = Math.floor(numCols / 2);

    pattern.forEach(([r, c]) => {
        const x = (r + offsetX + numRows) % numRows;
        const y = (c + offsetY + numCols) % numCols;
        newGrid[x][y] = 1;
    });

    setGrid(newGrid);
    setGeneration(0);
  };

  const handleSizeChange = (r: number, c: number) => {
      setRunning(false);
      historyRef.current = []; // Clear history on size change to avoid mismatch errors
      setHistoryLength(0);
      setNumRows(r);
      setNumCols(c);
      setGrid(generateEmptyGrid(r, c));
      setGeneration(0);
  };

  // --- Interaction Logic (Draw/Stamp) ---

  const placeStamp = (startR: number, startC: number, patternKey: string) => {
      const pattern = PATTERNS[patternKey];
      if (!pattern) return;
      
      // Save for Undo
      addToHistory(grid);

      setGrid(prev => {
          const newGrid = prev.map(row => [...row]);
          pattern.forEach(([r, c]) => {
              const targetR = (startR + r + prev.length) % prev.length;
              const targetC = (startC + c + prev[0].length) % prev[0].length;
              newGrid[targetR][targetC] = 1; // Force alive
          });
          return newGrid;
      });
  };

  const onCellInteraction = (r: number, c: number, type: 'down' | 'enter') => {
      // 1. Mouse Down Event
      if (type === 'down') {
          setIsMouseDown(true);
          
          if (interactionMode === 'stamp') {
              placeStamp(r, c, selectedStamp);
              return;
          }
          
          addToHistory(grid); // Save before drawing stroke

          // Draw/Erase single click
          setGrid(prev => {
              const newGrid = prev.map(row => [...row]);
              newGrid[r][c] = interactionMode === 'draw' ? 1 : 0;
              return newGrid;
          });
      }
      
      // 2. Mouse Enter (Drag) Event
      else if (type === 'enter' && isMouseDown) {
          if (interactionMode === 'stamp') return; // Don't drag-stamp, too chaotic

          setGrid(prev => {
            // Optimization: Only update if changed
            if (prev[r][c] === (interactionMode === 'draw' ? 1 : 0)) return prev;

            const newGrid = prev.map(row => [...row]);
            newGrid[r][c] = interactionMode === 'draw' ? 1 : 0;
            return newGrid;
        });
      }
  };


  // --- Rendering Helpers ---

  const getCellColor = (age: number) => {
      if (age === 0) return 'transparent';
      
      if (colorMode === 'classic') return '#61dafb';
      
      if (colorMode === 'heat') {
          if (age === 1) return '#ffffff';
          if (age < 5) return '#ffaa00';
          if (age < 15) return '#ff5500';
          return '#8800ff';
      }

      if (colorMode === 'neon') {
          const hue = (180 + (age * 10)) % 360;
          return `hsl(${hue}, 100%, 60%)`;
      }
      return '#fff';
  };

  const getCellShadow = (age: number) => {
      if (age === 0) return 'none';
      if (colorMode === 'classic') return '0 0 2px #61dafb';
      if (colorMode === 'neon') {
         const hue = (180 + (age * 10)) % 360;
         return `0 0 8px hsl(${hue}, 100%, 50%)`;
      }
      return 'none';
  };

  return (
    <div className="game-container">
      <h1 className="title">Game of Life <span>{selectedRule.name}</span></h1>
      
      <div className="main-layout">
        
        {/* Left Sidebar: Controls */}
        <div className="sidebar">
            
            {/* TOOLBOX */}
            <div className="control-group">
                <h3>Tools</h3>
                <div className="button-row" style={{marginBottom: '0.5rem'}}>
                    <button 
                        className={interactionMode === 'draw' ? 'active toggle-btn' : 'toggle-btn'} 
                        onClick={() => setInteractionMode('draw')}
                        style={{border: '1px solid #444'}}
                    >
                        Draw ✏️
                    </button>
                    <button 
                        className={interactionMode === 'erase' ? 'active toggle-btn' : 'toggle-btn'} 
                        onClick={() => setInteractionMode('erase')}
                        style={{border: '1px solid #444'}}
                    >
                        Erase 🧹
                    </button>
                    <button 
                        className={interactionMode === 'stamp' ? 'active toggle-btn' : 'toggle-btn'} 
                        onClick={() => setInteractionMode('stamp')}
                        style={{border: '1px solid #444'}}
                    >
                        Stamp ♟️
                    </button>
                </div>
                {interactionMode === 'stamp' && (
                    <select 
                        value={selectedStamp} 
                        onChange={(e) => setSelectedStamp(e.target.value)}
                    >
                        {Object.keys(PATTERNS).map(name => (
                            <option key={name} value={name}>{name}</option>
                        ))}
                    </select>
                )}
            </div>

            <div className="control-group">
                <h3>Simulation</h3>
                <div className="button-row">
                    <button 
                        onClick={handleStartStop} 
                        className={running ? 'btn-stop' : 'btn-start'}
                    >
                        {running ? 'PAUSE' : 'PLAY'}
                    </button>
                    <button 
                        onClick={handleUndo} 
                        disabled={running || historyLength === 0}
                        style={{ opacity: (running || historyLength === 0) ? 0.5 : 1 }}
                    >
                        Undo ⏪
                    </button>
                </div>
                
                {/* Time Travel Slider */}
                {!running && historyLength > 0 && (
                     <div style={{marginTop: '10px'}}>
                        <label style={{textAlign:'center', color: '#61dafb'}}>
                             Time Travel
                        </label>
                        <input 
                             type="range"
                             min="0"
                             max={historyLength}
                             value={historyLength}
                             onChange={(e) => handleScrub(Number(e.target.value))}
                             style={{width: '100%', direction: 'ltr'}}
                         />
                         <div style={{fontSize: '0.8rem', color: '#666', textAlign: 'center'}}>
                             Scrub to rewind
                         </div>
                     </div>
                )}
                
                <div className="button-row" style={{marginTop: '10px'}}>
                     <button onClick={handleNextStep}>Next Step ⏭️</button>
                    <button onClick={handleRandomize}>Random</button>
                    <button onClick={handleClear} className="btn-danger">Clear</button>
                </div>
            </div>

            <div className="control-group">
                <h3>Audio</h3>
                <label className="checkbox-label">
                    <input 
                        type="checkbox" 
                        checked={audioEnabled} 
                        onChange={e => setAudioEnabled(e.target.checked)} 
                    />
                    Enable Sound
                </label>
                <label>
                    Volume
                    <input 
                        type="range" min="0" max="0.5" step="0.01"
                        value={volume} onChange={e => setVolume(Number(e.target.value))} 
                    />
                </label>
                <label>
                    Waveform
                    <select 
                        value={waveform} 
                        onChange={(e) => setWaveform(e.target.value as OscillatorType)}
                        style={{marginBottom:0, marginTop: '5px'}}
                    >
                        <option value="sine">Sine</option>
                        <option value="triangle">Triangle</option>
                        <option value="square">Square</option>
                        <option value="sawtooth">Saw</option>
                    </select>
                </label>
            </div>

            <div className="control-group">
                <h3>Settings</h3>
                <label>
                    Speed ({speed}ms)
                    <input 
                        type="range" min="10" max="500" step="10"
                        value={speed} onChange={e => setSpeed(Number(e.target.value))} 
                    />
                </label>
                <label>
                    Grid Size ({numRows}x{numCols})
                    <input 
                        type="range" min="20" max="80" 
                        value={numRows} onChange={e => handleSizeChange(Number(e.target.value), Number(e.target.value))} 
                    />
                </label>
                <label className="checkbox-label">
                    <input 
                        type="checkbox" 
                        checked={showGridLines} 
                        onChange={e => setShowGridLines(e.target.checked)} 
                    />
                    Show Grid Lines
                </label>
            </div>

            <div className="control-group">
                <h3>Visuals</h3>
                <div className="toggle-group">
                    {['classic', 'heat', 'neon'].map(mode => (
                        <button 
                            key={mode}
                            className={`toggle-btn ${colorMode === mode ? 'active' : ''}`}
                            onClick={() => setColorMode(mode as any)}
                        >
                            {mode}
                        </button>
                    ))}
                </div>
            </div>

            {/* Presets/Rules (Moved to bottom) */}
            <div className="control-group">
                <h3>Rules & Load</h3>
                <select 
                    value={selectedRule.name}
                    onChange={(e) => setSelectedRule(RULE_SETS.find(r => r.name === e.target.value) || RULE_SETS[0])}
                >
                    {RULE_SETS.map(r => <option key={r.name} value={r.name}>{r.name}</option>)}
                </select>

                <select onChange={(e) => handlePatternLoad(e.target.value)} defaultValue="">
                    <option value="" disabled>Load Preset (Clears Board)...</option>
                    {Object.keys(PATTERNS).map(name => (
                        <option key={name} value={name}>{name}</option>
                    ))}
                </select>
            </div>
            
            <div className="stats">
                <div>Gen: <span>{generation}</span></div>
            </div>
        </div>

        {/* Right Side: Grid */}
        <div className="grid-wrapper">
            <div 
                className="grid"
                style={{
                    display: 'grid',
                    gridTemplateColumns: `repeat(${numCols}, 20px)`,
                    // Prevent default drag behavior to allow our custom painting
                    userSelect: 'none'
                }}
                onMouseLeave={() => setIsMouseDown(false)}
            >
                {grid.map((rows, i) => 
                    rows.map((age, k) => (
                        <div
                            key={`${i}-${k}`}
                            className="cell"
                            style={{
                                width: 20,
                                height: 20,
                                backgroundColor: getCellColor(age),
                                boxShadow: getCellShadow(age),
                                border: showGridLines ? '1px solid #333' : '1px solid transparent',
                                borderRadius: colorMode === 'neon' ? '20%' : '0'
                            }}
                            onMouseDown={() => onCellInteraction(i, k, 'down')}
                            onMouseEnter={() => onCellInteraction(i, k, 'enter')}
                        />
                    ))
                )}
            </div>
        </div>

      </div>
    </div>
  );
};

export default GameOfLife;
