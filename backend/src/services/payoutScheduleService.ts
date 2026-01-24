import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export enum ScheduleFrequency {
  DAILY = 'daily',
  WEEKLY = 'weekly',
  MONTHLY = 'monthly',
  QUARTERLY = 'quarterly',
}

export enum ScheduleStatus {
  ACTIVE = 'active',
  PAUSED = 'paused',
  COMPLETED = 'completed',
  FAILED = 'failed',
}

export interface PayoutScheduleInput {
  name: string;
  description?: string;
  frequency: ScheduleFrequency;
  nextExecutionDate: Date;
  investorFilter?: {
    includeAll?: boolean;
    investorIds?: string[];
  };
  payoutMinimum?: number; // Minimum payout amount to include
  autoApprove?: boolean; // Auto-approve payouts created by schedule
}

export interface PayoutScheduleExecution {
  scheduleId: string;
  executionDate: Date;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  payoutsCreated: number;
  payoutAmount: number;
  errorMessage?: string;
}

export class PayoutScheduleService {
  /**
   * Create a new payout schedule
   */
  async createSchedule(input: PayoutScheduleInput) {
    // Store schedule metadata in a JSON file or database table
    // For now, we'll create a record in a schedules collection
    const schedule = {
      id: `schedule_${Date.now()}`,
      ...input,
      status: ScheduleStatus.ACTIVE,
      createdAt: new Date(),
      lastExecutionDate: null as Date | null,
    };

    // In production, persist to database
    console.log('Created payout schedule:', schedule);
    return schedule;
  }

  /**
   * Get all active schedules
   */
  async getActiveSchedules() {
    // In production, fetch from database
    return [];
  }

  /**
   * Get schedule by ID
   */
  async getSchedule(scheduleId: string) {
    // In production, fetch from database
    return null;
  }

  /**
   * Update schedule
   */
  async updateSchedule(
    scheduleId: string,
    updates: Partial<PayoutScheduleInput>
  ) {
    // In production, update in database
    return null;
  }

  /**
   * Pause a schedule
   */
  async pauseSchedule(scheduleId: string) {
    // In production, update status in database
    console.log(`Paused schedule: ${scheduleId}`);
  }

  /**
   * Resume a paused schedule
   */
  async resumeSchedule(scheduleId: string) {
    // In production, update status in database
    console.log(`Resumed schedule: ${scheduleId}`);
  }

  /**
   * Delete a schedule
   */
  async deleteSchedule(scheduleId: string) {
    // In production, delete from database
    console.log(`Deleted schedule: ${scheduleId}`);
  }

  /**
   * Execute scheduled payouts for active cycles
   * This would typically run as a cron job
   */
  async executeScheduledPayouts(scheduleId?: string): Promise<PayoutScheduleExecution> {
    try {
      // Find cycles that recently completed (last 24 hours)
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const completedCycles = await prisma.cycle.findMany({
        where: {
          status: 'completed',
          endDate: {
            gte: oneDayAgo,
          },
          // Exclude cycles that already have payouts
          payouts: {
            none: {},
          },
        },
        include: {
          investments: true,
          revenues: true,
          expenses: true,
        },
      });

      let payoutsCreated = 0;
      let payoutAmount = 0;

      // For each completed cycle, calculate and create payouts
      for (const cycle of completedCycles) {
        const totalRevenue = cycle.revenues?.reduce((sum, r) => sum + r.amount, 0) || 0;
        const totalExpenses = cycle.expenses?.reduce((sum, e) => sum + e.amount, 0) || 0;
        const grossProfit = totalRevenue - totalExpenses;
        const totalInvestment = cycle.investments?.reduce((sum, i) => sum + i.amount, 0) || 0;

        // Calculate payouts for each investor
        for (const investment of cycle.investments || []) {
          const sharePercentage = totalInvestment > 0 
            ? investment.amount / totalInvestment 
            : 0;

          // 60% of revenue goes to investors, 40% kept as profit
          const investorShare = (sharePercentage * totalRevenue * 0.6) + (sharePercentage * grossProfit * 0.4);

          if (investorShare > 0) {
            const payout = await prisma.payout.create({
              data: {
                investorId: investment.investorId,
                cycleId: cycle.id,
                amount: investorShare,
                status: 'pending',
                revenueShare: sharePercentage * totalRevenue * 0.6,
                profitShare: sharePercentage * grossProfit * 0.4,
                createdAt: new Date(),
              },
            });

            payoutsCreated++;
            payoutAmount += investorShare;
          }
        }
      }

      return {
        scheduleId: scheduleId || 'manual',
        executionDate: new Date(),
        status: 'completed',
        payoutsCreated,
        payoutAmount,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return {
        scheduleId: scheduleId || 'manual',
        executionDate: new Date(),
        status: 'failed',
        payoutsCreated: 0,
        payoutAmount: 0,
        errorMessage,
      };
    }
  }

  /**
   * Process batch payouts (approval and payment)
   */
  async processBatchPayouts(
    payoutIds: string[],
    paymentReference: string
  ) {
    const results = [];

    for (const payoutId of payoutIds) {
      try {
        const payout = await prisma.payout.update({
          where: { id: payoutId },
          data: {
            status: 'processing',
            paymentReference,
            updatedAt: new Date(),
          },
        });

        results.push({
          payoutId,
          status: 'success',
          payout,
        });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        results.push({
          payoutId,
          status: 'failed',
          error: errorMessage,
        });
      }
    }

    return {
      processed: results.filter(r => r.status === 'success').length,
      failed: results.filter(r => r.status === 'failed').length,
      results,
    };
  }

  /**
   * Get execution history for a schedule
   */
  async getExecutionHistory(scheduleId: string, limit: number = 10) {
    // In production, fetch from execution history table
    return [];
  }

  /**
   * Calculate next execution date
   */
  calculateNextExecutionDate(
    frequency: ScheduleFrequency,
    currentDate: Date = new Date()
  ): Date {
    const next = new Date(currentDate);

    switch (frequency) {
      case ScheduleFrequency.DAILY:
        next.setDate(next.getDate() + 1);
        break;
      case ScheduleFrequency.WEEKLY:
        next.setDate(next.getDate() + 7);
        break;
      case ScheduleFrequency.MONTHLY:
        next.setMonth(next.getMonth() + 1);
        break;
      case ScheduleFrequency.QUARTERLY:
        next.setMonth(next.getMonth() + 3);
        break;
    }

    // Set execution time to 2 AM
    next.setHours(2, 0, 0, 0);
    return next;
  }

  /**
   * Retry failed payout from a schedule
   */
  async retryFailedPayouts(executionId: string) {
    console.log(`Retrying failed payouts from execution: ${executionId}`);
    // Implementation would fetch failed payouts and retry
  }

  /**
   * Get schedule statistics
   */
  async getScheduleStats(scheduleId: string) {
    // In production, calculate from execution history
    return {
      totalExecutions: 0,
      successfulExecutions: 0,
      failedExecutions: 0,
      totalPayoutsCreated: 0,
      totalPayoutAmount: 0,
      averagePayoutSize: 0,
    };
  }
}

export default new PayoutScheduleService();
