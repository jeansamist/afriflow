import type { ComponentType } from "react";
import { template as proActivated } from "./pro-activated";
import { template as topupReceipt } from "./topup-receipt";
import { template as payoutCredited } from "./payout-credited";
import { template as kycUpdate } from "./kyc-update";
import { template as lowMinutes } from "./low-minutes";
import { template as trialExpiring } from "./trial-expiring";
import { template as subscriptionExpiring3d } from "./subscription-expiring-3d";
import { template as subscriptionExpiring2d } from "./subscription-expiring-2d";
import { template as subscriptionExpiring1d } from "./subscription-expiring-1d";
import { template as subscriptionExpired } from "./subscription-expired";
import { template as numberReleaseWarning } from "./number-release-warning";
import { template as numberReleased } from "./number-released";
import { template as adminKycSubmitted } from "./admin-kyc-submitted";
import { template as adminPaymentLinkCreated } from "./admin-payment-link-created";

export interface TemplateEntry {
  component: ComponentType<any>;
  subject: string | ((data: Record<string, any>) => string);
  displayName?: string;
  previewData?: Record<string, any>;
  to?: string;
}

export const TEMPLATES: Record<string, TemplateEntry> = {
  "pro-activated": proActivated,
  "topup-receipt": topupReceipt,
  "payout-credited": payoutCredited,
  "kyc-update": kycUpdate,
  "low-minutes": lowMinutes,
  "trial-expiring": trialExpiring,
  "subscription-expiring-3d": subscriptionExpiring3d,
  "subscription-expiring-2d": subscriptionExpiring2d,
  "subscription-expiring-1d": subscriptionExpiring1d,
  "subscription-expired": subscriptionExpired,
  "number-release-warning": numberReleaseWarning,
  "number-released": numberReleased,
  "admin-kyc-submitted": adminKycSubmitted,
  "admin-payment-link-created": adminPaymentLinkCreated,
};
