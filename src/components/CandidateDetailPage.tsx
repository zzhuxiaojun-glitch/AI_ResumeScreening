import React, { useState, useEffect } from 'react';
import { supabase, Candidate, Score, Position, Resume } from '../lib/supabase';
import { ArrowLeft, Download, Save, AlertCircle, CheckCircle, TrendingUp, TrendingDown } from 'lucide-react';

interface CandidateDetailProps {
  candidateId: string;
  onBack: () => void;
}

export function CandidateDetailPage({ candidateId, onBack }: CandidateDetailProps) {
  const [candidate, setCandidate] = useState<Candidate | null>(null);
  const [score, setScore] = useState<Score | null>(null);
  const [position, setPosition] = useState<Position | null>(null);
  const [resume, setResume] = useState<Resume | null>(null);
  const [loading, setLoading] = useState(true);
  const [notes, setNotes] = useState('');
  const [status, setStatus] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadCandidateDetail();
  }, [candidateId]);

  const loadCandidateDetail = async () => {
    try {
      const { data: candidateData, error: candidateError } = await supabase
        .from('candidates')
        .select('*')
        .eq('id', candidateId)
        .maybeSingle();

      if (candidateError) throw candidateError;
      if (!candidateData) {
        alert('Candidate not found');
        onBack();
        return;
      }

      setCandidate(candidateData);
      setNotes(candidateData.notes);
      setStatus(candidateData.current_status);

      const { data: scoreData, error: scoreError } = await supabase
        .from('scores')
        .select('*')
        .eq('candidate_id', candidateId)
        .maybeSingle();

      if (scoreError) throw scoreError;
      setScore(scoreData);

      const { data: positionData, error: positionError } = await supabase
        .from('positions')
        .select('*')
        .eq('id', candidateData.position_id)
        .maybeSingle();

      if (positionError) throw positionError;
      setPosition(positionData);

      const { data: resumeData, error: resumeError } = await supabase
        .from('resumes')
        .select('*')
        .eq('id', candidateData.resume_id)
        .maybeSingle();

      if (resumeError) throw resumeError;
      setResume(resumeData);
    } catch (error) {
      console.error('Error loading candidate:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!candidate) return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from('candidates')
        .update({
          notes,
          current_status: status,
          updated_at: new Date().toISOString(),
        })
        .eq('id', candidateId);

      if (error) throw error;
      alert('Saved successfully');
    } catch (error) {
      console.error('Error saving:', error);
      alert('Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const handleDownloadResume = async () => {
    if (!resume) return;

    try {
      const { data, error } = await supabase.storage
        .from('resumes')
        .download(resume.file_path);

      if (error) throw error;

      const url = URL.createObjectURL(data);
      const link = document.createElement('a');
      link.href = url;
      link.download = resume.file_name;
      link.click();
    } catch (error) {
      console.error('Error downloading resume:', error);
      alert('Failed to download resume');
    }
  };

  if (loading) {
    return <div className="text-center py-12">Loading...</div>;
  }

  if (!candidate) {
    return <div className="text-center py-12">Candidate not found</div>;
  }

  const getGradeColor = (grade: string) => {
    switch (grade) {
      case 'A':
        return 'bg-green-100 text-green-800 border-green-300';
      case 'B':
        return 'bg-blue-100 text-blue-800 border-blue-300';
      case 'C':
        return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      case 'D':
        return 'bg-red-100 text-red-800 border-red-300';
      default:
        return 'bg-slate-100 text-slate-800 border-slate-300';
    }
  };

  return (
    <div>
      <div className="flex items-center mb-6">
        <button
          onClick={onBack}
          className="flex items-center text-slate-600 hover:text-slate-800 mr-4"
        >
          <ArrowLeft className="w-5 h-5 mr-2" />
          Back
        </button>
        <h1 className="text-2xl font-bold text-slate-800">Candidate Detail</h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h2 className="text-2xl font-bold text-slate-800 mb-2">
                  {candidate.name || 'Unknown'}
                </h2>
                <p className="text-slate-600">{position?.title}</p>
              </div>
              <div
                className={`px-4 py-2 rounded-lg border-2 font-bold text-2xl ${getGradeColor(
                  score?.grade || 'N/A'
                )}`}
              >
                {score?.grade || 'N/A'}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-slate-500">Email:</span>
                <p className="font-medium text-slate-800">{candidate.email || 'N/A'}</p>
              </div>
              <div>
                <span className="text-slate-500">Phone:</span>
                <p className="font-medium text-slate-800">{candidate.phone || 'N/A'}</p>
              </div>
              <div>
                <span className="text-slate-500">Education:</span>
                <p className="font-medium text-slate-800">{candidate.education || 'N/A'}</p>
              </div>
              <div>
                <span className="text-slate-500">School:</span>
                <p className="font-medium text-slate-800">{candidate.school || 'N/A'}</p>
              </div>
              <div>
                <span className="text-slate-500">Major:</span>
                <p className="font-medium text-slate-800">{candidate.major || 'N/A'}</p>
              </div>
              <div>
                <span className="text-slate-500">Work Experience:</span>
                <p className="font-medium text-slate-800">
                  {candidate.work_years ? `${candidate.work_years} years` : 'N/A'}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-md p-6">
            <h3 className="text-lg font-semibold text-slate-800 mb-4">Scoring Details</h3>

            {score ? (
              <>
                <div className="grid grid-cols-4 gap-4 mb-6">
                  <div className="text-center p-4 bg-blue-50 rounded-lg">
                    <div className="text-3xl font-bold text-blue-600">
                      {score.total_score.toFixed(1)}
                    </div>
                    <div className="text-xs text-slate-600 mt-1">Total Score</div>
                  </div>
                  <div className="text-center p-4 bg-red-50 rounded-lg">
                    <div className="text-2xl font-bold text-red-600">
                      {score.must_score.toFixed(1)}
                    </div>
                    <div className="text-xs text-slate-600 mt-1">Must-Have</div>
                  </div>
                  <div className="text-center p-4 bg-green-50 rounded-lg">
                    <div className="text-2xl font-bold text-green-600">
                      {score.nice_score.toFixed(1)}
                    </div>
                    <div className="text-xs text-slate-600 mt-1">Nice-to-Have</div>
                  </div>
                  <div className="text-center p-4 bg-orange-50 rounded-lg">
                    <div className="text-2xl font-bold text-orange-600">
                      -{score.reject_penalty.toFixed(1)}
                    </div>
                    <div className="text-xs text-slate-600 mt-1">Penalty</div>
                  </div>
                </div>

                <div className="space-y-4">
                  {score.matched_must.length > 0 && (
                    <div>
                      <div className="flex items-center text-sm font-medium text-green-700 mb-2">
                        <CheckCircle className="w-4 h-4 mr-2" />
                        Matched Must-Have Skills ({score.matched_must.length})
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {score.matched_must.map((skill, idx) => (
                          <span
                            key={idx}
                            className="px-3 py-1 bg-green-50 text-green-700 text-sm rounded-full border border-green-200"
                          >
                            {skill}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {score.missing_must.length > 0 && (
                    <div>
                      <div className="flex items-center text-sm font-medium text-red-700 mb-2">
                        <AlertCircle className="w-4 h-4 mr-2" />
                        Missing Must-Have Skills ({score.missing_must.length})
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {score.missing_must.map((skill, idx) => (
                          <span
                            key={idx}
                            className="px-3 py-1 bg-red-50 text-red-700 text-sm rounded-full border border-red-200"
                          >
                            {skill}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {score.matched_nice.length > 0 && (
                    <div>
                      <div className="flex items-center text-sm font-medium text-blue-700 mb-2">
                        <TrendingUp className="w-4 h-4 mr-2" />
                        Matched Nice-to-Have Skills ({score.matched_nice.length})
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {score.matched_nice.map((skill, idx) => (
                          <span
                            key={idx}
                            className="px-3 py-1 bg-blue-50 text-blue-700 text-sm rounded-full border border-blue-200"
                          >
                            {skill}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {score.matched_reject.length > 0 && (
                    <div>
                      <div className="flex items-center text-sm font-medium text-orange-700 mb-2">
                        <TrendingDown className="w-4 h-4 mr-2" />
                        Reject Keywords Found ({score.matched_reject.length})
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {score.matched_reject.map((keyword, idx) => (
                          <span
                            key={idx}
                            className="px-3 py-1 bg-orange-50 text-orange-700 text-sm rounded-full border border-orange-200"
                          >
                            {keyword}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {score.explanation && (
                  <div className="mt-6 p-4 bg-slate-50 rounded-lg">
                    <h4 className="text-sm font-medium text-slate-700 mb-2">Explanation</h4>
                    <p className="text-sm text-slate-600 whitespace-pre-line">
                      {score.explanation}
                    </p>
                  </div>
                )}
              </>
            ) : (
              <p className="text-slate-500">No scoring data available</p>
            )}
          </div>

          {candidate.skills.length > 0 && (
            <div className="bg-white rounded-lg shadow-md p-6">
              <h3 className="text-lg font-semibold text-slate-800 mb-4">All Skills</h3>
              <div className="flex flex-wrap gap-2">
                {candidate.skills.map((skill, idx) => (
                  <span
                    key={idx}
                    className="px-3 py-1 bg-slate-100 text-slate-700 text-sm rounded"
                  >
                    {skill}
                  </span>
                ))}
              </div>
            </div>
          )}

          {candidate.highlights.length > 0 && (
            <div className="bg-white rounded-lg shadow-md p-6">
              <h3 className="text-lg font-semibold text-slate-800 mb-4">Highlights</h3>
              <ul className="space-y-2">
                {candidate.highlights.map((highlight, idx) => (
                  <li key={idx} className="flex items-start text-sm text-slate-700">
                    <CheckCircle className="w-4 h-4 text-green-600 mr-2 mt-0.5 flex-shrink-0" />
                    <span>{highlight}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {candidate.risks.length > 0 && (
            <div className="bg-white rounded-lg shadow-md p-6">
              <h3 className="text-lg font-semibold text-slate-800 mb-4">Risk Points</h3>
              <ul className="space-y-2">
                {candidate.risks.map((risk, idx) => (
                  <li key={idx} className="flex items-start text-sm text-slate-700">
                    <AlertCircle className="w-4 h-4 text-orange-600 mr-2 mt-0.5 flex-shrink-0" />
                    <span>{risk}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <div className="space-y-6">
          <div className="bg-white rounded-lg shadow-md p-6">
            <h3 className="text-lg font-semibold text-slate-800 mb-4">Actions</h3>

            {resume && (
              <button
                onClick={handleDownloadResume}
                className="w-full flex items-center justify-center px-4 py-2 bg-slate-600 text-white rounded-lg hover:bg-slate-700 transition-colors mb-3"
              >
                <Download className="w-4 h-4 mr-2" />
                Download Resume
              </button>
            )}

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Status
                </label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="new">New</option>
                  <option value="reviewed">Reviewed</option>
                  <option value="interview">Interview</option>
                  <option value="rejected">Rejected</option>
                  <option value="hired">Hired</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Notes
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  rows={6}
                  placeholder="Add your notes here..."
                />
              </div>

              <button
                onClick={handleSave}
                disabled={saving}
                className="w-full flex items-center justify-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                <Save className="w-4 h-4 mr-2" />
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-md p-6">
            <h3 className="text-lg font-semibold text-slate-800 mb-4">Information</h3>
            <div className="space-y-3 text-sm">
              <div>
                <span className="text-slate-500">Submitted:</span>
                <p className="font-medium text-slate-800">
                  {new Date(candidate.created_at).toLocaleString()}
                </p>
              </div>
              {resume && (
                <>
                  <div>
                    <span className="text-slate-500">File:</span>
                    <p className="font-medium text-slate-800">{resume.file_name}</p>
                  </div>
                  <div>
                    <span className="text-slate-500">File Size:</span>
                    <p className="font-medium text-slate-800">
                      {(resume.file_size / 1024).toFixed(2)} KB
                    </p>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
