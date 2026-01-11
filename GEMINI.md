# Project Overview

**Game of Life** is a visionary, high-performance web application that reimagines Conway's Game of Life as an immersive digital art installation. It transcends standard "tech demos" by focusing on atmospheric aesthetics, kinetic feedback, and generative soundscapes.

The project features a cinematic entry experience, "Phosphor Persistence" rendering, a glassmorphic UI with toggleable visibility, and a responsive design optimized for mobile immersion.

## Tech Stack

*   **Framework:** React 18
*   **Language:** TypeScript
*   **Build Tool:** Vite
*   **Styling:** Plain CSS with Glassmorphism, CSS Variables, and Mobile-Responsive Media Queries.
*   **State Management:** React `useState`, `useRef`, `useCallback`, `memo`.
*   **Audio:** Native Web Audio API via `SoundEngine` (Custom ADSR Envelope).

## Architecture

*   **`src/App.tsx`**: Manages the "Cinematic Entry" (Attract Mode) and high-level layout.
*   **`src/components/GameOfLife.tsx`**: The core engine and immersive UI.
    *   **Responsive Grid**: Automatically calculates grid dimensions to fill the viewport on load (`calculateGridDimensions`).
    *   **Atomic Rendering**: Uses `MemoizedCell` with custom comparison logic.
    *   **UI Visibility**: Implements a toggleable HUD via `isUiVisible` and `enableUI` prop.
    *   **Time Travel**: Non-destructive history scrubbing with timeline branching.
*   **`src/utils/SoundEngine.ts`**: Singleton managing real-time sonification.
    *   **Cavernous Envelope**: Features a sharp percussive attack and long, reverb-like release for atmospheric depth.

## Key Features

1.  **Visionary Aesthetics**:
    *   **Cinematic Entry**: An "Attract Mode" overlay that runs the simulation in the background before user interaction.
    *   **Phosphor Persistence**: Cells appear instantly but fade out slowly (`0.15s`), creating a CRT-like ghosting effect.
    *   **Void Design**: Grid lines are hidden by default to emphasize the "living light" against a deep void.
    *   **Color Palettes**: Curated "Neon" (Cyberpunk HSL) and "Heat" (White-hot to Ember) modes.

2.  **Immersive Interaction**:
    *   **UI Toggle**: A dedicated glassmorphic button to hide all interfaces for a pure viewing experience.
    *   **Tactile Audio**: Generative soundscape with specific audio cues for drawing vs. erasing.
    *   **Mobile Optimized**: Full-screen settings panel, responsive grid sizing, and optimized touch layouts.

3.  **Advanced Simulation**:
    *   **Time Travel**: Rewind history and fork timelines seamlessly.
    *   **Pattern Library**: Instant stamping of complex organisms (Gliders, Gosper Guns).
    *   **Life Energy**: Dynamic ambient glow (`--life-intensity`) based on global population density.

# Building and Running

### Prerequisites

*   Node.js (v18+)
*   npm

### Development Commands

*   `npm install`: Install dependencies.
*   `npm run dev`: Start the development server (Exposed to network via `host: true`).
*   `npm run build`: Compile for production.
*   `npm run lint`: Run code style checks.

# Development Conventions

*   **Immersive First**: Prioritize visual "juice" and atmospheric depth over standard utility UI.
*   **Mobile Responsive**: Ensure all features are accessible and visually coherent on small touch screens.
*   **Performance**: Use `React.memo` and `useRef` to maintain 60fps even with complex grid interactions.
*   **Non-Destructive History**: All grid mutations should support undo/scrubbing capability.
