import React, { useState, useEffect } from "react";
import { DAILY_DATA } from "./data";
import { DayList } from "./components/DayList";
import { DayPractice } from "./components/DayPractice";
import { syncEventToScheduler } from "./utils/schedulerSync";
// Helper functions to safely obfuscate API keys in localStorage
const encodeKey = (str) => {
  if (!str) return "";
  return btoa(encodeURIComponent(str).split("").reverse().join(""));
};

const decodeKey = (str) => {
  if (!str) return "";
  try {
    const decoded = atob(str).split("").reverse().join("");
    return decodeURIComponent(decoded);
  } catch (e) {
    return str; // Fallback for pre-existing plain text values
  }
};

function App() {
  const [dayDataList, setDayDataList] = useState(DAILY_DATA);
  const [activeDay, setActiveDay] = useState(null);
  const [progress, setProgress] = useState({});
  const [selectedDayForSheet, setSelectedDayForSheet] = useState(null);
  const [practiceMode, setPracticeMode] = useState("speak"); // "preview" or "speak"
  const [showSettings, setShowSettings] = useState(false);
  const [medals, setMedals] = useState({});
  const [sensitivity, setSensitivity] = useState(70);
  const [streak, setStreak] = useState(0);
  const [supabaseUrl, setSupabaseUrl] = useState("");
  const [supabaseKey, setSupabaseKey] = useState("");
  const [syncEnabled, setSyncEnabled] = useState(false);
  const [preferredAi, setPreferredAi] = useState("chatgpt");
  const [geminiApiKey, setGeminiApiKey] = useState("");
  const [practiceStartTime, setPracticeStartTime] = useState(null);

  // Load progress, custom dialogues, medals, sensitivity, and streak from LocalStorage on mount
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
      const storedSensitivity = localStorage.getItem("daily_english_sensitivity");
      if (storedSensitivity) {
        setSensitivity(parseInt(storedSensitivity, 10));
      }
      const storedStreak = localStorage.getItem("daily_english_streak");
      if (storedStreak) {
        setStreak(parseInt(storedStreak, 10));
      }
      const storedUrl = localStorage.getItem("daily_english_supabase_url");
      if (storedUrl) {
        setSupabaseUrl(storedUrl);
      }
      const storedKey = localStorage.getItem("daily_english_supabase_key");
      if (storedKey) {
        setSupabaseKey(storedKey);
      }
      const storedSync = localStorage.getItem("daily_english_supabase_sync_enabled");
      if (storedSync) {
        setSyncEnabled(storedSync === "true");
      }
      const storedPreferredAi = localStorage.getItem("daily_english_preferred_ai");
      if (storedPreferredAi) {
        setPreferredAi(storedPreferredAi);
      }
      const storedGeminiKey = localStorage.getItem("daily_english_gemini_key");
      if (storedGeminiKey) {
        setGeminiApiKey(decodeKey(storedGeminiKey));
      }
    } catch (e) {
      console.error("Failed to load data from localStorage", e);
    }
  }, []);

  const handleSupabaseUrlChange = (val) => {
    setSupabaseUrl(val);
    localStorage.setItem("daily_english_supabase_url", val);
  };

  const handleSupabaseKeyChange = (val) => {
    setSupabaseKey(val);
    localStorage.setItem("daily_english_supabase_key", val);
  };

  const handleSyncEnabledChange = (val) => {
    setSyncEnabled(val);
    localStorage.setItem("daily_english_supabase_sync_enabled", String(val));
  };

  const handlePreferredAiChange = (val) => {
    setPreferredAi(val);
    localStorage.setItem("daily_english_preferred_ai", val);
  };

  const handleGeminiKeyChange = (val) => {
    setGeminiApiKey(val);
    localStorage.setItem("daily_english_gemini_key", encodeKey(val));
  };

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

  const handleSensitivityChange = (val) => {
    setSensitivity(val);
    localStorage.setItem("daily_english_sensitivity", val);
  };

  // Streak counter tracking system
  const handleDayCompleted = (dayNum, dayTitle) => {
    const todayStr = new Date().toLocaleDateString("en-CA");
    const lastCompleteDate = localStorage.getItem("daily_english_last_complete_date");
    
    let newStreak = streak;

    // Trigger Scheduler Sync if enabled
    if (syncEnabled) {
      const title = dayTitle || dayDataList.find(d => d.day === dayNum)?.title || "영어 회화";
      const start = practiceStartTime || new Date(Date.now() - 20 * 60 * 1000); // 20m fallback
      const end = new Date();
      syncEventToScheduler(dayNum, title, supabaseUrl, supabaseKey, start, end).then(res => {
        if (res.success) {
          console.log("스케줄러 연동 성공!");
        } else {
          console.warn("스케줄러 연동 실패:", res.error);
        }
      });
    }

    if (lastCompleteDate === todayStr) {
      return; // Already completed today
    } else if (lastCompleteDate) {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = yesterday.toLocaleDateString("en-CA");

      if (lastCompleteDate === yesterdayStr) {
        newStreak += 1;
      } else {
        newStreak = 1; // Streak broken, reset
      }
    } else {
      newStreak = 1; // First time complete
    }

    setStreak(newStreak);
    localStorage.setItem("daily_english_streak", newStreak);
    localStorage.setItem("daily_english_last_complete_date", todayStr);
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
        localStorage.removeItem("daily_english_streak");
        localStorage.removeItem("daily_english_last_complete_date");
        setProgress({});
        setMedals({});
        setStreak(0);
        
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
    if (window.confirm("현재 설정된 대본을 모두 지우고, 기본 10일치 일상 대본으로 복원하시겠습니까?\n(진행률, 시험 메달 및 스트릭 기록도 함께 초기화됩니다.)")) {
      localStorage.removeItem("daily_english_custom_dialogues");
      localStorage.removeItem("daily_english_progress");
      localStorage.removeItem("daily_english_medals");
      localStorage.removeItem("daily_english_streak");
      localStorage.removeItem("daily_english_last_complete_date");
      setDayDataList(DAILY_DATA);
      setProgress({});
      setMedals({});
      setStreak(0);
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
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                <span className="nav-title" style={{ color: "var(--accent-color)", fontSize: "19px", fontWeight: "850", letterSpacing: "-0.5px" }}>Hunsanglingo 🏆</span>
                <span style={{ fontSize: "11px", fontWeight: "600", color: "var(--text-muted)" }}>
                  하루 10분 영어 스피킹
                </span>
              </div>
              {streak > 0 && (
                <span 
                  className="header-streak-badge"
                  title="연속 학습 스트릭!"
                  style={{
                    background: "linear-gradient(135deg, #FF5A5F 0%, #FF9500 100%)",
                    color: "#FFFFFF",
                    fontSize: "11px",
                    fontWeight: "800",
                    padding: "3px 8px",
                    borderRadius: "12px",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "2px",
                    boxShadow: "0 3px 8px rgba(255, 90, 95, 0.2)"
                  }}
                >
                  🔥 {streak}일
                </span>
              )}
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
                  passingThreshold={sensitivity}
                  onDayCompleted={handleDayCompleted}
                  preferredAi={preferredAi}
                  geminiApiKey={geminiApiKey}
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
                  setPracticeStartTime(new Date());
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
                  setPracticeStartTime(new Date());
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
                  setPracticeStartTime(new Date());
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

        <div className="sensitivity-control-panel" style={{ padding: "16px", background: "#F2F2F7", borderRadius: "20px", margin: "16px 0", boxSizing: "border-box" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
            <span style={{ fontSize: "13px", fontWeight: "750", color: "var(--text-primary)" }}>🎙️ 발음 채점 민감도 (통과 기준)</span>
            <span style={{ fontSize: "13px", fontWeight: "800", color: "var(--accent-color)" }}>
              {sensitivity}% {sensitivity === 60 ? "(너그럽게)" : sensitivity === 70 ? "(보통)" : "(엄격하게)"}
            </span>
          </div>
          
          <div style={{ display: "flex", gap: "8px", width: "100%", marginTop: "10px" }}>
            {[60, 70, 80].map((level) => (
              <button
                key={level}
                onClick={() => handleSensitivityChange(level)}
                style={{
                  flex: 1,
                  padding: "10px 0",
                  borderRadius: "12px",
                  border: "2px solid",
                  borderColor: sensitivity === level ? "var(--accent-color)" : "#E2E8F0",
                  background: sensitivity === level ? "rgba(124, 58, 237, 0.05)" : "#FFFFFF",
                  color: sensitivity === level ? "var(--accent-color)" : "var(--text-secondary)",
                  fontWeight: "800",
                  fontSize: "12.5px",
                  cursor: "pointer",
                  transition: "all 0.15s ease",
                  boxShadow: sensitivity === level ? "none" : "0 2px 6px rgba(0,0,0,0.02)"
                }}
              >
                {level === 60 ? "너그럽게" : level === 70 ? "보통" : "엄격하게"}
              </button>
            ))}
          </div>
          <div style={{ fontSize: "10px", color: "var(--text-muted)", marginTop: "8px", textAlign: "center", fontWeight: "600" }}>
            {sensitivity === 60 ? "주변에 소음이 있거나 입문자분들께 권장합니다." : sensitivity === 70 ? "훈상링고 권장 기본 통과 감도입니다." : "원어민 수준에 필적하는 정밀한 발음에 도전합니다."}
          </div>
        </div>

        {/* Preferred AI Launcher Selector Panel */}
        <div className="sensitivity-control-panel" style={{ padding: "16px", background: "#F2F2F7", borderRadius: "20px", margin: "16px 0", boxSizing: "border-box" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
            <span style={{ fontSize: "13px", fontWeight: "750", color: "var(--text-primary)" }}>🤖 연동할 외부 AI 서비스</span>
            <span style={{ fontSize: "11.5px", fontWeight: "800", color: "var(--accent-color)" }}>
              {preferredAi === "chatgpt" ? "ChatGPT" : "Gemini"}
            </span>
          </div>
          
          <div style={{ display: "flex", gap: "8px", width: "100%", marginTop: "10px" }}>
            {[
              { id: "chatgpt", label: "💬 ChatGPT (추천)" },
              { id: "gemini", label: "✨ Google Gemini" }
            ].map((ai) => (
              <button
                key={ai.id}
                onClick={() => handlePreferredAiChange(ai.id)}
                style={{
                  flex: 1,
                  padding: "10px 0",
                  borderRadius: "12px",
                  border: "2px solid",
                  borderColor: preferredAi === ai.id ? "var(--accent-color)" : "#E2E8F0",
                  background: preferredAi === ai.id ? "rgba(124, 58, 237, 0.05)" : "#FFFFFF",
                  color: preferredAi === ai.id ? "var(--accent-color)" : "var(--text-secondary)",
                  fontWeight: "800",
                  fontSize: "12px",
                  cursor: "pointer",
                  transition: "all 0.15s ease",
                  boxShadow: preferredAi === ai.id ? "none" : "0 2px 6px rgba(0,0,0,0.02)"
                }}
              >
                {ai.label}
              </button>
            ))}
          </div>
          <div style={{ fontSize: "10px", color: "var(--text-muted)", marginTop: "8px", textAlign: "center", fontWeight: "600", lineHeight: "1.45" }}>
            {preferredAi === "chatgpt" 
              ? "버튼 클릭 시 ChatGPT 창이 열리며 질문이 자동으로 즉시 실행됩니다." 
              : "질문 텍스트가 클립보드에 자동 복사됩니다. Gemini 창이 열리면 붙여넣기(Ctrl+V) 하세요."}
          </div>
        </div>

        {/* Gemini API Key Panel */}
        <div className="sensitivity-control-panel" style={{ padding: "16px", background: "#F2F2F7", borderRadius: "20px", margin: "16px 0", boxSizing: "border-box" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
            <span style={{ fontSize: "13px", fontWeight: "750", color: "var(--text-primary)" }}>✨ Gemini API 키 설정</span>
            <span style={{ fontSize: "11px", fontWeight: "600", color: "var(--text-muted)" }}>원어민 발음용</span>
          </div>
          
          <input 
            type="text" 
            value={geminiApiKey} 
            onChange={(e) => handleGeminiKeyChange(e.target.value)} 
            placeholder="Gemini API 키를 입력하세요" 
            autoComplete="off"
            style={{
              padding: "8px 12px",
              borderRadius: "10px",
              border: "1.5px solid #E2E8F0",
              fontSize: "12px",
              outline: "none",
              fontFamily: "monospace",
              background: "#FFFFFF",
              boxSizing: "border-box",
              width: "100%",
              WebkitTextSecurity: "disc" // Mask characters visually without triggering browser password managers
            }}
          />
          <div style={{ fontSize: "10px", color: "var(--text-muted)", marginTop: "8px", textAlign: "left", fontWeight: "600", lineHeight: "1.4" }}>
            * API 키 입력 시 로봇이 아닌 **실제 원어민 수준의 자연스러운 Gemini AI 발음(Aoede 목소리)**으로 학습 문장을 재생합니다.
          </div>
        </div>

        {/* Supabase Sync Integration Panel */}
        <div className="sensitivity-control-panel" style={{ padding: "16px", background: "#F2F2F7", borderRadius: "20px", margin: "16px 0", boxSizing: "border-box" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
            <span style={{ fontSize: "13px", fontWeight: "750", color: "var(--text-primary)" }}>📅 Supabase 클라우드 연동</span>
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <input 
                type="checkbox" 
                id="scheduler-sync-toggle"
                checked={syncEnabled} 
                onChange={(e) => handleSyncEnabledChange(e.target.checked)} 
                style={{ cursor: "pointer", width: "16px", height: "16px" }}
              />
              <label htmlFor="scheduler-sync-toggle" style={{ fontSize: "12px", fontWeight: "750", color: "var(--text-secondary)", cursor: "pointer" }}>활성화</label>
            </div>
          </div>

          {syncEnabled && (
            <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginTop: "12px", borderTop: "1px solid #E5E5EA", paddingTop: "12px" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                <span style={{ fontSize: "11px", fontWeight: "750", color: "var(--text-secondary)", textAlign: "left" }}>Supabase URL</span>
                <input 
                  type="text" 
                  value={supabaseUrl} 
                  onChange={(e) => handleSupabaseUrlChange(e.target.value)} 
                  placeholder="https://xxxx.supabase.co" 
                  style={{
                    padding: "8px 12px",
                    borderRadius: "10px",
                    border: "1.5px solid #E2E8F0",
                    fontSize: "12px",
                    outline: "none",
                    fontFamily: "monospace",
                    background: "#FFFFFF",
                    boxSizing: "border-box",
                    width: "100%"
                  }}
                />
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                <span style={{ fontSize: "11px", fontWeight: "750", color: "var(--text-secondary)", textAlign: "left" }}>Supabase Anon Key</span>
                <input 
                  type="text" 
                  value={supabaseKey} 
                  onChange={(e) => handleSupabaseKeyChange(e.target.value)} 
                  placeholder="Publishable Key (anon)" 
                  style={{
                    padding: "8px 12px",
                    borderRadius: "10px",
                    border: "1.5px solid #E2E8F0",
                    fontSize: "12px",
                    outline: "none",
                    fontFamily: "monospace",
                    background: "#FFFFFF",
                    boxSizing: "border-box",
                    width: "100%"
                  }}
                />
              </div>
              <div style={{ fontSize: "10px", color: "var(--text-muted)", marginTop: "4px", lineHeight: "1.4", textAlign: "left", fontWeight: "600" }}>
                * Supabase 프로젝트 API 설정에서 확인한 URL 및 Publishable Key를 입력해 주세요.
              </div>
            </div>
          )}
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
