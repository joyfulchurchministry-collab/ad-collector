import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './App.css';

const API_URL = 'ad-collector.vercel.app'; // 배포된 주소

interface Ad {
  id: number;
  date: string; // 행사 일자 (분류 기준)
  regDate: string; // 실제 기록 일시
  title: string;
  content: string;
  author: string;
  category: string;
  location?: string;
}

const CATEGORIES = ["부서별 행사일정", "외부사역", "교우소식", "광고", "영상광고"];

function App() {
  const [view, setView] = useState<'submit' | 'dashboard' | 'events'>('dashboard');
  const [formData, setFormData] = useState({
    title: '',
    content: '',
    author: '',
    category: '광고',
    location: '',
    eventDate: ''
  });
  const [editingId, setEditingId] = useState<number | null>(null);
  const [status, setStatus] = useState('');
  const [ads, setAds] = useState<Ad[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchAds = async () => {
    setLoading(true);
    try {
      const response = await axios.get(`${API_URL}/api/ads`);
      if (response.data.success) {
        setAds(response.data.data);
      }
    } catch (error) {
      console.error('Failed to fetch ads:', error);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchAds();
  }, [view]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus('제출 중...');
    try {
      const submissionData = { ...formData };
      if (submissionData.category === "부서별 행사일정" && submissionData.eventDate) {
        submissionData.eventDate = new Date(submissionData.eventDate).toISOString();
      } else {
        submissionData.eventDate = new Date().toISOString();
      }

      if (editingId !== null) {
        // 수정 모드: PUT 요청
        await axios.put(`https://ad-collector-backend.onrender.com/api/ads/${editingId}`, submissionData);
        setStatus('✅ 성공적으로 수정되었습니다!');
        setEditingId(null);
      } else {
        // 생성 모드: POST 요청
        await axios.post('https://ad-collector-backend.onrender.com/api/ads', submissionData);
        setStatus('✅ 성공적으로 제출되었습니다!');
      }
      setFormData({ title: '', content: '', author: '', category: '광고', location: '', eventDate: '' });
      fetchAds();
    } catch (error) {
      setStatus('❌ 작업에 실패했습니다.');
      console.error(error);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('정말 삭제하시겠습니까?')) return;
    try {
      await axios.delete(`https://ad-collector-backend.onrender.com/api/ads/${id}`);
      fetchAds();
    } catch (error) {
      alert('삭제 실패');
    }
  };

  const handleEdit = (ad: Ad) => {
    setEditingId(ad.id);
    setFormData({
      title: ad.title,
      content: ad.content,
      author: ad.author,
      category: ad.category,
      location: ad.location || '',
      eventDate: ad.date ? ad.date.split('T')[0] : ''
    });
    setView('submit');
  };

  const handleNav = (v: 'submit' | 'dashboard' | 'events') => {
    if (v !== 'submit') {
      setEditingId(null);
      setFormData({ title: '', content: '', author: '', category: '광고', location: '', eventDate: '' });
    }
    setView(v);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const getCurrentWeekRange = () => {
    const now = new Date();
    const day = now.getDay();
    const diff = now.getDate() - (day === 0 ? 6 : day - 1);
    const monday = new Date(now.setDate(diff));
    monday.setHours(0, 0, 0, 0);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    sunday.setHours(23, 59, 59, 999);
    const formatDate = (date: Date) => `${date.getFullYear()}년 ${date.getMonth() + 1}월 ${date.getDate()}일(월)`;
    const formatDateShort = (date: Date) => `${date.getMonth() + 1}월 ${date.getDate()}일(주일)`;
    return { text: `${formatDate(monday)} ~ ${formatDateShort(sunday)} 주간 일정`, monday, sunday };
  };

  const currentWeek = getCurrentWeekRange();

  const categorizedAds = ads.reduce((acc: { 
    currentWeek: { [category: string]: Ad[] }, 
    futureEvents: Ad[] 
  }, ad) => {
    if (!ad.date) return acc;

    let adDate = new Date(ad.date);
    if (isNaN(adDate.getTime())) {
      const cleanDateStr = ad.date.replace(/\./g, '-').replace(/\s/g, '');
      adDate = new Date(cleanDateStr);
    }
    if (isNaN(adDate.getTime())) return acc;

    const categoryKey = ad.category || '기타';

    if (adDate >= currentWeek.monday && adDate <= currentWeek.sunday) {
      if (!acc.currentWeek[categoryKey]) acc.currentWeek[categoryKey] = [];
      acc.currentWeek[categoryKey].push(ad);
    } else if (adDate > currentWeek.sunday && categoryKey === "부서별 행사일정") {
      acc.futureEvents.push(ad);
    }

    return acc;
  }, { currentWeek: {}, futureEvents: [] });

  categorizedAds.futureEvents.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  const formatDisplayDate = (dateStr: string) => {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', weekday: 'short' });
  };

  const formatRegTime = (dateStr: string) => {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return '';
    return d.toLocaleDateString('ko-KR', { month: 'numeric', day: 'numeric' }) + ' ' + d.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false });
  };

  return (
    <div className="container">
      <nav className="nav">
        <button className={view === 'dashboard' ? 'active' : ''} onClick={() => handleNav('dashboard')}>대시보드</button>
        <button className={view === 'events' ? 'active' : ''} onClick={() => handleNav('events')}>부서별 행사</button>
        <button className={view === 'submit' ? 'active' : ''} onClick={() => handleNav('submit')}>광고/일정 제출</button>
      </nav>

      {view === 'submit' && (
        <div className="view-content">
          <h1><img src="/logo.png" alt="Joyful" style={{ height: '35px', verticalAlign: 'middle', marginRight: '10px' }} /> 광고/일정</h1>
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label>제목</label>
              <input name="title" value={formData.title} onChange={handleChange} required placeholder="광고 제목을 입력하세요" />
            </div>
            <div className="form-group">
              <label>작성자</label>
              <input name="author" value={formData.author} onChange={handleChange} required placeholder="이름 또는 닉네임" />
            </div>
            <div className="form-group">
              <label>카테고리</label>
              <select name="category" value={formData.category} onChange={handleChange}>
                {CATEGORIES.map(cat => <option key={cat} value={cat}>{cat}</option>)}
              </select>
            </div>
            {formData.category === "부서별 행사일정" && (
              <>
                <div className="form-group">
                  <label>행사 일자</label>
                  <input type="date" name="eventDate" value={formData.eventDate} onChange={handleChange} required />
                </div>
                <div className="form-group">
                  <label>장소</label>
                  <input name="location" value={formData.location} onChange={handleChange} required placeholder="행사 장소를 입력하세요" />
                </div>
              </>
            )}
            <div className="form-group">
              <label>내용</label>
              <textarea name="content" value={formData.content} onChange={handleChange} required placeholder="광고 내용을 상세히 적어주세요" rows={5}></textarea>
            </div>
            <button type="submit">광고/일정 제출</button>
          </form>
          {status && <p className="status-msg">{status}</p>}
        </div>
      )}

      {view === 'events' && (
        <div className="view-content">
          <h1><img src="/logo.png" alt="Joyful" style={{ height: '35px', verticalAlign: 'middle', marginRight: '10px' }} /> 부서별 행사 일정</h1>
          <div className="week-section">
            <h2 className="week-title">{currentWeek.text}</h2>
            {loading ? <p>로딩 중...</p> : (
              <>
                <div className="category-section">
                  <h3 className="category-title">이번 주 행사</h3>
                  <div className="ad-list">
                    {categorizedAds.currentWeek["부서별 행사일정"] && categorizedAds.currentWeek["부서별 행사일정"].length > 0 ? (
                      categorizedAds.currentWeek["부서별 행사일정"].map((ad, idx) => (
                        <div key={idx} className="ad-card">
                          <h3>{ad.title || '제목 없음'}</h3>
                          <div className="ad-info-badges">
                            <div className="ad-date-badge">📅 {formatDisplayDate(ad.date)}</div>
                            {ad.location && <div className="ad-location">📍 {ad.location}</div>}
                          </div>
                          <p>{ad.content || '내용이 없습니다.'}</p>
                          <div className="ad-footer">
                            <span className="reg-date">{ad.author || '익명'} | 기록: {formatRegTime(ad.regDate)}</span>
                            <div className="ad-actions">
                              <button onClick={() => handleEdit(ad)}>수정</button>
                              <button onClick={() => handleDelete(ad.id)}>삭제</button>
                            </div>
                          </div>
                        </div>
                      ))
                    ) : (
                      <p className="no-data">이번 주 예정된 행사가 없습니다.</p>
                    )}
                  </div>
                </div>

                {categorizedAds.futureEvents.length > 0 && (
                  <div className="category-section">
                    <h3 className="category-title">다음 주 이후 행사 일정</h3>
                    <div className="ad-list">
                      {categorizedAds.futureEvents.map((ad, idx) => (
                        <div key={idx} className="ad-card">
                          <h3>{ad.title || '제목 없음'}</h3>
                          <div className="ad-info-badges">
                            <div className="ad-date-badge">📅 {formatDisplayDate(ad.date)}</div>
                            {ad.location && <div className="ad-location">📍 {ad.location}</div>}
                          </div>
                          <p>{ad.content || '내용이 없습니다.'}</p>
                          <div className="ad-footer">
                            <span className="reg-date">{ad.author || '익명'} | 기록: {formatRegTime(ad.regDate)}</span>
                            <div className="ad-actions">
                              <button onClick={() => handleEdit(ad)}>수정</button>
                              <button onClick={() => handleDelete(ad.id)}>삭제</button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {view === 'dashboard' && (
        <div className="view-content">
          <h1><img src="/logo.png" alt="Joyful" style={{ height: '35px', verticalAlign: 'middle', marginRight: '10px' }} /> Ministry Schedule</h1>
          <div className="week-section">
            <h2 className="week-title">{currentWeek.text}</h2>
            {loading ? <p>로딩 중...</p> : (
              CATEGORIES.filter(cat => cat !== "부서별 행사일정").map(category => (
                <div key={category} className="category-section">
                  <h3 className="category-title">{category}</h3>
                  <div className="ad-list">
                    {categorizedAds.currentWeek[category] && categorizedAds.currentWeek[category].length > 0 ? (
                    categorizedAds.currentWeek[category].map((ad, idx) => (
                      <div key={idx} className="ad-card">
                        <h3>{ad.title || '제목 없음'}</h3>
                        <p>{ad.content || '내용이 없습니다.'}</p>
                        <div className="ad-footer">
                          <span className="reg-date">{ad.author || '익명'} | 기록: {formatRegTime(ad.regDate)}</span>
                          <div className="ad-actions">
                            <button onClick={() => handleEdit(ad)}>수정</button>
                            <button onClick={() => handleDelete(ad.id)}>삭제</button>
                          </div>
                        </div>
                      </div>
                    ))
                    ) : (                      <p className="no-data">해당 주간에 등록된 내용이 없습니다.</p>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
