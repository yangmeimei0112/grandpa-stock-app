import { useState, useEffect } from 'react';
import { supabase } from '../supabase';

export default function HistoryLog() {
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchTransactions = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('transactions')
      .select('*')
      .order('created_at', { ascending: false });

    if (!error) setTransactions(data);
    setLoading(false);
  };

  useEffect(() => {
    fetchTransactions();
  }, []);

  return (
    <div className="p-4">
      <h2 className="text-xl font-bold mb-4 text-gray-800">📝 歷史交易紀錄</h2>
      
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        {loading ? (
          <p className="p-6 text-center text-gray-500">資料載入中...</p>
        ) : transactions.length === 0 ? (
          <p className="p-6 text-center text-gray-500">目前沒有任何交易紀錄</p>
        ) : (
          transactions.map((tx) => (
            <div key={tx.id} className="p-4 border-b border-gray-100 last:border-b-0 flex justify-between items-center">
              <div>
                <span className={`inline-block px-2 py-1 rounded text-xs font-bold mr-2 ${tx.type === 'buy' ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-600'}`}>
                  {tx.type === 'buy' ? '買入' : '賣出'}
                </span>
                <span className="font-bold text-lg text-gray-800">{tx.stock_symbol}</span>
                <div className="text-xs text-gray-400 mt-1">
                  {new Date(tx.created_at).toLocaleString('zh-TW')}
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