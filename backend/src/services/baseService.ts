import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Base Service Class
 * Provides common CRUD operations and patterns for all services
 */
export abstract class BaseService {
  protected prisma = prisma;

  /**
   * Get all records with filtering, pagination, and sorting
   */
  async getAll(filters: any = {}, pagination: any = {}) {
    const { page = 1, limit = 10, sortBy = 'createdAt', sortOrder = 'desc' } = pagination;
    const offset = (page - 1) * limit;

    const where = this.buildWhereClause(filters);

    const [records, total] = await Promise.all([
      this.getAllRecords(where, { limit, offset, sortBy, sortOrder }),
      this.countRecords(where),
    ]);

    return {
      data: records,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get single record by ID
   */
  async getById(id: string) {
    const record = await this.getRecordById(id);
    if (!record) {
      throw new Error('Record not found');
    }
    return record;
  }

  /**
   * Create new record
   */
  async create(data: any, userId?: string) {
    await this.validateCreateData(data);
    const payload = { ...data };
    if (userId) payload.createdBy = userId;
    return await this.createRecord(payload);
  }

  /**
   * Update record
   */
  async update(id: string, data: any, userId?: string) {
    const record = await this.getRecordById(id);
    if (!record) {
      throw new Error('Record not found');
    }
    await this.validateUpdateData(data, record);
    const payload = { ...data };
    if (userId) payload.updatedBy = userId;
    return await this.updateRecord(id, payload);
  }

  /**
   * Delete record (soft delete if supported)
   */
  async delete(id: string) {
    const record = await this.getRecordById(id);
    if (!record) {
      throw new Error('Record not found');
    }
    return await this.deleteRecord(id);
  }

  /**
   * Override these methods in child services
   */
  protected abstract getAllRecords(where: any, options: any): Promise<any[]>;
  protected abstract countRecords(where: any): Promise<number>;
  protected abstract getRecordById(id: string): Promise<any>;
  protected abstract createRecord(data: any): Promise<any>;
  protected abstract updateRecord(id: string, data: any): Promise<any>;
  protected abstract deleteRecord(id: string): Promise<any>;
  protected buildWhereClause(filters: any): any {
    return {};
  }
  protected async validateCreateData(data: any): Promise<void> {}
  protected async validateUpdateData(data: any, record: any): Promise<void> {}
}
