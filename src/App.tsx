import { useState } from 'react';
import GameOfLife from './components/GameOfLife';
import GameOfLife3D from './components/GameOfLife3D';
import './index.css';
import './intro.css';
import './ui-toggle.css';

function App() {
  const [isIntro, setIsIntro] = useState(true);
  const [isExiting, setIsExiting] = useState(false);
  const [mode, setMode] = useState<'2d' | '3d'>('2d');

  const handleEnter = () => {
    setIsExiting(true);
    // Wait for the exit animation (1.5s in CSS) before removing component
    setTimeout(() => {
        setIsIntro(false);
        setIsExiting(false);
    }, 1200);
  };

  return (
    <div className="app-container">
      {/* Cinematic Title Overlay (Attract Mode) */}
      {isIntro && (
        <div className={`intro-overlay ${isExiting ? 'exit' : ''}`}>
          <div className="intro-content">
            <h1 className="intro-title">
              <span className="intro-glitch">CONWAY'S</span>
              GAME OF LIFE
            </h1>
            <button className="intro-cta" onClick={handleEnter}>
              ENTER VOID
            </button>
            <div className="mode-select" style={{ marginTop: '2rem', display: 'flex', gap: '1rem', justifyContent: 'center' }}>
                <button 
                    className={`hud-btn ${mode === '2d' ? 'active' : ''}`}
                    onClick={() => setMode('2d')}
                    style={{ background: 'rgba(255,255,255,0.1)', padding: '0.5rem 1rem' }}
                >
                    2D CLASSIC
                </button>
                <button 
                    className={`hud-btn ${mode === '3d' ? 'active' : ''}`}
                    onClick={() => setMode('3d')}
                    style={{ background: 'rgba(255,255,255,0.1)', padding: '0.5rem 1rem' }}
                >
                    3D CUBE
                </button>
            </div>
          </div>
        </div>
      )}

      {/* Mode Toggle (Visible when playing) */}
      {!isIntro && (
          <div style={{ position: 'absolute', top: '20px', right: '20px', zIndex: 1000, display: 'flex', gap: '10px' }}>
              <button 
                className="hud-btn" 
                onClick={() => setMode(m => m === '2d' ? '3d' : '2d')}
                style={{ 
                    background: 'rgba(0,0,0,0.5)', 
                    border: '1px solid rgba(255,255,255,0.2)',
                    backdropFilter: 'blur(10px)',
                    color: '#fff',
                    padding: '8px 16px',
                    cursor: 'pointer'
                }}
              >
                  SWITCH TO {mode === '2d' ? '3D' : '2D'}
              </button>
          </div>
      )}

      {/* Game Section - Always rendered, controls hidden during intro */}
      <section className="game-wrapper-section">
        <div className="game-card">
           {mode === '2d' ? (
               <GameOfLife enableUI={!isIntro} />
           ) : (
               <GameOfLife3D enableUI={!isIntro} />
           )}
        </div>
      </section>
    </div>
  );
}

export default App;