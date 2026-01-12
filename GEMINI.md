# Project Overview

**Game of Life** is a visionary, high-performance web application that reimagines Conway's Game of Life as an immersive digital art installation. It transcends standard "tech demos" by focusing on atmospheric aesthetics, kinetic feedback, and generative soundscapes.

The project features a cinematic entry experience, "Phosphor Persistence" rendering, a glassmorphic UI with toggleable visibility, and a responsive design optimized for mobile immersion.

## Tech Stack

*   **Framework:** React 18
*   **Language:** TypeScript
*   **Build Tool:** Vite
*   **3D Rendering:** Three.js with React Three Fiber (R3F) and @react-three/drei.
*   **Styling:** Plain CSS with Glassmorphism, CSS Variables, and Mobile-Responsive Media Queries.
*   **State Management:** React `useState`, `useRef`, `useCallback`, `memo`.
*   **Audio:** Native Web Audio API via `SoundEngine` (Custom ADSR Envelope).

## Architecture

*   **`src/App.tsx`**: Manages the "Cinematic Entry" (Attract Mode), mode switching (2D/3D), and high-level layout.
*   **`src/components/GameOfLife.tsx`**: The core 2D engine and immersive UI.
*   **`src/components/GameOfLife3D.tsx`**: High-performance 3D engine using WebGL.
    *   **Instanced Rendering**: Uses `InstancedMesh` for efficient rendering of thousands of cells in a single draw call.
    *   **Spatial Neighborhood**: Implements 3D Moore neighborhood (26 neighbors) with **strict bounds checking** (no toroidal wrapping) to prevent edge-case artifacts.
    *   **Adaptive Geometry**: Logic extracted to `src/utils/gridGeometry.ts`. Uses surface-normal alignment and **exact surface projection** to render all cells (including edges/corners) as flat panels ("Chamfered Panels"). This ensures seamless visual transitions where edge cells wrap perfectly around the cube without "floating" or "split" artifacts.
*   **`src/utils/SoundEngine.ts`**: Singleton managing real-time sonification.

## Key Features

1.  **Visionary Aesthetics**:
    *   **Hybrid Dimensionality**: Seamlessly toggle between 2D pixel-art and 3D volumetric "Void Cube" modes.
    *   **Phosphor Persistence**: Cells appear instantly but fade out slowly, creating a CRT-like ghosting effect in 2D and glowing trails in 3D.
    *   **Void Design**: Deep void backgrounds with glowing, light-emitting cell structures.
    *   **Cinematic Transition**: Immersive "Big Bang" zoom-out effect upon entering the simulation.

2.  **Immersive Interaction**:
    *   **3D Navigation**: Orbit, pan, and zoom through the 3D simulation with touch-optimized controls.
    *   **UI Toggle**: A dedicated glassmorphic button to hide all interfaces for a pure viewing experience.
    *   **Tactile Audio**: Generative soundscape synced with simulation events.

3.  **Advanced Simulation**:
    *   **Multi-Dimensional Rules**: Support for classic 2D rules and complex 3D rule sets (e.g., Carter Bays' 4555).
    *   **Time Travel**: Rewind history and fork timelines (currently optimized for 2D).

## Branches & Code Organization

The repository is organized to separate the stable core from experimental features.

### Active Branches

*   **`main`**: The primary stable branch.
    *   Contains the core 2D simulation, basic UI structure, and project documentation.
*   **`feature/3d-mode`**: The active development branch for the 3D engine.
    *   **New File**: `src/components/GameOfLife3D.tsx` (The WebGL engine).
    *   **Dependencies**: Adds `three`, `@react-three/fiber`, and `@react-three/drei`.
    *   **Logic**: Implements the 3D toggle and rendering loop in `App.tsx`.

### Function Locations

*   **Core Simulation Logic**:
    *   **2D**: Located in `src/components/GameOfLife.tsx`. The simulation is managed by a `requestAnimationFrame` loop (`animate` function) that calls the `runStep` function based on a settable speed. This avoids React's render cycle for the core logic, using `useRef` hooks to manage state.
    *   **3D**: Located in `src/components/GameOfLife3D.tsx` (function `runStep`). Uses flattened `Uint8Array` and 26-neighbor checking.
*   **Audio System**:
    *   `src/utils/SoundEngine.ts`: A singleton class `SoundEngine`. Accessed via `soundEngine.playGenerationSound()`.
*   **Rendering Loop**:
    *   **2D**: A custom `draw` function renders the grid state to an HTML5 Canvas. It is called within the `requestAnimationFrame` loop after each simulation step, completely bypassing the React component render for high performance.
    *   **3D**: `useEffect` inside `CellInstancedMesh` updates the `InstancedMesh` matrices directly (bypassing React render cycle for performance).

# Building and Running

### Prerequisites

*   Node.js (v18+)
*   npm

### Development Commands

*   `npm install`: Install dependencies (including 3D libraries).
*   `npm run dev`: Start the development server.
*   `npm run build`: Compile for production (checks both 2D and 3D components).

# Development Conventions

*   **Immersive First**: Prioritize visual "juice" and atmospheric depth.
*   **Performance Scaling**: Use `InstancedMesh` for 3D and `React.memo` for 2D to maintain 60fps on mobile.
*   **Mobile Responsive**: Ensure both 2D grid and 3D orbit controls feel native on touch devices.
*   **Non-Destructive History**: Maintain undo/scrubbing capability for grid mutations.
