import React, { useState, useCallback, useRef, useEffect, memo } from 'react';
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

const getCellColor = (age: number, colorMode: string) => {
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

const getCellShadow = (age: number, colorMode: string) => {
    if (age === 0) return 'none';
    if (colorMode === 'classic') return '0 0 2px #61dafb';
    if (colorMode === 'neon') {
       const hue = (180 + (age * 10)) % 360;
       return `0 0 8px hsl(${hue}, 100%, 50%)`;
    }
    return 'none';
};

// --- Memoized Cell Component ---

interface CellProps {
    age: number;
    row: number;
    col: number;
    colorMode: 'classic' | 'heat' | 'neon';
    showGridLines: boolean;
    onInteract: (r: number, c: number, type: 'down' | 'enter') => void;
}

const Cell = memo(({ age, row, col, colorMode, showGridLines, onInteract }: CellProps) => {
    return (
        <div
            className="cell"
            style={{
                width: 20,
                height: 20,
                backgroundColor: getCellColor(age, colorMode),
                boxShadow: getCellShadow(age, colorMode),
                border: showGridLines ? '1px solid rgba(255,255,255,0.1)' : '1px solid transparent',
                borderRadius: colorMode === 'neon' ? '20%' : '0'
            }}
            onMouseDown={() => onInteract(row, col, 'down')}
            onMouseEnter={() => onInteract(row, col, 'enter')}
        />
    );
}, (prev, next) => {
    return (
        prev.age === next.age &&
        prev.colorMode === next.colorMode &&
        prev.showGridLines === next.showGridLines
    );
});

Cell.displayName = 'MemoizedCell';


// --- Main Component ---

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
  const [showSettings, setShowSettings] = useState(false);

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
  
  const interactionModeRef = useRef(interactionMode);
  interactionModeRef.current = interactionMode;
  
  const selectedStampRef = useRef(selectedStamp);
  selectedStampRef.current = selectedStamp;
  
  const gridRef = useRef(grid);
  useEffect(() => { gridRef.current = grid; }, [grid]);

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

  // Update Life Energy CSS Variable
  useEffect(() => {
      let activeCount = 0;
      for (let i = 0; i < grid.length; i++) {
          for (let j = 0; j < grid[0].length; j++) {
              if (grid[i][j] > 0) activeCount++;
          }
      }
      const intensity = Math.min(activeCount / 500, 1); // Cap at 1
      document.documentElement.style.setProperty('--life-intensity', intensity.toString());
  }, [grid]);


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
      if (!historyRef.current[index]) return;
      const targetState = historyRef.current[index];
      const newHistory = historyRef.current.slice(0, index);
      historyRef.current = newHistory;
      setHistoryLength(newHistory.length);
      setGrid(targetState.map(row => [...row]));
      const diff = historyLength - index;
      setGeneration(g => Math.max(0, g - diff));
  };

  const handleRandomize = () => {
    addToHistory(grid);
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
      historyRef.current = []; 
      setHistoryLength(0);
      setNumRows(r);
      setNumCols(c);
      setGrid(generateEmptyGrid(r, c));
      setGeneration(0);
  };

  // --- Interaction Logic (Draw/Stamp) ---

  // We need a separate effect/ref for isMouseDown to be accessible inside the callback without re-creating it 
  // constantly if we want to avoid re-renders during drag?
  // To optimize: Use `useRef` for `isMouseDown` to avoid rebuilding callback.
  const isMouseDownRef = useRef(isMouseDown);
  useEffect(() => { isMouseDownRef.current = isMouseDown; }, [isMouseDown]);

  const handleCellInteract = useCallback((r: number, c: number, type: 'down' | 'enter') => {
      if (type === 'enter' && !isMouseDownRef.current) return;
      
      // Stamp logic needs grid access or simplified
      if (interactionModeRef.current === 'stamp') {
          if (type === 'down') {
             // Let's simplify: Stamp only on click, fine to re-create callback.
          }
      }
      
      if (type === 'down') {
          addToHistory(gridRef.current);
      }

      setGrid(prev => {
          const mode = interactionModeRef.current;
          if (type === 'enter' && mode === 'stamp') return prev; 
          
          const val = mode === 'draw' ? 1 : 0;
          if (prev[r][c] === val && mode !== 'stamp') return prev;

          const newGrid = prev.map(row => [...row]);
          
          if (mode === 'stamp' && type === 'down') {
             const pattern = PATTERNS[selectedStampRef.current];
             if (pattern) {
                pattern.forEach(([pr, pc]) => {
                    const targetR = (r + pr + prev.length) % prev.length;
                    const targetC = (c + pc + prev[0].length) % prev[0].length;
                    newGrid[targetR][targetC] = 1; 
                });
             }
          } else {
             newGrid[r][c] = val;
          }
          return newGrid;
      });

  }, []); // Dependencies empty! Uses Refs.

  return (
    <div className="game-container immersive">
      
      {/* Full Screen Grid */}
      <div 
        className="grid-surface"
        style={{
            display: 'grid',
            gridTemplateColumns: `repeat(${numCols}, 20px)`,
            width: '100%',
            height: '100%',
            justifyContent: 'center',
            alignContent: 'center',
        }}
        onMouseLeave={() => setIsMouseDown(false)}
      >
        {grid.map((rows, i) => 
            rows.map((age, k) => (
                <Cell
                    key={`${i}-${k}`}
                    row={i} 
                    col={k}
                    age={age}
                    colorMode={colorMode}
                    showGridLines={showGridLines}
                    onInteract={handleCellInteract}
                />
            ))
        )}
      </div>

      {/* Glass HUD Container */}
      <div className="glass-hud-container">
        
        {/* Timeline Slider */}
        {!running && historyLength > 0 && (
             <div className="hud-timeline">
                <input 
                     type="range"
                     min="0"
                     max={historyLength}
                     value={historyLength}
                     onChange={(e) => handleScrub(Number(e.target.value))}
                     title="Scrub History"
                 />
             </div>
        )}

        {/* Main Controls */}
        <div className="glass-hud">
          <div className="hud-group">
            <button className="hud-btn primary" onClick={handleStartStop}>
                {running ? 'PAUSE' : 'PLAY'}
            </button>
            <button className="hud-btn" onClick={handleNextStep} disabled={running}>STEP</button>
            <button className="hud-btn" onClick={handleUndo} disabled={running || historyLength === 0}>UNDO</button>
          </div>

          <div className="hud-divider"></div>

          <div className="hud-group">
              <button 
                className={`hud-btn ${interactionMode === 'draw' ? 'active' : ''}`}
                onClick={() => setInteractionMode('draw')}
              >
                  DRAW
              </button>
              <button 
                className={`hud-btn ${interactionMode === 'erase' ? 'active' : ''}`}
                onClick={() => setInteractionMode('erase')}
              >
                  ERASE
              </button>
              <button 
                className={`hud-btn ${interactionMode === 'stamp' ? 'active' : ''}`}
                onClick={() => setInteractionMode('stamp')}
              >
                  STAMP
              </button>
              {interactionMode === 'stamp' && (
                  <select 
                    className="hud-select"
                    value={selectedStamp}
                    onChange={(e) => setSelectedStamp(e.target.value)}
                  >
                     {Object.keys(PATTERNS).map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
              )}
          </div>

          <div className="hud-divider"></div>

          <div className="hud-group">
               <span className="hud-stat">GEN: {generation}</span>
               <button 
                  className={`hud-btn icon ${showSettings ? 'active' : ''}`} 
                  onClick={() => setShowSettings(!showSettings)}
                >
                   ⚙️
               </button>
          </div>
        </div>
      </div>

      {/* Settings Overlay */}
      {showSettings && (
          <div className="settings-panel glass-panel">
              <div className="settings-header">
                  <h3>Configuration</h3>
                  <button className="close-btn" onClick={() => setShowSettings(false)}>×</button>
              </div>
              
              <div className="setting-item">
                  <label>Ruleset & Preset</label>
                  <select 
                    value={selectedRule.name}
                    onChange={(e) => setSelectedRule(RULE_SETS.find(r => r.name === e.target.value) || RULE_SETS[0])}
                    style={{marginBottom: '0.5rem'}}
                  >
                      {RULE_SETS.map(r => <option key={r.name} value={r.name}>{r.name}</option>)}
                  </select>
                  <select onChange={(e) => handlePatternLoad(e.target.value)} defaultValue="">
                    <option value="" disabled>Load Pattern...</option>
                    {Object.keys(PATTERNS).map(name => (
                        <option key={name} value={name}>{name}</option>
                    ))}
                  </select>
              </div>

              <div className="setting-item">
                  <label>Speed ({speed}ms)</label>
                  <input 
                        type="range" min="10" max="500" step="10"
                        value={speed} onChange={e => setSpeed(Number(e.target.value))} 
                    />
              </div>

              <div className="setting-item">
                  <label>Grid Size</label>
                  <div className="row-gap">
                    <button onClick={() => handleSizeChange(20, 30)}>Small</button>
                    <button onClick={() => handleSizeChange(40, 50)}>Medium</button>
                    <button onClick={() => handleSizeChange(60, 80)}>Large</button>
                  </div>
              </div>

              <div className="setting-item">
                  <label>Visuals</label>
                  <div className="toggle-group" style={{marginBottom: '1rem'}}>
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
                  <label className="checkbox-row">
                    <input 
                        type="checkbox" 
                        checked={showGridLines} 
                        onChange={e => setShowGridLines(e.target.checked)} 
                    /> Show Grid Lines
                  </label>
              </div>

              <div className="setting-item">
                  <label>Audio</label>
                  <label className="checkbox-row" style={{marginBottom: '0.5rem'}}>
                    <input 
                        type="checkbox" 
                        checked={audioEnabled} 
                        onChange={e => setAudioEnabled(e.target.checked)} 
                    /> Enable Sonification
                  </label>
                  <div className="row-gap" style={{alignItems: 'center'}}>
                      <span style={{fontSize:'0.75rem', color:'#888'}}>Vol</span>
                      <input 
                        type="range" min="0" max="0.5" step="0.01"
                        value={volume} onChange={e => setVolume(Number(e.target.value))} 
                        style={{flex:1}}
                      />
                  </div>
                  <select 
                        value={waveform} 
                        onChange={(e) => setWaveform(e.target.value as OscillatorType)}
                        style={{marginTop: '0.5rem'}}
                    >
                        <option value="sine">Sine</option>
                        <option value="triangle">Triangle</option>
                        <option value="square">Square</option>
                        <option value="sawtooth">Saw</option>
                    </select>
              </div>

              <div className="setting-item actions">
                  <button onClick={handleRandomize}>Randomize</button>
                  <button onClick={handleClear} className="danger">Clear Board</button>
              </div>
          </div>
      )}
    </div>
  );
};

export default GameOfLife;