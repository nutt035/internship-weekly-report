/* -------------------------------------------------------------------------- */
/*                            Shared Types                                    */
/* -------------------------------------------------------------------------- */

/** Response shape returned by POST /api/weekly-report. */
export interface ApiResponse {
  success: boolean;
  message?: string;
  error?: string;
  docUrl?: string;
}
