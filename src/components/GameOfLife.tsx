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

const getCellColor = (age: number, colorMode: string) => {
    if (age === 0) return 'transparent';
    
    if (colorMode === 'classic') return '#61dafb';
    
    // Phosphor / Heat Mode (White Hot -> Cool Red)
    if (colorMode === 'heat') {
        if (age === 1) return '#ffffff'; // White hot birth
        if (age === 2) return '#fff700'; // Yellow
        if (age < 5)   return '#ff8800'; // Orange
        return '#ff0044'; // Red ember
    }

    // Neon Mode (Classic HSL Hue cycling based on age)
    if (colorMode === 'neon') {
        const hue = (180 + (age * 10)) % 360;
        return `hsl(${hue}, 100%, 60%)`;
    }
    return '#fff';
};

// Returns { blur: number, color: string } or null
const getCellShadow = (age: number, colorMode: string) => {
    if (age === 0) return null;
    
    if (colorMode === 'classic') return { blur: 2, color: '#61dafb' };
    
    const color = getCellColor(age, colorMode);
    
    // Dynamic glow intensity based on age (Newborn = brighter)
    const blur = age === 1 ? 15 : 6;
    
    if (colorMode === 'neon') {
       const hue = (180 + (age * 10)) % 360;
       return { blur, color: `hsl(${hue}, 100%, 50%)` };
    }
    if (colorMode === 'heat') {
       return { blur, color };
    }
    return null;
};


// --- Main Component ---

interface GameOfLifeProps {
    enableUI?: boolean;
}

const getCellSize = () => window.innerWidth < 768 ? 12 : 20;

const calculateGridDimensions = () => {
    const cellSize = getCellSize();
    const cols = Math.floor(window.innerWidth / cellSize);
    const rows = Math.floor(window.innerHeight / cellSize);
    return { rows, cols };
};

const GameOfLife: React.FC<GameOfLifeProps> = ({ enableUI = true }) => {
  // --- State ---
  const [numRows, setNumRows] = useState(() => calculateGridDimensions().rows);
  const [numCols, setNumCols] = useState(() => calculateGridDimensions().cols);
  
  // Use Ref for Grid State to avoid React Render Cycle Overhead
  const gridRef = useRef<GridType>([]);
  
  // Initialize grid ref if empty
  if (gridRef.current.length === 0) {
      const dim = calculateGridDimensions();
      gridRef.current = generateEmptyGrid(dim.rows, dim.cols);
  }

  // UI Visibility State
  const [isUiVisible, setIsUiVisible] = useState(true);
  
  const [running, setRunning] = useState(false);
  const [generation, setGeneration] = useState(0);
  const [speed, setSpeed] = useState(100);
  
  const [selectedRule, setSelectedRule] = useState<RuleSet>(RULE_SETS[0]);
  const [colorMode, setColorMode] = useState<'classic' | 'heat' | 'neon'>('neon');
  const [showGridLines, setShowGridLines] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  // Interaction State
  const [interactionMode, setInteractionMode] = useState<'draw' | 'erase' | 'stamp'>('draw');
  const [selectedStamp, setSelectedStamp] = useState<string>('Glider');
  const [isMouseDown, setIsMouseDown] = useState(false);

  // Time Travel State
  const historyRef = useRef<GridType[]>([]);
  const [historyLength, setHistoryLength] = useState(0);
  const [playbackIndex, setPlaybackIndex] = useState<number | null>(null);

  // Audio State
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [volume, setVolume] = useState(0.1);
  const [waveform, setWaveform] = useState<OscillatorType>('sine');

  // --- Refs ---
  const runningRef = useRef(running);
  runningRef.current = running;
  
  const playbackIndexRef = useRef(playbackIndex);
  playbackIndexRef.current = playbackIndex;

  const speedRef = useRef(speed);
  speedRef.current = speed;
  
  const ruleRef = useRef(selectedRule);
  ruleRef.current = selectedRule;
  
  const interactionModeRef = useRef(interactionMode);
  interactionModeRef.current = interactionMode;
  
  const selectedStampRef = useRef(selectedStamp);
  selectedStampRef.current = selectedStamp;
  
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const requestRef = useRef<number>();
  const lastUpdateRef = useRef<number>(0);

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

  // --- Rendering Logic (Canvas) ---
  
  const draw = useCallback(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
  
      const dpr = window.devicePixelRatio || 1;
      const cellSize = getCellSize();
      const width = numCols * cellSize;
      const height = numRows * cellSize;
      
      // Update canvas size if needed
      if (canvas.width !== width * dpr || canvas.height !== height * dpr) {
          canvas.width = width * dpr;
          canvas.height = height * dpr;
          // IMPORTANT: Scale must be reset after resize
          ctx.scale(dpr, dpr);
      } else {
          // If not resized, we need to clear and ensure scale is correct
          ctx.setTransform(1, 0, 0, 1, 0, 0); // Reset transform
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          ctx.scale(dpr, dpr);
      }
      
      const grid = gridRef.current;
      const effectiveGridLines = showGridLines && !runningRef.current;

      // Draw Loop
      let activeCount = 0;
  
      for(let r = 0; r < numRows; r++) {
          for(let c = 0; c < numCols; c++) {
              const age = grid[r][c];
              const x = c * cellSize;
              const y = r * cellSize;

              // Grid Lines
              if (effectiveGridLines) {
                  ctx.strokeStyle = 'rgba(255,255,255,0.05)';
                  ctx.lineWidth = 1;
                  ctx.strokeRect(x, y, cellSize, cellSize);
              }

              if (age > 0) {
                  activeCount++;
                  const color = getCellColor(age, colorMode);
                  const shadow = getCellShadow(age, colorMode);
                  
                  ctx.save();
                  if (shadow) {
                      ctx.shadowBlur = shadow.blur;
                      ctx.shadowColor = shadow.color;
                  }
                  
                  ctx.fillStyle = color;
                  
                  if (colorMode === 'neon') {
                      // Rounded rect approximation
                      const radius = 2;
                      ctx.beginPath();
                      ctx.moveTo(x + radius, y);
                      ctx.lineTo(x + cellSize - radius, y);
                      ctx.quadraticCurveTo(x + cellSize, y, x + cellSize, y + radius);
                      ctx.lineTo(x + cellSize, y + cellSize - radius);
                      ctx.quadraticCurveTo(x + cellSize, y + cellSize, x + cellSize - radius, y + cellSize);
                      ctx.lineTo(x + radius, y + cellSize);
                      ctx.quadraticCurveTo(x, y + cellSize, x, y + cellSize - radius);
                      ctx.lineTo(x, y + radius);
                      ctx.quadraticCurveTo(x, y, x + radius, y);
                      ctx.closePath();
                      ctx.fill();
                  } else {
                      ctx.fillRect(x, y, cellSize, cellSize);
                  }
                  ctx.restore();
              }
          }
      }

      // Update CSS Variable
      const intensity = Math.min(activeCount / 500, 1); 
      document.documentElement.style.setProperty('--life-intensity', intensity.toString());

  }, [numRows, numCols, colorMode, showGridLines]);

  // --- Simulation Logic ---

  const addToHistory = (gridState: GridType) => {
      if (playbackIndexRef.current !== null) {
          historyRef.current = historyRef.current.slice(0, playbackIndexRef.current);
          setPlaybackIndex(null); 
      }

      const stateCopy = gridState.map(row => [...row]);
      historyRef.current.push(stateCopy);
      if (historyRef.current.length > 100) {
          historyRef.current.shift();
      }
      setHistoryLength(historyRef.current.length);
  };

  const runStep = useCallback(() => {
      const g = gridRef.current;
      if (!g || g.length === 0) return;

      // History
      addToHistory(g);

      const rows = g.length;
      const cols = g[0].length;
      // Double buffer
      const newGrid = g.map(row => [...row]);
      
      const { born, survive } = ruleRef.current;
      
      let bornCount = 0;
      let bornRowSum = 0;

      for (let i = 0; i < rows; i++) {
        for (let k = 0; k < cols; k++) {
          let neighbors = 0;
          
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
              newGrid[i][k] = 0; 
            } else {
              newGrid[i][k] += 1; 
            }
          } else {
            if (born.includes(neighbors)) {
              newGrid[i][k] = 1; 
              bornCount++;
              bornRowSum += i;
            }
          }
        }
      }

      // Update Ref
      gridRef.current = newGrid;

      // Audio
      if (bornCount > 0) {
        const avgRow = bornRowSum / bornCount;
        soundEngine.playGenerationSound(bornCount, avgRow, rows);
      }
      
      // Update Gen Counter (State - triggers render)
      // To prevent UI lag on high speed, we could debounce this, but React 18 batching helps.
      setGeneration((gen) => gen + 1);

      // Draw
      draw();

  }, [draw]);


  // Game Loop using requestAnimationFrame
  const animate = useCallback((time: number) => {
      if (!runningRef.current) return;
      
      const deltaTime = time - lastUpdateRef.current;
      
      if (deltaTime >= speedRef.current) {
          runStep();
          lastUpdateRef.current = time;
      }
      
      requestRef.current = requestAnimationFrame(animate);
  }, [runStep]);


  useEffect(() => {
      if (running) {
          lastUpdateRef.current = performance.now();
          requestRef.current = requestAnimationFrame(animate);
      } else {
          if (requestRef.current) cancelAnimationFrame(requestRef.current);
      }
      return () => {
          if (requestRef.current) cancelAnimationFrame(requestRef.current);
      };
  }, [running, animate]);

  // Initial Draw
  useEffect(() => {
      draw();
  }, [draw, colorMode, showGridLines]);


  // --- Handlers ---

  const handleStartStop = () => {
    setRunning(!running);
  };

  const handleNextStep = () => {
      setRunning(false);
      runStep();
  };

  const handleUndo = () => {
      setRunning(false);
      if (historyRef.current.length === 0) return;

      const previousState = historyRef.current.pop();
      if (previousState) {
          gridRef.current = previousState;
          setGeneration(g => Math.max(0, g - 1));
          setHistoryLength(historyRef.current.length);
          setPlaybackIndex(null);
          draw();
      }
  };

  const handleScrub = (index: number) => {
      if (!historyRef.current[index]) return;
      
      const targetState = historyRef.current[index];
      setPlaybackIndex(index);
      
      // Update visual grid without changing 'live' state logic deeply
      // We just copy it to current ref to display it.
      // Note: If user hits play, it forks from here.
      gridRef.current = targetState.map(row => [...row]);
      
      setGeneration(g => Math.max(0, g)); 
      draw();
  };

  const handleRandomize = () => {
    addToHistory(gridRef.current);
    const newGrid = [];
    for (let i = 0; i < numRows; i++) {
      newGrid.push(Array.from(Array(numCols), () => (Math.random() > 0.75 ? 1 : 0)));
    }
    gridRef.current = newGrid;
    setGeneration(0);
    draw();
  };

  const handleClear = () => {
    addToHistory(gridRef.current);
    gridRef.current = generateEmptyGrid(numRows, numCols);
    setGeneration(0);
    setRunning(false);
    draw();
  };

  const handlePatternLoad = (patternName: string) => {
    setRunning(false);
    addToHistory(gridRef.current);
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

    gridRef.current = newGrid;
    setGeneration(0);
    draw();
  };

  const handleSizeChange = (r: number, c: number) => {
      setRunning(false);
      historyRef.current = []; 
      setHistoryLength(0);
      setPlaybackIndex(null);
      setNumRows(r);
      setNumCols(c);
      gridRef.current = generateEmptyGrid(r, c);
      setGeneration(0);
  };
  
  // Re-trigger draw when size or visuals change
  useEffect(() => {
      draw();
  }, [numRows, numCols, colorMode, showGridLines, draw]);

  // Handle Resize
  useEffect(() => {
    const handleResize = () => {
        const { rows, cols } = calculateGridDimensions();
        
        // Only update if dimensions actually changed significantly
        setNumRows(prevRows => {
            if (prevRows === rows) return prevRows;
            
            // Adjust grid data to new size (copy existing or pad)
            const oldGrid = gridRef.current;
            const newGrid = generateEmptyGrid(rows, cols);
            for (let i = 0; i < Math.min(prevRows, rows); i++) {
                for (let j = 0; j < Math.min(oldGrid[0]?.length || 0, cols); j++) {
                    newGrid[i][j] = oldGrid[i][j];
                }
            }
            gridRef.current = newGrid;
            return rows;
        });
        
        setNumCols(prevCols => {
            if (prevCols === cols) return prevCols;
            return cols;
        });
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // --- Interaction Logic (Draw/Stamp) ---

  const isMouseDownRef = useRef(isMouseDown);
  useEffect(() => { isMouseDownRef.current = isMouseDown; }, [isMouseDown]);

  const handleCellInteract = useCallback((r: number, c: number, type: 'down' | 'enter') => {
      if (type === 'enter' && !isMouseDownRef.current) return;
      
      if (type === 'down' || (type === 'enter' && isMouseDownRef.current)) {
          soundEngine.playInteractionSound(interactionModeRef.current === 'erase' ? 'erase' : 'draw');
      }
      
      if (type === 'down') {
          addToHistory(gridRef.current);
      }

      const prev = gridRef.current;
      const mode = interactionModeRef.current;
      
      if (type === 'enter' && mode === 'stamp') return; 
      
      const val = mode === 'draw' ? 1 : 0;
      if (prev[r] && prev[r][c] === val && mode !== 'stamp') return;
      if (!prev[r]) return; 

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
      
      gridRef.current = newGrid;
      draw();

  }, [draw]);

  const handleInteractionStart = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      
      if ('cancelable' in e && e.cancelable) e.preventDefault();
      setIsMouseDown(true);
      
      const rect = canvas.getBoundingClientRect();
      let clientX, clientY;
      
      if ('touches' in e) {
          clientX = e.touches[0].clientX;
          clientY = e.touches[0].clientY;
      } else {
          clientX = (e as React.MouseEvent).clientX;
          clientY = (e as React.MouseEvent).clientY;
      }

      const x = clientX - rect.left;
      const y = clientY - rect.top;
      
      const c = Math.floor((x / rect.width) * numCols);
      const r = Math.floor((y / rect.height) * numRows);
      
      if (r >= 0 && r < numRows && c >= 0 && c < numCols) {
          handleCellInteract(r, c, 'down');
      }
  };

  const handleInteractionMove = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
      if (!isMouseDownRef.current) return;
      
      const canvas = canvasRef.current;
      if (!canvas) return;
      
      if ('cancelable' in e && e.cancelable) e.preventDefault();
      
      const rect = canvas.getBoundingClientRect();
      let clientX, clientY;
      
      if ('touches' in e) {
          clientX = e.touches[0].clientX;
          clientY = e.touches[0].clientY;
      } else {
          clientX = (e as React.MouseEvent).clientX;
          clientY = (e as React.MouseEvent).clientY;
      }

      const x = clientX - rect.left;
      const y = clientY - rect.top;
      
      const c = Math.floor((x / rect.width) * numCols);
      const r = Math.floor((y / rect.height) * numRows);
      
      if (r >= 0 && r < numRows && c >= 0 && c < numCols) {
          handleCellInteract(r, c, 'enter');
      }
  };

  return (
    <div className="game-container immersive">
      
      {/* Canvas Grid Surface */}
      <div 
        className="grid-surface"
        style={{
            display: 'flex', 
            width: '100%',
            height: '100%',
            justifyContent: 'center',
            alignItems: 'center', 
            overflow: 'hidden' 
        }}
        onMouseLeave={() => setIsMouseDown(false)}
        onTouchEnd={() => setIsMouseDown(false)}
        onTouchCancel={() => setIsMouseDown(false)}
      >
        <canvas
            ref={canvasRef}
            onMouseDown={handleInteractionStart}
            onMouseMove={handleInteractionMove}
            onTouchStart={handleInteractionStart}
            onTouchMove={handleInteractionMove}
            style={{ 
                cursor: 'crosshair', 
                touchAction: 'none', 
                width: '100%', 
                height: '100%', 
                display: 'block' 
            }}
        />
      </div>

      {/* Toggle UI Button */}
      {enableUI && (
        <button 
            className={`ui-toggle-btn ${!isUiVisible ? 'hidden-ui' : ''}`}
            onClick={() => setIsUiVisible(!isUiVisible)}
            title={isUiVisible ? "Hide Interface" : "Show Interface"}
        >
            <div className="icon-frame"></div>
        </button>
      )}

      {/* Glass HUD Container */}
      {enableUI && isUiVisible && (
      <div className="glass-hud-container">
        
        {/* Timeline Slider */}
        {!running && historyLength > 0 && (
             <div className="hud-timeline">
                <span className="timeline-label">-{historyLength}</span>
                <input 
                     type="range"
                     min="0"
                     max={historyLength}
                     value={playbackIndex !== null ? playbackIndex : historyLength}
                     onChange={(e) => handleScrub(Number(e.target.value))}
                     title={`Rewind history (${historyLength} frames available)`}
                     style={{
                         backgroundSize: `${((playbackIndex !== null ? playbackIndex : historyLength) / historyLength) * 100}% 100%` 
                     }}
                 />
                 <span className="timeline-label">NOW</span>
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
            <button className="hud-btn" onClick={handleRandomize}>RANDOM</button>
            <button className="hud-btn" onClick={handleClear} style={{color: '#ff6b6b'}}>CLEAR</button>
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
               <select 
                    className="hud-select"
                    value={waveform} 
                    onChange={(e) => setWaveform(e.target.value as OscillatorType)}
                    style={{marginRight: '0.5rem', marginLeft: 0}}
                    title="Sound Waveform"
                >
                    <option value="sine">Sine</option>
                    <option value="triangle">Triangle</option>
                    <option value="square">Square</option>
                    <option value="sawtooth">Saw</option>
                </select>
               <input 
                    type="range" 
                    min="0" max="0.5" step="0.01"
                    value={volume} 
                    onChange={e => setVolume(Number(e.target.value))} 
                    style={{width: '60px', marginRight: '1rem', height: '4px'}}
                    title={`Volume: ${Math.round(volume * 200)}%`}
               />
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
      )}

      {/* Settings Overlay */}
      {enableUI && isUiVisible && showSettings && (
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
              </div>
          </div>
      )}
    </div>
  );
};

export default GameOfLife;