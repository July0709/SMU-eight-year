"use client";

import { useEffect, useRef, useState } from "react";

interface ImageViewerProps {
  src: string;
  alt?: string;
  onClose?: () => void;
  seriesIndex?: number;
  seriesCount?: number;
  onSeriesPrev?: () => void;
  onSeriesNext?: () => void;
}

export default function ImageViewer({
  src,
  alt = "",
  onClose,
  seriesIndex,
  seriesCount,
  onSeriesPrev,
  onSeriesNext,
}: ImageViewerProps) {
  const [scale, setScale] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0, px: 0, py: 0 });
  const containerRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    setScale(1);
    setRotation(0);
    setPosition({ x: 0, y: 0 });
  }, [src]);

  const handleWheel = (event: React.WheelEvent) => {
    event.preventDefault();
    const delta = event.deltaY > 0 ? -0.15 : 0.15;
    setScale((s) => Math.min(Math.max(s + delta, 0.5), 5));
  };

  const handlePointerDown = (event: React.PointerEvent) => {
    event.preventDefault();
    setDragging(true);
    dragStart.current = {
      x: event.clientX,
      y: event.clientY,
      px: position.x,
      py: position.y,
    };
    if (imgRef.current) imgRef.current.setPointerCapture(event.pointerId);
  };

  const handlePointerMove = (event: React.PointerEvent) => {
    if (!dragging) return;
    event.preventDefault();
    setPosition({
      x: dragStart.current.px + (event.clientX - dragStart.current.x),
      y: dragStart.current.py + (event.clientY - dragStart.current.y),
    });
  };

  const handlePointerUp = (event: React.PointerEvent) => {
    setDragging(false);
    if (imgRef.current) imgRef.current.releasePointerCapture(event.pointerId);
  };

  const zoomIn = () => setScale((s) => Math.min(s + 0.5, 5));
  const zoomOut = () => setScale((s) => Math.max(s - 0.5, 0.5));
  const reset = () => {
    setScale(1);
    setRotation(0);
    setPosition({ x: 0, y: 0 });
  };
  const rotate = () => setRotation((r) => (r + 90) % 360);
  const fullscreen = () => {
    if (containerRef.current?.requestFullscreen) {
      containerRef.current.requestFullscreen().catch(() => {});
    }
  };

  return (
    <div
      ref={containerRef}
      className="focus-image-wrapper"
      onWheel={handleWheel}
      onDoubleClick={reset}
    >
      <img
        ref={imgRef}
        className={`focus-image ${dragging ? "grabbing" : ""}`}
        src={src}
        alt={alt}
        draggable={false}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        style={{
          transform: `translate(${position.x}px, ${position.y}px) scale(${scale}) rotate(${rotation}deg)`,
        }}
      />

      {seriesCount && seriesCount > 1 && (
        <>
          <button
            onClick={onSeriesPrev}
            disabled={seriesIndex === 0}
            aria-label="上一张"
            style={{
              position: "absolute",
              left: 16,
              top: "50%",
              transform: "translateY(-50%)",
              width: 44,
              height: 44,
              border: 0,
              borderRadius: "50%",
              background: "rgba(15, 23, 42, 0.7)",
              color: "#fff",
              fontSize: 20,
              cursor: "pointer",
              display: "grid",
              placeItems: "center",
            }}
          >
            ‹
          </button>
          <button
            onClick={onSeriesNext}
            disabled={seriesIndex === seriesCount - 1}
            aria-label="下一张"
            style={{
              position: "absolute",
              right: 16,
              top: "50%",
              transform: "translateY(-50%)",
              width: 44,
              height: 44,
              border: 0,
              borderRadius: "50%",
              background: "rgba(15, 23, 42, 0.7)",
              color: "#fff",
              fontSize: 20,
              cursor: "pointer",
              display: "grid",
              placeItems: "center",
            }}
          >
            ›
          </button>
        </>
      )}

      <div className="image-viewer-controls">
        <button onClick={zoomOut} aria-label="缩小">−</button>
        <button onClick={reset} aria-label="重置">⌖</button>
        <button onClick={zoomIn} aria-label="放大">+</button>
        <button onClick={rotate} aria-label="旋转">↻</button>
        <button onClick={fullscreen} aria-label="全屏">⛶</button>
        {onClose && <button onClick={onClose} aria-label="关闭">✕</button>}
      </div>
    </div>
  );
}
