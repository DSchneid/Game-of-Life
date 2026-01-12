import { Text } from '@react-three/drei';
import { useState, useEffect, useRef } from 'react';
import { useFrame } from '@react-three/fiber';

export const VRLogger = () => {
  const [logs, setLogs] = useState<string[]>([]);
  const meshRef = useRef<any>(null);

  useEffect(() => {
    const originalLog = console.log;
    const originalError = console.error;
    const originalWarn = console.warn;

    const addLog = (type: string, args: any[]) => {
      const msg = args.map(a => (typeof a === 'object' ? JSON.stringify(a) : String(a))).join(' ');
      setLogs(prev => [`[${type}] ${msg}`, ...prev].slice(0, 10)); // Keep last 10
    };

    console.log = (...args) => {
      originalLog(...args);
      addLog('LOG', args);
    };

    console.error = (...args) => {
      originalError(...args);
      addLog('ERR', args);
    };

    console.warn = (...args) => {
      originalWarn(...args);
      addLog('WRN', args);
    };

    window.onerror = (message, source, lineno, colno, error) => {
        addLog('WIN_ERR', [`${message} at ${source}:${lineno}`]);
    };

    return () => {
      console.log = originalLog;
      console.error = originalError;
      console.warn = originalWarn;
      window.onerror = null;
    };
  }, []);

  // Follow camera slightly? Or just place on wall.
  // Placing on wall is stable.

  return (
    <group position={[0, 2, -3.9]} rotation={[0, 0, 0]}> 
        <mesh>
            <planeGeometry args={[4, 2]} />
            <meshBasicMaterial color="black" transparent opacity={0.7} />
        </mesh>
        <Text
            ref={meshRef}
            position={[0, 0, 0.01]}
            fontSize={0.15}
            color="white"
            anchorX="center"
            anchorY="middle"
            maxWidth={3.8}
            lineHeight={1.2}
        >
            {logs.join('\n')}
        </Text>
    </group>
  );
};
