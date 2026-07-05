import React from "react";

export function DayList({ data, onSelectDay, progress }) {
  // Calculate total sentences and total completed
  let totalSentences = 0;
  let totalCompleted = 0;

  data.forEach((dayData) => {
    const dayProgress = progress[dayData.day] || {};
    totalSentences += dayData.dialogue.length;
    
    // Count how many sentences are correct in this day
    const completedInDay = Object.values(dayProgress).filter(val => val === true).length;
    totalCompleted += completedInDay;
  });

  const overallPercent = totalSentences > 0 
    ? Math.round((totalCompleted / totalSentences) * 100) 
    : 0;

  return (
    <div className="day-list-view">
      <div className="home-progress-section">
        <div className="progress-header">
          <span className="progress-title">전체 학습 달성도</span>
          <span className="progress-pct">{overallPercent}%</span>
        </div>
        <div className="progress-bar-bg">
          <div 
            className="progress-bar-fill" 
            style={{ width: `${overallPercent}%` }}
          />
        </div>
      </div>

      <div className="day-grid">
        {data.map((dayData) => {
          const dayProgress = progress[dayData.day] || {};
          const totalInDay = dayData.dialogue.length;
          const completedInDay = Object.values(dayProgress).filter(val => val === true).length;
          const percent = totalInDay > 0 ? Math.round((completedInDay / totalInDay) * 100) : 0;
          
          return (
            <div 
              key={dayData.day} 
              className="day-card"
              onClick={() => onSelectDay(dayData.day)}
            >
              <div className="day-header">
                <span className="day-number">Day {String(dayData.day).padStart(3, "0")}</span>
                <span className={`day-progress-badge ${percent === 100 ? "completed" : ""}`}>
                  {percent === 100 ? "완료" : `${percent}%`}
                </span>
              </div>
              <h2 className="day-title">{dayData.title}</h2>
              <div className="day-key-expr">
                <div className="key-label">오늘의 핵심 표현</div>
                <div className="key-text">{dayData.keyExpression.ko}</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
