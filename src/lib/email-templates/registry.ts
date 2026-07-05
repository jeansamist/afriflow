import type { ComponentType } from 'react'
import { template as proActivated } from './pro-activated'
import { template as topupReceipt } from './topup-receipt'
import { template as payoutCredited } from './payout-credited'
import { template as kycUpdate } from './kyc-update'
import { template as lowMinutes } from './low-minutes'
import { template as trialExpiring } from './trial-expiring'
import { template as subscriptionExpiring3d } from './subscription-expiring-3d'
import { template as subscriptionExpiring1d } from './subscription-expiring-1d'
import { template as subscriptionExpired } from './subscription-expired'

export interface TemplateEntry {
  component: ComponentType<any>
  subject: string | ((data: Record<string, any>) => string)
  displayName?: string
  previewData?: Record<string, any>
  to?: string
}

export const TEMPLATES: Record<string, TemplateEntry> = {
  'pro-activated': proActivated,
  'topup-receipt': topupReceipt,
  'payout-credited': payoutCredited,
  'kyc-update': kycUpdate,
  'low-minutes': lowMinutes,
  'trial-expiring': trialExpiring,
  'subscription-expiring-3d': subscriptionExpiring3d,
  'subscription-expiring-1d': subscriptionExpiring1d,
  'subscription-expired': subscriptionExpired,
}
