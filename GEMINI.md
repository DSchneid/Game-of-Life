# Project Overview

**Game of Life** is a high-performance, immersive web application implementing Conway's Game of Life. Built as a React SPA, it transforms mathematical simulation into an interactive audiovisual experience.

The project features a glassmorphic HUD, atomic rendering for smooth performance, generative audio sonification, and non-destructive time travel.

## Tech Stack

*   **Framework:** React 18
*   **Language:** TypeScript
*   **Build Tool:** Vite
*   **Styling:** Plain CSS with Glassmorphism and dynamic CSS Variables.
*   **State Management:** React `useState`, `useRef`, `useCallback`, `memo`.
*   **Audio:** Native Web Audio API via `SoundEngine`.

## Architecture

*   **`src/App.tsx`**: Main entry point and layout sections (Hero, Info, Game).
*   **`src/components/GameOfLife.tsx`**: The core engine and immersive UI.
    *   **Atomic Rendering**: Uses `MemoizedCell` with custom comparison logic to minimize re-renders.
    *   **Glass HUD**: A floating control interface using `backdrop-filter` for a modern aesthetic.
    *   **Time Travel**: Implements a `historyRef` with a non-destructive preview mode and timeline forking.
    *   **Life Energy**: Dynamic CSS variable `--life-intensity` updates based on cell population, affecting ambient glow.
*   **`src/utils/SoundEngine.ts`**: Singleton managing real-time sonification based on grid activity.

## Key Features

1.  **Immersive Simulation**:
    *   Full-screen grid with adaptive sizing.
    *   Support for multiple rulesets (Conway, HighLife, Seeds, etc.).
    *   **Life Energy Effect**: A responsive background glow that pulses with the simulation's population.
2.  **Advanced Interaction**:
    *   **Draw/Erase/Stamp**: Multiple interaction modes for grid manipulation.
    *   **Pattern Library**: Instant stamping of classic organisms (Gliders, Pulsars, Gosper Guns).
    *   **Quick Actions**: Randomize and Clear controls integrated directly into the HUD.
3.  **Generative Audio**:
    *   Real-time soundscape generation.
    *   HUD-accessible Waveform and Volume controls.
4.  **Time Travel & History**:
    *   **Timeline Scrubbing**: Smoothly rewind through history with a dedicated slider.
    *   **Preview Mode**: View past states without destroying the future until the timeline is forked.
5.  **Performance Optimization**:
    *   Memoized cell rendering allows for large grids (up to 80x80) at high speeds.

# Building and Running

### Prerequisites

*   Node.js (v18+)
*   npm

### Development Commands

*   `npm install`: Install dependencies.
*   `npm run dev`: Start the development server.
*   `npm run build`: Compile for production (Type-checked via `tsc`).
*   `npm run lint`: Run code style checks.

# Development Conventions

*   **Performance First**: Use `useRef` for values that shouldn't trigger renders and `React.memo` for expensive grid components.
*   **Aesthetic Integrity**: Adhere to the glassmorphic dark-mode design system defined in `src/index.css`.
*   **Non-Destructive History**: When modifying grid state, always consider if the action should be added to history for Undo/Scrubbing support.