import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export enum TransferStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
}

export interface BankingDetails {
  accountNumber: string;
  bankCode: string;
  accountName: string;
}

export interface FundTransferInput {
  payoutId: string;
  investorId: string;
  amount: number;
  bankingDetails: BankingDetails;
  reference?: string;
}

export interface TransferResult {
  transferId: string;
  payoutId: string;
  status: TransferStatus;
  amount: number;
  reference: string;
  message: string;
  timestamp: Date;
}

export class BankingIntegrationService {
  private mockTransfers: Map<string, any> = new Map();

  /**
   * Initiate a fund transfer
   * This is a mock implementation - in production, integrate with:
   * - M-Pesa API for mobile money
   * - Local bank APIs (Safaricom, KCB, Equity, etc.)
   * - Third-party payment providers (Pesapal, Jambopay, etc.)
   */
  async initiateFundTransfer(input: FundTransferInput): Promise<TransferResult> {
    try {
      // Validate investor exists
      const investor = await prisma.investor.findUnique({
        where: { id: input.investorId },
      });

      if (!investor) {
        throw new Error('Investor not found');
      }

      // Validate payout exists
      const payout = await prisma.payout.findUnique({
        where: { id: input.payoutId },
      });

      if (!payout) {
        throw new Error('Payout not found');
      }

      // Validate amount matches payout
      if (input.amount !== payout.amount) {
        throw new Error('Transfer amount does not match payout amount');
      }

      // Create transfer record
      const transferId = `tfr_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const reference = input.reference || `GFH-${payout.id.substring(0, 8)}-${Date.now()}`;

      // Mock banking API call
      const transferResult = await this.processMockTransfer({
        transferId,
        payoutId: input.payoutId,
        investorId: input.investorId,
        amount: input.amount,
        bankingDetails: input.bankingDetails,
        reference,
      });

      // Record transaction
      await this.recordTransferTransaction(
        input.investorId,
        input.payoutId,
        input.amount,
        reference,
        transferResult.status
      );

      // Update payout status if transfer succeeded
      if (transferResult.status === TransferStatus.COMPLETED) {
        await prisma.payout.update({
          where: { id: input.payoutId },
          data: {
            status: 'paid',
            paymentReference: reference,
            updatedAt: new Date(),
          },
        });
      }

      return transferResult;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Transfer failed';
      
      return {
        transferId: `tfr_${Date.now()}`,
        payoutId: input.payoutId,
        status: TransferStatus.FAILED,
        amount: input.amount,
        reference: input.reference || 'unknown',
        message: errorMessage,
        timestamp: new Date(),
      };
    }
  }

  /**
   * Mock banking API implementation
   * In production, replace with actual bank API calls
   */
  private async processMockTransfer(input: any): Promise<TransferResult> {
    // Simulate API processing time
    await new Promise(resolve => setTimeout(resolve, 500));

    // 95% success rate for demo purposes
    const success = Math.random() < 0.95;

    if (success) {
      this.mockTransfers.set(input.transferId, {
        ...input,
        status: TransferStatus.COMPLETED,
        completedAt: new Date(),
      });

      return {
        transferId: input.transferId,
        payoutId: input.payoutId,
        status: TransferStatus.COMPLETED,
        amount: input.amount,
        reference: input.reference,
        message: `Transfer successful. Reference: ${input.reference}. Funds will be deposited within 1-2 business days.`,
        timestamp: new Date(),
      };
    } else {
      // Simulate occasional failures
      this.mockTransfers.set(input.transferId, {
        ...input,
        status: TransferStatus.FAILED,
        failedAt: new Date(),
        error: 'Insufficient account balance or invalid account details',
      });

      return {
        transferId: input.transferId,
        payoutId: input.payoutId,
        status: TransferStatus.FAILED,
        amount: input.amount,
        reference: input.reference,
        message: 'Transfer failed. Please check banking details and try again.',
        timestamp: new Date(),
      };
    }
  }

  /**
   * Verify transfer status
   */
  async verifyTransferStatus(transferId: string): Promise<TransferResult | null> {
    try {
      // Check mock transfers first
      const mockTransfer = this.mockTransfers.get(transferId);
      if (mockTransfer) {
        return {
          transferId,
          payoutId: mockTransfer.payoutId,
          status: mockTransfer.status,
          amount: mockTransfer.amount,
          reference: mockTransfer.reference,
          message: mockTransfer.status === TransferStatus.COMPLETED 
            ? 'Transfer completed successfully'
            : mockTransfer.error || 'Transfer failed',
          timestamp: mockTransfer.completedAt || mockTransfer.failedAt || new Date(),
        };
      }

      // In production, query actual bank API
      console.log(`Checking transfer status with bank API: ${transferId}`);

      return null;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Status check failed';
      throw new Error(`Failed to verify transfer: ${errorMessage}`);
    }
  }

  /**
   * Record financial transaction for the transfer
   */
  private async recordTransferTransaction(
    investorId: string,
    payoutId: string,
    amount: number,
    reference: string,
    status: TransferStatus
  ): Promise<void> {
    try {
      const payout = await prisma.payout.findUnique({
        where: { id: payoutId },
      });

      if (!payout) {
        throw new Error('Payout not found for transaction recording');
      }

      await prisma.transaction.create({
        data: {
          type: 'transfer',
          amount,
          description: `Fund transfer to investor`,
          reference,
          investorId,
          payoutId,
          cycleId: payout.cycleId || undefined,
          transactionDate: new Date(),
          notes: `Status: ${status}`,
        },
      });
    } catch (error) {
      console.error('Failed to record transfer transaction:', error);
      // Don't throw - continue even if transaction logging fails
    }
  }

  /**
   * Retry a failed transfer
   */
  async retryTransfer(transferId: string): Promise<TransferResult> {
    try {
      const transfer = this.mockTransfers.get(transferId);
      
      if (!transfer) {
        throw new Error('Transfer not found');
      }

      if (transfer.status === TransferStatus.COMPLETED) {
        throw new Error('Cannot retry a completed transfer');
      }

      // Create new transfer attempt
      return this.processMockTransfer({
        transferId: `${transferId}_retry_${Date.now()}`,
        ...transfer,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Retry failed';
      
      return {
        transferId,
        payoutId: transferId.split('_')[1],
        status: TransferStatus.FAILED,
        amount: 0,
        reference: 'unknown',
        message: errorMessage,
        timestamp: new Date(),
      };
    }
  }

  /**
   * Get transfer history
   */
  async getTransferHistory(investorId: string, limit: number = 10) {
    try {
      const transactions = await prisma.transaction.findMany({
        where: {
          investorId,
          type: 'transfer',
        },
        orderBy: { transactionDate: 'desc' },
        take: limit,
      });

      return transactions.map((t: any) => ({
        transferId: t.reference,
        amount: t.amount,
        date: t.transactionDate,
        status: t.notes?.includes('COMPLETED') ? TransferStatus.COMPLETED : TransferStatus.FAILED,
        reference: t.reference,
      }));
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to fetch history';
      throw new Error(`Failed to get transfer history: ${errorMessage}`);
    }
  }

  /**
   * Batch transfer for multiple payouts
   */
  async batchTransfer(transfers: FundTransferInput[]): Promise<{
    successful: number;
    failed: number;
    results: TransferResult[];
  }> {
    const results: TransferResult[] = [];

    for (const transfer of transfers) {
      try {
        const result = await this.initiateFundTransfer(transfer);
        results.push(result);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Transfer failed';
        results.push({
          transferId: `tfr_${Date.now()}`,
          payoutId: transfer.payoutId,
          status: TransferStatus.FAILED,
          amount: transfer.amount,
          reference: transfer.reference || 'unknown',
          message: errorMessage,
          timestamp: new Date(),
        });
      }
    }

    return {
      successful: results.filter(r => r.status === TransferStatus.COMPLETED).length,
      failed: results.filter(r => r.status === TransferStatus.FAILED).length,
      results,
    };
  }

  /**
   * Get transfer statistics
   */
  async getTransferStats() {
    try {
      const transactions = await prisma.transaction.findMany({
        where: { type: 'transfer' },
      });

      const completed = transactions.filter((t: any) => t.notes?.includes('COMPLETED')).length;
      const totalAmount = transactions.reduce((sum: number, t: any) => sum + t.amount, 0);

      return {
        totalTransfers: transactions.length,
        completedTransfers: completed,
        failedTransfers: transactions.length - completed,
        totalAmount,
        successRate: transactions.length > 0 
          ? ((completed / transactions.length) * 100).toFixed(2)
          : '0',
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Stats retrieval failed';
      throw new Error(`Failed to get transfer stats: ${errorMessage}`);
    }
  }

  /**
   * Validate banking details format
   */
  validateBankingDetails(details: BankingDetails): boolean {
    // Basic validation
    if (!details.accountNumber || details.accountNumber.length < 5) {
      return false;
    }
    if (!details.bankCode || details.bankCode.length < 3) {
      return false;
    }
    if (!details.accountName || details.accountName.length < 2) {
      return false;
    }
    return true;
  }
}

export default new BankingIntegrationService();
