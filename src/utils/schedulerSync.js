import { createClient } from '@supabase/supabase-js';

/**
 * Syncs the study progress event directly to Supabase cloud database.
 */
export async function syncEventToScheduler(dayNum, dayTitle, supabaseUrl, supabaseKey) {
  if (!supabaseUrl || !supabaseKey) {
    console.warn("Supabase integration skipped: URL or Key is missing.");
    return { success: false, error: "Supabase 연동 설정이 비어 있습니다." };
  }

  // Format today's date in local time YYYY-MM-DD
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const date = String(today.getDate()).padStart(2, '0');
  const dateStr = `${year}-${month}-${date}`;

  // Time formatting
  const formatTime = (d) => {
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    return `${hh}:${mm}`;
  };

  const timeStr = formatTime(today);
  const oneHourLater = new Date(today.getTime() + 60 * 60 * 1000);
  const endTimeStr = formatTime(oneHourLater);

  const paddedDay = String(dayNum).padStart(2, '0');
  const payload = {
    title: `Day ${paddedDay} - ${dayTitle} 영어 회화 완료 🏆`,
    date: dateStr,
    time: timeStr,
    end_time: endTimeStr, // matches 'end_time' column in PostgreSQL
    color: "#8b5cf6", // Purple study tag
    desc: `daily-english 앱(모바일/웹)을 통해 스피킹 성공 후 자동으로 전송된 실시간 연동 학습 결과입니다.`
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
