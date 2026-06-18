import { useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

export default function JobSubmission() {
  const [payload, setPayload] = useState('{\n  "task": "process_data",\n  "userId": 123\n}');
  const [priority, setPriority] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await axios.post(`${API_URL}/jobs`, {
        payload: JSON.parse(payload),
        priority
      });
      navigate(`/jobs/${res.data.id}`);
    } catch (err) {
      alert('Error submitting job. Check JSON format.');
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto border border-[#222] p-8 bg-[#0A0A0A]">
      <div className="border-b border-[#222] pb-2 mb-6">
        <h2 className="text-lg font-sans font-bold uppercase tracking-widest text-white">
          Submit New Job
        </h2>
      </div>
      
      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label className="block text-xs uppercase tracking-wider text-[#666] mb-2">Payload (JSON)</label>
          <textarea
            className="w-full h-48 bg-[#111] border border-[#333] p-4 text-[#ccc] font-mono text-sm focus:border-white focus:outline-none transition-colors"
            value={payload}
            onChange={(e) => setPayload(e.target.value)}
          />
        </div>
        <div>
          <label className="block text-xs uppercase tracking-wider text-[#666] mb-2">Priority</label>
          <input
            type="number"
            className="w-full bg-[#111] border border-[#333] p-3 text-[#ccc] font-mono focus:border-white focus:outline-none transition-colors"
            value={priority}
            onChange={(e) => setPriority(parseInt(e.target.value))}
          />
          <p className="text-xs text-[#666] mt-2 uppercase tracking-wider">
             Higher numbers are processed first by the scheduler.
          </p>
        </div>
        <div className="pt-4 border-t border-[#222]">
          <button
            type="submit"
            disabled={submitting}
            className="w-full border border-[#444] text-white font-mono uppercase tracking-widest text-sm py-3 px-4 hover:bg-white hover:text-black disabled:opacity-50 transition-colors focus:outline-none"
          >
            {submitting ? 'Submitting...' : 'Submit Job'}
          </button>
        </div>
      </form>
    </div>
  );
}
