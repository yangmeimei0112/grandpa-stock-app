import { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import { Lock, Unlock, BarChart3, ArrowRightLeft, Activity } from 'lucide-react';

export default function Manager() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [password, setPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  
  const [activeTab, setActiveTab] = useState('trade');

  // 新增交易狀態
  const [symbol, setSymbol] = useState('');
  const [type, setType] = useState('buy');
  const [shares, setShares] = useState('');
  const [price, setPrice] = useState('');

  // 籌碼與類股 API 狀態 (改為從 Supabase 讀取)
  const [timeframe, setTimeframe] = useState('0'); // 0代表最新一筆，1代表上一筆...
  const [chipData, setChipData] = useState({ date: '--', foreign: 0, trust: 0, dealer: 0 });
  const [sectorData, setSectorData] = useState({ tech: 0, fin: 0, trad: 0 });
  const [loadingChips, setLoadingChips] = useState(false);

  const handleLogin = (e) => {
    e.preventDefault();
    if (password === '0000') {
      setIsAuthenticated(true);
      setErrorMsg('');
    } else {
      setErrorMsg('密碼錯誤，請重新輸入');
      setPassword('');
    }
  };

  const handleAddTransaction = async (e) => {
    e.preventDefault();
    if (Number(shares) <= 0 || Number(price) <= 0) {
      alert('股數與價格必須大於 0');
      return;
    }
    const { error } = await supabase.from('transactions').insert([
      { stock_symbol: symbol.toUpperCase(), type, shares: Number(shares), price: Number(price) }
    ]);
    if (!error) {
      alert('✅ 交易新增成功！');
      setSymbol(''); setShares(''); setPrice('');
    } else {
      alert('發生錯誤：' + error.message);
    }
  };

  // ⚡ 光速讀取：直接從我們專屬的 Supabase 資料庫抓取「已經算好」的結果
  const fetchSupabaseChips = async () => {
    setLoadingChips(true);
    try {
      // 一次把資料庫裡算好的所有歷史紀錄抓下來，並按日期新到舊排序
      const { data, error } = await supabase
        .from('sector_fund_flow')
        .select('*')
        .order('date', { ascending: false });

      if (error) throw error;
      if (!data || data.length === 0) {
        setChipData({ date: '尚無資料，請執行機器人', foreign: 0, trust: 0, dealer: 0 });
        return;
      }

      // 將資料依照「日期」進行分組整理
      const groupedByDate = data.reduce((acc, row) => {
        if (!acc[row.date]) acc[row.date] = {};
        acc[row.date][row.sector] = row;
        return acc;
      }, {});

      // 取出所有可用的日期 (例如: ["2026-06-05", "2026-06-04"...])
      const availableDates = Object.keys(groupedByDate).sort((a, b) => b.localeCompare(a)); 
      
      // 根據下拉選單選擇的時間 (timeframe)，決定要看哪一天的資料
      // 防呆：如果資料庫只有 1 天的資料，但使用者選了 3 天前，就停留在最老的那一天
      let targetIndex = parseInt(timeframe);
      if (targetIndex >= availableDates.length) {
        targetIndex = availableDates.length - 1;
      }
      
      const targetDate = availableDates[targetIndex];
      const dayData = groupedByDate[targetDate];

      // 取出三大板塊的數據 (防呆：如果當天某板塊沒資料則補 0)
      const tech = dayData['tech'] || { foreign_net: 0, trust_net: 0, dealer_net: 0 };
      const fin = dayData['fin'] || { foreign_net: 0, trust_net: 0, dealer_net: 0 };
      const trad = dayData['trad'] || { foreign_net: 0, trust_net: 0, dealer_net: 0 };

      // 1. 計算三大法人「總計」買賣超 (供下方長條圖使用)
      const totalForeign = tech.foreign_net + fin.foreign_net + trad.foreign_net;
      const totalTrust = tech.trust_net + fin.trust_net + trad.trust_net;
      const totalDealer = tech.dealer_net + fin.dealer_net + trad.dealer_net;

      // 2. 計算「各板塊」吸金總額 (三大法人合計，供上方卡片使用)
      const techTotal = tech.foreign_net + tech.trust_net + tech.dealer_net;
      const finTotal = fin.foreign_net + fin.trust_net + fin.dealer_net;
      const tradTotal = trad.foreign_net + trad.trust_net + trad.dealer_net;

      setChipData({
        date: targetDate,
        foreign: totalForeign,
        trust: totalTrust,
        dealer: totalDealer
      });

      setSectorData({
        tech: techTotal,
        fin: finTotal,
        trad: tradTotal
      });

    } catch (err) {
      console.error("資料庫讀取錯誤:", err);
      setChipData({ date: '讀取失敗', foreign: 0, trust: 0, dealer: 0 });
    } finally {
      setLoadingChips(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'chips') {
      fetchSupabaseChips();
    }
  }, [timeframe, activeTab]);

  if (!isAuthenticated) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-4">
        <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100 w-full max-w-sm text-center">
          <div className="bg-blue-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 text-blue-600">
            <Lock size={32} />
          </div>
          <h2 className="text-xl font-bold text-gray-800 mb-2">經理人專區</h2>
          <form onSubmit={handleLogin} className="space-y-4 mt-6">
            <input 
              type="password" placeholder="密碼 (0000)" value={password} onChange={(e) => setPassword(e.target.value)} 
              className="w-full border p-3 rounded-xl text-center tracking-[0.5em] focus:outline-none focus:ring-1 focus:ring-blue-500" autoFocus
            />
            {errorMsg && <p className="text-red-500 text-sm">{errorMsg}</p>}
            <button type="submit" className="w-full bg-blue-600 text-white font-bold py-3 rounded-xl">解鎖進入</button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4">
      <div className="flex justify-between items-center mb-2">
        <h2 className="text-xl font-bold text-gray-800 flex items-center">
          <Unlock size={20} className="mr-2 text-green-500" /> 經理人控制台
        </h2>
        <button onClick={() => setIsAuthenticated(false)} className="text-sm px-3 py-1 bg-gray-200 text-gray-600 rounded-lg">鎖定</button>
      </div>

      <div className="flex bg-gray-200 p-1 rounded-xl">
        <button onClick={() => setActiveTab('trade')} className={`flex-1 flex items-center justify-center py-2 rounded-lg text-sm font-bold ${activeTab === 'trade' ? 'bg-white text-blue-700 shadow-sm' : 'text-gray-500'}`}>
          <ArrowRightLeft size={16} className="mr-2" />交易管理
        </button>
        <button onClick={() => setActiveTab('chips')} className={`flex-1 flex items-center justify-center py-2 rounded-lg text-sm font-bold ${activeTab === 'chips' ? 'bg-white text-blue-700 shadow-sm' : 'text-gray-500'}`}>
          <BarChart3 size={16} className="mr-2" />籌碼總經
        </button>
      </div>

      {activeTab === 'trade' && (
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-200 animate-in fade-in slide-in-from-bottom-2">
          <h3 className="font-bold text-gray-700 mb-4 border-b border-gray-100 pb-2">新增交易紀錄</h3>
          <form onSubmit={handleAddTransaction} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div><label className="block text-xs text-gray-500 mb-1">股票代號</label><input required placeholder="2330" value={symbol} onChange={e => setSymbol(e.target.value)} className="w-full border p-3 rounded-xl bg-gray-50 uppercase" /></div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">交易類型</label>
                <select value={type} onChange={e => setType(e.target.value)} className="w-full border p-3 rounded-xl bg-gray-50"><option value="buy" className="text-red-600">買入 (Buy)</option><option value="sell" className="text-green-600">賣出 (Sell)</option></select>
              </div>
              <div><label className="block text-xs text-gray-500 mb-1">成交股數</label><input required type="number" placeholder="1000" value={shares} onChange={e => setShares(e.target.value)} className="w-full border p-3 rounded-xl bg-gray-50" /></div>
              <div><label className="block text-xs text-gray-500 mb-1">成交單價</label><input required type="number" step="0.01" placeholder="820.5" value={price} onChange={e => setPrice(e.target.value)} className="w-full border p-3 rounded-xl bg-gray-50" /></div>
            </div>
            <button type="submit" className="w-full bg-gray-900 text-white p-4 rounded-xl font-bold mt-4">確認送出交易</button>
          </form>
        </div>
      )}

      {activeTab === 'chips' && (
        <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2">
          
          <div className="flex justify-between items-center px-1">
            <h3 className="font-bold text-gray-800">市場籌碼與資金動向</h3>
            <select 
              value={timeframe} 
              onChange={(e) => setTimeframe(e.target.value)}
              className="bg-gray-200 border border-gray-300 text-sm rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium text-gray-700"
            >
              <option value="0">資料庫最新一筆</option>
              <option value="1">資料庫第 2 筆</option>
              <option value="2">資料庫第 3 筆</option>
            </select>
          </div>
          
          <p className="text-xs text-gray-500 text-right pr-1">結算基準日：<span className="font-bold text-blue-600">{chipData.date}</span></p>

          {loadingChips ? (
            <div className="bg-white rounded-2xl p-8 shadow-sm border border-gray-200 text-center animate-pulse">
              <Activity size={24} className="mx-auto text-blue-400 mb-2" />
              <p className="text-gray-400 text-sm">從資料庫極速讀取中...</p>
            </div>
          ) : (
            <>
              {/* 三大板塊 資金輪動卡片 (顯示法人合計淨買賣 億元) */}
              <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl p-5 shadow-md text-white">
                <h4 className="text-sm font-bold text-slate-300 mb-4 flex items-center">
                  <Activity size={16} className="mr-2" /> 三大板塊資金流向 (三大法人合計)
                </h4>
                <div className="grid grid-cols-3 gap-3">
                  <div className="bg-slate-800/50 p-3 rounded-xl border border-slate-700/50 text-center">
                    <p className="text-xs text-slate-400 mb-1">💻 科技(電子)</p>
                    <p className={`text-lg font-bold ${sectorData.tech >= 0 ? 'text-red-400' : 'text-green-400'}`}>
                      {sectorData.tech > 0 ? '+' : ''}{Math.round(sectorData.tech)} 億
                    </p>
                  </div>
                  <div className="bg-slate-800/50 p-3 rounded-xl border border-slate-700/50 text-center">
                    <p className="text-xs text-slate-400 mb-1">🏦 金融保險</p>
                    <p className={`text-lg font-bold ${sectorData.fin >= 0 ? 'text-red-400' : 'text-green-400'}`}>
                      {sectorData.fin > 0 ? '+' : ''}{Math.round(sectorData.fin)} 億
                    </p>
                  </div>
                  <div className="bg-slate-800/50 p-3 rounded-xl border border-slate-700/50 text-center">
                    <p className="text-xs text-slate-400 mb-1">🏭 傳產(非金電)</p>
                    <p className={`text-lg font-bold ${sectorData.trad >= 0 ? 'text-red-400' : 'text-green-400'}`}>
                      {sectorData.trad > 0 ? '+' : ''}{Math.round(sectorData.trad)} 億
                    </p>
                  </div>
                </div>
              </div>

              {/* 三大法人買賣超 */}
              <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-200">
                <h4 className="text-sm font-bold text-gray-500 mb-4">三大法人買賣超 (億元)</h4>
                <div className="space-y-5">
                  {/* 外資 */}
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-bold text-gray-700 w-12">外資</span>
                    <div className="flex-1 mx-3 bg-gray-100 h-2.5 rounded-full overflow-hidden">
                      <div className={`h-full ${chipData.foreign >= 0 ? 'bg-red-500' : 'bg-green-500'}`} style={{ width: `${Math.min(Math.abs(chipData.foreign) / 400 * 100, 100)}%` }}></div>
                    </div>
                    <span className={`text-sm font-bold w-16 text-right ${chipData.foreign >= 0 ? 'text-red-600' : 'text-green-600'}`}>
                      {chipData.foreign > 0 ? '+' : ''}{Number(chipData.foreign).toFixed(2)}
                    </span>
                  </div>
                  {/* 投信 */}
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-bold text-gray-700 w-12">投信</span>
                    <div className="flex-1 mx-3 bg-gray-100 h-2.5 rounded-full overflow-hidden">
                      <div className={`h-full ${chipData.trust >= 0 ? 'bg-red-500' : 'bg-green-500'}`} style={{ width: `${Math.min(Math.abs(chipData.trust) / 100 * 100, 100)}%` }}></div>
                    </div>
                    <span className={`text-sm font-bold w-16 text-right ${chipData.trust >= 0 ? 'text-red-600' : 'text-green-600'}`}>
                      {chipData.trust > 0 ? '+' : ''}{Number(chipData.trust).toFixed(2)}
                    </span>
                  </div>
                  {/* 自營商 */}
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-bold text-gray-700 w-12">自營商</span>
                    <div className="flex-1 mx-3 bg-gray-100 h-2.5 rounded-full overflow-hidden">
                      <div className={`h-full ${chipData.dealer >= 0 ? 'bg-red-500' : 'bg-green-500'}`} style={{ width: `${Math.min(Math.abs(chipData.dealer) / 100 * 100, 100)}%` }}></div>
                    </div>
                    <span className={`text-sm font-bold w-16 text-right ${chipData.dealer >= 0 ? 'text-red-600' : 'text-green-600'}`}>
                      {chipData.dealer > 0 ? '+' : ''}{Number(chipData.dealer).toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}