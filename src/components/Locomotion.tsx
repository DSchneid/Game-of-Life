import { useFrame } from '@react-three/fiber';
import { useXR } from '@react-three/xr';
import { Vector3, Quaternion, Euler } from 'three';
import { useRef } from 'react';

interface LocomotionProps {
    moveSpeed?: number;
    rotateSpeed?: number;
}

export const Locomotion = ({ moveSpeed = 4, rotateSpeed = 2 }: LocomotionProps) => {
    const { player, controllers } = useXR();
    const rightTurnState = useRef(0); // 0: neutral, 1: turning

    useFrame((_state, delta) => {
        // --- Movement (Left Stick) ---
        const leftController = controllers.find(c => c.inputSource?.handedness === 'left');
        if (leftController && leftController.inputSource?.gamepad && player) {
            const axes = leftController.inputSource.gamepad.axes;
            // Standard mapping: 2 = X (left/right), 3 = Y (up/down)
            const dx = axes[2] || 0;
            const dy = axes[3] || 0;

            if (Math.abs(dx) > 0.1 || Math.abs(dy) > 0.1) {
                const forward = new Vector3(0, 0, -1).applyQuaternion(player.quaternion);
                forward.y = 0; // Keep movement horizontal
                forward.normalize();

                const right = new Vector3(1, 0, 0).applyQuaternion(player.quaternion);
                right.y = 0;
                right.normalize();

                const moveVector = forward.multiplyScalar(-dy).add(right.multiplyScalar(dx));
                
                player.position.add(moveVector.multiplyScalar(moveSpeed * delta));
            }
        }

        // --- Snap Turn (Right Stick) ---
        const rightController = controllers.find(c => c.inputSource?.handedness === 'right');
        if (rightController && rightController.inputSource?.gamepad && player) {
            const axes = rightController.inputSource.gamepad.axes;
            const dx = axes[2] || 0;

            // Snap turn threshold
            if (Math.abs(dx) > 0.5) {
                if (rightTurnState.current === 0) {
                    const angle = dx > 0 ? -45 : 45; // Deg
                    const radians = (angle * Math.PI) / 180;
                    
                    // Rotate player around Y axis
                    player.rotateY(radians);
                    
                    rightTurnState.current = 1;
                }
            } else {
                rightTurnState.current = 0;
            }
        }
    });

    return null;
};
