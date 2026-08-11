'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from '@/lib/router-compat';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LifeBuoy, Headphones, Plus, Search, X, AlertTriangle, CheckCircle2,
  Clock, ShieldCheck, CreditCard, RotateCcw, BadgeCheck, Flag, Wrench,
  CircleHelp, ChevronRight, FileText, Send, Paperclip, Star, ArrowLeft,
  ChevronDown, MessageSquare, Upload, Image as ImageIcon, Download,
  HelpCircle, Check
} from 'lucide-react';
import { fetchApi } from '@/legacy/services/apiClient';
import type { PaginatedResult, SupportTicketV2 as SupportTicket } from '@/legacy/services/adminService';
import { getCategoriesV2 } from '@/legacy/services/adminService';

type TicketReply = {
  id: string;
  message: string;
  is_public?: boolean;
  is_internal_note?: boolean;
  created_at: string;
  author?: { id?: string; full_name?: string; account_type?: string } | null;
  sender?: { id?: string; full_name?: string; account_type?: string } | null;
  attachment?: string | null;
  attachments?: Array<{ id: string; download_url: string; original_filename: string; mime_type?: string }> | null;
};

const supportApi = {
  getTickets: (p: number = 1, search: string = '') =>
    fetchApi<PaginatedResult<SupportTicket>>(`/support/tickets/?page=${p}&page_size=20${search ? `&search=${encodeURIComponent(search)}` : ''}`),
  getTicket: (id: string) =>
    fetchApi<SupportTicket>(`/support/tickets/${id}/`),
  createTicket: (data: { category: string; subject: string; description: string; priority?: string; attachment?: File }) => {
    if (data.attachment) {
      const fd = new FormData();
      fd.append('category', data.category);
      fd.append('subject', data.subject);
      fd.append('description', data.description);
      fd.append('priority', data.priority || 'NORMAL');
      fd.append('attachment', data.attachment);
      return fetchApi<SupportTicket>('/support/tickets/', { method: 'POST', body: fd });
    }
    return fetchApi<SupportTicket>('/support/tickets/', { method: 'POST', body: JSON.stringify(data) });
  },
  reply: (ticketId: string, message: string, attachment?: File) => {
    if (attachment) {
      const fd = new FormData();
      fd.append('message', message);
      fd.append('attachment', attachment);
      return fetchApi<TicketReply>(`/support/tickets/${ticketId}/`, { method: 'POST', body: fd });
    }
    return fetchApi<TicketReply>(`/support/tickets/${ticketId}/`, { method: 'POST', body: JSON.stringify({ message }) });
  },
  reopen: (ticketId: string) =>
    fetchApi<TicketReply>(`/support/tickets/${ticketId}/`, { method: 'POST', body: JSON.stringify({ message: 'Member reopened ticket' }) }),
  confirmResolution: (ticketId: string) =>
    fetchApi<TicketReply>(`/support/tickets/${ticketId}/`, { method: 'POST', body: JSON.stringify({ message: 'Confirmed resolved' }) }),
};

function AttachmentPreview({ url, filename, mimeType }: { url?: string | null; filename?: string; mimeType?: string }) {
  if (!url) return null;
  const isImage = mimeType?.startsWith('image/') || /\.(jpe?g|png|webp|gif)$/i.test(filename || url);
  if (isImage) {
    return (
      <a href={url} target="_blank" rel="noreferrer" className="block mt-2.5 group">
        <img
          src={url}
          alt={filename || 'Attachment'}
          className="max-h-48 rounded-xl border border-gray-200 shadow-xs object-cover group-hover:opacity-90 transition-opacity"
        />
        <span className="text-[10px] font-semibold text-gray-500 mt-1 flex items-center gap-1">
          <ImageIcon className="w-3 h-3" /> {filename || 'View image'}
        </span>
      </a>
    );
  }
  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      className="mt-2.5 inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-gray-100 hover:bg-gray-200 border border-gray-200 text-xs font-semibold text-gray-800 transition-colors"
    >
      {/\.pdf$/i.test(filename || url) ? <FileText className="w-4 h-4" /> : <Download className="w-4 h-4" />}
      <span>{filename || 'Download attachment'}</span>
    </a>
  );
}

const CATEGORY_OPTIONS = [
  { value: 'PAYMENTS', label: 'Payments & Plans', icon: CreditCard, blurb: 'Billing, subscription, and upgrade help', subjectHint: 'Issue with my plan or payment' },
  { value: 'REFUNDS', label: 'Refunds', icon: RotateCcw, blurb: 'Request assistance for completed transactions', subjectHint: 'Refund request for my order' },
  { value: 'PROFILE_VERIFICATION', label: 'Account & Verification', icon: BadgeCheck, blurb: 'ID verification, photo approval & login', subjectHint: 'Need help with profile verification' },
  { value: 'SAFETY', label: 'Safety & Report Profile', icon: Flag, blurb: 'Report suspicious activity or harassment', subjectHint: 'Report a suspicious profile or issue' },
  { value: 'TECHNICAL', label: 'Technical Issue', icon: Wrench, blurb: 'Bug reports, site access & error fixes', subjectHint: 'Something is not working correctly' },
  { value: 'GENERAL', label: 'General Inquiry', icon: CircleHelp, blurb: 'Ask us anything else about your experience', subjectHint: 'General question about My Dear Partner' },
];

const PRIORITY_OPTIONS = [
  { value: 'LOW', label: 'Low' },
  { value: 'NORMAL', label: 'Normal' },
  { value: 'HIGH', label: 'High' },
  { value: 'URGENT', label: 'Urgent' },
];

const FAQ_ITEMS = [
  {
    question: 'How long does profile or photo verification take?',
    answer: 'Our trust & safety team reviews submitted photos and government IDs within 2 to 4 hours. You will receive an instant notification once verified.'
  },
  {
    question: 'What happens when I send a support request?',
    answer: 'Your request is assigned to a dedicated support specialist. You can track all responses and message history directly on this page.'
  },
  {
    question: 'Can I request a refund if I upgraded by mistake?',
    answer: 'Yes! Select the Refunds category above and submit a request within 48 hours of purchase. Our finance team will review it promptly.'
  },
  {
    question: 'How do I report an inappropriate or fake profile?',
    answer: 'Click "Safety & Report Profile" above or use the "Report Profile" option directly on any member profile page to notify our safety officers.'
  }
];

function categoryMeta(value: string) {
  return CATEGORY_OPTIONS.find((c) => c.value === value) || CATEGORY_OPTIONS[CATEGORY_OPTIONS.length - 1];
}

const STATUS_COLORS: Record<string, string> = {
  OPEN: 'bg-rose-100 text-rose-800',
  IN_PROGRESS: 'bg-amber-100 text-amber-800',
  WAITING_FOR_MEMBER: 'bg-purple-100 text-purple-800',
  WAITING_FOR_USER: 'bg-purple-100 text-purple-800',
  RESOLVED: 'bg-emerald-100 text-emerald-800',
  CLOSED: 'bg-gray-100 text-gray-700',
  REOPENED: 'bg-rose-100 text-rose-800',
};

const PRIORITY_COLORS: Record<string, string> = {
  LOW: 'bg-gray-100 text-gray-700',
  NORMAL: 'bg-rose-100 text-rose-700',
  HIGH: 'bg-orange-100 text-orange-800',
  URGENT: 'bg-red-100 text-red-800',
};

export default function MemberSupportPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { id: routeTicketId } = useParams<{ id?: string }>();

  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [selectedTicket, setSelectedTicket] = useState<SupportTicket | null>(null);
  const [replies, setReplies] = useState<TicketReply[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [priorityFilter, setPriorityFilter] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState<string>('');

  const [loading, setLoading] = useState<boolean>(true);
  const [detailsLoading, setDetailsLoading] = useState<boolean>(false);
  const [submitLoading, setSubmitLoading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [activeMobileTab, setActiveMobileTab] = useState<'list' | 'detail'>('list');
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(null);
  const [ticketPage, setTicketPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [newSubject, setNewSubject] = useState<string>('');
  const [newDescription, setNewDescription] = useState<string>('');
  const [newCategory, setNewCategory] = useState<string>('GENERAL');
  const [newPriority, setNewPriority] = useState<string>('NORMAL');
  const [newAttachment, setNewAttachment] = useState<File | undefined>(undefined);
  const [newAttachmentPreview, setNewAttachmentPreview] = useState<string | null>(null);
  const [attachmentError, setAttachmentError] = useState<string | null>(null);
  const [createError, setCreateError] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<{ [key: string]: string }>({});

  const [replyMessage, setReplyMessage] = useState<string>('');
  const [replyAttachment, setReplyAttachment] = useState<File | undefined>(undefined);
  const [replyAttachmentError, setReplyAttachmentError] = useState<string | null>(null);
  const [feedbackRating, setFeedbackRating] = useState<number>(5);
  const [feedbackText, setFeedbackText] = useState<string>('');
  const [feedbackSubmitted, setFeedbackSubmitted] = useState<boolean>(false);

  const conversationEndRef = useRef<HTMLDivElement>(null);
  const chatBoxRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Preserve document scroll position across state changes
  const pageScrollRef = useRef(0);
  const preservePageScroll = () => { pageScrollRef.current = window.scrollY; };
  const restorePageScroll = () => {
    if (pageScrollRef.current > 0) {
      const y = pageScrollRef.current;
      pageScrollRef.current = 0;
      window.scrollTo(0, y);
    }
  };

  useEffect(() => {
    const handler = setTimeout(() => setDebouncedSearchQuery(searchQuery), 300);
    return () => clearTimeout(handler);
  }, [searchQuery]);

  const loadTickets = useCallback(async (p?: number) => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const pg = p ?? ticketPage;
      const data = await supportApi.getTickets(pg, debouncedSearchQuery);
      setTickets(data.results || []);
      setTicketPage(pg);
      setTotalPages(data.num_pages || 1);
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || 'Failed to load support requests.');
    } finally {
      setLoading(false);
    }
  }, [debouncedSearchQuery, statusFilter]);

  useEffect(() => {
    void loadTickets();
  }, [loadTickets]);

  // Separate loader for ticket details — avoids double-fetch bug
  const loadTicketDetails = useCallback(async (ticketId: string) => {
    setDetailsLoading(true);
    preservePageScroll();
    try {
      const details = await supportApi.getTicket(ticketId);
      setSelectedTicket(details);
      setReplies(details.replies || []);
      setFeedbackSubmitted(Boolean((details as any).feedback));
      setActiveMobileTab('detail');
    } catch (err: any) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to retrieve support request details.');
    } finally {
      setDetailsLoading(false);
    }
  }, []);

  // Restore page scroll after detail state settles
  useEffect(() => {
    restorePageScroll();
  }, [selectedTicket?.id, replies]);

  // Auto-scroll chat box to bottom on new message
  useEffect(() => {
    if (!chatBoxRef.current) return;
    chatBoxRef.current.scrollTop = chatBoxRef.current.scrollHeight;
  }, [replies.length]);

  // Load from URL param when it changes (initial mount + back/forward navigation)
  useEffect(() => {
    const id = routeTicketId;
    if (!id) { setSelectedTicket(null); setReplies([]); return; }
    setErrorMsg(null);
    setReplyMessage('');
    setReplyAttachment(undefined);
    void loadTicketDetails(id);
  }, [routeTicketId, loadTicketDetails]);

  const handleSelectTicket = useCallback((ticket: SupportTicket) => {
    const id = ticket.id;
    if (selectedTicket?.id === id) return;
    preservePageScroll();
    setErrorMsg(null);
    setReplyMessage('');
    setReplyAttachment(undefined);
    setReplyAttachmentError(null);
    setActiveMobileTab('detail');
    // Show the list item immediately while full details load
    setSelectedTicket(ticket);
    setReplies([]);
    void loadTicketDetails(id);
    window.history.replaceState(null, '', `/support/${id}`);
  }, [loadTicketDetails, selectedTicket?.id]);

  const openCreateModal = (presetCategory = 'GENERAL') => {
    setNewCategory(presetCategory);
    setNewSubject(categoryMeta(presetCategory).subjectHint);
    setNewPriority('NORMAL');
    setNewDescription('');
    setNewAttachment(undefined);
    if (newAttachmentPreview) URL.revokeObjectURL(newAttachmentPreview);
    setNewAttachmentPreview(null);
    setAttachmentError(null);
    setCreateError(null);
    setValidationErrors({});
    setIsModalOpen(true);
  };

  const MAX_ATTACHMENT_BYTES = 5 * 1024 * 1024;
  const ALLOWED_ATTACHMENT_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];

  const handleAttachmentChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setAttachmentError(null);
    if (newAttachmentPreview) {
      URL.revokeObjectURL(newAttachmentPreview);
      setNewAttachmentPreview(null);
    }
    const file = e.target.files?.[0];
    if (!file) { setNewAttachment(undefined); return; }
    if (!ALLOWED_ATTACHMENT_TYPES.includes(file.type)) {
      setAttachmentError('Only JPG, PNG, WEBP or PDF files are supported.');
      setNewAttachment(undefined);
      return;
    }
    if (file.size > MAX_ATTACHMENT_BYTES) {
      setAttachmentError('File is too large. Maximum size is 5MB.');
      setNewAttachment(undefined);
      return;
    }
    setNewAttachment(file);
    if (file.type.startsWith('image/')) {
      setNewAttachmentPreview(URL.createObjectURL(file));
    }
  };

  const validateTicketForm = (): boolean => {
    const errors: { [key: string]: string } = {};
    if (!newSubject.trim()) errors.subject = 'Subject is required.';
    else if (newSubject.length < 5) errors.subject = 'Subject must be at least 5 characters.';
    if (!newDescription.trim()) errors.description = 'Description is required.';
    else if (newDescription.length < 15) errors.description = 'Description must be at least 15 characters.';
    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleCreateTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateTicketForm()) return;
    setSubmitLoading(true);
    setCreateError(null);
    setErrorMsg(null);
    try {
      const created = await supportApi.createTicket({ category: newCategory, subject: newSubject, description: newDescription, priority: newPriority, attachment: newAttachment });
      setTickets([created, ...tickets]);
      setIsModalOpen(false);
      setNewSubject('');
      setNewDescription('');
      setNewCategory('GENERAL');
      setNewPriority('NORMAL');
      setNewAttachment(undefined);
      if (newAttachmentPreview) { URL.revokeObjectURL(newAttachmentPreview); setNewAttachmentPreview(null); }
      setValidationErrors({});
      handleSelectTicket(created);
    } catch (err: any) {
      console.error(err);
      setCreateError(err?.message || 'Failed to send your support request. Please try again.');
    } finally {
      setSubmitLoading(false);
    }
  };

  const handleReplySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTicket || !replyMessage.trim()) return;
    setSubmitLoading(true);
    setErrorMsg(null);
    try {
      const newReply = await supportApi.reply(selectedTicket.id, replyMessage, replyAttachment);
      setReplies((prev) => [...prev, newReply]);
      setReplyMessage('');
      setReplyAttachment(undefined);
      setReplyAttachmentError(null);
      setSelectedTicket((prev) => prev ? {
        ...prev,
        status: prev.status === 'WAITING_FOR_MEMBER' || prev.status === 'WAITING_FOR_USER' ? 'IN_PROGRESS' : prev.status,
        last_reply_at: new Date().toISOString()
      } : null);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to send reply.');
    } finally {
      setSubmitLoading(false);
    }
  };

  const handleReplyAttachmentChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setReplyAttachmentError(null);
    const file = e.target.files?.[0];
    if (!file) { setReplyAttachment(undefined); return; }
    if (!['image/jpeg', 'image/png', 'image/webp', 'application/pdf', 'text/plain'].includes(file.type) && !file.name.match(/\.(txt)$/i)) {
      setReplyAttachmentError('Only JPG, PNG, WEBP, PDF or TXT files are supported.');
      setReplyAttachment(undefined);
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setReplyAttachmentError('File is too large. Maximum size is 10MB.');
      setReplyAttachment(undefined);
      return;
    }
    setReplyAttachment(file);
  };

  const handleConfirmResolution = async () => {
    if (!selectedTicket) return;
    try {
      await supportApi.confirmResolution(selectedTicket.id);
      setFeedbackSubmitted(true);
      setSelectedTicket({ ...selectedTicket, status: 'RESOLVED', resolved_at: new Date().toISOString() });
      alert('Resolution confirmed. Thank you for your feedback!');
      void loadTickets();
    } catch (err: any) {
      alert(err.message || 'Failed to submit feedback.');
    }
  };

  const handleReopenTicket = async () => {
    if (!selectedTicket) return;
    try {
      const updated = await supportApi.reopen(selectedTicket.id);
      setSelectedTicket(updated as any);
      setReplies(((updated as any).replies || []) as TicketReply[]);
      setFeedbackSubmitted(false);
      alert('Support request reopened successfully.');
      void loadTickets();
    } catch (err: any) {
      alert(err.message || 'Failed to reopen support request.');
    }
  };

  const formatDate = (isoString?: string | null) => {
    if (!isoString) return 'N/A';
    return new Date(isoString).toLocaleString('en-IN', {
      timeZone: 'Asia/Kolkata', dateStyle: 'medium', timeStyle: 'short'
    });
  };

  const formatTime = (isoString?: string | null) => {
    if (!isoString) return '';
    return new Date(isoString).toLocaleString('en-IN', {
      timeZone: 'Asia/Kolkata', timeStyle: 'short'
    });
  };

  const filteredTickets = tickets.filter(t => {
    const matchesSearch = t.subject.toLowerCase().includes(debouncedSearchQuery.toLowerCase()) ||
      t.ticket_number.toLowerCase().includes(debouncedSearchQuery.toLowerCase());
    const matchesPriority = priorityFilter ? t.priority === priorityFilter : true;
    return matchesSearch && matchesPriority;
  });

  const statusTabs = [
    { value: '', label: 'All' },
    { value: 'OPEN', label: 'Open' },
    { value: 'IN_PROGRESS', label: 'In Progress' },
    { value: 'WAITING_FOR_USER', label: 'Awaiting You' },
    { value: 'RESOLVED', label: 'Resolved' },
  ];

  return (
    <main className="min-h-[100svh] bg-[#fcfaf9] pt-24 pb-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">

        {/* Header */}
        <div className="flex flex-col items-start justify-between gap-5 rounded-[1.75rem] border border-rose-100 bg-white p-6 shadow-[0_16px_40px_-32px_rgba(91,23,53,.42)] sm:flex-row sm:items-center sm:p-8">
          <div className="space-y-1.5">
            <div className="inline-flex items-center gap-2 rounded-full border border-rose-100 bg-rose-50 px-3 py-1 text-xs font-bold text-[#9b3655]">
              <Headphones className="w-3.5 h-3.5" />
              <span>Member Care & Support</span>
            </div>
            <h1 className="font-display text-2xl font-black tracking-tight text-[#351320] sm:text-3xl">
              How can we assist you today?
            </h1>
            <p className="max-w-xl text-sm leading-6 text-slate-500">
              Get fast assistance from our member specialists, track existing inquiries, or explore solutions below.
            </p>
          </div>
          <button
            type="button"
            className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-[#8e3d58] px-6 py-3 text-sm font-bold text-white shadow-lg shadow-rose-200 transition-all hover:-translate-y-0.5 hover:bg-[#702d45] cursor-pointer"
            onClick={() => openCreateModal('GENERAL')}
          >
            <Plus className="w-4 h-4" /> New Support Request
          </button>
        </div>

        {/* Category Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {CATEGORY_OPTIONS.map((category) => {
            const CategoryIcon = category.icon;
            return (
              <button
                type="button"
                key={category.value}
                onClick={() => openCreateModal(category.value)}
                className="group flex cursor-pointer items-start justify-between rounded-2xl border border-rose-100 bg-white p-5 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:border-rose-200 hover:shadow-md"
              >
                <div className="flex items-start gap-3.5">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-rose-100 bg-rose-50 text-[#a13a59] transition-colors group-hover:bg-[#8e3d58] group-hover:text-white">
                    <CategoryIcon className="w-5 h-5" />
                  </div>
                  <div>
                    <strong className="block text-sm font-bold text-[#351320] transition-colors group-hover:text-[#8e3d58]">
                      {category.label}
                    </strong>
                    <span className="block text-xs text-gray-600 mt-0.5 leading-snug">
                      {category.blurb}
                    </span>
                  </div>
                </div>
                <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-slate-300 transition-colors group-hover:text-[#8e3d58]" />
              </button>
            );
          })}
        </div>

        {/* Error Alert */}
        {errorMsg && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-5 py-4 text-sm font-semibold text-red-800 shadow-sm flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
            <button type="button" className="text-xs font-bold underline cursor-pointer shrink-0" onClick={() => setErrorMsg(null)}>Dismiss</button>
          </div>
        )}

        {/* Search & Filter Bar */}
        <div className="flex flex-col items-start justify-between gap-4 rounded-2xl border border-rose-100 bg-white p-4 shadow-sm lg:flex-row lg:items-center">
          <div className="relative w-full lg:w-72">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by subject or ticket number..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-gray-50 border border-gray-200 text-gray-900 pl-10 pr-8 py-2 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-1.5 w-full lg:w-auto">
            {statusTabs.map((tab) => (
              <button
                key={tab.value}
                type="button"
                className={`px-3.5 py-1.5 rounded-lg text-sm font-semibold transition-all cursor-pointer ${
                  statusFilter === tab.value
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200 border border-gray-200'
                }`}
                onClick={() => setStatusFilter(tab.value)}
              >
                {tab.label}
              </button>
            ))}
          </div>
          <select
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value)}
            className="w-full lg:w-auto bg-gray-50 border border-gray-200 text-gray-900 px-3 py-2 rounded-lg text-sm font-semibold cursor-pointer"
          >
            <option value="">All Priorities</option>
            <option value="LOW">Low</option>
            <option value="NORMAL">Normal</option>
            <option value="HIGH">High</option>
            <option value="URGENT">Urgent</option>
          </select>
        </div>

        {/* Main Workspace */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">

          {/* Left: Ticket List */}
          <div className={`lg:col-span-5 ${activeMobileTab === 'detail' ? 'hidden lg:block' : 'block'}`}>
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="px-5 py-3.5 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
                <h2 className="text-xs font-bold uppercase tracking-wider text-gray-700">Your Inquiries</h2>
                <span className="px-2.5 py-0.5 rounded-full bg-white border border-gray-200 text-gray-600 text-xs font-semibold">
                  {filteredTickets.length}
                </span>
              </div>
              <div className="divide-y divide-gray-100 max-h-[600px] overflow-y-auto">
                {loading ? (
                  <div className="p-8 text-center">
                    <div className="animate-pulse space-y-3">
                      {[...Array(3)].map((_, i) => (
                        <div key={i} className="h-20 bg-gray-100 rounded-lg" />
                      ))}
                    </div>
                  </div>
                ) : filteredTickets.length === 0 ? (
                  <div className="p-8 text-center">
                    <FileText className="w-10 h-10 text-gray-300 mx-auto mb-2" />
                    <h3 className="text-sm font-bold text-gray-800">No requests found</h3>
                    <p className="text-sm text-gray-600 mt-1 mb-3">
                      {tickets.length === 0
                        ? "You haven't contacted support yet."
                        : "No requests match your filters."}
                    </p>
                    <button
                      type="button"
                      className="px-3.5 py-1.5 rounded-lg bg-gray-100 text-gray-700 border border-gray-200 text-sm font-semibold cursor-pointer hover:bg-gray-200"
                      onClick={() => { setSearchQuery(''); setStatusFilter(''); setPriorityFilter(''); }}
                    >
                      Clear filters
                    </button>
                  </div>
                ) : (
                  filteredTickets.map((ticket) => (
                    <button
                      type="button"
                      key={ticket.id}
                      onClick={() => handleSelectTicket(ticket)}
                      className={`w-full p-4 sm:p-5 text-left transition-colors cursor-pointer border-l-4 ${
                        selectedTicket?.id === ticket.id
                          ? 'bg-indigo-50/60 border-l-indigo-600'
                          : 'hover:bg-gray-50 border-l-transparent'
                      }`}
                    >
                      <div className="flex justify-between items-center mb-1">
                        <span className="font-bold text-indigo-700 text-sm">#{ticket.ticket_number}</span>
                        <span className="text-xs text-gray-500 font-medium">{formatDate(ticket.created_at)}</span>
                      </div>
                      <h3 className="font-bold text-sm text-gray-900 line-clamp-1 mb-2.5">{ticket.subject}</h3>
                      <div className="flex flex-wrap gap-1.5 text-xs font-semibold">
                        <span className={`px-2 py-0.5 rounded-md ${STATUS_COLORS[ticket.status] || 'bg-gray-100 text-gray-700'}`}>
                          {(ticket.status || '').replace(/_/g, ' ')}
                        </span>
                        <span className={`px-2 py-0.5 rounded-md ${PRIORITY_COLORS[ticket.priority] || 'bg-gray-100 text-gray-700'}`}>
                          {ticket.priority}
                        </span>
                        <span className="px-2 py-0.5 rounded-md bg-gray-100 text-gray-700">
                          {(ticket.category || '').replace(/_/g, ' ')}
                        </span>
                      </div>
                    </button>
                  ))
                )}
                {totalPages > 1 && (
                  <div className="flex items-center justify-center gap-2 p-4 border-t border-gray-100">
                    <button onClick={() => loadTickets(ticketPage - 1)} disabled={ticketPage <= 1}
                      className="px-3 py-1 rounded-lg bg-indigo-50 text-indigo-700 text-xs font-medium disabled:opacity-30 hover:bg-indigo-100">
                      Previous
                    </button>
                    <span className="text-xs text-gray-500 font-mono">Page {ticketPage} of {totalPages}</span>
                    <button onClick={() => loadTickets(ticketPage + 1)} disabled={ticketPage >= totalPages}
                      className="px-3 py-1 rounded-lg bg-indigo-50 text-indigo-700 text-xs font-medium disabled:opacity-30 hover:bg-indigo-100">
                      Next
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Right: Conversation Detail */}
          <div className={`lg:col-span-7 ${activeMobileTab === 'list' ? 'hidden lg:block' : 'block'}`}>
            {detailsLoading && !selectedTicket ? (
              <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center shadow-sm">
                <div className="animate-pulse space-y-4">
                  <div className="h-6 bg-gray-100 rounded w-1/3 mx-auto" />
                  <div className="h-4 bg-gray-100 rounded w-2/3 mx-auto" />
                  <div className="h-32 bg-gray-100 rounded-lg" />
                </div>
              </div>
            ) : selectedTicket ? (
              <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden flex flex-col min-h-[500px]">

                {/* Mobile Back */}
                <div className="p-3 bg-gray-50 border-b border-gray-200 lg:hidden">
                  <button
                    type="button"
                    onClick={() => setActiveMobileTab('list')}
                    className="inline-flex items-center gap-1.5 text-sm font-semibold text-indigo-700 cursor-pointer"
                  >
                    <ArrowLeft className="w-4 h-4" /> Back to conversations
                  </button>
                </div>

                {/* Detail Header */}
                <div className="px-5 sm:px-6 py-4 bg-gray-50 border-b border-gray-200">
                  <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-2">
                    <div className="min-w-0">
                      <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                        #{selectedTicket.ticket_number} &middot; {formatDate(selectedTicket.created_at)}
                      </span>
                      <h2 className="text-lg sm:text-xl font-extrabold text-gray-900 mt-0.5 break-words">{selectedTicket.subject}</h2>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1.5 text-xs font-semibold mt-2.5">
                    <span className={`px-2.5 py-0.5 rounded-full ${STATUS_COLORS[selectedTicket.status] || 'bg-gray-100 text-gray-700'}`}>
                      {(selectedTicket.status || '').replace(/_/g, ' ')}
                    </span>
                    <span className={`px-2.5 py-0.5 rounded-full ${PRIORITY_COLORS[selectedTicket.priority] || 'bg-gray-100 text-gray-700'}`}>
                      {selectedTicket.priority}
                    </span>
                    <span className="px-2.5 py-0.5 rounded-full bg-gray-100 text-gray-700">
                      {(selectedTicket.category || '').replace(/_/g, ' ')}
                    </span>
                  </div>
                </div>

                {/* Conversation Body */}
                <div ref={chatBoxRef} className="flex-1 overflow-y-auto max-h-[450px] px-5 sm:px-6 py-5 space-y-5">
                  {/* Original Request */}
                  <div className="p-4 sm:p-5 rounded-xl bg-gray-50 border border-gray-200">
                    <div className="flex justify-between items-center text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2.5 border-b border-gray-200 pb-2">
                      <span>Original Request</span>
                      <span>{formatTime(selectedTicket.created_at)}</span>
                    </div>
                    <p className="text-sm text-gray-800 leading-relaxed">{(selectedTicket as any).description || selectedTicket.message}</p>
                    {(selectedTicket.attachments && selectedTicket.attachments.length > 0)
                      ? selectedTicket.attachments.map((att: any) => (
                          <AttachmentPreview key={att.id} url={att.download_url} filename={att.original_filename} mimeType={att.mime_type} />
                        ))
                      : <AttachmentPreview url={(selectedTicket as any).attachment} />
                    }
                  </div>

                  {/* Replies */}
                  {replies.map((reply) => {
                    const senderAccountType = reply.sender?.account_type || reply.author?.account_type;
                    const isUserSender =
                      senderAccountType === 'MEMBER' ||
                      reply.sender?.id === (selectedTicket as any).user?.id ||
                      reply.author?.id === (selectedTicket as any).user?.id ||
                      reply.sender?.id === (selectedTicket as any).member?.id;

                    const senderName = isUserSender ? 'You' : 'Support Team';

                    return (
                      <div key={reply.id} className={`flex ${isUserSender ? 'justify-end' : 'justify-start'}`}>
                        <div className={`flex gap-3 max-w-[88%] sm:max-w-[78%] ${isUserSender ? 'flex-row-reverse' : 'flex-row'}`}>
                          {!isUserSender && (
                            <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center shrink-0 mt-1">
                              <Headphones className="w-4 h-4" />
                            </div>
                          )}
                          <div className={`rounded-xl px-4 py-3 shadow-sm ${
                            isUserSender
                              ? 'bg-indigo-600 text-white rounded-br-sm'
                              : 'bg-white border border-gray-200 text-gray-900 rounded-bl-sm'
                          }`}>
                            <div className={`text-xs font-semibold mb-1.5 flex items-center justify-between gap-3 ${
                              isUserSender ? 'text-indigo-200' : 'text-gray-500'
                            }`}>
                              <span>{senderName}</span>
                              <span>{formatTime(reply.created_at)}</span>
                            </div>
                            <p className="text-sm leading-relaxed whitespace-pre-wrap">{reply.message}</p>
                            {(reply.attachments && reply.attachments.length > 0)
                              ? reply.attachments.map((att: any) => (
                                  <AttachmentPreview key={att.id} url={att.download_url} filename={att.original_filename} mimeType={att.mime_type} />
                                ))
                              : <AttachmentPreview url={reply.attachment} />
                            }
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  <div ref={conversationEndRef} />
                </div>

                {/* Reply Form */}
                <div className="px-5 sm:px-6 py-4 bg-gray-50 border-t border-gray-200">
                  {selectedTicket.status === 'RESOLVED' || selectedTicket.status === 'CLOSED' ? (
                    <div className="text-center py-3">
                      <p className="text-gray-800 font-bold text-sm mb-2">
                        {selectedTicket.status === 'CLOSED' ? 'This support request is closed.' : 'This request has been resolved.'}
                      </p>
                      <button
                        type="button"
                        className="px-5 py-2 rounded-lg bg-white border border-gray-300 text-gray-800 text-sm font-bold cursor-pointer hover:bg-gray-50"
                        onClick={handleReopenTicket}
                      >
                        Reopen Request
                      </button>
                    </div>
                  ) : (
                    <form onSubmit={handleReplySubmit} className="space-y-3">
                      <textarea
                        placeholder="Type your message..."
                        value={replyMessage}
                        onChange={(e) => setReplyMessage(e.target.value)}
                        className="w-full bg-white border border-gray-200 rounded-lg p-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 resize-none"
                        rows={3}
                        required
                      />
                      {replyAttachmentError && (
                        <p className="text-red-600 text-xs font-semibold">{replyAttachmentError}</p>
                      )}
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            className="inline-flex items-center gap-1.5 text-sm font-semibold text-gray-600 hover:text-gray-800 cursor-pointer"
                            onClick={() => fileInputRef.current?.click()}
                          >
                            <Paperclip className="w-4 h-4" />
                            {replyAttachment ? replyAttachment.name : 'Attach'}
                          </button>
                          {replyAttachment && (
                            <button
                              type="button"
                              className="text-xs font-bold text-red-600 hover:text-red-800 cursor-pointer"
                              onClick={() => { setReplyAttachment(undefined); setReplyAttachmentError(null); if (fileInputRef.current) fileInputRef.current.value = ''; }}
                            >
                              Remove
                            </button>
                          )}
                        </div>
                        <button
                          type="submit"
                          className="px-5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold flex items-center gap-1.5 shadow-sm cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                          disabled={submitLoading || !replyMessage.trim()}
                        >
                          {submitLoading ? 'Sending...' : (<><Send className="w-4 h-4" /> Send</>)}
                        </button>
                      </div>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept=".jpeg,.jpg,.png,.webp,.pdf"
                        className="hidden"
                        onChange={handleReplyAttachmentChange}
                      />
                    </form>
                  )}
                </div>

                {/* Resolution Feedback */}
                {selectedTicket.status === 'RESOLVED' && !feedbackSubmitted && (
                  <div className="px-5 sm:px-6 py-4 bg-gray-50 border-t border-gray-200">
                    <div className="bg-white rounded-xl border border-gray-200 p-4">
                      <p className="text-sm font-bold text-gray-900 mb-3">How was our support?</p>
                      <div className="flex gap-1 mb-3">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <button
                            key={star}
                            type="button"
                            className={`p-1 cursor-pointer ${star <= feedbackRating ? 'text-amber-400' : 'text-gray-200'}`}
                            onClick={() => setFeedbackRating(star)}
                          >
                            <Star className="w-5 h-5 fill-current" />
                          </button>
                        ))}
                      </div>
                      <textarea
                        placeholder="Share your feedback (optional)..."
                        value={feedbackText}
                        onChange={(e) => setFeedbackText(e.target.value)}
                        className="w-full bg-gray-50 border border-gray-200 rounded-lg p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 resize-none mb-2"
                        rows={2}
                      />
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold cursor-pointer"
                          onClick={handleConfirmResolution}
                        >
                          Confirm & Close
                        </button>
                      </div>
                    </div>
                  </div>
                )}

              </div>
            ) : (
              <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center shadow-sm h-full flex flex-col items-center justify-center">
                <LifeBuoy className="w-12 h-12 text-gray-300 mb-3" />
                <h2 className="text-lg font-bold text-gray-900">Select a conversation</h2>
                <p className="text-sm text-gray-600 mt-1 max-w-sm">
                  Choose a support request from the list or start a new request using the options above.
                </p>
              </div>
            )}
          </div>

        </div>

        {/* FAQ Section */}
        <div className="bg-white rounded-2xl border border-gray-200 p-6 sm:p-8 shadow-sm space-y-5">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-indigo-600" />
            <h2 className="text-lg font-bold text-gray-900">Frequently Asked Questions</h2>
          </div>
          <div className="divide-y divide-gray-200">
            {FAQ_ITEMS.map((faq, idx) => (
              <div key={idx} className="py-4">
                <button
                  type="button"
                  onClick={() => setOpenFaqIndex(openFaqIndex === idx ? null : idx)}
                  className="w-full flex items-center justify-between text-left font-bold text-sm text-gray-900 hover:text-indigo-700 transition-colors cursor-pointer gap-4"
                >
                  <span>{faq.question}</span>
                  <ChevronDown className={`w-4 h-4 shrink-0 transition-transform ${openFaqIndex === idx ? 'rotate-180 text-indigo-600' : 'text-gray-400'}`} />
                </button>
                {openFaqIndex === idx && (
                  <p className="text-sm text-gray-600 mt-2 leading-relaxed pl-1">
                    {faq.answer}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Create Ticket Modal */}
        {isModalOpen && (
          <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-xl w-full max-w-lg space-y-5 max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between border-b border-gray-200 pb-4">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-600">
                    <MessageSquare className="w-4 h-4" />
                  </div>
                  <h2 className="text-lg font-bold text-gray-900">Contact Support</h2>
                </div>
                <button type="button" onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600 cursor-pointer">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleCreateTicket} className="space-y-4">
                {createError && (
                  <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-800">
                    {createError}
                  </div>
                )}

                <div>
                  <label className="block text-sm font-bold text-gray-800 mb-2">Topic</label>
                  <div className="grid grid-cols-2 gap-2">
                    {CATEGORY_OPTIONS.map((cat) => (
                      <button
                        key={cat.value}
                        type="button"
                        className={`p-3 rounded-lg text-sm font-semibold text-left border transition-all cursor-pointer ${
                          newCategory === cat.value
                            ? 'bg-indigo-600 text-white border-indigo-600'
                            : 'bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100'
                        }`}
                        onClick={() => { setNewCategory(cat.value); setNewSubject(cat.subjectHint); }}
                      >
                        {cat.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-bold text-gray-800 mb-1">Subject</label>
                  <input
                    type="text"
                    placeholder="Summarize your issue..."
                    className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                    value={newSubject}
                    onChange={(e) => { setNewSubject(e.target.value); if (validationErrors.subject) setValidationErrors(prev => ({ ...prev, subject: '' })); }}
                    required
                  />
                  {validationErrors.subject && (
                    <p className="text-red-600 text-xs font-semibold mt-1">{validationErrors.subject}</p>
                  )}
                </div>

                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="block text-sm font-bold text-gray-800">Description</label>
                    <span className={`text-xs font-semibold ${newDescription.length < 15 ? 'text-amber-600' : 'text-emerald-600'}`}>
                      {newDescription.length}/15 min
                    </span>
                  </div>
                  <textarea
                    placeholder="Provide details so we can help faster (minimum 15 characters)..."
                    className="w-full bg-gray-50 border border-gray-200 rounded-lg p-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 resize-none"
                    rows={4}
                    value={newDescription}
                    onChange={(e) => { setNewDescription(e.target.value); if (validationErrors.description) setValidationErrors(prev => ({ ...prev, description: '' })); }}
                    required
                    minLength={15}
                  />
                  {validationErrors.description && (
                    <p className="text-red-600 text-xs font-semibold mt-1">{validationErrors.description}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-bold text-gray-800 mb-1">Attachment (optional &middot; image or PDF, max 5MB)</label>
                  {newAttachment ? (
                    <div className="border border-gray-200 rounded-lg p-3 bg-gray-50">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-semibold text-gray-800 truncate">{newAttachment.name}</span>
                        <button
                          type="button"
                          className="text-xs font-bold text-red-600 hover:text-red-800 cursor-pointer ml-2 shrink-0"
                          onClick={() => { setNewAttachment(undefined); setAttachmentError(null); if (newAttachmentPreview) { URL.revokeObjectURL(newAttachmentPreview); setNewAttachmentPreview(null); } }}
                        >
                          Remove
                        </button>
                      </div>
                      {newAttachmentPreview && (
                        <div className="mt-2">
                          <img src={newAttachmentPreview} alt="Preview" className="max-h-36 rounded-lg border border-gray-200 object-contain" />
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="relative border border-dashed border-gray-300 rounded-lg p-4 text-center bg-gray-50 hover:bg-gray-100 transition-colors">
                      <input
                        type="file"
                        accept=".jpeg,.jpg,.png,.webp,.pdf"
                        onChange={handleAttachmentChange}
                        className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                      />
                      <div className="flex flex-col items-center justify-center gap-1">
                        <Upload className="w-5 h-5 text-gray-500" />
                        <span className="text-sm font-semibold text-gray-600">Click to upload screenshot or file</span>
                      </div>
                    </div>
                  )}
                  {attachmentError && (
                    <p className="text-red-600 text-xs font-semibold mt-1">{attachmentError}</p>
                  )}
                </div>

                <div className="flex justify-end gap-2 pt-3 border-t border-gray-200">
                  <button
                    type="button"
                    className="px-4 py-2 rounded-lg bg-gray-100 text-gray-700 text-sm font-bold cursor-pointer hover:bg-gray-200"
                    onClick={() => setIsModalOpen(false)}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                    disabled={submitLoading}
                  >
                    {submitLoading ? 'Sending...' : 'Send Request'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

      </div>
    </main>
  );
}
