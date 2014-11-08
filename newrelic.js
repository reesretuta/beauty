/**
 * New Relic agent configuration.
 *
 * See lib/config.defaults.js in the agent distribution for a more complete
 * description of configuration variables and their potential values.
 */
exports.config = {
  /**
   * Array of application names.
   */
  app_name : ['Jafra Dev'],
  /**
   * Your New Relic license key.
   */
  license_key : '6cb8be9e638d707d85e18c3ca12f3aacf5341d58',
  logging : {
    /**
     * Level at which to log. 'trace' is most useful to New Relic when diagnosing
     * issues with the agent, 'info' and higher will impose the least overhead on
     * production applications.
     */
    level : 'info'
  },
  error_collector : {
      ignore_status_codes: [401, 404]
  }
};
