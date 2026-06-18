import { useEffect, useState } from 'react';
import axios from 'axios';
import { useParams, Link } from 'react-router-dom';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

export default function JobDetail() {
  const { id } = useParams();
  const [job, setJob] = useState<any>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchJob = async () => {
      try {
        const [jobRes, historyRes] = await Promise.all([
          axios.get(`${API_URL}/jobs/${id}`),
          axios.get(`${API_URL}/jobs/${id}/history`)
        ]);
        setJob(jobRes.data);
        setHistory(historyRes.data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchJob();
    const interval = setInterval(fetchJob, 2000);
    return () => clearInterval(interval);
  }, [id]);

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

  const renderHistoryStatus = (status: string) => {
    switch (status) {
      case 'failed':
        return <span className="text-[#FF3333]">● {status}</span>;
      case 'rejected_stale':
        return <span className="text-[#FFB000]">● {status}</span>;
      default:
        return <span className="text-white">○ {status}</span>;
    }
  };

  if (loading) return <div className="p-4 text-[#888]">Loading...</div>;
  if (!job) return <div className="p-4 text-[#FF3333]">Job not found</div>;

  return (
    <div className="space-y-8 text-sm">
      <div className="flex items-center space-x-4 mb-4">
        <Link to="/" className="text-[#888] hover:text-white underline decoration-[#444] underline-offset-4">← Back to Dashboard</Link>
      </div>

      <div className="border border-[#222]">
        <div className="bg-[#111] px-4 py-2 border-b border-[#222] flex justify-between items-center">
          <h3 className="font-sans text-xs font-semibold text-[#888] uppercase tracking-wider">Job Information</h3>
        </div>
        <div className="p-4 grid grid-cols-2 md:grid-cols-4 gap-6 bg-[#0A0A0A]">
          <div>
            <h4 className="text-[#666] text-xs uppercase tracking-wider mb-1">Job ID</h4>
            <div className="text-white">{job.id}</div>
          </div>
          <div>
            <h4 className="text-[#666] text-xs uppercase tracking-wider mb-1">Status</h4>
            <div className="uppercase text-xs">{renderStatus(job.status)}</div>
          </div>
          <div>
            <h4 className="text-[#666] text-xs uppercase tracking-wider mb-1">Priority</h4>
            <div className="text-white">{job.priority}</div>
          </div>
          <div>
            <h4 className="text-[#666] text-xs uppercase tracking-wider mb-1">Epoch</h4>
            <div className="text-white">{job.epoch}</div>
          </div>
          <div>
            <h4 className="text-[#666] text-xs uppercase tracking-wider mb-1">Attempts</h4>
            <div className="text-[#888]"><span className="text-white">{job.attempt_count}</span> / {job.max_attempts}</div>
          </div>
          <div className="col-span-3">
            <h4 className="text-[#666] text-xs uppercase tracking-wider mb-1">Assigned Worker</h4>
            <div className="text-white">{job.assigned_worker_id || <span className="text-[#666]">-</span>}</div>
          </div>
        </div>
      </div>

      <div>
        <h3 className="font-sans text-xs font-semibold text-[#888] uppercase tracking-wider mb-2">Payload</h3>
        <pre className="border border-[#222] bg-[#111] p-4 text-[#ccc] overflow-x-auto text-xs">
          {JSON.stringify(job.payload, null, 2)}
        </pre>
      </div>

      <div>
        <h3 className="font-sans text-xs font-semibold text-[#888] uppercase tracking-wider mb-2">Execution History</h3>
        <div className="border border-[#222] bg-[#0A0A0A]">
          {history.length === 0 ? (
            <div className="p-4 text-[#666]">No execution history yet.</div>
          ) : (
            <div className="divide-y divide-[#222]">
              {history.map(exec => (
                <div key={exec.id} className="p-4">
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex items-center space-x-4">
                      <span className="text-[#666] uppercase text-xs tracking-wider">Attempt {exec.attempt_number}</span>
                      <span className="uppercase text-xs">{renderHistoryStatus(exec.status)}</span>
                      {exec.status === 'rejected_stale' && (
                        <span className="text-[#FFB000] text-xs uppercase tracking-wider">
                          [ Epoch Mismatch ]
                        </span>
                      )}
                    </div>
                    <span className="text-[#666] text-xs">
                      {new Date(exec.started_at).toISOString().replace('T', ' ').substring(0, 19)}
                    </span>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4 mt-4 text-[#888]">
                    <div>
                      <span className="uppercase text-xs tracking-wider text-[#666] block mb-1">Worker ID</span>
                      <span className="text-[#ccc]">{exec.worker_id}</span>
                    </div>
                    <div>
                      <span className="uppercase text-xs tracking-wider text-[#666] block mb-1">Epoch</span>
                      <span className="text-[#ccc]">{exec.epoch}</span>
                    </div>
                    
                    {exec.error_message && (
                      <div className="col-span-2">
                        <span className="uppercase text-xs tracking-wider text-[#FF3333] block mb-1">Error</span>
                        <span className="text-[#FF3333]">{exec.error_message}</span>
                      </div>
                    )}
                    
                    {exec.result && (
                      <div className="col-span-2">
                        <span className="uppercase text-xs tracking-wider text-[#666] block mb-1">Result</span>
                        <pre className="border border-[#222] bg-[#111] p-3 text-[#ccc] overflow-x-auto text-xs mt-1">
                          {JSON.stringify(exec.result, null, 2)}
                        </pre>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
