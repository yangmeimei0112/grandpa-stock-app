import { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import { Lock, Unlock, BarChart3, ArrowRightLeft, Activity, Edit, Trash2, Save, X, TrendingUp, Calendar } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

const CORE_STOCK_DICT = {
  "0050": "元大台灣50", "0056": "元大高股息", "00878": "國泰永續高股息", "00919": "群益台灣精選高息", "00929": "復華台灣科技優息", "006208": "富邦台50",
  "2330": "台積電", "2317": "鴻海", "2454": "聯發科", "2308": "台達電", "2303": "聯電", "2382": "廣達", "3231": "緯創", "2412": "中華電",
  "2881": "富邦金", "2882": "國泰金", "2891": "中信金", "2886": "兆豐金", "2884": "玉山金", "2892": "第一金",
  "2002": "中鋼", "1101": "台泥", "2603": "長榮", "2609": "陽明", "2615": "萬海"
};

export default function Manager() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [password, setPassword] = useState('');
  const [activeTab, setActiveTab] = useState('trade');
  const [stockDict, setStockDict] = useState(CORE_STOCK_DICT);
  
  const [transactions, setTransactions] = useState([]);
  const [symbol, setSymbol] = useState('');
  const [type, setType] = useState('buy');
  const [shares, setShares] = useState('');
  const [price, setPrice] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [editData, setEditData] = useState({ shares: '', price: '' });
  
  // 圖表與籌碼狀態
  const [chipHistory, setChipHistory] = useState([]);
  const [allChips, setAllChips] = useState([]); // 儲存原始資料供日期篩選
  const [availableDates, setAvailableDates] = useState([]);
  const [selectedDate, setSelectedDate] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const updateDict = async () => {
      try {
        const res = await fetch(`https://corsproxy.io/?https://openapi.twse.com.tw/v1/exchangeReport/STOCK_DAY_ALL`);
        if (!res.ok) return;
        const data = await res.json();
        const fullDict = { ...CORE_STOCK_DICT };
        data.forEach(item => { if (item.Code) fullDict[item.Code.trim()] = item.Name.trim(); });
        setStockDict(fullDict);
      } catch (err) { console.warn("背景更新字典略過"); }
    };
    updateDict();
  }, []);

  useEffect(() => {
    if (isAuthenticated) {
      if (activeTab === 'trade') fetchTransactions();
      if (activeTab === 'chips') fetchSupabaseChips();
    }
  }, [activeTab, isAuthenticated]);

  const fetchTransactions = async () => {
    const { data } = await supabase.from('transactions').select('*').order('created_at', { ascending: false });
    if (data) setTransactions(data);
  };

  const fetchSupabaseChips = async () => {
    setLoading(true);
    const { data } = await supabase.from('sector_fund_flow').select('*').order('date', { ascending: true });
    if (data && data.length > 0) {
      setAllChips(data);
      // 1. 折線圖數據 (處理所有資料)
      const grouped = data.reduce((acc, row) => {
        if (!acc[row.date]) acc[row.date] = { date: row.date.slice(5), tech: 0, fin: 0, trad: 0 };
        acc[row.date][row.sector] = row.foreign_net + row.trust_net + row.dealer_net;
        return acc;
      }, {});
      setChipHistory(Object.values(grouped));

      // 2. 設定日期選單
      const dates = [...new Set(data.map(d => d.date))].sort((a,b) => b.localeCompare(a));
      setAvailableDates(dates);
      setSelectedDate(dates[0]); // 預設選最新日
    }
    setLoading(false);
  };

  // 動態計算選定日期的數據
  const getSelectedDayData = () => {
    const dailyRows = allChips.filter(d => d.date === selectedDate);
    const sectors = dailyRows.reduce((acc, r) => { acc[r.sector] = r.foreign_net + r.trust_net + r.dealer_net; return acc; }, {tech:0, fin:0, trad:0});
    const investors = dailyRows.reduce((acc, r) => { acc.foreign += r.foreign_net; acc.trust += r.trust_net; acc.dealer += r.dealer_net; return acc; }, {foreign:0, trust:0, dealer:0});
    return { sectors, investors };
  };

  const dayData = getSelectedDayData();

  const handleAdd = async (e) => {
    e.preventDefault();
    await supabase.from('transactions').insert([{ stock_symbol: symbol.toUpperCase(), type, shares: Number(shares), price: Number(price) }]);
    setSymbol(''); setShares(''); setPrice(''); fetchTransactions();
  };

  const handleDelete = async (id) => {
    if (window.confirm('確定刪除？')) {
      await supabase.from('transactions').delete().eq('id', id);
      fetchTransactions();
    }
  };

  const saveEdit = async (id) => {
    await supabase.from('transactions').update({ shares: Number(editData.shares), price: Number(editData.price) }).eq('id', id);
    setEditingId(null); fetchTransactions();
  };

  if (!isAuthenticated) return (
    <div className="flex flex-col items-center justify-center min-h-[80vh] p-4">
      <div className="bg-white p-10 rounded-3xl shadow-xl w-full max-w-md text-center">
        <h2 className="text-2xl font-black mb-6">系統管理後台</h2>
        <input type="password" placeholder="輸入通行碼" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full bg-gray-50 border p-4 rounded-2xl text-center mb-4" />
        <button onClick={() => password === '0000' ? setIsAuthenticated(true) : alert('密碼錯誤')} className="w-full bg-gray-900 text-white font-bold py-4 rounded-2xl">解鎖</button>
      </div>
    </div>
  );

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex gap-2">
        <button onClick={() => setActiveTab('trade')} className={`flex-1 p-4 rounded-2xl font-bold ${activeTab === 'trade' ? 'bg-indigo-600 text-white' : 'bg-white shadow-sm'}`}>交易管理</button>
        <button onClick={() => setActiveTab('chips')} className={`flex-1 p-4 rounded-2xl font-bold ${activeTab === 'chips' ? 'bg-indigo-600 text-white' : 'bg-white shadow-sm'}`}>籌碼圖表</button>
      </div>

      {activeTab === 'trade' ? (
        <div className="space-y-6">
            <div className="bg-white rounded-3xl p-6 shadow-sm border">
                <h3 className="font-bold mb-4">記錄新交易</h3>
                <form onSubmit={handleAdd} className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="relative">
                        <input required placeholder="代號(如 2330)" value={symbol} onChange={e => setSymbol(e.target.value)} className="w-full border p-3 rounded-xl uppercase" />
                        <span className="absolute right-2 top-3 text-xs font-bold text-indigo-500">{stockDict[symbol.trim().toUpperCase()] || ''}</span>
                    </div>
                    <select value={type} onChange={e => setType(e.target.value)} className="border p-3 rounded-xl"><option value="buy">買入</option><option value="sell">賣出</option></select>
                    <input required type="number" placeholder="股數" value={shares} onChange={e => setShares(e.target.value)} className="border p-3 rounded-xl" />
                    <input required type="number" step="0.01" placeholder="單價" value={price} onChange={e => setPrice(e.target.value)} className="border p-3 rounded-xl" />
                    <button type="submit" className="col-span-2 md:col-span-4 bg-gray-900 text-white p-3 rounded-xl">新增紀錄</button>
                </form>
            </div>
            <div className="bg-white rounded-3xl shadow-sm border overflow-hidden">
                <table className="w-full text-sm">
                    <thead className="bg-gray-50"><tr><th className="p-4">標的</th><th className="p-4">股數</th><th className="p-4">單價</th><th className="p-4">操作</th></tr></thead>
                    <tbody>
                    {transactions.map(txn => (
                        <tr key={txn.id} className="border-t text-center">
                            <td className="p-4 font-bold">{txn.stock_symbol} <span className="text-[10px] text-gray-400">{stockDict[txn.stock_symbol.trim().toUpperCase()] || '上市企業'}</span></td>
                            <td className="p-4">{editingId === txn.id ? <input type="number" value={editData.shares} onChange={e=>setEditData({...editData, shares: e.target.value})} className="w-16 border rounded" /> : txn.shares}</td>
                            <td className="p-4">${editingId === txn.id ? <input type="number" value={editData.price} onChange={e=>setEditData({...editData, price: e.target.value})} className="w-16 border rounded" /> : txn.price}</td>
                            <td className="p-4 space-x-2">
                                {editingId === txn.id ? <button onClick={() => saveEdit(txn.id)} className="text-indigo-600">存檔</button> : <><button onClick={() => {setEditingId(txn.id); setEditData({shares:txn.shares, price:txn.price})}} className="text-blue-500">編輯</button><button onClick={() => handleDelete(txn.id)} className="text-red-500">刪除</button></>}
                            </td>
                        </tr>
                    ))}
                    </tbody>
                </table>
            </div>
        </div>
      ) : (
        <div className="space-y-6">
            <div className="bg-white p-6 rounded-3xl shadow-sm border h-64">
                <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chipHistory}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="date" fontSize={10} />
                        <YAxis fontSize={10} />
                        <Tooltip />
                        <Legend fontSize={10} />
                        <Line dataKey="tech" stroke="#ef4444" name="科技" dot={false} />
                        <Line dataKey="fin" stroke="#3b82f6" name="金融" dot={false} />
                        <Line dataKey="trad" stroke="#eab308" name="傳產" dot={false} />
                    </LineChart>
                </ResponsiveContainer>
            </div>

            {/* 日期選擇器區塊 */}
            <div className="bg-white p-4 rounded-2xl border flex items-center gap-3">
                <Calendar className="text-gray-400" size={20}/>
                <select value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} className="w-full font-bold bg-transparent">
                    {availableDates.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
            </div>

            <div className="text-sm font-bold text-gray-500">結算日: {selectedDate}</div>
            <div className="grid grid-cols-3 gap-3">
                {[ {l:'科技(電子)', v:dayData.sectors.tech}, {l:'金融保險', v:dayData.sectors.fin}, {l:'傳產(非金電)', v:dayData.sectors.trad} ].map(item => (
                    <div key={item.l} className="bg-[#1e293b] p-4 rounded-2xl text-white text-center">
                        <div className="text-[10px] text-gray-400">{item.l}</div>
                        <div className={`text-lg font-bold ${item.v>=0?'text-green-400':'text-red-400'}`}>{item.v.toFixed(0)} 億</div>
                    </div>
                ))}
            </div>

            <div className="bg-white p-6 rounded-3xl border shadow-sm">
                <h3 className="text-sm font-bold mb-4">三大法人買賣超 (億元)</h3>
                {[ {l:'外資', v:dayData.investors.foreign}, {l:'投信', v:dayData.investors.trust}, {l:'自營商', v:dayData.investors.dealer} ].map(item => (
                    <div key={item.l} className="mb-4">
                        <div className="flex justify-between text-xs mb-1"><span>{item.l}</span><span className={item.v>=0?'text-red-500':'text-green-500'}>{item.v.toFixed(2)}</span></div>
                        <div className="h-3 bg-gray-100 rounded-full"><div className={`h-full ${item.v>=0?'bg-red-400':'bg-green-400'}`} style={{width: `${Math.min(Math.abs(item.v)/5, 100)}%`}} /></div>
                    </div>
                ))}
            </div>
        </div>
      )}
    </div>
  );
}