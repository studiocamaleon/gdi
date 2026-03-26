"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { ContactShadows, Edges, Environment, Line, OrbitControls, Text } from "@react-three/drei";
import * as THREE from "three";
import { Maximize2 } from "lucide-react";

const SCALE = 0.022;

export interface PlotterSimulatorPiece {
  id: string;
  w: number;
  h: number;
  originalW?: number | null;
  originalH?: number | null;
  usefulW?: number | null;
  usefulH?: number | null;
  cx: number;
  cy: number;
  color: string;
  label: string;
  textColor?: string;
  rotated?: boolean;
  panelIndex?: number | null;
  panelCount?: number | null;
  panelAxis?: "vertical" | "horizontal" | null;
  sourcePieceId?: string | null;
  overlapStart?: number | null;
  overlapEnd?: number | null;
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
  panelizado?: boolean;
  panelAxis?: "vertical" | "horizontal" | null;
  panelCount?: number;
  panelOverlap?: number | null;
  panelMaxWidth?: number | null;
  panelDistribution?: "equilibrada" | "libre" | null;
  panelWidthInterpretation?: "total" | "util" | null;
  panelMode?: "automatico" | "manual" | null;
}

function NestedItem({ piece }: { piece: PlotterSimulatorPiece }) {
  const width = piece.w * SCALE;
  const height = piece.h * SCALE;
  const originalPlacementWidth =
    (piece.rotated ? (piece.originalH ?? piece.h) : (piece.originalW ?? piece.w)) * SCALE;
  const originalPlacementHeight =
    (piece.rotated ? (piece.originalW ?? piece.w) : (piece.originalH ?? piece.h)) * SCALE;
  const usefulWidth = (piece.usefulW ?? piece.w) * SCALE;
  const usefulHeight = (piece.usefulH ?? piece.h) * SCALE;
  const posX = piece.cx * SCALE;
  const posY = piece.cy * SCALE;
  const isNarrowPiece = width / Math.max(height, 0.01) < 0.42;
  const isVeryNarrowPiece = width / Math.max(height, 0.01) < 0.2;
  const shouldRotateText = isNarrowPiece;
  const textBlockWidth = shouldRotateText ? height : width;
  const textBlockHeight = shouldRotateText ? width : height;
  const compactTextMode = isVeryNarrowPiece || textBlockWidth < 0.6 || textBlockHeight < 0.3;
  const labelFontSize = Math.max(
    compactTextMode ? 0.07 : 0.06,
    Math.min(compactTextMode ? 0.135 : 0.12, textBlockWidth * 0.18, textBlockHeight * 0.24),
  );
  const detailFontSize = Math.max(
    compactTextMode ? 0.055 : 0.048,
    Math.min(compactTextMode ? 0.105 : 0.1, labelFontSize * 0.74),
  );
  const labelOffsetY = Math.min(textBlockHeight * 0.12, 0.08);
  const detailOffsetY = Math.min(textBlockHeight * 0.12, 0.085);
  const rotatedLaneOffset = Math.max(0.16, Math.min(textBlockHeight * 0.34, 0.3));
  const detailText = `${piece.w}x${piece.h} cm`;
  const overlapStart = Math.max((piece.overlapStart ?? 0) * SCALE, 0);
  const overlapEnd = Math.max((piece.overlapEnd ?? 0) * SCALE, 0);
  const usefulOffsetX = piece.panelAxis === "vertical" ? (overlapStart - overlapEnd) / 2 : 0;
  const usefulOffsetY = piece.panelAxis === "horizontal" ? (-overlapStart + overlapEnd) / 2 : 0;
  const showsOriginalOutline =
    !piece.panelIndex &&
    (Math.abs(originalPlacementWidth - width) > 0.0001 ||
      Math.abs(originalPlacementHeight - height) > 0.0001);
  const originalOutlinePoints: Array<[number, number, number]> = [
    [-originalPlacementWidth / 2, originalPlacementHeight / 2, 0.032],
    [originalPlacementWidth / 2, originalPlacementHeight / 2, 0.032],
    [originalPlacementWidth / 2, -originalPlacementHeight / 2, 0.032],
    [-originalPlacementWidth / 2, -originalPlacementHeight / 2, 0.032],
    [-originalPlacementWidth / 2, originalPlacementHeight / 2, 0.032],
  ];

  return (
    <group position={[posX, -posY, 0.012]}>
      <mesh>
        <planeGeometry args={[Math.max(width, 0.01), Math.max(height, 0.01)]} />
        <meshBasicMaterial color={piece.color} polygonOffset polygonOffsetFactor={-4} />
        <Edges color="#000000" opacity={0.2} transparent />
      </mesh>
      {piece.panelIndex ? (
        <group>
          <mesh position={[usefulOffsetX, usefulOffsetY, 0.02]}>
            <planeGeometry args={[Math.max(usefulWidth, 0.01), Math.max(usefulHeight, 0.01)]} />
            <meshBasicMaterial color="#ffffff" opacity={0.1} transparent depthWrite={false} />
          </mesh>
          {piece.panelAxis === "vertical" && overlapStart > 0 ? (
            <mesh position={[(-width / 2) + overlapStart / 2, 0, 0.022]}>
              <planeGeometry args={[Math.max(overlapStart, 0.01), Math.max(height, 0.01)]} />
              <meshBasicMaterial color="#111111" opacity={0.16} transparent depthWrite={false} />
            </mesh>
          ) : null}
          {piece.panelAxis === "vertical" && overlapEnd > 0 ? (
            <mesh position={[(width / 2) - overlapEnd / 2, 0, 0.022]}>
              <planeGeometry args={[Math.max(overlapEnd, 0.01), Math.max(height, 0.01)]} />
              <meshBasicMaterial color="#111111" opacity={0.16} transparent depthWrite={false} />
            </mesh>
          ) : null}
          {piece.panelAxis === "horizontal" && overlapStart > 0 ? (
            <mesh position={[0, (height / 2) - overlapStart / 2, 0.022]}>
              <planeGeometry args={[Math.max(width, 0.01), Math.max(overlapStart, 0.01)]} />
              <meshBasicMaterial color="#111111" opacity={0.16} transparent depthWrite={false} />
            </mesh>
          ) : null}
          {piece.panelAxis === "horizontal" && overlapEnd > 0 ? (
            <mesh position={[0, (-height / 2) + overlapEnd / 2, 0.022]}>
              <planeGeometry args={[Math.max(width, 0.01), Math.max(overlapEnd, 0.01)]} />
              <meshBasicMaterial color="#111111" opacity={0.16} transparent depthWrite={false} />
            </mesh>
          ) : null}
          <Text
            position={[0, Math.max(height / 2 - 0.08, -height / 2 + 0.08), 0.03]}
            fontSize={0.05}
            color="#111111"
            anchorX="center"
            anchorY="top"
            fontWeight="bold"
            renderOrder={11}
            depthOffset={-11}
            material-depthWrite={false}
            material-depthTest={false}
          >
            {`Panel ${piece.panelIndex}`}
          </Text>
        </group>
      ) : null}
      {piece.rotated ? (
        <group position={[Math.max(width / 2 - 0.16, 0), Math.max(height / 2 - 0.08, 0), 0.028]}>
          <Text
            position={[0, 0, 0.01]}
            fontSize={0.075}
            color="#111111"
            anchorX="center"
            anchorY="middle"
            fontWeight="bold"
            renderOrder={11}
            depthOffset={-11}
            material-depthWrite={false}
            material-depthTest={false}
          >
            ↻
          </Text>
        </group>
      ) : null}
      <group rotation={[0, 0, shouldRotateText ? Math.PI / 2 : 0]}>
        <Text
          position={
            shouldRotateText
              ? [-rotatedLaneOffset, 0, 0.03]
              : [0, labelOffsetY, 0.03]
          }
          fontSize={labelFontSize}
          maxWidth={Math.max(textBlockWidth * 0.82, compactTextMode ? 0.28 : 0.2)}
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
          position={
            shouldRotateText
              ? [rotatedLaneOffset, 0, 0.03]
              : [0, -detailOffsetY, 0.03]
          }
          fontSize={detailFontSize}
          maxWidth={shouldRotateText ? Math.max(textBlockWidth * 1.8, 1.6) : Math.max(textBlockWidth * 0.86, compactTextMode ? 0.3 : 0.22)}
          color={piece.textColor || "#111"}
          anchorX="center"
          anchorY="middle"
          whiteSpace="nowrap"
          renderOrder={10}
          depthOffset={-10}
          material-transparent
          material-opacity={0.8}
          material-depthWrite={false}
          material-depthTest={false}
        >
          {detailText}
        </Text>
      </group>
      {showsOriginalOutline ? (
        <Line
          points={originalOutlinePoints}
          color="#ffffff"
          lineWidth={2}
          dashed
          dashSize={0.12}
          gapSize={0.06}
          transparent
          opacity={0.95}
          renderOrder={12}
          depthTest={false}
        />
      ) : null}
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
  panelizado = false,
  panelAxis = null,
  panelCount = 0,
  panelOverlap = null,
  panelMaxWidth = null,
  panelDistribution = null,
  panelWidthInterpretation = null,
  panelMode = null,
}: PlotterSimulatorProps) {
  const [spacePressed, setSpacePressed] = useState(false);
  const [pointerDown, setPointerDown] = useState(false);
  const hasOriginalOverlay = pieces.some((piece) => {
    if (piece.panelIndex) return false;
    const originalPlacementWidth = piece.rotated ? (piece.originalH ?? piece.h) : (piece.originalW ?? piece.w);
    const originalPlacementHeight = piece.rotated ? (piece.originalW ?? piece.w) : (piece.originalH ?? piece.h);
    return (
      Math.abs((originalPlacementWidth ?? piece.w) - piece.w) > 0.001 ||
      Math.abs((originalPlacementHeight ?? piece.h) - piece.h) > 0.001
    );
  });

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
        {panelizado ? (
          <div className="absolute right-4 top-4 w-[240px] rounded-xl border border-white/10 bg-zinc-950/75 p-3 text-white shadow-xl backdrop-blur-md">
            <div className="space-y-2">
              <div className="flex items-start justify-between gap-3 text-sm">
                <span className="text-zinc-300">Panelizado</span>
                <span className="text-right font-medium">
                  {panelMode === "manual" ? "Manual" : "Automático"}
                </span>
              </div>
              <div className="flex items-start justify-between gap-3 text-sm">
                <span className="text-zinc-300">Dirección</span>
                <span className="text-right font-medium">
                  {panelAxis === "horizontal" ? "Horizontal" : "Vertical"}
                </span>
              </div>
              <div className="flex items-start justify-between gap-3 text-sm">
                <span className="text-zinc-300">Paneles</span>
                <span className="text-right font-medium">
                  {panelCount || pieces.filter((piece) => piece.panelIndex).length}
                </span>
              </div>
              {panelOverlap != null ? (
                <div className="flex items-start justify-between gap-3 text-sm">
                  <span className="text-zinc-300">Solape</span>
                  <span className="text-right font-medium">{panelOverlap} cm</span>
                </div>
              ) : null}
              {panelMaxWidth != null ? (
                <div className="flex items-start justify-between gap-3 text-sm">
                  <span className="text-zinc-300">Ancho máximo</span>
                  <span className="text-right font-medium">{panelMaxWidth} cm</span>
                </div>
              ) : null}
              {panelDistribution ? (
                <div className="flex items-start justify-between gap-3 text-sm">
                  <span className="text-zinc-300">Distribución</span>
                  <span className="text-right font-medium">
                    {panelDistribution === "libre" ? "Libre" : "Equilibrada"}
                  </span>
                </div>
              ) : null}
              {panelWidthInterpretation ? (
                <div className="flex items-start justify-between gap-3 text-sm">
                  <span className="text-zinc-300">Interpretación</span>
                  <span className="text-right font-medium">
                    {panelWidthInterpretation === "util" ? "Ancho útil" : "Ancho total"}
                  </span>
                </div>
              ) : null}
            </div>
            <div className="mt-3 rounded-lg border border-white/10 bg-white/5 p-2">
              <div className="mb-2 flex items-center justify-between text-[11px] uppercase tracking-wide text-zinc-300">
                <span>Esquema</span>
                <span>{pieces.filter((piece) => piece.panelIndex).length} paneles</span>
              </div>
              <div className={`flex ${panelAxis === "horizontal" ? "flex-col" : "flex-row"} gap-1`}>
                {pieces
                  .filter((piece) => piece.panelIndex)
                  .sort((a, b) => (a.panelIndex ?? 0) - (b.panelIndex ?? 0))
                  .map((piece) => {
                    const total = panelAxis === "horizontal" ? piece.h : piece.w;
                    const useful = panelAxis === "horizontal" ? (piece.usefulH ?? piece.h) : (piece.usefulW ?? piece.w);
                    const start = piece.overlapStart ?? 0;
                    const end = piece.overlapEnd ?? 0;
                    const denom = Math.max(total, 1);
                    return (
                      <div
                        key={`schema-${piece.id}`}
                        className={`flex ${panelAxis === "horizontal" ? "h-14 w-full" : "h-14 flex-1"} items-stretch overflow-hidden rounded border border-white/10 bg-zinc-900/80`}
                      >
                        {start > 0 ? <div style={{ flex: start / denom }} className="bg-orange-300/35" /> : null}
                        <div
                          style={{ flex: useful / denom }}
                          className="flex min-w-0 items-center justify-center bg-cyan-300/20 px-1 text-[10px] font-medium text-white"
                        >
                          {`P${piece.panelIndex}`}
                        </div>
                        {end > 0 ? <div style={{ flex: end / denom }} className="bg-orange-300/35" /> : null}
                      </div>
                    );
                  })}
              </div>
              <div className="mt-2 flex items-center gap-3 text-[10px] text-zinc-300">
                <span className="inline-flex items-center gap-1">
                  <span className="inline-block h-2 w-2 rounded-sm bg-cyan-300/60" />
                  Área útil
                </span>
                <span className="inline-flex items-center gap-1">
                  <span className="inline-block h-2 w-2 rounded-sm bg-orange-300/60" />
                  Solape
                </span>
              </div>
            </div>
          </div>
        ) : null}
        {hasOriginalOverlay ? (
          <div className="absolute left-4 top-4 rounded-xl border border-white/10 bg-zinc-950/75 px-3 py-2 text-xs text-white shadow-xl backdrop-blur-md">
            Línea punteada: medida original antes de la demasía
          </div>
        ) : null}
        <div className="absolute bottom-6 left-1/2 flex -translate-x-1/2 items-center gap-3 rounded-full border border-zinc-800/50 bg-zinc-900/60 px-6 py-2 shadow-xl backdrop-blur-md">
          <Maximize2 className="h-4 w-4 text-zinc-400" />
          <span className="text-xs font-medium text-zinc-300">Arrastrá para rotar • Rueda para zoom • Espacio + arrastrar para desplazar</span>
        </div>
      </div>
    </div>
  );
}
