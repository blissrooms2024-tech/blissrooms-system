import { z } from "zod";

const optDate = z
  .string()
  .trim()
  .optional()
  .transform((v) => (v ? new Date(v) : undefined));

export const contractFormSchema = z.object({
  roomCode: z.string().trim().min(1),
  agentId: z.string().trim().optional(), // userCode, admin-only override
  tenantCode: z.string().trim().min(1), // userCode of a pre-created tenant profile
  moveInDate: optDate,
  commencementDate: optDate,
  expiredDate: optDate,
  tenureMonths: z.coerce.number().optional(),
  roomRental: z.coerce.number().min(0).default(0),
  carparkRental: z.coerce.number().min(0).default(0),
  securityDeposit: z.coerce.number().min(0).default(0),
  utilitiesDeposit: z.coerce.number().min(0).default(0),
  accessCardDeposit: z.coerce.number().min(0).default(0),
  adminFee: z.coerce.number().min(0).default(0),
  remarks: z.string().trim().optional().default(""),
  nationality: z.string().trim().optional().default(""),
  contactNumber: z.string().trim().optional().default(""),
  email: z.string().trim().optional().default(""),
  occupation: z.string().trim().optional().default(""),
  company: z.string().trim().optional().default(""),
  carPlate: z.string().trim().optional().default(""),
  emergencyName: z.string().trim().optional().default(""),
  emergencyContact: z.string().trim().optional().default(""),
  emergencyRelationship: z.string().trim().optional().default(""),
  utilDryer: z.boolean().optional().default(false),
  utilAircond: z.boolean().optional().default(false),
  utilElectric: z.boolean().optional().default(false),
});

export type ContractFormInput = z.infer<typeof contractFormSchema>;

/** Editing a contract corrects its printed details but never re-links the tenant account
 * (tenantId is set once at creation via tenantCode) — so this takes free-text name/IC instead. */
export const contractEditSchema = contractFormSchema
  .omit({ roomCode: true, agentId: true, tenantCode: true })
  .extend({
    tenantName: z.string().trim().min(1),
    tenantIc: z.string().trim().optional().default(""),
  });
