"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { ContactShadows, Edges, Environment, OrbitControls, Text } from "@react-three/drei";
import * as THREE from "three";
import { Maximize2 } from "lucide-react";

const SCALE = 0.022;

export interface PlotterSimulatorPiece {
  id: string;
  w: number;
  h: number;
  cx: number;
  cy: number;
  color: string;
  label: string;
  textColor?: string;
}

interface PlotterSimulatorProps {
  pieces: PlotterSimulatorPiece[];
  rollWidth?: number;
  rollLength?: number;
  optimizationPercentage?: number;
  marginLeft?: number;
  marginRight?: number;
  marginStart?: number;
  marginEnd?: number;
}

function NestedItem({ piece }: { piece: PlotterSimulatorPiece }) {
  const width = piece.w * SCALE;
  const height = piece.h * SCALE;
  const posX = piece.cx * SCALE;
  const posY = piece.cy * SCALE;

  return (
    <group position={[posX, -posY, 0.012]}>
      <mesh>
        <planeGeometry args={[Math.max(width, 0.01), Math.max(height, 0.01)]} />
        <meshBasicMaterial color={piece.color} polygonOffset polygonOffsetFactor={-4} />
        <Edges color="#000000" opacity={0.2} transparent />
      </mesh>
      <Text
        position={[0, 0.05, 0.03]}
        fontSize={0.12}
        color={piece.textColor || "#111"}
        anchorX="center"
        anchorY="middle"
        fontWeight="bold"
        renderOrder={10}
        depthOffset={-10}
        material-depthWrite={false}
        material-depthTest={false}
      >
        {piece.label}
      </Text>
      <Text
        position={[0, -0.08, 0.03]}
        fontSize={0.1}
        color={piece.textColor || "#111"}
        anchorX="center"
        anchorY="middle"
        opacity={0.8}
        renderOrder={10}
        depthOffset={-10}
        material-depthWrite={false}
        material-depthTest={false}
      >
        {piece.w}x{piece.h} cm
      </Text>
    </group>
  );
}

function Plotter({
  pieces,
  rollWidth = 160,
  rollLength = 170,
  marginLeft = 0,
  marginRight = 0,
  marginStart = 0,
  marginEnd = 0,
}: {
  pieces: PlotterSimulatorPiece[];
  rollWidth?: number;
  rollLength?: number;
  marginLeft?: number;
  marginRight?: number;
  marginStart?: number;
  marginEnd?: number;
}) {
  const paperGeometry = useMemo(() => {
    const geo = new THREE.PlaneGeometry(rollWidth * SCALE, rollLength * SCALE);
    geo.translate(0, -(rollLength * SCALE) / 2, 0);
    return geo;
  }, [rollWidth, rollLength]);

  const printableGeometry = useMemo(() => {
    const width = Math.max((rollWidth - marginLeft - marginRight) * SCALE, 0.01);
    const height = Math.max((rollLength - marginStart - marginEnd) * SCALE, 0.01);
    const geo = new THREE.PlaneGeometry(width, height);
    geo.translate(
      ((marginLeft - marginRight) / 2) * SCALE,
      -((marginStart + (rollLength - marginStart - marginEnd) / 2) * SCALE),
      0,
    );
    return geo;
  }, [marginEnd, marginLeft, marginRight, marginStart, rollLength, rollWidth]);

  return (
    <group position={[0, -1.0, 0]}>
      <mesh position={[-2.1, 1, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.15, 2, 0.6]} />
        <meshStandardMaterial color="#2a2a2a" roughness={0.7} />
      </mesh>
      <mesh position={[2.1, 1, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.15, 2, 0.6]} />
        <meshStandardMaterial color="#2a2a2a" roughness={0.7} />
      </mesh>
      <mesh position={[-2.1, 0.05, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.2, 0.1, 0.8]} />
        <meshStandardMaterial color="#111" />
      </mesh>
      <mesh position={[2.1, 0.05, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.2, 0.1, 0.8]} />
        <meshStandardMaterial color="#111" />
      </mesh>
      <mesh position={[0, 0.6, 0]} castShadow receiveShadow>
        <boxGeometry args={[4.2, 0.2, 0.1]} />
        <meshStandardMaterial color="#2a2a2a" />
      </mesh>
      <mesh position={[0, 2.1, 0]} castShadow receiveShadow>
        <boxGeometry args={[4.6, 0.3, 0.8]} />
        <meshStandardMaterial color="#e0e0e0" roughness={0.2} />
      </mesh>
      <mesh position={[0, 2.4, -0.2]} castShadow receiveShadow>
        <boxGeometry args={[4.6, 0.4, 0.4]} />
        <meshStandardMaterial color="#d0d0d0" roughness={0.3} />
      </mesh>
      <mesh position={[0, 2.45, 0.1]} renderOrder={2}>
        <boxGeometry args={[4.5, 0.3, 0.4]} />
        <meshPhysicalMaterial
          color="#111"
          transparent
          opacity={0.5}
          roughness={0.12}
          metalness={0.65}
          clearcoat={1}
          depthWrite={false}
          polygonOffset
          polygonOffsetFactor={-1}
          side={THREE.DoubleSide}
        />
      </mesh>

      <group position={[1.9, 2.4, 0.3]} rotation={[-Math.PI / 6, 0, 0]}>
        <mesh castShadow>
          <boxGeometry args={[0.4, 0.3, 0.05]} />
          <meshStandardMaterial color="#222" />
        </mesh>
        <mesh position={[0, 0.05, 0.03]}>
          <planeGeometry args={[0.3, 0.15]} />
          <meshBasicMaterial color="#0a84ff" />
        </mesh>
      </group>

      <mesh position={[0, 2.6, -0.4]} castShadow>
        <boxGeometry args={[4.2, 0.1, 0.1]} />
        <meshStandardMaterial color="#333" />
      </mesh>
      <mesh position={[0, 2.6, -0.4]} rotation={[0, 0, Math.PI / 2]} castShadow>
        <cylinderGeometry args={[0.25, 0.25, 3.8, 32]} />
        <meshStandardMaterial color="#f4f4f4" roughness={0.9} />
      </mesh>
      <mesh position={[0, 2.3, 0.1]}>
        <boxGeometry args={[4.2, 0.02, 0.02]} />
        <meshStandardMaterial color="#888" metalness={0.8} roughness={0.2} />
      </mesh>
      <mesh position={[1.2, 2.3, 0.1]}>
        <boxGeometry args={[0.25, 0.15, 0.15]} />
        <meshStandardMaterial color="#111" />
      </mesh>

      <group position={[0, 2.2, 0.35]} rotation={[-Math.PI / 12, 0, 0]}>
        <mesh geometry={paperGeometry} castShadow receiveShadow>
          <meshStandardMaterial color="#ffffff" roughness={0.9} side={THREE.DoubleSide} />

          <group position={[0, 0, 0.002]}>
            <mesh geometry={printableGeometry}>
              <meshBasicMaterial
                color="#22c55e"
                opacity={0.1}
                transparent
                depthWrite={false}
                polygonOffset
                polygonOffsetFactor={-1}
                side={THREE.DoubleSide}
              />
            </mesh>

            {marginLeft > 0 ? (
              <mesh position={[((-rollWidth / 2) + marginLeft / 2) * SCALE, -(rollLength / 2) * SCALE, 0.004]}>
                <planeGeometry args={[marginLeft * SCALE, rollLength * SCALE]} />
                <meshBasicMaterial
                  color="#ef4444"
                  opacity={0.28}
                  transparent
                  depthWrite={false}
                  polygonOffset
                  polygonOffsetFactor={-2}
                  side={THREE.DoubleSide}
                />
              </mesh>
            ) : null}
            {marginRight > 0 ? (
              <mesh position={[((rollWidth / 2) - marginRight / 2) * SCALE, -(rollLength / 2) * SCALE, 0.004]}>
                <planeGeometry args={[marginRight * SCALE, rollLength * SCALE]} />
                <meshBasicMaterial
                  color="#ef4444"
                  opacity={0.28}
                  transparent
                  depthWrite={false}
                  polygonOffset
                  polygonOffsetFactor={-2}
                  side={THREE.DoubleSide}
                />
              </mesh>
            ) : null}
            {marginStart > 0 ? (
              <mesh position={[0, -(marginStart / 2) * SCALE, 0.004]}>
                <planeGeometry args={[rollWidth * SCALE, marginStart * SCALE]} />
                <meshBasicMaterial
                  color="#ef4444"
                  opacity={0.24}
                  transparent
                  depthWrite={false}
                  polygonOffset
                  polygonOffsetFactor={-2}
                  side={THREE.DoubleSide}
                />
              </mesh>
            ) : null}
            {marginEnd > 0 ? (
              <mesh position={[0, -((rollLength - marginEnd / 2) * SCALE), 0.004]}>
                <planeGeometry args={[rollWidth * SCALE, marginEnd * SCALE]} />
                <meshBasicMaterial
                  color="#ef4444"
                  opacity={0.24}
                  transparent
                  depthWrite={false}
                  polygonOffset
                  polygonOffsetFactor={-2}
                  side={THREE.DoubleSide}
                />
              </mesh>
            ) : null}

            {pieces.map((piece) => (
              <NestedItem key={piece.id} piece={piece} />
            ))}

            <mesh position={[0, -(rollLength * SCALE) / 2, -0.002]}>
              <planeGeometry args={[rollWidth * SCALE, rollLength * SCALE, 16, 16]} />
              <meshBasicMaterial color="#000000" wireframe opacity={0.02} transparent depthWrite={false} />
            </mesh>
          </group>
        </mesh>
      </group>
    </group>
  );
}

export default function PlotterSimulator({
  pieces = [],
  rollWidth = 160,
  rollLength = 170,
  marginLeft = 0,
  marginRight = 0,
  marginStart = 0,
  marginEnd = 0,
}: PlotterSimulatorProps) {
  const [spacePressed, setSpacePressed] = useState(false);
  const [pointerDown, setPointerDown] = useState(false);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.code !== "Space") {
        return;
      }

      event.preventDefault();
      setSpacePressed(true);
    };

    const handleKeyUp = (event: KeyboardEvent) => {
      if (event.code !== "Space") {
        return;
      }

      setSpacePressed(false);
    };

    window.addEventListener("keydown", handleKeyDown, { passive: false });
    window.addEventListener("keyup", handleKeyUp);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, []);

  return (
    <div
      className="relative h-full min-h-[600px] overflow-hidden rounded-xl border border-[#c46a2d]/30 bg-gradient-to-br from-[#2a1d17] via-[#181414] to-[#0f0f10] font-sans"
      style={{
        cursor: spacePressed ? (pointerDown ? "grabbing" : "grab") : "default",
      }}
      onPointerDown={() => setPointerDown(true)}
      onPointerUp={() => setPointerDown(false)}
      onPointerLeave={() => setPointerDown(false)}
    >
      <div className="absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-[#ff7a1a]/18 via-[#ff7a1a]/6 to-transparent" />

      <div className="absolute inset-0">
        <Canvas shadows camera={{ position: [0, 0.5, 6], fov: 45 }}>
          <color attach="background" args={["#0f0f10"]} />
          <ambientLight intensity={0.6} />
          <spotLight position={[5, 10, 5]} angle={0.3} penumbra={1} intensity={1.5} castShadow shadow-mapSize={[2048, 2048]} />
          <pointLight position={[-10, -10, -10]} intensity={0.5} />

          <Plotter
            pieces={pieces}
            rollWidth={rollWidth}
            rollLength={rollLength}
            marginLeft={marginLeft}
            marginRight={marginRight}
            marginStart={marginStart}
            marginEnd={marginEnd}
          />

          <ContactShadows position={[0, -1.5, 0]} opacity={0.8} scale={15} blur={2.5} far={4} color="#000000" />
          <Environment preset="city" />
          <OrbitControls
            makeDefault
            target={[0, 0.5, 0]}
            minPolarAngle={0}
            maxPolarAngle={Math.PI / 2 + 0.1}
            minDistance={2}
            maxDistance={12}
            mouseButtons={{
              LEFT: spacePressed ? THREE.MOUSE.PAN : THREE.MOUSE.ROTATE,
              MIDDLE: THREE.MOUSE.DOLLY,
              RIGHT: THREE.MOUSE.ROTATE,
            }}
            touches={{
              ONE: THREE.TOUCH.ROTATE,
              TWO: THREE.TOUCH.DOLLY_PAN,
            }}
            enablePan={spacePressed}
            panSpeed={0.9}
            screenSpacePanning
          />
        </Canvas>
      </div>

      <div className="pointer-events-none absolute inset-0 flex flex-col">
        <div className="absolute bottom-6 left-1/2 flex -translate-x-1/2 items-center gap-3 rounded-full border border-zinc-800/50 bg-zinc-900/60 px-6 py-2 shadow-xl backdrop-blur-md">
          <Maximize2 className="h-4 w-4 text-zinc-400" />
          <span className="text-xs font-medium text-zinc-300">Arrastrá para rotar • Rueda para zoom • Espacio + arrastrar para desplazar</span>
        </div>
      </div>
    </div>
  );
}
