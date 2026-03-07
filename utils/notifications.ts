export type AppNoticeType = "success" | "error" | "warning" | "info";

export interface AppNotice {
  id?: string;
  type: AppNoticeType;
  message: string;
}

export const APP_NOTICE_EVENT = "app-notice";

export const notifyApp = (notice: AppNotice) => {
  if (typeof window === "undefined") return;
  const payload: AppNotice = {
    ...notice,
    id: notice.id || `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  };
  window.dispatchEvent(new CustomEvent<AppNotice>(APP_NOTICE_EVENT, { detail: payload }));
};
