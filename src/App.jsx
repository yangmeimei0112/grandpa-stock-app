import { BrowserRouter as Router, Routes, Route, Link, useLocation } from 'react-router-dom'
import { Home, PieChart, History, Settings } from 'lucide-react' // 改用 Settings 圖示代表經理人

// 匯入所有頁面元件
import Dashboard from './pages/Dashboard'
import Portfolio from './pages/Portfolio'
import HistoryLog from './pages/HistoryLog'
import RecentActivity from './pages/RecentActivity'
import Manager from './pages/Manager' // 新增匯入經理人專區

// 底部導覽列元件
const BottomNav = () => {
  const location = useLocation();
  const navItems = [
    { path: '/', icon: <Home size={24} />, label: '總覽' },
    { path: '/portfolio', icon: <PieChart size={24} />, label: '庫存' },
    { path: '/history', icon: <History size={24} />, label: '歷史' },
    { path: '/manager', icon: <Settings size={24} />, label: '經理人' }, // 新增的經理人入口
  ];

  return (
    <div className="fixed bottom-0 w-full bg-white border-t border-gray-200 flex justify-around pb-6 pt-3 shadow-[0_-2px_10px_rgba(0,0,0,0.05)]">
      {navItems.map((item) => (
        <Link key={item.path} to={item.path} className={`flex flex-col items-center ${location.pathname === item.path ? 'text-blue-600' : 'text-gray-400'}`}>
          {item.icon}
          <span className="text-[10px] mt-1 font-medium">{item.label}</span>
        </Link>
      ))}
    </div>
  );
};

// App 主結構
function App() {
  return (
    <Router>
      <div className="h-screen flex flex-col bg-gray-100">
        {/* 頂部標題列 */}
        <header className="bg-blue-700 text-white p-4 shadow-md text-center font-bold text-lg tracking-wider">
          📈 阿公的台股儀表板
        </header>

        {/* 主要內容區塊 */}
        <main className="flex-1 overflow-y-auto pb-20">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/portfolio" element={<Portfolio />} />
            <Route path="/recent" element={<RecentActivity />} />
            <Route path="/history" element={<HistoryLog />} />
            <Route path="/manager" element={<Manager />} /> {/* 註冊新的路徑 */}
          </Routes>
        </main>

        <BottomNav />
      </div>
    </Router>
  )
}

export default App