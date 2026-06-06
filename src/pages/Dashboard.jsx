import { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import { RefreshCw, AlertTriangle } from 'lucide-react';

export default function Dashboard() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdateTime, setLastUpdateTime] = useState('--:--:--');
  const [apiError, setApiError] = useState(false);
  
  // 大盤狀態多加了一個 date 欄位
  const [taiex, setTaiex] = useState({ price: 0, change: 0, percent: 0, isUp: true, date: '' });
  
  const [totalCost, setTotalCost] = useState(0);
  const [totalMarketValue, setTotalMarketValue] = useState(0);
  const [grandpaProfit, setGrandpaProfit] = useState(0);

  const fetchTwseData = async () => {
    try {
      const taiexRes = await fetch('/api/twse/v1/exchangeReport/FMTQIK');
      if (!taiexRes.ok) throw new Error('大盤資料抓取失敗');
      const taiexData = await taiexRes.json();
      
      const latestTaiex = taiexData[taiexData.length - 1];
      const taiexPrice = parseFloat(latestTaiex.TAIEX.replace(/,/g, ''));
      const prevTaiex = taiexData[taiexData.length - 2];
      const prevTaiexPrice = parseFloat(prevTaiex.TAIEX.replace(/,/g, ''));
      
      const change = taiexPrice - prevTaiexPrice;
      const percent = (change / prevTaiexPrice) * 100;

      // 解析並轉換大盤日期 (例如將民國 "1130605" 轉成西元 "2024/06/05")
      let parsedDate = '';
      if (latestTaiex.Date) {
        const cleanDate = latestTaiex.Date.replace(/\//g, ''); // 防呆：移除可能的斜線
        if (cleanDate.length >= 7) {
          const y = parseInt(cleanDate.slice(0, cleanDate.length - 4)) + 1911;
          const m = cleanDate.slice(-4, -2);
          const d = cleanDate.slice(-2);
          parsedDate = `${y}/${m}/${d}`;
        }
      }

      const currentTaiexState = {
        price: taiexPrice,
        change: change,
        percent: percent,
        isUp: change >= 0,
        date: parsedDate
      };

      const stockRes = await fetch('/api/twse/v1/exchangeReport/STOCK_DAY_ALL');
      if (!stockRes.ok) throw new Error('個股資料抓取失敗');
      const stockData = await stockRes.json();

      const stockPriceMap = {};
      stockData.forEach(item => {
        stockPriceMap[item.Code] = parseFloat(item.ClosingPrice);
      });

      return { taiex: currentTaiexState, stockPriceMap };

    } catch (error) {
      console.error("TWSE API 發生錯誤:", error);
      throw error;
    }
  };

  const loadDashboardData = async (isManualRefresh = false) => {
    if (isManualRefresh) setRefreshing(true);
    let hasAnyError = false;
    
    try {
      const twseData = await fetchTwseData();
      setTaiex(twseData.taiex);

      const { data: portfolioData, error } = await supabase.from('portfolio_view').select('*');

      if (!error && portfolioData) {
        let currentTotalCost = 0;
        let currentTotalValue = 0;

        portfolioData.forEach((item) => {
          const currentPrice = twseData.stockPriceMap[item.stock_symbol] || item.avg_cost; 
          currentTotalCost += Number(item.total_shares) * Number(item.avg_cost);
          currentTotalValue += Number(item.total_shares) * currentPrice;
        });

        const totalProfit = currentTotalValue - currentTotalCost;
        setTotalCost(currentTotalCost);
        setTotalMarketValue(currentTotalValue);
        setGrandpaProfit(totalProfit * 0.5);
      }
      
      setApiError(false);
      setLastUpdateTime(new Date().toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    } catch (error) {
      console.error("載入資料失敗:", error);
      setApiError(true);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadDashboardData();
    const intervalId = setInterval(() => {
      loadDashboardData();
    }, 300000); 
    return () => clearInterval(intervalId);
  }, []);

  return (
    <div className="p-4 space-y-4">
      {apiError && (
        <div className="bg-red-50 text-red-700 p-2 rounded-lg text-xs flex items-center justify-center border border-red-200 shadow-sm">
          <AlertTriangle size={14} className="mr-1" />
          無法取得證交所最新報價，目前顯示歷史成本數據。
        </div>
      )}

      {/* 頂部：大盤資訊區塊 */}
      <div className={`rounded-2xl p-5 text-white shadow-lg relative overflow-hidden transition-colors ${taiex.isUp ? 'bg-gradient-to-r from-red-500 to-red-700' : 'bg-gradient-to-r from-green-600 to-green-800'}`}>
        <div className="flex justify-between items-center mb-1">
          <h2 className="text-sm opacity-90 flex items-center">
            台灣加權指數
            {/* 在這裡動態加上是哪一天的收盤價 */}
            {taiex.date && <span className="ml-2 bg-black bg-opacity-20 px-2 py-0.5 rounded text-xs">{taiex.date} 收盤</span>}
          </h2>
          <button onClick={() => loadDashboardData(true)} disabled={refreshing} className="p-1 rounded-full hover:bg-white/20 transition">
            <RefreshCw size={16} className={`text-white opacity-80 ${refreshing ? 'animate-spin' : ''}`} />
          </button>
        </div>
        
        {loading && taiex.price === 0 ? (
          <div className="text-xl font-medium animate-pulse">官方資料結算中...</div>
        ) : (
          <div className="flex items-baseline space-x-2">
            <span className="text-3xl font-bold">{taiex.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
            <span className="font-medium text-sm bg-white/20 px-2 py-0.5 rounded">
              {taiex.isUp ? '▲' : '▼'} {Math.abs(taiex.change).toFixed(2)} ({Math.abs(taiex.percent).toFixed(2)}%)
            </span> 
          </div>
        )}
      </div>

      {/* 核心區塊：外公的專屬利潤 */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 text-center relative mt-2">
        <div className="absolute top-0 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-yellow-400 text-yellow-900 px-4 py-1 rounded-full text-xs font-bold shadow-sm border border-yellow-200">
          ✨ 外公專屬 50% 利潤 ✨
        </div>
        
        {loading && totalMarketValue === 0 ? (
          <p className="py-6 text-gray-400 animate-pulse">精算市價中...</p>
        ) : (
          <div className="mt-4">
            <div className={`text-4xl font-extrabold transition-all duration-500 ${grandpaProfit >= 0 ? 'text-red-600' : 'text-green-600'}`}>
              {grandpaProfit >= 0 ? '+' : ''}${Math.round(grandpaProfit).toLocaleString()}
            </div>
            <p className="text-sm text-gray-500 mt-2">基於官方最新收盤價估算</p>
          </div>
        )}
      </div>

      {/* 輔助數據：目前總市值與總成本 */}
      <div className="grid grid-cols-2 gap-3 mt-2">
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
          <p className="text-xs text-gray-400 font-medium mb-1">總市值 (收盤價)</p>
          <p className="text-lg font-bold text-gray-800">${Math.round(totalMarketValue).toLocaleString()}</p>
        </div>
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
          <p className="text-xs text-gray-400 font-medium mb-1">已投入總成本</p>
          <p className="text-lg font-bold text-gray-800">${Math.round(totalCost).toLocaleString()}</p>
        </div>
      </div>
      
      <div className="text-center mt-6">
        <p className="text-xs text-gray-400">
          官方盤後數據最後更新: {lastUpdateTime}
        </p>
      </div>
    </div>
  );
}