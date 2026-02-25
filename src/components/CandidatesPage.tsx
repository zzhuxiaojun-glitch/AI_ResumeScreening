import { useState, useEffect } from 'react';
import { supabase, Candidate, Score, Position } from '../lib/supabase';
import { Search, Download, Eye } from 'lucide-react';

interface CandidateWithScore extends Candidate {
  score?: Score;
  position?: Position;
}

export function CandidatesPage({ onViewDetail }: { onViewDetail: (id: string) => void }) {
  const [candidates, setCandidates] = useState<CandidateWithScore[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [gradeFilter, setGradeFilter] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [positionFilter, setPositionFilter] = useState<string>('');
  const [sortBy, setSortBy] = useState<'score' | 'date'>('score');
  const [positions, setPositions] = useState<Position[]>([]);

  useEffect(() => {
    loadPositions();
    loadCandidates();
  }, []);

  const loadPositions = async () => {
    try {
      const { data, error } = await supabase
        .from('positions')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setPositions(data || []);
    } catch (error) {
      console.error('Error loading positions:', error);
    }
  };

  const loadCandidates = async () => {
    try {
      const { data: candidatesData, error: candidatesError } = await supabase
        .from('candidates')
        .select('*')
        .order('created_at', { ascending: false });

      if (candidatesError) throw candidatesError;

      const candidateIds = candidatesData?.map((c) => c.id) || [];

      const { data: scoresData, error: scoresError } = await supabase
        .from('scores')
        .select('*')
        .in('candidate_id', candidateIds);

      if (scoresError) throw scoresError;

      const { data: positionsData, error: positionsError } = await supabase
        .from('positions')
        .select('*');

      if (positionsError) throw positionsError;

      const candidatesWithScores = candidatesData?.map((candidate) => ({
        ...candidate,
        score: scoresData?.find((s) => s.candidate_id === candidate.id),
        position: positionsData?.find((p) => p.id === candidate.position_id),
      })) || [];

      setCandidates(candidatesWithScores);
    } catch (error) {
      console.error('Error loading candidates:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleExportCSV = () => {
    const filtered = getFilteredCandidates();

    const headers = [
      'Name',
      'Email',
      'Phone',
      'Position',
      'Education',
      'School',
      'Major',
      'Work Years',
      'Score',
      'Grade',
      'Status',
      'Skills',
      'Created At',
    ];

    const rows = filtered.map((c) => [
      c.name,
      c.email,
      c.phone,
      c.position?.title || '',
      c.education,
      c.school,
      c.major,
      c.work_years,
      c.score?.total_score || 0,
      c.score?.grade || 'N/A',
      c.current_status,
      c.skills.join('; '),
      new Date(c.created_at).toLocaleDateString(),
    ]);

    const csv = [headers, ...rows].map((row) => row.join(',')).join('\n');
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `candidates_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  const getFilteredCandidates = () => {
    let filtered = [...candidates];

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(
        (c) =>
          c.name.toLowerCase().includes(term) ||
          c.email.toLowerCase().includes(term) ||
          c.phone.includes(term) ||
          c.skills.some((s) => s.toLowerCase().includes(term))
      );
    }

    if (gradeFilter) {
      filtered = filtered.filter((c) => c.score?.grade === gradeFilter);
    }

    if (statusFilter) {
      filtered = filtered.filter((c) => c.current_status === statusFilter);
    }

    if (positionFilter) {
      filtered = filtered.filter((c) => c.position_id === positionFilter);
    }

    filtered.sort((a, b) => {
      if (sortBy === 'score') {
        return (b.score?.total_score || 0) - (a.score?.total_score || 0);
      } else {
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      }
    });

    return filtered;
  };

  const filteredCandidates = getFilteredCandidates();

  const getGradeColor = (grade: string) => {
    switch (grade) {
      case 'A':
        return 'bg-green-100 text-green-800';
      case 'B':
        return 'bg-blue-100 text-blue-800';
      case 'C':
        return 'bg-yellow-100 text-yellow-800';
      case 'D':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-slate-100 text-slate-800';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'new':
        return 'bg-slate-100 text-slate-700';
      case 'reviewed':
        return 'bg-blue-100 text-blue-700';
      case 'interview':
        return 'bg-purple-100 text-purple-700';
      case 'rejected':
        return 'bg-red-100 text-red-700';
      case 'hired':
        return 'bg-green-100 text-green-700';
      default:
        return 'bg-slate-100 text-slate-700';
    }
  };

  if (loading) {
    return <div className="text-center py-12">Loading...</div>;
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-slate-800">Candidates</h1>
        <button
          onClick={handleExportCSV}
          className="flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
        >
          <Download className="w-4 h-4 mr-2" />
          Export CSV
        </button>
      </div>

      <div className="bg-white rounded-lg shadow-md p-4 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          <div className="lg:col-span-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search by name, email, phone, skills..."
                className="w-full pl-10 pr-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>

          <select
            value={positionFilter}
            onChange={(e) => setPositionFilter(e.target.value)}
            className="px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="">All Positions</option>
            {positions.map((pos) => (
              <option key={pos.id} value={pos.id}>
                {pos.title}
              </option>
            ))}
          </select>

          <select
            value={gradeFilter}
            onChange={(e) => setGradeFilter(e.target.value)}
            className="px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="">All Grades</option>
            <option value="A">Grade A</option>
            <option value="B">Grade B</option>
            <option value="C">Grade C</option>
            <option value="D">Grade D</option>
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="">All Status</option>
            <option value="new">New</option>
            <option value="reviewed">Reviewed</option>
            <option value="interview">Interview</option>
            <option value="rejected">Rejected</option>
            <option value="hired">Hired</option>
          </select>
        </div>

        <div className="flex items-center justify-between mt-4 pt-4 border-t border-slate-200">
          <div className="text-sm text-slate-600">
            Showing {filteredCandidates.length} of {candidates.length} candidates
          </div>
          <div className="flex items-center space-x-2">
            <span className="text-sm text-slate-600">Sort by:</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as 'score' | 'date')}
              className="text-sm px-3 py-1 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="score">Score (High to Low)</option>
              <option value="date">Date (Newest First)</option>
            </select>
          </div>
        </div>
      </div>

      <div className="space-y-3">
        {filteredCandidates.map((candidate) => (
          <div
            key={candidate.id}
            className="bg-white rounded-lg shadow-md p-5 hover:shadow-lg transition-shadow"
          >
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center space-x-3 mb-2">
                  <h3 className="text-lg font-semibold text-slate-800">
                    {candidate.name || 'Unknown'}
                  </h3>
                  <span
                    className={`px-3 py-1 rounded-full text-xs font-medium ${getGradeColor(
                      candidate.score?.grade || 'N/A'
                    )}`}
                  >
                    Grade {candidate.score?.grade || 'N/A'}
                  </span>
                  <span
                    className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(
                      candidate.current_status
                    )}`}
                  >
                    {candidate.current_status}
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-sm text-slate-600">
                  <div>
                    <span className="font-medium">Score:</span>{' '}
                    <span className="text-lg font-bold text-blue-600">
                      {candidate.score?.total_score?.toFixed(1) || 'N/A'}
                    </span>
                  </div>
                  <div>
                    <span className="font-medium">Position:</span>{' '}
                    {candidate.position?.title || 'N/A'}
                  </div>
                  <div>
                    <span className="font-medium">Education:</span> {candidate.education || 'N/A'}
                  </div>
                  <div>
                    <span className="font-medium">Experience:</span>{' '}
                    {candidate.work_years ? `${candidate.work_years} years` : 'N/A'}
                  </div>
                </div>

                <div className="mt-3">
                  <div className="text-xs text-slate-500 mb-1">Contact:</div>
                  <div className="text-sm text-slate-700">
                    {candidate.email && <span className="mr-4">{candidate.email}</span>}
                    {candidate.phone && <span>{candidate.phone}</span>}
                  </div>
                </div>

                {candidate.skills.length > 0 && (
                  <div className="mt-3">
                    <div className="text-xs text-slate-500 mb-1">Skills:</div>
                    <div className="flex flex-wrap gap-1">
                      {candidate.skills.slice(0, 8).map((skill, idx) => (
                        <span
                          key={idx}
                          className="px-2 py-1 bg-slate-100 text-slate-700 text-xs rounded"
                        >
                          {skill}
                        </span>
                      ))}
                      {candidate.skills.length > 8 && (
                        <span className="text-xs text-slate-400 py-1">
                          +{candidate.skills.length - 8} more
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </div>

              <button
                onClick={() => onViewDetail(candidate.id)}
                className="ml-4 flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <Eye className="w-4 h-4 mr-2" />
                View
              </button>
            </div>
          </div>
        ))}

        {filteredCandidates.length === 0 && (
          <div className="text-center py-12 text-slate-500">
            No candidates found. Upload resumes to get started.
          </div>
        )}
      </div>
    </div>
  );
}
