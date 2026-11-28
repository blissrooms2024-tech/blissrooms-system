import { z } from "zod";

/** Request bodies for the 会议记录 API. */

const isoTime = z.string().refine((v) => !Number.isNaN(Date.parse(v)), "时间不对");
const isoDay = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const meetingSchema = z.object({
  title: z.string().trim().min(1, "请填会议主题").max(120),
  startsAt: isoTime,
  endsAt: isoTime.nullable().optional(),
  location: z.string().trim().max(120).nullable().optional(),
  attendeeIds: z.array(z.string().min(1)).max(50).default([]),
  guests: z.array(z.string().trim().min(1).max(60)).max(30).default([]),
});

export const meetingPatchSchema = meetingSchema.partial().extend({
  /** DONE = finish the record (notes locked); OPEN = reopen it */
  status: z.enum(["OPEN", "DONE"]).optional(),
});

export const noteSchema = z.object({ body: z.string().max(20000) });

export const issueSchema = z.object({
  title: z.string().trim().min(1, "请填要解决的问题").max(200),
  detail: z.string().trim().max(2000).nullable().optional(),
  /** 谁处理: an account… */
  ownerId: z.string().min(1).nullable().optional(),
  /** …or just a name (someone without an account) */
  ownerName: z.string().trim().max(60).nullable().optional(),
  /** 谁跟进 */
  followUpId: z.string().min(1).nullable().optional(),
  dueDate: isoDay.nullable().optional(),
});

export const issuePatchSchema = issueSchema.partial().extend({
  status: z.enum(["OPEN", "DONE"]).optional(),
  doneNote: z.string().trim().max(500).nullable().optional(),
  /** The meeting it's being marked done at, if any */
  meetingCode: z.string().min(1).nullable().optional(),
});
