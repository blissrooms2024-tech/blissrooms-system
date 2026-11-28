import { z } from "zod";

/** Request bodies for the 待办 API. */

const isoDay = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "日期不对");

export const todoSchema = z.object({
  title: z.string().trim().min(1, "请填要做什么").max(200),
  note: z.string().trim().max(2000).nullable().optional(),
  dueDate: isoDay.nullable().optional(),
  /** Whose to-do it is — leave out for your own. Only Boss / Admin give to-dos to others. */
  ownerId: z.string().min(1).nullable().optional(),
});

export const todoPatchSchema = todoSchema.partial().extend({
  status: z.enum(["OPEN", "DONE"]).optional(),
});
