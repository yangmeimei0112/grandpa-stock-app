import { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import { AlertTriangle } from 'lucide-react';

export default function Portfolio() {
  const [portfolio, setPortfolio] = useState([]);
  const [loading, setLoading] = useState(true);
  const [apiError, setApiError] = useState(false);

  useEffect(() => {
    async function fetchPortfolio() {
      try {
        // 1. 抓取資料庫目前的庫存 (平均成本與股數)
        const { data: dbData, error } = await supabase.from('portfolio_view').select('*');
        if (error) throw error;

        // 2. 嘗試從證交所抓取最新「所有股票」的收盤價
        let stockPriceMap = {};
        try {
          const twseRes = await fetch('/api/twse/v1/exchangeReport/STOCK_DAY_ALL');
          if (twseRes.ok) {
            const twseData = await twseRes.json();
            // 將陣列轉換成字典方便尋找 { "2330": 820.0, "0050": 155.0 }
            twseData.forEach(item => {
              stockPriceMap[item.Code] = parseFloat(item.ClosingPrice);
            });
            setApiError(false);
          } else {
            setApiError(true);
          }
        } catch (e) {
          console.warn("官方報價抓取失敗，使用成本價", e);
          setApiError(true);
        }

        // 3. 結合庫存與市價，算出單檔損益
        const mergedData = dbData.map(item => {
          // 如果證交所有這檔股票的報價就用，沒有的話就暫時用成本價代替
          const currentPrice = stockPriceMap[item.stock_symbol] || item.avg_cost; 
          const cost = Number(item.avg_cost);
          const shares = Number(item.total_shares);
          
          // 計算損益金額與報酬率 (%)
          const profit = (currentPrice - cost) * shares;
          const profitPercent = cost > 0 ? ((currentPrice - cost) / cost) * 100 : 0;

          return {
            ...item,
            currentPrice,
            profit,
            profitPercent,
            isUp: profit >= 0
          };
        });

        setPortfolio(mergedData);
      } catch (err) {
        console.error("讀取庫存資料失敗:", err);
      } finally {
        setLoading(false);
      }
    }

    fetchPortfolio();
  }, []);

  return (
    <div className="p-4 space-y-4">
      <h2 className="text-xl font-bold text-gray-800 mb-2">💼 目前庫存與損益</h2>
      
      {apiError && (
        <div className="bg-yellow-50 text-yellow-700 p-2 rounded-lg text-xs flex items-center justify-center border border-yellow-200 shadow-sm">
          <AlertTriangle size={14} className="mr-1" />
          無法取得最新報價，目前以成本價顯示。
        </div>
      )}

      <div className="grid grid-cols-1 gap-4">
        {loading ? (
          <p className="text-center text-gray-500 py-10">結算庫存與即時報價中...</p>
        ) : portfolio.length === 0 ? (
          <p className="text-center text-gray-500 py-10 bg-white rounded-xl shadow-sm border border-gray-200">
            目前沒有持有任何股票喔！
          </p>
        ) : (
          portfolio.map((item) => (
            <div key={item.stock_symbol} className="bg-white p-5 rounded-xl shadow-sm border border-gray-200 flex flex-col">
              {/* 上半部：股票代號與股數 */}
              <div className="flex justify-between items-start border-b border-gray-100 pb-3 mb-3">
                <div>
                  <h3 className="font-bold text-2xl text-gray-800">{item.stock_symbol}</h3>
                  <div className="text-sm mt-1 flex flex-col space-y-1">
                    <span className="text-gray-500">平均成本: <span className="font-medium text-gray-700">${Number(item.avg_cost).toFixed(2)}</span></span>
                    <span className="text-gray-500">實際收盤: <span className="font-bold text-blue-600">${Number(item.currentPrice).toFixed(2)}</span></span>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-xl font-bold text-gray-800">{item.total_shares} <span className="text-sm text-gray-500 font-normal">股</span></div>
                </div>
              </div>
              
              {/* 下半部：單檔未實現損益 */}
              <div className="flex justify-between items-center bg-gray-50 p-3 rounded-lg">
                <span className="text-sm font-medium text-gray-500">未實現損益</span>
                <div className={`text-lg font-bold flex items-center ${item.isUp ? 'text-red-600' : 'text-green-600'}`}>
                  {item.isUp ? '+' : ''}${Math.round(item.profit).toLocaleString()} 
                  <span className={`text-xs ml-2 px-2 py-0.5 rounded shadow-sm bg-white border ${item.isUp ? 'border-red-100 text-red-600' : 'border-green-100 text-green-600'}`}>
                    {item.isUp ? '▲' : '▼'} {Math.abs(item.profitPercent).toFixed(2)}%
                  </span>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}