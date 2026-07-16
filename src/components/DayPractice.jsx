import React, { useState, useEffect, useRef } from "react";
import { AudioVisualizer } from "./AudioVisualizer";
import { Confetti } from "./Confetti";
import { playSuccessSound, playFailureSound, getSharedAudioContext } from "../utils/audioSynth";
import { askExternalAi } from "../utils/aiLauncher";

export function DayPractice({ dayData, progress, onMarkSentenceCorrect, onBack, mode, onSwitchToSpeak, onSaveMedal, passingThreshold = 70, onDayCompleted, preferredAi, geminiApiKey }) {
  const dialogue = dayData.dialogue;
  const dayProgress = progress[dayData.day] || {};

  const handleRequestAiExplanation = (sentenceEn, sentenceKo) => {
    askExternalAi(sentenceEn, sentenceKo, preferredAi);
  };

  // Find the first uncompleted sentence index
  const getInitialTurnIndex = () => {
    for (let i = 0; i < dialogue.length; i++) {
      if (dayProgress[dialogue[i].id] !== true) {
        return i;
      }
    }
    return dialogue.length; // All completed
  };

  const [activeTurnIndex, setActiveTurnIndex] = useState(() => {
    return mode === "test" ? 0 : getInitialTurnIndex();
  });
  const [revealedHints, setRevealedHints] = useState({}); // { index: boolean }
  const [isRecording, setIsRecording] = useState(false);
  const [stream, setStream] = useState(null);
  const [result, setResult] = useState(null); // { success: boolean, transcript: string }
  const [isTyping, setIsTyping] = useState(false); // Typing indicator state

  // Test Mode States
  const [hearts, setHearts] = useState(3);
  const [testStatus, setTestStatus] = useState("playing"); // "playing" | "passed" | "failed"

  const recognitionInstanceRef = useRef(null);
  const streamRef = useRef(null);
  const ttsAudioRef = useRef(null);

  const activeSentence = activeTurnIndex < dialogue.length ? dialogue[activeTurnIndex] : null;
  const isCompleted = activeTurnIndex === dialogue.length;

  // Update active turn index if dayData changes or mode changes
  useEffect(() => {
    if (mode === "test") {
      setActiveTurnIndex(0);
      setHearts(3);
      setTestStatus("playing");
    } else {
      setActiveTurnIndex(getInitialTurnIndex());
    }
    setResult(null);
    setRevealedHints({});
    setIsTyping(false);
  }, [dayData, mode]);

  // Trigger typing indicator on B's turn change
  useEffect(() => {
    if (activeTurnIndex > 0 && activeTurnIndex < dialogue.length) {
      const currentSentence = dialogue[activeTurnIndex];
      // Only simulate typing if it's Speaker B (reply)
      if (currentSentence && currentSentence.speaker === "B") {
        setIsTyping(true);
        const timer = setTimeout(() => {
          setIsTyping(false);
        }, 750); // 0.75 seconds typing simulation
        return () => clearTimeout(timer);
      }
    }
  }, [activeTurnIndex]);

  // Trigger day completion callback (streak) when completed in Practice mode
  useEffect(() => {
    if (isCompleted && mode !== "test") {
      if (onDayCompleted) {
        onDayCompleted(dayData.day, dayData.title);
      }
    }
  }, [isCompleted, mode, dayData.day, dayData.title, onDayCompleted]);

  // Clean up recording and TTS on unmount
  useEffect(() => {
    return () => {
      stopRecordingSession();
      if (ttsAudioRef.current) {
        ttsAudioRef.current.pause();
        ttsAudioRef.current = null;
      }
    };
  }, []);

  const handleSpeakTTS = (text, e) => {
    if (e) e.stopPropagation();

    // Stop any currently playing TTS audio
    if (ttsAudioRef.current) {
      ttsAudioRef.current.pause();
      ttsAudioRef.current = null;
    }

    // Stop any ongoing native speech synthesis
    if ("speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }

    const cleanText = text.replace(/\*/g, "").trim();
    if (!cleanText) return;

    // Local native fallback function to keep code clean and prevent duplicate code blocks
    const playFallback = () => {
      if ("speechSynthesis" in window) {
        const actualUtterance = new SpeechSynthesisUtterance(cleanText);
        actualUtterance.lang = "en-US";
        const voices = window.speechSynthesis.getVoices();
        
        console.log("Fallback SpeechSynthesis Voices available:", voices.map(v => `${v.name} (${v.lang})`));
        
        const usVoice = 
          voices.find(v => v.lang === "en-US" && v.name.includes("Google")) || 
          voices.find(v => v.name.includes("Online") && (v.lang === "en-US" || v.lang.startsWith("en"))) ||
          voices.find(v => v.lang === "en-US") || 
          voices.find(v => v.lang.startsWith("en"));

        if (usVoice) {
          console.log("Selected voice for fallback:", usVoice.name);
          actualUtterance.voice = usVoice;
        }
        window.speechSynthesis.speak(actualUtterance);
      } else {
        alert("이 브라우저는 음성 합성(TTS)을 지원하지 않습니다.");
      }
    };

    if (geminiApiKey) {
      // Use Gemini API for high-quality audio generation
      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-tts:generateContent?key=${geminiApiKey}`;
      
      const payload = {
        contents: [{
          parts: [{
            text: `Read this English sentence. Do not add any extra commentary or text, just say this sentence clearly: "${cleanText}"`
          }]
        }],
        generationConfig: {
          responseModalities: ["AUDIO"],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: {
                voiceName: "Aoede" // Premium female voice. Other options: Puck, Kore, Fenrir, Charon
              }
            }
          }
        }
      };

      fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
      })
      .then(async res => {
        if (!res.ok) {
          try {
            const errJson = await res.json();
            console.error("Gemini API Error Response:", errJson);
            throw new Error(`Gemini API error: ${res.status} - ${errJson.error?.message || "Unknown"}`);
          } catch (e) {
            throw new Error(`Gemini API error: ${res.status}`);
          }
        }
        return res.json();
      })
      .then(data => {
        const candidate = data.candidates?.[0];
        const partWithAudio = candidate?.content?.parts?.find(p => p.inlineData);
        if (!partWithAudio || !partWithAudio.inlineData?.data) {
          throw new Error("No audio data returned from Gemini API");
        }
        const base64Data = partWithAudio.inlineData.data;
        const mimeType = partWithAudio.inlineData.mimeType || "audio/x-wav";

        // Convert base64 data to binary bytes
        const binaryString = atob(base64Data);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }

        const blob = new Blob([bytes], { type: mimeType });
        const audioUrl = URL.createObjectURL(blob);
        const audio = new Audio(audioUrl);
        ttsAudioRef.current = audio;
        audio.play().catch(err => {
          console.warn("Gemini Audio play failed, falling back.", err);
          playFallback();
        });
      })
      .catch(err => {
        console.warn("Gemini API call failed, falling back to browser synthesis.", err);
        playFallback();
      });
    } else {
      // If no API key, use fallback browser speech synthesis directly
      playFallback();
    }
  };

  const toggleHint = (index) => {
    setRevealedHints(prev => ({
      ...prev,
      [index]: !prev[index]
    }));
  };

  const startRecordingSession = () => {
    setResult(null);
    setIsRecording(true);

    // Stop any playing TTS audio when recording starts
    if (ttsAudioRef.current) {
      ttsAudioRef.current.pause();
      ttsAudioRef.current = null;
    }
    if ("speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }

    try {
      const ctx = getSharedAudioContext();
      if (ctx && ctx.state === "suspended") {
        ctx.resume();
      }
    } catch (e) {
      console.log("AudioContext resume error on user gesture:", e);
    }

    const SpeechRecognitionClass = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognitionClass) {
      alert("이 브라우저는 음성 인식을 지원하지 않습니다. 크롬이나 사파리를 사용해 주세요.");
      setIsRecording(false);
      return;
    }

    try {
      const rec = new SpeechRecognitionClass();
      rec.lang = "en-US";
      rec.interimResults = false;
      rec.maxAlternatives = 1;
      recognitionInstanceRef.current = rec;

      rec.onstart = () => {
        console.log("Speech recognition started");
      };

      rec.onerror = (event) => {
        console.error("Speech recognition error", event.error);
        if (event.error !== "no-speech") {
          setIsRecording(false);
          stopMicStream();
        }
      };

      rec.onend = () => {
        console.log("Speech recognition ended");
        setIsRecording(false);
        stopMicStream();
      };

      rec.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        processSpeechResult(transcript);
      };

      rec.start();
    } catch (err) {
      console.error("Failed to start SpeechRecognition", err);
      setIsRecording(false);
      stopMicStream();
      return;
    }

    // Delay visualizer's getUserMedia request by 150ms to prevent iOS hardware mic lockup
    setTimeout(() => {
      if (!recognitionInstanceRef.current) return;
      navigator.mediaDevices.getUserMedia({ audio: true })
        .then((audioStream) => {
          streamRef.current = audioStream;
          setStream(audioStream);
        })
        .catch((err) => {
          console.error("Failed to get microphone stream for visualizer", err);
        });
    }, 150);
  };

  const stopRecordingSession = () => {
    if (recognitionInstanceRef.current) {
      try {
        recognitionInstanceRef.current.stop();
      } catch (e) {}
      recognitionInstanceRef.current = null;
    }
    setIsRecording(false);
    stopMicStream();
  };

  const stopMicStream = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setStream(null);
  };

  const normalizeText = (text) => {
    if (!text) return "";
    let clean = text.toLowerCase()
      .replace(/\*/g, "") // Remove asterisks
      .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?]/g, "") // Strip punctuation
      .replace(/\s+/g, " ") // Clean double spaces
      .trim();
    
    const contractions = {
      "i'll": "i will",
      "ill": "i will",
      "don't": "do not",
      "dont": "do not",
      "isn't": "is not",
      "isnt": "is not",
      "i'm": "i am",
      "im": "i am",
      "you're": "you are",
      "youre": "you are",
      "let's": "let us",
      "lets": "let us",
      "we've": "we have",
      "weve": "we have",
      "can't": "cannot",
      "cant": "can not",
      "it's": "it is",
      "its": "it is"
    };
    
    const words = clean.split(" ");
    const expanded = words.map(w => contractions[w] || w);
    return expanded.join(" ");
  };

  // Word-level Levenshtein Distance similarity
  const getSimilarity = (s1, s2) => {
    if (!s1 || !s2) return 0;
    const words1 = s1.split(" ");
    const words2 = s2.split(" ");
    
    const track = Array(words2.length + 1).fill(null).map(() =>
      Array(words1.length + 1).fill(null)
    );
    for (let i = 0; i <= words1.length; i += 1) track[0][i] = i;
    for (let j = 0; j <= words2.length; j += 1) track[j][0] = j;
    
    for (let j = 1; j <= words2.length; j += 1) {
      for (let i = 1; i <= words1.length; i += 1) {
        const indicator = words1[i - 1] === words2[j - 1] ? 0 : 1;
        track[j][i] = Math.min(
          track[j - 1][i] + 1, // deletion
          track[j][i - 1] + 1, // insertion
          track[j - 1][i - 1] + indicator // substitution
        );
      }
    }
    const distance = track[words2.length][words1.length];
    const maxLength = Math.max(words1.length, words2.length);
    return (maxLength - distance) / maxLength;
  };

  // Helper to render color-coded word highlights for speech diagnostics
  const renderWordHighlights = (correctSentence, spokenText) => {
    if (!spokenText) return <div style={{ fontSize: "14.5px", fontWeight: "500", color: "var(--text-muted)", opacity: 0.4, marginTop: "4px" }}>{correctSentence}</div>;
    
    const cleanSpokenWords = spokenText
      .toLowerCase()
      .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?]/g, "")
      .trim()
      .split(/\s+/);
      
    const correctWords = correctSentence.split(/\s+/);
    
    return (
      <div className="word-highlights-container" style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: "6px 4px", marginTop: "8px" }}>
        {correctWords.map((word, idx) => {
          const cleanWord = word
            .toLowerCase()
            .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?]/g, "");
            
          const isMatched = cleanSpokenWords.includes(cleanWord);
          
          return (
            <span 
              key={idx} 
              className={`word-hl-item ${isMatched ? "correct" : "incorrect"}`}
              style={{
                fontSize: "14.5px",
                fontWeight: isMatched ? "800" : "500",
                color: isMatched ? "var(--accent-color)" : "var(--text-muted)",
                textDecoration: isMatched ? "underline" : "none",
                textDecorationColor: isMatched ? "rgba(124, 58, 237, 0.4)" : "transparent",
                opacity: isMatched ? 1 : 0.35,
                padding: "2px 4px",
                display: "inline-block",
                transition: "all 0.2s"
              }}
            >
              {word}
            </span>
          );
        })}
      </div>
    );
  };

  const processSpeechResult = (spokenText) => {
    const activeSentence = dialogue[activeTurnIndex];
    if (!activeSentence) return;

    const normalizedSpoken = normalizeText(spokenText);
    const normalizedCorrect = normalizeText(activeSentence.en);

    const similarity = getSimilarity(normalizedSpoken, normalizedCorrect);
    const thresholdVal = passingThreshold || 70;
    const isCorrect = similarity >= (thresholdVal / 100);

    if (isCorrect) {
      playSuccessSound();
      onMarkSentenceCorrect(dayData.day, activeSentence.id, true);
      
      setResult({
        success: true,
        transcript: spokenText,
        score: Math.round(similarity * 100)
      });
      
      setTimeout(() => {
        if (mode === "test" && activeTurnIndex === dialogue.length - 1) {
          let medalType = "bronze";
          if (hearts === 3) medalType = "gold";
          else if (hearts === 2) medalType = "silver";
          
          if (onSaveMedal) {
            onSaveMedal(dayData.day, medalType);
          }
          if (onDayCompleted) {
            onDayCompleted(dayData.day, dayData.title);
          }
          setTestStatus("passed");
        } else {
          setActiveTurnIndex(prev => prev + 1);
        }
        setResult(null);
      }, 1400);

    } else {
      playFailureSound();
      
      if (mode === "test") {
        setHearts(prev => {
          const nextHearts = prev - 1;
          if (nextHearts === 0) {
            setTimeout(() => {
              setTestStatus("failed");
            }, 1400);
          }
          return nextHearts;
        });
      }

      setResult({
        success: false,
        transcript: spokenText,
        score: Math.round(similarity * 100)
      });
    }
  };

  const handleReset = () => {
    dialogue.forEach(item => {
      onMarkSentenceCorrect(dayData.day, item.id, false);
    });
    setActiveTurnIndex(0);
    setResult(null);
    setRevealedHints({});
    setIsTyping(false);
  };



  if (mode === "test" && testStatus !== "playing") {
    const isPassed = testStatus === "passed";
    let score = 0;
    let medal = "";
    let medalText = "";
    
    if (isPassed) {
      if (hearts === 3) { score = 100; medal = "🥇"; medalText = "금메달 (완벽해요!)"; }
      else if (hearts === 2) { score = 85; medal = "🥈"; medalText = "은메달 (훌륭해요!)"; }
      else { score = 70; medal = "🥉"; medalText = "동메달 (패스!)"; }
    }

    return (
      <div className="practice-layout" style={{ overflowY: "auto" }}>
        <div className="duo-report-container" style={{ padding: "30px 20px calc(var(--safe-bottom) + 50px)", display: "flex", flexDirection: "column", alignItems: "center", width: "100%", boxSizing: "border-box" }}>
          <div className="duo-report-card">
            {isPassed ? (
              <>
                <div className="duo-report-medal" style={{ fontSize: "70px", textAlign: "center" }}>
                  {medal}
                </div>
                <h2 className="duo-report-title" style={{ color: "var(--success-color)", fontSize: "22px", fontWeight: "850", textAlign: "center", marginTop: "10px" }}>
                  스피킹 시험 합격!
                </h2>
                <p style={{ textAlign: "center", color: "var(--text-secondary)", fontSize: "14px", marginTop: "4px" }}>
                  {medalText}
                </p>
                
                <div className="duo-report-stats" style={{ display: "flex", gap: "12px", justifyContent: "center", margin: "20px 0", width: "100%" }}>
                  <div className="duo-stat-card" style={{ flex: 1, padding: "14px 10px", borderRadius: "18px", border: "2px solid #E2E8F0", borderBottom: "5px solid #CBD5E1", textAlign: "center", background: "#FFFFFF" }}>
                    <div className="duo-stat-label" style={{ fontSize: "10px", color: "var(--text-muted)", fontWeight: "750" }}>최종 점수</div>
                    <div className="duo-stat-val" style={{ fontSize: "22px", fontWeight: "850", color: "var(--success-color)", marginTop: "4px" }}>{score}점</div>
                  </div>
                  <div className="duo-stat-card" style={{ flex: 1, padding: "14px 10px", borderRadius: "18px", border: "2px solid #E2E8F0", borderBottom: "5px solid #CBD5E1", textAlign: "center", background: "#FFFFFF" }}>
                    <div className="duo-stat-label" style={{ fontSize: "10px", color: "var(--text-muted)", fontWeight: "750" }}>남은 하트</div>
                    <div className="duo-stat-val" style={{ fontSize: "22px", fontWeight: "850", color: "#FF9500", marginTop: "4px" }}>{hearts} / 3</div>
                  </div>
                </div>
              </>
            ) : (
              <>
                <div className="duo-report-medal" style={{ fontSize: "70px", textAlign: "center" }}>
                  😢
                </div>
                <h2 className="duo-report-title" style={{ color: "#FF3B30", fontSize: "22px", fontWeight: "850", textAlign: "center", marginTop: "10px" }}>
                  아쉽게도 탈락했습니다...
                </h2>
                <p style={{ textAlign: "center", color: "var(--text-secondary)", fontSize: "14px", marginTop: "4px" }}>
                  하트 3개를 모두 잃었습니다. 조금만 더 연습해 볼까요?
                </p>
              </>
            )}

            <div className="duo-review-card" style={{ background: "#F2F2F7", borderRadius: "20px", padding: "16px", marginTop: "12px", width: "100%", boxSizing: "border-box" }}>
              <h3 style={{ fontSize: "14px", fontWeight: "750", marginBottom: "12px", textAlign: "left", width: "100%" }}>오늘의 대화 복습</h3>
              <div className="duo-review-list" style={{ maxHeight: "200px", overflowY: "auto", display: "flex", flexDirection: "column", gap: "8px", width: "100%" }}>
                {dialogue.map((item) => (
                  <div key={item.id} className="duo-review-item" style={{ background: "#FFFFFF", padding: "10px 12px", borderRadius: "12px", border: "1px solid rgba(0,0,0,0.04)", width: "100%", boxSizing: "border-box", display: "flex", flexDirection: "column", alignItems: "flex-start", gap: "2px" }}>
                    <span style={{ fontSize: "10px", fontWeight: "750", color: "var(--text-muted)" }}>
                      {item.speaker === "A" ? "Hun Sang" : "Han Bi"}
                    </span>
                    <div style={{ fontSize: "13px", fontWeight: "600", color: "var(--text-secondary)", textAlign: "left" }}>{item.ko}</div>
                    <div style={{ fontSize: "13.5px", fontWeight: "700", color: "var(--accent-color)", marginTop: "2px", textAlign: "left" }}>{item.en.replace(/\*/g, "")}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="duo-report-actions" style={{ display: "flex", flexDirection: "column", gap: "10px", marginTop: "20px", width: "100%" }}>
              <button 
                className="duo-btn-primary" 
                onClick={() => {
                  setHearts(3);
                  setActiveTurnIndex(0);
                  setTestStatus("playing");
                }}
              >
                {isPassed ? "다시 도전하기 🏆" : "재시험 치기 🔄"}
              </button>
              <button className="duo-btn-secondary" onClick={onBack}>
                대시보드로 돌아가기
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (mode === "preview") {
    return (
      <div className="preview-layout">
        <div className="preview-scroll-container">
          <div className="preview-intro-card">
            <h3>📖 전체 대화 대본</h3>
            <p>훈련 전에 대본을 읽어보고 재생 버튼을 눌러 원어민 발음을 들어보세요.</p>
          </div>
          
          <div className="preview-dialogue-list">
            {dialogue.map((item) => (
              <div key={item.id} className={`preview-msg-row ${item.speaker}`}>
                <div className="preview-speaker-label">
                  {item.speaker === "A" ? "Hun Sang" : "Han Bi"}
                </div>
                <div className="preview-bubble" onClick={(e) => handleSpeakTTS(item.en, e)}>
                  <div className="ko">{item.ko}</div>
                  <div className="en">{item.en.replace(/\*/g, "")}</div>
                  <div style={{ display: "flex", gap: "6px", marginTop: "8px" }}>
                    <button className="preview-tts-btn" onClick={(e) => { e.stopPropagation(); handleSpeakTTS(item.en, e); }}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M3 9V15H7L12 20V4L7 9H3ZM16.5 12C16.5 10.23 15.48 8.71 14 8V16C15.48 15.29 16.5 13.77 16.5 12Z" fill="currentColor"/>
                      </svg>
                      듣기
                    </button>
                    <button 
                      className="preview-ai-btn" 
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRequestAiExplanation(item.en, item.ko);
                      }}
                      style={{
                        background: "linear-gradient(135deg, rgba(124, 58, 237, 0.12) 0%, rgba(255, 90, 95, 0.12) 100%)",
                        color: "var(--accent-color)",
                        border: "none",
                        borderRadius: "10px",
                        padding: "5px 12px",
                        fontSize: "11.5px",
                        fontWeight: "800",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "4px",
                        cursor: "pointer",
                        boxShadow: "0 2px 5px rgba(0,0,0,0.02)",
                        transition: "all 0.2s"
                      }}
                    >
                      💬 AI 질문
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
          
          <div className="preview-footer-action">
            <button className="duo-btn-primary" onClick={onSwitchToSpeak}>
              실전 말하기 훈련 시작 🎙️
            </button>
            <button className="duo-btn-secondary" style={{ marginTop: "8px" }} onClick={onBack}>
              대시보드로 돌아가기
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="practice-layout">
      {/* Confetti Celebration Particle Effect */}
      <Confetti active={isCompleted} />

      {/* Stepper Header (Duolingo Style) */}
      {!isCompleted && (
        <div className="duo-stepper-header">
          <button className="duo-close-btn" onClick={onBack} title="종료">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M19 6.41L17.59 5L12 10.59L6.41 5L5 6.41L10.59 12L5 17.59L6.41 19L12 13.41L17.59 19L19 17.59L13.41 12L19 6.41Z" fill="currentColor"/>
            </svg>
          </button>
          
          <div className="duo-progress-container">
            <div 
              className="duo-progress-fill" 
              style={{ width: `${(activeTurnIndex / dialogue.length) * 100}%` }}
            />
          </div>
          
          <span className="duo-progress-text">
            {activeTurnIndex}/{dialogue.length}
          </span>
          
          {mode === "test" && (
            <div className="duo-hearts-display" style={{ display: "flex", gap: "4px", marginLeft: "12px", alignItems: "center" }}>
              {Array(3).fill(null).map((_, i) => (
                <span key={i} style={{ fontSize: "16px", opacity: i < hearts ? 1 : 0.25, transition: "opacity 0.2s" }}>
                  ❤️
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Card Stage / Carousel View */}
      {!isCompleted ? (
        <div className="duo-card-stage">
          {dialogue.map((item, index) => {
            const isActive = index === activeTurnIndex;
            const isPassed = index < activeTurnIndex;
            
            let transformClass = "";
            if (isActive) transformClass = "active";
            else if (isPassed) transformClass = "passed";
            else transformClass = "future";

            const isRevealed = revealedHints[index] === true;

            return (
              <div 
                key={item.id} 
                className={`duo-dialogue-card ${transformClass} ${item.speaker}`}
              >
                <div className="hunsang-avatar-profile">
                  <div className={`hunsang-avatar-circle ${item.speaker}`}>
                    {item.speaker === "A" ? "HS" : "HB"}
                  </div>
                  <span className="hunsang-avatar-name">
                    {item.speaker === "A" ? "Hun Sang" : "Han Bi"}
                  </span>
                </div>
                
                {isActive && isTyping ? (
                  /* B Typing Indicator inside B's Card */
                  <div className="duo-card-typing">
                    <span className="duo-typing-label">대답을 생각하는 중</span>
                    <div className="typing-indicator">
                      <span></span>
                      <span></span>
                      <span></span>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="duo-ko-text">"{item.ko}"</div>
                    
                    {/* English Hint / Target reveal */}
                    {mode !== "test" && (
                      <div 
                        className="duo-en-hint-box" 
                        onClick={() => isActive && toggleHint(index)}
                      >
                        {isRevealed ? (
                          <div className="duo-en-text">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                              <path d="M12 2C6.48 2 2 6.48 2 12C2 17.52 6.48 22 12 22C17.52 22 22 17.52 22 12C22 6.48 17.52 2 12 2ZM13 17H11V15H13V17ZM13 13H11V7H13V13Z" fill="currentColor"/>
                            </svg>
                            {item.en.replace(/\*/g, "")}
                          </div>
                        ) : (
                          <>
                            <div className="duo-en-text blurred">
                              {item.en.replace(/\*/g, "")}
                            </div>
                            <div className="duo-lock-hint">
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path d="M18 8H17V6C17 3.24 14.76 1 12 1C9.24 1 7 3.24 7 6V8H6C4.9 8 4 8.9 4 10V20C4 21.1 4.9 22 6 22H18C19.1 22 20 21.1 20 20V10C20 8.9 19.1 8 18 8ZM9 6C9 4.34 10.34 3 12 3C13.66 3 15 4.34 15 6V8H9V6ZM18 20H6V10H18V20ZM12 13C10.9 13 10 13.9 10 15C10 16.1 10.9 17 12 17C13.1 17 14 16.1 14 15C14 13.9 13.1 13 12 13Z" fill="currentColor"/>
                              </svg>
                              터치하여 영어 힌트 보기
                            </div>
                          </>
                        )}
                      </div>
                    )}
                    
                    {/* Floating AI Explain Button inside card */}
                    {isActive && mode !== "test" && (
                      <button
                        className="card-ai-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRequestAiExplanation(item.en, item.ko);
                        }}
                        style={{
                          position: "absolute",
                          bottom: "12px",
                          right: "12px",
                          background: "linear-gradient(135deg, rgba(124, 58, 237, 0.12) 0%, rgba(255, 90, 95, 0.12) 100%)",
                          color: "var(--accent-color)",
                          border: "none",
                          borderRadius: "12px",
                          padding: "5px 12px",
                          fontSize: "11.5px",
                          fontWeight: "800",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "4px",
                          cursor: "pointer",
                          boxShadow: "0 2px 6px rgba(124, 58, 237, 0.08)",
                          transition: "all 0.2s"
                        }}
                      >
                        💬 AI 질문
                      </button>
                    )}
                  </>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        /* ---------------------------------------------------- */
        /* Duolingo-Style Completion View                       */
        /* ---------------------------------------------------- */
      <div className="duo-completion-view">
        <div className="duo-report-card">
          <div className="duo-radial-progress-wrapper">
            <div className="duo-radial-progress">
              <svg className="duo-radial-svg" viewBox="0 0 100 100">
                <circle className="circle-bg" cx="50" cy="50" r="40" />
                <circle className="circle-fill" cx="50" cy="50" r="40" />
              </svg>
              <div className="duo-radial-inner">
                <svg width="34" height="34" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M12 2C6.48 2 2 6.48 2 12C2 17.52 6.48 22 12 22C17.52 22 22 17.52 22 12C22 6.48 17.52 2 12 2ZM9 16.17L4.83 12L3.41 13.41L9 19L21 7L19.59 5.59L9 16.17Z" fill="currentColor"/>
                </svg>
              </div>
            </div>
          </div>

          <h2 className="duo-completion-title" style={{ fontSize: "22px", fontWeight: "850", marginTop: "10px" }}>오늘의 대화 완료!</h2>
          <p className="duo-completion-subtitle" style={{ color: "var(--text-secondary)", fontSize: "14px", marginTop: "4px", marginBottom: "20px" }}>
            Day {dayData.day}의 모든 훈련을 성공적으로 마쳤습니다.
          </p>

          {/* Stats Box */}
          <div className="duo-report-stats" style={{ display: "flex", gap: "12px", width: "100%", margin: "16px 0" }}>
            <div className="duo-report-stat-item" style={{ flex: 1, background: "#FFFFFF", border: "2px solid #E2E8F0", borderBottom: "5px solid #CBD5E1", borderRadius: "18px", padding: "14px 10px", textAlign: "center" }}>
              <div style={{ fontSize: "10px", color: "var(--text-muted)", fontWeight: "750" }}>연습 문장</div>
              <div style={{ fontSize: "22px", fontWeight: "850", color: "var(--accent-color)", marginTop: "4px" }}>6 / 6</div>
            </div>
            <div className="duo-report-stat-item" style={{ flex: 1, background: "#FFFFFF", border: "2px solid #E2E8F0", borderBottom: "5px solid #CBD5E1", borderRadius: "18px", padding: "14px 10px", textAlign: "center" }}>
              <div style={{ fontSize: "10px", color: "var(--text-muted)", fontWeight: "750" }}>학습 성공률</div>
              <div style={{ fontSize: "22px", fontWeight: "850", color: "var(--success-color)", marginTop: "4px" }}>100%</div>
            </div>
          </div>

          {/* Vocabulary Review Section */}
          <div className="duo-review-card" style={{ background: "#F2F2F7", borderRadius: "20px", padding: "16px", marginTop: "12px", width: "100%", boxSizing: "border-box" }}>
            <h3 style={{ fontSize: "14px", fontWeight: "750", marginBottom: "12px", textAlign: "left", width: "100%", display: "flex", alignItems: "center", gap: "8px" }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 3L1 9L12 15L21 10.09V17H23V9L12 3ZM12 5.18L18.97 9L12 12.82L5.03 9L12 5.18ZM12 17.3L5 13.7V17L12 20.3L19 17V13.7L12 17.3Z" fill="currentColor"/>
              </svg>
              핵심 표현 오디오 복습
            </h3>
            <div className="duo-review-list" style={{ width: "100%" }}>
              {dayData.vocabulary.map((vocab, index) => (
                <div key={index} className="duo-review-item" style={{ width: "100%", display: "flex", justifyContent: "space-between", alignItems: "center", paddingBottom: "8px", borderBottom: "1px solid rgba(0,0,0,0.04)" }}>
                  <div className="duo-vocab-info" style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: "2px" }}>
                    <span className="duo-vocab-phrase" style={{ fontSize: "14px", fontWeight: "700", color: "var(--accent-color)" }}>{vocab.phrase}</span>
                    <span className="duo-vocab-meaning" style={{ fontSize: "13px", color: "var(--text-secondary)" }}>{vocab.meaning}</span>
                  </div>
                  <button 
                    className="duo-vocab-listen-btn" 
                    onClick={(e) => handleSpeakTTS(vocab.phrase, e)}
                    title="원어민 발음 듣기"
                    style={{ width: "32px", height: "32px", borderRadius: "50%", background: "var(--accent-light)", color: "var(--accent-color)", border: "none", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M3 9V15H7L12 20V4L7 9H3ZM16.5 12C16.5 10.23 15.48 8.71 14 8V16C15.48 15.29 16.5 13.77 16.5 12ZM14 3.23V5.29C16.89 6.15 19 8.83 19 12C19 15.17 16.89 17.85 14 18.71V20.77C18.01 19.86 21 16.28 21 12C21 7.72 18.01 4.14 14 3.23Z" fill="currentColor"/>
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Action Footer Buttons */}
          <div className="duo-actions" style={{ width: "100%", display: "flex", flexDirection: "column", gap: "10px", marginTop: "20px" }}>
            <button className="duo-btn-primary" onClick={onBack}>
              계속하기
            </button>
            <button className="duo-btn-secondary" onClick={handleReset}>
              다시 연습하기
            </button>
          </div>
        </div>
      </div>
      )}

      {/* Fixed Bottom Control Bar (Hidden when complete) */}
      {!isCompleted && (
        <div className={`bottom-control-panel ${isRecording || result || isTyping ? "expanded" : ""}`}>
          
          {isTyping ? (
            /* B is Typing Placeholder */
            <div className="prompt-box" style={{ background: "none" }}>
              <div style={{ fontSize: "14px", fontWeight: "600", color: "var(--text-muted)", display: "flex", alignItems: "center", justifyContent: "center", gap: "8px" }}>
                <span>상대방이 대답할 말을 적는 중</span>
                <span className="typing-indicator" style={{ display: "inline-flex" }}>
                  <span></span>
                  <span></span>
                  <span></span>
                </span>
              </div>
            </div>
          ) : (
            /* Normal Interactive Controls */
            <>
              {/* Active Prompt */}
              <div className="prompt-box">
                <div className="prompt-title">말해야 할 한글 문장</div>
                <div className="prompt-text">"{activeSentence?.ko}"</div>
              </div>

              {/* Dynamic Audio Visualizer or Speech Feedbacks */}
              <div className={`visualizer-box ${result ? "has-result" : ""}`}>
                {isRecording && (
                  <AudioVisualizer stream={stream} isRecording={isRecording} />
                )}
                
                {!isRecording && !result && (
                  <span className="visualizer-placeholder">아래 마이크 버튼을 눌러 말해보세요</span>
                )}
                
                {!isRecording && result && (
                  <div style={{ width: "100%" }}>
                    {result.success ? (
                      <div className="panel-feedback success" style={{ color: "var(--success-color)", fontWeight: "bold", textAlign: "center" }}>
                        정답입니다!
                      </div>
                    ) : (
                      <div className="panel-feedback error">
                        <strong>인식 결과: "{result.transcript || "(아무 소리도 인식 안 됨)"}"</strong>
                        {mode !== "test" ? (
                          <>
                            <div style={{ fontSize: "12px", color: "var(--text-muted)", fontWeight: "750", marginTop: "8px", borderTop: "1px solid rgba(0,0,0,0.05)", paddingTop: "8px" }}>발음 매칭 분석:</div>
                            {renderWordHighlights(activeSentence?.en.replace(/\*/g, ""), result.transcript)}
                            <button
                              onClick={() => activeSentence && handleRequestAiExplanation(activeSentence.en, activeSentence.ko)}
                              style={{
                                marginTop: "12px",
                                background: "linear-gradient(135deg, rgba(124, 58, 237, 0.12) 0%, rgba(255, 90, 95, 0.12) 100%)",
                                color: "var(--accent-color)",
                                border: "none",
                                borderRadius: "10px",
                                padding: "8px 14px",
                                fontSize: "12px",
                                fontWeight: "800",
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "4px",
                                cursor: "pointer",
                                width: "100%",
                                justifyContent: "center",
                                boxShadow: "0 2px 6px rgba(124, 58, 237, 0.05)",
                                transition: "all 0.2s"
                              }}
                            >
                              💬 AI에게 이 문장 질문하기
                            </button>
                          </>
                        ) : null}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Action Row */}
              <div className="actions-row">
                {/* Hint Button */}
                <button 
                  className={`btn-action-side hint ${revealedHints[activeTurnIndex] ? "hint-active" : ""}`}
                  onClick={() => toggleHint(activeTurnIndex)}
                  title="힌트 보기"
                  style={{ visibility: mode === "test" ? "hidden" : "visible" }}
                >
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M12 4.5C7 4.5 2.73 7.61 1 12C2.73 16.39 7 19.5 12 19.5C17 19.5 21.27 16.39 23 12C21.27 7.61 17 4.5 12 4.5ZM12 17C9.24 17 7 14.76 7 12C7 9.24 9.24 7 12 7C14.76 7 17 9.24 17 12C17 14.76 14.76 17 12 17ZM12 9C10.34 9 9 10.34 9 12C9 13.66 10.34 15 12 15C13.66 15 15 13.66 15 12C15 10.34 13.66 9 12 9Z" fill="currentColor"/>
                  </svg>
                </button>

                {/* Mic Toggle Button */}
                <button 
                  className={`btn-mic-main ${isRecording ? "recording" : ""}`}
                  onClick={isRecording ? stopRecordingSession : startRecordingSession}
                >
                  {isRecording ? (
                    <>
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M6 19H10V5H6V19ZM14 5v14h4V5h-4Z" fill="currentColor"/>
                      </svg>
                      완료하기
                    </>
                  ) : (
                    <>
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M12 14C13.66 14 15 12.66 15 11V5C15 3.34 13.66 2 12 2C10.34 2 9 3.34 9 5V11C9 12.66 10.34 14 12 14ZM17.3 11C17.3 14 14.76 16.1 12 16.1C9.24 16.1 6.7 14 6.7 11H5C5 14.41 7.72 17.23 11 17.72V21H13V17.72C16.28 17.23 19 14.41 19 11H17.3Z" fill="currentColor"/>
                      </svg>
                      말하기
                    </>
                  )}
                </button>

                {/* Listen Pronunciation Button */}
                <button 
                  className="btn-action-side listen"
                  onClick={() => activeSentence && handleSpeakTTS(activeSentence.en)}
                  title="원어민 발음 듣기"
                  style={{ visibility: mode === "test" ? "hidden" : "visible" }}
                >
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M3 9V15H7L12 20V4L7 9H3ZM16.5 12C16.5 10.23 15.48 8.71 14 8V16C15.48 15.29 16.5 13.77 16.5 12ZM14 3.23V5.29C16.89 6.15 19 8.83 19 12C19 15.17 16.89 17.85 14 18.71V20.77C18.01 19.86 21 16.28 21 12C21 7.72 18.01 4.14 14 3.23Z" fill="currentColor"/>
                  </svg>
                </button>
              </div>
            </>
          )}

        </div>
      )}
    </div>
  );
}
