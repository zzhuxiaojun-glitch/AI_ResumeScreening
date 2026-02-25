import React, { useState, useEffect } from 'react';
import { supabase, Position } from '../lib/supabase';
import { Plus, Edit2, Trash2, Save, X } from 'lucide-react';

export function PositionsPage() {
  const [positions, setPositions] = useState<Position[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    must_skills: '',
    nice_skills: '',
    reject_keywords: '',
    thresholdA: '80',
    thresholdB: '60',
    thresholdC: '40',
  });

  useEffect(() => {
    loadPositions();
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
    } finally {
      setLoading(false);
    }
  };

  const parseSkills = (text: string): Array<{ skill: string; weight: number }> => {
    return text
      .split('\n')
      .map(line => line.trim())
      .filter(line => line)
      .map(line => {
        const match = line.match(/^(.+?)\s*[:：]\s*(\d+(?:\.\d+)?)$/);
        if (match) {
          return { skill: match[1].trim(), weight: parseFloat(match[2]) };
        }
        return { skill: line, weight: 1 };
      });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const mustSkills = parseSkills(formData.must_skills);
    const niceSkills = parseSkills(formData.nice_skills);
    const rejectKeywords = formData.reject_keywords
      .split('\n')
      .map(k => k.trim())
      .filter(k => k);

    const positionData = {
      title: formData.title,
      description: formData.description,
      must_skills: mustSkills,
      nice_skills: niceSkills,
      reject_keywords: rejectKeywords,
      grade_thresholds: {
        A: parseInt(formData.thresholdA),
        B: parseInt(formData.thresholdB),
        C: parseInt(formData.thresholdC),
        D: 0,
      },
      updated_at: new Date().toISOString(),
    };

    try {
      if (editingId) {
        const { error } = await supabase
          .from('positions')
          .update(positionData)
          .eq('id', editingId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('positions').insert(positionData);
        if (error) throw error;
      }

      setShowForm(false);
      setEditingId(null);
      resetForm();
      loadPositions();
    } catch (error) {
      console.error('Error saving position:', error);
      alert('Failed to save position');
    }
  };

  const handleEdit = (position: Position) => {
    setEditingId(position.id);
    setFormData({
      title: position.title,
      description: position.description,
      must_skills: position.must_skills
        .map(s => `${s.skill}: ${s.weight}`)
        .join('\n'),
      nice_skills: position.nice_skills
        .map(s => `${s.skill}: ${s.weight}`)
        .join('\n'),
      reject_keywords: position.reject_keywords.join('\n'),
      thresholdA: String(position.grade_thresholds.A),
      thresholdB: String(position.grade_thresholds.B),
      thresholdC: String(position.grade_thresholds.C),
    });
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this position?')) return;

    try {
      const { error } = await supabase.from('positions').delete().eq('id', id);
      if (error) throw error;
      loadPositions();
    } catch (error) {
      console.error('Error deleting position:', error);
      alert('Failed to delete position');
    }
  };

  const resetForm = () => {
    setFormData({
      title: '',
      description: '',
      must_skills: '',
      nice_skills: '',
      reject_keywords: '',
      thresholdA: '80',
      thresholdB: '60',
      thresholdC: '40',
    });
  };

  if (loading) {
    return <div className="text-center py-12">Loading...</div>;
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-slate-800">Position Management</h1>
        <button
          onClick={() => {
            resetForm();
            setEditingId(null);
            setShowForm(true);
          }}
          className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-4 h-4 mr-2" />
          New Position
        </button>
      </div>

      {showForm && (
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold">
              {editingId ? 'Edit Position' : 'Create Position'}
            </h2>
            <button
              onClick={() => {
                setShowForm(false);
                setEditingId(null);
                resetForm();
              }}
              className="text-slate-400 hover:text-slate-600"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Position Title *
              </label>
              <input
                type="text"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Job Description
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                rows={3}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Must-Have Skills (one per line, format: "Skill: Weight")
                </label>
                <textarea
                  value={formData.must_skills}
                  onChange={(e) => setFormData({ ...formData, must_skills: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm"
                  rows={6}
                  placeholder="React: 3&#10;TypeScript: 2&#10;Node.js: 2"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Nice-to-Have Skills (one per line, format: "Skill: Weight")
                </label>
                <textarea
                  value={formData.nice_skills}
                  onChange={(e) => setFormData({ ...formData, nice_skills: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm"
                  rows={6}
                  placeholder="Docker: 1&#10;AWS: 1"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Reject Keywords (one per line)
              </label>
              <textarea
                value={formData.reject_keywords}
                onChange={(e) => setFormData({ ...formData, reject_keywords: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm"
                rows={3}
                placeholder="在校生&#10;实习"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Grade Thresholds (0-100)
              </label>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs text-slate-600 mb-1">Grade A (≥)</label>
                  <input
                    type="number"
                    value={formData.thresholdA}
                    onChange={(e) => setFormData({ ...formData, thresholdA: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                    min="0"
                    max="100"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-600 mb-1">Grade B (≥)</label>
                  <input
                    type="number"
                    value={formData.thresholdB}
                    onChange={(e) => setFormData({ ...formData, thresholdB: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                    min="0"
                    max="100"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-600 mb-1">Grade C (≥)</label>
                  <input
                    type="number"
                    value={formData.thresholdC}
                    onChange={(e) => setFormData({ ...formData, thresholdC: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                    min="0"
                    max="100"
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end space-x-3 pt-4">
              <button
                type="button"
                onClick={() => {
                  setShowForm(false);
                  setEditingId(null);
                  resetForm();
                }}
                className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <Save className="w-4 h-4 mr-2" />
                {editingId ? 'Update' : 'Create'}
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4">
        {positions.map((position) => (
          <div key={position.id} className="bg-white rounded-lg shadow-md p-6">
            <div className="flex justify-between items-start">
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-slate-800 mb-2">
                  {position.title}
                </h3>
                {position.description && (
                  <p className="text-sm text-slate-600 mb-3">{position.description}</p>
                )}

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
                  <div>
                    <h4 className="text-xs font-medium text-slate-500 mb-2">Must-Have ({position.must_skills.length})</h4>
                    <div className="flex flex-wrap gap-1">
                      {position.must_skills.slice(0, 5).map((skill, idx) => (
                        <span key={idx} className="inline-flex items-center px-2 py-1 bg-red-50 text-red-700 text-xs rounded">
                          {skill.skill} <span className="ml-1 text-red-500">×{skill.weight}</span>
                        </span>
                      ))}
                      {position.must_skills.length > 5 && (
                        <span className="text-xs text-slate-400">+{position.must_skills.length - 5} more</span>
                      )}
                    </div>
                  </div>

                  <div>
                    <h4 className="text-xs font-medium text-slate-500 mb-2">Nice-to-Have ({position.nice_skills.length})</h4>
                    <div className="flex flex-wrap gap-1">
                      {position.nice_skills.slice(0, 5).map((skill, idx) => (
                        <span key={idx} className="inline-flex items-center px-2 py-1 bg-green-50 text-green-700 text-xs rounded">
                          {skill.skill} <span className="ml-1 text-green-500">×{skill.weight}</span>
                        </span>
                      ))}
                      {position.nice_skills.length > 5 && (
                        <span className="text-xs text-slate-400">+{position.nice_skills.length - 5} more</span>
                      )}
                    </div>
                  </div>

                  <div>
                    <h4 className="text-xs font-medium text-slate-500 mb-2">Grading</h4>
                    <div className="text-xs text-slate-600">
                      A: ≥{position.grade_thresholds.A} | B: ≥{position.grade_thresholds.B} | C: ≥{position.grade_thresholds.C}
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex space-x-2 ml-4">
                <button
                  onClick={() => handleEdit(position)}
                  className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                >
                  <Edit2 className="w-4 h-4" />
                </button>
                <button
                  onClick={() => handleDelete(position.id)}
                  className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        ))}

        {positions.length === 0 && (
          <div className="text-center py-12 text-slate-500">
            No positions yet. Create your first position to get started.
          </div>
        )}
      </div>
    </div>
  );
}
