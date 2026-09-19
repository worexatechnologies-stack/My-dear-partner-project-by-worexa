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
          className="max-h-48 rounded-xl border border-[#efefef] shadow-xs object-cover group-hover:opacity-90 transition-opacity"
        />
        <span className="text-[10px] font-bold text-[#8e8e8e] mt-1 flex items-center gap-1 group-hover:text-[#e11d48] transition-colors">
          <ImageIcon className="w-3 h-3" strokeWidth={1.85} /> {filename || 'View image'}
        </span>
      </a>
    );
  }
  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      className="mt-2.5 inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[#f7f4f5] hover:bg-[#efe8ec] border border-[#efefef] text-xs font-bold text-[#443c40] hover:text-[#e11d48] transition-colors"
    >
      {/\.pdf$/i.test(filename || url) ? <FileText className="w-4 h-4" strokeWidth={1.85} /> : <Download className="w-4 h-4" strokeWidth={1.85} />}
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
  OPEN: 'bg-rose-50 text-[#e11d48] border border-rose-200 font-semibold',
  IN_PROGRESS: 'bg-amber-50 text-amber-700 border border-amber-200 font-semibold',
  WAITING_FOR_MEMBER: 'bg-purple-50 text-purple-700 border border-purple-200 font-semibold',
  WAITING_FOR_USER: 'bg-purple-50 text-purple-700 border border-purple-200 font-semibold',
  RESOLVED: 'bg-emerald-50 text-emerald-700 border border-emerald-200 font-semibold',
  CLOSED: 'bg-gray-100 text-gray-700 border border-gray-200 font-semibold',
  REOPENED: 'bg-rose-50 text-[#e11d48] border border-rose-200 font-semibold',
};

const PRIORITY_COLORS: Record<string, string> = {
  LOW: 'bg-gray-100 text-gray-700 border border-gray-200 font-semibold',
  NORMAL: 'bg-rose-50 text-[#e11d48] border border-rose-200 font-semibold',
  HIGH: 'bg-orange-50 text-orange-700 border border-orange-200 font-semibold',
  URGENT: 'bg-red-50 text-red-700 border border-red-200 font-semibold',
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
    <main className="min-h-[100svh] bg-[var(--color-app-bg)] pt-24 pb-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">

        {/* Hero Header Card */}
        <div className="relative overflow-hidden rounded-3xl border border-[#efefef] bg-white p-6 sm:p-8 lg:p-10 shadow-[0_2px_12px_rgba(0,0,0,0.03)]">
          {/* Soft ambient glow matching sidebar rose #e11d48 */}
          <div className="pointer-events-none absolute -top-20 -right-20 h-64 w-64 rounded-full bg-rose-100/50 blur-3xl" />

          <div className="relative flex flex-col md:flex-row md:items-center md:justify-between gap-6">
            <div className="space-y-2">
              <div className="inline-flex items-center gap-2 rounded-full border border-rose-200 bg-[#fff1f2] px-3.5 py-1 text-xs font-bold text-[#e11d48]">
                <Headphones className="w-3.5 h-3.5" strokeWidth={2.2} />
                <span>Help & Support Center</span>
              </div>
              <h1 className="font-display text-2xl sm:text-3xl lg:text-4xl font-black tracking-tight text-[#0f0f10]">
                How can we assist you today?
              </h1>
              <p className="max-w-xl text-sm leading-6 text-[#737373]">
                Search for instant answers, browse topics below, or connect directly with our member care team.
              </p>
            </div>

            <button
              type="button"
              className="inline-flex shrink-0 items-center justify-center gap-2 rounded-2xl bg-[#e11d48] hover:bg-[#be123c] px-6 py-3.5 text-sm font-bold text-white shadow-lg shadow-rose-500/25 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-xl hover:shadow-rose-500/35 active:scale-[0.98] cursor-pointer"
              onClick={() => openCreateModal('GENERAL')}
            >
              <Plus className="w-4 h-4" strokeWidth={2.5} /> New Support Request
            </button>
          </div>

          {/* Integrated Search Bar inside Hero */}
          <div className="relative mt-6 max-w-2xl">
            <div className="relative flex items-center">
              <Search className="w-4 h-4 text-[#737373] absolute left-4 pointer-events-none" strokeWidth={2} />
              <input
                type="text"
                placeholder="Search inquiries, tickets, or topics..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full h-12 bg-[#f7f4f5] hover:bg-[#f2eff0] focus:bg-white border border-[#efefef] focus:border-[#e11d48] focus:ring-4 focus:ring-[#e11d48]/10 text-[#0f0f10] placeholder-[#8e8e8e] pl-11 pr-10 rounded-2xl text-sm font-medium transition-all duration-200 outline-none shadow-xs"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3.5 text-[#8e8e8e] hover:text-[#0f0f10] cursor-pointer p-1"
                >
                  <X className="w-3.5 h-3.5" strokeWidth={2.2} />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Topic Categories Section */}
        <div className="space-y-3">
          <div className="flex items-center justify-between px-1">
            <h2 className="text-xs font-bold uppercase tracking-wider text-[#a8a29e]">Browse Help Topics</h2>
            <span className="text-xs text-[#737373]">Click a topic to submit a request</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {CATEGORY_OPTIONS.map((category) => {
              const CategoryIcon = category.icon;
              return (
                <button
                  type="button"
                  key={category.value}
                  onClick={() => openCreateModal(category.value)}
                  className="group relative flex cursor-pointer items-center justify-between rounded-2xl border border-[#efefef] bg-white p-5 text-left shadow-[0_1px_3px_rgba(0,0,0,0.03)] hover:border-rose-300 hover:shadow-lg hover:shadow-rose-500/8 hover:-translate-y-1 transition-all duration-200"
                >
                  <div className="flex items-center gap-4 min-w-0">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-[#efefef] bg-[#f7f4f5] text-[#262626] transition-all duration-200 group-hover:border-rose-200 group-hover:bg-[#fff1f2] group-hover:text-[#e11d48] group-hover:scale-105 group-hover:shadow-md group-hover:shadow-rose-500/10">
                      <CategoryIcon className="w-5 h-5 transition-transform duration-200 ease-out group-hover:scale-110" strokeWidth={1.85} />
                    </div>
                    <div className="min-w-0">
                      <strong className="block text-sm font-bold text-[#0f0f10] transition-colors group-hover:text-[#e11d48] truncate">
                        {category.label}
                      </strong>
                      <span className="block text-xs text-[#737373] mt-0.5 leading-snug line-clamp-1">
                        {category.blurb}
                      </span>
                    </div>
                  </div>
                  <div className="ml-3 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#f7f4f5] text-[#8e8e8e] transition-all duration-200 group-hover:bg-[#fff1f2] group-hover:text-[#e11d48] group-hover:translate-x-0.5">
                    <ChevronRight className="h-4 w-4" strokeWidth={2.2} />
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Error Alert */}
        {errorMsg && (
          <div className="rounded-2xl border border-red-200 bg-red-50/90 px-5 py-4 text-sm font-semibold text-red-800 shadow-sm flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 text-red-600" strokeWidth={1.85} />
              <span>{errorMsg}</span>
            </div>
            <button type="button" className="text-xs font-bold underline cursor-pointer shrink-0 hover:text-red-900" onClick={() => setErrorMsg(null)}>Dismiss</button>
          </div>
        )}

        {/* Status Filter Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 rounded-2xl border border-[#efefef] bg-white p-3.5 shadow-[0_1px_3px_rgba(0,0,0,0.03)]">
          <div className="flex flex-wrap items-center gap-1.5">
            {statusTabs.map((tab) => {
              const isActive = statusFilter === tab.value;
              return (
                <button
                  key={tab.value}
                  type="button"
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition-all duration-150 cursor-pointer ${
                    isActive
                      ? 'bg-[#e11d48] text-white shadow-md shadow-rose-500/25'
                      : 'bg-[#f7f4f5] text-[#443c40] hover:bg-[#efe8ec] border border-[#efefef]'
                  }`}
                  onClick={() => setStatusFilter(tab.value)}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>
          <div className="flex items-center gap-2">
            <select
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
              className="bg-[#f7f4f5] border border-[#efefef] text-[#443c40] px-3.5 py-2 rounded-xl text-xs font-bold cursor-pointer transition-all focus:outline-none focus:bg-white focus:border-[#e11d48] focus:ring-2 focus:ring-[#e11d48]/15"
            >
              <option value="">All Priorities</option>
              <option value="LOW">Low Priority</option>
              <option value="NORMAL">Normal Priority</option>
              <option value="HIGH">High Priority</option>
              <option value="URGENT">Urgent Priority</option>
            </select>
          </div>
        </div>

        {/* Main Workspace */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">

          {/* Left: Ticket List */}
          <div className={`lg:col-span-5 ${activeMobileTab === 'detail' ? 'hidden lg:block' : 'block'}`}>
            <div className="rounded-2xl border border-[#efefef] bg-white shadow-[0_1px_3px_rgba(0,0,0,0.03)] overflow-hidden">
              <div className="px-5 py-4 bg-[#fbf9fa] border-b border-[#efefef] flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <h2 className="text-xs font-bold uppercase tracking-wider text-[#443c40]">Your Inquiries</h2>
                </div>
                <span className="px-2.5 py-0.5 rounded-full bg-[#fff1f2] border border-rose-200 text-[#e11d48] text-xs font-bold">
                  {filteredTickets.length}
                </span>
              </div>
              <div className="divide-y divide-[#efefef] max-h-[600px] overflow-y-auto">
                {loading ? (
                  <div className="p-8 text-center">
                    <div className="animate-pulse space-y-3">
                      {[...Array(3)].map((_, i) => (
                        <div key={i} className="h-20 bg-[#f7f4f5] rounded-xl" />
                      ))}
                    </div>
                  </div>
                ) : filteredTickets.length === 0 ? (
                  <div className="p-10 text-center">
                    <div className="w-12 h-12 rounded-2xl bg-[#fff1f2] border border-rose-200 text-[#e11d48] flex items-center justify-center mx-auto mb-3">
                      <FileText className="w-6 h-6" strokeWidth={1.85} />
                    </div>
                    <h3 className="text-sm font-bold text-[#0f0f10]">No requests found</h3>
                    <p className="text-xs text-[#737373] mt-1 mb-4 max-w-xs mx-auto">
                      {tickets.length === 0
                        ? "You haven't contacted support yet."
                        : "No requests match your current filters."}
                    </p>
                    <button
                      type="button"
                      className="px-4 py-2 rounded-xl bg-[#f7f4f5] text-[#443c40] border border-[#efefef] text-xs font-bold cursor-pointer hover:bg-[#efe8ec] transition-colors"
                      onClick={() => { setSearchQuery(''); setStatusFilter(''); setPriorityFilter(''); }}
                    >
                      Clear filters
                    </button>
                  </div>
                ) : (
                  filteredTickets.map((ticket) => {
                    const isSelected = selectedTicket?.id === ticket.id;
                    return (
                      <button
                        type="button"
                        key={ticket.id}
                        onClick={() => handleSelectTicket(ticket)}
                        className={`w-full p-4 sm:p-5 text-left transition-all cursor-pointer border-l-4 ${
                          isSelected
                            ? 'bg-[#fff1f2]/60 border-l-[#e11d48]'
                            : 'hover:bg-[#fbf9fa] border-l-transparent'
                        }`}
                      >
                        <div className="flex justify-between items-center mb-1.5">
                          <span className="font-bold text-[#e11d48] text-xs">#{ticket.ticket_number}</span>
                          <span className="text-[11px] text-[#8e8e8e] font-medium">{formatDate(ticket.created_at)}</span>
                        </div>
                        <h3 className="font-bold text-sm text-[#0f0f10] line-clamp-1 mb-2.5">{ticket.subject}</h3>
                        <div className="flex flex-wrap gap-1.5 text-[11px] font-semibold">
                          <span className={`px-2 py-0.5 rounded-lg ${STATUS_COLORS[ticket.status] || 'bg-gray-100 text-gray-700'}`}>
                            {(ticket.status || '').replace(/_/g, ' ')}
                          </span>
                          <span className={`px-2 py-0.5 rounded-lg ${PRIORITY_COLORS[ticket.priority] || 'bg-gray-100 text-gray-700'}`}>
                            {ticket.priority}
                          </span>
                          <span className="px-2 py-0.5 rounded-lg bg-[#f7f4f5] border border-[#efefef] text-[#443c40]">
                            {(ticket.category || '').replace(/_/g, ' ')}
                          </span>
                        </div>
                      </button>
                    );
                  })
                )}
                {totalPages > 1 && (
                  <div className="flex items-center justify-center gap-2 p-4 border-t border-[#efefef] bg-[#fbf9fa]">
                    <button onClick={() => loadTickets(ticketPage - 1)} disabled={ticketPage <= 1}
                      className="px-3 py-1.5 rounded-xl bg-[#fff1f2] border border-rose-200 text-[#e11d48] text-xs font-bold disabled:opacity-40 hover:bg-[#ffe4e6] transition-colors">
                      Previous
                    </button>
                    <span className="text-xs text-[#737373] font-medium">Page {ticketPage} of {totalPages}</span>
                    <button onClick={() => loadTickets(ticketPage + 1)} disabled={ticketPage >= totalPages}
                      className="px-3 py-1.5 rounded-xl bg-[#fff1f2] border border-rose-200 text-[#e11d48] text-xs font-bold disabled:opacity-40 hover:bg-[#ffe4e6] transition-colors">
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
              <div className="bg-white rounded-2xl border border-[#efefef] p-12 text-center shadow-[0_1px_3px_rgba(0,0,0,0.03)]">
                <div className="animate-pulse space-y-4">
                  <div className="h-6 bg-[#f7f4f5] rounded-xl w-1/3 mx-auto" />
                  <div className="h-4 bg-[#f7f4f5] rounded-xl w-2/3 mx-auto" />
                  <div className="h-32 bg-[#f7f4f5] rounded-2xl" />
                </div>
              </div>
            ) : selectedTicket ? (
              <div className="rounded-2xl border border-[#efefef] bg-white shadow-[0_1px_3px_rgba(0,0,0,0.03)] overflow-hidden flex flex-col min-h-[520px]">

                {/* Mobile Back */}
                <div className="p-3 bg-[#fbf9fa] border-b border-[#efefef] lg:hidden">
                  <button
                    type="button"
                    onClick={() => setActiveMobileTab('list')}
                    className="inline-flex items-center gap-1.5 text-xs font-bold text-[#e11d48] cursor-pointer"
                  >
                    <ArrowLeft className="w-4 h-4" strokeWidth={2} /> Back to conversations
                  </button>
                </div>

                {/* Detail Header */}
                <div className="px-5 sm:px-6 py-4 bg-[#fbf9fa] border-b border-[#efefef]">
                  <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-2">
                    <div className="min-w-0">
                      <span className="text-xs font-bold text-[#e11d48] uppercase tracking-wider">
                        #{selectedTicket.ticket_number} &middot; <span className="text-[#8e8e8e] font-normal">{formatDate(selectedTicket.created_at)}</span>
                      </span>
                      <h2 className="text-lg sm:text-xl font-black text-[#0f0f10] mt-0.5 break-words">{selectedTicket.subject}</h2>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1.5 text-xs font-semibold mt-2.5">
                    <span className={`px-2.5 py-0.5 rounded-lg ${STATUS_COLORS[selectedTicket.status] || 'bg-gray-100 text-gray-700'}`}>
                      {(selectedTicket.status || '').replace(/_/g, ' ')}
                    </span>
                    <span className={`px-2.5 py-0.5 rounded-lg ${PRIORITY_COLORS[selectedTicket.priority] || 'bg-gray-100 text-gray-700'}`}>
                      {selectedTicket.priority}
                    </span>
                    <span className="px-2.5 py-0.5 rounded-lg bg-[#f7f4f5] border border-[#efefef] text-[#443c40]">
                      {(selectedTicket.category || '').replace(/_/g, ' ')}
                    </span>
                  </div>
                </div>

                {/* Conversation Body */}
                <div ref={chatBoxRef} className="flex-1 overflow-y-auto max-h-[450px] px-5 sm:px-6 py-5 space-y-4">
                  {/* Original Request */}
                  <div className="p-4 sm:p-5 rounded-2xl bg-[#fff8fa] border border-rose-100">
                    <div className="flex justify-between items-center text-[11px] font-bold text-[#e11d48] uppercase tracking-wider mb-2 border-b border-rose-100 pb-2">
                      <span>Original Request</span>
                      <span className="text-[#8e8e8e] font-normal">{formatTime(selectedTicket.created_at)}</span>
                    </div>
                    <p className="text-sm text-[#0f0f10] leading-relaxed">{(selectedTicket as any).description || selectedTicket.message}</p>
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
                        <div className={`flex gap-2.5 max-w-[88%] sm:max-w-[78%] ${isUserSender ? 'flex-row-reverse' : 'flex-row'}`}>
                          {!isUserSender && (
                            <div className="w-8 h-8 rounded-full bg-[#fff1f2] border border-rose-200 text-[#e11d48] flex items-center justify-center shrink-0 mt-1">
                              <Headphones className="w-4 h-4" strokeWidth={1.85} />
                            </div>
                          )}
                          <div className={`rounded-2xl px-4 py-3 shadow-xs ${
                            isUserSender
                              ? 'bg-[#e11d48] text-white rounded-br-sm'
                              : 'bg-[#f7f4f5] border border-[#efefef] text-[#0f0f10] rounded-bl-sm'
                          }`}>
                            <div className={`text-[11px] font-bold mb-1.5 flex items-center justify-between gap-3 ${
                              isUserSender ? 'text-rose-100' : 'text-[#737373]'
                            }`}>
                              <span>{senderName}</span>
                              <span className="font-normal">{formatTime(reply.created_at)}</span>
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
                <div className="px-5 sm:px-6 py-4 bg-[#fbf9fa] border-t border-[#efefef]">
                  {selectedTicket.status === 'RESOLVED' || selectedTicket.status === 'CLOSED' ? (
                    <div className="text-center py-3">
                      <p className="text-[#0f0f10] font-bold text-sm mb-2">
                        {selectedTicket.status === 'CLOSED' ? 'This support request is closed.' : 'This request has been resolved.'}
                      </p>
                      <button
                        type="button"
                        className="px-5 py-2.5 rounded-xl bg-white border border-[#efefef] text-[#0f0f10] text-xs font-bold cursor-pointer hover:bg-[#f7f4f5] transition-colors"
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
                        className="w-full bg-white border border-[#efefef] rounded-xl p-3.5 text-sm text-[#0f0f10] placeholder-[#8e8e8e] focus:outline-none focus:border-[#e11d48] focus:ring-2 focus:ring-[#e11d48]/15 resize-none transition-all"
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
                            className="inline-flex items-center gap-1.5 text-xs font-bold text-[#443c40] hover:text-[#e11d48] cursor-pointer transition-colors"
                            onClick={() => fileInputRef.current?.click()}
                          >
                            <Paperclip className="w-4 h-4" strokeWidth={1.85} />
                            {replyAttachment ? replyAttachment.name : 'Attach file'}
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
                          className="px-5 py-2.5 rounded-xl bg-[#e11d48] hover:bg-[#be123c] text-white text-xs font-bold flex items-center gap-1.5 shadow-sm shadow-rose-500/20 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                          disabled={submitLoading || !replyMessage.trim()}
                        >
                          {submitLoading ? 'Sending...' : (<><Send className="w-3.5 h-3.5" strokeWidth={2} /> Send</>)}
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
                  <div className="px-5 sm:px-6 py-4 bg-[#fbf9fa] border-t border-[#efefef]">
                    <div className="bg-white rounded-2xl border border-[#efefef] p-4 shadow-xs">
                      <p className="text-sm font-bold text-[#0f0f10] mb-3">How was our support?</p>
                      <div className="flex gap-1 mb-3">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <button
                            key={star}
                            type="button"
                            className={`p-1 cursor-pointer transition-colors ${star <= feedbackRating ? 'text-amber-400' : 'text-gray-200'}`}
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
                        className="w-full bg-[#f7f4f5] border border-[#efefef] rounded-xl p-2.5 text-sm text-[#0f0f10] focus:outline-none focus:bg-white focus:border-[#e11d48] focus:ring-2 focus:ring-[#e11d48]/15 resize-none mb-2"
                        rows={2}
                      />
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          className="px-4 py-2 rounded-xl bg-[#e11d48] hover:bg-[#be123c] text-white text-xs font-bold cursor-pointer transition-all shadow-sm"
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
              <div className="bg-white rounded-2xl border border-[#efefef] p-12 text-center shadow-[0_1px_3px_rgba(0,0,0,0.03)] h-full flex flex-col items-center justify-center min-h-[400px]">
                <div className="w-16 h-16 rounded-3xl bg-[#fff1f2] border border-rose-200 flex items-center justify-center text-[#e11d48] mb-4">
                  <Headphones className="w-8 h-8" strokeWidth={1.85} />
                </div>
                <h2 className="text-lg font-bold text-[#0f0f10]">Select a conversation</h2>
                <p className="text-xs text-[#737373] mt-1 max-w-sm">
                  Choose a support request from the list or start a new request using the topics above.
                </p>
              </div>
            )}
          </div>

        </div>

        {/* FAQ Section */}
        <div className="rounded-2xl border border-[#efefef] bg-white p-6 sm:p-8 shadow-[0_1px_3px_rgba(0,0,0,0.03)] space-y-4">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-[#fff1f2] border border-rose-200 flex items-center justify-center text-[#e11d48]">
              <ShieldCheck className="w-4 h-4" strokeWidth={1.85} />
            </div>
            <h2 className="text-lg font-bold text-[#0f0f10]">Frequently Asked Questions</h2>
          </div>
          <div className="divide-y divide-[#efefef]">
            {FAQ_ITEMS.map((faq, idx) => (
              <div key={idx} className="py-4">
                <button
                  type="button"
                  onClick={() => setOpenFaqIndex(openFaqIndex === idx ? null : idx)}
                  className="w-full flex items-center justify-between text-left font-bold text-sm text-[#0f0f10] hover:text-[#e11d48] transition-colors cursor-pointer gap-4"
                >
                  <span>{faq.question}</span>
                  <ChevronDown className={`w-4 h-4 shrink-0 transition-transform duration-200 ${openFaqIndex === idx ? 'rotate-180 text-[#e11d48]' : 'text-[#8e8e8e]'}`} strokeWidth={2} />
                </button>
                {openFaqIndex === idx && (
                  <p className="text-xs sm:text-sm text-[#525252] mt-2.5 leading-relaxed p-4 rounded-xl bg-[#fff8fa] border border-rose-100/60">
                    {faq.answer}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Create Ticket Modal */}
        {isModalOpen && (
          <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
            <div className="bg-white rounded-3xl border border-[#efefef] p-6 sm:p-7 w-full max-w-lg space-y-5 max-h-[90vh] overflow-y-auto shadow-2xl">
              <div className="flex items-center justify-between border-b border-[#efefef] pb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-[#fff1f2] border border-rose-200 flex items-center justify-center text-[#e11d48]">
                    <MessageSquare className="w-5 h-5" strokeWidth={1.85} />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-[#0f0f10]">Contact Support</h2>
                    <p className="text-xs text-[#737373]">Our team will get back to you shortly</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="w-8 h-8 rounded-full bg-[#f7f4f5] flex items-center justify-center text-[#737373] hover:text-[#0f0f10] hover:bg-[#efe8ec] transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" strokeWidth={2} />
                </button>
              </div>

              <form onSubmit={handleCreateTicket} className="space-y-4">
                {createError && (
                  <div className="rounded-xl border border-red-200 bg-red-50 p-3.5 text-xs font-semibold text-red-800">
                    {createError}
                  </div>
                )}

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-[#443c40] mb-2">Select Topic</label>
                  <div className="grid grid-cols-2 gap-2">
                    {CATEGORY_OPTIONS.map((cat) => {
                      const isSelected = newCategory === cat.value;
                      const CatIcon = cat.icon;
                      return (
                        <button
                          key={cat.value}
                          type="button"
                          className={`p-3 rounded-xl text-xs font-bold text-left border transition-all cursor-pointer flex items-center gap-2.5 ${
                            isSelected
                              ? 'bg-[#e11d48] text-white border-[#e11d48] shadow-md shadow-rose-500/25'
                              : 'bg-[#f7f4f5] text-[#443c40] border-[#efefef] hover:bg-[#efe8ec]'
                          }`}
                          onClick={() => { setNewCategory(cat.value); setNewSubject(cat.subjectHint); }}
                        >
                          <CatIcon className={`w-4 h-4 shrink-0 ${isSelected ? 'text-white' : 'text-[#e11d48]'}`} strokeWidth={1.85} />
                          <span className="truncate">{cat.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-[#443c40] mb-1.5">Subject</label>
                  <input
                    type="text"
                    placeholder="Summarize your issue..."
                    className="w-full bg-[#f7f4f5] border border-[#efefef] rounded-xl px-3.5 py-2.5 text-sm text-[#0f0f10] placeholder-[#8e8e8e] focus:outline-none focus:bg-white focus:border-[#e11d48] focus:ring-2 focus:ring-[#e11d48]/15 transition-all"
                    value={newSubject}
                    onChange={(e) => { setNewSubject(e.target.value); if (validationErrors.subject) setValidationErrors(prev => ({ ...prev, subject: '' })); }}
                    required
                  />
                  {validationErrors.subject && (
                    <p className="text-red-600 text-xs font-semibold mt-1">{validationErrors.subject}</p>
                  )}
                </div>

                <div>
                  <div className="flex justify-between items-center mb-1.5">
                    <label className="block text-xs font-bold uppercase tracking-wider text-[#443c40]">Description</label>
                    <span className={`text-[11px] font-bold ${newDescription.length < 15 ? 'text-amber-600' : 'text-emerald-600'}`}>
                      {newDescription.length}/15 min
                    </span>
                  </div>
                  <textarea
                    placeholder="Provide details so we can help faster (minimum 15 characters)..."
                    className="w-full bg-[#f7f4f5] border border-[#efefef] rounded-xl p-3.5 text-sm text-[#0f0f10] placeholder-[#8e8e8e] focus:outline-none focus:bg-white focus:border-[#e11d48] focus:ring-2 focus:ring-[#e11d48]/15 resize-none transition-all"
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
                  <label className="block text-xs font-bold uppercase tracking-wider text-[#443c40] mb-1.5">Attachment (optional &middot; image or PDF, max 5MB)</label>
                  {newAttachment ? (
                    <div className="border border-rose-100 rounded-2xl p-3.5 bg-[#fff8fa]">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-[#0f0f10] truncate">{newAttachment.name}</span>
                        <button
                          type="button"
                          className="text-xs font-bold text-red-600 hover:text-red-800 cursor-pointer ml-2 shrink-0"
                          onClick={() => { setNewAttachment(undefined); setAttachmentError(null); if (newAttachmentPreview) { URL.revokeObjectURL(newAttachmentPreview); setNewAttachmentPreview(null); } }}
                        >
                          Remove
                        </button>
                      </div>
                      {newAttachmentPreview && (
                        <div className="mt-2.5">
                          <img src={newAttachmentPreview} alt="Preview" className="max-h-36 rounded-xl border border-rose-100 object-contain" />
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="relative border-2 border-dashed border-[#efefef] hover:border-rose-200 rounded-2xl p-5 text-center bg-[#fbf9fa] hover:bg-[#fff8fa] transition-all cursor-pointer">
                      <input
                        type="file"
                        accept=".jpeg,.jpg,.png,.webp,.pdf"
                        onChange={handleAttachmentChange}
                        className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                      />
                      <div className="flex flex-col items-center justify-center gap-1.5">
                        <div className="w-8 h-8 rounded-full bg-[#fff1f2] text-[#e11d48] flex items-center justify-center">
                          <Upload className="w-4 h-4" strokeWidth={1.85} />
                        </div>
                        <span className="text-xs font-bold text-[#443c40]">Click to upload screenshot or document</span>
                        <span className="text-[10px] text-[#8e8e8e]">PNG, JPG, WEBP, or PDF up to 5MB</span>
                      </div>
                    </div>
                  )}
                  {attachmentError && (
                    <p className="text-red-600 text-xs font-semibold mt-1">{attachmentError}</p>
                  )}
                </div>

                <div className="flex justify-end gap-2.5 pt-3 border-t border-[#efefef]">
                  <button
                    type="button"
                    className="px-4 py-2.5 rounded-xl bg-[#f7f4f5] text-[#443c40] text-xs font-bold cursor-pointer hover:bg-[#efe8ec] transition-colors"
                    onClick={() => setIsModalOpen(false)}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-6 py-2.5 rounded-xl bg-[#e11d48] hover:bg-[#be123c] text-white text-xs font-bold cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-rose-500/25 transition-all"
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
