import type { CalendarEventSource, CalendarOwnerType } from "@prisma/client";

export interface CalendarOwner {
  type: CalendarOwnerType;
  photographerProfileId?: string;
  studioHallId?: string;
}

export interface TimeRange {
  startTime: Date;
  endTime: Date;
}

export interface AvailableSlot {
  startTime: Date;
  endTime: Date;
  startLabel: string;
  endLabel: string;
}

export interface AvailabilityRuleInput {
  startTime: string;
  endTime: string;
  isActive: boolean;
  minDurationMinutes: number;
  slotStepMinutes: number;
  bufferBeforeMinutes: number;
  bufferAfterMinutes: number;
}

export interface ManualBusyEventInput extends TimeRange {
  owner: CalendarOwner;
  title?: string;
  privateNote?: string;
  createdById?: string;
}

export interface AvailabilityQueryInput {
  owner: CalendarOwner;
  date: string;
  durationMinutes: number;
}

export interface DashboardCalendarEvent extends TimeRange {
  id: string;
  source: CalendarEventSource | "ACTIVE_HOLD";
  title: string;
  privateNote?: string;
  canDelete: boolean;
}

export interface ClientAvailableSlot {
  value: string;
  label: string;
  endLabel: string;
}
