import pool from "../config/db.config"

export async function saveScheduledJob(job: any) {
    const query = `
      INSERT INTO scheduled_jobs (
        job_id, type, page_id, message, description, scheduled_time,
        has_media, media_type, media_path, status
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
      ON CONFLICT (job_id) DO NOTHING;
    `
    const values = [
      job.job_id,
      job.type,
      job.page_id,
      job.message || null,
      job.description || null,
      job.scheduled_time,
      job.has_media || false,
      job.media_type || null,
      job.media_path || null,
      'scheduled',
    ]
    await pool.query(query, values)
  }
  
  export async function deleteScheduledJob(jobId: string) {
    await pool.query("DELETE FROM scheduled_jobs WHERE job_id = $1", [jobId])
  }
  
  export async function getAllScheduledJobs() {
    const result = await pool.query("SELECT * FROM scheduled_jobs ORDER BY scheduled_time ASC")
    return result.rows
  }

  export async function updateJobStatus(jobId: string, status: string) {
    const query = `
      UPDATE scheduled_jobs
      SET status = $1
      WHERE job_id = $2
    `
    await pool.query(query, [status, jobId])
  }
  