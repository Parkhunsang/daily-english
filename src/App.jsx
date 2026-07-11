import React, { useState, useEffect } from "react";
import { DAILY_DATA } from "./data";
import { DayList } from "./components/DayList";
import { DayPractice } from "./components/DayPractice";

function App() {
  const [dayDataList, setDayDataList] = useState(DAILY_DATA);
  const [activeDay, setActiveDay] = useState(null);
  const [progress, setProgress] = useState({});
  const [selectedDayForSheet, setSelectedDayForSheet] = useState(null);
  const [practiceMode, setPracticeMode] = useState("speak"); // "preview" or "speak"
  const [showSettings, setShowSettings] = useState(false);
  const [medals, setMedals] = useState({});

  // Load progress, custom dialogues, and medals from LocalStorage on mount
  useEffect(() => {
    try {
      const storedProgress = localStorage.getItem("daily_english_progress");
      if (storedProgress) {
        setProgress(JSON.parse(storedProgress));
      }
      const storedCustomData = localStorage.getItem("daily_english_custom_dialogues");
      if (storedCustomData) {
        setDayDataList(JSON.parse(storedCustomData));
      }
      const storedMedals = localStorage.getItem("daily_english_medals");
      if (storedMedals) {
        setMedals(JSON.parse(storedMedals));
      }
    } catch (e) {
      console.error("Failed to load data from localStorage", e);
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

  // Save earned test medals (Gold > Silver > Bronze priority)
  const handleSaveMedal = (dayNum, medalType) => {
    setMedals((prevMedals) => {
      const existingMedal = prevMedals[dayNum];
      const medalWeight = { gold: 3, silver: 2, bronze: 1 };
      
      if (existingMedal && medalWeight[existingMedal] >= medalWeight[medalType]) {
        return prevMedals; // Keep the higher medal
      }

      const newMedals = {
        ...prevMedals,
        [dayNum]: medalType,
      };

      try {
        localStorage.setItem("daily_english_medals", JSON.stringify(newMedals));
      } catch (e) {
        console.error("Failed to save medals to localStorage", e);
      }

      return newMedals;
    });
  };
  const handleImportJSON = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const parsed = JSON.parse(e.target.result);
        
        if (!Array.isArray(parsed)) {
          throw new Error("데이터 형식이 올바르지 않습니다. (배열 형태여야 함)");
        }
        if (parsed.length > 0 && (!parsed[0].day || !parsed[0].title || !parsed[0].dialogue)) {
          throw new Error("필수 학습 속성(day, title, dialogue)이 누락되었습니다.");
        }

        localStorage.setItem("daily_english_custom_dialogues", JSON.stringify(parsed));
        setDayDataList(parsed);
        
        localStorage.removeItem("daily_english_progress");
        localStorage.removeItem("daily_english_medals");
        setProgress({});
        setMedals({});
        
        alert(`총 ${parsed.length}일치의 대본 데이터가 성공적으로 탑재되었습니다!`);
        setShowSettings(false);
      } catch (err) {
        alert(`불러오기 실패: ${err.message}`);
      }
    };
    reader.readAsText(file);
    event.target.value = "";
  };

  const handleExportJSON = () => {
    try {
      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(dayDataList, null, 2));
      const downloadAnchor = document.createElement("a");
      downloadAnchor.setAttribute("href", dataStr);
      downloadAnchor.setAttribute("download", "daily_english_dialogues.json");
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
    } catch (e) {
      alert("대본 내보내기에 실패했습니다.");
    }
  };

  const handleResetDefaultData = () => {
    if (window.confirm("현재 설정된 대본을 모두 지우고, 기본 10일치 일상 대본으로 복원하시겠습니까?\n(진행률 및 시험 메달 기록도 함께 초기화됩니다.)")) {
      localStorage.removeItem("daily_english_custom_dialogues");
      localStorage.removeItem("daily_english_progress");
      localStorage.removeItem("daily_english_medals");
      setDayDataList(DAILY_DATA);
      setProgress({});
      setMedals({});
      alert("기본 대본으로 복원이 완료되었습니다.");
      setShowSettings(false);
    }
  };

  const [displayedDayData, setDisplayedDayData] = useState(null);

  // Sync displayed day data when activeDay changes
  useEffect(() => {
    if (activeDay) {
      const data = dayDataList.find((d) => d.day === activeDay);
      setDisplayedDayData(data);
    }
  }, [activeDay, dayDataList]);

  const selectedDayForSheetData = selectedDayForSheet
    ? dayDataList.find((d) => d.day === selectedDayForSheet)
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
              {practiceMode === "preview" 
                ? "대화문 미리보기" 
                : practiceMode === "test" 
                  ? `Day ${displayedDayData.day} - 스피킹 시험 🏆` 
                  : `Day ${displayedDayData.day} - ${displayedDayData.title}`}
            </span>
          </>
        ) : (
          <>
            <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
              <span className="nav-title" style={{ color: "var(--accent-color)", fontSize: "19px", fontWeight: "850", letterSpacing: "-0.5px" }}>Hunsanglingo 🏆</span>
              <span style={{ fontSize: "11px", fontWeight: "600", color: "var(--text-muted)" }}>
                하루 10분 영어 스피킹
              </span>
            </div>
            
            <button 
              className="btn-settings-gear"
              onClick={() => setShowSettings(true)}
              title="설정 및 대본 가져오기"
              style={{
                background: "none",
                border: "none",
                color: "var(--text-primary)",
                cursor: "pointer",
                padding: "8px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                transition: "transform 0.2s ease"
              }}
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M19.43 12.98C19.47 12.66 19.5 12.34 19.5 12C19.5 11.66 19.47 11.34 19.43 11.02L21.54 9.37C21.73 9.22 21.78 8.95 21.66 8.73L19.66 5.27C19.54 5.05 19.27 4.97 19.05 5.05L16.56 6.05C16.04 5.65 15.48 5.32 14.87 5.07L14.49 2.42C14.46 2.18 14.25 2 14 2H10C9.75 2 9.54 2.18 9.51 2.42L9.13 5.07C8.52 5.32 7.96 5.66 7.44 6.05L4.95 5.05C4.73 4.96 4.46 5.05 4.34 5.27L2.34 8.73C2.21 8.95 2.27 9.22 2.46 9.37L4.57 11.02C4.53 11.34 4.5 11.67 4.5 12C4.5 12.33 4.53 12.66 4.57 12.98L2.46 14.63C2.27 14.78 2.21 15.05 2.34 15.27L4.34 18.73C4.46 18.95 4.73 19.03 4.95 18.95L7.44 17.95C7.96 18.35 8.52 18.68 9.13 18.93L9.51 21.58C9.54 21.82 9.75 22 10 22H14C14.25 22 14.46 21.82 14.49 21.58L14.87 18.93C15.48 18.68 16.04 18.34 16.56 17.95L19.05 18.95C19.27 19.04 19.54 18.95 19.66 18.73L21.66 15.27C21.78 15.05 21.73 14.78 21.54 14.63L19.43 12.98ZM12 15.5C10.07 15.5 8.5 13.93 8.5 12C8.5 10.07 10.07 8.5 12 8.5C13.93 8.5 15.5 10.07 15.5 12C15.5 13.93 13.93 15.5 12 15.5Z" fill="currentColor"/>
              </svg>
            </button>
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
                data={dayDataList}
                onSelectDay={setSelectedDayForSheet}
                progress={progress}
                medals={medals}
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
                  onSaveMedal={handleSaveMedal}
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
              
              <button 
                className="duo-sheet-btn test"
                onClick={() => {
                  setPracticeMode("test");
                  setActiveDay(selectedDayForSheet);
                  setSelectedDayForSheet(null);
                }}
                style={{
                  borderColor: "#FF9500",
                  background: "rgba(255, 149, 0, 0.02)"
                }}
              >
                <div className="icon-box">🏆</div>
                <div className="text-box">
                  <span className="title" style={{ color: "#FF9500" }}>도전! 스피킹 시험</span>
                  <span className="desc">힌트 없이 하트 3개로 내 실력을 검증합니다.</span>
                </div>
              </button>
            </div>
          </>
        )}
      </div>

      {/* Settings Bottom Sheet Backdrop */}
      {showSettings && (
        <div 
          className="duo-sheet-backdrop" 
          onClick={() => setShowSettings(false)}
        />
      )}

      {/* Settings Bottom Sheet Panel */}
      <div className={`duo-bottom-sheet ${showSettings ? "open" : ""}`} style={{ paddingBottom: "calc(var(--safe-bottom) + 30px)" }}>
        <div className="duo-sheet-handle"></div>
        <div className="duo-sheet-header">
          <span className="duo-sheet-day">SETTINGS</span>
          <h3 className="duo-sheet-title">학습 설정 및 관리</h3>
        </div>

        <div className="duo-settings-description" style={{ fontSize: "12px", color: "var(--text-muted)", textAlign: "center", lineHeight: "1.45" }}>
          개인 소장 중인 대본 파일(JSON)을 불러와 공부하거나,<br/>
          공유용 대본 데이터를 백업 및 리셋할 수 있습니다.
        </div>

        <div className="duo-sheet-actions">
          {/* Import JSON Button */}
          <label className="duo-sheet-btn" style={{ cursor: "pointer" }}>
            <input 
              type="file" 
              accept=".json" 
              onChange={handleImportJSON} 
              style={{ display: "none" }} 
            />
            <div className="icon-box">📥</div>
            <div className="text-box">
              <span className="title" style={{ color: "var(--accent-color)" }}>대본 파일 불러오기 (Import)</span>
              <span className="desc">소장 중인 JSON 파일을 불러와 즉시 교체합니다.</span>
            </div>
          </label>

          {/* Export JSON Button */}
          <button className="duo-sheet-btn" onClick={handleExportJSON}>
            <div className="icon-box">📤</div>
            <div className="text-box">
              <span className="title">현재 대본 내보내기 (Export)</span>
              <span className="desc">현재 학습 중인 대본 데이터를 JSON 파일로 백업합니다.</span>
            </div>
          </button>

          {/* Reset Button */}
          <button className="duo-sheet-btn" onClick={handleResetDefaultData} style={{ borderColor: "#FF3B30", background: "rgba(255, 59, 48, 0.02)" }}>
            <div className="icon-box">🔄</div>
            <div className="text-box">
              <span className="title" style={{ color: "#FF3B30" }}>기본 대본으로 복원 (Reset)</span>
              <span className="desc" style={{ color: "#FF453A" }}>기본 내장된 10일치 창작 일상 대본으로 완전히 리셋합니다.</span>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
}

export default App;
