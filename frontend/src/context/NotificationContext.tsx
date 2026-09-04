import React, { createContext, useContext, useState, useCallback } from 'react';
import { CheckCircle, AlertTriangle, XCircle, Info, X } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface Toast {
  id: string;
  type: ToastType;
  title?: string;
  message: string;
}

interface ConfirmDialogOptions {
  title?: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  isDestructive?: boolean;
}

interface NotificationContextType {
  showToast: (message: string, type?: ToastType, title?: string) => void;
  showSuccess: (message: string, title?: string) => void;
  showError: (message: string, title?: string) => void;
  showWarning: (message: string, title?: string) => void;
  showInfo: (message: string, title?: string) => void;
  confirm: (options: ConfirmDialogOptions | string) => Promise<boolean>;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [confirmState, setConfirmState] = useState<{
    isOpen: boolean;
    options: ConfirmDialogOptions;
    resolve: (value: boolean) => void;
  } | null>(null);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback((message: string, type: ToastType = 'info', title?: string) => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, type, title, message }]);
    setTimeout(() => {
      removeToast(id);
    }, 4500);
  }, [removeToast]);

  const showSuccess = useCallback((message: string, title = 'Success') => {
    showToast(message, 'success', title);
  }, [showToast]);

  const showError = useCallback((message: string, title = 'Error') => {
    showToast(message, 'error', title);
  }, [showToast]);

  const showWarning = useCallback((message: string, title = 'Attention') => {
    showToast(message, 'warning', title);
  }, [showToast]);

  const showInfo = useCallback((message: string, title = 'Information') => {
    showToast(message, 'info', title);
  }, [showToast]);

  const confirm = useCallback((optionsOrMsg: ConfirmDialogOptions | string): Promise<boolean> => {
    const options: ConfirmDialogOptions =
      typeof optionsOrMsg === 'string'
        ? { message: optionsOrMsg, title: 'Please Confirm' }
        : optionsOrMsg;

    return new Promise((resolve) => {
      setConfirmState({
        isOpen: true,
        options,
        resolve,
      });
    });
  }, []);

  const handleConfirmAction = (value: boolean) => {
    if (confirmState) {
      confirmState.resolve(value);
      setConfirmState(null);
    }
  };

  return (
    <NotificationContext.Provider
      value={{ showToast, showSuccess, showError, showWarning, showInfo, confirm }}
    >
      {children}

      {/* Floating Toast Container */}
      <div className="fixed top-5 right-5 z-[9999] flex flex-col gap-2.5 max-w-sm w-full pointer-events-none p-2 sm:p-0">
        {toasts.map((toast) => {
          let bgClass = 'bg-white border-slate-200 text-slate-800';
          let icon = <Info className="w-5 h-5 text-sky-600 shrink-0" />;

          if (toast.type === 'success') {
            bgClass = 'bg-[#F0FDF4] border-emerald-200 text-emerald-950';
            icon = <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0" />;
          } else if (toast.type === 'error') {
            bgClass = 'bg-[#FEF2F2] border-rose-200 text-rose-950';
            icon = <XCircle className="w-5 h-5 text-rose-600 shrink-0" />;
          } else if (toast.type === 'warning') {
            bgClass = 'bg-[#FFFBEB] border-amber-200 text-amber-950';
            icon = <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />;
          }

          return (
            <div
              key={toast.id}
              className={`pointer-events-auto flex items-start gap-3 p-4 rounded-2xl border shadow-lg backdrop-blur-sm transition-all animate-in slide-in-from-top-3 duration-200 ${bgClass}`}
            >
              {icon}
              <div className="flex-1 text-xs">
                {toast.title && <div className="font-bold text-sm mb-0.5">{toast.title}</div>}
                <div className="leading-relaxed">{toast.message}</div>
              </div>
              <button
                onClick={() => removeToast(toast.id)}
                className="text-slate-400 hover:text-slate-700 p-0.5 rounded-lg transition-colors cursor-pointer shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          );
        })}
      </div>

      {/* Unified Confirm Modal */}
      {confirmState && confirmState.isOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[10000] flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white w-full max-w-md rounded-3xl p-6 border border-slate-200 shadow-2xl animate-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3 mb-3">
              <div
                className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 ${
                  confirmState.options.isDestructive
                    ? 'bg-rose-50 text-rose-600'
                    : 'bg-emerald-50 text-[#0D3833]'
                }`}
              >
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  {confirmState.options.title || 'Please Confirm'}
                </h3>
                <p className="text-xs text-slate-500">Action authorization requested</p>
              </div>
            </div>

            <div className="text-xs text-slate-600 leading-relaxed my-4 bg-slate-50 p-4 rounded-2xl border border-slate-100">
              {confirmState.options.message}
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                onClick={() => handleConfirmAction(false)}
                className="px-4 py-2 rounded-full border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition-colors cursor-pointer"
              >
                {confirmState.options.cancelText || 'Cancel'}
              </button>
              <button
                onClick={() => handleConfirmAction(true)}
                className={`px-5 py-2 rounded-full text-white text-xs font-semibold shadow-sm transition-all cursor-pointer ${
                  confirmState.options.isDestructive
                    ? 'bg-rose-600 hover:bg-rose-700'
                    : 'bg-[#0D3833] hover:bg-[#111f54]'
                }`}
              >
                {confirmState.options.confirmText || 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}
    </NotificationContext.Provider>
  );
};

export const useNotification = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotification must be used within a NotificationProvider');
  }
  return context;
};
