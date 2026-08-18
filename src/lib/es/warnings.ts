import { fmtNumber } from './format'

/**
 * Shared prose. Wording is asserted by tests and read by users, so change it
 * deliberately: these strings are the tool's actual teaching, not decoration.
 */
export const W = {
  /**
   * Standing notice. The sign of a converted d is the single most common
   * error in this direction of conversion, and nothing in the arithmetic
   * can detect it.
   */
  signConvention:
    'An event that is more likely in the experimental arm gives a positive d. If the event is a harm, a positive d is the worse result. If the odds ratio came from dichotomising a continuous scale, the sign depends on which direction was counted as response.',

  /** Standing notice: what this tool deliberately does not produce. */
  pointEstimatesOnly:
    'These conversions transform a point estimate, not its uncertainty. To pool converted effect sizes you must also convert the standard error, which this tool does not do.',

  spreadBetweenMethods: (low: number, high: number) =>
    `The methods disagree by ${fmtNumber(high - low)} (from ${fmtNumber(low)} to ${fmtNumber(high)}). That spread is the size of the modelling assumption, not sampling error — pick one method a priori and say so.`,

  smdFromRoundedRates:
    'Event rates recovered from a ratio are only as precise as the ratio you typed. Two decimal places on an odds ratio can move the recovered control event rate by several percentage points.',
} as const
