import { useState } from 'react';
import GameOfLife from './components/GameOfLife';
import './index.css';
import './intro.css';
import './ui-toggle.css';

function App() {
  const [isIntro, setIsIntro] = useState(true);
  const [isExiting, setIsExiting] = useState(false);

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
          </div>
        </div>
      )}

      {/* Game Section - Always rendered, controls hidden during intro */}
      <section className="game-wrapper-section">
        <div className="game-card">
           <GameOfLife enableUI={!isIntro} />
        </div>
      </section>
    </div>
  );
}

export default App;