import React, { useEffect, useRef } from "react";
import { getSharedAudioContext } from "../utils/audioSynth";

export function AudioVisualizer({ stream, isRecording }) {
  const canvasRef = useRef(null);
  const animationRef = useRef(null);
  const analyserRef = useRef(null);
  const sourceRef = useRef(null);

  useEffect(() => {
    if (!stream || !isRecording) {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
      cleanupAudio();
      drawSilent();
      return;
    }

    try {
      // Use the single global shared audio context to prevent Safari freeze/memory issues
      const audioContext = getSharedAudioContext();
      
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 2048;
      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);

      const source = audioContext.createMediaStreamSource(stream);
      source.connect(analyser);

      analyserRef.current = analyser;
      sourceRef.current = source;

      const canvas = canvasRef.current;
      const ctx = canvas.getContext("2d");
      
      const dpr = window.devicePixelRatio || 1;
      canvas.width = canvas.clientWidth * dpr;
      canvas.height = canvas.clientHeight * dpr;
      ctx.scale(dpr, dpr);

      let phase = 0;

      const draw = () => {
        if (!analyserRef.current) return;
        
        animationRef.current = requestAnimationFrame(draw);
        
        const width = canvas.width / dpr;
        const height = canvas.height / dpr;

        // Prevent division by zero if canvas is temporarily hidden / width is 0
        if (width <= 0 || height <= 0) return;
        
        analyser.getByteTimeDomainData(dataArray);
        
        ctx.fillStyle = "#F8F9FA";
        ctx.fillRect(0, 0, width, height);

        let sum = 0;
        for (let i = 0; i < bufferLength; i++) {
          const val = (dataArray[i] - 128) / 128;
          sum += val * val;
        }
        const rms = Math.sqrt(sum / bufferLength);
        const volume = Math.min(rms * 4.0, 1.0); 

        const drawWave = (color, amplitudeMult, speed, freqMult, opacity) => {
          ctx.strokeStyle = color;
          ctx.lineWidth = 2.5;
          ctx.globalAlpha = opacity;
          ctx.beginPath();

          for (let x = 0; x < width; x++) {
            const t = x / width;
            const envelope = Math.sin(t * Math.PI);
            const y = (height / 2) + Math.sin(t * Math.PI * 2 * freqMult + phase * speed) * (height * 0.4) * volume * envelope * amplitudeMult;
            
            if (x === 0) {
              ctx.moveTo(x, y);
            } else {
              ctx.lineTo(x, y);
            }
          }
          ctx.stroke();
        };

        drawWave("#007AFF", 1.0, 1.8, 1.5, 0.85);  
        drawWave("#5856D6", 0.6, -1.2, 2.5, 0.5);  
        drawWave("#30B0C7", 0.4, 2.4, 3.2, 0.3);   

        phase += 0.05;
      };

      draw();
    } catch (e) {
      console.error("Audio visualizer initialization failed", e);
      drawSilent();
    }

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
      cleanupAudio();
    };
  }, [stream, isRecording]);

  const cleanupAudio = () => {
    if (sourceRef.current) {
      try {
        sourceRef.current.disconnect();
      } catch (e) {}
      sourceRef.current = null;
    }
    analyserRef.current = null;
  };

  const drawSilent = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    
    // Check if client dimensions are non-zero before scaling
    if (canvas.clientWidth <= 0 || canvas.clientHeight <= 0) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = canvas.clientWidth * dpr;
    canvas.height = canvas.clientHeight * dpr;
    ctx.scale(dpr, dpr);
    
    const width = canvas.width / dpr;
    const height = canvas.height / dpr;
    
    ctx.fillStyle = "#F8F9FA";
    ctx.fillRect(0, 0, width, height);
    
    ctx.strokeStyle = "rgba(0, 122, 255, 0.25)";
    ctx.lineWidth = 2.5;
    ctx.globalAlpha = 1.0;
    ctx.beginPath();
    ctx.moveTo(0, height / 2);
    ctx.lineTo(width, height / 2);
    ctx.stroke();
  };

  return (
    <canvas 
      ref={canvasRef} 
      className="visualizer-canvas" 
      style={{ width: "100%", height: "100%" }}
    />
  );
}
