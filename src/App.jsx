import React, { useState, useEffect } from "react";
import { DAILY_DATA } from "./data";
import { DayList } from "./components/DayList";
import { DayPractice } from "./components/DayPractice";

function App() {
  const [activeDay, setActiveDay] = useState(null);
  const [progress, setProgress] = useState({});
  const [selectedDayForSheet, setSelectedDayForSheet] = useState(null);
  const [practiceMode, setPracticeMode] = useState("speak"); // "preview" or "speak"

  // Load progress from LocalStorage on mount
  useEffect(() => {
    try {
      const storedProgress = localStorage.getItem("daily_english_progress");
      if (storedProgress) {
        setProgress(JSON.parse(storedProgress));
      }
    } catch (e) {
      console.error("Failed to load progress from localStorage", e);
    }
  }, []);

  // Save progress to LocalStorage when it changes
  const handleMarkSentenceCorrect = (dayNum, sentenceId, isCorrect) => {
    setProgress((prevProgress) => {
      const dayProgress = prevProgress[dayNum] || {};
      const updatedDayProgress = {
        ...dayProgress,
        [sentenceId]: isCorrect,
      };
      
      const newProgress = {
        ...prevProgress,
        [dayNum]: updatedDayProgress,
      };

      try {
        localStorage.setItem("daily_english_progress", JSON.stringify(newProgress));
      } catch (e) {
        console.error("Failed to save progress to localStorage", e);
      }

      return newProgress;
    });
  };
  const [displayedDayData, setDisplayedDayData] = useState(null);

  // Sync displayed day data when activeDay changes (keep it during slide-out animation)
  useEffect(() => {
    if (activeDay) {
      const data = DAILY_DATA.find((d) => d.day === activeDay);
      setDisplayedDayData(data);
    }
  }, [activeDay]);

  const selectedDayForSheetData = selectedDayForSheet
    ? DAILY_DATA.find((d) => d.day === selectedDayForSheet)
    : null;

  return (
    <div className="app-container">
      {/* Navigation Header */}
      <header className="nav-header">
        {activeDay && displayedDayData ? (
          <>
            <button className="back-button" onClick={() => setActiveDay(null)}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M15.41 16.59L10.83 12L15.41 7.41L14 6L8 12L14 18L15.41 16.59Z" fill="currentColor"/>
              </svg>
              뒤로
            </button>
            <span className="nav-title" style={{ fontSize: "15px", fontWeight: "700" }}>
              {practiceMode === "preview" ? "대화문 미리보기" : `Day ${displayedDayData.day} - ${displayedDayData.title}`}
            </span>
          </>
        ) : (
          <>
            <span className="nav-title">Daily English</span>
            <span style={{ fontSize: "14px", fontWeight: "600", color: "var(--text-muted)" }}>
              100일의 기적 2
            </span>
          </>
        )}
      </header>

      {/* Main Content Area with Sliding Transition */}
      <main className={`main-content ${activeDay ? "practice-mode" : ""}`} style={{ padding: 0 }}>
        <div className="app-slider-container">
          <div className="app-slider">
            {/* Slide 1: Day List Dashboard */}
            <div 
              className="app-slide dashboard-slide"
              style={{ transform: activeDay ? "translateX(-100%)" : "translateX(0%)" }}
            >
              <div style={{ marginBottom: "20px" }}>
                <h1 style={{ fontSize: "24px", fontWeight: "800", color: "var(--text-primary)" }}>
                  학습 관리 대시보드
                </h1>
                <p style={{ fontSize: "14px", color: "var(--text-muted)", marginTop: "4px" }}>
                  오늘 공부할 일차를 선택하고, 외운 문장을 체크받으세요.
                </p>
              </div>
              
              <DayList
                data={DAILY_DATA}
                onSelectDay={setSelectedDayForSheet}
                progress={progress}
              />
            </div>

            {/* Slide 2: Day Practice */}
            <div 
              className="app-slide practice-slide"
              style={{ transform: activeDay ? "translateX(0%)" : "translateX(100%)" }}
            >
              {displayedDayData && (
                <DayPractice
                  dayData={displayedDayData}
                  progress={progress}
                  onMarkSentenceCorrect={handleMarkSentenceCorrect}
                  onBack={() => setActiveDay(null)}
                  mode={practiceMode}
                  onSwitchToSpeak={() => setPracticeMode("speak")}
                />
              )}
            </div>
          </div>
        </div>
      </main>

      {/* iOS Bottom Sheet Backdrop */}
      {selectedDayForSheet && (
        <div 
          className="duo-sheet-backdrop" 
          onClick={() => setSelectedDayForSheet(null)}
        />
      )}

      {/* iOS Bottom Sheet Panel */}
      <div className={`duo-bottom-sheet ${selectedDayForSheet ? "open" : ""}`}>
        <div className="duo-sheet-handle"></div>
        {selectedDayForSheetData && (
          <>
            <div className="duo-sheet-header">
              <span className="duo-sheet-day">Day {selectedDayForSheetData.day}</span>
              <h3 className="duo-sheet-title">{selectedDayForSheetData.title}</h3>
            </div>
            
            <div className="duo-sheet-preview-text">
              <span className="label">대표 표현</span>
              <p>"{selectedDayForSheetData.vocabulary[0]?.phrase} ({selectedDayForSheetData.vocabulary[0]?.meaning})"</p>
            </div>
            
            <div className="duo-sheet-actions">
              <button 
                className="duo-sheet-btn preview"
                onClick={() => {
                  setPracticeMode("preview");
                  setActiveDay(selectedDayForSheet);
                  setSelectedDayForSheet(null);
                }}
              >
                <div className="icon-box">📖</div>
                <div className="text-box">
                  <span className="title">대화문 미리보기</span>
                  <span className="desc">전체 대화 스크립트를 먼저 읽고 오디오를 들어봅니다.</span>
                </div>
              </button>
              
              <button 
                className="duo-sheet-btn speak"
                onClick={() => {
                  setPracticeMode("speak");
                  setActiveDay(selectedDayForSheet);
                  setSelectedDayForSheet(null);
                }}
              >
                <div className="icon-box">🎙️</div>
                <div className="text-box">
                  <span className="title">실전 스피킹 훈련</span>
                  <span className="desc">한 문장씩 영어로 말하며 채점 훈련을 시작합니다.</span>
                </div>
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default App;
