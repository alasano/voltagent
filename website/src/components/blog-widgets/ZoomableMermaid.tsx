import mermaid from "mermaid";
import React, { useState, useEffect } from "react";
import styles from "./ZoomableMermaid.module.css";

interface ZoomableMermaidProps {
  chart: string;
}

export default function ZoomableMermaid({
  chart,
}: ZoomableMermaidProps): JSX.Element {
  const [isZoomed, setIsZoomed] = useState(false);
  const [svg, setSvg] = useState<string>("");

  useEffect(() => {
    mermaid.initialize({
      startOnLoad: true,
      theme: "default",
      securityLevel: "loose",
    });

    const renderChart = async () => {
      try {
        const { svg } = await mermaid.render("mermaid-diagram", chart);
        setSvg(svg);
      } catch (error) {
        console.error("Failed to render Mermaid diagram:", error);
      }
    };

    renderChart();
  }, [chart]);

  return (
    <div className={styles.container}>
      {/* biome-ignore lint/a11y/useKeyWithClickEvents: ignore */}
      <div
        className={`${styles.mermaidWrapper} ${isZoomed ? styles.zoomed : ""}`}
        onClick={() => setIsZoomed(!isZoomed)}
      >
        <div
          className={styles.diagram}
          // biome-ignore lint/security/noDangerouslySetInnerHtml: ignore
          dangerouslySetInnerHTML={{ __html: svg }}
        />
        <div className={styles.zoomHint}>
          {isZoomed ? "Click to minimize" : "Click to zoom"}
        </div>
      </div>
      {isZoomed && (
        // biome-ignore lint/a11y/useKeyWithClickEvents: ignore
        <div className={styles.overlay} onClick={() => setIsZoomed(false)} />
      )}
    </div>
  );
}
