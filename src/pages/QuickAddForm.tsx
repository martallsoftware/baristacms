import { useEffect, useState, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  CheckCircleIcon,
  ExclamationTriangleIcon,
  ArrowLeftIcon,
  PaperAirplaneIcon,
  PhotoIcon,
  DocumentIcon,
  XMarkIcon,
  CloudArrowUpIcon,
} from '@heroicons/react/24/outline';
import {
  pageTemplateService,
  createRecordService,
  type PageTemplate,
  type ModuleField,
} from '../services/api';

export default function QuickAddForm() {
  const { slug } = useParams<{ slug: string }>();
  const [template, setTemplate] = useState<PageTemplate | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState<{ message: string; recordId: number; moduleName: string } | null>(null);

  // Form data
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [formData, setFormData] = useState<Record<string, unknown>>({});

  // File uploads
  const [pendingImages, setPendingImages] = useState<{ file: File; preview: string }[]>([]);
  const [pendingDocuments, setPendingDocuments] = useState<File[]>([]);
  const [uploadProgress, setUploadProgress] = useState<string | null>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const docInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (slug) {
      loadTemplate(slug);
    }
  }, [slug]);

  const loadTemplate = async (templateSlug: string) => {
    try {
      setLoading(true);
      setError(null);
      const data = await pageTemplateService.getBySlug(templateSlug);
      setTemplate(data);

      // Set default values if any
      if (data.default_values) {
        setFormData(data.default_values);
      }
    } catch (err) {
      console.error('Failed to load form:', err);
      setError('This form is not available.');
    } finally {
      setLoading(false);
    }
  };

  const handleFieldChange = (fieldName: string, value: unknown) => {
    setFormData(prev => ({
      ...prev,
      [fieldName]: value,
    }));
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.length) return;

    const files = Array.from(e.target.files);
    const newImages = files.map(file => ({
      file,
      preview: URL.createObjectURL(file),
    }));

    setPendingImages(prev => [...prev, ...newImages]);
    e.target.value = '';
  };

  const removeImage = (index: number) => {
    setPendingImages(prev => {
      const removed = prev[index];
      URL.revokeObjectURL(removed.preview);
      return prev.filter((_, i) => i !== index);
    });
  };

  const handleDocumentSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.length) return;

    const files = Array.from(e.target.files);
    setPendingDocuments(prev => [...prev, ...files]);
    e.target.value = '';
  };

  const removeDocument = (index: number) => {
    setPendingDocuments(prev => prev.filter((_, i) => i !== index));
  };

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!template || !name.trim()) return;

    let recordCreated = false;
    let recordId: number | null = null;
    let moduleName: string | null = null;
    let successMessage = '';
    const uploadErrors: string[] = [];

    try {
      setSubmitting(true);
      setUploadProgress(null);
      setError(null);

      // Submit the form to create the record
      const result = await pageTemplateService.submit(template.slug, {
        name: name.trim(),
        data: formData,
        email: email.trim() || undefined,
      });

      recordCreated = true;
      recordId = result.recordId;
      moduleName = result.moduleName;
      successMessage = result.message;

      // Upload images if any
      if (pendingImages.length > 0 && moduleName) {
        const recordService = createRecordService(moduleName);

        for (let i = 0; i < pendingImages.length; i++) {
          setUploadProgress(`Uploading images (${i + 1}/${pendingImages.length})...`);
          try {
            const base64 = await fileToBase64(pendingImages[i].file);
            await recordService.addImage(recordId, base64);
          } catch (imgErr) {
            console.error(`Failed to upload image ${i + 1}:`, imgErr);
            uploadErrors.push(`Image ${i + 1} failed to upload`);
          }
        }
      }

      // Upload documents if any
      if (pendingDocuments.length > 0 && moduleName) {
        const recordService = createRecordService(moduleName);

        for (let i = 0; i < pendingDocuments.length; i++) {
          setUploadProgress(`Uploading documents (${i + 1}/${pendingDocuments.length})...`);
          try {
            const file = pendingDocuments[i];
            const base64 = await fileToBase64(file);
            await recordService.addDocument(recordId, {
              name: file.name,
              file: base64,
              fileType: file.type,
              fileSize: file.size,
            });
          } catch (docErr) {
            console.error(`Failed to upload document ${i + 1}:`, docErr);
            uploadErrors.push(`Document "${pendingDocuments[i].name}" failed to upload`);
          }
        }
      }

      // Clean up image previews
      pendingImages.forEach(img => URL.revokeObjectURL(img.preview));

      // Show success even if some uploads failed
      let finalMessage = successMessage;
      if (uploadErrors.length > 0) {
        finalMessage += ` Note: ${uploadErrors.length} file(s) could not be uploaded.`;
      }

      setSuccess({
        message: finalMessage,
        recordId: recordId,
        moduleName: moduleName,
      });
    } catch (err) {
      console.error('Failed to submit form:', err);
      if (recordCreated && recordId && moduleName) {
        // Record was created but something else failed - still show success
        setSuccess({
          message: successMessage || 'Your submission was received, but some files may not have uploaded.',
          recordId: recordId,
          moduleName: moduleName,
        });
      } else {
        setError('Failed to submit form. Please try again.');
      }
    } finally {
      setSubmitting(false);
      setUploadProgress(null);
    }
  };

  const renderField = (field: ModuleField) => {
    const value = formData[field.name] ?? field.default_value ?? '';

    switch (field.field_type) {
      case 'textarea':
        return (
          <textarea
            id={field.name}
            value={String(value)}
            onChange={(e) => handleFieldChange(field.name, e.target.value)}
            rows={4}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            required={field.is_required === 1}
          />
        );

      case 'select':
        return (
          <select
            id={field.name}
            value={String(value)}
            onChange={(e) => handleFieldChange(field.name, e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            required={field.is_required === 1}
          >
            <option value="">Select...</option>
            {field.options?.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        );

      case 'boolean':
        return (
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              id={field.name}
              checked={Boolean(value)}
              onChange={(e) => handleFieldChange(field.name, e.target.checked)}
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 h-5 w-5"
            />
            <span className="text-gray-700">Yes</span>
          </label>
        );

      case 'number':
        return (
          <input
            type="number"
            id={field.name}
            value={String(value)}
            onChange={(e) => handleFieldChange(field.name, e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            required={field.is_required === 1}
          />
        );

      case 'date':
        return (
          <input
            type="date"
            id={field.name}
            value={String(value)}
            onChange={(e) => handleFieldChange(field.name, e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            required={field.is_required === 1}
          />
        );

      case 'email':
        return (
          <input
            type="email"
            id={field.name}
            value={String(value)}
            onChange={(e) => handleFieldChange(field.name, e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            required={field.is_required === 1}
          />
        );

      case 'url':
        return (
          <input
            type="url"
            id={field.name}
            value={String(value)}
            onChange={(e) => handleFieldChange(field.name, e.target.value)}
            placeholder="https://..."
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            required={field.is_required === 1}
          />
        );

      default:
        return (
          <input
            type="text"
            id={field.name}
            value={String(value)}
            onChange={(e) => handleFieldChange(field.name, e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            required={field.is_required === 1}
          />
        );
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (error && !template) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-8 max-w-md w-full text-center">
          <ExclamationTriangleIcon className="h-12 w-12 mx-auto text-amber-500 mb-4" />
          <h1 className="text-xl font-semibold text-gray-900 mb-2">Form Not Available</h1>
          <p className="text-gray-600 mb-6">{error}</p>
          <Link
            to="/"
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <ArrowLeftIcon className="h-4 w-4" />
            Go Home
          </Link>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-8 max-w-md w-full text-center">
          <CheckCircleIcon className="h-16 w-16 mx-auto text-green-500 mb-4" />
          <h1 className="text-2xl font-semibold text-gray-900 mb-2">Success!</h1>
          <p className="text-gray-600 mb-4">{success.message}</p>
          <div className="bg-gray-50 rounded-lg p-4 mb-6">
            <p className="text-sm text-gray-500 mb-1">Reference Number</p>
            <p className="text-xl font-semibold text-gray-900">
              {success.moduleName.toUpperCase()}-{success.recordId}
            </p>
          </div>
          <button
            onClick={() => {
              setSuccess(null);
              setName('');
              setEmail('');
              setFormData(template?.default_values || {});
              setPendingImages([]);
              setPendingDocuments([]);
            }}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Submit Another
          </button>
        </div>
      </div>
    );
  }

  if (!template) return null;

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-2xl mx-auto">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          {/* Header */}
          <div className="bg-blue-600 px-6 py-8 text-white">
            <h1 className="text-2xl font-bold">{template.title}</h1>
            {template.description && (
              <p className="mt-2 text-blue-100">{template.description}</p>
            )}
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="p-6 space-y-6">
            {/* Error message */}
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
                {error}
              </div>
            )}

            {/* Name field (always required) */}
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
                Title / Subject <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Enter a title for your submission"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              />
            </div>

            {/* Email field (for contact/follow-up) */}
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                Your Email
              </label>
              <input
                type="email"
                id="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your.email@example.com"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <p className="mt-1 text-xs text-gray-500">So we can get back to you</p>
            </div>

            {/* Dynamic fields */}
            {template.formFields?.map((field) => (
              <div key={field.id}>
                <label htmlFor={field.name} className="block text-sm font-medium text-gray-700 mb-1">
                  {field.display_name}
                  {field.is_required === 1 && <span className="text-red-500"> *</span>}
                </label>
                {renderField(field)}
              </div>
            ))}

            {/* Image Upload */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <PhotoIcon className="inline h-4 w-4 mr-1" />
                Images
              </label>
              <input
                type="file"
                ref={imageInputRef}
                onChange={handleImageSelect}
                accept="image/*"
                multiple
                className="hidden"
              />

              {pendingImages.length > 0 && (
                <div className="grid grid-cols-3 gap-2 mb-3">
                  {pendingImages.map((img, index) => (
                    <div key={index} className="relative group">
                      <img
                        src={img.preview}
                        alt={`Preview ${index + 1}`}
                        className="w-full h-20 object-cover rounded-lg"
                      />
                      <button
                        type="button"
                        onClick={() => removeImage(index)}
                        className="absolute -top-2 -right-2 p-1 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors"
                      >
                        <XMarkIcon className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <button
                type="button"
                onClick={() => imageInputRef.current?.click()}
                className="w-full border-2 border-dashed border-gray-300 rounded-lg p-4 text-center hover:border-blue-400 hover:bg-blue-50/50 transition-colors"
              >
                <CloudArrowUpIcon className="h-6 w-6 mx-auto text-gray-400 mb-1" />
                <p className="text-sm text-gray-600">Add Images</p>
                <p className="text-xs text-gray-400">PNG, JPG up to 5MB</p>
              </button>
            </div>

            {/* Document Upload */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <DocumentIcon className="inline h-4 w-4 mr-1" />
                Documents
              </label>
              <input
                type="file"
                ref={docInputRef}
                onChange={handleDocumentSelect}
                multiple
                className="hidden"
              />

              {pendingDocuments.length > 0 && (
                <div className="space-y-2 mb-3">
                  {pendingDocuments.map((file, index) => (
                    <div
                      key={index}
                      className="flex items-center gap-2 p-2 bg-gray-50 rounded-lg"
                    >
                      <DocumentIcon className="h-5 w-5 text-gray-400 flex-shrink-0" />
                      <span className="flex-1 text-sm text-gray-700 truncate">
                        {file.name}
                      </span>
                      <span className="text-xs text-gray-400">
                        {(file.size / 1024).toFixed(0)} KB
                      </span>
                      <button
                        type="button"
                        onClick={() => removeDocument(index)}
                        className="p-1 text-red-500 hover:bg-red-100 rounded transition-colors"
                      >
                        <XMarkIcon className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <button
                type="button"
                onClick={() => docInputRef.current?.click()}
                className="w-full border-2 border-dashed border-gray-300 rounded-lg p-4 text-center hover:border-blue-400 hover:bg-blue-50/50 transition-colors"
              >
                <CloudArrowUpIcon className="h-6 w-6 mx-auto text-gray-400 mb-1" />
                <p className="text-sm text-gray-600">Add Documents</p>
                <p className="text-xs text-gray-400">PDF, DOC, XLS, etc.</p>
              </button>
            </div>

            {/* Submit button */}
            <div className="pt-4">
              <button
                type="submit"
                disabled={submitting || !name.trim()}
                className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
              >
                {submitting ? (
                  <>
                    <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent" />
                    {uploadProgress || 'Submitting...'}
                  </>
                ) : (
                  <>
                    <PaperAirplaneIcon className="h-5 w-5" />
                    Submit
                    {(pendingImages.length > 0 || pendingDocuments.length > 0) && (
                      <span className="text-blue-200 text-sm">
                        ({pendingImages.length} images, {pendingDocuments.length} docs)
                      </span>
                    )}
                  </>
                )}
              </button>
            </div>
          </form>
        </div>

        {/* Footer */}
        <p className="text-center text-sm text-gray-500 mt-6">
          Powered by BaristaCMS
        </p>
      </div>
    </div>
  );
}
