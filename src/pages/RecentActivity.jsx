import { useState, useEffect } from 'react';
import { supabase } from '../supabase';

export default function RecentActivity() {
  const [recentTx, setRecentTx] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchRecentActivity() {
      // 1. 計算兩天前 (48小時前) 的時間點
      const twoDaysAgo = new Date();
      twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
      const isoString = twoDaysAgo.toISOString();

      // 2. 抓取大於等於 (gte) 兩天前時間點的交易紀錄
      const { data, error } = await supabase
        .from('transactions')
        .select('*')
        .gte('created_at', isoString)
        .order('created_at', { ascending: false });

      if (!error && data) {
        setRecentTx(data);
      } else {
        console.error("讀取近期變動失敗:", error?.message);
      }
      setLoading(false);
    }

    fetchRecentActivity();
  }, []);

  return (
    <div className="p-4">
      <h2 className="text-xl font-bold mb-2 text-gray-800">⚡ 近期變動</h2>
      <p className="text-sm text-gray-500 mb-4">顯示近 48 小時內的新增 (買入) 與刪除 (賣出) 紀錄</p>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        {loading ? (
          <p className="p-6 text-center text-gray-500">資料載入中...</p>
        ) : recentTx.length === 0 ? (
          <p className="p-6 text-center text-gray-500">這兩天沒有任何買賣動作喔！</p>
        ) : (
          recentTx.map((tx) => (
            <div key={tx.id} className="p-4 border-b border-gray-100 last:border-b-0 flex justify-between items-center">
              <div className="flex items-center space-x-3">
                {/* 用顏色與大字體區分買賣，讓長輩一目了然 */}
                <div className={`w-10 h-10 flex items-center justify-center rounded-full text-white font-bold ${tx.type === 'buy' ? 'bg-red-500' : 'bg-green-500'}`}>
                  {tx.type === 'buy' ? '新增' : '刪除'}
                </div>
                <div>
                  <span className="font-bold text-lg text-gray-800">{tx.stock_symbol}</span>
                  <div className="text-xs text-gray-400 mt-1">
                    {new Date(tx.created_at).toLocaleString('zh-TW', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
              </div>
              <div className="text-right">
                <div className="font-medium text-gray-800">{tx.shares} 股</div>
                <div className="text-sm text-gray-500">@ ${tx.price}</div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}