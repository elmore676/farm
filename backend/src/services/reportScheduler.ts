// Placeholder scheduler; connect to node-cron or BullMQ as needed.
import { reportService } from './report.service';

class ReportScheduler {
  start() {
    // TODO: wire cron jobs based on persisted schedules
    return true;
  }

  async runScheduled(schedule: any) {
    return reportService.generateOnDemand({
      type: schedule.type,
      params: schedule.params,
      format: schedule.format ?? 'pdf',
      requestedBy: schedule.createdBy ?? 'system',
    });
  }
}

export const reportScheduler = new ReportScheduler();
export default reportScheduler;
