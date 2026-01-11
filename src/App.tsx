import { useState } from 'react';
import GameOfLife from './components/GameOfLife';
import './index.css';
import './intro.css';
import './ui-toggle.css';

function App() {
  const [isIntro, setIsIntro] = useState(true);

  return (
    <div className="app-container">
      {/* Cinematic Title Overlay (Attract Mode) */}
      {isIntro && (
        <div className="intro-overlay">
          <div className="intro-content">
            <h1 className="intro-title">
              <span className="intro-glitch">CONWAY'S</span>
              <br />
              GAME OF LIFE
            </h1>
            <button className="intro-cta" onClick={() => setIsIntro(false)}>
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