'use client';

import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { CheckCircle2, XCircle, AlertCircle, Loader2, Calendar, ShieldCheck, ArrowRight } from 'lucide-react';
import { useGetPaymentOrderStatusQuery } from '@/legacy/services/membershipApi';

export default function PaymentStatusPage() {
  const params = useParams();
  const router = useRouter();
  const orderId = typeof params?.orderId === 'string' ? params.orderId : '';

  // Poll status every 3 seconds while order_status is 'created'
  const { data, error, isLoading, refetch } = useGetPaymentOrderStatusQuery(orderId, {
    pollingInterval: 3000,
    skip: !orderId,
  });

  const [stopPolling, setStopPolling] = useState(false);

  useEffect(() => {
    if (data?.order_status && data.order_status !== 'created') {
      setStopPolling(true);
    }
  }, [data]);

  // Loading state
  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-slate-950 text-white p-4">
        <Loader2 className="w-12 h-12 text-rose-500 animate-spin mb-4" />
        <p className="text-slate-400">Loading order details...</p>
      </div>
    );
  }

  // Error state
  if (error || !data) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-950 p-4">
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-2xl p-8 text-center text-white shadow-2xl"
        >
          <XCircle className="w-16 h-16 text-red-500 mx-auto mb-6" />
          <h1 className="text-2xl font-bold mb-2">Order Not Found</h1>
          <p className="text-slate-400 mb-6">We couldn't retrieve the status of this payment order. It might have expired or does not exist.</p>
          <button 
            onClick={() => router.push('/membership')}
            className="w-full py-3 bg-gradient-to-r from-rose-500 to-pink-500 rounded-xl font-medium hover:opacity-90 transition"
          >
            Go to Memberships
          </button>
        </motion.div>
      </div>
    );
  }

  const isSuccess = data.order_status === 'paid' || data.order_status === 'captured';
  const isFailed = data.order_status === 'failed' || data.order_status === 'cancelled' || data.order_status === 'expired';
  const isPending = data.order_status === 'created';

  return (
    <div className="flex items-center justify-center min-h-screen bg-slate-950 p-4 font-sans text-white">
      <motion.div 
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="max-w-lg w-full bg-slate-900 border border-slate-800/80 rounded-3xl p-8 relative overflow-hidden shadow-2xl"
      >
        {/* Visual background accents */}
        <div className="absolute top-0 right-0 w-48 h-48 bg-rose-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-pink-500/10 rounded-full blur-3xl pointer-events-none" />

        {isSuccess && (
          <div className="text-center">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', stiffness: 200, damping: 15 }}
            >
              <CheckCircle2 className="w-20 h-20 text-emerald-400 mx-auto mb-6 drop-shadow-[0_0_15px_rgba(52,211,153,0.3)]" />
            </motion.div>
            <h1 className="text-3xl font-extrabold mb-3 tracking-tight bg-gradient-to-r from-emerald-400 to-teal-300 bg-clip-text text-transparent">
              Payment Successful!
            </h1>
            <p className="text-slate-400 mb-8 max-w-sm mx-auto leading-relaxed">
              Your transaction is verified. Welcome to Premium! Your benefits are activated immediately.
            </p>

            <div className="bg-slate-800/40 border border-slate-700/30 rounded-2xl p-5 mb-8 text-left space-y-3">
              <div className="flex justify-between items-center text-sm border-b border-slate-800 pb-3">
                <span className="text-slate-400">Order ID</span>
                <span className="font-mono text-slate-200 text-xs">{orderId}</span>
              </div>
              <div className="flex justify-between items-center text-sm border-b border-slate-800 pb-3">
                <span className="text-slate-400">Membership Status</span>
                <span className="text-emerald-400 font-semibold flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4" /> Active
                </span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-slate-400">Payment status</span>
                <span className="text-slate-200 font-medium capitalize">{data.payment_status || 'Captured'}</span>
              </div>
            </div>

            <button 
              onClick={() => router.push('/dashboard')}
              className="w-full py-4 bg-gradient-to-r from-emerald-500 to-teal-500 rounded-2xl font-semibold flex items-center justify-center gap-2 hover:opacity-95 transition shadow-lg shadow-emerald-500/20"
            >
              Go to Dashboard <ArrowRight className="w-5 h-5" />
            </button>
          </div>
        )}

        {isFailed && (
          <div className="text-center">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', stiffness: 200, damping: 15 }}
            >
              <XCircle className="w-20 h-20 text-rose-500 mx-auto mb-6 drop-shadow-[0_0_15px_rgba(244,63,94,0.3)]" />
            </motion.div>
            <h1 className="text-3xl font-extrabold mb-3 tracking-tight text-rose-500">
              Payment Failed
            </h1>
            <p className="text-slate-400 mb-8 max-w-sm mx-auto leading-relaxed">
              We couldn't confirm this payment. If your money was deducted, it will be automatically refunded by your bank.
            </p>

            <div className="bg-slate-800/40 border border-slate-700/30 rounded-2xl p-5 mb-8 text-left space-y-3">
              <div className="flex justify-between items-center text-sm border-b border-slate-800 pb-3">
                <span className="text-slate-400">Order ID</span>
                <span className="font-mono text-slate-200 text-xs">{orderId}</span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-slate-400">Reason</span>
                <span className="text-rose-400 font-medium capitalize">{data.order_status}</span>
              </div>
            </div>

            <div className="flex gap-4">
              <button 
                onClick={() => router.push('/membership')}
                className="flex-1 py-4 bg-slate-800 hover:bg-slate-700 rounded-2xl font-semibold transition"
              >
                Back
              </button>
              <button 
                onClick={() => router.push('/membership')}
                className="flex-1 py-4 bg-gradient-to-r from-rose-500 to-pink-500 rounded-2xl font-semibold hover:opacity-95 transition shadow-lg shadow-rose-500/20"
              >
                Retry Checkout
              </button>
            </div>
          </div>
        )}

        {isPending && (
          <div className="text-center py-6">
            <Loader2 className="w-16 h-16 text-rose-500 animate-spin mx-auto mb-6" />
            <h1 className="text-2xl font-bold mb-3">Verifying Payment</h1>
            <p className="text-slate-400 mb-6 leading-relaxed max-w-sm mx-auto">
              Please do not close this window or hit back. We are checking the transaction status with Razorpay.
            </p>
            <div className="inline-flex items-center gap-1.5 px-4 py-2 bg-slate-800/50 border border-slate-700/30 rounded-full text-xs text-rose-400 font-medium">
              <AlertCircle className="w-3.5 h-3.5" /> Automatically checking...
            </div>
          </div>
        )}
      </motion.div>
    </div>
  );
}
