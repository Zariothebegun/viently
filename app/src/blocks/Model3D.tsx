import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { useState } from "react";
import type { Block } from "../schema";

type B = Extract<Block, { type: "model3d" }>;

function Scene({ assetId, hotspots, onPick, picked }: { assetId: string; hotspots: NonNullable<B["hotspots"]>; onPick: (id: string) => void; picked: string | null }) {
  const isCell = assetId.startsWith("cell") || assetId === "molecule-water";

  return (
    <>
      <ambientLight intensity={0.7} />
      <directionalLight position={[3, 4, 3]} intensity={1.4} />
      <directionalLight position={[-3, -2, -3]} intensity={0.5} color="#7aa2ff" />

      {isCell ? (
        <>
          <mesh>
            <sphereGeometry args={[1.5, 48, 48]} />
            <meshStandardMaterial color="#3ee0c0" transparent opacity={0.18} roughness={0.2} />
          </mesh>
          <mesh position={[0, 0.35, 0]}>
            <sphereGeometry args={[0.62, 36, 36]} />
            <meshStandardMaterial color="#7aa2ff" emissive="#2b3a70" roughness={0.4} />
          </mesh>
          <mesh position={[0.95, -0.55, 0.3]}>
            <sphereGeometry args={[0.18, 24, 24]} />
            <meshStandardMaterial color="#ffb86b" />
          </mesh>
        </>
      ) : assetId === "atom" ? (
        <>
          <mesh>
            <sphereGeometry args={[0.45, 32, 32]} />
            <meshStandardMaterial color="#ff7a90" emissive="#521020" />
          </mesh>
          {[0, 1, 2].map((i) => (
            <mesh key={i} rotation={[i * 1.1, i * 0.7, i * 0.5]}>
              <torusGeometry args={[1.3, 0.02, 16, 96]} />
              <meshStandardMaterial color="#3ee0c0" emissive="#0f3f36" />
            </mesh>
          ))}
        </>
      ) : assetId === "solar-system" ? (
        <>
          <mesh>
            <sphereGeometry args={[0.5, 32, 32]} />
            <meshStandardMaterial color="#ffb86b" emissive="#7a4a00" />
          </mesh>
          {[1.1, 1.5, 1.9].map((r, i) => (
            <mesh key={i} rotation={[Math.PI / 2, 0, 0]}>
              <torusGeometry args={[r, 0.012, 8, 96]} />
              <meshStandardMaterial color="#7aa2ff" />
            </mesh>
          ))}
        </>
      ) : (
        <mesh>
          <boxGeometry args={[1.8, 1.8, 1.8]} />
          <meshStandardMaterial color="#3ee0c0" roughness={0.3} metalness={0.2} />
        </mesh>
      )}

      {hotspots.map((h, i) => {
        const p = h.position ?? [Math.cos(i * 2.1) * 1.1, Math.sin(i * 2.1) * 0.8, 0.4];
        const active = picked === h.id;
        return (
          <mesh key={h.id} position={p as [number, number, number]} onClick={(e) => { e.stopPropagation(); onPick(h.id); }}>
            <sphereGeometry args={[active ? 0.16 : 0.11, 24, 24]} />
            <meshStandardMaterial color={active ? "#ffffff" : "#ffb86b"} emissive={active ? "#ffb86b" : "#5a3a00"} />
          </mesh>
        );
      })}
    </>
  );
}

export function Model3DBlockView({ block }: { block: B }) {
  const [picked, setPicked] = useState<string | null>(null);
  const hotspots = block.hotspots ?? [];
  const active = hotspots.find((h) => h.id === picked);

  return (
    <section className="block">
      <h3 className="block-title">{block.title}</h3>
      <div className="canvas-wrap">
        <Canvas camera={{ position: [0, 0.7, 4.2], fov: 45 }} dpr={[1, 2]}>
          <Scene assetId={block.assetId} hotspots={hotspots} onPick={setPicked} picked={picked} />
          <OrbitControls enablePan={false} minDistance={2.2} maxDistance={7} />
        </Canvas>
      </div>
      <div className={"hotspot-info " + (active ? "show" : "")}>
        {active ? (
          <>
            <strong>{active.label}</strong>
            <span>{active.description}</span>
          </>
        ) : (
          <span className="hint">Arrasta para rodar · toca num ponto</span>
        )}
      </div>
    </section>
  );
}
