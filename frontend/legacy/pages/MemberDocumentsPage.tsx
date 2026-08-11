'use client';

import { useState, useEffect, useCallback } from 'react';
import { Upload, FileText, RefreshCw, Download, AlertCircle, CheckCircle, Clock, XCircle, Loader2 } from 'lucide-react';
import { fetchApi, ApiError } from '../services/apiClient';
import { useAuth } from '../contexts/AuthContext';
import { useDispatch } from 'react-redux';
import { baseApi } from '../services/baseApi';

interface MemberDocument {
  id: string;
  document_type: string;
  custom_document_name: string;
  display_name: string;
  original_file_name: string;
  mime_type: string;
  file_size: number;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  admin_comment: string;
  rejection_reason: string;
  uploaded_at: string;
  reviewed_at: string | null;
  can_delete: boolean;
  can_reupload: boolean;
}

const DOCUMENT_TYPES = [
  { value: 'AADHAAR', label: 'Aadhaar Card' },
  { value: 'PAN', label: 'PAN Card' },
  { value: 'PASSPORT', label: 'Passport' },
  { value: 'DRIVING_LICENCE', label: 'Driving Licence' },
  { value: 'VOTER_ID', label: 'Voter ID' },
  { value: 'BIRTH_CERTIFICATE', label: 'Birth Certificate' },
  { value: 'ADDRESS_PROOF', label: 'Address Proof' },
  { value: 'INCOME_CERTIFICATE', label: 'Income Certificate' },
  { value: 'DEGREE_CERTIFICATE', label: 'Degree Certificate' },
  { value: 'TENTH_MARKSHEET', label: '10th Marks Card' },
  { value: 'TWELFTH_MARKSHEET', label: '12th Marks Card' },
  { value: 'DIPLOMA_CERTIFICATE', label: 'Diploma Certificate' },
  { value: 'EMPLOYMENT_PROOF', label: 'Employment Proof' },
  { value: 'SALARY_SLIP', label: 'Salary Slip' },
  { value: 'DIVORCE_CERTIFICATE', label: 'Divorce Certificate' },
  { value: 'DEATH_CERTIFICATE', label: 'Death Certificate' },
  { value: 'OTHER', label: 'Other' },
];

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function MemberDocumentsPage() {
  const { user } = useAuth();
  const [documents, setDocuments] = useState<MemberDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [uploading, setUploading] = useState(false);
  const [showUpload, setShowUpload] = useState(false);
  const [selectedType, setSelectedType] = useState('AADHAAR');
  const [customName, setCustomName] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadError, setUploadError] = useState('');
  const [viewDoc, setViewDoc] = useState<{ id: string; type: string } | null>(null);

  const dispatch = useDispatch();

  const loadDocs = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetchApi<any>('/member-auth/me/documents/');
      setDocuments(res.data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load documents.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadDocs(); }, [loadDocs]);

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile) return;
    setUploading(true);
    setUploadError('');
    try {
      const formData = new FormData();
      formData.append('document_type', selectedType);
      if (selectedType === 'OTHER') formData.append('custom_document_name', customName);
      formData.append('file', selectedFile);
      await fetchApi('/member-auth/me/documents/', {
        method: 'POST',
        body: formData,
      });
      setShowUpload(false);
      setSelectedFile(null);
      setCustomName('');
      await loadDocs();
      dispatch(baseApi.util.invalidateTags(['VerificationStatus']));
    } catch (err) {
      setUploadError(err instanceof ApiError ? err.message : 'Upload failed.');
    } finally {
      setUploading(false);
    }
  };

  const handleReupload = async (docId: string) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.pdf,.jpg,.jpeg,.png';
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      try {
        const formData = new FormData();
        formData.append('file', file);
        await fetchApi(`/member-auth/me/documents/${docId}/reupload/`, {
          method: 'POST',
          body: formData,
        });
        await loadDocs();
        dispatch(baseApi.util.invalidateTags(['VerificationStatus']));
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Re-upload failed.');
      }
    };
    input.click();
  };

  const stats = {
    total: documents.length,
    pending: documents.filter((d) => d.status === 'PENDING').length,
    approved: documents.filter((d) => d.status === 'APPROVED').length,
    rejected: documents.filter((d) => d.status === 'REJECTED').length,
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">My Documents</h1>
          <p className="text-gray-600 mt-1">Upload and manage your verification documents</p>
        </div>
        <button
          onClick={() => setShowUpload(!showUpload)}
          className="inline-flex items-center gap-2 px-4 py-2 bg-rose-500 text-white rounded-lg font-medium hover:bg-rose-600 transition-colors"
        >
          <Upload className="w-4 h-4" />
          Upload Document
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4 mb-8">
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
          <p className="text-sm text-gray-600">Total</p>
        </div>
        <div className="bg-white rounded-xl border border-rose-200 p-4">
          <p className="text-2xl font-bold text-rose-600">{stats.pending}</p>
          <p className="text-sm text-rose-600">Pending</p>
        </div>
        <div className="bg-white rounded-xl border border-green-200 p-4">
          <p className="text-2xl font-bold text-green-600">{stats.approved}</p>
          <p className="text-sm text-green-600">Approved</p>
        </div>
        <div className="bg-white rounded-xl border border-red-200 p-4">
          <p className="text-2xl font-bold text-red-600">{stats.rejected}</p>
          <p className="text-sm text-red-600">Rejected</p>
        </div>
      </div>

      {/* Upload Form */}
      {showUpload && (
        <form onSubmit={handleUpload} className="bg-white rounded-xl border border-gray-200 p-6 mb-8">
          <h2 className="text-lg font-semibold mb-4">Upload a Document</h2>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Document Type</label>
              <select
                value={selectedType}
                onChange={(e) => setSelectedType(e.target.value)}
                className="w-full h-11 px-4 rounded-xl border border-gray-200 bg-white text-gray-900"
              >
                {DOCUMENT_TYPES.map((dt) => (
                  <option key={dt.value} value={dt.value}>{dt.label}</option>
                ))}
              </select>
            </div>
            {selectedType === 'OTHER' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Custom Document Name</label>
                <input
                  type="text"
                  value={customName}
                  onChange={(e) => setCustomName(e.target.value)}
                  placeholder="e.g. 10th Marks Card"
                  className="w-full h-11 px-4 rounded-xl border border-gray-200"
                />
              </div>
            )}
          </div>
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">File (PDF, JPG, JPEG, PNG - max 10 MB)</label>
            <input
              type="file"
              accept=".pdf,.jpg,.jpeg,.png"
              onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
              className="w-full"
            />
            {selectedFile && (
              <p className="text-sm text-gray-500 mt-1">{selectedFile.name} ({formatFileSize(selectedFile.size)})</p>
            )}
          </div>
          {uploadError && (
            <p className="text-red-600 text-sm mb-4 flex items-center gap-1">
              <AlertCircle className="w-4 h-4" /> {uploadError}
            </p>
          )}
          <div className="flex gap-3">
            <button
              type="submit"
              disabled={uploading || !selectedFile}
              className="inline-flex items-center gap-2 px-4 py-2 bg-rose-500 text-white rounded-lg font-medium hover:bg-rose-600 disabled:opacity-50 transition-colors"
            >
              {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
              {uploading ? 'Uploading...' : 'Upload'}
            </button>
            <button
              type="button"
              onClick={() => setShowUpload(false)}
              className="px-4 py-2 border border-gray-200 rounded-lg text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 mt-0.5" />
          <div className="flex-1">
            <p className="text-red-800">{error}</p>
          </div>
          <button onClick={() => setError('')} className="text-red-600 hover:text-red-800">&times;</button>
        </div>
      )}

      {/* Documents List */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-8 h-8 animate-spin text-rose-500" />
        </div>
      ) : documents.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-xl border border-dashed border-gray-300">
          <FileText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No documents uploaded</h3>
          <p className="text-gray-600 mb-6">Upload your documents to complete verification</p>
          <button
            onClick={() => setShowUpload(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-rose-500 text-white rounded-lg font-medium hover:bg-rose-600"
          >
            <Upload className="w-4 h-4" />
            Upload Your First Document
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {documents.map((doc) => (
            <div key={doc.id} className="bg-white rounded-xl border border-gray-200 p-5">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <FileText className="w-5 h-5 text-rose-500" />
                    <h3 className="font-semibold text-gray-900">{doc.display_name}</h3>
                    {doc.status === 'PENDING' && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                        <Clock className="w-3 h-3" /> Pending
                      </span>
                    )}
                    {doc.status === 'APPROVED' && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                        <CheckCircle className="w-3 h-3" /> Approved
                      </span>
                    )}
                    {doc.status === 'REJECTED' && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                        <XCircle className="w-3 h-3" /> Rejected
                      </span>
                    )}
                  </div>
                  <div className="text-sm text-gray-600 space-y-1">
                    <p>File: {doc.original_file_name} ({formatFileSize(doc.file_size)})</p>
                    <p>Uploaded: {formatDate(doc.uploaded_at)}</p>
                  </div>
                  {doc.status === 'REJECTED' && doc.rejection_reason && (
                    <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                      <strong>Rejection reason:</strong> {doc.rejection_reason}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2 ml-4">
                  <button
                    type="button"
                    onClick={() => setViewDoc({ id: doc.id, type: doc.document_type })}
                    className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
                    title="View document"
                  >
                    <Download className="w-4 h-4" />
                  </button>
                  {doc.can_reupload && (
                    <button
                      type="button"
                      onClick={() => handleReupload(doc.id)}
                      className="inline-flex items-center gap-1 px-3 py-1.5 bg-amber-500 text-white text-sm rounded-lg hover:bg-amber-600 transition-colors"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      Re-upload
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
