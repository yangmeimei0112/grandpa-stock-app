require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const WebSocket = require('ws'); // 🌟 解決 Node.js 20 雲端環境缺少 WebSocket 的問題

// 初始化 Supabase 連線 (自動支援 Vite 格式或標準格式的變數名稱)
const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
if (!supabaseUrl || !supabaseKey) {
  console.error('❌ 錯誤：找不到 Supabase 環境變數，請檢查環境變數設定');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  realtime: {
    transport: WebSocket
  }
});

const fetchOptions = {
  headers: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko)',
    'Accept': 'application/json'
  }
};

// 📅 日期計算器 (避開週休二日)
const getTradeDate = (daysAgo) => {
  let d = new Date();
  if (d.getDay() === 0) d.setDate(d.getDate() - 2);
  if (d.getDay() === 6) d.setDate(d.getDate() - 1);
  let count = 0;
  while (count < daysAgo) {
    d.setDate(d.getDate() - 1);
    if (d.getDay() === 0) d.setDate(d.getDate() - 2);
    if (d.getDay() === 6) d.setDate(d.getDate() - 1);
    count++;
  }
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return { queryDate: `${yyyy}${mm}${dd}`, displayDate: `${yyyy}-${mm}-${dd}` };
};

async function runRobot() {
  console.log('🤖 TWSE 籌碼結算機器人 (鐵壁防禦完美版) 啟動...');
  
  try {
    // 1. 取得真實產業名單
    console.log('📦 正在下載公司真實產業名單...');
    const companyRes = await fetch('https://openapi.twse.com.tw/v1/opendata/t187ap03_L', fetchOptions);
    if (!companyRes.ok) throw new Error('無法取得產業名單 API');
    const companyData = await companyRes.json();
    
    const sectorMap = {};
    companyData.forEach(company => {
      let code = String(company['公司代號'] || company['Code'] || '').trim();
      let industry = String(company['產業別'] || company['Industry'] || '').trim();
      
      if (!code || code.length !== 4 || code.startsWith('0')) return; 

      // 官方數字產業代碼對照表
      const techCodes = ['24', '25', '26', '27', '28', '29', '30', '31', '33'];
      const finCodes = ['17'];

      // 雙重安全檢驗：代碼符合，或者文字包含關鍵字，皆能精準分類
      if (techCodes.includes(industry) || industry.includes('電子') || industry.includes('半導體') || industry.includes('電腦') || industry.includes('光電') || industry.includes('通信') || industry.includes('資訊') || industry.includes('雲端')) {
        sectorMap[code] = 'tech';
      } else if (finCodes.includes(industry) || industry.includes('金融') || industry.includes('保險')) {
        sectorMap[code] = 'fin';
      } else {
        sectorMap[code] = 'trad';
      }
    });

    // 2. 取得收盤價基準
    console.log('💵 正在下載最新收盤價...');
    const priceRes = await fetch('https://openapi.twse.com.tw/v1/exchangeReport/STOCK_DAY_ALL', fetchOptions);
    if (!priceRes.ok) throw new Error('無法取得收盤價 API');
    const priceData = await priceRes.json();
    
    const priceMap = {};
    priceData.forEach(item => {
      const code = String(item.Code || item.證券代號 || '').trim();
      const price = parseFloat(item.ClosingPrice || item.收盤價) || 0;
      if (code && price > 0) priceMap[code] = price;
    });

    // 3. 連續處理並回溯 3 個交易日，確保資料連貫性
    for (let daysAgo = 0; daysAgo <= 2; daysAgo++) {
      let { queryDate, displayDate } = getTradeDate(daysAgo);
      console.log(`\n📊 正在處理 ${displayDate} 的三大法人個股明細...`);
      
      const url = `https://www.twse.com.tw/rwd/zh/fund/T86?response=json&date=${queryDate}&selectType=ALLBUT0999`;
      let t86Res = await fetch(url, fetchOptions);
      let t86Json = await t86Res.json();

      if (t86Json.stat !== "OK") {
         console.log(`⚠️ ${displayDate} 官方無交易資料 (假日/休市)，跳過`);
         continue;
      }

      const result = {
        tech: { foreign: 0, trust: 0, dealer: 0 },
        fin: { foreign: 0, trust: 0, dealer: 0 },
        trad: { foreign: 0, trust: 0, dealer: 0 }
      };

      const fields = t86Json.fields || [];
      const codeIdx = fields.indexOf('證券代號');
      
      // 🌟 嚴格欄位字首比對：精準對應官方外資、投信與自營商欄位，完全避開括號內文字的誤殺與干擾
      const foreignIdx = fields.findIndex(f => (f.startsWith('外陸資') || f.startsWith('外資及陸資') || f.startsWith('外資')) && f.includes('買賣超')); 
      const trustIdx = fields.findIndex(f => f.startsWith('投信') && f.includes('買賣超'));
      const dealerIdxTotal = fields.findIndex(f => f === '自營商買賣超股數' || f === '自營商買賣超股數(自營商)'); 
      const dealerIdx1 = fields.findIndex(f => f.includes('自營商') && f.includes('自行買賣'));
      const dealerIdx2 = fields.findIndex(f => f.includes('自營商') && f.includes('避險'));

      // 🛑 查核機制一：【核心欄位解析警報】
      if (foreignIdx === -1) {
        throw new Error(`[欄位解析警報] 找不到「外資」欄位！當前所有欄位名稱：${fields.join(', ')}`);
      }
      if (trustIdx === -1) {
        throw new Error(`[欄位解析警報] 找不到「投信」欄位！當前所有欄位名稱：${fields.join(', ')}`);
      }
      if (dealerIdxTotal === -1 && (dealerIdx1 === -1 || dealerIdx2 === -1)) {
        throw new Error(`[欄位解析警報] 找不到完整的「自營商」欄位！當前所有欄位名稱：${fields.join(', ')}`);
      }

      const t86Data = t86Json.data || [];
      let totalValidStocks = 0;
      let successfullyClassified = 0;

      t86Data.forEach(row => {
        const code = String(row[codeIdx] || '').trim();
        if (code.length !== 4 || code.startsWith('0')) return; 
        
        totalValidStocks++;
        const sector = sectorMap[code];
        const price = priceMap[code];
        
        if (sector && price) {
          successfullyClassified++;

          let foreignShares = parseFloat(String(row[foreignIdx]).replace(/,/g, ''));
          let trustShares = parseFloat(String(row[trustIdx]).replace(/,/g, ''));
          
          let dealerShares = 0;
          if (dealerIdxTotal > -1) {
               dealerShares = parseFloat(String(row[dealerIdxTotal]).replace(/,/g, ''));
          } else {
               if (dealerIdx1 > -1) dealerShares += parseFloat(String(row[dealerIdx1]).replace(/,/g, ''));
               if (dealerIdx2 > -1) dealerShares += parseFloat(String(row[dealerIdx2]).replace(/,/g, ''));
          }

          foreignShares = isNaN(foreignShares) ? 0 : foreignShares;
          trustShares = isNaN(trustShares) ? 0 : trustShares;
          dealerShares = isNaN(dealerShares) ? 0 : dealerShares;

          // 乘上個股收盤價，精算各類股真實的「買賣超金額 (單位: 億元)」
          result[sector].foreign += (foreignShares * price) / 100000000;
          result[sector].trust += (trustShares * price) / 100000000;
          result[sector].dealer += (dealerShares * price) / 100000000;
        }
      });

      const coverageRate = successfullyClassified / totalValidStocks;
      console.log(`🔍 [安全檢查] 普通股總數: ${totalValidStocks} 檔, 成功分類: ${successfullyClassified} 檔`);
      
      // 🛑 查核機制二：【產業分類覆蓋率熔斷】
      if (coverageRate < 0.85) {
        throw new Error(`[熔斷警報] 產業分類覆蓋率過低 (${(coverageRate * 100).toFixed(2)}%)，拒絕寫入髒資料！`);
      }

      // 🛑 查核機制三：【實體法人總額零值異常攔截】
      const totalForeignMarket = Math.abs(result.tech.foreign) + Math.abs(result.fin.foreign) + Math.abs(result.trad.foreign);
      const totalTrustMarket = Math.abs(result.tech.trust) + Math.abs(result.fin.trust) + Math.abs(result.trad.trust);
      const totalDealerMarket = Math.abs(result.tech.dealer) + Math.abs(result.fin.dealer) + Math.abs(result.trad.dealer);

      if (totalForeignMarket === 0) throw new Error(`[數據防護警報] 外資當日總計為 0 億！欄位解析出錯，取消上傳！`);
      if (totalTrustMarket === 0) throw new Error(`[數據防護警報] 投信當日總計為 0 億！欄位解析出錯，取消上傳！`);
      if (totalDealerMarket === 0) throw new Error(`[數據防護警報] 自營商當日總計為 0 億！欄位解析出錯，取消上傳！`);

      // 🛑 查核機制四：【三大板塊零值漏洞攔截】
      const techSum = Math.abs(result.tech.foreign) + Math.abs(result.tech.trust) + Math.abs(result.tech.dealer);
      const finSum = Math.abs(result.fin.foreign) + Math.abs(result.fin.trust) + Math.abs(result.fin.dealer);
      const tradSum = Math.abs(result.trad.foreign) + Math.abs(result.trad.trust) + Math.abs(result.trad.dealer);

      if (techSum === 0 || finSum === 0 || tradSum === 0) {
        throw new Error(`[數據防護警報] 偵測到板塊數據異常缺漏！科技(${techSum.toFixed(1)}億) | 金融(${finSum.toFixed(1)}億) | 傳產(${tradSum.toFixed(1)}億) 有欄位為 0，攔截寫入！`);
      }

      console.log(`💾 三重檢查通過。正在將 ${displayDate} 的正確籌碼寫入資料庫...`);
      const upsertData = [
        { date: displayDate, sector: 'tech', foreign_net: result.tech.foreign, trust_net: result.tech.trust, dealer_net: result.tech.dealer },
        { date: displayDate, sector: 'fin', foreign_net: result.fin.foreign, trust_net: result.fin.trust, dealer_net: result.fin.dealer },
        { date: displayDate, sector: 'trad', foreign_net: result.trad.foreign, trust_net: result.trad.trust, dealer_net: result.trad.dealer },
      ];

      const { error } = await supabase.from('sector_fund_flow').upsert(upsertData, { onConflict: 'date, sector' });
      if (error) throw error;
    }
    
    console.log('\n🎉 任務大成功！所有安全防護機制驗證通過，資料庫已成功更新！');

  } catch (err) {
    console.error('\n❌ 機器人遭安全機制攔截，錯誤原因:', err.message || err);
  }
}

runRobot();