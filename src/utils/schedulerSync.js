import { createClient } from '@supabase/supabase-js';

/**
 * Syncs the study progress event directly to Supabase cloud database with actual tracked time.
 */
export async function syncEventToScheduler(dayNum, dayTitle, supabaseUrl, supabaseKey, startTime, endTime) {
  if (!supabaseUrl || !supabaseKey) {
    console.warn("Supabase integration skipped: URL or Key is missing.");
    return { success: false, error: "Supabase URL 또는 Publishable Key가 비어 있습니다. 설정(⚙️)에서 입력해 주세요." };
  }

  // Use endTime (completion time) as the date of the event
  const eventDate = endTime || new Date();
  const year = eventDate.getFullYear();
  const month = String(eventDate.getMonth() + 1).padStart(2, '0');
  const date = String(eventDate.getDate()).padStart(2, '0');
  const dateStr = `${year}-${month}-${date}`;

  // Time formatting helper
  const formatTime = (d) => {
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    return `${hh}:${mm}`;
  };

  // Track actual study time (start time of session to end time of session)
  const actualStart = startTime ? new Date(startTime) : new Date(Date.now() - 20 * 60 * 1000);
  const actualEnd = endTime ? new Date(endTime) : new Date();

  const timeStr = formatTime(actualStart);
  const endTimeStr = formatTime(actualEnd);

  // Compute total duration in minutes
  const durationMs = actualEnd - actualStart;
  const durationMins = Math.max(1, Math.round(durationMs / (60 * 1000)));

  const paddedDay = String(dayNum).padStart(2, '0');
  const payload = {
    title: `Day ${paddedDay} - ${dayTitle} 영어 회화 완료 🏆`,
    date: dateStr,
    time: timeStr,
    end_time: endTimeStr, // matches 'end_time' column in PostgreSQL
    color: "#8b5cf6", // Purple study tag
    desc: `daily-english 회화 훈련 완료 (소요 시간: ${durationMins}분)`
  };

  try {
    const cleanedUrl = supabaseUrl.replace(/\/rest\/v1\/?$/, '').replace(/\/$/, '').trim();
    const supabase = createClient(cleanedUrl, supabaseKey);
    const { data, error } = await supabase
      .from('scheduler_events')
      .insert([payload])
      .select();

    if (error) throw error;

    console.log("Supabase insert successful:", data);
    return { success: true, data };
  } catch (error) {
    console.error("Failed to insert event into Supabase database:", error);
    return { success: false, error: error.message };
  }
}
