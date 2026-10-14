import { z } from 'zod';

export const ProductionStageCodeSchema = z.enum([
    'WARPING',
    'WEAVING',
    'DYEING',
    'CUTTING',
    'STITCHING',
    'FINISHING',
    'PACKING',
    'GENERAL_PROCESS',
  ]);
export type ProductionStageCode = z.infer<typeof ProductionStageCodeSchema>;

export const DowntimeCategorySchema = z.enum([
    'PLANNED_MAINTENANCE',
    'CHANGEOVER',
    'MECHANICAL_FAILURE',
    'YARN_BREAKAGE',
    'MATERIAL_SHORTAGE',
    'QUALITY_HOLD',
    'POWER_UTILITY',
  ]);
export type DowntimeCategory = z.infer<typeof DowntimeCategorySchema>;

export const ExecuteRoutingStepSchema = z.object({
    stepId: z.string().min(1),
    status: z.enum(['PENDING', 'IN_PROGRESS', 'PAUSED', 'COMPLETED', 'SKIPPED']),
    actualSetupMins: z.number().int().nonnegative().default(0),
    actualRunMins: z.number().int().nonnegative().default(0),
    downtimeMins: z.number().int().nonnegative().default(0),
    inputQuantityScaled: z.number().int().nonnegative().default(0),
    goodOutputScaled: z.number().int().nonnegative().default(0),
    scrapOutputScaled: z.number().int().nonnegative().default(0),
    reworkOutputScaled: z.number().int().nonnegative().default(0),
    notes: z.string().optional(),
});
export type ExecuteRoutingStepDto = z.infer<typeof ExecuteRoutingStepSchema>;

export const RecordDowntimeSchema = z.object({
    workCenterId: z.string().min(1),
    workOrderId: z.string().optional(),
    routingStepId: z.string().optional(),
    category: DowntimeCategorySchema,
    isPlanned: z.boolean().default(false),
    durationMins: z.number().int().positive(),
    reasonAr: z.string().min(1),
    reasonEn: z.string().min(1),
    startedAt: z.string().optional(),
});
export type RecordDowntimeDto = z.infer<typeof RecordDowntimeSchema>;

export const CreateCutPlanSchema = z.object({
    workOrderId: z.string().min(1),
    fabricItemId: z.string().min(1),
    dyeLotCode: z.string().optional(),
    shadeGroup: z.string().optional(),
    markerLengthMetersScaled: z.number().int().positive(),
    markerWidthCm: z.number().int().positive(),
    markerEfficiencyPctScaled: z.number().int().min(1000).max(10000),
    shrinkageAllowancePctScaled: z.number().int().min(0).max(5000).default(0),
    plannedPlies: z.number().int().positive(),
    netFabricRequiredScaled: z.number().int().positive(),
    actualFabricConsumedScaled: z.number().int().nonnegative().default(0),
    endBitWasteScaled: z.number().int().nonnegative().default(0),
    piecesPerLay: z.number().int().positive().default(1),
});
export type CreateCutPlanDto = z.infer<typeof CreateCutPlanSchema>;

export const FourPointDefectEntrySchema = z.object({
    defectCode: z.string().min(1),
    defectNameAr: z.string().min(1),
    defectNameEn: z.string().min(1),
    meterPositionScaled: z.number().int().nonnegative().optional(),
    defectSizeInchesScaled: z.number().int().positive().optional(),
    penaltyPoints: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]),
    isMajor: z.boolean().default(false),
    notes: z.string().optional(),
});

export const RecordFourPointInspectionSchema = z.object({
    lotId: z.string().min(1),
    workOrderId: z.string().optional(),
    inspectedLengthMetersScaled: z.number().int().positive(),
    inspectedWidthCm: z.number().int().positive(),
    targetGsm: z.number().int().positive().optional(),
    measuredGsm: z.number().int().positive().optional(),
    warpShrinkagePctScaled: z.number().int().default(0),
    weftShrinkagePctScaled: z.number().int().default(0),
    colorFastnessGrade: z.number().int().min(1).max(5).optional(),
    shadeMatchStatus: z.enum(['PASS', 'MARGINAL', 'FAIL']).default('PASS'),
    maxAllowedPoints100SqmScaled: z.number().int().positive().default(200000),
    defects: z.array(FourPointDefectEntrySchema).default([]),
    notes: z.string().optional(),
});
export type RecordFourPointInspectionDto = z.infer<typeof RecordFourPointInspectionSchema>;

export interface WorkCenterOeeDto {
    workCenterId: string;
    code: string;
    nameAr: string;
    nameEn: string;
    availabilityPct: number;
    performancePct: number;
    qualityPct: number;
    oeePct: number;
    totalPlannedRunMins: number;
    totalActualRunMins: number;
    totalUnplannedDowntimeMins: number;
    goodUnitsScaled: number;
    scrapUnitsScaled: number;
}

export interface ExecutiveBusinessAnalyticsDto {
    overallOeePct: number;
    firstPassYieldPct: number;
    onTimeCompletionRatePct: number;
    totalScrapLossMinor: number;
    totalMaterialVarianceMinor: number;
    totalLaborOverheadVarianceMinor: number;
    estimatedGrossMarginPct: number;
    workCenterOee: WorkCenterOeeDto[];
    topDowntimeReasons: Array<{ category: DowntimeCategory; totalMins: number; sharePct: number }>;
    unitEconomicsByProduct: Array<{
      itemId: string;
      code: string;
      nameAr: string;
      nameEn: string;
      sellingPriceMinor: number;
      standardCostMinor: number;
      actualAvgCostMinor: number;
      grossMarginMinor: number;
      grossMarginPct: number;
    }>;
}
