import { useRef } from 'react';
import GameOfLife from './components/GameOfLife';
import './index.css';

function App() {
  const gameSectionRef = useRef<HTMLDivElement>(null);

  const scrollToGame = () => {
    gameSectionRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div className="app-container">
      
      {/* Hero Section */}
      <section className="hero-section">
        <div className="hero-content">
          <h1 className="hero-title">
            <span className="gradient-text">CELLULAR</span> AUTOMATON
          </h1>
          <p className="hero-subtitle">
            Explore the complexity arising from simplicity. <br />
            Paint with life, listen to the chaos, and rewind time.
          </p>
          <button className="hero-cta" onClick={scrollToGame}>
            Enter Simulation
          </button>
        </div>
        <div className="hero-background-elements">
           <div className="blob blob-1"></div>
           <div className="blob blob-2"></div>
        </div>
      </section>

      {/* Introduction / Info Section */}
      <section className="info-section">
        <div className="info-card">
          <h2>What is this?</h2>
          <p>
            The <strong>Game of Life</strong>, devised by mathematician John Conway in 1970, isn't a game in the traditional sense. 
            It's a "zero-player game" — its evolution is determined by its initial state, requiring no further input.
          </p>
        </div>
        
        <div className="features-grid">
           <div className="feature-item">
              <h3>🎨 Paint & Stamp</h3>
              <p>Draw your own organisms or stamp complex structures like Gliders and Spaceships directly onto the grid.</p>
           </div>
           <div className="feature-item">
              <h3>🎵 Generative Audio</h3>
              <p>Listen to the simulation. Every birth triggers a note, creating a unique soundscape based on the grid's density.</p>
           </div>
           <div className="feature-item">
              <h3>⏪ Time Travel</h3>
              <p>Made a mistake? Use the history slider to scrub backward in time and fork the timeline.</p>
           </div>
        </div>
      </section>

      {/* Game Section */}
      <section className="game-wrapper-section" ref={gameSectionRef}>
        <div className="game-card">
           <GameOfLife />
        </div>
      </section>

      {/* Footer */}
      <footer className="app-footer">
        <p>Built with React, Vite & TypeScript • 2026</p>
      </footer>
    </div>
  );
}

export default App;