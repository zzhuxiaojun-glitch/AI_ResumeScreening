import React, { useState, useEffect } from 'react';
import { supabase, Position } from '../lib/supabase';
import { Upload, FileText, Loader, CheckCircle, XCircle } from 'lucide-react';

interface UploadStatus {
  fileName: string;
  status: 'pending' | 'uploading' | 'parsing' | 'success' | 'error';
  error?: string;
}

export function UploadPage() {
  const [positions, setPositions] = useState<Position[]>([]);
  const [selectedPosition, setSelectedPosition] = useState<string>('');
  const [files, setFiles] = useState<File[]>([]);
  const [uploadStatuses, setUploadStatuses] = useState<UploadStatus[]>([]);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    loadPositions();
  }, []);

  const loadPositions = async () => {
    try {
      const { data, error } = await supabase
        .from('positions')
        .select('*')
        .eq('status', 'active')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setPositions(data || []);
      if (data && data.length > 0) {
        setSelectedPosition(data[0].id);
      }
    } catch (error) {
      console.error('Error loading positions:', error);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newFiles = Array.from(e.target.files);
      setFiles((prev) => [...prev, ...newFiles]);
    }
  };

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleUpload = async () => {
    if (!selectedPosition || files.length === 0) return;

    setUploading(true);
    const statuses: UploadStatus[] = files.map((file) => ({
      fileName: file.name,
      status: 'pending',
    }));
    setUploadStatuses(statuses);

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      setUploadStatuses((prev) =>
        prev.map((s, idx) => (idx === i ? { ...s, status: 'uploading' } : s))
      );

      try {
        const fileExt = file.name.split('.').pop();
        const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
        const filePath = `resumes/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('resumes')
          .upload(filePath, file);

        if (uploadError) throw uploadError;

        const { data: resumeData, error: resumeError } = await supabase
          .from('resumes')
          .insert({
            position_id: selectedPosition,
            file_name: file.name,
            file_path: filePath,
            file_size: file.size,
            file_type: fileExt || 'unknown',
            upload_source: 'manual',
            status: 'pending',
          })
          .select()
          .single();

        if (resumeError) throw resumeError;

        setUploadStatuses((prev) =>
          prev.map((s, idx) => (idx === i ? { ...s, status: 'parsing' } : s))
        );

        const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/parse-resume`;
        const response = await fetch(apiUrl, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ resume_id: resumeData.id }),
        });

        if (!response.ok) {
          throw new Error('Parse failed');
        }

        setUploadStatuses((prev) =>
          prev.map((s, idx) => (idx === i ? { ...s, status: 'success' } : s))
        );
      } catch (error: any) {
        console.error('Upload error:', error);
        setUploadStatuses((prev) =>
          prev.map((s, idx) =>
            idx === i ? { ...s, status: 'error', error: error.message } : s
          )
        );
      }
    }

    setUploading(false);
  };

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-800 mb-6">Upload Resumes</h1>

      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Select Position *
            </label>
            <select
              value={selectedPosition}
              onChange={(e) => setSelectedPosition(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              disabled={uploading}
            >
              <option value="">Choose a position...</option>
              {positions.map((pos) => (
                <option key={pos.id} value={pos.id}>
                  {pos.title}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Upload Resume Files (PDF, DOC, DOCX)
            </label>
            <div className="border-2 border-dashed border-slate-300 rounded-lg p-8 text-center hover:border-blue-400 transition-colors">
              <input
                type="file"
                multiple
                accept=".pdf,.doc,.docx"
                onChange={handleFileSelect}
                className="hidden"
                id="file-upload"
                disabled={uploading}
              />
              <label
                htmlFor="file-upload"
                className="cursor-pointer flex flex-col items-center"
              >
                <Upload className="w-12 h-12 text-slate-400 mb-3" />
                <span className="text-sm text-slate-600">
                  Click to upload or drag and drop
                </span>
                <span className="text-xs text-slate-500 mt-1">
                  PDF, DOC, DOCX (Max 10MB each)
                </span>
              </label>
            </div>
          </div>

          {files.length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-slate-700 mb-2">
                Selected Files ({files.length})
              </h3>
              <div className="space-y-2">
                {files.map((file, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between p-3 bg-slate-50 rounded-lg"
                  >
                    <div className="flex items-center">
                      <FileText className="w-5 h-5 text-slate-400 mr-3" />
                      <div>
                        <p className="text-sm font-medium text-slate-700">
                          {file.name}
                        </p>
                        <p className="text-xs text-slate-500">
                          {(file.size / 1024).toFixed(2)} KB
                        </p>
                      </div>
                    </div>
                    {!uploading && (
                      <button
                        onClick={() => removeFile(index)}
                        className="text-red-600 hover:text-red-700"
                      >
                        <XCircle className="w-5 h-5" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {uploadStatuses.length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-slate-700 mb-2">Upload Progress</h3>
              <div className="space-y-2">
                {uploadStatuses.map((status, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between p-3 bg-slate-50 rounded-lg"
                  >
                    <div className="flex items-center flex-1">
                      {status.status === 'success' && (
                        <CheckCircle className="w-5 h-5 text-green-600 mr-3" />
                      )}
                      {status.status === 'error' && (
                        <XCircle className="w-5 h-5 text-red-600 mr-3" />
                      )}
                      {(status.status === 'uploading' || status.status === 'parsing') && (
                        <Loader className="w-5 h-5 text-blue-600 mr-3 animate-spin" />
                      )}
                      {status.status === 'pending' && (
                        <div className="w-5 h-5 mr-3" />
                      )}
                      <div className="flex-1">
                        <p className="text-sm font-medium text-slate-700">
                          {status.fileName}
                        </p>
                        <p className="text-xs text-slate-500">
                          {status.status === 'pending' && 'Waiting...'}
                          {status.status === 'uploading' && 'Uploading...'}
                          {status.status === 'parsing' && 'Parsing and scoring...'}
                          {status.status === 'success' && 'Complete'}
                          {status.status === 'error' && `Error: ${status.error}`}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex justify-end">
            <button
              onClick={handleUpload}
              disabled={!selectedPosition || files.length === 0 || uploading}
              className="flex items-center px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {uploading ? (
                <>
                  <Loader className="w-4 h-4 mr-2 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4 mr-2" />
                  Upload & Parse
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
