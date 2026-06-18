import { useEffect, useState } from 'react';
import axios from 'axios';
import { formatDistanceToNow } from 'date-fns';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

export default function WorkersList() {
  const [workers, setWorkers] = useState<any[]>([]);

  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

  useEffect(() => {
    const fetchWorkers = async () => {
      try {
        const res = await axios.get(`${API_URL}/workers`);
        setWorkers(res.data);
        setLastUpdated(new Date());
      } catch (err) {
        console.error(err);
      }
    };
    fetchWorkers();
    const interval = setInterval(fetchWorkers, 2000);
    return () => clearInterval(interval);
  }, []);

  const renderWorkerStatus = (status: string) => {
    switch (status) {
      case 'idle':
        return <span className="text-[#888]">○ {status}</span>;
      case 'busy':
        return <span className="text-white">● {status}</span>;
      default:
        return <span className="text-[#FF3333]">● {status}</span>;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-end border-b border-[#222] pb-2">
        <h2 className="font-sans text-lg font-bold uppercase tracking-widest text-white">Connected Workers</h2>
        <div className="text-xs text-[#666] flex items-center space-x-2">
          <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
          <span>LIVE • LAST POLL: {lastUpdated.toLocaleTimeString()}</span>
        </div>
      </div>
      
      <div className="flex space-x-2 items-center text-sm">
        <span className="uppercase text-[#666] tracking-wider text-xs">Total Registered</span>
        <span className="font-bold text-white">{workers.length}</span>
      </div>
      
      <div className="mt-4 border border-[#222] overflow-hidden">
        <table className="min-w-full divide-y divide-[#222] text-sm">
          <thead className="bg-[#111]">
            <tr>
              <th className="px-4 py-2 text-left font-sans text-xs font-semibold text-[#888] uppercase tracking-wider">Worker ID</th>
              <th className="px-4 py-2 text-left font-sans text-xs font-semibold text-[#888] uppercase tracking-wider">Status</th>
              <th className="px-4 py-2 text-left font-sans text-xs font-semibold text-[#888] uppercase tracking-wider">Current Job ID</th>
              <th className="px-4 py-2 text-left font-sans text-xs font-semibold text-[#888] uppercase tracking-wider">Last Heartbeat</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#222] bg-[#0A0A0A]">
            {workers.map(worker => (
              <tr key={worker.id} className="hover:bg-[#111] transition-colors">
                <td className="px-4 py-2 whitespace-nowrap text-[#ccc]">
                  {worker.id}
                </td>
                <td className="px-4 py-2 whitespace-nowrap">
                  {renderWorkerStatus(worker.status)}
                </td>
                <td className="px-4 py-2 whitespace-nowrap text-[#888]">
                  {worker.current_job_id ? (
                    worker.current_job_id.substring(0, 8)
                  ) : "-"}
                </td>
                <td className="px-4 py-2 whitespace-nowrap">
                  {worker.last_heartbeat_at ? (
                    <span className={`${new Date().getTime() - new Date(worker.last_heartbeat_at).getTime() > 15000 ? 'text-[#FF3333]' : 'text-[#888]'}`}>
                      {formatDistanceToNow(new Date(worker.last_heartbeat_at), { addSuffix: true })}
                    </span>
                  ) : <span className="text-[#666]">-</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {workers.length === 0 && (
          <div className="p-4 text-left text-[#666]">No workers registered yet.</div>
        )}
      </div>
    </div>
  );
}
