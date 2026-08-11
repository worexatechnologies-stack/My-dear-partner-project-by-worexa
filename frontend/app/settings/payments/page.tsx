'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  CreditCard, Calendar, Download, RefreshCw, AlertCircle, 
  CheckCircle, ArrowLeft, Loader2, Info, Receipt, HelpCircle, X
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { 
  useGetPaymentHistoryQuery, 
  useRequestRefundMutation 
} from '@/legacy/services/membershipApi';
import { fetchApi } from '@/legacy/services/apiClient';

interface ReceiptData {
  receipt_number: string;
  payment_id: string;
  order_id: string;
  member_name: string;
  plan_name: string;
  amount: string;
  currency: string;
  payment_date: string;
  membership_start: string | null;
  membership_expiry: string | null;
  platform_details: {
    name: string;
    support_email: string;
  };
}

export default function PaymentHistoryPage() {
  const router = useRouter();
  const { data: history = [], isLoading, error, refetch } = useGetPaymentHistoryQuery();
  const [requestRefund, { isLoading: isRefunding }] = useRequestRefundMutation();

  // Receipt Modal State
  const [selectedReceipt, setSelectedReceipt] = useState<ReceiptData | null>(null);
  const [loadingReceiptId, setLoadingReceiptId] = useState<string | null>(null);

  // Refund Dialog State
  const [refundOrder, setRefundOrder] = useState<any | null>(null);
  const [refundReason, setRefundReason] = useState('billing_issue');
  const [refundDetails, setRefundDetails] = useState('');
  const [refundError, setRefundError] = useState('');
  const [refundSuccess, setRefundSuccess] = useState('');

  const fetchReceipt = async (orderId: string) => {
    setLoadingReceiptId(orderId);
    try {
      // Direct raw API fetch via apiClient utility
      const res = await fetchApi<any>(`/payments/${orderId}/receipt/`);
      if (res?.data) {
        setSelectedReceipt(res.data);
      } else {
        setSelectedReceipt(res);
      }
    } catch (err: any) {
      alert('Failed to retrieve receipt. Please try again.');
    } finally {
      setLoadingReceiptId(null);
    }
  };

  const handleRefundSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!refundOrder) return;
    setRefundError('');
    setRefundSuccess('');
    try {
      await requestRefund({
        orderId: refundOrder.id,
        reason: refundReason,
        details: refundDetails
      }).unwrap();
      setRefundSuccess('Refund request submitted successfully! Pending administrator review.');
      refetch();
      setTimeout(() => {
        setRefundOrder(null);
        setRefundSuccess('');
        setRefundDetails('');
      }, 3000);
    } catch (err: any) {
      setRefundError(err?.message || 'Failed to submit refund request.');
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-950 text-white">
        <Loader2 className="w-8 h-8 animate-spin text-rose-500" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 md:p-8 font-sans">
      <div className="max-w-5xl mx-auto">
        {/* Navigation & Title */}
        <div className="flex items-center gap-3 mb-8">
          <button 
            onClick={() => router.back()}
            className="p-2.5 bg-slate-900 border border-slate-800 rounded-xl hover:bg-slate-850 transition"
          >
            <ArrowLeft className="w-5 h-5 text-slate-400" />
          </button>
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent">
              Payment History
            </h1>
            <p className="text-sm text-slate-400">View, download receipts, and manage your premium billing.</p>
          </div>
        </div>

        {/* Info Banner */}
        <div className="bg-rose-500/10 border border-rose-500/25 rounded-2xl p-4 mb-6 flex items-start gap-3">
          <Info className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
          <div className="text-sm text-rose-300">
            <span className="font-semibold">Refund Policy:</span> Matrimony plans are eligible for full refunds within 14 days of purchase, provided no search quota has been consumed. Refund requests take 3-5 business days to process.
          </div>
        </div>

        {/* Payments list */}
        {history.length === 0 ? (
          <div className="bg-slate-900 border border-slate-800/80 rounded-2xl p-12 text-center text-slate-400">
            <CreditCard className="w-12 h-12 text-slate-650 mx-auto mb-4" />
            <p className="text-lg font-medium text-slate-300 mb-1">No payment history found</p>
            <p className="text-sm text-slate-500">When you purchase a premium plan, it will appear here.</p>
          </div>
        ) : (
          <div className="bg-slate-900 border border-slate-800/80 rounded-2xl overflow-hidden shadow-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-800 bg-slate-900/50 text-slate-400 text-xs font-semibold uppercase tracking-wider">
                    <th className="px-6 py-4">Plan Name</th>
                    <th className="px-6 py-4">Transaction Date</th>
                    <th className="px-6 py-4">Amount</th>
                    <th className="px-6 py-4">Status</th>
                    <th className="px-6 py-4">Payment ID</th>
                    <th className="px-6 py-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 text-sm">
                  {history.map((payment) => {
                    const canRefund = payment.status === 'active';
                    return (
                      <tr key={payment.id} className="hover:bg-slate-850/30 transition">
                        <td className="px-6 py-4 font-semibold text-white">
                          {payment.plan_name}
                        </td>
                        <td className="px-6 py-4 text-slate-350">
                          {new Date(payment.starts_at).toLocaleDateString('en-US', {
                            year: 'numeric', month: 'short', day: 'numeric'
                          })}
                        </td>
                        <td className="px-6 py-4 font-mono text-slate-200">
                          ₹{parseFloat(payment.amount).toLocaleString('en-IN')}
                        </td>
                        <td className="px-6 py-4">
                          <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium ${
                            payment.status === 'active' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
                            payment.status === 'refunded' ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20' :
                            payment.status === 'partially_refunded' ? 'bg-orange-500/10 text-orange-400 border border-orange-500/20' :
                            'bg-slate-800 text-slate-400'
                          }`}>
                            <span className="w-1.5 h-1.5 rounded-full bg-current" />
                            {payment.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 font-mono text-slate-400 text-xs">
                          {payment.payment_id || 'N/A'}
                        </td>
                        <td className="px-6 py-4 text-right space-x-2">
                          <button
                            onClick={() => fetchReceipt(payment.id)}
                            disabled={loadingReceiptId === payment.id}
                            className="inline-flex items-center gap-1 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-300 rounded-lg text-xs font-medium transition"
                          >
                            {loadingReceiptId === payment.id ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <Receipt className="w-3.5 h-3.5" />
                            )}
                            Receipt
                          </button>
                          {canRefund && (
                            <button
                              onClick={() => setRefundOrder(payment)}
                              className="inline-flex items-center gap-1 px-3 py-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 rounded-lg text-xs font-medium transition border border-rose-500/20"
                            >
                              <RefreshCw className="w-3.5 h-3.5" />
                              Refund
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* RECEIPT MODAL */}
      <AnimatePresence>
        {selectedReceipt && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-slate-900 border border-slate-800 max-w-lg w-full rounded-2xl p-6 shadow-2xl relative text-white"
            >
              <button 
                onClick={() => setSelectedReceipt(null)}
                className="absolute top-4 right-4 p-1.5 bg-slate-800 hover:bg-slate-700 rounded-full transition"
              >
                <X className="w-4 h-4" />
              </button>

              <div className="text-center mb-6">
                <Receipt className="w-10 h-10 text-rose-500 mx-auto mb-2" />
                <h2 className="text-xl font-bold">Tax Invoice / Receipt</h2>
                <p className="text-xs text-slate-400">MDP Platform Private Limited</p>
              </div>

              <div className="space-y-4 text-sm border-t border-slate-800 pt-4 mb-6">
                <div className="flex justify-between">
                  <span className="text-slate-400">Receipt No</span>
                  <span className="font-semibold font-mono text-slate-200">{selectedReceipt.receipt_number}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Payment ID</span>
                  <span className="font-mono text-slate-200">{selectedReceipt.payment_id}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Customer Name</span>
                  <span className="text-slate-200">{selectedReceipt.member_name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Plan Description</span>
                  <span className="text-slate-200 font-semibold">{selectedReceipt.plan_name} Membership</span>
                </div>
                <div className="flex justify-between border-t border-slate-800/60 pt-3">
                  <span className="text-slate-450 font-medium">Payment Date</span>
                  <span className="text-slate-300">
                    {new Date(selectedReceipt.payment_date).toLocaleDateString('en-US', {
                      year: 'numeric', month: 'long', day: 'numeric'
                    })}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-450 font-medium">Valid From</span>
                  <span className="text-slate-300">
                    {selectedReceipt.membership_start ? new Date(selectedReceipt.membership_start).toLocaleDateString() : 'N/A'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-450 font-medium">Valid Until</span>
                  <span className="text-slate-300">
                    {selectedReceipt.membership_expiry ? new Date(selectedReceipt.membership_expiry).toLocaleDateString() : 'N/A'}
                  </span>
                </div>
                <div className="flex justify-between border-t border-slate-800 pt-3 text-base">
                  <span className="font-bold text-white">Total Amount Paid</span>
                  <span className="font-bold text-rose-400 font-mono">
                    ₹{parseFloat(selectedReceipt.amount).toLocaleString('en-IN')}.00
                  </span>
                </div>
              </div>

              <div className="text-center text-xs text-slate-500 mb-6 bg-slate-850 p-3 rounded-xl">
                This is a computer-generated document. For billing inquiries, email {selectedReceipt.platform_details.support_email}.
              </div>

              <button 
                onClick={() => window.print()}
                className="w-full py-3 bg-slate-850 hover:bg-slate-800 font-medium rounded-xl flex items-center justify-center gap-2 border border-slate-700/50 transition"
              >
                <Download className="w-4 h-4" /> Print Receipt
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* REFUND MODAL */}
      <AnimatePresence>
        {refundOrder && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-slate-900 border border-slate-800 max-w-md w-full rounded-2xl p-6 shadow-2xl relative text-white"
            >
              <button 
                onClick={() => setRefundOrder(null)}
                className="absolute top-4 right-4 p-1.5 bg-slate-800 hover:bg-slate-700 rounded-full transition"
              >
                <X className="w-4 h-4" />
              </button>

              <h2 className="text-2xl font-bold mb-2 flex items-center gap-2">
                <RefreshCw className="w-6 h-6 text-rose-500" />
                Request a Refund
              </h2>
              <p className="text-sm text-slate-400 mb-6">
                You are requesting a refund for the <span className="text-white font-semibold">{refundOrder.plan_name}</span> plan purchase (₹{parseFloat(refundOrder.amount).toLocaleString('en-IN')}).
              </p>

              {refundSuccess ? (
                <div className="text-center py-4">
                  <CheckCircle className="w-12 h-12 text-emerald-400 mx-auto mb-3" />
                  <p className="text-sm font-semibold text-emerald-400">{refundSuccess}</p>
                </div>
              ) : (
                <form onSubmit={handleRefundSubmit} className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold uppercase text-slate-400 mb-1.5">
                      Reason for Refund
                    </label>
                    <select
                      value={refundReason}
                      onChange={(e) => setRefundReason(e.target.value)}
                      className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-rose-500 transition"
                    >
                      <option value="billing_issue">Billing/Transaction Issue</option>
                      <option value="accidental_purchase">Accidental Purchase</option>
                      <option value="unsatisfied_service">Unsatisfied with Premium Features</option>
                      <option value="found_partner">Found my partner elsewhere</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold uppercase text-slate-400 mb-1.5">
                      Additional Details
                    </label>
                    <textarea
                      value={refundDetails}
                      onChange={(e) => setRefundDetails(e.target.value)}
                      placeholder="Please explain in detail why you want a refund..."
                      rows={4}
                      required
                      className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-rose-500 transition resize-none"
                    />
                  </div>

                  {refundError && (
                    <div className="flex gap-2 p-3 bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl text-xs">
                      <AlertCircle className="w-4 h-4 shrink-0" />
                      <span>{refundError}</span>
                    </div>
                  )}

                  <div className="flex gap-4 pt-2">
                    <button
                      type="button"
                      onClick={() => setRefundOrder(null)}
                      className="flex-1 py-3 bg-slate-800 hover:bg-slate-750 font-medium rounded-xl transition"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={isRefunding}
                      className="flex-1 py-3 bg-rose-500 hover:bg-rose-600 disabled:opacity-50 font-medium rounded-xl transition shadow-lg shadow-rose-500/20"
                    >
                      {isRefunding ? 'Submitting...' : 'Submit Request'}
                    </button>
                  </div>
                </form>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
