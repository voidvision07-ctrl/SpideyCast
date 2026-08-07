import React, { useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Points, PointMaterial } from '@react-three/drei';

function WebParticles() {
  const ref = useRef();
  
  // Generate spherical distribution of particle nodes
  const sphere = new Float32Array(1500);
  for (let i = 0; i < 1500; i += 3) {
    sphere[i] = (Math.random() - 0.5) * 10;
    sphere[i + 1] = (Math.random() - 0.5) * 10;
    sphere[i + 2] = (Math.random() - 0.5) * 10;
  }

  useFrame((state, delta) => {
    ref.current.rotation.x -= delta / 10;
    ref.current.rotation.y -= delta / 15;
  });

  return (
    <group rotation={[0, 0, Math.PI / 4]}>
      <Points ref={ref} positions={sphere} stride={3} frustumCulled={false}>
        <PointMaterial
          transparent
          color="#E50914"
          size={0.03}
          sizeAttenuation={true}
          depthWrite={false}
        />
      </Points>
    </group>
  );
}

export default function Background3D() {
  return (
    <div className="fixed inset-0 z-0 pointer-events-none opacity-40">
      <Canvas camera={{ position: [0, 0, 3] }}>
        <WebParticles />
      </Canvas>
    </div>
  );
}