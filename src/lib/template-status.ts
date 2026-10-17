/**
 * Shared display config for message_templates.status.
 *
 * The DB stores Meta's raw enum (DRAFT / APPROVED / PENDING / REJECTED /
 * PAUSED / DISABLED / IN_APPEAL / PENDING_DELETION) — the UI maps it to
 * a human label + dark-theme badge classes here so the template manager,
 * inbox picker, and broadcast picker stay aligned.
 */

import type { MessageTemplateStatus } from '@/types';

export interface TemplateStatusDisplay {
  label: string;
  classes: string;
}

export const templateStatusConfig: Record<
  MessageTemplateStatus,
  TemplateStatusDisplay
> = {
  DRAFT: {
    label: 'Draft',
    classes: 'bg-foreground/5 text-muted-foreground border-foreground/10',
  },
  PENDING: {
    label: 'Pending',
    classes: 'bg-warning/20 text-warning border-warning/30',
  },
  APPROVED: {
    label: 'Approved',
    classes: 'bg-primary/20 text-primary border-primary/30',
  },
  REJECTED: {
    label: 'Rejected',
    classes: 'bg-destructive/20 text-destructive border-destructive/30',
  },
  PAUSED: {
    label: 'Paused',
    classes: 'bg-orange-600/20 text-orange-600 dark:text-orange-400 border-orange-600/30',
  },
  DISABLED: {
    label: 'Disabled',
    classes: 'bg-destructive/5 text-destructive border-destructive/30',
  },
  IN_APPEAL: {
    label: 'In Appeal',
    classes: 'bg-blue-600/20 text-blue-600 dark:text-blue-400 border-blue-600/30',
  },
  PENDING_DELETION: {
    label: 'Pending Deletion',
    classes: 'bg-foreground/5 text-muted-foreground border-foreground/5',
  },
};
