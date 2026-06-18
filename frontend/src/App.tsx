import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import Dashboard from './pages/Dashboard';
import JobSubmission from './pages/JobSubmission';
import JobDetail from './pages/JobDetail';
import WorkersList from './pages/WorkersList';

export default function App() {
  return (
    <Router>
      <div className="min-h-screen bg-[#0A0A0A] text-[#E0E0E0] font-mono flex flex-col antialiased">
        <header className="px-6 py-4 flex justify-between items-center border-b border-[#222]">
          <h1 className="text-sm font-sans font-bold text-white tracking-widest uppercase">
            Queueman
          </h1>
          <nav className="space-x-8 text-xs tracking-wider">
            <Link to="/" className="text-[#888] hover:text-white transition-colors">Dashboard</Link>
            <Link to="/workers" className="text-[#888] hover:text-white transition-colors">Workers</Link>
            <Link to="/new-job" className="text-white border border-[#444] px-3 py-1 hover:border-white transition-colors">
              Submit Job
            </Link>
          </nav>
        </header>
        <main className="flex-1 p-6 w-full max-w-[1400px] mx-auto">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/jobs/:id" element={<JobDetail />} />
            <Route path="/workers" element={<WorkersList />} />
            <Route path="/new-job" element={<JobSubmission />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
}
