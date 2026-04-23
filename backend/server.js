require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { GoogleSpreadsheet } = require('google-spreadsheet');
const { JWT } = require('google-auth-library');
const { Client } = require('@notionhq/client');

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 5001;

// 연동 정보
const NOTION_TOKEN = process.env.NOTION_TOKEN;
const NOTION_DB_ID = process.env.NOTION_DB_ID;
const GOOGLE_SHEET_ID = process.env.GOOGLE_SHEET_ID;
const GOOGLE_SERVICE_ACCOUNT_EMAIL = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
const GOOGLE_PRIVATE_KEY = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n');

// 서비스 클라이언트 초기화
const notion = new Client({ auth: NOTION_TOKEN });

// Google Sheets 인증 설정
const serviceAccountAuth = new JWT({
  email: GOOGLE_SERVICE_ACCOUNT_EMAIL,
  key: GOOGLE_PRIVATE_KEY,
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});

// 1. 광고 저장 API
app.post('/api/ads', async (req, res) => {
  const { title, content, author, category, location, eventDate } = req.body;

  try {
    const doc = new GoogleSpreadsheet(GOOGLE_SHEET_ID, serviceAccountAuth);
    await doc.loadInfo();
    const sheet = doc.sheetsByIndex[0];
    
    const now = new Date().toISOString();
    const finalEventDate = eventDate ? eventDate : now;

    await sheet.addRow({
      날짜: now,
      제목: title,
      내용: content,
      작성자: author,
      카테고리: category,
      장소: location || '',
      '행사 일자': finalEventDate
    });

    const notionProperties = {
      제목: { title: [{ text: { content: title } }] },
      내용: { rich_text: [{ text: { content: content } }] },
      작성자: { select: { name: author } },
      카테고리: { multi_select: [{ name: category }] },
      날짜: { date: { start: now } },
      장소: { rich_text: [{ text: { content: location || '' } }] },
      '행사 일자': { date: { start: finalEventDate } }
    };

    try {
      await notion.pages.create({
        parent: { database_id: NOTION_DB_ID },
        properties: notionProperties
      });
    } catch (e) {
      console.warn('Notion save warning:', e.message);
      delete notionProperties['행사 일자'];
      await notion.pages.create({
        parent: { database_id: NOTION_DB_ID },
        properties: notionProperties
      });
    }

    res.status(200).json({ success: true, message: '광고가 성공적으로 등록되었습니다!' });
  } catch (error) {
    console.error('Error Details:', error);
    res.status(500).json({ success: false, message: '저장 중 오류가 발생했습니다.', error: error.message });
  }
});

// 2. 광고 조회 API
app.get('/api/ads', async (req, res) => {
  try {
    const doc = new GoogleSpreadsheet(GOOGLE_SHEET_ID, serviceAccountAuth);
    await doc.loadInfo();
    const sheet = doc.sheetsByIndex[0];
    const rows = await sheet.getRows();

    const ads = rows
      .map((row, index) => {
        const data = row.toObject();
        const displayDate = data['행사 일자'] || data['날짜'];
        
        return {
          id: index,
          date: displayDate,
          regDate: data['날짜'],
          title: data['제목'],
          content: data['내용'],
          author: data['작성자'],
          category: data['카테고리'],
          location: data['장소']
        };
      })
      .filter(ad => ad.title || ad.content);

    res.status(200).json({ success: true, data: ads });
  } catch (error) {
    console.error('Error fetching ads:', error);
    res.status(500).json({ success: false, message: '데이터를 가져오는데 실패했습니다.' });
  }
});

// 3. 광고 삭제 API
app.delete('/api/ads/:index', async (req, res) => {
  try {
    const doc = new GoogleSpreadsheet(GOOGLE_SHEET_ID, serviceAccountAuth);
    await doc.loadInfo();
    const sheet = doc.sheetsByIndex[0];
    const rows = await sheet.getRows();
    const index = parseInt(req.params.index);
    
    if (rows[index]) {
      await rows[index].delete();
      res.status(200).json({ success: true });
    } else {
      res.status(404).json({ success: false, message: '광고를 찾을 수 없습니다.' });
    }
  } catch (error) {
    res.status(500).json({ success: false, message: '삭제 중 오류가 발생했습니다.' });
  }
});

// 4. 광고 수정 API
app.put('/api/ads/:index', async (req, res) => {
  const { title, content, author, category, location, eventDate } = req.body;
  try {
    const doc = new GoogleSpreadsheet(GOOGLE_SHEET_ID, serviceAccountAuth);
    await doc.loadInfo();
    const sheet = doc.sheetsByIndex[0];
    const rows = await sheet.getRows();
    const index = parseInt(req.params.index);
    
    if (rows[index]) {
      rows[index].assign({
        제목: title,
        내용: content,
        작성자: author,
        카테고리: category,
        장소: location || '',
        '행사 일자': eventDate
      });
      await rows[index].save();
      res.status(200).json({ success: true });
    } else {
      res.status(404).json({ success: false, message: '광고를 찾을 수 없습니다.' });
    }
  } catch (error) {
    res.status(500).json({ success: false, message: '수정 중 오류가 발생했습니다.' });
  }
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
