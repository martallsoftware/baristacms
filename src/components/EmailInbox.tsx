import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  EnvelopeIcon,
  EnvelopeOpenIcon,
  ArrowPathIcon,
  InboxArrowDownIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  XCircleIcon,
  UserIcon,
  ClockIcon,
  PaperClipIcon,
} from '@heroicons/react/24/outline';
import {
  emailInboxService,
  type InboxEmail,
  type ProcessedEmail,
  type Module,
} from '../services/api';

interface EmailInboxProps {
  module: Module;
  onClose?: () => void;
}

export default function EmailInbox({ module, onClose }: EmailInboxProps) {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'unprocessed' | 'processed'>('unprocessed');
  const [unprocessedEmails, setUnprocessedEmails] = useState<InboxEmail[]>([]);
  const [processedEmails, setProcessedEmails] = useState<ProcessedEmail[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedEmail, setSelectedEmail] = useState<InboxEmail | ProcessedEmail | null>(null);

  const loadEmails = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const [unprocessed, processed] = await Promise.all([
        emailInboxService.getUnprocessed(),
        emailInboxService.getModuleEmails(module.id),
      ]);

      // Filter unprocessed emails that match this module's name in subject
      const moduleEmails = unprocessed.filter(
        (e) => e.moduleName?.toLowerCase() === module.name.toLowerCase()
      );

      setUnprocessedEmails(moduleEmails);
      setProcessedEmails(processed.emails);
    } catch (err) {
      console.error('Failed to load emails:', err);
      setError(err instanceof Error ? err.message : 'Failed to load emails');
    } finally {
      setLoading(false);
    }
  }, [module.id, module.name]);

  useEffect(() => {
    loadEmails();
  }, [loadEmails]);

  const handleProcessAll = async () => {
    setProcessing(true);
    setError(null);

    try {
      const result = await emailInboxService.processEmails();

      if (result.success) {
        // Reload emails after processing
        await loadEmails();
      }
    } catch (err) {
      console.error('Failed to process emails:', err);
      setError(err instanceof Error ? err.message : 'Failed to process emails');
    } finally {
      setProcessing(false);
    }
  };

  const handleProcessSingle = async (email: InboxEmail) => {
    setProcessing(true);
    setError(null);

    try {
      const result = await emailInboxService.processSingle(email.id, module.name);

      if (result.success) {
        // Navigate to the created record
        navigate(`/records/${module.name}/${result.recordId}`);
      }
    } catch (err) {
      console.error('Failed to process email:', err);
      setError(err instanceof Error ? err.message : 'Failed to process email');
    } finally {
      setProcessing(false);
    }
  };

  const formatDate = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      return date.toLocaleString();
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl mx-4 h-[80vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-gray-50">
          <div className="flex items-center gap-3">
            <InboxArrowDownIcon className="h-6 w-6 text-blue-600" />
            <h2 className="text-lg font-semibold text-gray-900">
              Email Inbox - {module.display_name}
            </h2>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={loadEmails}
              disabled={loading}
              className="flex items-center gap-2 px-3 py-1.5 text-gray-600 hover:bg-gray-200 rounded-lg transition-colors disabled:opacity-50"
            >
              <ArrowPathIcon className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
            {onClose && (
              <button
                onClick={onClose}
                className="p-1 hover:bg-gray-200 rounded-full transition-colors"
              >
                <span className="sr-only">Close</span>
                <svg className="h-5 w-5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-200">
          <button
            onClick={() => setActiveTab('unprocessed')}
            className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
              activeTab === 'unprocessed'
                ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50'
                : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
            }`}
          >
            <div className="flex items-center justify-center gap-2">
              <EnvelopeIcon className="h-4 w-4" />
              Unprocessed
              {unprocessedEmails.length > 0 && (
                <span className="bg-blue-100 text-blue-800 text-xs px-2 py-0.5 rounded-full">
                  {unprocessedEmails.length}
                </span>
              )}
            </div>
          </button>
          <button
            onClick={() => setActiveTab('processed')}
            className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
              activeTab === 'processed'
                ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50'
                : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
            }`}
          >
            <div className="flex items-center justify-center gap-2">
              <EnvelopeOpenIcon className="h-4 w-4" />
              Processed
              {processedEmails.length > 0 && (
                <span className="bg-green-100 text-green-800 text-xs px-2 py-0.5 rounded-full">
                  {processedEmails.length}
                </span>
              )}
            </div>
          </button>
        </div>

        {/* Info Banner */}
        <div className="px-6 py-3 bg-blue-50 border-b border-blue-100">
          <p className="text-sm text-blue-700">
            Emails with <code className="bg-blue-100 px-1.5 py-0.5 rounded font-mono">[{module.name}]</code> in the subject line will be routed to this module.
          </p>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mx-6 mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm flex items-center gap-2">
            <ExclamationTriangleIcon className="h-5 w-5" />
            {error}
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-auto">
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
            </div>
          ) : activeTab === 'unprocessed' ? (
            <div className="p-6">
              {unprocessedEmails.length === 0 ? (
                <div className="text-center py-12">
                  <EnvelopeOpenIcon className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-500">No unprocessed emails for this module</p>
                  <p className="text-sm text-gray-400 mt-2">
                    Emails sent to your inbox with [{module.name}] in the subject will appear here
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {/* Process All Button */}
                  {unprocessedEmails.length > 0 && (
                    <div className="flex justify-end mb-4">
                      <button
                        onClick={handleProcessAll}
                        disabled={processing}
                        className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-50"
                      >
                        {processing ? (
                          <>
                            <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                            Processing...
                          </>
                        ) : (
                          <>
                            <InboxArrowDownIcon className="h-4 w-4" />
                            Process All Emails
                          </>
                        )}
                      </button>
                    </div>
                  )}

                  {/* Email List */}
                  {unprocessedEmails.map((email) => (
                    <div
                      key={email.id}
                      className="border border-gray-200 rounded-lg p-4 hover:border-blue-300 hover:bg-blue-50/30 transition-colors cursor-pointer"
                      onClick={() => setSelectedEmail(email)}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <UserIcon className="h-4 w-4 text-gray-400" />
                            <span className="font-medium text-gray-900 truncate">
                              {email.fromName || email.fromAddress}
                            </span>
                            {email.fromName && (
                              <span className="text-sm text-gray-500 truncate">
                                &lt;{email.fromAddress}&gt;
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            <h3 className="font-semibold text-gray-900 truncate">
                              {email.cleanSubject || email.subject}
                            </h3>
                            {email.hasAttachments && (
                              <span className="flex items-center gap-1 text-xs text-gray-500" title="Has attachments">
                                <PaperClipIcon className="h-4 w-4" />
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-gray-500 line-clamp-2 mt-1">
                            {email.bodyPreview}
                          </p>
                        </div>
                        <div className="flex flex-col items-end gap-2">
                          <div className="flex items-center gap-1 text-xs text-gray-400">
                            <ClockIcon className="h-3 w-3" />
                            {formatDate(email.receivedAt)}
                          </div>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleProcessSingle(email);
                            }}
                            disabled={processing}
                            className="px-3 py-1 text-xs bg-blue-100 text-blue-700 hover:bg-blue-200 rounded-full transition-colors disabled:opacity-50"
                          >
                            Create Record
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="p-6">
              {processedEmails.length === 0 ? (
                <div className="text-center py-12">
                  <CheckCircleIcon className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-500">No processed emails yet</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {processedEmails.map((email) => (
                    <div
                      key={email.id}
                      className={`border rounded-lg p-4 transition-colors ${
                        email.status === 'processed'
                          ? 'border-green-200 bg-green-50/30 hover:border-green-300'
                          : email.status === 'error'
                          ? 'border-red-200 bg-red-50/30'
                          : 'border-gray-200 bg-gray-50/30'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <UserIcon className="h-4 w-4 text-gray-400" />
                            <span className="font-medium text-gray-900 truncate">
                              {email.from_name || email.from_address}
                            </span>
                          </div>
                          <h3 className="font-semibold text-gray-900 truncate">
                            {email.subject}
                          </h3>
                          <p className="text-sm text-gray-500 line-clamp-2 mt-1">
                            {email.body_preview}
                          </p>
                          {email.error_message && (
                            <div className="flex items-center gap-1 text-sm text-red-600 mt-2">
                              <XCircleIcon className="h-4 w-4" />
                              {email.error_message}
                            </div>
                          )}
                        </div>
                        <div className="flex flex-col items-end gap-2">
                          <div className="flex items-center gap-1 text-xs text-gray-400">
                            <ClockIcon className="h-3 w-3" />
                            {formatDate(email.received_at)}
                          </div>
                          <span
                            className={`px-2 py-0.5 text-xs rounded-full ${
                              email.status === 'processed'
                                ? 'bg-green-100 text-green-700'
                                : email.status === 'error'
                                ? 'bg-red-100 text-red-700'
                                : 'bg-gray-100 text-gray-700'
                            }`}
                          >
                            {email.status}
                          </span>
                          {email.record_id && (
                            <button
                              onClick={() => navigate(`/records/${module.name}/${email.record_id}`)}
                              className="px-3 py-1 text-xs bg-blue-100 text-blue-700 hover:bg-blue-200 rounded-full transition-colors"
                            >
                              View Record
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Email Detail Modal */}
        {selectedEmail && 'bodyPreview' in selectedEmail && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-60">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl mx-4 max-h-[80vh] flex flex-col overflow-hidden">
              <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-gray-50">
                <h3 className="font-semibold text-gray-900">Email Details</h3>
                <button
                  onClick={() => setSelectedEmail(null)}
                  className="p-1 hover:bg-gray-200 rounded-full transition-colors"
                >
                  <svg className="h-5 w-5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <div className="flex-1 overflow-auto p-6">
                <div className="space-y-4">
                  <div>
                    <span className="text-sm text-gray-500">From:</span>
                    <p className="font-medium">
                      {(selectedEmail as InboxEmail).fromName || (selectedEmail as InboxEmail).fromAddress}
                      {(selectedEmail as InboxEmail).fromName && (
                        <span className="text-gray-500 font-normal ml-2">
                          &lt;{(selectedEmail as InboxEmail).fromAddress}&gt;
                        </span>
                      )}
                    </p>
                  </div>
                  <div>
                    <span className="text-sm text-gray-500">Subject:</span>
                    <p className="font-medium">{(selectedEmail as InboxEmail).subject}</p>
                  </div>
                  <div>
                    <span className="text-sm text-gray-500">Received:</span>
                    <p>{formatDate((selectedEmail as InboxEmail).receivedAt)}</p>
                  </div>
                  {(selectedEmail as InboxEmail).hasAttachments && (
                    <div className="flex items-center gap-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                      <PaperClipIcon className="h-5 w-5 text-blue-600" />
                      <span className="text-sm text-blue-700">
                        This email has attachments. They will be saved with the record when processed.
                      </span>
                    </div>
                  )}
                  <div>
                    <span className="text-sm text-gray-500">Message:</span>
                    <div className="mt-2 p-4 bg-gray-50 rounded-lg whitespace-pre-wrap text-sm">
                      {(selectedEmail as InboxEmail).body || (selectedEmail as InboxEmail).bodyPreview}
                    </div>
                  </div>
                </div>
              </div>
              <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-200 bg-gray-50">
                <button
                  onClick={() => setSelectedEmail(null)}
                  className="px-4 py-2 text-gray-700 bg-gray-200 hover:bg-gray-300 rounded-lg transition-colors"
                >
                  Close
                </button>
                <button
                  onClick={() => {
                    handleProcessSingle(selectedEmail as InboxEmail);
                    setSelectedEmail(null);
                  }}
                  disabled={processing}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-50"
                >
                  <InboxArrowDownIcon className="h-4 w-4" />
                  Create Record
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
