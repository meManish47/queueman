import { useEffect, useState } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

export default function Dashboard() {
  const [jobs, setJobs] = useState<any[]>([]);
  const [stats, setStats] = useState<any>({});

  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [jobsRes, statsRes] = await Promise.all([
          axios.get(`${API_URL}/jobs?limit=20`),
          axios.get(`${API_URL}/stats`)
        ]);
        setJobs(jobsRes.data);
        setStats(statsRes.data);
        setLastUpdated(new Date());
      } catch (err) {
        console.error('Error fetching dashboard data', err);
      }
    };
    fetchData();
    const interval = setInterval(fetchData, 2000);
    return () => clearInterval(interval);
  }, []);

  const renderStatus = (status: string) => {
    switch(status) {
      case 'failed':
      case 'dead':
        return <span className="text-[#FF3333]">● {status}</span>;
      case 'retry_waiting':
        return <span className="text-[#FFB000]">● {status}</span>;
      default:
        return <span className="text-[#888]">○ {status}</span>;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-end border-b border-[#222] pb-2">
        <h2 className="font-sans text-lg font-bold uppercase tracking-widest text-white">System Status</h2>
        <div className="text-xs text-[#666] flex items-center space-x-2">
          <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
          <span>LIVE • LAST POLL: {lastUpdated.toLocaleTimeString()}</span>
        </div>
      </div>

      <div className="flex flex-wrap gap-x-8 gap-y-2 text-sm">
        {['pending', 'assigned', 'running', 'retry_waiting', 'completed', 'failed', 'dead'].map((status) => (
          <div key={status} className="flex space-x-2 items-center">
            <span className="uppercase text-[#666] tracking-wider text-xs">{status}</span>
            <span className={`font-bold ${['failed', 'dead'].includes(status) ? 'text-[#FF3333]' : status === 'retry_waiting' ? 'text-[#FFB000]' : 'text-white'}`}>
              {stats[status] || 0}
            </span>
          </div>
        ))}
      </div>

      <div className="mt-8 border border-[#222] overflow-hidden">
        <table className="min-w-full divide-y divide-[#222] text-sm">
          <thead className="bg-[#111]">
            <tr>
              <th className="px-4 py-2 text-left font-sans text-xs font-semibold text-[#888] uppercase tracking-wider">Job ID</th>
              <th className="px-4 py-2 text-left font-sans text-xs font-semibold text-[#888] uppercase tracking-wider">Status</th>
              <th className="px-4 py-2 text-left font-sans text-xs font-semibold text-[#888] uppercase tracking-wider">Priority</th>
              <th className="px-4 py-2 text-left font-sans text-xs font-semibold text-[#888] uppercase tracking-wider">Attempts</th>
              <th className="px-4 py-2 text-left font-sans text-xs font-semibold text-[#888] uppercase tracking-wider">Created At</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#222] bg-[#0A0A0A]">
            {jobs.map(job => (
              <tr key={job.id} className="hover:bg-[#111] transition-colors">
                <td className="px-4 py-2 whitespace-nowrap text-[#ccc]">
                  <Link to={`/jobs/${job.id}`} className="hover:text-white underline decoration-[#444] underline-offset-4">
                    {job.id.substring(0, 8)}
                  </Link>
                </td>
                <td className="px-4 py-2 whitespace-nowrap">
                  {renderStatus(job.status)}
                </td>
                <td className="px-4 py-2 whitespace-nowrap text-[#888]">{job.priority}</td>
                <td className="px-4 py-2 whitespace-nowrap text-[#888]">
                  {job.attempt_count} / {job.max_attempts}
                </td>
                <td className="px-4 py-2 whitespace-nowrap text-[#666]">
                  {new Date(job.created_at).toISOString().replace('T', ' ').substring(0, 19)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {jobs.length === 0 && (
          <div className="p-4 text-left text-[#666]">No jobs found.</div>
        )}
      </div>
    </div>
  );
}
